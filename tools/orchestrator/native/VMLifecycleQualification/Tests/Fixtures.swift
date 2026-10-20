import Foundation

let fixtureHash = String(repeating: "a", count: 64)
func fixtureID(_ n: Int) -> String { String(format: "00000000-0000-4000-8000-%012d", n) }

func fixtureBinding() throws -> VMExecutionBinding {
    let blob = VMBlob(sha256: fixtureHash, byteLength: 16)
    let binary = VMBinary(blob: blob, version: "synthetic/1", sourceSha: nil)
    return try VMExecutionBinding(runId: fixtureID(1), attemptId: fixtureID(2), hostScopeId: fixtureID(3),
        bootId: fixtureID(4), clockEpochId: fixtureID(5), actors: VMActors(controller: fixtureID(6), owner: fixtureID(7),
        watchdog: fixtureID(8), resources: fixtureID(9), broker: fixtureID(10), reconciler: fixtureID(11)),
        resourceIds: (20..<29).map(fixtureID), workflowRevision: 1, journalSequence: 1, journalHeadHash: fixtureHash,
        acceptedBundleRef: "bundle-v1:\(fixtureHash)", repositoryBaselineSha: "3d184902db7d2a371d9dcc2642061cacf7bb7fec",
        phaseAJobRef: blob, artifacts: VMArtifacts(controller: binary, owner: binary, watchdog: binary, guest: binary,
        image: VMImage(kernel: blob, initramfs: blob, rootDisk: blob), inputProjection: blob), policyDigest: fixtureHash, armedAt: 100)
}

final class FixtureClock: VMClock {
    var reading: VMClockReading
    var onRead: (() -> Void)?
    init(_ b: VMExecutionBinding) { reading = VMClockReading(tick: b.deadlines.armedAt, bootId: b.bootId, epochId: b.clockEpochId) }
    func read() -> VMClockReading { onRead?(); return reading }
}

final class FixtureEffects: VMEffects {
    var creates = 0, stops = 0, escalations = 0, notifications = 0, brokerCalls = 0
    var createResponse = VMCreateResponse.created
    var notificationAccepted = true
    var onCreate: (() -> Void)?, onStop: (() -> Void)?, onNotify: (() -> Void)?, onBroker: (() -> Void)?
    func create() -> VMCreateResponse { creates += 1; onCreate?(); return createResponse }
    func requestStop() { stops += 1; onStop?() }
    func escalate() { escalations += 1 }
    func notifyFence() -> Bool { notifications += 1; onNotify?(); return notificationAccepted }
    func brokerOperation() { brokerCalls += 1; onBroker?() }
}

final class Fixture {
    let binding: VMExecutionBinding
    let clock: FixtureClock
    let effects = FixtureEffects()
    let registry: VMHostRegistry
    let bootstrap: VMSimulationBootstrap
    let catalog: VMSimulationProcedureCatalog
    let model: VMLifecycle
    init(start: Bool = true, binding supplied: VMExecutionBinding? = nil,
         registry: VMHostRegistry = VMHostRegistry(), procedures: Bool = true) throws {
        let b = try supplied ?? fixtureBinding()
        binding = b; clock = FixtureClock(b); self.registry = registry
        bootstrap = try VMSimulationBootstrap(binding: b)
        catalog = procedures ? .simulationFixture(version: "cleanup-simulation/1") : VMSimulationProcedureCatalog()
        model = try VMLifecycle(binding: b, grant: bootstrap.issue(), clock: clock, effects: effects, registry: registry, catalog: catalog)
        if start { try model.arm(); try model.create(); try model.go() }
    }
    func fact(_ claim: VMObligation, value: VMFactValue = .satisfied, n: Int? = nil) -> VMFact {
        let index = VMObligation.allCases.firstIndex(of: claim)!
        return VMFact(id: fixtureID(n ?? (100 + index)), bindingDigest: try! VMWire.digest(binding),
            resourceId: binding.resourceIds[index], claim: claim, value: value, source: claim.source,
            sourceId: binding.actors.id(claim.source), sequence: UInt64(n ?? (100 + index)),
            tick: clock.reading.tick, epochId: binding.clockEpochId, exposureReference: model.ledger.entry(claim).exposureReference)
    }
    func observe(_ claim: VMObligation, value: VMFactValue = .satisfied, n: Int? = nil) throws {
        try model.observe(bootstrap.qualify(fact(claim, value: value, n: n)))
    }
    func cleanup(except: Set<VMObligation> = []) throws {
        for claim in VMObligation.allCases where claim != .brokerFence && claim != .upstream && !except.contains(claim) {
            try observe(claim)
        }
        if !except.contains(.upstream) && effects.brokerCalls > 0 { try observe(.upstream) }
    }
    func normal() throws -> VMQualificationReport {
        try model.completeWorkload(); try cleanup(); return try model.finish()
    }
    func unresolved() throws -> VMQualificationReport {
        clock.reading.tick = binding.deadlines.cleanupBy
        try model.poll(); return try model.finish()
    }
    func recoveryProofs(_ claims: [VMObligation]? = nil) throws -> [VMQualifiedObservation] {
        try (claims ?? model.ledger.outstanding).map { claim in
            var f = fact(claim, n: 500 + VMObligation.allCases.firstIndex(of: claim)!)
            f.source = .reconciler; f.sourceId = binding.actors.reconciler
            return try bootstrap.qualifyRecovery(f)
        }
    }
    func permission() throws -> VMReconciliationPermission {
        try catalog.permission(bindingDigest: VMWire.digest(binding), caseId: model.quarantine!.caseId,
            ledgerDigest: VMWire.digest(model.ledger), revision: model.recoveryRevision)
    }
}

enum TestFailure: Error { case assertion(String) }
func check(_ condition: @autoclosure () throws -> Bool, _ message: String = "assertion") throws {
    if try !condition() { throw TestFailure.assertion(message) }
}
func rejects(_ expected: VMError, _ body: () throws -> Void) throws {
    do { try body() } catch let e as VMError { try check(e == expected, "expected \(expected), got \(e)"); return }
    throw TestFailure.assertion("expected rejection \(expected)")
}
