import BackgroundTasks
import Foundation
import HealthKit

/// Wakes the app when Apple Health has new data, and every few hours as a
/// fallback. Observer queries must be registered on every launch, including the
/// background launches HealthKit itself triggers.
enum BackgroundSync {
    static let refreshTaskIdentifier = "com.selrano.health.refresh"

    private static var started = false
    private static var queries: [HKObserverQuery] = []

    static func start() {
        guard !started, HealthReader.isAvailable, Stored.askedForHealthAccess else { return }
        started = true
        let store = HealthReader.shared.store
        let types: [(HKSampleType, HKUpdateFrequency)] = [
            (HealthReader.steps, .hourly),
            (HealthReader.activeEnergy, .hourly),
            (HealthReader.exercise, .hourly),
            (HealthReader.restingHeartRate, .hourly),
            (HealthReader.sleep, .immediate),
            (HealthReader.workouts, .immediate)
        ]
        for (type, frequency) in types {
            // HealthKit calls this on a background queue, so it must not be main-actor isolated.
            let query = HKObserverQuery(sampleType: type, predicate: nil) { @Sendable _, completion, error in
                // HealthKit stops waking the app if the completion handler is not called.
                // HealthKit allows calling the completion handler from any thread.
                nonisolated(unsafe) let completion = completion
                guard error == nil else { completion(); return }
                Task { @MainActor in
                    await SyncEngine.shared.sync()
                    completion()
                }
            }
            queries.append(query)
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: frequency) { _, _ in }
        }
        scheduleRefresh()
    }

    static func scheduleRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: refreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
