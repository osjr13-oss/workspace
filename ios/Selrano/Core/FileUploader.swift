import Foundation
import UniformTypeIdentifiers

/// Uploads a photo or document straight to Supabase Storage using a one-time signed link,
/// then lets the Selrano server process it so Gemini and chat search can use it.
@MainActor
enum FileUploader {
    enum Stage: Equatable {
        case uploading
        case reading
    }

    static let allowedTypes: [UTType] = [
        .pdf,
        .plainText,
        .image,
        UTType(filenameExtension: "md") ?? .plainText,
        UTType(filenameExtension: "docx") ?? .data
    ]

    static func upload(
        data: Data,
        name: String,
        mimeType: String,
        session: Session,
        onStage: (Stage) -> Void = { _ in }
    ) async throws -> WorkspaceFile {
        struct Signed: Decodable { let storagePath: String; let token: String }
        struct Saved: Decodable { let file: WorkspaceFile }

        onStage(.uploading)
        let metadata: [String: Any] = ["name": name, "type": mimeType, "size": data.count]
        let signed: Signed = try await session.api.post("/api/files/upload-url", body: metadata)
        let config = try await session.publicConfig()
        let encodedPath = signed.storagePath.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? signed.storagePath
        guard let uploadURL = URL(string: "\(config.supabaseUrl)/storage/v1/object/upload/sign/workspace-files/\(encodedPath)?token=\(signed.token)") else {
            throw APIError.server("Could not prepare the upload link.")
        }

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "PUT"
        request.timeoutInterval = 120
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.upload(for: request, from: data)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw APIError.server("The upload did not go through (\(status)).")
        }

        onStage(.reading)
        var finish = metadata
        finish["storagePath"] = signed.storagePath
        let saved: Saved = try await session.api.post("/api/files/upload", body: finish)
        return saved.file
    }

    static func uploadFile(
        at url: URL,
        session: Session,
        onStage: (Stage) -> Void = { _ in }
    ) async throws -> WorkspaceFile {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        return try await upload(data: data, name: url.lastPathComponent, mimeType: mimeType, session: session, onStage: onStage)
    }
}
