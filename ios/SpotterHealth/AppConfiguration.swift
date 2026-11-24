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

enum NativeOAuthProvider: String {
    case apple, google

    func acceptsAuthorizationURL(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.port == nil || parts.port == 443,
              parts.user == nil, parts.password == nil, parts.fragment == nil else { return false }
        switch self {
        case .apple: return parts.host == "appleid.apple.com" && parts.percentEncodedPath == "/auth/authorize"
        case .google: return parts.host == "accounts.google.com" && parts.percentEncodedPath == "/o/oauth2/v2/auth"
        }
    }
}

enum NativeOAuthMode: String {
    case login, link

    var completedStatus: String { self == .login ? "signed-in" : "linked" }
}

enum NativeOAuthCallback: Equatable {
    case code(String), cancelled, failed(String)

    static let scheme = "spotter-auth"

    init?(url: URL) {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == Self.scheme, parts.host == "oauth", parts.percentEncodedPath == "/complete",
              parts.port == nil, parts.user == nil, parts.password == nil, parts.fragment == nil,
              let items = parts.queryItems, items.count == 1, let value = items[0].value else { return nil }
        switch items[0].name {
        case "code" where value.utf8.count == 43 && value.utf8.allSatisfy(Self.codeCharacter):
            self = .code(value)
        case "error" where value == "oauth-cancelled" || value == "link-cancelled":
            self = .cancelled
        case "error" where ["oauth-expired", "oauth-error", "use-access-code", "link-expired", "link-error",
                            "link-conflict", "link-already-bound"].contains(value):
            self = .failed(value)
        default: return nil
        }
    }

    private static func codeCharacter(_ byte: UInt8) -> Bool {
        (65...90).contains(byte) || (97...122).contains(byte) || (48...57).contains(byte) || byte == 45 || byte == 95
    }
}

struct NativeOAuthIntent: Equatable {
    private static let prefix = "/api/auth/oauth/"
    let provider: NativeOAuthProvider
    let mode: NativeOAuthMode
    let expectedOwner: String?

    static func provider(for url: URL) -> NativeOAuthProvider? {
        guard let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedPath else { return nil }
        if path == prefix + "apple/native" { return .apple }
        if path == prefix + "google/native" { return .google }
        return nil
    }

    init?(url: URL, sourceURL: URL?, configuration: AppConfiguration, mainFrame: Bool, userActivated: Bool) {
        guard mainFrame, userActivated, configuration.origin == AppConfiguration.defaultOrigin,
              configuration.contains(url), let sourceURL, configuration.contains(sourceURL),
              let provider = Self.provider(for: url), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.fragment == nil, let query = parts.queryItems,
              let modeItem = query.first(where: { $0.name == "mode" }),
              let value = modeItem.value, let mode = NativeOAuthMode(rawValue: value) else { return nil }
        let owner: String?
        switch mode {
        case .login:
            guard query.count == 1 else { return nil }
            owner = nil
        case .link:
            guard query.count == 2, let candidate = query.first(where: { $0.name == "expectedOwner" })?.value,
                  !candidate.isEmpty, candidate.utf16.count <= 120,
                  candidate == candidate.trimmingCharacters(in: .whitespacesAndNewlines),
                  candidate.rangeOfCharacter(from: .controlCharacters) == nil else { return nil }
            owner = candidate
        }
        self.provider = provider
        self.mode = mode
        expectedOwner = owner
    }
}

/// The web app remains the source of training features; this value identifies its trusted origin.
struct AppConfiguration: Equatable, Sendable {
    private static var webRelease: [String: Any]? { Bundle.main.object(forInfoDictionaryKey: "SpotterWebRelease") as? [String: Any] }
    static var defaultOrigin: String { webRelease?["origin"] as? String ?? "https://spotter-free.couple-ledger-service.workers.dev" }
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
