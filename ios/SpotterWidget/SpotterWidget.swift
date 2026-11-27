import AppIntents
import SwiftUI
import WidgetKit

private struct SpotterWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: SpotterWidgetSnapshot?
    let isPreview: Bool

    var day: String { SpotterWidgetSnapshot.dayKey(for: date) }
    var weekStart: String { SpotterWidgetSnapshot.weekStartKey(for: date) }

    static func preview(at date: Date = .now) -> Self {
        let day = SpotterWidgetSnapshot.dayKey(for: date)
        let weekStart = SpotterWidgetSnapshot.weekStartKey(for: date)
        let calendar = Calendar.current
        let lastWeek = calendar.date(byAdding: .day, value: -7, to: date) ?? date
        let ownDays: [SpotterWidgetSnapshot.DayState] = [.completed, .rest, .completed, .none, .planned, .none, .none]
        var buddyDays: [SpotterWidgetSnapshot.DayState] = [.completed, .rest, .none, .none, .none, .planned, .none]
        if let index = SpotterWidgetSnapshot.weekDays(startingAt: weekStart).firstIndex(of: day) {
            buddyDays[index] = .planned
        }
        var exampleMinutes: [String: Int] = [:]
        for (index, key) in SpotterWidgetSnapshot.yearDays(endingAt: date).enumerated() {
            guard let key, (index * 13 + index / 7 * 5) % 11 < 5 else { continue }
            exampleMinutes[key] = 20 + ((index * 29) % 62)
        }
        let snapshot = SpotterWidgetSnapshot(
            updatedAt: date,
            day: day,
            todayCompleted: 1,
            weekStart: weekStart,
            weekCheckins: ownDays.map { $0 == .completed },
            nextWorkout: nil,
            activeWorkout: nil,
            buddy: .init(id: "preview", name: "阿澈", ownDays: ownDays, buddyDays: buddyDays, todayTitle: "下肢训练", todayTime: "18:30"),
            nutrition: .init(
                calories: 1_840, protein: 112, carbs: 204, fat: 63, waterML: 1_250,
                goals: .init(calories: 2_300, protein: 145, carbs: 260, fat: 75),
                frequentMeals: [.init(id: "oats", name: "酸奶燕麦碗"), .init(id: "shake", name: "蛋白粉加牛奶")]
            ),
            weekly: .init(weekStart: SpotterWidgetSnapshot.weekStartKey(for: lastWeek), dailyMinutes: [48, 0, 53, 0, 44, 0, 47], trainingDays: 4, totalMinutes: 192, completedSets: 68, previousTrainingDays: 3),
            year: .init(dailyMinutes: exampleMinutes)
        )
        return .init(date: date, snapshot: snapshot, isPreview: true)
    }
}

private struct SpotterWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpotterWidgetEntry { .preview() }

    func getSnapshot(in context: Context, completion: @escaping (SpotterWidgetEntry) -> Void) {
        let now = Date.now
        completion(context.isPreview ? .preview(at: now) : entry(at: now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpotterWidgetEntry>) -> Void) {
        let now = Date.now
        let current = entry(at: now)
        let midnight = Calendar.current.dateInterval(of: .day, for: now)?.end ?? now.addingTimeInterval(3_600)
        let boundaries = Set([midnight, current.snapshot?.expiresAt].compactMap { $0 }).filter { $0 > now }.sorted()
        completion(Timeline(entries: [current] + boundaries.map(entry(at:)), policy: .after(midnight)))
    }

    private func entry(at date: Date) -> SpotterWidgetEntry {
        .init(date: date, snapshot: SpotterWidgetStore.shared.read(at: date), isPreview: false)
    }
}

private enum SpotterCard {
    case buddy, nutrition, weekly, year

    var kind: String {
        switch self {
        case .buddy: SpotterWidgetStore.buddyKind
        case .nutrition: SpotterWidgetStore.nutritionKind
        case .weekly: SpotterWidgetStore.weeklyKind
        case .year: SpotterWidgetStore.yearKind
        }
    }

    var title: String {
        switch self {
        case .buddy: "搭子督练"
        case .nutrition: "今日饮食"
        case .weekly: "我的训练周报"
        case .year: "年度训练热力图"
        }
    }

