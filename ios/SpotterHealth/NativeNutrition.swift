import AVFoundation
import Charts
import CryptoKit
import Speech
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
            let grams: Double?
            let foodId: String?
        }
        let id: String?
        let kind: String
        let date: String?
        let entry: Entry?
        let values: Values?
        let cut: [Stage]?
        let carbCycle: CarbCycle?
        let workouts: [WorkoutEnergy]?
        let sourceWorkoutId: String?
        let proteinProductId: String?
        let preference: NativeJSON?
        let targetWeightKg: Double?
        let name: String?
        let per100g: NativeNutritionFood.Facts?
    }

    struct RecentMeal: Decodable {
        let foodId: String
        let meal: String
        let grams: Double
    }

    let rows: [Row]
    var recentMeals: [RecentMeal]? = nil

    func recentServings(for meal: NutritionShortcut) -> [NativeRecentServing] {
        guard meal.isMeal, let recentMeals else { return [] }
        let personal: [NativeNutritionFood] = rows.compactMap { row in
            guard row.kind == "food", let id = row.id, let name = row.name, let facts = row.per100g else { return nil }
            return NativeNutritionFood(id: id, name: name, facts: facts)
        }
        let foods = personal + NativeNutritionFood.builtIn
        var seen: Set<String> = []
        let ranked = recentMeals.filter { $0.meal == meal.rawValue } + recentMeals
        return Array(ranked.compactMap { previous -> NativeRecentServing? in
            guard seen.insert(previous.foodId).inserted, (0.1...3000).contains(previous.grams),
                  let food = foods.first(where: { $0.id == previous.foodId }) else { return nil }
            return NativeRecentServing(food: food, grams: previous.grams)
        }.prefix(4))
    }

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

private struct NativeRecentServing: Identifiable {
    let food: NativeNutritionFood
    let grams: Double
    var id: String { food.id }
}

private struct NativeQuickMealReceipt: Equatable {
    let id: String
    let updated: String
    let name: String
    var day: String? = nil
}

private struct NativeQuickMealStatus: View {
    let api: NativeAPI
    let owner: String
    let receipt: NativeQuickMealReceipt
    let onUndo: () -> Void
    @State private var pending = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Label("已记下「\(receipt.name)」", systemImage: "checkmark.circle")
                    .font(.footnote.weight(.medium))
                Spacer(minLength: 4)
                Button("撤销") { Task { await undo() } }
                    .font(.footnote.weight(.semibold)).buttonStyle(.spotterPress).disabled(pending)
            }
            if let day = receipt.day, day != spotterDay() {
                Text(day).font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }.padding(9).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 9))
    }

    private func undo() async {
        guard !pending else { return }
        pending = true; error = nil
        defer { pending = false }
        do {
            try await api.spotterSend("/api/library", body: [
                "action": "remove", "expectedOwner": owner, "kind": "nutrition",
                "id": receipt.id, "revision": receipt.updated
            ])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            onUndo()
        } catch { self.error = error.localizedDescription }
    }
}

@MainActor
private struct NativeNutritionSummary: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
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
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("home-nutrition-summary")
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
        .lineLimit(1)
        .minimumScaleFactor(0.70)
        .accessibilityElement(children: .combine)
    }

    private func dial(_ title: String, unit: String, color: Color, value: Double, goal: Double) -> some View {
        let progress = goal > 0 ? value / goal : 0
        let dialProgress = min(max(progress, 0), 1)
        return VStack(spacing: 3) {
            ZStack {
                Circle().fill(color.opacity(0.06))
                Circle().strokeBorder(color.opacity(0.19), lineWidth: 5)
                Circle().inset(by: 2.5)
                    .trim(from: 0, to: dialProgress)
                    .stroke(color, lineWidth: 5)
                    .rotationEffect(.degrees(-90))
                    .animation(reduceMotion || systemReduceMotion ? nil : .easeOut(duration: 0.26), value: dialProgress)
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
    value.formatted(.number.precision(.fractionLength(0...1)))
}

private struct NutritionShortcuts: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.dynamicTypeSize) private var textSize
    let onSelect: (NutritionShortcut) -> Void
    let onFavorites: () -> Void

    private static let entries = NutritionShortcut.allCases.filter { $0 != .weight }
    private let buttonWidth: CGFloat = 44
    private let spacing: CGFloat = 3

    var body: some View {
        if textSize.isAccessibilitySize {
            grid
        } else {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: spacing) { buttons }
                    .frame(minWidth: buttonWidth * CGFloat(Self.entries.count + 1) + spacing * CGFloat(Self.entries.count))
                grid
            }
        }
    }

    private var grid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: buttonWidth), spacing: 4), count: 3), spacing: 4) {
            buttons
        }
    }

    @ViewBuilder private var buttons: some View {
        ForEach(Self.entries) { shortcut in
            button(shortcut.rawValue, icon: Image(shortcut.icon)) { onSelect(shortcut) }
        }
        button("常用餐", icon: Image(systemName: "star"), action: onFavorites)
    }

    private func button(_ title: String, icon: Image, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                icon.renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 18, height: 18).foregroundStyle(accent.tint)
                    .accessibilityHidden(true)
                Text(title).font(.caption2.weight(.semibold)).lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(minWidth: buttonWidth, maxWidth: .infinity, minHeight: 51)
            .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(title)
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
    @State private var quickMeal: NativeQuickMealReceipt?
    @State private var showFavoriteMeals = false
    @State private var error: String?
    @State private var reloadRevision = 0
    @Environment(\.spotterInteractionMotion) private var motion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            NativeNutritionSummary(payload: payload, date: spotterDay(), logs: logs, onOpen: onOpen)
            Divider().overlay(SpotterPalette.line)
            NutritionShortcuts(onSelect: { shortcut = $0 }, onFavorites: { showFavoriteMeals = true })
            if let quickMeal {
                NativeQuickMealStatus(api: api, owner: owner, receipt: quickMeal) { self.quickMeal = nil }
                    .id(quickMeal.id).transition(.opacity)
            }
            if let error {
                Button("重新读取今日饮食") { Task { await load() } }
                    .font(.footnote.weight(.semibold)).buttonStyle(.spotterPress).accessibilityHint(error)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 14)
        .spotterCard()
        .animation(motion, value: error != nil)
        .animation(motion, value: quickMeal?.id)
        .task(id: reloadRevision) { await load() }
        .onChange(of: phase) { phase in
            if phase == .active { reloadRevision &+= 1 }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in reloadRevision &+= 1 }
        .sheet(item: $shortcut) { selected in
            NativeNutritionEditor(api: api, owner: owner, date: spotterDay(), shortcut: selected, recent: payload.recentServings(for: selected)) {
                quickMeal = $0
            }
        }
        .sheet(isPresented: $showFavoriteMeals) {
            NativeFavoriteMeals(api: api, owner: owner, date: .now) { receipt, _ in
                quickMeal = receipt
                showFavoriteMeals = false
            }
        }
    }

    private func load() async {
        let date = spotterDay()
        do {
            let next = try await api.spotterRead("/api/library?date=" + date, as: NutritionPayload.self)
            guard date == spotterDay(), !Task.isCancelled else { return }
            payload = next
            error = nil
        } catch is CancellationError {
        } catch {
            if date == spotterDay(), !Task.isCancelled { self.error = error.localizedDescription }
        }
    }
}

private enum NutritionDestination: Identifiable {
    case entry(NutritionShortcut, NutritionPayload.Row?, NativeNutritionFood?, Double?)
    case settings, goals, cycle, recipes, recommendations, protein, stats, photo, voice, energy, copy, favorites

    var id: String {
        switch self {
        case .entry(let shortcut, let row, let food, _): return row?.id ?? food?.id ?? shortcut.rawValue
        case .settings: return "settings"
        case .goals: return "goals"
        case .cycle: return "cycle"
        case .recipes: return "recipes"
        case .recommendations: return "recommendations"
        case .protein: return "protein"
        case .stats: return "stats"
        case .photo: return "photo"
        case .voice: return "voice"
        case .energy: return "energy"
        case .copy: return "copy"
        case .favorites: return "favorites"
        }
    }
}

@MainActor
struct NativeNutritionDetail: View {
    @Environment(\.spotterAccent) private var accent
    let api: NativeAPI
    let owner: String
    var logs: [NativeWorkoutEntry]? = nil

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var date = Date.now
    @State private var payload = NutritionPayload(rows: [])
    @State private var loadedDate = ""
    @State private var loadError: String?
    @State private var mutationError: String?
    @State private var destination: NutritionDestination?
    @State private var queuedDestination: NutritionDestination?
    @State private var showDate = false
    @State private var deleting = false
    @State private var deleteCandidate: NutritionPayload.Row?
    @State private var quickMeal: NativeQuickMealReceipt?
    @State private var reloadRevision = 0

    init(api: NativeAPI, owner: String, logs: [NativeWorkoutEntry]? = nil, initialDate: Date = .now) {
        self.api = api
        self.owner = owner
        self.logs = logs
        _date = State(initialValue: initialDate)
    }

    static func clearFavoriteMeals(api: NativeAPI, owner: String) {
        NativeFavoriteMealStore(api: api, owner: owner).clear()
    }

    private var day: String { spotterDay(date) }
    private var ready: Bool { loadedDate == day && loadError == nil }
    private var rows: [NutritionPayload.Row] { payload.entries(on: day).filter { $0.entry?.type != "measurement" } }
    private var mealNow: NutritionShortcut {
        let hour = Calendar.current.component(.hour, from: .now)
        if hour < 10 { return .breakfast }
        if hour < 14 { return .lunch }
        return hour < 17 ? .snack : .dinner
    }
    private var allowsMotion: Bool { !reduceMotion && !systemReduceMotion }
    private var dateBounds: ClosedRange<Date> {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let start = calendar.date(from: DateComponents(year: 1900, month: 1, day: 1)) ?? .distantPast
        let end = calendar.date(from: DateComponents(year: 2100, month: 12, day: 31, hour: 23, minute: 59)) ?? .distantFuture
        return start...end
    }

    var body: some View {
        VStack(spacing: 12) {
            header
            nutritionScroll
                .safeAreaInset(edge: .bottom, spacing: 6) {
                    toolbar
                }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .background(SpotterPalette.background.ignoresSafeArea())
        .task(id: "\(day)/\(reloadRevision)") { await load(day) }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in reloadRevision &+= 1 }
        .sheet(item: $destination, onDismiss: openQueuedDestination) { item in
            destinationView(item)
        }
        .sheet(isPresented: $showDate) {
            NavigationStack {
                ScrollView {
                    DatePicker("选择日期", selection: $date, in: dateBounds, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .padding(16)
                }
                .navigationTitle("选择饮食日期")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton { showDate = false } } }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: day) { _ in
            showDate = false
            mutationError = nil
            deleteCandidate = nil
        }
        .confirmationDialog("删除这条记录？", isPresented: Binding(get: { deleteCandidate != nil }, set: { visible in
            if !visible { deleteCandidate = nil }
        }), presenting: deleteCandidate) { row in
            Button("删除", role: .destructive) { Task { await remove(row) } }
        }
    }

