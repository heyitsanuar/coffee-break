import Foundation

enum TestFailure: Error { case assertion(String) }
func check(_ value: @autoclosure () throws -> Bool) throws {
    if try !value() { throw TestFailure.assertion("assertion failed") }
}
func rejects(_ expected: QualificationError, _ body: () throws -> Void) throws {
    do { try body() } catch let error as QualificationError {
        try check(error == expected); return
    }
    throw TestFailure.assertion("expected \(expected)")
}
final class FakeClock: QualificationClock { var milliseconds: UInt64 = 100 }
let runID = "11111111-1111-4111-8111-111111111111"
let requestID = "22222222-2222-4222-8222-222222222222"
let ownerID = "33333333-3333-4333-8333-333333333333"
let artifact = String(repeating: "a", count: 64)
let capability = Data(repeating: 231, count: 32)
func binding(_ expected: WorkloadOutcome = .completed) -> QualificationBinding {
    QualificationBinding(runID: runID, requestID: requestID, ownerID: ownerID,
        experimentID: "HP-01", sourceRevision: String(repeating: "b", count: 40),
        harnessDigest: artifact, guardDigest: artifact, helperDigest: artifact, expectedOutcome: expected)
}
let guardIdentity = ProcessObservation(pid: 40, parentPID: 30, groupID: 40, uid: 501, start: 80, executableDigest: artifact)
let childIdentity = ProcessObservation(pid: 50, parentPID: 40, groupID: 50, uid: 501, start: 100, executableDigest: artifact)
final class FakeChild: SpawnedQualificationChild {
    var identity = childIdentity
    var signals: [QualificationSignal] = []
    var goCount = 0
    var waits = 0
    var waitResult = WaitObservation.pending
    var observation = HostObservation(identity: childIdentity, exit: nil, descriptorsClosed: false, resourcesReleased: false, descendantCount: 0)
    var delivery = SignalDelivery.accepted
    var duringSignal: (() throws -> Void)?
    var duringWait: (() -> Void)?
    var duringObserve: (() -> Void)?
    var goFails = false, waitFails = false, observeFails = false
    func sendGo(_ frame: PrivateGo) throws {
        if goFails { throw QualificationError.ownership }
        goCount += 1
    }
    func signal(_ signal: QualificationSignal) throws -> SignalDelivery {
        signals.append(signal); try duringSignal?(); return delivery
    }
    func wait() throws -> WaitObservation {
        waits += 1
        duringWait?()
        if waitFails { throw QualificationError.ownership }
        return waitResult
    }
    func observe() throws -> HostObservation {
        duringObserve?()
        if observeFails { throw QualificationError.ownership }
        return observation
    }
    func exit(_ value: ProcessExit = .exited(0)) {
        waitResult = .reaped(value)
        observation = HostObservation(identity: identity, exit: value, descriptorsClosed: true, resourcesReleased: true, descendantCount: 0)
    }
}
final class FakeSpawner: QualificationSpawnPort {
    let child = FakeChild()
    var count = 0
    func spawn(_ binding: QualificationBinding) throws -> any SpawnedQualificationChild { count += 1; return child }
}
func fixture(_ expected: WorkloadOutcome = .completed) throws -> (QualificationHarness, FakeClock, FakeSpawner) {
    let clock = FakeClock(), port = FakeSpawner()
    return (try QualificationHarness(binding: binding(expected), clock: clock, spawner: port, guardIdentity: guardIdentity, capability: capability), clock, port)
}
func running(_ expected: WorkloadOutcome = .completed) throws -> (QualificationHarness, FakeClock, FakeSpawner) {
    let (h, clock, port) = try fixture(expected)
    let go = try h.arm(); try h.prepareChild(); try h.go(go)
    return (h, clock, port)
}
var passed = 0, failed = 0
func test(_ name: String, _ body: () throws -> Void) {
    do { try body(); passed += 1; print("PASS \(name)") }
    catch { failed += 1; print("FAIL \(name): \(error)") }
}

