import Charts
import SwiftUI
import UIKit

@MainActor
struct NativeRestSchedule: View {
    let api: NativeAPI
    let owner: String
    var addToday = true

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var weekdays = Set<Int>()
    @State private var dates = Set<String>()
    @State private var chosenDay = Date.now
    @State private var revision: String?
    @State private var ready = false
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    Text("每周不安排训练的日子").font(.headline)
                    ViewThatFits(in: .horizontal) {
                        weekdayButtons(0..<7)
                        VStack(alignment: .leading, spacing: 4) {
                            weekdayButtons(0..<4)
                            weekdayButtons(4..<7)
                        }
                    }
                    .animation(motion, value: weekdays)
                    Text("临时有事的日期").font(.headline)
                    HStack {
                        DatePicker("临时休息日期", selection: $chosenDay, displayedComponents: .date).labelsHidden()
                        Spacer()
                        Button { withAnimation(motion) { _ = dates.insert(spotterDay(chosenDay)) } } label: { Label("加入", systemImage: "plus") }
                            .buttonStyle(.spotterControl)
                            .disabled(!ready || busy || dates.count >= 180 || dates.contains(spotterDay(chosenDay)))
                    }
                    ForEach(dates.sorted(), id: \.self) { day in
                        HStack {
                            Text(day)
                            Spacer()
                            Button {
                                withAnimation(motion) { _ = dates.remove(day) }
                            } label: {
                                Image(systemName: "xmark").frame(width: 36, height: 36)
                            }
                            .buttonStyle(.spotterPress)
                            .accessibilityLabel("移除 " + day)
                            .disabled(busy)
                        }
                        .transition(.opacity.combined(with: .offset(y: -6)))
                    }
                    Text("新排和顺延会避开这些日子。已排好的训练可从当天单独调整。")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                    if let message { Text(message).font(.footnote).foregroundStyle(SpotterPalette.muted) }
                    if !ready {
                        Button("重新读取计划设置") { Task { await load() } }
                            .buttonStyle(.spotterPress).disabled(busy)
                    }
                    Button("保存计划设置") { Task { await save() } }
                        .buttonStyle(SpotterNativeButtonStyle(primary: true))
                        .disabled(!ready || busy)
                }
                .padding(16).spotterCard().padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("安排休息")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
            .task { await load() }
        }
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func weekdayButtons(_ indices: Range<Int>) -> some View {
        let labels = Array("一二三四五六日")
        return HStack(spacing: 4) {
            ForEach(indices, id: \.self) { index in
                let selected = weekdays.contains(index)
                Button {
                    if selected { weekdays.remove(index) }
                    else { weekdays.insert(index) }
                } label: {
                    Text("周" + String(labels[index]))
                        .font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SpotterChoiceStyle(selected: selected, horizontalPadding: 2))
                .disabled(!ready || busy || (weekdays.count >= 6 && !selected))
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }

    private func load() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let payload = try await api.spotterRead("/api/library", as: NativeJSON.self)
            let row = payload["rows"].array.first { $0["kind"].string == "schedule" }
            let today = Date.now
            weekdays = Set(row?["values"]["weekdays"].array.map { Int($0.number) } ?? [])
            dates = Set(row?["values"]["dates"].array.map(\.string) ?? [])
            let weekday = (Calendar(identifier: .gregorian).component(.weekday, from: today) + 5) % 7
            if addToday && !weekdays.contains(weekday) && dates.count < 180 { dates.insert(spotterDay(today)) }
            revision = row?["updated"].string
            ready = true
            message = nil
        } catch { message = error.localizedDescription }
    }

    private func save() async {
        guard ready && !busy else { return }
        busy = true
        defer { busy = false }
        do {
            try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner, "revision": revision as Any? ?? NSNull(),
                "data": ["kind": "schedule", "values": ["weekdays": weekdays.sorted(), "dates": dates.sorted()]]
            ])
            dismiss()
        } catch { message = error.localizedDescription }
    }
}

private struct NativeBodyLibrary: Decodable, Sendable {
    struct Record: Identifiable, Sendable {
        let id: String
        let day: String
        let date: Date
        let value: Double
        let updated: String
    }