    private var nutritionScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                NativeNutritionSummary(payload: payload, date: day, logs: logs)
                    .padding(14).spotterCard(radius: 18)
                if let quickMeal {
                    NativeQuickMealStatus(api: api, owner: owner, receipt: quickMeal) { self.quickMeal = nil }
                        .id(quickMeal.id).transition(.opacity)
                }
                if let loadError {
                    Button { Task { await load(day) } } label: {
                        Label(loadError, systemImage: "arrow.clockwise")
                            .font(.footnote).multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.spotterPress)
                    .transition(.opacity)
                }
                if let mutationError { Text(mutationError).font(.footnote).foregroundStyle(.red).transition(.opacity) }
                if ready {
                    records.transition(.opacity)
                } else if loadError == nil {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 140).transition(.opacity)
                }
            }
            .animation(motion, value: ready)
            .animation(motion, value: loadError != nil)
            .animation(motion, value: mutationError != nil)
            .animation(motion, value: quickMeal?.id)
            .padding(.bottom, 4)
        }
        .clipped()
        .refreshable { await load(day) }
    }

    private var header: some View {
        SpotterGlassGroup {
            HStack(spacing: 7) {
                iconButton("arrow.left", "返回", glass: true) { dismiss() }
                Spacer(minLength: 0)
                iconButton("chevron.left", "前一天", glass: true) { move(-1) }.disabled(date <= dateBounds.lowerBound)
                Button { showDate = true } label: {
                    Text(day == spotterDay() ? "今天" : day)
                        .font(.subheadline.weight(.semibold)).monospacedDigit().lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .contentTransition(allowsMotion ? .numericText() : .identity)
                        .padding(.horizontal, 10).frame(minWidth: 58, minHeight: 44)
                        .contentShape(Capsule())
                        .spotterGlass(in: Capsule(), tint: accent.selection.opacity(0.65), interactive: allowsMotion)
                }
                .buttonStyle(.spotterGlassPress)
                .accessibilityLabel("选择饮食日期，\(day)")
                iconButton("chevron.right", "后一天", glass: true) { move(1) }.disabled(date >= dateBounds.upperBound)
                Spacer(minLength: 0)
                iconButton("slider.horizontal.3", "饮食设置", glass: true) { destination = .settings }
            }
        }
        .animation(motion, value: day)
    }

    private var shareText: String {
        let totals = payload.totals(on: day)
        let heading = ["\(day) · 饮食记录", "热量 \(nutritionNumber(totals.calories)) 千卡",
                       "蛋白质 \(nutritionNumber(totals.protein)) g · 碳水 \(nutritionNumber(totals.carbs)) g · 脂肪 \(nutritionNumber(totals.fat)) g",
                       "饮水 \(nutritionNumber(totals.water)) ml"]
        let meals = NutritionShortcut.allCases.filter(\.isMeal).compactMap { meal -> String? in
            let names = rows.filter { $0.entry?.meal == meal.rawValue }.compactMap { $0.entry?.name }
            return names.isEmpty ? nil : meal.rawValue + " · " + names.joined(separator: "、")
        }
        return (heading + meals).joined(separator: "\n")
    }

    private var records: some View {
        let dailyRows = rows
        let meals = Dictionary(grouping: dailyRows.filter { $0.entry?.type == "meal" }, by: { $0.entry?.meal ?? "" })
        return LazyVStack(alignment: .leading, spacing: 16) {
            if dailyRows.isEmpty {
                VStack(spacing: 8) {
                    Image("NutritionLunch").renderingMode(.template)
                    Text("这一天还没有记录").font(.subheadline)
                }
                .foregroundStyle(SpotterPalette.muted)
                .frame(maxWidth: .infinity, minHeight: 120)
                .transition(.opacity)
            } else {
                ForEach(NutritionShortcut.allCases.filter(\.isMeal)) { meal in
                    if let items = meals[meal.rawValue] {
                        HStack {
                            Text(meal.rawValue).font(.headline).accessibilityAddTraits(.isHeader)
                            Spacer()
                            Button { destination = .entry(meal, nil, nil, nil) } label: {
                                Label("加食物", systemImage: "plus").font(.subheadline.weight(.semibold))
                            }
                            .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.accent)
                        }
                        ForEach(items, id: \.id) { record($0, meal: meal).transition(.opacity) }
                        Divider()
                    }
                }
                ForEach(dailyRows.filter { $0.entry?.type == "water" || $0.entry?.type == "weight" }, id: \.id) { row in
                    record(row, meal: row.entry?.type == "water" ? .water : .weight).transition(.opacity)
                }
            }
        }
        .padding(14).spotterCard(radius: 18)
        .animation(motion, value: dailyRows.compactMap(\.id))
    }

    @ViewBuilder private func record(_ row: NutritionPayload.Row, meal: NutritionShortcut) -> some View {
        if let entry = row.entry {
            let name = meal.isMeal ? entry.name ?? "餐食" : (meal == .water ? "饮水" : "体重")
            HStack(spacing: 10) {
                Image(meal.isMeal ? "NutritionSnack" : meal.icon).renderingMode(.template).resizable()
                    .frame(width: 19, height: 19).frame(width: 40, height: 40)
                    .foregroundStyle(SpotterPalette.accent)
                    .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.subheadline.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                    Text(recordDetail(entry)).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    if row.sourceWorkoutId != nil {
                        Text("训练打卡同步").font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if row.sourceWorkoutId == nil {
                    HStack(spacing: 6) {
                        if meal.isMeal {
                            iconButton("pencil", "编辑 \(name)") { destination = .entry(meal, row, nil, nil) }
                        }
                        iconButton("trash", "删除 \(name)") { deleteCandidate = row }.disabled(deleting)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func recordDetail(_ entry: NutritionPayload.Row.Entry) -> String {
        func measure(_ amount: Double, _ unit: String) -> String {
            nutritionNumber(amount) + "\u{00A0}" + unit
        }
        if entry.type == "water" { return measure(entry.ml ?? 0, "ml") }
        if entry.type == "weight" { return measure(entry.kg ?? 0, "kg") }
        let values = [measure(entry.calories ?? 0, "千卡"), "蛋白质 " + measure(entry.protein ?? 0, "g"),
                      "碳水 " + measure(entry.carbs ?? 0, "g"), "脂肪 " + measure(entry.fat ?? 0, "g")]
        return ((entry.grams.map { [measure($0, "g")] } ?? []) + values).joined(separator: " · ")
    }

    private var toolbar: some View {
        NutritionShortcuts { shortcut in
            destination = .entry(shortcut, nil, nil, nil)
        } onFavorites: {
            destination = .favorites
        }
        .spotterGlassToolbar()
        .padding(.bottom, 3)
    }

    private func iconButton(_ icon: String, _ label: String, glass: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            let symbol = Image(systemName: icon).font(.system(size: 16, weight: .medium))
                .frame(width: 44, height: 44)
            Group {
                if glass {
                    symbol.spotterGlass(in: Circle(), tint: accent.selection.opacity(0.34), interactive: allowsMotion)
                } else {
                    symbol.background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(glass ? .spotterGlassPress : .spotterPress)
        .accessibilityLabel(label)
    }

    @ViewBuilder private func destinationView(_ item: NutritionDestination) -> some View {
        switch item {
        case .entry(let shortcut, let row, let food, let grams):
            NativeNutritionEditor(api: api, owner: owner, date: day, shortcut: shortcut, existing: row, food: food, grams: grams,
                                  recent: row == nil && food == nil ? payload.recentServings(for: shortcut) : []) {
                quickMeal = $0
            }
        case .settings:
            NativeNutritionSheet(title: "饮食设置") {
                Section("营养计划") {
                    settingsLink("营养目标", icon: "target", destination: .goals).disabled(!ready)
                    settingsLink("碳循环设置", icon: "calendar", destination: .cycle).disabled(!ready)
                    settingsLink("计入运动消耗", icon: "flame", destination: .energy).disabled(!ready)
                    settingsLink("智能食谱", icon: "book", destination: .recipes).disabled(!ready)
                    settingsLink("食物推荐", icon: "fork.knife", destination: .recommendations).disabled(!ready)
                }
                Section("记录方式") {
                    settingsLink("AI 识别", icon: "wand.and.stars", destination: .photo)
                    settingsLink("语音", icon: "mic", destination: .voice)
                    settingsLink("记蛋白粉", icon: "cup.and.saucer", destination: .protein)
                    settingsLink("复制往日餐食", icon: "doc.on.doc", destination: .copy)
                    settingsLink("记体重", icon: "scalemass", destination: .entry(.weight, nil, nil, nil))
                }
                Section {
                    settingsLink("统计", icon: "chart.bar.xaxis", destination: .stats)
                    ShareLink(item: shareText) { Label("分享饮食记录", systemImage: "square.and.arrow.up") }
                        .disabled(!ready || rows.isEmpty)
                }
            }
        case .goals, .cycle, .energy:
            NativeNutritionPlanning(api: api, owner: owner, day: day, payload: payload, logs: logs ?? [], destination: item)
        case .recipes, .recommendations, .voice:
            NativeNutritionIdeas(api: api, owner: owner, day: day, mealNow: mealNow,
                                 payload: payload, logs: logs ?? [], destination: item) { food, meal, grams in
                openAfterDismiss(.entry(meal, nil, food, grams))
            }
        case .protein:
            NativeNutritionProtein(api: api, owner: owner, day: day)
        case .stats:
            NativeNutritionStats(api: api, day: date)
        case .photo:
            NativeCoachView(api: api, owner: owner, compact: false, initialMeal: mealNow.rawValue, nutritionDate: day)
                .presentationDetents([.large])
        case .copy:
            NativeNutritionCopy(api: api, owner: owner, destination: date, suggestedMeal: mealNow, dateBounds: dateBounds)
        case .favorites:
            NativeFavoriteMeals(api: api, owner: owner, date: date) { receipt, recordedDate in
                date = recordedDate
                quickMeal = receipt
                destination = nil
            }
        }
    }

    private func settingsLink(_ title: String, icon: String, destination: NutritionDestination) -> some View {
        Button { openAfterDismiss(destination) } label: {
            HStack {
                Label(title, systemImage: icon)
                Spacer(minLength: 10)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            }
            .contentShape(Rectangle())
        }
    }

    private func openAfterDismiss(_ next: NutritionDestination) {
        queuedDestination = next
        destination = nil
    }

    private func openQueuedDestination() {
        guard let next = queuedDestination else { return }
        queuedDestination = nil
        destination = next
    }

    private func move(_ days: Int) {
        if let next = Calendar.current.date(byAdding: .day, value: days, to: date), dateBounds.contains(next) { date = next }
    }

    private func load(_ day: String) async {
        do {
            let next = try await api.spotterRead("/api/library?date=" + day, as: NutritionPayload.self)
            guard day == self.day, !Task.isCancelled else { return }
            payload = next
            loadedDate = day
            loadError = nil
        } catch is CancellationError {
        } catch {
            if day == self.day, !Task.isCancelled { loadError = error.localizedDescription }
        }
    }

    private func remove(_ row: NutritionPayload.Row) async {
        guard let id = row.id, row.sourceWorkoutId == nil, !deleting else { return }
        deleting = true
        mutationError = nil
        defer { deleting = false }
        do {
            try await api.spotterSend("/api/library", body: ["action": "remove", "kind": "nutrition", "id": id, "expectedOwner": owner])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        } catch { mutationError = error.localizedDescription }
    }
}

private struct NativeMealCopyItem: Identifiable {
    struct Meal: Encodable {
        let type = "meal"
        let meal: String
        let name: String
        let calories: Double
        let protein: Double
        let carbs: Double
        let fat: Double
        let grams: Double?
        let foodId: String?

        func inMeal(_ shortcut: NutritionShortcut) -> Self {
            Self(meal: shortcut.rawValue, name: name, calories: calories, protein: protein, carbs: carbs,
                 fat: fat, grams: grams, foodId: foodId)
        }
    }

    struct Record: Encodable {
        let kind = "nutrition"
        let id: String
        let date: String
        let entry: Meal
        let proteinProductId: String?
    }

    let id: String
    let meal: Meal
    let proteinProductId: String?

    init?(_ row: NutritionPayload.Row) {
        guard row.sourceWorkoutId == nil, let id = row.id, let entry = row.entry, entry.type == "meal",
              let meal = entry.meal, let name = entry.name, let calories = entry.calories,
              let protein = entry.protein, let carbs = entry.carbs, let fat = entry.fat else { return nil }
        self.id = id
        self.meal = Meal(meal: meal, name: name, calories: calories, protein: protein, carbs: carbs,
                         fat: fat, grams: entry.grams, foodId: entry.foodId)
        proteinProductId = row.proteinProductId
    }

    func record(on destination: String, as target: NutritionShortcut) -> Record {
        // Match the web copy ID when keeping the source meal. Moving it to a different meal is a separate copy.
        var key = "nutrition-copy:\(id):\(destination)"
        if target.rawValue != meal.meal { key += ":\(target.rawValue)" }
        var bytes = Array(SHA256.hash(data: Data(key.utf8)).prefix(16))
        bytes[6] = (bytes[6] & 15) | 128
        bytes[8] = (bytes[8] & 63) | 128
        let id = UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                             bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
        return Record(id: id.uuidString.lowercased(), date: destination, entry: meal.inMeal(target),
                      proteinProductId: proteinProductId)
    }
}

private struct NativeFavoriteMeal: Codable, Identifiable {
    struct Food: Codable, Identifiable {
        let id: String
        let name: String
        let calories: Double
        let protein: Double
        let carbs: Double
        let fat: Double
        let grams: Double?
        let foodId: String?
        let proteinProductId: String?

        init?(_ row: NutritionPayload.Row) {
            guard let entry = row.entry, entry.type == "meal", let id = row.id, let name = entry.name,
                  let calories = entry.calories, let protein = entry.protein, let carbs = entry.carbs, let fat = entry.fat else { return nil }
            self.id = id
            self.name = name
            self.calories = calories
            self.protein = protein
            self.carbs = carbs
            self.fat = fat
            grams = entry.grams
            foodId = entry.foodId
            proteinProductId = row.proteinProductId
        }
    }

    var id = UUID()
    let name: String
    let meal: NutritionShortcut.RawValue
    let foods: [Food]

    var defaultMeal: NutritionShortcut { NutritionShortcut(rawValue: meal) ?? .snack }
    var calories: Double { foods.reduce(0) { $0 + $1.calories } }
    var protein: Double { foods.reduce(0) { $0 + $1.protein } }

    func record(id: String, day: String, meal: NutritionShortcut, servings: Double) -> [String: Any]? {
        guard meal.isMeal, servings.isFinite, servings > 0, !foods.isEmpty, (1...100).contains(name.utf16.count) else { return nil }
        func scaled(_ value: Double) -> Double { (value * servings * 100).rounded() / 100 }
        let energy = scaled(calories)
        let macros = [scaled(protein), scaled(foods.reduce(0) { $0 + $1.carbs }), scaled(foods.reduce(0) { $0 + $1.fat })]
        guard (0...30_000).contains(energy), macros.allSatisfy({ (0...20_000).contains($0) }) else { return nil }
        var entry: [String: Any] = ["type": "meal", "name": name, "meal": meal.rawValue, "calories": energy,
                                    "protein": macros[0], "carbs": macros[1], "fat": macros[2]]
        let amounts = foods.compactMap(\.grams)
        if amounts.count == foods.count {
            let grams = scaled(amounts.reduce(0, +))
            guard (0.1...3_000).contains(grams) else { return nil }
            entry["grams"] = grams
        }
        if foods.count == 1, let foodId = foods[0].foodId { entry["foodId"] = foodId }
        var record: [String: Any] = ["kind": "nutrition", "id": id, "date": day, "entry": entry]
        if foods.count == 1, let proteinId = foods[0].proteinProductId { record["proteinProductId"] = proteinId }
        return record
    }
}

@MainActor private struct NativeFavoriteMealStore {
    let api: NativeAPI
    let owner: String

    private var url: URL? {
        let digest = SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/FavoriteMeals", isDirectory: true).appendingPathComponent(digest + ".json")
    }

    func load() throws -> [NativeFavoriteMeal] {
        guard let url else { throw CocoaError(.fileNoSuchFile) }
        do { return try JSONDecoder().decode([NativeFavoriteMeal].self, from: Data(contentsOf: url)) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { return [] }
    }

    func edit(_ change: (inout [NativeFavoriteMeal]) -> Void) throws -> [NativeFavoriteMeal] {
        guard let url else { throw CocoaError(.fileNoSuchFile) }
        var presets = try load()
        change(&presets)
        var directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.complete])
        var attributes = URLResourceValues()
        attributes.isExcludedFromBackup = true
        try directory.setResourceValues(attributes)
        try JSONEncoder().encode(presets).write(to: url, options: [.atomic, .completeFileProtection])
        return presets
    }

    func clear() {
        if let url { try? FileManager.default.removeItem(at: url) }
    }

    func log(_ preset: NativeFavoriteMeal, id: String, date: Date, meal: NutritionShortcut,
             servings: Double) async throws -> NativeQuickMealReceipt {
        let day = spotterDay(date)
        guard let record = preset.record(id: id, day: day, meal: meal, servings: servings) else { throw NativeAPIError.invalidRequest }
        let response = try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner,
                                                                       "revision": NSNull(), "data": record])
        let updated = try JSONDecoder().decode(NativeJSON.self, from: response)["updated"].string
        guard !updated.isEmpty else { throw NativeAPIError.invalidResponse }
        NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        return NativeQuickMealReceipt(id: id, updated: updated, name: preset.name, day: day)
    }
}

@MainActor private struct NativeFavoriteMeals: View {
    let api: NativeAPI
    let owner: String
    let date: Date
    let onSaved: (NativeQuickMealReceipt, Date) -> Void

    @State private var presets: [NativeFavoriteMeal] = []
    @State private var removing: NativeFavoriteMeal?
    @State private var retry: (preset: NativeFavoriteMeal, id: String)?
    @State private var busy = false
    @State private var error: String?

    private var store: NativeFavoriteMealStore { .init(api: api, owner: owner) }

    var body: some View {
        NativeNutritionSheet(title: "常用餐", busy: busy) {
            Section {
                NavigationLink {
                    NativeFavoriteMealEditor(api: api, owner: owner, date: date, save: add)
                } label: { Label("新建常用组合", systemImage: "plus.circle") }
                .disabled(busy || retry != nil)
            } footer: {
                Text("快速记餐会记入 \(spotterDay(date))。常用组合保存在这台 iPhone，新的饮食记录会自动同步。")
            }
            Section("我的常用餐") {
                if presets.isEmpty { Text("还没有常用餐").foregroundStyle(.secondary) }
                ForEach(presets) { preset in
                    VStack(alignment: .leading, spacing: 7) {
                        Text(preset.name).font(.headline)
                        Text(preset.foods.map(\.name).joined(separator: "、"))
                            .font(.footnote).foregroundStyle(SpotterPalette.muted).lineLimit(2)
                        Text("\(preset.defaultMeal.rawValue) · 一份 \(nutritionNumber(preset.calories)) 千卡 · 蛋白质 \(nutritionNumber(preset.protein)) g")
                            .font(.caption).foregroundStyle(SpotterPalette.muted)
                        HStack(spacing: 6) {
                            Button { Task { await log(preset) } } label: {
                                Label(retry?.preset.id == preset.id ? "重试记餐" : "记一份", systemImage: "plus.circle.fill")
                                    .font(.footnote.weight(.semibold))
                            }
                            .buttonStyle(.spotterControl)
                            .disabled(busy || retry.map { $0.preset.id != preset.id } == true)
                            NavigationLink {
                                NativeFavoriteMealOptions(preset: preset, store: store, date: date, onSaved: onSaved)
                            } label: {
                                Text("调整日期与份量").font(.footnote.weight(.semibold))
                            }
                            .buttonStyle(.spotterControl)
                            .disabled(busy || retry != nil)
                        }
                    }
                    .padding(.vertical, 4)
                    .swipeActions { Button("删除", role: .destructive) { removing = preset }.disabled(busy || retry != nil) }
                }
            }
            if let error { Section { Text(error).font(.footnote).foregroundStyle(.red) } }
        }
        .task {
            do { presets = try store.load() }
            catch { self.error = "暂时无法读取此设备的常用餐。" }
        }
        .confirmationDialog("删除这份常用组合？", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
                            presenting: removing) { preset in
            Button("删除", role: .destructive) {
                do { presets = try store.edit { $0.removeAll(where: { $0.id == preset.id }) }; error = nil }
                catch { self.error = "暂时无法删除常用餐。" }
            }
        }
    }

    private func add(_ preset: NativeFavoriteMeal) throws {
        presets = try store.edit { $0.insert(preset, at: 0) }
        error = nil
    }

    private func log(_ preset: NativeFavoriteMeal) async {
        guard !busy else { return }
        let id = retry?.id ?? UUID().uuidString.lowercased()
        busy = true; error = nil
        defer { busy = false }
        do {
            let receipt = try await store.log(preset, id: id, date: date, meal: preset.defaultMeal, servings: 1)
            retry = nil
            onSaved(receipt, date)
        } catch {
            retry = (preset, id)
            self.error = "\(error.localizedDescription) 请使用「重试记餐」核对这一次的结果。"
        }
    }
}

@MainActor private struct NativeFavoriteMealEditor: View {
    let api: NativeAPI
    let owner: String
    let save: (NativeFavoriteMeal) throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var name = ""
    @State private var meal = NutritionShortcut.snack
    @State private var foods: [NativeFavoriteMeal.Food] = []
    @State private var selected: Set<String> = []
    @State private var loading = true
    @State private var error: String?

    init(api: NativeAPI, owner: String, date: Date, save: @escaping (NativeFavoriteMeal) throws -> Void) {
        self.api = api
        self.owner = owner
        self.save = save
        _date = State(initialValue: date)
    }

    private var day: String { spotterDay(date) }
    private var selectedFoods: [NativeFavoriteMeal.Food] { foods.filter { selected.contains($0.id) } }
    private var suggestedName: String {
        let picked = selectedFoods
        let names = picked.prefix(2).map(\.name).joined(separator: " + ")
        let suffix = picked.count > 2 ? "等 \(picked.count) 项" : ""
        let label = String(names.prefix(44)) + suffix
        return label.utf16.count > 100 ? "常用餐 · \(picked.count) 项" : label
    }
    private var title: String {
        let typed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return typed.isEmpty ? suggestedName : typed
    }

    var body: some View {
        Form {
            Section {
                TextField(suggestedName.isEmpty ? "组合名称（选填）" : suggestedName, text: $name)
                    .accessibilityLabel("组合名称（选填）")
                SpotterMenuPicker("默认餐次", selection: $meal, options: NutritionShortcut.allCases.filter(\.isMeal).map { ($0, $0.rawValue) })
                DatePicker("选取记录日期", selection: $date, displayedComponents: .date)
            }
            Section("选入一份的食物") {
                if loading { ProgressView() }
                if !loading && foods.isEmpty && error == nil { Text("这一天没有可选的餐食。").foregroundStyle(.secondary) }
                ForEach(foods) { food in
                    let checked = selected.contains(food.id)
                    Button {
                        if checked { selected.remove(food.id) } else { selected.insert(food.id) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(food.name).foregroundStyle(SpotterPalette.ink)
                                Text("\(nutritionNumber(food.calories)) 千卡").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(checked ? SpotterPalette.accent : SpotterPalette.muted)
                                .accessibilityHidden(true)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityValue(checked ? "已选中" : "未选中")
                }
            }
            Section {
                Button("存为常用餐") {
                    let preset = NativeFavoriteMeal(name: title, meal: meal.rawValue, foods: selectedFoods)
                    guard preset.record(id: preset.id.uuidString, day: day, meal: meal, servings: 1) != nil else {
                        error = "这份组合的总重量或营养数值超出记餐范围，请减少选中的食物。"
                        return
                    }
                    do {
                        try save(preset)
                        dismiss()
                    } catch { self.error = "暂时无法保存这份组合。" }
                }.disabled(loading || selected.isEmpty || !(1...100).contains(title.utf16.count))
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .buttonStyle(.spotterPress)
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle("新建常用组合")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: day) { await load(day) }
    }

    private func load(_ requested: String) async {
        loading = true; foods = []; selected = []; error = nil
        defer { if day == requested { loading = false } }
        do {
            let response = try await api.request("/api/library?date=" + requested, method: "GET", json: nil, for: owner)
            let payload = try JSONDecoder().decode(NutritionPayload.self, from: response)
            guard day == requested, !Task.isCancelled else { return }
            foods = payload.entries(on: requested).compactMap(NativeFavoriteMeal.Food.init)
        } catch {
            guard day == requested, !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
    }
}

@MainActor private struct NativeFavoriteMealOptions: View {
    let preset: NativeFavoriteMeal
    let store: NativeFavoriteMealStore
    let onSaved: (NativeQuickMealReceipt, Date) -> Void
    @Environment(\.spotterAccent) private var accent
    @State private var date: Date
    @State private var meal: NutritionShortcut
    @State private var amount = "1"
    @State private var id = UUID().uuidString.lowercased()
    @State private var busy = false
    @State private var submitted = false
    @State private var error: String?

    init(preset: NativeFavoriteMeal, store: NativeFavoriteMealStore, date: Date, onSaved: @escaping (NativeQuickMealReceipt, Date) -> Void) {
        self.preset = preset
        self.store = store
        self.onSaved = onSaved
        _date = State(initialValue: date)
        _meal = State(initialValue: preset.defaultMeal)
    }

    var body: some View {
        let servings = nutritionValue(amount)
        let allowed = servings.map { preset.record(id: id, day: spotterDay(date), meal: meal, servings: $0) != nil } ?? false
        Form {
            Section {
                DatePicker("记入日期", selection: $date, displayedComponents: .date)
                SpotterMenuPicker("餐次", selection: $meal, options: NutritionShortcut.allCases.filter(\.isMeal).map { ($0, $0.rawValue) })
                LabeledContent("份数") {
                    HStack(spacing: 4) {
                        portionControl("减少半份", icon: "minus") {
                            amount = nutritionNumber(max(0.1, (servings ?? 1) - 0.5))
                        }.disabled((servings ?? 1) <= 0.1)
                        TextField("份数", text: $amount).keyboardType(.decimalPad)
                            .multilineTextAlignment(.center).accessibilityLabel("份数")
                            .monospacedDigit().frame(width: 46)
                        portionControl("增加半份", icon: "plus") {
                            amount = nutritionNumber((servings ?? 1) + 0.5)
                        }
                    }
                }
            }.disabled(submitted || busy)
            Section {
                if let servings, allowed {
                    Text("热量 \(nutritionNumber(preset.calories * servings)) 千卡 · 蛋白质 \(nutritionNumber(preset.protein * servings)) g")
                        .font(.footnote).foregroundStyle(.secondary)
                } else { Text("请输入可记录的份数。").font(.footnote).foregroundStyle(.secondary) }
                Button(busy ? "正在记录…" : (submitted ? "重试记餐" : "记入饮食")) {
                    if let servings { Task { await log(servings) } }
                }.disabled(!allowed || busy)
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .buttonStyle(.spotterPress)
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle(preset.name)
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(busy)
        .navigationBarBackButtonHidden(busy)
    }

    private func portionControl(_ label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                .frame(width: 36, height: 36)
                .background(accent.selection, in: Circle())
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress).accessibilityLabel(label)
    }

    private func log(_ servings: Double) async {
        guard !busy else { return }
        busy = true; submitted = true; error = nil
        defer { busy = false }
        do { onSaved(try await store.log(preset, id: id, date: date, meal: meal, servings: servings), date) }
        catch { self.error = "\(error.localizedDescription) 重试会继续使用这一次的记录。" }
    }
}

@MainActor
private struct NativeNutritionCopy: View {
    private struct Backup: Encodable {
        let format = "spotter-backup"
        let version = 1
        let training: [String] = []
        let heart: [String] = []
        let library: [NativeMealCopyItem.Record]
    }

    private struct Receipt: Decodable {
        let added: Int
        let skipped: Int
    }

    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let destination: String
    let sourceBounds: ClosedRange<Date>
    private let meals = NutritionShortcut.allCases.filter(\.isMeal)

    @State private var sourceDate: Date
    @State private var sourceMeal: NutritionShortcut
    @State private var chosenTarget: NutritionShortcut?
    @State private var items: [NativeMealCopyItem] = []
    @State private var loadedDay: String?
    @State private var omitted: Set<String> = []
    @State private var loadError: String?
    @State private var copyError: String?
    @State private var receipt: Receipt?
    @State private var copying = false

    init(api: NativeAPI, owner: String, destination: Date, suggestedMeal: NutritionShortcut, dateBounds: ClosedRange<Date>) {
        self.api = api
        self.owner = owner
        self.destination = spotterDay(destination)
        let calendar = Calendar.current
        let today = min(calendar.startOfDay(for: .now), dateBounds.upperBound)
        let targetDate = calendar.startOfDay(for: destination)
        let previous = calendar.date(byAdding: .day, value: -1, to: targetDate) ?? today
        let source = previous < dateBounds.lowerBound ? today : min(previous, today)
        sourceBounds = dateBounds.lowerBound...today
        _sourceDate = State(initialValue: source)
        _sourceMeal = State(initialValue: suggestedMeal)
    }

    private var from: String { spotterDay(sourceDate) }
    private var targetMeal: NutritionShortcut { chosenTarget ?? sourceMeal }
    private var mealItems: [NativeMealCopyItem] { items.filter { $0.meal.meal == sourceMeal.rawValue } }
    private var selected: [NativeMealCopyItem] { mealItems.filter { !omitted.contains($0.id) } }

    var body: some View {
        NativeNutritionSheet(title: "复制往日餐食", busy: copying) {
            Section("从哪里复制") {
                DatePicker("来源日期", selection: $sourceDate, in: sourceBounds, displayedComponents: .date)
                SpotterMenuPicker("来源餐次", selection: $sourceMeal,
                                  options: meals.map { ($0, $0.rawValue) })
            }
            .disabled(copying)
            Section("复制到 \(destination)") {
                SpotterMenuPicker("目标餐次", selection: Binding(get: { targetMeal }, set: { chosenTarget = $0 }),
                                  options: meals.map { ($0, $0.rawValue) })
                    .disabled(copying)
            }
            selection
            Section {
                Button { Task { await copy() } } label: {
                    if copying { ProgressView("正在复制") }
                    else { Label("复制 \(selected.count) 项到\(targetMeal.rawValue)", systemImage: "doc.on.doc") }
                }
                .font(.subheadline.weight(.semibold)).foregroundStyle(accent.tint)
                .disabled(copying || loadedDay != from || from == destination || selected.isEmpty)
                if let receipt {
                    Label(receiptText(receipt), systemImage: "checkmark.circle.fill")
                        .font(.footnote).foregroundStyle(accent.tint)
                }
                if let copyError { Text(copyError).font(.footnote).foregroundStyle(.red) }
            }
        }
        .presentationDetents([.large])
        .task(id: from) { await load(from) }
        .onChange(of: sourceMeal) { _ in omitted = []; clearFeedback() }
        .onChange(of: targetMeal) { _ in clearFeedback() }
        .animation(motion, value: loadedDay)
    }

    private var selection: some View {
        Section {
            if from == destination {
                Text("请选择另一天的餐食。")
            } else if let loadError {
                Text(loadError).font(.footnote).foregroundStyle(.red)
                Button("重试读取") { Task { await load(from) } }
            } else if loadedDay != from {
                ProgressView("正在读取餐食")
            } else if mealItems.isEmpty {
                Text("这一天的\(sourceMeal.rawValue)没有可复制的餐食。")
                    .foregroundStyle(SpotterPalette.muted)
            } else {
                ForEach(mealItems) { item in
                    Toggle(isOn: Binding(get: { !omitted.contains(item.id) }, set: { included in
                        if included { omitted.remove(item.id) } else { omitted.insert(item.id) }
                        clearFeedback()
                    })) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.meal.name).font(.subheadline.weight(.semibold))
                            let portion = item.meal.grams.map { "\(nutritionNumber($0)) g · " } ?? ""
                            Text(portion + nutritionNumber(item.meal.calories) + " 千卡")
                                .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        }
                    }
                    .disabled(copying)
                }
            }
        } header: {
            Text("选择要复制的食物")
        } footer: {
            Text("已随训练同步的蛋白粉会留在原来的记录里。")
        }
    }

    private func load(_ requested: String) async {
        guard requested == from, !Task.isCancelled else { return }
        loadedDay = nil
        loadError = nil
        items = []
        omitted = []
        clearFeedback()
        guard requested != destination else { return }
        do {
            let data = try await api.request("/api/library?date=" + requested, method: "GET", json: nil, for: owner)
            let payload = try JSONDecoder().decode(NutritionPayload.self, from: data)
            guard requested == from, !Task.isCancelled else { return }
            items = payload.entries(on: requested).compactMap(NativeMealCopyItem.init)
            loadedDay = requested
            if mealItems.isEmpty,
               let available = meals.first(where: { option in items.contains { $0.meal.meal == option.rawValue } }) {
                sourceMeal = available
            }
        } catch is CancellationError {
        } catch {
            if requested == from, !Task.isCancelled { loadError = error.localizedDescription }
        }
    }

    private func copy() async {
        guard !copying, loadedDay == from, from != destination, !selected.isEmpty else { return }
        clearFeedback()
        copying = true
        defer {
            copying = false
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        }
        let records = selected.map { $0.record(on: destination, as: targetMeal) }
        var query = URLComponents()
        query.path = "/api/data"
        query.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
        guard let path = query.string else { return }
        do {
            let data = try await api.request(path, method: "POST", json: JSONEncoder().encode(Backup(library: records)), for: owner)
            let result = try JSONDecoder().decode(Receipt.self, from: data)
            guard result.added >= 0, result.skipped >= 0, result.added + result.skipped == records.count else {
                throw NativeAPIError.invalidResponse
            }
            receipt = result
        } catch {
            copyError = "\(error.localizedDescription) 可以按原选项重试，已复制的项目会自动跳过。"
        }
    }

    private func clearFeedback() {
        receipt = nil
        copyError = nil
    }

    private func receiptText(_ receipt: Receipt) -> String {
        if receipt.added == 0 { return "所选的 \(receipt.skipped) 项已复制过。" }
        if receipt.skipped == 0 { return "已复制 \(receipt.added) 项。" }
        return "已复制 \(receipt.added) 项，跳过 \(receipt.skipped) 项已复制的食物。"
    }
}

@MainActor
private struct NativeNutritionEditor: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let date: String
    let shortcut: NutritionShortcut
    private let isEditing: Bool
    private let foodId: String?
    private let proteinProductId: String?
    private let recent: [NativeRecentServing]
    private let onQuickSave: ((NativeQuickMealReceipt) -> Void)?

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
    @State private var quickItem: NativeRecentServing?

    init(api: NativeAPI, owner: String, date: String, shortcut: NutritionShortcut,
         existing: NutritionPayload.Row? = nil, food: NativeNutritionFood? = nil, grams: Double? = nil,
         recent: [NativeRecentServing] = [], onQuickSave: ((NativeQuickMealReceipt) -> Void)? = nil) {
        self.api = api
        self.owner = owner
        self.date = date
        self.shortcut = shortcut
        self.recent = recent
        self.onQuickSave = onQuickSave
        self.proteinProductId = existing?.proteinProductId
        isEditing = existing != nil
        foodId = existing?.entry?.foodId ?? food?.id
        if let entry = existing?.entry, let existingID = existing?.id {
            _id = State(initialValue: existingID)
            _name = State(initialValue: entry.name ?? "")
            _calories = State(initialValue: nutritionInput(entry.calories ?? 0))
            _protein = State(initialValue: nutritionInput(entry.protein ?? 0))
            _carbs = State(initialValue: nutritionInput(entry.carbs ?? 0))
            _fat = State(initialValue: nutritionInput(entry.fat ?? 0))
            _quantity = State(initialValue: entry.grams.map(nutritionInput) ?? "")
        } else if let food {
            let grams = grams ?? 100
            let facts = food.facts.scaled(grams)
            _name = State(initialValue: food.name)
            _calories = State(initialValue: nutritionInput(facts.calories))
            _protein = State(initialValue: nutritionInput(facts.protein))
            _carbs = State(initialValue: nutritionInput(facts.carbs))
            _fat = State(initialValue: nutritionInput(facts.fat))
            _quantity = State(initialValue: nutritionInput(grams))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if shortcut.isMeal {
                        if !recent.isEmpty { recentFoods }
                        field("食物名称", value: $name, numeric: false)
                        field("重量（g，选填）", value: $quantity)
                        field("热量（千卡）", value: $calories)
                        field("蛋白质（g）", value: $protein)
                        field("碳水（g）", value: $carbs)
                        field("脂肪（g）", value: $fat)
                    } else if shortcut == .water {
                        field("饮水量（ml）", value: $quantity)
                        SpotterGlassSegments(options: ["150", "250", "500", "750"], value: $quantity, glass: false) { "\($0) ml" }
                            .accessibilityElement(children: .contain)
                            .accessibilityLabel("常用饮水量")
                    } else {
                        SpotterGlassSegments(options: [false, true], value: $imperialWeight, glass: false) { $0 ? "磅" : "公斤" }
                            .accessibilityElement(children: .contain)
                            .accessibilityLabel("单位")
                        field(imperialWeight ? "体重（lb）" : "体重（kg）", value: $quantity)
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red).transition(.opacity) }
                    Button {
                        Task { await save() }
                    } label: {
                        ZStack {
                            if busy { ProgressView().transition(.opacity) }
                            else { Text("保存").fontWeight(.semibold).transition(.opacity) }
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(SpotterPalette.deep)
                        .background(accent.fill, in: RoundedRectangle(cornerRadius: 9))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .disabled(busy)
                }
                .animation(motion, value: busy)
                .animation(motion, value: error != nil)
                .padding(16)
                .spotterCard()
                .padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isEditing ? "编辑食物" : (shortcut.isMeal ? "记\(shortcut.rawValue)" : shortcut.rawValue))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton(label: "取消") { dismiss() }.disabled(busy) } }
        }
        .interactiveDismissDisabled(busy)
        .presentationDetents(shortcut.isMeal ? [.large] : [.medium, .large])
        .presentationDragIndicator(.visible)
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

    private var recentFoods: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("最近记过").font(.subheadline.weight(.semibold))
            ForEach(recent) { serving in
                Button {
                    Task { await saveQuick(serving) }
                } label: {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(serving.food.name).font(.subheadline.weight(.medium))
                            Text(nutritionNumber(serving.grams) + " g · 上次份量").font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                        Spacer()
                        if busy && quickItem?.id == serving.id { ProgressView() }
                        else { Image(systemName: "plus.circle.fill").foregroundStyle(accent.tint) }
                    }
                    .frame(minHeight: 44).padding(.horizontal, 8)
                    .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 9))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress).disabled(busy || quickItem != nil && quickItem?.id != serving.id)
                .accessibilityHint("按上次份量添加到" + shortcut.rawValue)
            }
            Divider()
        }
    }

    private func saveQuick(_ serving: NativeRecentServing) async {
        guard !busy, quickItem == nil || quickItem?.id == serving.id else { return }
        quickItem = serving
        let facts = serving.food.facts.scaled(serving.grams)
        let entry: [String: Any] = ["type": "meal", "meal": shortcut.rawValue, "name": serving.food.name,
                                    "foodId": serving.id, "grams": serving.grams, "calories": facts.calories,
                                    "protein": facts.protein, "carbs": facts.carbs, "fat": facts.fat]
        await save(entry, quickName: serving.food.name)
    }

    private func number(_ value: String) -> Double? {
        nutritionValue(value)
    }

    private func save() async {
        guard let entry = entryPayload else { error = "请检查名称、数值和单位。"; return }
        guard quickItem == nil else { error = "请先重试上方所选的最近食物，或关闭后重新打开。"; return }
        await save(entry)
    }

    private func save(_ entry: [String: Any], quickName: String? = nil) async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            var item: [String: Any] = ["kind": "nutrition", "id": id, "date": date, "entry": entry]
            if let proteinProductId { item["proteinProductId"] = proteinProductId }
            var payload: [String: Any] = ["action": "save", "expectedOwner": owner, "data": item]
            if shortcut.isMeal && !isEditing { payload["revision"] = NSNull() }
            let response = try await api.spotterSend("/api/library", body: payload)
            if let quickName, let data = try? JSONDecoder().decode(NativeJSON.self, from: response), !data["updated"].string.isEmpty {
                onQuickSave?(NativeQuickMealReceipt(id: id, updated: data["updated"].string, name: quickName))
            }
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
            if let foodId { entry["foodId"] = foodId }
            return entry
        }
        guard let amount = number(quantity) else { return nil }
        if shortcut == .water { return amount > 0 && amount <= 20_000 ? ["type": "water", "ml": amount] : nil }
        let kg = imperialWeight ? amount * 0.45359237 : amount
        return (10...700).contains(kg) ? ["type": "weight", "kg": kg] : nil
    }
}

