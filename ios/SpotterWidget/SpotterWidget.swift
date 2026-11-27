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
            nextWorkout: .init(title: "下肢力量训练", day: day, minutes: 45, planID: "preview-plan"),
            activeWorkout: nil,
            buddy: .init(id: "preview", name: "阿澈", ownDays: ownDays, buddyDays: buddyDays, todayTitle: "下肢训练", todayTime: "18:30"),
            nutrition: .init(
                calories: 1_840, protein: 112, carbs: 204, fat: 63, waterML: 1_250,
                goals: .init(calories: 2_300, protein: 145, carbs: 260, fat: 75),
                offersUpdatedEstimate: true
            ),
            weekly: .init(weekStart: SpotterWidgetSnapshot.weekStartKey(for: lastWeek), dailyMinutes: [48, 0, 53, 0, 44, 0, 47], trainingDays: 4, totalMinutes: 192, completedSets: 68, previousTrainingDays: 3),
            year: .init(dailyMinutes: exampleMinutes),
            progressWeek: ownDays.enumerated().map { index, state in
                .init(trainingState: state, trainingProgress: state == .completed ? 1 : 0,
                      nutritionProgress: index < 4 ? [0.82, 1, 0.68, 0.44][index] : nil, hasNutritionRecord: index < 4)
            }
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
    case todayWorkout, buddy, nutrition, progressWeek, weekly, year

    var kind: String {
        switch self {
        case .todayWorkout: SpotterWidgetStore.widgetKind
        case .buddy: SpotterWidgetStore.buddyKind
        case .nutrition: SpotterWidgetStore.nutritionKind
        case .progressWeek: SpotterWidgetStore.progressWeekKind
        case .weekly: SpotterWidgetStore.weeklyKind
        case .year: SpotterWidgetStore.yearKind
        }
    }

    var title: String {
        switch self {
        case .todayWorkout: "今天开练"
        case .buddy: "搭子本周"
        case .nutrition: "今日饮食"
        case .progressWeek: "本周双环"
        case .weekly: "我的训练周报"
        case .year: "年度训练热力图"
        }
    }

    var icon: String {
        switch self {
        case .todayWorkout: "figure.strengthtraining.traditional"
        case .buddy: "person.2.fill"
        case .nutrition: "fork.knife"
        case .progressWeek: "circle.circle"
        case .weekly: "chart.bar.xaxis"
        case .year: "calendar"
        }
    }

    var description: String {
        switch self {
        case .todayWorkout: "查看下一堂训练，或直接回到当前训练。"
        case .buddy: "并排查看你和搭子周一至周日的训练打卡。"
        case .nutrition: "查看剩余热量和三大营养素，快速打开拍照记餐或饮水。"
        case .progressWeek: "用一周双环查看训练和饮食进度。"
        case .weekly: "回顾最近完整一周训练的天数、时长和组数。"
        case .year: "查看最近 365 天的训练，每格代表一天。"
        }
    }

    var families: [WidgetFamily] {
        switch self {
        case .todayWorkout: [.systemSmall]
        case .buddy: [.systemSmall, .systemMedium]
        case .year: [.systemMedium, .systemLarge]
        case .nutrition, .progressWeek, .weekly: [.systemMedium]
        }
    }

    var route: String {
        switch self {
        case .todayWorkout: "training-launch"
        case .buddy: "buddy"
        case .nutrition: "nutrition"
        case .progressWeek: "progress"
        case .weekly: "weekly"
        case .year: "year"
        }
    }
}

@main
enum SpotterWidgets {
    @MainActor static func main() {
        if #available(iOS 18.0, *) {
            SpotterWidgetsWithWatch.main()
        } else {
            SpotterLegacyWidgets.main()
        }
    }

    @MainActor @WidgetBundleBuilder
    fileprivate static var homeWidgets: some Widget {
        SpotterTodayWorkoutWidget()
        SpotterBuddyWidget()
        SpotterNutritionWidget()
        SpotterWeekProgressWidget()
        SpotterWeeklyWidget()
        SpotterYearWidget()
    }
}

