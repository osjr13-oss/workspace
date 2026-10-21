import Foundation

nonisolated enum APIError: Error, LocalizedError, Equatable {
    /// The token was revoked from Selrano's Settings, or the account lost access.
    case unauthorized
    case invalidCode
    case rateLimited
    case server(Int)
    case network

    var errorDescription: String? {
        switch self {
        case .unauthorized: "This iPhone is no longer connected. Pair it again from Selrano's Settings."
        case .invalidCode: "That code did not work. Codes last 10 minutes and work once."
        case .rateLimited: "Too many attempts. Wait a minute and try again."
        case .server(let status): "Selrano could not take the update (error \(status)). It will try again later."
        case .network: "Could not reach Selrano. Check your connection."
        }
    }
}

/// The two endpoints the app uses. Nothing else on the server accepts the device token.
nonisolated struct APIClient: Sendable {
    var baseURL: URL
    var session: URLSession = .shared

    static var configured: APIClient {
        let raw = Bundle.main.object(forInfoDictionaryKey: "SelranoBaseURL") as? String
        return APIClient(baseURL: URL(string: raw ?? "") ?? URL(string: "https://www.selrano.com")!)
    }

    /// Exchange the code shown in Selrano's Settings for a device token.
    func claim(code: String, deviceName: String) async throws -> String {
        struct Body: Encodable { var code: String; var deviceName: String }
        struct Reply: Decodable { var token: String }
        let data = try await post("api/health/pair/claim", body: Body(code: code, deviceName: deviceName), token: nil, codeExchange: true)
        guard let reply = try? JSONDecoder().decode(Reply.self, from: data), !reply.token.isEmpty else {
            throw APIError.server(200)
        }
        return reply.token
    }

    func sync(_ payload: SyncPayload, token: String) async throws {
        _ = try await post("api/health/sync", body: payload, token: token, codeExchange: false)
    }

    private func post(_ path: String, body: some Encodable, token: String?, codeExchange: Bool) async throws -> Data {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONEncoder.selrano.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200..<300: return data
        case 401: throw codeExchange ? APIError.invalidCode : APIError.unauthorized
        case 400, 404, 410: throw codeExchange ? APIError.invalidCode : APIError.server(status)
        case 429: throw APIError.rateLimited
        default: throw APIError.server(status)
        }
    }
}
