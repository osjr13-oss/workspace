import SwiftUI

@main
struct SelranoApp: App {
    @State private var session = Session()
    @State private var notices = Notices()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(notices)
                .environment(router)
                .tint(Theme.accent)
                .preferredColorScheme(.light)
        }
    }
}

/// Which tab is open, and a message handed from Today to a new chat.
@Observable
final class Router {
    enum Tab: Hashable { case today, chats, notes, money, more }
    var tab: Tab = .today
    var chatPath: [ChatRoute] = []

    func startChat(with message: String) {
        tab = .chats
        chatPath = [.new(firstMessage: message)]
    }

    func openChat(_ thread: ChatThread) {
        tab = .chats
        chatPath = [.thread(thread)]
    }
}

enum ChatRoute: Hashable {
    case new(firstMessage: String?)
    case thread(ChatThread)
}
