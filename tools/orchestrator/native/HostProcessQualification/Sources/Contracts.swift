import Foundation
import CryptoKit

enum AdapterError: Error, Equatable {
    case contract, transition, replay, ownership, observation, deadline, busy, emergency
    case unsupported, delivery, resourceLimit, interrupted, incompleteEvidence
}
enum AdapterLimits {
    static let caseMilliseconds: UInt64 = 30_000
    static let executionMilliseconds: UInt64 = 8_000
    static let graceMilliseconds: UInt64 = 1_000
    static let cleanupMilliseconds: UInt64 = 3_000
    static let helperMilliseconds: UInt64 = 20_000
    static let frameBytes = 4096, outputBytes = 65_536, eventCount = 128, reportBytes = 65_536
    static let maximumWaitCalls = 4 // Initial call plus at most three EINTR retries per child.
}
enum AdapterWire {
    static func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }
    static func decode<T: Codable>(_ type: T.Type, _ bytes: Data, limit: Int) throws -> T {
        guard !bytes.isEmpty, bytes.count <= limit else { throw AdapterError.contract }
        do {
            let value = try JSONDecoder().decode(type, from: bytes)
            guard try encode(value) == bytes else { throw AdapterError.contract }
            return value
        } catch { throw AdapterError.contract }
    }
    static func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    static func digest<T: Encodable>(_ value: T) throws -> String { hash(try encode(value)) }
    static func hex(_ text: String, count: Int = 64) -> Bool {
        text.utf8.count == count && text.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    static func uuid(_ text: String) -> Bool { UUID(uuidString: text)?.uuidString.lowercased() == text }
}
enum AdapterWorkload: String, Codable { case notStarted, completed, cancelled, timedOut, failed }
enum AdapterVerdict: String, Codable { case pass = "PASS", fail = "FAIL", unverified = "UNVERIFIED", blocked = "BLOCKED" }
enum AdapterCleanup: String, Codable { case verifiedModel, partial, unresolved = "UNRESOLVED" }
enum AdapterState: String, Codable { case bound, armed, ready, running, terminating, killing, reaped, unresolved, blocked }
enum AdapterSignal: String, Codable { case term = "TERM", kill = "KILL" }
enum AdapterExit: Codable, Equatable {
    case exited(Int32), signaled(Int32)
    var valid: Bool {
        switch self { case .exited(let code): return (0...255).contains(code)
        case .signaled(let number): return (1...64).contains(number) }
    }
}
enum AdapterIssue: String, Codable {
    case clockRollback, clockDiscontinuity, sleepWake, overflow, executionUnavailable, spawnDenied
    case observation, ownership, noChild, waitFailure, eintrLimit, signalDenied, transport
    case executionDeadline, cleanupDeadline, caseDeadline, helperDeadline, guardLost
    case emergencyUnavailable, emergencyUnqualified, emergencyDenied
    case descriptors, descendants, contradictoryExit, resources, protocolViolation, eventLimit
}
struct AdapterBinding: Codable, Equatable {
    var schemaVersion = 1
    var kind = "native-adapter-model-binding/1"
    var mode = "deterministic-fakes"
    var authorization = "none"
    var experimentID = "HP-01"
    var sessionID: String
    var requestID: String
    var ownerID: String
    var sourceRevision: String
    var guardDigest: String
    var helperDigest: String
    var expected: AdapterWorkload
    static func parse(_ bytes: Data) throws -> Self {
        let b = try AdapterWire.decode(Self.self, bytes, limit: AdapterLimits.frameBytes)
        guard b.schemaVersion == 1, b.kind == "native-adapter-model-binding/1", b.mode == "deterministic-fakes",
              b.authorization == "none", b.experimentID == "HP-01",
              [b.sessionID, b.requestID, b.ownerID].allSatisfy(AdapterWire.uuid),
              AdapterWire.hex(b.sourceRevision, count: 40), AdapterWire.hex(b.guardDigest), AdapterWire.hex(b.helperDigest),
              [.completed, .cancelled, .timedOut].contains(b.expected) else { throw AdapterError.contract }
        return b
    }
}
struct AdapterIdentity: Codable, Equatable {
    var pid: Int32
    var parentPID: Int32
    var uid: UInt32
    var start: UInt64
    var executableDigest: String
    var valid: Bool { pid > 1 && parentPID > 1 && start > 0 && AdapterWire.hex(executableDigest) }
}
struct AdapterObservation: Codable, Equatable {
    var identity: AdapterIdentity
    var exit: AdapterExit?
    var descendantCount: Int
    var resourcesReleased: Bool
}
/// In-memory capability only. Not Codable; payloads and reports cannot mint it.
struct AdapterGo: Equatable {
    var bindingDigest: String
    var deadlines: AdapterDeadlines
    var nonce: Data
}
enum AdapterFrameKind: String, Codable { case ready, observation }
struct AdapterFrame: Codable {
    var schemaVersion = 1
    var kindTag = "native-adapter-model-frame/1"
    var sessionID: String
    var bindingDigest: String
    var deadlineDigest: String
    var sequence: Int
    var kind: AdapterFrameKind
    var text: String
    static func parse(_ bytes: Data) throws -> Self {
        let f = try AdapterWire.decode(Self.self, bytes, limit: AdapterLimits.frameBytes)
        guard f.schemaVersion == 1, f.kindTag == "native-adapter-model-frame/1", AdapterWire.uuid(f.sessionID),
              AdapterWire.hex(f.bindingDigest), AdapterWire.hex(f.deadlineDigest), f.sequence > 0,
              f.text.utf8.count <= 2048 else { throw AdapterError.contract }
        return f
    }
}
enum AdapterEventKind: String, Codable {
    case bound, armed, spawned, identityObserved, ready, go, helperObservation, rejected
    case waitInterrupted, termRequested, termAccepted, killRequested, killAccepted, signalDenied
    case reaped, descriptorsClosed, incompleteCleanup, controllerLost, guardLost
    case emergencyRequested, emergencyAccepted, emergencyDenied
}
enum AdapterEventSource: String, Codable { case hostModel, untrustedHelper }
struct AdapterEvent: Codable {
    var sequence: Int
    var milliseconds: UInt64
    var kind: AdapterEventKind
    var source: AdapterEventSource
    var digest: String?
}