test("closed versioned binding and report") {
    let bytes = try Wire.encode(binding())
    try check(QualificationBinding.parse(bytes) == binding())
    var object = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
    object["launch"] = true
    let invalid = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes])
    try rejects(.invalidContract) { _ = try QualificationBinding.parse(invalid) }
}
test("arming precedes spawn and GO; one creation only") {
    let (h, _, port) = try fixture()
    try rejects(.invalidTransition) { try h.prepareChild() }
    let go = try h.arm(); try check(port.count == 0)
    try h.prepareChild(); try h.go(go)
    try rejects(.replay) { try h.go(go) }
    try rejects(.invalidTransition) { try h.prepareChild() }
    try check(port.count == 1 && port.child.goCount == 1)
}
test("stale GO cannot reset immutable deadline") {
    let (h, clock, port) = try fixture(.timedOut)
    let go = try h.arm(); try h.prepareChild(); clock.milliseconds = go.deadline
    try rejects(.deadline) { try h.go(go) }
    try h.poll(); try check(port.child.goCount == 0 && port.child.signals == [.term])
    try check(h.report().deadline == go.deadline)
}
test("controller loss cancels without deadline authority") {
    let (h, _, port) = try running(.cancelled)
    let deadline = try h.report().deadline
    try h.controllerLost(binding(.cancelled))
    try check(port.child.signals == [.term] && h.report().deadline == deadline)
}
test("cooperative cancellation has independent verdict and workload dimensions") {
    let (h, _, port) = try running(.cancelled)
    try h.cancel(binding(.cancelled)); port.child.exit(.exited(0)); try h.poll()
    let report = try h.report()
    try check(report.verdict == .pass && report.workload == .cancelled && report.cleanup == .verifiedFixture)
}
test("TERM success is not termination; KILL requires wait and cleanup") {
    let (h, clock, port) = try running(.timedOut)
    clock.milliseconds += 8000; try h.poll()
    try check(h.report().cleanup == .unresolved)
    clock.milliseconds += 1000; try h.poll(); try check(port.child.signals == [.term, .kill])
    port.child.exit(.signaled(.kill)); try h.poll()
    try check(h.report().verdict == .pass && h.report().workload == .timedOut)
    try rejects(.invalidTransition) { try h.cancel(binding(.timedOut)) }
    try h.poll(); try check(port.child.signals == [.term, .kill])
}
test("missing exit, ECHILD and contradictory status cannot establish success") {
    for result in [WaitObservation.pending, .noChild, .reaped(.exited(0))] {
        let (h, clock, port) = try running()
        port.child.waitResult = result; clock.milliseconds += 30000; try h.poll()
        try check(h.report().verdict != .pass && h.report().cleanup != .verifiedFixture)
    }
}
test("valid completion requires host exit, reap, closed descriptors and released resources") {
    let (h, _, port) = try running(); port.child.exit(); try h.poll()
    try check(h.report().verdict == .pass && h.report().workload == .completed)
}
test("ambiguous spawn ownership cannot signal a PID") {
    let (h, _, port) = try fixture(); _ = try h.arm(); port.child.identity.parentPID = 999
    try rejects(.ownership) { try h.prepareChild() }
    try h.poll(); try check(port.child.signals.isEmpty && h.report().cleanup == .unresolved)
}
test("signal delivery failure is non-success") {
    let (h, _, port) = try running(); port.child.delivery = .denied
    try rejects(.signalFailure) { try h.cancel(binding()) }
    try check(h.report().verdict != .pass)
}
test("backward clock and overflow fail closed") {
    let (h, clock, _) = try fixture(); clock.milliseconds = UInt64.max
    try rejects(.deadline) { _ = try h.arm() }
    let (other, otherClock, port) = try running(); otherClock.milliseconds = 99
    try rejects(.deadline) { try other.poll() }
    try check(port.child.signals.isEmpty && other.report().cleanup == .unresolved)
}
test("helper data has no host management authority") {
    let (h, _, port) = try running()
    try rejects(.invalidContract) { try h.receiveHelper(Data("{\"signal\":\"KILL\",\"pid\":50}".utf8)) }
    try check(port.child.signals.isEmpty)
}
test("reentrant adapter cannot race signal and reap") {
    let (h, _, port) = try running(.cancelled)
    port.child.duringSignal = { try rejects(.busy) { try h.poll() } }
    try h.cancel(binding(.cancelled)); try check(port.child.waits == 0)
}
test("helper performs no work before exact GO and uses independent emergency deadline") {
    let clock = FakeClock()
    let helper = try QualificationHelper(binding: binding(), clock: clock, capability: capability, behavior: .cooperativeExit)
    try helper.tick(); try check(helper.workloadActions == 0)
    let (h, _, _) = try fixture(); let go = try h.arm()
    try helper.go(go); try helper.tick(); try check(helper.state == .completed && helper.workloadActions == 1)
    let waiting = try QualificationHelper(binding: binding(), clock: clock, capability: capability, behavior: .waitForCancellation)
    clock.milliseconds += 20000; try waiting.tick(); try check(waiting.state == .emergencyExit && waiting.workloadActions == 0)
}
test("publication positive control and specific interruption failures") {
    let (h, _, port) = try running(); port.child.exit(); try h.poll()
    let control = QualificationPublication(); try h.publish(control)
    try check(control.verified().verdict == .pass)
    for point in [QualificationInterruption.beforeBytes, .afterBytes] {
        let store = QualificationPublication()
        try rejects(.interrupted) { try h.publish(store, interruption: point) }
        try rejects(.incompleteEvidence) { _ = try store.verified() }
    }
}
test("report contains no capability and never grants production authority") {
    let (h, _, port) = try running(); port.child.exit(); try h.poll()
    let bytes = try Wire.encode(h.report())
    let text = String(decoding: bytes, as: UTF8.self)
    try check(!text.contains(capability.base64EncodedString()))
    let report = try QualificationReport.parse(bytes)
    try check(report.authorization == "none" && report.nativeEnforcement == "unverified" && report.mode == "fake-only")
}
test("no real adapter or helper transport is enabled") {
    try rejects(.executionDisabled) { _ = try DisabledQualificationSpawner().spawn(binding()) }
    try check(QualificationHelperEntry.unavailableTransportExitCode == 3)
}

