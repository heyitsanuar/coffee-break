import Foundation

/// C can model connection loss only; it has no clock, spawn, signal or wait port.
final class QualificationController {
    private let binding: QualificationBinding
    private(set) var lost = false
    init(binding: QualificationBinding) { self.binding = binding }
    func lose(_ value: QualificationBinding) throws {
        guard value == binding else { throw QualificationError.ownership }
        guard !lost else { throw QualificationError.replay }
        lost = true
    }
}

/// One immutable run. Synchronous calls are serialized inside G; there is no
/// scheduler, automatic poll loop, retry, production command or background task.
final class QualificationHarness {
    private let guardModel: QualificationGuard
    init(binding: QualificationBinding, clock: any QualificationClock, spawner: any QualificationSpawnPort,
         guardIdentity: ProcessObservation, capability: Data) throws {
        guardModel = try QualificationGuard(binding: binding, clock: clock, spawner: spawner,
            guardIdentity: guardIdentity, capability: capability)
    }
    func arm() throws -> PrivateGo { try guardModel.arm() }
    func prepareChild() throws { try guardModel.prepareChild() }
    func go(_ frame: PrivateGo) throws { try guardModel.go(frame) }
    func cancel(_ binding: QualificationBinding) throws { try guardModel.cancel(binding) }
    func controllerLost(_ binding: QualificationBinding) throws { try guardModel.controllerLost(binding) }
    func poll() throws { try guardModel.poll() }
    func receiveHelper(_ bytes: Data) throws { try guardModel.receiveHelper(bytes) }
    func report() throws -> QualificationReport { try guardModel.report() }
    func publish(_ publication: QualificationPublication, interruption: QualificationInterruption? = nil) throws {
        try publication.stage(report())
        try publication.commit(interruption: interruption)
    }
}
