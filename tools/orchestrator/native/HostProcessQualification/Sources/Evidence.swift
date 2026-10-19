import Foundation

struct AdapterReport: Codable {
    static let unverified = ["native-ownership", "native-signals-reap", "independent-deadlines", "emergency-stop",
        "sleep-wake", "descendant-containment", "filesystem-races", "credentials-network", "plugins-mcp",
        "resource-enforcement", "durable-publication"]
    var schemaVersion = 1
    var kind = "native-adapter-model-report/1"
    var mode = "deterministic-fakes"
    var authorization = "none"
    var allowNativeLaunch = false
    var nativeEnforcement = "unverified"
    var clockKind = "injected-model-milliseconds"
    var unverifiedGuarantees = Self.unverified
    var publication = "incomplete"
    var verdict = AdapterVerdict.unverified
    var binding: AdapterBinding
    var guardIdentity: AdapterIdentity
    var process: AdapterIdentity?
    var deadlines: AdapterDeadlines?
    var cancelAt: UInt64?
    var observedAt: UInt64
    var state: AdapterState
    var workload: AdapterWorkload
    var cleanup: AdapterCleanup
    var creationRecorded: Bool
    var goUsed: Bool
    var cleanupObligation: Bool
    var exit: AdapterExit?
    var observation: AdapterObservation?
    var descriptors: AdapterDescriptorResult?
    var events: [AdapterEvent]
    var issues: [AdapterIssue]

    var expectedVerdict: AdapterVerdict {
        let blockers: Set<AdapterIssue> = [.emergencyUnavailable, .emergencyUnqualified, .executionUnavailable, .spawnDenied]
        if !goUsed, !issues.isEmpty, issues.allSatisfy({ blockers.contains($0) }) { return .blocked }
        if !issues.isEmpty { return .fail }
        if state == .reaped, cleanup == .verifiedModel, goUsed {
            return workload == binding.expected ? .pass : .fail
        }
        return .unverified
    }
    static func parse(_ bytes: Data) throws -> Self {
        let r = try AdapterWire.decode(Self.self, bytes, limit: AdapterLimits.reportBytes)
        _ = try AdapterBinding.parse(AdapterWire.encode(r.binding))
        guard r.schemaVersion == 1, r.kind == "native-adapter-model-report/1", r.mode == "deterministic-fakes",
              r.authorization == "none", !r.allowNativeLaunch, r.nativeEnforcement == "unverified",
              r.clockKind == "injected-model-milliseconds", r.unverifiedGuarantees == Self.unverified,
              ["incomplete", "complete"].contains(r.publication), r.verdict == r.expectedVerdict,
              r.guardIdentity.valid, r.guardIdentity.executableDigest == r.binding.guardDigest,
              r.events.count <= AdapterLimits.eventCount, try AdapterWire.encode(r.events).count <= AdapterLimits.outputBytes,
              Set(r.issues).count == r.issues.count,
              r.cleanupObligation == (r.creationRecorded && r.cleanup != .verifiedModel) else { throw AdapterError.contract }
        if let d = r.deadlines {
            guard d == (try AdapterDeadlines.make(at: d.armedAt)), r.observedAt >= d.armedAt else { throw AdapterError.contract }
        } else if r.goUsed || r.creationRecorded { throw AdapterError.contract }
        var previous: UInt64 = 0
        for (index, event) in r.events.enumerated() {
            guard event.sequence == index + 1, event.milliseconds >= previous, event.milliseconds <= r.observedAt,
                  event.digest == nil || AdapterWire.hex(event.digest!),
                  (event.source == .untrustedHelper) == (event.kind == .helperObservation) else { throw AdapterError.contract }
            previous = event.milliseconds
        }
        if let exit = r.exit { guard exit.valid else { throw AdapterError.contract } }
        if r.cleanup == .verifiedModel {
            guard r.creationRecorded, let identity = r.process, identity.valid,
                  identity.parentPID == r.guardIdentity.pid, identity.uid == r.guardIdentity.uid,
                  identity.executableDigest == r.binding.helperDigest, let exit = r.exit,
                  let observation = r.observation, observation.identity == identity, observation.exit == exit,
                  observation.descendantCount == 0, observation.resourcesReleased, r.descriptors == .closed,
                  r.events.filter({ $0.kind == .reaped }).count == 1 else { throw AdapterError.contract }
        }
        if r.verdict == .pass {
            guard let d = r.deadlines, r.observedAt < d.caseAt, r.observedAt < d.helperAt else { throw AdapterError.contract }
            if let cancelled = r.cancelAt {
                guard r.observedAt < (try AdapterDeadlines.add(cancelled, AdapterLimits.graceMilliseconds + AdapterLimits.cleanupMilliseconds)) else {
                    throw AdapterError.contract
                }
            }
            switch r.workload {
            case .completed: guard r.exit == .exited(0), r.cancelAt == nil, r.observedAt < d.executionAt else { throw AdapterError.contract }
            case .timedOut: guard r.observedAt >= d.executionAt else { throw AdapterError.contract }
            case .cancelled: guard r.cancelAt != nil else { throw AdapterError.contract }
            default: throw AdapterError.contract
            }
            let ordered: [AdapterEventKind] = [.bound, .armed, .spawned, .identityObserved, .ready, .go, .reaped, .descriptorsClosed]
            var lastIndex = -1
            for kind in ordered {
                let indices = r.events.indices.filter { r.events[$0].kind == kind }
                guard indices.count == 1, indices[0] > lastIndex else { throw AdapterError.contract }
                lastIndex = indices[0]
            }
        }
        return r
    }
}

enum AdapterPublicationInterruption { case beforeBytes, afterBytes }
/// Memory-only publication fault model. Hashes are consistency checks, not
/// authentication, durable storage, native cleanup evidence or PO authorization.
final class AdapterPublication {
    private var staged: Data?
    private var body: Data?
    private var committedDigest: String?
    func stage(_ report: AdapterReport) throws {
        guard staged == nil else { throw AdapterError.transition }
        var final = report; final.publication = "complete"
        let bytes = try AdapterWire.encode(final); _ = try AdapterReport.parse(bytes)
        staged = bytes
    }
    func commit(interruption: AdapterPublicationInterruption? = nil) throws {
        guard let staged, committedDigest == nil else { throw AdapterError.transition }
        if interruption == .beforeBytes { throw AdapterError.interrupted }
        body = staged
        if interruption == .afterBytes { throw AdapterError.interrupted }
        committedDigest = AdapterWire.hash(staged)
    }
    func verified() throws -> AdapterReport {
        guard let body, let committedDigest, AdapterWire.hash(body) == committedDigest else { throw AdapterError.incompleteEvidence }
        return try Self.verify(body, expectedDigest: committedDigest)
    }
    static func verify(_ bytes: Data, expectedDigest: String) throws -> AdapterReport {
        guard AdapterWire.hex(expectedDigest), AdapterWire.hash(bytes) == expectedDigest else { throw AdapterError.incompleteEvidence }
        let report = try AdapterReport.parse(bytes)
        guard report.publication == "complete" else { throw AdapterError.incompleteEvidence }; return report
    }
}
