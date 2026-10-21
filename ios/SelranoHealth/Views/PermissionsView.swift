import SwiftUI

struct PermissionsView: View {
    let onDone: () -> Void
    @State private var requesting = false
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                Text("Selrano reads, and never writes:")
                Label("Steps and active energy", systemImage: "figure.walk")
                Label("Exercise minutes and workouts", systemImage: "figure.run")
                Label("Sleep", systemImage: "bed.double")
                Label("Resting heart rate", systemImage: "heart")
            } footer: {
                Text("You can change this anytime in the Health app under Sharing, Apps.")
            }
            if !HealthReader.isAvailable {
                Section { Text("Apple Health is not available on this device.").foregroundStyle(.red) }
            }
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }
            Section {
                Button {
                    request()
                } label: {
                    if requesting { ProgressView() } else { Text("Allow Health access") }
                }
                .disabled(requesting || !HealthReader.isAvailable)
            }
        }
    }

    private func request() {
        requesting = true
        error = nil
        Task {
            do {
                try await HealthReader.shared.requestAuthorization()
                Stored.askedForHealthAccess = true
                BackgroundSync.start()
                onDone()
                await SyncEngine.shared.sync()
            } catch {
                self.error = "Could not open the Health permission sheet."
            }
            requesting = false
        }
    }
}
