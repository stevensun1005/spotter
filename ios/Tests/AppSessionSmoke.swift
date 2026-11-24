import Foundation

@main
struct AppSessionSmoke {
    @MainActor
    static func main() async {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        let first = ExpectedHealthAccount(origin: "https://synthetic.invalid", accountId: "synthetic-first")
        let second = ExpectedHealthAccount(origin: first.origin, accountId: "synthetic-second")
        let session = AppSession()
        session.acceptIdentity(first, forRevision: session.identityRevision)
        let unchanged = session.identityRevision
        session.identityVerifier = { first }
        let confirmed = await session.confirmIdentity()
        expect(confirmed, "Confirm same account immediately before native uploads")
        expect(session.identityRevision == unchanged, "Unchanged identity does not interrupt an active sync")
        session.identityVerifier = { second }
        let switched = await session.confirmIdentity()
        expect(!switched && session.healthAccount == nil, "A same-page account switch clears native access")
        let stale = unchanged
        session.acceptIdentity(first, forRevision: stale)
        expect(session.healthAccount == nil, "Stale frame cannot restore the old account")
        session.acceptIdentity(first, forRevision: session.identityRevision)
        session.identityVerifier = { nil }
        let signedOut = await session.confirmIdentity()
        expect(!signedOut && session.healthAccount == nil, "Sign-out or a failed verification stops uploads")
        session.acceptIdentity(first, forRevision: session.identityRevision)
        session.identityVerifier = {
            session.clearIdentity()
            session.acceptIdentity(first, forRevision: session.identityRevision)
            return first
        }
        let raced = await session.confirmIdentity()
        expect(!raced, "Refreshing then returning the same account invalidates in-flight work")
        print("PASS app session identity: unchanged account, same-page switch, stale result, sign-out, refresh race")
    }
}