    var profile: NativeJSON?
    var measurements: [String: [Record]] = [:]

    init() {}

    init(from decoder: Decoder) throws {
        let rows = try NativeJSON(from: decoder)["rows"]
        guard case .array(let items) = rows else { throw NativeAPIError.invalidResponse }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        var ids = Set<String>()
        for row in items {
            if row["kind"].string == "body-profile" {
                if profile == nil { profile = row }
                continue
            }
            guard row["kind"].string == "nutrition" else { continue }
            let entry = row["entry"]
            let id = row["id"].string
            let day = row["date"].string
            guard !id.isEmpty, let date = formatter.date(from: day), formatter.string(from: date) == day else { continue }
            let key: String
            let value: NativeJSON
            switch entry["type"].string {
            case "weight": key = "weight"; value = entry["kg"]
            case "measurement": key = entry["metric"].string; value = entry["value"]
            default: continue
            }
            guard !key.isEmpty, case .number(let reading) = value, reading.isFinite, ids.insert(id).inserted else { continue }
            measurements[key, default: []].append(Record(id: id, day: day, date: date, value: reading, updated: row["updated"].string))
        }
        for key in Array(measurements.keys) {
            measurements[key]?.sort { ($0.day, $0.updated, $0.id) < ($1.day, $1.updated, $1.id) }
        }
    }
}

@MainActor
struct NativeBodyData: View {
    private struct Metric: Identifiable {
        let id: String
        let name: String
        let unit: String
        let range: ClosedRange<Double>

        init(_ id: String, _ name: String, _ unit: String, _ range: ClosedRange<Double>) {
            self.id = id; self.name = name; self.unit = unit; self.range = range
        }
    }

    private static let metrics = [
        Metric("weight", "体重", "kg", 10...700),
        Metric("fat", "体脂率", "%", 1...75), Metric("muscle", "肌肉量", "kg", 1...200),
        Metric("fatMass", "体脂肪量", "kg", 0...350), Metric("skeletalMuscle", "骨骼肌量", "kg", 1...200),
        Metric("fatFreeMass", "去脂体重", "kg", 1...350), Metric("bodyWater", "体水分量", "kg", 1...350),
        Metric("boneMass", "骨量", "kg", 0.1...25), Metric("proteinMass", "身体蛋白质量", "kg", 0.1...150),
        Metric("bmr", "基础代谢（设备估算）", "千卡/天", 100...10_000), Metric("visceralFat", "内脏脂肪等级", "级", 0...100),
        Metric("subcutaneousFat", "皮下脂肪率", "%", 0...75), Metric("smi", "骨骼肌指数", "kg/m²", 0.1...50),
        Metric("metabolicAge", "代谢年龄（设备估算）", "岁", 1...150), Metric("waistHipRatio", "腰臀比", "", 0.2...4),
        Metric("waist", "腰围", "cm", 10...400), Metric("chest", "胸围", "cm", 10...400),
        Metric("hip", "臀围", "cm", 10...400), Metric("neck", "颈围", "cm", 5...200),
        Metric("shoulders", "肩宽", "cm", 10...200), Metric("arm", "臂围", "cm", 5...150), Metric("thigh", "大腿围", "cm", 5...200)
    ]

    let api: NativeAPI
    let owner: String
    var showsClose = false
    var onProfileSaved: @MainActor (NativeAnatomyVariant?) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var library = NativeBodyLibrary()
    @State private var loading = false
    @State private var ready = false
    @State private var busy = false
    @State private var message: String?
    @State private var selected = "weight"
    @State private var date = Date.now
    @State private var reading = ""
    @State private var editing: String?
    @State private var nextID = UUID().uuidString.lowercased()
    @State private var height = ""
    @State private var age = ""
    @State private var sex = ""

