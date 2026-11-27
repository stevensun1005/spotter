import AVFoundation
import Charts
import Combine
import CryptoKit
import Speech
import SwiftUI

enum NutritionShortcut: String, CaseIterable, Identifiable {
    case breakfast = "早餐"
    case lunch = "午餐"
    case dinner = "晚餐"
    case snack = "加餐"
    case water = "饮水"
    case weight = "记体重"

    static var suggestedMeal: Self {
        switch Calendar.current.component(.hour, from: .now) {
        case ..<10: return .breakfast
        case ..<14: return .lunch
        case ..<17: return .snack
        default: return .dinner
        }
    }

    static var suggestedMainMeal: Self {
        let meal = suggestedMeal
        return meal == .snack ? .lunch : meal
    }

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

struct NutritionPayload: Decodable {
    struct Values: Decodable, Sendable {
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
        guard meal.isMeal else { return [] }
        return recentServings(for: [meal])[meal] ?? []
    }

    func recentServingsByMeal() -> [NutritionShortcut: [NativeRecentServing]] {
        recentServings(for: NutritionShortcut.allCases.filter(\.isMeal))
    }

    private func recentServings(for meals: [NutritionShortcut]) -> [NutritionShortcut: [NativeRecentServing]] {
        guard let recentMeals, !recentMeals.isEmpty else { return [:] }
        let personal = rows.reduce(into: [String: NativeNutritionFood]()) { foods, row in
            guard row.kind == "food", let id = row.id, foods[id] == nil,
                  let name = row.name, let facts = row.per100g else { return }
            foods[id] = NativeNutritionFood(id: id, name: name, facts: facts)
        }
        return Dictionary(uniqueKeysWithValues: meals.map { meal in
            (meal, recentServings(for: meal, from: recentMeals, personal: personal))
        })
    }

    private func recentServings(for meal: NutritionShortcut, from recentMeals: [RecentMeal],
                                personal: [String: NativeNutritionFood]) -> [NativeRecentServing] {
        var servings: [NativeRecentServing] = []
        var seen: Set<String> = []
        for sameMeal in [true, false] {
            for previous in recentMeals where (previous.meal == meal.rawValue) == sameMeal {
                guard seen.insert(previous.foodId).inserted, (0.1...3000).contains(previous.grams),
                      let food = personal[previous.foodId] ?? NativeNutritionFood.builtInByID[previous.foodId] else { continue }
                servings.append(NativeRecentServing(food: food, grams: previous.grams))
                if servings.count == 4 { return servings }
            }
        }
        return servings
    }

