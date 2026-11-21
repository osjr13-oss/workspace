import SwiftUI

struct ChatListView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @Environment(Router.self) private var router
    @State private var threads: [ChatThread] = []
    @State private var loaded = false
    @State private var query = ""
    @State private var deleting: ChatThread?
    @State private var renaming: ChatThread?
    @State private var newTitle = ""

    private var groups: [(String, [ChatThread])] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        let list = needle.isEmpty ? threads : threads.filter { $0.title.lowercased().contains(needle) }
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        var buckets: [String: [ChatThread]] = [:]
        for thread in list {
            let date = Format.date(thread.updated_at) ?? .distantPast
            let label = date >= startOfToday ? "Today"
                : date >= startOfToday.addingTimeInterval(-86_400) ? "Yesterday"
                : date >= startOfToday.addingTimeInterval(-7 * 86_400) ? "Previous 7 days" : "Older"
            buckets[label, default: []].append(thread)
        }
        return ["Today", "Yesterday", "Previous 7 days", "Older"].compactMap { label in buckets[label].map { (label, $0) } }
    }

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.chatPath) {
            List {
                if loaded && threads.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Start a conversation")
                            .font(Theme.display(28))
                        StarterGrid { prompt in router.chatPath = [.new(firstMessage: prompt)] }
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                ForEach(groups, id: \.0) { label, items in
                    Section(label) {
                        ForEach(items) { thread in
                            NavigationLink(value: ChatRoute.thread(thread)) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(Format.clean(thread.title).isEmpty ? "Untitled chat" : Format.clean(thread.title))
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                        .lineLimit(1)
                                    Text(Format.relative(thread.updated_at))
                                        .font(.system(size: 13))
                                        .foregroundStyle(Theme.muted)
                                }
                                .padding(.vertical, 3)
                            }
                            .listRowBackground(Theme.surface)
                            .swipeActions {
                                Button("Delete", systemImage: "trash", role: .destructive) { deleting = thread }
                                Button("Rename", systemImage: "pencil") {
                                    newTitle = thread.title
                                    renaming = thread
                                }
                                .tint(Theme.accent)
                            }
                            .contextMenu {
                                Button("Rename", systemImage: "pencil") {
                                    newTitle = thread.title
                                    renaming = thread
                                }
                                Button("Delete", systemImage: "trash", role: .destructive) { deleting = thread }
                            }
                        }
                    }
                }
                if !loaded {
                    SkeletonLines(count: 5).listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .searchable(text: $query, prompt: "Search chats")
            .refreshable { await load() }
            .navigationTitle("Chats")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        router.chatPath = [.new(firstMessage: nil)]
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .accessibilityLabel("New chat")
                }
            }
            .navigationDestination(for: ChatRoute.self) { route in
                switch route {
                case .new(let first):
                    ChatView(thread: nil, firstMessage: first) { Task { await load() } }
                case .thread(let thread):
                    ChatView(thread: thread) { Task { await load() } }
                }
            }
            .task { await load() }
            .confirmationDialog("Delete this chat?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible, presenting: deleting) { thread in
                Button("Delete", role: .destructive) { Task { await delete(thread) } }
            } message: { thread in
                Text("\"\(Format.clean(thread.title))\" and its messages will be removed. This cannot be undone.")
            }
            .alert("Rename chat", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } }), presenting: renaming) { thread in
                TextField("Title", text: $newTitle)
                Button("Save") { Task { await rename(thread) } }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private func load() async {
        do {
            threads = try await session.api.rows("chat_threads", query: "select=*&temporary=eq.false&order=updated_at.desc")
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
        loaded = true
    }

    private func delete(_ thread: ChatThread) async {
        do {
            try await session.api.deleteRow("chat_threads", id: thread.id)
            withAnimation { threads.removeAll { $0.id == thread.id } }
            notices.show("Chat deleted")
        } catch {
            notices.show("Could not delete the chat", error: true)
        }
    }

    private func rename(_ thread: ChatThread) async {
        let title = String(Format.clean(newTitle).trimmingCharacters(in: .whitespaces).prefix(120))
        guard !title.isEmpty else { return }
        do {
            try await session.api.update("chat_threads", id: thread.id, values: ["title": title, "title_locked": true])
            if let index = threads.firstIndex(of: thread) { threads[index].title = title }
            notices.show("Chat renamed")
        } catch {
            notices.show("Could not rename the chat", error: true)
        }
    }
}
