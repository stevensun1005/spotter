import Foundation
import HealthKit

enum NativeHealthGroup: String, CaseIterable, Identifiable, Sendable {
    case heart, activity, body, sleep, nutrition

    var id: Self { self }

    var title: String {
        switch self {
        case .heart: return "心脏与康复"
        case .activity: return "活动与训练"
        case .body: return "身体测量"
        case .sleep: return "睡眠"
        case .nutrition: return "饮食与饮水"
        }
    }

    var metrics: [NativeHealthMetric] {
        switch self {
        case .heart:
            return [.heartRate, .restingHeartRate, .walkingHeartRate, .heartRateVariability, .heartRateRecovery,
                    .vo2Max, .respiratoryRate, .oxygenSaturation]
        case .activity:
            return [.steps, .walkRunDistance, .cyclingDistance, .swimmingDistance, .wheelchairDistance,
                    .wheelchairPushes, .flightsClimbed, .activeEnergy, .basalEnergy, .exerciseTime, .standTime, .workouts]
        case .body:
            return [.bodyMass, .height, .bodyMassIndex, .bodyFat, .leanBodyMass, .waist]
        case .sleep:
            return [.sleep]
        case .nutrition:
            return [.dietaryEnergy, .protein, .carbs, .dietaryFat, .fiber, .water]
        }
    }
}

enum NativeHealthMetric: String, Hashable, Identifiable, Sendable {
    case heartRate, restingHeartRate, walkingHeartRate, heartRateVariability, heartRateRecovery, vo2Max, respiratoryRate, oxygenSaturation
    case steps, walkRunDistance, cyclingDistance, swimmingDistance, wheelchairDistance, wheelchairPushes, flightsClimbed
    case activeEnergy, basalEnergy, exerciseTime, standTime, workouts
    case bodyMass, height, bodyMassIndex, bodyFat, leanBodyMass, waist, sleep
    case dietaryEnergy, protein, carbs, dietaryFat, fiber, water

    static var supportedMetrics: Set<Self> { Set(NativeHealthGroup.allCases.flatMap(\.metrics)) }

    var id: Self { self }

    fileprivate struct Quantity {
        enum Summary { case sum, average, latest }
        let identifier: HKQuantityTypeIdentifier
        let title: String
        let unit: HKUnit
        let symbol: String
        let summary: Summary
        let multiplier: Double

        init(_ identifier: HKQuantityTypeIdentifier, _ title: String, _ unit: HKUnit, _ symbol: String,
             _ summary: Summary, multiplier: Double = 1) {
            self.identifier = identifier
            self.title = title
            self.unit = unit
            self.symbol = symbol
            self.summary = summary
            self.multiplier = multiplier
        }
    }