private func nutritionInput(_ value: Double) -> String {
    value.formatted(.number.grouping(.never).precision(.fractionLength(0...6)))
}

private func nutritionValue(_ text: String) -> Double? {
    guard let value = Double(text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")),
          value.isFinite else { return nil }
    return value
}

@MainActor
private struct NativeNutritionSheet<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    let title: String
    var busy = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        NavigationStack {
            Form(content: content)
                .buttonStyle(.spotterPress)
                .scrollContentBackground(.hidden)
                .background(SpotterPalette.background.ignoresSafeArea())
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { NutritionDismissButton { dismiss() }.disabled(busy) }
                }
        }
        .tint(accent.tint)
        .interactiveDismissDisabled(busy)
        .presentationDragIndicator(.visible)
    }
}

private struct NutritionDismissButton: View {
    var label = "关闭"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark").font(.subheadline.weight(.semibold))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
    }
}

private enum NutritionMetric: String, CaseIterable, Identifiable {
    case calories, protein, carbs, fat, water
    var id: Self { self }
    var title: String {
        switch self {
        case .calories: return "热量"
        case .protein: return "蛋白质"
        case .carbs: return "碳水"
        case .fat: return "脂肪"
        case .water: return "饮水"
        }
    }
    var unit: String { self == .calories ? "千卡" : self == .water ? "ml" : "g" }
    subscript(_ values: NutritionPayload.Values) -> Double {
        switch self {
        case .calories: return values.calories
        case .protein: return values.protein
        case .carbs: return values.carbs
        case .fat: return values.fat
        case .water: return values.water
        }
    }
}

