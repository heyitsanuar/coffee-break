import Foundation

struct QualificationReport: Codable {
    var schemaVersion = 1
    var kind = "host-process-qualification/1"
    var mode = "fake-only"
    var authorization = "none"
    var nativeEnforcement = "unverified"
    var clockKind = "injected-fake-milliseconds"
    var publication = "incomplete"
    var binding: QualificationBinding
    var guardIdentity: ProcessObservation
    var process: ProcessObservation?
    var capabilityDigest: String
    var armedAt: UInt64?
    var deadline: UInt64?
    var observedAt: UInt64
    var state: QualificationState
    var verdict: ExperimentVerdict
    var workload: WorkloadOutcome
    var cleanup: QualificationCleanup
    var exit: ProcessExit?
    var observation: HostObservation?
    var events: [QualificationEvent]
    var issues: [QualificationIssue]

    static func parse(_ bytes: Data) throws -> Self {
        let r: Self
        do { r = try Wire.decode(Self.self, bytes, limit: QualificationLimits.reportBytes) }
        catch { throw QualificationError.invalidContract }
        _ = try QualificationBinding.parse(Wire.encode(r.binding))
        guard r.schemaVersion == 1, r.kind == "host-process-qualification/1", r.mode == "fake-only",
              r.authorization == "none", r.nativeEnforcement == "unverified", r.clockKind == "injected-fake-milliseconds",
              ["incomplete", "complete"].contains(r.publication), Wire.digestValid(r.capabilityDigest),
              r.guardIdentity.valid, r.guardIdentity.executableDigest == r.binding.guardDigest,
              r.events.count <= QualificationLimits.eventCount,
              try Wire.encode(r.events).count <= QualificationLimits.eventBytes,
              Set(r.issues).count == r.issues.count else { throw QualificationError.invalidContract }
        if let armed = r.armedAt {
            let (expected, overflow) = armed.addingReportingOverflow(QualificationLimits.guardMilliseconds)
            guard !overflow, r.deadline == expected, r.observedAt >= armed else { throw QualificationError.invalidContract }
        } else if r.deadline != nil { throw QualificationError.invalidContract }
        var previous: UInt64 = 0
        for (index, event) in r.events.enumerated() {
            guard event.sequence == index + 1, event.milliseconds >= previous, event.milliseconds <= r.observedAt,
                  event.digest == nil || Wire.digestValid(event.digest!),
                  (event.source == .untrustedHelper) == (event.kind == .helper) else { throw QualificationError.invalidContract }
            previous = event.milliseconds
        }
        if r.cleanup == .verifiedFixture || r.verdict == .pass {
            guard r.state == .reaped, let process = r.process, process.valid,
                  process.parentPID == r.guardIdentity.pid, process.uid == r.guardIdentity.uid,
                  process.executableDigest == r.binding.helperDigest, let exit = r.exit,
                  let observation = r.observation, observation.identity == process, observation.exit == exit,
                  observation.descendantCount == 0, observation.descriptorsClosed, observation.resourcesReleased,
                  r.events.filter({ $0.kind == .reaped }).count == 1 else { throw QualificationError.invalidContract }
        }
        if r.verdict == .pass {
            guard r.cleanup == .verifiedFixture, r.issues.isEmpty, r.armedAt != nil,
                  r.workload == r.binding.expectedOutcome, r.workload != .notStarted else { throw QualificationError.invalidContract }
            if r.workload == .completed {
                guard r.exit == .exited(0), r.events.filter({ $0.kind == .go }).count == 1 else { throw QualificationError.invalidContract }
            }
        }
        return r
    }
}

enum QualificationInterruption { case beforeBytes, afterBytes }

/// In-memory publication protocol fixture. No disk persistence, authenticated
/// observer or native cleanup is established by this store or its hashes.
final class QualificationPublication {
    private var staged: Data?
    private var body: Data?
    private var committedDigest: String?

    func stage(_ report: QualificationReport) throws {
        guard staged == nil else { throw QualificationError.invalidTransition }
        var final = report
        final.publication = "complete"
        let bytes = try Wire.encode(final)
        _ = try QualificationReport.parse(bytes)
        staged = bytes
    }
    func commit(interruption: QualificationInterruption? = nil) throws {
        guard let staged, committedDigest == nil else { throw QualificationError.invalidTransition }
        if interruption == .beforeBytes { throw QualificationError.interrupted }
        body = staged
        if interruption == .afterBytes { throw QualificationError.interrupted }
        committedDigest = Wire.sha256(staged)
    }
    func verified() throws -> QualificationReport {
        guard let body, let committedDigest, Wire.sha256(body) == committedDigest else {
            throw QualificationError.incompleteEvidence
        }
        let report = try QualificationReport.parse(body)
        guard report.publication == "complete" else { throw QualificationError.incompleteEvidence }
        return report
    }
}
