import HealthKit
import SwiftUI
import WatchKit

@main
struct SpotterWatchApp: App {
    @WKApplicationDelegateAdaptor private var delegate: SpotterWatchDelegate

    var body: some Scene {
        WindowGroup { SpotterWatchTrainingView(workout: .shared) }
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
    @Published private(set) var workoutState: NativeWatchWorkoutStatePacket?
    @Published private(set) var actionPending = false
    @Published private(set) var actionNotice: String?

    private let store = HKHealthStore()
    private let heartRate = HKQuantityType(.heartRate)
    private let workoutType = HKObjectType.workoutType()
    private var pendingConfiguration: HKWorkoutConfiguration?
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var disconnectTask: Task<Void, Never>?
    private var actionTimeout: Task<Void, Never>?
    private var pendingActionID: UUID?
    private var collecting = false
    private var measuredAfter = Date.distantPast
    private var latestSampleAt = Date.distantPast

    var canStop: Bool {
        phase == .connecting || phase == .running || phase == .paused
    }

    var canControl: Bool { phoneConnected && workoutState != nil && !actionPending }

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
        clearMirroredState()
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
        clearMirroredState()
        builder?.delegate = nil
        builder?.discardWorkout()
        builder = nil
        current.delegate = nil
        session = nil
        if current.state != .ended { current.end() }
        phase = result
    }

    private func clearMirroredState() {
        actionTimeout?.cancel()
        actionTimeout = nil
        pendingActionID = nil
        actionPending = false
        actionNotice = nil
        workoutState = nil
    }

    func control(_ action: NativeWatchWorkoutCommand.Action, position: NativeWatchWorkoutSnapshot.Position? = nil,
                 weight: Double? = nil, reps: Int? = nil, seconds: Int? = nil, running: Bool? = nil,
                 adjustment: Int? = nil, edit: WatchSetTarget? = nil) {
        guard let session, let workoutState, canControl else {
            actionNotice = "等 iPhone 重新连接后再记录。"
            return
        }
        if let edit, edit.token != workoutState.token || edit.revision != workoutState.revision {
            actionNotice = "训练进度已变化，请重新打开当前组。"
            return
        }
        let command = NativeWatchWorkoutCommand(token: workoutState.token, revision: workoutState.revision,
                                                action: action, position: position, weight: weight,
                                                reps: reps, seconds: seconds, running: running, adjustment: adjustment)
        guard workoutState.allows(command), let data = command.encoded() else {
            actionNotice = "请核对当前组或休息时间后重试。"
            return
        }
        let requestID = command.id
        pendingActionID = requestID
        actionPending = true
        actionNotice = nil
        actionTimeout = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(8)) } catch { return }
            guard let self, self.pendingActionID == requestID else { return }
            self.resolveAction(requestID, notice: "还未确认，请核对 iPhone 上的进度。")
            self.refreshWorkoutState()
        }
        session.sendToRemoteWorkoutSession(data: data) { [weak self] delivered, _ in
            guard !delivered else { return }
            Task { @MainActor in
                guard let self, self.session === session else { return }
                self.resolveAction(requestID, notice: "暂时无法连接 iPhone，请稍后重试。")
            }
        }
    }

    private func resolveAction(_ id: UUID, notice: String?) {
        guard pendingActionID == id else { return }
        actionTimeout?.cancel()
        actionTimeout = nil
        pendingActionID = nil
        actionPending = false
        actionNotice = notice
    }

    private func receiveWorkoutState(_ packet: NativeWatchWorkoutStatePacket) {
        if let previous = workoutState {
            guard previous.token == packet.token else { return }
            if packet.revision >= previous.revision { workoutState = packet }
        } else {
            workoutState = packet
        }
        if let response = packet.acknowledgement {
            resolveAction(response.id, notice: response.applied ? nil : "训练进度已变化，请核对后再记。")
        }
    }

    private func refreshWorkoutState() {
        guard phoneConnected, let session, let workoutState,
              let data = NativeWatchWorkoutCommand(token: workoutState.token, revision: workoutState.revision,
                                                   action: .refresh).encoded() else { return }
        session.sendToRemoteWorkoutSession(data: data) { _, _ in }
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
            refreshWorkoutState()
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
        Task { @MainActor in
            guard session === workoutSession else { return }
            for data in values {
                if data.count < 256, let command = try? JSONDecoder().decode(Message.self, from: data),
                   command.version == 1, command.kind == "stop" {
                    finish(workoutSession, as: .ended)
                    return
                }
                if let packet = NativeWatchWorkoutStatePacket.decode(data) {
                    updateConnection(true, for: workoutSession)
                    receiveWorkoutState(packet)
                }
            }
        }
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

private enum WatchTrainingColors {
    static let background = Color(red: 0.035, green: 0.065, blue: 0.055)
    static let surface = Color(red: 0.085, green: 0.15, blue: 0.115)
    static let raised = Color(red: 0.125, green: 0.205, blue: 0.16)
    static let border = Color(red: 0.19, green: 0.29, blue: 0.22)
    static let lime = Color(red: 0.82, green: 0.98, blue: 0.54)
    static let text = Color(red: 0.95, green: 0.98, blue: 0.92)
    static let secondary = Color(red: 0.69, green: 0.78, blue: 0.70)
}

private func watchDuration(_ seconds: Int) -> String {
    let seconds = max(0, seconds)
    if seconds >= 3_600 { return String(format: "%d:%02d:%02d", seconds / 3_600, seconds / 60 % 60, seconds % 60) }
    return String(format: "%02d:%02d", seconds / 60, seconds % 60)
}

private func watchWeight(_ weight: Double) -> String {
    weight.formatted(.number.precision(.fractionLength(0...2)))
}

private struct WatchTrainingButton: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    var primary = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.footnote.weight(.semibold))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, 4)
            .foregroundStyle(primary ? WatchTrainingColors.background : WatchTrainingColors.text)
            .background(primary ? WatchTrainingColors.lime : WatchTrainingColors.raised, in: RoundedRectangle(cornerRadius: 13))
            .opacity(configuration.isPressed ? 0.68 : (enabled ? 1 : 0.5))
    }
}

