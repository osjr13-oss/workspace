import SwiftUI

struct NotesView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @State private var notes: [Note] = []
    @State private var loaded = false
    @State private var query = ""
    @State private var path: [NoteRoute] = []

    enum NoteRoute: Hashable { case note(Note), new }

    private var visible: [Note] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return needle.isEmpty ? notes : notes.filter { $0.title.lowercased().contains(needle) || $0.content.lowercased().contains(needle) }
    }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if loaded && notes.isEmpty {
                    EmptyNote(text: "Write your first note, or ask Selrano in a chat to save one for you.", actionTitle: "New note") { path = [.new] }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                ForEach(visible) { note in
                    NavigationLink(value: NoteRoute.note(note)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Format.clean(note.title).isEmpty ? "Untitled note" : Format.clean(note.title))
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                            Text(preview(note))
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.muted)
                                .lineLimit(2)
                            Text(Format.relative(note.updated_at))
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(Theme.surface)
                }
                .onDelete { offsets in
                    let targets = offsets.map { visible[$0] }
                    Task { for note in targets { await delete(note) } }
                }
                if !loaded { SkeletonLines(count: 5).listRowBackground(Color.clear) }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .searchable(text: $query, prompt: "Search notes")
            .refreshable { await load() }
            .navigationTitle("Notes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { path = [.new] } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("New note")
                }
            }
            .navigationDestination(for: NoteRoute.self) { route in
                switch route {
                case .note(let note): NoteEditorView(note: note) { Task { await load() } }
                case .new: NoteEditorView(note: nil) { Task { await load() } }
                }
            }
            .task { await load() }
        }
    }

    private func preview(_ note: Note) -> String {
        let plain = note.content.replacingOccurrences(of: #"[#*_>`]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        return plain.isEmpty ? "Empty note" : Format.clean(plain)
    }

    private func load() async {
        do {
            notes = try await session.api.rows("notes", query: "select=*&order=updated_at.desc")
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
        loaded = true
    }

    private func delete(_ note: Note) async {
        do {
            try await session.api.deleteRow("notes", id: note.id)
            withAnimation { notes.removeAll { $0.id == note.id } }
            notices.show("Note deleted")
        } catch {
            notices.show("Could not delete the note", error: true)
        }
    }
}

struct NoteEditorView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @Environment(\.dismiss) private var dismiss
    @State private var noteId: String?
    @State private var title: String
    @State private var content: String
    @State private var savedTitle: String
    @State private var savedContent: String
    @State private var saving = false
    @State private var transforming: String?
    @State private var confirmDelete = false
    @FocusState private var bodyFocused: Bool
    let onChange: () -> Void

    init(note: Note?, onChange: @escaping () -> Void) {
        _noteId = State(initialValue: note?.id)
        _title = State(initialValue: note.map { Format.clean($0.title) } ?? "")
        _content = State(initialValue: note.map { Format.clean($0.content) } ?? "")
        _savedTitle = State(initialValue: note.map { Format.clean($0.title) } ?? "")
        _savedContent = State(initialValue: note.map { Format.clean($0.content) } ?? "")
        self.onChange = onChange
    }

    private var dirty: Bool { title != savedTitle || content != savedContent }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                TextField("Title", text: $title, axis: .vertical)
                    .font(Theme.display(28))
                    .foregroundStyle(Theme.ink)
                TextEditor(text: $content)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.ink)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 420)
                    .focused($bodyFocused)
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text("Start writing. Markdown works.")
                                .font(.system(size: 16))
                                .foregroundStyle(Theme.muted)
                                .padding(.top, 8)
                                .padding(.leading, 5)
                                .allowsHitTesting(false)
                        }
                    }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .background(Theme.paper.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Menu {
                    ForEach(["Summarize", "Rewrite", "Turn into outline", "Turn into notes"], id: \.self) { action in
                        Button(action) { Task { await transform(action) } }
                    }
                    if noteId != nil {
                        Divider()
                        Button("Delete note", systemImage: "trash", role: .destructive) { confirmDelete = true }
                    }
                } label: {
                    if transforming != nil { ProgressView() } else { Image(systemName: "wand.and.stars") }
                }
                .accessibilityLabel("Note actions")
                .disabled(transforming != nil)
                Button(saving ? "Saving" : "Save") { Task { await save() } }
                    .fontWeight(.semibold)
                    .disabled(!dirty || saving)
            }
        }
        .confirmationDialog("Delete this note?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        } message: {
            Text("\"\(title.isEmpty ? "Untitled note" : title)\" will be removed. This cannot be undone.")
        }
        .onAppear { if noteId == nil { bodyFocused = true } }
        .onDisappear { if dirty { Task { await save(quiet: true) } } }
    }

    private func save(quiet: Bool = false) async {
        guard dirty, !saving else { return }
        saving = true
        defer { saving = false }
        let cleanTitle = Format.clean(title).trimmingCharacters(in: .whitespaces)
        let values: [String: Any] = [
            "title": cleanTitle.isEmpty ? "Untitled note" : cleanTitle,
            "content": Format.clean(content),
            "updated_at": ISO8601DateFormatter().string(from: Date())
        ]
        do {
            if let noteId {
                try await session.api.update("notes", id: noteId, values: values)
                if !quiet { notices.show("Note saved") }
            } else {
                guard let userId = session.me?.id else { throw APIError.signedOut }
                var insert = values
                insert["user_id"] = userId
                let created: Note = try await session.api.insert("notes", values: insert)
                noteId = created.id
                if !quiet { notices.show("Note created") }
            }
            savedTitle = title
            savedContent = content
            onChange()
        } catch {
            notices.show("Could not save the note", error: true)
        }
    }

    private func transform(_ action: String) async {
        guard !content.trimmingCharacters(in: .whitespaces).isEmpty else {
            notices.show("Write something first", error: true)
            return
        }
        struct Result: Decodable { let result: String }
        transforming = action
        defer { transforming = nil }
        do {
            let response: Result = try await session.api.post("/api/ai/transform", body: ["action": action, "text": content])
            withAnimation { content = Format.clean(response.result) }
            notices.show("\(action) ready. Save to keep it.")
        } catch {
            notices.show(error.localizedDescription, error: true)
        }
    }

    private func delete() async {
        guard let noteId else { return }
        do {
            try await session.api.deleteRow("notes", id: noteId)
            savedTitle = title
            savedContent = content
            notices.show("Note deleted")
            onChange()
            dismiss()
        } catch {
            notices.show("Could not delete the note", error: true)
        }
    }
}
