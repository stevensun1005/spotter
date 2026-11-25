import HealthKit
import SwiftUI

@available(iOS 17.0, *)
@MainActor
final class NativeWatchHeartRate: NSObject, ObservableObject {
    enum Connection: Equatable {
        case idle, connecting, measuring, paused, disconnected, permissionRequired, unavailable

        var detail: String {
            switch self {
            case .idle: return "手表上记录组次、查看心率"
            case .connecting: return "连接中，请查看手表"
            case .measuring: return "等待手表心率"
            case .paused: return "训练已暂停"
            case .disconnected: return "手表连接已中断"
            case .permissionRequired: return "请在手表检查健康权限"
            case .unavailable: return "请在手表打开训练搭子后重试"
            }
        }
    }

    static let shared = NativeWatchHeartRate()
    @Published private(set) var connection: Connection = .idle
    @Published private(set) var reading: NativeWatchHeartRateReading?

    private struct Request {
        let id: UUID
        let startedAt: Date
    }

    private let healthStore = HKHealthStore()
    private var context: NativeWatchWorkoutContext?
    private var request: Request?
    private var session: HKWorkoutSession?
    private var lastSampleDate: Date?
    private var timeout: Task<Void, Never>?
    private var listening = false
    private var workoutSnapshot: NativeWatchWorkoutSnapshot?
    private var workoutRevision = 0
    private var workoutCommand: (@MainActor (NativeWatchWorkoutCommand) -> NativeWatchWorkoutSnapshot?)?
    private var acknowledgements: [NativeWatchWorkoutAcknowledgement] = []

    func prepare() {
        guard !listening, HKHealthStore.isHealthDataAvailable() else { return }
        listening = true
        healthStore.workoutSessionMirroringStartHandler = { [weak self] incoming in
            Task { @MainActor in self?.receiveSession(incoming) }
        }
    }

    func useWorkout(_ context: NativeWatchWorkoutContext?) {
        if let context, let previous = self.context, context.matches(previous) {
            self.context = context
            guard context.isRunning != previous.isRunning, let session else { return }
            if !context.isRunning {
                reading = nil
                connection = .paused
                if session.state == .running { session.pause() }
            } else {
                connection = .measuring
                if session.state == .paused { session.resume() }
            }
        } else {
            end()
            self.context = context
            workoutSnapshot = nil
            workoutCommand = nil
            workoutRevision = 0
        }
    }

    func updateWorkout(context: NativeWatchWorkoutContext?, snapshot: NativeWatchWorkoutSnapshot?,
                       apply: (@MainActor (NativeWatchWorkoutCommand) -> NativeWatchWorkoutSnapshot?)? = nil) {
        useWorkout(context)
        guard context != nil else { return }
        workoutCommand = apply
        guard workoutSnapshot != snapshot else { return }
        workoutSnapshot = snapshot
        workoutRevision += 1
        sendWorkout()
    }

    func state(for context: NativeWatchWorkoutContext) -> Connection {
        self.context?.matches(context) == true ? connection : .idle
    }

    func latest(for context: NativeWatchWorkoutContext) -> NativeWatchHeartRateReading? {
        state(for: context) == .measuring ? reading : nil
    }

