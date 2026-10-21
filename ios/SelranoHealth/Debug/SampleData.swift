#if DEBUG
import Foundation
import HealthKit

/// Fills the simulator's Health store with two weeks of plausible data, so sync
/// can be exercised without a phone or Watch. Debug builds only.
enum SampleData {
    static func seed(now: Date = .now, calendar: Calendar = .current) async throws {
        let store = HealthReader.shared.store
        let quantities: Set<HKSampleType> = [HealthReader.steps, HealthReader.activeEnergy, HealthReader.exercise, HealthReader.restingHeartRate]
        try await store.requestAuthorization(toShare: quantities.union([HealthReader.sleep, HealthReader.workouts]), read: HealthReader.readTypes)

        var samples: [HKSample] = []
        for (index, day) in LocalDays.recent(14, now: now, calendar: calendar).enumerated() {
            let noon = day.start.addingTimeInterval(12 * 3600)
            let hour = TimeInterval(3600)
            let steps = Double(6000 + (index * 733) % 5000)
            samples.append(HKQuantitySample(type: HealthReader.steps, quantity: HKQuantity(unit: .count(), doubleValue: steps), start: noon, end: noon + hour))
            samples.append(HKQuantitySample(type: HealthReader.activeEnergy, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: steps / 20), start: noon, end: noon + hour))
            samples.append(HKQuantitySample(type: HealthReader.exercise, quantity: HKQuantity(unit: .minute(), doubleValue: Double(15 + index % 4 * 10)), start: noon, end: noon + 30 * 60))
            samples.append(HKQuantitySample(type: HealthReader.restingHeartRate, quantity: HKQuantity(unit: .count().unitDivided(by: .minute()), doubleValue: Double(58 + index % 5)), start: noon, end: noon))

            // Bed at 23:00 the evening before, up at 07:00, with a short awake spell.
            let bed = day.start.addingTimeInterval(-hour)
            let stages: [(HKCategoryValueSleepAnalysis, TimeInterval, TimeInterval)] = [
                (.inBed, 0, 8 * hour),
                (.asleepCore, 0.25 * hour, 3 * hour),
                (.asleepDeep, 3 * hour, 4.5 * hour),
                (.awake, 4.5 * hour, 4.75 * hour),
                (.asleepREM, 4.75 * hour, 6 * hour),
                (.asleepCore, 6 * hour, 7.75 * hour)
            ]
            for (value, from, to) in stages {
                samples.append(HKCategorySample(type: HealthReader.sleep, value: value.rawValue, start: bed + from, end: bed + to))
            }
        }
        try await store.save(samples)

        for offset in [1, 3, 6] {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: now)) else { continue }
            let start = day.addingTimeInterval(18 * 3600)
            let end = start.addingTimeInterval(40 * 60)
            let configuration = HKWorkoutConfiguration()
            configuration.activityType = offset == 3 ? .traditionalStrengthTraining : .running
            let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
            try await builder.beginCollection(at: start)
            try await builder.addSamples([
                HKQuantitySample(type: HealthReader.activeEnergy, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: 320), start: start, end: end)
            ])
            try await builder.endCollection(at: end)
            _ = try await builder.finishWorkout()
        }
    }
}
#endif