@MainActor
private struct NativeNutritionPlanning: View {
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let day: String
    let payload: NutritionPayload
    let destination: NutritionDestination
    let logs: [NativeWorkoutEntry]
    static let carbKinds = ["低碳", "中碳", "高碳"]
    static let weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    @Environment(\.dismiss) private var dismiss
    @State private var fields: [NutritionMetric: String]
    @State private var carbDays: [String]
    @State private var carbGrams: [String: String]
    @State private var exerciseEnergy: [String: String]
    @State private var busy = false
    @State private var error: String?

    init(api: NativeAPI, owner: String, day: String, payload: NutritionPayload, logs: [NativeWorkoutEntry], destination: NutritionDestination) {
        self.api = api
        self.owner = owner
        self.day = day
        self.payload = payload
        self.destination = destination
        self.logs = logs.filter { $0.day == day && $0.owner == owner }
        let base = payload.rows.first { $0.kind == "targets" }?.values ?? .init()
        let saved = payload.rows.first { $0.kind == "nutrition-plan" }?.carbCycle
        _fields = State(initialValue: Dictionary(uniqueKeysWithValues: NutritionMetric.allCases.map { ($0, nutritionInput($0[base])) }))
        _carbDays = State(initialValue: saved?.days.count == 7 ? saved?.days ?? [] : Array(repeating: "中碳", count: 7))
        let defaults = ["低碳": (base.carbs * 0.8).rounded(), "中碳": base.carbs.rounded(), "高碳": (base.carbs * 1.2).rounded()]
        _carbGrams = State(initialValue: (saved?.grams ?? defaults).mapValues(nutritionInput))
        let workouts = payload.rows.first { $0.kind == "nutrition-energy" && $0.id == day }?.workouts ?? []
        _exerciseEnergy = State(initialValue: workouts.reduce(into: [:]) { $0[$1.id] = nutritionInput($1.calories) })
    }

