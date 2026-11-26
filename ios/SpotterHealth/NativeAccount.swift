import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import Security
import UIKit

struct NativeProfile: Codable, Equatable, Sendable {
    let id: String
    let name: String?

    private enum CodingKeys: String, CodingKey { case id, name }

    init(id: String, name: String?) {
        self.id = id
        self.name = name
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let id = try values.decode(String.self, forKey: .id)
        guard !id.isEmpty, id.utf8.count <= 250 else { throw NativeAPIError.invalidResponse }
        let displayName = try values.decodeIfPresent(String.self, forKey: .name)?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(id: id, name: displayName.flatMap { $0.isEmpty ? nil : $0 })
    }
}

struct NativeProviderStatus: Equatable, Sendable {
    struct Option: Decodable, Equatable, Sendable {
        var enabled = false
        var linked = false
    }

    var apple = Option()
    var google = Option()

    mutating func clearLinks() {
        apple.linked = false
        google.linked = false
    }
}

enum NativeAPIError: LocalizedError {
    case invalidRequest, invalidResponse, accountChanged, keychain, cancelled
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidRequest: return "请求地址无效。"
        case .invalidResponse: return "暂时无法确认服务器返回的结果。请重试。"
        case .accountChanged: return "当前登录已变更，请重试。"
        case .keychain: return "暂时无法访问安全的账号存储。请解锁手机后重试。"
        case .cancelled: return nil
        case .server(_, let message): return message
        }
    }

    var statusCode: Int? {
        if case .server(let status, _) = self { return status }
        return nil
    }
}

private final class NativeNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

private struct NativeSessionVault {
    static let cookieName = "__Host-spotter_session"
    let origin: String

    struct Session: Codable {
        let token: String
        var profile: NativeProfile?
        let expires: Date?
        var verifiedAt: Date?

        func cachedProfile(at now: Date = .now) -> NativeProfile? {
            guard let verifiedAt, verifiedAt <= now,
                  now < (expires ?? verifiedAt.addingTimeInterval(24 * 60 * 60)) else { return nil }
            return profile
        }
    }

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "app.spotter.health.account-session",
         kSecAttrAccount as String: origin,
         kSecAttrSynchronizable as String: false]
    }

    static func isToken(_ value: String) -> Bool {
        value.utf8.count == 64 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    private static func allowsVolatileSession(_ status: OSStatus) -> Bool {
        #if DEBUG && targetEnvironment(simulator)
        // Unsigned simulator builds cannot use Keychain. NativeAPI still keeps the verified session in memory.
        return status == errSecMissingEntitlement
        #else
        return false
        #endif
    }

    func load() throws -> Session? {
        var item = query
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &result)
        if status == errSecItemNotFound || Self.allowsVolatileSession(status) { return nil }
        guard status == errSecSuccess else { throw NativeAPIError.keychain }
        if let data = result as? Data {
            if let session = try? JSONDecoder().decode(Session.self, from: data), Self.isToken(session.token) {
                return session
            }
            if let token = String(data: data, encoding: .utf8), Self.isToken(token) {
                return Session(token: token, profile: nil, expires: nil, verifiedAt: nil)
            }
        }
        try clear()
        return nil
    }

    func save(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess || Self.allowsVolatileSession(status) { return }
        guard status == errSecItemNotFound else { throw NativeAPIError.keychain }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let added = SecItemAdd(item as CFDictionary, nil)
        guard added == errSecSuccess || Self.allowsVolatileSession(added) else { throw NativeAPIError.keychain }
    }

    func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound || Self.allowsVolatileSession(status) else {
            throw NativeAPIError.keychain
        }
    }
}

