import Foundation

enum TestFailure: Error { case assertion(String) }
func check(_ value: @autoclosure () throws -> Bool, _ message: String = "assertion failed") throws {
    if try !value() { throw TestFailure.assertion(message) }
}
func rejects(_ expected: AdapterError, _ body: () throws -> Void) throws {
    do { try body() } catch let error as AdapterError {
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
let owner = "22222222-2222-4222-8222-222222222222"
let request = "33333333-3333-4333-8333-333333333333"
let digest = String(repeating: "a", count: 64)
let nonce = Data(repeating: 127, count: 32)
let guardIdentity = AdapterIdentity(pid: 40, parentPID: 30, uid: 501, start: 1, executableDigest: digest)
let identity = AdapterIdentity(pid: 50, parentPID: 40, uid: 501, start: 2, executableDigest: digest)
func binding(_ expected: AdapterWorkload = .completed) -> AdapterBinding {
    AdapterBinding(sessionID: session, requestID: request, ownerID: owner, sourceRevision: String(repeating: "b", count: 40),
        guardDigest: digest, helperDigest: digest, expected: expected)
}
final class FakeClock: AdapterClock {
    var reading = AdapterClockReading(milliseconds: 100, epoch: session, wakeGeneration: 0)
    var tick: UInt64 { get { reading.milliseconds } set { reading.milliseconds = newValue } }
}
final class FakeChild: AdapterChild {
    var calls: [String] = []
    var waitOwner: AdapterWaitOwner?
    var observation = AdapterObservation(identity: identity, exit: nil, descendantCount: 0, resourcesReleased: true)
    var observationUnavailable = false
    var waits: [AdapterWaitResult] = [.pending]
    var descriptors = AdapterDescriptorResult.closed
    var delivery = AdapterDelivery.accepted
    var goDelivery = AdapterDelivery.accepted
    var duringWait: (() -> Void)?
    var duringObserve: (() -> Void)?
    var duringClose: (() -> Void)?
    var duringGo: (() -> Void)?
    var duringSignal: (() -> Void)?
    func wait(owner: AdapterWaitOwner) -> AdapterWaitResult {
        calls.append("wait"); duringWait?()
        guard waitOwner === owner else { return .noChild }
        return waits.count > 1 ? waits.removeFirst() : waits[0]
    }
    func signal(_ signal: AdapterSignal) -> AdapterDelivery {
        calls.append(signal.rawValue); duringSignal?(); return delivery
    }
    func observe() -> AdapterObservationResult {
        calls.append("observe"); duringObserve?()
        return observationUnavailable ? .unavailable : .observed(observation)
    }
    func closeDescriptors() -> AdapterDescriptorResult {
        calls.append("close"); duringClose?(); return descriptors
    }
    func deliverGo(_ go: AdapterGo) -> AdapterDelivery {
        calls.append("go"); duringGo?(); return goDelivery
    }
    func exit(_ value: AdapterExit = .exited(0)) {
        waits = [.reaped(value)]; observation.exit = value
    }
}
final class FakeSpawner: AdapterSpawner {
    let child = FakeChild()
    var count = 0
    var available = true
    var duringSpawn: (() -> Void)?
    func spawn(_ binding: AdapterBinding, waitOwner: AdapterWaitOwner) -> AdapterSpawnResult {
        count += 1; duringSpawn?(); child.waitOwner = waitOwner
        return available ? .created(child) : .unavailable
    }
}
final class FakeEmergency: AdapterEmergency {
    var qualification = EmergencyQualification.qualifiedSimulation
    var outcome = EmergencyOutcome.accepted
    var requests = 0
    var duringQualification: (() -> Void)?
    func qualify(bindingDigest: String) -> EmergencyQualification { duringQualification?(); return qualification }
    func requestStop(bindingDigest: String) -> EmergencyOutcome { requests += 1; return outcome }
}
func fixture(_ expected: AdapterWorkload = .completed, emergency: (any AdapterEmergency)? = nil) throws -> (AdapterLifecycle, FakeClock, FakeSpawner, FakeEmergency) {
    let clock = FakeClock(), spawn = FakeSpawner(), capability = FakeEmergency()
    let model = try AdapterLifecycle(binding: binding(expected), guardIdentity: guardIdentity, clock: clock,
        spawner: spawn, emergency: emergency ?? capability, nonce: nonce)
    return (model, clock, spawn, capability)
}
func ready(_ expected: AdapterWorkload = .completed, emergency: (any AdapterEmergency)? = nil) throws -> (AdapterLifecycle, FakeClock, FakeSpawner, FakeEmergency, AdapterGo) {
    let (model, clock, spawn, capability) = try fixture(expected, emergency: emergency)
    let go = try model.arm(); try model.prepare()
    let frame = AdapterFrame(sessionID: session, bindingDigest: try AdapterWire.digest(binding(expected)),
        deadlineDigest: try AdapterWire.digest(go.deadlines), sequence: 1, kind: .ready, text: "")
    try model.receive(AdapterWire.encode(frame))
    return (model, clock, spawn, capability, go)
}
func running(_ expected: AdapterWorkload = .completed) throws -> (AdapterLifecycle, FakeClock, FakeSpawner, FakeEmergency) {
    let (model, clock, spawn, capability, go) = try ready(expected)
    try model.go(go); return (model, clock, spawn, capability)
}
func published(_ model: AdapterLifecycle) throws -> AdapterReport {
    let store = AdapterPublication(); try store.stage(model.report()); try store.commit(); return try store.verified()
}

test("creation recorded before fallible observation; ownership obligation survives") {
    let (m, _, s, _) = try fixture(); _ = try m.arm(); s.child.observationUnavailable = true
    try rejects(.observation) { try m.prepare() }
    let r = try m.report()
    try check(r.creationRecorded && r.cleanupObligation && r.events.contains { $0.kind == .spawned })
    try check(r.cleanup == .unresolved && r.verdict != .pass && s.count == 1)
    try rejects(.transition) { try m.prepare() }
    try m.cancel(AdapterWire.digest(binding()))
    try check(s.child.calls.contains("TERM"))
}
test("modeled positive control requires GO, owned reap and complete cleanup") {
    let (m, _, s, _) = try running(); s.child.exit(); try m.poll()
    let r = try published(m)
    try check(r.verdict == .pass && r.cleanup == .verifiedModel && !r.cleanupObligation)
    try check(r.mode == "deterministic-fakes" && r.authorization == "none" && !r.allowNativeLaunch)
    try check(s.count == 1 && s.child.waitOwner?.ownerID == owner)
}
test("bounded EINTR retains unresolved cleanup without infinite retry") {
    let (m, _, s, _) = try running(); s.child.waits = [.interrupted]
    try m.poll(); try m.poll()
    try check(s.child.calls.filter { $0 == "wait" }.count == AdapterLimits.maximumWaitCalls)
    try check(m.report().issues.contains(.eintrLimit) && m.report().cleanupObligation)
}
test("ECHILD loses authority without silently settling") {
    let (m, _, s, _) = try running(); s.child.waits = [.noChild]; try m.poll()
    try rejects(.ownership) { try m.cancel(AdapterWire.digest(binding())) }
    try m.poll()
    try check(m.report().cleanup == .unresolved && m.report().issues.contains(.noChild))
    try check(!s.child.calls.contains("TERM"))
}
test("exit during cancellation is reaped once and never signaled afterward") {
    let (m, _, s, _) = try running(.cancelled)
    s.child.duringSignal = { s.child.exit() }
    try m.cancel(AdapterWire.digest(binding(.cancelled))); try m.poll()
    let before = s.child.calls; let bytes = try AdapterWire.encode(m.report())
    try m.poll(); try rejects(.transition) { try m.cancel(AdapterWire.digest(binding(.cancelled))) }
    try check(s.child.calls == before && AdapterWire.encode(m.report()) == bytes)
    try check(published(m).verdict == .pass)
}
test("default emergency capability blocks GO; no implicit fallback") {
    let (m, _, s, _, go) = try ready(emergency: UnavailableAdapterEmergency())
    try rejects(.emergency) { try m.go(go) }
    try check(m.report().verdict == .blocked && !s.child.calls.contains("go"))
    try check(m.report().cleanupObligation)
}
for phase in ["entry", "wait", "observe", "close"] {
    for completion: UInt64 in [8099, 8100, 8101] {
        test("normal completion at \(completion) during \(phase) preserves F2") {
            let (m, clock, s, _) = try running(); clock.tick = phase == "entry" ? completion : 8099
            if phase == "wait" { s.child.duringWait = { clock.tick = completion } }
            if phase == "observe" { s.child.duringObserve = { clock.tick = completion } }
            if phase == "close" { s.child.duringClose = { clock.tick = completion } }
            s.child.exit(); try m.poll(); let r = try published(m)
            try check(r.workload == (completion < 8100 ? .completed : .timedOut))
            try check(r.verdict == (completion < 8100 ? .pass : .fail))
        }
    }
}
for elapsed: UInt64 in [3999, 4000, 4001, 30000] {
    test("late cleanup at +\(elapsed) preserves F1 and cleanup evidence separately") {
        let (m, clock, s, _) = try running(.cancelled)
        try m.cancel(AdapterWire.digest(binding(.cancelled)))
        clock.tick += elapsed; s.child.exit(); try m.poll()
        let r = try published(m)
        try check(r.cleanup == .verifiedModel && !r.cleanupObligation)
        try check(r.verdict == (elapsed < 4000 ? .pass : .fail))
        try check(r.issues.contains(.cleanupDeadline) == (elapsed >= 4000))
        try check(r.issues.contains(.caseDeadline) == (elapsed >= 30000))
    }
}
test("expected timeout is an experiment outcome, not successful workload completion") {
    let (m, clock, s, _) = try running(.timedOut); clock.tick = 8100
    s.child.exit(); try m.poll()
    try check(published(m).verdict == .pass && m.report().workload == .timedOut)
}
test("valid evidence positive control and exact publication interruption errors") {
    let (m, _, s, _) = try running(); s.child.exit(); try m.poll()
    try check(published(m).verdict == .pass)
    for point in [AdapterPublicationInterruption.beforeBytes, .afterBytes] {
        let store = AdapterPublication(); try store.stage(m.report())
        try rejects(.interrupted) { try store.commit(interruption: point) }
        try rejects(.incompleteEvidence) { _ = try store.verified() }
    }
}

test("EINTR can resolve within the fixed retry budget") {
    let (m, _, s, _) = try running(); s.child.exit(); s.child.waits = [.interrupted, .interrupted, .reaped(.exited(0))]
    try m.poll(); try check(published(m).verdict == .pass)
    try check(s.child.calls.filter { $0 == "wait" }.count == 3)
}
test("EINTR crossing execution deadline stops retries before termination request") {
    let (m, clock, s, _) = try running(.timedOut)
    s.child.waits = [.interrupted]; s.child.duringWait = { clock.tick = 8100 }
    try m.poll()
    try check(s.child.calls.filter { $0 == "wait" }.count == 1 && s.child.calls.contains("TERM"))
    try check(m.report().workload == .timedOut && m.report().cleanup == .unresolved)
}
test("unavailable spawn is typed and never retried") {
    let m = try AdapterLifecycle(binding: binding(), guardIdentity: guardIdentity, clock: FakeClock(), nonce: nonce)
    _ = try m.arm(); try rejects(.unsupported) { try m.prepare() }
    try check(m.report().verdict == .blocked && !m.report().creationRecorded)
    try rejects(.transition) { try m.prepare() }
}
test("wrong wait owner cannot settle an otherwise exited child") {
    let (m, _, s, _) = try running(); s.child.exit()
    s.child.waitOwner = AdapterWaitOwner(binding: binding()) // Same UUIDs, different owner object.
    try m.poll(); try check(m.report().issues.contains(.noChild) && m.report().cleanupObligation)
}
test("failure after spawn permits known-child reap but cannot become PASS") {
    let (m, _, s, _) = try fixture(); _ = try m.arm(); s.child.observationUnavailable = true
    try rejects(.observation) { try m.prepare() }
    s.child.observationUnavailable = false; s.child.exit(); try m.poll()
    try check(m.report().exit == .exited(0) && m.report().cleanupObligation && m.report().verdict == .fail)
    let count = s.child.calls.count; try m.poll(); try check(s.child.calls.count == count)
}
for bad in ["parent", "uid", "digest", "pid", "descendants"] {
    test("initial contradictory \(bad) observation never grants signal authority") {
        let (m, _, s, _) = try fixture(); _ = try m.arm()
        switch bad {
        case "parent": s.child.observation.identity.parentPID = 999
        case "uid": s.child.observation.identity.uid = 999
        case "digest": s.child.observation.identity.executableDigest = String(repeating: "c", count: 64)
        case "pid": s.child.observation.identity.pid = 1
        default: s.child.observation.descendantCount = 1
        }
        try rejects(.ownership) { try m.prepare() }
        try rejects(.ownership) { try m.cancel(AdapterWire.digest(binding())) }
        try check(m.report().cleanupObligation && !s.child.calls.contains("TERM"))
    }
}
test("unqualified emergency is not sufficient; helper JSON cannot qualify it") {
    let (m, _, s, e, go) = try ready(); e.qualification = .unqualified
    try rejects(.contract) { try m.receive(Data("{\"emergencyQualified\":true}".utf8)) }
    try check(!s.child.calls.contains("go") && m.report().verdict != .pass)
    let (other, _, otherSpawn, otherEmergency, token) = try ready()
    otherEmergency.qualification = .unqualified
    try rejects(.emergency) { try other.go(token) }
    try check(other.report().verdict == .blocked && !otherSpawn.child.calls.contains("go"))
    _ = go
}
test("guard loss uses separate capability, never transfers wait ownership") {
    let (m, _, s, e) = try running(); let before = s.child.calls
    try m.guardLost(AdapterWire.digest(binding())); try m.poll()
    let r = try m.report()
    try check(e.requests == 1 && s.child.calls == before && r.cleanup == .unresolved && r.cleanupObligation)
    try check(r.events.contains { $0.kind == .emergencyRequested })
    try check(r.events.contains { $0.kind == .emergencyAccepted })
    try check(r.verdict == .fail)
    try rejects(.ownership) { try m.cancel(AdapterWire.digest(binding())) }
    try rejects(.transition) { try m.guardLost(AdapterWire.digest(binding())) }
}
for result in [EmergencyOutcome.denied, .unavailable] {
    test("emergency \(result) preserves unresolved cleanup and bounded requests") {
        let (m, _, s, e) = try running(); e.outcome = result
        try m.guardLost(AdapterWire.digest(binding())); try m.poll(); try m.poll()
        try check(e.requests == 1 && m.report().cleanupObligation && m.report().verdict == .fail)
        try check(!s.child.calls.contains("TERM") && !s.child.calls.contains("KILL"))
    }
}
test("controller disappearance cancels its bound child without resetting deadlines") {
    let (m, _, s, _) = try running(.cancelled); let deadlines = try m.report().deadlines
    try m.controllerLost(AdapterWire.digest(binding(.cancelled))); s.child.exit(); try m.poll()
    try check(published(m).verdict == .pass && m.report().deadlines == deadlines)
}
test("controller loss at execution deadline cannot hide timeout") {
    let (m, clock, s, _) = try running(.timedOut); clock.tick = 8100
    try m.controllerLost(AdapterWire.digest(binding(.timedOut))); s.child.exit(); try m.poll()
    try check(published(m).workload == .timedOut)
}
test("TERM acceptance is not reap; KILL is bounded and remains unverified until wait") {
    let (m, clock, s, _) = try running(.timedOut); clock.tick = 8100; try m.poll()
    try check(m.report().cleanup == .unresolved && m.report().exit == nil)
    clock.tick = 9100; try m.poll(); try m.poll()
    try check(s.child.calls.filter { $0 == "TERM" }.count == 1 && s.child.calls.filter { $0 == "KILL" }.count == 1)
    s.child.exit(.signaled(9)); try m.poll(); try check(published(m).verdict == .pass)
}
test("signal denial does not erase ownership or masquerade as termination") {
    let (m, _, s, _) = try running(.cancelled); s.child.delivery = .denied
    try rejects(.delivery) { try m.cancel(AdapterWire.digest(binding(.cancelled))) }
    try check(m.report().cleanupObligation && m.report().exit == nil && m.report().issues.contains(.signalDenied))
    s.child.exit(); try m.poll(); try check(published(m).verdict == .fail)
}
test("reentrant signal callback cannot race reap or report") {
    let (m, _, s, _) = try running(.cancelled)
    var rejections = 0
    s.child.duringSignal = {
        do { try m.poll() } catch AdapterError.busy { rejections += 1 } catch { }
        do { _ = try m.report() } catch AdapterError.busy { rejections += 1 } catch { }
    }
    try m.cancel(AdapterWire.digest(binding(.cancelled)))
    try check(rejections == 2 && !s.child.calls.contains("wait"))
}
for dimension in ["exit", "identity", "descendants", "resources", "descriptors", "unavailableDescriptors", "missingObservation"] {
    test("post-reap \(dimension) failure retains evidence and revokes signaling") {
        let (m, _, s, _) = try running(); s.child.exit()
        switch dimension {
        case "exit": s.child.observation.exit = .exited(7)
        case "identity": s.child.observation.identity.start += 1
        case "descendants": s.child.observation.descendantCount = 1
        case "resources": s.child.observation.resourcesReleased = false
        case "descriptors": s.child.descriptors = .partial
        case "unavailableDescriptors": s.child.descriptors = .unavailable
        default: s.child.observationUnavailable = true
        }
        try m.poll(); let r = try m.report()
        try check(r.verdict == .fail && r.cleanup != .verifiedModel && r.cleanupObligation)
        try check(s.child.calls.last == "close")
        let calls = s.child.calls; try m.poll()
        try rejects(.transition) { try m.cancel(AdapterWire.digest(binding())) }
        try check(calls == s.child.calls)
    }
}
for problem in ["rollback", "epoch", "wake"] {
    test("clock \(problem) is sticky and cannot produce PASS") {
        let (m, clock, s, _) = try running()
        switch problem {
        case "rollback": clock.tick = 99
        case "epoch": clock.reading.epoch = owner
        default: clock.reading.wakeGeneration = 1
        }
        try rejects(.deadline) { try m.poll() }
        clock.reading = AdapterClockReading(milliseconds: 101, epoch: session, wakeGeneration: 0)
        try rejects(.deadline) { try m.poll() }
        try check(m.report().verdict == .fail && m.report().cleanupObligation)
        try check(!s.child.calls.contains("TERM") && !s.child.calls.contains("wait"))
    }
}
test("deadline overflow blocks before modeled creation") {
    let (m, clock, s, _) = try fixture(); clock.tick = UInt64.max
    try rejects(.deadline) { _ = try m.arm() }
    try check(s.count == 0 && m.report().issues.contains(.overflow))
}
test("successful reap revokes even if final clock observation fails") {
    let (m, clock, s, _) = try running(); s.child.exit(); s.child.duringObserve = { clock.tick = 99 }
    try rejects(.deadline) { try m.poll() }
    let calls = s.child.calls; try m.poll()
    try rejects(.transition) { try m.cancel(AdapterWire.digest(binding())) }
    try check(calls == s.child.calls && m.report().verdict == .fail)
}
for operation in ["spawn", "qualification", "go"] {
    test("execution deadline crossing inside \(operation) is observed") {
        if operation == "spawn" {
            let (m, clock, s, _) = try fixture(); _ = try m.arm(); s.duringSpawn = { clock.tick = 8100 }
            try rejects(.deadline) { try m.prepare() }
            try check(m.report().creationRecorded && m.report().cleanupObligation)
        } else {
            let (m, clock, s, e, token) = try ready()
            if operation == "qualification" { e.duringQualification = { clock.tick = 8100 } }
            else { s.child.duringGo = { clock.tick = 8100 } }
            try rejects(.deadline) { try m.go(token) }
            try check(m.report().verdict != .pass)
            try check(s.child.calls.contains("go") == (operation == "go"))
        }
    }
}
for field in ["binding", "deadline", "nonce"] {
    test("GO rejects changed \(field)") {
        let (m, _, s, _, token) = try ready(); var altered = token
        switch field {
        case "binding": altered.bindingDigest = String(repeating: "c", count: 64)
        case "deadline": altered.deadlines = try AdapterDeadlines.make(at: 101)
        default: altered.nonce = Data(repeating: 0, count: 32)
        }
        try rejects(.ownership) { try m.go(altered) }
        try check(!s.child.calls.contains("go"))
    }
}
test("one-use GO rejects replay and never respawns") {
    let (m, _, s, _, token) = try ready(); try m.go(token)
    try rejects(.replay) { try m.go(token) }
    try rejects(.replay) { _ = try m.arm() }
    try check(s.count == 1 && s.child.calls.filter { $0 == "go" }.count == 1)
}
test("stale GO cannot extend immutable deadlines") {
    let (m, clock, s, _, token) = try ready(); clock.tick = 8100
    try rejects(.deadline) { try m.go(token) }
    try check(m.report().deadlines == token.deadlines && !s.child.calls.contains("go"))
}
for invalid in ["malformed", "oversize", "authority", "sequence", "binding", "deadline", "session", "order"] {
    test("protocol rejects \(invalid) without granting authority") {
        let (m, _, s, _) = try running()
        let deadlines = try m.report().deadlines!
        var frame = AdapterFrame(sessionID: session, bindingDigest: try AdapterWire.digest(binding()),
            deadlineDigest: try AdapterWire.digest(deadlines), sequence: 2, kind: .observation, text: "")
        switch invalid {
        case "sequence": frame.sequence = 1
        case "binding": frame.bindingDigest = String(repeating: "c", count: 64)
        case "deadline": frame.deadlineDigest = String(repeating: "c", count: 64)
        case "session": frame.sessionID = owner
        case "order": frame.kind = .ready
        default: break
        }
        var bytes = try AdapterWire.encode(frame)
        if invalid == "oversize" { bytes = Data(repeating: 0, count: 4097) }
        if invalid == "malformed" { bytes = Data("{".utf8) }
        if invalid == "authority" { bytes = Data("{\"pid\":50,\"signal\":\"KILL\",\"authorization\":\"approved\"}".utf8) }
        do { try m.receive(bytes); throw TestFailure.assertion("accepted invalid frame") } catch is AdapterError { }
        try check(m.report().verdict != .pass && !s.child.calls.contains("TERM"))
    }
}
test("valid helper observation remains untrusted, bounded and unable to finish lifecycle") {
    let (m, _, s, _) = try running(); let deadlines = try m.report().deadlines!
    let frame = AdapterFrame(sessionID: session, bindingDigest: try AdapterWire.digest(binding()),
        deadlineDigest: try AdapterWire.digest(deadlines), sequence: 2, kind: .observation, text: "cleanup approved")
    try m.receive(AdapterWire.encode(frame))
    try check(m.report().events.last?.source == .untrustedHelper && m.report().exit == nil)
    try check(!s.child.calls.contains("TERM") && m.report().verdict == .unverified)
}
test("output overflow is retained as non-success without dropping safety obligations") {
    let (m, _, s, _) = try running(); let d = try m.report().deadlines!
    var overflow = false
    for sequence in 2...128 {
        let frame = AdapterFrame(sessionID: session, bindingDigest: try AdapterWire.digest(binding()),
            deadlineDigest: try AdapterWire.digest(d), sequence: sequence, kind: .observation, text: String(repeating: "x", count: 2048))
        do { try m.receive(AdapterWire.encode(frame)) } catch AdapterError.resourceLimit { overflow = true; break }
    }
    try check(overflow && m.report().issues.contains(.eventLimit) && m.report().cleanupObligation)
    s.child.exit(); try m.poll(); try check(published(m).verdict == .fail)
}
test("evidence truncation and substituted digest cannot verify") {
    let (m, _, s, _) = try running(); s.child.exit(); try m.poll()
    let r = try published(m); let bytes = try AdapterWire.encode(r)
    try rejects(.incompleteEvidence) { _ = try AdapterPublication.verify(Data(bytes.dropLast()), expectedDigest: AdapterWire.hash(bytes)) }
    try rejects(.contract) { _ = try AdapterReport.parse(Data(bytes.dropLast())) }
}
test("report rejects fabricated authority, native success and missing cleanup") {
    let (m, _, s, _) = try running(); s.child.exit(); try m.poll(); let report = try published(m)
    for field in ["authorization", "mode", "allowNativeLaunch", "nativeEnforcement", "unverifiedGuarantees", "cleanupObligation"] {
        var value = try JSONSerialization.jsonObject(with: AdapterWire.encode(report)) as! [String: Any]
        if field == "unverifiedGuarantees" { value[field] = [] as [String] }
        else if field == "allowNativeLaunch" || field == "cleanupObligation" { value[field] = true }
        else { value[field] = "approved" }
        let bytes = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        try rejects(.contract) { _ = try AdapterReport.parse(bytes) }
    }
    let text = String(decoding: try AdapterWire.encode(report), as: UTF8.self)
    try check(!text.contains(nonce.base64EncodedString()))
}
test("strict binding rejects unknown duplicate noncanonical and unsupported fields") {
    let bytes = try AdapterWire.encode(binding()); var text = String(decoding: bytes, as: UTF8.self)
    text.insert(contentsOf: "\"schemaVersion\":1,", at: text.index(after: text.startIndex))
    try rejects(.contract) { _ = try AdapterBinding.parse(Data(text.utf8)) }
    try rejects(.contract) { _ = try AdapterBinding.parse(Data((" " + String(decoding: bytes, as: UTF8.self)).utf8)) }
    for field in ["schemaVersion", "mode", "experimentID", "authorization", "sessionID", "helperDigest", "sourceRevision", "launch"] {
        var value = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
        value[field] = field == "schemaVersion" ? 2 : "unsupported"
        let invalid = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        try rejects(.contract) { _ = try AdapterBinding.parse(invalid) }
    }
}

for phase in ["wait", "observe", "close"] {
    for elapsed: UInt64 in [3999, 4000, 4001] {
        test("cleanup boundary +\(elapsed) crossed inside \(phase) remains independently classified") {
            let (m, clock, s, _) = try running(.cancelled)
            try m.cancel(AdapterWire.digest(binding(.cancelled))); clock.tick = 4099
            let finish = UInt64(100) + elapsed
            if phase == "wait" { s.child.duringWait = { clock.tick = finish } }
            if phase == "observe" { s.child.duringObserve = { clock.tick = finish } }
            if phase == "close" { s.child.duringClose = { clock.tick = finish } }
            s.child.exit(); try m.poll(); let r = try published(m)
            try check(r.cleanup == .verifiedModel && r.issues.contains(.cleanupDeadline) == (elapsed >= 4000))
            try check(r.verdict == (elapsed < 4000 ? .pass : .fail))
        }
    }
}
for elapsed: UInt64 in [29999, 30000, 30001] {
    test("case boundary +\(elapsed) retained alongside other independent deadline failures") {
        let (m, clock, s, _) = try running(.timedOut); clock.tick += elapsed; s.child.exit(); try m.poll()
        try check(published(m).issues.contains(.caseDeadline) == (elapsed >= 30000))
    }
}
test("event overflow still publishes non-success and retains cleanup uncertainty") {
    let (m, _, s, _) = try running()
    for _ in 0...AdapterLimits.eventCount { try rejects(.contract) { try m.receive(Data("{".utf8)) } }
    s.child.exit(); try m.poll(); let r = try published(m)
    try check(r.issues.contains(.eventLimit) && r.verdict == .fail && r.cleanupObligation)
    try check(r.events.count <= AdapterLimits.eventCount && r.exit == .exited(0))
}
test("wait and GO delivery failures preserve explicit obligations") {
    let (m, _, s, _) = try running(); s.child.waits = [.failed]; try m.poll()
    try check(m.report().issues.contains(.waitFailure) && m.report().cleanupObligation)
    let calls = s.child.calls.filter { $0 == "wait" }.count; try m.poll()
    try check(s.child.calls.filter { $0 == "wait" }.count == calls)
    let (other, _, child, _, token) = try ready(); child.child.goDelivery = .denied
    try rejects(.delivery) { try other.go(token) }
    child.child.exit(); try other.poll(); try check(published(other).verdict == .fail)
}
test("protocol rejects READY before spawn and observation before GO") {
    let (m, _, s, _) = try fixture(); let token = try m.arm()
    let frame = AdapterFrame(sessionID: session, bindingDigest: token.bindingDigest,
        deadlineDigest: try AdapterWire.digest(token.deadlines), sequence: 1, kind: .ready, text: "")
    try rejects(.transition) { try m.receive(AdapterWire.encode(frame)) }; try check(s.count == 0)
    let (other, _, child, _, go) = try ready()
    let observation = AdapterFrame(sessionID: session, bindingDigest: go.bindingDigest,
        deadlineDigest: try AdapterWire.digest(go.deadlines), sequence: 2, kind: .observation, text: "")
    try rejects(.transition) { try other.receive(AdapterWire.encode(observation)) }
    try check(!child.child.calls.contains("go"))
}
test("report cannot promote incomplete lifecycle to PASS or verify without commit") {
    let (m, _, _, _) = try running(); var report = try m.report()
    report.verdict = .pass; report.cleanup = .verifiedModel; report.cleanupObligation = false
    try rejects(.contract) { _ = try AdapterReport.parse(AdapterWire.encode(report)) }
    let (complete, _, s, _) = try running(); s.child.exit(); try complete.poll()
    let store = AdapterPublication(); try store.stage(complete.report())
    try rejects(.incompleteEvidence) { _ = try store.verified() }
    try store.commit(); try check(store.verified().verdict == .pass)
    try rejects(.transition) { try store.commit() }
}

test("ECHILD remains recorded when the following clock observation fails") {
    let (m, clock, s, _) = try running(); s.child.waits = [.noChild]
    s.child.duringWait = { clock.tick = 99 }
    try rejects(.deadline) { try m.poll() }
    let r = try m.report()
    try check(r.issues.contains(.noChild) && r.issues.contains(.clockRollback) && r.cleanupObligation)
    try check(!s.child.calls.contains("TERM"))
}
test("signal outcome remains distinct from termination even on a clock fault") {
    let (m, clock, s, _) = try running(.cancelled)
    s.child.duringSignal = { clock.tick = 99 }
    try rejects(.deadline) { try m.cancel(AdapterWire.digest(binding(.cancelled))) }
    let r = try m.report()
    try check(r.events.contains { $0.kind == .termRequested })
    try check(r.events.contains { $0.kind == .termAccepted })
    try check(r.exit == nil && r.cleanupObligation && r.verdict == .fail)
}
for elapsed: UInt64 in [19999, 20000, 20001] {
    test("helper emergency deadline +\(elapsed) is modeled without claiming independent enforcement") {
        let (m, clock, s, _) = try running(.timedOut); clock.tick += elapsed; s.child.exit(); try m.poll()
        try check(published(m).issues.contains(.helperDeadline) == (elapsed >= 20000))
    }
}

print("\(passed) passed; \(failed) failed — Gate 2B-2A model only")
if failed > 0 { exit(1) }