    var icon: String {
        switch self {
        case .buddy: "person.2.fill"
        case .nutrition: "fork.knife"
        case .weekly: "chart.bar.xaxis"
        case .year: "calendar"
        }
    }

    var description: String {
        switch self {
        case .buddy: "并排查看你和搭子的本周打卡，给搭子打气。"
        case .nutrition: "查看今天的热量、营养和饮水，一键记录已选常用餐。"
        case .weekly: "回顾最近完整一周训练的天数、时长和组数。"
        case .year: "查看最近 365 天的训练，每格代表一天。"
        }
    }

    var families: [WidgetFamily] {
        switch self {
        case .buddy: [.systemSmall, .systemMedium]
        case .year: [.systemMedium, .systemLarge]
        case .nutrition, .weekly: [.systemMedium]
        }
    }

    var route: String {
        switch self {
        case .buddy: "buddy"
        case .nutrition: "nutrition"
        case .weekly: "weekly"
        case .year: "year"
        }
    }
}

@main
struct SpotterWidgets: WidgetBundle {
    var body: some Widget {
        SpotterBuddyWidget()
        SpotterNutritionWidget()
        SpotterWeeklyWidget()
        SpotterYearWidget()
        if #available(iOS 16.1, *) { SpotterWorkoutLiveActivity() }
    }
}

private struct SpotterBuddyWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .buddy) }
}

private struct SpotterNutritionWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .nutrition) }
}

private struct SpotterWeeklyWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .weekly) }
}

private struct SpotterYearWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .year) }
}

@MainActor private func spotterConfiguration(for card: SpotterCard) -> some WidgetConfiguration {
    StaticConfiguration(kind: card.kind, provider: SpotterWidgetProvider()) { entry in
        SpotterHomeCard(card: card, entry: entry)
    }
    .configurationDisplayName(card.title)
    .description(card.description)
    .supportedFamilies(card.families)
}

