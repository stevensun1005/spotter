import Charts
import CryptoKit
import Foundation
import SwiftUI

struct NativeHealthPreferences {
    let base: String

    init(origin: String?, owner: String?) {
        let identity = [origin ?? "", owner ?? ""].joined(separator: "\n")
        let hash = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
        base = "spotter.native.health." + hash
    }

    func key(_ field: String) -> String { base + "." + field }

    var hasRequestedNativeAccess: Bool {
        get { UserDefaults.standard.bool(forKey: key("nativeAccessRequested")) }
        nonmutating set { UserDefaults.standard.set(newValue, forKey: key("nativeAccessRequested")) }
    }

    var enabled: Bool { UserDefaults.standard.bool(forKey: key("autoHeart")) }

    var processed: [String] { UserDefaults.standard.stringArray(forKey: key("finished")) ?? [] }

    func remember(_ id: String) {
        let recent = processed.filter { $0 != id } + [id]
        UserDefaults.standard.set(Array(recent.suffix(160)), forKey: key("finished"))
    }

    func report(_ description: String, kind: String) {
        UserDefaults.standard.set(Date.now.timeIntervalSince1970, forKey: key(kind + "At"))
        UserDefaults.standard.set(description, forKey: key(kind + "Result"))
    }
}

@MainActor
final class NativeAutomaticHeartSync {
    static let shared = NativeAutomaticHeartSync()
    private var activeScopes: Set<String> = []
    private var attempts: [String: Date] = [:]

    private struct CurrentHeart: Decodable {
        let data: NativeImportedHeart?
        let automaticHeart: Bool?
    }

    private struct Upload: Encodable {
        let action = "save"
        let onlyIfMissing = true
        let expectedOwner: String
        let id: String
        let data: HeartPayload
    }

    private struct Receipt: Decodable { let saved: Bool }

    func run(api: NativeAPI, owner: String, entries: [NativeWorkoutEntry], force: Bool = false) async {
        let preferences = NativeHealthPreferences(origin: api.origin, owner: owner)
        guard preferences.enabled, activeScopes.insert(preferences.base).inserted else { return }
        defer { activeScopes.remove(preferences.base) }

        let now = Date.now
        let start = Calendar.current.date(byAdding: .day, value: -7, to: now) ?? now
        let limit = Int(start.timeIntervalSince1970 * 1_000)
        let completed = Set(preferences.processed)
        attempts = attempts.filter { now.timeIntervalSince($0.value) < 7 * 24 * 60 * 60 }
        let windows = entries.compactMap { entry -> WorkoutWindow? in
            let from = Int(entry.data["started"].number)
            let to = Int(entry.data["ended"].number)
            let window = WorkoutWindow(id: entry.id, from: from, to: to)
            guard entry.owner == owner, entry.kind == "log", !completed.contains(entry.id),
                  to > from, to >= limit, window.canRead else { return nil }
            let last = attempts[preferences.base + entry.id] ?? .distantPast
            return force || now.timeIntervalSince(last) >= 15 * 60 ? window : nil
        }
        .sorted { lhs, rhs in
            let left = attempts[preferences.base + lhs.id] ?? .distantPast
            let right = attempts[preferences.base + rhs.id] ?? .distantPast
            return left == right ? lhs.to > rhs.to : left < right
        }

        if windows.isEmpty {
            if force { preferences.report("近 7 天没有需要补录的已完成训练。", kind: "auto") }
            return
        }

        let reader = HealthKitReader()
        var saved = 0
        var existing = 0
        var waiting = 0
        for window in windows.prefix(12) {
            guard preferences.enabled, !Task.isCancelled else { return }
            let attemptKey = preferences.base + window.id
            attempts[attemptKey] = now
            do {
                let cloud = try await api.request("/api/health?id=" + window.id, method: "GET", json: nil, for: owner)
                let current = try JSONDecoder().decode(CurrentHeart.self, from: cloud)
                if current.data != nil {
                    preferences.remember(window.id)
                    existing += 1
                    continue
                }
                guard current.automaticHeart == true else {
                    preferences.report("当前服务暂不支持心率自动补录。", kind: "auto")
                    return
                }
                guard let readings = try await reader.read(window) else {
                    waiting += 1
                    continue
                }
                guard preferences.enabled, !Task.isCancelled else { return }
                let body = try JSONEncoder().encode(Upload(expectedOwner: owner, id: window.id, data: readings))
                let reply = try await api.request("/api/health", method: "POST", json: body)
                let receipt = try JSONDecoder().decode(Receipt.self, from: reply)
                preferences.remember(window.id)
                if receipt.saved { saved += 1 } else { existing += 1 }
            } catch is CancellationError {
                return
            } catch let error as NativeAPIError where error.statusCode == 404 {
                attempts.removeValue(forKey: attemptKey)
                waiting += 1
            } catch {
                waiting += 1
            }
        }

        var result = ["已补录 \(saved) 堂"]
        if existing > 0 { result.append("已有心率 \(existing) 堂") }
        if waiting > 0 { result.append("待重试 \(waiting) 堂") }
        preferences.report(result.joined(separator: " · "), kind: "auto")
    }
}

