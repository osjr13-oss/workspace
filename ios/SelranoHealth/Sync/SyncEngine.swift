import Foundation
import HealthKit
import UIKit

/// What happened on the last sync, shown on the Status screen.
struct SyncReport: Codable, Equatable {
    var at: Date
    var days: Int
    var nights: Int
    var workouts: Int
    var error: String?
}

/// Reads Apple Health and sends the result to Selrano. Several HealthKit
/// observers can fire at once; overlapping requests share one sync and, if
/// anything arrived meanwhile, run one more after it.
@Observable
final class SyncEngine {
    static let shared = SyncEngine()

    /// Days of daily totals and sleep re-sent every time, so late Watch data is picked up.
    static let windowDays = 14

    private(set) var isPaired = Keychain.readToken() != nil
    private(set) var isSyncing = false
    private(set) var lastReport: SyncReport? = Stored.lastReport

    private let health = HealthReader.shared
    private var api = APIClient.configured
    private var running: Task<Void, Never>?
    private var rerun = false

    func pair(code: String) async throws {
        let normalized = code.uppercased().filter { $0.isLetter || $0.isNumber }
        let token = try await api.claim(code: normalized, deviceName: UIDevice.current.name)
        guard Keychain.saveToken(token) else { throw APIError.server(0) }
        Stored.workoutAnchor = nil
        isPaired = true
    }

    /// Forget this device's token and sync position. The device also stays listed
    /// in Selrano's Settings until it is revoked there.
    func disconnect() {
        Keychain.deleteToken()
        Stored.workoutAnchor = nil
        Stored.lastReport = nil
        lastReport = nil
        isPaired = false
    }

    func sync() async {
        if let running {
            rerun = true
            await running.value
            return
        }
        let task = Task {
            repeat {
                rerun = false
                await syncOnce()
            } while rerun
        }
        running = task
        isSyncing = true
        await task.value
        running = nil
        isSyncing = false
    }

    private func syncOnce() async {
        guard let token = Keychain.readToken() else {
            isPaired = false
            return
        }
        var report = SyncReport(at: .now, days: 0, nights: 0, workouts: 0)
        do {
            var anchor = Stored.workoutAnchor
            var first = true
            // Workouts arrive in batches of at most 200; daily totals and sleep go with the first.
            while true {
                let dayRows = first ? try await health.dailyTotals(lastDays: Self.windowDays) : []
                let nightRows = first ? try await health.sleepNights(lastDays: Self.windowDays) : []
                let workoutChanges = try await health.workoutChanges(since: anchor)

                let payload = SyncPayload(
                    tz: TimeZone.current.identifier,
                    appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0",
                    days: Array(dayRows.suffix(SyncPayload.maxDays)),
                    sleep: nightRows.suffix(SyncPayload.maxNights).map(SyncPayload.Night.init),
                    workouts: .init(upserted: workoutChanges.upserted, deleted: workoutChanges.deleted)
                )
                try await api.sync(payload, token: token)
                // The anchor moves only once the server has the batch.
                Stored.workoutAnchor = workoutChanges.anchor
                anchor = workoutChanges.anchor
                report.days += payload.days.count
                report.nights += payload.sleep.count
                report.workouts += payload.workouts.upserted.count
                first = false
                if !workoutChanges.hasMore { break }
            }
        } catch APIError.unauthorized {
            disconnect()
            report.error = APIError.unauthorized.errorDescription
        } catch let error as HKError where error.code == .errorDatabaseInaccessible {
            report.error = "Health data is locked while the iPhone is locked. Selrano will sync after you unlock it."
        } catch {
            report.error = (error as? LocalizedError)?.errorDescription ?? "Sync failed. Selrano will try again later."
        }
        lastReport = report
        Stored.lastReport = report
    }
}

/// Small values kept between launches.
enum Stored {
    private static let defaults = UserDefaults.standard

    static var workoutAnchor: HKQueryAnchor? {
        get {
            guard let data = defaults.data(forKey: "workoutAnchor") else { return nil }
            return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
        }
        set {
            if let newValue, let data = try? NSKeyedArchiver.archivedData(withRootObject: newValue, requiringSecureCoding: true) {
                defaults.set(data, forKey: "workoutAnchor")
            } else {
                defaults.removeObject(forKey: "workoutAnchor")
            }
        }
    }

    static var lastReport: SyncReport? {
        get { defaults.data(forKey: "lastReport").flatMap { try? JSONDecoder().decode(SyncReport.self, from: $0) } }
        set { defaults.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "lastReport") }
    }

    static var askedForHealthAccess: Bool {
        get { defaults.bool(forKey: "askedForHealthAccess") }
        set { defaults.set(newValue, forKey: "askedForHealthAccess") }
    }
}
