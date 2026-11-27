import SwiftUI
import WidgetKit

private struct WatchWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: SpotterWatchWidgetSnapshot?

    var active: SpotterWatchWidgetSnapshot.Active? { snapshot?.active(at: date) }
    var next: SpotterWatchWidgetSnapshot.Next? { snapshot?.next(at: date) }

    static func example(at date: Date, active: Bool) -> Self {
        let snapshot = SpotterWatchWidgetSnapshot(
            generatedAt: date,
            active: active ? .init(completedSets: 8, totalSets: 16, isRunning: true) : nil,
            next: .init(title: "下肢力量", scheduledDate: date)
        )
        return .init(date: date, snapshot: snapshot)
    }
}

private struct WatchWidgetProvider: TimelineProvider {
    let previewsActiveWorkout: Bool

    func placeholder(in context: Context) -> WatchWidgetEntry {
        .example(at: .now, active: previewsActiveWorkout)
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchWidgetEntry) -> Void) {
        let now = Date.now
        completion(context.isPreview ? placeholder(in: context) : .init(date: now, snapshot: SpotterWatchWidgetStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchWidgetEntry>) -> Void) {
        let now = Date.now
        let snapshot = SpotterWatchWidgetStore.read()
        let dates = [now] + (snapshot?.refreshDates(after: now) ?? [])
        completion(Timeline(entries: dates.map { .init(date: $0, snapshot: snapshot) }, policy: .never))
    }
}

private let watchTrainingURL = URL(string: "spotter-watch://training")!

@main
struct SpotterWatchWidgets: WidgetBundle {
    var body: some Widget {
        WatchTrainingComplication()
        WatchNextWorkoutWidget()
    }
}

private struct WatchTrainingComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: SpotterWatchWidgetStore.circularKind,
            provider: WatchWidgetProvider(previewsActiveWorkout: true)
        ) { entry in
            WatchTrainingComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
                .widgetURL(watchTrainingURL)
        }
        .configurationDisplayName("开练")
        .description("打开腕上训练，查看正在进行的训练完成了几组。")
        .supportedFamilies([.accessoryCircular])
    }
}

private struct WatchTrainingComplicationView: View {
    let entry: WatchWidgetEntry

    var body: some View {
        Group {
            if let active = entry.active, active.totalSets > 0 {
                Gauge(value: min(1, Double(active.completedSets) / Double(active.totalSets))) {
                    Text(active.isRunning ? "训练" : "已暂停")
                } currentValueLabel: {
                    Text("\(active.completedSets)/\(active.totalSets)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(Color(red: 0.82, green: 0.98, blue: 0.54))
                .accessibilityLabel(active.isRunning ? "继续训练" : "训练已暂停")
                .accessibilityValue("已完成 \(active.completedSets) 组，共 \(active.totalSets) 组")
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: entry.active?.isRunning == false ? "pause.fill" : "play.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .widgetAccentable()
                }
                .accessibilityLabel(entry.active == nil ? "开练" : "继续训练")
            }
        }
    }
}

private struct WatchNextWorkoutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: SpotterWatchWidgetStore.nextKind,
            provider: WatchWidgetProvider(previewsActiveWorkout: false)
        ) { entry in
            WatchNextWorkoutView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(watchTrainingURL)
        }
        .configurationDisplayName("下一练")
        .description("在表盘或智能叠放查看下一堂计划，训练时可回到当前训练。")
        .supportedFamilies([.accessoryRectangular])
    }
}

private struct WatchNextWorkoutView: View {
    let entry: WatchWidgetEntry

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .frame(width: 24, height: 24)
                .background(.quinary, in: RoundedRectangle(cornerRadius: 7))
                .widgetAccentable()
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(heading)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let active = entry.active, active.totalSets > 0 {
                    Text("\(active.completedSets)/\(active.totalSets) 组 · 继续训练")
                        .monospacedDigit()
                        .lineLimit(1)
                } else if let next = entry.next, entry.active == nil {
                    Text(next.title).lineLimit(1).privacySensitive()
                } else {
                    Text(entry.active == nil ? "打开训练搭子" : "继续训练").lineLimit(1)
                }
            }
            .font(.system(size: 13, weight: .semibold))
            .minimumScaleFactor(0.78)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }

    private var icon: String {
        if let active = entry.active { return active.isRunning ? "dumbbell.fill" : "pause.fill" }
        return entry.next == nil ? "play.fill" : "calendar"
    }

    private var heading: String {
        if let active = entry.active { return active.isRunning ? "训练进行中" : "训练已暂停" }
        guard let next = entry.next else { return "下一练" }
        let calendar = Calendar.current
        if calendar.isDate(next.scheduledDate, inSameDayAs: entry.date) { return "下一练 · 今天" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: entry.date),
           calendar.isDate(next.scheduledDate, inSameDayAs: tomorrow) { return "下一练 · 明天" }
        return "下一练 · \(next.scheduledDate.formatted(.dateTime.month().day().locale(Locale(identifier: "zh_Hans_CN"))))"
    }
}
