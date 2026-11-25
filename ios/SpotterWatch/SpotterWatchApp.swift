import HealthKit
import SwiftUI
import WatchKit

@main
struct SpotterWatchApp: App {
    @WKApplicationDelegateAdaptor private var delegate: SpotterWatchDelegate

    var body: some Scene {
        WindowGroup { SpotterWatchHeartView(workout: .shared) }
    }
}

final class SpotterWatchDelegate: NSObject, WKApplicationDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { await SpotterWatchWorkout.shared.receive(workoutConfiguration) }
    }

    func handleActiveWorkoutRecovery() {
        Task { await SpotterWatchWorkout.shared.endRecoveredWorkout() }
    }
}

@MainActor
private final class SpotterWatchWorkout: NSObject, ObservableObject {
    enum Phase: Equatable {
        case idle, checking, permissionRequired, connecting, running, paused, ended, unavailable, failed, disconnected

        var title: String {
            switch self {
            case .idle: "准备就绪"
            case .checking: "正在检查权限"
            case .permissionRequired: "需要健康授权"
            case .connecting: "正在连接 iPhone"
            case .running: "正在测量心率"
            case .paused: "心率测量已暂停"
            case .ended: "心率测量已结束"
            case .unavailable: "此手表无法读取心率"
            case .failed: "暂时无法开始测量"
            case .disconnected: "与 iPhone 的连接已中断"
            }
        }
    }

    struct Reading {
        let bpm: Double
        let measuredAt: Date

        var milliseconds: Int64 { Int64((measuredAt.timeIntervalSince1970 * 1_000).rounded()) }
    }

    static let shared = SpotterWatchWorkout()

    @Published private(set) var phase = Phase.idle
    @Published private(set) var reading: Reading?
    @Published private(set) var phoneConnected = true

    private let store = HKHealthStore()
    private let heartRate = HKQuantityType(.heartRate)
    private let workoutType = HKObjectType.workoutType()
    private var pendingConfiguration: HKWorkoutConfiguration?
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var disconnectTask: Task<Void, Never>?
    private var collecting = false
    private var measuredAfter = Date.distantPast
    private var latestSampleAt = Date.distantPast

    var canStop: Bool {
        phase == .connecting || phase == .running || phase == .paused
    }

    func receive(_ configuration: HKWorkoutConfiguration) async {
        guard session == nil, phase != .checking else { return }
        pendingConfiguration = configuration
        guard HKHealthStore.isHealthDataAvailable() else { phase = .unavailable; return }
        phase = .checking

        do {
            let request = try await store.statusForAuthorizationRequest(toShare: [workoutType], read: [heartRate])
            guard request == .unnecessary, store.authorizationStatus(for: workoutType) == .sharingAuthorized else {
                phase = .permissionRequired
                return
            }
            await startPendingWorkout()
        } catch {
            phase = .permissionRequired
        }
    }

    func authorize() async {
        guard phase == .permissionRequired else { return }
        phase = .checking
        do {
            try await store.requestAuthorization(toShare: [workoutType], read: [heartRate])
            guard store.authorizationStatus(for: workoutType) == .sharingAuthorized else {
                phase = .permissionRequired
                return
            }
            await startPendingWorkout()
        } catch {
            phase = .permissionRequired
        }
    }

