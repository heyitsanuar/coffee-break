import Foundation

struct VMEvent: Codable, Equatable {
    var sequence: UInt64, tick: UInt64
    var code: VMEventCode
    var reference: String?
    var previousDigest: String?
}
enum VMEventCode: String, Codable {
    case armed, createIntent, createReturned, go, stopRequested, escalationRequested, brokerOperation
    case fence, observation, rejected, controllerLost, ownerLost, watchdogLost, blocked, quarantine, quota, finalized
}
struct VMEventLog {
    private(set) var events: [VMEvent] = []
    private(set) var ordinaryCount = 0
    private(set) var ordinaryBytes = 0
    private(set) var totalBytes = 0
    mutating func append(_ code: VMEventCode, tick: UInt64, reference: String? = nil, critical: Bool = false) throws {
        let previous = try events.last.map(VMWire.digest)
        let e = VMEvent(sequence: UInt64(events.count + 1), tick: tick, code: code, reference: reference, previousDigest: previous)
        let size = try VMWire.encode(e).count
        guard size <= 4_096, events.count < 128, totalBytes + size <= 65_536,
              critical || (ordinaryCount < 96 && ordinaryBytes + size <= 49_152) else { throw VMError.quota }
        events.append(e); totalBytes += size
        if !critical { ordinaryCount += 1; ordinaryBytes += size }
    }
}

struct VMQualificationReport: VMDocument {
    static let documentKind = "vm-qualification-report"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var binding: VMExecutionBinding
    var owner: VMOwnerLifecycle, watchdog: VMWatchdogLifecycle
    var vm: VMState, outcome: VMOutcome, verdict: VMVerdict
    var workloadCompleted: Bool
    var controllerLost: Bool
    var brokerOpen: Bool
    var upstreamCancellationRequested: Bool
    var upstreamCostReversalEstablished = false
    var ledger: VMResourceObligations
    var quarantine: VMQuarantineRecord?
    var observations: [VMFact]
    var findings: [VMReason]
    var events: [VMEvent]
    var finalizedAtTick: UInt64
    var unverifiedGuarantees = ["native-ownership", "native-termination", "wait-reap", "vm-cleanup", "disk-release",
        "watchdog-enforcement", "vm-isolation", "broker-enforcement", "filesystem-durability", "plugin-mcp-isolation",
        "orch-002-ac06", "gate-1-provenance"]
    var bindingIdentity: String { get throws { try VMWire.digest(binding) } }
    func validate() throws {
        try validateEnvelope(); try binding.validate(); try owner.validate(); try watchdog.validate(); try ledger.validate()
        let digest = try bindingIdentity
        guard owner.bindingDigest == digest, watchdog.bindingDigest == digest, ledger.bindingDigest == digest,
              watchdog.deadlineBindingDigest == (try VMWire.digest(binding.deadlines)),
              ledger.reservationId == binding.attemptId, ledger.entries.map(\.resourceId) == binding.resourceIds,
              observations.count <= 32,
              events.count <= 128, Set(findings).count == findings.count,
              finalizedAtTick >= binding.deadlines.armedAt, finalizedAtTick <= VMWire.maximumInteger,
              !brokerOpen, !upstreamCostReversalEstablished,
              unverifiedGuarantees == Self.requiredUnverified else { throw VMError.contract }
        let observationRefs = try observations.map(VMWire.digest)
        guard Set(observationRefs).count == observations.count else { throw VMError.contract }
        if Set(observations.map(\.id)).count != observations.count {
            guard findings.contains(.contradiction), quarantine != nil else { throw VMError.contract }
        }
        for item in observations { try item.validate(binding, recovery: false) }
        guard ledger.entries.flatMap(\.evidenceRefs).allSatisfy(observationRefs.contains) else { throw VMError.evidence }
        try ledger.validateEvidence(observations)
        for i in events.indices {
            let e = events[i]
            guard e.sequence == UInt64(i + 1), e.tick >= binding.deadlines.armedAt, e.tick <= finalizedAtTick,
                  i == 0 || e.tick >= events[i - 1].tick,
                  i == 0 ? e.previousDigest == nil : e.previousDigest == (try VMWire.digest(events[i - 1])),
                  e.reference == nil || VMWire.hex(e.reference!), (try VMWire.encode(e)).count <= 4_096 else { throw VMError.contract }
        }
        guard events.reduce(0, { $0 + ((try? VMWire.encode($1).count) ?? 65_537) }) <= 65_536,
              events.last?.code == .finalized else { throw VMError.contract }
        if let quarantine {
            try quarantine.validate()
            guard quarantine.bindingDigest == digest, quarantine.hostScopeId == binding.hostScopeId,
                  quarantine.resourceIds == binding.resourceIds, quarantine.reservationId == binding.attemptId,
                  quarantine.state == .active, outcome == .unresolved, ledger.reservationHeld else { throw VMError.contract }
        }
        let cleanup = ledger.complete && !ledger.reservationHeld && quarantine == nil
        func observed(_ claim: VMObligation) -> [String] {
            zip(observations, observationRefs).filter { $0.0.claim == claim && $0.0.value == .satisfied }.map { $0.1 }
        }
        for (claim, ref) in [(VMObligation.ownerExit, owner.exitRef), (.ownerReap, watchdog.reapRef), (.vmStop, owner.stopCallbackRef)] {
            guard ref == nil || observed(claim).contains(ref!) else { throw VMError.evidence }
        }
        guard outcome != .completed || (owner.exitRef != nil && watchdog.reapRef != nil && owner.stopCallbackRef != nil && vm == .stoppedObserved)
        else { throw VMError.contract }
        let expected: VMVerdict = outcome == .completed ? .pass : outcome == .unresolved ? .unverified : .fail
        guard verdict == expected, outcome != .completed || (cleanup && workloadCompleted && findings.isEmpty && owner.goConsumed),
              outcome != .unresolved || (quarantine != nil && ledger.reservationHeld),
              outcome == .unresolved || outcome == .blocked || cleanup else { throw VMError.contract }
    }
    static let requiredUnverified = ["native-ownership", "native-termination", "wait-reap", "vm-cleanup", "disk-release",
        "watchdog-enforcement", "vm-isolation", "broker-enforcement", "filesystem-durability", "plugin-mcp-isolation",
        "orch-002-ac06", "gate-1-provenance"]
}