actor NativeAPI {
    nonisolated let origin: String
    private let vault: NativeSessionVault
    private let session: URLSession
    private let configuration: AppConfiguration
    private var credential: NativeSessionVault.Session?
    private var token: String? { credential?.token }
    private var didReadVault = false
    private var sessionRevision = 0
    private var expired: (@MainActor @Sendable () -> Void)?

    init() {
        guard let configuration = try? AppConfiguration(origin: AppConfiguration.defaultOrigin) else {
            preconditionFailure("The packaged Spotter API must use a valid HTTPS origin.")
        }
        self.configuration = configuration
        self.origin = configuration.origin
        self.vault = NativeSessionVault(origin: configuration.origin)
        let settings = URLSessionConfiguration.ephemeral
        settings.httpShouldSetCookies = false
        settings.httpCookieAcceptPolicy = .never
        settings.httpCookieStorage = nil
        settings.urlCredentialStorage = nil
        settings.urlCache = nil
        self.session = URLSession(configuration: settings, delegate: NativeNoRedirect(), delegateQueue: nil)
    }

    func observeExpiry(_ handler: @escaping @MainActor @Sendable () -> Void) {
        expired = handler
    }

    func request(_ path: String, method: String = "GET", json: Data? = nil) async throws -> Data {
        try await accepted(path, method: method, json: json, cookie: token).data
    }

    func request(_ path: String, method: String, json: Data?, for expectedOwner: String) async throws -> Data {
        guard let cookie = token else { throw NativeAPIError.accountChanged }
        let revision = sessionRevision
        let current = try await profile(cookie: cookie)
        try Task.checkCancellation()
        guard revision == sessionRevision, current.id == expectedOwner else { throw NativeAPIError.accountChanged }
        let result = try await accepted(path, method: method, json: json, cookie: cookie)
        guard revision == sessionRevision else { throw NativeAPIError.accountChanged }
        return result.data
    }

    func loadCachedProfile() throws -> NativeProfile? {
        try readVault()
        return credential?.cachedProfile()
    }

    func loadProfile() async throws -> NativeProfile? {
        try readVault()
        guard let token else { return nil }
        do {
            let account = try await profile(cookie: token)
            if var current = credential, current.token == token {
                current.profile = account
                current.verifiedAt = .now
                credential = current
                try? vault.save(current)
            }
            return account
        }
        catch let error as NativeAPIError where error.statusCode == 401 { return nil }
    }

    private func readVault() throws {
        guard !didReadVault else { return }
        credential = try vault.load()
        didReadVault = true
    }

    fileprivate func finishLogin(_ path: String, body: Data, requireOAuthStatus: Bool) async throws -> NativeProfile {
        guard token == nil else { throw NativeAPIError.accountChanged }
        let result = try await accepted(path, method: "POST", json: body, cookie: nil)
        if requireOAuthStatus {
            let completion = try JSONDecoder().decode(OAuthCompletion.self, from: result.data)
            guard completion.status == NativeOAuthMode.login.completedStatus else { throw NativeAPIError.invalidResponse }
        }
        guard let value = result.response.value(forHTTPHeaderField: "Set-Cookie"), let url = result.response.url,
              let sessionToken = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": value], for: url).first(where: {
                  $0.name == NativeSessionVault.cookieName && $0.isHTTPOnly && $0.isSecure && $0.path == "/" && $0.domain == url.host
              }), NativeSessionVault.isToken(sessionToken.value) else { throw NativeAPIError.invalidResponse }

        // Confirm the account before promoting the new credential to shared requests or persisting it.
        let account = try await profile(cookie: sessionToken.value)
        let credential = NativeSessionVault.Session(token: sessionToken.value, profile: account, expires: sessionToken.expiresDate, verifiedAt: .now)
        try vault.save(credential)
        replaceCredential(credential)
        return account
    }

    fileprivate func finishLink(_ path: String, body: Data) async throws {
        guard token != nil else { throw NativeAPIError.accountChanged }
        let data = try await request(path, method: "POST", json: body)
        guard try JSONDecoder().decode(OAuthCompletion.self, from: data).status == NativeOAuthMode.link.completedStatus else {
            throw NativeAPIError.invalidResponse
        }
    }

    // Local sign-out takes effect even if the server is temporarily unreachable.
    fileprivate func signOut(didClear: @MainActor @Sendable () -> Void) async throws -> Bool {
        try vault.clear()
        let previous = token
        replaceCredential(nil)
        await didClear()
        guard let previous else { return true }
        do {
            let result = try await send("/api/auth/sign-out", method: "POST", json: nil, cookie: previous)
            return result.response.statusCode == 303 && result.response.value(forHTTPHeaderField: "Location") == "/"
        } catch { return false }
    }

    private struct ProfileResponse: Decodable { let me: NativeProfile }
    private struct OAuthCompletion: Decodable { let status: String }
    private struct Problem: Decodable { let error: String }

    private func profile(cookie: String) async throws -> NativeProfile {
        let result = try await accepted("/api/state", method: "GET", json: nil, cookie: cookie)
        return try JSONDecoder().decode(ProfileResponse.self, from: result.data).me
    }

    private func replaceCredential(_ value: NativeSessionVault.Session?) {
        credential = value
        didReadVault = true
        sessionRevision &+= 1
    }

    private func accepted(_ path: String, method: String, json: Data?, cookie: String?) async throws -> (data: Data, response: HTTPURLResponse) {
        let result = try await send(path, method: method, json: json, cookie: cookie)
        let status = result.response.statusCode
        if status == 401, let cookie, cookie == token {
            try? vault.clear()
            replaceCredential(nil)
            await expired?()
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(Problem.self, from: result.data))?.error
            throw NativeAPIError.server(status: status, message: message.map { String($0.prefix(300)) } ?? "服务器暂时无法处理此请求。")
        }
        return result
    }

    private func send(_ path: String, method: String, json: Data?, cookie: String?) async throws -> (data: Data, response: HTTPURLResponse) {
        guard path.hasPrefix("/api/"), path.utf8.count <= 8_192,
              !path.contains("\\"), path.rangeOfCharacter(from: .controlCharacters) == nil,
              let parts = URLComponents(string: origin + path), parts.fragment == nil,
              parts.percentEncodedPath.split(separator: "/", omittingEmptySubsequences: false).dropFirst().allSatisfy({ segment in
                  guard let decoded = segment.removingPercentEncoding else { return false }
                  return !decoded.isEmpty && decoded != "." && decoded != ".." && !decoded.contains("/") && !decoded.contains("\\")
              }), ["GET", "POST", "PUT", "PATCH", "DELETE"].contains(method) else { throw NativeAPIError.invalidRequest }

        let betaSocialEnabled = Bundle.main.object(forInfoDictionaryKey: "SpotterBetaSocialAPIEnabled") as? String == "YES"
        let destination = configuration.betaSocialAPI(for: parts.percentEncodedPath, enabled: betaSocialEnabled) ?? configuration
        let route = parts.percentEncodedPath + (parts.percentEncodedQuery.map { "?" + $0 } ?? "")
        guard let url = URL(string: destination.origin + route), destination.contains(url) else { throw NativeAPIError.invalidRequest }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 35)
        request.httpMethod = method
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if origin == "https://spotter-free.couple-ledger-service.workers.dev" {
            let versionKey: String?
            switch (parts.path, method) {
            case ("/api/ai-coach", _):
                versionKey = "SpotterInternalCoachWorkerVersion"
            case ("/api/notifications", _), ("/api/workout", "POST"):
                // The check-in writer and inbox use the same internal Worker version.
                versionKey = "SpotterInternalNotificationsWorkerVersion"
            default:
                versionKey = nil
            }
            if let versionKey, let value = Bundle.main.object(forInfoDictionaryKey: versionKey) as? String,
               let version = UUID(uuidString: value) {
                request.setValue("spotter-free=\"\(version.uuidString.lowercased())\"", forHTTPHeaderField: "Cloudflare-Workers-Version-Overrides")
            }
        }
        if let cookie { request.setValue("\(NativeSessionVault.cookieName)=\(cookie)", forHTTPHeaderField: "Cookie") }
        if method != "GET" { request.setValue(destination.origin, forHTTPHeaderField: "Origin") }
        if let json {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = json
        }
        let revision = sessionRevision
        let (data, response) = try await session.data(for: request)
        guard revision == sessionRevision else { throw NativeAPIError.accountChanged }
        guard let http = response as? HTTPURLResponse, let url = http.url, destination.contains(url) else {
            throw NativeAPIError.invalidResponse
        }
        return (data, http)
    }
}

