import Foundation

enum QualificationHelperBehavior: String, Codable { case cooperativeExit, waitForCancellation, ignoreTerm }
enum QualificationHelperState { case awaitingGo, running, completed, cancelled, emergencyExit, failed }

/// S specification and deterministic model. No command, file, network, spawn,
/// signal or descriptor API is available here. A future IPC adapter is separate.
final class QualificationHelper {
    private let binding: QualificationBinding
    private let clock: any QualificationClock
    private let capability: Data
    private let behavior: QualificationHelperBehavior
    private let emergencyDeadline: UInt64
    private var lastTick: UInt64
    private(set) var state = QualificationHelperState.awaitingGo
    private(set) var workloadActions = 0

    init(binding: QualificationBinding, clock: any QualificationClock, capability: Data,
         behavior: QualificationHelperBehavior) throws {
        self.binding = try QualificationBinding.parse(Wire.encode(binding))
        guard capability.count == 32 else { throw QualificationError.invalidContract }
        self.clock = clock; self.capability = capability; self.behavior = behavior
        lastTick = clock.milliseconds
        let (deadline, overflow) = lastTick.addingReportingOverflow(QualificationLimits.emergencyMilliseconds)
        guard !overflow else { throw QualificationError.deadline }
        emergencyDeadline = deadline
    }
    private func now() throws -> UInt64 {
        let tick = clock.milliseconds
        guard tick >= lastTick else { state = .failed; throw QualificationError.deadline }
        lastTick = tick
        if tick >= emergencyDeadline { state = .emergencyExit }
        return tick
    }
    func go(_ frame: PrivateGo) throws {
        guard state == .awaitingGo else { throw QualificationError.replay }
        let tick = try now()
        guard state == .awaitingGo else { throw QualificationError.replay }
        let (deadline, overflow) = frame.armedAt.addingReportingOverflow(QualificationLimits.guardMilliseconds)
        guard frame.binding == binding, frame.capability == capability, !overflow, frame.deadline == deadline,
              frame.armedAt <= tick else { throw QualificationError.ownership }
        guard tick < frame.deadline else { throw QualificationError.deadline }
        state = .running
    }
    func tick() throws {
        guard [.awaitingGo, .running].contains(state) else { return }
        _ = try now()
        if state == .running, behavior == .cooperativeExit { workloadActions = 1; state = .completed }
    }
    func cancel() throws {
        guard [.awaitingGo, .running].contains(state) else { throw QualificationError.invalidTransition }
        _ = try now()
        guard state != .emergencyExit else { return }
        if behavior != .ignoreTerm { state = .cancelled }
    }
}

enum QualificationHelperEntry {
    // Gate 2A deliberately supplies no live transport, real clock or capability
    // bootstrap. Compilation is allowed; this artifact must never be executed.
    static let unavailableTransportExitCode: Int32 = 3
}
