import Combine

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var healthAccount: ExpectedHealthAccount?
    @Published private(set) var identityRevision = 0
    var identityVerifier: (() async -> ExpectedHealthAccount?)?

    /// Invalidates in-flight identity checks and health work before a page, origin, or account changes.
    func clearIdentity() {
        identityRevision &+= 1
        healthAccount = nil
    }

    func acceptIdentity(_ account: ExpectedHealthAccount, forRevision revision: Int) {
        guard revision == identityRevision else { return }
        identityRevision &+= 1
        healthAccount = account
    }

    /// A just-in-time read also catches account changes in pages that did not navigate.
    func confirmIdentity() async -> Bool {
        guard let expected = healthAccount, let identityVerifier else { return false }
        let revision = identityRevision
        let current = await identityVerifier()
        guard revision == identityRevision else { return false }
        guard current == expected else { clearIdentity(); return false }
        return true
    }
}
