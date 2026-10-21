import Foundation

/// Calendar days in the user's own timezone. Health totals are grouped by local
/// day so "today" on the phone is "today" in Selrano, across daylight saving.
nonisolated enum LocalDays {
    /// The `count` most recent local days, oldest first, ending with the day containing `now`.
    static func recent(_ count: Int, now: Date, calendar: Calendar) -> [DateInterval] {
        let today = calendar.startOfDay(for: now)
        return (0..<max(count, 0)).reversed().compactMap { offset in
            guard
                let start = calendar.date(byAdding: .day, value: -offset, to: today),
                let end = calendar.date(byAdding: .day, value: 1, to: start)
            else { return nil }
            return DateInterval(start: start, end: end)
        }
    }

    /// "YYYY-MM-DD" for the local day containing `date`.
    static func key(for date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
