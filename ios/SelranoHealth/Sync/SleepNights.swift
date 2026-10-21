import Foundation

/// One sleep sample from Apple Health, reduced to what aggregation needs.
nonisolated struct SleepSegment: Equatable, Sendable {
    enum Stage: Sendable { case inBed, awake, asleepUnspecified, core, deep, rem }

    var start: Date
    var end: Date
    var stage: Stage
    /// Written by an Apple Watch rather than the phone or another app.
    var fromWatch: Bool

    var isAsleep: Bool { stage == .asleepUnspecified || stage == .core || stage == .deep || stage == .rem }
}

/// Sleep for one night, keyed by the local date the user woke up.
nonisolated struct SleepNight: Equatable, Sendable {
    var date: String
    var asleepMinutes: Int
    var inBedMinutes: Int
    var deepMinutes: Int
    var remMinutes: Int
    var coreMinutes: Int
    var awakeMinutes: Int
    var start: Date
    var end: Date
}

nonisolated enum SleepNights {
    /// Segments further apart than this belong to different sleep sessions.
    static let sessionGap: TimeInterval = 3 * 60 * 60

    /// Group raw samples into nights.
    ///
    /// Several sources often record the same night (the Watch, the phone, a sleep
    /// app). Where a Watch recorded a session, only its stages are counted, and
    /// overlapping intervals are merged so no minute is counted twice. Each
    /// session belongs to the local date it ended on; a nap that ends the same day
    /// adds to that date.
    static func aggregate(_ segments: [SleepSegment], calendar: Calendar) -> [SleepNight] {
        let sessions = sessionsOf(segments.filter { $0.end > $0.start })
        var byDate: [String: [[SleepSegment]]] = [:]
        for session in sessions {
            guard let last = session.map(\.end).max() else { continue }
            byDate[LocalDays.key(for: last, calendar: calendar), default: []].append(session)
        }
        return byDate.keys.sorted().compactMap { date in
            night(date: date, sessions: byDate[date] ?? [])
        }
    }

    private static func sessionsOf(_ segments: [SleepSegment]) -> [[SleepSegment]] {
        var sessions: [[SleepSegment]] = []
        var current: [SleepSegment] = []
        var currentEnd = Date.distantPast
        for segment in segments.sorted(by: { $0.start < $1.start }) {
            if !current.isEmpty && segment.start.timeIntervalSince(currentEnd) > sessionGap {
                sessions.append(current)
                current = []
            }
            current.append(segment)
            currentEnd = max(currentEnd, segment.end)
        }
        if !current.isEmpty { sessions.append(current) }
        return sessions
    }

    private static func night(date: String, sessions: [[SleepSegment]]) -> SleepNight? {
        var asleep: [DateInterval] = []
        var inBed: [DateInterval] = []
        var deep: [DateInterval] = []
        var rem: [DateInterval] = []
        var core: [DateInterval] = []
        var awake: [DateInterval] = []
        for session in sessions {
            let watchStaged = session.contains { $0.fromWatch && $0.stage != .inBed }
            for segment in session {
                let interval = DateInterval(start: segment.start, end: segment.end)
                if segment.stage == .inBed {
                    inBed.append(interval)
                    continue
                }
                if watchStaged && !segment.fromWatch { continue }
                switch segment.stage {
                case .awake: awake.append(interval)
                case .deep: deep.append(interval); asleep.append(interval)
                case .rem: rem.append(interval); asleep.append(interval)
                case .core: core.append(interval); asleep.append(interval)
                case .asleepUnspecified: asleep.append(interval)
                case .inBed: break
                }
            }
        }
        let asleepMerged = merge(asleep)
        let inBedMerged = merge(inBed + asleepMerged)
        guard let start = inBedMerged.first?.start, let end = inBedMerged.map(\.end).max() else { return nil }
        return SleepNight(
            date: date,
            asleepMinutes: minutes(asleepMerged),
            inBedMinutes: minutes(inBedMerged),
            deepMinutes: minutes(merge(deep)),
            remMinutes: minutes(merge(rem)),
            coreMinutes: minutes(merge(core)),
            awakeMinutes: minutes(subtract(merge(awake), asleepMerged)),
            start: start,
            end: end
        )
    }

    /// Union of intervals, sorted, with overlaps and touching edges joined.
    static func merge(_ intervals: [DateInterval]) -> [DateInterval] {
        var merged: [DateInterval] = []
        for interval in intervals.sorted(by: { $0.start < $1.start }) {
            if let last = merged.last, interval.start <= last.end {
                merged[merged.count - 1] = DateInterval(start: last.start, end: max(last.end, interval.end))
            } else {
                merged.append(interval)
            }
        }
        return merged
    }

    /// Parts of `intervals` not covered by `removing` (both already merged).
    static func subtract(_ intervals: [DateInterval], _ removing: [DateInterval]) -> [DateInterval] {
        var result: [DateInterval] = []
        for interval in intervals {
            var pieces = [interval]
            for cut in removing {
                pieces = pieces.flatMap { piece -> [DateInterval] in
                    guard cut.start < piece.end && cut.end > piece.start else { return [piece] }
                    var kept: [DateInterval] = []
                    if cut.start > piece.start { kept.append(DateInterval(start: piece.start, end: cut.start)) }
                    if cut.end < piece.end { kept.append(DateInterval(start: cut.end, end: piece.end)) }
                    return kept
                }
            }
            result.append(contentsOf: pieces)
        }
        return result
    }

    static func minutes(_ intervals: [DateInterval]) -> Int {
        Int((intervals.reduce(0) { $0 + $1.duration } / 60).rounded())
    }
}