for field in ["schemaVersion", "mode", "planVersion", "ownerID", "helperDigest", "sourceRevision", "experimentID"] {
    test("binding rejects unsupported or malformed \(field)") {
        var value = try JSONSerialization.jsonObject(with: Wire.encode(binding())) as! [String: Any]
        value[field] = field == "schemaVersion" ? 2 : "unsupported"
        let bytes = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        try rejects(.invalidContract) { _ = try QualificationBinding.parse(bytes) }
    }
}
test("binding rejects duplicate fields and oversized documents") {
    var text = String(decoding: try Wire.encode(binding()), as: UTF8.self)
    text.insert(contentsOf: "\"schemaVersion\":1,", at: text.index(after: text.startIndex))
    try rejects(.invalidContract) { _ = try QualificationBinding.parse(Data(text.utf8)) }
    try rejects(.invalidContract) { _ = try QualificationBinding.parse(Data(repeating: 120, count: 4097)) }
}
for field in ["run", "request", "owner", "executable", "armedAt", "deadline", "capability"] {
    test("GO rejects mismatched \(field) without work") {
        let (h, _, port) = try fixture(); var go = try h.arm(); try h.prepareChild()
        switch field {
        case "run": go.binding.runID = ownerID
        case "request": go.binding.requestID = ownerID
        case "owner": go.binding.ownerID = runID
        case "executable": go.binding.helperDigest = String(repeating: "c", count: 64)
        case "armedAt": go.armedAt += 1
        case "deadline": go.deadline += 1
        default: go.capability = Data(repeating: 0, count: 32)
        }
        try rejects(.ownership) { try h.go(go) }
        try check(port.child.goCount == 0 && port.child.signals.isEmpty)
    }
}
test("GO before arm, repeated arm and post-reap GO cannot create work") {
    let (other, _, _) = try fixture(); let token = try other.arm()
    let (h, _, port) = try fixture()
    try rejects(.ownership) { try h.go(token) }
    let go = try h.arm(); try rejects(.replay) { _ = try h.arm() }
    try h.prepareChild(); try h.go(go); port.child.exit(); try h.poll()
    try rejects(.invalidTransition) { try h.go(go) }
    try check(port.child.goCount == 1 && port.count == 1)
}
test("no GO timeout has no child; disabled adapter is explicitly blocked") {
    let (h, clock, port) = try fixture(); let go = try h.arm()
    clock.milliseconds = go.deadline; try h.poll()
    try check(h.report().verdict == .blocked && port.count == 0)
    let disabled = try QualificationHarness(binding: binding(), clock: FakeClock(), spawner: DisabledQualificationSpawner(), guardIdentity: guardIdentity, capability: capability)
    _ = try disabled.arm()
    try rejects(.executionDisabled) { try disabled.prepareChild() }
    try check(disabled.report().verdict == .blocked)
}
test("wrong controller binding and replayed loss cannot change deadline") {
    let c = QualificationController(binding: binding(.cancelled))
    try rejects(.ownership) { try c.lose(binding()) }
    try c.lose(binding(.cancelled)); try rejects(.replay) { try c.lose(binding(.cancelled)) }
    let (h, _, port) = try running(.cancelled)
    try rejects(.ownership) { try h.controllerLost(binding()) }
    try h.controllerLost(binding(.cancelled))
    try rejects(.invalidTransition) { try h.controllerLost(binding(.cancelled)) }
    try check(port.child.signals == [.term])
}
for missing in ["descriptors", "resources", "exit", "identity", "descendants"] {
    test("cleanup cannot pass with missing or contradictory \(missing)") {
        let (h, _, port) = try running(); port.child.exit()
        switch missing {
        case "descriptors": port.child.observation.descriptorsClosed = false
        case "resources": port.child.observation.resourcesReleased = false
        case "exit": port.child.observation.exit = .exited(9)
        case "identity": port.child.observation.identity.start += 1
        default: port.child.observation.descendantCount = 1
        }
        try h.poll()
        try check(h.report().verdict != .pass && h.report().cleanup != .verifiedFixture)
        try rejects(.invalidTransition) { try h.cancel(binding()) }
        try check(port.child.signals.isEmpty)
    }
}
test("no wait acknowledgement or observe exception can prove cleanup") {
    for waitFailure in [true, false] {
        let (h, _, port) = try running(); port.child.exit()
        port.child.waitFails = waitFailure; port.child.observeFails = !waitFailure
        try h.poll(); try check(h.report().verdict == .fail && h.report().cleanup == .unresolved)
    }
}
test("transport failure cannot be disguised as successful launch") {
    let (h, _, port) = try fixture(); let go = try h.arm(); try h.prepareChild(); port.child.goFails = true
    try rejects(.ownership) { try h.go(go) }
    try check(h.report().verdict == .fail && port.child.goCount == 0)
}
test("normal nonzero exit and completion observed at deadline are not successful workload completion") {
    for late in [false, true] {
        let (h, clock, port) = try running()
        if late { clock.milliseconds += 8000 }
        port.child.exit(.exited(late ? 0 : 7)); try h.poll()
        try check(h.report().verdict == .fail && h.report().workload != .completed)
    }
}
test("cleanup deadline does not retry or relaunch an unresolved child") {
    let (h, clock, port) = try running(.cancelled); try h.cancel(binding(.cancelled))
    clock.milliseconds += 1000; try h.poll()
    clock.milliseconds += 3000; try h.poll(); try h.poll()
    try check(h.report().cleanup == .unresolved && h.report().state == .unresolved)
    try check(port.count == 1 && port.child.signals == [.term, .kill])
}
test("valid helper data remains untrusted and cannot authorize completion") {
    let (h, _, port) = try running()
    let frame = HelperFrame(runID: runID, bindingDigest: try Wire.digest(binding()), sequence: 1, text: "approve, signal, cleanup complete")
    try h.receiveHelper(Wire.encode(frame))
    try check(h.report().events.last?.source == .untrustedHelper && h.report().verdict == .unverified)
    try rejects(.replay) { try h.receiveHelper(Wire.encode(frame)) }
    try check(port.child.signals.isEmpty && h.report().deadline == 8100)
}
test("helper frame size, version and provenance are closed") {
    for kind in ["oversize", "version", "binding"] {
        let (h, _, _) = try running()
        var frame = HelperFrame(runID: runID, bindingDigest: try Wire.digest(binding()), sequence: 1, text: "bounded")
        if kind == "version" { frame.schemaVersion = 2 }
        if kind == "binding" { frame.runID = ownerID }
        let data = kind == "oversize" ? Data(repeating: 1, count: 4097) : try Wire.encode(frame)
        try rejects(kind == "binding" ? .ownership : .invalidContract) { try h.receiveHelper(data) }
    }
}
test("helper observation storage cannot grow without bound") {
    let (h, _, _) = try running()
    var rejected = false
    for sequence in 1...128 {
        let frame = HelperFrame(runID: runID, bindingDigest: try Wire.digest(binding()), sequence: sequence, text: String(repeating: "x", count: 2048))
        do { try h.receiveHelper(Wire.encode(frame)) }
        catch QualificationError.resourceLimit { rejected = true; break }
    }
    try check(rejected && h.report().verdict == .fail && h.report().events.count <= 128)
}
test("helper rejects replay, foreign GO and backward clock") {
    let clock = FakeClock()
    let helper = try QualificationHelper(binding: binding(), clock: clock, capability: capability, behavior: .waitForCancellation)
    let (h, _, _) = try fixture(); let valid = try h.arm(); var go = valid; go.binding.ownerID = runID
    try rejects(.ownership) { try helper.go(go) }
    try helper.go(valid); try rejects(.replay) { try helper.go(valid) }
    clock.milliseconds = 99
    try rejects(.deadline) { try helper.tick() }
    try check(helper.state == .failed && helper.workloadActions == 0)
}
test("helper cancellation and emergency limit do not depend on controller") {
    for behavior in [QualificationHelperBehavior.waitForCancellation, .ignoreTerm] {
        let clock = FakeClock()
        let helper = try QualificationHelper(binding: binding(), clock: clock, capability: capability, behavior: behavior)
        let (h, _, _) = try fixture(); try helper.go(h.arm()); try helper.cancel()
        try check(helper.state == (behavior == .ignoreTerm ? .running : .cancelled))
        clock.milliseconds += 20000; try helper.tick()
        try check(helper.state == (behavior == .ignoreTerm ? .emergencyExit : .cancelled))
    }
    let clock = FakeClock(); clock.milliseconds = UInt64.max
    try rejects(.deadline) { _ = try QualificationHelper(binding: binding(), clock: clock, capability: capability, behavior: .cooperativeExit) }
}
test("report rejects widened authority, unknown fields and unsupported versions") {
    let (h, _, port) = try running(); port.child.exit(); try h.poll()
    let valid = try Wire.encode(h.report())
    for field in ["schemaVersion", "authorization", "nativeEnforcement", "mode", "clockKind", "extra"] {
        var value = try JSONSerialization.jsonObject(with: valid) as! [String: Any]
        value[field] = field == "schemaVersion" ? 2 : "approved"
        let bytes = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        try rejects(.invalidContract) { _ = try QualificationReport.parse(bytes) }
    }
    try rejects(.invalidContract) { _ = try QualificationReport.parse(Data(repeating: 120, count: 65537)) }
}
test("valid JSON cannot falsely label missing cleanup evidence PASS") {
    let (h, _, _) = try running()
    var report = try h.report(); report.verdict = .pass; report.cleanup = .verifiedFixture
    try rejects(.invalidContract) { _ = try QualificationReport.parse(Wire.encode(report)) }
    let store = QualificationPublication()
    try rejects(.invalidContract) { try store.stage(report) }
    try rejects(.incompleteEvidence) { _ = try store.verified() }
}
test("publication cannot verify before commit or repeat an acknowledged commit") {
    let (h, _, port) = try running(); port.child.exit(); try h.poll()
    let store = QualificationPublication(); try store.stage(h.report())
    try rejects(.incompleteEvidence) { _ = try store.verified() }
    try store.commit(); try check(store.verified().publication == "complete")
    try rejects(.invalidTransition) { try store.commit() }
    try rejects(.invalidTransition) { try store.stage(h.report()) }
}

