import HealthKit
import SwiftUI
import WatchConnectivity
import WatchKit

@main
struct SpotterWatchApp: App {
    @WKApplicationDelegateAdaptor private var delegate: SpotterWatchDelegate

    var body: some Scene {
        WindowGroup { SpotterWatchRoot() }
    }
}

private struct SpotterWatchRoot: View {
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        SpotterWatchTrainingView(workout: .shared)
            .onChange(of: scenePhase, initial: true) { _, next in
                if next == .active { SpotterWatchWorkout.shared.activate() }
            }
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
    @Published private var local = LocalTraining()
    @Published private var companionReachable = false

    private struct LocalTraining: Codable, Equatable {
        var catalog: NativeWatchTrainingCatalog?
        var drafts: [NativeWatchOfflineWorkout] = []
        var checkins: [NativeWatchOfflineCheckin] = []
    }

    private let store = HKHealthStore()
    private let heartRate = HKQuantityType(.heartRate)
    private let activeEnergy = HKQuantityType(.activeEnergyBurned)
    private let basalEnergy = HKQuantityType(.basalEnergyBurned)
    private var workoutReadTypes: Set<HKObjectType> { [heartRate, activeEnergy, basalEnergy] }
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
    private var isReportingSummary = false
    private var pendingFinish: (token: UUID, end: Date)?
    private var summaryTimeout: Task<Void, Never>?
    private var queuedSummaries: [Data] = []
    private var localHealthWorkoutID: UUID?
    private var pendingHealthCheckin: UUID?
    private var finalizingLocalHealth = false
    private var attemptedTransfers: [UUID: Date] = [:]
    private var watchWidgetSnapshot: SpotterWatchWidgetSnapshot?
    private let localDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
        .appendingPathComponent("Spotter/WatchTraining", isDirectory: true)