    func targets(on date: String, countingWorkoutIDs ids: Set<String>?) -> Values {
        let base = rows.first { $0.kind == "targets" }?.values ?? Values()
        let plan = rows.first { $0.kind == "nutrition-plan" }
        var target = base
        if let stage = plan?.cut?.filter({ $0.date <= date }).max(by: { $0.date < $1.date }) {
            let energy = nutritionCalories(protein: base.protein, carbs: base.carbs, fat: base.fat)
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

private struct NativeNutritionExport: Decodable {
    let library: [NutritionPayload.Row]
}

@MainActor
final class NativeNutritionWeek: ObservableObject {
    struct Bounds: Hashable {
        let start: String
        let end: String

        init(containing date: Date) {
            let days = SpotterWeekDateStrip.dates(containing: date)
            start = spotterDay(days.first ?? date)
            end = spotterDay(days.last ?? date)
        }

        func contains(_ day: String) -> Bool { start <= day && day <= end }
    }

    private struct Snapshot {
        let payload: NutritionPayload?
        let timestamp: Date
        let failed: Bool
    }

    private struct Request {
        let id: UUID
        let task: Task<Void, Never>
    }

    private let api: NativeAPI
    private let owner: String
    @Published private var weeks: [Bounds: Snapshot] = [:]
    private var requests: [Bounds: Request] = [:]

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
    }

    func payload(containing date: Date) -> NutritionPayload? {
        snapshot(containing: spotterDay(date))?.payload
    }

    func ringDay(_ date: Date, logs: [NativeWorkoutEntry]?, dailyPayload: NutritionPayload? = nil) -> SpotterWeekDateStrip.Day {
        let day = spotterDay(date)
        let cached = snapshot(containing: day)
        guard let payload = dailyPayload ?? cached?.payload else {
            let status = cached?.failed == true ? "饮食进度暂不可用" : "正在读取饮食进度"
            return .init(date: date, accessibilityStatus: status)
        }
        let entries = payload.entries(on: day)
        if entries.contains(where: { $0.entry?.type == "meal" }) {
            let totals = payload.totals(on: day)
            let workouts = payload.rows.contains { $0.kind == "nutrition-energy" && $0.id == day }
                ? logs.map { Set($0.lazy.filter { $0.owner == self.owner && $0.day == day }.map(\.id)) }
                : nil
            let goal = payload.targets(on: day, countingWorkoutIDs: workouts).calories
            let calories = nutritionNumber(totals.calories)
            if goal > 0 {
                return .init(date: date, progress: totals.calories / goal,
                             accessibilityStatus: "\(calories) / \(nutritionNumber(goal)) 千卡", showsMarker: totals.calories <= 0)
            }
            return .init(date: date, accessibilityStatus: "\(calories) 千卡，未设置热量目标", showsMarker: true)
        }
        if entries.contains(where: { $0.entry?.type == "water" }) {
            let water = payload.totals(on: day).water
            return .init(date: date, accessibilityStatus: "已记饮水 \(nutritionNumber(water)) 毫升", showsMarker: true)
        }
        return .init(date: date, accessibilityStatus: "暂无饮食记录")
    }

    func refreshWeek(containing date: Date, force: Bool = false) async {
        guard !Task.isCancelled else { return }
        let bounds = Bounds(containing: date)
        if !force, let request = requests[bounds] {
            await request.task.value
            return
        }
        if !force, let cached = weeks[bounds], !cached.failed,
           Date.now.timeIntervalSince(cached.timestamp) < 60 { return }
        requests[bounds]?.task.cancel()
        let id = UUID()
        let task = Task { [weak self] in
            guard let self else { return }
            await self.readWeek(bounds, id: id)
        }
        requests[bounds] = Request(id: id, task: task)
        await task.value
    }

    private func snapshot(containing day: String) -> Snapshot? {
        weeks.first(where: { $0.key.contains(day) })?.value
    }

    private func readWeek(_ bounds: Bounds, id: UUID) async {
        defer { if requests[bounds]?.id == id { requests[bounds] = nil } }
        do {
            let path = "/api/data?scope=nutrition&from=\(bounds.start)&to=\(bounds.end)"
            let data = try await api.request(path, method: "GET", json: nil, for: owner)
            let rows = try JSONDecoder().decode(NativeNutritionExport.self, from: data).library
            guard !Task.isCancelled, requests[bounds]?.id == id else { return }
            cache(.init(payload: NutritionPayload(rows: rows), timestamp: .now, failed: false), for: bounds)
        } catch is CancellationError {
        } catch {
            guard !Task.isCancelled, requests[bounds]?.id == id else { return }
            if let issue = error as? NativeAPIError {
                switch issue {
                case .accountChanged: clearAccountCache()
                default: if issue.statusCode == 401 { clearAccountCache() }
                }
            }
            cache(.init(payload: weeks[bounds]?.payload, timestamp: .now, failed: true), for: bounds)
        }
    }

    private func cache(_ snapshot: Snapshot, for bounds: Bounds) {
        var next = weeks
        next[bounds] = snapshot
        if next.count > 6, let oldest = next.min(by: { $0.value.timestamp < $1.value.timestamp })?.key {
            next[oldest] = nil
        }
        weeks = next
    }

    private func clearAccountCache() {
        for request in requests.values { request.task.cancel() }
        requests.removeAll()
        weeks.removeAll()
    }
}

struct NativeRecentServing: Identifiable {
    let food: NativeNutritionFood
    let grams: Double
    var id: String { food.id }
}

extension NativeWorkoutStore {
    func readWidgetNutrition(on day: String) async throws -> SpotterWidgetSnapshot.Nutrition {
        let data = try await api.request("/api/library?date=" + day, method: "GET", json: nil, for: owner)
        let payload = try JSONDecoder().decode(NutritionPayload.self, from: data)
        let workoutIDs = widgetOverviewDay == day
            ? Set(logs.filter { $0.day == day && $0.owner == owner }.map(\.id))
            : nil
        let totals = payload.totals(on: day)
        let targets = payload.targets(on: day, countingWorkoutIDs: workoutIDs)
        let goals: SpotterWidgetSnapshot.Nutrition.Goals? =
            [targets.calories, targets.protein, targets.carbs, targets.fat].contains(where: { $0 > 0 })
                ? .init(calories: max(0, targets.calories), protein: max(0, targets.protein),
                        carbs: max(0, targets.carbs), fat: max(0, targets.fat))
                : nil
        return .init(calories: max(0, totals.calories), protein: max(0, totals.protein),
                     carbs: max(0, totals.carbs), fat: max(0, totals.fat), waterML: max(0, totals.water),
                     goals: goals, frequentMeals: NativeNutritionDetail.widgetFrequentMeals(api: api, owner: owner))
    }
}

struct NativeQuickMealReceipt: Equatable {
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
private struct NativeNutritionDailySummary: View {
    private typealias Values = NutritionPayload.Values
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    @ScaledMetric(relativeTo: .title2) private var ringSize = 132.0

    let totals: NutritionPayload.Values?
    let targets: NutritionPayload.Values?
    var onOpen: (() -> Void)? = nil
    var onCollapse: (() -> Void)? = nil

    private var goal: Double { targets?.calories ?? 0 }
    private var progress: Double { ratio(totals?.calories, goal: goal) }
    private var remaining: Double? { goal > 0 ? totals.map { goal - $0.calories } : nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            heading
            if textSize.isAccessibilitySize {
                stackedEnergy
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) {
                        remainingMetric.frame(minWidth: 64, maxWidth: .infinity)
                        calorieRing
                        waterMetric.frame(minWidth: 64, maxWidth: .infinity)
                    }
                    stackedEnergy
                }
            }
            Divider().overlay(SpotterPalette.line)
            if textSize.isAccessibilitySize {
                VStack(spacing: 10) { macros }
            } else {
                HStack(alignment: .top, spacing: 12) { macros }
            }
        }
        .padding(14)
        .spotterCard(radius: 20)
    }

    private var heading: some View {
        HStack(spacing: 4) {
            Text("饮食记录").font(.headline).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            if let onOpen {
                Button(action: onOpen) {
                    Label("明细", systemImage: "arrow.up.right")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accent.tint)
                        .labelStyle(.titleAndIcon)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("查看饮食明细")
                .accessibilityIdentifier("home-nutrition-summary")
                .nativeGuideTarget(.mainMeal)
            }
            if let onCollapse { NativeHomeNutritionCollapseButton(action: onCollapse) }
        }
    }

