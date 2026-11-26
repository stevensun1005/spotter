import ActivityKit
import Combine
import Foundation
import OSLog
import UIKit

@available(iOS 16.1, *)
@MainActor
final class NativeTrainingLiveActivity: ObservableObject {
    static let shared = NativeTrainingLiveActivity()

    /// The per-app switch in iPhone Settings → 训练搭子 → 实时活动.
    @Published private(set) var systemEnabled: Bool
    /// The person swiped this workout's activity off the Lock Screen.
    @Published private(set) var dismissedCurrentWorkout = false
    /// Why ActivityKit refused the last start, shown in 设置 → 计时提醒.
    @Published private(set) var requestProblem: String?

    private typealias Training = Activity<SpotterTrainingActivityAttributes>
    private typealias State = SpotterTrainingActivityAttributes.ContentState
    /// Builds 26 to 50 stored every started workout here and never started it again,
    /// even after iOS ended the activity or the Settings switch was turned off and on.
    private static let legacyStartedKey = "spotter.native.training.live-activity.started"
    private static let dismissedKey = "spotter.native.training.live-activity.dismissed"
    private static let heartRefreshInterval: TimeInterval = 10
    private static let log = Logger(subsystem: "app.spotter.health", category: "LiveActivity")

    private struct Update: Equatable {
        let workoutKey: String?
        let state: State?
        let foreground: Bool
    }

    private var pending: Update?
    private var latest: Update?
    private var isUpdating = false
    /// Last state seen for each activity this process follows.
    private var lastStates: [String: ActivityState] = [:]
    private var endingByApp = Set<String>()
    /// The Settings switch was seen off since the last start. Activities it removed are not swipes.
    private var switchWasOff = false
    /// Last value from activityEnablementUpdates, so only an off → on change clears a swipe.
    private var streamEnabled: Bool

    private init() {
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        systemEnabled = enabled
        streamEnabled = enabled
        switchWasOff = !enabled
        UserDefaults.standard.removeObject(forKey: Self.legacyStartedKey)
        Task { await self.watchEnablement() }
    }

    func sync(workoutKey: String?, state: SpotterTrainingActivityAttributes.ContentState?, foreground: Bool) {
        let update = Update(workoutKey: workoutKey, state: state, foreground: foreground)
        latest = update
        pending = update
        guard !isUpdating else { return }
        isUpdating = true
        Task {
            while let next = pending {
                pending = nil
                await apply(next)
            }
            isUpdating = false
        }
    }

    /// Starts the current workout's activity again after it was swiped off the Lock Screen.
    func showCurrentWorkoutAgain() {
        UserDefaults.standard.removeObject(forKey: Self.dismissedKey)
        dismissedCurrentWorkout = false
        retryLatest()
    }

    private func retryLatest() {
        guard let latest, latest.workoutKey != nil else { return }
        sync(workoutKey: latest.workoutKey, state: latest.state,
             foreground: UIApplication.shared.applicationState == .active)
    }

    private func watchEnablement() async {
        for await enabled in ActivityAuthorizationInfo().activityEnablementUpdates {
            Self.log.notice("Live Activities switch in Settings: \(enabled, privacy: .public)")
            let wasEnabled = streamEnabled
            streamEnabled = enabled
            systemEnabled = enabled
            guard enabled else {
                switchWasOff = true
                continue
            }
            // Only a switch turned back on brings the running workout back, not a repeated "on".
            guard !wasEnabled else { continue }
            UserDefaults.standard.removeObject(forKey: Self.dismissedKey)
            dismissedCurrentWorkout = false
            retryLatest()
        }
    }

