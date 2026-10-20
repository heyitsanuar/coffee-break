import Foundation

enum VMQuarantineState: String, Codable { case active, cleared }
enum VMReason: String, Codable, CaseIterable {
    case controllerLost, ownerLost, watchdogLost, ownerBlocked, creationUncertain, deadline, clockDiscontinuity
    case contradiction, quota, incompleteCleanup, rejectedEvent, notificationFailed, staleResult, operatorNote, restoreIncomplete
}
struct VMQuarantineRecord: VMDocument {
    static let documentKind = "vm-quarantine-record"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String, caseId: String, hostScopeId: String, reservationId: String
    var resourceIds: [String], reasonCodes: [VMReason]
    var openedAtTick: UInt64
    var obligationSetDigest: String
    var state = VMQuarantineState.active
    var recoveryRevision: UInt64 = 0
    var decisionRefs: [String] = [], noteRefs: [String] = [], rejectionRefs: [String] = []
    var bindingIdentity: String { bindingDigest }
    func validate() throws {
        try validateEnvelope(); try VMWire.refs(decisionRefs); try VMWire.refs(noteRefs); try VMWire.refs(rejectionRefs)
        guard VMWire.hex(bindingDigest), VMWire.uuid(caseId), VMWire.uuid(hostScopeId), VMWire.uuid(reservationId),
              resourceIds.count == VMObligation.allCases.count, Set(resourceIds).count == resourceIds.count,
              resourceIds.allSatisfy(VMWire.uuid), !reasonCodes.isEmpty, Set(reasonCodes).count == reasonCodes.count,
              openedAtTick <= VMWire.maximumInteger, VMWire.hex(obligationSetDigest), recoveryRevision <= VMWire.maximumInteger,
              decisionRefs.count <= 8, noteRefs.count <= 8, rejectionRefs.count <= 8,
              state != .cleared || !decisionRefs.isEmpty else { throw VMError.contract }
    }
}

// One append-only post-clearance dispute per attempt. Historical clearance and
// original report remain separate immutable artifacts. Publication is simulated.
struct VMPostClearanceDispute: VMDocument {
    static let documentKind = "vm-post-clearance-dispute"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var originalReportDigest: String
    var clearedAtTick: UInt64
    var clearedCase: VMQuarantineRecord
    var clearance: VMRecoveryDecision
    var evidence: VMReconciliationEvidence
    var resultingLedger: VMResourceObligations
    var quarantine: VMQuarantineRecord
    var bindingIdentity: String { clearance.bindingDigest }
    static func caseId(_ clearedCase: VMQuarantineRecord, fact: VMFact) throws -> String {
        let h = VMWire.hash(Data("dispute:\(try VMWire.digest(clearedCase)):\(try VMWire.digest(fact))".utf8))
        return [h.prefix(8), h.dropFirst(8).prefix(4), h.dropFirst(12).prefix(4), h.dropFirst(16).prefix(4), h.dropFirst(20).prefix(12)]
            .map(String.init).joined(separator: "-")
    }
    func validate() throws {
        try validateEnvelope(); try clearedCase.validate(); try clearance.validate()
        try evidence.validate(); try resultingLedger.validate(); try quarantine.validate()
        guard VMWire.hex(originalReportDigest), originalReportDigest == clearance.originalReportDigest,
              clearedCase.state == .cleared, clearance.disposition == .clearedSimulation,
              clearedCase.bindingDigest == bindingIdentity, clearance.caseId == clearedCase.caseId,
              clearedCase.caseId == evidence.binding.attemptId, clearedCase.reservationId == evidence.binding.attemptId,
              clearedCase.hostScopeId == evidence.binding.hostScopeId, clearedCase.resourceIds == evidence.binding.resourceIds,
              clearedCase.decisionRefs.last == (try VMWire.digest(clearance)),
              clearedCase.obligationSetDigest == (try VMWire.digest(clearance.resultingLedger)),
              clearedCase.recoveryRevision == (try VMWire.add(clearance.expectedRevision, 1)),
              try evidence.bindingIdentity == bindingIdentity, evidence.fact.value == .retained,
              evidence.caseId == quarantine.caseId, quarantine.caseId == (try Self.caseId(clearedCase, fact: evidence.fact)),
              quarantine.caseId != clearedCase.caseId, quarantine.state == .active,
              quarantine.bindingDigest == bindingIdentity, quarantine.hostScopeId == clearedCase.hostScopeId,
              quarantine.reservationId == clearedCase.reservationId, quarantine.resourceIds == clearedCase.resourceIds,
              quarantine.recoveryRevision == (try VMWire.add(clearedCase.recoveryRevision, 1)),
              quarantine.openedAtTick >= evidence.fact.tick,
              quarantine.decisionRefs.isEmpty, quarantine.noteRefs.isEmpty, quarantine.rejectionRefs.isEmpty,
              quarantine.obligationSetDigest == (try VMWire.digest(resultingLedger)) else { throw VMError.evidence }
        let released = clearance.evidence.filter { $0.fact.claim == evidence.fact.claim }.map { $0.fact.tick }.max()
        guard clearedAtTick >= clearedCase.openedAtTick, clearedAtTick <= VMWire.maximumInteger,
              clearedAtTick >= (clearance.evidence.map { $0.fact.tick }.max() ?? 0),
              evidence.fact.tick >= max(released ?? clearedCase.openedAtTick, clearedAtTick) else { throw VMError.stale }
        var expected = clearance.resultingLedger
        var quota = false
        do { try expected.dispute(evidence.fact) } catch VMError.quota { quota = true }
        guard expected == resultingLedger, resultingLedger.reservationHeld,
              resultingLedger.entry(evidence.fact.claim).status == .contradictory,
              quarantine.reasonCodes == (quota ? [.contradiction, .quota] : [.contradiction]) else { throw VMError.evidence }
    }
}
