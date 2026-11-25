import Foundation

struct NativeWatchWorkoutContext: Equatable {
    let owner: String
    let workoutID: String
    let isRunning: Bool

    func matches(_ other: Self) -> Bool {
        owner == other.owner && workoutID == other.workoutID
    }
}

struct NativeWatchHeartRateReading: Equatable {
    let bpm: Int
    let measuredAt: Date

    func isFresh(at now: Date) -> Bool {
        (-5...30).contains(now.timeIntervalSince(measuredAt))
    }
}

struct NativeWatchWorkoutSnapshot: Codable, Equatable, Sendable {
    struct Position: Codable, Hashable, Sendable {
        let move: Int
        let row: Int

        var isValid: Bool { (0..<30).contains(move) && (0..<30).contains(row) }
    }

    struct Side: Codable, Equatable, Sendable {
        let weight: Double
        let reps: Int

        private enum CodingKeys: String, CodingKey {
            case weight = "w", reps = "r"
        }
    }

    struct Set: Codable, Equatable, Sendable {
        let index: Int
        let weight: Double
        let reps: Int
        let seconds: Int
        let done: Bool
        var right: Side? = nil

        private enum CodingKeys: String, CodingKey {
            case index = "i", weight = "w", reps = "r", seconds = "s", done = "d", right = "b"
        }
    }

    struct Exercise: Codable, Equatable, Sendable {
        let index: Int
        let name: String
        let unit: String
        let isTimed: Bool
        let sets: [Set]
    }

    static let maximumElapsedMilliseconds = 86_400_000
    static let maximumRestMilliseconds = 600_000
    let title: String
    let elapsedMilliseconds: Int
    let runningSinceMilliseconds: Int64?
    let restElapsedDeadlineMilliseconds: Int?
    let restLabel: String?
    let next: Position?
    let exercises: [Exercise]

    func elapsed(at now: Date = .now) -> Int {
        let nowMilliseconds = (now.timeIntervalSince1970 * 1_000).rounded()
        let delta = runningSinceMilliseconds.map { max(0, nowMilliseconds - Double($0)) } ?? 0
        return Int(min(Double(Self.maximumElapsedMilliseconds), Double(elapsedMilliseconds) + delta))
    }

    func restRemainingSeconds(at now: Date = .now) -> Int? {
        restElapsedDeadlineMilliseconds.map { max(0, $0 - elapsed(at: now) + 999) / 1_000 }
    }

    var isValid: Bool {
        guard (1...100).contains(title.utf16.count),
              (0...Self.maximumElapsedMilliseconds).contains(elapsedMilliseconds),
              runningSinceMilliseconds.map({ (0...9_999_999_999_999).contains($0) }) ?? true,
              restElapsedDeadlineMilliseconds.map({ (0...(Self.maximumElapsedMilliseconds + Self.maximumRestMilliseconds)).contains($0) }) ?? true,
              (restLabel?.utf16.count ?? 0) <= 30, exercises.count <= 30 else { return false }
        return exercises.enumerated().allSatisfy { moveIndex, move in
            move.index == moveIndex && (1...100).contains(move.name.utf16.count) && ["kg", "lb"].contains(move.unit) &&
                move.sets.count <= 30 && move.sets.enumerated().allSatisfy { setIndex, set in
                    set.index == setIndex && (0...2_000).contains(set.weight) && (0...999).contains(set.reps) &&
                        (0...18_000).contains(set.seconds) &&
                        (set.right.map { (0...2_000).contains($0.weight) && (0...999).contains($0.reps) } ?? true)
                }
        } && (next.map { position in
            position.isValid && exercises.indices.contains(position.move) &&
                exercises[position.move].sets.indices.contains(position.row) &&
                !exercises[position.move].sets[position.row].done
        } ?? true)
    }

    func allows(_ command: NativeWatchWorkoutCommand) -> Bool {
        switch command.action {
        case .completeSet:
            guard let position = command.position, next == position,
                  exercises.indices.contains(position.move), exercises[position.move].sets.indices.contains(position.row) else { return false }
            let move = exercises[position.move]
            let set = move.sets[position.row]
            guard !set.done else { return false }
            return move.isTimed ? command.weight == nil && command.reps == nil
                : command.seconds == nil && (set.right == nil || (command.weight == nil && command.reps == nil))
        case .setRunning, .refresh:
            return true
        case .skipRest, .adjustRest:
            return restElapsedDeadlineMilliseconds != nil
        }
    }
}