    private var stackedEnergy: some View {
        VStack(spacing: 12) {
            calorieRing
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    remainingMetric.frame(minWidth: 70, maxWidth: .infinity)
                    waterMetric.frame(minWidth: 70, maxWidth: .infinity)
                }
                VStack(spacing: 8) {
                    remainingMetric
                    waterMetric
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var calorieRing: some View {
        let diameter = min(ringSize, 188)
        let fill = min(progress, 1)
        let eaten = totals.map { nutritionNumber($0.calories) } ?? "—"
        let percent = progress.formatted(.percent.precision(.fractionLength(0)))
        let goalText = goal > 0 ? "/ \(nutritionNumber(goal)) 千卡" : "千卡"
        return ZStack {
            Circle().fill(accent.selection.opacity(0.40))
            Circle().strokeBorder(accent.tint.opacity(0.15), lineWidth: 9)
            if fill > 0 {
                Circle().inset(by: 4.5).trim(from: 0, to: fill)
                    .stroke(accent.tint, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            VStack(spacing: 2) {
                Text(goal > 0 ? "已摄入 · \(percent)" : "已摄入")
                    .font(.caption2.weight(.semibold)).foregroundStyle(accent.tint)
                Text(eaten).font(.title.weight(.bold).monospacedDigit())
                    .contentTransition(motion == nil ? .identity : .numericText())
                Text(goalText).font(.caption2).foregroundStyle(SpotterPalette.muted)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.65)
            .padding(14)
        }
        .frame(width: diameter, height: diameter)
        .animation(motion, value: fill)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("已摄入热量")
        .accessibilityValue(totals == nil ? "数据暂不可用" : "\(eaten) \(goalText)" + (goal > 0 ? " · \(percent)" : ""))
        .accessibilityIdentifier("nutrition-daily-calories")
    }

    private var remainingMetric: some View {
        let exceeded = (remaining ?? 0) < 0
        let amount = remaining.map { "\(nutritionNumber(abs($0))) 千卡" }
        return sideMetric(exceeded ? "超出目标" : "剩余热量", symbol: exceeded ? "exclamationmark" : "bolt",
                          value: amount ?? (totals == nil ? "—" : "未设目标"), color: accent.tint)
    }

    private var waterMetric: some View {
        let amount = totals.map { "\(nutritionNumber($0.water)) mL" }
        return sideMetric("已饮水", symbol: "drop", value: amount ?? "—", color: SpotterPalette.color(0x14868a))
    }

    private func sideMetric(_ title: String, symbol: String, value: String, color: Color) -> some View {
        VStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.caption.weight(.semibold)).foregroundStyle(color)
                .frame(width: 27, height: 27)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                .accessibilityHidden(true)
            Text(value).font(.caption.weight(.bold).monospacedDigit())
            Text(title).font(.caption2).foregroundStyle(SpotterPalette.muted)
        }
        .multilineTextAlignment(.center)
        .lineLimit(1)
        .minimumScaleFactor(0.70)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(value)
    }

    @ViewBuilder private var macros: some View {
        macro("碳水", id: "carbs", key: \.carbs, tint: 0x7764c3)
        macro("蛋白质", id: "protein", key: \.protein, tint: 0xbd632f)
        macro("脂肪", id: "fat", key: \.fat, tint: 0xbd5061)
    }

    private func macro(_ title: String, id: String, key: KeyPath<Values, Double>, tint: UInt32) -> some View {
        let intake = totals?[keyPath: key]
        let goal = targets?[keyPath: key] ?? 0
        let amount = intake.map(nutritionNumber) ?? "—"
        let value = goal > 0 ? "\(amount) / \(nutritionNumber(goal)) g" : "\(amount) g"
        let fill = min(ratio(intake, goal: goal), 1)
        let color = SpotterPalette.color(tint)
        return VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption.weight(.semibold))
            Text(value).font(.caption2.monospacedDigit()).foregroundStyle(SpotterPalette.muted)
                .lineLimit(1).minimumScaleFactor(0.72)
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.16))
                    if fill > 0 {
                        Capsule().fill(color).frame(width: geometry.size.width * CGFloat(fill))
                    }
                }
            }
            .frame(height: 5)
            .animation(motion, value: fill)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(intake == nil ? "数据暂不可用" : value)
        .accessibilityIdentifier("nutrition-daily-macro-\(id)")
    }

    private func ratio(_ value: Double?, goal: Double) -> Double {
        guard let value, value.isFinite, goal.isFinite, goal > 0 else { return 0 }
        let fraction = value / goal
        return fraction.isFinite ? max(fraction, 0) : 0
    }
}

func nutritionNumber(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...1)))
}

func nutritionCalories(protein: Double, carbs: Double, fat: Double) -> Double {
    (protein + carbs) * 4 + fat * 9
}

private struct NutritionShortcuts: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(\.spotterGuide) private var guide
    let onMainMeal: () -> Void
    let onSelect: (NutritionShortcut) -> Void
    let onFavorites: () -> Void
    let onPhoto: () -> Void

    private let buttonWidth: CGFloat = 44
    private let spacing: CGFloat = 6

    var body: some View {
        if textSize.isAccessibilitySize {
            grid
        } else {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: spacing) { buttons }
                    .frame(minWidth: buttonWidth * 5 + spacing * 4)
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
        button("记录正餐", icon: Image(systemName: "fork.knife"), guideTarget: .mainMeal) {
            onMainMeal()
            guide?.advance(.mainMeal)
        }
        button("加餐", icon: Image(systemName: "carrot")) { onSelect(.snack) }
        button("饮水", icon: Image(systemName: "drop")) { onSelect(.water) }
        button("常用餐", icon: Image(systemName: "star"), action: onFavorites)
        button("拍照记录", icon: Image(systemName: "camera"), action: onPhoto)
    }

    @ViewBuilder private func button(_ title: String, icon: Image, guideTarget: NativeGuideStep? = nil,
                                     action: @escaping () -> Void) -> some View {
        let shape = RoundedRectangle(cornerRadius: 13)
        let primary = guideTarget == .mainMeal
        let background = primary ? accent.selection : SpotterPalette.card
        let control = Button(action: action) {
            VStack(spacing: 4) {
                icon.renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 18, height: 18).foregroundStyle(accent.tint)
                    .accessibilityHidden(true)
                Text(title).font(.caption2.weight(.semibold)).lineLimit(textSize.isAccessibilitySize ? 2 : 1)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.75)
            }
            .frame(minWidth: buttonWidth, maxWidth: .infinity, minHeight: 51)
            .background(background, in: shape)
            .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
            .contentShape(shape)
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(title)
        .nativeGuideTarget(guideTarget)
        if primary {
            control.accessibilityIdentifier("nutrition-detail-log-meal")
        } else {
            control
        }
    }
}

