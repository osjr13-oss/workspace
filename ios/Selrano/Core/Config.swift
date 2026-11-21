import Foundation

/// Where the Selrano server lives. Release builds always use the real site; a Debug
/// build can be pointed elsewhere (a local server) with SELRANO_BASE_URL in the
/// launch environment or in Signing.local.xcconfig.
enum AppConfig {
    static let baseURL: URL = {
        if let override = ProcessInfo.processInfo.environment["SELRANO_BASE_URL"], let url = URL(string: override) {
            return url
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: "SelranoBaseURL") as? String, let url = URL(string: value), !value.isEmpty {
            return url
        }
        return URL(string: "https://www.selrano.com")!
    }()
}