    private var title: String {
        switch destination {
        case .cycle: return "碳循环设置"
        case .energy: return "计入运动消耗"
        default: return "营养目标"
        }
    }

    var body: some View {
        NativeNutritionSheet(title: title, busy: busy) {
            switch destination {
            case .cycle: cycleContent
            case .energy: energyContent
            default: goalsContent
            }
            if let error { Text(error).font(.footnote).foregroundStyle(.red).transition(.opacity) }
            Button(busy ? "保存中…" : "保存") { Task { await save() } }
                .foregroundStyle(SpotterPalette.accent)
                .disabled(busy || (destination.id == "energy" && logs.isEmpty))
        }
        .animation(motion, value: error != nil)
    }

    private var goalsContent: some View {
        Section("每日营养目标") {
            ForEach(NutritionMetric.allCases) { metric in
                TextField("\(metric.title)（\(metric.unit)）", text: Binding(get: { fields[metric, default: ""] }, set: { fields[metric] = $0 }))
                    .keyboardType(.decimalPad)
            }
        }
    }

    @ViewBuilder private var cycleContent: some View {
        Section("每日碳水") {
            ForEach(Self.carbKinds, id: \.self) { label in
                TextField("\(label)（g）", text: Binding(get: { carbGrams[label, default: ""] }, set: { carbGrams[label] = $0 }))
                    .keyboardType(.decimalPad)
            }
        }
        Section("每周安排") {
            ForEach(Self.weekdays.indices, id: \.self) { index in
                SpotterMenuPicker(Self.weekdays[index], selection: $carbDays[index], options: Self.carbKinds.map { ($0, $0) })
            }
        }
        if payload.rows.contains(where: { $0.kind == "nutrition-plan" && $0.carbCycle != nil }) {
            Button("停用碳循环", role: .destructive) { Task { await save(removeCycle: true) } }
                .foregroundStyle(.red).disabled(busy)
        }
    }