private struct NutritionPhotoRequest: Identifiable {
    let id = UUID()
    let day: String
    let meal = NutritionShortcut.suggestedMeal
}

@MainActor
struct NativeHomeNutritionCollapseButton: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark").font(.footnote.weight(.semibold))
                .foregroundStyle(SpotterPalette.muted)
                .frame(width: 34, height: 34)
                .spotterGlass(in: Circle(), tint: accent.selection.opacity(0.34), interactive: motion != nil)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterGlassPress)
        .accessibilityLabel("收起饮食记录")
        .accessibilityIdentifier("home-nutrition-collapse")
    }
}

@MainActor
struct NativeHomeNutrition: View {
    let api: NativeAPI
    let owner: String
    var logs: [NativeWorkoutEntry]? = nil
    var date: Date = .now
    var week: NativeNutritionWeek? = nil
    var onCollapse: (() -> Void)? = nil
    let onOpen: () -> Void

    @Environment(\.scenePhase) private var phase
    @State private var payload = NutritionPayload(rows: [])
    @State private var loadedDate = ""
    @State private var error: String?
    @State private var reloadRevision = 0
    @Environment(\.spotterInteractionMotion) private var motion

    private var day: String { spotterDay(date) }

    var body: some View {
        let current = loadedDate == day ? payload : week?.payload(containing: date)
        let workoutIDs = logs.map { Set($0.lazy.filter { $0.owner == owner && $0.day == day }.map(\.id)) }
        return VStack(alignment: .leading, spacing: 14) {
            NativeNutritionDailySummary(totals: current?.totals(on: day),
                                        targets: current?.targets(on: day, countingWorkoutIDs: workoutIDs),
                                        onOpen: onOpen, onCollapse: onCollapse)
            if let error {
                Button("重新读取饮食记录") { Task { await load(day) } }
                    .font(.footnote.weight(.semibold)).buttonStyle(.spotterPress).accessibilityHint(error)
                    .transition(.opacity)
            }
        }
        .animation(motion, value: error != nil)
        .task(id: "\(day)/\(reloadRevision)") { await load(day) }
        .onChange(of: day) { _ in error = nil }
        .onChange(of: phase) { phase in
            if phase == .active { reloadRevision &+= 1 }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in reloadRevision &+= 1 }
    }

    private func load(_ requested: String) async {
        do {
            let next = try await api.spotterRead("/api/library?date=" + requested, as: NutritionPayload.self)
            guard requested == day, !Task.isCancelled else { return }
            payload = next
            loadedDate = requested
            error = nil
        } catch is CancellationError {
        } catch {
            if requested == day, !Task.isCancelled { self.error = error.localizedDescription }
        }
    }
}

private enum NutritionDestination: Identifiable {
    case logger(NutritionShortcut?)
    case entry(NutritionShortcut, NutritionPayload.Row?, NativeNutritionFood?, Double?)
    case settings, goals, cycle, recipes, recommendations, protein, stats, voice, energy, copy, favorites

    var id: String {
        switch self {
        case .logger(let meal): return "logger/" + (meal?.rawValue ?? "main")
        case .entry(let shortcut, let row, let food, _): return row?.id ?? food?.id ?? shortcut.rawValue
        case .settings: return "settings"
        case .goals: return "goals"
        case .cycle: return "cycle"
        case .recipes: return "recipes"
        case .recommendations: return "recommendations"
        case .protein: return "protein"
        case .stats: return "stats"
        case .voice: return "voice"
        case .energy: return "energy"
        case .copy: return "copy"
        case .favorites: return "favorites"
        }
    }
}

enum NativeNutritionWidgetEntry {
    case frequentMeals, water, recordMeal
}

