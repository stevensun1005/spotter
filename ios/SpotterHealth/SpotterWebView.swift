import AuthenticationServices
import Combine
import CryptoKit
import Foundation
import Security
import SwiftUI
import WebKit

@MainActor
final class SpotterWebModel: NSObject, ObservableObject {
    @Published private(set) var configuration: AppConfiguration
    @Published private(set) var isLoading = false
    @Published private(set) var progress = 0.0
    @Published private(set) var canGoBack = false
    @Published private(set) var errorMessage: String?
    @Published var oauthErrorMessage: String?
    @Published private(set) var currentURL: URL?
    @Published private(set) var pendingShareURL: URL?
    let session: AppSession

    var accountId: String? { session.healthAccount?.accountId }
    var accountOrigin: String? { session.healthAccount?.origin }

    private var webView: WKWebView?
    private var observations: [NSKeyValueObservation] = []
    private var sessionChanges: AnyCancellable?
    private var downloads: [ObjectIdentifier: URL] = [:]
    private var oauthAttempt: UUID?
    private var oauthSession: ASWebAuthenticationSession?
    private var oauthWindow: ASPresentationAnchor?

    init(configuration: AppConfiguration, session: AppSession? = nil) {
        self.configuration = configuration
        self.session = session ?? AppSession()
        super.init()
        sessionChanges = self.session.objectWillChange.sink { [weak self] in self?.objectWillChange.send() }
        self.session.identityVerifier = { [weak self] in await self?.readCurrentIdentity() }
    }

