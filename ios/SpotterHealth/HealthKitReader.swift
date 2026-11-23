import Foundation
import HealthKit

@MainActor
final class HealthKitReader {
    private let store = HKHealthStore()

    private func heartRate() throws -> HKQuantityType {
        guard HKHealthStore.isHealthDataAvailable(),
              let heart = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            throw HealthError.unavailable
        }
        return heart
    }

    func authorize() async throws {
        let heart = try heartRate()
        try await store.requestAuthorization(toShare: [], read: [heart])
    }

    func read(_ workout: WorkoutWindow) async throws -> HeartPayload? {
        guard workout.canRead else { return nil }
        let heart = try heartRate()
        let predicate = HKQuery.predicateForSamples(withStart: workout.start, end: workout.end,
                                                     options: [.strictStartDate, .strictEndDate])
        let samples = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[HeartPoint], Error>) in
            let query = HKSampleQuery(sampleType: heart, predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, results, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let bpm = HKUnit.count().unitDivided(by: .minute())
                let points = (results as? [HKQuantitySample] ?? []).compactMap { sample -> HeartPoint? in
                    let value = sample.quantity.doubleValue(for: bpm)
                    guard value.isFinite && value >= 1 && value <= 300 else { return nil }
                    return HeartPoint(at: Int((sample.startDate.timeIntervalSince1970 * 1_000).rounded()),
                                      bpm: Int(value.rounded()))
                }
                continuation.resume(returning: points)
            }
            self.store.execute(query)
        }
        return HeartPayload.reduce(samples, within: workout)
    }
}

enum HealthError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "这台设备无法读取 Apple 健康。请使用支持健康数据的 iPhone。"
    }
}
