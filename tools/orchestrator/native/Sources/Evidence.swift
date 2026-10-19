import Foundation

struct GuestFrame: Codable {
    var schemaVersion = 1
    var kind = "untrusted-data"
    var jobID: String
    var profileDigest: String
    var sequence: Int
    var text: String
}
final class ObservationLog {
    private let jobID: String
    private let profileDigest: String
    private var frames: [GuestFrame] = []
    private var bytes = 0
    var count: Int { frames.count }
    init(jobID: String, profileDigest: String) { self.jobID = jobID; self.profileDigest = profileDigest }
    func append(_ data: Data) throws {
        let limits = ResourceLimits()
        let frame = try Wire.decode(GuestFrame.self, data, limit: limits.frameBytes)
        guard frame.schemaVersion == 1, frame.kind == "untrusted-data", frame.jobID == jobID,
              frame.profileDigest == profileDigest, frame.sequence == frames.count + 1,
              frame.text.utf8.count <= 2048 else { throw ScaffoldError.invalidContract }
        guard frames.count < limits.observationCount, data.count <= limits.observationBytes - bytes else { throw ScaffoldError.resourceLimit }
        frames.append(frame); bytes += data.count
    }
    func digest() throws -> String { try Wire.digest(frames) }
}
struct SyntheticEvidence: Codable {
    var schemaVersion = 1
    var kind = "synthetic-host-fake-evidence"
    var authorization = "none"
    var jobID: String
    var ownerID: String
    var profileDigest: String
    var observationsDigest: String
    var finalDigest: String?
    var cleanupConfirmed: Bool
}
enum PublicationInterruption { case beforeBytes, afterBytes }
/// In-memory publication simulation only. No filesystem, durability, external
/// truth or authenticated cleanup is established by this fake store.
final class FakeEvidencePublication {
    private var staged: Data?
    private var body: Data?
    private var committedDigest: String?
    private var finalBytes: Data?
    func stage(_ evidence: SyntheticEvidence, finalBytes: Data? = nil) throws {
        guard staged == nil else { throw ScaffoldError.invalidTransition }
        let data = try Wire.encode(evidence)
        guard data.count <= 65_536, (finalBytes?.count ?? 0) <= 65_536 else { throw ScaffoldError.resourceLimit }
        staged = data; self.finalBytes = finalBytes
    }
    func commit(expectedDigest: String, interruption: PublicationInterruption? = nil) throws {
        guard let staged, Wire.digestValid(expectedDigest), Wire.sha256(staged) == expectedDigest else { throw ScaffoldError.digestMismatch }
        if interruption == .beforeBytes { throw ScaffoldError.interrupted }
        body = staged
        if interruption == .afterBytes { throw ScaffoldError.interrupted }
        committedDigest = expectedDigest
    }
    func verified(jobID: String, ownerID: String, profileDigest: String, observationsDigest: String? = nil) throws -> SyntheticEvidence {
        guard let body, let committedDigest, Wire.sha256(body) == committedDigest else { throw ScaffoldError.incompleteEvidence }
        let evidence = try Wire.decode(SyntheticEvidence.self, body)
        guard evidence.schemaVersion == 1, evidence.kind == "synthetic-host-fake-evidence", evidence.authorization == "none",
              evidence.jobID == jobID, evidence.ownerID == ownerID, evidence.profileDigest == profileDigest,
              Wire.digestValid(evidence.observationsDigest), let final = evidence.finalDigest,
              Wire.digestValid(final), let finalBytes, Wire.sha256(finalBytes) == final,
              observationsDigest == nil || evidence.observationsDigest == observationsDigest,
              evidence.cleanupConfirmed else { throw ScaffoldError.incompleteEvidence }
        return evidence
    }
}