private struct SpotterLegacyWidgets: WidgetBundle {
    var body: some Widget {
        SpotterWidgets.homeWidgets
        if #available(iOS 16.1, *) { SpotterWorkoutLiveActivity() }
    }
}

@available(iOS 18.0, *)
private struct SpotterWidgetsWithWatch: WidgetBundle {
    var body: some Widget {
        SpotterWidgets.homeWidgets
        SpotterWorkoutLiveActivityWithWatch()
    }
}

private struct SpotterTodayWorkoutWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .todayWorkout) }
}

private struct SpotterBuddyWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .buddy) }
}

private struct SpotterNutritionWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .nutrition) }
}

private struct SpotterWeekProgressWidget: Widget {
    var body: some WidgetConfiguration { spotterConfiguration(for: .progressWeek) }
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
    private var nutritionBlue: Color { fullColor ? Color(red: 178 / 255, green: 219 / 255, blue: 247 / 255) : .primary }
    private var trainingGreen: Color {
        guard fullColor else { return .primary }
        return dark ? Color(red: 0.55, green: 0.72, blue: 0.53) : Color(red: 0.29, green: 0.38, blue: 0.23)
    }
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
        guard let snapshot = entry.snapshot, snapshot.weekStart == entry.weekStart else { return nil }
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

    private var nextWorkout: SpotterWidgetSnapshot.Workout? {
        guard let workout = entry.snapshot?.nextWorkout, workout.day >= entry.day else { return nil }
        return workout
    }

    private var openURL: URL {
        if supportsActions, card == .todayWorkout {
            if entry.snapshot?.activeWorkout != nil { return route("training") }
            if let plan = nextWorkout, let id = plan.planID {
                return route("schedule", query: [.init(name: "id", value: id), .init(name: "day", value: plan.day)])
            }
        }
        if supportsActions, card == .buddy, let buddy, SpotterWidgetSnapshot.isEntryID(buddy.id) {
            return buddyURL(buddy.id, day: entry.day)
        }
        return route(card.route)
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
        .widgetURL(openURL)
    }

