import Foundation

enum SupervisorState { case prepared, observing, collecting, completed, unresolved }
/// Only simulated lifecycle operations exist. It has no VM or process handle.
final class SupervisorModel {
    private let profile: SyntheticProfile
    private let digest: String
    private let log: ObservationLog
    private(set) var state = SupervisorState.prepared
    init(profile: SyntheticProfile, digest: String) throws {
        self.profile = try SyntheticProfile.parse(Wire.encode(profile), expectedDigest: digest)
        self.digest = digest; log = ObservationLog(jobID: profile.jobID, profileDigest: digest)
    }
    func beginSimulation() throws {
        guard state == .prepared else { throw ScaffoldError.invalidTransition }; state = .observing
    }
    func receiveGuest(_ data: Data) throws {
        guard state == .observing else { throw ScaffoldError.invalidTransition }
        try log.append(data) // Data cannot transition lifecycle or authorize actions.
    }
    func fixtureFinished() throws {
        guard state == .observing else { throw ScaffoldError.invalidTransition }; state = .collecting
    }
    func finish(_ publication: FakeEvidencePublication) throws {
        guard state == .collecting else { throw ScaffoldError.invalidTransition }
        do { _ = try publication.verified(jobID: profile.jobID, ownerID: profile.ownerID, profileDigest: digest, observationsDigest: log.digest()) }
        catch { state = .unresolved; throw error }
        state = .completed
    }
}