    fileprivate func makeWebView() -> WKWebView {
        if let webView { return webView }
        let settings = WKWebViewConfiguration()
        settings.websiteDataStore = .default()
        settings.defaultWebpagePreferences.preferredContentMode = .mobile
        settings.applicationNameForUserAgent = "Spotter/1.0 SpotterOAuth/1"
        settings.allowsInlineMediaPlayback = true
        settings.userContentController.addUserScript(WKUserScript(
            source: SpotterWebAppearance.liquidGlassScript(trustedOrigin: AppConfiguration.defaultOrigin),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true,
            in: .world(name: "SpotterAppearance")
        ))
        let view = WKWebView(frame: .zero, configuration: settings)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.isOpaque = false
        view.backgroundColor = .systemBackground
        #if DEBUG
        if #available(iOS 16.4, *) { view.isInspectable = true }
        #endif
        webView = view
        observations = [
            view.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                let value = view.estimatedProgress
                Task { @MainActor [weak self] in self?.progress = value }
            },
            view.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor [weak self] in self?.updateNavigationState(view) }
            },
            view.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.currentURL = view.url
                    self.updateNavigationState(view)
                    self.refreshIdentity()
                }
            },
        ]
        view.load(URLRequest(url: configuration.url, cachePolicy: .reloadRevalidatingCacheData))
        return view
    }

    func load(configuration next: AppConfiguration) {
        guard next != configuration else { return }
        cancelNativeOAuth()
        session.clearIdentity()
        configuration = next
        currentURL = nil
        errorMessage = nil
        canGoBack = false
        webView?.stopLoading()
        webView?.load(URLRequest(url: next.url, cachePolicy: .reloadRevalidatingCacheData))
    }

    func reload() {
        cancelNativeOAuth()
        session.clearIdentity()
        errorMessage = nil
        guard let webView else { return }
        if let url = webView.url, configuration.contains(url) || url.scheme == "https" { webView.reload() }
        else { webView.load(URLRequest(url: configuration.url, cachePolicy: .reloadRevalidatingCacheData)) }
    }

    func goBack() {
        guard let webView,
              let item = webView.backForwardList.backList.last(where: { configuration.contains($0.url) }) else { return }
        cancelNativeOAuth()
        session.clearIdentity()
        errorMessage = nil
        webView.go(to: item)
    }

    private func updateNavigationState(_ webView: WKWebView) {
        canGoBack = webView.backForwardList.backList.contains { configuration.contains($0.url) }
    }

    /// No script message handler is registered. Only this native-initiated main-frame read can provide identity.
    func refreshIdentity() {
        session.clearIdentity()
        let revision = session.identityRevision
        Task { @MainActor [weak self] in
            guard let self, let account = await self.readCurrentIdentity() else { return }
            self.session.acceptIdentity(account, forRevision: revision)
        }
    }

    private func readCurrentIdentity() async -> ExpectedHealthAccount? {
        guard let webView, !webView.isLoading, let current = webView.url, configuration.contains(current) else { return nil }
        let expectedOrigin = configuration.origin
        let script = """
        if (window.top !== window || window.location.origin !== expectedOrigin) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch('/api/state', {credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal, headers: {'Accept': 'application/json'}});
          if (!response.ok || new URL(response.url).origin !== expectedOrigin) return null;
          const state = await response.json();
          const accountId = state && state.me && state.me.id;
          if (typeof accountId !== 'string' || accountId.length < 1 || accountId.length > 200) return null;
          return {origin: window.location.origin, accountId};
        } catch (_) { return null; }
        finally { clearTimeout(timer); }
        """
        return await withCheckedContinuation { continuation in
            webView.callAsyncJavaScript(script, arguments: ["expectedOrigin": expectedOrigin], in: nil, in: .page) { [weak self, weak webView] result in
                guard let self, let webView, self.webView === webView,
                      self.configuration.origin == expectedOrigin, let url = webView.url, self.configuration.contains(url),
                      case .success(let raw) = result, let value = raw as? [String: Any],
                      value["origin"] as? String == expectedOrigin, let accountId = value["accountId"] as? String,
                      !accountId.isEmpty, accountId.count <= 200 else { continuation.resume(returning: nil); return }
                continuation.resume(returning: ExpectedHealthAccount(origin: expectedOrigin, accountId: accountId))
            }
        }
    }

    func clearSharedFile() {
        if let pendingShareURL { try? FileManager.default.removeItem(at: pendingShareURL.deletingLastPathComponent()) }
        pendingShareURL = nil
    }

    private func failNavigation(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        isLoading = false
        session.clearIdentity()
        if (error as NSError).code == NSURLErrorNotConnectedToInternet {
            errorMessage = "网络未连接。联网后重试；已打开训练的草稿仍按原有规则保存在此设备。"
        } else {
            errorMessage = "页面暂时无法打开，请检查网络或站点网址后重试。"
        }
    }

    private func external(_ url: URL) {
        UIApplication.shared.open(url)
    }

    private func cancelNativeOAuth() {
        oauthAttempt = nil
        let previous = oauthSession
        oauthSession = nil
        oauthWindow = nil
        previous?.cancel()
    }

    private func oauthIsCurrent(_ id: UUID, in view: WKWebView) -> Bool {
        oauthAttempt == id && webView === view && configuration.origin == AppConfiguration.defaultOrigin
            && !view.isLoading && view.url.map(configuration.contains) == true
    }

    private static func base64URL(_ bytes: Data) -> String {
        bytes.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private func startNativeOAuth(_ intent: NativeOAuthIntent, in view: WKWebView) {
        guard oauthAttempt == nil, let anchor = view.window else { return }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            oauthErrorMessage = "暂时无法安全启动登录，请重试。"
            return
        }
        let verifier = Self.base64URL(Data(bytes))
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        let id = UUID()
        guard !view.isLoading else {
            oauthErrorMessage = "请等当前页面加载完成后重试。"
            return
        }
        oauthAttempt = id
        oauthWindow = anchor
        oauthErrorMessage = nil
        Task { @MainActor [weak self, weak view] in
            guard let self, let view else { return }
            do {
                var body = ["provider": intent.provider.rawValue, "mode": intent.mode.rawValue, "challenge": challenge]
                if let owner = intent.expectedOwner { body["expectedOwner"] = owner }
                let result = try await self.nativeOAuthPOST("/api/auth/oauth/start", body: body, id: id, in: view)
                guard let rawURL = result["authorizationUrl"] as? String, let url = URL(string: rawURL),
                      intent.provider.acceptsAuthorizationURL(url) else { throw NativeOAuthError.invalidResponse }
                self.presentNativeOAuth(url, verifier: verifier, intent: intent, id: id, in: view)
            } catch {
                self.failNativeOAuth(id, message: (error as? NativeOAuthError)?.message ?? "暂时无法启动登录，请重试。")
            }
        }
    }

    private func presentNativeOAuth(_ url: URL, verifier: String, intent: NativeOAuthIntent, id: UUID, in view: WKWebView) {
        guard oauthIsCurrent(id, in: view) else {
            if oauthAttempt == id { cancelNativeOAuth() }
            return
        }
        let handler: ASWebAuthenticationSession.CompletionHandler = { [weak self, weak view] url, error in
            Task { @MainActor in
                guard let self, let view else { return }
                await self.finishNativeOAuth(url, error: error, verifier: verifier, intent: intent, id: id, in: view)
            }
        }
        let auth: ASWebAuthenticationSession
        if #available(iOS 17.4, *) {
            auth = ASWebAuthenticationSession(url: url, callback: .customScheme(NativeOAuthCallback.scheme), completionHandler: handler)
        } else {
            auth = ASWebAuthenticationSession(url: url, callbackURLScheme: NativeOAuthCallback.scheme, completionHandler: handler)
        }
        auth.presentationContextProvider = self
        oauthSession = auth
        if !auth.start() { failNativeOAuth(id, message: "暂时无法打开系统登录窗口，请重试。") }
    }

    private func finishNativeOAuth(_ url: URL?, error: Error?, verifier: String, intent: NativeOAuthIntent, id: UUID, in view: WKWebView) async {
        guard oauthIsCurrent(id, in: view) else {
            if oauthAttempt == id { cancelNativeOAuth() }
            return
        }
        oauthSession = nil
        if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
            cancelNativeOAuth()
            return
        }
        guard error == nil, let url, let callback = NativeOAuthCallback(url: url) else {
            failNativeOAuth(id, message: NativeOAuthError.invalidResponse.message)
            return
        }
        switch callback {
        case .cancelled:
            cancelNativeOAuth()
        case let .failed(reason):
            failNativeOAuth(id, message: NativeOAuthError.provider(reason).message)
        case let .code(code):
            session.clearIdentity()
            do {
                let result = try await nativeOAuthPOST("/api/auth/oauth/native/complete", body: ["code": code, "verifier": verifier], id: id, in: view)
                guard result["status"] as? String == intent.mode.completedStatus,
                      let destination = URL(string: intent.mode == .link ? "/?auth=linked" : "/", relativeTo: configuration.url)?.absoluteURL else {
                    throw NativeOAuthError.invalidResponse
                }
                cancelNativeOAuth()
                view.load(URLRequest(url: destination, cachePolicy: .reloadRevalidatingCacheData))
            } catch {
                failNativeOAuth(id, message: (error as? NativeOAuthError)?.message ?? NativeOAuthError.invalidResponse.message)
                refreshIdentity()
            }
        }
    }

    private func failNativeOAuth(_ id: UUID, message: String) {
        guard oauthAttempt == id else { return }
        cancelNativeOAuth()
        oauthErrorMessage = message
    }

    private func nativeOAuthPOST(_ path: String, body: [String: String], id: UUID, in view: WKWebView) async throws -> [String: Any] {
        guard oauthIsCurrent(id, in: view) else { throw NativeOAuthError.invalidResponse }
        let script = """
        if (window.top !== window || window.location.origin !== expectedOrigin) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(path, {
            method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
            headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
            body: JSON.stringify(payload), signal: controller.signal
          });
          if (new URL(response.url).origin !== expectedOrigin) return null;
          return {ok: response.ok, value: await response.json()};
        } catch (_) { return null; }
        finally { clearTimeout(timer); }
        """
        let raw = try await view.callAsyncJavaScript(script,
            arguments: ["path": path, "payload": body, "expectedOrigin": configuration.origin],
            in: nil, contentWorld: .world(name: "SpotterNativeOAuth"))
        guard oauthIsCurrent(id, in: view), let result = raw as? [String: Any],
              let ok = result["ok"] as? Bool, let value = result["value"] as? [String: Any] else {
            throw NativeOAuthError.invalidResponse
        }
        if !ok { throw NativeOAuthError.provider(value["code"] as? String ?? "") }
        return value
    }
}

