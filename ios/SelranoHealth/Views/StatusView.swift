import SwiftUI

struct StatusView: View {
    let engine: SyncEngine
    @State private var confirmingDisconnect = false

    var body: some View {
        Form {
            Section("Last sync") {
                if let report = engine.lastReport {
                    LabeledContent("When", value: report.at.formatted(.relative(presentation: .named)))
                    LabeledContent("Days of activity", value: "\(report.days)")
                    LabeledContent("Nights of sleep", value: "\(report.nights)")
                    LabeledContent("New workouts", value: "\(report.workouts)")
                    if let error = report.error {
                        Text(error).foregroundStyle(.red)
                    }
                } else {
                    Text("Not synced yet.").foregroundStyle(Palette.muted)
                }
            }
            Section {
                Button {
                    Task { await engine.sync() }
                } label: {
                    HStack {
                        Text("Sync now")
                        if engine.isSyncing {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(engine.isSyncing)
            } footer: {
                Text("Selrano also syncs on its own when Apple Health has new data. iOS decides exactly when.")
            }
            Section {
                Link("Open Selrano", destination: APIClient.configured.baseURL)
            }
            #if DEBUG
            Section("Debug") {
                Button("Add sample data") {
                    Task {
                        try? await SampleData.seed()
                        await engine.sync()
                    }
                }
            }
            #endif
            Section {
                Button("Disconnect this iPhone", role: .destructive) {
                    confirmingDisconnect = true
                }
            } footer: {
                Text("To stop Selrano accepting data from this phone, also revoke it in Settings on the web.")
            }
        }
        .refreshable { await engine.sync() }
        .confirmationDialog("Disconnect this iPhone?", isPresented: $confirmingDisconnect, titleVisibility: .visible) {
            Button("Disconnect", role: .destructive) { engine.disconnect() }
        }
    }
}
