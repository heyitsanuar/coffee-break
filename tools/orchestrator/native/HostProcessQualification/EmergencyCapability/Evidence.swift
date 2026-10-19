import Foundation

struct CapabilityReport: Codable, Equatable {
    var version = 1
    var kind = "emergency-capability-report/1"
    var mode = "simulation"
    var authorization = "none"
    var allowNativeLaunch = false
    var nativeEnforcement = "unverified"
    var binding: CapabilityBinding
    var provenance: CapabilityProvenance?
    var established: Bool
    var validated: Bool
    var goAdmitted: Bool
    var status: CapabilityStatus
    var used: Int
    var request: CapabilityRequest?
    var response: CapabilityResponse?
    var rightReleased: Bool
    var releaseResponse: CapabilityRelease?
    var controllerLost: Bool
    var guardLost: Bool
    var holderLost: Bool
    var targetGone: Bool
    var facts: CapabilityFacts
    var findings: [CapabilityFinding]
    var events: [CapabilityEvent]

    // Derived outcomes cannot be upgraded by a caller-supplied success field.
    var cleanup: CapabilityCleanup {
        guard let exit = facts.exit, let reap = facts.reap, exit == reap else { return .unresolved }
        return rightReleased && facts.descriptorsClosed ? .verifiedSimulation : .partial
    }
    var emergency: CapabilityEmergency {
        guard let request else { return .notRequested }
        if response == .accepted && facts.exit?.kind == .forced && facts.emergencyCauseReference == request.reference { return .corroboratedSimulation }
        return response == nil ? .unverified : .responseObserved
    }
    var verdict: CapabilityVerdict {
        if findings.contains(where: { $0.fatal }) { return .fail }
        guard established, validated, goAdmitted else { return .blocked }
        guard request != nil, response == .accepted, emergency == .corroboratedSimulation,
              cleanup == .verifiedSimulation, !findings.contains(.ambiguousRace) else { return .unverified }
        return .pass
    }
    // Outcomes are present in published bytes AND re-derived on decode.
    private enum CodingKeys: String, CodingKey {
        case version, kind, mode, authorization, allowNativeLaunch, nativeEnforcement, binding, provenance, established, validated, goAdmitted
        case status, used, request, response, rightReleased, releaseResponse, controllerLost, guardLost, holderLost, targetGone, facts, findings, events
        case cleanup, emergency, verdict
    }
    init(binding: CapabilityBinding, provenance: CapabilityProvenance?, established: Bool, validated: Bool, goAdmitted: Bool,
         status: CapabilityStatus, used: Int, request: CapabilityRequest?, response: CapabilityResponse?, rightReleased: Bool,
         releaseResponse: CapabilityRelease?, controllerLost: Bool, guardLost: Bool, holderLost: Bool, targetGone: Bool,
         facts: CapabilityFacts, findings: [CapabilityFinding], events: [CapabilityEvent]) {
        self.binding = binding; self.provenance = provenance; self.established = established; self.validated = validated; self.goAdmitted = goAdmitted
        self.status = status; self.used = used; self.request = request; self.response = response; self.rightReleased = rightReleased
        self.releaseResponse = releaseResponse; self.controllerLost = controllerLost; self.guardLost = guardLost; self.holderLost = holderLost
        self.targetGone = targetGone; self.facts = facts; self.findings = findings; self.events = events
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decode(Int.self, forKey: .version); kind = try c.decode(String.self, forKey: .kind)
        mode = try c.decode(String.self, forKey: .mode); authorization = try c.decode(String.self, forKey: .authorization)
        allowNativeLaunch = try c.decode(Bool.self, forKey: .allowNativeLaunch); nativeEnforcement = try c.decode(String.self, forKey: .nativeEnforcement)
        binding = try c.decode(CapabilityBinding.self, forKey: .binding); provenance = try c.decodeIfPresent(CapabilityProvenance.self, forKey: .provenance)
        established = try c.decode(Bool.self, forKey: .established); validated = try c.decode(Bool.self, forKey: .validated)
        goAdmitted = try c.decode(Bool.self, forKey: .goAdmitted); status = try c.decode(CapabilityStatus.self, forKey: .status)
        used = try c.decode(Int.self, forKey: .used); request = try c.decodeIfPresent(CapabilityRequest.self, forKey: .request)
        response = try c.decodeIfPresent(CapabilityResponse.self, forKey: .response); rightReleased = try c.decode(Bool.self, forKey: .rightReleased)
        releaseResponse = try c.decodeIfPresent(CapabilityRelease.self, forKey: .releaseResponse)
        controllerLost = try c.decode(Bool.self, forKey: .controllerLost); guardLost = try c.decode(Bool.self, forKey: .guardLost)
        holderLost = try c.decode(Bool.self, forKey: .holderLost); targetGone = try c.decode(Bool.self, forKey: .targetGone)
        facts = try c.decode(CapabilityFacts.self, forKey: .facts); findings = try c.decode([CapabilityFinding].self, forKey: .findings)
        events = try c.decode([CapabilityEvent].self, forKey: .events)
        guard try c.decode(CapabilityCleanup.self, forKey: .cleanup) == cleanup,
              try c.decode(CapabilityEmergency.self, forKey: .emergency) == emergency,
              try c.decode(CapabilityVerdict.self, forKey: .verdict) == verdict else { throw CapabilityError.contract }
        try validate()
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .version); try c.encode(kind, forKey: .kind); try c.encode(mode, forKey: .mode)
        try c.encode(authorization, forKey: .authorization); try c.encode(allowNativeLaunch, forKey: .allowNativeLaunch)
        try c.encode(nativeEnforcement, forKey: .nativeEnforcement); try c.encode(binding, forKey: .binding)
        try c.encodeIfPresent(provenance, forKey: .provenance); try c.encode(established, forKey: .established)
        try c.encode(validated, forKey: .validated); try c.encode(goAdmitted, forKey: .goAdmitted); try c.encode(status, forKey: .status)
        try c.encode(used, forKey: .used); try c.encodeIfPresent(request, forKey: .request); try c.encodeIfPresent(response, forKey: .response)
        try c.encode(rightReleased, forKey: .rightReleased); try c.encodeIfPresent(releaseResponse, forKey: .releaseResponse)
        try c.encode(controllerLost, forKey: .controllerLost); try c.encode(guardLost, forKey: .guardLost)
        try c.encode(holderLost, forKey: .holderLost); try c.encode(targetGone, forKey: .targetGone)
        try c.encode(facts, forKey: .facts); try c.encode(findings, forKey: .findings); try c.encode(events, forKey: .events)
        try c.encode(cleanup, forKey: .cleanup); try c.encode(emergency, forKey: .emergency); try c.encode(verdict, forKey: .verdict)
    }
    func validate() throws {
        try binding.validate()
        guard version == 1, kind == "emergency-capability-report/1", mode == "simulation", authorization == "none", !allowNativeLaunch,
              nativeEnforcement == "unverified", (0...1).contains(used), events.count <= 96,
              Set(findings).count == findings.count, findings.count <= CapabilityFinding.allCases.count,
              !validated || established, !goAdmitted || validated,
              (request == nil) == (used == 0), response == nil || request != nil,
              rightReleased == (releaseResponse == .released), !established || provenance != nil,
              facts.exit?.valid != false, facts.reap?.valid != false else { throw CapabilityError.contract }
        if let provenance { guard try provenance.matches(binding) else { throw CapabilityError.contract } }
        if let request {
            guard try request.reference == CapabilityWire.digest(binding), request.at >= binding.issuedAt, request.at < binding.deadline else { throw CapabilityError.contract }
        }
        if let cause = facts.emergencyCauseReference { guard cause == request?.reference else { throw CapabilityError.contract } }
        if let exit = facts.exit, let reap = facts.reap { guard exit == reap else { throw CapabilityError.contract } }
        _ = try CapabilityWire.encode(self)
    }
}

