import Foundation

struct AdapterClockReading {
    var milliseconds: UInt64
    var epoch: String
    var wakeGeneration: UInt64
}
protocol AdapterClock: AnyObject { var reading: AdapterClockReading { get } }
struct AdapterDeadlines: Codable, Equatable {
    let armedAt: UInt64
    let caseAt: UInt64
    let executionAt: UInt64
    let helperAt: UInt64
    static func add(_ time: UInt64, _ duration: UInt64) throws -> UInt64 {
        let (result, overflow) = time.addingReportingOverflow(duration)
        guard !overflow else { throw AdapterError.deadline }; return result
    }
    static func make(at time: UInt64) throws -> Self {
        try Self(armedAt: time, caseAt: add(time, AdapterLimits.caseMilliseconds),
            executionAt: add(time, AdapterLimits.executionMilliseconds), helperAt: add(time, AdapterLimits.helperMilliseconds))
    }
}
/// No live clock is provided. Epoch/wake observations are trusted injected data.
final class AdapterTimekeeper {
    private let clock: any AdapterClock
    private let epoch: String
    private let wakeGeneration: UInt64
    private(set) var last: UInt64
    private(set) var fault: AdapterIssue?
    init(clock: any AdapterClock) throws {
        let first = clock.reading
        guard AdapterWire.uuid(first.epoch) else { throw AdapterError.contract }
        self.clock = clock; epoch = first.epoch; wakeGeneration = first.wakeGeneration; last = first.milliseconds
    }
    func sample() throws -> UInt64 {
        guard fault == nil else { throw AdapterError.deadline }
        let current = clock.reading
        if current.epoch != epoch { fault = .clockDiscontinuity }
        else if current.wakeGeneration != wakeGeneration { fault = .sleepWake }
        else if current.milliseconds < last { fault = .clockRollback }
        guard fault == nil else { throw AdapterError.deadline }
        last = current.milliseconds; return last
    }
}