    private var energyContent: some View {
        Section("当天完成的训练") {
            if logs.isEmpty { Text("当天没有已完成的训练").foregroundStyle(.secondary) }
            ForEach(logs, id: \.id) { log in
                Toggle(log.title, isOn: Binding(get: { exerciseEnergy[log.id] != nil }, set: { enabled in
                    withAnimation(motion) { exerciseEnergy[log.id] = enabled ? "" : nil }
                }))
                if exerciseEnergy[log.id] != nil {
                    TextField("消耗（千卡）", text: Binding(get: { exerciseEnergy[log.id, default: ""] }, set: { exerciseEnergy[log.id] = $0 }))
                        .keyboardType(.decimalPad)
                        .transition(.opacity)
                }
            }
        }
    }

    private func planningRecord(removeCycle: Bool) -> [String: Any]? {
        var record: [String: Any] = ["kind": "nutrition-plan"]
        if let stages = payload.rows.first(where: { $0.kind == "nutrition-plan" })?.cut {
            record["cut"] = stages.map { ["date": $0.date, "calories": $0.calories] }
        }
        if !removeCycle {
            let grams = Self.carbKinds.compactMap { key in carbGrams[key].flatMap(nutritionValue) }
            guard grams.count == 3, grams.allSatisfy({ (0...1500).contains($0) }), grams[0] <= grams[1], grams[1] <= grams[2] else { return nil }
            record["carbCycle"] = ["days": carbDays, "grams": Dictionary(uniqueKeysWithValues: zip(Self.carbKinds, grams))]
        }
        return record
    }

    private func energyRecord() -> [String: Any]? {
        let chosen = logs.compactMap { log in exerciseEnergy[log.id].map { (log.id, $0) } }
        let workouts = chosen.compactMap { id, text -> [String: Any]? in
            guard let calories = nutritionValue(text), (1...5000).contains(calories) else { return nil }
            return ["id": id, "calories": calories]
        }
        guard chosen.count == workouts.count else { return nil }
        return ["kind": "nutrition-energy", "id": day, "workouts": workouts]
    }

    private func targetRecord() -> [String: Any]? {
        let chosen = NutritionMetric.allCases.compactMap { metric -> (String, Double)? in
            guard let value = fields[metric].flatMap(nutritionValue), (0...20000).contains(value) else { return nil }
            return (metric.rawValue, value)
        }
        guard chosen.count == NutritionMetric.allCases.count else { return nil }
        var record: [String: Any] = ["kind": "targets", "values": Dictionary(uniqueKeysWithValues: chosen)]
        let previous = payload.rows.first { $0.kind == "targets" }
        if let preference = previous?.preference,
           let data = try? JSONEncoder().encode(preference), let object = try? JSONSerialization.jsonObject(with: data) {
            record["preference"] = object
        }
        if let weight = previous?.targetWeightKg { record["targetWeightKg"] = weight }
        return record
    }

