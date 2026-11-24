import PhotosUI
import SwiftUI

struct ChatView: View {
    @Environment(Session.self) private var session
    @Environment(Notices.self) private var notices
    @State private var model: ChatModel
    @State private var text = ""
    @State private var title: String
    @State private var pickingPhoto = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var importingFile = false
    @FocusState private var composerFocused: Bool
    private let firstMessage: String?
    var onChange: () -> Void = {}

    init(thread: ChatThread?, firstMessage: String? = nil, onChange: @escaping () -> Void = {}) {
        _model = State(initialValue: ChatModel(threadId: thread?.id))
        _title = State(initialValue: thread.map { Format.clean($0.title) } ?? "New chat")
        self.firstMessage = firstMessage
        self.onChange = onChange
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 22) {
                    if model.messages.isEmpty && !model.loading && !model.busy {
                        EmptyChat { prompt in model.send(prompt, api: session.api) }
                    }
                    if model.loading {
                        SkeletonLines(count: 4).padding(.top, 20)
                    }
                    ForEach(model.messages) { message in
                        MessageView(
                            message: message,
                            streaming: message.id == "streaming",
                            onRegenerate: message.isUser || model.busy || message.id == "error" ? nil : { model.regenerate(message, api: session.api) }
                        )
                        .id(message.id)
                        .transition(.asymmetric(insertion: .opacity.combined(with: .move(edge: .bottom)), removal: .opacity))
                    }
                    if model.busy && !model.replyStarted {
                        ThinkingView(label: model.status).id("thinking")
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .animation(.spring(duration: 0.35), value: model.messages.map(\.id))
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: model.messages.last?.content) { _, _ in
                proxy.scrollTo("bottom", anchor: .bottom)
            }
            .onChange(of: model.busy) { _, busy in
                withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                if !busy { onChange() }
            }
        }
        .safeAreaInset(edge: .bottom) {
            @Bindable var bindableModel = model
            Composer(
                text: $text,
                depth: $bindableModel.depth,
                busy: model.busy,
                uploading: model.uploadingAttachments,
                attachments: model.attachments,
                focused: $composerFocused,
                onPickPhoto: { pickingPhoto = true },
                onPickFile: { importingFile = true },
                onRemoveAttachment: { model.removeAttachment($0) }
            ) {
                model.send(text, api: session.api)
                text = ""
            } onStop: {
                model.stop(api: session.api)
            }
        }
        .photosPicker(isPresented: $pickingPhoto, selection: $selectedPhoto, matching: .images)
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    let name = "Photo \(Date().formatted(.dateTime.year().month().day().hour().minute())).jpg"
                        .replacingOccurrences(of: "/", with: "-")
                        .replacingOccurrences(of: ":", with: ".")
                    let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.85) ?? data
                    model.attachPhoto(data: jpeg, name: name, session: session)
                }
                selectedPhoto = nil
            }
        }
        .fileImporter(isPresented: $importingFile, allowedContentTypes: FileUploader.allowedTypes) { result in
            guard case .success(let url) = result else { return }
            model.attachFile(url: url, session: session)
        }
        .background(Theme.paper.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.paper, for: .navigationBar)
        .task {
            model.onThreadCreated = { _ in onChange() }
            model.onAction = { _, label in notices.show(label) }
            if model.threadId != nil {
                await model.load(api: session.api)
            } else if let firstMessage, model.messages.isEmpty {
                model.send(firstMessage, api: session.api)
            } else {
                composerFocused = true
            }
        }
        .onChange(of: model.busy) { _, busy in
            guard !busy, title == "New chat", let id = model.threadId else { return }
            Task {
                let rows: [ChatThread] = (try? await session.api.rows("chat_threads", query: "select=*&id=eq.\(id)")) ?? []
                if let thread = rows.first { withAnimation { title = Format.clean(thread.title) } }
            }
        }
    }
}

private struct EmptyChat: View {
    @Environment(Session.self) private var session
    let send: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(Format.greeting(name: session.firstName))
                .font(Theme.display(34))
                .foregroundStyle(Theme.ink)
                .padding(.top, 40)
            Text("Ask anything. Selrano can look through your notes, files, email, calendar and spending.")
                .font(.system(size: 15))
                .foregroundStyle(Theme.inkSoft)
            StarterGrid(send: send)
        }
    }
}

struct Starter: Identifiable {
    let id: String
    let title: String
    let prompt: String
    let icon: String

    static let all = [
        Starter(id: "notes", title: "Summarize my notes", prompt: "Summarize what is in my notes and point out anything I should follow up on.", icon: "note.text"),
        Starter(id: "week", title: "Plan my week", prompt: "Help me plan my week. Ask me what I have coming up first.", icon: "checklist"),
        Starter(id: "reply", title: "Draft a reply", prompt: "Help me draft a reply to a message. I will paste it next.", icon: "envelope"),
        Starter(id: "news", title: "What changed today", prompt: "What are the most important news stories today?", icon: "globe")
    ]
}