test("controller loss at deadline cannot conceal a timeout") {
    let (h, clock, port) = try running(.timedOut)
    clock.milliseconds += 8000
    try h.controllerLost(binding(.timedOut)); port.child.exit(); try h.poll()
    try check(h.report().verdict == .pass && h.report().workload == .timedOut)
}
test("TERM and KILL requests and delivery results remain distinct from reap evidence") {
    let (h, clock, port) = try running(.cancelled)
    try h.cancel(binding(.cancelled)); clock.milliseconds += 1000; try h.poll()
    let kinds = try h.report().events.map(\.kind)
    try check(kinds == [.armed, .spawned, .go, .termRequested, .term, .killRequested, .kill])
    try check(h.report().exit == nil && h.report().cleanup == .unresolved)
    port.child.exit(.signaled(.kill)); try h.poll()
    try check(h.report().events.last?.kind == .reaped)
}

for elapsed: UInt64 in [3999, 4000, 4001, 30001] {
    test("F1 cancellation cleanup at +\(elapsed)ms preserves deadline classification and publication") {
        let (h, clock, port) = try running(.cancelled)
        try h.cancel(binding(.cancelled)) // Cancellation at fake time 100 ms.
        clock.milliseconds += elapsed
        port.child.exit(); try h.poll()
        let late = elapsed >= 4000
        let report = try h.report()
        let publication = QualificationPublication(); try h.publish(publication)
        let published = try publication.verified()
        if late && published.verdict == .pass {
            throw TestFailure.assertion("late cleanup at +\(elapsed)ms published PASS")
        }
        try check(report.verdict == (late ? .fail : .pass))
        try check(report.cleanup == .verifiedFixture && report.workload == .cancelled)
        try check(report.issues.contains(.incompleteCleanup) == late)
        try check(report.issues.contains(.caseLimit) == (elapsed >= 30000))
        try check(report.events.last?.kind == .reaped && report.observedAt == clock.milliseconds)
        try check(published.verdict == report.verdict && published.issues == report.issues)
        try check(published.cleanup == .verifiedFixture && published.publication == "complete")
        try h.poll()
        try check(h.report().verdict == report.verdict && h.report().issues == report.issues)
        try check(port.child.signals == [.term]) // No signaling after reap, even when late.
    }
}
for elapsed: UInt64 in [29999, 30000, 30001] {
    test("F1 overall case at +\(elapsed)ms cannot bypass expiry with a valid reap") {
        let (h, clock, port) = try running(.timedOut)
        // Isolate the case deadline: no earlier cancellation/cleanup deadline exists.
        clock.milliseconds += elapsed; port.child.exit(); try h.poll()
        let expired = elapsed >= 30000
        let report = try h.report()
        let publication = QualificationPublication(); try h.publish(publication)
        let published = try publication.verified()
        if expired && published.verdict == .pass {
            throw TestFailure.assertion("late case at +\(elapsed)ms published PASS")
        }
        try check(report.verdict == (expired ? .fail : .pass))
        try check(report.issues.contains(.caseLimit) == expired)
        try check(!report.issues.contains(.incompleteCleanup))
        try check(report.cleanup == .verifiedFixture && report.workload == .timedOut)
        try check(published.verdict == report.verdict)
        try check(published.issues == report.issues)
    }
}
for phase in ["wait", "observe"] {
    test("F1 trusted clock is rechecked after \(phase), not inferred from helper text") {
        let (h, clock, port) = try running(.cancelled)
        let frame = HelperFrame(runID: runID, bindingDigest: try Wire.digest(binding(.cancelled)), sequence: 1, text: "cleanup completed at time 100")
        try h.receiveHelper(Wire.encode(frame)); try h.cancel(binding(.cancelled))
        clock.milliseconds += 3999; port.child.exit()
        if phase == "wait" { port.child.duringWait = { clock.milliseconds += 1 } }
        else { port.child.duringObserve = { clock.milliseconds += 1 } }
        try h.poll()
        let report = try h.report()
        try check(report.verdict == .fail && report.issues.contains(.incompleteCleanup))
        try check(report.cleanup == .verifiedFixture && report.observedAt == 4100)
        let publication = QualificationPublication(); try h.publish(publication)
        try check(publication.verified().verdict == .fail)
    }
}

