import Foundation

struct WorkoutWindow: Decodable, Sendable {
    let id: String
    let from: Int
    let to: Int

    var start: Date { Date(timeIntervalSince1970: Double(from) / 1_000) }
    var end: Date { Date(timeIntervalSince1970: Double(to) / 1_000) }

    var canRead: Bool {
        let now = Int(Date().timeIntervalSince1970 * 1_000)
        return UUID(uuidString: id) != nil && (946_684_800_000...now).contains(from) &&
            to >= from && to <= now && to - from <= 86_400_000
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
    let minimum: Int
    let maximum: Int
    let sourceName: String?
    let sourceBundleId: String?
    let samples: [HeartPoint]

    static func reduce(_ readings: [HeartPoint], within workout: WorkoutWindow,
                       sourceName: String? = nil, sourceBundleId: String? = nil) -> HeartPayload? {
        var byTime: [Int: Int] = [:]
        for item in readings where item.at >= workout.from && item.at <= workout.to && (1...300).contains(item.bpm) {
            byTime[item.at] = item.bpm
        }
        let points = byTime.keys.sorted().compactMap { at in byTime[at].map { HeartPoint(at: at, bpm: $0) } }
        guard let first = points.first, let last = points.last else { return nil }
        let peak = points.indices.max { points[$0].bpm < points[$1].bpm } ?? 0
        let low = points.indices.min { points[$0].bpm < points[$1].bpm } ?? 0
        let count = min(718, points.count)
        let positions = (0..<count).map { index in
            Int((Double(index) * Double(points.count - 1) / Double(max(1, count - 1))).rounded())
        }
        let kept = Set(positions + [peak, low]).sorted().map { points[$0] }
        let mean = Double(points.reduce(0) { $0 + $1.bpm }) / Double(points.count)
        return HeartPayload(from: first.at, to: last.at, average: Int(mean.rounded()),
                            minimum: points[low].bpm, maximum: points[peak].bpm,
                            sourceName: sourceName, sourceBundleId: sourceBundleId, samples: kept)
    }
}

enum HealthSelection: String, CaseIterable, Identifiable, Codable, Sendable {
    case heartRate, bodyMass, workouts, steps, activeEnergy, exerciseTime
    var id: String { rawValue }
    var title: String {
        switch self {
        case .heartRate: return "训练心率"
        case .bodyMass: return "体重"
        case .workouts: return "系统运动记录"
        case .steps: return "步数"
        case .activeEnergy: return "活跃能量"
        case .exerciseTime: return "运动时长"
        }
    }
}

struct BodyMassRecord: Encodable, Sendable {
    let id: String
    let at: Int
    let value: Double
    let unit = "kg"
    let sourceName: String
    let sourceId: String
}

struct SystemWorkoutRecord: Encodable, Sendable {
    let id: String
    let from: Int
    let to: Int
    let activity: String
    let durationSeconds: Double
    let activeEnergyKcal: Double?
    let sourceName: String
    let sourceId: String
}

struct ActivityRecord: Encodable, Sendable {
    let date: String
    let from: Int
    let to: Int
    var steps: Double?
    var activeEnergyKcal: Double?
    var exerciseMinutes: Double?
    let sourceName = "Apple 健康（系统汇总）"
    let sourceId = "com.apple.health.statistics"
}

struct HealthRecordsPayload: Encodable, Sendable {
    let selected: [String]
    let from: Int
    let to: Int
    let timeZone: String
    let bodyMass: [BodyMassRecord]
    let workouts: [SystemWorkoutRecord]
    let activity: [ActivityRecord]
    var count: Int { bodyMass.count + workouts.count + activity.count }
    var received: Set<HealthSelection> {
        var result = Set<HealthSelection>()
        if !bodyMass.isEmpty { result.insert(.bodyMass) }
        if !workouts.isEmpty { result.insert(.workouts) }
        if activity.contains(where: { $0.steps != nil }) { result.insert(.steps) }
        if activity.contains(where: { $0.activeEnergyKcal != nil }) || workouts.contains(where: { $0.activeEnergyKcal != nil }) { result.insert(.activeEnergy) }
        if activity.contains(where: { $0.exerciseMinutes != nil }) { result.insert(.exerciseTime) }
        return result
    }
}

func epochMilliseconds(_ date: Date) -> Int { Int((date.timeIntervalSince1970 * 1_000).rounded()) }
