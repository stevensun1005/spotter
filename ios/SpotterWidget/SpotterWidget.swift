import SwiftUI
import WidgetKit

struct SpotterWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: SpotterWidgetSnapshot?

    var activeExpiresAt: Date? {
        guard let snapshot, snapshot.activeWorkout != nil else { return nil }
        return snapshot.updatedAt.addingTimeInterval(8 * 3_600)
    }

    var activeWorkout: SpotterWidgetSnapshot.Active? {
        guard let activeExpiresAt, date < activeExpiresAt else { return nil }
        return snapshot?.activeWorkout
    }

    static func preview(at date: Date = .now) -> Self {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: date) ?? date
        return .init(date: date, snapshot: .init(
            updatedAt: date,
            day: SpotterWidgetSnapshot.dayKey(for: date),
            todayCompleted: 1,
            weekStart: SpotterWidgetSnapshot.weekStartKey(for: date),
            weekCheckins: [true, false, true, false, true, false, false],
            nextWorkout: .init(title: "下肢力量", day: SpotterWidgetSnapshot.dayKey(for: tomorrow), minutes: 45),
            activeWorkout: nil
        ))
    }
}

private struct SpotterWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpotterWidgetEntry {
        .preview()
    }

    func getSnapshot(in context: Context, completion: @escaping (SpotterWidgetEntry) -> Void) {
        let now = Date.now
        completion(context.isPreview ? .preview(at: now) : entry(at: now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpotterWidgetEntry>) -> Void) {
        let now = Date.now
        let current = entry(at: now)
        let nextDay = Calendar.current.dateInterval(of: .day, for: now)?.end
            ?? now.addingTimeInterval(3_600)
        let changes = [nextDay, current.snapshot?.expiresAt, current.activeExpiresAt].compactMap { $0 }
        let boundaries = Set(changes).filter { $0 > now }.sorted()
        let entries = [current] + boundaries.map(entry(at:))
        completion(Timeline(entries: entries, policy: .after(nextDay)))
    }

    private func entry(at date: Date) -> SpotterWidgetEntry {
        .init(date: date, snapshot: SpotterWidgetStore.shared.read(at: date))
    }
}

@main
struct SpotterWidgets: WidgetBundle {
    var body: some Widget {
        SpotterTrainingWidget()
        if #available(iOS 16.1, *) { SpotterWorkoutLiveActivity() }
    }
}

struct SpotterTrainingWidget: Widget {
    static let kind = SpotterWidgetStore.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: SpotterWidgetProvider()) { entry in
            SpotterTrainingWidgetView(entry: entry)
        }
        .configurationDisplayName("训练搭子 · 今日训练")
        .description("查看下一堂训练和打卡进度，点按即可进入 Spotter。")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

