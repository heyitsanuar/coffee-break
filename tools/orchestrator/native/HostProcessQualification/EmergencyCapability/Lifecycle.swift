import Foundation

// All dependencies are trusted in-process simulation ports. No production adapter is provided.
final class CapabilityLifecycle {
    let binding: CapabilityBinding
    private let holder: CapabilityHolder
    private let creation: CapabilityCreation
    private let clock: CapabilityClock
    private let bootstrap: CapabilityBootstrap
    private let observations: CapabilityObservationPort
    private let lock = NSLock()
    private let authority = CapabilityAuthority()
    private var reconciliation = CapabilityReconciliation()
    private var lastClock: CapabilityClockReading
    private var issuedAttempt = false
    private var established = false, validated = false, goAdmitted = false
    private var controllerLost = false, guardLost = false, holderLost = false, targetGone = false
    private var request: CapabilityRequest?
    private var response: CapabilityResponse?
    private var inFlight = false, observing = false, releasing = false
    private var revokedDuringRequest = false
    private var findings: [CapabilityFinding] = []
    private var events: [CapabilityEvent] = []
    private var finalReport: CapabilityReport?

    init(binding: CapabilityBinding, holder: CapabilityHolder, creation: CapabilityCreation, clock: CapabilityClock,
         bootstrap: CapabilityBootstrap = UnavailableCapabilityBootstrap(), observations: CapabilityObservationPort = UnavailableCapabilityObservations()) throws {
        try binding.validate()
        guard holder.identity == binding.holder, creation.binding == binding else { throw CapabilityError.provenance }
        self.binding = binding; self.holder = holder; self.creation = creation; self.clock = clock
        self.bootstrap = bootstrap; self.observations = observations; self.lastClock = clock.reading
    }
    private func locked<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock(); defer { lock.unlock() }; return try body()
    }
    private func note(_ finding: CapabilityFinding) { if !findings.contains(finding) { findings.append(finding) } }
    private func event(_ event: CapabilityEvent) {
        if events.count < 96 { events.append(event) } else { note(.resourceLimit) }
    }
    private func mutable() throws { guard finalReport == nil else { throw CapabilityError.terminal } }
    private func usable() throws {
        try mutable()
        guard !findings.contains(where: { $0.fatal }) else { throw CapabilityError.inactive }
        guard events.count < 96 else { note(.resourceLimit); throw CapabilityError.resourceLimit }
    }
    @discardableResult private func sampleClock() -> Bool {
        let reading = clock.reading
        guard reading.bootID == binding.bootID, reading.bootID == lastClock.bootID,
              reading.wakeGeneration == lastClock.wakeGeneration, reading.milliseconds >= lastClock.milliseconds,
              reading.milliseconds >= binding.issuedAt else {
            note(.clockDiscontinuity); authority.invalidate(.expired); return false
        }
        lastClock = reading
        return !findings.contains(.clockDiscontinuity)
    }
    private func fresh() throws {
        guard sampleClock(), lastClock.milliseconds < binding.deadline else {
            authority.invalidate(.expired); throw CapabilityError.deadline
        }
    }
    private func audit(_ error: CapabilityError) {
        switch error {
        case .provenance: note(.provenanceRejected)
        case .custody: note(.custodyRejected)
        case .replay: note(.replayRejected)
        case .unavailable: note(.unavailable)
        default: break
        }
        event(.rejected)
    }
    func issue() throws {
        try locked {
            try usable()
            guard !issuedAttempt else { audit(.replay); throw CapabilityError.replay }
            issuedAttempt = true
            do {
                try fresh()
                try authority.establish(bootstrap: bootstrap, binding: binding, holder: holder, creation: creation)
                established = true; event(.issued)
            } catch let error as CapabilityError { audit(error); throw error }
        }
    }
    func validate() throws {
        try locked {
            try usable(); try fresh(); try authority.check(holder: holder)
            guard established, !validated else { throw CapabilityError.inactive }
            validated = true; event(.validated)
        }
    }
    func admitSimulatedGO(holder: CapabilityHolder, bindingDigest: String? = nil) throws {
        try locked {
            try usable()
            do {
                try fresh(); try authority.check(holder: holder); try scope(bindingDigest)
                guard validated, !goAdmitted else { throw CapabilityError.inactive }
                goAdmitted = true; event(.goAdmitted)
            } catch let error as CapabilityError { audit(error); throw error }
        }
    }
    private func scope(_ digest: String?) throws {
        if let digest, try digest != CapabilityWire.digest(binding) { throw CapabilityError.provenance }
    }
    func requestEmergency(holder: CapabilityHolder, bindingDigest: String? = nil) throws {
        let operation: CapabilityOperation = try locked {
            try usable()
            guard !inFlight, !releasing else { throw CapabilityError.busy }
            do {
                try fresh(); try scope(bindingDigest)
                guard goAdmitted, !holderLost, !targetGone else { throw CapabilityError.inactive }
                let operation = try authority.reserve(holder: holder)
                // Budget reservation precedes every injected call; reentrancy cannot duplicate use.
                request = CapabilityRequest(reference: try CapabilityWire.hash(CapabilityWire.encode(binding)), at: lastClock.milliseconds)
                inFlight = true; event(.requested)
                return operation
            } catch let error as CapabilityError { audit(error); throw error }
        }
        let result = operation.terminate() // External simulation code always runs outside the state lock.
        locked {
            response = result; event(.responded)
            if result != .accepted { note(.responseRejected) }
            if revokedDuringRequest { note(.revokedDuringOperation) }
            if !sampleClock() || lastClock.milliseconds >= binding.deadline { note(.expiredDuringOperation); authority.invalidate(.expired) }
            inFlight = false
        }
    }
    func revoke() throws {
        try locked {
            try mutable(); authority.invalidate(.revoked)
            if inFlight { revokedDuringRequest = true }
            event(.revoked)
        }
    }
    func loseController() throws { try locked { try mutable(); controllerLost = true; event(.controllerLost) } }
    func loseGuard() throws { try locked { try mutable(); guardLost = true; event(.guardLost) } }
    func loseHolder() throws {
        try locked {
            try mutable(); holderLost = true; authority.invalidate(.holderLost)
            if inFlight { revokedDuringRequest = true }
            event(.holderLost)
        }
    }
    func targetDisappeared() throws {
        try locked { try mutable(); targetGone = true; authority.invalidate(.targetGone); event(.targetDisappeared) }
    }
    func receiveHelper(_ bytes: Data) throws {
        try locked {
            try mutable(); note(.helperRejected); event(.rejected)
            // No helper bytes are retained or interpreted as bootstrap provenance.
            guard bytes.count <= 4_096 else { note(.resourceLimit); throw CapabilityError.resourceLimit }
            throw CapabilityError.provenance
        }
    }
    func reconcile() throws {
        try locked {
            try mutable()
            guard !observing else { throw CapabilityError.busy }
            observing = true
        }
        let batch = observations.read()
        try locked {
            defer { observing = false }
            _ = sampleClock()
            guard let batch else { note(.unavailable); event(.reconciled); return }
            do {
                for finding in try reconciliation.apply(batch, binding: binding, creation: creation, guardLost: guardLost, request: request, inFlight: inFlight) { note(finding) }
                if batch.exit != nil || reconciliation.facts.reap != nil {
                    targetGone = true; authority.invalidate(.targetGone)
                }
                event(.reconciled)
            } catch {
                note(.contradictory); event(.rejected); throw CapabilityError.contradiction
            }
        }
    }
    func releaseRight(holder: CapabilityHolder) throws {
        let operation: CapabilityOperation = try locked {
            try mutable()
            guard !inFlight, !releasing else { throw CapabilityError.busy }
            guard !holderLost else { throw CapabilityError.inactive }
            let operation = try authority.release(holder: holder)
            releasing = true; return operation
        }
        let result = operation.release()
        locked {
            _ = sampleClock(); authority.recordRelease(result); releasing = false; event(.released)
        }
    }
    private func snapshot() -> CapabilityReport {
        CapabilityReport(binding: binding, provenance: authority.provenance, established: established, validated: validated,
            goAdmitted: goAdmitted, status: authority.status, used: authority.used, request: request, response: response,
            rightReleased: authority.rightReleased, releaseResponse: authority.releaseResponse,
            controllerLost: controllerLost, guardLost: guardLost, holderLost: holderLost, targetGone: targetGone,
            facts: reconciliation.facts, findings: findings, events: events)
    }
    func report() throws -> CapabilityReport { locked { finalReport ?? snapshot() } }
    func finish() throws -> CapabilityReport {
        try locked {
            if let finalReport { return finalReport }
            guard !inFlight, !observing, !releasing else { throw CapabilityError.busy }
            let report = snapshot(); try report.validate(); finalReport = report; return report
        }
    }
}
