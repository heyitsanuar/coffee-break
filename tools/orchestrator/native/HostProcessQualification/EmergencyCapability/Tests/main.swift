import Foundation

enum TestFailure: Error { case assertion(String) }
func check(_ value: @autoclosure () throws -> Bool, _ message: String = "assertion failed") throws {
    if try !value() { throw TestFailure.assertion(message) }
}
func rejects(_ expected: CapabilityError, _ body: () throws -> Void) throws {
    do { try body() } catch let error as CapabilityError {
        try check(error == expected, "wrong rejection: \(error)"); return
    }
    throw TestFailure.assertion("expected \(expected)")
}
var passed = 0, failed = 0
func test(_ name: String, _ body: () throws -> Void) {
    do { try body(); passed += 1; print("PASS \(name)") }
    catch { failed += 1; print("FAIL \(name): \(error)") }
}
let session = "11111111-1111-4111-8111-111111111111"
let request = "22222222-2222-4222-8222-222222222222"
let boot = "33333333-3333-4333-8333-333333333333"
let issuerID = "44444444-4444-4444-8444-444444444444"
let holderID = "55555555-5555-4555-8555-555555555555"
let guardID = "66666666-6666-4666-8666-666666666666"
let targetID = "77777777-7777-4777-8777-777777777777"
let objectID = "88888888-8888-4888-8888-888888888888"
let hash = String(repeating: "a", count: 64)
func binding() -> CapabilityBinding {
    CapabilityBinding(experimentID: "HP-01", sessionID: session, requestID: request, bootID: boot,
        planDigest: hash, sourceRevision: String(repeating: "b", count: 40),
        issuer: CapabilityActor(instanceID: issuerID, binaryDigest: hash),
        holder: CapabilityActor(instanceID: holderID, binaryDigest: hash),
        waitOwner: CapabilityActor(instanceID: guardID, binaryDigest: hash),
        target: CapabilityTarget(instanceID: targetID, objectID: objectID, bootID: boot, binaryDigest: hash),
        issuedAt: 100, deadline: 8100, evidenceReferences: [hash])
}
final class FakeClock: CapabilityClock {
    var reading = CapabilityClockReading(milliseconds: 100, bootID: boot, wakeGeneration: 0)
    var tick: UInt64 { get { reading.milliseconds } set { reading.milliseconds = newValue } }
}
final class FakeOperation: CapabilityOperation {
    var response = CapabilityResponse.accepted
    var releaseResult = CapabilityRelease.released
    var requests = 0, releases = 0
    var duringRequest: (() -> Void)?
    var duringRelease: (() -> Void)?
    func terminate() -> CapabilityResponse { requests += 1; duringRequest?(); return response }
    func release() -> CapabilityRelease { releases += 1; duringRelease?(); return releaseResult }
}
final class FakeObservations: CapabilityObservationPort {
    var batch: CapabilityObservationBatch?
    var reads = 0
    func read() -> CapabilityObservationBatch? { reads += 1; return batch }
}
struct Fixture {
    let model: CapabilityLifecycle
    let clock: FakeClock
    let holder: CapabilityHolder
    let creation: CapabilityCreation
    let bootstrap: SimulatedCapabilityBootstrap
    let operation: FakeOperation
    let observations: FakeObservations
}
func fixture(bound b: CapabilityBinding = binding(), proof: ((inout CapabilityProvenance) -> Void)? = nil, qualified: Bool = true, complete: Bool = true) throws -> Fixture {
    let clock = FakeClock(), holder = CapabilityHolder(identity: b.holder)
    clock.reading = CapabilityClockReading(milliseconds: b.issuedAt, bootID: b.bootID, wakeGeneration: 0)
    let creation = CapabilityCreation(binding: b), op = FakeOperation(), observations = FakeObservations()
    var provenance = CapabilityProvenance(bindingDigest: try CapabilityWire.digest(b), issuer: b.issuer, holder: b.holder,
        kernelEmitter: b.target, taskObject: b.target, creationTarget: b.target)
    proof?(&provenance)
    let bootstrap = SimulatedCapabilityBootstrap(provenance: provenance, holder: holder, creation: creation,
        operation: op, qualified: qualified, simulatedPortName: 19, complete: complete)
    let m = try CapabilityLifecycle(binding: b, holder: holder, creation: creation, clock: clock,
        bootstrap: bootstrap, observations: observations)
    return Fixture(model: m, clock: clock, holder: holder, creation: creation, bootstrap: bootstrap, operation: op, observations: observations)
}
func ready(bound b: CapabilityBinding = binding()) throws -> Fixture {
    let f = try fixture(bound: b); try f.model.issue(); try f.model.validate(); try f.model.admitSimulatedGO(holder: f.holder)
    return f
}
func observe(_ f: Fixture, reap: Bool = true, cause: Bool = true) throws {
    let reference = try f.model.report().request?.reference
    f.observations.batch = CapabilityObservationBatch(bindingDigest: try CapabilityWire.digest(binding()), target: binding().target,
        exit: CapabilityExit(code: 9, kind: .forced), reap: reap ? CapabilityReap(owner: f.creation, exit: CapabilityExit(code: 9, kind: .forced)) : nil,
        emergencyCauseReference: cause ? reference : nil, descriptorsClosed: true)
    try f.model.reconcile()
}
func complete() throws -> Fixture {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.releaseRight(holder: f.holder)
    return f
}
func published(_ model: CapabilityLifecycle) throws -> CapabilityReport {
    let store = CapabilityPublication(); try store.stage(model.finish()); try store.commit(); return try store.verified()
}

