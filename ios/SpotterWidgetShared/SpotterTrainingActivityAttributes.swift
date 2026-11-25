import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct SpotterTrainingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let completedSets: Int
        let totalSets: Int
        let nextMovement: String?
        let nextSet: Int?
        let isRunning: Bool
        let restDeadline: Date?
        let pausedRestSeconds: Int?
        var elapsedStartedAt: Date? = nil
        var elapsedSeconds: Int? = nil
        var heartBPM: Int? = nil
        var heartExpiresAt: Date? = nil

        var progress: Double {
            guard totalSets > 0 else { return 0 }
            return min(1, Double(completedSets) / Double(totalSets))
        }

        var staleHeartDate: Date? {
            guard isRunning, let heartBPM, (20...260).contains(heartBPM) else { return nil }
            return heartExpiresAt
        }

        func visibleHeart(at now: Date = .now) -> Int? {
            guard let expiry = staleHeartDate, expiry > now else { return nil }
            return heartBPM
        }
    }

    let workoutKey: String
}
