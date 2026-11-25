import Charts
import Foundation
import SwiftUI
import UniformTypeIdentifiers

@MainActor
struct NativeHeartView: View {
    private struct Cloud: Decodable { let data: NativeImportedHeart? }
    private enum Confirmation: String, Identifiable {
        case apple, replaceFile, remove
        var id: Self { self }
        var title: String { self == .remove ? "移除这次训练的心率？" : "替换这次训练已保存的心率？" }
        var action: String { self == .remove ? "移除心率" : "确认替换" }
    }

    let api: NativeAPI
    let owner: String
    let entry: NativeWorkoutEntry
    @State private var stored: NativeImportedHeart?
    @State private var preview: NativeImportedHeart?
    @State private var loading = true
    @State private var loadedCloud = false
    @State private var operation: Task<Void, Never>?
    @State private var message: String?
    @State private var showingFiles = false
    @State private var confirmation: Confirmation?

    private var window: WorkoutWindow? {
        guard entry.owner == owner, entry.kind == "log", let interval = entry.workoutWindow else { return nil }
        let value = WorkoutWindow(id: entry.id, from: interval.from, to: interval.to)
        return value.canRead ? value : nil
    }

    private static let fileTypes = [UTType(filenameExtension: "fit"), UTType(filenameExtension: "tcx"), .commaSeparatedText, .zip]
        .map { $0 ?? .data }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("训练心率", systemImage: "heart.text.square").font(.headline)
            if preview != nil { Label("导入预览 · 仅你可见", systemImage: "lock").font(.footnote.weight(.semibold)) }
            if let shown = preview ?? stored { summary(shown) }
            if loading || operation != nil { ProgressView(loading ? "正在读取心率…" : "正在处理心率…").font(.footnote) }
            if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
            if let window { controls(window).disabled(loading || operation != nil) }
            else if stored == nil { Text("此训练没有可读取的起止时间。").font(.footnote).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
        .task(id: entry.id) {
            defer { loading = false }
            do { try await loadCloud() }
            catch is CancellationError { }
            catch { message = "无法读取云端心率。重新打开这条记录可重试。" }
        }
        .onDisappear {
            operation?.cancel()
        }
        .fileImporter(isPresented: $showingFiles, allowedContentTypes: Self.fileTypes) { result in
            guard let window else { return }
            switch result {
            case .success(let url): perform { try await importFile(url, window: window) }
            case .failure: message = "无法打开所选文件。"
            }
        }
        .confirmationDialog(confirmation?.title ?? "", isPresented: Binding(
            get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }
        ), titleVisibility: .visible, presenting: confirmation) { action in
            Button(action.action, role: .destructive) {
                guard let window else { return }
                switch action {
                case .apple: perform { try await loadHealth(window) }
                case .replaceFile: perform { try await savePreview() }
                case .remove: perform { try await remove() }
                }
            }
            Button("取消", role: .cancel) {}
        }
    }

    @ViewBuilder private func controls(_ window: WorkoutWindow) -> some View {
        if preview != nil {
            let needsConfirmation = stored != nil || !loadedCloud
            Button {
                if needsConfirmation { confirmation = .replaceFile }
                else { perform { try await savePreview() } }
            } label: { Label(needsConfirmation ? "替换已保存心率" : "保存心率", systemImage: "checkmark") }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
            Button("取消预览") { preview = nil; message = nil }.buttonStyle(.spotterPress)
        } else {
            ViewThatFits(in: .horizontal) {
                HStack { fileButton; appleButton(window) }
                VStack(alignment: .leading, spacing: 8) { fileButton; appleButton(window) }
            }
            if stored != nil {
                Button("移除心率") { confirmation = .remove }
                    .font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted).buttonStyle(.spotterPress)
            }
            DisclosureGroup("支持的设备与文件") {
                Text("Garmin 等设备可导入 FIT 或 TCX，WHOOP 可选择 workouts.csv 或原始 ZIP。含明确时间和 BPM 的 CSV 也可导入。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.top, 5)
            }.font(.footnote)
        }
    }

    private var fileButton: some View {
        Button { showingFiles = true } label: {
            Label("导入心率文件", systemImage: "doc.badge.plus").fixedSize(horizontal: true, vertical: false)
        }.buttonStyle(.bordered)
    }

    private func appleButton(_ window: WorkoutWindow) -> some View {
        Button {
            if (stored != nil && stored?.source != "apple") || !loadedCloud { confirmation = .apple }
            else { perform { try await loadHealth(window) } }
        } label: {
            Label("从 Apple 健康同步", systemImage: "arrow.trianglehead.clockwise").fixedSize(horizontal: true, vertical: false)
        }.buttonStyle(.bordered)
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
                heartMeasure("平均", value: data.average)
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
        let result = try await api.spotterRead("/api/health?id=" + entry.id, as: Cloud.self)
        try Task.checkCancellation()
        stored = result.data
        loadedCloud = true
    }

    private func importFile(_ url: URL, window: WorkoutWindow) async throws {
        let parse = Task.detached(priority: .userInitiated) { try NativeHeartFileImport.read(url, window: window) }
        let result = try await withTaskCancellationHandler { try await parse.value } onCancel: { parse.cancel() }
        try Task.checkCancellation()
        preview = result
    }

    private func savePreview() async throws {
        guard window != nil, let preview else { return }
        try await save(preview)
        stored = preview
        self.preview = nil
        loadedCloud = true
        message = "心率已保存到这次训练。"
    }

    private func loadHealth(_ window: WorkoutWindow) async throws {
        let reader = HealthKitReader()
        try await reader.authorize(.heartRate)
        guard let payload = try await reader.read(window) else {
            message = "这段时间没有可读取的心率。请检查健康权限和手表同步。"
            return
        }
        try await save(payload)
        try await loadCloud()
        message = "这次训练的心率已同步。"
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
        _ = try await api.request("/api/health", method: "POST", json: body)
    }

    private func remove() async throws {
        guard window != nil, stored != nil else { return }
        let body = try JSONEncoder().encode(["action": "remove", "id": entry.id])
        _ = try await api.request("/api/health", method: "POST", json: body, for: owner)
        stored = nil
        loadedCloud = true
        message = "已移除这次训练的心率。"
    }
}

