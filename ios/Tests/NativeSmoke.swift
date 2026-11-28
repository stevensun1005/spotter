import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

private final class RetryProtocol: URLProtocol, @unchecked Sendable {
    enum Reply {
        case offline
        case cancelled
        case status(Int, String)
    }

    private static let lock = NSLock()
    private static var replies: [Reply] = []
    private static var attemptCount = 0

    static func prepare(_ responses: [Reply]) {
        lock.lock()
        defer { lock.unlock() }
        replies = responses
        attemptCount = 0
    }

    static var attempts: Int {
        lock.lock()
        defer { lock.unlock() }
        return attemptCount
    }

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.scheme == "https" && request.url?.host == "native-smoke.invalid"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lock.lock()
        Self.attemptCount += 1
        let reply = Self.replies.isEmpty ? Reply.status(599, "{\"error\":\"Unexpected attempt\"}") : Self.replies.removeFirst()
        Self.lock.unlock()
        switch reply {
        case .offline:
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
        case .cancelled:
            client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
        case .status(let code, let body):
            let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() { }
}

@main
struct NativeSmoke {
    static func main() async throws {
        func expect(_ value: @autoclosure () -> Bool, _ message: String) {
            precondition(value(), message)
        }
        let normalized = try BridgeClient.origin(" https://EXAMPLE.com:443/ ")
        expect(normalized == "https://example.com", "Normalize HTTPS origin")
        var localCalendar = Calendar(identifier: .gregorian)
        localCalendar.timeZone = TimeZone(identifier: "America/Toronto")!
        let dstStart = localCalendar.date(from: DateComponents(year: 2026, month: 11, day: 1))!
        let dstEnd = localCalendar.date(byAdding: .day, value: 1, to: dstStart)!
        expect(dstEnd.timeIntervalSince(dstStart) == 25 * 3_600, "Local activity days retain the DST hour")
        for input in ["http://example.com", "https://example.com/api", "https://name:secret@example.com", "https://example.com?token=secret", "https://example.com#fragment"] {
            do { _ = try BridgeClient.origin(input); preconditionFailure("Reject non-origin address") }
            catch BridgeError.origin { }
        }
        let now = epochMilliseconds(Date())
        let historic = WorkoutWindow(id: UUID().uuidString, from: now - 90 * 86_400_000, to: now - 90 * 86_400_000 + 3_600_000)
        expect(historic.canRead, "History older than fourteen days can be read")
        expect(!WorkoutWindow(id: historic.id, from: now, to: now + 100_000).canRead, "Do not read future samples")
        let morning = WorkoutWindow(id: UUID().uuidString, from: now - 8_000_000, to: now - 4_000_000)
        let evening = WorkoutWindow(id: UUID().uuidString, from: now - 3_000_000, to: now - 1_000_000)
        var samples = (0..<4_000).map { HeartPoint(at: morning.from + $0 * 1_000, bpm: 120) }
        samples[1_093] = HeartPoint(at: samples[1_093].at, bpm: 53)
        samples[2_521] = HeartPoint(at: samples[2_521].at, bpm: 193)
        samples.append(HeartPoint(at: evening.from + 1_000, bpm: 161))
        samples.append(HeartPoint(at: morning.from - 1_000, bpm: 299))
        let reduced = HeartPayload.reduce(samples, within: morning, sourceName: "Synthetic Watch", sourceBundleId: "test.synthetic")!
        expect(reduced.samples.count <= 720, "Bound transport size")
        expect(reduced.minimum == 53 && reduced.maximum == 193, "Keep extrema from all samples")
        expect(reduced.samples.contains { $0.bpm == 53 } && reduced.samples.contains { $0.bpm == 193 }, "Curve keeps extrema during downsampling")
        expect(reduced.average == 120, "Average uses all readings")
        expect(reduced.samples.allSatisfy { $0.at >= morning.from && $0.at <= morning.to }, "Same-day windows stay isolated")
        expect(HeartPayload.reduce(samples, within: evening)?.average == 161, "Match second training by actual timestamps")
        expect(HeartPayload.reduce([], within: morning) == nil, "Empty reads remain empty")
        let duplicate = HeartPayload.reduce(samples + samples, within: morning)!
        expect(duplicate.average == reduced.average && duplicate.samples.count == reduced.samples.count, "Repeat samples are stable")
        let weight = BodyMassRecord(id: UUID().uuidString, at: now - 1_000, value: 80, sourceName: "Synthetic Scale", sourceId: "test.scale")
        let records = HealthRecordsPayload(selected: ["bodyMass"], from: now - 2_000, to: now,
                                           timeZone: "America/Toronto", bodyMass: [weight], workouts: [], activity: [])
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(records)) as! [String: Any]
        expect((json["bodyMass"] as! [[String: Any]])[0]["unit"] as? String == "kg", "Mass transport is canonical kilograms")
        expect((json["selected"] as? [String]) == ["bodyMass"], "Only chosen data types are sent")
        expect(records.received == [.bodyMass], "Report types with actual samples")
        let noRead = HealthRecordsPayload(selected: ["bodyMass", "steps"], from: now - 2_000, to: now,
                                         timeZone: "America/Toronto", bodyMass: [], workouts: [], activity: [])
        expect(noRead.received.isEmpty, "No-read permissions do not appear as received")
        try await verifyRetries()
        print("PASS native smoke: HTTPS validation, history, same-day matching, extrema, repeat reduction, selected payload")
        print("PASS native retry: offline recovery and limit, 503 recovery, 401 single attempt, cancellation single attempt")
    }

