import SwiftUI

struct PairView: View {
    let engine: SyncEngine
    @State private var code = ""
    @State private var pairing = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var cleaned: String { code.uppercased().filter { $0.isLetter || $0.isNumber } }

    var body: some View {
        Form {
            Section {
                Text("Connect this iPhone so your coach can see your steps, workouts, sleep, and resting heart rate.")
                    .foregroundStyle(Palette.muted)
            }
            Section {
                TextField("8-character code", text: $code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(.title3, design: .monospaced))
                    .focused($focused)
                    .onSubmit(pair)
                    .accessibilityLabel("Pairing code")
            } header: {
                Text("Pairing code")
            } footer: {
                Text("In Selrano on the web, open Settings and choose Connect iPhone.")
            }
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }
            Section {
                Button(action: pair) {
                    if pairing { ProgressView() } else { Text("Connect") }
                }
                .disabled(cleaned.count != 8 || pairing)
            }
        }
        .onAppear { focused = true }
    }

    private func pair() {
        guard cleaned.count == 8, !pairing else { return }
        pairing = true
        error = nil
        Task {
            do {
                try await engine.pair(code: cleaned)
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? "Could not connect. Try again."
            }
            pairing = false
        }
    }
}
