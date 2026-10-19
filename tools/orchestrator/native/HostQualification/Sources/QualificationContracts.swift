import Foundation

enum QualificationError: Error, Equatable {
    case invalidContract, invalidTransition, replay, ownership, deadline, busy
    case signalFailure, incompleteEvidence, interrupted, resourceLimit, executionDisabled
}

enum QualificationLimits {
    static let caseMilliseconds: UInt64 = 30_000
    static let guardMilliseconds: UInt64 = 8_000
    static let graceMilliseconds: UInt64 = 1_000
    static let cleanupMilliseconds: UInt64 = 3_000
    static let emergencyMilliseconds: UInt64 = 20_000
    static let frameBytes = 4096
    static let eventBytes = 65_536
    static let eventCount = 128
    static let reportBytes = 65_536
    static let maximumProcesses = 4
}

enum WorkloadOutcome: String, Codable { case completed, cancelled, timedOut, failed, notStarted }
enum ExperimentVerdict: String, Codable { case pass = "PASS", fail = "FAIL", unverified = "UNVERIFIED", blocked = "BLOCKED" }
enum QualificationCleanup: String, Codable { case verifiedFixture, partial, unresolved = "UNRESOLVED" }
enum QualificationSignal: String, Codable { case term = "TERM", kill = "KILL" }
enum ProcessExit: Codable, Equatable { case exited(Int32), signaled(QualificationSignal) }
enum WaitObservation { case pending, reaped(ProcessExit), noChild, failed }
enum SignalDelivery { case accepted, denied }
enum QualificationState: String, Codable { case idle, armed, prepared, running, terminating, killing, reaped, unresolved, blocked }
enum QualificationIssue: String, Codable {
    case clock, ownership, signalFailure, unexpectedECHILD, waitFailure, contradictoryExit
    case incompleteCleanup, unexpectedDescendant, eventLimit, malformedHelper, helperReplay
    case deadline, caseLimit, executionDisabled, spawnFailure, transportFailure
}

struct QualificationBinding: Codable, Equatable {
    var schemaVersion = 1
    var kind = "host-process-qualification-binding"
    var planVersion = "gate1/1"
    var mode = "fake-only"
    var runID: String
    var requestID: String
    var ownerID: String
    var experimentID: String
    var sourceRevision: String
    var harnessDigest: String
    var guardDigest: String
    var helperDigest: String
    var expectedOutcome: WorkloadOutcome

    static func parse(_ bytes: Data) throws -> Self {
        let value: Self
        do { value = try Wire.decode(Self.self, bytes, limit: QualificationLimits.frameBytes) }
        catch { throw QualificationError.invalidContract }
        guard value.schemaVersion == 1, value.kind == "host-process-qualification-binding",
              value.planVersion == "gate1/1", value.mode == "fake-only",
              Wire.uuid(value.runID), Wire.uuid(value.requestID), Wire.uuid(value.ownerID),
              (1...15).map({ String(format: "HP-%02d", $0) }).contains(value.experimentID),
              value.sourceRevision.count == 40, Wire.digestValid(value.sourceRevision + String(repeating: "0", count: 24)),
              [value.harnessDigest, value.guardDigest, value.helperDigest].allSatisfy(Wire.digestValid) else {
            throw QualificationError.invalidContract
        }
        return value
    }
}

struct ProcessObservation: Codable, Equatable {
    var pid: Int32
    var parentPID: Int32
    var groupID: Int32
    var uid: UInt32
    var start: UInt64
    var executableDigest: String
    var valid: Bool { pid > 1 && parentPID > 1 && groupID > 1 && Wire.digestValid(executableDigest) }
}

struct HostObservation: Codable, Equatable {
    var identity: ProcessObservation
    var exit: ProcessExit?
    var descriptorsClosed: Bool
    var resourcesReleased: Bool
    var descendantCount: Int
}

/// Private in-process control value, deliberately not Codable. Never logged.
struct PrivateGo: Equatable {
    var binding: QualificationBinding
    var armedAt: UInt64
    var deadline: UInt64
    var capability: Data
}

struct HelperFrame: Codable {
    var schemaVersion = 1
    var kind = "helper-observation"
    var runID: String
    var bindingDigest: String
    var sequence: Int
    var text: String
    static func parse(_ bytes: Data) throws -> Self {
        let frame: Self
        do { frame = try Wire.decode(Self.self, bytes, limit: QualificationLimits.frameBytes) }
        catch { throw QualificationError.invalidContract }
        guard frame.schemaVersion == 1, frame.kind == "helper-observation", Wire.uuid(frame.runID),
              Wire.digestValid(frame.bindingDigest), frame.sequence > 0, frame.text.utf8.count <= 2048 else {
            throw QualificationError.invalidContract
        }
        return frame
    }
}

enum QualificationEventSource: String, Codable { case host, untrustedHelper }
enum QualificationEventKind: String, Codable {
    case armed, spawned, go, termRequested, killRequested, term, kill, signalDenied
    case reaped, helper, rejected, incomplete
}
struct QualificationEvent: Codable {
    var sequence: Int
    var milliseconds: UInt64
    var source: QualificationEventSource
    var kind: QualificationEventKind
    var digest: String?
}

protocol QualificationClock: AnyObject { var milliseconds: UInt64 { get } }
