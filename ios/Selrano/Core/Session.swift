import Foundation
import Observation

nonisolated struct StoredSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
}

nonisolated struct PublicConfig: Codable {
    let supabaseUrl: String
    let supabaseAnonKey: String
}

nonisolated struct Me: Codable {
    let id: String
    let email: String?
    let fullName: String
}

/// The signed-in account. Signs in with Supabase directly, keeps the session in the
/// Keychain, refreshes it before it expires, and confirms with Selrano that the
/// account is allowed in (the server's private allowlist).
@Observable
final class Session {
    enum State { case loading, signedOut, signedIn }

    private(set) var state: State = .loading
    private(set) var me: Me?
    private var stored: StoredSession?
    private var config: PublicConfig?
    private var refreshing: Task<StoredSession, Error>?

    var firstName: String {
        me?.fullName.split(separator: " ").first.map(String.init) ?? ""
    }

    private static let account = "session"

    func restore() async {
        guard let data = Keychain.load(account: Self.account), let saved = try? JSONDecoder().decode(StoredSession.self, from: data) else {
            state = .signedOut
            return
        }
        stored = saved
        do {
            me = try await api.get("/api/me")
            state = .signedIn
        } catch APIError.signedOut {
            signOutLocally()
        } catch {
            // Offline: stay signed in with what we have; screens show their own errors.
            state = .signedIn
        }
    }

    func signIn(email: String, password: String) async throws {
        let config = try await publicConfig()
        var request = URLRequest(url: URL(string: "\(config.supabaseUrl)/auth/v1/token?grant_type=password")!)
        request.httpMethod = "POST"
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email.trimmingCharacters(in: .whitespaces), "password": password])
        let session = try await tokenRequest(request)
        save(session)
        do {
            me = try await api.get("/api/me")
        } catch APIError.signedOut {
            signOutLocally()
            throw APIError.server("This Selrano is private, and that account is not on the list.")
        }
        state = .signedIn
    }

    func signOut() {
        if let token = stored?.accessToken, let config {
            var request = URLRequest(url: URL(string: "\(config.supabaseUrl)/auth/v1/logout?scope=local")!)
            request.httpMethod = "POST"
            request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            Task { _ = try? await URLSession.shared.data(for: request) }
        }
        signOutLocally()
    }

    func signOutLocally() {
        Keychain.delete(account: Self.account)
        stored = nil
        me = nil
        state = .signedOut
    }

    /// A valid access token, refreshed first when it is about to expire.
    func accessToken(forceRefresh: Bool = false) async throws -> String {
        guard let current = stored else { throw APIError.signedOut }
        if !forceRefresh, current.expiresAt.timeIntervalSinceNow > 60 { return current.accessToken }
        if let refreshing { return try await refreshing.value.accessToken }
        let task = Task { () throws -> StoredSession in
            let config = try await publicConfig()
            var request = URLRequest(url: URL(string: "\(config.supabaseUrl)/auth/v1/token?grant_type=refresh_token")!)
            request.httpMethod = "POST"
            request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["refresh_token": current.refreshToken])
            return try await tokenRequest(request)
        }
        refreshing = task
        defer { refreshing = nil }
        do {
            let next = try await task.value
            save(next)
            return next.accessToken
        } catch APIError.signedOut {
            signOutLocally()
            throw APIError.signedOut
        }
    }

    func publicConfig() async throws -> PublicConfig {
        if let config { return config }
        let url = AppConfig.baseURL.appending(path: "/api/app/config")
        guard let (data, response) = try? await URLSession.shared.data(from: url) else { throw APIError.network }
        guard (response as? HTTPURLResponse)?.statusCode == 200, let decoded = try? JSONDecoder().decode(PublicConfig.self, from: data) else {
            throw APIError.server("Selrano is not answering right now. Try again in a moment.")
        }
        config = decoded
        return decoded
    }

    private func tokenRequest(_ request: URLRequest) async throws -> StoredSession {
        struct TokenResponse: Codable {
            let access_token: String
            let refresh_token: String
            let expires_in: Double
        }
        struct TokenError: Codable { let error_description: String?; let msg: String? }
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { throw APIError.network }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 400 || status == 401 {
            if request.url?.query?.contains("refresh_token") == true { throw APIError.signedOut }
            let message = (try? JSONDecoder().decode(TokenError.self, from: data)).flatMap { $0.error_description ?? $0.msg }
            throw APIError.server(message == "Invalid login credentials" ? "That email and password do not match." : (message ?? "Could not sign in."))
        }
        guard status == 200, let token = try? JSONDecoder().decode(TokenResponse.self, from: data) else {
            throw APIError.server("Could not sign in. Try again in a moment.")
        }
        return StoredSession(accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date().addingTimeInterval(token.expires_in))
    }

    private func save(_ session: StoredSession) {
        stored = session
        if let data = try? JSONEncoder().encode(session) { Keychain.save(data, account: Self.account) }
    }

    @ObservationIgnored lazy var api = API(session: self)
}
