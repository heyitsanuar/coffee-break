import Foundation

enum VMRecoveryDisposition: String, Codable { case rejected, partial, clearedSimulation }
struct VMReconciliationEvidence: VMDocument {
    static let documentKind = "vm-reconciliation-evidence"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var binding: VMExecutionBinding
    var caseId: String, procedureVersion: String
    var qualification = "qualifiedSimulation"
    var fact: VMFact
    var bindingIdentity: String { get throws { try VMWire.digest(binding) } }
    func validate() throws {
        try validateEnvelope(); try binding.validate(); try fact.validate(binding, recovery: true)
        guard VMWire.uuid(caseId), procedureVersion == "cleanup-simulation/1", qualification == "qualifiedSimulation",
              fact.value == .satisfied || fact.value == .retained else { throw VMError.evidence }
    }
}
struct VMRecoveryDecision: VMDocument {
    static let documentKind = "vm-recovery-decision"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String, caseId: String, originalReportDigest: String
    var expectedRevision: UInt64, expectedLedgerDigest: String
    var procedureVersion: String
    var evidence: [VMReconciliationEvidence]
    var disposition: VMRecoveryDisposition
    var previousLedger: VMResourceObligations
    var resultingLedger: VMResourceObligations
    var remaining: [VMObligation]
    var bindingIdentity: String { bindingDigest }
    func validate() throws {
        try validateEnvelope(); try previousLedger.validate(); try resultingLedger.validate()
        guard VMWire.hex(bindingDigest), VMWire.uuid(caseId), VMWire.hex(originalReportDigest),
              VMWire.hex(expectedLedgerDigest), expectedRevision <= VMWire.maximumInteger,
              procedureVersion == "cleanup-simulation/1", !evidence.isEmpty, evidence.count <= 12,
              Set(evidence.map { $0.fact.claim }).count == evidence.count,
              resultingLedger.bindingDigest == bindingDigest, remaining == resultingLedger.outstanding,
              disposition != .rejected,
              (disposition == .clearedSimulation) == remaining.isEmpty,
              resultingLedger.reservationHeld == !remaining.isEmpty else { throw VMError.contract }
        for item in evidence {
            try item.validate()
            // Qualified retained observations are auditable recovery facts, not
            // evidence that may authorize cleanup in a recovery decision.
            guard item.fact.value == .satisfied else { throw VMError.evidence }
            guard try item.bindingIdentity == bindingDigest, item.caseId == caseId, item.procedureVersion == procedureVersion
            else { throw VMError.binding }
        }
        let pinned = evidence[0].binding
        guard previousLedger.entries.map(\.resourceId) == pinned.resourceIds,
              previousLedger.reservationId == pinned.attemptId, previousLedger.heldResources == pinned.resources
        else { throw VMError.binding }
        guard previousLedger.bindingDigest == bindingDigest, try VMWire.digest(previousLedger) == expectedLedgerDigest,
              previousLedger.reservationHeld else { throw VMError.evidence }
        var expected = previousLedger
        for item in evidence {
            guard expected.entry(item.fact.claim).status == .outstanding else { throw VMError.evidence }
            try expected.credit(item.fact)
        }
        expected.reservationHeld = !expected.complete
        guard expected == resultingLedger else { throw VMError.evidence }
    }
}

final class VMReconciliationPermission {
    fileprivate let catalog: VMSimulationProcedureCatalog
    let bindingDigest: String, caseId: String, ledgerDigest: String
    let revision: UInt64, procedureVersion: String
    private var used = false
    fileprivate init(catalog: VMSimulationProcedureCatalog, bindingDigest: String, caseId: String, ledgerDigest: String, revision: UInt64) {
        self.catalog = catalog; self.bindingDigest = bindingDigest; self.caseId = caseId; self.ledgerDigest = ledgerDigest
        self.revision = revision; procedureVersion = "cleanup-simulation/1"
    }
    func consume(catalog expected: VMSimulationProcedureCatalog, binding: String, caseId: String, ledger: String, revision: UInt64) throws {
        guard !used else { throw VMError.replay } // M8: permission consumption is one-shot
        used = true
        guard catalog === expected, expected.simulationOnly, self.bindingDigest == binding, self.caseId == caseId,
              ledgerDigest == ledger, self.revision == revision else { throw VMError.stale }
    }
}
final class VMSimulationProcedureCatalog {
    let simulationOnly: Bool
    init() { simulationOnly = false } // Operational catalog is empty.
    private init(version: String) { simulationOnly = version == "cleanup-simulation/1" }
    static func simulationFixture(version: String) -> VMSimulationProcedureCatalog { VMSimulationProcedureCatalog(version: version) }
    func permission(bindingDigest: String, caseId: String, ledgerDigest: String, revision: UInt64) throws -> VMReconciliationPermission {
        guard simulationOnly, VMWire.hex(bindingDigest), VMWire.uuid(caseId), VMWire.hex(ledgerDigest),
              revision <= VMWire.maximumInteger else { throw VMError.authority }
        return VMReconciliationPermission(catalog: self, bindingDigest: bindingDigest, caseId: caseId, ledgerDigest: ledgerDigest, revision: revision)
    }
}

// Candidate state is not authoritative until its publication verifies. Retained
// even on lost acknowledgement so recovery can apply the committed decision once.
final class VMRecoveryTransaction {
    let decision: VMRecoveryDecision
    let publication = VMPublication<VMRecoveryDecision>()
    var applied = false
    init(_ decision: VMRecoveryDecision) { self.decision = decision }
}