struct StarterGrid: View {
    let send: (String) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(Starter.all) { starter in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    send(starter.prompt)
                } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        Image(systemName: starter.icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                        Text(starter.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(PressableStyle())
            }
        }
    }
}

/// Cards shrink slightly under a finger, so they feel pressable.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

struct Composer: View {
    @Binding var text: String
    @Binding var depth: String
    let busy: Bool
    let uploading: Bool
    let attachments: [ChatAttachment]
    var focused: FocusState<Bool>.Binding
    let onPickPhoto: () -> Void
    let onPickFile: () -> Void
    let onRemoveAttachment: (UUID) -> Void
    let onSend: () -> Void
    let onStop: () -> Void

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !uploading
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(attachments) { item in
                            attachmentChip(item)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 10)
                }
            }
            HStack(alignment: .bottom, spacing: 6) {
                Menu {
                    Button { onPickPhoto() } label: { Label("Photo Library", systemImage: "photo") }
                    Button { onPickFile() } label: { Label("Choose File", systemImage: "doc") }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.inkSoft)
                        .frame(width: 34, height: 34)
                        .background(Theme.paperRaised, in: Circle())
                }
                .accessibilityLabel("Attach photo or file")
                .padding(.leading, 8)
                .padding(.bottom, 8)

                Menu {
                    Button {
                        depth = "fast"
                    } label: {
                        Label("Fast (Gemini 4 Hydrogen)", systemImage: depth == "fast" ? "checkmark" : "bolt")
                    }
                    Button {
                        depth = "deep"
                    } label: {
                        Label("Deep (Gemini 4 Argon)", systemImage: depth == "deep" ? "checkmark" : "sparkles")
                    }
                } label: {
                    Text(depth == "deep" ? "Deep" : "Fast")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(depth == "deep" ? Theme.accent : Theme.muted)
                        .padding(.horizontal, 6)
                        .frame(height: 34)
                }
                .accessibilityLabel("Thinking depth")
                .padding(.bottom, 8)

                TextField("Ask Selrano anything", text: $text, axis: .vertical)
                    .font(.system(size: 16))
                    .lineLimit(1...6)
                    .focused(focused)
                    .padding(.vertical, 12)
                    .padding(.leading, 4)

                Button {
                    if busy {
                        onStop()
                    } else if canSend {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        onSend()
                    }
                } label: {
                    Image(systemName: busy ? "stop.fill" : "arrow.up")
                        .font(.system(size: busy ? 13 : 16, weight: .bold))
                        .foregroundStyle(Color(hex: 0xFDFBF7))
                        .frame(width: 36, height: 36)
                        .background(busy || canSend ? Theme.accent : Theme.borderStrong, in: Circle())
                        .contentTransition(.symbolEffect(.replace))
                }
                .disabled(!busy && !canSend)
                .accessibilityLabel(busy ? "Stop responding" : "Send message")
                .padding(.trailing, 7)
                .padding(.bottom, 7)
            }
        }
        .background(Color.white, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.borderStrong, lineWidth: 1))
        .shadow(color: Theme.accent.opacity(0.08), radius: 14, y: 6)
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
        .padding(.top, 6)
        .background(alignment: .bottom) {
            LinearGradient(colors: [Theme.paper.opacity(0), Theme.paper], startPoint: .top, endPoint: .center)
                .ignoresSafeArea()
        }
    }

    private func attachmentChip(_ item: ChatAttachment) -> some View {
        let isFailed: Bool
        let subtitle: String?
        switch item.status {
        case .uploading:
            isFailed = false
            subtitle = "Uploading"
        case .reading:
            isFailed = false
            subtitle = "Reading"
        case .ready:
            isFailed = false
            subtitle = nil
        case .failed(let message):
            isFailed = true
            subtitle = message
        }
        return HStack(spacing: 6) {
            if item.isBusy {
                ProgressView().controlSize(.mini)
            } else {
                Image(systemName: isFailed ? "exclamationmark.circle" : "paperclip")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isFailed ? Theme.critical : Theme.accent)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isFailed ? Theme.critical : Theme.ink)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(isFailed ? Theme.critical : Theme.muted)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: 160, alignment: .leading)
            Button {
                onRemoveAttachment(item.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.muted)
                    .padding(4)
            }
            .accessibilityLabel("Remove \(item.name)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(isFailed ? Theme.critical.opacity(0.08) : Theme.paperRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(isFailed ? Theme.critical.opacity(0.4) : Theme.border, lineWidth: 1))
    }
}

/// Shown until the first words of a reply arrive, with what Selrano is doing.
struct ThinkingView: View {
    let label: String?
    @State private var animate = false

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 5) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Theme.accent)
                        .frame(width: 7, height: 7)
                        .scaleEffect(animate ? 1 : 0.5)
                        .opacity(animate ? 1 : 0.35)
                        .animation(.easeInOut(duration: 0.55).repeatForever().delay(Double(index) * 0.18), value: animate)
                }
            }
            Text(label ?? "Thinking")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.muted)
                .contentTransition(.opacity)
                .animation(.easeInOut, value: label)
        }
        .onAppear { animate = true }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label ?? "Selrano is thinking")
    }
}
