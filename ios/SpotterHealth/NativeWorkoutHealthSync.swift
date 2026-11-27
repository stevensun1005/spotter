import Combine
import Foundation

/// Retains completed summaries until the matching check-in and its private payload reach the server.
@MainActor
final class NativeWorkoutHealthSync: ObservableObject {
    static let shared = NativeWorkoutHealthSync()
    @Published private(set) var updatedWorkout: NativeWorkoutEntry.Key?

    private struct Pending: Codable {
        let owner: String
        let origin: String
        let workoutID: String
        let token: UUID?
        let from: Int64
        let to: Int64
        let created: Date
        var summary: NativeWorkoutHealthSummary?

        var key: NativeWorkoutEntry.Key { .init(owner: owner, id: workoutID) }

        var isRecent: Bool { Date.now.timeIntervalSince(created) < (summary == nil ? 7 : 90) * 86_400 }
    }

    private struct Upload: Encodable {
        let expectedOwner: String
        let id: String
        let data: NativeWorkoutHealthSummary
    }

    private struct Response: Decodable {
        let data: NativeWorkoutHealthSummary?
    }

    private var pending: [Pending] = []
    private var attempts: [String: Date] = [:]
    private var inFlight: Set<String> = []
    private var retries: [String: Task<Void, Never>] = [:]
    private var retryCounts: [String: Int] = [:]
    private let diskURL: URL?

    private init() {
        diskURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/WorkoutHealth", isDirectory: true)
            .appendingPathComponent("pending.json")
        if let diskURL, let bytes = try? Data(contentsOf: diskURL),
           let saved = try? JSONDecoder().decode([Pending].self, from: bytes) {
            pending = saved.filter(\.isRecent)
        }
    }

    func expect(token: UUID, origin: String, owner: String, entry: NativeWorkoutEntry) -> Bool {
        guard let window = Self.window(for: entry, owner: owner), !pending.contains(where: { $0.token == token }) else { return false }
        pending.append(Pending(owner: owner, origin: origin, workoutID: entry.id, token: token,
                               from: Int64(window.from), to: Int64(window.to), created: .now))
        persist()
        return true
    }

    func accept(_ packet: NativeWatchWorkoutSummaryPacket) {
        guard let index = pending.firstIndex(where: { $0.token == packet.token }),
              pending[index].isRecent,
              packet.data.fits(start: pending[index].from, end: pending[index].to),
              // A finish response must reach all the way to the recorded end of the Spotter workout.
              abs(packet.data.endedAtMilliseconds - pending[index].to) <= 60_000,
              (pending[index].summary?.metricCount ?? 0) < packet.data.metricCount else { return }
        pending[index].summary = packet.data
        let key = pending[index].key
        persist()
        updatedWorkout = key
    }

    func run(api: NativeAPI, owner: String, entries: [NativeWorkoutEntry]) async {
        let existing = Dictionary(entries.filter { $0.owner == owner && $0.kind == "log" }.map { ($0.id, $0) },
                                  uniquingKeysWith: { first, _ in first })
        let work = pending.filter { $0.origin == api.origin && $0.owner == owner && $0.isRecent && existing[$0.workoutID] != nil }
        for request in work.prefix(16) {
            guard let entry = existing[request.workoutID], !Task.isCancelled else { return }
            if request.summary == nil {
                let key = scope(api.origin, owner, entry.id)
                let now = Date.now
                guard now.timeIntervalSince(attempts[key] ?? .distantPast) > 120,
                      let window = Self.window(for: entry, owner: owner) else { continue }
                attempts = attempts.filter { now.timeIntervalSince($0.value) < 86_400 }
                attempts[key] = now
                if let summary = try? await HealthKitReader().readWorkoutSummary(window) {
                    cache(summary, origin: api.origin, owner: owner, window: window)
                }
            }
            await upload(api: api, owner: owner, id: entry.id)
        }
    }

    func load(api: NativeAPI, owner: String, entry: NativeWorkoutEntry,
              refresh: Bool = false) async throws -> NativeWorkoutHealthSummary? {
        guard let window = Self.window(for: entry, owner: owner) else { return nil }
        var local = stored(origin: api.origin, owner: owner, id: entry.id)?.summary
        if refresh, local?.metricCount != 3, let reading = try? await HealthKitReader().readWorkoutSummary(window) {
            cache(reading, origin: api.origin, owner: owner, window: window)
            local = stored(origin: api.origin, owner: owner, id: entry.id)?.summary
        }
        if let local {
            if refresh { Task { await upload(api: api, owner: owner, id: entry.id) } }
            return local
        }
        do {
            let data = try await api.request("/api/health/workout-summary?id=" + entry.id, method: "GET", json: nil, for: owner)
            let summary = try JSONDecoder().decode(Response.self, from: data).data
                .flatMap { $0.fits(start: Int64(window.from), end: Int64(window.to)) ? $0 : nil }
            // A Watch response may arrive while this read is waiting on the server.
            if let latest = stored(origin: api.origin, owner: owner, id: entry.id)?.summary,
               latest.metricCount >= (summary?.metricCount ?? 0) { return latest }
            return summary
        } catch let error as NativeAPIError where error.statusCode == 404 {
            return stored(origin: api.origin, owner: owner, id: entry.id)?.summary
        }
    }

