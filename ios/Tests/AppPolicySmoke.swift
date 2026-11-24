import Foundation

@main
struct AppPolicySmoke {
    static func main() throws {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        let app = try AppConfiguration(origin: " https://EXAMPLE.com:443/ ")
        expect(app.origin == "https://example.com", "Canonical HTTPS origin")
        expect(app.verifiedWebVersion == nil, "Never apply the default Sites release to a custom origin")
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
    }
}
