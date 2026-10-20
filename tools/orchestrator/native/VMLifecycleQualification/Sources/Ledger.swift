import Foundation

enum VMObligation: String, Codable, CaseIterable {
    case ownerExit, ownerReap, vmStop, vmResources, disk, scratch, descriptors, brokerFence, upstream
    var source: VMRole {
        switch self {
        case .ownerExit, .ownerReap: return .watchdog
        case .vmStop: return .owner
        case .vmResources, .disk, .scratch, .descriptors: return .resources
        case .brokerFence: return .controller
        case .upstream: return .broker
        }
    }
}
enum VMFactValue: String, Codable { case satisfied, retained, notRequired }
enum VMObligationStatus: String, Codable { case outstanding, satisfied, notRequired, contradictory }
enum VMExposure: String, Codable { case notDispatched, possible, confirmed }
struct VMFact: Codable, Equatable {
    var id: String, bindingDigest: String, resourceId: String
    var claim: VMObligation, value: VMFactValue, source: VMRole
    var sourceId: String
    var sequence: UInt64, tick: UInt64
    var epochId: String
    var exposureReference: String? = nil
    func validate(_ binding: VMExecutionBinding, recovery: Bool) throws {
        guard bindingDigest == (try VMWire.digest(binding)) else { throw VMError.binding }
        let index = VMObligation.allCases.firstIndex(of: claim)!
        guard VMWire.uuid(id), resourceId == binding.resourceIds[index], sourceId == binding.actors.id(source),
              source == (recovery ? .reconciler : claim.source), epochId == binding.clockEpochId,
              sequence <= VMWire.maximumInteger, tick >= binding.deadlines.armedAt, tick <= VMWire.maximumInteger,
              exposureReference == nil || VMWire.hex(exposureReference!),
              value != .notRequired || (claim == .upstream && exposureReference == nil) else { throw VMError.evidence }
        guard try VMWire.encode(self).count <= 4_096 else { throw VMError.quota }
    }
}
struct VMObligationEntry: Codable, Equatable {
    var resourceId: String, claim: VMObligation
    var exposure = VMExposure.notDispatched
    var status = VMObligationStatus.outstanding
    var evidenceRefs: [String] = []
    var exposureReference: String?
    var exposedAtTick: UInt64?
}
struct VMResourceObligations: VMDocument {
    static let documentKind = "vm-resource-obligations"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String, reservationId: String
    var heldResources = VMResources()
    var reservationHeld = true
    var revision: UInt64 = 0
    var previousDigest: String?
    var entries: [VMObligationEntry]
    var bindingIdentity: String { bindingDigest }
    init(_ b: VMExecutionBinding) throws {
        bindingDigest = try VMWire.digest(b); reservationId = b.attemptId
        entries = zip(VMObligation.allCases, b.resourceIds).map { VMObligationEntry(resourceId: $0.1, claim: $0.0) }
        // The local admission gate exists before VM creation; physical resources
        // and upstream requests do not. Its exposure is the bound gate itself.
        let gate = VMObligation.allCases.firstIndex(of: .brokerFence)!
        entries[gate].exposure = .possible; entries[gate].exposureReference = bindingDigest
        entries[gate].exposedAtTick = b.deadlines.armedAt
    }
    var outstanding: [VMObligation] { entries.filter { $0.status == .outstanding || $0.status == .contradictory }.map(\.claim) }
    var complete: Bool { outstanding.isEmpty }
    func entry(_ claim: VMObligation) -> VMObligationEntry { entries.first { $0.claim == claim }! }
    func requireUnexposed(_ claim: VMObligation) throws {
        let item = entry(claim)
        guard item.exposure == .notDispatched, item.status == .outstanding, item.evidenceRefs.isEmpty,
              item.exposureReference == nil, item.exposedAtTick == nil else { throw VMError.transition }
    }
    mutating func dispatched(at tick: UInt64, reference: String) throws {
        let physical = entries.indices.filter { entries[$0].claim != .upstream && entries[$0].claim != .brokerFence }
        for i in physical { try requireUnexposed(entries[i].claim) }
        guard tick <= VMWire.maximumInteger, VMWire.hex(reference) else { throw VMError.contract }
        try advance()
        for i in physical {
            entries[i].exposure = .possible; entries[i].exposureReference = reference; entries[i].exposedAtTick = tick
        }
    }
    mutating func exposeUpstream(at tick: UInt64, reference: String) throws {
        try requireUnexposed(.upstream)
        guard tick <= VMWire.maximumInteger, VMWire.hex(reference) else { throw VMError.contract }
        try advance()
        let index = VMObligation.allCases.firstIndex(of: .upstream)!
        entries[index].exposure = .possible; entries[index].exposureReference = reference; entries[index].exposedAtTick = tick
    }
    mutating func advance() throws {
        previousDigest = try VMWire.digest(self); revision = try VMWire.add(revision, 1)
    }
    // This primitive is private to the trusted aggregate/evaluator boundary. It
    // does not authenticate DTOs: callers must first validate opaque provenance.
    func validateCredit(_ fact: VMFact) throws {
        let item = entry(fact.claim)
        if fact.value == .notRequired {
            guard fact.claim == .upstream, item.exposure == .notDispatched,
                  item.exposureReference == nil, fact.exposureReference == nil else { throw VMError.evidence }
        } else {
            guard item.exposure != .notDispatched, let reference = item.exposureReference,
                  fact.exposureReference == reference, let tick = item.exposedAtTick, fact.tick >= tick
            else { throw VMError.evidence }
        }
    }
    mutating func credit(_ fact: VMFact) throws {
        try validateCredit(fact)
        let index = entries.firstIndex { $0.claim == fact.claim }!
        let reference = try VMWire.digest(fact)
        if entries[index].evidenceRefs.contains(reference) { return }
        guard entries.flatMap(\.evidenceRefs).count < 32 else { throw VMError.quota }
        try advance(); entries[index].evidenceRefs.append(reference)
        let previous = entries[index].status
        if previous == .contradictory || (previous == .satisfied && fact.value != .satisfied) ||
            (previous == .notRequired && fact.value != .notRequired) {
            entries[index].status = .contradictory; throw VMError.contradiction
        }
        switch fact.value {
        case .satisfied: entries[index].status = .satisfied; entries[index].exposure = .confirmed
        case .notRequired:
            guard entries[index].exposure == .notDispatched else {
                entries[index].status = .contradictory; throw VMError.contradiction
            }
            entries[index].status = .notRequired
        case .retained: entries[index].status = .outstanding
        }
    }
    // Recording a qualified negative fact is not a cleanup authorization. Keep
    // the changed history even when it contradicts an earlier satisfied credit.
    mutating func dispute(_ fact: VMFact) throws {
        guard fact.value == .retained else { throw VMError.evidence }
        do { try credit(fact) }
        catch VMError.contradiction { /* credit retained both facts and the disputed status */ }
        catch VMError.quota {
            // The full negative fact is retained by the recovery audit. Exhausting
            // ledger references must not leave the earlier cleanup credit usable.
            let index = entries.firstIndex { $0.claim == fact.claim }!
            if entries[index].status == .satisfied {
                try advance(); entries[index].status = .contradictory
            }
            reservationHeld = true; throw VMError.quota
        }
        reservationHeld = true
    }
    // Reconstruct each obligation from its own referenced facts. Merely finding
    // a valid digest elsewhere in the report does not establish this resource's
    // release, and a retained observation cannot be relabelled as satisfied.
    func validateEvidence(_ facts: [VMFact]) throws {
        var byDigest: [String: VMFact] = [:]
        for fact in facts { byDigest[try VMWire.digest(fact)] = fact }
        let conflictedIds = Set(Dictionary(grouping: facts, by: \.id).filter { $0.value.count > 1 }.map(\.key))
        for entry in entries {
            var expected = VMObligationStatus.outstanding
            var hasConflictingId = false
            for reference in entry.evidenceRefs {
                guard let fact = byDigest[reference], fact.claim == entry.claim, fact.resourceId == entry.resourceId
                else { throw VMError.evidence }
                try validateCredit(fact)
                hasConflictingId = hasConflictingId || conflictedIds.contains(fact.id)
                if expected == .contradictory { continue }
                switch fact.value {
                case .satisfied: expected = expected == .notRequired ? .contradictory : .satisfied
                case .retained: expected = expected == .outstanding ? .outstanding : .contradictory
                case .notRequired: expected = expected == .satisfied ? .contradictory : .notRequired
                }
            }
            guard entry.status == expected || (entry.status == .contradictory && hasConflictingId) else { throw VMError.evidence }
        }
    }
    func validate() throws {
        try validateEnvelope(); try VMWire.refs(entries.flatMap(\.evidenceRefs))
        guard VMWire.hex(bindingDigest), VMWire.uuid(reservationId), heldResources == VMResources(),
              entries.count == VMObligation.allCases.count, entries.count <= 12,
              entries.map(\.claim) == VMObligation.allCases, Set(entries.map(\.resourceId)).count == entries.count,
              entries.allSatisfy({ VMWire.uuid($0.resourceId) }), revision <= VMWire.maximumInteger,
              entries.allSatisfy({ ($0.exposure == .notDispatched) == ($0.exposureReference == nil && $0.exposedAtTick == nil) }),
              entries.allSatisfy({ $0.exposure == .notDispatched || ($0.exposureReference.map { VMWire.hex($0) } == true &&
                  $0.exposedAtTick.map { $0 <= VMWire.maximumInteger } == true) }),
              previousDigest == nil || VMWire.hex(previousDigest!), reservationHeld || complete,
              entries.allSatisfy({ $0.status == .outstanding || !$0.evidenceRefs.isEmpty }),
              entries.allSatisfy({ $0.exposure != .notDispatched || $0.status == .notRequired ||
                  ($0.status == .outstanding && $0.evidenceRefs.isEmpty) }),
              entries.allSatisfy({ $0.status != .notRequired || ($0.claim == .upstream && $0.exposure == .notDispatched) })
        else { throw VMError.contract }
    }
}