    func clear(origin: String, owner: String) {
        let keys = pending.filter { $0.origin == origin && $0.owner == owner }
            .map { scope(origin, owner, $0.workoutID) }
        for key in keys {
            retries.removeValue(forKey: key)?.cancel()
            retryCounts.removeValue(forKey: key)
        }
        pending.removeAll { $0.origin == origin && $0.owner == owner }
        if updatedWorkout?.owner == owner { updatedWorkout = nil }
        persist()
    }

    private func cache(_ summary: NativeWorkoutHealthSummary, origin: String, owner: String, window: WorkoutWindow) {
        guard summary.fits(start: Int64(window.from), end: Int64(window.to)) else { return }
        if let index = pending.lastIndex(where: { $0.origin == origin && $0.owner == owner && $0.workoutID == window.id }) {
            guard (pending[index].summary?.metricCount ?? 0) < summary.metricCount else { return }
            pending[index].summary = summary
        } else {
            pending.append(Pending(owner: owner, origin: origin, workoutID: window.id, token: nil,
                                   from: Int64(window.from), to: Int64(window.to), created: .now, summary: summary))
        }
        persist()
        updatedWorkout = .init(owner: owner, id: window.id)
    }

    private func upload(api: NativeAPI, owner: String, id: String) async {
        let compound = scope(api.origin, owner, id)
        guard let pendingUpload = stored(origin: api.origin, owner: owner, id: id), let summary = pendingUpload.summary,
              inFlight.insert(compound).inserted else { return }
        defer { inFlight.remove(compound) }
        retries.removeValue(forKey: compound)?.cancel()
        do {
            let body = try JSONEncoder().encode(Upload(expectedOwner: owner, id: id, data: summary))
            let data = try await api.request("/api/health/workout-summary", method: "POST", json: body, for: owner)
            guard try JSONDecoder().decode(Response.self, from: data).data?.isValid == true else { return }
            retryCounts.removeValue(forKey: compound)
            pending.removeAll {
                $0.origin == api.origin && $0.owner == owner && $0.workoutID == id && $0.summary == summary
            }
            persist()
            updatedWorkout = .init(owner: owner, id: id)
        } catch {
            // The existing workout outbox confirms the log first. A later receipt, reconnect or foreground visit
            // also retries the private summary independently of the nutrition and workout mutations.
            guard !Task.isCancelled else { return }
            retryIfTransient(error, api: api, owner: owner, id: id, key: compound)
        }
    }

    private func retryIfTransient(_ error: Error, api: NativeAPI, owner: String, id: String, key: String) {
        let retryable = if let status = (error as? NativeAPIError)?.statusCode {
            [408, 409, 429, 500, 502, 503, 504].contains(status)
        } else { error is URLError }
        let delays = [4, 12, 30]
        let attempt = retryCounts[key, default: 0]
        guard retryable, delays.indices.contains(attempt) else { return }
        retryCounts[key] = attempt + 1
        retries[key] = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(delays[attempt])) } catch { return }
            guard let self else { return }
            retries.removeValue(forKey: key)
            await upload(api: api, owner: owner, id: id)
        }
    }

    private func stored(origin: String, owner: String, id: String) -> Pending? {
        pending.last { $0.origin == origin && $0.owner == owner && $0.workoutID == id && $0.isRecent }
    }

    private func scope(_ origin: String, _ owner: String, _ id: String) -> String {
        [origin, owner, id].joined(separator: "\n")
    }

    private static func window(for entry: NativeWorkoutEntry, owner: String) -> WorkoutWindow? {
        guard entry.kind == "log", entry.owner == owner, let interval = entry.workoutWindow else { return nil }
        let now = NativeWorkoutHealthSummary.milliseconds(.now)
        guard UUID(uuidString: entry.id) != nil, (946_684_800_000...now).contains(interval.from),
              (interval.from + 1...min(now + 1_000, interval.from + 86_400_000)).contains(interval.to) else { return nil }
        return WorkoutWindow(id: entry.id, from: Int(interval.from), to: Int(interval.to))
    }

    private func persist() {
        pending = Array(pending.filter(\.isRecent).suffix(120))
        guard let diskURL, let data = try? JSONEncoder().encode(pending) else { return }
        var directory = diskURL.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? directory.setResourceValues(values)
            try data.write(to: diskURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch {}
    }
}
