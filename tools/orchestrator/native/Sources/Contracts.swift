import Foundation
import CryptoKit

enum ScaffoldError: Error { case invalidContract, digestMismatch, invalidTransition, identityMismatch, deadline, incompleteEvidence, resourceLimit, interrupted }

/// Closed canonical JSON is deliberate: unknown/duplicate fields and alternate
/// encodings cannot disappear during Codable decoding and become accepted data.
enum Wire {
    static func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }
    static func decode<T: Codable>(_ type: T.Type, _ bytes: Data, limit: Int = 65_536) throws -> T {
        guard !bytes.isEmpty, bytes.count <= limit else { throw ScaffoldError.resourceLimit }
        let value = try JSONDecoder().decode(type, from: bytes)
        guard try encode(value) == bytes else { throw ScaffoldError.invalidContract }
        return value
    }
    static func sha256(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    static func digest<T: Encodable>(_ value: T) throws -> String { sha256(try encode(value)) }
    static func uuid(_ value: String) -> Bool { UUID(uuidString: value)?.uuidString.lowercased() == value }
    static func digestValid(_ value: String) -> Bool { value.utf8.count == 64 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) } }
}

struct DevicePolicy: Codable, Equatable {
    var allowlist = ["base-read-only", "console-bounded", "input-read-only", "scratch-bounded"]
    var ipNetworking = false
    var hostDirectorySharing = false
    var credentialForwarding = false
    var clipboard = false
    var usb = false
    var sshAgentForwarding = false
    var nestedVirtualization = false
    var hostOnlyManagement = true
    var baseReadOnly = true
    var inputReadOnly = true
}
struct ResourceLimits: Codable, Equatable {
    var maximumJobs = 1
    var maximumVMs = 1
    var cpuCount = 2
    var memoryMiB = 2048
    var scratchMiB = 2048
    var consoleBytes = 65_536
    var frameBytes = 4096
    var observationBytes = 65_536
    var observationCount = 64
    var bootMilliseconds: UInt64 = 120_000
    var executionMilliseconds: UInt64 = 900_000
    var stopGraceMilliseconds: UInt64 = 10_000
    var teardownMilliseconds: UInt64 = 30_000
}
struct SyntheticProfile: Codable, Equatable {
    var schemaVersion = 1
    var purpose = "b0.2a-1-synthetic-only"
    var jobID: String
    var ownerID: String
    var devices = DevicePolicy()
    var limits = ResourceLimits()
    var automaticRetry = false
    var runtimeFallback = false
    static func parse(_ bytes: Data, expectedDigest: String) throws -> Self {
        guard Wire.digestValid(expectedDigest), Wire.sha256(bytes) == expectedDigest else { throw ScaffoldError.digestMismatch }
        let value = try Wire.decode(Self.self, bytes)
        guard value.schemaVersion == 1, value.purpose == "b0.2a-1-synthetic-only",
              Wire.uuid(value.jobID), Wire.uuid(value.ownerID), value.devices == DevicePolicy(),
              value.limits == ResourceLimits(), !value.automaticRetry, !value.runtimeFallback else { throw ScaffoldError.invalidContract }
        return value
    }
}
struct GoToken: Codable, Equatable {
    var schemaVersion = 1
    var jobID: String
    var ownerID: String
    var requestID: String
    var profileDigest: String
    var armedAt: UInt64
    var deadline: UInt64
}

protocol SyntheticClock: AnyObject { var milliseconds: UInt64 { get } }
enum SyntheticAction: Equatable { case go, cancel, escalate }
/// This is an observation port for fake actions, not an executable/process API.
protocol SyntheticChildPort: AnyObject { func record(_ action: SyntheticAction) }