    override init() {
        super.init()
        if let url = localDirectory?.appendingPathComponent("training.json"), let bytes = try? Data(contentsOf: url),
           let saved = try? JSONDecoder().decode(LocalTraining.self, from: bytes) {
            local = saved
            showLocalDraft()
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    var canStop: Bool {
        !isReportingSummary && (phase == .connecting || phase == .running || phase == .paused)
    }

    var canControl: Bool { (localDraft != nil || phoneConnected) && workoutState != nil && !actionPending }
    var canFinish: Bool { canControl && workoutState?.snapshot.canFinish == true }
    var hasPendingSync: Bool { local.checkins.contains { $0.binding == local.catalog?.binding } }
    var isTrainingOnWatch: Bool { localDraft != nil }

    var hasSyncedTrainingCatalog: Bool { local.catalog?.binding != nil }

    var upcomingOption: NativeWatchLaunchOption? {
        let today = NativeWorkoutSession.day()
        return availableOptions.first { !$0.isResume && $0.day > today }
    }

    var launchOptions: [NativeWatchLaunchOption] {
        let today = NativeWorkoutSession.day()
        return availableOptions.filter {
            $0.day == today && (companionReachable || (!$0.isResume && $0.plan != nil))
        }
    }

    private var availableOptions: [NativeWatchLaunchOption] {
        guard let catalog = local.catalog, let binding = catalog.binding else { return [] }
        let completed = Set(local.checkins.filter { $0.binding == binding }.map { $0.finished["planId"].string })
        return catalog.options.filter { $0.isResume || !completed.contains($0.id) }
    }

    private var localDraft: NativeWatchOfflineWorkout? {
        local.drafts.first { $0.binding == local.catalog?.binding }
    }

    func activate() {
        if WCSession.isSupported() { updateCompanion(.default) }
        refreshWatchWidgets()
    }

    func launch(_ option: NativeWatchLaunchOption) {
        guard !actionPending, localDraft == nil, session == nil, phase != .checking, phase != .permissionRequired,
              let binding = local.catalog?.binding, launchOptions.contains(option) else { return }
        actionNotice = nil
        let connectivity = WCSession.default
        if connectivity.activationState == .activated, connectivity.isReachable {
            launchNearby(option, binding: binding, using: connectivity)
            return
        }
        guard let draft = NativeWatchOfflineWorkout(option: option, binding: binding) else {
            actionNotice = "这堂训练需要在 iPhone 上开始。"
            return
        }
        var updated = local
        updated.drafts.append(draft)
        guard saveLocal(updated) else { actionNotice = "手表暂时无法保存训练，请重试。"; return }
        showLocalDraft()
        Task { await beginLocalHealth(for: draft, requestPermission: true) }
    }

    private func launchNearby(_ option: NativeWatchLaunchOption, binding: String, using connectivity: WCSession) {
        let request = NativeWatchNearbyLaunch(binding: binding, optionID: option.id)
        guard let data = try? JSONEncoder().encode(request) else { return }
        let marker = UUID()
        pendingActionID = marker
        actionPending = true
        phase = .connecting
        actionTimeout = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(55)) } catch { return }
            self?.nearbyLaunchFailed(marker, notice: "连接超时，请在 iPhone 查看训练。")
        }
        connectivity.sendMessage([NativeWatchNearbyLaunch.key: data]) { [weak self] reply in
            guard reply["started"] as? Bool != true else { return }
            Task { @MainActor in self?.nearbyLaunchFailed(marker, notice: "请打开 iPhone 上的训练搭子后重试。") }
        } errorHandler: { [weak self] _ in
            Task { @MainActor in self?.nearbyLaunchFailed(marker, notice: "暂时无法连接 iPhone，请稍后重试。") }
        }
    }

    private func nearbyLaunchFailed(_ marker: UUID, notice: String) {
        guard pendingActionID == marker else { return }
        phase = .failed
        resolveAction(marker, notice: notice)
    }

    private func saveLocal(_ updated: LocalTraining) -> Bool {
        guard let localDirectory else { return false }
        do {
            try FileManager.default.createDirectory(at: localDirectory, withIntermediateDirectories: true)
            var file = localDirectory.appendingPathComponent("training.json")
            try JSONEncoder().encode(updated).write(to: file, options: .atomic)
            var properties = URLResourceValues()
            properties.isExcludedFromBackup = true
            try? file.setResourceValues(properties)
            local = updated
            return true
        } catch { return false }
    }

    private func showLocalDraft() {
        guard let draft = localDraft else { refreshWatchWidgets(); return }
        workoutState = draft.state
        phase = draft.workout.isRunning ? .running : .paused
        refreshWatchWidgets()
    }

    private func refreshWatchWidgets() {
        guard local.catalog?.binding != nil else {
            watchWidgetSnapshot = nil
            SpotterWatchWidgetStore.write(nil)
            return
        }
        let today = NativeWorkoutSession.day()
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let upcoming = availableOptions.first { !$0.isResume && $0.day >= today }
        let next: SpotterWatchWidgetSnapshot.Next? = upcoming.flatMap { plan in
            formatter.date(from: plan.day).map { .init(title: plan.title, scheduledDate: $0) }
        }
        let current: SpotterWatchWidgetSnapshot.Active? = workoutState.map {
            let sets = $0.snapshot.exercises.flatMap(\.sets)
            return .init(completedSets: sets.filter(\.done).count, totalSets: sets.count,
                         isRunning: $0.snapshot.runningSinceMilliseconds != nil)
        }
        guard watchWidgetSnapshot?.active != current || watchWidgetSnapshot?.next != next || watchWidgetSnapshot == nil || (current != nil && (watchWidgetSnapshot?.activeExpiration ?? .distantPast) <= .now) else { return }
        let snapshot = SpotterWatchWidgetSnapshot(active: current, next: next)
        watchWidgetSnapshot = snapshot
        SpotterWatchWidgetStore.write(snapshot)
    }

    private func receiveCatalog(_ packet: NativeWatchTrainingCatalog) {
        guard packet != local.catalog else { return }
        let previousBinding = local.catalog?.binding
        var updated = local
        if previousBinding != packet.binding, var draft = localDraft,
           let index = updated.drafts.firstIndex(where: { $0.id == draft.id }), draft.workout.isRunning {
            let switchAccount = NativeWatchWorkoutCommand(token: draft.id, revision: draft.revision, action: .setRunning, running: false)
            if draft.apply(switchAccount) { updated.drafts[index] = draft }
        }
        updated.catalog = packet
        guard saveLocal(updated) else { return }
        if previousBinding != packet.binding {
            if let session, !isReportingSummary { finish(session, as: .idle) }
            else { clearMirroredState() }
            if !isReportingSummary { phase = .idle }
        }
        showLocalDraft()
        flushWatchCheckins(using: .default)
    }

    private func updateCompanion(_ connectivity: WCSession) {
        companionReachable = connectivity.activationState == .activated && connectivity.isReachable
        if let data = connectivity.receivedApplicationContext[NativeWatchTrainingCatalog.key] as? Data,
           let catalog = NativeWatchTrainingCatalog.decode(data) { receiveCatalog(catalog) }
        flushSummaries(using: connectivity)
        flushWatchCheckins(using: connectivity)
    }

    private func flushWatchCheckins(using connectivity: WCSession) {
        guard connectivity.activationState == .activated, connectivity.isCompanionAppInstalled,
              let localDirectory, let binding = local.catalog?.binding else { return }
        let inFlight = Set(connectivity.outstandingFileTransfers.compactMap {
            $0.file.metadata?[NativeWatchOfflineCheckin.key] as? String
        })
        for archive in local.checkins where archive.binding == binding && archive.id != pendingHealthCheckin {
            let id = archive.id.uuidString
            guard !inFlight.contains(id), Date.now.timeIntervalSince(attemptedTransfers[archive.id] ?? .distantPast) >= 30,
                  let bytes = archive.encoded() else { continue }
            let file = localDirectory.appendingPathComponent(id + ".json")
            do {
                try bytes.write(to: file, options: .atomic)
                attemptedTransfers[archive.id] = .now
                connectivity.transferFile(file, metadata: [NativeWatchOfflineCheckin.key: id])
            } catch { }
        }
    }

    private func acceptWatchCheckinReceipt(_ id: UUID) {
        guard local.checkins.contains(where: { $0.id == id }) else { return }
        var updated = local
        updated.checkins.removeAll { $0.id == id }
        guard saveLocal(updated) else { return }
        attemptedTransfers.removeValue(forKey: id)
        if let file = localDirectory?.appendingPathComponent(id.uuidString + ".json") {
            try? FileManager.default.removeItem(at: file)
        }
        if localDraft == nil, workoutState == nil, !hasPendingSync { actionNotice = "训练已同步到 iPhone。" }
    }

    private func controlLocal(_ command: NativeWatchWorkoutCommand, draft: NativeWatchOfflineWorkout) {
        guard draft.state.allows(command), command.encoded() != nil else { return }
        if command.action == .finishWorkout {
            finishLocalTraining(draft)
            return
        }
        var changed = draft
        guard changed.apply(command), let index = local.drafts.firstIndex(where: { $0.id == draft.id }) else { return }
        var updated = local
        updated.drafts[index] = changed
        guard saveLocal(updated) else { actionNotice = "手表暂时无法保存，请重试。"; return }
        actionNotice = nil
        showLocalDraft()
        if command.action == .setRunning {
            if changed.workout.isRunning {
                if session?.state == .paused { session?.resume() }
                else if session == nil {
                    Task { await beginLocalHealth(for: changed, requestPermission: false) }
                }
            } else if session?.state == .running {
                session?.pause()
                reading = nil
            }
        }
    }

    func discardLocalWorkout() {
        guard let draft = localDraft, draft.workout.completedSets == 0 || !draft.workout.isRunning else { return }
        var updated = local
        updated.drafts.removeAll { $0.id == draft.id }
        guard saveLocal(updated) else { actionNotice = "暂时无法放弃训练，请重试。"; return }
        if let session, localHealthWorkoutID == draft.id { finish(session, as: .idle) }
        else {
            clearMirroredState()
            phase = .idle
            refreshWatchWidgets()
        }
        actionNotice = "本次试练已放弃，训练计划已保留。"
    }

    private func finishLocalTraining(_ draft: NativeWatchOfflineWorkout) {
        guard let archive = try? draft.finalizing(), archive.encoded() != nil else {
            actionNotice = "请至少完成一组后再结束训练。"
            return
        }
        var updated = local
        updated.drafts.removeAll { $0.id == draft.id }
        updated.checkins.append(archive)
        guard saveLocal(updated) else { actionNotice = "手表暂时无法保存，请重试。"; return }
        clearMirroredState()
        phase = .ended
        actionNotice = "已在手表保存，连接 iPhone 后自动同步。"
        refreshWatchWidgets()
        if let session, localHealthWorkoutID == draft.id, collecting, let builder, builder.startDate != nil {
            pendingHealthCheckin = draft.id
            let end = Date(timeIntervalSince1970: archive.finished["ended"].number / 1_000)
            isReportingSummary = true
            collecting = false
            reading = nil
            summaryTimeout = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(18)) } catch { return }
                self?.finishLocalHealth(session)
            }
            if session.state == .stopped || session.state == .ended { completeLocalHealth(session, end: end) }
            else { session.stopActivity(with: end) }
        } else {
            if let session, localHealthWorkoutID == draft.id { finish(session, as: .ended) }
            flushWatchCheckins(using: .default)
        }
    }

    private func beginLocalHealth(for draft: NativeWatchOfflineWorkout, requestPermission: Bool) async {
        guard session == nil, localDraft?.id == draft.id, HKHealthStore.isHealthDataAvailable() else { return }
        do {
            if requestPermission, try await store.statusForAuthorizationRequest(toShare: [workoutType], read: workoutReadTypes) != .unnecessary {
                try await store.requestAuthorization(toShare: [workoutType], read: workoutReadTypes)
            }
            guard session == nil, localDraft?.id == draft.id, localDraft?.workout.isRunning == true,
                  store.authorizationStatus(for: workoutType) == .sharingAuthorized else { return }
            let configuration = HKWorkoutConfiguration()
            let activity = draft.workout.watchCardioActivity
            switch activity {
            case .running, .treadmillRunning: configuration.activityType = .running
            case .walking, .incline: configuration.activityType = .walking
            case .cycling, .stationaryCycling: configuration.activityType = .cycling
            case .rowing: configuration.activityType = .rowing
            case .elliptical: configuration.activityType = .elliptical
            case .stairClimbing: configuration.activityType = .stairClimbing
            case .jumpRope: configuration.activityType = .jumpRope
            case .swimming: configuration.activityType = .swimming
            case .hiit: configuration.activityType = .highIntensityIntervalTraining
            case .cardio: configuration.activityType = .mixedCardio
            case nil: configuration.activityType = .traditionalStrengthTraining
            }
            configuration.locationType = .unknown
            let current = try HKWorkoutSession(healthStore: store, configuration: configuration)
            let workoutBuilder = current.associatedWorkoutBuilder()
            workoutBuilder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: configuration)
            current.delegate = self
            workoutBuilder.delegate = self
            session = current
            builder = workoutBuilder
            localHealthWorkoutID = draft.id
            let start = Date.now
            measuredAfter = start
            latestSampleAt = .distantPast
            current.startActivity(with: start)
            try await workoutBuilder.beginCollection(at: start)
            guard session === current else { return }
            collecting = true
            try await workoutBuilder.addMetadata([HKMetadataKeySyncIdentifier: "spotter-watch-" + draft.id.uuidString,
                                                  HKMetadataKeySyncVersion: 1])
            collectHeartRate(from: workoutBuilder)
        } catch {
            if let session, localHealthWorkoutID == draft.id { finish(session, as: .failed) }
        }
    }

    private func completeLocalHealth(_ current: HKWorkoutSession, end: Date) {
        guard let id = pendingHealthCheckin, !finalizingLocalHealth,
              session === current, let builder, let start = builder.startDate else { return }
        finalizingLocalHealth = true
        let archiveEnd = local.checkins.first(where: { $0.id == id }).map {
            Date(timeIntervalSince1970: $0.finished["ended"].number / 1_000)
        } ?? end
        let end = min(archiveEnd, end)
        Task {
            do {
                try await builder.endCollection(at: end)
                guard session === current else { return }
                let summary = healthSummary(from: builder, start: start, end: end)
                if let index = local.checkins.firstIndex(where: { $0.id == id }), summary.isValid {
                    var updated = local
                    updated.checkins[index].summary = summary
                    _ = saveLocal(updated)
                }
                _ = try await builder.finishWorkout()
                finishLocalHealth(current, savedToHealth: true)
            } catch { finishLocalHealth(current) }
        }
    }

    private func finishLocalHealth(_ current: HKWorkoutSession, savedToHealth: Bool = false) {
        guard session === current else { return }
        pendingHealthCheckin = nil
        finalizingLocalHealth = false
        finish(current, as: .ended, discardBuilder: !savedToHealth)
        if localDraft == nil, workoutState == nil { actionNotice = "已在手表保存，连接 iPhone 后自动同步。" }
        flushWatchCheckins(using: .default)
    }

    private func healthSummary(from builder: HKLiveWorkoutBuilder, start: Date, end: Date) -> NativeWorkoutHealthSummary {
        let kcal = HKUnit.kilocalorie()
        let bpm = HKUnit.count().unitDivided(by: .minute())
        return NativeWorkoutHealthSummary(start: start, end: end,
            active: builder.statistics(for: activeEnergy)?.sumQuantity()?.doubleValue(for: kcal),
            basal: builder.statistics(for: basalEnergy)?.sumQuantity()?.doubleValue(for: kcal),
            average: builder.statistics(for: heartRate)?.averageQuantity()?.doubleValue(for: bpm))
    }

    func receive(_ configuration: HKWorkoutConfiguration) async {
        guard session == nil, localDraft == nil, phase != .checking else { return }
        pendingConfiguration = configuration
        clearMirroredState()
        guard HKHealthStore.isHealthDataAvailable() else { phase = .unavailable; return }
        phase = .checking

        do {
            let request = try await store.statusForAuthorizationRequest(toShare: [workoutType], read: workoutReadTypes)
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
            try await store.requestAuthorization(toShare: [workoutType], read: workoutReadTypes)
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
            let summaryTypes = [heartRate, activeEnergy, basalEnergy]
            for type in source.typesToCollect where !summaryTypes.contains(type) {
                source.disableCollection(for: type)
            }
            for type in summaryTypes where !source.typesToCollect.contains(type) {
                source.enableCollection(for: type, predicate: nil)
            }
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
        guard session == nil, !isReportingSummary else { return }
        if let recovered = try? await store.recoverActiveWorkoutSession(), session == nil {
            let recoveredBuilder = recovered.associatedWorkoutBuilder()
            if let draft = localDraft, recoveredBuilder.metadata[HKMetadataKeySyncIdentifier] as? String == "spotter-watch-" + draft.id.uuidString,
               recovered.state == .running || recovered.state == .paused {
                session = recovered
                builder = recoveredBuilder
                localHealthWorkoutID = draft.id
                collecting = true
                recovered.delegate = self
                recoveredBuilder.delegate = self
                if draft.workout.isRunning, recovered.state == .paused { recovered.resume() }
                if !draft.workout.isRunning, recovered.state == .running { recovered.pause() }
            } else {
                recoveredBuilder.discardWorkout()
                recovered.end()
            }
        }
        showLocalDraft()
    }

    private func finishAndReport(_ request: NativeWatchWorkoutFinishRequest, via current: HKWorkoutSession) {
        guard session === current, !isReportingSummary, collecting, let builder,
              workoutState?.token == request.token, let start = builder.startDate else { return }
        let end = min(request.end, .now)
        guard start < end else { finish(current, as: .ended); return }
        isReportingSummary = true
        pendingFinish = (request.token, end)
        collecting = false
        reading = nil
        phase = .ended
        disconnectTask?.cancel()
        summaryTimeout = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(18)) } catch { return }
            self?.finish(current, as: .ended)
        }
        if current.state == .stopped || current.state == .ended {
            reportStoppedWorkout(current, at: end)
        } else {
            current.stopActivity(with: end)
        }
    }

    private func reportStoppedWorkout(_ current: HKWorkoutSession, at date: Date) {
        guard let pending = pendingFinish, let builder, let start = builder.startDate else { return }
        pendingFinish = nil
        let end = min(pending.end, date)
        guard end > start else { finish(current, as: .ended); return }
        Task {
            do {
                try await builder.endCollection(at: end)
                guard session === current else { return }
                let summary = healthSummary(from: builder, start: start, end: end)
                if let data = NativeWatchWorkoutSummaryPacket(token: pending.token, data: summary).encoded() {
                    // Background delivery carries the same one-time token and survives the mirrored session ending.
                    if WCSession.isSupported() {
                        queuedSummaries.append(data)
                        flushSummaries(using: .default)
                    }
                    _ = try? await current.sendToRemoteWorkoutSession(data: data)
                }
            } catch { }
            finish(current, as: .ended)
        }
    }

    private func flushSummaries(using connectivity: WCSession) {
        guard connectivity.activationState == .activated, connectivity.isCompanionAppInstalled else { return }
        for data in queuedSummaries {
            connectivity.transferUserInfo([NativeWatchWorkoutSummaryPacket.transferKey: data])
        }
        queuedSummaries.removeAll()
    }

    private func finish(_ current: HKWorkoutSession, as result: Phase, discardBuilder: Bool = true) {
        guard session === current else { return }
        disconnectTask?.cancel()
        disconnectTask = nil
        collecting = false
        isReportingSummary = false
        pendingFinish = nil
        summaryTimeout?.cancel()
        summaryTimeout = nil
        reading = nil
        clearMirroredState()
        builder?.delegate = nil
        if discardBuilder { builder?.discardWorkout() }
        builder = nil
        current.delegate = nil
        session = nil
        localHealthWorkoutID = nil
        if current.state != .ended { current.end() }
        phase = result
        showLocalDraft()
        refreshWatchWidgets()
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
                 adjustment: Int? = nil, rightWeight: Double? = nil, rightReps: Int? = nil, edit: WatchSetTarget? = nil) {
        guard let workoutState, canControl else {
            actionNotice = "等 iPhone 重新连接后再记录。"
            return
        }
        if let edit, edit.token != workoutState.token || edit.revision != workoutState.revision {
            actionNotice = "训练进度已变化，请重新打开当前组。"
            return
        }
        let command = NativeWatchWorkoutCommand(token: workoutState.token, revision: workoutState.revision,
                                                action: action, position: position, weight: weight,
                                                reps: reps, seconds: seconds, running: running, adjustment: adjustment,
                                                rightWeight: rightWeight, rightReps: rightReps)
        if let draft = localDraft { controlLocal(command, draft: draft); return }
        guard let session, workoutState.allows(command), let data = command.encoded() else {
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
        refreshWatchWidgets()
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
        guard session === current, !isReportingSummary, phoneConnected != connected else { return }
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
        guard localHealthWorkoutID == nil else { return }
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
        guard localHealthWorkoutID == nil else { return }
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
                if pendingHealthCheckin != nil { completeLocalHealth(workoutSession, end: date) }
                else if isReportingSummary { reportStoppedWorkout(workoutSession, at: date) }
                else { finish(workoutSession, as: .ended) }
            default:
                break
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            if pendingHealthCheckin != nil { finishLocalHealth(workoutSession) }
            else { finish(workoutSession, as: .failed) }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession values: [Data]) {
        Task { @MainActor in
            guard session === workoutSession else { return }
            for data in values {
                if let request = NativeWatchWorkoutFinishRequest.decode(data) {
                    finishAndReport(request, via: workoutSession)
                    continue
                }
                if data.count < 256, let command = try? JSONDecoder().decode(Message.self, from: data),
                   command.version == 1, command.kind == "stop" {
                    if !isReportingSummary { finish(workoutSession, as: .ended) }
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

extension SpotterWatchWorkout: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
                             error: Error?) {
        Task { @MainActor in updateCompanion(session) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let data = applicationContext[NativeWatchTrainingCatalog.key] as? Data,
              let catalog = NativeWatchTrainingCatalog.decode(data) else { return }
        Task { @MainActor in receiveCatalog(catalog) }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in updateCompanion(session) }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        guard let raw = userInfo[NativeWatchOfflineCheckin.acceptedKey] as? String, let id = UUID(uuidString: raw) else { return }
        Task { @MainActor in acceptWatchCheckinReceipt(id) }
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

    var id: NativeWatchWorkoutSnapshot.Position { position }
    var position: NativeWatchWorkoutSnapshot.Position { .init(move: exercise.index, row: set.index) }
    var title: String { "第 \(set.index + 1) 组" }

    var values: String {
        if exercise.isTimed { return watchDuration(set.seconds) }
        let left = "\(watchWeight(set.weight)) \(exercise.unit) × \(set.reps)"
        guard let right = set.right else { return left }
        return "左 \(left)\n右 \(watchWeight(right.weight)) \(exercise.unit) × \(right.reps)"
    }
}

private struct WatchSetValues: Equatable {
    var weight: Double
    var reps: Double
    var seconds: Double
    var rightWeight: Double?
    var rightReps: Double?

    init(_ set: NativeWatchWorkoutSnapshot.Set) {
        weight = set.weight
        reps = Double(set.reps)
        seconds = Double(set.seconds)
        rightWeight = set.right?.weight
        rightReps = set.right.map { Double($0.reps) }
    }
}

private struct SpotterWatchTrainingView: View {
    private enum Page: Hashable { case focus, list }

    private enum Confirmation {
        case finish, disconnect, discard

        var title: String {
            switch self {
            case .finish: "结束这次训练？"
            case .disconnect: "断开这块手表？"
            case .discard: "放弃这次训练？"
            }
        }
    }

    @ObservedObject var workout: SpotterWatchWorkout
    @AppStorage("watch.restHaptics") private var restHaptics = true
    @AppStorage("watch.setTimerHaptics") private var setTimerHaptics = true
    @AppStorage("watch.crownInput") private var crownInput = true
    @State private var page = Page.focus
    @State private var showsSettings = false
    @State private var confirmation: Confirmation?
    @State private var editing: WatchSetTarget?
    @State private var pendingEdit: SetEdit?

    private struct SetEdit {
        let token: UUID?
        let position: NativeWatchWorkoutSnapshot.Position
        let original: WatchSetValues
        let values: WatchSetValues
    }

    private struct TimerCue: Equatable {
        let token: UUID
        let deadline: Int
        let runningSince: Int64
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            if let snapshot = workout.workoutState?.snapshot {
                TabView(selection: $page) {
                    focus(snapshot).tag(Page.focus)
                    trainingList(snapshot).tag(Page.list)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        connectionCard
                        connectionNotice
                        ForEach(workout.launchOptions) { option in launchButton(option) }
                        if workout.launchOptions.isEmpty, let upcoming = workout.upcomingOption {
                            upcomingCard(upcoming)
                        }
                    }
                    .padding(.horizontal, 7)
                    .padding(.bottom, 8)
                }
            }
        }
        .background(WatchTrainingColors.background.ignoresSafeArea())
        .foregroundStyle(WatchTrainingColors.text)
        .sheet(isPresented: $showsSettings) { settings }
        .sheet(item: $editing) { target in
            WatchSetEntry(target: target, values: values(for: target), crownInput: crownInput) { values in
                pendingEdit = SetEdit(token: target.token, position: target.position, original: .init(target.set), values: values)
            }
        }
        .confirmationDialog(confirmation?.title ?? "", isPresented: showsConfirmation,
                            titleVisibility: .visible, presenting: confirmation) { prompt in
            switch prompt {
            case .finish:
                Button("结束并保存") { workout.control(.finishWorkout) }
                Button("继续训练", role: .cancel) {}
            case .disconnect:
                Button("断开手表", role: .destructive) { workout.stop() }
                Button("取消", role: .cancel) {}
            case .discard:
                Button("放弃训练", role: .destructive) { workout.discardLocalWorkout() }
                Button("继续训练", role: .cancel) {}
            }
        } message: { prompt in
            if case .discard = prompt {
                Text("这次训练的记录会清除，今天的计划会保留。")
            }
        }
        .onChange(of: workout.workoutState?.token) { _, _ in
            page = .focus
            pendingEdit = nil
            editing = nil
        }
        .onOpenURL(perform: openTrainingURL)
        .task(id: restCue) { await remindAtEnd(restCue, haptic: .notification) { restCue == $0 } }
        .task(id: setCue) { await remindAtEnd(setCue, haptic: .success) { setCue == $0 } }
    }

    private var showsConfirmation: Binding<Bool> {
        Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } })
    }

    private func openTrainingURL(_ url: URL) {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.user == nil, parts.password == nil, parts.port == nil,
              parts.query == nil, parts.fragment == nil else { return }
        switch (parts.scheme, parts.host, parts.path) {
        case ("spotter-watch", "training", ""), ("spotter", "widget", "/training"):
            page = .focus
        default:
            break
        }
    }

    private var toolbar: some View {
        HStack(spacing: 0) {
            if let snapshot = workout.workoutState?.snapshot {
                TimelineView(.periodic(from: .now, by: 1)) { timeline in
                    HStack(spacing: 5) {
                        let elapsed = watchDuration(snapshot.elapsed(at: timeline.date) / 1_000)
                        Text(elapsed)
                            .font(.system(.footnote, design: .rounded, weight: .bold).monospacedDigit())
                            .lineLimit(1).minimumScaleFactor(0.65)
                            .accessibilityLabel("训练计时 \(elapsed)")
                        heartRate(at: timeline.date)
                    }
                }
                Spacer(minLength: 0)
                let running = snapshot.runningSinceMilliseconds != nil
                toolbarButton(running ? "pause.fill" : "play.fill", label: running ? "暂停训练" : "继续训练") {
                    workout.control(.setRunning, running: !running)
                }
                .disabled(!workout.canControl)
                toolbarButton(page == .focus ? "list.bullet" : "scope", label: page == .focus ? "查看训练列表" : "回到当前组") {
                    page = page == .focus ? .list : .focus
                }
            } else {
                Label("训练搭子", systemImage: "figure.strengthtraining.traditional")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(WatchTrainingColors.lime)
                Spacer(minLength: 0)
                toolbarButton("gearshape", label: "训练设置") { showsSettings = true }
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 2)
    }

    private func toolbarButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.footnote.weight(.semibold))
                .frame(width: 32, height: 29)
                .background(WatchTrainingColors.raised, in: Capsule())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var connectionCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: "applewatch")
                .font(.title3.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.lime)
                .accessibilityHidden(true)
            Text(workout.phase == .idle || workout.phase == .ended ? "腕上训练" : workout.phase.title)
                .font(.headline.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            if let connectionHelp {
                Text(connectionHelp)
                    .font(.footnote)
                    .foregroundStyle(WatchTrainingColors.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if workout.phase == .permissionRequired {
                Button("授权并开始") { Task { await workout.authorize() } }
                    .buttonStyle(WatchTrainingButton(primary: true))
            } else if workout.canStop {
                Button("断开手表") { confirmation = .disconnect }
                    .buttonStyle(WatchTrainingButton())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private var connectionHelp: String? {
        switch workout.phase {
        case .permissionRequired: return "请允许读取心率并授权训练会话。"
        case .checking: return "正在检查 Apple 健康权限。"
        case .connecting, .running, .paused: return "正在接收训练。"
        case .failed, .disconnected: return "可重试已同步的计划，或打开 iPhone 恢复连接。"
        case .unavailable: return "此手表暂时无法开始训练。"
        case .idle, .ended:
            if !workout.launchOptions.isEmpty { return nil }
            return workout.hasSyncedTrainingCatalog ? "今天没有可以在表上开始的训练。" : "在 iPhone 打开训练搭子，同步今天的计划。"
        }
    }

    private func launchButton(_ option: NativeWatchLaunchOption) -> some View {
        Button { workout.launch(option) } label: {
            HStack(spacing: 7) {
                Image(systemName: option.isResume ? "arrow.uturn.forward" : "play.fill")
                    .font(.caption2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(option.title).font(.footnote.weight(.bold)).lineLimit(2)
                    Text(option.isResume ? "继续训练" : "今日计划")
                        .font(.caption2)
                        .opacity(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 6)
        }
        .buttonStyle(WatchTrainingButton(primary: option.isResume))
        .disabled(workout.actionPending || workout.phase == .checking || workout.phase == .permissionRequired ||
                  workout.phase == .connecting || workout.phase == .running || workout.phase == .paused)
    }

    private func upcomingCard(_ option: NativeWatchLaunchOption) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "calendar")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.lime)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("下一练 · \(scheduledDay(option.day))")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(WatchTrainingColors.secondary)
                Text(option.title)
                    .font(.footnote.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    private func scheduledDay(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return key }
        return "\(parts[1])月\(parts[2])日"
    }

    private func heartRate(at date: Date) -> some View {
        let value = workout.phase == .running ? workout.reading.flatMap {
            (-5...30).contains(date.timeIntervalSince($0.measuredAt)) ? Int($0.bpm.rounded()) : nil
        } : nil
        return HStack(spacing: 2) {
            Image(systemName: "heart.fill").font(.system(size: 8, weight: .semibold))
            Text(value.map(String.init) ?? "–").font(.caption2.weight(.semibold).monospacedDigit())
        }
        .fixedSize(horizontal: true, vertical: false)
        .foregroundStyle(WatchTrainingColors.lime)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(value.map { "心率 \($0) 次每分钟" } ?? "等待心率")
        .privacySensitive()
    }

    private var syncNotice: String? {
        if workout.hasPendingSync { return "有训练记录等待同步" }
        if workout.actionPending { return "正在同步" }
        if workout.isTrainingOnWatch { return "在表上记录，结束后同步" }
        if workout.workoutState != nil && !workout.phoneConnected { return "正在重新连接 iPhone" }
        return nil
    }

    @ViewBuilder private var connectionNotice: some View {
        if let notice = workout.actionNotice ?? syncNotice {
            Label(notice, systemImage: workout.actionNotice == nil ? "arrow.triangle.2.circlepath" : "exclamationmark.circle")
                .font(.caption2)
                .foregroundStyle(WatchTrainingColors.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func focus(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let target = currentSet(in: snapshot)
            let rest = snapshot.restRemainingSeconds(at: timeline.date) ?? 0
            let timer = snapshot.activeSetTimer.flatMap { $0.position == target?.position ? $0 : nil }
            let setTime = timer == nil ? nil : snapshot.setRemainingSeconds(at: timeline.date)
            VStack(spacing: 6) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 7) {
                        if rest > 0 {
                            restPanel(snapshot, next: target, seconds: rest)
                        } else if let target {
                            currentSetPanel(target, countdown: setTime, duration: timer?.durationSeconds)
                            if timer == nil, snapshot.activeSetTimer != nil {
                                Text("另一组正在计时，可在 iPhone 查看。")
                                    .font(.caption2)
                                    .foregroundStyle(WatchTrainingColors.secondary)
                            }
                        } else {
                            finishedPanel(snapshot)
                        }
                        connectionNotice
                    }
                    .padding(.horizontal, 7)
                }
                .id(target?.position)
                focusAction(snapshot, target: target, resting: rest > 0, setTime: setTime)
                    .padding(.horizontal, 7)
                    .padding(.bottom, 3)
            }
        }
    }

    private func currentSetPanel(_ target: WatchSetTarget, countdown: Int?, duration: Int?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                if let block = target.exercise.block {
                    Text(block)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(WatchTrainingColors.lime)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(WatchTrainingColors.raised, in: Capsule())
                }
                Text("第 \(target.set.index + 1) / \(target.exercise.sets.count) 组")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(WatchTrainingColors.secondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if let tempo = target.exercise.tempo {
                    Text(tempo).font(.caption2.monospacedDigit())
                        .foregroundStyle(WatchTrainingColors.secondary)
                        .accessibilityLabel("动作节奏 \(tempo)")
                }
            }
            Text(target.exercise.name)
                .font(.headline.weight(.bold))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if let countdown, let duration {
                timerDial(countdown, total: duration)
            } else {
                Button { editing = target } label: { valueTiles(target, values: values(for: target)) }
                    .buttonStyle(.plain)
                    .disabled(!workout.canControl)
                    .accessibilityHint("点按编辑")
            }
            if let previous = target.set.previous, !target.exercise.isTimed {
                let label = target.set.right == nil ? "上次" : "上次左侧"
                Text("\(label) \(watchWeight(previous.weight)) \(target.exercise.unit) × \(previous.reps)")
                    .font(.caption2)
                    .foregroundStyle(WatchTrainingColors.secondary)
            }
        }
    }

    @ViewBuilder private func valueTiles(_ target: WatchSetTarget, values: WatchSetValues) -> some View {
        if target.exercise.isTimed {
            metricTile("目标时长", value: watchDuration(Int(values.seconds)), icon: "timer")
        } else if let rightWeight = values.rightWeight, let rightReps = values.rightReps {
            HStack(spacing: 4) {
                metricTile("左侧 · \(target.exercise.unit)", value: "\(watchWeight(values.weight)) × \(Int(values.reps))")
                metricTile("右侧 · \(target.exercise.unit)", value: "\(watchWeight(rightWeight)) × \(Int(rightReps))", icon: "pencil")
            }
        } else {
            HStack(spacing: 4) {
                metricTile("重量 · \(target.exercise.unit)", value: watchWeight(values.weight))
                metricTile("次数", value: String(Int(values.reps)), icon: "pencil")
            }
        }
    }

    private func metricTile(_ label: String, value: String, icon: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 2) {
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(WatchTrainingColors.secondary)
                Spacer(minLength: 0)
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(WatchTrainingColors.secondary)
                        .accessibilityHidden(true)
                }
            }
            Text(value)
                .font(.system(.title3, design: .rounded, weight: .bold).monospacedDigit())
                .foregroundStyle(WatchTrainingColors.lime)
                .lineLimit(1)
                .minimumScaleFactor(0.60)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, 6)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }

    private func restPanel(_ snapshot: NativeWatchWorkoutSnapshot, next: WatchSetTarget?, seconds: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(snapshot.restLabel ?? "组间休息", systemImage: "hourglass")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.secondary)
                .accessibilityAddTraits(.isHeader)
            countdownDigits(seconds)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 2)
                .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 12))
            if let next {
                let label = [next.exercise.block, next.exercise.name].compactMap { $0 }.joined(separator: " · ")
                Text("下一组 · \(label) · \(next.title)")
                    .font(.caption2.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
         }
    }

    private func timerDial(_ seconds: Int, total: Int) -> some View {
        VStack(spacing: 3) {
            countdownDigits(seconds)
            ProgressView(value: Double(max(0, min(seconds, total))), total: Double(max(1, total)))
                .tint(WatchTrainingColors.lime)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private func countdownDigits(_ seconds: Int) -> some View {
        Text(watchDuration(seconds))
            .font(.system(.largeTitle, design: .rounded, weight: .heavy).monospacedDigit())
            .foregroundStyle(WatchTrainingColors.lime)
            .minimumScaleFactor(0.70)
            .lineLimit(1)
            .accessibilityLabel("剩余 \(seconds) 秒")
    }

    private func finishedPanel(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "checkmark.circle").foregroundStyle(WatchTrainingColors.lime)
            Text(snapshot.exercises.contains { !$0.sets.isEmpty } ? "组次已完成" :
                    snapshot.runningSinceMilliseconds == nil ? "训练已暂停" : "训练进行中")
                .font(.headline.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text(snapshot.title).font(.footnote).foregroundStyle(WatchTrainingColors.secondary)
            workoutProgress(snapshot)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder private func focusAction(_ snapshot: NativeWatchWorkoutSnapshot, target: WatchSetTarget?,
                                          resting: Bool, setTime: Int?) -> some View {
        if snapshot.runningSinceMilliseconds == nil, target != nil {
            Button("继续训练") { workout.control(.setRunning, running: true) }
                .buttonStyle(WatchTrainingButton(primary: true))
                .disabled(!workout.canControl)
        } else if resting {
            HStack(spacing: 4) {
                Button("−15秒") { workout.control(.adjustRest, adjustment: -15) }
                    .buttonStyle(WatchTrainingButton())
                    .accessibilityLabel("休息减少 15 秒")
                Button("+15秒") { workout.control(.adjustRest, adjustment: 15) }
                    .buttonStyle(WatchTrainingButton())
                    .accessibilityLabel("休息增加 15 秒")
                Button("跳过") { workout.control(.skipRest) }
                    .buttonStyle(WatchTrainingButton(primary: true))
                    .accessibilityLabel("跳过休息")
            }
            .disabled(!workout.canControl)
        } else if let target {
            setAction(target, setTime: setTime, hasOtherTimer: setTime == nil && snapshot.activeSetTimer != nil)
        } else {
            Button("结束训练") { confirmation = .finish }
                .buttonStyle(WatchTrainingButton(primary: true))
                .disabled(!workout.canFinish)
        }
    }

    @ViewBuilder private func setAction(_ target: WatchSetTarget, setTime: Int?, hasOtherTimer: Bool) -> some View {
        if target.exercise.isTimed, setTime == nil {
            let seconds = Int(values(for: target).seconds.rounded())
            Button(seconds > 0 ? "开始计时" : "填写时长") {
                if seconds > 0 {
                    workout.control(.startSetTimer, position: target.position, seconds: seconds, edit: target)
                } else {
                    editing = target
                }
            }
            .buttonStyle(WatchTrainingButton(primary: true))
            .disabled(!workout.canControl || hasOtherTimer)
        } else {
            HStack(spacing: 5) {
                if setTime != nil {
                    Button {
                        workout.control(.cancelSetTimer, position: target.position, edit: target)
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .frame(minWidth: 32, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(WatchTrainingColors.secondary)
                    .accessibilityLabel("重置本组计时")
                }
                Button { complete(target, usingTimer: setTime != nil) } label: {
                    Label("完成这组", systemImage: "checkmark")
                }
                .buttonStyle(WatchTrainingButton(primary: true))
            }
            .disabled(!workout.canControl || hasOtherTimer)
        }
    }

    private func values(for target: WatchSetTarget) -> WatchSetValues {
        let original = WatchSetValues(target.set)
        guard let pendingEdit, pendingEdit.token == target.token, pendingEdit.position == target.position,
              pendingEdit.original == original else { return original }
        return pendingEdit.values
    }

    private func complete(_ target: WatchSetTarget, usingTimer: Bool) {
        let original = WatchSetValues(target.set)
        let edited = values(for: target)
        workout.control(.completeSet, position: target.position,
                        weight: edited.weight == original.weight ? nil : edited.weight,
                        reps: edited.reps == original.reps ? nil : Int(edited.reps.rounded()),
                        seconds: usingTimer || edited.seconds == original.seconds ? nil : Int(edited.seconds.rounded()),
                        rightWeight: edited.rightWeight == original.rightWeight ? nil : edited.rightWeight,
                        rightReps: edited.rightReps == original.rightReps ? nil : edited.rightReps.map { Int($0.rounded()) },
                        edit: target)
    }

    private func currentSet(in snapshot: NativeWatchWorkoutSnapshot) -> WatchSetTarget? {
        guard let state = workout.workoutState, let next = snapshot.next,
              let exercise = snapshot.exercises.first(where: { $0.index == next.move }),
              let set = exercise.sets.first(where: { $0.index == next.row }), !set.done else { return nil }
        return WatchSetTarget(token: state.token, revision: state.revision, exercise: exercise, set: set)
    }

    private func trainingList(_ snapshot: NativeWatchWorkoutSnapshot) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 7) {
                Text(snapshot.title)
                    .font(.headline.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                workoutProgress(snapshot)
                connectionNotice
                HStack(spacing: 4) {
                    Button { showsSettings = true } label: {
                        Label("设置", systemImage: "gearshape")
                    }
                    .buttonStyle(WatchTrainingButton())
                    Button("结束训练") { confirmation = .finish }
                        .buttonStyle(WatchTrainingButton())
                        .disabled(!workout.canFinish)
                }
                if canDiscard(snapshot) {
                    Button(role: .destructive) { confirmation = .discard } label: {
                        Label("放弃训练", systemImage: "trash")
                            .font(.footnote.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.red)
                    .disabled(!workout.canControl)
                }
                ForEach(snapshot.exercises, id: \.index) { exercise in
                    exerciseCard(exercise, next: snapshot.next)
                }
            }
            .padding(.horizontal, 7)
            .padding(.bottom, 6)
        }
    }

    private func canDiscard(_ snapshot: NativeWatchWorkoutSnapshot) -> Bool {
        workout.isTrainingOnWatch && (snapshot.runningSinceMilliseconds == nil ||
            !snapshot.exercises.contains { $0.sets.contains(where: \.done) })
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

    private func exerciseCard(_ exercise: NativeWatchWorkoutSnapshot.Exercise, next: NativeWatchWorkoutSnapshot.Position?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text([exercise.block, exercise.name].compactMap { $0 }.joined(separator: " · "))
                .font(.footnote.weight(.bold))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(WatchTrainingColors.raised)
                .accessibilityAddTraits(.isHeader)
            ForEach(exercise.sets, id: \.index) { set in
                let target = WatchSetTarget(exercise: exercise, set: set)
                setRow(target, isCurrent: next == target.position)
            }
        }
        .background(WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 12))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func setRow(_ target: WatchSetTarget, isCurrent: Bool) -> some View {
        HStack(alignment: .top, spacing: 5) {
            Image(systemName: target.set.done ? "checkmark.circle.fill" : isCurrent ? "circle.inset.filled" : "circle")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(target.set.done || isCurrent ? WatchTrainingColors.lime : WatchTrainingColors.secondary)
            Text("\(target.set.index + 1)").font(.caption2.weight(.semibold))
                .foregroundStyle(WatchTrainingColors.secondary)
            Text(target.values)
                .font(.footnote.weight(isCurrent ? .semibold : .regular).monospacedDigit())
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 8)
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
                Toggle("动作计时震动", isOn: $setTimerHaptics).tint(WatchTrainingColors.lime)
                Toggle("数码表冠输入", isOn: $crownInput).tint(WatchTrainingColors.lime)
                Text(crownInput ? "点选数值后旋转表冠。" : "使用加减按钮调整重量、次数或时长。")
                    .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                if workout.canStop && !workout.isTrainingOnWatch {
                    Button("断开手表") {
                        workout.stop()
                        showsSettings = false
                    }
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

    private var restCue: TimerCue? {
        guard restHaptics else { return nil }
        return timerCue(deadline: workout.workoutState?.snapshot.restElapsedDeadlineMilliseconds)
    }

    private var setCue: TimerCue? {
        guard setTimerHaptics else { return nil }
        return timerCue(deadline: workout.workoutState?.snapshot.activeSetTimer?.elapsedDeadlineMilliseconds)
    }

    private func timerCue(deadline: Int?) -> TimerCue? {
        guard workout.phoneConnected || workout.isTrainingOnWatch,
              let deadline, let state = workout.workoutState,
              let running = state.snapshot.runningSinceMilliseconds else { return nil }
        return TimerCue(token: state.token, deadline: deadline, runningSince: running)
    }

    private func remindAtEnd(_ cue: TimerCue?, haptic: WKHapticType, isCurrent: (TimerCue) -> Bool) async {
        guard let cue, let snapshot = workout.workoutState?.snapshot else { return }
        let delay = cue.deadline - snapshot.elapsed()
        guard delay > 0 else { return }
        do { try await Task.sleep(for: .milliseconds(delay)) } catch { return }
        guard !Task.isCancelled, isCurrent(cue) else { return }
        WKInterfaceDevice.current().play(haptic)
    }
}

private struct WatchSetEntry: View {
    private enum Field: Hashable { case weight, reps, rightWeight, rightReps, seconds }

    let target: WatchSetTarget
    let crownInput: Bool
    let save: (WatchSetValues) -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Field?
    @State private var values: WatchSetValues

    init(target: WatchSetTarget, values: WatchSetValues, crownInput: Bool, save: @escaping (WatchSetValues) -> Void) {
        self.target = target
        self.crownInput = crownInput
        self.save = save
        _values = State(initialValue: values)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                Text(target.exercise.name).font(.headline.weight(.bold))
                Text(target.title).font(.caption2.weight(.semibold)).foregroundStyle(WatchTrainingColors.secondary)
                if target.exercise.isTimed {
                    editor("时长", text: watchDuration(Int(values.seconds)), field: .seconds, value: $values.seconds, maximum: 18_000, step: 1)
                } else {
                    let unilateral = values.rightWeight != nil
                    if target.exercise.allowsSeparateSides == true, target.set.right == nil {
                        Toggle("左右分开记录", isOn: separatesSides)
                            .font(.footnote)
                            .tint(WatchTrainingColors.lime)
                    }
                    editor(unilateral ? "左侧重量" : "重量", text: "\(watchWeight(values.weight)) \(target.exercise.unit)",
                           field: .weight, value: $values.weight, maximum: 2_000, step: 0.5)
                    editor(unilateral ? "左侧次数" : "次数", text: String(Int(values.reps)),
                           field: .reps, value: $values.reps, maximum: 999, step: 1)
                    if let rightWeight = values.rightWeight, let rightReps = values.rightReps {
                        editor("右侧重量", text: "\(watchWeight(rightWeight)) \(target.exercise.unit)", field: .rightWeight,
                               value: Binding(get: { values.rightWeight ?? rightWeight }, set: { values.rightWeight = $0 }),
                               maximum: 2_000, step: 0.5)
                        editor("右侧次数", text: String(Int(rightReps)), field: .rightReps,
                               value: Binding(get: { values.rightReps ?? rightReps }, set: { values.rightReps = $0 }),
                               maximum: 999, step: 1)
                    }
                }
                if crownInput {
                    Text("点选数值后旋转表冠。")
                        .font(.caption2).foregroundStyle(WatchTrainingColors.secondary)
                }
                Button("应用到当前组") {
                    save(values)
                    dismiss()
                }
                .buttonStyle(WatchTrainingButton(primary: true))
            }
            .padding(8)
        }
        .background(WatchTrainingColors.background.ignoresSafeArea())
        .foregroundStyle(WatchTrainingColors.text)
    }

    private var separatesSides: Binding<Bool> {
        Binding(get: { values.rightWeight != nil }, set: { separate in
            values.rightWeight = separate ? values.weight : nil
            values.rightReps = separate ? values.reps : nil
        })
    }

    @ViewBuilder private func editor(_ title: String, text: String, field: Field, value: Binding<Double>, maximum: Double, step: Double) -> some View {
        let bounds = 0...maximum
        if crownInput {
            valueLabel(title, text: text, selected: focused == field)
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
            Stepper(value: value, in: bounds, step: step) { valueLabel(title, text: text, selected: false) }
        }
    }

    private func valueLabel(_ title: String, text: String, selected: Bool) -> some View {
        HStack {
            Text(title).font(.footnote)
            Spacer(minLength: 2)
            Text(text).font(.footnote.weight(.bold).monospacedDigit())
                .foregroundStyle(WatchTrainingColors.lime)
        }
        .frame(minHeight: 42)
        .padding(.horizontal, 7)
        .background(selected ? WatchTrainingColors.raised : WatchTrainingColors.surface, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }
}
