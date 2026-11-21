import SwiftUI

struct MoreView: View {
    @Environment(Session.self) private var session
    @Environment(\.openURL) private var openURL
    @AppStorage("faceIDLock") private var lockEnabled = true
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { MemoryView() } label: { Label("Memory", systemImage: "brain") }
                }
                .listRowBackground(Theme.surface)

                Section {
                    if LockScreen.canUseBiometrics {
                        Toggle(isOn: $lockEnabled) { Label("Lock with Face ID", systemImage: "faceid") }
                            .tint(Theme.accent)
                    }
                } footer: {
                    Text("Asks for Face ID whenever Selrano comes back from the background.")
                }
                .listRowBackground(Theme.surface)

                Section {
                    Button { openURL(AppConfig.baseURL.appending(path: "/settings")) } label: {
                        Label("Connect Google, weekly email", systemImage: "link")
                    }
                    Button { openURL(AppConfig.baseURL.appending(path: "/money")) } label: {
                        Label("Connect a bank", systemImage: "building.columns")
                    }
                } header: {
                    Text("On selrano.com")
                } footer: {
                    Text("Connections are set up once on the website, where Google and your bank show their own sign-in pages. They then work here too.")
                }
                .listRowBackground(Theme.surface)

                Section {
                    if let email = session.me?.email {
                        LabeledContent("Signed in as", value: email)
                    }
                    Button("Sign out", role: .destructive) { confirmSignOut = true }
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .navigationTitle("More")
            .confirmationDialog("Sign out of Selrano on this iPhone?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { session.signOut() }
            }
        }
    }
}
