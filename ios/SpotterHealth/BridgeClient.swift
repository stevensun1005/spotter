import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct Connection: Codable, Sendable {
    let origin: String
    let token: String
}

struct ExpectedHealthAccount: Equatable, Sendable {
    let origin: String
    let accountId: String
}

enum HealthAccountError: LocalizedError {
    case unavailable
    case changed
    case mismatch

    var errorDescription: String? {
        switch self {
        case .unavailable: return "请先在训练页面登录，再同步健康数据。"
        case .changed: return "当前账号或网站已变化，健康同步已暂停。请确认账号后重试。"
        case .mismatch: return "健康连接与当前训练账号不一致，请用当前账号重新配对。"
        }
    }
}

enum HealthAccountGate {
    static func permits(expected: ExpectedHealthAccount?, connection: Connection, deviceOwner: String) -> Bool {
        guard let expected, !expected.accountId.isEmpty,
              let expectedOrigin = try? BridgeClient.origin(expected.origin),
              let deviceOrigin = try? BridgeClient.origin(connection.origin) else { return false }
        return expectedOrigin == deviceOrigin && expected.accountId == deviceOwner
    }
}

enum BridgeError: LocalizedError {
    case origin
    case badResponse
    case server(Int, String)
    case keychain

    var errorDescription: String? {
        switch self {
        case .origin: return "请输入独立版的 HTTPS 站点网址，例如 https://workout.example.com。"
        case .badResponse: return "服务器返回了无法读取的结果。请检查站点网址。"
        case .server(_, let message): return message
        case .keychain: return "无法保存或移除设备连接。请重试。"
        }
    }
}

private final class NoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

struct HealthRecordsResult: Decodable {
    let saved: Int
    let skipped: Int
    let empty: Bool
}

struct WorkoutPage: Decodable {
    let workouts: [WorkoutWindow]
    let nextCursor: String?
}

struct BridgeClient {
    private static let defaultSession = URLSession(configuration: .ephemeral, delegate: NoRedirect(), delegateQueue: nil)
    private let session: URLSession?

    // Tests can inject a URLProtocol-backed session; production keeps the ephemeral, no-redirect transport.
    init(session: URLSession? = nil) { self.session = session }
    private struct Empty: Encodable {}
    private struct Pair: Encodable { let code: String }
    private struct Token: Decodable { let token: String }
    private struct Sync: Encodable { let id: String; let data: HeartPayload }
    private struct Saved: Decodable { let saved: Bool }
    private struct RecordsSaved: Decodable { let saved: Int }
    private struct Report: Encodable {
        let action = "report"
        let from: Int; let to: Int; let saved: Int; let skipped: Int; let empty: Bool; let selected: [String]; let received: [String]
    }
    private struct Status: Decodable { let connected: Bool }
    private struct DeviceIdentity: Decodable { let owner: String }
    private struct Problem: Decodable { let error: String }

    static func origin(_ input: String) throws -> String {
        guard var url = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { throw BridgeError.origin }
        url.scheme = "https"
        url.host = host.lowercased()
        url.path = ""
        if url.port == 443 { url.port = nil }
        guard let result = url.string else { throw BridgeError.origin }
        return result
    }

    static func pair(origin input: String, code: String) async throws -> Connection {
        let server = try origin(input)
        let result: Token = try await call(server, "pair", method: "POST", body: Pair(code: code))
        return Connection(origin: server, token: result.token)
    }

    func deviceOwner(_ connection: Connection) async throws -> String {
        let identity: DeviceIdentity = try await Self.call(connection.origin, "device", token: connection.token,
                                                         method: "GET", body: Optional<Empty>.none, session: session)
        guard !identity.owner.isEmpty else { throw BridgeError.badResponse }
        return identity.owner
    }

    func workouts(_ connection: Connection, from: Date, to: Date, cursor: String?) async throws -> WorkoutPage {
        var query = [URLQueryItem(name: "from", value: String(epochMilliseconds(from))),
                     URLQueryItem(name: "to", value: String(epochMilliseconds(to))), URLQueryItem(name: "limit", value: "100")]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await Self.call(connection.origin, "sync", token: connection.token,
                                   method: "GET", body: Optional<Empty>.none, query: query, session: session)
    }

    func save(_ record: HeartPayload, id: String, using connection: Connection) async throws -> Bool {
        let result: Saved = try await Self.call(connection.origin, "sync", token: connection.token,
                                                 method: "POST", body: Sync(id: id, data: record), session: session)
        return result.saved
    }

    func save(_ records: HealthRecordsPayload, using connection: Connection) async throws -> HealthRecordsResult {
        let result: HealthRecordsResult = try await Self.call(connection.origin, "records", token: connection.token,
                                                        method: "POST", body: records, session: session)
        return result
    }

    func report(_ connection: Connection, from: Date, to: Date, saved: Int, skipped: Int, empty: Bool, selected: Set<HealthSelection>, received: Set<HealthSelection>) async throws {
        let _: RecordsSaved = try await Self.call(connection.origin, "sync", token: connection.token, method: "POST",
            body: Report(from: epochMilliseconds(from), to: epochMilliseconds(to), saved: saved, skipped: skipped, empty: empty, selected: selected.map(\.rawValue).sorted(), received: received.map(\.rawValue).sorted()), session: session)
    }

    func disconnect(_ connection: Connection) async throws {
        let _: Status = try await Self.call(connection.origin, "sync", token: connection.token,
                                           method: "DELETE", body: Empty(), session: session)
    }

    private static func call<Input: Encodable, Output: Decodable>(
        _ input: String, _ route: String, token: String? = nil, method: String, body: Input?,
        query: [URLQueryItem] = [], session: URLSession? = nil
    ) async throws -> Output {
        let server = try origin(input)
        guard var parts = URLComponents(string: server + "/api/health/apple/" + route) else { throw BridgeError.origin }
        if !query.isEmpty { parts.queryItems = query }
        guard let url = parts.url else { throw BridgeError.origin }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = method
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue(server, forHTTPHeaderField: "Origin")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        // GETs and writes are idempotent. A dropped response can be safely retried without local health-data queues.
        let attempts = route == "pair" ? 1 : 3
        for attempt in 0..<attempts {
            do {
                let (data, response) = try await (session ?? defaultSession).data(for: request)
                guard let http = response as? HTTPURLResponse else { throw BridgeError.badResponse }
                if http.statusCode >= 500 && attempt + 1 < attempts {
                    try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 500_000_000)
                    continue
                }
                guard (200..<300).contains(http.statusCode) else {
                    let problem = try? JSONDecoder().decode(Problem.self, from: data)
                    throw BridgeError.server(http.statusCode, problem?.error ?? "服务器暂时无法同步。")
                }
                guard let result = try? JSONDecoder().decode(Output.self, from: data) else { throw BridgeError.badResponse }
                return result
            } catch let error as URLError where attempt + 1 < attempts && error.code != .cancelled {
                try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 500_000_000)
            }
        }
        throw BridgeError.badResponse
    }
}
