import Foundation

enum GuardState { case reserved, armed, awaitingReady, running, cancelling, escalating, unresolved, completed, failed }

/// Single-threaded synthetic state model. There is no spawn, OS signal, launchd,
/// live timer, VM handle or recovery of an external resource in this module.
final class GuardModel {
    private let profile: SyntheticProfile
    private let digest: String
    private let requestID: String
    private let clock: SyntheticClock
    private let child: SyntheticChildPort
    private var lastTick: UInt64
    private var token: GoToken?
    private var bootDeadline: UInt64?
    private var cancelAt: UInt64?
    private(set) var state = GuardState.reserved
    init(profile: SyntheticProfile, digest: String, requestID: String, clock: SyntheticClock, child: SyntheticChildPort) throws {
        self.profile = try SyntheticProfile.parse(Wire.encode(profile), expectedDigest: digest)
        guard Wire.uuid(requestID) else { throw ScaffoldError.identityMismatch }
        self.digest = digest; self.requestID = requestID; self.clock = clock; self.child = child; lastTick = clock.milliseconds
    }
    private func now() throws -> UInt64 {
        guard clock.milliseconds >= lastTick else { state = .unresolved; throw ScaffoldError.deadline }
        lastTick = clock.milliseconds; return lastTick
    }
    private func adding(_ instant: UInt64, _ duration: UInt64) throws -> UInt64 {
        let (value, overflow) = instant.addingReportingOverflow(duration)
        guard !overflow else { state = .unresolved; throw ScaffoldError.deadline }
        return value
    }
    func submit(requestID: String, profileDigest: String) throws {
        guard self.requestID == requestID, digest == profileDigest else { throw ScaffoldError.identityMismatch }
        // Already bound at construction; identical submissions never create work.
    }
    func arm() throws -> GoToken {
        if state == .armed, let token { return token }
        guard state == .reserved else { throw ScaffoldError.invalidTransition }
        let instant = try now()
        let deadline = try adding(instant, profile.limits.executionMilliseconds)
        bootDeadline = try adding(instant, profile.limits.bootMilliseconds)
        let value = GoToken(jobID: profile.jobID, ownerID: profile.ownerID, requestID: requestID, profileDigest: digest, armedAt: instant, deadline: deadline)
        token = value; state = .armed; return value
    }
    func go(_ value: GoToken) throws {
        guard let token, value == token else { throw ScaffoldError.identityMismatch }
        let instant = try now()
        if [.awaitingReady, .running].contains(state) {
            guard instant < token.deadline else { throw ScaffoldError.deadline }; return
        }
        guard state == .armed else { throw ScaffoldError.invalidTransition }
        guard let bootDeadline, instant < bootDeadline, instant < token.deadline else { throw ScaffoldError.deadline }
        state = .awaitingReady; child.record(.go)
    }
    func ready() throws {
        guard state == .awaitingReady else { throw ScaffoldError.invalidTransition }
        let instant = try now()
        guard let bootDeadline, instant < bootDeadline, let token, instant < token.deadline else { throw ScaffoldError.deadline }
        state = .running
    }
    func cancel() throws {
        if [.cancelling, .escalating].contains(state) { return }
        guard [.armed, .awaitingReady, .running].contains(state) else { throw ScaffoldError.invalidTransition }
        cancelAt = try now(); state = .cancelling; child.record(.cancel)
    }
    func poll() throws {
        let instant = try now()
        if let token, [.armed, .awaitingReady, .running].contains(state) {
            if instant >= token.deadline || (state != .running && instant >= (bootDeadline ?? 0)) { try cancel() }
        }
        if let cancelAt {
            if [.cancelling, .escalating].contains(state), instant >= (try adding(cancelAt, profile.limits.teardownMilliseconds)) { state = .unresolved }
            else if state == .cancelling, instant >= (try adding(cancelAt, profile.limits.stopGraceMilliseconds)) { state = .escalating; child.record(.escalate) }
        }
    }
    func controllerLost() throws { try cancel() }
    func supervisorLost() { if state != .completed && state != .failed { state = .unresolved } }
    func guardFailed() { if state != .completed && state != .failed { state = .unresolved } }
    func receiveGuest(_ data: Data) throws { throw ScaffoldError.invalidContract }
    func finish(_ publication: FakeEvidencePublication) throws {
        guard [.running, .cancelling, .escalating].contains(state) else { throw ScaffoldError.invalidTransition }
        try poll()
        guard state != .unresolved else { throw ScaffoldError.incompleteEvidence }
        do { _ = try publication.verified(jobID: profile.jobID, ownerID: profile.ownerID, profileDigest: digest) }
        catch { state = .unresolved; throw error }
        state = state == .running ? .completed : .failed
    }
}
