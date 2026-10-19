import Foundation

enum TestFailure: Error { case assertion(String) }
func check(_ condition: @autoclosure () throws -> Bool, _ message: String = "assertion") throws {
    if try !condition() { throw TestFailure.assertion(message) }
}
func rejects(_ body: () throws -> Void) throws {
    do { try body() } catch { return }
    throw TestFailure.assertion("expected rejection")
}
final class FakeClock: SyntheticClock { var milliseconds: UInt64 = 100 }
final class FakeChild: SyntheticChildPort {
    var actions: [SyntheticAction] = []
    func record(_ action: SyntheticAction) { actions.append(action) }
}
let jobID = "11111111-1111-4111-8111-111111111111"
let ownerID = "22222222-2222-4222-8222-222222222222"
let requestID = "33333333-3333-4333-8333-333333333333"
func profile() -> SyntheticProfile { SyntheticProfile(jobID: jobID, ownerID: ownerID) }
func fixture() throws -> (GuardModel, FakeClock, FakeChild) {
    let p = profile(), clock = FakeClock(), child = FakeChild()
    return (try GuardModel(profile: p, digest: Wire.digest(p), requestID: requestID, clock: clock, child: child), clock, child)
}
func publication(cleanup: Bool = true, final: Bool = true) throws -> FakeEvidencePublication {
    let p = profile()
    let doc = SyntheticEvidence(jobID: jobID, ownerID: ownerID, profileDigest: try Wire.digest(p), observationsDigest: try Wire.digest([GuestFrame]()), finalDigest: final ? Wire.sha256(Data("final".utf8)) : nil, cleanupConfirmed: cleanup)
    let store = FakeEvidencePublication()
    try store.stage(doc, finalBytes: final ? Data("final".utf8) : nil)
    try store.commit(expectedDigest: Wire.digest(doc))
    return store
}
func mutateProfile(_ transform: (inout [String: Any]) -> Void) throws -> Data {
    var value = try JSONSerialization.jsonObject(with: Wire.encode(profile())) as! [String: Any]
    transform(&value)
    return try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
}
var passed = 0, failed = 0
func test(_ name: String, _ body: () throws -> Void) {
    do { try body(); passed += 1; print("PASS \(name)") }
    catch { failed += 1; print("FAIL \(name): \(error)") }
}