    private var metric: Metric { Self.metrics.first { $0.id == selected } ?? Self.metrics[0] }
    private var profile: NativeJSON? { library.profile }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                profileCard
                NativeAppleBodyTrends(origin: api.origin, owner: owner)
                    .id(api.origin + "\n" + owner)
                measurementCard
                if ready { trendCard.transition(.opacity.combined(with: .offset(y: 8))) }
                if let message { Text(message).font(.footnote).foregroundStyle(SpotterPalette.muted) }
                if loading && !ready { ProgressView("正在读取身体数据…") }
                if !ready && !loading && !busy {
                    Button("重新读取身体数据") { Task { await load(updateProfile: true) } }
                        .buttonStyle(.spotterPress)
                }
            }
            .padding(14)
            .animation(motion, value: ready)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("身体数据")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsClose {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Label("返回", systemImage: "chevron.left") }.disabled(busy)
                }
            }
        }
        .task { await load(updateProfile: true) }
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("身体档案").font(.headline)
            if let latest = library.measurements["weight"]?.last {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(format(latest.value, "kg")).font(.title3.weight(.bold))
                        Text("最新体重 · " + latest.day).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer()
                    if let cm = profile?["values"]["heightCm"].number, (50...280).contains(cm) {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(format(latest.value / pow(cm / 100, 2), "")).font(.title3.weight(.bold))
                            Text("BMI").font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                    }
                }
            }
            HStack(alignment: .top, spacing: 8) {
                field("身高（cm）", $height)
                field("年龄（岁）", $age, type: .numberPad)
            }
            SpotterMenuPicker("性别（用于营养估算和肌群图）", selection: $sex,
                              options: [("", "未填写"), ("male", "男"), ("female", "女")])
            Button("保存身体档案") { Task { await saveProfile() } }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(busy || !ready)
        }
        .padding(14).spotterCard()
    }

    private var measurementCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("记录身体测量").font(.headline)
            SpotterMenuPicker("测量项目", selection: $selected, options: Self.metrics.map { ($0.id, $0.name) })
            .onChange(of: selected) { _ in clearReading() }
            DatePicker("测量日期", selection: $date, in: ...max(date, .now), displayedComponents: .date)
            field(metric.unit.isEmpty ? metric.name : "\(metric.name)（\(metric.unit)）", $reading)
            HStack {
                if editing != nil {
                    Button("取消编辑", action: clearReading)
                        .buttonStyle(.spotterControl).transition(.opacity)
                }
                Button { Task { await saveReading() } } label: {
                    Text(editing == nil ? "保存测量" : "更新记录").frame(maxWidth: .infinity)
                }
                .buttonStyle(.spotterPrimaryControl)
                .disabled(busy || !ready)
            }

            .animation(motion, value: editing != nil)
        }
        .padding(14).spotterCard()
    }

    private var trendCard: some View {
        let data = library.measurements[selected] ?? []
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(metric.name + "趋势").font(.headline)
                Spacer()
                if let last = data.last { Text(format(last.value, metric.unit)).font(.subheadline.weight(.semibold)) }
            }
            if data.isEmpty { Text("暂无测量记录。").font(.footnote).foregroundStyle(SpotterPalette.muted) }
            else {
                Chart(data) { point in
                    LineMark(x: .value("日期", point.date), y: .value(metric.name, point.value))
                    if data.count <= 60 {
                        PointMark(x: .value("日期", point.date), y: .value(metric.name, point.value))
                    }
                }
                .foregroundStyle(SpotterPalette.adaptive(0x2c6b4a, 0x9cdab5))
                .frame(height: 155)
                .accessibilityLabel(metric.name + "变化曲线")
                ForEach(Array(data.suffix(30).reversed())) { record in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(format(record.value, metric.unit)).fontWeight(.semibold)
                            Text(record.day).font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                        Spacer()
                        Button("编辑") {
                            date = record.date
                            editing = record.id
                            reading = format(record.value, "")
                        }.buttonStyle(.spotterControl).disabled(busy)
                    }
                }
            }
        }
        .padding(14).spotterCard()
    }

    private func field(_ label: String, _ value: Binding<String>, type: UIKeyboardType = .decimalPad) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            TextField("", text: value).keyboardType(type).accessibilityLabel(label)
                .padding(.horizontal, 9).frame(minHeight: 40).spotterCard(radius: 9)
        }
    }

    private func format(_ value: Double, _ unit: String) -> String {
        let digits = value.formatted(.number.grouping(.never).precision(.fractionLength(0...2)))
        return unit.isEmpty ? digits : digits + " " + unit
    }

    private func numeric(_ text: String) -> Double? {
        guard let value = Double(text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")),
              value.isFinite else { return nil }
        return value
    }

    private func clearReading() {
        editing = nil
        reading = ""
        nextID = UUID().uuidString.lowercased()
    }

    private func load(updateProfile: Bool) async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let data = try await api.spotterRead("/api/library?section=body", as: NativeBodyLibrary.self)
            try Task.checkCancellation()
            library = data
            if !ready { message = nil }
            ready = true
            if updateProfile {
                let values = profile?["values"] ?? .null
                let cm = values["heightCm"].number
                height = (50...280).contains(cm) ? format(cm, "") : ""
                if let years = Int(exactly: values["age"].number), (1...130).contains(years) {
                    age = String(years)
                } else { age = "" }
                let storedSex = values["sex"].string
                sex = ["male", "female"].contains(storedSex) ? storedSex : ""
            }
        } catch is CancellationError {
            return
        } catch { message = error.localizedDescription }
    }

    private func saveProfile() async {
        guard !busy else { return }
        var values: [String: Any] = [:]
        if !height.isEmpty {
            guard let value = numeric(height), (50...280).contains(value) else { message = "请检查身高。"; return }
            values["heightCm"] = value
        }
        if !age.isEmpty {
            guard let value = Int(age), (1...130).contains(value) else { message = "请检查年龄。"; return }
            let previous = profile?["values"] ?? .null
            values["age"] = value
            values["ageAsOf"] = previous["age"].number == Double(value) && !previous["ageAsOf"].string.isEmpty
                ? previous["ageAsOf"].string : spotterDay()
        }
        let savedFigure = NativeAnatomyVariant(rawValue: sex)
        if let savedFigure { values["sex"] = savedFigure.rawValue }
        busy = true
        defer { busy = false }
        do {
            let revision = profile?["updated"].string
            try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner, "revision": revision as Any? ?? NSNull(),
                "data": ["kind": "body-profile", "values": values]
            ])
            onProfileSaved(savedFigure)
            message = "身体档案已保存到云端。"
            await load(updateProfile: true)
        } catch { message = error.localizedDescription }
    }

    private func saveReading() async {
        guard !busy, let value = numeric(reading), metric.range.contains(value) else {
            message = "请检查测量数值。"; return
        }
        let entry: [String: Any] = selected == "weight"
            ? ["type": "weight", "kg": value] : ["type": "measurement", "metric": selected, "value": value]
        busy = true
        defer { busy = false }
        do {
            try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner,
                "data": ["kind": "nutrition", "id": editing ?? nextID, "date": spotterDay(date), "entry": entry]
            ])
            clearReading()
            message = "已保存到云端。"
            await load(updateProfile: false)
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        } catch { message = error.localizedDescription }
    }
}

