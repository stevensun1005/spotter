import SwiftUI

private enum NutritionShortcut: String, CaseIterable, Identifiable {
    case breakfast = "早餐"
    case lunch = "午餐"
    case dinner = "晚餐"
    case snack = "加餐"
    case water = "饮水"
    case weight = "记体重"

    var id: Self { self }
    var isMeal: Bool { self != .water && self != .weight }
    var icon: String {
        switch self {
        case .breakfast: return "NutritionBreakfast"
        case .lunch: return "NutritionLunch"
        case .dinner: return "NutritionDinner"
        case .snack: return "NutritionSnack"
        case .water: return "NutritionWater"
        case .weight: return "NutritionWeight"
        }
    }
}

private struct NutritionPayload: Decodable {
    struct Values: Decodable {
        var calories: Double = 0
        var protein: Double = 0
        var carbs: Double = 0
        var fat: Double = 0
        var water: Double = 0
    }

    struct Row: Decodable {
        struct Stage: Decodable {
            let date: String
            let calories: Double
        }
        struct CarbCycle: Decodable {
            let days: [String]
            let grams: [String: Double]
        }
        struct WorkoutEnergy: Decodable {
            let id: String
            let calories: Double
        }
        struct Entry: Decodable {
            let type: String
            let name: String?
            let meal: String?
            let calories: Double?
            let protein: Double?
            let carbs: Double?
            let fat: Double?
            let ml: Double?
            let kg: Double?
        }
        let id: String?
        let kind: String
        let date: String?
        let entry: Entry?
        let values: Values?
        let cut: [Stage]?
        let carbCycle: CarbCycle?
        let workouts: [WorkoutEnergy]?
    }

    let rows: [Row]

    func targets(on date: String, countingWorkoutIDs ids: Set<String>?) -> Values {
        let base = rows.first { $0.kind == "targets" }?.values ?? Values()
        let plan = rows.first { $0.kind == "nutrition-plan" }
        var target = base
        if let stage = plan?.cut?.filter({ $0.date <= date }).max(by: { $0.date < $1.date }) {
            let energy = (base.protein + base.carbs) * 4 + base.fat * 9
            let proteinShare = energy > 0 ? floor(base.protein * 400 / energy) : 25
            let carbShare = energy > 0 ? floor(base.carbs * 400 / energy) : 45
            target.calories = stage.calories
            target.protein = (stage.calories * proteinShare / 400).rounded()
            target.carbs = (stage.calories * carbShare / 400).rounded()
            target.fat = (stage.calories * (100 - proteinShare - carbShare) / 900).rounded()
        }
        if let cycle = plan?.carbCycle, cycle.days.count == 7, target.calories > 0,
           let noon = ISO8601DateFormatter().date(from: date + "T12:00:00Z") {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
            let weekday = (calendar.component(.weekday, from: noon) + 5) % 7
            if let carbs = cycle.grams[cycle.days[weekday]] {
                target.calories = max(0, target.calories + 4 * (carbs - target.carbs))
                target.carbs = carbs
            }
        }
        if target.calories > 0, let workouts = rows.first(where: { $0.kind == "nutrition-energy" && $0.id == date })?.workouts {
            target.calories += workouts.filter { ids?.contains($0.id) ?? true }.reduce(0) { $0 + $1.calories }
        }
        return target
    }

    func entries(on date: String) -> [Row] {
        rows.filter { $0.kind == "nutrition" && $0.date == date && $0.id != nil }
    }

    func totals(on date: String) -> Values {
        entries(on: date).reduce(into: Values()) { totals, row in
            guard let entry = row.entry else { return }
            if entry.type == "meal" {
                totals.calories += entry.calories ?? 0
                totals.protein += entry.protein ?? 0
                totals.carbs += entry.carbs ?? 0
                totals.fat += entry.fat ?? 0
            }
            if entry.type == "water" { totals.water += entry.ml ?? 0 }
        }
    }
}

@MainActor
private struct NativeNutritionSummary: View {
    let payload: NutritionPayload
    let date: String
    var logs: [NativeWorkoutEntry]? = nil
    var onOpen: (() -> Void)? = nil

