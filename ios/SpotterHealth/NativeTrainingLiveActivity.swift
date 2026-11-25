import ActivityKit
import Foundation

@available(iOS 16.1, *)
@MainActor
final class NativeTrainingLiveActivity {
    static let shared = NativeTrainingLiveActivity()

    private typealias Training = Activity<SpotterTrainingActivityAttributes>
    private typealias State = SpotterTrainingActivityAttributes.ContentState
    private static let lastStartedKey = "spotter.native.training.live-activity.started"

    private struct Update: Equatable {
        let workoutKey: String?
        let state: State?
        let foreground: Bool
    }

    private var pending: Update?
    private var isUpdating = false

    func sync(workoutKey: String?, state: SpotterTrainingActivityAttributes.ContentState?, foreground: Bool) {
        pending = Update(workoutKey: workoutKey, state: state, foreground: foreground)
        guard !isUpdating else { return }
        isUpdating = true
        Task {
            while let update = pending {
                pending = nil
                await apply(update)
            }
            isUpdating = false
        }
    }

    private func apply(_ update: Update) async {
        let authorized = ActivityAuthorizationInfo().areActivitiesEnabled
        let activities = Training.activities
        for activity in activities where !authorized || activity.attributes.workoutKey != update.workoutKey {
            if #available(iOS 16.2, *) {
                await activity.end(nil, dismissalPolicy: .immediate)
            } else {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
        guard pending == nil else { return }
        guard let workoutKey = update.workoutKey, let state = update.state else {
            UserDefaults.standard.removeObject(forKey: Self.lastStartedKey)
            return
        }
        guard authorized else { return }

        if let activity = activities.first(where: { $0.attributes.workoutKey == workoutKey }) {
            if #available(iOS 16.2, *) {
                if activity.content.state != state { await activity.update(ActivityContent(state: state, staleDate: nil)) }
            } else if activity.contentState != state {
                await activity.update(using: state)
            }
            return
        }

        // A user-dismissed activity stays dismissed for this workout.
        let defaults = UserDefaults.standard
        guard update.foreground, defaults.string(forKey: Self.lastStartedKey) != workoutKey else { return }
        let attributes = SpotterTrainingActivityAttributes(workoutKey: workoutKey)
        do {
            if #available(iOS 16.2, *) {
                _ = try Training.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil))
            } else {
                _ = try Training.request(attributes: attributes, contentState: state)
            }
            defaults.set(workoutKey, forKey: Self.lastStartedKey)
        } catch {
            // ActivityKit can decline a request while the foreground state is changing.
        }
    }
}
