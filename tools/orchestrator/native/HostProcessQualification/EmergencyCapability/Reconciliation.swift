import Foundation

enum CapabilityExitKind: String, Codable { case normal, forced, unknown }
struct CapabilityExit: Codable, Equatable {
    var code: Int32
    var kind: CapabilityExitKind
    var valid: Bool { (0...255).contains(code) }
}
// These observation objects are trusted injected simulation facts, not wire messages from S.
struct CapabilityReap {
    let owner: CapabilityCreation
    let exit: CapabilityExit
}
struct CapabilityObservationBatch {
    var bindingDigest: String
    var target: CapabilityTarget
    var exit: CapabilityExit?
    var reap: CapabilityReap?
    var emergencyCauseReference: String?
    var descriptorsClosed: Bool
}
protocol CapabilityObservationPort: AnyObject { func read() -> CapabilityObservationBatch? }
final class UnavailableCapabilityObservations: CapabilityObservationPort { func read() -> CapabilityObservationBatch? { nil } }
struct CapabilityFacts: Codable, Equatable {
    var exit: CapabilityExit?
    var reap: CapabilityExit?
    var emergencyCauseReference: String?
    var descriptorsClosed = false
}
struct CapabilityReconciliation {
    private(set) var facts = CapabilityFacts()
    mutating func apply(_ batch: CapabilityObservationBatch, binding: CapabilityBinding, creation: CapabilityCreation,
                        guardLost: Bool, request: CapabilityRequest?, inFlight: Bool) throws -> [CapabilityFinding] {
        guard try batch.bindingDigest == CapabilityWire.digest(binding), batch.target == binding.target,
              batch.exit?.valid != false, batch.reap?.exit.valid != false,
              batch.emergencyCauseReference.map({ CapabilityWire.hex($0) }) != false else { throw CapabilityError.contradiction }
        if let old = facts.exit, let new = batch.exit, old != new { throw CapabilityError.contradiction }
        if let old = facts.reap, let new = batch.reap?.exit, old != new { throw CapabilityError.contradiction }
        if let exit = batch.exit ?? facts.exit, let reap = batch.reap?.exit ?? facts.reap, exit != reap { throw CapabilityError.contradiction }
        if let old = facts.emergencyCauseReference, let new = batch.emergencyCauseReference, old != new { throw CapabilityError.contradiction }
        if let cause = batch.emergencyCauseReference, cause != request?.reference { throw CapabilityError.contradiction }
        if let reap = batch.reap, reap.owner !== creation { throw CapabilityError.contradiction }
        // Descriptors cannot reopen after an attested close in this bounded experiment.
        if facts.descriptorsClosed && !batch.descriptorsClosed { throw CapabilityError.contradiction }
        var findings: [CapabilityFinding] = []
        if let exit = batch.exit {
            facts.exit = exit
            if request == nil && (exit.kind != .normal || exit.code != 0) { findings.append(.unexpectedExit) }
        }
        if let reap = batch.reap {
            if guardLost && facts.reap == nil { findings.append(.unaccreditedReap) }
            else { facts.reap = reap.exit }
            if inFlight { findings.append(.ambiguousRace) }
        }
        if let cause = batch.emergencyCauseReference { facts.emergencyCauseReference = cause }
        facts.descriptorsClosed = batch.descriptorsClosed
        return findings
    }
}
