import Foundation

var passed = 0, failed = 0
let filter = CommandLine.arguments.dropFirst().first
func test(_ name: String, _ body: () throws -> Void) {
    guard filter == nil || name.contains(filter!) else { return }
    do { try body(); passed += 1; print("PASS \(name)") }
    catch { failed += 1; print("FAIL \(name): \(error)") }
}

test("S01 normal complete evidence") {
    let f = try Fixture(), r = try f.normal()
    try check(r.outcome == .completed && r.verdict == .pass && !r.ledger.reservationHeld)
    try check(r.owner.exitRef != nil && r.watchdog.reapRef != nil && r.vm == .stoppedObserved)
    try check(f.effects.creates == 1 && f.effects.stops == 1 && f.effects.escalations == 0)
    try rejects(.terminal) { try f.model.brokerOperation() }
}
test("S02 ignored shutdown never proves release") {
    let f = try Fixture(); try f.model.cancel()
    f.clock.reading.tick = f.model.graceBy; try f.model.poll()
    let r = try f.unresolved()
    try check(r.outcome == .unresolved && r.ledger.reservationHeld && f.effects.escalations == 1)
    try check(r.ledger.outstanding.contains(.vmResources) && f.effects.stops == 1)
}
for role in [VMRole.owner, .watchdog, .controller] {
    let id = role == .owner ? "S03" : role == .watchdog ? "S05" : "S06"
    test("\(id) \(role) disappearance preserves obligations") {
        let f = try Fixture(), deadlines = f.binding.deadlines
        try f.model.lose(role)
        try rejects(.authority) { try f.model.brokerOperation() }
        let r = try f.unresolved()
        try check(r.outcome == .unresolved && r.ledger.reservationHeld && r.binding.deadlines == deadlines)
        try check(f.effects.creates == 1 && f.effects.brokerCalls == 0 && r.quarantine?.state == .active)
    }
}
test("S04 blocked owner timeout is unresolved") {
    let f = try Fixture(); try f.model.ownerBlocked(); let r = try f.unresolved()
    try check(r.outcome == .unresolved && r.quarantine != nil && r.ledger.reservationHeld)
}
test("S07 owner and watchdog lost") {
    let f = try Fixture(); try f.model.lose(.owner); try f.model.lose(.watchdog)
    let r = try f.unresolved()
    try check(r.owner.state == .lost && r.watchdog.state == .lost && r.watchdog.reapRef == nil)
    try check(r.outcome == .unresolved && f.effects.creates == 1)
}
test("S08 sleep exact deadline denies new operation") {
    let f = try Fixture(); f.clock.reading.tick = f.binding.deadlines.executionBy
    try rejects(.deadline) { try f.model.brokerOperation() }
    try check(f.effects.brokerCalls == 0 && !f.model.brokerOpen)
}
test("S09 owner exit is not VM cleanup") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.ownerExit); try f.observe(.ownerReap)
    try check(f.model.ledger.entry(.vmResources).status == .outstanding, "owner exit cannot credit VM release")
    let r = try f.unresolved()
    try check(r.outcome == .unresolved && r.ledger.outstanding.contains(.vmResources))
    try check(r.ledger.reservationHeld && r.quarantine?.state == .active && f.effects.creates == 1)
}
test("S10 stop callback cannot release scratch") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.vmStop)
    try check(f.model.ledger.entry(.scratch).status == .outstanding, "stop callback cannot credit scratch")
    try f.cleanup(except: [.scratch, .vmStop])
    let r = try f.unresolved()
    try check(r.owner.stopCallbackRef != nil && r.ledger.outstanding.contains(.scratch) && r.ledger.reservationHeld)
}
test("S11 upstream cancellation is not upstream completion") {
    let f = try Fixture(); try f.model.brokerOperation(); try f.model.cancel(); try f.cleanup(except: [.upstream])
    let r = try f.unresolved()
    try check(r.ledger.outstanding == [.upstream] && r.ledger.reservationHeld && !r.upstreamCostReversalEstablished)
    try check(f.effects.brokerCalls == 1 && f.effects.notifications == 1)
}
test("S12 late evidence cannot rewrite finalized report") {
    let f = try Fixture(), r = try f.unresolved(), original = try VMWire.encode(r)
    try rejects(.terminal) { try f.observe(.vmResources) }
    try check(VMWire.encode(f.model.finish()) == original && r.outcome == .unresolved)
}
test("S13 exact duplicate idempotent and conflicting replay audited") {
    let f = try Fixture(); try f.model.completeWorkload()
    let fact = f.fact(.ownerExit), proof = try f.bootstrap.qualify(fact)
    try f.model.observe(proof); try f.model.observe(proof)
    try check(f.model.ledger.entry(.ownerExit).evidenceRefs.count == 1)
    var changed = fact; changed.value = .retained
    try rejects(.contradiction) { try f.model.observe(f.bootstrap.qualify(changed)) }
    try check(f.model.quarantine != nil && f.effects.creates == 1)
}
test("S14 cross attempt evidence rejected") {
    let f = try Fixture(); var b = f.binding; b.attemptId = fixtureID(999)
    let other = try Fixture(binding: b), p = try other.bootstrap.qualify(other.fact(.vmResources))
    try rejects(.binding) { try f.model.observe(p) }
    try check(f.model.ledger.entry(.vmResources).status == .outstanding)
    try check(f.effects.creates == 1)
}
test("S15 contradictory cleanup retained without credit") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.scratch)
    try rejects(.contradiction) { try f.observe(.scratch, value: .retained, n: 333) }
    let r = try f.unresolved()
    try check(r.ledger.entry(.scratch).status == .contradictory && r.ledger.reservationHeld && r.observations.count >= 2)
}
test("S16 partial reconciliation retains entire initial reservation") {
    let f = try Fixture(); _ = try f.unresolved()
    let decision = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try check(decision.disposition == .partial && f.model.ledger.reservationHeld && f.model.quarantine?.state == .active)
    try check(f.model.ledger.entry(.scratch).status == .satisfied && f.effects.creates == 1)
}
test("S17 unresolved cannot replace even through new run") {
    let f = try Fixture(); _ = try f.unresolved()
    try rejects(.quarantined) { try f.model.requestReplacement() }
    var b = f.binding; b.runId = fixtureID(998); b.attemptId = fixtureID(999)
    try rejects(.quarantined) { _ = try Fixture(binding: b, registry: f.registry) }
    try check(f.model.ledger.reservationHeld && f.effects.creates == 1)
}
test("S18 unresolved resources cannot be reused") {
    let f = try Fixture(); _ = try f.unresolved()
    try rejects(.quarantined) { try f.model.requestReuse() }
    try check(f.model.ledger.reservationHeld && f.model.quarantine?.state == .active && f.effects.creates == 1)
}
test("S19 uncertain creation acknowledgment is not healthy empty state") {
    let f = try Fixture(start: false); try f.model.arm(); f.effects.createResponse = .uncertain
    try rejects(.unavailable) { try f.model.create() }
    try rejects(.authority) { try f.model.create() }
    let r = try f.model.finish()
    try check(r.outcome == .unresolved && r.ledger.reservationHeld && r.vm == .unknown)
    try check(f.effects.creates == 1)
    try rejects(.terminal) { try f.model.create() }
}
test("S20 corrupt incomplete restore preserves host hold without authority") {
    let f = try Fixture(), r = try f.unresolved(), bytes = try VMWire.encode(r)
    for data in [Data(), Data(bytes.dropLast()), bytes] {
        let view = VMLifecycle.restore(data, binding: f.binding, registry: f.registry)
        try check(!view.allowNativeLaunch && view.reservationHeld && !view.canResume && view.uncertaintyDigest != nil)
        try check(f.registry.isHeld(f.binding.hostScopeId))
    }
    try check(f.effects.creates == 1)
}
test("S21 manual intervention has no reconciliation authority") {
    let f = try Fixture(procedures: false); _ = try f.unresolved()
    try f.model.operatorNote(fixtureHash)
    try rejects(.authority) { _ = try f.permission() }
    try check(f.model.ledger.reservationHeld && f.model.quarantine?.state == .active && f.effects.creates == 1)
}
test("S22 qualified reconciliation commits separately without launch authority") {
    let f = try Fixture(), old = try VMWire.encode(f.unresolved()), permission = try f.permission()
    let d = try f.model.reconcile(proofs: f.recoveryProofs(), permission: permission)
    try check(d.disposition == .clearedSimulation && !f.model.ledger.reservationHeld && f.model.quarantine?.state == .cleared)
    try check(VMWire.encode(f.model.finish()) == old && f.model.finish().outcome == .unresolved)
    try rejects(.authority) { try f.model.requestReplacement() }
    try check(f.effects.creates == 1 && f.model.accountingReleases == 1)
}

