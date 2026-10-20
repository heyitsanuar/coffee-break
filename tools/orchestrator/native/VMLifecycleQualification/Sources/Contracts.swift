import Foundation
import CryptoKit

enum VMError: Error, Equatable {
    case contract, binding, authority, replay, transition, deadline, clock, busy, terminal
    case quarantined, unavailable, contradiction, quota, interrupted, incomplete, stale, evidence
}

// Tripwire, not an OS boundary. There is no operative backend in this module.
enum VMBackendPolicy { static let productionIntegration = false }

protocol VMDocument: Codable, Equatable {
    static var documentKind: String { get }
    var schemaVersion: Int { get }
    var kind: String { get }
    var mode: String { get }
    var authorization: String { get }
    var allowNativeLaunch: Bool { get }
    var nativeEnforcement: String { get }
    var bindingIdentity: String { get throws }
    func validate() throws
}
extension VMDocument {
    func validateEnvelope() throws {
        guard schemaVersion == 1, kind == Self.documentKind, mode == "simulation", authorization == "none",
              !allowNativeLaunch, nativeEnforcement == "unverified" else { throw VMError.contract }
    }
}
enum VMWire {
    static let maximumInteger: UInt64 = 9_007_199_254_740_991
    static func encode<T: Encodable>(_ value: T) throws -> Data {
        let e = JSONEncoder(); e.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try e.encode(value)
        guard data.count <= 65_536 else { throw VMError.quota }
        return data
    }
    static func document<T: VMDocument>(_ value: T) throws -> Data { try value.validate(); return try encode(value) }
    // Exact re-encoding rejects unknown/duplicate fields at every nested level.
    // No decoding API produces a capability, qualified observation or permission.
    static func decode<T: VMDocument>(_ type: T.Type, _ bytes: Data) throws -> T {
        guard !bytes.isEmpty, bytes.count <= 65_536 else { throw VMError.quota }
        let value: T
        do { value = try JSONDecoder().decode(type, from: bytes) } catch { throw VMError.contract }
        guard try encode(value) == bytes else { throw VMError.contract }
        try value.validate(); return value
    }
    static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    static func digest<T: Encodable>(_ value: T) throws -> String { hash(try encode(value)) }
    static func hex(_ s: String, count: Int = 64) -> Bool {
        s.utf8.count == count && s.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    static func uuid(_ s: String) -> Bool { UUID(uuidString: s)?.uuidString.lowercased() == s }
    static func add(_ a: UInt64, _ b: UInt64) throws -> UInt64 {
        let r = a.addingReportingOverflow(b)
        guard !r.overflow, r.partialValue <= maximumInteger else { throw VMError.contract }
        return r.partialValue
    }
    static func refs(_ values: [String]) throws {
        guard values.count <= 32, Set(values).count == values.count, values.allSatisfy({ hex($0) }) else { throw VMError.contract }
    }
}
struct VMBlob: Codable, Equatable {
    var sha256: String
    var byteLength: UInt64
    var valid: Bool { VMWire.hex(sha256) && byteLength > 0 && byteLength <= 65_536 }
    func verify(_ bytes: Data) throws {
        guard valid, UInt64(bytes.count) == byteLength, VMWire.hash(bytes) == sha256 else { throw VMError.evidence }
    }
}
struct VMBinary: Codable, Equatable {
    var blob: VMBlob
    var version: String
    var sourceSha: String?
    var valid: Bool { blob.valid && version == "synthetic/1" && (sourceSha == nil || VMWire.hex(sourceSha!, count: 40)) }
}
struct VMImage: Codable, Equatable {
    var format = "linux-artifacts-model/1"
    var kernel: VMBlob, initramfs: VMBlob, rootDisk: VMBlob
    var valid: Bool { format == "linux-artifacts-model/1" && kernel.valid && initramfs.valid && rootDisk.valid }
}
struct VMArtifacts: Codable, Equatable {
    var controller: VMBinary, owner: VMBinary, watchdog: VMBinary, guest: VMBinary
    var image: VMImage
    var inputProjection: VMBlob
    var valid: Bool { controller.valid && owner.valid && watchdog.valid && guest.valid && image.valid && inputProjection.valid }
}
enum VMRole: String, Codable, CaseIterable { case controller, owner, watchdog, resources, broker, reconciler }
struct VMActors: Codable, Equatable {
    var controller: String, owner: String, watchdog: String, resources: String, broker: String, reconciler: String
    func id(_ role: VMRole) -> String {
        switch role {
        case .controller: return controller
        case .owner: return owner
        case .watchdog: return watchdog
        case .resources: return resources
        case .broker: return broker
        case .reconciler: return reconciler
        }
    }
    var valid: Bool {
        let ids = VMRole.allCases.map(id)
        return Set(ids).count == ids.count && ids.allSatisfy(VMWire.uuid)
    }
}
struct VMResources: Codable, Equatable {
    var maxAttempts = 1, maxVMs = 1, vCPUs = 2, memoryMiB = 2048, scratchMiB = 2048
}
struct VMDeadlines: Codable, Equatable {
    var armedAt: UInt64, bootBy: UInt64, executionBy: UInt64, escalationBy: UInt64, cleanupBy: UInt64
    init(_ t: UInt64) throws {
        armedAt = t; bootBy = try VMWire.add(t, 120_000); executionBy = try VMWire.add(t, 900_000)
        escalationBy = try VMWire.add(executionBy, 10_000); cleanupBy = try VMWire.add(escalationBy, 30_000)
    }
    func validate() throws { guard try self == VMDeadlines(armedAt) else { throw VMError.contract } }
}
struct VMExecutionBinding: VMDocument {
    static let documentKind = "vm-execution-binding"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var purpose = "d1a-model-only", repository = "heyitsanuar/coffee-break"
    var storyNumber = 103, epicNumber = 99
    var runId: String, attemptId: String, hostScopeId: String, bootId: String, clockEpochId: String
    var actors: VMActors
    var resourceIds: [String]
    var workflowRevision: UInt64, journalSequence: UInt64
    var journalHeadHash: String, acceptedBundleRef: String, repositoryBaselineSha: String
    var phaseAJobRef: VMBlob
    var artifacts: VMArtifacts
    var policyId = "RECOVERY-001", policyVersion = 1, policyDigest: String
    var resources = VMResources()
    var deadlines: VMDeadlines
    var bindingIdentity: String { get throws { try VMWire.digest(self) } }
    init(runId: String, attemptId: String, hostScopeId: String, bootId: String, clockEpochId: String, actors: VMActors,
         resourceIds: [String], workflowRevision: UInt64, journalSequence: UInt64, journalHeadHash: String,
         acceptedBundleRef: String, repositoryBaselineSha: String, phaseAJobRef: VMBlob, artifacts: VMArtifacts,
         policyDigest: String, armedAt: UInt64) throws {
        self.runId = runId; self.attemptId = attemptId; self.hostScopeId = hostScopeId; self.bootId = bootId
        self.clockEpochId = clockEpochId; self.actors = actors; self.resourceIds = resourceIds
        self.workflowRevision = workflowRevision; self.journalSequence = journalSequence; self.journalHeadHash = journalHeadHash
        self.acceptedBundleRef = acceptedBundleRef; self.repositoryBaselineSha = repositoryBaselineSha
        self.phaseAJobRef = phaseAJobRef; self.artifacts = artifacts; self.policyDigest = policyDigest
        deadlines = try VMDeadlines(armedAt); try validate()
    }
    func validate() throws {
        try validateEnvelope(); try deadlines.validate()
        guard purpose == "d1a-model-only", repository == "heyitsanuar/coffee-break", storyNumber == 103, epicNumber == 99,
              [runId, attemptId, hostScopeId, bootId, clockEpochId].allSatisfy(VMWire.uuid), actors.valid,
              resourceIds.count == VMObligation.allCases.count, Set(resourceIds).count == resourceIds.count,
              resourceIds.allSatisfy(VMWire.uuid), workflowRevision <= VMWire.maximumInteger,
              journalSequence <= VMWire.maximumInteger, VMWire.hex(journalHeadHash),
              acceptedBundleRef.hasPrefix("bundle-v1:"), VMWire.hex(String(acceptedBundleRef.dropFirst(10))),
              VMWire.hex(repositoryBaselineSha, count: 40), phaseAJobRef.valid, artifacts.valid,
              policyId == "RECOVERY-001", policyVersion == 1, VMWire.hex(policyDigest), resources == VMResources()
        else { throw VMError.contract }
    }
}

enum VMOwnerState: String, Codable { case bound, starting, running, stopRequested, stopObserved, exitObserved, blocked, lost }
enum VMWatchdogState: String, Codable { case bound, armed, monitoring, enforcing, exitObserved, reaped, finished, lost }
enum VMState: String, Codable { case notCreated, allocated, starting, running, stopRequested, stoppedObserved, unknown }
enum VMAttemptPhase: String, Codable { case prepared, active, settling, finalized }
enum VMOutcome: String, Codable { case completed, failed, cancelled, unresolved, blocked }
enum VMVerdict: String, Codable { case pass = "PASS", fail = "FAIL", unverified = "UNVERIFIED" }

struct VMOwnerLifecycle: VMDocument {
    static let documentKind = "vm-owner-lifecycle"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String
    var state = VMOwnerState.bound
    var creationRef: String?, stopRequestRef: String?, stopCallbackRef: String?, exitRef: String?
    var goConsumed = false, controlRevoked = false
    var bindingIdentity: String { bindingDigest }
    func validate() throws {
        try validateEnvelope(); guard VMWire.hex(bindingDigest) else { throw VMError.contract }
        try VMWire.refs([creationRef, stopRequestRef, stopCallbackRef, exitRef].compactMap { $0 })
        guard !goConsumed || creationRef != nil, stopCallbackRef == nil || stopRequestRef != nil else { throw VMError.contract }
    }
}
struct VMWatchdogLifecycle: VMDocument {
    static let documentKind = "vm-watchdog-lifecycle"
    var schemaVersion = 1, kind = documentKind, mode = "simulation", authorization = "none"
    var allowNativeLaunch = false, nativeEnforcement = "unverified"
    var bindingDigest: String, deadlineBindingDigest: String
    var state = VMWatchdogState.bound
    var armed = false
    var ownerExitRef: String?, reapRef: String?
    var stopUsed = 0, escalationUsed = 0
    var bindingIdentity: String { bindingDigest }
    func validate() throws {
        try validateEnvelope()
        guard VMWire.hex(bindingDigest), VMWire.hex(deadlineBindingDigest), (0...1).contains(stopUsed),
              (0...1).contains(escalationUsed) else { throw VMError.contract }
        try VMWire.refs([ownerExitRef, reapRef].compactMap { $0 })
    }
}

struct VMClockReading: Equatable { var tick: UInt64; var bootId: String; var epochId: String }
protocol VMClock: AnyObject { func read() -> VMClockReading }
enum VMCreateResponse: String, Codable { case created, uncertain }
// Records simulated effects only. Implementations in Tests never launch anything.
protocol VMEffects: AnyObject {
    func create() -> VMCreateResponse
    func requestStop()
    func escalate()
    func notifyFence() -> Bool
    func brokerOperation()
}
