import Foundation
import HealthKit

@MainActor
final class HealthKitReader {
    private let store = HKHealthStore()

    private func sampleType(_ selection: HealthSelection) throws -> HKSampleType {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthError.unavailable }
        if selection == .workouts { return HKObjectType.workoutType() }
        let identifier: HKQuantityTypeIdentifier
        switch selection {
        case .heartRate: identifier = .heartRate
        case .bodyMass: identifier = .bodyMass
        case .steps: identifier = .stepCount
        case .activeEnergy: identifier = .activeEnergyBurned
        case .exerciseTime: identifier = .appleExerciseTime
        case .workouts: return HKObjectType.workoutType()
        }
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { throw HealthError.unavailable }
        return type
    }

    // Request only the type the person explicitly enabled. HealthKit does not reveal read-denial status.
    func authorize(_ selection: HealthSelection) async throws {
        try await store.requestAuthorization(toShare: [], read: [try sampleType(selection)])
    }

    private func samples(_ type: HKSampleType, from: Date, to: Date) async throws -> [HKSample] {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to,
                                                     options: [.strictStartDate, .strictEndDate])
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate,
                                      limit: HKObjectQueryNoLimit,
                                      sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, results, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: results ?? []) }
            }
            store.execute(query)
        }
    }

    func read(_ workout: WorkoutWindow) async throws -> HeartPayload? {
        guard workout.canRead else { return nil }
        let all = try await samples(sampleType(.heartRate), from: workout.start, to: workout.end) as? [HKQuantitySample] ?? []
        // Pick one physical/source stream for a window, preferring Apple Watch, instead of stacking trackers.
        let groups = Dictionary(grouping: all) { sample in
            sample.sourceRevision.source.bundleIdentifier + ":" + (sample.sourceRevision.productType ?? "")
        }
        let preferred = groups.sorted { left, right in
            let lhs = left.value
            let rhs = right.value
            let leftWatch = lhs.first?.sourceRevision.productType?.lowercased().contains("watch") ?? false
            let rightWatch = rhs.first?.sourceRevision.productType?.lowercased().contains("watch") ?? false
            if leftWatch != rightWatch { return leftWatch }
            if lhs.count != rhs.count { return lhs.count > rhs.count }
            return left.key < right.key
        }.first?.value ?? []
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let points = preferred.compactMap { sample -> HeartPoint? in
            let value = sample.quantity.doubleValue(for: bpm)
            guard value.isFinite && value >= 1 && value <= 300 else { return nil }
            return HeartPoint(at: epochMilliseconds(sample.startDate), bpm: Int(value.rounded()))
        }
        let source = preferred.first?.sourceRevision.source
        let isWatch = preferred.first?.sourceRevision.productType?.lowercased().contains("watch") ?? false
        return HeartPayload.reduce(points, within: workout,
                                   sourceName: source.map { String((isWatch ? "Apple Watch · " + $0.name : $0.name).prefix(160)) },
                                   sourceBundleId: source.map { String($0.bundleIdentifier.prefix(200)) })
    }

    func records(selected: Set<HealthSelection>, from: Date, to: Date, calendar: Calendar) async throws -> HealthRecordsPayload {
        var weights: [BodyMassRecord] = []
        var workouts: [SystemWorkoutRecord] = []
        if selected.contains(.bodyMass) {
            let readings = try await samples(sampleType(.bodyMass), from: from, to: to) as? [HKQuantitySample] ?? []
            weights = readings.compactMap { item in
                let value = item.quantity.doubleValue(for: .gramUnit(with: .kilo))
                guard value.isFinite && value > 0 && item.startDate < to else { return nil }
                return BodyMassRecord(id: item.uuid.uuidString, at: epochMilliseconds(item.startDate), value: value,
                                      sourceName: String(item.sourceRevision.source.name.prefix(160)), sourceId: String(item.sourceRevision.source.bundleIdentifier.prefix(200)))
            }
        }
        if selected.contains(.workouts) {
            let readings = try await samples(sampleType(.workouts), from: from, to: to) as? [HKWorkout] ?? []
            let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
            workouts = readings.filter { $0.startDate < to }.map { item in
                SystemWorkoutRecord(id: item.uuid.uuidString, from: epochMilliseconds(item.startDate), to: epochMilliseconds(item.endDate),
                                    activity: Self.activityName(item.workoutActivityType), durationSeconds: item.duration,
                                    activeEnergyKcal: selected.contains(.activeEnergy) ? item.statistics(for: energy)?.sumQuantity()?.doubleValue(for: .kilocalorie()) : nil,
                                    sourceName: String(item.sourceRevision.source.name.prefix(160)), sourceId: String(item.sourceRevision.source.bundleIdentifier.prefix(200)))
            }
        }
        var activities: [String: ActivityRecord] = [:]
        let metrics: [(HealthSelection, HKUnit)] = [(.steps, .count()), (.activeEnergy, .kilocalorie()), (.exerciseTime, .minute())]
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        for (selection, unit) in metrics where selected.contains(selection) {
            guard let type = try sampleType(selection) as? HKQuantityType else { continue }
            for (start, end, value) in try await statistics(type, unit: unit, from: from, to: to, calendar: calendar) {
                guard value.isFinite && value >= 0 else { continue }
                let date = formatter.string(from: start)
                var record = activities[date] ?? ActivityRecord(date: date, from: epochMilliseconds(start), to: epochMilliseconds(end))
                switch selection {
                case .steps: record.steps = value.rounded()
                case .activeEnergy: record.activeEnergyKcal = value
                case .exerciseTime: record.exerciseMinutes = value
                default: break
                }
                activities[date] = record
            }
        }
        return HealthRecordsPayload(selected: selected.filter { $0 != .heartRate }.map(\.rawValue).sorted(),
                                    from: epochMilliseconds(from), to: epochMilliseconds(to), timeZone: calendar.timeZone.identifier,
                                    bodyMass: weights, workouts: workouts, activity: activities.values.sorted { $0.from < $1.from })
    }

    private func statistics(_ type: HKQuantityType, unit: HKUnit, from: Date, to: Date,
                            calendar: Calendar) async throws -> [(Date, Date, Double)] {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to)
        // Default HealthKit statistics merge overlapping sources before calculating totals.
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate,
                                                     options: .cumulativeSum, anchorDate: calendar.startOfDay(for: from),
                                                     intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, collection, error in
                if let error { continuation.resume(throwing: error); return }
                var results: [(Date, Date, Double)] = []
                collection?.enumerateStatistics(from: from, to: to) { item, _ in
                    let start = max(item.startDate, from)
                    let end = min(item.endDate, to)
                    guard start < end, let quantity = item.sumQuantity() else { return }
                    results.append((start, end, quantity.doubleValue(for: unit)))
                }
                continuation.resume(returning: results)
            }
            store.execute(query)
        }
    }

    private static func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "跑步"
        case .walking: return "步行"
        case .cycling: return "骑行"
        case .swimming: return "游泳"
        case .traditionalStrengthTraining: return "力量训练"
        case .functionalStrengthTraining: return "功能性力量训练"
        case .yoga: return "瑜伽"
        case .hiking: return "徒步"
        case .highIntensityIntervalTraining: return "高强度间歇训练"
        default: return "HealthKit 运动 " + String(type.rawValue)
        }
    }
}

enum HealthError: LocalizedError {
    case unavailable
    case range

    var errorDescription: String? {
        switch self {
        case .unavailable: return "这台设备无法读取 Apple 健康。请使用支持健康数据的 iPhone。"
        case .range: return "请选择不超过 365 天的有效日期范围，结束日期不能晚于今天。"
        }
    }
}
