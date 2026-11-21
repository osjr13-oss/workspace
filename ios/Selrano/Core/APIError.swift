import Foundation

enum APIError: LocalizedError {
    case signedOut
    case server(String)
    case network

    var errorDescription: String? {
        switch self {
        case .signedOut: return "Please sign in again."
        case .server(let message): return message
        case .network: return "Could not reach Selrano. Check your connection and try again."
        }
    }
}