for phase in ["poll", "wait", "observe"] {
    for completion: UInt64 in [8099, 8100, 8101] {
        test("F2 normal completion at \(completion)ms via \(phase) preserves execution expiry in publication") {
            let (h, clock, port) = try running()
            clock.milliseconds = phase == "poll" ? completion : 8099
            if phase == "wait" { port.child.duringWait = { clock.milliseconds = completion } }
            if phase == "observe" { port.child.duringObserve = { clock.milliseconds = completion } }
            port.child.exit(); try h.poll()
            let report = try h.report()
            let publication = QualificationPublication(); try h.publish(publication)
            let published = try publication.verified()
            let expired = completion >= 8100
            if expired && (published.verdict == .pass || published.workload == .completed) {
                throw TestFailure.assertion("expired normal completion at \(completion)ms via \(phase) published \(published.workload)/\(published.verdict)")
            }
            try check(report.workload == (expired ? .timedOut : .completed))
            try check(report.verdict == (expired ? .fail : .pass))
            try check(report.deadline == 8100 && report.observedAt == completion)
            try check(report.cleanup == .verifiedFixture && report.issues.isEmpty)
            try check(published.verdict == report.verdict && published.workload == report.workload)
            try check(published.cleanup == report.cleanup && published.issues == report.issues)
            try h.poll()
            try check(h.report().workload == report.workload && h.report().verdict == report.verdict)
            try check(port.child.signals.isEmpty && port.child.waits == 1)
        }
    }
}
for phase in ["wait", "observe"] {
    for completion: UInt64 in [8100, 8101] {
        test("F2 expected timeout at \(completion)ms via \(phase) remains an experiment PASS") {
            let (h, clock, port) = try running(.timedOut)
            clock.milliseconds = 8099
            if phase == "wait" { port.child.duringWait = { clock.milliseconds = completion } }
            else { port.child.duringObserve = { clock.milliseconds = completion } }
            port.child.exit(); try h.poll()
            let report = try h.report()
            let publication = QualificationPublication(); try h.publish(publication)
            let published = try publication.verified()
            if published.verdict != .pass || published.workload != .timedOut {
                throw TestFailure.assertion("expected timeout at \(completion)ms via \(phase) published \(published.workload)/\(published.verdict)")
            }
            try check(report.verdict == .pass && report.workload == .timedOut)
            try check(report.cleanup == .verifiedFixture && report.issues.isEmpty)
            try check(published.verdict == report.verdict && published.workload == report.workload)
            try check(published.cleanup == report.cleanup && published.issues == report.issues)
            try h.poll()
            try check(h.report().workload == .timedOut && h.report().verdict == .pass)
            try check(port.child.signals.isEmpty && port.child.waits == 1)
        }
    }
}

print("\(passed) passed; \(failed) failed — Gate 2A fakes only; no host-process qualification")
if failed > 0 { exit(1) }