@MainActor
final class NativeAccount: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    let api: NativeAPI
    @Published private(set) var profile: NativeProfile?
    @Published private(set) var providerStatus = NativeProviderStatus()
    @Published private(set) var isBusy = false
    @Published private(set) var isRestoring = true
    /// The saved session could not be read, usually because iOS woke the app while the phone was locked.
    @Published private(set) var isSessionLocked = false
    @Published private(set) var errorMessage: String?

    private var provisionedHandleOwner: String?
    private var browser: ASWebAuthenticationSession?
    private var browserWindow: ASPresentationAnchor?
    private var browserFlow: (id: UUID, completion: CheckedContinuation<URL, Error>)?

    init(api: NativeAPI = NativeAPI()) { self.api = api; super.init() }

    func restore() async {
        guard !isBusy else { return }
        isRestoring = profile == nil
        defer { isRestoring = false }
        await perform {
            await api.observeExpiry { [weak self] in
                self?.clearProfile()
                self?.errorMessage = "登录已过期，请重新登录。"
            }
            if profile == nil {
                do {
                    if let cached = try await api.loadCachedProfile() {
                        profile = cached
                        isRestoring = false
                    }
                    isSessionLocked = false
                } catch NativeAPIError.keychain {
                    // Keychain items are unreadable until the phone is unlocked. This is not a sign-out.
                    isSessionLocked = true
                    throw NativeAPIError.keychain
                }
            }
            do {
                let refreshed = try await api.loadProfile()
                if refreshed == nil { clearProfile() }
                else if profile != refreshed { profile = refreshed }
            } catch {
                guard profile != nil else {
                    try? await refreshProviderStatus()
                    throw error
                }
                return
            }
            if profile == nil { providerStatus.clearLinks() }
            try await refreshProviderStatus()
        }
    }

    func signIn(email: String, accessCode: String, allowAI: Bool = false) async {
        await perform {
            let entry = AccessCodeSignIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                         accessCode: accessCode.trimmingCharacters(in: .whitespacesAndNewlines))
            let signedIn = try await api.finishLogin("/api/auth/sign-in", body: JSONEncoder().encode(entry), requireOAuthStatus: false)
            if allowAI { NativeCoachConsent.allow(owner: signedIn.id) }
            profile = signedIn
            try await refreshProviderStatus()
        }
    }

    func signInApple(allowAI: Bool = false) async { await oauth(.apple, mode: .login, allowAI: allowAI) }
    func signInGoogle(allowAI: Bool = false) async { await oauth(.google, mode: .login, allowAI: allowAI) }
    func linkApple() async { await oauth(.apple, mode: .link) }
    func linkGoogle() async { await oauth(.google, mode: .link) }

    func signOut() async {
        await perform {
            let revoked = try await api.signOut { [weak self] in self?.clearProfile() }
            if !revoked { errorMessage = "已在此手机退出，暂时无法通知服务器。" }
        }
    }

    func clearError() { errorMessage = nil }

    func useConfirmedName(_ name: String, for owner: String) throws {
        guard let profile, profile.id == owner else { throw NativeAPIError.accountChanged }
        if profile.name != name { self.profile = NativeProfile(id: owner, name: name) }
    }

    func ensureAccountHandle(for owner: String) async {
        guard profile?.id == owner, provisionedHandleOwner != owner else { return }
        do {
            // The existing API provisions the account's username if missing.
            // It preserves any explicitly saved discovery setting.
            _ = try await api.request("/api/auth/profile", method: "GET", json: nil, for: owner)
            guard !Task.isCancelled, profile?.id == owner else { return }
            provisionedHandleOwner = owner
        } catch {
            // Retry on the next foreground entry without blocking sign-in.
        }
    }

    private func clearProfile() {
        profile = nil
        provisionedHandleOwner = nil
        providerStatus.clearLinks()
    }

    private struct StatusResponse: Decodable {
        struct Providers: Decodable { let apple: NativeProviderStatus.Option; let google: NativeProviderStatus.Option }
        let providers: Providers
        let nativeAppleEnabled: Bool?
    }

    private func refreshProviderStatus() async throws {
        let data = try await api.request("/api/auth/oauth")
        let status = try JSONDecoder().decode(StatusResponse.self, from: data)
        providerStatus = NativeProviderStatus(
            apple: .init(enabled: status.nativeAppleEnabled ?? false, linked: profile != nil && status.providers.apple.linked),
            google: .init(enabled: status.providers.google.enabled, linked: profile != nil && status.providers.google.linked))
    }

    private struct AccessCodeSignIn: Encodable { let email: String; let accessCode: String }
    private struct FlowStart: Encodable {
        let mode: String
        let challenge: String
        let expectedOwner: String?
        let provider: String?
    }
    private struct AppleChallenge: Decodable { let state: String; let nonce: String }
    private struct GoogleChallenge: Decodable { let authorizationUrl: URL }
    private struct FlowCompletion: Encodable { let code: String; let verifier: String; let state: String? }

    private func oauth(_ provider: NativeOAuthProvider, mode: NativeOAuthMode, allowAI: Bool = false) async {
        await perform {
            let owner = profile?.id
            guard (mode == .link) == (owner != nil) else { throw NativeAPIError.accountChanged }
            guard let window = Self.activeWindow() else { throw NativeAPIError.invalidResponse }
            let verifier = try Self.newVerifier()
            let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
            let body = try JSONEncoder().encode(FlowStart(mode: mode.rawValue, challenge: challenge,
                                                          expectedOwner: owner, provider: provider == .google ? provider.rawValue : nil))
            let endpoint: String
            let completion: FlowCompletion
            switch provider {
            case .apple:
                let challenge = try await api.request("/api/auth/oauth/apple/app/start", method: "POST", json: body)
                let flow = try JSONDecoder().decode(AppleChallenge.self, from: challenge)
                guard Self.isOpaqueToken(flow.state), Self.isOpaqueToken(flow.nonce) else { throw NativeAPIError.invalidResponse }
                let apple = NativeAppleAuthorization(window: window)
                let code = try await apple.authorize(state: flow.state, nonce: flow.nonce)
                completion = FlowCompletion(code: code, verifier: verifier, state: flow.state)
                endpoint = "/api/auth/oauth/apple/app/complete"
            case .google:
                let challenge = try await api.request("/api/auth/oauth/start", method: "POST", json: body)
                let flow = try JSONDecoder().decode(GoogleChallenge.self, from: challenge)
                guard provider.acceptsAuthorizationURL(flow.authorizationUrl) else { throw NativeAPIError.invalidResponse }
                let callbackURL = try await authorizeGoogle(url: flow.authorizationUrl, window: window)
                guard let callback = NativeOAuthCallback(url: callbackURL) else { throw NativeAPIError.invalidResponse }
                switch callback {
                case .code(let code): completion = FlowCompletion(code: code, verifier: verifier, state: nil)
                case .cancelled: throw NativeAPIError.cancelled
                case .failed(let reason): throw Self.oauthError(reason)
                }
                endpoint = "/api/auth/oauth/native/complete"
            }
            guard profile?.id == owner else { throw NativeAPIError.accountChanged }
            let result = try JSONEncoder().encode(completion)
            switch mode {
            case .login:
                let signedIn = try await api.finishLogin(endpoint, body: result, requireOAuthStatus: true)
                if allowAI { NativeCoachConsent.allow(owner: signedIn.id) }
                profile = signedIn
            case .link: try await api.finishLink(endpoint, body: result)
            }
            try await refreshProviderStatus()
        }
    }

    private func perform(_ operation: () async throws -> Void) async {
        guard !isBusy else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do { try await operation() }
        catch NativeAPIError.cancelled { }
        catch is CancellationError { }
        catch let error as NativeAPIError { errorMessage = error.errorDescription }
        catch let error as URLError where error.code == .cancelled { }
        catch { errorMessage = "暂时无法完成账号操作，请检查网络后重试。" }
    }

    private func authorizeGoogle(url: URL, window: ASPresentationAnchor) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let id = UUID()
            browserFlow = (id, continuation)
            browserWindow = window
            let handler: ASWebAuthenticationSession.CompletionHandler = { [weak self] url, error in
                Task { @MainActor in
                    if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                        self?.finishGoogle(id, .failure(NativeAPIError.cancelled))
                    } else if let url, error == nil { self?.finishGoogle(id, .success(url)) }
                    else { self?.finishGoogle(id, .failure(NativeAPIError.invalidResponse)) }
                }
            }
            if #available(iOS 17.4, *) {
                browser = ASWebAuthenticationSession(url: url, callback: .customScheme(NativeOAuthCallback.scheme), completionHandler: handler)
            } else {
                browser = ASWebAuthenticationSession(url: url, callbackURLScheme: NativeOAuthCallback.scheme, completionHandler: handler)
            }
            browser?.presentationContextProvider = self
            if browser?.start() != true { finishGoogle(id, .failure(NativeAPIError.invalidResponse)) }
        }
    }

    private func finishGoogle(_ id: UUID, _ result: Result<URL, Error>) {
        guard let flow = browserFlow, flow.id == id else { return }
        browserFlow = nil
        browser = nil
        browserWindow = nil
        flow.completion.resume(with: result)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        browserWindow ?? ASPresentationAnchor()
    }

    private static func activeWindow() -> ASPresentationAnchor? {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive && $0.keyWindow != nil }?.keyWindow
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private static func newVerifier() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw NativeAPIError.invalidRequest
        }
        return base64URL(Data(bytes))
    }

    private static func isOpaqueToken(_ value: String) -> Bool {
        value.utf8.count == 43 && value.utf8.allSatisfy { (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95 }
    }

    private static func oauthError(_ reason: String) -> NativeAPIError {
        switch reason {
        case "use-access-code": return .server(status: 409, message: "这个邮箱已有训练搭子账号。请先用现有方式登录，再到账号设置绑定。")
        case "link-conflict": return .server(status: 409, message: "这个登录方式已绑定到另一个训练搭子账号。")
        case "link-already-bound": return .server(status: 409, message: "当前账号已经绑定此登录方式。")
        case "oauth-expired", "link-expired": return .server(status: 400, message: "此次账号操作已过期，请重新发起。")
        default: return .server(status: 400, message: "登录或绑定未完成，请重试。")
        }
    }
}

@MainActor
private final class NativeAppleAuthorization: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let window: ASPresentationAnchor
    private var state: String?
    private var controller: ASAuthorizationController?
    private var pending: CheckedContinuation<String, Error>?

    init(window: ASPresentationAnchor) { self.window = window }

    func authorize(state: String, nonce: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            pending = continuation
            self.state = state
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.email]
            request.state = state
            request.nonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            self.controller = controller
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { window }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let state, credential.state == state, let raw = credential.authorizationCode,
              let code = String(data: raw, encoding: .utf8), !code.isEmpty, code.utf8.count <= 4_096 else {
            finish(.failure(NativeAPIError.invalidResponse))
            return
        }
        finish(.success(code))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let wasCancelled = (error as? ASAuthorizationError)?.code == .canceled
        finish(.failure(wasCancelled ? NativeAPIError.cancelled : NativeAPIError.invalidResponse))
    }

    private func finish(_ result: Result<String, Error>) {
        let continuation = pending
        pending = nil
        controller = nil
        state = nil
        continuation?.resume(with: result)
    }
}
