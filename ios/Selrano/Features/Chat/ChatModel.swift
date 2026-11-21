import Foundation
import Observation

struct ChatAttachment: Identifiable, Equatable {
    enum Status: Equatable {
        case uploading
        case reading
        case ready(fileId: String)
        case failed(String)
    }

    let id: UUID
    let name: String
    var status: Status

    var fileId: String? {
        if case .ready(let id) = status { return id }
        return nil
    }

    var isBusy: Bool {
        status == .uploading || status == .reading
    }
}

/// One conversation: its active branch of saved messages, pending attachments, and the reply being written right now.
@Observable
final class ChatModel {
    private(set) var threadId: String?
    private(set) var messages: [ChatMessage] = []
    private(set) var attachments: [ChatAttachment] = []
    private(set) var loading = false
    private(set) var busy = false
    private(set) var status: String?
    private(set) var replyStarted = false
    var error: String?

    @ObservationIgnored private var replyTask: Task<Void, Never>?
    @ObservationIgnored private var currentQuestionId: String?
    @ObservationIgnored private var currentStartedAt: String?
    @ObservationIgnored var onThreadCreated: ((String) -> Void)?
    @ObservationIgnored var onAction: ((String, String) -> Void)?

    var uploadingAttachments: Bool {
        attachments.contains(where: \.isBusy)
    }

    init(threadId: String?) {
        self.threadId = threadId
    }