@MainActor
private struct NativeAppleBodyTrends: View {
    private struct Comparison: Identifiable {
        let latest: NativeHealthBodySample
        let baseline: NativeHealthBodySample?
        var id: NativeHealthMetric { latest.metric }
    }

    private static let metrics: [NativeHealthMetric] = [.bodyMass, .bodyFat, .leanBodyMass, .waist]
    let origin: String
    let owner: String

    @Environment(\.scenePhase) private var scenePhase
    @State private var window = 90
    @State private var readings: NativeHealthReadings?

    private var accessRequested: Bool {
        NativeHealthPreferences(origin: origin, owner: owner).hasRequestedNativeAccess
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Apple 健康体成分").font(.headline).accessibilityAddTraits(.isHeader)
            if !HealthKitReader.nativeDataAvailable {
                caption("此设备暂时无法读取 Apple 健康。")
            } else if !accessRequested {
                caption("在「设置 → 手表与健康」授权后，这里会显示体成分变化。")
            } else if let readings {
                let comparisons = comparisons(in: readings)
                if !readings.values.isEmpty {
                    SpotterSegments("体成分时间范围", options: [30, 90], value: $window) { "近 \($0) 天" }
                }
                if comparisons.isEmpty {
                    caption(readings.values.isEmpty
                            ? "近 90 天没有可读的体成分记录。可在「设置 → 手表与健康」检查授权。"
                            : "近 \(window) 天没有可读的体成分记录。")
                } else {
                    ForEach(comparisons) { comparison in
                        row(comparison)
                    }
                    caption(insight(for: comparisons))
                }
            } else {
                ProgressView("正在读取体成分…").font(.footnote)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14).spotterCard()
        .task(id: scenePhase) { await monitorBodyHealth() }
        .onDisappear { readings = nil }
    }

