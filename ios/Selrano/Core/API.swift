import Foundation

/// Calls to the Selrano server (bearer token, same allowlist as the website) and to
/// Supabase's database API (the same rows and row-level security the website reads).
@MainActor
final class API {
    unowned let session: Session

    init(session: Session) {
        self.session = session
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()

    // MARK: Selrano server

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await send(server(path, method: "GET"))
    }

    func post<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await send(server(path, method: "POST", body: body))
    }

    func patch<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await send(server(path, method: "PATCH", body: body))
    }

    func delete(_ path: String) async throws {
        let _: Empty = try await send(server(path, method: "DELETE"))
    }

    /// A raw authorized request to the Selrano server, for streaming.
    func serverRequest(_ path: String, method: String, body: [String: Any]? = nil) async throws -> URLRequest {
        var request = server(path, method: method, body: body)
        request.setValue("Bearer \(try await session.accessToken())", forHTTPHeaderField: "Authorization")
        return request
    }

    private func server(_ path: String, method: String, body: [String: Any]? = nil) -> URLRequest {
        var request = URLRequest(url: URL(string: path, relativeTo: AppConfig.baseURL)!)
        request.httpMethod = method
        request.timeoutInterval = 60
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        return request
    }

    // MARK: Database (Supabase REST, row-level security as the signed-in user)

    /// GET /rest/v1/<table>?<query>
    func rows<T: Decodable>(_ table: String, query: String) async throws -> [T] {
        try await send(try await database(table, query: query, method: "GET"))
    }

    func insert<T: Decodable>(_ table: String, values: [String: Any]) async throws -> T {
        var request = try await database(table, query: "select=*", method: "POST", body: values)
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.setValue("application/vnd.pgrst.object+json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    func update(_ table: String, id: String, values: [String: Any]) async throws {
        let request = try await database(table, query: "id=eq.\(id)", method: "PATCH", body: values)
        let _: Empty = try await send(request)
    }

    func deleteRow(_ table: String, id: String) async throws {
        let request = try await database(table, query: "id=eq.\(id)", method: "DELETE")
        let _: Empty = try await send(request)
    }

    private func database(_ table: String, query: String, method: String, body: [String: Any]? = nil) async throws -> URLRequest {
        let config = try await session.publicConfig()
        var request = URLRequest(url: URL(string: "\(config.supabaseUrl)/rest/v1/\(table)?\(query)")!)
        request.httpMethod = method
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        return request
    }

    // MARK: Sending

    private struct Empty: Decodable {}
    private struct ServerError: Decodable { let error: String?; let message: String? }

    private func send<T: Decodable>(_ base: URLRequest, retried: Bool = false) async throws -> T {
        var request = base
        request.setValue("Bearer \(try await session.accessToken(forceRefresh: retried))", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { throw APIError.network }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            if !retried { return try await send(base, retried: true) }
            session.signOutLocally()
            throw APIError.signedOut
        }
        guard (200..<300).contains(status) else {
            let decoded = try? Self.decoder.decode(ServerError.self, from: data)
            throw APIError.server(decoded?.error ?? decoded?.message ?? "Something went wrong (\(status)).")
        }
        if T.self == Empty.self || data.isEmpty { return try Self.decoder.decode(T.self, from: Data("{}".utf8)) }
        do {
            return try Self.decoder.decode(T.self, from: data)
        } catch {
            throw APIError.server("Selrano sent something this app could not read. Try updating the app.")
        }
    }
}
