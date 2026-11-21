import LocalAuthentication
import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("faceIDLock") private var lockEnabled = true
    @State private var locked = true

    var body: some View {
        ZStack(alignment: .top) {
            Theme.paper.ignoresSafeArea()
            switch session.state {
            case .loading:
                ProgressView().tint(Theme.accent)
            case .signedOut:
                SignInView()
                    .transition(.opacity)
            case .signedIn:
                MainTabs()
                    .transition(.opacity)
                if locked && lockEnabled && LockScreen.canUseBiometrics {
                    LockScreen { locked = false }
                        .transition(.opacity)
                        .zIndex(2)
                }
            }
            if let notice = notices.current {
                NoticeBanner(notice: notice)
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(3)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.state)
        .task { await session.restore() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { locked = true }
        }
    }
}

/// Face ID before the app shows anything, every time it comes back from the background.
struct LockScreen: View {
    let unlocked: () -> Void
    @State private var failed = false

    static var canUseBiometrics: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    var body: some View {
        ZStack {
            Theme.paper.ignoresSafeArea()
            VStack(spacing: 18) {
                Image("Mark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 56, height: 56)
                Text("Selrano is locked")
                    .font(Theme.display(28))
                    .foregroundStyle(Theme.ink)
                Button("Unlock") { authenticate() }
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(maxWidth: 220)
                    .opacity(failed ? 1 : 0)
            }
        }
        .task { authenticate() }
    }

    private func authenticate() {
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock Selrano") { success, _ in
            Task { @MainActor in
                if success { unlocked() } else { failed = true }
            }
        }
    }
}

struct MainTabs: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            Tab("Today", systemImage: "sun.max", value: Router.Tab.today) { TodayView() }
            Tab("Chats", systemImage: "bubble.left.and.bubble.right", value: Router.Tab.chats) { ChatListView() }
            Tab("Notes", systemImage: "book.closed", value: Router.Tab.notes) { NotesView() }
            Tab("Money", systemImage: "wallet.bifold", value: Router.Tab.money) { MoneyView() }
            Tab("More", systemImage: "ellipsis.circle", value: Router.Tab.more) { MoreView() }
        }
    }
}