    fileprivate var quantity: Quantity? {
        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        let kilometers = HKUnit.meterUnit(with: .kilo)
        switch self {
        case .heartRate: return Quantity(.heartRate, "心率", beatsPerMinute, "次/分", .average)
        case .restingHeartRate: return Quantity(.restingHeartRate, "静息心率", beatsPerMinute, "次/分", .average)
        case .walkingHeartRate: return Quantity(.walkingHeartRateAverage, "步行心率", beatsPerMinute, "次/分", .average)
        case .heartRateVariability: return Quantity(.heartRateVariabilitySDNN, "心率变异性（SDNN）", .secondUnit(with: .milli), "毫秒", .average)
        case .heartRateRecovery: return Quantity(.heartRateRecoveryOneMinute, "一分钟心率恢复", beatsPerMinute, "次/分", .average)
        case .vo2Max:
            let unit = HKUnit.literUnit(with: .milli).unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute()))
            return Quantity(.vo2Max, "最大摄氧量", unit, "mL/kg/min", .latest)
        case .respiratoryRate: return Quantity(.respiratoryRate, "呼吸频率", beatsPerMinute, "次/分", .average)
        case .oxygenSaturation: return Quantity(.oxygenSaturation, "血氧饱和度", .percent(), "%", .average, multiplier: 100)
        case .steps: return Quantity(.stepCount, "步数", .count(), "步", .sum)
        case .walkRunDistance: return Quantity(.distanceWalkingRunning, "步行与跑步距离", kilometers, "km", .sum)
        case .cyclingDistance: return Quantity(.distanceCycling, "骑行距离", kilometers, "km", .sum)
        case .swimmingDistance: return Quantity(.distanceSwimming, "游泳距离", .meter(), "m", .sum)
        case .wheelchairDistance: return Quantity(.distanceWheelchair, "轮椅距离", kilometers, "km", .sum)
        case .wheelchairPushes: return Quantity(.pushCount, "轮椅推动次数", .count(), "次", .sum)
        case .flightsClimbed: return Quantity(.flightsClimbed, "爬楼层数", .count(), "层", .sum)
        case .activeEnergy: return Quantity(.activeEnergyBurned, "活跃能量", .kilocalorie(), "千卡", .sum)
        case .basalEnergy: return Quantity(.basalEnergyBurned, "静息能量", .kilocalorie(), "千卡", .sum)
        case .exerciseTime: return Quantity(.appleExerciseTime, "运动时长", .minute(), "分钟", .sum)
        case .standTime: return Quantity(.appleStandTime, "站立时长", .minute(), "分钟", .sum)
        case .bodyMass: return Quantity(.bodyMass, "体重", .gramUnit(with: .kilo), "kg", .latest)
        case .height: return Quantity(.height, "身高", .meterUnit(with: .centi), "cm", .latest)
        case .bodyMassIndex: return Quantity(.bodyMassIndex, "身体质量指数（BMI）", .count(), "kg/m²", .latest)
        case .bodyFat: return Quantity(.bodyFatPercentage, "体脂率", .percent(), "%", .latest, multiplier: 100)
        case .leanBodyMass: return Quantity(.leanBodyMass, "去脂体重", .gramUnit(with: .kilo), "kg", .latest)
        case .waist: return Quantity(.waistCircumference, "腰围", .meterUnit(with: .centi), "cm", .latest)
        case .dietaryEnergy: return Quantity(.dietaryEnergyConsumed, "摄入能量", .kilocalorie(), "千卡", .sum)
        case .protein: return Quantity(.dietaryProtein, "蛋白质", .gram(), "g", .sum)
        case .carbs: return Quantity(.dietaryCarbohydrates, "碳水化合物", .gram(), "g", .sum)
        case .dietaryFat: return Quantity(.dietaryFatTotal, "饮食脂肪", .gram(), "g", .sum)
        case .fiber: return Quantity(.dietaryFiber, "膳食纤维", .gram(), "g", .sum)
        case .water: return Quantity(.dietaryWater, "饮水量", .literUnit(with: .milli), "mL", .sum)
        case .workouts, .sleep: return nil
        }
    }

    var title: String {
        switch self {
        case .workouts: return "系统运动记录"
        case .sleep: return "睡眠时间"
        default: return quantity?.title ?? ""
        }
    }

    var symbol: String { quantity?.symbol ?? "" }
    var isAverage: Bool { quantity?.summary == .average }

    var accountMeasurement: (key: String?, range: ClosedRange<Double>)? {
        switch self {
        case .bodyMass: return (nil, 10...700)
        case .bodyFat: return ("fat", 1...75)
        case .leanBodyMass: return ("fatFreeMass", 1...350)
        case .waist: return ("waist", 10...400)
        default: return nil
        }
    }

    fileprivate var sampleType: HKSampleType? {
        switch self {
        case .workouts: return HKObjectType.workoutType()
        case .sleep: return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
        default: return quantity.flatMap { HKQuantityType.quantityType(forIdentifier: $0.identifier) }
        }
    }
}

struct NativeHealthBodySample: Identifiable, Sendable {
    let id: String
    let metric: NativeHealthMetric
    let date: Date
    let value: Double
    let sourceName: String
    let sourceID: String
}

enum NativeHealthReading: Sendable {
    case quantity(value: Double, latest: Date? = nil)
    case body([NativeHealthBodySample])
    case workouts([SystemWorkoutRecord])
    case sleep(seconds: TimeInterval?, inBedSeconds: TimeInterval?)
}

struct NativeHealthReadings: Sendable {
    var values: [NativeHealthMetric: NativeHealthReading] = [:]
    var failed: Set<NativeHealthMetric> = []
}

@MainActor
final class HealthKitReader {
    private let store = HKHealthStore()
    private var nativeObservers: [HKObserverQuery] = []

    static var nativeDataAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func authorizeNativeMetrics() async throws {
        try await store.requestAuthorization(toShare: [], read: nativeReadTypes())
    }

