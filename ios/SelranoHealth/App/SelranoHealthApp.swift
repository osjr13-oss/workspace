import SwiftUI

@main
struct SelranoHealthApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Registers HealthKit observers on every launch, including background ones.
        BackgroundSync.start()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, SyncEngine.shared.isPaired, Stored.askedForHealthAccess else { return }
            Task { await SyncEngine.shared.sync() }
        }
        .backgroundTask(.appRefresh(BackgroundSync.refreshTaskIdentifier)) {
            await BackgroundSync.scheduleRefresh()
            await SyncEngine.shared.sync()
        }
    }
}