    func connect(_ context: NativeWatchWorkoutContext, activity: HKWorkoutActivityType) {
        guard self.context?.matches(context) == true, connection != .connecting, session == nil else { return }
        prepare()
        guard listening else { connection = .unavailable; return }

        let reconnecting = request != nil
        let currentRequest = request ?? Request(id: UUID(), startedAt: .now)
        let requestID = currentRequest.id
        request = currentRequest
        if !reconnecting { lastSampleDate = nil }
        reading = nil
        connection = .connecting
        timeout?.cancel()
        timeout = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(55)) } catch { return }
            guard let self, self.request?.id == requestID, self.session == nil else { return }
            self.end(showing: .unavailable)
        }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activity
        configuration.locationType = .unknown
        Task { [weak self] in
            guard let self else { return }
            do {
                try await healthStore.startWatchApp(toHandle: configuration)
            } catch {
                guard request?.id == requestID, session == nil else { return }
                if reconnecting { connection = .disconnected }
                else { end(showing: .unavailable) }
            }
        }
    }

    func end(showing status: Connection = .idle) {
        timeout?.cancel()
        timeout = nil
        request = nil
        acknowledgements = []
        lastSampleDate = nil
        reading = nil
        let current = session
        session = nil
        connection = status
        if let current {
            current.delegate = nil
            stop(current)
        }
    }

    private func stop(_ session: HKWorkoutSession) {
        guard session.state != .ended else { return }
        session.sendToRemoteWorkoutSession(data: NativeWatchHeartRatePacket.stop) { _, _ in }
        session.end()
    }

    private func receiveSession(_ incoming: HKWorkoutSession) {
        guard incoming.type == .mirrored else { return }
        guard let context, request != nil else { stop(incoming); return }
        // HealthKit can replace the mirrored object when the same devices reconnect.
        if let session, session !== incoming { session.delegate = nil }
        session = incoming
        reading = nil
        timeout?.cancel()
        timeout = nil
        incoming.delegate = self
        connection = context.isRunning ? .measuring : .paused
        if context.isRunning, incoming.state == .paused { incoming.resume() }
        if !context.isRunning, incoming.state == .running { incoming.pause() }
        sendWorkout()
    }

    private func handle(_ status: NativeWatchHeartRatePacket.Status) {
        switch status {
        case .running:
            if context?.isRunning == true { connection = .measuring }
            sendWorkout()
        case .paused:
            connection = .paused
            reading = nil
            sendWorkout()
        case .ended: end(showing: .disconnected)
        case .permissionRequired: end(showing: .permissionRequired)
        case .unavailable, .failed: end(showing: .unavailable)
        }
    }

    private func receive(_ packets: [Data], via incoming: HKWorkoutSession) {
        for packet in packets {
            guard session === incoming, let request else { continue }
            guard let message = NativeWatchHeartRatePacket(packet, requestedAt: request.startedAt, after: lastSampleDate) else {
                if let action = NativeWatchWorkoutCommand.decode(packet) { receiveWorkoutCommand(action, requestID: request.id) }
                continue
            }
            switch message {
            case .reading(let reading):
                guard context?.isRunning == true, connection == .measuring else { continue }
                lastSampleDate = reading.measuredAt
                self.reading = reading
            case .status(let status): handle(status)
            }
        }
    }

    private func sendWorkout(acknowledgement: NativeWatchWorkoutAcknowledgement? = nil) {
        guard let session, let request, let workoutSnapshot,
              let data = NativeWatchWorkoutStatePacket(token: request.id, revision: workoutRevision,
                                                       snapshot: workoutSnapshot, acknowledgement: acknowledgement).encoded() else { return }
        session.sendToRemoteWorkoutSession(data: data) { _, _ in }
    }

    private func receiveWorkoutCommand(_ command: NativeWatchWorkoutCommand, requestID: UUID) {
        guard command.token == requestID, let context, let workoutSnapshot else { return }
        if let previous = acknowledgements.first(where: { $0.id == command.id }) {
            sendWorkout(acknowledgement: previous)
            return
        }
        if command.action == .refresh {
            sendWorkout(acknowledgement: .init(id: command.id, applied: true))
            return
        }

        let revision = workoutRevision
        let current = NativeWatchWorkoutStatePacket(token: requestID, revision: revision, snapshot: workoutSnapshot)
        var applied = false
        if current.allows(command), let next = workoutCommand?(command) {
            // The store may synchronously publish its new state during the callback.
            guard self.context?.matches(context) == true, self.request?.id == requestID else { return }
            useWorkout(.init(owner: context.owner, workoutID: context.workoutID, isRunning: next.runningSinceMilliseconds != nil))
            self.workoutSnapshot = next
            if workoutRevision == revision { workoutRevision += 1 }
            applied = true
        }
        let response = NativeWatchWorkoutAcknowledgement(id: command.id, applied: applied)
        acknowledgements.append(response)
        if acknowledgements.count > 32 { acknowledgements.removeFirst() }
        sendWorkout(acknowledgement: response)
    }
}

extension NativeWatchWorkoutSnapshot {
    init(session: NativeWorkoutSession, previous: NativeWorkoutSession.SetPosition?) {
        func milliseconds(_ value: NativeJSON, max: Int) -> Int? {
            guard case .number(let number) = value, (0...Double(max)).contains(number) else { return nil }
            return Int(number.rounded(.up))
        }

        func text(_ value: String, fallback: String, limit: Int = 100) -> String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? fallback : String(decoding: trimmed.utf16.prefix(limit), as: UTF16.self)
        }

        func weight(_ value: NativeJSON) -> Double {
            let number = value.number
            guard (0...2_000).contains(number) else { return 0 }
            return (number * 1_000).rounded() / 1_000
        }

