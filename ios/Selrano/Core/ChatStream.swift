import Foundation

/// One line of the chat reply stream (lib/chat-stream.ts on the server).
enum ChatStreamEvent: Equatable {
    case start(threadId: String, questionId: String?, startedAt: String?)
    case status(String?)
    case text(String)
    case action(kind: String, label: String)
    case error(String)
    case other

    static func parse(_ line: String) -> ChatStreamEvent? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty,
              let data = trimmed.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = object["type"] as? String else { return nil }
        switch type {
        case "start":
            return (object["threadId"] as? String).map {
                .start(threadId: $0, questionId: object["questionId"] as? String, startedAt: object["startedAt"] as? String)
            }
        case "status": return .status(object["label"] as? String)
        case "text": return (object["text"] as? String).map { .text($0) }
        case "action": return .action(kind: object["kind"] as? String ?? "", label: object["label"] as? String ?? "Done")
        case "error": return .error(object["error"] as? String ?? "Chat failed.")
        default: return .other
        }
    }
}

enum ChatStream {
    /// Sends a message and yields each event as soon as its line arrives.
    static func send(api: API, body: [String: Any]) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task { @MainActor in
                do {
                    var request = try await api.serverRequest("/api/ai/chat", method: "POST", body: body)
                    request.timeoutInterval = 300
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if status == 401 { throw APIError.signedOut }
                    if status != 200 {
                        var raw = Data()
                        for try await byte in bytes { raw.append(byte) }
                        let message = (try? JSONSerialization.jsonObject(with: raw) as? [String: Any])?["error"] as? String
                        throw APIError.server(message ?? "Chat failed (\(status)).")
                    }
                    for try await line in bytes.lines {
                        if let event = ChatStreamEvent.parse(line) { continuation.yield(event) }
                    }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch let error as URLError where error.code == .cancelled {
                    continuation.finish()
                } catch let error as APIError {
                    continuation.finish(throwing: error)
                } catch {
                    continuation.finish(throwing: APIError.network)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