struct VMReceipt: VMDocument {
    static let documentKind = "vm-publication-receipt"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String, documentKind: String, digest: String
    var byteLength: Int
    var bindingIdentity: String { bindingDigest }
    func validate() throws {
        try validateEnvelope()
        guard VMWire.hex(bindingDigest), VMWire.hex(digest), (1...65_536).contains(byteLength),
              documentKind == VMQualificationReport.documentKind || documentKind == VMRecoveryDecision.documentKind ||
                  documentKind == VMPostClearanceDispute.documentKind else { throw VMError.contract }
    }
}
enum VMPublicationPoint: String, CaseIterable { case beforeBytes, afterBytes, beforeReceipt, afterReceipt }
// In-memory transaction model. No real file publication or durability claim.
final class VMPublication<T: VMDocument> {
    private var staged: Data?
    private var bytes: Data?
    private var receipt: Data?
    private var proposed: VMReceipt?
    func stage(_ value: T) throws {
        guard staged == nil else { throw VMError.replay }
        let data = try VMWire.document(value)
        let marker = VMReceipt(bindingDigest: try value.bindingIdentity, documentKind: T.documentKind,
            digest: VMWire.hash(data), byteLength: data.count)
        try marker.validate(); staged = data; proposed = marker
    }
    func commit(interruption: VMPublicationPoint? = nil, beforeReceipt: (() throws -> Void)? = nil) throws {
        guard let staged, let proposed, bytes == nil, receipt == nil else { throw VMError.incomplete }
        if interruption == .beforeBytes { throw VMError.interrupted }
        bytes = staged
        if interruption == .afterBytes { throw VMError.interrupted } // M7: no marker before complete publication
        try beforeReceipt?()
        if interruption == .beforeReceipt { throw VMError.interrupted }
        receipt = try VMWire.document(proposed)
        if interruption == .afterReceipt { throw VMError.interrupted }
    }
    func verified() throws -> T {
        guard let bytes, let receipt else { throw VMError.incomplete }
        return try Self.verify(bytes: bytes, receipt: receipt)
    }
    func exported() throws -> (bytes: Data, receipt: Data) {
        _ = try verified()
        return (bytes!, receipt!)
    }
    static func verify(bytes: Data, receipt: Data) throws -> T {
        let r = try VMWire.decode(VMReceipt.self, receipt)
        guard bytes.count == r.byteLength, VMWire.hash(bytes) == r.digest, r.documentKind == T.documentKind else { throw VMError.incomplete }
        let value = try VMWire.decode(T.self, bytes)
        guard try value.bindingIdentity == r.bindingDigest else { throw VMError.binding }
        return value
    }
}