    private func apply(_ update: Update) async {
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        if systemEnabled != enabled { systemEnabled = enabled }
        if !enabled { switchWasOff = true }
        let activities = Training.activities
        for activity in activities {
            // A swipe can arrive while the app is suspended. Record it before deciding to request again.
            if activity.activityState == .dismissed { stateChanged(activity, to: .dismissed) } else { observe(activity) }
        }
        // Ended activities stay listed until they leave the Lock Screen. They no longer update,
        // so clear them and request a new one for the same workout.
        for activity in activities where activity.activityState != .dismissed &&
            (!enabled || activity.attributes.workoutKey != update.workoutKey || !Self.isLive(activity)) {
            await end(activity)
        }
        guard pending == nil else { return }
        guard let workoutKey = update.workoutKey, let state = update.state else {
            UserDefaults.standard.removeObject(forKey: Self.dismissedKey)
            dismissedCurrentWorkout = false
            requestProblem = nil
            return
        }
        guard enabled else {
            Self.log.notice("Not started: Live Activities are off in iPhone Settings")
            return
        }

        if let activity = activities.first(where: { $0.attributes.workoutKey == workoutKey && Self.isLive($0) }) {
            UserDefaults.standard.removeObject(forKey: Self.dismissedKey)
            dismissedCurrentWorkout = false
            if requestProblem != nil { requestProblem = nil }
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

        // An activity the person swiped away stays away for this workout.
        let defaults = UserDefaults.standard
        if let dismissed = defaults.string(forKey: Self.dismissedKey) {
            if dismissed == workoutKey {
                dismissedCurrentWorkout = true
                return
            }
            defaults.removeObject(forKey: Self.dismissedKey)
        }
        dismissedCurrentWorkout = false
        // ActivityKit only starts activities for a foreground app. The next foreground refresh retries.
        guard update.foreground else { return }
        let attributes = SpotterTrainingActivityAttributes(workoutKey: workoutKey)
        do {
            let activity: Training
            if #available(iOS 16.2, *) {
                let next = activityState(state, preservingRecentHeartFrom: nil)
                activity = try Training.request(attributes: attributes, content: ActivityContent(state: next, staleDate: next.staleHeartDate))
            } else {
                activity = try Training.request(attributes: attributes, contentState: stateWithoutHeart(state))
            }
            observe(activity)
            requestProblem = nil
            switchWasOff = false
            Self.log.notice("Started activity \(activity.id, privacy: .public)")
        } catch {
            requestProblem = Self.describe(error)
            Self.log.error("ActivityKit refused the request: \(String(describing: error), privacy: .public)")
        }
    }

    private func end(_ activity: Training) async {
        endingByApp.insert(activity.id)
        if #available(iOS 16.2, *) {
            await activity.end(nil, dismissalPolicy: .immediate)
        } else {
            await activity.end(dismissalPolicy: .immediate)
        }
    }

    private func observe(_ activity: Training) {
        guard activity.activityState != .dismissed, lastStates[activity.id] == nil else { return }
        lastStates[activity.id] = activity.activityState
        Task { await self.follow(activity) }
    }

    private func follow(_ activity: Training) async {
        for await state in activity.activityStateUpdates {
            stateChanged(activity, to: state)
            if state == .dismissed { break }
        }
    }

    private func stateChanged(_ activity: Training, to state: ActivityState) {
        let id = activity.id
        // Each removal is handled once, whether follow() or apply() sees it first.
        guard let previous = lastStates[id] else { return }
        Self.log.notice("Activity \(id, privacy: .public) is now \(String(describing: state), privacy: .public)")
        guard state == .dismissed else {
            lastStates[id] = state
            return
        }
        lastStates[id] = nil
        let endedByApp = endingByApp.remove(id) != nil
        // Only a swipe on the Lock Screen takes a running activity straight to dismissed.
        // iOS ends an activity first when it times out, and the Settings switch turns authorization off.
        let key = activity.attributes.workoutKey
        guard !endedByApp, !switchWasOff, Self.isLiveState(previous), ActivityAuthorizationInfo().areActivitiesEnabled,
              latest?.workoutKey == key,
              !Training.activities.contains(where: { $0.id != id && $0.attributes.workoutKey == key && Self.isLive($0) })
        else { return }
        UserDefaults.standard.set(key, forKey: Self.dismissedKey)
        dismissedCurrentWorkout = true
        Self.log.notice("Activity \(id, privacy: .public) was removed from the Lock Screen")
    }

    private static func isLive(_ activity: Training) -> Bool {
        isLiveState(activity.activityState)
    }

    private static func isLiveState(_ state: ActivityState) -> Bool {
        if state == .active { return true }
        if #available(iOS 16.2, *) { return state == .stale }
        return false
    }

    private static func describe(_ error: Error) -> String {
        let reason = (error as? LocalizedError)?.errorDescription ?? String(describing: error)
        return "iOS 没有开始本次训练的实时活动（\(reason)）。回到训练页面时会再试一次。"
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
