import Foundation

/// Object identity designates exactly one wait owner, never reconstructed from
/// an identity observation or evidence. The owning lifecycle does not export it.
final class AdapterWaitOwner {
    let ownerID: String
    let sessionID: String
    init(binding: AdapterBinding) { ownerID = binding.ownerID; sessionID = binding.sessionID }
}
/// Created only by matching a successful injected spawn result. No PID input,
/// Codable, public adoption factory, automatic retry or process-group operation.
final class AdapterOwnedChild {
    private let port: any AdapterChild
    private let waitOwner: AdapterWaitOwner
    private(set) var reaped = false
    private(set) var authorityLost = false
    private(set) var exit: AdapterExit?
    var identity: AdapterIdentity?
    init?(_ result: AdapterSpawnResult, waitOwner: AdapterWaitOwner) {
        guard case .created(let port) = result else { return nil }
        self.port = port; self.waitOwner = waitOwner
    }
    func wait() -> AdapterWaitResult { port.wait(owner: waitOwner) }
    func signal(_ signal: AdapterSignal) throws -> AdapterDelivery {
        guard !reaped, !authorityLost else { throw AdapterError.ownership }
        return port.signal(signal)
    }
    func revokeForReap(_ exit: AdapterExit) { reaped = true; self.exit = exit }
    func loseAuthority() { authorityLost = true }
    func observe() -> AdapterObservationResult { port.observe() }
    func closeDescriptors() -> AdapterDescriptorResult { port.closeDescriptors() }
    func deliverGo(_ go: AdapterGo) -> AdapterDelivery { port.deliverGo(go) }
}