    private func save(removeCycle: Bool = false) async {
        guard !busy else { return }
        let record: [String: Any]?
        switch destination {
        case .cycle:
            record = planningRecord(removeCycle: removeCycle)
            if record == nil { error = "请填写 0–1500 克碳水，低碳、中碳和高碳依次递增。" }
        case .energy:
            record = energyRecord()
            if record == nil { error = "请为所选训练填写 1–5000 千卡。" }
        default:
            record = targetRecord()
            if record == nil { error = "请填写 0–20000 范围内的目标值。" }
        }
        guard let record else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": record])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

@MainActor
private struct NativeNutritionProtein: View {
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let day: String

    @Environment(\.dismiss) private var dismiss
    @State private var products: [NativeNutritionProteinServing] = []
    @State private var selection: String?
    @State private var id = UUID().uuidString.lowercased()
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var alreadyLogged = false

    private var current: NativeNutritionProteinServing? { products.first { $0.id == selection } }

    var body: some View {
        NativeNutritionSheet(title: "记录一杯蛋白粉", busy: saving) {
            Section("\(day) · 加餐") {
                if loading { ProgressView("正在读取蛋白粉仓库…") }
                else if products.count == 1, let first = products.first { serving(first) }
                else if !products.isEmpty {
                    SpotterMenuPicker("喝的是哪款？", selection: $selection,
                                      options: [(nil, "请选择")] + products.map { (Optional($0.id), $0.name) })
                    if let current { serving(current).id(current.id).transition(.opacity) }
                } else if error == nil {
                    Text("仓库暂时没有营养资料完整的配方。").foregroundStyle(.secondary)
                    NavigationLink { NativeProteinView(api: api, owner: owner) } label: { Text("打开蛋白粉仓库") }
                    Button("刷新仓库") { Task { await load() } }.foregroundStyle(SpotterPalette.accent)
                }
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
                if products.isEmpty { Button("重试") { Task { await load() } }.foregroundStyle(SpotterPalette.accent) }
            }
            if alreadyLogged {
                Text("饮食记录或训练打卡里已有这杯。").foregroundStyle(.secondary)
            }
            Button(saving ? "保存中…" : alreadyLogged ? "确实喝了另一杯，继续记" : "记录一杯") {
                Task { await save(anotherCup: alreadyLogged) }
            }
                .foregroundStyle(SpotterPalette.accent)
                .disabled(current == nil || loading || saving)
        }
        .animation(motion, value: selection)
        .animation(motion, value: loading)
        .onChange(of: selection) { _ in
            alreadyLogged = false
            id = UUID().uuidString.lowercased()
        }
        .task { await load() }
    }

    private func serving(_ product: NativeNutritionProteinServing) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(product.name).font(.headline)
            Text("粉 \(nutritionNumber(product.powderGrams)) g · \(product.mixer) \(nutritionNumber(product.cupMl)) ml")
            Text(product.facts.description)
        }
        .font(.footnote)
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let raw = try await api.request("/api/library")
            let rows = try JSONDecoder().decode(NativeJSON.self, from: raw)["rows"].array
            products = rows.first { $0["kind"].string == "protein-warehouse" }?["products"].array.compactMap(NativeNutritionProteinServing.init) ?? []
            if products.count == 1 { selection = products.first?.id }
        } catch is CancellationError {
        } catch { self.error = error.localizedDescription }
    }

    private func save(anotherCup: Bool) async {
        guard !saving, let current else { return }
        saving = true
        error = nil
        defer { saving = false }
        do {
            var request: [String: Any] = ["action": "record-saved", "expectedOwner": owner, "productId": current.id,
                                          "recordId": id, "localDate": day, "text": "我喝了蛋白粉"]
            if anotherCup { request["anotherCup"] = true }
            let data = try await api.spotterSend("/api/coach-protein", body: request)
            let receipt = try JSONDecoder().decode(NativeJSON.self, from: data)
            guard receipt["status"].string == "complete", let drink = receipt["records"].array.first else {
                error = receipt["message"].string.isEmpty ? "配方可能已更新，请刷新仓库后重试。" : receipt["message"].string
                return
            }
            if drink["alreadyRecorded"].bool {
                alreadyLogged = true
                return
            }
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

private struct NativeNutritionProteinServing: Identifiable {
    let id: String
    let name: String
    let powderGrams: Double
    let cupMl: Double
    let mixer: String
    let facts: NativeNutritionFood.Facts

    init?(product: NativeJSON) {
        let powder = product["powder"]
        guard case .object = powder, !product["id"].string.isEmpty else { return nil }
        id = product["id"].string
        let original = product["name"].string
        name = product["scoopEstimated"].bool || product["powderEstimated"].bool ? String(original.prefix(96)) + "（估算）" : original
        powderGrams = product["scoopGrams"].number
        cupMl = product["cupMl"].number
        let liquid = product["mixer"]["per100ml"]
        mixer = product["mixer"]["name"].string.isEmpty ? "水" : product["mixer"]["name"].string
        let amount: (String) -> Double = { [powderGrams, cupMl] key in
            (powder[key].number * powderGrams + liquid[key].number * cupMl).rounded() / 100
        }
        facts = .init(calories: amount("calories"), protein: amount("protein"), carbs: amount("carbs"), fat: amount("fat"))
    }

}

@MainActor
private struct NativeNutritionStats: View {
    private struct Export: Decodable { let library: [NutritionPayload.Row] }
    private struct Point: Identifiable { let id: String; let total: NutritionPayload.Values }
    let api: NativeAPI
    let day: Date
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @State private var range = 7
    @State private var metric = NutritionMetric.calories
    @State private var points: [Point] = []
    @State private var busy = true
    @State private var error: String?

    var body: some View {
        NativeNutritionSheet(title: "饮食统计") {
            Section {
                SpotterGlassSegments(options: [7, 14, 30], value: $range) { "近 \($0) 天" }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("区间")
                SpotterMenuPicker("指标", selection: $metric, options: NutritionMetric.allCases.map { ($0, $0.title) })
            }
            Section(metric.title) {
                if busy { ProgressView("正在读取…") }
                else if let error { Button(error) { Task { await load(range) } }.foregroundStyle(SpotterPalette.accent) }
                else {
                    Chart(points) { point in
                        BarMark(x: .value("日期", String(point.id.suffix(5))), y: .value(metric.title, metric[point.total]))
                            .foregroundStyle(SpotterPalette.accent)
                    }
                    .chartXAxis {
                        AxisMarks(values: points.enumerated().filter { $0.offset.isMultiple(of: range > 7 ? 5 : 2) }.map { String($0.element.id.suffix(5)) })
                    }
                    .frame(height: 175)
                    .animation(reduceMotion || systemReduceMotion ? nil : .easeInOut(duration: 0.24), value: metric)
                    let average = points.isEmpty ? 0 : points.reduce(0) { $0 + metric[$1.total] } / Double(points.count)
                    Text("每日平均 \(nutritionNumber(average)) \(metric.unit)").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .task(id: range) { await load(range) }
    }

    private func load(_ days: Int) async {
        busy = true
        error = nil
        defer { if !Task.isCancelled && range == days { busy = false } }
        let dates = (1 - days...0).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: day).map(spotterDay) }
        guard let start = dates.first, let end = dates.last else { return }
        do {
            let data = try await api.spotterRead("/api/data?scope=nutrition&from=\(start)&to=\(end)", as: Export.self)
            guard !Task.isCancelled, range == days else { return }
            let byDay = Dictionary(grouping: data.library.filter { $0.date != nil }, by: { $0.date ?? "" })
            points = dates.map { key in Point(id: key, total: NutritionPayload(rows: byDay[key] ?? []).totals(on: key)) }
        } catch is CancellationError {
        } catch { if !Task.isCancelled && range == days { self.error = "饮食统计读取失败，点此重试。" } }
    }
}

private struct NativeNutritionFood: Identifiable {
    struct Facts: Decodable {
        var calories: Double
        var protein: Double
        var carbs: Double
        var fat: Double

        var payload: [String: Double] { ["calories": calories, "protein": protein, "carbs": carbs, "fat": fat] }
        var description: String {
            "\(nutritionNumber(calories)) 千卡 · 蛋白质 \(nutritionNumber(protein)) g · 碳水 \(nutritionNumber(carbs)) g · 脂肪 \(nutritionNumber(fat)) g"
        }

        func scaled(_ grams: Double) -> Self {
            Self(calories: calories * grams / 100, protein: protein * grams / 100, carbs: carbs * grams / 100, fat: fat * grams / 100)
        }

        func adding(_ rhs: Self) -> Self {
            Self(calories: calories + rhs.calories, protein: protein + rhs.protein, carbs: carbs + rhs.carbs, fat: fat + rhs.fat)
        }

        func fit(_ remaining: Self) -> Double {
            let pairs = [(protein, remaining.protein), (carbs, remaining.carbs), (fat, remaining.fat)]
            let covered = pairs.reduce(0) { $0 + ($1.1 > 0 ? min(1, $1.0 / $1.1) : 0) }
            let overBudget = remaining.calories > 0 ? max(0, calories / remaining.calories - 1) : 0
            return covered - overBudget
        }
    }

    let id: String
    let name: String
    let aliases: [String]
    let facts: Facts

    init(id: String, name: String, aliases: [String] = [], facts: Facts) {
        self.id = id
        self.name = name
        self.aliases = aliases
        self.facts = facts
    }

    init(_ code: Int, _ name: String, _ aliases: [String], _ calories: Double, _ protein: Double, _ carbs: Double, _ fat: Double) {
        self.init(id: "fdc-\(code)", name: name, aliases: aliases, facts: Facts(calories: calories, protein: protein, carbs: carbs, fat: fat))
    }

    private static func normalize(_ name: String) -> String {
        name.folding(options: [.widthInsensitive, .diacriticInsensitive, .caseInsensitive], locale: .current)
            .filter { $0.isLetter || $0.isNumber }
    }

    func matches(_ text: String) -> Bool {
        let needle = Self.normalize(text)
        guard !needle.isEmpty else { return true }
        return ([name] + aliases).contains { candidate in
            let key = Self.normalize(candidate)
            return !key.isEmpty && (key.contains(needle) || needle.contains(key))
        }
    }
}

private struct NativeNutritionRecipe: Identifiable {
    struct Ingredient {
        let food: NativeNutritionFood
        let grams: Double
    }
    var id: String { name }
    let name: String
    let method: String
    let ingredients: [Ingredient]
    let facts: NativeNutritionFood.Facts

    init(_ name: String, _ method: String, _ amounts: [(Int, Double)]) {
        self.name = name
        self.method = method
        ingredients = amounts.compactMap { code, grams in
            NativeNutritionFood.builtIn.first { $0.id == "fdc-\(code)" }.map { Ingredient(food: $0, grams: grams) }
        }
        facts = ingredients.reduce(.init(calories: 0, protein: 0, carbs: 0, fat: 0)) { $0.adding($1.food.facts.scaled($1.grams)) }
    }
}

@MainActor
private struct NativeNutritionIdeas: View {
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let day: String
    let payload: NutritionPayload
    let logs: [NativeWorkoutEntry]
    let destination: NutritionDestination
    let openFood: (NativeNutritionFood, NutritionShortcut, Double?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var meal: NutritionShortcut
    @State private var writing = false
    @State private var error: String?
    @State private var ids: [String: [String]] = [:]
    @StateObject private var voice = NativeNutritionSpeech()

    init(api: NativeAPI, owner: String, day: String, mealNow: NutritionShortcut, payload: NutritionPayload, logs: [NativeWorkoutEntry],
         destination: NutritionDestination, openFood: @escaping (NativeNutritionFood, NutritionShortcut, Double?) -> Void) {
        self.api = api
        self.owner = owner
        self.day = day
        self.payload = payload
        self.logs = logs
        self.destination = destination
        self.openFood = openFood
        _meal = State(initialValue: mealNow)
    }

    private var remaining: NativeNutritionFood.Facts {
        let target = payload.targets(on: day, countingWorkoutIDs: Set(logs.filter { $0.day == day && $0.owner == owner }.map(\.id)))
        let consumed = payload.totals(on: day)
        return .init(calories: max(0, target.calories - consumed.calories), protein: max(0, target.protein - consumed.protein),
                     carbs: max(0, target.carbs - consumed.carbs), fat: max(0, target.fat - consumed.fat))
    }

    private var personal: [NativeNutritionFood] {
        payload.rows.compactMap { row in
            guard row.kind == "food", let id = row.id, let name = row.name, let facts = row.per100g else { return nil }
            return NativeNutritionFood(id: id, name: name, facts: facts)
        }
    }

    private var suggestions: [NativeNutritionFood] {
        let options = personal + NativeNutritionFood.builtIn
        if case .voice = destination {
            guard !voice.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
            return Array(options.filter { $0.matches(voice.text) }.prefix(15))
        }
        let budget = remaining
        return Array(options.sorted { $0.facts.fit(budget) > $1.facts.fit(budget) }.prefix(8))
    }

    private var title: String {
        switch destination {
        case .recipes: return "智能食谱"
        case .voice: return "语音记录饮食"
        default: return "食物推荐"
        }
    }

    var body: some View {
        NativeNutritionSheet(title: title, busy: writing) {
            Section {
                SpotterMenuPicker("记入餐次", selection: $meal,
                                  options: NutritionShortcut.allCases.filter(\.isMeal).map { ($0, $0.rawValue) })
                    .disabled(writing)
            }
            if case .voice = destination { voiceInput }
            if let error { Text(error).foregroundStyle(.red).transition(.opacity) }
            if case .recipes = destination { recipeList }
            else { foodList }
        }
        .animation(motion, value: error != nil)
        .onDisappear { voice.stop() }
    }

    private var voiceInput: some View {
        Section {
            TextField("例如：100 克燕麦", text: $voice.text)
            Button {
                if voice.recording { voice.stop() }
                else { Task { await voice.start() } }
            } label: {
                Label(voice.recording ? "结束录音" : "开始录音", systemImage: voice.recording ? "stop.circle.fill" : "mic")
                    .foregroundStyle(voice.recording ? .red : SpotterPalette.accent)
                    .contentTransition(.opacity)
            }
            .disabled(voice.starting)
            .animation(motion, value: voice.recording)
            if let error = voice.error { Text(error).font(.footnote).foregroundStyle(.secondary).transition(.opacity) }
        } footer: { Text("录音转成可编辑文字。选中食物并核对份量后保存。") }
    }

    private var foodList: some View {
        Section("食物") {
            ForEach(suggestions) { item in
                Button {
                    voice.stop()
                    openFood(item, meal, spokenGrams)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.name).font(.subheadline.weight(.semibold))
                            Text("每 100 g · " + item.facts.description).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "plus.circle").foregroundStyle(SpotterPalette.accent)
                    }
                    .contentShape(Rectangle())
                }
            }
            if case .voice = destination, !voice.text.isEmpty, suggestions.isEmpty {
                Text("没有找到匹配的食物，试试食物简称。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private var spokenGrams: Double? {
        guard case .voice = destination,
              let range = voice.text.range(of: #"[0-9]+(?:\.[0-9]+)?\s*(?:克|g)"#, options: .regularExpression),
              let number = nutritionValue(String(voice.text[range].dropLast())), (0.1...3000).contains(number) else { return nil }
        return number
    }

    private var recipeList: some View {
        let budget = remaining
        let recipes = NativeNutritionRecipe.builtIn.sorted { $0.facts.fit(budget) > $1.facts.fit(budget) }
        return ForEach(recipes) { recipe in
            Section(recipe.name) {
                Text(recipe.method)
                Text(recipe.ingredients.map { "\($0.food.name) \(nutritionNumber($0.grams)) g" }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary)
                Text(recipe.facts.description).font(.caption).foregroundStyle(.secondary)
                Button(writing ? "保存中…" : "记入\(meal.rawValue)") { Task { await save(recipe) } }
                    .foregroundStyle(SpotterPalette.accent).disabled(writing)
            }
        }
    }

    private func save(_ recipe: NativeNutritionRecipe) async {
        guard !writing else { return }
        writing = true
        error = nil
        defer { writing = false }
        let key = meal.rawValue + recipe.id
        let recordIDs = ids[key] ?? recipe.ingredients.map { _ in UUID().uuidString.lowercased() }
        ids[key] = recordIDs
        let records: [[String: Any]] = zip(recipe.ingredients, recordIDs).map { ingredient, id in
            var entry: [String: Any] = ["type": "meal", "meal": meal.rawValue, "name": ingredient.food.name, "foodId": ingredient.food.id, "grams": ingredient.grams]
            entry.merge(ingredient.food.facts.scaled(ingredient.grams).payload) { _, amount in amount }
            return ["kind": "nutrition", "id": id, "date": day, "entry": entry]
        }
        var query = URLComponents()
        query.path = "/api/data"
        query.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
        guard let path = query.string else { return }
        do {
            try await api.spotterSend(path, body: ["format": "spotter-backup", "version": 1, "training": [], "heart": [], "library": records])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

@MainActor
private final class NativeNutritionSpeech: ObservableObject {
    @Published var text = ""
    @Published private(set) var recording = false
    @Published private(set) var starting = false
    @Published private(set) var error: String?
    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private var recognition: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var hasTap = false
    private var generation = 0

    func start() async {
        guard !recording, !starting else { return }
        starting = true
        error = nil
        generation += 1
        let current = generation
        defer { if current == generation { starting = false } }
        let systemAuth = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard current == generation else { return }
        guard systemAuth == .authorized else { error = "请在系统设置允许语音识别，也可以在这里直接输入。"; return }
        let mic = await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
        }
        guard current == generation else { return }
        guard mic else { error = "请在系统设置允许麦克风。"; return }
        guard let recognizer, recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
            error = "设备暂时无法进行离线中文语音识别。你可以使用键盘听写或输入。"
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true)
            let bufferRequest = SFSpeechAudioBufferRecognitionRequest()
            bufferRequest.shouldReportPartialResults = true
            bufferRequest.requiresOnDeviceRecognition = true
            request = bufferRequest
            let node = engine.inputNode
            let format = node.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                stop(); error = "设备暂时无法读取麦克风。"; return
            }
            node.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in bufferRequest.append(buffer) }
            hasTap = true
            engine.prepare()
            try engine.start()
            recording = true
            recognition = recognizer.recognitionTask(with: bufferRequest) { [weak self] result, failure in
                let transcript = result?.bestTranscription.formattedString
                let finished = result?.isFinal ?? false
                let failed = failure != nil
                Task { @MainActor in
                    guard let self, self.generation == current else { return }
                    if let transcript { self.text = transcript }
                    if finished || failed { self.stop() }
                    if failed && self.text.isEmpty { self.error = "没有听清，可以再录一次。" }
                }
            }
        } catch {
            stop()
            self.error = "麦克风暂时不可用。"
        }
    }

    func stop() {
        generation += 1
        let audioWasActive = hasTap || request != nil
        if engine.isRunning { engine.stop() }
        if hasTap { engine.inputNode.removeTap(onBus: 0); hasTap = false }
        request?.endAudio(); request = nil
        recognition?.cancel(); recognition = nil
        recording = false
        starting = false
        if audioWasActive { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    }
}

private extension NativeNutritionFood {
    // Same USDA FoodData Central entries used by the Spotter web nutrition tools.
    static let builtIn: [Self] = [
        .init(173904, "原味燕麦片（干）", ["燕麦", "燕麦片", "燕麥", "燕麥片", "干燕麦", "oats", "rolled oats", "dry oats", "oatmeal", "quick oats"], 379, 13.15, 67.7, 6.52),
        .init(173424, "水煮鸡蛋", ["鸡蛋", "雞蛋", "水煮蛋", "熟鸡蛋", "egg", "eggs", "boiled egg", "hard-boiled egg"], 155, 12.58, 1.12, 10.61),
        .init(171265, "全脂牛奶", ["牛奶", "纯牛奶", "純牛奶", "全脂奶", "milk", "whole milk", "3.25% milk"], 61, 3.15, 4.8, 3.25),
        .init(170894, "原味脱脂希腊酸奶", ["希腊酸奶", "希臘酸奶", "希腊优格", "脱脂酸奶", "greek yogurt", "greek yoghurt", "nonfat greek yogurt"], 59, 10.19, 3.6, 0.39),
        .init(173944, "香蕉", ["banana", "bananas"], 89, 1.09, 22.84, 0.33),
        .init(172688, "全麦面包", ["全麥麵包", "全麦吐司", "全麦土司", "whole wheat bread", "wholemeal bread"], 252, 12.45, 42.71, 3.5),
        .init(173905, "燕麦粥（水煮）", ["熟燕麦", "燕麥粥", "煮燕麦", "cooked oats", "cooked oatmeal", "oat porridge"], 71, 2.54, 12, 1.52),
        .init(171267, "低脂牛奶（2%）", ["低脂奶", "低脂牛奶", "2% milk", "low-fat milk", "reduced fat milk"], 50, 3.3, 4.8, 1.98),
        .init(171284, "原味全脂酸奶", ["酸奶", "原味酸奶", "原味优格", "原味優格", "plain yogurt", "plain yoghurt", "yogurt"], 61, 3.47, 4.66, 3.25),
        .init(175215, "无糖豆浆", ["豆浆", "豆漿", "豆奶", "無糖豆漿", "soy milk", "soymilk", "unsweetened soy milk"], 33, 2.86, 1.74, 1.61),
        .init(171688, "苹果（带皮）", ["苹果", "蘋果", "apple", "apples"], 52, 0.26, 13.81, 0.17),
        .init(171711, "蓝莓", ["藍莓", "blueberry", "blueberries"], 57, 0.74, 14.49, 0.33),
        .init(167762, "草莓", ["strawberry", "strawberries"], 32, 0.67, 7.68, 0.3),
        .init(174924, "白面包", ["白麵包", "白吐司", "白土司", "white bread"], 266, 8.85, 49.42, 3.33),
        .init(169757, "白米饭（熟）", ["米饭", "白饭", "米飯", "白飯", "熟米饭", "white rice", "cooked rice"], 130, 2.69, 28.17, 0.28),
        .init(168484, "水煮红薯", ["红薯", "紅薯", "番薯", "地瓜", "熟红薯", "sweet potato", "boiled sweet potato"], 76, 1.37, 17.72, 0.14),
        .init(168483, "烤红薯（去皮）", ["烤番薯", "烤地瓜", "baked sweet potato"], 90, 2.01, 20.71, 0.15),
        .init(171705, "牛油果", ["鳄梨", "酪梨", "avocado", "avocados"], 160, 2, 8.53, 14.66),
        .init(172470, "原味花生酱（无盐）", ["花生酱", "花生醬", "peanut butter", "unsalted peanut butter"], 598, 22.21, 22.31, 51.36),
        .init(170567, "原味巴旦木", ["巴旦木", "扁桃仁", "杏仁", "almond", "almonds"], 579, 21.15, 21.55, 49.93),
        .init(170554, "奇亚籽", ["奇亞籽", "chia", "chia seeds"], 486, 16.54, 42.12, 30.74),
        .init(172475, "北豆腐（生）", ["北豆腐", "老豆腐", "硬豆腐", "豆腐", "tofu", "firm tofu"], 144, 17.27, 2.78, 8.72),
    ]
}

private extension NativeNutritionRecipe {
    static let builtIn: [Self] = [
        .init("蓝莓燕麦酸奶碗", "用水煮熟燕麦，放温后拌入酸奶，铺上蓝莓。", [(173904, 45), (170894, 170), (171711, 80)]),
        .init("鸡蛋牛油果全麦吐司", "烤脆吐司，将牛油果压泥抹上，铺水煮蛋片。", [(173424, 100), (171705, 45), (172688, 70)]),
        .init("豆腐红薯饭碗", "豆腐切块加热至熟透，红薯切片，和热米饭一起装碗。", [(172475, 130), (168484, 120), (169757, 100)]),
        .init("草莓香蕉酸奶杯", "水果洗净切块，和原味酸奶交替装杯。", [(167762, 80), (173944, 85), (170894, 160)]),
        .init("豆浆花生燕麦粥", "燕麦加豆浆小火煮稠，关火后拌入花生酱。", [(173904, 45), (175215, 240), (172470, 12)]),
    ]
}