test("C01 all eight strict contracts round trip with explicit simulation flags") {
    func roundTrip<T: VMDocument>(_ value: T) throws {
        let bytes = try VMWire.document(value)
        try check(VMWire.decode(T.self, bytes) == value)
        try check(value.mode == "simulation" && value.authorization == "none" && !value.allowNativeLaunch && value.nativeEnforcement == "unverified")
        let text = String(decoding: bytes, as: UTF8.self)
        for invalid in [Data(("{\"unknown\":0," + text.dropFirst()).utf8),
                        Data(("{\"mode\":\"simulation\"," + text.dropFirst()).utf8),
                        Data(text.replacingOccurrences(of: "\"schemaVersion\":1", with: "\"schemaVersion\":2").utf8),
                        Data(text.replacingOccurrences(of: "\"allowNativeLaunch\":false", with: "\"allowNativeLaunch\":true").utf8)] {
            try rejects(.contract) { _ = try VMWire.decode(T.self, invalid) }
        }
    }
    let f = try Fixture(), report = try f.unresolved()
    try roundTrip(f.binding); try roundTrip(report.owner); try roundTrip(report.watchdog)
    try roundTrip(report.ledger); try roundTrip(report.quarantine!); try roundTrip(report)
    let d = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try roundTrip(d); try roundTrip(d.evidence[0])
}
test("C02 nested unknown noncanonical truncated and oversized rejected") {
    let b = try fixtureBinding(), bytes = try VMWire.document(b), text = String(decoding: bytes, as: UTF8.self)
    let invalid = text.replacingOccurrences(of: "\"image\":{", with: "\"image\":{\"unknown\":true,")
    try rejects(.contract) { _ = try VMWire.decode(VMExecutionBinding.self, Data(invalid.utf8)) }
    try rejects(.contract) { _ = try VMWire.decode(VMExecutionBinding.self, Data((" " + text).utf8)) }
    try rejects(.contract) { _ = try VMWire.decode(VMExecutionBinding.self, Data(bytes.dropLast())) }
    try rejects(.quota) { _ = try VMWire.decode(VMExecutionBinding.self, Data(repeating: 32, count: 65_537)) }
    try rejects(.contract) { _ = try VMDeadlines(UInt64.max) }
    try rejects(.contract) { _ = try VMDeadlines(VMWire.maximumInteger) }
}
for field in ["policy", "resource", "binary", "bundle", "revision", "image", "deadline", "actor", "resourceIds", "purpose"] {
    test("C03 exact binding rejects \(field)") {
        var b = try fixtureBinding()
        switch field {
        case "policy": b.policyVersion = 2
        case "resource": b.resources.vCPUs = 3
        case "binary": b.artifacts.owner.version = "operative/1"
        case "bundle": b.acceptedBundleRef += "a"
        case "revision": b.workflowRevision = UInt64.max
        case "image": b.artifacts.image.format = "unknown"
        case "deadline": b.deadlines.cleanupBy += 1
        case "actor": b.actors.owner = b.actors.watchdog
        case "resourceIds": b.resourceIds[1] = b.resourceIds[0]
        default: b.purpose = "production"
        }
        try rejects(.contract) { try b.validate() }
    }
}
test("C04 exact artifact byte digest and size verification") {
    let bytes = Data("synthetic".utf8), ref = VMBlob(sha256: VMWire.hash(bytes), byteLength: UInt64(bytes.count))
    try ref.verify(bytes)
    try rejects(.evidence) { try ref.verify(Data(bytes.dropLast())) }
    try rejects(.evidence) { try ref.verify(Data(repeating: 65, count: bytes.count)) }
}
test("A01 grant bootstrap and creation are one shot; DTO cannot issue authority") {
    let f = try Fixture(start: false)
    try rejects(.replay) { _ = try f.bootstrap.issue() }
    let root = try VMSimulationBootstrap(binding: f.binding), grant = try root.issue()
    _ = try VMLifecycle(binding: f.binding, grant: grant, clock: f.clock, effects: f.effects, registry: VMHostRegistry())
    try rejects(.replay) { _ = try VMLifecycle(binding: f.binding, grant: grant, clock: f.clock, effects: f.effects, registry: VMHostRegistry()) }
    let dto = try VMWire.decode(VMExecutionBinding.self, VMWire.document(f.binding))
    let otherRoot = try VMSimulationBootstrap(binding: dto)
    try rejects(.evidence) { _ = try otherRoot.qualify(f.fact(.vmResources)) }
    let otherWorld = try Fixture(binding: dto)
    let proof = try otherWorld.bootstrap.qualify(otherWorld.fact(.vmResources))
    try rejects(.authority) { try f.model.observe(proof) }
    try check(f.effects.creates == 0)
}
test("A02 empty procedure catalog and one use permission") {
    let f = try Fixture(); _ = try f.unresolved(); let p = try f.permission()
    let digest = try VMWire.digest(f.model.ledger)
    try p.consume(catalog: f.catalog, binding: VMWire.digest(f.binding), caseId: f.model.quarantine!.caseId, ledger: digest, revision: f.model.recoveryRevision)
    try rejects(.replay) { try p.consume(catalog: f.catalog, binding: VMWire.digest(f.binding), caseId: f.model.quarantine!.caseId, ledger: digest, revision: f.model.recoveryRevision) }
    try check(f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("T01 boot boundary last permitted and exact expiration") {
    let f = try Fixture(start: false); try f.model.arm(); try f.model.create()
    f.clock.reading.tick = f.binding.deadlines.bootBy - 1; try f.model.go()
    let g = try Fixture(start: false); try g.model.arm(); try g.model.create()
    g.clock.reading.tick = g.binding.deadlines.bootBy
    try rejects(.deadline) { try g.model.go() }
    try check(!g.model.owner.goConsumed && g.effects.creates == 1)
}
test("T02 execution last tick and controller loss never extends cleanup") {
    let f = try Fixture(); f.clock.reading.tick = f.binding.deadlines.executionBy - 1; try f.model.brokerOperation()
    let original = f.binding.deadlines
    try f.model.lose(.controller)
    try check(f.model.cleanupBy <= original.cleanupBy && f.model.graceBy <= original.escalationBy, "controller loss cannot renew deadlines")
    f.clock.reading.tick = original.cleanupBy; try f.model.poll()
    try check(f.model.quarantine != nil && f.model.ledger.reservationHeld)
}
for fault in ["rollback", "epoch", "boot", "overflow"] {
    test("T03 sticky clock fault \(fault) cannot restore authority") {
        let f = try Fixture()
        switch fault {
        case "rollback": f.clock.reading.tick = 99
        case "epoch": f.clock.reading.epochId = fixtureID(999)
        case "boot": f.clock.reading.bootId = fixtureID(999)
        default: f.clock.reading.tick = UInt64.max
        }
        try rejects(.clock) { try f.model.brokerOperation() }
        f.clock.reading = VMClockReading(tick: 100, bootId: f.binding.bootId, epochId: f.binding.clockEpochId)
        try rejects(.authority) { try f.model.brokerOperation() }
        try check(f.model.quarantine != nil && f.effects.brokerCalls == 0)
    }
}
test("T04 timeout retains quarantine indefinitely") {
    let f = try Fixture(); try f.model.lose(.owner)
    f.clock.reading.tick = f.binding.deadlines.cleanupBy; try f.model.poll()
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld, "timeout must not clear quarantine")
    f.clock.reading.tick += 1_000_000; try f.model.poll()
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld)
    try check(f.effects.creates == 1)
}
test("R01 reentrant creation and pending finalization rejected") {
    let f = try Fixture(start: false); try f.model.arm()
    var duplicate: VMError?, finalization: VMError?
    f.effects.onCreate = {
        do { try f.model.create() } catch { duplicate = error as? VMError }
        do { _ = try f.model.finish() } catch { finalization = error as? VMError }
    }
    try f.model.create()
    try check(duplicate == .busy && finalization == .busy && f.effects.creates == 1)
}
for loss in [VMRole.owner, .watchdog, .controller] {
    test("R02 create response after \(loss) loss cannot reactivate") {
        let f = try Fixture(start: false); try f.model.arm()
        f.effects.onCreate = { try! f.model.lose(loss) }
        try rejects(.authority) { try f.model.create() }
        try check(f.model.vm == .unknown && !f.model.owner.goConsumed && f.model.ledger.reservationHeld)
        try check(f.effects.creates == 1 && !f.model.brokerOpen)
    }
}
test("R03 expiry during creation response preserves exposure") {
    let f = try Fixture(start: false); try f.model.arm()
    f.effects.onCreate = { f.clock.reading.tick = f.binding.deadlines.executionBy }
    try rejects(.deadline) { try f.model.create() }
    try check(f.effects.creates == 1 && f.model.ledger.reservationHeld && !f.model.owner.goConsumed)
}
test("R04 broker fence precedes failed reentrant notification") {
    let f = try Fixture(); f.effects.notificationAccepted = false
    var denied: VMError?
    f.effects.onNotify = {
        do { try f.model.brokerOperation() } catch { denied = error as? VMError }
    }
    try f.model.cancel()
    try check(!f.model.brokerOpen && denied == .authority && f.effects.brokerCalls == 0, "failed notification must keep gate closed")
    try check(f.model.ledger.entry(.brokerFence).status == .satisfied)
}
test("R05 clock reentrancy cannot admit an operation") {
    let f = try Fixture(); var denied: VMError?
    f.clock.onRead = {
        do { try f.model.brokerOperation() } catch { denied = error as? VMError }
    }
    try f.model.brokerOperation()
    try check(denied == .busy && f.effects.brokerCalls == 1)
}
test("R06 late broker response after cancellation does not reopen gate") {
    let f = try Fixture()
    f.effects.onBroker = { try! f.model.lose(.controller) }
    try rejects(.authority) { try f.model.brokerOperation() }
    try check(!f.model.brokerOpen && f.effects.brokerCalls == 1 && f.model.ledger.entry(.upstream).status == .outstanding)
}
test("R07 invalid stale and unqualified reconciliation retain reservations") {
    let f = try Fixture(); _ = try f.unresolved()
    let p = try f.permission(); try f.model.operatorNote(fixtureHash)
    try rejects(.stale) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: p) }
    let ordinary = try f.bootstrap.qualify(f.fact(.scratch))
    try rejects(.authority) { _ = try f.model.reconcile(proofs: [ordinary], permission: f.permission()) }
    try check(f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("R08 reconciler reentrancy and intervening revision invalidate commit") {
    let f = try Fixture(); _ = try f.unresolved(); let p = try f.permission()
    var duplicate: VMError?
    try rejects(.stale) {
        _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: p, beforeReceipt: {
            do { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
            catch { duplicate = error as? VMError }
            try f.model.operatorNote(fixtureHash)
        })
    }
    try check(duplicate == .busy && f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
    try rejects(.incomplete) { _ = try f.model.recoverReconciliation() }
}
test("Q01 quota never discards obligations or critical finalization") {
    let f = try Fixture(), initial = f.model.ledger.entries.map(\.claim)
    for _ in 0..<140 {
        do { try f.model.go() } catch {}
        try check(f.model.ledger.entry(.vmResources).status == .outstanding && f.model.ledger.entry(.scratch).status == .outstanding,
            "quota cannot eliminate pending resource obligations")
    }
    try check(f.model.ledger.entries.map(\.claim) == initial, "quota must retain all obligations")
    try check(f.model.ledger.reservationHeld && !f.model.brokerOpen)
    let r = try f.model.finish()
    try check(r.events.count <= 128 && r.events.last?.code == .finalized && r.outcome == .unresolved)
}
test("Q02 event frame count and byte quotas have exact boundaries") {
    var log = VMEventLog()
    for _ in 0..<96 { try log.append(.rejected, tick: 100) }
    try rejects(.quota) { try log.append(.rejected, tick: 100) }
    for _ in 0..<32 { try log.append(.quarantine, tick: 100, critical: true) }
    try rejects(.quota) { try log.append(.finalized, tick: 100, critical: true) }
    try check(log.events.count == 128 && log.totalBytes <= 65_536)
}
for point in VMPublicationPoint.allCases {
    test("I01 receipt last publication \(point)") {
        let f = try Fixture(), r = try f.normal(), p = VMPublication<VMQualificationReport>()
        try p.stage(r)
        try rejects(.interrupted) { try p.commit(interruption: point) }
        if point == .afterReceipt { try check(p.verified() == r) }
        else { try rejects(.incomplete) { _ = try p.verified() } }
        try rejects(.replay) { try p.stage(r) }
    }
}
test("I02 uninterrupted publication positive control and digest tampering") {
    let f = try Fixture(), r = try f.normal(), bytes = try VMWire.document(r), p = VMPublication<VMQualificationReport>()
    try p.stage(r); try p.commit(); try check(p.verified() == r)
    let receipt = VMReceipt(bindingDigest: try r.bindingIdentity, documentKind: VMQualificationReport.documentKind,
        digest: VMWire.hash(bytes), byteLength: bytes.count)
    try rejects(.incomplete) { _ = try VMPublication<VMQualificationReport>.verify(bytes: Data(bytes.dropLast()), receipt: VMWire.document(receipt)) }
    var forged = r; forged.verdict = .pass; forged.outcome = .unresolved
    try rejects(.contract) { _ = try VMWire.document(forged) }
}
for point in VMPublicationPoint.allCases {
    test("I03 reconciliation interruption \(point) retains accounting until commit") {
        let f = try Fixture(), original = try VMWire.document(f.unresolved())
        try rejects(.interrupted) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission(), interruption: point) }
        try check(f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
        if point == .afterReceipt {
            let d = try f.model.recoverReconciliation()
            try check(d.disposition == .clearedSimulation && !f.model.ledger.reservationHeld && f.model.accountingReleases == 1)
            _ = try f.model.recoverReconciliation(); try check(f.model.accountingReleases == 1)
        } else {
            try rejects(.incomplete) { _ = try f.model.recoverReconciliation() }
            try rejects(.busy) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
            try check(f.model.ledger.reservationHeld && f.model.quarantine?.state == .active)
        }
        try check(VMWire.document(f.model.finish()) == original && f.effects.creates == 1)
    }
}
test("I04 finalized report ignores later clock and ports") {
    let f = try Fixture(), bytes = try VMWire.document(f.normal())
    f.clock.reading.tick = UInt64.max
    f.clock.onRead = { fatalError("final report must not read the clock") }
    try check(VMWire.document(f.model.finish()) == bytes)
    try rejects(.terminal) { try f.model.lose(.owner) }
}
test("AC01 AC02 AC16 architecture has no production backend or admission authority") {
    try check(!VMBackendPolicy.productionIntegration, "operative backend must not be connected")
    let f = try Fixture(), r = try f.unresolved()
    try check(!r.allowNativeLaunch && r.authorization == "none" && r.unverifiedGuarantees.contains("orch-002-ac06"))
}
test("C05 forged report outcomes and release observations cannot upgrade evidence") {
    let f = try Fixture(), r = try f.unresolved()
    var forged = r; forged.outcome = .completed; forged.verdict = .pass
    try rejects(.contract) { _ = try VMWire.document(forged) }
    forged = r; forged.ledger.reservationHeld = false
    try rejects(.contract) { _ = try VMWire.document(forged) }
    forged = r; forged.owner.exitRef = fixtureHash
    try rejects(.evidence) { _ = try VMWire.document(forged) }
}
test("C06 same ID contradiction remains publishable without losing history") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.scratch)
    var changed = f.fact(.scratch); changed.value = .retained
    try rejects(.contradiction) { try f.model.observe(f.bootstrap.qualify(changed)) }
    let r = try f.model.finish()
    try check(r.outcome == .unresolved && r.ledger.entry(.scratch).status == .contradictory)
    try check(r.observations.filter { $0.id == changed.id }.count == 2)
    try check(VMWire.decode(VMQualificationReport.self, VMWire.document(r)) == r)
}
test("T05 repeated cancellation never moves early deadlines forward") {
    let f = try Fixture(); try f.model.cancel(); let grace = f.model.graceBy, cleanup = f.model.cleanupBy
    f.clock.reading.tick += 500; try f.model.cancel()
    try check(f.model.graceBy == grace && f.model.cleanupBy == cleanup && f.effects.stops == 1)
    f.clock.reading.tick = cleanup; try f.model.poll()
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld)
}
test("T06 evidence at cleanup deadline cannot produce success") {
    let f = try Fixture(); try f.model.completeWorkload()
    f.clock.reading.tick = f.model.cleanupBy
    try rejects(.evidence) { try f.observe(.vmResources) }
    try f.model.poll(); let r = try f.model.finish()
    try check(r.outcome == .unresolved && r.ledger.reservationHeld)
}
test("Q03 eight rejected reconciliation requests preserve audit and full reservation") {
    let f = try Fixture(); _ = try f.unresolved()
    for _ in 0..<8 { try rejects(.evidence) { _ = try f.model.reconcile(proofs: [], permission: f.permission()) } }
    try rejects(.quota) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
    try check(f.model.quarantine!.rejectionRefs.count == 8 && f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
    try f.model.quarantine!.validate()
}
test("Q04 frame and reference limits fail closed without evicting entries") {
    let f = try Fixture(), original = f.model.ledger.entries
    var ledger = f.model.ledger
    ledger.entries[0].evidenceRefs = (0..<33).map { VMWire.hash(Data("ref-\($0)".utf8)) }
    try rejects(.contract) { try ledger.validate() }
    var log = VMEventLog()
    try rejects(.quota) { try log.append(.observation, tick: 100, reference: String(repeating: "a", count: 4096)) }
    try check(log.events.isEmpty && f.model.ledger.entries == original)
}
test("R09 reentrant notification cannot finalize the attempt") {
    let f = try Fixture(); var rejection: VMError?
    f.effects.onNotify = { do { _ = try f.model.finish() } catch { rejection = error as? VMError } }
    try f.model.cancel()
    try check(rejection == .busy && !f.model.brokerOpen && f.effects.notifications == 1)
}
test("R10 cross attempt recovery proof cannot satisfy a quarantined ledger") {
    let f = try Fixture(); _ = try f.unresolved(); var other = f.binding; other.attemptId = fixtureID(777)
    let g = try Fixture(binding: other); _ = try g.unresolved()
    try rejects(.binding) { _ = try f.model.reconcile(proofs: g.recoveryProofs(), permission: f.permission()) }
    try check(f.model.ledger.reservationHeld && f.model.quarantine?.state == .active && f.model.accountingReleases == 0)
}
test("R11 contradictory and backdated reconciliation proofs stay unresolved") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.scratch)
    try rejects(.contradiction) { try f.observe(.scratch, value: .retained, n: 333) }
    _ = try f.unresolved()
    try rejects(.evidence) { _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission()) }
    var stale = f.fact(.disk, n: 700); stale.source = .reconciler; stale.sourceId = f.binding.actors.reconciler
    stale.tick = f.binding.deadlines.armedAt
    try rejects(.evidence) { _ = try f.model.reconcile(proofs: [f.bootstrap.qualifyRecovery(stale)], permission: f.permission()) }
    try check(f.model.ledger.reservationHeld && f.model.quarantine?.state == .active)
}
test("R12 owner loss rejects raw cleanup until explicit reconciliation") {
    let f = try Fixture(); try f.model.lose(.owner)
    try rejects(.quarantined) { try f.observe(.vmResources) }
    try check(f.model.ledger.entry(.vmResources).status == .outstanding && f.effects.creates == 1)
}
test("R13 cooperative cancellation records cleanup without reversing upstream costs") {
    let f = try Fixture(); try f.model.brokerOperation(); try f.model.cancel(); try f.cleanup()
    let r = try f.model.finish()
    try check(r.outcome == .cancelled && r.verdict == .fail && !r.ledger.reservationHeld && r.quarantine == nil)
    try check(r.upstreamCancellationRequested && !r.upstreamCostReversalEstablished && f.effects.brokerCalls == 1)
}
test("R14 watchdog loss before GO never admits replacement") {
    let f = try Fixture(start: false); try f.model.arm(); try f.model.create(); try f.model.lose(.watchdog)
    try rejects(.authority) { try f.model.go() }
    try rejects(.quarantined) { try f.model.requestReplacement() }
    try check(!f.model.owner.goConsumed && f.effects.creates == 1)
}
for point in VMPublicationPoint.allCases {
    test("I05 final publication interruption \(point) retains accounting until receipt") {
        let f = try Fixture(); try f.model.completeWorkload(); try f.cleanup()
        try rejects(.interrupted) { _ = try f.model.finish(interruption: point) }
        try check(f.model.ledger.reservationHeld && f.effects.creates == 1)
        try rejects(.terminal) { try f.model.lose(.owner) }
        if point == .afterReceipt {
            let r = try f.model.finish(); try check(r.outcome == .completed && !f.model.ledger.reservationHeld)
        } else {
            try rejects(.incomplete) { _ = try f.model.finish() }
            try check(f.model.ledger.reservationHeld)
        }
    }
}
test("I06 receipt verified restore imports historical metadata only") {
    for unresolved in [false, true] {
        let f = try Fixture(), r = try unresolved ? f.unresolved() : f.normal(), bytes = try VMWire.document(r)
        let receipt = try VMWire.document(VMReceipt(bindingDigest: r.bindingIdentity, documentKind: VMQualificationReport.documentKind,
            digest: VMWire.hash(bytes), byteLength: bytes.count))
        let view = VMLifecycle.restore(bytes, receipt: receipt, binding: f.binding, registry: f.registry)
        try check(view.verifiedTerminalMetadata && view.historicalOutcome == r.outcome && !view.canResume && !view.allowNativeLaunch)
        try check(view.reservationHeld == r.ledger.reservationHeld && f.registry.isHeld(f.binding.hostScopeId))
        var other = f.binding; other.attemptId = fixtureID(999)
        let wrong = VMLifecycle.restore(bytes, receipt: receipt, binding: other, registry: f.registry)
        try check(!wrong.verifiedTerminalMetadata && wrong.reservationHeld)
        let truncated = VMLifecycle.restore(bytes, receipt: Data(receipt.dropLast()), binding: f.binding, registry: f.registry)
        try check(!truncated.verifiedTerminalMetadata && truncated.reservationHeld)
    }
}
test("R15 host metadata change cannot bypass a shared registry") {
    let f = try Fixture(); var b = f.binding; b.hostScopeId = fixtureID(999)
    try rejects(.binding) { _ = try Fixture(binding: b, registry: f.registry) }
    try check(f.effects.creates == 1)
}
test("R16 unexpected owner exit immediately fences without implying VM cleanup") {
    let f = try Fixture(); try f.observe(.ownerExit)
    try check(!f.model.brokerOpen && f.model.owner.state == .exitObserved && f.model.vm == .unknown)
    try rejects(.authority) { try f.model.brokerOperation() }
    let r = try f.unresolved()
    try check(r.outcome == .unresolved && r.owner.exitRef != nil && r.ledger.entry(.vmResources).status == .outstanding)
    try check(f.effects.stops == 0 && f.effects.escalations == 0 && f.effects.brokerCalls == 0)
}
test("R17 observed owner exit cannot regress to stop request or blocked") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.ownerExit)
    f.clock.reading.tick = f.binding.deadlines.executionBy; try f.model.poll()
    try check(f.model.owner.state == .exitObserved && f.effects.stops == 1 && f.effects.escalations == 0)
    try rejects(.transition) { try f.model.ownerBlocked() }
    try check(f.model.owner.state == .exitObserved)
}
test("R18 complete reconciliation after partial retains historical outcome") {
    let f = try Fixture(), original = try VMWire.document(f.unresolved())
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try check(f.model.ledger.reservationHeld)
    let d = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    try check(d.disposition == .clearedSimulation && f.model.accountingReleases == 1 && !f.model.ledger.reservationHeld)
    try check(VMWire.document(f.model.finish()) == original && f.registry.isHeld(f.binding.hostScopeId))
}
test("R19 boot deadline during creation cannot admit late response") {
    let f = try Fixture(start: false); try f.model.arm()
    f.effects.onCreate = { f.clock.reading.tick = f.binding.deadlines.bootBy }
    try rejects(.deadline) { try f.model.create() }
    try check(!f.model.owner.goConsumed && f.model.ledger.reservationHeld && f.effects.creates == 1)
}
test("R20 recovery clock failure cannot mutate finalized lifecycle") {
    let f = try Fixture(), bytes = try VMWire.document(f.unresolved())
    f.clock.reading.epochId = fixtureID(999)
    try rejects(.clock) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
    try check(f.model.phase == .finalized && f.model.ledger.reservationHeld && VMWire.document(f.model.finish()) == bytes)
}
test("C07 retained resource evidence cannot be relabelled as successful cleanup") {
    let f = try Fixture(); try f.model.completeWorkload()
    try f.observe(.ownerExit); try f.observe(.ownerReap); try f.observe(.vmStop)
    for claim in [VMObligation.vmResources, .disk, .scratch, .descriptors] { try f.observe(claim, value: .retained) }
    var forged = try f.unresolved()
    for i in forged.ledger.entries.indices { forged.ledger.entries[i].status = forged.ledger.entries[i].claim == .upstream ? .notRequired : .satisfied }
    forged.ledger.reservationHeld = false; forged.quarantine = nil; forged.findings = []
    forged.outcome = .completed; forged.verdict = .pass
    try rejects(.evidence) { _ = try VMWire.document(forged) }
}
test("C08 reconciliation result must be reproducible from exact previous ledger") {
    let f = try Fixture(); _ = try f.unresolved()
    var d = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    d.resultingLedger.entries[0].status = .satisfied
    d.resultingLedger.entries[0].evidenceRefs = [fixtureHash]
    d.remaining = d.resultingLedger.outstanding
    try rejects(.evidence) { _ = try VMWire.document(d) }
}
test("R21 reap preceding exit stays independently reaped") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.ownerReap)
    var exit = f.fact(.ownerExit, n: 200)
    exit.sequence = 200
    try f.model.observe(f.bootstrap.qualify(exit))
    try check(f.model.watchdog.state == .reaped && f.model.watchdog.reapRef != nil && f.model.owner.exitRef != nil)
}
test("C09 recovery prior resource identities must match embedded execution binding") {
    let f = try Fixture(); _ = try f.unresolved()
    var d = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    d.previousLedger.entries[0].resourceId = fixtureID(999)
    d.expectedLedgerDigest = try VMWire.digest(d.previousLedger)
    var derived = d.previousLedger
    for record in d.evidence { try derived.credit(record.fact) }
    derived.reservationHeld = !derived.complete
    d.resultingLedger = derived; d.remaining = derived.outstanding
    try rejects(.binding) { _ = try VMWire.document(d) }
}