    private func startDate(days: Int, ending now: Date, calendar: Calendar) -> Date {
        calendar.date(byAdding: .day, value: 1 - days, to: calendar.startOfDay(for: now)) ?? now
    }

    private func comparisons(in readings: NativeHealthReadings) -> [Comparison] {
        let calendar = Calendar.current
        let start = startDate(days: window, ending: .now, calendar: calendar)
        return Self.metrics.compactMap { metric in
            guard let result = readings.values[metric], case let .body(samples) = result,
                  let latest = samples.last(where: { $0.date >= start }) else { return nil }
            let baseline = samples.first(where: {
                $0.date >= start && !$0.sourceID.isEmpty && $0.sourceID == latest.sourceID &&
                !calendar.isDate($0.date, inSameDayAs: latest.date)
            })
            return Comparison(latest: latest, baseline: baseline)
        }
    }

    private func row(_ comparison: Comparison) -> some View {
        let latest = comparison.latest
        return HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(latest.metric.title).font(.subheadline.weight(.semibold))
                caption([spotterDay(latest.date), latest.sourceName].filter { !$0.isEmpty }.joined(separator: " · "))
            }
            Spacer(minLength: 2)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(amount(latest.value)) \(latest.metric.symbol)").font(.subheadline.weight(.bold)).monospacedDigit()
                if let baseline = comparison.baseline {
                    let difference = ((latest.value - baseline.value) * 10).rounded() / 10
                    let unit = latest.metric == .bodyFat ? "百分点" : latest.metric.symbol
                    let baselineDay = baseline.date.formatted(.dateTime.month().day())
                    caption(difference == 0 ? "与 \(baselineDay) 持平"
                            : "较 \(baselineDay) \(difference > 0 ? "+" : "")\(amount(difference)) \(unit)")
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func caption(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(SpotterPalette.muted)
    }

    private func amount(_ value: Double) -> String {
        value.formatted(.number.grouping(.never).precision(.fractionLength(0...1)))
    }

    private func insight(for comparisons: [Comparison]) -> String {
        if !comparisons.contains(where: { $0.baseline != nil }) {
            return "同一来源在不同日期有测量后会显示变化。尽量在相近时间和条件下测量。"
        }
        if comparisons.contains(where: { $0.id == .leanBodyMass }) {
            return "去脂体重包含肌肉、水分等非脂肪成分。把连续测量与同一训练动作的重量和次数一起看。"
        }
        return "尽量在相近时间和条件下测量。体成分趋势可以和同一训练动作的重量、次数一起比较。"
    }

    private func monitorBodyHealth() async {
        guard scenePhase == .active, accessRequested, HealthKitReader.nativeDataAvailable else { return }
        let reader = HealthKitReader()
        let metrics = Set(Self.metrics)
        let updates = AsyncStream<Void>(bufferingPolicy: .bufferingNewest(1)) { continuation in
            reader.observeNativeMetrics(metrics) { continuation.yield(()) }
        }
        defer { reader.stopObservingNativeMetrics() }

        await refreshBodyHealth(using: reader, metrics: metrics)
        for await _ in updates {
            guard !Task.isCancelled else { break }
            await refreshBodyHealth(using: reader, metrics: metrics)
        }
    }

    private func refreshBodyHealth(using reader: HealthKitReader, metrics: Set<NativeHealthMetric>) async {
        let now = Date.now
        let calendar = Calendar.current
        let start = startDate(days: 90, ending: now, calendar: calendar)
        let result = try? await reader.readNativeMetrics(metrics, from: start, to: now, calendar: calendar)
        guard !Task.isCancelled else { return }
        readings = result ?? NativeHealthReadings()
    }
}