struct NativeWatchWorkoutAcknowledgement: Codable, Equatable, Sendable {
    let id: UUID
    let applied: Bool
}

struct NativeWatchWorkoutStatePacket: Codable, Sendable {
    private var version = 1
    private var kind = "workoutSnapshot"
    let token: UUID
    let revision: Int
    let snapshot: NativeWatchWorkoutSnapshot
    var acknowledgement: NativeWatchWorkoutAcknowledgement? = nil

    init(token: UUID, revision: Int, snapshot: NativeWatchWorkoutSnapshot,
         acknowledgement: NativeWatchWorkoutAcknowledgement? = nil) {
        self.token = token
        self.revision = revision
        self.snapshot = snapshot
        self.acknowledgement = acknowledgement
    }

    // A full phone workout can contain 30 exercises with 30 sets each.
    static let maximumDataSize = 96 * 1_024

    static func decode(_ data: Data) -> Self? {
        guard data.count <= maximumDataSize, let value = try? JSONDecoder().decode(Self.self, from: data),
              value.version == 1, value.kind == "workoutSnapshot", value.revision >= 0, value.snapshot.isValid else { return nil }
        return value
    }

    func encoded() -> Data? {
        guard snapshot.isValid, let data = try? JSONEncoder().encode(self), data.count <= Self.maximumDataSize else { return nil }
        return data
    }

    func allows(_ command: NativeWatchWorkoutCommand) -> Bool {
        command.token == token && command.revision == revision && snapshot.allows(command)
    }
}

struct NativeWatchWorkoutCommand: Codable, Sendable {
    enum Action: String, Codable, Sendable {
        case completeSet, setRunning, skipRest, adjustRest, refresh
    }

    private var version = 1
    private var kind = "workoutAction"
    let id: UUID
    let token: UUID
    let revision: Int
    let action: Action
    var position: NativeWatchWorkoutSnapshot.Position? = nil
    var weight: Double? = nil
    var reps: Int? = nil
    var seconds: Int? = nil
    var running: Bool? = nil
    var adjustment: Int? = nil

    init(id: UUID = UUID(), token: UUID, revision: Int, action: Action,
         position: NativeWatchWorkoutSnapshot.Position? = nil,
         weight: Double? = nil, reps: Int? = nil, seconds: Int? = nil,
         running: Bool? = nil, adjustment: Int? = nil) {
        self.id = id
        self.token = token
        self.revision = revision
        self.action = action
        self.position = position
        self.weight = weight
        self.reps = reps
        self.seconds = seconds
        self.running = running
        self.adjustment = adjustment
    }

    static func decode(_ data: Data) -> Self? {
        guard data.count <= 1_024, let value = try? JSONDecoder().decode(Self.self, from: data), value.isValid else { return nil }
        return value
    }

    func encoded() -> Data? {
        guard isValid else { return nil }
        return try? JSONEncoder().encode(self)
    }

    private var isValid: Bool {
        guard version == 1, kind == "workoutAction", revision >= 0 else { return false }
        let hasValues = weight != nil || reps != nil || seconds != nil
        switch action {
        case .completeSet:
            return position?.isValid == true && running == nil && adjustment == nil &&
                (weight.map { (0...2_000).contains($0) } ?? true) && (reps.map { (0...999).contains($0) } ?? true) &&
                (seconds.map { (0...18_000).contains($0) } ?? true)
        case .setRunning:
            return position == nil && !hasValues && running != nil && adjustment == nil
        case .adjustRest:
            return position == nil && !hasValues && running == nil && (adjustment == 15 || adjustment == -15)
        case .skipRest, .refresh:
            return position == nil && !hasValues && running == nil && adjustment == nil
        }
    }
}

enum NativeWatchHeartRatePacket {
    enum Status: String, Decodable {
        case running, paused, ended, permissionRequired, unavailable, failed
    }

    case reading(NativeWatchHeartRateReading)
    case status(Status)

    private struct Payload: Decodable {
        let version: Int
        let kind: String
        let bpm: Double?
        let measuredAtMilliseconds: Int64?
        let status: Status?
    }

