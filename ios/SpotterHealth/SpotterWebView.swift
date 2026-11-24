import Combine
import Foundation
import SwiftUI
import WebKit

@MainActor
final class SpotterWebModel: NSObject, ObservableObject {
    @Published private(set) var configuration: AppConfiguration
    @Published private(set) var isLoading = false
    @Published private(set) var progress = 0.0
    @Published private(set) var canGoBack = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var currentURL: URL?
    @Published private(set) var pendingShareURL: URL?
    let session: AppSession

    var accountId: String? { session.healthAccount?.accountId }
    var accountOrigin: String? { session.healthAccount?.origin }

    private var webView: WKWebView?
    private var observations: [NSKeyValueObservation] = []
    private var sessionChanges: AnyCancellable?
    private var downloads: [ObjectIdentifier: URL] = [:]

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
        settings.applicationNameForUserAgent = "Spotter/1.0"
        settings.allowsInlineMediaPlayback = true
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
        session.clearIdentity()
        configuration = next
        currentURL = nil
        errorMessage = nil
        canGoBack = false
        webView?.stopLoading()
        webView?.load(URLRequest(url: next.url, cachePolicy: .reloadRevalidatingCacheData))
    }

    func reload() {
        session.clearIdentity()
        errorMessage = nil
        guard let webView else { return }
        if let url = webView.url, configuration.contains(url) || url.scheme == "https" { webView.reload() }
        else { webView.load(URLRequest(url: configuration.url, cachePolicy: .reloadRevalidatingCacheData)) }
    }

    func goBack() {
        guard let webView,
              let item = webView.backForwardList.backList.last(where: { configuration.contains($0.url) }) else { return }
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
}

extension SpotterWebModel: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
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