    func nativeAuthorizationNeedsPrompt() async throws -> Bool {
        let readTypes = try nativeReadTypes()
        return try await withCheckedThrowingContinuation { continuation in
            store.getRequestStatusForAuthorization(toShare: [], read: readTypes) { status, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: status != .unnecessary) }
            }
        }
    }

    func hasReadableNativeSample() async -> Bool {
        guard Self.nativeDataAvailable, !Task.isCancelled else { return false }
        let metrics: [NativeHealthMetric] = [.steps, .heartRate, .bodyMass, .workouts, .activeEnergy, .sleep]
        return await withTaskGroup(of: Bool.self) { group in
            for type in metrics.compactMap(\.sampleType) {
                group.addTask {
                    await self.containsNativeSample(type)
                }
            }
            while let found = await group.next() {
                if found {
                    group.cancelAll()
                    return true
                }
            }
            return false
        }
    }

    private func containsNativeSample(_ type: HKSampleType) async -> Bool {
        guard !Task.isCancelled else { return false }
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: nil) {
                _, records, _ in continuation.resume(returning: records?.isEmpty == false)
            }
            store.execute(query)
        }
    }

    private func nativeReadTypes() throws -> Set<HKObjectType> {
        guard Self.nativeDataAvailable else { throw HealthError.unavailable }
        return Set(NativeHealthMetric.supportedMetrics.compactMap(\.sampleType))
    }

    func observeNativeMetrics(_ metrics: Set<NativeHealthMetric>, onChange: @escaping @MainActor () -> Void) {
        stopObservingNativeMetrics()
        guard Self.nativeDataAvailable else { return }
        for type in Set(metrics.compactMap(\.sampleType)) {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, complete, error in
                defer { complete() }
                guard error == nil else { return }
                Task { @MainActor in onChange() }
            }
            nativeObservers.append(query)
            store.execute(query)
        }
    }

    func stopObservingNativeMetrics() {
        nativeObservers.forEach { store.stop($0) }
        nativeObservers.removeAll()
    }

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

    func readNativeMetrics(_ metrics: Set<NativeHealthMetric>, from: Date, to: Date, calendar: Calendar) async throws -> NativeHealthReadings {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthError.unavailable }
        let types = metrics.compactMap { metric in metric.sampleType.map { (metric, $0) } }
        guard !types.isEmpty else { throw HealthError.unavailable }
        try Task.checkCancellation()

        return await withTaskGroup(of: (NativeHealthMetric, NativeHealthReading?, Bool).self) { group in
            for (metric, type) in types {
                group.addTask {
                    do {
                        let value = try await self.nativeReading(metric, type: type, from: from, to: to, calendar: calendar,
                                                                 readWorkoutEnergy: metrics.contains(.activeEnergy))
                        return (metric, value, false)
                    } catch { return (metric, nil, true) }
                }
            }
            var result = NativeHealthReadings(failed: metrics.subtracting(types.map(\.0)))
            for await (metric, value, failed) in group {
                result.values[metric] = value
                if failed { result.failed.insert(metric) }
            }
            return result
        }
    }

    private func nativeReading(_ metric: NativeHealthMetric, type: HKSampleType, from: Date, to: Date, calendar: Calendar,
                               readWorkoutEnergy: Bool) async throws -> NativeHealthReading? {
        try Task.checkCancellation()
        switch metric {
        case .workouts:
            let records = try await systemWorkouts(from: from, to: to, includeEnergy: readWorkoutEnergy)
            return records.isEmpty ? nil : .workouts(records)
        case .sleep:
            let records = try await samples(type, from: from, to: to, options: []) as? [HKCategorySample] ?? []
            let inBed = HKCategoryValueSleepAnalysis.inBed.rawValue
            let asleep = Set([HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                              HKCategoryValueSleepAnalysis.asleepCore.rawValue, HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                              HKCategoryValueSleepAnalysis.asleepREM.rawValue])
            let sleepingTime = Self.coveredSeconds(records, from: from, to: to) { asleep.contains($0) }
            let bedTime = Self.coveredSeconds(records, from: from, to: to) { $0 == inBed }
            return sleepingTime == nil && bedTime == nil ? nil : .sleep(seconds: sleepingTime, inBedSeconds: bedTime)
        default: break
        }

        guard let spec = metric.quantity, let quantityType = type as? HKQuantityType else { return nil }
        switch spec.summary {
        case .sum:
            let days = try await statistics(quantityType, unit: spec.unit, from: from, to: to, calendar: calendar)
            let values = days.map(\.2).filter(\.isFinite)
            let total = values.reduce(0, +) * spec.multiplier
            return !values.isEmpty && total.isFinite ? .quantity(value: total) : nil
        case .average:
            return try await average(quantityType, from: from, to: to).flatMap { average in
                let value = average.doubleValue(for: spec.unit) * spec.multiplier
                return value.isFinite ? .quantity(value: value) : nil
            }
        case .latest:
            let saveable = metric.accountMeasurement != nil
            let readings = try await samples(type, from: from, to: to,
                                             limit: saveable ? HKObjectQueryNoLimit : 1, ascending: saveable) as? [HKQuantitySample] ?? []
            if saveable {
                let converted = readings.compactMap { sample -> NativeHealthBodySample? in
                    let value = sample.quantity.doubleValue(for: spec.unit) * spec.multiplier
                    guard value.isFinite && value > 0 else { return nil }
                    let source = sample.sourceRevision.source
                    let sourceID = [source.bundleIdentifier, sample.device?.localIdentifier ?? ""].joined(separator: ":")
                    return NativeHealthBodySample(id: sample.uuid.uuidString.lowercased(), metric: metric, date: sample.startDate,
                                                  value: value, sourceName: source.name, sourceID: sourceID)
                }
                return converted.isEmpty ? nil : .body(converted)
            }
            guard let latest = readings.first else { return nil }
            let value = latest.quantity.doubleValue(for: spec.unit) * spec.multiplier
            return value.isFinite ? .quantity(value: value, latest: latest.startDate) : nil
        }
    }

    private func samples(_ type: HKSampleType, from: Date, to: Date,
                         options: HKQueryOptions = [.strictStartDate, .strictEndDate],
                         limit: Int = HKObjectQueryNoLimit, ascending: Bool = true) async throws -> [HKSample] {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: options)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate,
                                      limit: limit,
                                      sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: ascending)]) { _, results, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: results ?? []) }
            }
            store.execute(query)
        }
    }

    private func average(_ type: HKQuantityType, from: Date, to: Date) async throws -> HKQuantity? {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: [.strictStartDate, .strictEndDate])
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .discreteAverage) { _, result, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: result?.averageQuantity()) }
            }
            store.execute(query)
        }
    }

    // Sources may report the same hours with fine- and coarse-grained sleep records. Count their overlap once.
    private static func coveredSeconds(_ records: [HKCategorySample], from: Date, to: Date, matches: (Int) -> Bool) -> TimeInterval? {
        let intervals = records.compactMap { sample -> DateInterval? in
            let start = max(from, sample.startDate)
            let end = min(to, sample.endDate)
            guard matches(sample.value), start < end else { return nil }
            return DateInterval(start: start, end: end)
        }.sorted { $0.start < $1.start }
        guard var period = intervals.first else { return nil }
        var seconds: TimeInterval = 0
        for next in intervals.dropFirst() {
            if next.start <= period.end { period.end = max(period.end, next.end) }
            else {
                seconds += period.duration
                period = next
            }
        }
        return seconds + period.duration
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
        if selected.contains(.bodyMass) {
            let readings = try await samples(sampleType(.bodyMass), from: from, to: to) as? [HKQuantitySample] ?? []
            weights = readings.compactMap { item in
                let value = item.quantity.doubleValue(for: .gramUnit(with: .kilo))
                guard value.isFinite && value > 0 && item.startDate < to else { return nil }
                return BodyMassRecord(id: item.uuid.uuidString, at: epochMilliseconds(item.startDate), value: value,
                                      sourceName: String(item.sourceRevision.source.name.prefix(160)), sourceId: String(item.sourceRevision.source.bundleIdentifier.prefix(200)))
            }
        }
        let workouts = selected.contains(.workouts)
            ? try await systemWorkouts(from: from, to: to, includeEnergy: selected.contains(.activeEnergy)) : []
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

    private func systemWorkouts(from: Date, to: Date, includeEnergy: Bool) async throws -> [SystemWorkoutRecord] {
        let readings = try await samples(sampleType(.workouts), from: from, to: to) as? [HKWorkout] ?? []
        let energy = includeEnergy ? HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) : nil
        return readings.filter { $0.startDate < to }.map { item in
            SystemWorkoutRecord(id: item.uuid.uuidString, from: epochMilliseconds(item.startDate), to: epochMilliseconds(item.endDate),
                                activity: Self.activityName(item.workoutActivityType), durationSeconds: item.duration,
                                activeEnergyKcal: energy.flatMap { item.statistics(for: $0)?.sumQuantity()?.doubleValue(for: .kilocalorie()) },
                                sourceName: String(item.sourceRevision.source.name.prefix(160)), sourceId: String(item.sourceRevision.source.bundleIdentifier.prefix(200)))
        }
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