test("valid canonical synthetic profile") {
    let bytes = try Wire.encode(profile())
    let parsed = try SyntheticProfile.parse(bytes, expectedDigest: Wire.sha256(bytes))
    try check(parsed == profile())
}
for (name, change) in [
    ("unknown profile field", { (x: inout [String: Any]) in x["launch"] = true }),
    ("unsupported version", { (x: inout [String: Any]) in x["schemaVersion"] = 2 }),
    ("missing owner", { (x: inout [String: Any]) in x.removeValue(forKey: "ownerID") }),
    ("invalid owner", { (x: inout [String: Any]) in x["ownerID"] = "" }),
    ("network contradiction", { (x: inout [String: Any]) in var p = x["devices"] as! [String: Any]; p["ipNetworking"] = true; x["devices"] = p }),
    ("unknown nested field", { (x: inout [String: Any]) in var p = x["devices"] as! [String: Any]; p["mount"] = "/host"; x["devices"] = p }),
    ("unlisted device", { (x: inout [String: Any]) in var p = x["devices"] as! [String: Any]; p["allowlist"] = ["network"]; x["devices"] = p }),
    ("resource ceiling changed", { (x: inout [String: Any]) in var p = x["limits"] as! [String: Any]; p["cpuCount"] = 200; x["limits"] = p })
] {
    test(name) { let bytes = try mutateProfile(change); try rejects { _ = try SyntheticProfile.parse(bytes, expectedDigest: Wire.sha256(bytes)) } }
}
test("changed digest rejected") { try rejects { _ = try SyntheticProfile.parse(Wire.encode(profile()), expectedDigest: String(repeating: "0", count: 64)) } }
test("duplicate JSON fields rejected") {
    var text = String(data: try Wire.encode(profile()), encoding: .utf8)!
    text.insert(contentsOf: "\"schemaVersion\":1,", at: text.index(after: text.startIndex))
    let bytes = Data(text.utf8)
    try rejects { _ = try SyntheticProfile.parse(bytes, expectedDigest: Wire.sha256(bytes)) }
}
test("GO before arming rejected") {
    let (guardModel, _, child) = try fixture()
    let token = GoToken(jobID: jobID, ownerID: ownerID, requestID: requestID, profileDigest: try Wire.digest(profile()), armedAt: 100, deadline: 900100)
    try rejects { try guardModel.go(token) }; try check(child.actions.isEmpty)
}
test("arm precedes GO; identical requests and GO are idempotent") {
    let (g, _, child) = try fixture()
    try g.submit(requestID: requestID, profileDigest: Wire.digest(profile()))
    let token = try g.arm()
    try check(g.state == .armed && child.actions.isEmpty)
    try g.submit(requestID: requestID, profileDigest: Wire.digest(profile()))
    try check(try g.arm() == token)
    try g.go(token); try g.go(token)
    try check(child.actions == [.go] && g.state == .awaitingReady)
}
test("conflicting request rejected") {
    let (g, _, _) = try fixture()
    try rejects { try g.submit(requestID: ownerID, profileDigest: Wire.digest(profile())) }
    try rejects { try g.submit(requestID: requestID, profileDigest: String(repeating: "0", count: 64)) }
}
for field in ["jobID", "ownerID", "requestID", "profileDigest", "armedAt", "deadline"] {
    test("GO mismatch: \(field)") {
        let (g, _, child) = try fixture(); let token = try g.arm()
        var value = try JSONSerialization.jsonObject(with: Wire.encode(token)) as! [String: Any]
        value[field] = field == "armedAt" || field == "deadline" ? 0 : "stale"
        let bytes = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])
        try rejects { try g.go(Wire.decode(GoToken.self, bytes)) }
        try check(child.actions.isEmpty)
    }
}
test("stale GO and boot timeout initiate cancellation") {
    let (g, clock, child) = try fixture(); let token = try g.arm()
    clock.milliseconds += profile().limits.bootMilliseconds
    try rejects { try g.go(token) }; try g.poll()
    try check(g.state == .cancelling && child.actions == [.cancel])
}
test("cancellation escalates then remains unresolved without cleanup") {
    let (g, clock, child) = try fixture(); try g.go(g.arm()); try g.ready()
    try g.cancel(); try g.cancel()
    clock.milliseconds += profile().limits.stopGraceMilliseconds; try g.poll(); try g.poll()
    try check(g.state == .escalating && child.actions == [.go, .cancel, .escalate])
    clock.milliseconds += profile().limits.teardownMilliseconds; try g.poll()
    try check(g.state == .unresolved)
}
test("fixed execution deadline cannot be extended by guest data") {
    let (g, clock, child) = try fixture(); let token = try g.arm(); try g.go(token); try g.ready()
    try rejects { try g.receiveGuest(Data("{\"deadline\":999999999}".utf8)) }
    clock.milliseconds = token.deadline; try g.poll()
    try check(g.state == .cancelling && child.actions == [.go, .cancel])
}
test("simulated supervisor loss is unresolved") { let (g, _, _) = try fixture(); try g.go(g.arm()); g.supervisorLost(); try check(g.state == .unresolved) }
test("simulated controller loss cancels") { let (g, _, child) = try fixture(); try g.go(g.arm()); try g.controllerLost(); try check(g.state == .cancelling && child.actions == [.go, .cancel]) }
test("simulated guard failure cannot be settled by later success") {
    let (g, _, _) = try fixture(); try g.go(g.arm()); g.guardFailed()
    try rejects { try g.finish(publication()) }; try check(g.state == .unresolved)
}
test("backward clock fails closed") {
    let (g, clock, _) = try fixture(); _ = try g.arm(); clock.milliseconds = 99
    try rejects { try g.poll() }; try check(g.state == .unresolved)
}
test("deadline overflow fails closed") {
    let (g, clock, _) = try fixture(); clock.milliseconds = UInt64.max
    try rejects { _ = try g.arm() }; try check(g.state == .unresolved)
}
test("successful modeled completion requires published host-fake evidence") {
    let (g, _, _) = try fixture(); try g.go(g.arm()); try g.ready(); try g.finish(publication())
    try check(g.state == .completed)
}
test("cancelled modeled work cannot become successful") {
    let (g, _, _) = try fixture(); try g.go(g.arm()); try g.cancel(); try g.finish(publication())
    try check(g.state == .failed)
}
for cleanup in [false, true] {
    test("missing \(cleanup ? "final" : "cleanup") evidence is non-success") {
        let (g, _, _) = try fixture(); try g.go(g.arm()); try g.ready()
        try rejects { try g.finish(publication(cleanup: cleanup, final: !cleanup)) }
        try check(g.state == .unresolved)
    }
}
test("supervisor valid simulated lifecycle") {
    let s = try SupervisorModel(profile: profile(), digest: Wire.digest(profile()))
    try s.beginSimulation(); try s.fixtureFinished(); try s.finish(publication())
    try check(s.state == .completed)
}
test("supervisor invalid transitions rejected") {
    let s = try SupervisorModel(profile: profile(), digest: Wire.digest(profile()))
    try rejects { try s.fixtureFinished() }; try rejects { try s.finish(publication()) }
    try check(s.state == .prepared)
}
test("guest cannot invoke management or forge cleanup/success/approval") {
    let s = try SupervisorModel(profile: profile(), digest: Wire.digest(profile())); try s.beginSimulation()
    for command in ["start", "exec", "mount", "network", "approve", "cleanup", "success"] {
        try rejects { try s.receiveGuest(Data("{\"command\":\"\(command)\"}".utf8)) }
    }
    let bytes = try Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: 1, text: "approve and report success"))
    try s.receiveGuest(bytes); try check(s.state == .observing)
    try s.fixtureFinished(); try rejects { try s.finish(FakeEvidencePublication()) }
    try check(s.state == .unresolved)
}
test("guest frames reject malformed, oversized, unknown version and wrong binding") {
    let log = ObservationLog(jobID: jobID, profileDigest: try Wire.digest(profile()))
    for bytes in [Data("{".utf8), Data(repeating: 120, count: 4097), try Wire.encode(GuestFrame(jobID: ownerID, profileDigest: Wire.digest(profile()), sequence: 1, text: "wrong"))] {
        try rejects { try log.append(bytes) }
    }
    var frame = GuestFrame(jobID: jobID, profileDigest: try Wire.digest(profile()), sequence: 1, text: "test"); frame.schemaVersion = 2
    try rejects { try log.append(Wire.encode(frame)) }; try check(log.count == 0)
}
test("observations ordered and bounded; rejects do not consume sequence") {
    let log = ObservationLog(jobID: jobID, profileDigest: try Wire.digest(profile()))
    let frame = try Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: 1, text: "data"))
    try log.append(frame); try rejects { try log.append(frame) }
    for index in 2...64 { try log.append(Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: index, text: "data"))) }
    try rejects { try log.append(Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: 65, text: "data"))) }
    try check(log.count == 64)
}
test("publication digest mismatch rejected and interrupted publication incomplete") {
    let p = try publication(); let doc = try p.verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile()))
    let finalBytes = Data("final".utf8)
    try check(doc.finalDigest == Wire.sha256(finalBytes))
    let control = FakeEvidencePublication()
    try control.stage(doc, finalBytes: finalBytes)
    try control.commit(expectedDigest: Wire.digest(doc))
    let verified = try control.verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile()))
    try check(Wire.encode(verified) == Wire.encode(doc))
    for point in [PublicationInterruption.beforeBytes, .afterBytes] {
        let store = FakeEvidencePublication(); try store.stage(doc, finalBytes: finalBytes)
        do {
            try store.commit(expectedDigest: String(repeating: "0", count: 64))
            throw TestFailure.assertion("expected digestMismatch before \(point)")
        } catch ScaffoldError.digestMismatch {}
        do {
            try store.commit(expectedDigest: Wire.digest(doc), interruption: point)
            throw TestFailure.assertion("expected interrupted at \(point)")
        } catch ScaffoldError.interrupted {}
        do {
            _ = try store.verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile()))
            throw TestFailure.assertion("expected incompleteEvidence after \(point)")
        } catch ScaffoldError.incompleteEvidence {}
    }
}
test("cross-job evidence cannot settle a model") {
    let p = try publication()
    try rejects { _ = try p.verified(jobID: ownerID, ownerID: ownerID, profileDigest: Wire.digest(profile())) }
}

