import ActivityKit
import Foundation

@available(iOS 16.1, *)
@MainActor
final class NativeTrainingLiveActivity {
    static let shared = NativeTrainingLiveActivity()

    private typealias Training = Activity<SpotterTrainingActivityAttributes>
    private typealias State = SpotterTrainingActivityAttributes.ContentState
    private static let lastStartedKey = "spotter.native.training.live-activity.started"
    private static let heartRefreshInterval: TimeInterval = 10

    private struct Update: Equatable {
        let workoutKey: String?
        let state: State?
        let foreground: Bool
    }

    private var pending: Update?
    private var isUpdating = false

    func sync(workoutKey: String?, state: SpotterTrainingActivityAttributes.ContentState?, foreground: Bool) {
        let update = Update(workoutKey: workoutKey, state: state, foreground: foreground)
        pending = update
        // ActivityKit only starts from the foreground. Request before a later
        // scene update can replace this snapshot in the asynchronous queue.
        startIfNeeded(update)
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
        for activity in currentActivities where !authorized || activity.attributes.workoutKey != update.workoutKey {
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

        if let activity = currentActivities.first(where: { $0.attributes.workoutKey == workoutKey }) {
            if #available(iOS 16.2, *) {
                let current = activity.content.state
                let next = activityState(state, preservingRecentHeartFrom: current)
                if current != next { await activity.update(ActivityContent(state: next, staleDate: next.staleHeartDate)) }
            } else {
                let next = stateWithoutHeart(state)
                if activity.contentState != next { await activity.update(using: next) }
            }
            return
        }
        startIfNeeded(update)
    }

    private var currentActivities: [Training] {
        Training.activities.filter { $0.activityState != .ended && $0.activityState != .dismissed }
    }

    private func startIfNeeded(_ update: Update) {
        guard update.foreground, let workoutKey = update.workoutKey, let state = update.state else { return }
        // A user-dismissed activity stays dismissed for this workout.
        let defaults = UserDefaults.standard
        guard defaults.string(forKey: Self.lastStartedKey) != workoutKey,
              ActivityAuthorizationInfo().areActivitiesEnabled, currentActivities.isEmpty else { return }
        let attributes = SpotterTrainingActivityAttributes(workoutKey: workoutKey)
        do {
            if #available(iOS 16.2, *) {
                let next = activityState(state, preservingRecentHeartFrom: nil)
                _ = try Training.request(attributes: attributes, content: ActivityContent(state: next, staleDate: next.staleHeartDate))
            } else {
                _ = try Training.request(attributes: attributes, contentState: stateWithoutHeart(state))
            }
            defaults.set(workoutKey, forKey: Self.lastStartedKey)
        } catch {
            // ActivityKit can decline a request while the foreground state is changing.
        }
    }

    private func activityState(_ state: State, preservingRecentHeartFrom previous: State?) -> State {
        let now = Date()
        guard state.visibleHeart(at: now) != nil, let newExpiry = state.staleHeartDate else {
            return stateWithoutHeart(state)
        }
        guard let previous, previous.visibleHeart(at: now) != nil, let oldExpiry = previous.staleHeartDate,
              newExpiry.timeIntervalSince(oldExpiry) < Self.heartRefreshInterval else { return state }
        var next = state
        next.heartBPM = previous.heartBPM
        next.heartExpiresAt = oldExpiry
        return next
    }

    private func stateWithoutHeart(_ state: State) -> State {
        var next = state
        next.heartBPM = nil
        next.heartExpiresAt = nil
        return next
    }
}
