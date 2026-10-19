import Foundation
import CryptoKit

enum CapabilityError: Error, Equatable {
    case contract, provenance, unavailable, inactive, custody, replay, deadline, busy, terminal
    case interrupted, incompleteEvidence, resourceLimit, contradiction
}

enum CapabilityWire {
    static let maximumBytes = 65_536
    static func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let bytes = try encoder.encode(value)
        guard bytes.count <= maximumBytes else { throw CapabilityError.resourceLimit }
        return bytes
    }
    // Metadata only: decoding never produces custody or usable authority.
    static func decode<T: Codable>(_ type: T.Type, from bytes: Data) throws -> T {
        guard bytes.count <= maximumBytes else { throw CapabilityError.resourceLimit }
        let value: T
        do { value = try JSONDecoder().decode(type, from: bytes) }
        catch { throw CapabilityError.contract }
        guard try encode(value) == bytes else { throw CapabilityError.contract }
        return value
    }
    static func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    static func digest<T: Encodable>(_ value: T) throws -> String { hash(try encode(value)) }
    static func hex(_ value: String, count: Int = 64) -> Bool {
        value.utf8.count == count && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    static func uuid(_ value: String) -> Bool { UUID(uuidString: value)?.uuidString.lowercased() == value }
}

struct CapabilityActor: Codable, Equatable {
    var instanceID: String
    var binaryDigest: String
    var valid: Bool { CapabilityWire.uuid(instanceID) && CapabilityWire.hex(binaryDigest) }
}
struct CapabilityTarget: Codable, Equatable {
    var instanceID: String
    var objectID: String
    var bootID: String
    var binaryDigest: String
    var valid: Bool {
        CapabilityWire.uuid(instanceID) && CapabilityWire.uuid(objectID) && CapabilityWire.uuid(bootID) && CapabilityWire.hex(binaryDigest)
    }
}
struct CapabilityBinding: Codable, Equatable {
    var version = 1
    var kind = "emergency-capability/1"
    var mode = "simulation"
    var authorization = "none"
    var allowNativeLaunch = false
    var operation = "emergency-termination-request"
    var usageBudget = 1
    var experimentID: String
    var sessionID: String
    var requestID: String
    var bootID: String
    var planDigest: String
    var sourceRevision: String
    var issuer: CapabilityActor
    var holder: CapabilityActor
    var waitOwner: CapabilityActor
    var target: CapabilityTarget
    var issuedAt: UInt64
    var deadline: UInt64
    var evidenceReferences: [String]

    func validate() throws {
        let end = issuedAt.addingReportingOverflow(8_000)
        guard version == 1, kind == "emergency-capability/1", mode == "simulation", authorization == "none",
              !allowNativeLaunch, operation == "emergency-termination-request", usageBudget == 1,
              experimentID == "HP-01", CapabilityWire.uuid(sessionID), CapabilityWire.uuid(requestID), CapabilityWire.uuid(bootID),
              CapabilityWire.hex(planDigest), CapabilityWire.hex(sourceRevision, count: 40), issuer.valid, holder.valid, waitOwner.valid,
              Set([issuer.instanceID, holder.instanceID, waitOwner.instanceID, target.instanceID]).count == 4,
              target.valid, target.bootID == bootID, !end.overflow, deadline == end.partialValue,
              (1...8).contains(evidenceReferences.count), evidenceReferences == evidenceReferences.sorted(),
              Set(evidenceReferences).count == evidenceReferences.count, evidenceReferences.allSatisfy({ CapabilityWire.hex($0) })
        else { throw CapabilityError.contract }
        guard try CapabilityWire.encode(self).count <= 4_096 else { throw CapabilityError.resourceLimit }
    }
}
struct CapabilityProvenance: Codable, Equatable {
    var origin = "trusted-bootstrap-simulation"
    var bindingDigest: String
    var issuer: CapabilityActor
    var holder: CapabilityActor
    var kernelEmitter: CapabilityTarget
    var taskObject: CapabilityTarget
    var creationTarget: CapabilityTarget
    func matches(_ binding: CapabilityBinding) throws -> Bool {
        try origin == "trusted-bootstrap-simulation" && bindingDigest == CapabilityWire.digest(binding) && issuer == binding.issuer &&
            holder == binding.holder && kernelEmitter == binding.target && taskObject == binding.target && creationTarget == binding.target
    }
}
struct CapabilityClockReading: Equatable {
    var milliseconds: UInt64
    var bootID: String
    var wakeGeneration: UInt64
}
protocol CapabilityClock: AnyObject { var reading: CapabilityClockReading { get } }
enum CapabilityResponse: String, Codable { case accepted, denied, unavailable, targetAlreadyExited, contradictory }
enum CapabilityRelease: String, Codable { case released, partial, unavailable }
enum CapabilityStatus: String, Codable { case unissued, active, spent, revoked, expired, holderLost, targetGone, released }
enum CapabilityVerdict: String, Codable { case pass = "PASS", fail = "FAIL", unverified = "UNVERIFIED", blocked = "BLOCKED" }
enum CapabilityCleanup: String, Codable { case verifiedSimulation, partial, unresolved }
enum CapabilityEmergency: String, Codable { case notRequested, responseObserved, corroboratedSimulation, unverified }
enum CapabilityFinding: String, Codable, CaseIterable {
    case provenanceRejected, custodyRejected, replayRejected, helperRejected, unavailable, clockDiscontinuity, resourceLimit
    case revokedDuringOperation, expiredDuringOperation, contradictory, responseRejected, unexpectedExit, ambiguousRace, unaccreditedReap
    var fatal: Bool {
        switch self {
        case .provenanceRejected, .clockDiscontinuity, .resourceLimit, .revokedDuringOperation, .expiredDuringOperation,
             .contradictory, .responseRejected, .unexpectedExit: return true
        default: return false
        }
    }
}
enum CapabilityEvent: String, Codable {
    case issued, validated, goAdmitted, requested, responded, revoked, released, reconciled, rejected
    case controllerLost, guardLost, holderLost, targetDisappeared
}
struct CapabilityRequest: Codable, Equatable {
    var reference: String
    var at: UInt64
}