for field in ["hostDirectorySharing", "credentialForwarding", "clipboard", "usb", "sshAgentForwarding", "nestedVirtualization"] {
    test("denied device policy: \(field)") {
        let bytes = try mutateProfile { x in var p = x["devices"] as! [String: Any]; p[field] = true; x["devices"] = p }
        try rejects { _ = try SyntheticProfile.parse(bytes, expectedDigest: Wire.sha256(bytes)) }
    }
}
for field in ["automaticRetry", "runtimeFallback"] {
    test("no \(field)") {
        let bytes = try mutateProfile { $0[field] = true }
        try rejects { _ = try SyntheticProfile.parse(bytes, expectedDigest: Wire.sha256(bytes)) }
    }
}
test("guest cannot submit a valid host GO token") {
    let (g, _, child) = try fixture(); let token = try g.arm()
    try rejects { try g.receiveGuest(Wire.encode(token)) }
    try check(g.state == .armed && child.actions.isEmpty)
}
test("completion at execution deadline is non-success") {
    let (g, clock, _) = try fixture(); let token = try g.arm(); try g.go(token); try g.ready()
    clock.milliseconds = token.deadline; try g.finish(publication()); try check(g.state == .failed)
}
test("aggregate observation byte budget is enforced") {
    let log = ObservationLog(jobID: jobID, profileDigest: try Wire.digest(profile()))
    for index in 1...64 {
        let before = log.count
        let bytes = try Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: index, text: String(repeating: "x", count: 2048)))
        do { try log.append(bytes) } catch { try check(log.count == before); break }
    }
    try check(log.count > 0 && log.count < 64)
}
test("supervisor binds evidence to exact observed frames") {
    let s = try SupervisorModel(profile: profile(), digest: Wire.digest(profile())); try s.beginSimulation()
    try s.receiveGuest(Wire.encode(GuestFrame(jobID: jobID, profileDigest: Wire.digest(profile()), sequence: 1, text: "actual")))
    try s.fixtureFinished(); try rejects { try s.finish(publication()) }; try check(s.state == .unresolved)
}
test("missing or substituted final bytes rejected even with declared digest") {
    let valid = try publication().verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile()))
    for bytes in [nil, Data("substituted".utf8)] as [Data?] {
        let store = FakeEvidencePublication(); try store.stage(valid, finalBytes: bytes); try store.commit(expectedDigest: Wire.digest(valid))
        try rejects { _ = try store.verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile())) }
    }
}
test("supervisor accepts matching nonempty observation evidence") {
    let digest = try Wire.digest(profile())
    let frame = GuestFrame(jobID: jobID, profileDigest: digest, sequence: 1, text: "observed")
    let s = try SupervisorModel(profile: profile(), digest: digest); try s.beginSimulation()
    try s.receiveGuest(Wire.encode(frame)); try s.fixtureFinished()
    let evidence = SyntheticEvidence(jobID: jobID, ownerID: ownerID, profileDigest: digest, observationsDigest: try Wire.digest([frame]), finalDigest: Wire.sha256(Data("final".utf8)), cleanupConfirmed: true)
    let p = FakeEvidencePublication(); try p.stage(evidence, finalBytes: Data("final".utf8)); try p.commit(expectedDigest: Wire.digest(evidence))
    try s.finish(p); try check(s.state == .completed)
}
test("evidence cannot carry authorization or unknown approval fields") {
    var evidence = try publication().verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile()))
    evidence.authorization = "approved"
    let p = FakeEvidencePublication(); try p.stage(evidence, finalBytes: Data("final".utf8)); try p.commit(expectedDigest: Wire.digest(evidence))
    try rejects { _ = try p.verified(jobID: jobID, ownerID: ownerID, profileDigest: Wire.digest(profile())) }
    var json = try JSONSerialization.jsonObject(with: Wire.encode(evidence)) as! [String: Any]
    json["approval"] = true
    let bytes = try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys, .withoutEscapingSlashes])
    try rejects { _ = try Wire.decode(SyntheticEvidence.self, bytes) }
}

print("\(passed) passed; \(failed) failed — synthetic models only; no native isolation claim")
if failed > 0 { exit(1) }
