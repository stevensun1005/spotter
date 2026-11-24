import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@main
struct HealthAccountGateSmoke {
    static func main() async throws {
        let account = ExpectedHealthAccount(origin: "https://synthetic.invalid", accountId: "synthetic-owner")
        let connection = Connection(origin: "https://synthetic.invalid", token: "synthetic-device-token")
        precondition(HealthAccountGate.permits(expected: account, connection: connection, deviceOwner: account.accountId))
        precondition(!HealthAccountGate.permits(expected: nil, connection: connection, deviceOwner: account.accountId))
        precondition(!HealthAccountGate.permits(expected: account, connection: connection, deviceOwner: "other-owner"))
        precondition(!HealthAccountGate.permits(expected: ExpectedHealthAccount(origin: "https://other.invalid", accountId: account.accountId), connection: connection, deviceOwner: account.accountId))
        precondition(!HealthAccountGate.permits(expected: ExpectedHealthAccount(origin: "http://synthetic.invalid", accountId: account.accountId), connection: connection, deviceOwner: account.accountId))
        precondition(!HealthAccountGate.permits(expected: ExpectedHealthAccount(origin: account.origin, accountId: ""), connection: connection, deviceOwner: ""))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SyntheticDeviceIdentity.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let owner = try await BridgeClient(session: session).deviceOwner(connection)
        precondition(owner == account.accountId)
        print("PASS native App health binding: unknown account, account/site mismatch, and token-derived identity")
    }
}

private final class SyntheticDeviceIdentity: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "synthetic.invalid" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        precondition(request.url?.path == "/api/health/apple/device")
        precondition(request.httpMethod == "GET")
        precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer synthetic-device-token")
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil,
                                       headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{\"owner\":\"synthetic-owner\"}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