private struct WatchSetTarget: Identifiable {
    var token: UUID? = nil
    var revision: Int? = nil
    let exercise: NativeWatchWorkoutSnapshot.Exercise
    let set: NativeWatchWorkoutSnapshot.Set

    var id: String { "\(exercise.index):\(set.index)" }
    var position: NativeWatchWorkoutSnapshot.Position { .init(move: exercise.index, row: set.index) }
    var title: String { "第 \(set.index + 1) 组" }

    var values: String {
        if exercise.isTimed { return watchDuration(set.seconds) }
        let left = "\(watchWeight(set.weight)) \(exercise.unit) × \(set.reps)"
        guard let right = set.right else { return left }
        return "左 \(left)\n右 \(watchWeight(right.weight)) \(exercise.unit) × \(right.reps)"
    }
}

private struct SpotterWatchTrainingView: View {
    @ObservedObject var workout: SpotterWatchWorkout
    @AppStorage("watch.restHaptics") private var restHaptics = true
    @AppStorage("watch.crownInput") private var crownInput = true
    @State private var showsSettings = false
    @State private var editing: WatchSetTarget?

    private struct RestCue: Equatable {
        let token: UUID
        let deadline: Int
        let runningSince: Int64
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                toolbar
                if let snapshot = workout.workoutState?.snapshot {
                    trainingHeader(snapshot)
                    connectionNotice
                    sessionControls(snapshot)
                    workoutProgress(snapshot)
                    ForEach(snapshot.exercises, id: \.index) { exercise in exerciseCard(exercise, next: snapshot.next) }
                    if snapshot.exercises.isEmpty {
                        Text("当前训练没有分组动作。")
                            .font(.footnote).foregroundStyle(WatchTrainingColors.secondary)
                    }
                } else {
                    connectionCard
                }
            }
            .padding(.horizontal, 7)
            .padding(.bottom, 10)
        }
        .background(WatchTrainingColors.background.ignoresSafeArea())
        .foregroundStyle(WatchTrainingColors.text)
        .sheet(isPresented: $showsSettings) { settings }
        .sheet(item: $editing) { target in
            WatchSetEntry(target: target, crownInput: crownInput) { weight, reps, seconds in
                workout.control(.completeSet, position: target.position, weight: weight, reps: reps, seconds: seconds, edit: target)
            }
        }
        .task(id: restCue) { await remindWhenRestEnds() }
    }

    private var toolbar: some View {
        HStack(spacing: 5) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.lime)
                .accessibilityHidden(true)
            if workout.workoutState == nil {
                Text("训练搭子").font(.footnote.weight(.bold)).lineLimit(1)
            }
            Spacer(minLength: 0)
            if let snapshot = workout.workoutState?.snapshot {
                let running = snapshot.runningSinceMilliseconds != nil
                toolbarButton(running ? "pause.fill" : "play.fill", label: running ? "暂停训练" : "继续训练") {
                    workout.control(.setRunning, running: !running)
                }
                .disabled(!workout.canControl)
            }
            toolbarButton("gearshape", label: "训练设置") { showsSettings = true }
        }
    }

    private func toolbarButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.footnote.weight(.semibold))
                .frame(width: 33, height: 30)
                .background(WatchTrainingColors.raised, in: Capsule())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var connectionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "applewatch")
                .font(.title3.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.lime)
                .accessibilityHidden(true)
            Text(workout.phase == .idle ? "腕上训练" : workout.phase.title)
                .font(.headline.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text(connectionHelp)
                .font(.footnote)
                .foregroundStyle(WatchTrainingColors.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if workout.phase == .permissionRequired {
                Button("授权并开始") { Task { await workout.authorize() } }
                    .buttonStyle(WatchTrainingButton(primary: true))
            } else if workout.canStop {
                Button("断开手表", action: workout.stop)
                    .buttonStyle(WatchTrainingButton())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private var connectionHelp: String {
        switch workout.phase {
        case .permissionRequired: "请允许读取心率并授权训练会话。"
        case .checking: "正在检查 Apple 健康权限。"
        case .connecting, .running, .paused: "正在接收 iPhone 上的训练。"
        case .failed, .disconnected: "请回到 iPhone 的训练页，重新连接手表。"
        case .unavailable: "请在支持心率读取的 Apple Watch 上使用。"
        case .idle, .ended: "先在 iPhone 开始训练，再连接手表。"
        }
    }

    private func trainingHeader(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(snapshot.title)
                .font(.headline.weight(.bold))
                .lineLimit(2)
                .accessibilityAddTraits(.isHeader)
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                let elapsed = watchDuration(snapshot.elapsed(at: timeline.date) / 1_000)
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(elapsed)
                        .font(.system(.title3, design: .rounded, weight: .bold).monospacedDigit())
                        .lineLimit(1).minimumScaleFactor(0.68)
                        .accessibilityLabel("训练计时 \(elapsed)")
                    Spacer(minLength: 0)
                    heartRate(at: timeline.date)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(11)
        .background(LinearGradient(colors: [WatchTrainingColors.raised, WatchTrainingColors.surface],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder private func workoutProgress(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        let total = snapshot.exercises.reduce(0) { $0 + $1.sets.count }
        if total > 0 {
            let completed = snapshot.exercises.reduce(0) { $0 + $1.sets.filter(\.done).count }
            ProgressView(value: Double(completed), total: Double(total)) {
                Text("\(completed) / \(total) 组")
                    .font(.caption2.weight(.semibold)).foregroundStyle(WatchTrainingColors.secondary)
            }
            .tint(WatchTrainingColors.lime)
            .accessibilityLabel("完成 \(completed) 组，共 \(total) 组")
        }
    }

    private func heartRate(at date: Date) -> some View {
        let value = workout.phase == .running ? workout.reading.flatMap {
            (-5...30).contains(date.timeIntervalSince($0.measuredAt)) ? Int($0.bpm.rounded()) : nil
        } : nil
        return HStack(spacing: 3) {
            Image(systemName: "heart.fill").font(.caption2)
            Text(value.map(String.init) ?? "–").font(.footnote.weight(.semibold).monospacedDigit())
            Text("BPM").font(.system(size: 9, weight: .semibold))
        }
        .fixedSize(horizontal: true, vertical: false)
        .layoutPriority(1)
        .foregroundStyle(WatchTrainingColors.lime)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(value.map { "心率 \($0) 次每分钟" } ?? "等待心率")
        .privacySensitive()
    }

    @ViewBuilder private var connectionNotice: some View {
        if !workout.phoneConnected || workout.actionPending || workout.actionNotice != nil {
            let text = workout.actionNotice ?? (workout.phoneConnected ? "正在同步到 iPhone" : "正在重新连接 iPhone")
            Label(text, systemImage: workout.actionNotice != nil ? "exclamationmark.circle" : "arrow.triangle.2.circlepath")
                .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func sessionControls(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            if let remaining = snapshot.restRemainingSeconds(at: timeline.date), remaining > 0 {
                restControls(label: snapshot.restLabel ?? "组间休息", remaining: remaining)
            } else if let target = currentSet {
                Button { editing = target } label: {
                    Label("记录第 \(target.set.index + 1) 组", systemImage: "checkmark")
                }
                .buttonStyle(WatchTrainingButton(primary: true))
                .accessibilityHint(target.exercise.name)
                .disabled(!workout.canControl || snapshot.runningSinceMilliseconds == nil)
            } else if snapshot.exercises.contains(where: { !$0.sets.isEmpty }) {
                Label("组次已完成，可在 iPhone 结束训练。", systemImage: "checkmark.circle")
                    .font(.caption2)
                    .foregroundStyle(WatchTrainingColors.secondary)
            }
        }
    }

    private func restControls(label: String, remaining: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(label).font(.caption2.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
                Text(watchDuration(remaining))
                    .font(.system(.headline, design: .rounded, weight: .bold).monospacedDigit())
                    .foregroundStyle(WatchTrainingColors.lime)
            }
            HStack(spacing: 4) {
                Button("−15 秒") { workout.control(.adjustRest, adjustment: -15) }
                    .accessibilityLabel("休息减少 15 秒")
                Button("+15 秒") { workout.control(.adjustRest, adjustment: 15) }
                    .accessibilityLabel("休息增加 15 秒")
                Button("跳过") { workout.control(.skipRest) }
                    .accessibilityLabel("跳过休息")
            }
            .buttonStyle(WatchTrainingButton())
            .disabled(!workout.canControl)
        }
        .padding(8)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    private var currentSet: WatchSetTarget? {
        guard let state = workout.workoutState else { return nil }
        let snapshot = state.snapshot
        guard let next = snapshot.next, let exercise = snapshot.exercises.first(where: { $0.index == next.move }),
              let set = exercise.sets.first(where: { $0.index == next.row }), !set.done else { return nil }
        return WatchSetTarget(token: state.token, revision: state.revision, exercise: exercise, set: set)
    }

    private func exerciseCard(_ exercise: NativeWatchWorkoutSnapshot.Exercise, next: NativeWatchWorkoutSnapshot.Position?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(exercise.name)
                .font(.footnote.weight(.bold))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 9)
                .padding(.vertical, 7)
                .background(WatchTrainingColors.raised)
                .accessibilityAddTraits(.isHeader)
            ForEach(exercise.sets, id: \.index) { set in
                let target = WatchSetTarget(exercise: exercise, set: set)
                let current = next?.move == exercise.index && next?.row == set.index
                setRow(target, isCurrent: current)
            }
        }
        .background(WatchTrainingColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }

    private func setRow(_ target: WatchSetTarget, isCurrent: Bool) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: target.set.done ? "checkmark.circle.fill" : isCurrent ? "circle.inset.filled" : "circle")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(target.set.done || isCurrent ? WatchTrainingColors.lime : WatchTrainingColors.secondary)
                .accessibilityHidden(true)
            Text("\(target.set.index + 1)").font(.caption2.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.secondary)
                .accessibilityHidden(true)
            Text(target.values)
                .font(.footnote.weight(isCurrent ? .semibold : .regular).monospacedDigit())
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .overlay(alignment: .top) { Rectangle().fill(WatchTrainingColors.border).frame(height: 0.5) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(target.title)，\(target.values)，\(target.set.done ? "已完成" : isCurrent ? "当前组" : "待完成")")
    }

    private var settings: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                Text("训练设置").font(.headline.weight(.bold)).accessibilityAddTraits(.isHeader)
                Toggle("休息结束震动", isOn: $restHaptics).tint(WatchTrainingColors.lime)
                Toggle("数码表冠输入", isOn: $crownInput).tint(WatchTrainingColors.lime)
                Text(crownInput ? "点选数值后旋转表冠。" : "使用加减按钮调整重量、次数或时长。")
                    .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                if workout.canStop {
                    Button("断开手表") { showsSettings = false; workout.stop() }
                        .buttonStyle(WatchTrainingButton())
                }
                Button("完成") { showsSettings = false }
                    .buttonStyle(WatchTrainingButton(primary: true))
            }
            .padding(9)
        }
        .background(WatchTrainingColors.background.ignoresSafeArea())
        .foregroundStyle(WatchTrainingColors.text)
    }

    private var restCue: RestCue? {
        guard restHaptics, workout.phoneConnected, let state = workout.workoutState,
              let deadline = state.snapshot.restElapsedDeadlineMilliseconds,
              let running = state.snapshot.runningSinceMilliseconds else { return nil }
        return RestCue(token: state.token, deadline: deadline, runningSince: running)
    }

    private func remindWhenRestEnds() async {
        guard let cue = restCue, let snapshot = workout.workoutState?.snapshot else { return }
        let delay = cue.deadline - snapshot.elapsed()
        guard delay > 0 else { return }
        do { try await Task.sleep(for: .milliseconds(delay)) } catch { return }
        guard restCue == cue, !Task.isCancelled else { return }
        WKInterfaceDevice.current().play(.notification)
    }
}

private struct WatchSetEntry: View {
    private enum Field: Hashable { case weight, reps, seconds }

    let target: WatchSetTarget
    let crownInput: Bool
    let save: (Double?, Int?, Int?) -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Field?
    @State private var weight: Double
    @State private var reps: Double
    @State private var seconds: Double

    init(target: WatchSetTarget, crownInput: Bool, save: @escaping (Double?, Int?, Int?) -> Void) {
        self.target = target
        self.crownInput = crownInput
        self.save = save
        _weight = State(initialValue: target.set.weight)
        _reps = State(initialValue: Double(target.set.reps))
        _seconds = State(initialValue: Double(target.set.seconds))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(target.exercise.name).font(.headline.weight(.bold))
                Text(target.title).font(.caption2.weight(.semibold)).foregroundStyle(WatchTrainingColors.secondary)
                if target.set.right != nil {
                    Text(target.values).font(.footnote.weight(.semibold)).monospacedDigit()
                    Text("左右两侧的数值可以在 iPhone 修改。")
                        .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                } else if target.exercise.isTimed {
                    editor("时长", text: watchDuration(Int(seconds)), field: .seconds, value: $seconds, maximum: 18_000, step: 1)
                } else {
                    editor("重量", text: "\(watchWeight(weight)) \(target.exercise.unit)", field: .weight, value: $weight, maximum: 2_000, step: 0.5)
                    editor("次数", text: String(Int(reps)), field: .reps, value: $reps, maximum: 999, step: 1)
                }
                if crownInput && target.set.right == nil {
                    Text("点选数值后旋转表冠。")
                        .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                }
                Button("完成这组") {
                    if target.set.right != nil { save(nil, nil, nil) }
                    else if target.exercise.isTimed { save(nil, nil, Int(seconds.rounded())) }
                    else { save(weight == target.set.weight ? nil : weight, Int(reps.rounded()), nil) }
                    dismiss()
                }
                .buttonStyle(WatchTrainingButton(primary: true))
            }
            .padding(8)
        }
        .background(WatchTrainingColors.background.ignoresSafeArea())
        .foregroundStyle(WatchTrainingColors.text)
    }

    @ViewBuilder private func editor(_ title: String, text: String, field: Field, value: Binding<Double>, maximum: Double, step: Double) -> some View {
        let bounds = 0...maximum
        if crownInput {
            valueLabel(title, text: text)
                .contentShape(Rectangle())
                .onTapGesture { focused = field }
                .focusable()
                .focused($focused, equals: field)
                .digitalCrownRotation(value, from: bounds.lowerBound, through: bounds.upperBound, by: step,
                                      sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true)
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: value.wrappedValue = min(bounds.upperBound, value.wrappedValue + step)
                    case .decrement: value.wrappedValue = max(bounds.lowerBound, value.wrappedValue - step)
                    @unknown default: break
                    }
                }
        } else {
            Stepper(value: value, in: bounds, step: step) { valueLabel(title, text: text) }
        }
    }

    private func valueLabel(_ title: String, text: String) -> some View {
        HStack {
            Text(title).font(.footnote)
            Spacer(minLength: 2)
            Text(text).font(.footnote.weight(.bold).monospacedDigit())
                .foregroundStyle(WatchTrainingColors.lime)
        }
        .frame(minHeight: 39)
        .padding(.horizontal, 7)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}
