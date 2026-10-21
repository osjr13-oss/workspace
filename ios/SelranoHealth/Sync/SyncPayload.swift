import Foundation

/// The body of `POST /api/health/sync`. Field names match the server contract.
nonisolated struct SyncPayload: Encodable, Sendable {
    var tz: String
    var appVersion: String
    var days: [Day]
    var sleep: [Night]
    var workouts: Workouts

    struct Day: Encodable, Sendable, Equatable {
        var date: String
        var steps: Int?
        var activeKcal: Double?
        var restingHr: Double?
        var exerciseMin: Int?

        enum CodingKeys: String, CodingKey {
            case date, steps
            case activeKcal = "active_kcal"
            case restingHr = "resting_hr"
            case exerciseMin = "exercise_min"
        }

        var isEmpty: Bool { steps == nil && activeKcal == nil && restingHr == nil && exerciseMin == nil }
    }

    struct Night: Encodable, Sendable {
        var date: String
        var asleepMin: Int
        var inBedMin: Int
        var deepMin: Int
        var remMin: Int
        var coreMin: Int
        var awakeMin: Int
        var startAt: Date
        var endAt: Date

        enum CodingKeys: String, CodingKey {
            case date
            case asleepMin = "asleep_min"
            case inBedMin = "in_bed_min"
            case deepMin = "deep_min"
            case remMin = "rem_min"
            case coreMin = "core_min"
            case awakeMin = "awake_min"
            case startAt = "start_at"
            case endAt = "end_at"
        }

        init(_ night: SleepNight) {
            date = night.date
            asleepMin = night.asleepMinutes
            inBedMin = night.inBedMinutes
            deepMin = night.deepMinutes
            remMin = night.remMinutes
            coreMin = night.coreMinutes
            awakeMin = night.awakeMinutes
            startAt = night.start
            endAt = night.end
        }
    }

    struct Workout: Encodable, Sendable {
        var hkUUID: UUID
        var activityType: String
        var startAt: Date
        var endAt: Date
        var durationS: Int
        var activeKcal: Double?
        var distanceM: Double?
        var sourceName: String

        enum CodingKeys: String, CodingKey {
            case hkUUID = "hk_uuid"
            case activityType = "activity_type"
            case startAt = "start_at"
            case endAt = "end_at"
            case durationS = "duration_s"
            case activeKcal = "active_kcal"
            case distanceM = "distance_m"
            case sourceName = "source_name"
        }
    }

    struct Workouts: Encodable, Sendable {
        var upserted: [Workout]
        var deleted: [UUID]
    }

    /// Limits the server enforces; the app never sends more.
    static let maxDays = 60
    static let maxNights = 60
    static let maxWorkouts = 200
}

nonisolated extension JSONEncoder {
    static let selrano: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}
