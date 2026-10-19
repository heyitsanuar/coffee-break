import Foundation

// Neither custody nor creation provenance is serializable. Equal metadata does not confer ownership.
final class CapabilityHolder {
    let identity: CapabilityActor
    init(identity: CapabilityActor) { self.identity = identity }
}
final class CapabilityCreation {
    let binding: CapabilityBinding
    private let lock = NSLock()
    private var issued = false
    init(binding: CapabilityBinding) { self.binding = binding }
    fileprivate func claimIssuance() throws {
        lock.lock(); defer { lock.unlock() }
        guard !issued else { throw CapabilityError.replay }
        issued = true
    }
}
protocol CapabilityOperation: AnyObject {
    func terminate() -> CapabilityResponse
    func release() -> CapabilityRelease
}

// Only a trusted injected bootstrap can originate this object. It cannot be decoded from a report.
final class CapabilityGrant {
    fileprivate let holder: CapabilityHolder
    fileprivate let creation: CapabilityCreation
    fileprivate let operation: CapabilityOperation
    let provenance: CapabilityProvenance
    private let lock = NSLock()
    private var claimed = false
    fileprivate init(provenance: CapabilityProvenance, holder: CapabilityHolder, creation: CapabilityCreation, operation: CapabilityOperation) {
        self.provenance = provenance; self.holder = holder; self.creation = creation; self.operation = operation
    }
    fileprivate func claim() throws {
        lock.lock(); defer { lock.unlock() }
        guard !claimed else { throw CapabilityError.replay }
        claimed = true
    }
}
protocol CapabilityBootstrap: AnyObject { func offer() -> CapabilityGrant? }
final class UnavailableCapabilityBootstrap: CapabilityBootstrap { func offer() -> CapabilityGrant? { nil } }

// Simulation-only trusted root. The numeric observation is deliberately never used as a key or authority.
final class SimulatedCapabilityBootstrap: CapabilityBootstrap {
    let simulatedPortName: UInt32
    private let qualified: Bool
    private let complete: Bool
    private let grant: CapabilityGrant
    private(set) var requests = 0
    init(provenance: CapabilityProvenance, holder: CapabilityHolder, creation: CapabilityCreation,
         operation: CapabilityOperation, qualified: Bool, simulatedPortName: UInt32, complete: Bool = true) {
        self.qualified = qualified; self.complete = complete; self.simulatedPortName = simulatedPortName
        grant = CapabilityGrant(provenance: provenance, holder: holder, creation: creation, operation: operation)
    }
    func offer() -> CapabilityGrant? {
        requests += 1
        return qualified && complete ? grant : nil
    }
}

// Mutable authority is confined to one lifecycle's lock. No transfer or duplication operation exists.
final class CapabilityAuthority {
    private var grant: CapabilityGrant?
    private(set) var status = CapabilityStatus.unissued
    private(set) var used = 0
    private(set) var rightReleased = false
    private(set) var releaseResponse: CapabilityRelease?
    private(set) var provenance: CapabilityProvenance?
    func establish(bootstrap: CapabilityBootstrap, binding: CapabilityBinding, holder: CapabilityHolder, creation: CapabilityCreation) throws {
        guard grant == nil, status == .unissued else { throw CapabilityError.replay }
        guard let offer = bootstrap.offer() else { throw CapabilityError.unavailable }
        guard try offer.provenance.matches(binding), offer.holder === holder, offer.creation === creation,
              holder.identity == binding.holder, creation.binding == binding else { throw CapabilityError.provenance }
        try offer.claim()
        try creation.claimIssuance()
        grant = offer; provenance = offer.provenance; status = .active
    }
    func check(holder: CapabilityHolder) throws {
        guard let grant else { throw CapabilityError.inactive }
        guard grant.holder === holder else { throw CapabilityError.custody }
        guard status == .active, used == 0 else { throw CapabilityError.inactive }
    }
    func reserve(holder: CapabilityHolder) throws -> CapabilityOperation {
        try check(holder: holder)
        guard let grant else { throw CapabilityError.inactive }
        used = 1; status = .spent
        return grant.operation
    }
    func invalidate(_ next: CapabilityStatus) {
        // A later observation must never resurrect a released right.
        if status != .released { status = next }
    }
    func release(holder: CapabilityHolder) throws -> CapabilityOperation {
        guard let grant else { throw CapabilityError.inactive }
        guard grant.holder === holder else { throw CapabilityError.custody }
        guard releaseResponse == nil, status != .released, status != .holderLost else { throw CapabilityError.inactive }
        status = .revoked
        return grant.operation
    }
    func recordRelease(_ result: CapabilityRelease) {
        releaseResponse = result; rightReleased = result == .released
        if rightReleased { status = .released }
    }
}