private enum NativeOAuthError: Error {
    case invalidResponse, provider(String)

    var message: String {
        switch self {
        case .provider("use-access-code"):
            return "请先用现有访问码登录，再到个人设置绑定 Apple 或 Google。"
        case .provider("link-conflict"):
            return "这个登录方式已关联到另一个训练搭子账号。"
        case .provider("link-already-bound"):
            return "你的训练搭子账号已经绑定了此登录方式。"
        case .provider("oauth-expired"), .provider("link-expired"):
            return "本次操作已过期，请重新发起。"
        default:
            return "登录或绑定未完成，请重试。"
        }
    }
}

extension SpotterWebModel: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        oauthWindow ?? ASPresentationAnchor()
    }
}

extension SpotterWebModel: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if configuration.origin == AppConfiguration.defaultOrigin, configuration.contains(url), NativeOAuthIntent.provider(for: url) != nil {
            let source = navigationAction.sourceFrame
            let origin = source.securityOrigin
            let trustedSource = source.isMainFrame && origin.protocol == "https" && origin.host == configuration.url.host
                && (origin.port == 0 ? 443 : origin.port) == (configuration.url.port ?? 443)
            let intent = NativeOAuthIntent(url: url, sourceURL: trustedSource ? webView.url : nil, configuration: configuration,
                mainFrame: navigationAction.targetFrame?.isMainFrame == true, userActivated: navigationAction.navigationType == .linkActivated &&
                navigationAction.request.httpMethod == "GET")
            decisionHandler(.cancel)
            if let intent { startNativeOAuth(intent, in: webView) }
            return
        }
        let policy = configuration.navigationPolicy(for: url, mainFrame: mainFrame, userActivated: navigationAction.navigationType == .linkActivated)
        switch policy {
        case .cancel: decisionHandler(.cancel)
        case .external:
            external(url)
            decisionHandler(.cancel)
        case .allow:
            if mainFrame && !configuration.ownsBlob(url) { session.clearIdentity() }
            if navigationAction.shouldPerformDownload && (configuration.contains(url) || configuration.ownsBlob(url)) {
                decisionHandler(.download)
            } else { decisionHandler(.allow) }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        let policy = self.configuration.navigationPolicy(for: url, mainFrame: true, userActivated: navigationAction.navigationType == .linkActivated)
        if policy == .external { external(url) }
        else if policy == .allow { webView.load(navigationAction.request) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame && !navigationResponse.canShowMIMEType,
           let url = navigationResponse.response.url, configuration.contains(url) || configuration.ownsBlob(url) {
            decisionHandler(.download)
        } else { decisionHandler(.allow) }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        cancelNativeOAuth()
        session.clearIdentity()
        isLoading = true
        errorMessage = nil
        currentURL = webView.url
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) { currentURL = webView.url }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        progress = 1
        currentURL = webView.url
        updateNavigationState(webView)
        refreshIdentity()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failNavigation(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failNavigation(error) }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        cancelNativeOAuth()
        session.clearIdentity()
        isLoading = false
        errorMessage = "页面已暂停，请重新加载。已保存的训练记录仍保留在原账号。"
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
}

extension SpotterWebModel: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("spotter-export-" + UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUnlessOpen])
            let name = URL(fileURLWithPath: suggestedFilename).lastPathComponent
            let destination = directory.appendingPathComponent(name.isEmpty || name == "." || name == ".." ? "spotter-export" : name)
            downloads[ObjectIdentifier(download)] = destination
            completionHandler(destination)
        } catch {
            errorMessage = "暂时无法保存导出文件，请重试。"
            completionHandler(nil)
        }
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                  decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
        decisionHandler(request.url.map(configuration.contains) == true ? .allow : .cancel)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let destination = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        clearSharedFile()
        pendingShareURL = destination
        isLoading = false
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let destination = downloads.removeValue(forKey: ObjectIdentifier(download)) {
            try? FileManager.default.removeItem(at: destination.deletingLastPathComponent())
        }
        isLoading = false
        errorMessage = "导出未完成，请联网后重新导出。"
    }
}

struct SpotterWebView: UIViewRepresentable {
    @ObservedObject var model: SpotterWebModel

    func makeUIView(context: Context) -> WKWebView { model.makeWebView() }
    func updateUIView(_ uiView: WKWebView, context: Context) { }
}
