import Foundation
import Testing
@testable import SelranoHealth

@Suite("Local days")
struct LocalDaysTests {
    func calendar(_ zone: String) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: zone)!
        return calendar
    }

    @Test func recentDaysEndToday() {
        let calendar = calendar("America/New_York")
        let now = calendar.date(from: DateComponents(year: 2026, month: 10, day: 21, hour: 8))!
        let days = LocalDays.recent(14, now: now, calendar: calendar)
        #expect(days.count == 14)
        #expect(LocalDays.key(for: days.first!.start, calendar: calendar) == "2026-10-08")
        #expect(LocalDays.key(for: days.last!.start, calendar: calendar) == "2026-10-21")
        #expect(days.last!.contains(now))
    }

    @Test func daylightSavingDaysHaveTheirRealLength() {
        let calendar = calendar("America/New_York")
        let now = calendar.date(from: DateComponents(year: 2026, month: 11, day: 2, hour: 12))!
        let days = LocalDays.recent(3, now: now, calendar: calendar)
        // 1 November 2026 is 25 hours long in New York.
        #expect(days.map { $0.duration / 3600 } == [24, 25, 24])

        let spring = calendar.date(from: DateComponents(year: 2026, month: 3, day: 8, hour: 12))!
        #expect(LocalDays.recent(1, now: spring, calendar: calendar)[0].duration == 23 * 3600)
    }

    @Test func keysFollowTheCalendarsTimezone() {
        let instant = ISO8601DateFormatter().date(from: "2026-10-21T02:30:00Z")!
        #expect(LocalDays.key(for: instant, calendar: calendar("UTC")) == "2026-10-21")
        #expect(LocalDays.key(for: instant, calendar: calendar("America/Los_Angeles")) == "2026-10-20")
        #expect(LocalDays.key(for: instant, calendar: calendar("Asia/Tokyo")) == "2026-10-21")
    }

    @Test func consecutiveDaysTouch() {
        let calendar = calendar("Europe/London")
        let days = LocalDays.recent(30, now: .now, calendar: calendar)
        for (previous, next) in zip(days, days.dropFirst()) {
            #expect(previous.end == next.start)
        }
    }
}