        let clock = session.raw["clock"]
        let rows = session.rows
        let exercises = session.plan.exercises.prefix(30).enumerated().map { index, move in
            let sets: [Set] = rows.indices.contains(index) ? rows[index].prefix(30).enumerated().map { row, set in
                let right: Side? = if case .object = set["right"] {
                    .init(weight: weight(set["right"]["weight"]), reps: milliseconds(set["right"]["reps"], max: 999) ?? 0)
                } else { nil }
                return .init(index: row, weight: weight(set["weight"]), reps: milliseconds(set["reps"], max: 999) ?? 0,
                             seconds: milliseconds(set["seconds"], max: 18_000) ?? 0, done: set["done"].bool, right: right)
            } : []
            return Exercise(index: index, name: text(move["name"].string, fallback: "动作"),
                            unit: move["unit"].string == "lb" ? "lb" : "kg", isTimed: move["seconds"].number > 0, sets: sets)
        }

        let next = session.nextSet(after: previous).map { Position(move: $0.move, row: $0.row) }
        let deadline = milliseconds(session.raw["rest"]["until"],
                                    max: Self.maximumElapsedMilliseconds + Self.maximumRestMilliseconds)
        self.init(title: text(session.plan.title, fallback: "训练"),
                  elapsedMilliseconds: milliseconds(clock["elapsed"], max: Self.maximumElapsedMilliseconds) ?? session.elapsedMilliseconds(),
                  runningSinceMilliseconds: milliseconds(clock["runningSince"], max: 9_999_999_999_999),
                  restElapsedDeadlineMilliseconds: deadline,
                  restLabel: deadline == nil ? nil : text(session.raw["rest"]["kind"].string, fallback: "组间休息", limit: 30),
                  next: next?.isValid == true ? next : nil, exercises: exercises)
    }
}

@available(iOS 17.0, *)
extension NativeWatchHeartRate: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState, date: Date) {
        Task { @MainActor in
            guard session === workoutSession else { return }
            switch toState {
            case .running:
                if context?.isRunning == false { workoutSession.pause() }
                else { handle(.running) }
            case .paused: handle(.paused)
            case .stopped, .ended: handle(.ended)
            default: break
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            if session === workoutSession { end(showing: .unavailable) }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
        Task { @MainActor in receive(data, via: workoutSession) }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?) {
        Task { @MainActor in
            guard session === workoutSession else { return }
            workoutSession.delegate = nil
            session = nil
            reading = nil
            // Keep the explicit request scoped to this workout so HealthKit can reconnect.
            connection = .disconnected
        }
    }
}

@available(iOS 17.0, *)
struct NativeWatchHeartRateStrip: View {
    @ObservedObject private var watch = NativeWatchHeartRate.shared
    let context: NativeWatchWorkoutContext
    var cardio: NativeWorkoutSession.CardioActivity?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 5)) { clock in
            let connection = watch.state(for: context)
            let sample = watch.latest(for: context)
            let live = sample.flatMap { $0.isFresh(at: clock.date) ? $0 : nil }
            HStack(spacing: 8) {
                Image(systemName: "heart.fill")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(SpotterPalette.accent)
                    .frame(width: 28, height: 28).background(SpotterPalette.wash, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Apple Watch 在表练").font(.caption.weight(.semibold))
                    Text(live == nil ? (sample == nil ? connection.detail : "等待新心率") : "实时")
                        .font(.caption2).foregroundStyle(SpotterPalette.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                if let live {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(live.bpm.formatted()).font(.title3.bold()).monospacedDigit()
                        Text("BPM").font(.caption2.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("实时心率 \(live.bpm) 次每分钟")
                    .accessibilityIdentifier("workout-watch-current-bpm")
                    .privacySensitive()
                }
                control(connection)
            }
            .padding(7)
            .background(SpotterPalette.card.opacity(0.8), in: RoundedRectangle(cornerRadius: 14))
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("workout-watch-heart-rate")
    }

    @ViewBuilder private func control(_ connection: NativeWatchHeartRate.Connection) -> some View {
        switch connection {
        case .idle, .unavailable, .permissionRequired, .disconnected:
            Button {
                watch.connect(context, activity: activityType)
            } label: {
                Text(connection == .idle ? "连接" : "重试")
                    .font(.caption.weight(.semibold)).padding(.horizontal, 12)
                    .frame(minWidth: 44, minHeight: 40).background(SpotterPalette.wash, in: Capsule())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel(connection == .idle ? "连接 Apple Watch" : "重试连接 Apple Watch")
        case .connecting, .measuring, .paused:
            Button { watch.end() } label: {
                Image(systemName: "xmark").font(.caption.weight(.semibold))
                    .frame(width: 44, height: 40).background(SpotterPalette.wash, in: Capsule())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel(connection == .connecting ? "取消连接 Apple Watch" : "断开 Apple Watch")
        }
    }

    private var activityType: HKWorkoutActivityType {
        switch cardio {
        case .incline: return .walking
        case .hiit: return .highIntensityIntervalTraining
        case .cardio: return .mixedCardio
        case nil: return .traditionalStrengthTraining
        }
    }
}