    static let stop = Data(#"{"version":1,"kind":"stop"}"#.utf8)

    init?(_ data: Data, requestedAt: Date, after: Date?, now: Date = .now) {
        guard (1...512).contains(data.count), let payload = try? JSONDecoder().decode(Payload.self, from: data),
              payload.version == 1 else { return nil }

        switch payload.kind {
        case "heartRate":
            guard let bpm = payload.bpm, bpm.isFinite, (20...260).contains(bpm),
                  let milliseconds = payload.measuredAtMilliseconds else { return nil }
            let measuredAt = Date(timeIntervalSince1970: Double(milliseconds) / 1_000)
            let reading = NativeWatchHeartRateReading(bpm: Int(bpm.rounded()), measuredAt: measuredAt)
            guard measuredAt >= requestedAt, after.map({ measuredAt > $0 }) ?? true,
                  reading.isFresh(at: now) else { return nil }
            self = .reading(reading)
        case "status":
            guard let status = payload.status else { return nil }
            self = .status(status)
        default:
            return nil
        }
    }
}

struct NativeWorkoutHealthSummary: Codable, Equatable, Sendable {
    var source = "apple-watch"
    let startedAtMilliseconds: Int64
    let endedAtMilliseconds: Int64
    let activeKilocalories: Double?
    let totalKilocalories: Double?
    let averageHeartRate: Double?

    var isValid: Bool {
        guard source == "apple-watch",
              (946_684_800_000...4_102_444_800_000).contains(startedAtMilliseconds),
              (startedAtMilliseconds + 1...startedAtMilliseconds + 86_400_000).contains(endedAtMilliseconds),
              activeKilocalories != nil || averageHeartRate != nil,
              activeKilocalories.map({ (0...30_000).contains($0) }) ?? true,
              averageHeartRate.map({ (20...260).contains($0) }) ?? true else { return false }
        if let totalKilocalories {
            guard let activeKilocalories else { return false }
            return (activeKilocalories...30_000).contains(totalKilocalories)
        }
        return true
    }

    var metricCount: Int {
        [activeKilocalories, totalKilocalories, averageHeartRate].compactMap { $0 }.count
    }

    init(start: Date, end: Date, active: Double?, basal: Double?, average: Double?) {
        startedAtMilliseconds = Self.milliseconds(start)
        endedAtMilliseconds = Self.milliseconds(end)
        activeKilocalories = active.flatMap { (0...30_000).contains($0) ? $0 : nil }
        if let active = activeKilocalories, let basal, (0...30_000 - active).contains(basal) {
            totalKilocalories = active + basal
        } else { totalKilocalories = nil }
        averageHeartRate = average.flatMap { (20...260).contains($0) ? $0 : nil }
    }

    func fits(start: Int64, end: Int64) -> Bool {
        guard isValid, startedAtMilliseconds >= start - 30_000, endedAtMilliseconds <= end + 30_000 else { return false }
        let overlap = min(end, endedAtMilliseconds) - max(start, startedAtMilliseconds)
        return overlap > 0 && Double(overlap) >= Double(endedAtMilliseconds - startedAtMilliseconds) * 0.95
    }

    static func milliseconds(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1_000).rounded())
    }
}

struct NativeWatchWorkoutFinishRequest: Codable, Sendable {
    private var version = 1
    private var kind = "finishWorkoutSummary"
    let token: UUID
    let endedAtMilliseconds: Int64

    init(token: UUID, end: Date) {
        self.token = token
        endedAtMilliseconds = NativeWorkoutHealthSummary.milliseconds(end)
    }

    var end: Date { Date(timeIntervalSince1970: Double(endedAtMilliseconds) / 1_000) }

    static func decode(_ data: Data, now: Date = .now) -> Self? {
        guard data.count <= 512, let packet = try? JSONDecoder().decode(Self.self, from: data),
              packet.version == 1, packet.kind == "finishWorkoutSummary",
              (-120...60).contains(packet.end.timeIntervalSince(now)) else { return nil }
        return packet
    }

    func encoded() -> Data? { try? JSONEncoder().encode(self) }
}

struct NativeWatchWorkoutSummaryPacket: Codable, Sendable {
    static let transferKey = "spotterWorkoutSummary"

    private var version = 1
    private var kind = "workoutSummary"
    let token: UUID
    let data: NativeWorkoutHealthSummary

    init(token: UUID, data: NativeWorkoutHealthSummary) {
        self.token = token
        self.data = data
    }

    static func decode(_ data: Data) -> Self? {
        guard data.count <= 1_024, let packet = try? JSONDecoder().decode(Self.self, from: data),
              packet.version == 1, packet.kind == "workoutSummary", packet.data.isValid else { return nil }
        return packet
    }

    func encoded() -> Data? {
        guard data.isValid else { return nil }
        return try? JSONEncoder().encode(self)
    }
}
