import SwiftUI

struct MemoryView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @State private var memories: [Memory] = []
    @State private var loaded = false
    @State private var draft = ""
    @State private var editing: Memory?
    @State private var editText = ""
    @State private var forgetting: Memory?
    @FocusState private var adding: Bool

    private var pinned: [Memory] { memories.filter { $0.pinned == true } }
    private var other: [Memory] { memories.filter { $0.pinned != true } }

    var body: some View {
        List {
            Section {
                HStack(spacing: 10) {
                    TextField("Teach Selrano something about you", text: $draft, axis: .vertical)
                        .lineLimit(1...4)
                        .focused($adding)
                        .submitLabel(.done)
                    Button { Task { await add() } } label: {
                        Image(systemName: "plus.circle.fill").font(.system(size: 26)).foregroundStyle(draft.isEmpty ? Theme.borderStrong : Theme.accent)
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityLabel("Add memory")
                }
                .listRowBackground(Theme.surface)
            } footer: {
                Text("Selrano also learns from your chats. Pinned memories are used in every conversation.")
            }
            if !pinned.isEmpty {
                Section("Pinned") { ForEach(pinned) { row($0) } }
            }
            Section(pinned.isEmpty ? "Remembered" : "Other memories") {
                ForEach(other) { row($0) }
                if loaded && memories.isEmpty {
                    Text("Nothing remembered yet.").foregroundStyle(Theme.muted).listRowBackground(Theme.surface)
                }
                if !loaded { SkeletonLines(count: 4).listRowBackground(Color.clear) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.paper)
        .navigationTitle("Memory")
        .refreshable { await load() }
        .task { await load() }
        .alert("Edit memory", isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } }), presenting: editing) { memory in
            TextField("Memory", text: $editText)
            Button("Save") { Task { await patch(memory, ["content": editText], notice: "Memory updated") } }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Forget this memory?", isPresented: Binding(get: { forgetting != nil }, set: { if !$0 { forgetting = nil } }), titleVisibility: .visible, presenting: forgetting) { memory in
            Button("Forget", role: .destructive) { Task { await forget(memory) } }
        } message: { _ in
            Text("Selrano will stop using it in chats. This cannot be undone.")
        }
    }

    private func row(_ memory: Memory) -> some View {
        Text(Format.clean(memory.content))
            .font(.system(size: 15))
            .foregroundStyle(Theme.ink)
            .padding(.vertical, 3)
            .listRowBackground(Theme.surface)
            .swipeActions(edge: .leading) {
                Button(memory.pinned == true ? "Unpin" : "Pin", systemImage: memory.pinned == true ? "pin.slash" : "pin") {
                    Task { await patch(memory, ["pinned": !(memory.pinned ?? false)], notice: memory.pinned == true ? "Unpinned" : "Pinned") }
                }
                .tint(Theme.accent)
            }
            .swipeActions(edge: .trailing) {
                Button("Forget", systemImage: "trash", role: .destructive) { forgetting = memory }
                Button("Edit", systemImage: "pencil") {
                    editText = memory.content
                    editing = memory
                }
            }
            .contextMenu {
                Button(memory.pinned == true ? "Unpin" : "Pin", systemImage: "pin") {
                    Task { await patch(memory, ["pinned": !(memory.pinned ?? false)], notice: memory.pinned == true ? "Unpinned" : "Pinned") }
                }
                Button("Edit", systemImage: "pencil") {
                    editText = memory.content
                    editing = memory
                }
                Button("Forget", systemImage: "trash", role: .destructive) { forgetting = memory }
            }
    }

    private func load() async {
        do {
            let list: MemoryList = try await session.api.get("/api/memories")
            memories = list.memories
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
        loaded = true
    }

    private func add() async {
        let text = Format.clean(draft).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        do {
            let result: MemoryResult = try await session.api.post("/api/memories", body: ["content": text])
            withAnimation { memories.insert(result.memory, at: 0) }
            draft = ""
            adding = false
            notices.show("Saved to memory")
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
    }

    private func patch(_ memory: Memory, _ body: [String: Any], notice: String) async {
        do {
            let result: MemoryResult = try await session.api.patch("/api/memories/\(memory.id)", body: body)
            withAnimation {
                if let index = memories.firstIndex(where: { $0.id == memory.id }) { memories[index] = result.memory }
            }
            notices.show(notice)
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
    }

    private func forget(_ memory: Memory) async {
        do {
            try await session.api.delete("/api/memories/\(memory.id)")
            withAnimation { memories.removeAll { $0.id == memory.id } }
            notices.show("Memory forgotten")
        } catch {
            notices.show("Could not forget that memory", error: true)
        }
    }
}
