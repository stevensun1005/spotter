import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct Connection: Codable, Sendable {
    let origin: String
    let token: String
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

struct BridgeClient {
    private static let session = URLSession(configuration: .ephemeral, delegate: NoRedirect(), delegateQueue: nil)
    private struct Empty: Encodable {}
    private struct Pair: Encodable { let code: String }
    private struct Token: Decodable { let token: String }
    private struct Windows: Decodable { let workouts: [WorkoutWindow] }
    private struct Sync: Encodable { let id: String; let data: HeartPayload }
    private struct Saved: Decodable { let saved: Bool }
    private struct Status: Decodable { let connected: Bool }
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

    func workouts(_ connection: Connection) async throws -> [WorkoutWindow] {
        let response: Windows = try await Self.call(connection.origin, "sync", token: connection.token,
                                                   method: "GET", body: Optional<Empty>.none)
        return response.workouts
    }

    func save(_ record: HeartPayload, id: String, using connection: Connection) async throws -> Bool {
        let result: Saved = try await Self.call(connection.origin, "sync", token: connection.token,
                                                 method: "POST", body: Sync(id: id, data: record))
        return result.saved
    }

    func disconnect(_ connection: Connection) async throws {
        let _: Status = try await Self.call(connection.origin, "sync", token: connection.token,
                                           method: "DELETE", body: Empty())
    }

    private static func call<Input: Encodable, Output: Decodable>(
        _ input: String, _ route: String, token: String? = nil, method: String, body: Input?
    ) async throws -> Output {
        let server = try origin(input)
        guard let url = URL(string: server + "/api/health/apple/" + route) else { throw BridgeError.origin }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = method
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue(server, forHTTPHeaderField: "Origin")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw BridgeError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            let problem = try? JSONDecoder().decode(Problem.self, from: data)
            throw BridgeError.server(http.statusCode, problem?.error ?? "服务器暂时无法同步。")
        }
        guard let result = try? JSONDecoder().decode(Output.self, from: data) else { throw BridgeError.badResponse }
        return result
    }
}
