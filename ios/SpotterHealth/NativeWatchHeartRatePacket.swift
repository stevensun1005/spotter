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