@MainActor
struct NativeHealthSummary: View {
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
    private let groups: [NativeHealthGroup]
    private let metrics: Set<NativeHealthMetric>
    @State private var selected: Set<NativeHealthMetric>
    @State private var uploadSelection: Set<NativeHealthMetric> = []
    @State private var days = 7
    @State private var snapshot: Snapshot?
    @State private var message: String?
    @State private var operation: Task<Void, Never>?

    init(api: NativeAPI? = nil, owner: String? = nil, initialGroup: NativeHealthGroup? = nil) {
        self.api = api
        self.owner = owner
        groups = initialGroup.map { [$0] } ?? NativeHealthGroup.allCases
        metrics = Set(groups.flatMap(\.metrics))
        _selected = State(initialValue: metrics)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Apple 健康", systemImage: "heart.text.square").font(.headline)
            Text("查看所选范围的健康数据。需要开启的项目由 Apple 健康逐项授权。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
            Picker("日期范围", selection: $days) {
                Text("今天").tag(1)
                Text("近 7 天").tag(7)
                Text("近 30 天").tag(30)
                Text("近 90 天").tag(90)
                Text("近一年").tag(365)
            }
            .disabled(operation != nil)
            selectionView.disabled(operation != nil)
            Button {
                operation = Task { await read() }
            } label: {
                Text("读取所选数据").frame(maxWidth: .infinity)
            }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
            .disabled(operation != nil || selected.isEmpty)
            if operation != nil {
                ProgressView("正在处理…").font(.footnote)
            }
            if let message {
                Text(message).font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if let snapshot {
                results(snapshot.data)
                if let api, let owner {
                    uploadView(snapshot, api: api, owner: owner)
                }
            }
        }
        .onChange(of: selected) { _ in clearResults() }
        .onChange(of: days) { _ in clearResults() }
        .onDisappear {
            operation?.cancel()
            clearResults()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
    }

    private var selectionView: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 8) {
                Button(selected == metrics ? "清空" : "选择全部") {
                    selected = selected == metrics ? [] : metrics
                }
                .buttonStyle(.bordered)
                ForEach(groups) { group in
                    DisclosureGroup(group.title) {
                        ForEach(group.metrics) { metric in
                            Toggle(metric.title, isOn: enabled(metric, in: $selected))
                                .padding(.top, 4)
                        }
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Text("读取项目（\(selected.count)/\(metrics.count)）").font(.subheadline.weight(.semibold))
        }
    }

    private func results(_ data: NativeHealthReadings) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(groups) { group in
                let visible = group.metrics.filter { selected.contains($0) }
                if !visible.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.title).font(.subheadline.weight(.bold))
                        ForEach(visible) { metric in
                            readingRow(metric, data.values[metric], failed: data.failed.contains(metric))
                        }
                    }
                }
            }
            Text("无可读样本可能表示当前范围内没有记录，或此项目尚未获准读取。")
                .font(.caption).foregroundStyle(SpotterPalette.muted)
        }
    }

    private func readingRow(_ metric: NativeHealthMetric, _ value: NativeHealthReading?, failed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            LabeledContent {
                Text(value.map { display($0, metric: metric) } ?? (failed ? "暂不可读取" : "无可读样本"))
                    .monospacedDigit()
            } label: {
                Text(metric.isAverage ? "平均" + metric.title : metric.title)
            }
            .font(.subheadline)

            switch value {
            case let .quantity(_, latest):
                if let latest { measurementDate(latest) }
            case let .body(samples):
                if let latest = samples.last { measurementDate(latest.date) }
            case let .workouts(workouts):
                DisclosureGroup("最近 \(min(10, workouts.count)) 次运动") {
                    ForEach(Array(workouts.suffix(10).reversed()), id: \.id) { session in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.activity + " · " + minutes(session.durationSeconds))
                            if let energy = session.activeEnergyKcal {
                                Text(energy.formatted(.number.precision(.fractionLength(0))) + " 千卡")
                            }
                            measurementDate(Date(timeIntervalSince1970: Double(session.from) / 1_000))
                        }
                        .padding(.vertical, 3)
                    }
                }
                .font(.footnote)
                .foregroundStyle(SpotterPalette.muted)
            case let .sleep(_, inBedSeconds):
                if let inBedSeconds { Text("在床时间 \(minutes(inBedSeconds))").font(.caption).foregroundStyle(SpotterPalette.muted) }
            case nil: EmptyView()
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
                .buttonStyle(.bordered)
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

    private func clearResults() {
        snapshot = nil
        uploadSelection = []
        message = nil
    }

    private func read() async {
        defer { operation = nil }
        clearResults()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date.now
        guard let begin = calendar.date(byAdding: .day, value: 1 - days, to: calendar.startOfDay(for: now)) else { return }
        do {
            let data = try await HealthKitReader().readNativeMetrics(selected, from: begin, to: now, calendar: calendar)
            try Task.checkCancellation()
            snapshot = Snapshot(data: data, calendar: calendar)
            uploadSelection = Set(bodySamples(data).map(\.metric))
        } catch is CancellationError {
        } catch { message = error.localizedDescription }
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