test("qualified issuance, exact binding, custody and complete modeled reconciliation") {
    let f = try complete(); let r = try published(f.model)
    try check(r.verdict == .pass && r.cleanup == .verifiedSimulation)
    try check(r.established && r.validated && r.request != nil && r.response == .accepted)
    try check(r.facts.exit != nil && r.facts.reap != nil && r.rightReleased)
    try check(r.mode == "simulation" && r.authorization == "none" && !r.allowNativeLaunch)
}
for field in ["issuer", "holder", "binding", "emitter", "object", "creation", "origin"] {
    test("issuance rejects mismatched \(field) before granting authority") {
        let f = try fixture(proof: { p in
            switch field {
            case "issuer": p.issuer.instanceID = targetID
            case "holder": p.holder.instanceID = guardID
            case "binding": p.bindingDigest = String(repeating: "c", count: 64)
            case "emitter": p.kernelEmitter.instanceID = holderID
            case "object": p.taskObject.objectID = issuerID
            case "creation": p.creationTarget.instanceID = issuerID
            default: p.origin = "helper-claim"
            }
        })
        try rejects(.provenance) { try f.model.issue() }
        try check(!f.model.report().established && f.operation.requests == 0)
    }
}
test("default and unqualified bootstrap cannot enable GO or emergency use") {
    let f = try fixture(qualified: false)
    try rejects(.unavailable) { try f.model.issue() }
    try rejects(.inactive) { try f.model.admitSimulatedGO(holder: f.holder) }
    try check(f.operation.requests == 0)
    let b = binding(), holder = CapabilityHolder(identity: binding().holder)
    let m = try CapabilityLifecycle(binding: b, holder: holder, creation: CapabilityCreation(binding: b), clock: FakeClock())
    try rejects(.unavailable) { try m.issue() }
    try check(m.report().verdict == .blocked)
}
test("duplicate issuance and same-identity replacement holder cannot create authority") {
    let f = try ready(); try rejects(.replay) { try f.model.issue() }
    try rejects(.custody) { try f.model.requestEmergency(holder: CapabilityHolder(identity: binding().holder)) }
    try check(f.bootstrap.requests == 1 && f.operation.requests == 0)
}
test("accepted API response and target exit do not imply reap or cleanup") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder)
    try check(f.model.report().facts.exit == nil && f.model.report().cleanup == .unresolved)
    try observe(f, reap: false); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.emergency == .corroboratedSimulation && r.verdict == .unverified && r.cleanup == .unresolved)
}
test("G loss keeps R capability but never invents wait ownership") {
    let f = try ready(); try f.model.loseGuard(); try f.model.requestEmergency(holder: f.holder)
    try observe(f); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.guardLost && r.facts.reap == nil && r.cleanup == .unresolved && r.verdict == .unverified)
}
test("R loss invalidates capability while G retains its separate cleanup responsibility") {
    let f = try ready(); try f.model.loseHolder()
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    try observe(f, cause: false)
    try check(f.model.report().holderLost && f.model.report().facts.reap != nil && !f.model.report().rightReleased)
}
test("revocation during operation preserves response but prevents global success") {
    let f = try ready(); f.operation.duringRequest = { try! f.model.revoke() }
    try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.releaseRight(holder: f.holder)
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    let r = try published(f.model)
    try check(r.response == .accepted && r.verdict == .fail && r.findings.contains(.revokedDuringOperation))
}
test("expiry during injected operation is not erased by late valid cleanup") {
    let f = try ready(); f.operation.duringRequest = { f.clock.tick = 8100 }
    try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.response == .accepted && r.findings.contains(.expiredDuringOperation) && r.verdict == .fail)
}
test("publication positive control and exact incomplete interruption errors") {
    let f = try complete(); let report = try f.model.finish()
    let control = CapabilityPublication(); try control.stage(report); try control.commit(); try check(control.verified().verdict == .pass)
    for point in [CapabilityPublicationInterruption.beforeBytes, .afterBytes] {
        let store = CapabilityPublication(); try store.stage(report)
        try rejects(.interrupted) { try store.commit(interruption: point) }
        try rejects(.incompleteEvidence) { _ = try store.verified() }
    }
}

