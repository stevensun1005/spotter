import Foundation

struct WorkoutWindow: Decodable, Sendable {
    let id: String
    let from: Int
    let to: Int

    var start: Date { Date(timeIntervalSince1970: Double(from) / 1_000) }
    var end: Date { Date(timeIntervalSince1970: Double(to) / 1_000) }

    var canRead: Bool {
        let now = Int(Date().timeIntervalSince1970 * 1_000)
        return UUID(uuidString: id) != nil && (now - 14 * 86_400_000...now).contains(from) &&
            to >= from && to - from <= 86_400_000
    }
}

struct HeartPoint: Codable, Sendable {
    let at: Int
    let bpm: Int
}

struct HeartPayload: Encodable, Sendable {
    let source = "apple"
    let from: Int
    let to: Int
    let average: Int
    let maximum: Int
    let samples: [HeartPoint]

    static func reduce(_ readings: [HeartPoint], within workout: WorkoutWindow) -> HeartPayload? {
        var byTime: [Int: Int] = [:]
        for item in readings where item.at >= workout.from && item.at <= workout.to && (1...300).contains(item.bpm) {
            byTime[item.at] = item.bpm
        }
        let points = byTime.keys.sorted().compactMap { at in byTime[at].map { HeartPoint(at: at, bpm: $0) } }
        guard let first = points.first, let last = points.last else { return nil }
        let peak = points.indices.max { points[$0].bpm < points[$1].bpm } ?? 0
        let count = min(719, points.count)
        let positions = (0..<count).map { index in
            Int((Double(index) * Double(points.count - 1) / Double(max(1, count - 1))).rounded())
        }
        let kept = Set(positions + [peak]).sorted().map { points[$0] }
        let mean = Double(points.reduce(0) { $0 + $1.bpm }) / Double(points.count)
        return HeartPayload(from: first.at, to: last.at, average: Int(mean.rounded()),
                            maximum: points[peak].bpm, samples: kept)
    }
}
