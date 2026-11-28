import Foundation

@main
struct AppPolicySmoke {
    static func main() throws {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        let app = try AppConfiguration(origin: " https://EXAMPLE.com:443/ ")
        expect(app.origin == "https://example.com", "Canonical HTTPS origin")
        expect(app.verifiedWebVersion == nil, "Never apply the default Cloudflare release to a custom origin")
        for raw in ["http://example.com", "https://user:secret@example.com", "https://example.com/training", "https://example.com?token=secret", "https://example.com#fragment", "https://example.com:99999"] {
            do { _ = try AppConfiguration(origin: raw); preconditionFailure("Reject unsafe origin") }
            catch AppConfigurationError.origin { }
        }
        expect(app.contains(URL(string: "https://EXAMPLE.com/training/id")!), "Keep shared training routes in the app")
        expect(!app.contains(URL(string: "https://example.com.evil.test/")!), "Host suffix is not same origin")
        expect(!app.contains(URL(string: "https://example.com:444/")!), "Different port is another origin")
        expect(!app.contains(URL(string: "http://example.com/")!), "Different scheme is another origin")
        expect(!app.contains(URL(string: "https://user:secret@example.com/")!), "Never forward URL credentials")
        expect(app.navigationPolicy(for: URL(string: "https://example.com/training/id")!, mainFrame: true, userActivated: true) == .allow, "Allow internal links")
        expect(app.navigationPolicy(for: URL(string: "https://video.example/watch")!, mainFrame: true, userActivated: true) == .external, "External videos use the system browser")
        expect(app.navigationPolicy(for: URL(string: "https://login.example/authorize")!, mainFrame: true, userActivated: false) == .allow, "Allow secure sign-in redirects without native trust")
        expect(app.navigationPolicy(for: URL(string: "https://video.example/embed")!, mainFrame: false, userActivated: true) == .allow, "Keep secure third-party frames sandboxed in WebKit")
        expect(app.navigationPolicy(for: URL(string: "file:///private/secret")!, mainFrame: true, userActivated: true) == .cancel, "No file navigation")
        expect(app.navigationPolicy(for: URL(string: "javascript:alert(1)")!, mainFrame: true, userActivated: true) == .cancel, "No script navigation")
        expect(app.navigationPolicy(for: URL(string: "http://example.com/")!, mainFrame: true, userActivated: false) == .cancel, "No HTTP downgrade")
        expect(app.ownsBlob(URL(string: "blob:https://example.com/synthetic")!), "Support same-origin file exports")
        expect(!app.ownsBlob(URL(string: "blob:https://example.com.evil.test/synthetic")!), "Reject foreign export blobs")
        print("PASS app URL policy: HTTPS origins, same-origin routes, external videos, login redirects, forbidden schemes, export blobs")

        let trusted = try AppConfiguration(origin: AppConfiguration.defaultOrigin)
        let beta = trusted.betaSocialAPI(for: "/api/friends", enabled: true)
        expect(beta?.origin == "https://spotter-beta-api.couple-ledger-service.workers.dev", "Use the exact beta service for friendship requests")
        expect(trusted.betaSocialAPI(for: "/api/auth/avatar", enabled: true) == beta, "Use the same authenticated service for avatars")
        expect(trusted.betaSocialAPI(for: "/api/friends", enabled: false) == nil, "Stable builds use their original friends service")
        expect(app.betaSocialAPI(for: "/api/friends", enabled: true) == nil, "Custom servers keep their own sessions")
        for path in ["/api/ai-coach", "/api/auth/profile", "/api/auth/avatar/remove", "/api/%66riends", "/api/notifications"] {
            expect(trusted.betaSocialAPI(for: path, enabled: true) == nil, "Do not send unrelated session traffic to the beta service")
        }
        let link = URL(string: trusted.origin + "/api/auth/oauth/google/native?mode=link&expectedOwner=spotter-123")!
        let login = URL(string: trusted.origin + "/api/auth/oauth/apple/native?mode=login")!
        let linkIntent = NativeOAuthIntent(url: link, sourceURL: trusted.url, configuration: trusted, mainFrame: true, userActivated: true)
        expect(linkIntent?.provider == .google && linkIntent?.mode == .link && linkIntent?.expectedOwner == "spotter-123", "Preserve account binding on the trusted main frame link")
        let loginIntent = NativeOAuthIntent(url: login, sourceURL: trusted.url, configuration: trusted, mainFrame: true, userActivated: true)
        expect(loginIntent?.provider == .apple && loginIntent?.mode == .login && loginIntent?.expectedOwner == nil, "No owner supplied for sign in")
        expect(NativeOAuthIntent(url: link, sourceURL: trusted.url, configuration: trusted, mainFrame: false, userActivated: true) == nil, "Reject subframe auth requests")
        expect(NativeOAuthIntent(url: link, sourceURL: trusted.url, configuration: trusted, mainFrame: true, userActivated: false) == nil, "Require a direct click")
        expect(NativeOAuthIntent(url: link, sourceURL: app.url, configuration: trusted, mainFrame: true, userActivated: true) == nil, "Reject cross-origin auth initiation")
        let anotherSite = URL(string: app.origin + "/api/auth/oauth/google/native?mode=login")!
        expect(NativeOAuthIntent(url: anotherSite, sourceURL: app.url, configuration: app, mainFrame: true, userActivated: true) == nil, "Custom sites cannot drive system OAuth")
        for path in ["google/native?mode=link", "apple/native?mode=login&expectedOwner=ignored", "google/native?mode=link&expectedOwner=%0Avalue",
                     "apple/native?mode=login&mode=link", "google/native?mode=login&returnTo=https://example.com", "google/native?mode=login#fragment"] {
            let invalid = URL(string: trusted.origin + "/api/auth/oauth/" + path)!
            expect(NativeOAuthIntent(url: invalid, sourceURL: trusted.url, configuration: trusted, mainFrame: true, userActivated: true) == nil, "Reject ambiguous OAuth query: " + path)
        }

        expect(NativeOAuthProvider.google.acceptsAuthorizationURL(URL(string: "https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture")!), "Accept Google's exact endpoint")
        expect(NativeOAuthProvider.apple.acceptsAuthorizationURL(URL(string: "https://appleid.apple.com/auth/authorize")!), "Accept Apple's exact endpoint")
        for raw in ["http://accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com.evil.test/o/oauth2/v2/auth",
                    "https://name@accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com:444/o/oauth2/v2/auth",
                    "https://accounts.google.com/redirect", "https://appleid.apple.com/auth/authorize"] {
            expect(!NativeOAuthProvider.google.acceptsAuthorizationURL(URL(string: raw)!), "Reject untrusted authorization endpoint: " + raw)
        }

        let code = String(repeating: "a", count: 43)
        let callback = "spotter-auth://oauth/complete"
        expect(NativeOAuthCallback(url: URL(string: callback + "?code=" + code)!) == .code(code), "Accept a single base64url handoff code")
        expect(NativeOAuthCallback(url: URL(string: callback + "?error=link-cancelled")!) == .cancelled, "Provider cancellation ends silently")
        expect(NativeOAuthCallback(url: URL(string: callback + "?error=link-conflict")!) == .failed("link-conflict"), "Propagate a recognized, non-secret failure")
        for raw in [callback + "?code=short", callback + "?code=" + code + "&error=oauth-cancelled", callback + "?code=" + code + "#f",
                    callback + "?error=unknown", "https://oauth/complete?code=" + code, "spotter-auth://other/complete?code=" + code,
                    "spotter-auth://oauth:4000/complete?code=" + code, "spotter-auth://oauth/%63omplete?code=" + code] {
            expect(NativeOAuthCallback(url: URL(string: raw)!) == nil, "Reject malformed OAuth handoff: " + raw)
        }
        print("PASS native OAuth policy: trusted user gesture, expected owner, exact provider endpoint and single-use handoff shape")
    }
}