    private func startPendingWorkout() async {
        guard let configuration = pendingConfiguration else { phase = .idle; return }
        pendingConfiguration = nil
        phase = .connecting
        reading = nil
        phoneConnected = true
        latestSampleAt = .distantPast
        measuredAfter = .distantPast

        do {
            let current = try HKWorkoutSession(healthStore: store, configuration: configuration)
            let workoutBuilder = current.associatedWorkoutBuilder()
            let source = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: configuration)
            for type in source.typesToCollect where type != heartRate {
                source.disableCollection(for: type)
            }
            source.enableCollection(for: heartRate, predicate: nil)
            workoutBuilder.dataSource = source
            workoutBuilder.delegate = self
            current.delegate = self
            session = current
            builder = workoutBuilder

            do {
                try await current.startMirroringToCompanionDevice()
                guard session === current else {
                    try? await current.stopMirroringToCompanionDevice()
                    return
                }
                let start = Date()
                measuredAfter = start
                current.startActivity(with: start)
                try await workoutBuilder.beginCollection(at: start)
                guard session === current else { return }
                collecting = true
                if current.state == .ended || current.state == .stopped {
                    finish(current, as: .ended)
                } else {
                    setTrackingPhase(current.state == .paused ? .paused : .running, for: current, at: start)
                    collectHeartRate(from: workoutBuilder)
                }
            } catch {
                finish(current, as: .failed)
            }
        } catch {
            phase = .failed
        }
    }

    func stop() {
        if let session {
            finish(session, as: .ended)
        }
    }

    func endRecoveredWorkout() async {
        guard session == nil, phase == .idle else { return }
        phase = .checking
        if let recovered = try? await store.recoverActiveWorkoutSession() {
            recovered.associatedWorkoutBuilder().discardWorkout()
            recovered.end()
            phase = .ended
        } else {
            phase = .idle
        }
    }

    private func finish(_ current: HKWorkoutSession, as result: Phase) {
        guard session === current else { return }
        disconnectTask?.cancel()
        disconnectTask = nil
        collecting = false
        reading = nil
        builder?.delegate = nil
        builder?.discardWorkout()
        builder = nil
        current.delegate = nil
        session = nil
        if current.state != .ended { current.end() }
        phase = result
    }

    private struct Message: Codable {
        let version: Int
        let kind: String
        var bpm: Double? = nil
        var measuredAtMilliseconds: Int64? = nil
        var status: String? = nil
    }

    private func send(_ message: Message, via current: HKWorkoutSession) {
        guard let data = try? JSONEncoder().encode(message) else { return }
        current.sendToRemoteWorkoutSession(data: data) { [weak self] delivered, _ in
            Task { @MainActor in
                self?.updateConnection(delivered, for: current)
            }
        }
    }

    private func updateConnection(_ connected: Bool, for current: HKWorkoutSession) {
        guard session === current, phoneConnected != connected else { return }
        phoneConnected = connected
        if connected {
            disconnectTask?.cancel()
            disconnectTask = nil
        } else {
            disconnectTask = Task { [weak self] in
                // Allow HealthKit to reestablish mirroring after a brief disconnect.
                for _ in 0..<5 {
                    do { try await Task.sleep(for: .seconds(10)) }
                    catch { return }
                    guard let self, session === current, !phoneConnected else { return }
                    let status = phase == .paused ? "paused" : "running"
                    send(Message(version: 1, kind: "status", status: status), via: current)
                }
                do { try await Task.sleep(for: .seconds(10)) }
                catch { return }
                guard let self, session === current, !phoneConnected else { return }
                finish(current, as: .disconnected)
            }
        }
    }

    private func setTrackingPhase(_ next: Phase, for current: HKWorkoutSession, at date: Date) {
        guard phase != next else { return }
        measuredAfter = max(measuredAfter, date)
        reading = nil
        phase = next
        let status = next == .running ? "running" : "paused"
        send(Message(version: 1, kind: "status", status: status), via: current)
    }

    private func collectHeartRate(from workoutBuilder: HKLiveWorkoutBuilder) {
        guard builder === workoutBuilder, let session, collecting, phase == .running,
              let statistics = workoutBuilder.statistics(for: heartRate),
              let quantity = statistics.mostRecentQuantity(),
              let measuredAt = statistics.mostRecentQuantityDateInterval()?.end,
              measuredAt >= measuredAfter, measuredAt > latestSampleAt,
              measuredAt <= Date().addingTimeInterval(5) else { return }
        let bpm = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        guard (20...260).contains(bpm) else { return }
        latestSampleAt = measuredAt
        let current = Reading(bpm: bpm, measuredAt: measuredAt)
        reading = current
        send(Message(version: 1, kind: "heartRate", bpm: bpm, measuredAtMilliseconds: current.milliseconds), via: session)
    }
}

extension SpotterWatchWorkout: HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState, date: Date) {
        Task { @MainActor in
            guard session === workoutSession else { return }
            switch toState {
            case .running, .paused:
                guard collecting, workoutSession.state == toState else { return }
                setTrackingPhase(toState == .running ? .running : .paused, for: workoutSession, at: date)
            case .stopped, .ended:
                finish(workoutSession, as: .ended)
            default:
                break
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in finish(workoutSession, as: .failed) }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession values: [Data]) {
        let stopRequested = values.contains { data in
            guard data.count < 256, let command = try? JSONDecoder().decode(Message.self, from: data) else { return false }
            return command.version == 1 && command.kind == "stop"
        }
        if stopRequested { Task { @MainActor in finish(workoutSession, as: .ended) } }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?) {
        Task { @MainActor in updateConnection(false, for: workoutSession) }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard collectedTypes.contains(HKQuantityType(.heartRate)) else { return }
        Task { @MainActor in collectHeartRate(from: workoutBuilder) }
    }
}

private struct SpotterWatchHeartView: View {
    @ObservedObject var workout: SpotterWatchWorkout
    private let lime = Color(red: 0.79, green: 0.94, blue: 0.48)

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "heart.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(lime)
                    .accessibilityHidden(true)
                Text("训练搭子")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if workout.phase == .running || workout.phase == .paused {
                    TimelineView(.periodic(from: .now, by: 5)) { timeline in
                        let value = workout.reading.flatMap { timeline.date.timeIntervalSince($0.measuredAt) <= 25 ? Int($0.bpm.rounded()) : nil }
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(value.map(String.init) ?? "–")
                                .font(.system(size: 46, weight: .bold, design: .rounded).monospacedDigit())
                            Text("BPM").font(.caption.weight(.semibold)).foregroundStyle(lime)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(value.map { "心率 \($0) 次每分钟" } ?? "等待心率")
                        .privacySensitive()
                    }
                }
                Text(workout.phase.title)
                    .font(.caption.weight(.semibold))
                    .multilineTextAlignment(.center)
                if let detail {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                if workout.phase == .permissionRequired {
                    Button("授权并开始") { Task { await workout.authorize() } }
                        .buttonStyle(.borderedProminent)
                        .tint(lime)
                        .foregroundStyle(.black)
                } else if workout.canStop {
                    Button("停止心率测量", action: workout.stop)
                        .buttonStyle(.bordered)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 5)
            .padding(.vertical, 6)
        }
    }

    private var detail: String? {
        switch workout.phase {
        case .idle, .ended: "在 iPhone 的训练页连接 Apple Watch。"
        case .permissionRequired: "请允许读取心率并授权训练会话。如果已拒绝，请在健康设置中检查权限。"
        case .running where !workout.phoneConnected: "正在尝试重新连接 iPhone。"
        case .running where workout.reading == nil: "戴紧手表，等待第一笔心率。"
        case .paused: "在 iPhone 继续训练后恢复心率测量。"
        case .failed, .disconnected: "检查手表与 iPhone 的连接，再从训练页重试。"
        default: nil
        }
    }
}