    private typealias Values = NutritionPayload.Values
    private let nutrients: [(String, String, UInt32, KeyPath<Values, Double>)] = [
        ("蛋白质", "g", 0xbd632f, \.protein), ("碳水", "g", 0x7764c3, \.carbs),
        ("脂肪", "g", 0xbd5061, \.fat), ("饮水", "ml", 0x14868a, \.water)
    ]

    var body: some View {
        if let onOpen {
            Button(action: onOpen) {
                summary(showLink: true).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("打开饮食详情")
        } else {
            summary(showLink: false)
        }
    }

    private func summary(showLink: Bool) -> some View {
        let totals = payload.totals(on: date)
        let targets = payload.targets(on: date, countingWorkoutIDs: logs.map { Set($0.filter { $0.day == date }.map(\.id)) })
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                energy(totals.calories, goal: targets.calories)
                if showLink {
                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }
            .frame(minHeight: showLink ? 37 : nil)

            HStack(alignment: .top, spacing: 5) {
                ForEach(nutrients, id: \.0) { name, unit, color, key in
                    dial(name, unit: unit, color: SpotterPalette.color(color), value: totals[keyPath: key], goal: targets[keyPath: key])
                }
            }
        }
    }

    private func energy(_ value: Double, goal: Double) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(nutritionNumber(value)).font(.system(size: 22, weight: .bold)).monospacedDigit()
            Text(goal > 0 ? "/ \(nutritionNumber(goal)) 千卡" : "千卡")
                .font(.system(size: 13))
                .foregroundStyle(SpotterPalette.muted)
        }
    }

    private func dial(_ title: String, unit: String, color: Color, value: Double, goal: Double) -> some View {
        let progress = goal > 0 ? value / goal : 0
        return VStack(spacing: 3) {
            ZStack {
                Circle().fill(color.opacity(0.06))
                Circle().strokeBorder(color.opacity(0.19), lineWidth: 5)
                if progress > 0 {
                    Circle().inset(by: 2.5)
                        .trim(from: 0, to: min(progress, 1))
                        .stroke(color, lineWidth: 5)
                        .rotationEffect(.degrees(-90))
                }
                VStack(spacing: 1) {
                    Text(nutritionNumber(value)).font(.system(size: 16, weight: .bold)).monospacedDigit()
                    Text(goal > 0 ? "/ \(nutritionNumber(goal))" : unit)
                        .font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                }
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .padding(7)
            }
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: 81)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(title).font(.system(size: 13, weight: .semibold))
                Text(unit).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            if goal > 0 {
                Text(progress.formatted(.percent.precision(.fractionLength(0))))
                    .font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

private func nutritionNumber(_ value: Double) -> String {
    value.formatted(.number.grouping(.never).precision(.fractionLength(0...1)))
}

private struct NutritionShortcuts: View {
    let onSelect: (NutritionShortcut) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(NutritionShortcut.allCases) { shortcut in
                Button {
                    onSelect(shortcut)
                } label: {
                    VStack(spacing: 4) {
                        Image(shortcut.icon).renderingMode(.template).resizable()
                            .frame(width: 18, height: 18).foregroundStyle(SpotterPalette.muted)
                        Text(shortcut.rawValue).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                    .frame(maxWidth: .infinity, minHeight: 51)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

@MainActor
struct NativeHomeNutrition: View {
    let api: NativeAPI
    let owner: String
    var logs: [NativeWorkoutEntry]? = nil
    let onOpen: () -> Void

    @Environment(\.scenePhase) private var phase
    @State private var payload = NutritionPayload(rows: [])
    @State private var shortcut: NutritionShortcut?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            NativeNutritionSummary(payload: payload, date: spotterDay(), logs: logs, onOpen: onOpen)
            Divider().overlay(SpotterPalette.line)
            NutritionShortcuts { shortcut = $0 }
            if let error {
                Button("重新读取今日饮食") { Task { await load() } }
                    .font(.footnote.weight(.semibold)).accessibilityHint(error)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 14)
        .spotterCard()
        .task { await load() }
        .onChange(of: phase) { phase in
            if phase == .active { Task { await load() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in Task { await load() } }
        .sheet(item: $shortcut) {
            NativeNutritionEditor(api: api, owner: owner, date: spotterDay(), shortcut: $0)
        }
    }

    private func load() async {
        let date = spotterDay()
        do {
            let next = try await api.spotterRead("/api/library?date=" + date, as: NutritionPayload.self)
            guard date == spotterDay() else { return }
            payload = next
            error = nil
        } catch is CancellationError {
        } catch { self.error = error.localizedDescription }
    }
}

@MainActor
struct NativeNutritionDetail: View {
    let api: NativeAPI
    let owner: String
    var logs: [NativeWorkoutEntry]? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var date = Date.now
    @State private var payload = NutritionPayload(rows: [])
    @State private var loadedDate = ""
    @State private var error: String?
    @State private var shortcut: NutritionShortcut?
    @State private var showDate = false

    var body: some View {
        let day = spotterDay(date)
        VStack(spacing: 14) {
            HStack(spacing: 5) {
                iconButton("arrow.left", "返回") { dismiss() }
                Spacer(minLength: 1)
                iconButton("chevron.left", "前一天") { move(-1) }
                Button {
                    showDate = true
                } label: {
                    Label(day, systemImage: "calendar").font(.subheadline.weight(.semibold)).lineLimit(1)
                }
                .buttonStyle(.plain)
                iconButton("chevron.right", "后一天") { move(1) }
                Spacer(minLength: 1)
                iconButton("arrow.counterclockwise", "回到今天") { date = .now }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    NativeNutritionSummary(payload: payload, date: day, logs: logs)
                        .padding(14).spotterCard()
                    VStack(alignment: .leading, spacing: 12) {
                        Text("饮食记录").font(.headline)
                        let rows = payload.entries(on: day).compactMap { row in row.id.map { ($0, row) } }
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(SpotterPalette.muted)
                            Button("重试") { Task { await load(day) } }
                        } else if day != loadedDate {
                            ProgressView().frame(maxWidth: .infinity, minHeight: 140)
                        } else if rows.isEmpty {
                            VStack(spacing: 8) {
                                Image("NutritionLunch").renderingMode(.template)
                                Text("这天还没有饮食记录").font(.subheadline)
                            }
                            .foregroundStyle(SpotterPalette.muted)
                            .frame(maxWidth: .infinity, minHeight: 140)
                        } else {
                            ForEach(rows, id: \.0) { _, row in
                                if let entry = row.entry {
                                    switch entry.type {
                                    case "meal":
                                        LabeledContent(entry.name ?? "餐食", value: nutritionNumber(entry.calories ?? 0) + " 千卡")
                                    case "weight":
                                        LabeledContent("体重", value: nutritionNumber(entry.kg ?? 0) + " kg")
                                    case "water":
                                        LabeledContent("饮水", value: nutritionNumber(entry.ml ?? 0) + " ml")
                                    default: EmptyView()
                                    }
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14).spotterCard()
                }
            }
            NutritionShortcuts { shortcut = $0 }
                .padding(.horizontal, 6).spotterCard(radius: 13)
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .background(SpotterPalette.background.ignoresSafeArea())
        .task(id: day) { await load(day) }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in Task { await load(day) } }
        .sheet(item: $shortcut) { NativeNutritionEditor(api: api, owner: owner, date: day, shortcut: $0) }
        .sheet(isPresented: $showDate) {
            DatePicker("选择日期", selection: $date, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding(20)
                .presentationDetents([.medium, .large])
        }
    }

    private func iconButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                .frame(width: 40, height: 42).spotterCard(radius: 9)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func move(_ days: Int) {
        if let next = Calendar.current.date(byAdding: .day, value: days, to: date) { date = next }
    }

    private func load(_ day: String) async {
        do {
            let next = try await api.spotterRead("/api/library?date=" + day, as: NutritionPayload.self)
            guard day == spotterDay(date), !Task.isCancelled else { return }
            payload = next
            loadedDate = day
            error = nil
        } catch is CancellationError {
        } catch {
            if day == spotterDay(date) { self.error = error.localizedDescription }
        }
    }
}

@MainActor
private struct NativeNutritionEditor: View {
    let api: NativeAPI
    let owner: String
    let date: String
    let shortcut: NutritionShortcut

    @Environment(\.dismiss) private var dismiss
    @State private var id = UUID().uuidString.lowercased()
    @State private var name = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var quantity = ""
    @State private var imperialWeight = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if shortcut.isMeal {
                        field("食物名称", value: $name, numeric: false)
                        field("重量（g，选填）", value: $quantity)
                        field("热量（千卡）", value: $calories)
                        field("蛋白质（g）", value: $protein)
                        field("碳水（g）", value: $carbs)
                        field("脂肪（g）", value: $fat)
                    } else if shortcut == .water {
                        field("饮水量（ml）", value: $quantity)
                        HStack(spacing: 8) {
                            ForEach([250, 500, 750], id: \.self) { amount in
                                Button("\(amount) ml") { quantity = String(amount) }.buttonStyle(.bordered)
                            }
                        }
                    } else {
                        Picker("单位", selection: $imperialWeight) {
                            Text("公斤").tag(false)
                            Text("磅").tag(true)
                        }
                        .pickerStyle(.segmented)
                        field(imperialWeight ? "体重（lb）" : "体重（kg）", value: $quantity)
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                    Button {
                        Task { await save() }
                    } label: {
                        if busy { ProgressView().frame(maxWidth: .infinity).frame(height: 44) }
                        else { Text("保存").fontWeight(.semibold).frame(maxWidth: .infinity).frame(height: 44) }
                    }
                    .foregroundStyle(SpotterPalette.deep)
                    .background(SpotterPalette.lime, in: RoundedRectangle(cornerRadius: 9))
                    .buttonStyle(.plain)
                    .disabled(busy)
                }
                .padding(16)
                .spotterCard()
                .padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(shortcut.isMeal ? "记\(shortcut.rawValue)" : shortcut.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        }
        .interactiveDismissDisabled(busy)
        .presentationDetents(shortcut.isMeal ? [.large] : [.medium, .large])
    }

    private func field(_ title: String, value: Binding<String>, numeric: Bool = true) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            TextField("", text: value)
                .accessibilityLabel(title)
                .keyboardType(numeric ? .decimalPad : .default)
                .padding(.horizontal, 10)
                .frame(minHeight: 42)
                .spotterCard(radius: 9)
        }
    }

    private func number(_ value: String) -> Double? {
        guard let result = Double(value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")),
              result.isFinite else { return nil }
        return result
    }

    private func save() async {
        guard let entry = entryPayload else { error = "请检查名称、数值和单位。"; return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            var payload: [String: Any] = [
                "action": "save", "expectedOwner": owner,
                "data": ["kind": "nutrition", "id": id, "date": date, "entry": entry]
            ]
            if shortcut.isMeal { payload["revision"] = NSNull() }
            try await api.spotterSend("/api/library", body: payload)
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }

    private var entryPayload: [String: Any]? {
        if shortcut.isMeal {
            let food = name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard (1...100).contains(food.count), let energy = number(calories), (0...30_000).contains(energy),
                  let p = number(protein), let c = number(carbs), let f = number(fat),
                  [p, c, f].allSatisfy({ (0...20_000).contains($0) }) else { return nil }
            var entry: [String: Any] = ["type": "meal", "meal": shortcut.rawValue, "name": food,
                                        "calories": energy, "protein": p, "carbs": c, "fat": f]
            if !quantity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                guard let grams = number(quantity), (0.1...3_000).contains(grams) else { return nil }
                entry["grams"] = grams
            }
            return entry
        }
        guard let amount = number(quantity) else { return nil }
        if shortcut == .water { return amount > 0 && amount <= 20_000 ? ["type": "water", "ml": amount] : nil }
        let kg = imperialWeight ? amount * 0.45359237 : amount
        return (10...700).contains(kg) ? ["type": "weight", "kg": kg] : nil
    }
}
