import Foundation
import Testing
@testable import SelranoHealth

@Suite("Sleep nights")
struct SleepNightsTests {
    let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }()

    func at(_ text: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = calendar.timeZone
        formatter.formatOptions = [.withFullDate, .withTime, .withColonSeparatorInTime, .withDashSeparatorInDate]
        return formatter.date(from: text)!
    }

    func segment(_ start: String, _ end: String, _ stage: SleepSegment.Stage, watch: Bool = true) -> SleepSegment {
        SleepSegment(start: at(start), end: at(end), stage: stage, fromWatch: watch)
    }

    @Test func overlappingSourcesAreNotCountedTwice() {
        let nights = SleepNights.aggregate([
            segment("2026-10-20T23:00:00", "2026-10-21T07:00:00", .asleepUnspecified, watch: false),
            segment("2026-10-20T23:30:00", "2026-10-21T03:00:00", .core),
            segment("2026-10-21T03:00:00", "2026-10-21T04:00:00", .deep),
            segment("2026-10-21T04:00:00", "2026-10-21T06:30:00", .rem)
        ], calendar: calendar)
        #expect(nights.count == 1)
        let night = nights[0]
        #expect(night.date == "2026-10-21")
        // The Watch staged this night, so the phone's longer estimate is ignored.
        #expect(night.asleepMinutes == 7 * 60)
        #expect(night.coreMinutes == 210)
        #expect(night.deepMinutes == 60)
        #expect(night.remMinutes == 150)
    }

    @Test func phoneOnlyNightsStillCount() {
        let nights = SleepNights.aggregate([
            segment("2026-10-20T23:00:00", "2026-10-21T03:00:00", .asleepUnspecified, watch: false),
            segment("2026-10-21T02:00:00", "2026-10-21T06:00:00", .asleepUnspecified, watch: false)
        ], calendar: calendar)
        #expect(nights.map(\.asleepMinutes) == [7 * 60])
    }

    @Test func inBedCoversAsleepAndAwakeExcludesAsleep() {
        let nights = SleepNights.aggregate([
            segment("2026-10-20T22:30:00", "2026-10-21T07:00:00", .inBed, watch: false),
            segment("2026-10-20T23:00:00", "2026-10-21T02:00:00", .core),
            segment("2026-10-21T01:30:00", "2026-10-21T02:30:00", .awake),
            segment("2026-10-21T02:30:00", "2026-10-21T06:00:00", .core)
        ], calendar: calendar)
        let night = nights[0]
        #expect(night.inBedMinutes == 510)
        #expect(night.asleepMinutes == 390)
        #expect(night.awakeMinutes == 30)
        #expect(night.start == at("2026-10-20T22:30:00"))
        #expect(night.end == at("2026-10-21T07:00:00"))
    }

    @Test func separateNightsLandOnTheirWakeDates() {
        let nights = SleepNights.aggregate([
            segment("2026-10-19T23:00:00", "2026-10-20T06:00:00", .core),
            segment("2026-10-20T23:30:00", "2026-10-21T06:30:00", .core)
        ], calendar: calendar)
        #expect(nights.map(\.date) == ["2026-10-20", "2026-10-21"])
    }

    @Test func aNapAddsToTheSameDay() {
        let nights = SleepNights.aggregate([
            segment("2026-10-20T23:00:00", "2026-10-21T06:00:00", .core),
            segment("2026-10-21T14:00:00", "2026-10-21T14:30:00", .core)
        ], calendar: calendar)
        #expect(nights.count == 1)
        #expect(nights[0].asleepMinutes == 7 * 60 + 30)
    }

    @Test func fallBackNightIsMeasuredInRealTime() {
        // Clocks go back at 02:00 on 1 November 2026: 23:00 to 07:00 is nine real hours.
        let start = at("2026-10-31T23:00:00")
        let end = at("2026-11-01T07:00:00")
        let nights = SleepNights.aggregate([SleepSegment(start: start, end: end, stage: .core, fromWatch: true)], calendar: calendar)
        #expect(nights[0].date == "2026-11-01")
        #expect(nights[0].asleepMinutes == 9 * 60)
    }

    @Test func emptyAndInvertedSegmentsAreIgnored() {
        let nights = SleepNights.aggregate([
            segment("2026-10-21T06:00:00", "2026-10-21T05:00:00", .core)
        ], calendar: calendar)
        #expect(nights.isEmpty)
    }
}
