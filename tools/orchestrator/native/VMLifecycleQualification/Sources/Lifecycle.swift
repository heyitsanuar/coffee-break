import Foundation

struct VMRestoredView {
    let canResume = false, allowNativeLaunch = false
    var reservationHeld: Bool
    var uncertaintyDigest: String?
    var verifiedTerminalMetadata: Bool
    var historicalOutcome: VMOutcome?
}

// Serialized, deterministic aggregate, not a concurrent/native runtime. Reentrant
// fake callbacks are supported at explicit external-call boundaries; callers must
// not invoke this model concurrently from multiple threads.
final class VMLifecycle {
    let binding: VMExecutionBinding
    private let bindingDigest: String
    private let grant: VMGrant
    private let clock: VMClock
    private let effects: VMEffects
    private let registry: VMHostRegistry
    private let catalog: VMSimulationProcedureCatalog
    private(set) var owner: VMOwnerLifecycle
    private(set) var watchdog: VMWatchdogLifecycle
    private(set) var vm = VMState.notCreated
    private(set) var phase = VMAttemptPhase.prepared
    private(set) var ledger: VMResourceObligations
    private(set) var quarantine: VMQuarantineRecord?
    private(set) var brokerOpen = true
    private(set) var graceBy: UInt64
    private(set) var cleanupBy: UInt64
    private var log = VMEventLog()
    private var findings: [VMReason] = []
    private var observations: [VMFact] = []
    private var sourceSequences: [VMRole: UInt64] = [:]
    private var pending = false, readingClock = false, dispatched = false, controllerAlive = true
    private var workloadCompleted = false, cancelled = false, upstreamCancellationRequested = false
    private var brokerCalls = 0
    private var lastTick: UInt64
    private var finalReport: VMQualificationReport?
    private var finalCandidate: VMQualificationReport?
    private let finalPublication = VMPublication<VMQualificationReport>()
    private var clearedAtTick: UInt64?
    private var recoveryRequests = 0
    private var recoveryPending = false
    private var recoveryTransaction: VMRecoveryTransaction?
    private var recoveryArchive: [VMRecoveryTransaction] = []
    private(set) var recoveryObservations: [VMReconciliationEvidence] = []
    private(set) var accountingReleases = 0
    private(set) var accountingReinstatements = 0
    private(set) var postClearanceDispute: VMPostClearanceDispute?
    private let disputePublication = VMPublication<VMPostClearanceDispute>()
    private(set) var postClearanceRejections: [String] = []
    var recoveryRevision: UInt64 { quarantine?.recoveryRevision ?? 0 }
    private var hasRecoveryDispute: Bool {
        recoveryObservations.contains { ledger.entry($0.fact.claim).status == .contradictory }
    }

