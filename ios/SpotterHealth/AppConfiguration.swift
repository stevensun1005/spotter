import Foundation

enum AppConfigurationError: LocalizedError {
    case origin

    var errorDescription: String? { "请输入完整的 HTTPS 站点网址，不包含路径、账号或查询参数。" }
}

enum AppNavigationPolicy: Equatable {
    case allow
    case external
    case cancel
}

/// The web app remains the source of training features; this value identifies its trusted origin.
struct AppConfiguration: Equatable, Sendable {
    private static var webRelease: [String: Any]? { Bundle.main.object(forInfoDictionaryKey: "SpotterWebRelease") as? [String: Any] }
    static var defaultOrigin: String { webRelease?["origin"] as? String ?? "https://spotter-duo.stezero.chatgpt.site" }
    let origin: String
    var url: URL { URL(string: origin)! }

    var verifiedWebVersion: Int? {
        guard origin == Self.defaultOrigin else { return nil }
        return Self.webRelease?["version"] as? Int
    }

    init(origin input: String) throws {
        guard var parts = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              parts.scheme?.lowercased() == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/",
              parts.port == nil || (1...65_535).contains(parts.port!) else { throw AppConfigurationError.origin }
        parts.scheme = "https"
        parts.host = host.lowercased()
        parts.path = ""
        if parts.port == 443 { parts.port = nil }
        guard let result = parts.string, URL(string: result) != nil else { throw AppConfigurationError.origin }
        origin = result
    }

    func contains(_ candidate: URL) -> Bool {
        guard let parts = URLComponents(url: candidate, resolvingAgainstBaseURL: false),
              parts.user == nil, parts.password == nil else { return false }
        return parts.scheme?.lowercased() == "https" &&
            parts.host?.lowercased() == url.host?.lowercased() &&
            (parts.port ?? 443) == (url.port ?? 443)
    }

    func ownsBlob(_ candidate: URL) -> Bool {
        guard candidate.scheme?.lowercased() == "blob",
              let embedded = URL(string: String(candidate.absoluteString.dropFirst(5))) else { return false }
        return contains(embedded)
    }

    func navigationPolicy(for candidate: URL, mainFrame: Bool, userActivated: Bool) -> AppNavigationPolicy {
        if contains(candidate) || ownsBlob(candidate) { return .allow }
        let scheme = candidate.scheme?.lowercased()
        if scheme == "about" && !mainFrame { return .allow }
        // Secure automatic redirects may be part of a sign-in flow. They never gain native identity access.
        if scheme == "https", candidate.user == nil, candidate.password == nil {
            return mainFrame && userActivated ? .external : .allow
        }
        if mainFrame && userActivated && ["mailto", "tel"].contains(scheme ?? "") { return .external }
        return .cancel
    }
}
