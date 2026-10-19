import Foundation

final class QualificationGuard {
    /// Only minted after this guard's spawn port returns. No PID initializer,
    /// Codable conformance, handle export or historical adoption operation.
    private final class OwnedChild {
        let port: any SpawnedQualificationChild
        let identity: ProcessObservation
        var reaped = false
        init(created port: any SpawnedQualificationChild) {
            self.port = port
            identity = port.identity
        }
    }

    private let lock = NSLock()
    private let binding: QualificationBinding
    private let clock: any QualificationClock
    private let spawner: any QualificationSpawnPort
    private let guardIdentity: ProcessObservation
    private let capability: Data
    private var child: OwnedChild?
    private var state = QualificationState.idle
    private var workload = WorkloadOutcome.notStarted
    private var cleanup = QualificationCleanup.unresolved
    private var lastTick: UInt64
    private var token: PrivateGo?
    private var cancelAt: UInt64?
    private var exit: ProcessExit?
    private var observation: HostObservation?
    private var events: [QualificationEvent] = []
    private var issues: [QualificationIssue] = []
    private var helperSequence = 0
    private var helperBytes = 0

    init(binding: QualificationBinding, clock: any QualificationClock, spawner: any QualificationSpawnPort,
         guardIdentity: ProcessObservation, capability: Data) throws {
        self.binding = try QualificationBinding.parse(Wire.encode(binding))
        guard guardIdentity.valid, guardIdentity.executableDigest == binding.guardDigest, capability.count == 32 else {
            throw QualificationError.invalidContract
        }
        self.clock = clock; self.spawner = spawner; self.guardIdentity = guardIdentity
        self.capability = capability; lastTick = clock.milliseconds
    }

    private func serialized<T>(_ operation: () throws -> T) throws -> T {
        guard lock.try() else { throw QualificationError.busy }
        defer { lock.unlock() }
        return try operation()
    }
    private func issue(_ value: QualificationIssue) {
        if !issues.contains(value) { issues.append(value) }
    }
    private func unresolved(_ value: QualificationIssue) {
        issue(value); state = .unresolved
        if workload == .completed || workload == .notStarted { workload = .failed }
    }
    private func now() throws -> UInt64 {
        let tick = clock.milliseconds
        guard tick >= lastTick else { unresolved(.clock); throw QualificationError.deadline }
        lastTick = tick; return tick
    }
    private func add(_ instant: UInt64, _ duration: UInt64) throws -> UInt64 {
        let (value, overflow) = instant.addingReportingOverflow(duration)
        guard !overflow else { unresolved(.clock); throw QualificationError.deadline }
        return value
    }
    private func record(_ kind: QualificationEventKind, source: QualificationEventSource = .host, digest: String? = nil) {
        let event = QualificationEvent(sequence: events.count + 1, milliseconds: lastTick, source: source, kind: kind, digest: digest)
        guard events.count < QualificationLimits.eventCount,
              let bytes = try? Wire.encode(events + [event]), bytes.count <= QualificationLimits.eventBytes else {
            unresolved(.eventLimit); return
        }
        events.append(event)
    }
    private func matches(_ value: QualificationBinding) throws {
        guard value == binding else { record(.rejected); throw QualificationError.ownership }
    }

    func arm() throws -> PrivateGo {
        try serialized {
            guard state == .idle else { throw QualificationError.replay }
            let tick = try now()
            // Validate all absolute deadlines before creating any modeled child.
            let deadline = try add(tick, QualificationLimits.guardMilliseconds)
            _ = try add(tick, QualificationLimits.caseMilliseconds)
            let go = PrivateGo(binding: binding, armedAt: tick, deadline: deadline, capability: capability)
            token = go; state = .armed; record(.armed); return go
        }
    }
    func prepareChild() throws {
        try serialized {
            guard state == .armed, child == nil, let token else { throw QualificationError.invalidTransition }
            guard try now() < token.deadline else { throw QualificationError.deadline }
            let created: any SpawnedQualificationChild
            do { created = try spawner.spawn(binding) }
            catch QualificationError.executionDisabled {
                state = .blocked; issue(.executionDisabled); throw QualificationError.executionDisabled
            } catch { unresolved(.spawnFailure); throw QualificationError.ownership }
            let owned = OwnedChild(created: created)
            child = owned
            guard owned.identity.valid, owned.identity.parentPID == guardIdentity.pid,
                  owned.identity.uid == guardIdentity.uid, owned.identity.executableDigest == binding.helperDigest,
                  owned.identity.pid != guardIdentity.pid else {
                unresolved(.ownership); throw QualificationError.ownership
            }
            state = .prepared; record(.spawned)
        }
    }
    func go(_ frame: PrivateGo) throws {
        try serialized {
            guard let token, frame == token else { record(.rejected); throw QualificationError.ownership }
            guard state != .running else { throw QualificationError.replay }
            guard state == .prepared, let child, !child.reaped else { throw QualificationError.invalidTransition }
            guard try now() < token.deadline else { throw QualificationError.deadline }
            do { try child.port.sendGo(frame) }
            catch { unresolved(.transportFailure); throw QualificationError.ownership }
            state = .running; workload = .notStarted; record(.go)
        }
    }
    private func send(_ signal: QualificationSignal) throws {
        guard let child, !child.reaped else { throw QualificationError.invalidTransition }
        record(signal == .term ? .termRequested : .killRequested)
        do {
            guard try child.port.signal(signal) == .accepted else { throw QualificationError.signalFailure }
            record(signal == .term ? .term : .kill)
        } catch {
            record(.signalDenied); unresolved(.signalFailure); throw QualificationError.signalFailure
        }
    }
    private func cancel(at tick: UInt64, outcome: WorkloadOutcome) throws {
        guard [.prepared, .running].contains(state) else { throw QualificationError.invalidTransition }
        cancelAt = tick
        workload = token.map { tick >= $0.deadline } == true ? .timedOut : outcome
        state = .terminating
        try send(.term)
    }
    func cancel(_ value: QualificationBinding) throws {
        try serialized { try matches(value); try cancel(at: now(), outcome: .cancelled) }
    }
    func controllerLost(_ value: QualificationBinding) throws {
        try serialized { try matches(value); try cancel(at: now(), outcome: .cancelled) }
    }