    init(binding: VMExecutionBinding, grant: VMGrant, clock: VMClock, effects: VMEffects,
         registry: VMHostRegistry, catalog: VMSimulationProcedureCatalog = VMSimulationProcedureCatalog()) throws {
        guard !VMBackendPolicy.productionIntegration else { throw VMError.authority }
        try binding.validate(); try grant.claim(binding); try registry.claim(binding)
        self.binding = binding; bindingDigest = try VMWire.digest(binding); self.grant = grant
        self.clock = clock; self.effects = effects; self.registry = registry; self.catalog = catalog
        owner = VMOwnerLifecycle(bindingDigest: bindingDigest)
        watchdog = VMWatchdogLifecycle(bindingDigest: bindingDigest, deadlineBindingDigest: try VMWire.digest(binding.deadlines))
        ledger = try VMResourceObligations(binding); lastTick = binding.deadlines.armedAt
        graceBy = binding.deadlines.escalationBy; cleanupBy = binding.deadlines.cleanupBy
    }
    private func live() throws { guard finalReport == nil, finalCandidate == nil else { throw VMError.terminal } }
    private func exclusive() throws { try live(); guard !pending, !readingClock else { throw VMError.busy } }
    private func event(_ code: VMEventCode, reference: String? = nil, critical: Bool = false) throws {
        do { try log.append(code, tick: lastTick, reference: reference, critical: critical) }
        catch { fail(.quota); throw VMError.quota }
    }
    private func audit(_ reason: VMReason = .rejectedEvent) {
        do { try log.append(.rejected, tick: lastTick, reference: VMWire.hash(Data(reason.rawValue.utf8))) }
        catch { fail(.quota) }
    }
    private func now() throws -> UInt64 {
        guard !readingClock else { throw VMError.busy }
        readingClock = true
        let r = clock.read() // External port; no aggregate update is in progress.
        readingClock = false
        guard r.bootId == binding.bootId, r.epochId == binding.clockEpochId,
              r.tick >= lastTick, r.tick <= VMWire.maximumInteger else {
            // Recovery failures are audited on the recovery case; they cannot
            // move an already finalized lifecycle back into settling.
            if finalReport == nil { fail(.clockDiscontinuity) }
            throw VMError.clock
        }
        lastTick = r.tick; return r.tick
    }
    private func fence() {
        guard brokerOpen else { return }
        brokerOpen = false // M6: close before notification; a failed notification cannot undo this.
        owner.controlRevoked = true
        do {
            try log.append(.fence, tick: lastTick, critical: true)
            var fact = try grant.localFact(.brokerFence, tick: lastTick, sequence: UInt64(log.events.count))
            fact.exposureReference = ledger.entry(.brokerFence).exposureReference
            try ledger.credit(fact); observations.append(fact)
        } catch { if !findings.contains(.quota) { findings.append(.quota) } }
        let alreadyPending = pending
        pending = true
        let acknowledged = effects.notifyFence() // External call after state is closed.
        pending = alreadyPending
        if !acknowledged && !findings.contains(.notificationFailed) { findings.append(.notificationFailed) }
    }
    private func openQuarantine(_ reason: VMReason) {
        guard dispatched else { return }
        ledger.reservationHeld = true
        registry.quarantine(binding.hostScopeId, caseId: binding.attemptId)
        if quarantine == nil {
            quarantine = VMQuarantineRecord(bindingDigest: bindingDigest, caseId: binding.attemptId,
                hostScopeId: binding.hostScopeId, reservationId: ledger.reservationId, resourceIds: binding.resourceIds,
                reasonCodes: [reason], openedAtTick: lastTick, obligationSetDigest: (try? VMWire.digest(ledger)) ?? bindingDigest)
            try? log.append(.quarantine, tick: lastTick, critical: true)
        } else if !quarantine!.reasonCodes.contains(reason) {
            quarantine!.reasonCodes.append(reason)
        }
    }
    private func fail(_ reason: VMReason) {
        if !findings.contains(reason) {
            findings.append(reason)
            if reason == .quota { try? log.append(.quota, tick: lastTick, critical: true) }
        }
        phase = .settling; fence(); openQuarantine(reason)
    }
    private func validExecutionTime() throws {
        let t = try now()
        if t >= binding.deadlines.executionBy { // M11: inclusive expiry
            try settle(reason: .deadline); throw VMError.deadline
        }
    }
    private func newOperation() throws {
        try live()
        guard controllerAlive, brokerOpen, quarantine == nil else { audit(); throw VMError.authority }
        try exclusive(); try validExecutionTime()
        guard controllerAlive, brokerOpen, quarantine == nil, findings.isEmpty else { audit(); throw VMError.authority }
    }
    func arm() throws {
        try newOperation()
        guard watchdog.state == .bound, !dispatched else { audit(); throw VMError.transition }
        guard lastTick < binding.deadlines.bootBy else { audit(); throw VMError.deadline }
        try event(.armed); watchdog.state = .armed; watchdog.armed = true
    }
    func create() throws {
        try newOperation()
        guard watchdog.state == .armed, owner.state == .bound, !dispatched else { audit(); throw VMError.transition }
        guard lastTick < binding.deadlines.bootBy else { audit(); throw VMError.deadline }
        try event(.createIntent)
        let reference = try VMWire.digest(log.events.last!)
        try grant.register(VMObligation.allCases.filter { $0 != .brokerFence && $0 != .upstream }, reference: reference, tick: lastTick)
        try ledger.dispatched(at: lastTick, reference: reference)
        dispatched = true; pending = true; owner.state = .starting; vm = .unknown
        let result = effects.create()
        pending = false
        try event(.createReturned, reference: VMWire.hash(Data(result.rawValue.utf8)))
        // Preserve the fact of dispatch/response before any fallible clock read.
        guard result == .created else { fail(.creationUncertain); throw VMError.unavailable }
        try validExecutionTime()
        guard lastTick < binding.deadlines.bootBy else { fail(.deadline); throw VMError.deadline }
        guard controllerAlive, brokerOpen, quarantine == nil, owner.state == .starting,
              watchdog.state == .armed else {
            fail(.staleResult); throw VMError.authority
        }
        owner.creationRef = bindingDigest; vm = .allocated; watchdog.state = .monitoring
    }
    func go() throws {
        try newOperation()
        guard lastTick < binding.deadlines.bootBy else { try settle(reason: .deadline); throw VMError.deadline }
        guard vm == .allocated, owner.state == .starting, !owner.goConsumed, watchdog.state == .monitoring
        else { audit(); throw VMError.transition }
        try event(.go); owner.goConsumed = true; owner.state = .running; vm = .running; phase = .active
    }
    func brokerOperation() throws {
        try newOperation()
        guard phase == .active, vm == .running else { audit(); throw VMError.transition }
        do { try ledger.requireUnexposed(.upstream) } catch { audit(); throw error }
        try event(.brokerOperation)
        let reference = try VMWire.digest(log.events.last!)
        try grant.register([.upstream], reference: reference, tick: lastTick)
        try ledger.exposeUpstream(at: lastTick, reference: reference)
        brokerCalls += 1; pending = true
        effects.brokerOperation()
        pending = false
        try validExecutionTime()
        guard controllerAlive, brokerOpen, quarantine == nil else { audit(.staleResult); throw VMError.authority }
    }
    private func noUpstreamExposure() throws {
        guard brokerCalls == 0, ledger.entry(.upstream).status == .outstanding else { return }
        let fact = try grant.localFact(.upstream, tick: lastTick, sequence: UInt64(log.events.count))
        try ledger.credit(fact); observations.append(fact)
    }
    private func settle(reason: VMReason? = nil) throws {
        if let reason, !findings.contains(reason) { findings.append(reason) }
        phase = .settling; fence()
        guard !pending else { openQuarantine(.staleResult); return }
        try noUpstreamExposure()
        let early = min(lastTick, binding.deadlines.executionBy)
        graceBy = min(graceBy, try VMWire.add(early, 10_000))
        cleanupBy = min(cleanupBy, try VMWire.add(graceBy, 30_000))
        if dispatched && watchdog.stopUsed == 0 && owner.state != .lost && owner.state != .blocked && owner.state != .exitObserved {
            watchdog.stopUsed = 1
            try event(.stopRequested, critical: true)
            owner.stopRequestRef = try VMWire.digest(log.events.last!)
            owner.state = .stopRequested
            if vm != .unknown { vm = .stopRequested }
            if watchdog.state != .lost { watchdog.state = .enforcing }
            pending = true; effects.requestStop(); pending = false
            _ = try now()
        }
    }
    func completeWorkload() throws {
        try exclusive(); try validExecutionTime()
        guard phase == .active, controllerAlive, brokerOpen, quarantine == nil else { audit(); throw VMError.authority }
        workloadCompleted = true; try settle()
    }
    func cancel() throws {
        try exclusive(); _ = try now(); cancelled = true; upstreamCancellationRequested = brokerCalls > 0
        try settle()
    }
    func lose(_ role: VMRole) throws {
        try live()
        // Loss/revocation may run reentrantly while an injected operation is pending.
        switch role {
        case .controller:
            guard controllerAlive else { audit(); return }; controllerAlive = false
            try event(.controllerLost, critical: true)
            try settle(reason: .controllerLost) // M5: never renew immutable deadlines
        case .owner:
            guard owner.state != .lost else { audit(); return }
            owner.state = .lost; vm = .unknown; try event(.ownerLost, critical: true); fail(.ownerLost)
        case .watchdog:
            guard watchdog.state != .lost else { audit(); return }
            watchdog.state = .lost; try event(.watchdogLost, critical: true); fail(.watchdogLost)
        default: audit(); throw VMError.transition
        }
    }
    func ownerBlocked() throws {
        try live()
        guard owner.state != .exitObserved, owner.state != .lost else { audit(); throw VMError.transition }
        owner.state = .blocked; try event(.blocked, critical: true); fail(.ownerBlocked)
    }
    func poll() throws {
        try exclusive(); let t = try now()
        if t >= binding.deadlines.executionBy || (!owner.goConsumed && t >= binding.deadlines.bootBy) {
            try settle(reason: .deadline)
        }
        if phase == .settling, dispatched, t >= graceBy, watchdog.escalationUsed == 0, watchdog.state != .lost, owner.exitRef == nil {
            watchdog.escalationUsed = 1; try event(.escalationRequested, critical: true)
            pending = true; effects.escalate(); pending = false
            _ = try now()
        }
        if lastTick >= cleanupBy && !ledger.complete { fail(.incompleteCleanup) }
    }
    func observe(_ proof: VMQualifiedObservation) throws {
        try live()
        do { try grant.authenticate(proof, recovery: false) } catch { audit(); throw error }
        let fact = proof.fact
        // Reject premature or stale teardown before recording/crediting it. A
        // pre-minted proof cannot acquire a later exposure, even at the same tick.
        do { try ledger.validateCredit(fact) } catch { audit(); throw error }
        if let previous = observations.first(where: { $0.id == fact.id }) {
            guard previous == fact else {
                if !observations.contains(fact) {
                    guard observations.count < 30 else { fail(.quota); throw VMError.quota }
                    try event(.observation, reference: VMWire.digest(fact))
                    observations.append(fact)
                    try? ledger.credit(fact)
                    let index = ledger.entries.firstIndex { $0.claim == fact.claim }!
                    ledger.entries[index].status = .contradictory
                }
                fail(.contradiction); throw VMError.contradiction
            }
            return
        }
        let t = try now()
        guard fact.tick <= t, fact.tick < cleanupBy else { audit(); throw VMError.evidence }
        guard observations.count < 30 else { fail(.quota); throw VMError.quota } // reserve two local facts
        if let previous = sourceSequences[fact.source], fact.sequence <= previous { audit(); throw VMError.stale }
        guard quarantine == nil else { audit(); throw VMError.quarantined }
        guard fact.claim != .ownerReap || watchdog.state != .lost else { audit(); throw VMError.authority }
        guard fact.claim != .vmStop || owner.stopRequestRef != nil else { audit(); throw VMError.transition }
        if t >= cleanupBy { fail(.incompleteCleanup); throw VMError.deadline }
        try event(.observation, reference: VMWire.digest(fact))
        observations.append(fact); sourceSequences[fact.source] = fact.sequence
        do { try ledger.credit(fact) } catch { fail(.contradiction); throw error }
        if fact.value == .satisfied {
            let ref = try VMWire.digest(fact)
            switch fact.claim {
            case .ownerExit: owner.exitRef = ref; watchdog.ownerExitRef = ref; owner.state = .exitObserved
                if watchdog.state != .lost && watchdog.reapRef == nil { watchdog.state = .exitObserved }
                if phase == .active || phase == .prepared { vm = .unknown; fail(.ownerLost) }
            case .ownerReap: watchdog.reapRef = ref; watchdog.state = .reaped
            case .vmStop: owner.stopCallbackRef = ref; vm = .stoppedObserved
                if owner.state != .exitObserved { owner.state = .stopObserved }
            default: break // M1/M9: no observation implicitly satisfies any other obligation.
            }
        }
    }
    func finish(interruption: VMPublicationPoint? = nil) throws -> VMQualificationReport {
        if let finalReport { return finalReport }
        if finalCandidate != nil { return try commitFinalProjection() }
        try exclusive()
        do { try poll() } catch VMError.clock { /* preserve a fail-closed report at the last trusted tick */ }
        fence()
        if dispatched { try noUpstreamExposure() }
        let outcome: VMOutcome
        var committedLedger = ledger
        if quarantine != nil { outcome = .unresolved }
        else if !dispatched { outcome = .blocked }
        else if ledger.complete {
            outcome = workloadCompleted && findings.isEmpty ? .completed : cancelled ? .cancelled : .failed
            try committedLedger.advance(); committedLedger.reservationHeld = false
        } else { throw VMError.transition }
        if outcome == .unresolved { ledger.reservationHeld = true }
        try event(.finalized, critical: true)
        let report = VMQualificationReport(binding: binding, owner: owner, watchdog: watchdog, vm: vm, outcome: outcome,
            verdict: outcome == .completed ? .pass : outcome == .unresolved ? .unverified : .fail,
            workloadCompleted: workloadCompleted, controllerLost: !controllerAlive, brokerOpen: brokerOpen,
            upstreamCancellationRequested: upstreamCancellationRequested, ledger: committedLedger, quarantine: quarantine,
            observations: observations, findings: findings, events: log.events, finalizedAtTick: lastTick)
        try report.validate(); _ = try VMWire.document(report)
        try finalPublication.stage(report); finalCandidate = report
        try finalPublication.commit(interruption: interruption)
        return try commitFinalProjection()
    }
    private func commitFinalProjection() throws -> VMQualificationReport {
        let report = try finalPublication.verified()
        ledger = report.ledger; finalReport = report; phase = .finalized
        return report
    }
    func requestReplacement() throws {
        if quarantine?.state == .active { throw VMError.quarantined } // M3
        throw VMError.authority
    }
    func requestReuse() throws {
        if quarantine?.state == .active { throw VMError.quarantined }
        throw VMError.authority
    }
    func operatorNote(_ digest: String) throws {
        guard finalReport != nil, quarantine?.state == .active, VMWire.hex(digest), quarantine!.noteRefs.count < 8 else { throw VMError.authority }
        if !quarantine!.noteRefs.contains(digest) { quarantine!.noteRefs.append(digest) }
        quarantine!.recoveryRevision = try VMWire.add(recoveryRevision, 1)
    }
    private func recoveryQuota() throws {
        ledger.reservationHeld = true
        if !quarantine!.reasonCodes.contains(.quota) {
            quarantine!.reasonCodes.append(.quota)
            quarantine!.recoveryRevision = try VMWire.add(recoveryRevision, 1)
        }
    }
    private func auditRecoveryRejection(_ error: Error, proofs: [VMQualifiedObservation]) throws {
        if quarantine?.state == .cleared {
            // Never append to a historical cleared case. Bounded separate audit.
            if postClearanceRejections.count < 8 {
                let references = try proofs.map { try VMWire.digest($0.fact) }.joined(separator: ":")
                postClearanceRejections.append(VMWire.hash(Data("rejected-after-clearance:\(error):\(references)".utf8)))
            }
            return
        }
        guard quarantine!.rejectionRefs.count < 8 else { try recoveryQuota(); return }
        let references = try proofs.map { try VMWire.digest($0.fact) }.joined(separator: ":")
        quarantine!.rejectionRefs.append(VMWire.hash(Data("rejected:\(recoveryRevision):\(error):\(references)".utf8)))
        quarantine!.recoveryRevision = try VMWire.add(recoveryRevision, 1)
    }
    private func reopenDispute(_ fact: VMFact, interruption: VMPublicationPoint?) throws {
        guard let clearedCase = quarantine, clearedCase.state == .cleared,
              let transaction = recoveryArchive.last, transaction.applied else { throw VMError.incomplete }
        let clearance = try transaction.publication.verified()
        guard clearance.disposition == .clearedSimulation, ledger == clearance.resultingLedger else { throw VMError.stale }
        let releasedAt = recoveryArchive.filter(\.applied).flatMap { $0.decision.evidence }
            .filter { $0.fact.claim == fact.claim }.map { $0.fact.tick }.max() ?? finalReport!.finalizedAtTick
        guard let clearedAtTick, fact.tick >= max(releasedAt, clearedAtTick) else { throw VMError.stale }
        let caseId = try VMPostClearanceDispute.caseId(clearedCase, fact: fact)
        let evidence = VMReconciliationEvidence(binding: binding, caseId: caseId, procedureVersion: "cleanup-simulation/1", fact: fact)
        try evidence.validate()
        var candidate = ledger, quota = false
        do { try candidate.dispute(fact) } catch VMError.quota { quota = true }
        let next = VMQuarantineRecord(bindingDigest: bindingDigest, caseId: caseId,
            hostScopeId: binding.hostScopeId, reservationId: ledger.reservationId, resourceIds: binding.resourceIds,
            reasonCodes: quota ? [.contradiction, .quota] : [.contradiction], openedAtTick: lastTick,
            obligationSetDigest: try VMWire.digest(candidate), recoveryRevision: try VMWire.add(clearedCase.recoveryRevision, 1))
        let dispute = VMPostClearanceDispute(originalReportDigest: try VMWire.digest(finalReport!), clearedAtTick: clearedAtTick, clearedCase: clearedCase,
            clearance: clearance, evidence: evidence, resultingLedger: candidate, quarantine: next)
        // Safety projection precedes any fallible publication. Receipt loss never
        // removes the live hold. Exactly one linked record reinstates accounting.
        registry.quarantine(binding.hostScopeId, caseId: caseId) // R1: restore the new case's admission hold.
        ledger = candidate; quarantine = next; accountingReinstatements += 1
        postClearanceDispute = dispute; recoveryObservations.append(evidence)
        try disputePublication.stage(dispute)
        try disputePublication.commit(interruption: interruption)
        if quota { throw VMError.quota }
    }
    func disputeArtifacts() throws -> (bytes: Data, receipt: Data) { try disputePublication.exported() }
    func recoveryArtifacts() throws -> (bytes: Data, receipt: Data) {
        guard let transaction = recoveryArchive.last else { throw VMError.incomplete }
        return try transaction.publication.exported()
    }
    private func retainRecoveryContradiction(_ proof: VMQualifiedObservation, interruption: VMPublicationPoint?) throws {
        try grant.authenticate(proof, recovery: true)
        let fact = proof.fact, t = try now()
        guard fact.value == .retained else { throw VMError.evidence }
        guard fact.tick >= finalReport!.finalizedAtTick, fact.tick <= t else { throw VMError.stale }
        try ledger.validateCredit(fact)
        if recoveryObservations.contains(where: { $0.fact == fact }) { return }
        if quarantine?.state == .cleared { // R1: safety ingestion survives historical clearance.
            try reopenDispute(fact, interruption: interruption)
            return
        }
        let record = VMReconciliationEvidence(binding: binding, caseId: quarantine!.caseId,
            procedureVersion: "cleanup-simulation/1", fact: fact)
        try record.validate()
        if recoveryObservations.contains(record) { return }
        guard recoveryObservations.count < 32 else { try recoveryQuota(); throw VMError.quota }
        // Preserve the qualified fact before evaluating clearance authorization.
        // A stale/consumed permission cannot make a real contradiction disappear.
        recoveryObservations.append(record)
        do { try ledger.dispute(fact) } catch {
            quarantine!.obligationSetDigest = try VMWire.digest(ledger)
            try recoveryQuota(); throw error
        }
        if hasRecoveryDispute && !quarantine!.reasonCodes.contains(.contradiction) { quarantine!.reasonCodes.append(.contradiction) }
        quarantine!.obligationSetDigest = try VMWire.digest(ledger)
        quarantine!.recoveryRevision = try VMWire.add(recoveryRevision, 1)
    }
    func reconcile(proofs: [VMQualifiedObservation], permission: VMReconciliationPermission,
                   interruption: VMPublicationPoint? = nil, beforeReceipt: (() throws -> Void)? = nil) throws -> VMRecoveryDecision {
        guard let original = finalReport, original.outcome == .unresolved, quarantine != nil else { throw VMError.transition }
        guard proofs.count <= 12 else {
            if quarantine?.state == .active { try recoveryQuota() }
            throw VMError.quota
        }
        // Safety observations remain admissible during an in-flight publication
        // or after acknowledgement loss. They invalidate its exact revision.
        var retained = false
        var rejected: Error?
        for proof in proofs where proof.fact.value == .retained {
            do { try retainRecoveryContradiction(proof, interruption: interruption); retained = true }
            catch { try auditRecoveryRejection(error, proofs: [proof]); if rejected == nil { rejected = error } }
        }
        if retained { throw hasRecoveryDispute ? VMError.contradiction : VMError.evidence }
        if let rejected { throw rejected }
        guard quarantine?.state == .active else { throw VMError.transition }
        guard !hasRecoveryDispute else { throw VMError.contradiction }
        guard !quarantine!.reasonCodes.contains(.quota) else { throw VMError.quota }
        guard !recoveryPending, recoveryTransaction == nil else { throw VMError.busy }
        guard recoveryRequests < 8 else { throw VMError.quota }
        recoveryRequests += 1; recoveryPending = true
        defer { recoveryPending = false }
        do {
            let revision = recoveryRevision, ledgerDigest = try VMWire.digest(ledger)
            try permission.consume(catalog: catalog, binding: bindingDigest, caseId: quarantine!.caseId, ledger: ledgerDigest, revision: revision)
            let t = try now()
            guard !proofs.isEmpty, proofs.count <= 12, Set(proofs.map { $0.fact.claim }).count == proofs.count,
                  Set(proofs.map { $0.fact.id }).count == proofs.count else { throw VMError.evidence }
            var candidate = ledger
            var records: [VMReconciliationEvidence] = []
            for proof in proofs {
                try grant.authenticate(proof, recovery: true)
                let fact = proof.fact
                let history = observations + recoveryArchive.filter(\.applied).flatMap { $0.decision.evidence.map(\.fact) } + recoveryObservations.map(\.fact)
                guard !history.contains(where: { $0.id == fact.id }) else { throw VMError.replay }
                guard fact.value == .satisfied, fact.tick >= original.finalizedAtTick, fact.tick <= t,
                      candidate.entry(fact.claim).status == .outstanding else { throw VMError.evidence }
                let record = VMReconciliationEvidence(binding: binding, caseId: quarantine!.caseId,
                    procedureVersion: permission.procedureVersion, fact: fact)
                try record.validate(); records.append(record); try candidate.credit(fact)
            }
            candidate.reservationHeld = !candidate.complete
            let decision = VMRecoveryDecision(bindingDigest: bindingDigest, caseId: quarantine!.caseId,
                originalReportDigest: try VMWire.digest(original), expectedRevision: revision, expectedLedgerDigest: ledgerDigest,
                procedureVersion: permission.procedureVersion, evidence: records,
                disposition: candidate.complete ? .clearedSimulation : .partial, previousLedger: ledger,
                resultingLedger: candidate, remaining: candidate.outstanding)
            let transaction = VMRecoveryTransaction(decision)
            try transaction.publication.stage(decision)
            recoveryTransaction = transaction; recoveryArchive.append(transaction)
            try transaction.publication.commit(interruption: interruption) {
                try beforeReceipt?()
                guard self.recoveryRevision == revision, try VMWire.digest(self.ledger) == ledgerDigest else { throw VMError.stale }
            }
            return try recoverReconciliation()
        } catch {
            if recoveryTransaction == nil {
                try auditRecoveryRejection(error, proofs: proofs)
            }
            throw error
        }
    }
    @discardableResult func recoverReconciliation() throws -> VMRecoveryDecision {
        guard let transaction = recoveryTransaction ?? recoveryArchive.last else { throw VMError.incomplete }
        let d = try transaction.publication.verified()
        if transaction.applied { return d }
        guard d.expectedRevision == recoveryRevision, try VMWire.digest(ledger) == d.expectedLedgerDigest,
              d.bindingDigest == bindingDigest, quarantine?.state == .active else { throw VMError.stale }
        // Receipt already committed. The following logical projection is atomic,
        // invokes no external ports and is replayed at most once.
        ledger = d.resultingLedger
        quarantine!.decisionRefs.append(try VMWire.digest(d))
        quarantine!.obligationSetDigest = try VMWire.digest(ledger)
        quarantine!.recoveryRevision = try VMWire.add(recoveryRevision, 1)
        if d.disposition == .clearedSimulation {
            quarantine!.state = .cleared; clearedAtTick = lastTick; accountingReleases += 1
        }
        transaction.applied = true; recoveryTransaction = nil
        return d
    }
    static func restore(_ bytes: Data, receipt: Data? = nil, binding: VMExecutionBinding, registry: VMHostRegistry,
                        disputeBytes: Data? = nil, disputeReceipt: Data? = nil) -> VMRestoredView {
        // Receipt-less/active/corrupt restoration never creates a healthy empty
        // run or live authority. Even valid terminal metadata cannot resume.
        registry.quarantine(binding.hostScopeId)
        if let receipt, let report = try? VMPublication<VMQualificationReport>.verify(bytes: bytes, receipt: receipt), report.binding == binding {
            if disputeBytes != nil || disputeReceipt != nil {
                guard let disputeBytes, let disputeReceipt,
                      let dispute = try? VMPublication<VMPostClearanceDispute>.verify(bytes: disputeBytes, receipt: disputeReceipt),
                      dispute.bindingIdentity == (try? VMWire.digest(binding)),
                      dispute.originalReportDigest == VMWire.hash(bytes), dispute.evidence.binding == binding else {
                    return VMRestoredView(reservationHeld: true, uncertaintyDigest: VMWire.hash(disputeBytes ?? bytes),
                        verifiedTerminalMetadata: false, historicalOutcome: report.outcome)
                }
                registry.quarantine(binding.hostScopeId, caseId: dispute.quarantine.caseId)
                return VMRestoredView(reservationHeld: true, uncertaintyDigest: VMWire.hash(disputeBytes),
                    verifiedTerminalMetadata: true, historicalOutcome: report.outcome)
            }
            return VMRestoredView(reservationHeld: report.ledger.reservationHeld,
                uncertaintyDigest: report.outcome == .unresolved ? VMWire.hash(bytes) : nil,
                verifiedTerminalMetadata: true, historicalOutcome: report.outcome)
        }
        return VMRestoredView(reservationHeld: true, uncertaintyDigest: VMWire.hash(bytes),
            verifiedTerminalMetadata: false, historicalOutcome: nil)
    }
}