enum CapabilityPublicationInterruption { case beforeBytes, afterBytes }
// In-memory publication model only. Marker publication is the final transaction step.
final class CapabilityPublication {
    private var staged: Data?
    private var bytes: Data?
    private var marker: String?
    func stage(_ report: CapabilityReport) throws {
        guard staged == nil, bytes == nil, marker == nil else { throw CapabilityError.replay }
        try report.validate(); staged = try CapabilityWire.encode(report)
    }
    func commit(interruption: CapabilityPublicationInterruption? = nil) throws {
        guard let staged, bytes == nil, marker == nil else { throw CapabilityError.incompleteEvidence }
        if interruption == .beforeBytes { throw CapabilityError.interrupted }
        bytes = staged
        if interruption == .afterBytes { throw CapabilityError.interrupted }
        marker = CapabilityWire.hash(staged)
    }
    static func verify(bytes: Data, digest: String) throws -> CapabilityReport {
        guard CapabilityWire.hex(digest), CapabilityWire.hash(bytes) == digest else { throw CapabilityError.incompleteEvidence }
        let report = try CapabilityWire.decode(CapabilityReport.self, from: bytes)
        try report.validate(); return report
    }
    func verified() throws -> CapabilityReport {
        guard let bytes, let marker else { throw CapabilityError.incompleteEvidence }
        return try Self.verify(bytes: bytes, digest: marker)
    }
}
