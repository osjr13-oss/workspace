import Foundation
import HealthKit

/// Everything the app reads from Apple Health. Read access only; the app never
/// writes, except the Debug-only sample data seeder.
final class HealthReader: Sendable {
    static let shared = HealthReader()

    let store = HKHealthStore()

    static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    nonisolated static let steps = HKQuantityType(.stepCount)
    nonisolated static let activeEnergy = HKQuantityType(.activeEnergyBurned)
    nonisolated static let exercise = HKQuantityType(.appleExerciseTime)
    nonisolated static let restingHeartRate = HKQuantityType(.restingHeartRate)
    nonisolated static let sleep = HKCategoryType(.sleepAnalysis)
    nonisolated static let workouts = HKObjectType.workoutType()

    nonisolated static var readTypes: Set<HKObjectType> {
        [steps, activeEnergy, exercise, restingHeartRate, sleep, workouts]
    }

    /// Shows the Health permission sheet. HealthKit never reveals whether read
    /// access was granted, so the app can only remember that it asked.
    func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: Self.readTypes)
    }

    // MARK: Daily totals

    /// Steps, active energy, exercise minutes and resting heart rate for each of
    /// the last `count` local days. Statistics queries de-duplicate overlapping
    /// iPhone and Watch samples, which summing raw samples would double count.
    func dailyTotals(lastDays count: Int, now: Date = .now, calendar: Calendar = .current) async throws -> [SyncPayload.Day] {
        let days = LocalDays.recent(count, now: now, calendar: calendar)
        guard let first = days.first, let last = days.last else { return [] }
        let range = DateInterval(start: first.start, end: last.end)

        async let steps = collect(Self.steps, .cumulativeSum, unit: .count(), range: range, calendar: calendar)
        async let energy = collect(Self.activeEnergy, .cumulativeSum, unit: .kilocalorie(), range: range, calendar: calendar)
        async let exercise = collect(Self.exercise, .cumulativeSum, unit: .minute(), range: range, calendar: calendar)
        async let resting = collect(Self.restingHeartRate, .discreteAverage, unit: .count().unitDivided(by: .minute()), range: range, calendar: calendar)
        let (stepValues, energyValues, exerciseValues, restingValues) = try await (steps, energy, exercise, resting)

        return days.map { day in
            let key = LocalDays.key(for: day.start, calendar: calendar)
            return SyncPayload.Day(
                date: key,
                steps: stepValues[key].map { Int($0.rounded()) },
                activeKcal: energyValues[key].map { ($0 * 10).rounded() / 10 },
                restingHr: restingValues[key].map { ($0 * 10).rounded() / 10 },
                exerciseMin: exerciseValues[key].map { Int($0.rounded()) }
            )
        }.filter { !$0.isEmpty }
    }

    private func collect(
        _ type: HKQuantityType,
        _ options: HKStatisticsOptions,
        unit: HKUnit,
        range: DateInterval,
        calendar: Calendar
    ) async throws -> [String: Double] {
        let predicate = HKQuery.predicateForSamples(withStart: range.start, end: range.end)
        let query = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: predicate),
            options: options,
            anchorDate: calendar.startOfDay(for: range.start),
            intervalComponents: DateComponents(day: 1)
        )
        let collection = try await query.result(for: store)
        var values: [String: Double] = [:]
        collection.enumerateStatistics(from: range.start, to: range.end) { statistics, _ in
            let quantity = options.contains(.cumulativeSum) ? statistics.sumQuantity() : statistics.averageQuantity()
            if let quantity { values[LocalDays.key(for: statistics.startDate, calendar: calendar)] = quantity.doubleValue(for: unit) }
        }
        return values
    }

    // MARK: Sleep

    /// Nights whose wake date falls in the last `count` local days.
    func sleepNights(lastDays count: Int, now: Date = .now, calendar: Calendar = .current) async throws -> [SleepNight] {
        let days = LocalDays.recent(count, now: now, calendar: calendar)
        guard let first = days.first, let last = days.last else { return [] }
        // Start a day early so a night that began before the window is complete.
        let start = calendar.date(byAdding: .day, value: -1, to: first.start) ?? first.start
        let predicate = HKQuery.predicateForSamples(withStart: start, end: last.end)
        let query = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: Self.sleep, predicate: predicate)],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        let samples = try await query.result(for: store)
        let segments = samples.compactMap { sample -> SleepSegment? in
            guard let stage = Self.stage(sample.value) else { return nil }
            let product = sample.sourceRevision.productType ?? ""
            return SleepSegment(start: sample.startDate, end: sample.endDate, stage: stage, fromWatch: product.hasPrefix("Watch"))
        }
        let firstKey = LocalDays.key(for: first.start, calendar: calendar)
        return SleepNights.aggregate(segments, calendar: calendar).filter { $0.date >= firstKey }
    }

    nonisolated static func stage(_ value: Int) -> SleepSegment.Stage? {
        switch HKCategoryValueSleepAnalysis(rawValue: value) {
        case .inBed: .inBed
        case .awake: .awake
        case .asleepUnspecified: .asleepUnspecified
        case .asleepCore: .core
        case .asleepDeep: .deep
        case .asleepREM: .rem
        default: nil
        }
    }

    // MARK: Workouts

    struct WorkoutChanges {
        var upserted: [SyncPayload.Workout]
        var deleted: [UUID]
        var anchor: HKQueryAnchor
        /// More changes are waiting beyond this batch.
        var hasMore: Bool
    }

    /// Workouts added or deleted since `anchor`. A first sync looks back 60 days.
    func workoutChanges(since anchor: HKQueryAnchor?, now: Date = .now) async throws -> WorkoutChanges {
        let lookback = Calendar.current.date(byAdding: .day, value: -60, to: now) ?? now
        let query = HKAnchoredObjectQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForSamples(withStart: lookback, end: nil))],
            anchor: anchor,
            limit: SyncPayload.maxWorkouts
        )
        let result = try await query.result(for: store)
        let upserted = result.addedSamples.map(Self.payload)
        let deleted = result.deletedObjects.map(\.uuid)
        return WorkoutChanges(
            upserted: upserted,
            deleted: Array(deleted.prefix(SyncPayload.maxWorkouts)),
            anchor: result.newAnchor,
            hasMore: result.addedSamples.count >= SyncPayload.maxWorkouts
        )
    }

    nonisolated static func payload(_ workout: HKWorkout) -> SyncPayload.Workout {
        let energy = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
        let distanceTypes: [HKQuantityTypeIdentifier] = [.distanceWalkingRunning, .distanceCycling, .distanceSwimming, .distanceWheelchair, .distanceDownhillSnowSports]
        let distance = distanceTypes.lazy
            .compactMap { workout.statistics(for: HKQuantityType($0))?.sumQuantity()?.doubleValue(for: .meter()) }
            .first
        return SyncPayload.Workout(
            hkUUID: workout.uuid,
            activityType: WorkoutNames.name(for: workout.workoutActivityType),
            startAt: workout.startDate,
            endAt: workout.endDate,
            durationS: Int(workout.duration.rounded()),
            activeKcal: energy.map { ($0 * 10).rounded() / 10 },
            distanceM: distance.map { $0.rounded() },
            sourceName: workout.sourceRevision.source.name
        )
    }
}
