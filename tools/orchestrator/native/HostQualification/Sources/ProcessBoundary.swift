import Foundation

// An eventual adapter must return a creation-bound object, not expose PID-based
// lookup/adoption. These synchronous ports run under the guard's operation lock.
protocol QualificationSignalPort: AnyObject {
    func signal(_ signal: QualificationSignal) throws -> SignalDelivery
}
protocol QualificationWaitPort: AnyObject { func wait() throws -> WaitObservation }
protocol QualificationObservationPort: AnyObject { func observe() throws -> HostObservation }
protocol SpawnedQualificationChild: QualificationSignalPort, QualificationWaitPort, QualificationObservationPort {
    var identity: ProcessObservation { get }
    func sendGo(_ frame: PrivateGo) throws
}
protocol QualificationSpawnPort: AnyObject {
    func spawn(_ binding: QualificationBinding) throws -> any SpawnedQualificationChild
}

/// No real-process implementation, escape hatch or permission override exists.
final class DisabledQualificationSpawner: QualificationSpawnPort {
    func spawn(_ binding: QualificationBinding) throws -> any SpawnedQualificationChild {
        throw QualificationError.executionDisabled
    }
}
