import Foundation

// These are synchronous model ports, not native API wrappers. There is no real
// clock, child, process lookup, PID adoption, shell, transport or fallback here.
enum AdapterSpawnResult { case created(any AdapterChild), unavailable, denied }
enum AdapterWaitResult { case pending, interrupted, reaped(AdapterExit), noChild, failed }
enum AdapterDelivery { case accepted, denied, unavailable }
enum AdapterObservationResult { case observed(AdapterObservation), unavailable }
enum AdapterDescriptorResult: String, Codable { case closed, partial, unavailable }
protocol AdapterSpawner: AnyObject {
    func spawn(_ binding: AdapterBinding, waitOwner: AdapterWaitOwner) -> AdapterSpawnResult
}
protocol AdapterWaitPort: AnyObject { func wait(owner: AdapterWaitOwner) -> AdapterWaitResult }
protocol AdapterSignalPort: AnyObject { func signal(_ signal: AdapterSignal) -> AdapterDelivery }
protocol AdapterObservationPort: AnyObject { func observe() -> AdapterObservationResult }
protocol AdapterDescriptorPort: AnyObject { func closeDescriptors() -> AdapterDescriptorResult }
protocol AdapterChild: AdapterWaitPort, AdapterSignalPort, AdapterObservationPort, AdapterDescriptorPort {
    func deliverGo(_ go: AdapterGo) -> AdapterDelivery
}
final class UnavailableAdapterSpawner: AdapterSpawner {
    func spawn(_ binding: AdapterBinding, waitOwner: AdapterWaitOwner) -> AdapterSpawnResult { .unavailable }
}