    @ViewBuilder private var cardContents: some View {
        switch card {
        case .todayWorkout:
            todayWorkoutContent
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
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    emptyState("等待同步今日饮食", detail: nil)
                    nutritionActions
                }
            }
        case .progressWeek:
            if let snapshot = entry.snapshot, snapshot.weekStart == entry.weekStart, let progress = snapshot.progressWeek {
                progressWeekContent(progress, latestDay: snapshot.day)
            } else {
                emptyState("等待同步本周进度", detail: "打开 App 查看双环")
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
            if !privateView, card == .nutrition, nutrition?.offersUpdatedEstimate == true {
                if supportsActions {
                    Link(destination: route("nutrition-estimate")) { estimateLabel.privacySensitive() }
                        .accessibilityLabel("查看动态热量估算")
                } else {
                    estimateLabel
                }
            } else if !privateView, let caption {
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

    private var estimateLabel: some View {
        Label("查看估算", systemImage: "chart.line.uptrend.xyaxis")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(green)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
    }

    private var caption: String? {
        switch card {
        case .todayWorkout: return nil
        case .buddy:
            guard buddy != nil else { return nil }
            if !smallBuddy { return dateRange(entry.weekStart) }
            guard let day = entry.snapshot?.day, day < entry.day,
                  let dayIndex = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart).firstIndex(of: day) else { return nil }
            return "截至周\(Self.weekdays[dayIndex])"
        case .nutrition: return nutrition?.offersUpdatedEstimate == true ? nil : nutrition.map { "饮水 \(number($0.waterML)) mL" }
        case .progressWeek: return dateRange(entry.weekStart)
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
            case .todayWorkout, .buddy, .progressWeek, .year:
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

    @ViewBuilder private var todayWorkoutContent: some View {
        if let active = entry.snapshot?.activeWorkout {
            workoutCard(title: active.title, status: active.isRunning ? "进行中" : "已暂停",
                        subtitle: active.totalSets > 0 ? "\(active.completedSets)/\(active.totalSets) 组" : "已开始训练",
                        action: "继续训练", icon: "play.fill",
                        progress: active.totalSets > 0 ? Double(active.completedSets) / Double(active.totalSets) : nil)
        } else if let plan = nextWorkout {
            workoutCard(title: plan.title, status: plan.day == entry.day ? "今天安排" : "下一堂",
                        subtitle: [plan.day == entry.day ? nil : compactDay(plan.day),
                                   plan.minutes > 0 ? "\(plan.minutes) 分钟" : nil].compactMap { $0 }.joined(separator: " · "),
                        action: plan.day == entry.day ? "开始训练" : "查看安排",
                        icon: plan.day == entry.day ? "play.fill" : "calendar")
        } else if let snapshot = entry.snapshot, snapshot.day == entry.day, snapshot.todayCompleted > 0 {
            workoutCard(title: "今日已完成", status: "已打卡", subtitle: "\(snapshot.todayCompleted) 堂训练",
                        action: "打开训练", icon: "checkmark")
        } else {
            workoutCard(title: entry.snapshot == nil ? "打开训练" : "今天暂无安排", status: nil, subtitle: "",
                        action: "选择训练", icon: "arrow.up.right")
        }
    }

    private func workoutCard(title: String, status: String?, subtitle: String, action: String, icon: String,
                             progress: Double? = nil) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Spacer(minLength: 2)
            if let status {
                Text(status)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(green)
            }
            Text(title)
                .font(.system(size: 21, weight: .bold))
                .lineLimit(2)
                .minimumScaleFactor(0.75)
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(muted)
                    .monospacedDigit()
                    .lineLimit(1)
            }
            if let progress {
                GeometryReader { proxy in
                    Capsule().fill(track)
                        .overlay(alignment: .leading) {
                            Capsule().fill(trainingGreen).frame(width: proxy.size.width * progress).widgetAccentable()
                        }
                }
                .frame(height: 3)
                .accessibilityHidden(true)
            }
            Spacer(minLength: 1)
            Label(action, systemImage: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(green)
                .lineLimit(1)
                .widgetAccentable()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func compactDay(_ day: String) -> String {
        let fields = day.split(separator: "-")
        guard fields.count == 3, let month = Int(fields[1]), let number = Int(fields[2]) else { return day }
        return "\(month)月\(number)日"
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
        let count = buddyCount(days, through: latest)
        let cutoffLabel = latest < today ? "截至周\(Self.weekdays[latest])" : nil

        return VStack(spacing: 2) {
            HStack(spacing: 2) {
                Text(name)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(count.visible)
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
            ([name, cutoffLabel, count.accessible].compactMap { $0 } + days.prefix(7).enumerated().map { index, state in
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
        let week = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart)
        let today = week.firstIndex(of: entry.day) ?? 6
        let latest = entry.snapshot.flatMap { week.firstIndex(of: $0.day) } ?? today
        let state = value.buddyDays[today]
        return VStack(alignment: .leading, spacing: 6) {
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                Color.clear.frame(width: 55, height: 8)
                ForEach(Self.weekdays.indices, id: \.self) { index in
                    Text(Self.weekdays[index])
                        .font(.system(size: 9, weight: index == today ? .bold : .medium))
                        .foregroundStyle(index == today ? green : muted)
                        .frame(maxWidth: .infinity)
                }
                Color.clear.frame(width: 47, height: 8)
            }.accessibilityHidden(true)
            mediumBuddyRow("我", days: value.ownDays, keys: week, today: today, latest: latest)
            mediumBuddyRow(value.name, days: value.buddyDays, keys: week, today: today, latest: latest, partner: value.id)
            Spacer(minLength: 0)
            Label(latest < today ? "截至周\(Self.weekdays[latest])" :
                    [buddyStatus(state), buddyDetail(value, state: state)].compactMap { $0 }.joined(separator: " · "),
                  systemImage: "calendar")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(muted)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    private func buddyCount(_ days: [SpotterWidgetSnapshot.DayState], through latest: Int) -> (visible: String, accessible: String) {
        let elapsed = days.prefix(latest + 1)
        let visible = elapsed.filter { $0 != .unavailable }
        let completed = visible.filter { $0 == .completed }.count
        if visible.isEmpty { return ("未公开", "本周打卡未公开") }
        if visible.count == elapsed.count { return ("\(completed) 天", "本周已打卡 \(completed) 天") }
        return (completed > 0 ? "可见 \(completed) 天" : "部分公开", "公开记录中已打卡 \(completed) 天")
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

    private func mediumBuddyRow(_ name: String, days: [SpotterWidgetSnapshot.DayState], keys: [String],
                                today: Int, latest: Int, partner: String? = nil) -> some View {
        let count = buddyCount(days, through: latest)
        return HStack(spacing: 4) {
            Text(name)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(width: 55, alignment: .leading)
            ForEach(Self.weekdays.indices, id: \.self) { index in
                let state = days[index]
                let appearance = index > latest && state == .unavailable ? .none : state
                let description = "\(name)，周\(Self.weekdays[index])，" +
                    (index > today ? "日期未到" : index > latest ? "等待同步" : dayStateLabel(state))
                if supportsActions, let partner, index <= today, keys.indices.contains(index) {
                    Link(destination: buddyURL(partner, day: keys[index])) {
                        buddyDay(appearance, today: today == index)
                    }.accessibilityLabel(description)
                } else {
                    buddyDay(appearance, today: today == index).accessibilityLabel(description)
                }
            }
            Text(count.visible)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(muted)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(width: 47, alignment: .trailing)
                .accessibilityLabel(count.accessible)
        }
    }

    private func buddyURL(_ partner: String, day: String) -> URL {
        route("buddy", query: [.init(name: "id", value: partner), .init(name: "day", value: day)])
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
            nutritionActions
        }
    }

    private var nutritionActions: some View {
        HStack(spacing: 6) {
            if supportsActions {
                action("拍照记餐", icon: "camera", to: route("nutrition-photo"))
                action("饮水 +250 mL", icon: "drop.fill", to: route("water", query: [.init(name: "ml", value: "250"), .init(name: "day", value: entry.day)]))
                    .accessibilityLabel("记录饮水 250 毫升")
            } else {
                actionLabel("拍照记餐", icon: "camera")
                actionLabel("饮水 +250 mL", icon: "drop.fill")
            }
        }
    }

    private func calorieRing(_ value: SpotterWidgetSnapshot.Nutrition) -> some View {
        let target = value.goals.flatMap { $0.calories > 0 ? $0.calories : nil }
        let remaining = target.map { $0 - value.calories }
        let amount = number(remaining.map(abs) ?? value.calories, decimals: 0)
        let label = remaining.map { $0 < 0 ? "超出" : "还剩" } ?? "已记录"
        let intake = "已吃 \(number(value.calories, decimals: 0))"
        let accessibility = target.map { "\(intake) 千卡，目标 \(number($0, decimals: 0)) 千卡，\(label) \(amount) 千卡" } ??
            "\(intake) 千卡，未设置热量目标"
        return ZStack {
            Circle()
                .strokeBorder(fullColor ? nutritionBlue.opacity(0.22) : track, lineWidth: 4)
            if let fraction = fraction(value.calories, target: target), fraction > 0 {
                Circle()
                    .inset(by: 2)
                    .trim(from: 0, to: fraction)
                    .stroke(fullColor ? nutritionBlue : .primary, style: .init(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .widgetAccentable()
            }
            VStack(spacing: 0) {
                Text(label + (target == nil ? "" : "千卡"))
                    .font(.system(size: 8, weight: .semibold)).foregroundStyle(muted)
                Text(amount).font(.system(size: 20, weight: .bold, design: .rounded))
                Text(target == nil ? "千卡" : intake).font(.system(size: 8, weight: .medium)).foregroundStyle(muted)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.62)
            .monospacedDigit()
            .padding(.horizontal, 6)
        }
        .frame(width: 70, height: 70)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility)
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

    private func progressWeekContent(_ progress: [SpotterWidgetSnapshot.WeekDay], latestDay: String) -> some View {
        let days = SpotterWidgetSnapshot.weekDays(startingAt: entry.weekStart)
        return VStack(alignment: .leading, spacing: 6) {
            Spacer(minLength: 0)
            HStack(spacing: 2) {
                ForEach(days.indices, id: \.self) { index in
                    let day = days[index]
                    if supportsActions {
                        Link(destination: route("progress", query: [.init(name: "day", value: day)])) {
                            progressWeekDay(progress[index], day: day, index: index, latestDay: latestDay)
                        }
                    } else {
                        progressWeekDay(progress[index], day: day, index: index, latestDay: latestDay)
                    }
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                ringLegend("训练", tint: trainingGreen)
                ringLegend("饮食", tint: nutritionBlue)
                Label("休息", systemImage: "minus")
                Spacer(minLength: 0)
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(muted)
        }
    }

    private func progressWeekDay(_ progress: SpotterWidgetSnapshot.WeekDay, day: String, index: Int,
                                 latestDay: String) -> some View {
        let today = entry.day == day
        let future = entry.day < day
        let stale = !future && latestDay < day
        let training = progress.trainingState
        let nutrition = future || stale ? nil : progress.nutritionProgress
        return VStack(spacing: 3) {
            Text(Self.weekdays[index])
                .font(.system(size: 9, weight: today ? .bold : .medium))
                .foregroundStyle(today ? green : muted)
            ZStack {
                Circle().fill(today ? track : .clear)
                progressStroke(progress.trainingProgress, tint: trainingGreen, width: 2.4)
                    .padding(1)
                progressStroke(nutrition ?? 0, tint: nutritionBlue, width: 2.1)
                    .padding(5.5)
                if training == .rest {
                    Image(systemName: "minus").font(.system(size: 8, weight: .bold)).foregroundStyle(muted)
                } else if !future && progress.hasNutritionRecord == true && nutrition == nil {
                    Circle().fill(nutritionBlue).frame(width: 3, height: 3)
                } else {
                    Text(String(day.suffix(2)).drop(while: { $0 == "0" }))
                        .font(.system(size: 9, weight: today ? .bold : .medium, design: .monospaced))
                        .foregroundStyle(muted)
                }
            }
            .frame(width: 27, height: 27)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(progressDayLabel(progress, index: index, future: future, stale: stale))
    }

    private func progressStroke(_ progress: Double, tint: Color, width: CGFloat) -> some View {
        Circle().inset(by: width / 2)
            .stroke(tint.opacity(0.19), lineWidth: width)
            .overlay {
                if progress > 0 {
                    Circle().inset(by: width / 2).trim(from: 0, to: progress)
                        .stroke(tint, style: .init(lineWidth: width, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .widgetAccentable()
                }
            }
    }

    private func progressDayLabel(_ day: SpotterWidgetSnapshot.WeekDay, index: Int, future: Bool, stale: Bool) -> String {
        let training = day.trainingState == .unavailable ? "训练等待同步" :
            day.trainingState == .planned && day.trainingProgress > 0 ? "训练已完成 \(Int(day.trainingProgress * 100))%" :
            "训练\(dayStateLabel(day.trainingState))"
        let nutrition: String
        if future { nutrition = "日期未到" }
        else if stale || day.hasNutritionRecord == nil { nutrition = "饮食等待同步" }
        else if let progress = day.nutritionProgress { nutrition = "饮食目标达成 \(Int(progress * 100))%" }
        else { nutrition = day.hasNutritionRecord == true ? "已有饮食记录" : "暂无饮食记录" }
        return "周\(Self.weekdays[index])，\(training)，\(nutrition)"
    }

    private func ringLegend(_ title: String, tint: Color) -> some View {
        HStack(spacing: 4) {
            Circle().strokeBorder(tint, lineWidth: 1.6).frame(width: 8, height: 8)
            Text(title)
        }
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

    private func action(_ title: String, icon: String, to url: URL) -> some View {
        Link(destination: url) { actionLabel(title, icon: icon) }
            .buttonStyle(.plain)
    }

    private func actionLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .foregroundStyle(green)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 23)
            .background(track, in: RoundedRectangle(cornerRadius: 8))
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
            SpotterHomeCard(card: .todayWorkout, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            SpotterHomeCard(card: .buddy, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            SpotterHomeCard(card: .buddy, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .nutrition, entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterHomeCard(card: .progressWeek, entry: .preview())
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