    func load(api: API) async {
        guard let threadId else { return }
        loading = messages.isEmpty
        defer { loading = false }
        do {
            async let threadRows: [ChatThread] = api.rows("chat_threads", query: "select=*&id=eq.\(threadId)")
            async let messageRows: [ChatMessage] = api.rows("chat_messages", query: "select=*&thread_id=eq.\(threadId)&order=created_at.asc")
            let (threads, rows) = try await (threadRows, messageRows)
            messages = ChatTree.activePath(rows, leafId: threads.first?.active_leaf_id)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func attachPhoto(data: Data, name: String, session: Session) {
        guard attachments.count < 8 else { return }
        let item = ChatAttachment(id: UUID(), name: name, status: .uploading)
        attachments.append(item)
        Task {
            do {
                let file = try await FileUploader.upload(data: data, name: name, mimeType: "image/jpeg", session: session) { stage in
                    self.updateAttachment(item.id, status: stage == .uploading ? .uploading : .reading)
                }
                updateAttachment(item.id, status: .ready(fileId: file.id))
            } catch {
                updateAttachment(item.id, status: .failed(error.localizedDescription))
            }
        }
    }

    func attachFile(url: URL, session: Session) {
        guard attachments.count < 8 else { return }
        let item = ChatAttachment(id: UUID(), name: url.lastPathComponent, status: .uploading)
        attachments.append(item)
        Task {
            do {
                let file = try await FileUploader.uploadFile(at: url, session: session) { stage in
                    self.updateAttachment(item.id, status: stage == .uploading ? .uploading : .reading)
                }
                updateAttachment(item.id, status: .ready(fileId: file.id))
            } catch {
                updateAttachment(item.id, status: .failed(error.localizedDescription))
            }
        }
    }

    func removeAttachment(_ id: UUID) {
        attachments.removeAll { $0.id == id }
    }

    private func updateAttachment(_ id: UUID, status: ChatAttachment.Status) {
        if let index = attachments.firstIndex(where: { $0.id == id }) {
            attachments[index].status = status
        }
    }

    func send(_ raw: String, api: API) {
        let text = Format.clean(raw).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy, !uploadingAttachments else { return }
        let ready = attachments.compactMap { item -> (id: String, name: String)? in
            guard let fileId = item.fileId else { return nil }
            return (fileId, item.name)
        }
        let parentId = messages.last(where: { $0.id != "error" && $0.id != "streaming" && $0.id != "pending-user" })?.id
        error = nil
        messages.removeAll { $0.id == "error" }
        let pendingCitations = ready.enumerated().map { index, file in
            Citation(kind: "file", marker: "attachment-\(index + 1)", fileId: file.id, fileName: file.name, title: nil, url: nil, label: nil)
        }
        messages.append(ChatMessage(id: "pending-user", parent_id: parentId, role: "user", content: text, citations: pendingCitations.isEmpty ? nil : pendingCitations, created_at: ISO8601DateFormatter().string(from: Date())))
        attachments.removeAll()
        busy = true
        replyStarted = false
        status = nil
        currentQuestionId = nil
        currentStartedAt = nil
        var body: [String: Any] = ["message": text]
        if let threadId { body["threadId"] = threadId }
        if let parentId { body["parentId"] = parentId }
        if !ready.isEmpty { body["fileIds"] = ready.map(\.id) }
        replyTask = Task { await run(body: body, api: api) }
    }

    func regenerate(_ message: ChatMessage, api: API) {
        guard !busy, let index = messages.firstIndex(of: message) else { return }
        messages = Array(messages.prefix(index))
        busy = true
        replyStarted = false
        currentQuestionId = nil
        currentStartedAt = nil
        var body: [String: Any] = ["regenerateMessageId": message.id]
        if let threadId { body["threadId"] = threadId }
        replyTask = Task { await run(body: body, api: api) }
    }

    /// Keep the words already shown as the reply, and save exactly those.
    func stop(api: API) {
        guard busy else { return }
        replyTask?.cancel()
        replyTask = nil
        let partial = messages.last(where: { $0.id == "streaming" })?.content ?? ""
        let questionId = currentQuestionId
        let startedAt = currentStartedAt
        busy = false
        status = nil
        guard let threadId else { return }
        Task {
            var body: [String: Any] = ["threadId": threadId, "content": partial]
            if let questionId { body["questionId"] = questionId }
            if let startedAt { body["startedAt"] = startedAt }
            _ = try? await URLSession.shared.data(for: try await api.serverRequest("/api/ai/chat/stop", method: "POST", body: body))
            await load(api: api)
        }
    }

    private func run(body: [String: Any], api: API) async {
        var bubbleAdded = false
        do {
            for try await event in ChatStream.send(api: api, body: body) {
                switch event {
                case .start(let id, let questionId, let startedAt):
                    if threadId != id {
                        threadId = id
                        onThreadCreated?(id)
                    }
                    if let questionId { currentQuestionId = questionId }
                    if let startedAt { currentStartedAt = startedAt }
                case .status(let label):
                    status = label
                case .text(let chunk):
                    if !bubbleAdded {
                        bubbleAdded = true
                        status = nil
                        messages.append(ChatMessage(id: "streaming", role: "assistant", content: "", citations: nil, created_at: ISO8601DateFormatter().string(from: Date())))
                    }
                    if let index = messages.lastIndex(where: { $0.id == "streaming" }) {
                        messages[index].content += Format.clean(chunk)
                        if !messages[index].content.trimmingCharacters(in: .whitespaces).isEmpty { replyStarted = true }
                    }
                case .action(let kind, let label):
                    onAction?(kind, label)
                case .error(let message):
                    fail(message)
                    return
                case .other:
                    break
                }
            }
            if Task.isCancelled { return }
            // Swap the streamed words for the saved rows (with their sources).
            await load(api: api)
        } catch {
            if Task.isCancelled { return }
            if bubbleAdded {
                // The server finishes and saves the reply even if the connection dropped.
                try? await Task.sleep(for: .seconds(2))
                await load(api: api)
            } else {
                fail(error.localizedDescription)
            }
        }
        busy = false
        status = nil
        replyStarted = false
    }

    private func fail(_ message: String) {
        messages.removeAll { $0.id == "streaming" || $0.id == "pending-user" }
        messages.append(ChatMessage(id: "error", role: "assistant", content: message, citations: nil, created_at: ""))
        busy = false
        status = nil
        replyStarted = false
    }
}