    private static func verifyRetries() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [RetryProtocol.self]
        let transport = URLSession(configuration: configuration)
        defer { transport.invalidateAndCancel() }
        let client = BridgeClient(session: transport)
        let connection = Connection(origin: "https://native-smoke.invalid", token: String(repeating: "a", count: 64))
        let now = Date()

        RetryProtocol.prepare([.offline, .status(200, "{\"workouts\":[],\"nextCursor\":null}")])
        let page = try await client.workouts(connection, from: now.addingTimeInterval(-3_600), to: now, cursor: nil)
        precondition(page.workouts.isEmpty && page.nextCursor == nil && RetryProtocol.attempts == 2,
                     "Offline request retries once and decodes successful page")

        RetryProtocol.prepare([.offline, .offline, .offline])
        do {
            _ = try await client.workouts(connection, from: now.addingTimeInterval(-3_600), to: now, cursor: nil)
            preconditionFailure("Persistent offline state must surface after bounded retries")
        } catch let error as URLError where error.code == .notConnectedToInternet {
            precondition(RetryProtocol.attempts == 3, "Offline retries must stop after three attempts")
        }

        let window = WorkoutWindow(id: UUID().uuidString, from: epochMilliseconds(now) - 2_000,
                                   to: epochMilliseconds(now) - 1_000)
        let payload = HeartPayload.reduce([HeartPoint(at: window.from, bpm: 120)], within: window)!
        RetryProtocol.prepare([.status(503, "{\"error\":\"Synthetic temporary failure\"}"), .status(200, "{\"saved\":true}")])
        let saved = try await client.save(payload, id: window.id, using: connection)
        precondition(saved && RetryProtocol.attempts == 2, "503 write retries once and returns saved flag")

        RetryProtocol.prepare([.status(401, "{\"error\":\"Synthetic expired device\"}"), .status(200, "{\"saved\":true}")])
        do {
            _ = try await client.save(payload, id: window.id, using: connection)
            preconditionFailure("401 must surface for re-pairing")
        } catch BridgeError.server(401, _) {
            precondition(RetryProtocol.attempts == 1, "401 must not retry")
        }

        RetryProtocol.prepare([.cancelled, .status(200, "{\"workouts\":[],\"nextCursor\":null}")])
        do {
            _ = try await client.workouts(connection, from: now.addingTimeInterval(-3_600), to: now, cursor: nil)
            preconditionFailure("Cancellation must surface")
        } catch let error as URLError where error.code == .cancelled {
            precondition(RetryProtocol.attempts == 1, "Cancellation must not retry")
        }
    }
}