func retainedRecovery(_ f: Fixture, n: Int = 800, tick: UInt64? = nil) throws -> VMQualifiedObservation {
    var fact = f.fact(.scratch, value: .retained, n: n)
    fact.source = .reconciler; fact.sourceId = f.binding.actors.reconciler
    if let tick { fact.tick = tick }
    return try f.bootstrap.qualifyRecovery(fact)
}
test("F1-A exact reviewer sequence cannot clear after contradictory recovery evidence") {
    let f = try Fixture(), original = try VMWire.document(f.unresolved())
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    do { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    catch let error as VMError { try check(error == .evidence || error == .contradiction) }
    var cleared = false
    let remaining = f.model.ledger.outstanding.filter { $0 != .scratch }
    do { cleared = try f.model.reconcile(proofs: f.recoveryProofs(remaining), permission: f.permission()).disposition == .clearedSimulation }
    catch let error as VMError { try check(error == .contradiction) }
    try check(!cleared && f.model.accountingReleases == 0, "qualified contradiction must prevent clearance and release")
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.ledger.entry(.scratch).evidenceRefs.count == 2)
    try check(f.model.recoveryObservations.count == 1 && f.model.recoveryObservations[0].fact.value == .retained)
    let audit = f.model.recoveryObservations[0]
    try check(VMWire.decode(VMReconciliationEvidence.self, VMWire.document(audit)) == audit)
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld && f.model.ledger.heldResources == VMResources())
    try check(VMWire.document(f.model.finish()) == original && f.effects.creates == 1)
    try rejects(.quarantined) { try f.model.requestReplacement() }
    try rejects(.quarantined) { try f.model.requestReuse() }
}
test("F1-B negative recovery before partial reconciliation cannot be overridden") {
    let f = try Fixture(); try f.model.completeWorkload(); try f.observe(.scratch); _ = try f.unresolved()
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("F1-C stale permission cannot hide a current qualified contradiction") {
    let f = try Fixture(); _ = try f.unresolved(); let stale = try f.permission()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: stale) }
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.ledger.reservationHeld)
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
}
test("F1-D duplicate and reused-ID contradiction retain distinct history idempotently") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    let negative = try retainedRecovery(f, n: 505) // same ID as the earlier scratch release
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission()) }
    let ledger = f.model.ledger, revision = f.model.recoveryRevision
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission()) }
    try check(f.model.ledger == ledger && f.model.recoveryRevision == revision)
    try check(ledger.entry(.scratch).evidenceRefs.count == 2 && ledger.entry(.scratch).status == .contradictory)
}
test("F1-E stale observation is rejected without becoming cleanup evidence") {
    let f = try Fixture(), report = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    let before = f.model.ledger
    try rejects(.stale) { _ = try f.model.reconcile(proofs: [retainedRecovery(f, tick: report.finalizedAtTick - 1)], permission: f.permission()) }
    try check(f.model.ledger == before && f.model.ledger.reservationHeld && f.model.quarantine?.state == .active)
}
test("F1-F cross-attempt negative cannot dispute this attempt's cleanup credit") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    var binding = f.binding; binding.attemptId = fixtureID(999)
    let g = try Fixture(binding: binding); _ = try g.unresolved()
    let before = f.model.ledger
    try rejects(.binding) { _ = try f.model.reconcile(proofs: [retainedRecovery(g)], permission: f.permission()) }
    try check(f.model.ledger == before && f.model.ledger.reservationHeld)
    let d = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    try check(d.disposition == .clearedSimulation && f.model.accountingReleases == 1)
}
test("F1-G contradiction during receipt publication invalidates candidate clearance") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try rejects(.stale) {
        _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission(), beforeReceipt: {
            try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
        })
    }
    try rejects(.incomplete) { _ = try f.model.recoverReconciliation() }
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("F1-H contradiction after lost acknowledgement cannot release on replay") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try rejects(.interrupted) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission(), interruption: .afterReceipt) }
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try rejects(.stale) { _ = try f.model.recoverReconciliation() }
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("F2-A broker settlement cannot be reused for a second exposure") {
    let f = try Fixture(); try f.model.brokerOperation(); try f.observe(.upstream)
    let settled = f.model.ledger.entry(.upstream)
    var secondDenied = false
    do { try f.model.brokerOperation() } catch let error as VMError { try check(error == .transition); secondDenied = true }
    try f.model.completeWorkload(); try f.cleanup(except: [.upstream]); let report = try f.model.finish()
    try check(secondDenied && f.effects.brokerCalls == 1, "settled broker exposure must never be dispatched again")
    try check(report.outcome == .completed && report.ledger.entry(.upstream) == settled)
}
test("F2-B precreation scratch credit cannot produce completed PASS") {
    let f = try Fixture(start: false)
    do { try f.observe(.scratch, n: 0) } catch let error as VMError { try check(error == .evidence) }
    try f.model.arm(); try f.model.create(); try f.model.go(); try f.model.completeWorkload(); try f.cleanup(except: [.scratch])
    var early: VMQualificationReport?
    do { early = try f.model.finish() } catch let error as VMError { try check(error == .transition) }
    try check(early?.outcome != .completed && early?.verdict != .pass, "pre-exposure credit must not produce PASS")
    let report = try early ?? f.unresolved()
    try check(report.outcome == .unresolved && report.ledger.entry(.scratch).status == .outstanding && report.ledger.reservationHeld)
    try check(f.effects.creates == 1)
}
test("F2-C broker dispatch is one shot both pending and unsettled") {
    let f = try Fixture(); var nested: VMError?
    f.effects.onBroker = { do { try f.model.brokerOperation() } catch { nested = error as? VMError } }
    try f.model.brokerOperation()
    try rejects(.transition) { try f.model.brokerOperation() }
    try check(nested == .busy && f.effects.brokerCalls == 1 && f.model.ledger.entry(.upstream).status == .outstanding)
    var candidate = f.model.ledger
    try rejects(.transition) { try candidate.exposeUpstream(at: f.clock.reading.tick, reference: fixtureHash) }
}
test("F2-D uncertain broker acknowledgement retains exposure and rejects stale settlement") {
    let f = try Fixture(), stale = f.fact(.upstream, n: 800)
    try rejects(.evidence) { _ = try f.bootstrap.qualify(stale) }
    f.clock.reading.tick += 100
    f.effects.onBroker = { f.clock.reading.tick = f.binding.deadlines.executionBy }
    try rejects(.deadline) { try f.model.brokerOperation() }
    try rejects(.authority) { try f.model.brokerOperation() }
    try rejects(.evidence) { try f.model.observe(f.bootstrap.qualify(stale)) }
    let report = try f.unresolved()
    try check(report.outcome == .unresolved && report.ledger.entry(.upstream).status == .outstanding && report.ledger.reservationHeld)
    try check(f.effects.brokerCalls == 1 && !f.model.brokerOpen)
}
test("F2-E pre-exposure and same-tick preminted scratch proofs are rejected") {
    let f = try Fixture(start: false), fact = f.fact(.scratch)
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    try f.model.arm(); try f.model.create(); try f.model.go()
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    // Independent credit validation is still required for DTO replay/evaluation.
    try rejects(.evidence) { try f.model.ledger.validateCredit(fact) }
    try check(f.model.ledger.entry(.scratch).evidenceRefs.isEmpty && f.model.ledger.entry(.scratch).status == .outstanding)
    try f.observe(.scratch, n: 900)
    try check(f.model.ledger.entry(.scratch).status == .satisfied && f.effects.creates == 1)
}
test("F2-F stale broker settlement is rejected even at the same clock tick") {
    let f = try Fixture(), fact = f.fact(.upstream, n: 800)
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    try f.model.brokerOperation()
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    try check(f.model.ledger.entry(.upstream).status == .outstanding)
    try f.observe(.upstream, n: 900)
    try rejects(.transition) { try f.model.brokerOperation() }
    try check(f.effects.brokerCalls == 1 && f.model.ledger.entry(.upstream).evidenceRefs.count == 1)
}
test("F2-G duplicate or uncertain VM creation cannot reuse cleanup credit") {
    let f = try Fixture(); try f.observe(.scratch)
    let credited = f.model.ledger.entry(.scratch)
    try rejects(.transition) { try f.model.create() }
    try check(f.effects.creates == 1 && f.model.ledger.entry(.scratch) == credited)
    let g = try Fixture(start: false); try g.model.arm(); g.effects.createResponse = .uncertain
    try rejects(.unavailable) { try g.model.create() }
    try rejects(.authority) { try g.model.create() }
    try check(g.effects.creates == 1 && g.model.ledger.entry(.scratch).status == .outstanding && g.model.ledger.reservationHeld)
}
test("F1-I evidence quota cannot preserve a disputed credit as satisfied") {
    let f = try Fixture()
    for n in 1000..<1029 { try f.observe(.scratch, value: .retained, n: n) }
    let original = try VMWire.document(f.unresolved())
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    try check(f.model.ledger.entries.flatMap(\.evidenceRefs).count == 32)
    try rejects(.quota) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.recoveryObservations.count == 1)
    try check(f.model.ledger.reservationHeld && f.model.accountingReleases == 0 && f.model.quarantine?.state == .active)
    try check(f.model.quarantine!.obligationSetDigest == VMWire.digest(f.model.ledger))
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
    try check(VMWire.document(f.model.finish()) == original)
}
test("F1-J unqualified negative cannot invalidate this attempt's release") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    let old = f.model.ledger, ordinary = try f.bootstrap.qualify(f.fact(.scratch, value: .retained, n: 800))
    try rejects(.authority) { _ = try f.model.reconcile(proofs: [ordinary], permission: f.permission()) }
    try check(f.model.ledger == old && f.model.recoveryObservations.isEmpty && !f.model.quarantine!.rejectionRefs.isEmpty)
}
test("F1-K foreign negative in a batch cannot mask a valid contradiction") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs([.scratch]), permission: f.permission())
    var binding = f.binding; binding.attemptId = fixtureID(999)
    let foreign = try Fixture(binding: binding); _ = try foreign.unresolved()
    try rejects(.contradiction) {
        _ = try f.model.reconcile(proofs: [retainedRecovery(foreign), retainedRecovery(f)], permission: f.permission())
    }
    try check(f.model.recoveryObservations.count == 1 && f.model.ledger.entry(.scratch).status == .contradictory)
    try check(f.model.ledger.reservationHeld && f.model.accountingReleases == 0)
}
test("F2-H settlement with the right reference but an older timestamp is stale") {
    let f = try Fixture(); f.clock.reading.tick += 100; try f.model.brokerOperation()
    var old = f.fact(.upstream, n: 800); old.tick = f.binding.deadlines.armedAt
    try rejects(.evidence) { try f.model.observe(f.bootstrap.qualify(old)) }
    try check(f.model.ledger.entry(.upstream).status == .outstanding)
    try f.observe(.upstream, n: 900)
    try check(f.model.ledger.entry(.upstream).status == .satisfied && f.effects.brokerCalls == 1)
}
test("F1-L retained pending resource can later settle without overriding a contradiction") {
    let f = try Fixture(); _ = try f.unresolved()
    try rejects(.evidence) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try check(f.model.ledger.entry(.scratch).status == .outstanding && f.model.ledger.reservationHeld)
    f.clock.reading.tick += 1
    let d = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    try check(d.disposition == .clearedSimulation && f.model.accountingReleases == 1 && f.model.recoveryObservations.count == 1)
    try check(f.model.finish().outcome == .unresolved)
}