for field in ["session", "request", "boot", "incarnation", "binary", "plan"] {
    test("exact scope rejects a different \(field)") {
        let f = try ready(); var other = binding()
        switch field {
        case "session": other.sessionID = targetID
        case "request": other.requestID = targetID
        case "boot": other.bootID = targetID; other.target.bootID = targetID
        case "incarnation": other.target.instanceID = issuerID
        case "binary": other.target.binaryDigest = String(repeating: "c", count: 64)
        default: other.planDigest = String(repeating: "c", count: 64)
        }
        try rejects(.provenance) { try f.model.requestEmergency(holder: f.holder, bindingDigest: CapabilityWire.digest(other)) }
        try check(f.operation.requests == 0 && f.model.report().verdict == .fail)
    }
}
for field in ["version", "kind", "mode", "authorization", "launch", "operation", "budget", "boot", "digest", "deadline", "overflow", "references"] {
    test("closed capability contract rejects invalid \(field)") {
        var b = binding()
        switch field {
        case "version": b.version = 2
        case "kind": b.kind = "unknown"
        case "mode": b.mode = "native"
        case "authorization": b.authorization = "approved"
        case "launch": b.allowNativeLaunch = true
        case "operation": b.operation = "unrestricted"
        case "budget": b.usageBudget = 2
        case "boot": b.target.bootID = targetID
        case "digest": b.planDigest = "invalid"
        case "deadline": b.deadline += 1
        case "overflow": b.issuedAt = UInt64.max; b.deadline = 7_999
        default: b.evidenceReferences = [hash, hash]
        }
        try rejects(.contract) { _ = try fixture(bound: b) }
    }
}
test("incomplete bootstrap cannot establish or admit GO") {
    let f = try fixture(complete: false)
    try rejects(.unavailable) { try f.model.issue() }
    try rejects(.inactive) { try f.model.admitSimulatedGO(holder: f.holder) }
    try check(!f.model.report().validated && f.operation.requests == 0)
}
test("bootstrap grant cannot be replayed into a second lifecycle") {
    let f = try ready()
    let replay = try CapabilityLifecycle(binding: binding(), holder: f.holder, creation: f.creation, clock: f.clock,
        bootstrap: f.bootstrap, observations: f.observations)
    try rejects(.replay) { try replay.issue() }
    try check(!replay.report().established && f.model.report().established)
}
test("a second qualified fake issuer cannot duplicate the same creation authority") {
    let f = try ready()
    let bootstrap = SimulatedCapabilityBootstrap(provenance: try f.model.report().provenance!, holder: f.holder,
        creation: f.creation, operation: f.operation, qualified: true, simulatedPortName: 19)
    let duplicate = try CapabilityLifecycle(binding: binding(), holder: f.holder, creation: f.creation, clock: f.clock, bootstrap: bootstrap)
    try rejects(.replay) { try duplicate.issue() }
    try check(!duplicate.report().established && f.operation.requests == 0)
}
test("equal serialized holder metadata has no custody or transfer rights") {
    let f = try ready()
    let metadata = try CapabilityWire.decode(CapabilityActor.self, from: CapabilityWire.encode(binding().holder))
    let replacement = CapabilityHolder(identity: metadata)
    try rejects(.custody) { try f.model.requestEmergency(holder: replacement) }
    try rejects(.custody) { try f.model.releaseRight(holder: replacement) }
    try check(f.operation.requests == 0 && f.operation.releases == 0)
}
test("helper claims and persisted reports cannot bootstrap authority") {
    let report = try complete().model.finish(), f = try fixture(qualified: false)
    try rejects(.provenance) { try f.model.receiveHelper(CapabilityWire.encode(report)) }
    try rejects(.provenance) { try f.model.receiveHelper(Data("{\"pid\":123,\"port\":19}".utf8)) }
    try rejects(.unavailable) { try f.model.issue() }
    try check(f.model.report().provenance == nil && !f.model.report().established && f.operation.requests == 0)
}
test("revoked capability stays unusable when a simulated port number is reused") {
    let old = try ready(); try old.model.revoke()
    var next = binding(); next.target.instanceID = "99999999-9999-4999-8999-999999999999"
    let fresh = try ready(bound: next)
    try check(old.bootstrap.simulatedPortName == fresh.bootstrap.simulatedPortName)
    try rejects(.inactive) { try old.model.requestEmergency(holder: old.holder) }
    try fresh.model.requestEmergency(holder: fresh.holder)
    try check(old.operation.requests == 0 && fresh.operation.requests == 1)
}
test("revocation before GO cannot be undone by validation or controller loss") {
    let f = try fixture(); try f.model.issue(); try f.model.validate(); try f.model.revoke(); try f.model.loseController()
    try rejects(.inactive) { try f.model.admitSimulatedGO(holder: f.holder) }
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    try check(f.operation.requests == 0)
}
for stage in ["issue", "validate", "GO", "request"] {
    test("immutable deadline blocks \(stage) at exact expiry") {
        let f = try fixture()
        if stage != "issue" { try f.model.issue() }
        if stage == "GO" || stage == "request" { try f.model.validate() }
        if stage == "request" { try f.model.admitSimulatedGO(holder: f.holder) }
        f.clock.tick = binding().deadline
        try rejects(.deadline) {
            switch stage {
            case "issue": try f.model.issue()
            case "validate": try f.model.validate()
            case "GO": try f.model.admitSimulatedGO(holder: f.holder)
            default: try f.model.requestEmergency(holder: f.holder)
            }
        }
        try check(f.operation.requests == 0 && f.model.report().facts.exit == nil && f.model.report().verdict != .pass)
    }
}
test("last permitted deadline tick succeeds and controller loss cannot extend it") {
    let f = try ready(); try f.model.loseController(); f.clock.tick = 8099
    try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.controllerLost && r.binding.deadline == 8100 && r.verdict == .pass)
    let expired = try ready(); try expired.model.loseController(); expired.clock.tick = 8100
    try rejects(.deadline) { try expired.model.requestEmergency(holder: expired.holder) }
}
for fault in ["rollback", "boot", "wake"] {
    test("clock \(fault) is sticky and never renews authority") {
        let f = try ready()
        switch fault {
        case "rollback": f.clock.tick = 99
        case "boot": f.clock.reading.bootID = targetID
        default: f.clock.reading.wakeGeneration = 1
        }
        try rejects(.deadline) { try f.model.requestEmergency(holder: f.holder) }
        f.clock.reading = CapabilityClockReading(milliseconds: 101, bootID: boot, wakeGeneration: 0)
        try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
        try check(f.model.report().findings.contains(.clockDiscontinuity) && f.operation.requests == 0)
    }
}
test("reentrant duplicate requests reserve only one finite budget") {
    let f = try ready(); var rejection: CapabilityError?
    f.operation.duringRequest = {
        do { try f.model.requestEmergency(holder: f.holder) } catch { rejection = error as? CapabilityError }
    }
    try f.model.requestEmergency(holder: f.holder)
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    try check(rejection == .busy && f.operation.requests == 1 && f.model.report().used == 1)
}
for response in [CapabilityResponse.denied, .unavailable, .targetAlreadyExited, .contradictory] {
    test("\(response.rawValue) API result never falls back or replenishes budget") {
        let f = try ready(); f.operation.response = response
        try f.model.requestEmergency(holder: f.holder)
        try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
        try observe(f); try f.model.releaseRight(holder: f.holder)
        let r = try published(f.model)
        try check(r.response == response && r.verdict == .fail && r.emergency != .corroboratedSimulation && f.operation.requests == 1)
    }
}
test("S disappearance invalidates use without exit, cause or reap inference") {
    let f = try ready(); try f.model.targetDisappeared()
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    let r = try published(f.model)
    try check(r.targetGone && r.facts.exit == nil && r.facts.reap == nil && r.emergency == .notRequested && r.verdict == .unverified)
}
test("simultaneous R and G loss cannot reconstruct authority from a finished report") {
    let f = try ready(); try f.model.loseHolder(); try f.model.loseGuard(); try observe(f, cause: false)
    let r = try published(f.model)
    try check(r.holderLost && r.guardLost && r.facts.reap == nil && r.cleanup == .unresolved)
    let replacement = try fixture(qualified: false)
    try rejects(.provenance) { try replacement.model.receiveHelper(CapabilityWire.encode(r)) }
    try rejects(.unavailable) { try replacement.model.issue() }
}
test("exit and rightful reap without proven emergency cause retain global uncertainty") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder); try observe(f, cause: false); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.cleanup == .verifiedSimulation && r.emergency != .corroboratedSimulation && r.verdict == .unverified)
}
test("normal reap racing emergency response cannot claim emergency causality") {
    let f = try ready()
    f.operation.duringRequest = {
        f.observations.batch = CapabilityObservationBatch(bindingDigest: try! CapabilityWire.digest(binding()), target: binding().target,
            exit: CapabilityExit(code: 0, kind: .normal), reap: CapabilityReap(owner: f.creation, exit: CapabilityExit(code: 0, kind: .normal)),
            emergencyCauseReference: nil, descriptorsClosed: true)
        try! f.model.reconcile()
    }
    try f.model.requestEmergency(holder: f.holder); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.response == .accepted && r.facts.reap != nil && r.findings.contains(.ambiguousRace) && r.verdict == .unverified)
}
test("target exit during revocation preserves independent observations") {
    let f = try ready(); try f.model.revoke(); try observe(f, cause: false); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.request == nil && r.response == nil && r.facts.exit != nil && r.facts.reap != nil && r.verdict != .pass)
}
test("unexpected nonzero target exit is a persistent failure") {
    let f = try ready(); try observe(f, cause: false)
    try check(f.model.report().findings.contains(.unexpectedExit) && f.model.report().verdict == .fail)
}
test("reap alone does not synthesize an independent exit observation") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder)
    f.observations.batch = CapabilityObservationBatch(bindingDigest: try CapabilityWire.digest(binding()), target: binding().target,
        exit: nil, reap: CapabilityReap(owner: f.creation, exit: CapabilityExit(code: 9, kind: .forced)),
        emergencyCauseReference: nil, descriptorsClosed: true)
    try f.model.reconcile(); try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.facts.exit == nil && r.facts.reap != nil && r.cleanup == .unresolved && r.verdict == .unverified)
}
for mismatch in ["binding", "target", "owner", "exit", "cause", "code"] {
    test("contradictory \(mismatch) observation fails closed without replacing history") {
        let f = try ready(); try f.model.requestEmergency(holder: f.holder); try observe(f)
        let before = try f.model.report().facts
        var batch = f.observations.batch!
        switch mismatch {
        case "binding": batch.bindingDigest = String(repeating: "c", count: 64)
        case "target": batch.target.objectID = issuerID
        case "owner": batch.reap = CapabilityReap(owner: CapabilityCreation(binding: binding()), exit: batch.exit!)
        case "exit": batch.exit = CapabilityExit(code: 0, kind: .normal)
        case "cause": batch.emergencyCauseReference = hash
        default: batch.exit = CapabilityExit(code: -1, kind: .forced)
        }
        f.observations.batch = batch
        try rejects(.contradiction) { try f.model.reconcile() }
        try check(f.model.report().facts == before && f.model.report().verdict == .fail)
    }
}
for release in [CapabilityRelease.partial, .unavailable] {
    test("\(release.rawValue) right cleanup cannot publish global PASS") {
        let f = try ready(); f.operation.releaseResult = release
        try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.releaseRight(holder: f.holder)
        let r = try published(f.model)
        try check(r.cleanup == .partial && !r.rightReleased && r.verdict == .unverified)
    }
}
test("unclosed descriptors remain partial despite right release and reap") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder)
    f.observations.batch = CapabilityObservationBatch(bindingDigest: try CapabilityWire.digest(binding()), target: binding().target,
        exit: CapabilityExit(code: 9, kind: .forced), reap: CapabilityReap(owner: f.creation, exit: CapabilityExit(code: 9, kind: .forced)),
        emergencyCauseReference: try f.model.report().request!.reference, descriptorsClosed: false)
    try f.model.reconcile(); try f.model.releaseRight(holder: f.holder)
    try check(published(f.model).cleanup == .partial && f.model.report().verdict == .unverified)
}
test("release callback cannot reacquire or spend a released authority") {
    let f = try ready(); var observed: CapabilityError?
    f.operation.duringRelease = {
        do { try f.model.requestEmergency(holder: f.holder) } catch { observed = error as? CapabilityError }
    }
    try f.model.releaseRight(holder: f.holder)
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    try rejects(.inactive) { try f.model.releaseRight(holder: f.holder) }
    try check(observed == .busy && f.operation.requests == 0 && f.operation.releases == 1)
}
test("unavailable observation port never fabricates exit or cleanup") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder); try f.model.reconcile()
    let r = try published(f.model)
    try check(r.facts.exit == nil && r.cleanup == .unresolved && r.verdict == .unverified)
}
test("terminal reports are byte stable and reject all later mutation") {
    let f = try complete(), bytes = try CapabilityWire.encode(f.model.finish())
    let counts = [f.operation.requests, f.operation.releases, f.observations.reads, f.bootstrap.requests]
    f.clock.tick = UInt64.max; f.observations.batch = nil
    try rejects(.terminal) { try f.model.reconcile() }
    try rejects(.terminal) { try f.model.revoke() }
    try rejects(.terminal) { try f.model.loseGuard() }
    try rejects(.terminal) { try f.model.requestEmergency(holder: f.holder) }
    try check(CapabilityWire.encode(f.model.finish()) == bytes && CapabilityWire.encode(f.model.report()) == bytes)
    try check(counts == [f.operation.requests, f.operation.releases, f.observations.reads, f.bootstrap.requests])
}
test("in-flight request cannot finalize publication") {
    let f = try ready(); var rejected = false
    f.operation.duringRequest = {
        do { _ = try f.model.finish() } catch { rejected = (error as? CapabilityError) == .busy }
    }
    try f.model.requestEmergency(holder: f.holder); try check(rejected)
}
test("holder loss during operation retains response and cannot masquerade as successful cleanup") {
    let f = try ready(); f.operation.duringRequest = { try! f.model.loseHolder() }
    try f.model.requestEmergency(holder: f.holder); try observe(f)
    try rejects(.inactive) { try f.model.releaseRight(holder: f.holder) }
    let r = try published(f.model)
    try check(r.response == .accepted && r.holderLost && r.facts.reap != nil && !r.rightReleased && r.verdict == .fail)
}
test("reap credited before G loss remains evidence rather than being invented afterward") {
    let f = try ready(); try f.model.requestEmergency(holder: f.holder); try observe(f); try f.model.loseGuard()
    try f.model.releaseRight(holder: f.holder)
    let r = try published(f.model)
    try check(r.guardLost && r.facts.reap != nil && r.cleanup == .verifiedSimulation && r.verdict == .pass)
}
test("incomplete issuance cannot be retried into implicit authority") {
    let f = try fixture(complete: false); try rejects(.unavailable) { try f.model.issue() }
    try rejects(.replay) { try f.model.issue() }
    try check(f.bootstrap.requests == 1 && f.operation.requests == 0)
}
test("canonical binding round-trip is metadata and strict report claims cannot authorize launch") {
    let b = binding(); try check(CapabilityWire.decode(CapabilityBinding.self, from: CapabilityWire.encode(b)) == b)
    var r = try complete().model.finish(); r.allowNativeLaunch = true
    try rejects(.contract) { try CapabilityPublication().stage(r) }
    r.allowNativeLaunch = false; r.nativeEnforcement = "verified"
    try rejects(.contract) { try CapabilityPublication().stage(r) }
}
test("helper and event bounds retain fixed evidence and block new operations") {
    let f = try ready()
    try rejects(.resourceLimit) { try f.model.receiveHelper(Data(repeating: 65, count: 4097)) }
    for _ in 0..<110 { try rejects(.provenance) { try f.model.receiveHelper(Data()) } }
    try rejects(.inactive) { try f.model.requestEmergency(holder: f.holder) }
    let r = try published(f.model)
    try check(r.events.count == 96 && r.findings.contains(.resourceLimit) && r.verdict == .fail)
    try check(CapabilityWire.encode(r).count < CapabilityWire.maximumBytes)
}
test("strict evidence rejects oversized, unknown, truncated and falsely upgraded records") {
    let r = try complete().model.finish(), bytes = try CapabilityWire.encode(r)
    try check(CapabilityPublication.verify(bytes: bytes, digest: CapabilityWire.hash(bytes)) == r)
    try rejects(.resourceLimit) { _ = try CapabilityWire.decode(CapabilityReport.self, from: Data(repeating: 32, count: 65_537)) }
    try rejects(.incompleteEvidence) { _ = try CapabilityPublication.verify(bytes: bytes.dropLast(), digest: CapabilityWire.hash(bytes)) }
    let text = String(decoding: bytes, as: UTF8.self)
    let unknown = Data(("{\"unknown\":0," + text.dropFirst()).utf8)
    try rejects(.contract) { _ = try CapabilityWire.decode(CapabilityReport.self, from: unknown) }
    let duplicate = Data(("{\"mode\":\"simulation\"," + text.dropFirst()).utf8)
    try rejects(.contract) { _ = try CapabilityWire.decode(CapabilityReport.self, from: duplicate) }
    let incomplete = try ready(); try incomplete.model.requestEmergency(holder: incomplete.holder)
    let unverified = String(decoding: try CapabilityWire.encode(incomplete.model.finish()), as: UTF8.self)
    let upgraded = Data(unverified.replacingOccurrences(of: "\"verdict\":\"UNVERIFIED\"", with: "\"verdict\":\"PASS\"").utf8)
    try rejects(.contract) { _ = try CapabilityWire.decode(CapabilityReport.self, from: upgraded) }
}

print("\(passed) passed; \(failed) failed — Gate 2B-2C simulation only")
if failed > 0 { exit(1) }
