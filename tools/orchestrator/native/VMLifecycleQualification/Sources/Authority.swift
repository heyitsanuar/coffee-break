import Foundation

// These are in-memory object identities, deliberately without Codable. A fresh
// object with equal metadata is not a replacement for an issued grant.
final class VMCreationIdentity { fileprivate init() {} }
// A registration is an opaque, one-shot exposure generation, not its digest.
fileprivate final class VMExposureRegistration {
    let resourceId: String, reference: String
    let tick: UInt64
    init(resourceId: String, reference: String, tick: UInt64) {
        self.resourceId = resourceId; self.reference = reference; self.tick = tick
    }
}
final class VMQualifiedObservation {
    let fact: VMFact
    fileprivate let issuer: VMSimulationBootstrap
    fileprivate let creation: VMCreationIdentity
    let recovery: Bool
    fileprivate let exposure: VMExposureRegistration
    fileprivate init(_ fact: VMFact, issuer: VMSimulationBootstrap, recovery: Bool, exposure: VMExposureRegistration) {
        self.fact = fact; self.issuer = issuer; creation = issuer.creation; self.recovery = recovery; self.exposure = exposure
    }
}
final class VMGrant {
    fileprivate let issuer: VMSimulationBootstrap
    private var claimed = false
    fileprivate init(_ issuer: VMSimulationBootstrap) { self.issuer = issuer }
    func claim(_ b: VMExecutionBinding) throws {
        guard try VMWire.digest(b) == issuer.bindingDigest else { throw VMError.binding }
        guard !claimed else { throw VMError.replay }; claimed = true
        try register([.brokerFence], reference: issuer.bindingDigest, tick: b.deadlines.armedAt)
    }
    func authenticate(_ observation: VMQualifiedObservation, recovery: Bool) throws {
        guard observation.fact.bindingDigest == issuer.bindingDigest else { throw VMError.binding } // M4
        guard observation.issuer === issuer, observation.creation === issuer.creation, observation.recovery == recovery
        else { throw VMError.authority }
        try observation.fact.validate(issuer.binding, recovery: recovery)
        let current = try issuer.registeredExposure(observation.fact)
        guard observation.exposure === current else { throw VMError.authority }
    }
    // Only the claimed aggregate reserves exposures, before invoking a fake port.
    // Registration cannot be imported from an observation or a decoded ledger.
    func register(_ claims: [VMObligation], reference: String, tick: UInt64) throws {
        guard claimed, !claims.isEmpty, Set(claims).count == claims.count,
              VMWire.hex(reference), tick >= issuer.binding.deadlines.armedAt, tick <= VMWire.maximumInteger,
              claims.allSatisfy({ issuer.exposures[$0] == nil }) else { throw VMError.transition }
        for claim in claims {
            let index = VMObligation.allCases.firstIndex(of: claim)!
            issuer.exposures[claim] = VMExposureRegistration(resourceId: issuer.binding.resourceIds[index], reference: reference, tick: tick)
        }
    }
    func localFact(_ claim: VMObligation, tick: UInt64, sequence: UInt64) throws -> VMFact {
        let b = issuer.binding, index = VMObligation.allCases.firstIndex(of: claim)!
        guard claim == .brokerFence || claim == .upstream else { throw VMError.authority }
        let h = VMWire.hash(Data("\(issuer.bindingDigest):\(claim.rawValue):\(sequence)".utf8))
        let parts = [h.prefix(8), h.dropFirst(8).prefix(4), h.dropFirst(12).prefix(4), h.dropFirst(16).prefix(4), h.dropFirst(20).prefix(12)]
        let id = parts.map(String.init).joined(separator: "-")
        return VMFact(id: id, bindingDigest: issuer.bindingDigest,
            resourceId: b.resourceIds[index], claim: claim, value: claim == .upstream ? .notRequired : .satisfied,
            source: claim.source, sourceId: b.actors.id(claim.source), sequence: sequence, tick: tick, epochId: b.clockEpochId)
    }
}
final class VMSimulationBootstrap {
    fileprivate let binding: VMExecutionBinding
    fileprivate let bindingDigest: String
    fileprivate let creation = VMCreationIdentity()
    private var issued = false
    fileprivate var exposures: [VMObligation: VMExposureRegistration] = [:]
    init(binding: VMExecutionBinding) throws { try binding.validate(); self.binding = binding; bindingDigest = try VMWire.digest(binding) }
    func issue() throws -> VMGrant {
        guard !issued else { throw VMError.replay }; issued = true; return VMGrant(self)
    }
    fileprivate func registeredExposure(_ fact: VMFact) throws -> VMExposureRegistration {
        guard let exposure = exposures[fact.claim] else { throw VMError.evidence }
        guard exposure.resourceId == fact.resourceId, exposure.reference == fact.exposureReference,
              fact.value != .notRequired, fact.tick >= exposure.tick else { throw VMError.evidence }
        return exposure
    }
    private func qualify(_ fact: VMFact, recovery: Bool) throws -> VMQualifiedObservation {
        try fact.validate(binding, recovery: recovery)
        let exposure = try registeredExposure(fact) // R2: registration must already exist at qualification.
        return VMQualifiedObservation(fact, issuer: self, recovery: recovery, exposure: exposure)
    }
    func qualify(_ fact: VMFact) throws -> VMQualifiedObservation { try qualify(fact, recovery: false) }
    // Explicit trusted test root. This does not claim a public native recovery API.
    func qualifyRecovery(_ fact: VMFact) throws -> VMQualifiedObservation { try qualify(fact, recovery: true) }
}

// One trusted fake registry must be shared by all attempts on a simulated host.
// Logical restoration can add a conservative hold, never reconstruct custody.
final class VMHostRegistry {
    private var attempts: [String: String] = [:]
    private var holds: Set<String> = []
    private var cases: Set<String> = []
    private var scope: String?
    func claim(_ b: VMExecutionBinding) throws {
        guard scope == nil || scope == b.hostScopeId else { throw VMError.binding }
        scope = b.hostScopeId
        guard !holds.contains(b.hostScopeId) else { throw VMError.quarantined }
        guard attempts[b.hostScopeId] == nil else { throw VMError.authority }
        attempts[b.hostScopeId] = b.attemptId
    }
    func quarantine(_ host: String, caseId: String? = nil) {
        // A caller cannot turn one fake host registry into a multi-host scheduler.
        if scope == nil { scope = host }
        holds.insert(scope!)
        if let caseId { cases.insert(caseId) }
    }
    func isHeld(_ host: String) -> Bool { holds.contains(host) }
    func isHeld(_ host: String, caseId: String) -> Bool { holds.contains(host) && cases.contains(caseId) }
    // A cleared case does not erase the one-attempt admission claim. No new
    // creation is enabled by simulated accounting release.
}
