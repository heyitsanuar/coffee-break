import Foundation

/// One model session. Every port is injected; synchronous calls must terminate.
/// The lock models serialization, not an independent native deadline or sandbox.
final class AdapterLifecycle {
    private let lock = NSLock()
    private let binding: AdapterBinding
    private let bindingDigest: String
    private let guardIdentity: AdapterIdentity
    private let time: AdapterTimekeeper
    private let spawner: any AdapterSpawner
    private let emergency: any AdapterEmergency
    private let waitOwner: AdapterWaitOwner
    private let nonce: Data
    private var child: AdapterOwnedChild?
    private var permit: AdapterGo?
    private var state = AdapterState.bound
    private var workload = AdapterWorkload.notStarted
    private var cleanup = AdapterCleanup.unresolved
    private var issues: [AdapterIssue] = []
    private var events: [AdapterEvent] = []
    private var spawnAttempted = false
    private var goUsed = false
    private var guardGone = false
    private var waitSuspended = false
    private var interruptions = 0
    private var cancelAt: UInt64?
    private var termAttempted = false
    private var killAttempted = false
    private var helperSequence = 0
    private var helperBytes = 0
    private var observation: AdapterObservation?
    private var descriptors: AdapterDescriptorResult?

    init(binding: AdapterBinding, guardIdentity: AdapterIdentity, clock: any AdapterClock,
         spawner: any AdapterSpawner = UnavailableAdapterSpawner(),
         emergency: any AdapterEmergency = UnavailableAdapterEmergency(), nonce: Data) throws {
        self.binding = try AdapterBinding.parse(AdapterWire.encode(binding))
        guard guardIdentity.valid, guardIdentity.executableDigest == binding.guardDigest, nonce.count == 32 else {
            throw AdapterError.contract
        }
        bindingDigest = try AdapterWire.digest(binding); self.guardIdentity = guardIdentity
        time = try AdapterTimekeeper(clock: clock); self.spawner = spawner; self.emergency = emergency
        waitOwner = AdapterWaitOwner(binding: binding); self.nonce = nonce
        record(.bound)
    }
    private func serialized<T>(_ action: () throws -> T) throws -> T {
        guard lock.try() else { throw AdapterError.busy }
        defer { lock.unlock() }; return try action()
    }
    private func issue(_ value: AdapterIssue) { if !issues.contains(value) { issues.append(value) } }
    private func record(_ kind: AdapterEventKind, source: AdapterEventSource = .hostModel, digest: String? = nil) {
        let next = AdapterEvent(sequence: events.count + 1, milliseconds: time.last, kind: kind, source: source, digest: digest)
        guard events.count < AdapterLimits.eventCount,
              let bytes = try? AdapterWire.encode(events + [next]), bytes.count <= AdapterLimits.outputBytes else {
            issue(.eventLimit); return
        }
        events.append(next)
    }
    private func reject(_ error: AdapterError) throws -> Never {
        // A settled snapshot remains immutable, including after invalid late calls.
        if child?.reaped != true { record(.rejected); issue(.protocolViolation) }
        throw error
    }
    private func now() throws -> UInt64 {
        do { return try time.sample() }
        catch { issue(time.fault ?? .overflow); state = .unresolved; throw AdapterError.deadline }
    }
    private func match(_ digest: String) throws {
        guard digest == bindingDigest else { try reject(.ownership) }
    }
    private func checkBudgets(_ tick: UInt64) {
        guard let deadlines = permit?.deadlines else { return }
        if tick >= deadlines.caseAt { issue(.caseDeadline) }
        if tick >= deadlines.helperAt, child != nil { issue(.helperDeadline) }
        if let cancelAt, let end = try? AdapterDeadlines.add(cancelAt, AdapterLimits.graceMilliseconds + AdapterLimits.cleanupMilliseconds), tick >= end {
            issue(.cleanupDeadline)
        }
        if tick >= deadlines.executionAt, workload == .notStarted { workload = .timedOut }
    }
    func arm() throws -> AdapterGo {
        try serialized {
            guard state == .bound else { try reject(.replay) }
            let tick = try now()
            let deadlines: AdapterDeadlines
            do { deadlines = try AdapterDeadlines.make(at: tick) }
            catch { issue(.overflow); state = .blocked; throw AdapterError.deadline }
            let go = AdapterGo(bindingDigest: bindingDigest, deadlines: deadlines, nonce: nonce)
            permit = go; state = .armed; record(.armed); return go
        }
    }
    func prepare() throws {
        try serialized {
            guard state == .armed, !spawnAttempted, let permit else { try reject(.transition) }
            guard try now() < permit.deadlines.executionAt else { issue(.executionDeadline); throw AdapterError.deadline }
            spawnAttempted = true
            let result = spawner.spawn(binding, waitOwner: waitOwner)
            if let created = AdapterOwnedChild(result, waitOwner: waitOwner) {
                // Commit ownership before clock sampling, observation or any other
                // fallible work after a successful spawn. Failures retain this child.
                child = created; record(.spawned)
                _ = try now()
                guard case .observed(let observed) = created.observe() else {
                    issue(.observation); throw AdapterError.observation
                }
                _ = try now()
                guard observed.identity.valid, observed.identity.parentPID == guardIdentity.pid,
                      observed.identity.pid != guardIdentity.pid, observed.identity.uid == guardIdentity.uid,
                      observed.identity.executableDigest == binding.helperDigest, observed.exit == nil,
                      observed.descendantCount == 0 else {
                    issue(.ownership); created.loseAuthority(); state = .unresolved; throw AdapterError.ownership
                }
                created.identity = observed.identity; record(.identityObserved)
                checkBudgets(time.last)
                guard time.last < permit.deadlines.executionAt else { issue(.executionDeadline); throw AdapterError.deadline }
            } else {
                switch result { case .denied: issue(.spawnDenied)
                default: issue(.executionUnavailable) }
                state = .blocked; throw AdapterError.unsupported
            }
        }
    }
    func receive(_ bytes: Data) throws {
        try serialized {
            guard child?.reaped != true, !guardGone else { throw AdapterError.transition }
            let frame: AdapterFrame
            do { frame = try AdapterFrame.parse(bytes) }
            catch { try reject(.contract) }
            guard let permit, frame.sessionID == binding.sessionID, frame.bindingDigest == bindingDigest,
                  frame.deadlineDigest == (try AdapterWire.digest(permit.deadlines)) else { try reject(.ownership) }
            guard frame.sequence == helperSequence + 1 else { try reject(.replay) }
            guard (frame.kind == .ready && state == .armed && child?.identity != nil && issues.isEmpty)
                    || (frame.kind == .observation && state == .running) else { try reject(.transition) }
            guard bytes.count <= AdapterLimits.outputBytes - helperBytes, helperSequence < AdapterLimits.eventCount else {
                issue(.eventLimit); throw AdapterError.resourceLimit
            }
            checkBudgets(try now())
            guard time.last < permit.deadlines.executionAt else { issue(.executionDeadline); throw AdapterError.deadline }
            helperSequence += 1; helperBytes += bytes.count
            if frame.kind == .ready { state = .ready; record(.ready) }
            else { record(.helperObservation, source: .untrustedHelper, digest: AdapterWire.hash(bytes)) }
        }
    }
    func go(_ frame: AdapterGo) throws {
        try serialized {
            guard !goUsed else { try reject(.replay) }
            guard frame == permit else { try reject(.ownership) }
            guard state == .ready, let child, !child.reaped, !child.authorityLost, issues.isEmpty else { try reject(.transition) }
            let qualification = emergency.qualify(bindingDigest: bindingDigest)
            guard qualification == .qualifiedSimulation else {
                issue(qualification == .unavailable ? .emergencyUnavailable : .emergencyUnqualified)
                state = .blocked; throw AdapterError.emergency
            }
            guard try now() < frame.deadlines.executionAt else { issue(.executionDeadline); throw AdapterError.deadline }
            goUsed = true; record(.go)
            let result = child.deliverGo(frame)
            state = .running
            let tick = try now(); checkBudgets(tick)
            guard result == .accepted else { issue(.transport); workload = .failed; throw AdapterError.delivery }
            // An adapter returning late cannot hide expiry by reporting delivery.
            if tick >= frame.deadlines.executionAt { throw AdapterError.deadline }
        }
    }
    private func send(_ signal: AdapterSignal) throws {
        guard let child, !child.reaped, !child.authorityLost else { throw AdapterError.ownership }
        if signal == .term { guard !termAttempted else { return }; termAttempted = true }
        else { guard !killAttempted else { return }; killAttempted = true }
        record(signal == .term ? .termRequested : .killRequested)
        let result = try child.signal(signal)
        if result == .accepted { record(signal == .term ? .termAccepted : .killAccepted) }
        else { record(.signalDenied); issue(.signalDenied) }
        _ = try now(); checkBudgets(time.last)
        if result != .accepted { throw AdapterError.delivery }
    }
    private func cancelAt(_ tick: UInt64) throws {
        guard let child, !child.reaped else { throw AdapterError.transition }
        guard !child.authorityLost, !guardGone else { throw AdapterError.ownership }
        if cancelAt != nil { return }
        do { _ = try AdapterDeadlines.add(tick, AdapterLimits.graceMilliseconds + AdapterLimits.cleanupMilliseconds) }
        catch { issue(.overflow); throw AdapterError.deadline }
        cancelAt = tick
        checkBudgets(tick)
        if workload == .notStarted { workload = .cancelled }
        state = .terminating; try send(.term)
    }
    func cancel(_ digest: String) throws {
        try serialized {
            try match(digest)
            guard child?.reaped != true else { throw AdapterError.transition }
            try cancelAt(now())
        }
    }
    func controllerLost(_ digest: String) throws {
        try serialized {
            try match(digest)
            guard child?.reaped != true else { throw AdapterError.transition }
            record(.controllerLost)
            if child != nil { try cancelAt(now()) }
            else { state = .blocked; issue(.protocolViolation) }
        }
    }
    func guardLost(_ digest: String) throws {
        try serialized {
            try match(digest)
            guard !guardGone, child != nil, child?.reaped != true else { throw AdapterError.transition }
            guardGone = true; child?.loseAuthority(); state = .unresolved; issue(.guardLost); record(.guardLost)
            record(.emergencyRequested)
            // Even an accepted emergency request cannot establish reap or cleanup.
            if emergency.qualify(bindingDigest: bindingDigest) == .qualifiedSimulation {
                switch emergency.requestStop(bindingDigest: bindingDigest) {
                case .accepted: record(.emergencyAccepted)
                case .denied: issue(.emergencyDenied); record(.emergencyDenied)
                case .unavailable: issue(.emergencyUnavailable); record(.emergencyDenied)
                }
            } else { issue(.emergencyUnavailable); record(.emergencyDenied) }
            _ = try now(); checkBudgets(time.last)
        }
    }
    private func finishReap(_ value: AdapterExit, child: AdapterOwnedChild) throws {
        child.revokeForReap(value); record(.reaped) // Revoke before all subsequent port calls.
        let observed = child.observe()
        descriptors = child.closeDescriptors() // Attempt closure even if observation failed.
        if descriptors == .closed { record(.descriptorsClosed) }
        else { issue(.descriptors); record(.incompleteCleanup) }
        if case .observed(let result) = observed {
            observation = result
            if child.identity != result.identity || result.exit != value || !value.valid { issue(.contradictoryExit) }
            if result.descendantCount != 0 { issue(.descendants) }
            if !result.resourcesReleased { issue(.resources) }
            if child.identity == result.identity, result.exit == value, value.valid,
               result.descendantCount == 0, result.resourcesReleased, descriptors == .closed,
               events.contains(where: { $0.kind == .reaped }) {
                cleanup = .verifiedModel
            } else { cleanup = .partial }
        } else { issue(.observation); cleanup = .unresolved }
        // Preserve F1/F2: sample after wait, observation AND descriptor closure.
        let tick = try now(); checkBudgets(tick)
        if workload == .notStarted { workload = goUsed && value == .exited(0) ? .completed : .failed }
        state = cleanup == .verifiedModel ? .reaped : .unresolved
    }
    func poll() throws {
        try serialized {
            guard child?.reaped != true, !guardGone, let permit else { return }
            checkBudgets(try now())
            if let child, !child.authorityLost, !waitSuspended {
                while true {
                    let result = child.wait()
                    // A terminal wait must revoke authority even when time is invalid.
                    if case .reaped(let exit) = result { try finishReap(exit, child: child); return }
                    // Preserve an ownership loss before another fallible clock read.
                    if case .noChild = result {
                        child.loseAuthority(); issue(.noChild); state = .unresolved
                        checkBudgets(try now()); return
                    }
                    if case .failed = result { waitSuspended = true; issue(.waitFailure) }
                    let tick = try now(); checkBudgets(tick)
                    switch result {
                    case .interrupted:
                        interruptions += 1; record(.waitInterrupted)
                        if interruptions >= AdapterLimits.maximumWaitCalls {
                            waitSuspended = true; issue(.eintrLimit); break
                        }
                        if tick < permit.deadlines.executionAt && issues.isEmpty { continue }
                    default: break
                    }
                    break
                }
            }
            guard let child else {
                if time.last >= permit.deadlines.executionAt { state = .blocked; issue(.executionDeadline) }; return
            }
            guard !child.authorityLost else { return }
            if cancelAt == nil, time.last >= permit.deadlines.executionAt { try cancelAt(time.last) }
            if let cancelAt, time.last >= (try AdapterDeadlines.add(cancelAt, AdapterLimits.graceMilliseconds)) {
                state = .killing; try send(.kill)
            }
            if !issues.isEmpty { state = .unresolved }
        }
    }
    func report() throws -> AdapterReport {
        try serialized {
            var report = AdapterReport(binding: binding, guardIdentity: guardIdentity, process: child?.identity,
                deadlines: permit?.deadlines, cancelAt: cancelAt, observedAt: time.last, state: state,
                workload: workload, cleanup: cleanup, creationRecorded: child != nil, goUsed: goUsed,
                cleanupObligation: child != nil && cleanup != .verifiedModel, exit: child?.exit,
                observation: observation, descriptors: descriptors, events: events, issues: issues)
            report.verdict = report.expectedVerdict
            return try AdapterReport.parse(AdapterWire.encode(report))
        }
    }
}