@MainActor
struct NativeHeartView: View {
    private struct Cloud: Decodable { let data: NativeImportedHeart? }

    let api: NativeAPI
    let owner: String
    let entry: NativeWorkoutEntry
    var isPending = false
    @State private var workoutSummary: NativeWorkoutHealthSummary?
    @State private var stored: NativeImportedHeart?
    @Environment(\.dynamicTypeSize) private var textSize
    @State private var loading = true
    @State private var loadedCloud = false
    @State private var operation: Task<Void, Never>?
    @State private var message: String?
    @State private var confirmsReplacement = false

    private var window: WorkoutWindow? {
        guard entry.owner == owner, entry.kind == "log", let interval = entry.workoutWindow else { return nil }
        let value = WorkoutWindow(id: entry.id, from: Int(interval.from), to: Int(interval.to))
        return value.canRead ? value : nil
    }

    var body: some View {
        VStack(spacing: 13) {
            workoutSummaryCard
            if !isPending { heartCard }
        }
        .task(id: entry.key) { _ = await updateWorkoutSummary() }
        .onReceive(NativeWorkoutHealthSync.shared.$updatedWorkout) { updated in
            guard updated == entry.key else { return }
            Task { _ = await updateWorkoutSummary() }
        }
    }

    private var workoutSummaryCard: some View {
        let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 7)) : AnyLayout(HStackLayout(spacing: 7))
        return VStack(alignment: .leading, spacing: 10) {
            Label("训练数据", systemImage: "applewatch")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            layout {
                workoutMetric("活跃热量", value: workoutSummary?.activeKilocalories, unit: "千卡")
                workoutMetric("总热量", value: workoutSummary?.totalKilocalories, unit: "千卡")
                workoutMetric("平均心率", value: workoutSummary?.averageHeartRate, unit: "次/分")
            }
            if workoutSummary != nil {
                Text("Apple Watch").font(.caption).foregroundStyle(SpotterPalette.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
    }

    private func workoutMetric(_ title: String, value: Double?, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
            Text(value?.formatted(.number.precision(.fractionLength(0))) ?? "—")
                .font(.title3.weight(.heavy))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if value != nil { Text(unit).font(.caption2).foregroundStyle(SpotterPalette.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(9)
        .background(SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 9))
        .accessibilityElement(children: .combine)
    }

    private var heartCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("训练心率", systemImage: "heart.text.square")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                if let window { syncButton(window) }
            }
            if let stored { summary(stored) }
            if loading {
                ProgressView("正在读取心率…").font(.footnote)
            } else if let message {
                Text(message).font(.footnote).foregroundStyle(SpotterPalette.muted)
            } else if stored == nil {
                Text(window == nil ? "此训练没有可读取的起止时间。" : "暂无心率记录。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
        .task(id: entry.id) {
            defer { loading = false }
            do { try await loadCloud() }
            catch is CancellationError { }
            catch { message = "无法读取云端心率。轻点同步按钮重试。" }
        }
        .onDisappear { operation?.cancel() }
        .confirmationDialog("替换这次训练已保存的心率？", isPresented: $confirmsReplacement, titleVisibility: .visible) {
            Button("确认替换", role: .destructive) {
                if let window { perform { try await loadHealth(window) } }
            }
            Button("取消", role: .cancel) {}
        }
    }

    private func syncButton(_ window: WorkoutWindow) -> some View {
        Button {
            perform {
                if !loadedCloud { try await loadCloud() }
                if let stored, stored.source != "apple" { confirmsReplacement = true }
                else { try await loadHealth(window) }
            }
        } label: {
            Group {
                if operation == nil {
                    Image(systemName: "arrow.clockwise").font(.subheadline.weight(.semibold))
                } else {
                    ProgressView().controlSize(.small)
                }
            }
            .frame(width: 36, height: 36)
            .foregroundStyle(SpotterPalette.ink)
            .background(SpotterPalette.wash, in: Circle())
            .overlay { Circle().strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
            .frame(width: 44, height: 44)
            .contentShape(Circle())
        }
        .buttonStyle(.spotterPress)
        .disabled(loading || operation != nil)
        .accessibilityLabel(operation == nil ? "从 Apple 健康同步" : "正在同步 Apple 健康")
        .accessibilityHint("同步训练热量和心率")
        .accessibilityIdentifier("spotter-workout-heart-sync")
    }

    private func summary(_ data: NativeImportedHeart) -> some View {
        let start = Date(timeIntervalSince1970: Double(data.from) / 1_000)
        let end = Date(timeIntervalSince1970: Double(data.to) / 1_000)
        let dateStyle: Date.FormatStyle.DateStyle = Calendar.current.isDate(start, inSameDayAs: end) ? .omitted : .abbreviated
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Text(data.label).font(.footnote.weight(.semibold))
                Text(start.formatted(date: dateStyle, time: .shortened) + " – " + end.formatted(date: dateStyle, time: .shortened))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            HStack(spacing: 20) {
                if workoutSummary?.averageHeartRate == nil { heartMeasure("平均", value: data.average) }
                heartMeasure("最低", value: data.lowest)
                heartMeasure("最高", value: data.maximum)
            }
            if !data.samples.isEmpty {
                Chart(data.samples, id: \.at) { point in
                    let time = Date(timeIntervalSince1970: Double(point.at) / 1_000)
                    if data.samples.count == 1 {
                        PointMark(x: .value("时间", time), y: .value("心率", point.bpm)).foregroundStyle(.red)
                    } else {
                        LineMark(x: .value("时间", time), y: .value("心率", point.bpm)).foregroundStyle(.red)
                    }
                }
                .frame(height: 120)
                .accessibilityLabel("训练心率曲线")
            }
        }
    }

    private func heartMeasure(_ title: String, value: Int?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value.map { "\($0)" } ?? "–").font(.title3.bold()).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
    }

    private func perform(_ action: @escaping @MainActor () async throws -> Void) {
        guard operation == nil, !loading else { return }
        message = nil
        operation = Task {
            defer { operation = nil }
            do { try await action() }
            catch is CancellationError { }
            catch { message = error.localizedDescription }
        }
    }

    private func loadCloud() async throws {
        guard entry.owner == owner, entry.kind == "log", UUID(uuidString: entry.id) != nil else { return }
        let data = try await api.request("/api/health?id=" + entry.id, method: "GET", json: nil, for: owner)
        try Task.checkCancellation()
        stored = try JSONDecoder().decode(Cloud.self, from: data).data
        loadedCloud = true
    }

    private func updateWorkoutSummary(refresh: Bool = false) async -> Bool {
        guard let value = try? await NativeWorkoutHealthSync.shared.load(api: api, owner: owner, entry: entry, refresh: refresh),
              !Task.isCancelled else { return false }
        workoutSummary = value
        return true
    }

    private func loadHealth(_ window: WorkoutWindow) async throws {
        let reader = HealthKitReader()
        try await reader.authorizeWorkoutSummary()
        async let refreshedSummary = updateWorkoutSummary(refresh: true)
        guard let payload = try await reader.read(window) else {
            message = await refreshedSummary ? "已读取手表训练数据，暂无可读取的心率曲线。" :
                "这段时间没有可读取的心率。请检查健康权限和手表同步。"
            return
        }
        try await save(payload)
        try await loadCloud()
        message = await refreshedSummary ? "已读取手表训练数据，心率已同步。" : "这次训练的心率已同步。"
    }

    private struct HeartUpload<Payload: Encodable>: Encodable {
        let action = "save"
        let id: String
        let expectedOwner: String
        let data: Payload
    }

    private func save<T: Encodable>(_ data: T) async throws {
        guard window != nil else { return }
        try Task.checkCancellation()
        let body = try JSONEncoder().encode(HeartUpload(id: entry.id, expectedOwner: owner, data: data))
        _ = try await api.request("/api/health", method: "POST", json: body, for: owner)
    }
}

@MainActor
struct NativeHealthSummary: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.spotterInteractionMotion) private var motion
    private struct Snapshot {
        let data: NativeHealthReadings
        let calendar: Calendar
    }

    private struct CloudBody: Decodable {
        struct Row: Decodable { let id: String? }
        let rows: [Row]
    }

    var api: NativeAPI? = nil
    var owner: String? = nil
    var workouts: NativeWorkoutStore? = nil
    private let preferences: NativeHealthPreferences
    private let groups: [NativeHealthGroup]
    private let metrics: Set<NativeHealthMetric>
    @State private var reader = HealthKitReader()
    @State private var didRequestAccess: Bool
    @State private var needsPermissionPrompt: Bool?
    @State private var showPermissionInstructions = false
    @State private var refreshRevision = 0
    @State private var observing = false
    @State private var readTask: Task<Void, Never>?
    @State private var pendingRead = false
    @State private var uploadSelection: Set<NativeHealthMetric> = []
    @State private var days = 7
    @State private var snapshot: Snapshot?
    @State private var readError: String?
    @State private var message: String?
    @State private var operation: Task<Void, Never>?
    @AppStorage private var autoHeart: Bool
    @AppStorage private var autoAt: Double
    @AppStorage private var autoResult: String
    @AppStorage private var readAt: Double
    @AppStorage private var readResult: String

    init(api: NativeAPI? = nil, owner: String? = nil, initialGroup: NativeHealthGroup? = nil, workouts: NativeWorkoutStore? = nil) {
        self.api = api
        self.owner = owner
        self.workouts = workouts
        let preferences = NativeHealthPreferences(origin: api?.origin, owner: owner)
        self.preferences = preferences
        groups = initialGroup.map { [$0] } ?? NativeHealthGroup.allCases
        metrics = Set(groups.flatMap(\.metrics)).intersection(NativeHealthMetric.supportedMetrics)
        _didRequestAccess = State(initialValue: preferences.hasRequestedNativeAccess)
        _autoHeart = AppStorage(wrappedValue: false, preferences.key("autoHeart"))
        _autoAt = AppStorage(wrappedValue: 0, preferences.key("autoAt"))
        _autoResult = AppStorage(wrappedValue: "", preferences.key("autoResult"))
        _readAt = AppStorage(wrappedValue: 0, preferences.key("readAt"))
        _readResult = AppStorage(wrappedValue: "", preferences.key("readResult"))
    }

    private var canRead: Bool {
        HealthKitReader.nativeDataAvailable && didRequestAccess
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if HealthKitReader.nativeDataAvailable {
                Button(action: managePermission) {
                    Label(didRequestAccess && needsPermissionPrompt == false ? "管理 Apple 健康权限" : "授权 Apple 健康",
                          systemImage: "heart.text.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(operation != nil)
            } else {
                Label("这台设备无法读取 Apple 健康", systemImage: "heart.text.square")
                    .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            }
            if canRead { availableData }
            if let api, let owner, canRead || autoHeart {
                accountSync(api: api, owner: owner)
            }
            if operation != nil { ProgressView("正在处理…").font(.footnote) }
            if let message {
                Text(message).font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
        }
        .task(id: refreshRevision) { await refreshAccess() }
        .onChange(of: days) { _ in
            snapshot = nil
            uploadSelection = []
            readError = nil
            scheduleRead()
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active { refreshRevision &+= 1 }
            else {
                stopReading()
                if phase == .background { snapshot = nil }
            }
        }
        .alert("管理 Apple 健康权限", isPresented: $showPermissionInstructions) {
            Button("好", role: .cancel) {}
        } message: {
            Text("在 iPhone 的「健康」中点头像，选择「App 与服务」→「训练搭子」。")
        }
        .animation(motion, value: snapshot != nil)
        .onDisappear {
            operation?.cancel()
            stopReading()
            snapshot = nil
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
    }

    private var availableData: some View {
        VStack(alignment: .leading, spacing: 10) {
            SpotterMenuPicker("日期范围", selection: $days,
                              options: [(1, "今天"), (7, "近 7 天"), (30, "近 30 天"), (90, "近 90 天"), (365, "近一年")])
                .disabled(operation != nil)
            reportView("最近一次读取", timestamp: readAt, result: readResult)
            if let readError {
                Text(readError).font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if let snapshot {
                if snapshot.data.values.isEmpty {
                    Text("此日期范围内没有可读样本。可更换日期范围或检查健康权限。")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                } else {
                    results(snapshot.data)
                }
            } else if readTask != nil {
                ProgressView("正在读取 Apple 健康…").font(.footnote)
            }
        }
    }

    private func accountSync(api: NativeAPI, owner: String) -> some View {
        SpotterDisclosure("同步到我的账号") {
            VStack(alignment: .leading, spacing: 8) {
                if groups == NativeHealthGroup.allCases {
                    Toggle("自动补录训练心率", isOn: Binding(get: { autoHeart }, set: { enabled in
                        autoHeart = enabled
                        if enabled { retryHeart(api: api, owner: owner) }
                    }))
                    .font(.subheadline.weight(.semibold))
                    .disabled(!canRead && !autoHeart)
                    Text("按训练的实际起止时间，补录近 7 天匹配到的心率。")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                    reportView("最近一次补录", timestamp: autoAt, result: autoResult)
                    if autoHeart {
                        Button("重试近 7 天") { retryHeart(api: api, owner: owner) }
                            .buttonStyle(.spotterControl)
                    }
                }
                if let snapshot { uploadView(snapshot, api: api, owner: owner) }
            }
            .disabled(operation != nil)
        }
    }

    private func retryHeart(api: NativeAPI, owner: String) {
        operation = Task {
            defer { operation = nil }
            if let workouts { await workouts.load() }
            await NativeAutomaticHeartSync.shared.run(api: api, owner: owner, entries: workouts?.logs ?? [], force: true)
        }
    }

    @ViewBuilder private func reportView(_ title: String, timestamp: Double, result: String) -> some View {
        if timestamp > 0 {
            VStack(alignment: .leading, spacing: 2) {
                Text(title + " · " + Date(timeIntervalSince1970: timestamp).formatted(.dateTime.month().day().hour().minute()))
                    .font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
                if !result.isEmpty { Text(result).font(.caption).foregroundStyle(SpotterPalette.ink) }
            }
        }
    }

    private func results(_ data: NativeHealthReadings) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(groups) { group in
                let visible = group.metrics.filter { data.values[$0] != nil }
                if !visible.isEmpty {
                    SpotterDisclosure(group.title) {
                        ForEach(visible) { metric in
                            if let value = data.values[metric] { readingRow(metric, value) }
                        }
                    }
                }
            }
        }
    }

    private func readingRow(_ metric: NativeHealthMetric, _ value: NativeHealthReading) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            LabeledContent {
                Text(display(value, metric: metric))
                    .monospacedDigit()
            } label: {
                Text(metric.isAverage ? "平均" + metric.title : metric.title)
            }
            .font(.subheadline)

            switch value {
            case let .quantity(_, latest):
                if let latest { measurementDate(latest) }
            case let .body(samples):
                if let latest = samples.last {
                    HStack(spacing: 5) {
                        measurementDate(latest.date)
                        Text("· " + latest.sourceName).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                }
            case let .workouts(workouts):
                SpotterDisclosure("最近 \(min(10, workouts.count)) 次运动") {
                    ForEach(Array(workouts.suffix(10).reversed()), id: \.id) { session in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.activity + " · " + minutes(session.durationSeconds))
                            if let energy = session.activeEnergyKcal {
                                Text(energy.formatted(.number.precision(.fractionLength(0))) + " 千卡")
                            }
                            Text(session.sourceName).font(.caption)
                            measurementDate(Date(timeIntervalSince1970: Double(session.from) / 1_000))
                        }
                        .padding(.vertical, 3)
                    }
                }
                .font(.footnote)
                .foregroundStyle(SpotterPalette.muted)
            case let .sleep(_, inBedSeconds):
                if let inBedSeconds { Text("在床时间 \(minutes(inBedSeconds))").font(.caption).foregroundStyle(SpotterPalette.muted) }
            }
        }
    }

    private func measurementDate(_ date: Date) -> some View {
        Text(date, format: .dateTime.month().day().hour().minute())
            .font(.caption).foregroundStyle(SpotterPalette.muted)
    }

    private func display(_ reading: NativeHealthReading, metric: NativeHealthMetric) -> String {
        switch reading {
        case let .quantity(value, _):
            return value.formatted(.number.precision(.fractionLength(0...2))) + " " + metric.symbol
        case let .body(records):
            return records.last.map { $0.value.formatted(.number.precision(.fractionLength(0...2))) + " " + metric.symbol } ?? "无可读样本"
        case let .workouts(records):
            return "\(records.count) 次 · " + minutes(records.reduce(0) { $0 + $1.durationSeconds })
        case let .sleep(seconds, _):
            return seconds.map(minutes) ?? "无睡眠时长"
        }
    }

    private func minutes(_ seconds: TimeInterval) -> String {
        (seconds / 60).formatted(.number.precision(.fractionLength(0))) + " 分钟"
    }

    @ViewBuilder private func uploadView(_ snapshot: Snapshot, api: NativeAPI, owner: String) -> some View {
        let available = bodySamples(snapshot.data)
        let writable = Set(available.map(\.metric))
        let chosen = available.filter { uploadSelection.contains($0.metric) }
        if !available.isEmpty {
            Divider()
            VStack(alignment: .leading, spacing: 8) {
                Text("同步身体记录到账号").font(.subheadline.weight(.bold))
                Text("将所选测量保存到训练搭子的身体数据。其他健康读数仅在此处查看。")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                ForEach(NativeHealthGroup.body.metrics.filter { writable.contains($0) }) { metric in
                    Toggle(metric.title, isOn: enabled(metric, in: $uploadSelection))
                }
                Button("同步 \(chosen.count) 条记录") {
                    operation = Task { await upload(chosen, calendar: snapshot.calendar, api: api, owner: owner) }
                }
                .buttonStyle(.spotterControl)
                .disabled(chosen.isEmpty)
            }
            .disabled(operation != nil)
        }
    }

    private func enabled(_ metric: NativeHealthMetric, in selection: Binding<Set<NativeHealthMetric>>) -> Binding<Bool> {
        Binding(get: { selection.wrappedValue.contains(metric) }, set: { enabled in
            if enabled { selection.wrappedValue.insert(metric) }
            else { selection.wrappedValue.remove(metric) }
        })
    }

    private func bodySamples(_ readings: NativeHealthReadings) -> [NativeHealthBodySample] {
        NativeHealthGroup.body.metrics.flatMap { metric -> [NativeHealthBodySample] in
            guard case let .body(records)? = readings.values[metric], let measurement = metric.accountMeasurement else { return [] }
            return records.filter { measurement.range.contains($0.value) }
        }
    }

    private func managePermission() {
        if didRequestAccess && needsPermissionPrompt == false {
            showPermissionInstructions = true
            return
        }
        message = nil
        operation = Task {
            defer { operation = nil }
            do {
                try await reader.authorizeNativeMetrics()
                try Task.checkCancellation()
                preferences.hasRequestedNativeAccess = true
                didRequestAccess = true
                refreshRevision &+= 1
            } catch is CancellationError {
            } catch { message = error.localizedDescription }
        }
    }

    private func refreshAccess() async {
        guard HealthKitReader.nativeDataAvailable, scenePhase == .active else { return }
        if let status = try? await reader.nativeAuthorizationNeedsPrompt(), !Task.isCancelled {
            needsPermissionPrompt = status
        }
        guard canRead, scenePhase == .active, !Task.isCancelled else { return }
        if !observing {
            observing = true
            reader.observeNativeMetrics(metrics) { scheduleRead(coalescing: true) }
        }
        scheduleRead()
    }

    private func stopReading() {
        reader.stopObservingNativeMetrics()
        observing = false
        readTask?.cancel()
        readTask = nil
        pendingRead = false
    }

    private func scheduleRead(coalescing: Bool = false) {
        guard observing, canRead, scenePhase == .active else { return }
        if coalescing, readTask != nil {
            pendingRead = true
            return
        }
        readTask?.cancel()
        readTask = Task {
            if coalescing {
                do { try await Task.sleep(for: .seconds(2)) }
                catch { return }
            }
            await read()
            guard !Task.isCancelled else { return }
            readTask = nil
            if pendingRead {
                pendingRead = false
                scheduleRead(coalescing: true)
            }
        }
    }

    private func read() async {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date.now
        guard let begin = calendar.date(byAdding: .day, value: 1 - days, to: calendar.startOfDay(for: now)) else { return }
        do {
            let data = try await reader.readNativeMetrics(metrics, from: begin, to: now, calendar: calendar)
            try Task.checkCancellation()
            let available = Set(bodySamples(data).map(\.metric))
            if snapshot == nil { uploadSelection = available }
            else { uploadSelection.formIntersection(available) }
            snapshot = Snapshot(data: data, calendar: calendar)
            readError = nil
            preferences.report("读取到 \(data.values.count) 项", kind: "read")
        } catch is CancellationError {
        } catch {
            guard !Task.isCancelled else { return }
            readError = error.localizedDescription
            preferences.report("读取未完成", kind: "read")
        }
    }

    private func upload(_ samples: [NativeHealthBodySample], calendar: Calendar, api: NativeAPI, owner: String) async {
        var saved = 0
        var skipped = 0
        defer {
            operation = nil
            if saved > 0 { NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil) }
        }
        message = nil
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        do {
            let cloud = try await api.spotterRead("/api/library?section=body", as: CloudBody.self)
            var existing = Set(cloud.rows.compactMap(\.id).map { $0.lowercased() })
            for sample in samples {
                try Task.checkCancellation()
                guard !existing.contains(sample.id) else { skipped += 1; continue }
                let entry: [String: Any]
                if let key = sample.metric.accountMeasurement?.key {
                    entry = ["type": "measurement", "metric": key, "value": sample.value]
                } else {
                    entry = ["type": "weight", "kg": sample.value]
                }
                _ = try await api.spotterSend("/api/library", body: [
                    "action": "save", "expectedOwner": owner,
                    "data": ["kind": "nutrition", "id": sample.id, "date": formatter.string(from: sample.date), "entry": entry]
                ])
                existing.insert(sample.id)
                saved += 1
            }
            message = "已同步 \(saved) 条，跳过已有的 \(skipped) 条。"
        } catch is CancellationError {
        } catch { message = "已同步 \(saved) 条。\(error.localizedDescription)" }
    }
}