    func poll() throws {
        try serialized {
            guard ![.unresolved, .blocked, .reaped, .idle].contains(state) else { return }
            let tick = try now()
            guard let token else { throw QualificationError.invalidTransition }
            if tick >= token.deadline, [.prepared, .running].contains(state) { workload = .timedOut }
            if let child, !child.reaped {
                let result: WaitObservation
                do { result = try child.port.wait() }
                catch { unresolved(.waitFailure); return }
                switch result {
                case .noChild: unresolved(.unexpectedECHILD); return
                case .failed: unresolved(.waitFailure); return
                case .reaped(let value):
                    // Invalidate signal authority immediately, even if later observations disagree.
                    child.reaped = true; exit = value; record(.reaped)
                    do { observation = try child.port.observe() }
                    catch { unresolved(.incompleteCleanup); return }
                    guard let observation, observation.identity == child.identity, observation.exit == value else {
                        unresolved(.contradictoryExit); return
                    }
                    guard observation.descendantCount == 0 else { unresolved(.unexpectedDescendant); return }
                    guard observation.descriptorsClosed, observation.resourcesReleased else {
                        cleanup = .partial; unresolved(.incompleteCleanup); return
                    }
                    // Cleanup can be verified yet too late to qualify. Use the
                    // trusted clock after wait/observe, never a helper timestamp.
                    let completionTick = try now()
                    if completionTick >= token.deadline, [.prepared, .running].contains(state) {
                        workload = .timedOut
                    }
                    if completionTick >= (try add(token.armedAt, QualificationLimits.caseMilliseconds)) {
                        issue(.caseLimit)
                    }
                    if let cancelAt, completionTick >= (try add(cancelAt, QualificationLimits.graceMilliseconds + QualificationLimits.cleanupMilliseconds)) {
                        issue(.incompleteCleanup)
                    }
                    cleanup = .verifiedFixture
                    if workload == .notStarted {
                        workload = state == .running && value == .exited(0) ? .completed : .failed
                    }
                    state = .reaped; return
                case .pending: break
                }
            }
            if tick >= (try add(token.armedAt, QualificationLimits.caseMilliseconds)) {
                unresolved(.caseLimit); return
            }
            if [.prepared, .running].contains(state), tick >= token.deadline {
                try cancel(at: tick, outcome: .timedOut)
            }
            if state == .armed, tick >= token.deadline { issue(.deadline); state = .blocked }
            if let cancelAt {
                let teardown = try add(cancelAt, QualificationLimits.graceMilliseconds + QualificationLimits.cleanupMilliseconds)
                if tick >= teardown { unresolved(.incompleteCleanup); return }
                if state == .terminating, tick >= (try add(cancelAt, QualificationLimits.graceMilliseconds)) {
                    state = .killing; try send(.kill)
                }
            }
        }
    }

    func receiveHelper(_ bytes: Data) throws {
        try serialized {
            guard state == .running else { throw QualificationError.invalidTransition }
            let frame: HelperFrame
            do { frame = try HelperFrame.parse(bytes) }
            catch { issue(.malformedHelper); record(.rejected); throw QualificationError.invalidContract }
            guard frame.runID == binding.runID, frame.bindingDigest == (try Wire.digest(binding)) else {
                issue(.malformedHelper); throw QualificationError.ownership
            }
            guard frame.sequence == helperSequence + 1 else { issue(.helperReplay); throw QualificationError.replay }
            guard bytes.count <= QualificationLimits.eventBytes - helperBytes,
                  helperSequence < QualificationLimits.eventCount else {
                unresolved(.eventLimit); throw QualificationError.resourceLimit
            }
            helperBytes += bytes.count; helperSequence += 1
            record(.helper, source: .untrustedHelper, digest: Wire.sha256(bytes))
            if state == .unresolved { throw QualificationError.resourceLimit }
        }
    }

    func report() throws -> QualificationReport {
        try serialized {
            let verdict: ExperimentVerdict
            if state == .blocked { verdict = .blocked }
            else if !issues.isEmpty { verdict = .fail }
            else if state != .reaped || cleanup != .verifiedFixture { verdict = .unverified }
            else { verdict = workload == binding.expectedOutcome ? .pass : .fail }
            return QualificationReport(binding: binding, guardIdentity: guardIdentity, process: child?.identity,
                capabilityDigest: Wire.sha256(capability), armedAt: token?.armedAt, deadline: token?.deadline,
                observedAt: lastTick, state: state, verdict: verdict, workload: workload, cleanup: cleanup,
                exit: exit, observation: observation, events: events, issues: issues)
        }
    }
}