private struct SpotterHomeCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.redactionReasons) private var redactionReasons
    @Environment(\.widgetFamily) private var family

    let card: SpotterCard
    let entry: SpotterWidgetEntry

    private static let weekdays = ["一", "二", "三", "四", "五", "六", "日"]
    private var fullColor: Bool { renderingMode == .fullColor }
    private var dark: Bool { scheme == .dark }
    private var privateView: Bool { redactionReasons.contains(.privacy) }
    private var supportsActions: Bool { !entry.isPreview && redactionReasons.isEmpty }
    private var smallBuddy: Bool { card == .buddy && family == .systemSmall }
    private var ink: Color {
        guard fullColor else { return .primary }
        return dark || card == .weekly ? Color(red: 0.94, green: 0.97, blue: 0.92) : Color(red: 0.10, green: 0.17, blue: 0.13)
    }
    private var muted: Color {
        guard fullColor else { return .secondary }
        return dark || card == .weekly ? Color(red: 0.73, green: 0.82, blue: 0.73) : Color(red: 0.28, green: 0.37, blue: 0.30)
    }
    private var green: Color {
        guard fullColor else { return .primary }
        return dark || card == .weekly ? Color(red: 0.77, green: 0.91, blue: 0.73) : Color(red: 0.18, green: 0.34, blue: 0.23)
    }
    private var lime: Color { fullColor ? Color(red: 0.83, green: 0.96, blue: 0.55) : .primary }
    private var limeInk: Color { fullColor ? Color(red: 0.11, green: 0.20, blue: 0.11) : .primary }
    private var track: Color { ink.opacity(fullColor && !dark ? 0.08 : 0.15) }
    private var buddy: SpotterWidgetSnapshot.Buddy? {
        guard let snapshot = entry.snapshot, snapshot.weekStart == entry.weekStart,
              snapshot.day == entry.day || (smallBuddy && snapshot.day < entry.day) else { return nil }
        return snapshot.buddy
    }
    private var nutrition: SpotterWidgetSnapshot.Nutrition? {
        guard entry.snapshot?.day == entry.day else { return nil }
        return entry.snapshot?.nutrition
    }
    private var weekly: SpotterWidgetSnapshot.Weekly? {
        guard let previous = Calendar.current.date(byAdding: .day, value: -7, to: entry.date),
              let weekly = entry.snapshot?.weekly,
              weekly.weekStart == SpotterWidgetSnapshot.weekStartKey(for: previous) else { return nil }
        return weekly
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { background }
        } else {
            content.padding(12).background { background }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            headline
            if privateView {
                emptyState("内容已隐藏", detail: nil)
            } else {
                cardContents.privacySensitive()
            }
        }
        .foregroundStyle(ink)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(route(card.route))
    }

    @ViewBuilder private var cardContents: some View {
        switch card {
        case .buddy:
            if let buddy {
                if smallBuddy {
                    smallBuddyContent(buddy)
                } else {
                    buddyContent(buddy)
                }
            } else {
                emptyState(
                    entry.snapshot?.day == entry.day ? "还没有可显示的搭子" : "等待同步搭子打卡",
                    detail: "打开 App 查看搭子"
                )
            }
        case .nutrition:
            if let nutrition {
                nutritionContent(nutrition)
            } else if let saved = entry.snapshot?.nutrition {
                VStack(alignment: .leading, spacing: 4) {
                    emptyState("等待同步今日饮食", detail: nil)
                    nutritionActions(saved.frequentMeals)
                }
            } else {
                emptyState("等待同步今日饮食", detail: "打开 App 记一餐")
            }
        case .weekly:
            if let weekly {
                weeklyContent(weekly)
            } else {
                emptyState("等待同步训练周报", detail: "打开 App 查看统计")
            }
        case .year:
            if let snapshot = entry.snapshot, let year = snapshot.year {
                yearContent(year, endingOn: snapshot.day)
            } else {
                emptyState("等待同步训练记录", detail: "打开 App 查看打卡历史")
            }
        }
    }

    private var headline: some View {
        HStack(spacing: 5) {
            Image(systemName: card.icon)
                .font(.system(size: 11, weight: .semibold))
                .widgetAccentable()
                .accessibilityHidden(true)
            Text(smallBuddy ? "搭子本周" : card.title)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 2)
            if !privateView, let caption {
                Text(caption)
                    .font(.system(size: 10, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .privacySensitive()
            }
        }
        .foregroundStyle(green)
    }

    private var caption: String? {
        switch card {
        case .buddy:
            guard buddy != nil else { return nil }
            if !smallBuddy { return dateRange(entry.weekStart) }
            guard let day = entry.snapshot?.day, day < entry.day,
                  let dayIndex = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart).firstIndex(of: day) else { return nil }
            return "截至周\(Self.weekdays[dayIndex])"
        case .nutrition: return nutrition.map { "饮水 \(number($0.waterML)) mL" }
        case .weekly: return weekly.flatMap { dateRange($0.weekStart) }
        case .year: return "过去 365 天"
        }
    }

    @ViewBuilder private var background: some View {
        if !fullColor {
            Color.clear
        } else {
            switch card {
            case .weekly:
                LinearGradient(
                    colors: [Color(red: 0.23, green: 0.37, blue: 0.28), Color(red: 0.09, green: 0.18, blue: 0.13)],
                    startPoint: .topTrailing, endPoint: .bottomLeading
                )
            case .buddy, .year:
                dark ? Color(red: 0.12, green: 0.19, blue: 0.15) : Color(red: 0.94, green: 0.97, blue: 0.91)
            case .nutrition:
                dark ? Color(red: 0.13, green: 0.18, blue: 0.15) : Color(red: 0.97, green: 0.98, blue: 0.94)
            }
        }
    }

    private func emptyState(_ title: String, detail: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 19, weight: .bold)).lineLimit(2)
            if let detail {
                Label(detail, systemImage: "arrow.up.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(muted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func smallBuddyContent(_ value: SpotterWidgetSnapshot.Buddy) -> some View {
        let week = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart)
        let today = week.firstIndex(of: entry.day) ?? 6
        let latest = entry.snapshot.flatMap { week.firstIndex(of: $0.day) } ?? today
        return VStack(spacing: 0) {
            Spacer(minLength: 3)
            HStack(spacing: 3) {
                ForEach(Self.weekdays.indices, id: \.self) { index in
                    Text(Self.weekdays[index])
                        .font(.system(size: 9, weight: today == index ? .bold : .medium))
                        .foregroundStyle(today == index ? green : muted)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
            Spacer(minLength: 2)
            smallBuddyRow("我", days: value.ownDays, today: today, latest: latest)
            Spacer(minLength: 4)
            smallBuddyRow(value.name, days: value.buddyDays, today: today, latest: latest)
            Spacer(minLength: 2)
        }
        .accessibilityHint("打开搭子页面")
    }

    private func smallBuddyRow(_ name: String, days: [SpotterWidgetSnapshot.DayState], today: Int, latest: Int) -> some View {
        let elapsed = days.prefix(latest + 1)
        let visible = elapsed.filter { $0 != .unavailable }
        let completed = visible.filter { $0 == .completed }.count
        let count = visible.isEmpty ? "未公开" :
            visible.count == elapsed.count ? "\(completed) 天" :
            completed > 0 ? "可见 \(completed) 天" : "部分公开"
        let countLabel = visible.isEmpty ? "本周打卡未公开" :
            visible.count == elapsed.count ? "本周已打卡 \(completed) 天" : "公开记录中已打卡 \(completed) 天"
        let cutoffLabel = latest < today ? "截至周\(Self.weekdays[latest])" : nil

        return VStack(spacing: 2) {
            HStack(spacing: 2) {
                Text(name)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(count)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(muted)
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            HStack(spacing: 3) {
                ForEach(Self.weekdays.indices, id: \.self) { index in
                    let state = days.indices.contains(index) ? days[index] : .unavailable
                    buddyDay(index > latest && state == .unavailable ? .none : state, today: today == index)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            ([name, cutoffLabel, countLabel].compactMap { $0 } + days.prefix(7).enumerated().map { index, state in
                let label: String
                if index > today && (state == .none || state == .unavailable) {
                    label = "日期未到"
                } else if index > latest && (state == .none || state == .unavailable) {
                    label = "等待同步"
                } else {
                    label = dayStateLabel(state)
                }
                return "周\(Self.weekdays[index])\(label)"
            }).joined(separator: "，")
        )
    }

    private func buddyContent(_ value: SpotterWidgetSnapshot.Buddy) -> some View {
        let todayIndex = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart).firstIndex(of: entry.day)
        let today = todayIndex.flatMap { value.buddyDays.indices.contains($0) ? value.buddyDays[$0] : nil } ?? .none
        return VStack(alignment: .leading, spacing: 4) {
            VStack(spacing: 3) {
                HStack(spacing: 4) {
                    Color.clear.frame(width: 39, height: 8)
                    ForEach(Self.weekdays, id: \.self) { day in
                        Text(day)
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(muted)
                            .frame(maxWidth: .infinity)
                    }
                }
                .accessibilityHidden(true)
                buddyRow(name: "我", days: value.ownDays, todayIndex: todayIndex)
                buddyRow(name: value.name, days: value.buddyDays, todayIndex: todayIndex)
            }
            .frame(maxHeight: .infinity)
            HStack(spacing: 7) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(buddyStatus(today))
                        .font(.system(size: 12, weight: .semibold))
                    if let detail = buddyDetail(value, state: today) {
                        Text(detail).font(.system(size: 10, weight: .medium)).foregroundStyle(muted)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                Spacer(minLength: 0)
                if today != .rest && today != .unavailable {
                    if supportsActions, !value.cheered {
                        action("给搭子打气", icon: "flame.fill", to: route("buddy-cheer", query: [.init(name: "buddy", value: value.id)]), prominent: true)
                    } else {
                        actionLabel(value.cheered ? "已打气" : "给搭子打气", icon: value.cheered ? "checkmark" : "flame.fill", prominent: !value.cheered)
                    }
                }
            }
        }
    }

    private func buddyStatus(_ state: SpotterWidgetSnapshot.DayState) -> String {
        switch state {
        case .completed: "搭子今天已打卡"
        case .rest: "搭子今天休息"
        case .planned: "搭子今天待练"
        case .none: "搭子今天暂无打卡"
        case .unavailable: "搭子今日动态未公开"
        }
    }

    private func buddyDetail(_ buddy: SpotterWidgetSnapshot.Buddy, state: SpotterWidgetSnapshot.DayState) -> String? {
        switch state {
        case .planned:
            let parts = [buddy.todayTime, buddy.todayTitle].compactMap { $0 }
            return parts.isEmpty ? nil : parts.joined(separator: " · ")
        case .completed: return buddy.todayTitle
        case .rest, .none, .unavailable: return nil
        }
    }

    private func buddyRow(name: String, days: [SpotterWidgetSnapshot.DayState], todayIndex: Int?) -> some View {
        HStack(spacing: 4) {
            Text(name)
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: 39, alignment: .leading)
            ForEach(Self.weekdays.indices, id: \.self) { index in
                let state = days.indices.contains(index) ? days[index] : .none
                buddyDay(state, today: todayIndex == index)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            name + "，" + days.prefix(7).enumerated().map { index, state in
                "周\(Self.weekdays[index])\(dayStateLabel(state))"
            }.joined(separator: "，")
        )
    }

    private func buddyDay(_ state: SpotterWidgetSnapshot.DayState, today: Bool) -> some View {
        ZStack {
            if state == .completed && fullColor {
                RoundedRectangle(cornerRadius: 4).fill(lime)
            } else if state == .none || state == .completed {
                RoundedRectangle(cornerRadius: 4).fill(track)
            } else if state == .planned {
                RoundedRectangle(cornerRadius: 4).strokeBorder(green.opacity(today ? 0.9 : 0.5), lineWidth: 1)
            }
            Image(systemName: dayStateIcon(state))
                .font(.system(size: 7, weight: .semibold))
                .foregroundStyle(state == .completed ? limeInk : state == .planned ? green : muted)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 16)
        .widgetAccentable(state == .completed)
    }

    private func dayStateIcon(_ state: SpotterWidgetSnapshot.DayState) -> String {
        switch state {
        case .completed: "checkmark"
        case .rest: "minus"
        case .planned: "circle"
        case .none: "circle.fill"
        case .unavailable: "lock"
        }
    }

    private func dayStateLabel(_ state: SpotterWidgetSnapshot.DayState) -> String {
        switch state {
        case .completed: "已打卡"
        case .rest: "休息"
        case .planned: "待练"
        case .none: "无打卡"
        case .unavailable: "未公开"
        }
    }

    private func nutritionContent(_ value: SpotterWidgetSnapshot.Nutrition) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 11) {
                calorieRing(value)
                VStack(alignment: .leading, spacing: 4) {
                    nutrient("蛋白质", amount: value.protein, target: value.goals?.protein, color: Color(red: 0.77, green: 0.42, blue: 0.23))
                    nutrient("碳水", amount: value.carbs, target: value.goals?.carbs, color: Color(red: 0.53, green: 0.45, blue: 0.80))
                    nutrient("脂肪", amount: value.fat, target: value.goals?.fat, color: Color(red: 0.78, green: 0.40, blue: 0.52))
                }
            }
            .frame(maxHeight: .infinity)
            nutritionActions(value.frequentMeals)
        }
    }

    private func nutritionActions(_ meals: [SpotterWidgetSnapshot.Nutrition.FrequentMeal]) -> some View {
        HStack(spacing: 4) {
            mealShortcuts(meals)
            if supportsActions {
                action("+250 mL", icon: "drop.fill", to: route("water", query: [.init(name: "ml", value: "250"), .init(name: "day", value: entry.day)]))
                    .accessibilityLabel("记录饮水 250 毫升")
            } else {
                actionLabel("+250 mL", icon: "drop.fill")
            }
        }
    }

    @ViewBuilder private func mealShortcuts(_ meals: [SpotterWidgetSnapshot.Nutrition.FrequentMeal]) -> some View {
        if #available(iOS 17.0, *), !meals.isEmpty {
            ForEach(meals.prefix(3), id: \.id) { meal in
                if supportsActions {
                    Button(intent: SpotterWidgetMealIntent(mealID: meal.id, day: entry.day)) {
                        mealShortcutLabel(meal.name)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("记录常用餐：\(meal.name)")
                } else {
                    mealShortcutLabel(meal.name)
                }
            }
        } else if supportsActions {
            action(meals.isEmpty ? "设置常用餐" : "常用餐", icon: "star", to: route("frequent-meals"))
        } else {
            actionLabel("常用餐", icon: "star")
        }
    }

    private func mealShortcutLabel(_ name: String) -> some View {
        Text(name)
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: 23)
            .foregroundStyle(green)
            .background(track, in: RoundedRectangle(cornerRadius: 8))
    }

    private func calorieRing(_ value: SpotterWidgetSnapshot.Nutrition) -> some View {
        let amount = number(value.calories, decimals: 0)
        let target = value.goals.map { number($0.calories, decimals: 0) }
        let nutritionBlue = Color(red: 178 / 255, green: 219 / 255, blue: 247 / 255)
        return ZStack {
            Circle()
                .strokeBorder(fullColor ? nutritionBlue.opacity(0.22) : track, lineWidth: 4)
            if let fraction = fraction(value.calories, target: value.goals?.calories), fraction > 0 {
                Circle()
                    .inset(by: 2)
                    .trim(from: 0, to: fraction)
                    .stroke(fullColor ? nutritionBlue : .primary, style: .init(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .widgetAccentable()
            }
            VStack(spacing: 0) {
                Text(amount).font(.system(size: 17, weight: .bold, design: .rounded))
                if let target {
                    Text("/ \(target)").font(.system(size: 9, weight: .semibold)).foregroundStyle(muted)
                }
                Text("千卡").font(.system(size: 9, weight: .medium)).foregroundStyle(muted)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.62)
            .monospacedDigit()
            .padding(.horizontal, 6)
        }
        .frame(width: 65, height: 65)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(target.map { "已记录 \(amount) 千卡，目标 \($0) 千卡" } ?? "已记录 \(amount) 千卡")
    }

    private func nutrient(_ label: String, amount: Double, target: Double?, color: Color) -> some View {
        let unitValue = target.map { "\(number(amount)) / \(number($0)) g" } ?? "\(number(amount)) g"
        return VStack(spacing: 2) {
            HStack(spacing: 5) {
                Text(label).fontWeight(.semibold)
                Spacer(minLength: 0)
                Text(unitValue).monospacedDigit().foregroundStyle(muted)
            }
            .font(.system(size: 10))
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            if let fraction = fraction(amount, target: target) {
                GeometryReader { proxy in
                    Capsule().fill(track)
                        .overlay(alignment: .leading) {
                            Capsule().fill(fullColor ? color : green)
                                .frame(width: proxy.size.width * fraction)
                                .widgetAccentable()
                        }
                }
                .frame(height: 3)
                .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func weeklyContent(_ value: SpotterWidgetSnapshot.Weekly) -> some View {
        let changes = value.trainingDays - value.previousTrainingDays
        return VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .center, spacing: 9) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        metric(value.trainingDays)
                        Text("天训练").font(.system(size: 11, weight: .semibold))
                    }
                    Text(changes == 0 ? "与上周训练天数持平" : "比上周\(changes > 0 ? "多" : "少")练 \(abs(changes)) 天")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(green)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                weeklyBars(value.dailyMinutes)
                    .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: .infinity)
            Divider().overlay(muted.opacity(0.14)).accessibilityHidden(true)
            HStack(spacing: 9) {
                weekStat(duration(value.totalMinutes), label: "训练时长")
                weekStat("\(value.completedSets) 组", label: "完成组数")
            }
        }
    }

    private func weeklyBars(_ minutes: [Int]) -> some View {
        let peak = max(60, minutes.max() ?? 0)
        return HStack(alignment: .bottom, spacing: 4) {
            ForEach(Self.weekdays.indices, id: \.self) { index in
                let value = minutes.indices.contains(index) ? minutes[index] : 0
                VStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(value > 0 ? lime : muted.opacity(0.3))
                        .frame(width: 10, height: value > 0 ? max(3, 31 * Double(value) / Double(peak)) : 2)
                        .frame(maxWidth: .infinity)
                        .frame(height: 31, alignment: .bottom)
                        .widgetAccentable(value > 0)
                    Text(Self.weekdays[index])
                        .font(.system(size: 8, weight: .medium))
                        .foregroundStyle(muted)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            minutes.prefix(7).enumerated().map { index, value in
                "周\(Self.weekdays[index]) \(value) 分钟"
            }.joined(separator: "，")
        )
    }

    private func weekStat(_ value: String, label: String) -> some View {
        HStack(spacing: 4) {
            Text(value).font(.system(size: 11, weight: .semibold)).monospacedDigit()
            Text(label).font(.system(size: 9, weight: .medium)).foregroundStyle(muted)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.73)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func yearContent(_ value: SpotterWidgetSnapshot.Year, endingOn day: String) -> some View {
        let map = SpotterYearLayout(keys: SpotterWidgetSnapshot.yearDays(endingOn: day), minutes: value.dailyMinutes)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                metric(map.trainingDays)
                Text("天训练").font(.system(size: 11, weight: .semibold))
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(muted)
                    .accessibilityHidden(true)
            }
            if family == .systemLarge { Spacer(minLength: 0) }
            yearCalendar(map).frame(height: 54)
            if family == .systemLarge {
                Spacer(minLength: 0)
                yearMonths(map.months)
                Spacer(minLength: 0)
            }
            yearLegend
        }
        .frame(maxHeight: .infinity, alignment: .center)
        .accessibilityHint("打开年度打卡历史")
    }

    private func yearCalendar(_ map: SpotterYearLayout) -> some View {
        let colors = (0..<4).map(yearColor)
        return GeometryReader { proxy in
            let spacing: CGFloat = 1
            let stride = proxy.size.width / CGFloat(max(1, map.columns))
            let tile = max(0, min(stride - spacing, (proxy.size.height - 12) / 7 - spacing))
            VStack(alignment: .leading, spacing: 2) {
                ZStack(alignment: .topLeading) {
                    ForEach(map.labels) { label in
                        Text(label.text)
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(muted)
                            .fixedSize()
                            .offset(x: stride * CGFloat(label.column))
                    }
                }
                .frame(height: 9)
                Canvas { canvas, _ in
                    for (index, cell) in map.cells.enumerated() {
                        guard let cell else { continue }
                        let rect = CGRect(
                            x: stride * CGFloat(index / 7),
                            y: (tile + spacing) * CGFloat(index % 7),
                            width: tile, height: tile
                        )
                        let path = cell.minutes == nil ? Path(ellipseIn: rect.insetBy(dx: 0.4, dy: 0.4)) : Path(roundedRect: rect, cornerRadius: 1)
                        canvas.fill(path, with: .color(colors[level(for: cell.minutes)]))
                    }
                }
                .widgetAccentable()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(map.accessibilityLabel)
    }

    private func yearMonths(_ months: [SpotterYearLayout.Month]) -> some View {
        let mostRecent = months.suffix(12)
        let peak = max(1, mostRecent.map(\.days).max() ?? 0)
        return VStack(alignment: .leading, spacing: 5) {
            Text("每月训练天数").font(.system(size: 11, weight: .semibold))
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array(mostRecent)) { month in
                    VStack(spacing: 2) {
                        Capsule().fill(month.days > 0 ? green : track)
                            .frame(width: 8, height: max(2, 33 * Double(month.days) / Double(peak)))
                            .frame(height: 33, alignment: .bottom)
                        Text("\(month.number)")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(muted)
                            .monospacedDigit()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .accessibilityHidden(true)
    }

    private var yearLegend: some View {
        HStack(spacing: 3) {
            Text("每日训练时长")
            Spacer(minLength: 2)
            Text("休")
            ForEach(0..<4) { index in
                RoundedRectangle(cornerRadius: index == 0 ? 3 : 1.5)
                    .fill(yearColor(index))
                    .frame(width: 6, height: 6)
                    .accessibilityHidden(true)
            }
            Text("60+ 分")
        }
        .font(.system(size: 9, weight: .medium))
        .foregroundStyle(muted)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("每日训练时长分档：未打卡、已打卡未满 30 分钟、30 至 59 分钟、60 分钟及以上")
    }

    private func level(for minutes: Int?) -> Int {
        guard let minutes else { return 0 }
        if minutes < 30 { return 1 }
        if minutes < 60 { return 2 }
        return 3
    }

    private func yearColor(_ level: Int) -> Color {
        guard fullColor else { return ink.opacity([0.18, 0.42, 0.69, 1][level]) }
        if level == 0 { return track }
        let light = [
            Color(red: 0.64, green: 0.75, blue: 0.60),
            Color(red: 0.34, green: 0.58, blue: 0.37),
            Color(red: 0.15, green: 0.36, blue: 0.24)
        ]
        let darkColors = [
            Color(red: 0.35, green: 0.52, blue: 0.38),
            Color(red: 0.56, green: 0.74, blue: 0.49),
            lime
        ]
        return (dark ? darkColors : light)[level - 1]
    }

    private func route(_ path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents()
        components.scheme = "spotter"
        components.host = "widget"
        components.path = "/" + path
        if !query.isEmpty { components.queryItems = query }
        return components.url ?? URL(string: "spotter://widget/training")!
    }

    private func action(_ title: String, icon: String, to url: URL, prominent: Bool = false) -> some View {
        Link(destination: url) { actionLabel(title, icon: icon, prominent: prominent) }
            .buttonStyle(.plain)
    }

    private func actionLabel(_ title: String, icon: String, prominent: Bool = false) -> some View {
        Label(title, systemImage: icon)
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .foregroundStyle(prominent ? limeInk : green)
            .padding(.horizontal, 8)
            .frame(minHeight: 23)
            .background(prominent && fullColor ? lime : track, in: RoundedRectangle(cornerRadius: 8))
    }

    private func metric(_ number: Int) -> some View {
        Text(number.formatted())
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.75)
    }

    private func number(_ value: Double, decimals: Int = 1) -> String {
        value.formatted(.number.precision(.fractionLength(0...decimals)))
    }

    private func fraction(_ amount: Double, target: Double?) -> Double? {
        guard let target, target > 0 else { return nil }
        return min(1, max(0, amount / target))
    }

    private func duration(_ minutes: Int) -> String {
        guard minutes >= 60 else { return "\(minutes) 分钟" }
        return "\(minutes / 60) 小时 \(minutes % 60) 分"
    }

    private func dateRange(_ weekStart: String) -> String? {
        let days = SpotterWidgetSnapshot.weekDays(startingAt: weekStart)
        guard let first = days.first.flatMap(monthDay), let last = days.last.flatMap(monthDay) else { return nil }
        return first.month == last.month
            ? "\(first.month) 月 \(first.day)–\(last.day) 日"
            : "\(first.month)/\(first.day)–\(last.month)/\(last.day)"
    }

    private func monthDay(_ key: String) -> (month: Int, day: Int)? {
        let parts = key.split(separator: "-")
        guard parts.count == 3, let month = Int(parts[1]), let day = Int(parts[2]) else { return nil }
        return (month, day)
    }
}

private struct SpotterYearLayout {
    struct Cell {
        /// Nil means no training on a dated tile. A recorded session may have zero logged minutes.
        let minutes: Int?
    }

    struct Label: Identifiable {
        let column: Int
        let text: String
        var id: Int { column }
    }

    struct Month: Identifiable {
        let id: String
        let number: Int
        var days: Int
    }

    let cells: [Cell?]
    let columns: Int
    let labels: [Label]
    let months: [Month]
    let trainingDays: Int

    init(keys: [String?], minutes: [String: Int]) {
        cells = keys.map { key in key.map { Cell(minutes: minutes[$0]) } }
        columns = keys.count / 7
        trainingDays = cells.compactMap { $0?.minutes }.count
        var headings: [Label] = []
        var monthly: [Month] = []
        for (index, key) in keys.enumerated() {
            guard let key else { continue }
            let parts = key.split(separator: "-")
            guard parts.count == 3, let month = Int(parts[1]), let day = Int(parts[2]) else { continue }
            let monthID = String(key.prefix(7))
            if monthly.last?.id != monthID { monthly.append(.init(id: monthID, number: month, days: 0)) }
            if minutes[key] != nil { monthly[monthly.count - 1].days += 1 }
            if day == 1, [3, 6, 9, 12].contains(month), index / 7 + 4 < columns {
                headings.append(.init(column: index / 7, text: "\(month) 月"))
            }
        }
        labels = headings
        months = monthly
    }

    var accessibilityLabel: String {
        let totals = months.map { month in
            "\(month.id.prefix(4)) 年 \(month.number) 月 \(month.days) 天"
        }
        return "过去 365 天训练 \(trainingDays) 天，" + totals.joined(separator: "，")
    }
}

#if DEBUG
struct SpotterWidgetPreviews: PreviewProvider {
    static var previews: some View {
        Group {
            SpotterHomeCard(card: .buddy, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            SpotterHomeCard(card: .buddy, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .nutrition, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .weekly, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .year, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .year, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemLarge))
        }
    }
}
#endif
