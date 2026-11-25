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

        var progress: Double {
            guard totalSets > 0 else { return 0 }
            return min(1, Double(completedSets) / Double(totalSets))
        }
    }

    let workoutKey: String
}