test("R1-A post-clearance qualified contradiction must reopen a linked hold") {
    let f = try Fixture(); _ = try f.unresolved()
    _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    do { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) } catch is VMError {}
    try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld,
              "post-clearance counter-evidence must restore quarantine and full reservation")
    try check(f.model.ledger.entry(.scratch).status == .contradictory && !f.model.recoveryObservations.isEmpty)
}
test("R2-A predicted exact-reference proof cannot be qualified before exposure") {
    // A separate simulated world reveals only the deterministic event digest.
    let predictor = try Fixture(), f = try Fixture(start: false)
    var fact = f.fact(.scratch)
    fact.exposureReference = predictor.model.ledger.entry(.scratch).exposureReference
    var preminted: VMQualifiedObservation?
    do { preminted = try f.bootstrap.qualify(fact) } catch let error as VMError { try check(error == .evidence) }
    try check(preminted == nil, "predicted reference and matching tick cannot establish exposure ordering")
}

func clearedFixture() throws -> (Fixture, Data, VMRecoveryDecision) {
    let f = try Fixture(), original = try VMWire.document(f.unresolved())
    let decision = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    return (f, original, decision)
}
func reportReceipt(_ bytes: Data, binding: VMExecutionBinding) throws -> Data {
    try VMWire.document(VMReceipt(bindingDigest: VMWire.digest(binding), documentKind: VMQualificationReport.documentKind,
        digest: VMWire.hash(bytes), byteLength: bytes.count))
}
test("R1-B duplicate dispute preserves historical reports decisions and receipts") {
    let (f, original, decision) = try clearedFixture(), closed = f.model.quarantine!
    let artifacts = try f.model.recoveryArtifacts(), negative = try retainedRecovery(f)
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission()) }
    let record = f.model.postClearanceDispute!, ledger = f.model.ledger, revision = f.model.recoveryRevision
    let published = try f.model.disputeArtifacts()
    try check(VMPublication<VMPostClearanceDispute>.verify(bytes: published.bytes, receipt: published.receipt) == record)
    try check(record.clearedCase == closed && record.clearance == decision && record.quarantine.caseId != closed.caseId)
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission()) }
    try check(f.model.ledger == ledger && f.model.recoveryRevision == revision && f.model.recoveryObservations.count == 1)
    try check(f.model.accountingReleases == 1 && f.model.accountingReinstatements == 1 && f.model.ledger.heldResources == VMResources())
    try check(f.registry.isHeld(f.binding.hostScopeId, caseId: record.quarantine.caseId), "new dispute requires its own host-scope hold")
    let after = try f.model.recoveryArtifacts(), afterDispute = try f.model.disputeArtifacts()
    try check(after.bytes == artifacts.bytes && after.receipt == artifacts.receipt && afterDispute.bytes == published.bytes && afterDispute.receipt == published.receipt)
    try check(f.model.recoverReconciliation() == decision && f.model.ledger == ledger && VMWire.document(f.model.finish()) == original)
    try rejects(.quarantined) { try f.model.requestReplacement() }
    try rejects(.quarantined) { try f.model.requestReuse() }
}
test("R1-C stale foreign unqualified and mismatched post-clearance evidence is rejected") {
    let f = try Fixture(); let report = try f.unresolved()
    f.clock.reading.tick += 10
    _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    let closed = f.model.quarantine!, ledger = f.model.ledger
    try rejects(.stale) { _ = try f.model.reconcile(proofs: [retainedRecovery(f, tick: report.finalizedAtTick)], permission: f.permission()) }
    var b = f.binding; b.attemptId = fixtureID(999)
    let g = try Fixture(binding: b); _ = try g.unresolved()
    try rejects(.binding) { _ = try f.model.reconcile(proofs: [retainedRecovery(g)], permission: f.permission()) }
    let ordinary = try f.bootstrap.qualify(f.fact(.scratch, value: .retained, n: 900))
    try rejects(.authority) { _ = try f.model.reconcile(proofs: [ordinary], permission: f.permission()) }
    var wrong = f.fact(.scratch, value: .retained, n: 901)
    wrong.source = .reconciler; wrong.sourceId = f.binding.actors.reconciler; wrong.exposureReference = fixtureHash
    try rejects(.evidence) { _ = try f.bootstrap.qualifyRecovery(wrong) }
    try check(f.model.quarantine == closed && f.model.ledger == ledger && f.model.postClearanceDispute == nil)
    try check(f.model.postClearanceRejections.count == 3 && f.model.recoveryObservations.isEmpty && f.model.accountingReinstatements == 0)
}
for point in VMPublicationPoint.allCases {
    test("R1-D interrupted dispute publication \(point) never removes safety holds") {
        let (f, original, _) = try clearedFixture(), negative = try retainedRecovery(f)
        try rejects(.interrupted) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission(), interruption: point) }
        try check(f.model.quarantine?.state == .active && f.model.ledger.reservationHeld && f.model.ledger.entry(.scratch).status == .contradictory)
        try check(f.model.accountingReleases == 1 && f.model.accountingReinstatements == 1 && f.model.recoveryObservations.count == 1)
        try check(f.registry.isHeld(f.binding.hostScopeId, caseId: f.model.quarantine!.caseId))
        if point == .afterReceipt {
            let a = try f.model.disputeArtifacts()
            try check(VMPublication<VMPostClearanceDispute>.verify(bytes: a.bytes, receipt: a.receipt) == f.model.postClearanceDispute!)
        } else { try rejects(.incomplete) { _ = try f.model.disputeArtifacts() } }
        let ledger = f.model.ledger
        try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [negative], permission: f.permission()) }
        try check(f.model.ledger == ledger && f.model.accountingReinstatements == 1 && VMWire.document(f.model.finish()) == original)
    }
}
test("R1-E clearance acknowledgement loss then apply cannot hide later dispute") {
    let f = try Fixture(), original = try VMWire.document(f.unresolved())
    try rejects(.interrupted) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission(), interruption: .afterReceipt) }
    let decision = try f.model.recoverReconciliation(), artifacts = try f.model.recoveryArtifacts()
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try check(f.model.recoverReconciliation() == decision && f.model.ledger.reservationHeld && f.model.accountingReleases == 1 && f.model.accountingReinstatements == 1)
    let after = try f.model.recoveryArtifacts()
    try check(after.bytes == artifacts.bytes && after.receipt == artifacts.receipt && VMWire.document(f.model.finish()) == original)
}
test("R1-F passive restore preserves linked dispute but never reconstructs authority") {
    let (f, original, _) = try clearedFixture(), receipt = try reportReceipt(original, binding: f.binding)
    let passive = VMLifecycle.restore(original, receipt: receipt, binding: f.binding, registry: f.registry)
    try check(!passive.canResume && passive.reservationHeld)
    // Only the still-existing trusted simulation root can qualify a new fact;
    // the restored DTO has no live aggregate or registration authority.
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    let a = try f.model.disputeArtifacts(), registry = VMHostRegistry()
    let restored = VMLifecycle.restore(original, receipt: receipt, binding: f.binding, registry: registry, disputeBytes: a.bytes, disputeReceipt: a.receipt)
    try check(restored.verifiedTerminalMetadata && restored.reservationHeld && !restored.canResume && !restored.allowNativeLaunch)
    try check(registry.isHeld(f.binding.hostScopeId, caseId: f.model.quarantine!.caseId))
    try check(restored.historicalOutcome == .unresolved && restored.uncertaintyDigest == VMWire.hash(a.bytes))
    let incomplete = VMLifecycle.restore(original, receipt: receipt, binding: f.binding, registry: registry, disputeBytes: a.bytes)
    try check(!incomplete.verifiedTerminalMetadata && incomplete.reservationHeld && !incomplete.canResume)
    let corrupt = VMLifecycle.restore(original, receipt: receipt, binding: f.binding, registry: registry, disputeBytes: a.bytes, disputeReceipt: Data(a.receipt.dropLast()))
    try check(!corrupt.verifiedTerminalMetadata && corrupt.reservationHeld)
    var b = f.binding; b.attemptId = fixtureID(999)
    let foreign = try Fixture(binding: b), foreignBytes = try VMWire.document(foreign.unresolved())
    let cross = VMLifecycle.restore(foreignBytes, receipt: try reportReceipt(foreignBytes, binding: b), binding: b, registry: VMHostRegistry(), disputeBytes: a.bytes, disputeReceipt: a.receipt)
    try check(!cross.verifiedTerminalMetadata && cross.reservationHeld)
}
test("R1-G quota exhaustion while reopening retains counter-evidence and full reservation") {
    let f = try Fixture()
    // 23 ordinary facts + two local facts + seven recovery credits = 32 refs.
    for n in 1000..<1023 { try f.observe(.scratch, value: .retained, n: n) }
    let original = try VMWire.document(f.unresolved())
    _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission())
    try check(f.model.ledger.entries.flatMap(\.evidenceRefs).count == 32 && !f.model.ledger.reservationHeld)
    try rejects(.quota) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    try check(f.model.quarantine?.state == .active && f.model.quarantine!.reasonCodes.contains(.quota))
    try check(f.model.ledger.entry(.scratch).status == .contradictory && f.model.ledger.reservationHeld && f.model.ledger.heldResources == VMResources())
    let a = try f.model.disputeArtifacts(), d = try VMPublication<VMPostClearanceDispute>.verify(bytes: a.bytes, receipt: a.receipt)
    try check(d.evidence.fact.value == .retained && f.model.recoveryObservations.count == 1 && f.model.accountingReinstatements == 1)
    try check(VMWire.document(f.model.finish()) == original)
}
test("R1-H post-clearance dispute DTO cannot relabel history or produce a release") {
    let (f, _, _) = try clearedFixture()
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: [retainedRecovery(f)], permission: f.permission()) }
    let d = f.model.postClearanceDispute!
    var changed = d; changed.clearedCase.state = .active
    try rejects(.evidence) { _ = try VMWire.document(changed) }
    changed = d; changed.clearedCase.hostScopeId = fixtureID(999); changed.quarantine.hostScopeId = fixtureID(999)
    try rejects(.evidence) { _ = try VMWire.document(changed) }
    changed = d; changed.quarantine.recoveryRevision += 1
    try rejects(.evidence) { _ = try VMWire.document(changed) }
    changed = d; changed.evidence.fact.exposureReference = fixtureHash
    try rejects(.evidence) { _ = try VMWire.document(changed) }
    try rejects(.contradiction) { _ = try f.model.reconcile(proofs: f.recoveryProofs(), permission: f.permission()) }
}
test("R2-B predicted reference with exact future tick cannot pre-mint normal or recovery proofs") {
    let predictor = try Fixture(start: false), f = try Fixture(start: false)
    predictor.clock.reading.tick += 500; try predictor.model.arm(); try predictor.model.create()
    var fact = f.fact(.scratch); fact.exposureReference = predictor.model.ledger.entry(.scratch).exposureReference
    fact.tick = predictor.clock.reading.tick
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    fact.source = .reconciler; fact.sourceId = f.binding.actors.reconciler
    try rejects(.evidence) { _ = try f.bootstrap.qualifyRecovery(fact) }
    f.clock.reading.tick = predictor.clock.reading.tick; try f.model.arm(); try f.model.create(); try f.model.go()
    try check(f.model.ledger.entry(.scratch).exposureReference == fact.exposureReference)
    try f.model.completeWorkload(); try f.observe(.scratch, n: 0); try f.cleanup(except: [.scratch])
    try check(f.model.finish().outcome == .completed, "fresh qualification after real fake exposure remains supported")
}
test("R2-C exact resource and attempt registration required even with matching reference") {
    let f = try Fixture(); var fact = f.fact(.scratch)
    fact.resourceId = f.binding.resourceIds[4]
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    fact = f.fact(.upstream); fact.exposureReference = f.model.ledger.entry(.scratch).exposureReference
    try rejects(.evidence) { _ = try f.bootstrap.qualify(fact) }
    var b = f.binding; b.attemptId = fixtureID(999)
    let g = try Fixture(binding: b)
    try rejects(.binding) { _ = try f.bootstrap.qualify(g.fact(.scratch)) }
    let proper = try f.bootstrap.qualify(f.fact(.scratch))
    try f.model.observe(proper)
    try check(f.model.ledger.entry(.scratch).status == .satisfied)
}
for response in [VMCreateResponse.created, .uncertain] {
    test("R2-D reentrant qualification sees reserved exposure before port returns \(response)") {
        let f = try Fixture(start: false); try f.model.arm(); f.effects.createResponse = response
        var proof: VMQualifiedObservation?, failure: Error?
        f.effects.onCreate = { do { proof = try f.bootstrap.qualify(f.fact(.scratch, n: 0)) } catch { failure = error } }
        if response == .created { try f.model.create() }
        else { try rejects(.unavailable) { try f.model.create() } }
        try check(proof != nil && failure == nil && f.effects.creates == 1)
        if response == .created {
            try f.model.go(); try f.model.completeWorkload(); try f.model.observe(proof!)
            try f.cleanup(except: [.scratch]); try check(f.model.finish().outcome == .completed)
            try rejects(.terminal) { try f.model.create() }
        } else {
            try rejects(.quarantined) { try f.model.observe(proof!) }
            try rejects(.authority) { try f.model.create() }
            try check(f.unresolved().outcome == .unresolved && f.model.ledger.reservationHeld)
        }
    }
}
test("R2-E old qualified proof cannot cross generation or reopen dispatch") {
    let f = try Fixture(), old = try f.bootstrap.qualify(f.fact(.scratch, n: 0))
    try f.model.completeWorkload(); try f.model.observe(old); try f.cleanup(except: [.scratch]); _ = try f.model.finish()
    try rejects(.terminal) { try f.model.create() }
    try rejects(.terminal) { try f.model.observe(old) }
    // Equal serialized binding/event references in a later simulated world do
    // not transfer opaque exposure identity. Same-attempt re-exposure is denied.
    let later = try Fixture()
    try check(later.model.ledger.entry(.scratch).exposureReference == old.fact.exposureReference)
    try rejects(.authority) { try later.model.observe(old) }
    try later.observe(.scratch)
    try rejects(.transition) { try later.model.create() }
    try check(later.effects.creates == 1 && later.model.ledger.entry(.scratch).status == .satisfied)
}
test("R2-F restored DTO has no trusted exposure registration") {
    let f = try Fixture(), fact = f.fact(.scratch)
    let dto = try VMWire.decode(VMResourceObligations.self, VMWire.document(f.model.ledger))
    let root = try VMSimulationBootstrap(binding: VMWire.decode(VMExecutionBinding.self, VMWire.document(f.binding)))
    _ = try root.issue() // Issuing a grant alone does not reserve any exposure.
    try check(dto.entry(.scratch).exposureReference == fact.exposureReference)
    try rejects(.evidence) { _ = try root.qualify(fact) }
    var recovery = fact; recovery.source = .reconciler; recovery.sourceId = f.binding.actors.reconciler
    try rejects(.evidence) { _ = try root.qualifyRecovery(recovery) }
    try check(f.model.ledger.entry(.scratch).status == .outstanding)
}

print("\(passed) passed; \(failed) failed — D1-A fake-backed simulation only")
if failed > 0 || passed == 0 { exit(1) }