struct SpotterTrainingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: SpotterWidgetEntry

    private static let trainingURL = URL(string: "spotter://widget/training")!
    private static let historyURL = URL(string: "spotter://widget/history")!

    private var snapshot: SpotterWidgetSnapshot? { entry.snapshot }
    private var day: String { SpotterWidgetSnapshot.dayKey(for: entry.date) }
    private var todayCompleted: Int { snapshot?.day == day ? snapshot?.todayCompleted ?? 0 : 0 }
    private var active: SpotterWidgetSnapshot.Active? { entry.activeWorkout }
    private var upcoming: SpotterWidgetSnapshot.Workout? {
        guard let workout = snapshot?.nextWorkout, workout.day >= day else { return nil }
        return workout
    }
    private var week: [Bool]? {
        guard let snapshot, snapshot.weekStart == SpotterWidgetSnapshot.weekStartKey(for: entry.date),
              snapshot.weekCheckins.count == 7 else { return nil }
        return snapshot.weekCheckins
    }
    private var isAccessory: Bool { family == .accessoryCircular || family == .accessoryRectangular }
    private var fullColor: Bool { renderingMode == .fullColor && !isAccessory }
    private var ink: Color { fullColor ? Color(red: 0.95, green: 0.98, blue: 0.92) : .primary }
    private var muted: Color { fullColor ? Color(red: 0.72, green: 0.81, blue: 0.73) : .secondary }
    private var lime: Color { fullColor ? Color(red: 0.82, green: 0.96, blue: 0.48) : .primary }

    private var status: String {
        if let active { return active.isRunning ? "训练进行中" : "训练已暂停" }
        if let upcoming { return upcoming.day == day ? "今日计划" : "下次训练" }
        if todayCompleted > 0 { return "今日已打卡" }
        return "训练日程"
    }

    private var title: String {
        if let active { return active.title }
        if let upcoming { return upcoming.title }
        if todayCompleted > 0 { return "完成 \(todayCompleted) 堂" }
        return snapshot == nil ? "打开训练搭子" : "今天没有安排"
    }

    private var detail: String? {
        if let active {
            return active.totalSets > 0 ? "\(active.completedSets)/\(active.totalSets) 组已完成" : "打开训练记录"
        }
        if let upcoming {
            let sessionDate = workoutDateLabel(upcoming.day)
            return upcoming.minutes > 0 ? "\(sessionDate) · \(upcoming.minutes) 分钟" : sessionDate
        }
        if todayCompleted > 0 { return nil }
        return snapshot == nil ? "同步你的训练计划" : "随时开始自由训练"
    }

    private var workoutSymbol: String {
        if let active { return active.isRunning ? "bolt.fill" : "pause.fill" }
        if upcoming?.day == day { return "calendar" }
        if todayCompleted > 0 { return "checkmark" }
        return "dumbbell.fill"
    }

    private var actionTitle: String {
        if active != nil { return "继续训练" }
        if upcoming?.day == day { return "查看训练" }
        return snapshot == nil ? "打开 App" : "打开训练"
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            layout
                .containerBackground(for: .widget) { backdrop }
        } else {
            layout
                .padding(isAccessory ? 0 : 14)
                .background { backdrop }
        }
    }

    @ViewBuilder private var layout: some View {
        switch family {
        case .accessoryCircular:
            circular
                .widgetURL(Self.trainingURL)
        case .accessoryRectangular:
            rectangular
                .widgetURL(Self.trainingURL)
        case .systemMedium:
            medium
                .widgetURL(Self.trainingURL)
        default:
            small
                .widgetURL(Self.trainingURL)
                .accessibilityElement(children: .combine)
                .accessibilityHint("打开训练")
        }
    }

    @ViewBuilder private var backdrop: some View {
        if fullColor {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [
                    Color(red: 0.16, green: 0.28, blue: 0.22),
                    Color(red: 0.06, green: 0.13, blue: 0.10),
                ], startPoint: .topTrailing, endPoint: .bottomLeading)
                ForEach(0..<3) { index in
                    Circle()
                        .strokeBorder(lime.opacity(0.11 - Double(index) * 0.024), lineWidth: 1)
                        .frame(width: 89 + CGFloat(index) * 34, height: 89 + CGFloat(index) * 34)
                        .offset(x: 31 + CGFloat(index) * 17, y: -34 - CGFloat(index) * 17)
                }
            }
            .clipped()
            .accessibilityHidden(true)
        } else {
            Color.clear
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 3) {
                logotype
                Spacer(minLength: 0)
                Image(systemName: workoutSymbol)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(lime)
                    .frame(width: 19, height: 19)
                    .background(lime.opacity(0.14), in: Circle())
                    .widgetAccentable()
                    .accessibilityHidden(true)
            }
            Spacer(minLength: 3)
            workoutSummary(.system(size: 20, weight: .bold))
            Spacer(minLength: 3)
            actionCopy
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .foregroundStyle(ink)
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 13) {
            VStack(alignment: .leading, spacing: 0) {
                logotype
                Spacer(minLength: 3)
                workoutSummary(.system(size: 23, weight: .bold))
                Spacer(minLength: 3)
                actionCopy
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityHint("打开训练")
            Link(destination: Self.historyURL) {
                weekCard
            }
            .buttonStyle(.plain)
            .accessibilityHint("打开打卡历史")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(ink)
    }

    private func workoutSummary(_ font: Font) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            statusText
            titleText(font)
            if let detail { detailText(detail) }
        }
    }

    private var logotype: some View {
        HStack(spacing: 5) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(lime)
                .widgetAccentable()
                .accessibilityHidden(true)
            Text("训练搭子")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(muted)
                .lineLimit(1)
        }
    }

    private var statusText: some View {
        Text(status)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(lime)
            .lineLimit(1)
            .widgetAccentable()
    }

    @ViewBuilder private func titleText(_ font: Font) -> some View {
        let label = Text(title)
            .font(font)
            .lineLimit(2)
            .minimumScaleFactor(0.72)
            .fixedSize(horizontal: false, vertical: true)
        if active != nil || upcoming != nil {
            label.privacySensitive()
        } else {
            label
        }
    }

    private func detailText(_ detail: String) -> some View {
        Text(detail)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(muted)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.78)
    }

    private var actionCopy: some View {
        HStack(spacing: 5) {
            Image(systemName: active == nil ? "arrow.up.right" : "play.fill")
                .font(.system(size: 8, weight: .bold))
                .accessibilityHidden(true)
            Text(actionTitle)
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
        }
        .foregroundStyle(lime)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(lime.opacity(0.13), in: Capsule())
        .widgetAccentable()
        .accessibilityHidden(true)
    }

    private var weekCard: some View {
        let visited = week?.filter { $0 }.count
        let todayColumn = (Calendar.current.component(.weekday, from: entry.date) + 5) % 7
        return VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Text("本周打卡")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(muted)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(muted)
            }
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(visited.map(String.init) ?? "–")
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                Text("天").font(.system(size: 10, weight: .semibold)).foregroundStyle(muted)
            }
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                ForEach(Array("一二三四五六日".enumerated()), id: \.offset) { pair in
                    weekColumn(String(pair.element), checked: week?[pair.offset] == true, today: todayColumn == pair.offset)
                }
            }
        }
        .padding(9)
        .frame(maxWidth: 130, maxHeight: .infinity, alignment: .leading)
        .background(.primary.opacity(fullColor ? 0.20 : 0.08), in: RoundedRectangle(cornerRadius: 13))
        .overlay {
            RoundedRectangle(cornerRadius: 13).strokeBorder(muted.opacity(0.23))
                .allowsHitTesting(false)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(visited.map { "本周打卡 \($0) 天" } ?? "本周打卡，等待同步")
    }

    private func weekColumn(_ label: String, checked: Bool, today: Bool) -> some View {
        VStack(spacing: 3) {
            ZStack(alignment: .bottom) {
                Capsule().fill(muted.opacity(0.25))
                if checked {
                    Capsule().fill(lime).widgetAccentable()
                }
                if today {
                    Capsule().strokeBorder(ink.opacity(checked ? 0.8 : 0.55), lineWidth: 1)
                }
            }
            .frame(width: 7, height: checked ? 14 : 8)
            .frame(height: 15, alignment: .bottom)
            Text(label)
                .font(.system(size: 8, weight: today ? .bold : .medium))
                .foregroundStyle(today ? ink : muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }

    private var accessoryStatus: String {
        if let active { return active.isRunning ? "训练中" : "训练已暂停" }
        if upcoming?.day == day { return "今日待练" }
        if todayCompleted > 0 { return "今日已打卡" }
        return snapshot == nil ? "打开训练搭子" : "查看训练日程"
    }

    private var accessoryProgress: Double {
        if let active, active.totalSets > 0 {
            return min(1, max(0, Double(active.completedSets) / Double(active.totalSets)))
        }
        if todayCompleted > 0 { return 1 }
        return 0
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            Circle()
                .strokeBorder(.primary.opacity(0.24), lineWidth: 2)
                .padding(6)
            if accessoryProgress > 0 {
                Circle()
                    .trim(from: 0, to: accessoryProgress)
                    .stroke(.primary, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(7)
                    .widgetAccentable()
            }
            Image(systemName: workoutSymbol)
                .font(.system(size: 16, weight: .semibold))
                .widgetAccentable()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessoryStatus)
    }

    private var rectangular: some View {
        HStack(spacing: 7) {
            Image(systemName: workoutSymbol)
                .font(.system(size: 14, weight: .semibold))
                .widgetAccentable()
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(accessoryStatus)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text("训练搭子")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("训练搭子，" + accessoryStatus)
    }

    private func workoutDateLabel(_ key: String) -> String {
        if key == day { return "今天" }
        if let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: entry.date),
           key == SpotterWidgetSnapshot.dayKey(for: tomorrow) { return "明天" }
        let parts = key.split(separator: "-")
        guard parts.count == 3, let month = Int(parts[1]), let date = Int(parts[2]) else { return "计划训练" }
        return "\(month)月\(date)日"
    }
}

#if DEBUG
struct SpotterTrainingWidgetPreviews: PreviewProvider {
    static var previews: some View {
        Group {
            SpotterTrainingWidgetView(entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            SpotterTrainingWidgetView(entry: .preview())
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            SpotterTrainingWidgetView(entry: .preview())
                .previewContext(WidgetPreviewContext(family: .accessoryCircular))
            SpotterTrainingWidgetView(entry: .preview())
                .previewContext(WidgetPreviewContext(family: .accessoryRectangular))
        }
    }
}
#endif
