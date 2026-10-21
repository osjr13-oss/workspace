import Foundation
import Testing
@testable import SelranoHealth

@Suite("Sync payload")
struct SyncPayloadTests {
    @Test func encodesTheServerContract() throws {
        let start = ISO8601DateFormatter().date(from: "2026-10-21T06:00:00Z")!
        let payload = SyncPayload(
            tz: "America/New_York",
            appVersion: "1.0",
            days: [.init(date: "2026-10-21", steps: 8123, activeKcal: 412.5, restingHr: nil, exerciseMin: 31)],
            sleep: [],
            workouts: .init(upserted: [
                .init(hkUUID: UUID(uuidString: "11111111-1111-4111-8111-111111111111")!, activityType: "running", startAt: start, endAt: start.addingTimeInterval(1800), durationS: 1800, activeKcal: 300, distanceM: 5000, sourceName: "Apple Watch")
            ], deleted: [UUID(uuidString: "22222222-2222-4222-8222-222222222222")!])
        )
        let json = try JSONSerialization.jsonObject(with: JSONEncoder.selrano.encode(payload)) as! [String: Any]
        #expect(json["tz"] as? String == "America/New_York")
        let day = (json["days"] as! [[String: Any]])[0]
        #expect(day["active_kcal"] as? Double == 412.5)
        #expect(day["exercise_min"] as? Int == 31)
        #expect(day["resting_hr"] == nil)
        let workouts = json["workouts"] as! [String: Any]
        let workout = (workouts["upserted"] as! [[String: Any]])[0]
        #expect(workout["hk_uuid"] as? String == "11111111-1111-4111-8111-111111111111")
        #expect(workout["start_at"] as? String == "2026-10-21T06:00:00Z")
        #expect((workouts["deleted"] as! [String]) == ["22222222-2222-4222-8222-222222222222"])
    }

    @Test func emptyDaysAreDetected() {
        #expect(SyncPayload.Day(date: "2026-10-21").isEmpty)
        #expect(!SyncPayload.Day(date: "2026-10-21", steps: 0).isEmpty)
    }
}