@MainActor
struct NativeNutritionDetail: View {
    @Environment(\.spotterAccent) private var accent
    let api: NativeAPI
    let owner: String
    var logs: [NativeWorkoutEntry]? = nil
    var initialWidgetEntry: NativeNutritionWidgetEntry? = nil
    private let onDateChange: ((Date) -> Void)?
    private let ownsNutritionWeek: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterGuide) private var guide
    @StateObject private var nutritionWeek: NativeNutritionWeek
    @State private var date = Date.now
    @State private var payload = NutritionPayload(rows: [])
    @State private var loadedDate = ""
    @State private var loadError: String?
    @State private var mutationError: String?
    @State private var destination: NutritionDestination?
    @State private var queuedDestination: NutritionDestination?
    @State private var photoCapture: NutritionPhotoRequest?
    @State private var showDate = false
    @State private var deleting = false
    @State private var deleteCandidate: NutritionPayload.Row?
    @State private var quickMeal: NativeQuickMealReceipt?
    @State private var reloadRevision = 0
    @State private var didOpenWidgetEntry = false
    @State private var closesAfterGuidedMeal = false

    init(api: NativeAPI, owner: String, logs: [NativeWorkoutEntry]? = nil, initialDate: Date = .now,
         initialWidgetEntry: NativeNutritionWidgetEntry? = nil, week: NativeNutritionWeek? = nil,
         onDateChange: ((Date) -> Void)? = nil) {
        self.api = api
        self.owner = owner
        self.logs = logs
        self.initialWidgetEntry = initialWidgetEntry
        self.onDateChange = onDateChange
        self.ownsNutritionWeek = week == nil
        _nutritionWeek = StateObject(wrappedValue: week ?? NativeNutritionWeek(api: api, owner: owner))
        _date = State(initialValue: initialDate)
    }

    static func clearFavoriteMeals(api: NativeAPI, owner: String) {
        NativeFavoriteMealStore(api: api, owner: owner).clear()
        NativeFoodLocalStore(api: api, owner: owner).clear()
    }

    static func widgetFrequentMeals(api: NativeAPI, owner: String) -> [SpotterWidgetSnapshot.Nutrition.FrequentMeal] {
        let store = NativeFavoriteMealStore(api: api, owner: owner)
        guard let favorites = try? store.widgetMeals() else { return [] }
        return favorites.map { .init(id: $0.id.uuidString.lowercased(), name: $0.name) }
    }

    private var day: String { spotterDay(date) }
    private var ready: Bool { loadedDate == day && loadError == nil }
    private var rows: [NutritionPayload.Row] { payload.entries(on: day).filter { $0.entry?.type != "measurement" } }
    private var mealNow: NutritionShortcut { .suggestedMeal }
    private var weekDates: [Date] { SpotterWeekDateStrip.dates(containing: date) }
    private var dateBounds: ClosedRange<Date> {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let start = calendar.date(from: DateComponents(year: 1900, month: 1, day: 1)) ?? .distantPast
        let end = calendar.date(from: DateComponents(year: 2100, month: 12, day: 31, hour: 23, minute: 59)) ?? .distantFuture
        return start...end
    }

    var body: some View {
        let bounds = NativeNutritionWeek.Bounds(containing: date)
        return VStack(spacing: 0) {
            VStack(spacing: 6) {
                header(bounds)
                weekStrip
            }
            .padding(8)
            .spotterCard()
            .padding(.bottom, 12)
            nutritionScroll
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .background(SpotterPalette.background.ignoresSafeArea())
        .task(id: "\(day)/\(reloadRevision)") { await load(day) }
        .task(id: bounds) { await nutritionWeek.refreshWeek(containing: date) }
        .onAppear {
            guard !didOpenWidgetEntry, let initialWidgetEntry else { return }
            didOpenWidgetEntry = true
            switch initialWidgetEntry {
            case .frequentMeals: destination = .favorites
            case .water: destination = .entry(.water, nil, nil, 250)
            case .recordMeal:
                closesAfterGuidedMeal = guide?.step.presentation == .mealEditor
                destination = .logger(nil)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in
            reloadRevision &+= 1
            if ownsNutritionWeek {
                let selection = date
                Task { await nutritionWeek.refreshWeek(containing: selection, force: true) }
            }
        }
        .sheet(item: $destination, onDismiss: finishDestination) { item in
            destinationView(item)
        }
        .fullScreenCover(item: $photoCapture) { request in
            NativeNutritionPhotoCapture(api: api, owner: owner, nutritionDate: request.day, initialMeal: request.meal.rawValue)
        }
        .sheet(isPresented: $showDate) {
            SpotterWeekCalendarSheet(selection: $date, title: "选择饮食日期", bounds: dateBounds)
        }
        .onChange(of: day) { _ in
            loadError = nil
            mutationError = nil
            deleteCandidate = nil
            onDateChange?(date)
        }
        .confirmationDialog("删除这条记录？", isPresented: Binding(get: { deleteCandidate != nil }, set: { visible in
            if !visible { deleteCandidate = nil }
        }), presenting: deleteCandidate) { row in
            Button("删除", role: .destructive) { Task { await remove(row) } }
        }
    }

    private var nutritionScroll: some View {
        let current = ready ? payload : nutritionWeek.payload(containing: date)
        let workoutIDs = logs.map { Set($0.lazy.filter { $0.owner == owner && $0.day == day }.map(\.id)) }
        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                NativeNutritionDailySummary(totals: current?.totals(on: day),
                                            targets: current?.targets(on: day, countingWorkoutIDs: workoutIDs))
                mealActions
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
        .refreshable {
            let selection = date
            await load(spotterDay(selection))
            await nutritionWeek.refreshWeek(containing: selection, force: true)
        }
    }

    private func header(_ bounds: NativeNutritionWeek.Bounds) -> some View {
        HStack(spacing: 2) {
            headerButton("arrow.left", label: "返回") { dismiss() }
            Spacer(minLength: 0)
            SpotterWeekNavigation(selection: date, calendarLabel: "选择饮食日期",
                                  canGoBack: bounds.start > spotterDay(dateBounds.lowerBound),
                                  canGoForward: bounds.end < spotterDay(dateBounds.upperBound), onMove: moveWeek) {
                showDate = true
            }
            Spacer(minLength: 0)
            headerButton("slider.horizontal.3", label: "饮食设置") { destination = .settings }
        }
    }

    private func headerButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
    }

    private var weekStrip: some View {
        let bounds = dateBounds
        let days = weekDates.map { date in
            guard bounds.contains(date) else {
                return SpotterWeekDateStrip.Day(date: date, accessibilityStatus: "不可选", isEnabled: false)
            }
            return nutritionWeek.ringDay(date, logs: logs, dailyPayload: spotterDay(date) == day && ready ? payload : nil)
        }
        return SpotterWeekDateStrip(days: days, selection: date) { selected in
            if spotterDay(selected) != day { date = selected }
        }
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
                            Button { destination = .logger(meal) } label: {
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

    private var mealActions: some View {
        NutritionShortcuts(onMainMeal: { destination = .logger(nil) },
                           onSelect: { destination = $0.isMeal ? .logger($0) : .entry($0, nil, nil, nil) },
                           onFavorites: { destination = .favorites },
                           onPhoto: { photoCapture = NutritionPhotoRequest(day: day) })
    }

    private func iconButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 16, weight: .medium))
                .frame(width: 44, height: 44)
                .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
    }

    @ViewBuilder private func destinationView(_ item: NutritionDestination) -> some View {
        switch item {
        case .logger(let meal):
            NativeMealLogger(api: api, owner: owner, date: day, meal: meal, payload: payload) { receipt in
                if let receipt { quickMeal = receipt }
            }
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
            NativeNutritionStats(api: api, owner: owner, day: date)
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

    private func finishDestination() {
        if closesAfterGuidedMeal {
            if let guide, guide.step.presentation == .mealEditor { guide.skipSection(guide.step) }
            dismiss()
            return
        }
        guard let next = queuedDestination else { return }
        queuedDestination = nil
        destination = next
    }

    private func moveWeek(_ offset: Int) {
        guard let next = Calendar.current.date(byAdding: .day, value: offset * 7, to: date) else { return }
        date = min(max(next, dateBounds.lowerBound), dateBounds.upperBound)
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

struct NativeFavoriteMeal: Codable, Identifiable {
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

@MainActor struct NativeFavoriteMealStore {
    let api: NativeAPI
    let owner: String

    private var scope: String {
        SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private var widgetSelectionKey: String { "spotter.native.widget.meals." + scope }

    private var url: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/FavoriteMeals", isDirectory: true).appendingPathComponent(scope + ".json")
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
        UserDefaults.standard.removeObject(forKey: widgetSelectionKey)
        for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix(widgetAttemptPrefix) {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    func widgetMeals() throws -> [NativeFavoriteMeal] {
        let presets = try load()
        return (UserDefaults.standard.stringArray(forKey: widgetSelectionKey) ?? []).prefix(3).compactMap { id in
            presets.first { $0.id.uuidString == id }
        }
    }

    func saveWidgetMeals(_ ids: [UUID]) {
        UserDefaults.standard.set(Array(ids.prefix(3)).map(\.uuidString), forKey: widgetSelectionKey)
        NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
    }

    private var widgetAttemptPrefix: String { "spotter.native.widget.meal-attempt." + scope + "." }

    func widgetAttemptKey(id: UUID, day: String) -> String {
        widgetAttemptPrefix + day + "." + id.uuidString
    }

    func cleanOldWidgetAttempts(except day: String) {
        let currentPrefix = widgetAttemptPrefix + day + "."
        for key in UserDefaults.standard.dictionaryRepresentation().keys
            where key.hasPrefix(widgetAttemptPrefix) && !key.hasPrefix(currentPrefix) {
            UserDefaults.standard.removeObject(forKey: key)
        }
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

@MainActor
enum NativeWidgetMealAction {
    static var api: NativeAPI?
    private static var inProgress: Set<String> = []
    private static var lastSaved: [String: Date] = [:]

    static func log(mealID: String, day: String) async throws -> String {
        let now = Date.now
        guard day == spotterDay(now) else { throw SpotterWidgetMealError.outdated }
        guard let mealID = UUID(uuidString: mealID) else { throw SpotterWidgetMealError.missingMeal }
        let api = Self.api ?? NativeAPI()
        guard let profile = try await api.loadProfile() else { throw NativeAPIError.accountChanged }
        let store = NativeFavoriteMealStore(api: api, owner: profile.id)
        guard let meal = try store.widgetMeals().first(where: { $0.id == mealID }) else {
            throw SpotterWidgetMealError.missingMeal
        }
        let key = store.widgetAttemptKey(id: mealID, day: day)
        guard inProgress.insert(key).inserted else { throw SpotterWidgetMealError.inProgress }
        defer { inProgress.remove(key) }
        lastSaved = lastSaved.filter { now.timeIntervalSince($0.value) < 2 }
        if lastSaved[key] != nil { return meal.name }

        let defaults = UserDefaults.standard
        store.cleanOldWidgetAttempts(except: day)
        let id = defaults.string(forKey: key) ?? UUID().uuidString.lowercased()
        defaults.set(id, forKey: key)
        do {
            _ = try await store.log(meal, id: id, date: now, meal: meal.defaultMeal, servings: 1)
        } catch let error as NativeAPIError where error.statusCode == 409 {
            let data = try await api.request("/api/library?date=" + day, method: "GET", json: nil, for: profile.id)
            let payload = try JSONDecoder().decode(NutritionPayload.self, from: data)
            guard payload.entries(on: day).contains(where: { $0.id == id }) else { throw error }
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        }
        defaults.removeObject(forKey: key)
        lastSaved[key] = .now
        return meal.name
    }
}

@MainActor private struct NativeFavoriteMeals: View {
    let api: NativeAPI
    let owner: String
    let date: Date
    let onSaved: (NativeQuickMealReceipt, Date) -> Void

    @State private var presets: [NativeFavoriteMeal] = []
    @State private var widgetMealIDs: [UUID] = []
    @State private var removing: NativeFavoriteMeal?
    @State private var openPreset: String?
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
            Section {
                if presets.isEmpty { Text("新建常用餐后就可以添加到桌面。").foregroundStyle(.secondary) }
                ForEach(presets) { preset in
                    let pinned = widgetMealIDs.contains(preset.id)
                    Toggle(preset.name, isOn: Binding(
                        get: { widgetMealIDs.contains(preset.id) },
                        set: { selected in
                            if selected && widgetMealIDs.count < 3 {
                                widgetMealIDs.append(preset.id)
                            } else if !selected {
                                widgetMealIDs.removeAll { $0 == preset.id }
                            }
                            store.saveWidgetMeals(widgetMealIDs)
                        }
                    ))
                    .disabled(!pinned && widgetMealIDs.count >= 3)
                }
            } header: {
                Text("桌面快捷记餐 · \(widgetMealIDs.count)/3")
            } footer: {
                Text("最多选三款。从今日饮食小组件点一下，就按默认餐次记一份。")
            }
            Section {
                if presets.isEmpty { Text("还没有常用餐").foregroundStyle(.secondary) }
                ForEach(presets) { preset in
                    let row = VStack(alignment: .leading, spacing: 7) {
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
                    if #available(iOS 18.0, *) {
                        if !busy, retry == nil {
                            row.spotterSwipeToDelete(id: preset.id.uuidString, openRow: $openPreset,
                                                      accessibilityLabel: "删除 \(preset.name)") { removing = preset }
                        } else { row }
                    } else {
                        row.swipeActions(allowsFullSwipe: false) {
                            Button("删除", systemImage: "trash") { removing = preset }
                                .tint(.red)
                                .disabled(busy || retry != nil)
                        }
                        .accessibilityAction(named: Text("删除 \(preset.name)")) {
                            if !busy, retry == nil { removing = preset }
                        }
                    }
                }
            } header: {
                Text("我的常用餐")
            } footer: {
                if !presets.isEmpty {
                    Text("向左滑动一份常用餐可打开删除操作。")
                }
            }
            if let error { Section { Text(error).font(.footnote).foregroundStyle(.red) } }
        }
        .task {
            do {
                presets = try store.load()
                widgetMealIDs = try store.widgetMeals().map(\.id)
            }
            catch { self.error = "暂时无法读取此设备的常用餐。" }
        }
        .confirmationDialog("删除这份常用组合？", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
                            titleVisibility: .visible, presenting: removing) { preset in
            Button("删除", role: .destructive) {
                do {
                    presets = try store.edit { $0.removeAll(where: { $0.id == preset.id }) }
                    if widgetMealIDs.contains(preset.id) {
                        widgetMealIDs.removeAll { $0 == preset.id }
                        store.saveWidgetMeals(widgetMealIDs)
                    }
                    error = nil
                }
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
    private let isEditing: Bool
    private let foodId: String?
    private let proteinProductId: String?
    private let recent: [NativeRecentServing]
    private let onQuickSave: ((NativeQuickMealReceipt) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var shortcut: NutritionShortcut
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
         recent: [NativeRecentServing] = [],
         onQuickSave: ((NativeQuickMealReceipt) -> Void)? = nil) {
        self.api = api
        self.owner = owner
        self.date = date
        _shortcut = State(initialValue: shortcut)
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
        } else if shortcut == .water, let grams {
            _quantity = State(initialValue: nutritionInput(grams))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if shortcut.isMeal {
                        if !recent.isEmpty { recentFoods(recent) }
                        field("食物名称", value: $name, numeric: false)
                        field("重量（g，选填）", value: $quantity)
                        field("蛋白质（g）", value: $protein)
                        field("碳水（g）", value: $carbs)
                        field("脂肪（g）", value: $fat)
                        VStack(alignment: .leading, spacing: 5) {
                            field("热量（千卡）", value: $calories,
                                  placeholder: estimatedCalories.map { "\(nutritionNumber($0))（估算）" } ?? "自动估算")
                            Text("留空时按以上三项估算热量，也可以填写包装标注值。")
                                .font(.footnote)
                                .foregroundStyle(SpotterPalette.muted)
                        }
                    } else if shortcut == .water {
                        field("饮水量（ml）", value: $quantity)
                        SpotterSegments("饮水量", options: ["150", "250", "500", "750"], value: $quantity) { "\($0) ml" }
                            .accessibilityElement(children: .contain)
                            .accessibilityLabel("常用饮水量")
                    } else {
                        SpotterSegments("体重单位", options: [false, true], value: $imperialWeight) { $0 ? "磅" : "公斤" }
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
            .navigationTitle(editorTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton(label: "取消") { dismiss() }.disabled(busy) } }
        }
        .interactiveDismissDisabled(busy)
        .presentationDetents(shortcut.isMeal ? [.large] : [.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func field(_ title: String, value: Binding<String>, numeric: Bool = true, placeholder: String = "") -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            TextField(placeholder, text: value)
                .accessibilityLabel(title)
                .keyboardType(numeric ? .decimalPad : .default)
                .padding(.horizontal, 10)
                .frame(minHeight: 42)
                .spotterCard(radius: 9)
        }
    }

    private var editorTitle: String {
        if isEditing { return "编辑食物" }
        return shortcut.isMeal ? "记\(shortcut.rawValue)" : shortcut.rawValue
    }

    private func recentFoods(_ servings: [NativeRecentServing]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("最近记过").font(.subheadline.weight(.semibold))
            ForEach(servings) { serving in
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
                .buttonStyle(.spotterPress)
                .disabled(busy || quickItem != nil && quickItem?.id != serving.id)
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

    private var mealMacros: (protein: Double, carbs: Double, fat: Double)? {
        guard let p = number(protein), let c = number(carbs), let f = number(fat),
              [p, c, f].allSatisfy({ (0...20_000).contains($0) }) else { return nil }
        return (p, c, f)
    }

    private var estimatedCalories: Double? {
        mealMacros.map { nutritionCalories(protein: $0.protein, carbs: $0.carbs, fat: $0.fat) }
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
            let energy = calories.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? estimatedCalories : number(calories)
            guard (1...100).contains(food.count), let energy, (0...30_000).contains(energy), let macros = mealMacros else { return nil }
            var entry: [String: Any] = ["type": "meal", "meal": shortcut.rawValue, "name": food,
                                        "calories": energy, "protein": macros.protein, "carbs": macros.carbs, "fat": macros.fat]
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

func nutritionInput(_ value: Double) -> String {
    value.formatted(.number.grouping(.never).precision(.fractionLength(0...6)))
}

func nutritionValue(_ text: String) -> Double? {
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

struct NutritionDismissButton: View {
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
    private struct Point: Identifiable, Sendable { let id: String; let total: NutritionPayload.Values }
    private struct Snapshot {
        let owner: String
        let day: String
        let points: [Point]
        let loadedAt: Date
    }

    let api: NativeAPI
    let owner: String
    let day: Date
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var range = 7
    @State private var metric = NutritionMetric.calories
    @State private var snapshot: Snapshot?
    @State private var refreshRevision = 0
    @State private var busy = true
    @State private var error: String?

    private var loadKey: String { "\(owner)/\(spotterDay(day))/\(refreshRevision)" }

    private var pointsForRange: [Point]? {
        guard let snapshot, snapshot.owner == owner, snapshot.day == spotterDay(day) else { return nil }
        return Array(snapshot.points.suffix(range))
    }

    var body: some View {
        let request = loadKey
        NativeNutritionSheet(title: "饮食统计") {
            Section {
                SpotterSegments("统计区间", options: [7, 14, 30], value: $range) { "近 \($0) 天" }
                SpotterMenuPicker("指标", selection: $metric, options: NutritionMetric.allCases.map { ($0, $0.title) })
            }
            Section(metric.title) {
                if let points = pointsForRange { chart(points) }
                if busy {
                    ProgressView(pointsForRange == nil ? "正在读取…" : "正在更新…")
                } else if let error {
                    Button(error) { refreshRevision &+= 1 }.foregroundStyle(SpotterPalette.accent)
                }
            }
        }
        .task(id: request) { await load(request) }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in refreshRevision &+= 1 }
        .onChange(of: scenePhase) { phase in
            guard phase == .active, !busy else { return }
            if let snapshot, Date.now.timeIntervalSince(snapshot.loadedAt) < 60 { return }
            refreshRevision &+= 1
        }
    }

    @ViewBuilder private func chart(_ points: [Point]) -> some View {
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

    private func load(_ request: String) async {
        guard !Task.isCancelled, request == loadKey else { return }
        busy = true
        error = nil
        defer { if !Task.isCancelled && request == loadKey { busy = false } }
        let dates = (-29...0).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: day).map(spotterDay) }
        guard let start = dates.first, let end = dates.last else { return }
        do {
            let path = "/api/data?scope=nutrition&from=\(start)&to=\(end)"
            let data = try await api.request(path, method: "GET", json: nil, for: owner)
            guard !Task.isCancelled, request == loadKey else { return }
            let points = try await Task.detached(priority: .utility) {
                let export = try JSONDecoder().decode(NativeNutritionExport.self, from: data)
                let byDay = Dictionary(grouping: export.library.filter { $0.date != nil }, by: { $0.date ?? "" })
                return dates.map { key in Point(id: key, total: NutritionPayload(rows: byDay[key] ?? []).totals(on: key)) }
            }.value
            guard !Task.isCancelled, request == loadKey else { return }
            snapshot = Snapshot(owner: owner, day: end, points: points, loadedAt: .now)
        } catch is CancellationError {
        } catch {
            guard !Task.isCancelled, request == loadKey else { return }
            if let issue = error as? NativeAPIError {
                switch issue {
                case .accountChanged: snapshot = nil
                default: if issue.statusCode == 401 { snapshot = nil }
                }
            }
            self.error = pointsForRange == nil ? "饮食统计读取失败，点此重试。" : "更新失败，显示上次数据。点此重试。"
        }
    }
}

struct NativeNutritionFood: Identifiable, Equatable, Sendable {
    struct Facts: Decodable, Equatable, Sendable {
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
    /// Display details from the shared food catalog. Personal foods leave them empty.
    var emoji: String? = nil
    var category: String? = nil
    var group: String? = nil
    var portions: [NativeFoodPortion] = []
    var source: String? = nil
    var detail: String? = nil
    /// The chain or brand of a catalog item. Search lists everyday foods before branded ones that match as well.
    var brand: String? = nil
    var isPersonal = false

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
        if case .voice = destination {
            guard !voice.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
            return Array((personal + NativeNutritionFood.builtIn).filter { $0.matches(voice.text) }.prefix(15))
        }
        let budget = remaining
        return Array((personal + NativeNutritionFood.core).sorted { $0.facts.fit(budget) > $1.facts.fit(budget) }.prefix(8))
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
final class NativeNutritionSpeech: ObservableObject {
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

extension NativeNutritionFood {
    /// The shared catalog in `cloudflare/shared/food-catalog.json`, which the web nutrition tools also use.
    /// The short list below only covers a missing or unreadable bundle resource.
    static let builtIn: [Self] = {
        let catalog = NativeFoodCatalog.shared?.nutritionFoods ?? []
        return catalog.isEmpty ? fallback : catalog
    }()

    static let builtInByID = Dictionary(builtIn.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

    /// The original everyday list. Recommendations rank only these, like the web nutrition tools.
    static let core: [Self] = {
        let ids = Set(fallback.map(\.id))
        let loaded = builtIn.filter { ids.contains($0.id) }
        return loaded.count == fallback.count ? loaded : fallback
    }()

    // Same USDA FoodData Central entries used by the Spotter web nutrition tools.
    private static let fallback: [Self] = [
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
