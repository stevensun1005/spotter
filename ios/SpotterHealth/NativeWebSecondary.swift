import Charts
import SwiftUI
import UIKit
import UniformTypeIdentifiers

private let secondaryLilac = Color(red: 0.92, green: 0.90, blue: 0.96)
private let secondaryTeal = Color(red: 0.86, green: 0.94, blue: 0.92)
private let secondarySlate = Color(red: 0.90, green: 0.93, blue: 0.94)

private extension View {
    func secondaryCard(radius: CGFloat = 15) -> some View {
        background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(SpotterPalette.line, lineWidth: 1).allowsHitTesting(false))
    }

    func secondaryPage() -> some View {
        frame(maxWidth: 620, alignment: .leading)
            .padding(.horizontal, 15)
            .padding(.top, 12)
            .padding(.bottom, 22)
            .frame(maxWidth: .infinity)
    }
}

private struct SecondarySegment<Option: Hashable>: View {
    let options: [Option]
    @Binding var value: Option
    let title: (Option) -> String

    var body: some View {
        HStack(spacing: 3) {
            ForEach(options, id: \.self) { option in
                Button { value = option } label: {
                    Text(title(option))
                        .font(.caption.weight(value == option ? .bold : .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .foregroundStyle(value == option ? SpotterPalette.deep : SpotterPalette.muted)
                        .frame(maxWidth: .infinity, minHeight: 35)
                        .background(value == option ? SpotterPalette.wash : .clear, in: RoundedRectangle(cornerRadius: 8))
                        .contentShape(Rectangle())
                }.buttonStyle(.plain)
                    .accessibilityAddTraits(value == option ? .isSelected : [])
            }
        }
        .padding(3)
        .secondaryCard(radius: 11)
    }
}

private struct SecondarySelectionMenu<Option: Hashable>: View {
    let label: String
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String

    var body: some View {
        Menu {
            Picker(label, selection: $selection) {
                ForEach(options, id: \.self) { option in Text(title(option)).tag(option) }
            }
        } label: {
            HStack(spacing: 5) {
                Text(title(selection)).font(.subheadline).lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .accessibilityHidden(true)
            }
            .fixedSize(horizontal: true, vertical: false)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .foregroundStyle(SpotterPalette.deep)
        }
        .accessibilityLabel(label)
        .accessibilityValue(title(selection))
    }
}

private struct SecondaryActionHeader<Actions: View>: View {
    let title: String
    @ViewBuilder let actions: Actions

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                heading.fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: 4)
                actionRow
            }
            VStack(alignment: .leading, spacing: 2) {
                heading
                ViewThatFits(in: .horizontal) {
                    actionRow
                    VStack(alignment: .leading, spacing: 0) { actions }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var heading: some View {
        Text(title).font(.headline).accessibilityAddTraits(.isHeader)
    }

    private var actionRow: some View {
        HStack(spacing: 12) { actions }.fixedSize(horizontal: true, vertical: false)
    }
}

private struct SecondaryButtonStyle: ButtonStyle {
    var primary = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(primary ? SpotterPalette.deep : SpotterPalette.ink)
            .padding(.horizontal, 12)
            .frame(minHeight: 42)
            .background(primary ? SpotterPalette.lime : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(SpotterPalette.line, lineWidth: 1).allowsHitTesting(false))
            .spotterPressFeedback(configuration.isPressed)
    }
}

private struct SecondaryBadge: View {
    let text: String
    var green = false

    var body: some View {
        Text(text).font(.caption2.weight(.semibold))
            .foregroundStyle(green ? SpotterPalette.deep : SpotterPalette.muted)
            .padding(.horizontal, 7).padding(.vertical, 4)
            .background(green ? SpotterPalette.wash : SpotterPalette.background, in: Capsule())
    }
}

private struct SecondaryTile: View {
    let icon: String
    var color = SpotterPalette.wash
    var size: CGFloat = 34

    var body: some View {
        Image(systemName: icon).font(.system(size: min(18, size * 0.48), weight: .semibold))
            .foregroundStyle(SpotterPalette.deep)
            .frame(width: size, height: size)
            .background(color, in: RoundedRectangle(cornerRadius: size * 0.27))
            .accessibilityHidden(true)
    }
}

private struct SecondaryRow: View {
    let title: String
    var detail: String?
    let icon: String
    var color = secondarySlate
    var accessory: String? = "chevron.right"

    var body: some View {
        HStack(spacing: 12) {
            SecondaryTile(icon: icon, color: color)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                if let detail { Text(detail).font(.caption).foregroundStyle(SpotterPalette.muted) }
            }
            Spacer(minLength: 5)
            if let accessory {
                Image(systemName: accessory).font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .frame(minHeight: 55)
        .contentShape(Rectangle())
    }
}

private struct SecondaryGroup<Content: View>: View {
    var title: String? = nil
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title { Text(title).font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted).padding(.leading, 12) }
            VStack(alignment: .leading, spacing: 0) { content }.secondaryCard()
        }
    }
}

private struct SecondaryNotice: View {
    let message: String
    var warning = false

    var body: some View {
        Text(message).font(.footnote)
            .foregroundStyle(warning ? Color.red : SpotterPalette.muted)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 9))
    }
}

private enum SecondaryDate {
    static var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.firstWeekday = 2
        return value
    }

    static func shift(_ date: Date, _ value: Int, component: Calendar.Component = .day) -> Date {
        calendar.date(byAdding: component, value: value, to: date) ?? date
    }

    static func parse(_ day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func days(_ start: Date, through end: Date) -> Int {
        (calendar.dateComponents([.day], from: start, to: end).day ?? 0) + 1
    }

    static func weekStart(_ date: Date) -> Date {
        shift(date, -((calendar.component(.weekday, from: date) + 5) % 7))
    }

    static func monthStart(_ date: Date) -> Date {
        calendar.dateInterval(of: .month, for: date)?.start ?? date
    }

    static var today: Date { calendar.startOfDay(for: .now) }
}

private enum SecondaryMetric: String, CaseIterable, Hashable {
    case volume = "训练容量", sessions = "训练次数", minutes = "训练时长", sets = "完成组数"

    var unit: String {
        switch self { case .volume: return "kg"; case .sessions: return "次"; case .minutes: return "分钟"; case .sets: return "组" }
    }

    var icon: String {
        switch self { case .volume: return "chart.bar.xaxis"; case .sessions: return "calendar"; case .minutes: return "clock"; case .sets: return "checkmark" }
    }

    func value(in entries: [NativeWorkoutEntry]) -> Double {
        entries.reduce(0) { total, entry in
            switch self {
            case .volume: return total + (entry.session?.volumeKg ?? 0)
            case .sessions: return total + 1
            case .minutes: return total + Double(entry.durationMinutes)
            case .sets: return total + Double(entry.session?.completedSets ?? 0)
            }
        }
    }
}

@MainActor
struct NativeSpotterStats: View {
    @ObservedObject var store: NativeWorkoutStore
    let api: NativeAPI
    let owner: String

    private enum Page: String, CaseIterable { case overview = "训练统计", history = "打卡历史" }
    private enum Period: String, CaseIterable { case week = "周", month = "月", quarter = "季", year = "年", recent = "最近", custom = "自定义" }
    private enum Compare: String, CaseIterable { case previous = "上一周期", year = "上年同期", off = "关闭对比" }

    @State private var page = Page.overview
    @State private var period = Period.week
    @State private var step = 0
    @State private var recent = 30
    @State private var customStart = SecondaryDate.shift(SecondaryDate.today, -29)
    @State private var customEnd = SecondaryDate.today
    @State private var comparison = Compare.previous
    @State private var metric = SecondaryMetric.volume
    @State private var trend = SecondaryMetric.volume
    @State private var partner: SecondaryFriend?
    @State private var partnerSelected = false

    private var sharedLogs: [NativeWorkoutEntry] {
        guard let partner else { return [] }
        return store.entries.filter { $0.kind == "log" && $0.owner == partner.id }
    }

    private var subjectLogs: [NativeWorkoutEntry] { partnerSelected && partner != nil ? sharedLogs : store.logs }
    private var range: ClosedRange<Date> { range(at: step) }
    private var comparedRange: ClosedRange<Date> {
        if comparison == .year {
            return SecondaryDate.shift(range.lowerBound, -1, component: .year)...SecondaryDate.shift(range.upperBound, -1, component: .year)
        }
        if period == .custom {
            return SecondaryDate.shift(range.lowerBound, -rangeCount(range))...SecondaryDate.shift(range.lowerBound, -1)
        }
        return self.range(at: step - 1)
    }

    private func range(at offset: Int) -> ClosedRange<Date> {
        let today = SecondaryDate.today
        switch period {
        case .custom: return customStart...max(customEnd, customStart)
        case .week:
            let start = SecondaryDate.shift(SecondaryDate.weekStart(today), offset * 7)
            return start...SecondaryDate.shift(start, 6)
        case .recent:
            let end = SecondaryDate.shift(today, offset * recent)
            return SecondaryDate.shift(end, 1 - recent)...end
        default:
            let calendar = SecondaryDate.calendar
            let year = calendar.component(.year, from: today)
            let month = calendar.component(.month, from: today)
            let width = period == .year ? 12 : period == .quarter ? 3 : 1
            guard let base = calendar.date(from: DateComponents(year: year, month: (month - 1) / width * width + 1, day: 1)) else { return today...today }
            let start = SecondaryDate.shift(base, offset * width, component: .month)
            return start...SecondaryDate.shift(SecondaryDate.shift(start, width, component: .month), -1)
        }
    }

    private func rangeCount(_ interval: ClosedRange<Date>) -> Int { max(1, SecondaryDate.days(interval.lowerBound, through: interval.upperBound)) }

    private func logs(_ interval: ClosedRange<Date>) -> [NativeWorkoutEntry] {
        let from = spotterDay(interval.lowerBound)
        let to = spotterDay(interval.upperBound)
        return subjectLogs.filter { $0.day >= from && $0.day <= to }
    }

    private func label(_ interval: ClosedRange<Date>, short: Bool = false) -> String {
        let from = spotterDay(interval.lowerBound)
        let to = spotterDay(interval.upperBound)
        return short ? "\(from.suffix(5)) 至 \(to.suffix(5))" : "\(from) — \(to)"
    }

    private var periodTitle: String {
        let calendar = SecondaryDate.calendar
        let year = calendar.component(.year, from: range.lowerBound)
        let month = calendar.component(.month, from: range.lowerBound)
        switch period {
        case .year: return "\(year) 年"
        case .quarter: return "\(year) 年第 \((month - 1) / 3 + 1) 季度"
        case .month: return "\(year) 年 \(month) 月"
        default: return label(range, short: true)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                Text("统计").font(.system(.largeTitle, weight: .heavy)).padding(.bottom, 4).accessibilityAddTraits(.isHeader)
                SecondarySegment(options: Page.allCases, value: $page, title: \.rawValue)
                if page == .overview { overview }
                else { SecondaryHistory(api: api, owner: owner, entries: store.logs + sharedLogs, partner: sharedLogs.isEmpty ? nil : partner) }
            }.foregroundStyle(SpotterPalette.ink).secondaryPage()
        }
        .background(SpotterPalette.background)
        .refreshable { await store.load(); await loadPartner() }
        .task { await loadPartner() }
    }

    private var canStepForward: Bool {
        period == .custom ? SecondaryDate.shift(customEnd, rangeCount(range)) <= SecondaryDate.today : step < 0
    }

    private func shiftPeriod(_ delta: Int) {
        if period == .custom {
            let distance = rangeCount(range) * delta
            customStart = SecondaryDate.shift(customStart, distance)
            customEnd = SecondaryDate.shift(customEnd, distance)
        } else { step += delta }
    }

    private var overview: some View {
        let current = logs(range)
        let former = comparison == .off ? nil : logs(comparedRange)
        return VStack(spacing: 9) {
            rangePicker
            if rangeCount(range) > 3_660 {
                SecondaryNotice(message: "请选择有效日期，范围最长 10 年。", warning: true)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)], spacing: 7) {
                    ForEach(SecondaryMetric.allCases, id: \.self) { tile($0, current: current, former: former) }
                }
                comparisonCard(current: current, former: former)
                trendCard(current: current, former: former)
                SecondaryActivityCalendar(entries: subjectLogs, end: min(range.upperBound, SecondaryDate.today))
                SecondaryMusclePanel(entries: current)
                SecondaryPerformance(entries: current, compared: former)
            }
        }
    }

    private var rangePicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let partner, !sharedLogs.isEmpty {
                SecondarySegment(options: [false, true], value: $partnerSelected) { $0 ? "搭子 · \(partner.name)" : "我" }
            }
            SecondarySegment(options: Period.allCases, value: $period, title: \.rawValue)
                .onChange(of: period) { _ in step = 0 }
            if period == .recent {
                Picker("最近天数", selection: $recent) { ForEach([7, 30, 90, 365], id: \.self) { Text("\($0) 天").tag($0) } }
                    .onChange(of: recent) { _ in step = 0 }
            }
            if period == .custom {
                DatePicker("开始日期", selection: $customStart, in: (SecondaryDate.parse("1900-01-01") ?? customStart)...SecondaryDate.today, displayedComponents: .date)
                    .onChange(of: customStart) { customEnd = max(customEnd, $0) }
                DatePicker("结束日期", selection: $customEnd, in: customStart...SecondaryDate.today, displayedComponents: .date)
            }
            HStack {
                stepButton("上一周期", symbol: "chevron.left") { shiftPeriod(-1) }
                    .disabled(spotterDay(range.lowerBound) < "1901-01-01" || rangeCount(range) > 3_660)
                Spacer(minLength: 0)
                VStack(spacing: 3) {
                    Text(periodTitle).font(.subheadline.weight(.bold)).foregroundStyle(SpotterPalette.deep)
                    Text(label(range)).font(.caption2.monospacedDigit()).foregroundStyle(SpotterPalette.muted).lineLimit(1)
                }
                Spacer(minLength: 0)
                stepButton("下一周期", symbol: "chevron.right") { shiftPeriod(1) }.disabled(!canStepForward)
            }.background(SpotterPalette.wash.opacity(0.58), in: RoundedRectangle(cornerRadius: 9))
        }.padding(9).secondaryCard()
    }

    private func tile(_ key: SecondaryMetric, current: [NativeWorkoutEntry], former: [NativeWorkoutEntry]?) -> some View {
        let lead = key == .volume
        let value = key.value(in: current)
        let difference = former.map { value - key.value(in: $0) } ?? 0
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(key == .sessions ? "训练次数 / 天数" : key.rawValue).font(.caption.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 2)
                SecondaryTile(icon: key.icon, color: lead ? SpotterPalette.lime : SpotterPalette.wash, size: 25)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(statNumber(value)).font(.title2.weight(.heavy)).monospacedDigit().minimumScaleFactor(0.65).lineLimit(1)
                    .foregroundStyle(lead ? Color.white : SpotterPalette.ink)
                Text(key.unit + (key == .sessions ? " · \(Set(current.map(\.day)).count) 天" : "")).font(.caption.weight(.medium)).lineLimit(1)
            }
            if let former {
                Text(former.isEmpty ? "对比期暂无记录" : "较对比期 \(difference > 0 ? "+" : "")\(statNumber(difference)) \(key.unit)")
                    .font(.caption2).lineLimit(1)
            }
        }
        .foregroundStyle(lead ? Color.white.opacity(0.82) : SpotterPalette.muted)
        .padding(10)
        .background(lead ? SpotterPalette.color(0x21442f) : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(SpotterPalette.line, lineWidth: lead ? 0 : 1).allowsHitTesting(false))
    }

    private func comparisonCard(current: [NativeWorkoutEntry], former: [NativeWorkoutEntry]?) -> some View {
        let value = metric.value(in: current) / Double(metric == .volume ? rangeCount(range) : 1)
        let prior = former.map { metric.value(in: $0) / Double(metric == .volume ? rangeCount(comparedRange) : 1) } ?? 0
        let scale = max(1, value, prior)
        return VStack(alignment: .leading, spacing: 9) {
            SecondaryActionHeader(title: "周期对比") {
                metricSelect("对比指标", value: $metric)
                SecondarySelectionMenu(label: "比较范围", options: Compare.allCases, selection: $comparison, title: \.rawValue)
            }
            comparisonRow("本期", value: value, scale: scale, period: range, empty: current.isEmpty)
            if let former { comparisonRow("对比期", value: prior, scale: scale, period: comparedRange, empty: former.isEmpty) }
        }.padding(12).secondaryCard()
    }

    private func comparisonRow(_ title: String, value: Double, scale: Double, period: ClosedRange<Date>, empty: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(title).font(.caption)
                Spacer()
                Text(empty ? "—" : statNumber(value)).font(.title3.weight(.heavy)).foregroundStyle(SpotterPalette.deep).monospacedDigit()
                Text(metric.unit + (metric == .volume ? "/天" : "")).font(.caption2)
            }
            ProgressView(value: max(0, value), total: scale).tint(SpotterPalette.accent)
            Text(label(period) + (empty ? " · 暂无记录" : "")).font(.caption2)
        }.foregroundStyle(SpotterPalette.muted).padding(10).background(SpotterPalette.wash.opacity(0.58), in: RoundedRectangle(cornerRadius: 10))
    }

    private func metricSelect(_ title: String, value: Binding<SecondaryMetric>) -> some View {
        SecondarySelectionMenu(label: title, options: SecondaryMetric.allCases, selection: value, title: \.rawValue)
    }

    private func trendCard(current: [NativeWorkoutEntry], former: [NativeWorkoutEntry]?) -> some View {
        let points = max(2, min(120, max(rangeCount(range), rangeCount(comparedRange))))
        let here = cumulative(current, in: range, points: points)
        let before = former.map { cumulative($0, in: comparedRange, points: points) }
        return VStack(alignment: .leading, spacing: 9) {
            SecondaryActionHeader(title: "累计趋势") { metricSelect("趋势指标", value: $trend) }
            HStack(spacing: 23) {
                trendTotal("本期累计", value: trend.value(in: current))
                if let former { trendTotal("对比期累计", value: trend.value(in: former)) }
            }
            if current.isEmpty && (former?.isEmpty ?? true) {
                SecondaryNotice(message: "这个周期打卡后，这里会显示累计曲线。")
            } else {
                Chart(0..<points, id: \.self) { index in
                    if let before {
                        LineMark(x: .value("进度", index), y: .value("对比期", before[index]), series: .value("时间", "对比期"))
                            .foregroundStyle(SpotterPalette.muted).lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4])).interpolationMethod(.stepEnd)
                    }
                    AreaMark(x: .value("进度", index), y: .value("本期", here[index]))
                        .foregroundStyle(LinearGradient(colors: [SpotterPalette.accent.opacity(0.35), SpotterPalette.accent.opacity(0.04)], startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.stepEnd)
                    LineMark(x: .value("进度", index), y: .value("本期", here[index]), series: .value("时间", "本期"))
                        .foregroundStyle(SpotterPalette.accent).interpolationMethod(.stepEnd)
                }
                .chartXAxis {
                    AxisMarks(values: [0, (points - 1) / 2, points - 1]) { value in
                        if let index = value.as(Int.self) {
                            AxisValueLabel { Text(spotterDay(SecondaryDate.shift(range.lowerBound, (rangeCount(range) - 1) * index / (points - 1))).suffix(5)) }
                        }
                    }
                }
                .frame(height: 218).accessibilityLabel("\(trend.rawValue)累计趋势")
            }
        }.padding(12).secondaryCard()
    }

    private func trendTotal(_ title: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption)
            Text("\(statNumber(value)) \(trend.unit)").font(.subheadline.weight(.bold)).monospacedDigit()
        }.foregroundStyle(SpotterPalette.accent)
    }

    private func cumulative(_ entries: [NativeWorkoutEntry], in interval: ClosedRange<Date>, points: Int) -> [Double] {
        let daily = Dictionary(grouping: entries, by: \.day).mapValues { trend.value(in: $0) }.sorted { $0.key < $1.key }
        var cursor = 0
        var total = 0.0
        return (0..<points).map { index in
            let day = spotterDay(SecondaryDate.shift(interval.lowerBound, (rangeCount(interval) - 1) * index / (points - 1)))
            while cursor < daily.count, daily[cursor].key <= day { total += daily[cursor].value; cursor += 1 }
            return total
        }
    }

    private func loadPartner() async {
        if let data = try? await api.spotterRead("/api/friends", as: SecondaryFriendList.self) {
            partner = data.friends.first(where: \.buddy)
            if partner == nil { partnerSelected = false }
        }
    }
}

private func statNumber(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(0...1))) }

private func stepButton(_ name: String, symbol: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: symbol).font(.subheadline.weight(.semibold)).frame(width: 40, height: 40).contentShape(Rectangle())
    }.buttonStyle(.plain).accessibilityLabel(name)
}

private struct SecondaryActivityCalendar: View {
    let entries: [NativeWorkoutEntry]
    let end: Date
    @State private var selected: String?

    private static let colors = [
        Color(red: 0.90, green: 0.93, blue: 0.90), Color(red: 0.77, green: 0.89, blue: 0.76),
        Color(red: 0.55, green: 0.78, blue: 0.57), Color(red: 0.33, green: 0.64, blue: 0.45),
        Color(red: 0.15, green: 0.45, blue: 0.30)
    ]

    var body: some View {
        let first = SecondaryDate.shift(end, -364)
        let from = spotterDay(first)
        let to = spotterDay(end)
        let daily = Dictionary(grouping: entries.filter { $0.day >= from && $0.day <= to }, by: \.day)
        let start = SecondaryDate.shift(first, 1 - SecondaryDate.calendar.component(.weekday, from: first))
        let weeks = (SecondaryDate.days(start, through: end) + 6) / 7
        return VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Text("训练活跃日历").font(.headline)
                Spacer(minLength: 4)
                Text("过去一年 \(daily.values.reduce(0) { $0 + $1.count }) 次打卡").font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .bottom, spacing: 5) {
                    VStack(spacing: 3) {
                        ForEach(Array(["", "一", "", "三", "", "五", ""].enumerated()), id: \.offset) { _, label in
                            Text(label).font(.caption2).frame(width: 13, height: 14)
                        }
                    }.foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                    ScrollViewReader { proxy in
                        ScrollView(.horizontal) {
                            HStack(spacing: 3) {
                                ForEach(0..<weeks, id: \.self) { week in
                                    VStack(spacing: 3) {
                                        Text(monthTitle(SecondaryDate.shift(start, 7 * week)))
                                            .font(.system(size: 8)).fixedSize().frame(width: 14, height: 12)
                                        ForEach(0..<7, id: \.self) { day in
                                            let date = SecondaryDate.shift(start, 7 * week + day)
                                            let key = spotterDay(date)
                                            if date >= first && date <= end {
                                                cell(key, entries: daily[key, default: []])
                                            } else { Color.clear.frame(width: 14, height: 14) }
                                        }
                                    }.id(week)
                                }
                            }.padding(.horizontal, 2)
                        }
                        .onAppear { proxy.scrollTo(weeks - 1, anchor: .trailing) }
                        .onChange(of: end) { _ in selected = nil; proxy.scrollTo(weeks - 1, anchor: .trailing) }
                    }
                }
                HStack(spacing: 4) {
                    Text("\(from) — \(to)").lineLimit(1).minimumScaleFactor(0.65)
                    Spacer(minLength: 2)
                    Text("少")
                    ForEach(Self.colors.indices, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 2).fill(Self.colors[index]).frame(width: 10, height: 10)
                    }
                    Text("多")
                }.font(.caption2).foregroundStyle(SpotterPalette.muted)
                if let selected, selected >= from, selected <= to {
                    Text("\(selected) · \(description(daily[selected, default: []]))").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }.padding(9).secondaryCard(radius: 10)
        }.padding(12).secondaryCard()
    }

    private func monthTitle(_ day: Date) -> String {
        let calendar = SecondaryDate.calendar
        return calendar.component(.day, from: day) <= 7 ? "\(calendar.component(.month, from: day))月" : ""
    }

    private func description(_ entries: [NativeWorkoutEntry]) -> String {
        if entries.isEmpty { return "当天无训练记录" }
        let values = [SecondaryMetric.volume, .sets, .minutes].compactMap { metric -> String? in
            let value = metric.value(in: entries)
            return value > 0 ? "\(statNumber(value)) \(metric.unit)" : nil
        }
        return values.isEmpty ? "已打卡，训练量未记录" : values.joined(separator: " · ")
    }

    private func cell(_ key: String, entries: [NativeWorkoutEntry]) -> some View {
        let volume = SecondaryMetric.volume.value(in: entries)
        let sets = SecondaryMetric.sets.value(in: entries)
        let minutes = SecondaryMetric.minutes.value(in: entries)
        let (amount, thresholds) = volume > 0 ? (volume, [500.0, 1_500, 3_000]) : sets > 0 ? (sets, [5, 10, 18]) : (minutes, [15, 30, 60])
        let level = amount > 0 ? 1 + thresholds.filter { amount >= $0 }.count : 0
        return Button { selected = key } label: {
            RoundedRectangle(cornerRadius: 2).fill(Self.colors[level])
                .overlay(RoundedRectangle(cornerRadius: 2).strokeBorder(selected == key ? SpotterPalette.deep : SpotterPalette.line, lineWidth: 1))
                .frame(width: 14, height: 14)
        }.buttonStyle(.plain).accessibilityLabel("\(key) · \(description(entries))")
    }
}

private struct SecondarySVGPath {
    private let bytes: [UInt8]
    private var index = 0

    init(_ source: String) { bytes = Array(source.utf8) }

    mutating func parse() -> Path? {
        var path = Path()
        var point = CGPoint.zero
        var start = CGPoint.zero
        var command: UInt8 = 0
        while true {
            skipSeparators()
            guard index < bytes.count else { return path.isEmpty ? nil : path }
            if (65...90).contains(bytes[index]) || (97...122).contains(bytes[index]) {
                command = bytes[index]
                index += 1
            }
            let relative = command >= 97
            let base = relative ? point : .zero
            switch command {
            case 77, 109: // M, m
                guard let next = pair(base) else { return nil }
                path.move(to: next)
                point = next
                start = next
                command = relative ? 108 : 76
            case 76, 108: // L, l
                guard let next = pair(base) else { return nil }
                path.addLine(to: next)
                point = next
            case 72, 104: // H, h
                guard let x = number() else { return nil }
                point.x = base.x + x
                path.addLine(to: point)
            case 86, 118: // V, v
                guard let y = number() else { return nil }
                point.y = base.y + y
                path.addLine(to: point)
            case 67, 99: // C, c
                guard let first = pair(base), let second = pair(base), let next = pair(base) else { return nil }
                path.addCurve(to: next, control1: first, control2: second)
                point = next
            case 81, 113: // Q, q
                guard let control = pair(base), let next = pair(base) else { return nil }
                path.addQuadCurve(to: next, control: control)
                point = next
            case 65, 97: // A, a
                guard let rx = number(), let ry = number(), let angle = number(),
                      let large = flag(), let sweep = flag(), let next = pair(base) else { return nil }
                Self.addArc(to: &path, from: point, target: next, rx: rx, ry: ry, rotation: angle, large: large, sweep: sweep)
                point = next
            case 90, 122: // Z, z
                path.closeSubpath()
                point = start
                command = 0
            default: return nil
            }
        }
    }

    private mutating func skipSeparators() {
        while index < bytes.count, bytes[index] == 44 || bytes[index] <= 32 { index += 1 }
    }

    private mutating func number() -> CGFloat? {
        skipSeparators()
        let begin = index
        if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
        while index < bytes.count, (48...57).contains(bytes[index]) { index += 1 }
        if index < bytes.count, bytes[index] == 46 {
            index += 1
            while index < bytes.count, (48...57).contains(bytes[index]) { index += 1 }
        }
        if index < bytes.count, bytes[index] == 69 || bytes[index] == 101 {
            index += 1
            if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
            while index < bytes.count, (48...57).contains(bytes[index]) { index += 1 }
        }
        guard index > begin, let value = Double(String(decoding: bytes[begin..<index], as: UTF8.self)), value.isFinite else { return nil }
        return CGFloat(value)
    }

    private mutating func pair(_ base: CGPoint) -> CGPoint? {
        guard let x = number(), let y = number() else { return nil }
        return CGPoint(x: base.x + x, y: base.y + y)
    }

    private mutating func flag() -> Bool? {
        skipSeparators()
        guard index < bytes.count, bytes[index] == 48 || bytes[index] == 49 else { return nil }
        let value = bytes[index] == 49
        index += 1
        return value
    }

    // SVG 2, Appendix B.2: convert the ellipse endpoints to a transformed unit circle.
    private static func addArc(to path: inout Path, from begin: CGPoint, target end: CGPoint,
                               rx: CGFloat, ry: CGFloat, rotation: CGFloat, large: Bool, sweep: Bool) {
        guard begin != end else { return }
        var radiusX = abs(rx)
        var radiusY = abs(ry)
        guard radiusX > 0, radiusY > 0 else { path.addLine(to: end); return }
        let radians = rotation.truncatingRemainder(dividingBy: 360) * .pi / 180
        let cosine = cos(radians)
        let sine = sin(radians)
        let dx = (begin.x - end.x) / 2
        let dy = (begin.y - end.y) / 2
        let x = cosine * dx + sine * dy
        let y = -sine * dx + cosine * dy
        let radiusScale = max(1, hypot(x / radiusX, y / radiusY))
        radiusX *= radiusScale
        radiusY *= radiusScale
        let unitX = x / radiusX
        let unitY = y / radiusY
        let distance = unitX * unitX + unitY * unitY
        guard distance > 0 else { path.addLine(to: end); return }
        let multiplier = (large == sweep ? -1.0 : 1.0) * sqrt(max(0, 1 / distance - 1))
        let centerX = multiplier * unitY * radiusX
        let centerY = -multiplier * unitX * radiusY
        let from = atan2((y - centerY) / radiusY, (x - centerX) / radiusX)
        let to = atan2((-y - centerY) / radiusY, (-x - centerX) / radiusX)
        var delta = to - from
        if sweep && delta < 0 { delta += 2 * .pi }
        if !sweep && delta > 0 { delta -= 2 * .pi }
        let transform = CGAffineTransform(a: cosine * radiusX, b: sine * radiusX,
                                          c: -sine * radiusY, d: cosine * radiusY,
                                          tx: cosine * centerX - sine * centerY + (begin.x + end.x) / 2,
                                          ty: sine * centerX + cosine * centerY + (begin.y + end.y) / 2)
        path.addRelativeArc(center: .zero, radius: 1, startAngle: .radians(from), delta: .radians(delta), transform: transform)
    }
}

private struct SecondaryAnatomy: View {
    let counts: [String: Int]
    @State private var figure = Figure.male
    @State private var artwork = [String: Drawing]()
    @State private var selected: String?
    @State private var loaded = false

    private enum Figure: String, CaseIterable {
        case male, female
        var title: String { self == .male ? "男性图" : "女性图" }
    }

    private enum Side: String, CaseIterable {
        case front, back
        var title: String { self == .front ? "正面" : "背面" }
    }

    private struct Source: Decodable { let viewBox: String; let regions: [String: [String]] }
    private struct Region: Sendable { let key: String; let paths: [Path] }
    private struct Drawing: Sendable {
        let box: CGRect
        let regions: [Region]

        func placement(in size: CGSize) -> (scale: CGFloat, offset: CGPoint) {
            let scale = min(size.width / box.width, size.height / box.height)
            return (scale, CGPoint(x: (size.width - box.width * scale) / 2 - box.minX * scale,
                                   y: (size.height - box.height * scale) / 2 - box.minY * scale))
        }
    }

    private static let colors = [0xd5e3ff, 0xb3c9ff, 0x8caaff, 0x4f72cb, 0x273e9c].map { SpotterPalette.color(UInt32($0)) }
    private static let neutral = SpotterPalette.color(0xdce4ef)
    private static let exterior = SpotterPalette.color(0xf3f6fc)
    private static let outline = SpotterPalette.color(0xf7f9fe)
    private static let aliases = [
        "upper-chest": "chest", "lower-chest": "chest", "upper-abs": "abs", "lower-abs": "abs",
        "front-deltoid": "front-delts", "rear-deltoid": "rear-delts", "deltoids": "side-delts",
        "upper-trapezius": "trapezius", "lower-trapezius": "trapezius", "inner-quad": "quadriceps",
        "outer-quad": "quadriceps", "rhomboids": "upper-back", "rotator-cuff": "rear-delts"
    ]
    private static let names = [
        "chest": "胸大肌", "upper-chest": "胸大肌上束", "lower-chest": "胸大肌中下束", "serratus": "前锯肌",
        "trapezius": "斜方肌", "upper-trapezius": "上斜方肌", "lower-trapezius": "下斜方肌", "lats": "背阔肌",
        "upper-back": "上背", "lower-back": "下背／竖脊肌", "rhomboids": "菱形肌", "rotator-cuff": "肩袖",
        "front-delts": "三角肌前束", "side-delts": "三角肌中束", "rear-delts": "三角肌后束", "biceps": "肱二头肌",
        "triceps": "肱三头肌", "forearm": "前臂", "abs": "腹直肌", "upper-abs": "上腹", "lower-abs": "下腹",
        "obliques": "腹斜肌", "gluteal": "臀肌", "quadriceps": "股四头肌", "inner-quad": "股四头肌内侧",
        "outer-quad": "股四头肌外侧", "hamstring": "腘绳肌", "adductors": "大腿内收肌", "hip-flexors": "髋屈肌",
        "calves": "小腿后侧", "tibialis": "胫骨前肌"
    ]

    var body: some View {
        VStack(spacing: 8) {
            SecondarySegment(options: Figure.allCases, value: $figure, title: \.title)
                .accessibilityLabel("肌群图体型")
            if loaded, !artwork.isEmpty {
                HStack(spacing: 9) {
                    ForEach(Side.allCases, id: \.self) { side in
                        if let drawing = artwork["\(figure.rawValue)-\(side.rawValue)"] { diagram(drawing, side: side) }
                    }
                }
                Text(selected.map(description) ?? "点图上任一区域可以查看名称")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                HStack(spacing: 4) {
                    Text("未训练")
                    colorChip(Self.neutral)
                    Text("少")
                    ForEach(Self.colors.indices, id: \.self) { index in colorChip(Self.colors[index]) }
                    Text("多")
                }
                .font(.caption2).foregroundStyle(SpotterPalette.muted)
                .accessibilityLabel("蓝色越深代表完成组数越多")
            } else if loaded { SecondaryNotice(message: "肌肉图暂时无法读取。") }
            else { ProgressView("正在读取肌肉图…") }
        }
        .onChange(of: figure) { _ in selected = nil }
        .task {
            artwork = await Task.detached(priority: .utility) { Self.loadArtwork() }.value
            loaded = true
        }
    }

    private func name(_ region: String) -> String? { Self.names[region] ?? Self.aliases[region].flatMap { Self.names[$0] } }
    private func count(_ region: String) -> Int { counts[region] ?? Self.aliases[region].flatMap { counts[$0] } ?? 0 }
    private func description(_ region: String) -> String { "\(name(region) ?? region) · \(count(region)) 组" }

    private func colorChip(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 13, height: 9).accessibilityHidden(true)
    }

    private func diagram(_ drawing: Drawing, side: Side) -> some View {
        let highest = max(1, counts.values.max() ?? 0)
        let accessible = drawing.regions.filter { name($0.key) != nil && count($0.key) > 0 }.map { description($0.key) }
        return VStack(spacing: 4) {
            GeometryReader { geometry in
                Canvas { context, size in
                    let placement = drawing.placement(in: size)
                    var canvas = context
                    canvas.translateBy(x: placement.offset.x, y: placement.offset.y)
                    canvas.scaleBy(x: placement.scale, y: placement.scale)
                    for region in drawing.regions {
                        let total = count(region.key)
                        let level = max(0, min(4, Int(ceil(Double(total) / Double(highest) * 5)) - 1))
                        let fill = total > 0 ? Self.colors[level] : name(region.key) == nil ? Self.exterior : Self.neutral
                        for path in region.paths {
                            canvas.fill(path, with: .color(fill))
                            canvas.stroke(path, with: .color(Self.outline), lineWidth: 2.3)
                        }
                    }
                }
                .contentShape(Rectangle())
                .gesture(SpatialTapGesture().onEnded { event in
                    let placement = drawing.placement(in: geometry.size)
                    guard placement.scale > 0 else { return }
                    let point = CGPoint(x: (event.location.x - placement.offset.x) / placement.scale,
                                        y: (event.location.y - placement.offset.y) / placement.scale)
                    if let region = drawing.regions.last(where: { name($0.key) != nil && $0.paths.contains { $0.contains(point) } }) {
                        selected = region.key
                        UIAccessibility.post(notification: .announcement, argument: description(region.key))
                    }
                })
            }
            .frame(height: 193)
            .accessibilityLabel("\(figure == .female ? "女性" : "男性")\(side.title)肌肉解剖图")
            .accessibilityValue(accessible.isEmpty ? "未训练" : accessible.joined(separator: "，"))
            .accessibilityAddTraits(.isImage)
            Text(side.title).font(.caption2).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
        }.frame(maxWidth: .infinity)
    }

    nonisolated private static func loadArtwork() -> [String: Drawing] {
        guard let url = Bundle.main.url(forResource: "anatomy", withExtension: "json"),
              let data = try? Data(contentsOf: url), let source = try? JSONDecoder().decode([String: Source].self, from: data) else { return [:] }
        let json = String(decoding: data, as: UTF8.self)
        let figureStarts = source.keys.compactMap { key in
            json.range(of: "\"\(key)\"").map { (key, $0.lowerBound) }
        }.sorted { $0.1 < $1.1 }
        let layers = ["head", "hair", "feet", "hands", "knees", "ankles", "neck", "gluteal", "quadriceps", "chest", "abs", "trapezius", "upper-back", "deltoids"]
        var drawings = [String: Drawing]()
        for (index, location) in figureStarts.enumerated() {
            let (key, start) = location
            guard let figure = source[key] else { continue }
            let size = figure.viewBox.split(separator: " ").compactMap { Double($0) }
            guard size.count == 4, size[2] > 0, size[3] > 0 else { continue }
            let end = figureStarts.indices.contains(index + 1) ? figureStarts[index + 1].1 : json.endIndex
            let original = json[start..<end]
            // The web keeps original JSON order for regions outside its explicit layer list.
            let positions = figure.regions.keys.reduce(into: [String: String.Index]()) { result, name in
                result[name] = original.range(of: "\"\(name)\"")?.lowerBound
            }
            let keys = figure.regions.keys.sorted { left, right in
                let a = layers.firstIndex(of: left) ?? layers.count
                let b = layers.firstIndex(of: right) ?? layers.count
                return a == b ? (positions[left] ?? end) < (positions[right] ?? end) : a < b
            }
            var regions = [Region]()
            for name in keys {
                let commands = figure.regions[name, default: []]
                let paths = commands.compactMap { command in
                    var parser = SecondarySVGPath(command)
                    return parser.parse()
                }
                guard paths.count == commands.count else { break }
                regions.append(Region(key: name, paths: paths))
            }
            guard regions.count == keys.count else { continue }
            drawings[key] = Drawing(box: CGRect(x: size[0], y: size[1], width: size[2], height: size[3]), regions: regions)
        }
        return drawings
    }
}

private struct SecondaryMusclePanel: View {
    let entries: [NativeWorkoutEntry]
    @State private var layer = Layer.primary
    @State private var catalogue: Catalog?
    @State private var unavailable = false

    private enum Layer: String, CaseIterable { case primary = "主要训练", secondary = "辅助参与" }
    private struct Catalog: Sendable { let byID: [String: [String: NativeJSON]]; let byName: [String: [String: NativeJSON]] }
    private static let groups: [(String, Set<String>)] = [
        ("胸部", ["chest", "upper-chest", "lower-chest", "serratus"]),
        ("背部", ["lats", "upper-back", "lower-back", "rhomboids", "trapezius", "upper-trapezius", "lower-trapezius"]),
        ("臀腿", ["gluteal", "quadriceps", "inner-quad", "outer-quad", "hamstring", "adductors", "hip-flexors", "abductors"]),
        ("肩部", ["front-delts", "side-delts", "rear-delts", "rotator-cuff"]),
        ("手臂", ["biceps", "triceps", "forearm"]),
        ("核心", ["abs", "upper-abs", "lower-abs", "obliques"]),
        ("小腿", ["calves", "tibialis"])
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("肌群训练分布").font(.headline)
            Text("按完成的正式组计数，不含热身。每组可能训练多个肌群。").font(.caption).foregroundStyle(SpotterPalette.muted)
            SecondarySegment(options: Layer.allCases, value: $layer, title: \.rawValue)
            if let catalogue {
                let (totals, counts) = distribution(catalogue)
                let highest = max(1, totals.max() ?? 0)
                SecondaryAnatomy(counts: counts)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3), spacing: 7) {
                    ForEach(Self.groups.indices, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(Self.groups[index].0).font(.caption.weight(.semibold))
                            Text("\(totals[index]) 组").font(.caption2).foregroundStyle(SpotterPalette.muted)
                            ProgressView(value: Double(totals[index]), total: Double(highest)).tint(SpotterPalette.color(0x4f72cb))
                        }.padding(8).background(SpotterPalette.wash.opacity(0.43), in: RoundedRectangle(cornerRadius: 8))
                    }
                }
            } else if unavailable { SecondaryNotice(message: "暂时无法读取肌群标注。") }
            else { ProgressView("正在读取肌群标注…") }
        }.padding(12).secondaryCard()
            .task {
                let loaded = await Task.detached(priority: .utility) { Self.loadCatalogue() }.value
                catalogue = loaded
                unavailable = loaded == nil
            }
    }

    nonisolated private static func nameKey(_ name: String) -> String {
        name.precomposedStringWithCompatibilityMapping.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    nonisolated private static func loadCatalogue() -> Catalog? {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "json"), let data = try? Data(contentsOf: url),
              let value = try? JSONDecoder().decode(NativeJSON.self, from: data) else { return nil }
        var byID = [String: [String: NativeJSON]]()
        var byName = [String: [String: NativeJSON]]()
        for move in value["rows"].array {
            let muscles = move["muscles"].object
            guard !muscles.isEmpty else { continue }
            byID[move["id"].string] = muscles
            for name in [move["name"].string, move["en"].string] where !name.isEmpty { byName[nameKey(name)] = muscles }
        }
        return Catalog(byID: byID, byName: byName)
    }

    private func distribution(_ catalogue: Catalog) -> ([Int], [String: Int]) {
        var totals = Array(repeating: 0, count: Self.groups.count)
        var regionCounts = [String: Int]()
        for entry in entries {
            guard let session = entry.session else { continue }
            for (index, move) in session.plan.exercises.enumerated() where session.rows.indices.contains(index) && !move["warmup"].bool {
                let count = session.rows[index].filter { $0["done"].bool && $0["kind"].string != "warmup" }.count
                guard count > 0 else { continue }
                let muscles = catalogue.byID[move["catalogueId"].string] ?? catalogue.byName[Self.nameKey(move["name"].string)] ?? [:]
                let regions = Set(muscles.compactMap { name, intensity -> String? in
                    let value = intensity.number
                    return name != "cardiovascular system" && value > 0 && (layer == .primary ? value >= 75 : value < 75) ? name : nil
                })
                for region in regions { regionCounts[region, default: 0] += count }
                for index in Self.groups.indices where !Self.groups[index].1.isDisjoint(with: regions) { totals[index] += count }
            }
        }
        return (totals, regionCounts)
    }
}

private struct SecondaryPerformance: View {
    let entries: [NativeWorkoutEntry]
    let compared: [NativeWorkoutEntry]?
    @State private var metric = Metric.maximum
    @AppStorage(NativePreferenceKey.oneRepMax) private var oneRepMax = "epley"

    private enum Metric: String, CaseIterable { case maximum = "1RM 估算", weight = "最大重量" }
    private struct Result: Identifiable {
        let id: String
        let title: String
        let day: String
        let value: Double
        let weight: Double
        let reps: Double
    }

    var body: some View {
        let prior = compared.map(results)
        let current = results(entries).values.sorted { $0.value > $1.value }
        return VStack(alignment: .leading, spacing: 10) {
            Text("动作表现").font(.headline)
            SecondarySegment(options: Metric.allCases, value: $metric, title: \.rawValue)
            if current.isEmpty { SecondaryNotice(message: "此周期没有可计算的负重纪录。") }
            else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(Array(current.prefix(8))) { lift in
                        VStack(alignment: .leading, spacing: 5) {
                            Label(lift.title, systemImage: "dumbbell").font(.caption.weight(.semibold)).lineLimit(2)
                            Text("\(statNumber(lift.value)) kg").font(.title3.weight(.heavy)).foregroundStyle(SpotterPalette.accent).monospacedDigit()
                            Text("\(statNumber(lift.weight)) kg × \(Int(lift.reps)) 次 · \(lift.day.suffix(5))").font(.caption2)
                            if let prior {
                                Text(prior[lift.id].map { "对比期 \(statNumber($0.value)) kg" } ?? "对比期暂无记录").font(.caption2)
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(9)
                            .background(SpotterPalette.wash.opacity(0.54), in: RoundedRectangle(cornerRadius: 9))
                    }
                }
            }
            Text("重量统一换算为 kg。分侧记录按较重一侧统计个人纪录。").font(.caption2).foregroundStyle(SpotterPalette.muted)
        }.padding(12).secondaryCard()
    }

    private func results(_ records: [NativeWorkoutEntry]) -> [String: Result] {
        var result = [String: Result]()
        for entry in records {
            guard let session = entry.session else { continue }
            for (index, move) in session.plan.exercises.enumerated() where !move["warmup"].bool && session.rows.indices.contains(index) {
                let title = move["name"].string
                let identifier = move["catalogueId"].string
                let key = identifier.isEmpty ? title.lowercased() : identifier
                let factor = move["unit"].string == "lb" ? 0.45359237 : 1
                for row in session.rows[index] where row["done"].bool && row["kind"].string != "warmup" {
                    for side in [row, row["right"]] {
                        let weight = side["weight"].number * factor
                        let reps = side["reps"].number
                        guard weight > 0, reps > 0, metric == .weight || reps <= 10 else { continue }
                        let value = metric == .weight || reps == 1 ? weight :
                            oneRepMax == "brzycki" ? weight * 36 / (37 - reps) : weight * (1 + reps / 30)
                        if value > (result[key]?.value ?? 0) {
                            result[key] = Result(id: key, title: title, day: entry.day, value: value, weight: weight, reps: reps)
                        }
                    }
                }
            }
        }
        return result
    }
}

@MainActor
private struct SecondaryHistory: View {
    let api: NativeAPI
    let owner: String
    let entries: [NativeWorkoutEntry]
    let partner: SecondaryFriend?
    @State private var month = SecondaryDate.monthStart(SecondaryDate.today)
    @State private var scope = Scope.all
    @State private var selection: Selection?

    private enum Scope: String, CaseIterable { case all = "全部", mine = "我的记录", partner = "搭子记录" }
    private enum Selection: Identifiable {
        case day(String), workout(NativeWorkoutEntry)
        var id: String { switch self { case .day(let day): return day; case .workout(let entry): return entry.owner + ":" + entry.id } }
    }

    private var grouped: [String: [NativeWorkoutEntry]] {
        Dictionary(grouping: entries.filter { record in
            if partner == nil || scope == .mine { return record.owner == owner }
            if scope == .partner { return record.owner == partner?.id }
            return true
        }, by: \.day)
    }

    var body: some View {
        let start = SecondaryDate.weekStart(month)
        let last = SecondaryDate.shift(SecondaryDate.shift(month, 1, component: .month), -1)
        let days = (SecondaryDate.days(start, through: last) + 6) / 7 * 7
        let records = grouped
        return VStack(alignment: .leading, spacing: 9) {
            SecondaryActionHeader(title: "\(SecondaryDate.calendar.component(.year, from: month)) 年 \(SecondaryDate.calendar.component(.month, from: month)) 月") {
                if partner != nil {
                    SecondarySelectionMenu(label: "记录筛选", options: Scope.allCases, selection: $scope, title: \.rawValue)
                }
                HStack(spacing: 3) {
                    stepButton("上个月", symbol: "chevron.left") { month = SecondaryDate.shift(month, -1, component: .month) }
                    stepButton("下个月", symbol: "chevron.right") { month = SecondaryDate.shift(month, 1, component: .month) }
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 7), spacing: 4) {
                ForEach(["一", "二", "三", "四", "五", "六", "日"], id: \.self) { Text($0).font(.caption2).foregroundStyle(SpotterPalette.muted) }
                ForEach(0..<days, id: \.self) { index in
                    let date = SecondaryDate.shift(start, index)
                    calendarCell(date, records: records[spotterDay(date), default: []], inside: date >= month && date <= last)
                }
            }
            HStack(spacing: 8) {
                if scope != .partner || partner == nil { SecondaryBadge(text: "我", green: true) }
                if let partner, scope != .mine { SecondaryBadge(text: partner.name) }
            }
        }.padding(10).secondaryCard()
            .sheet(item: $selection) { selection in
                NavigationStack {
                    switch selection {
                    case .day(let date):
                        ScrollView {
                            VStack(spacing: 10) {
                                let daily = grouped[date, default: []]
                                if daily.isEmpty { SecondaryNotice(message: "这一天还没有训练记录。") }
                                ForEach(Array(daily.enumerated()), id: \.offset) { _, record in
                                    NavigationLink { SecondaryTrainingDetail(api: api, owner: owner, record: record) } label: {
                                        SecondaryRow(title: record.title, detail: "\(record.owner == owner ? "我" : partner?.name ?? "搭子") · \(record.durationMinutes) 分钟", icon: "dumbbell", color: record.owner == owner ? SpotterPalette.wash : secondaryLilac)
                                            .secondaryCard()
                                    }.buttonStyle(.plain)
                                }
                            }.secondaryPage()
                        }.background(SpotterPalette.background).navigationTitle("\(date.suffix(5)) 的打卡").navigationBarTitleDisplayMode(.inline)
                    case .workout(let record): SecondaryTrainingDetail(api: api, owner: owner, record: record)
                    }
                }
                .presentationDragIndicator(.visible)
            }
    }

    private func calendarCell(_ date: Date, records: [NativeWorkoutEntry], inside: Bool) -> some View {
        let key = spotterDay(date)
        return VStack(alignment: .leading, spacing: 2) {
            Button { selection = .day(key) } label: {
                HStack(spacing: 0) {
                    Text(SecondaryDate.calendar.component(.day, from: date).formatted()).font(.caption2.weight(.semibold))
                    Spacer(minLength: 0)
                    if records.count > 2 { Text("+\(records.count - 2)").font(.system(size: 8)) }
                }.padding(3).frame(maxWidth: .infinity).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityLabel("\(key)，\(records.count) 次打卡")
            ForEach(Array(records.prefix(2).enumerated()), id: \.offset) { _, record in
                Button { selection = .workout(record) } label: {
                    Text(record.title).font(.system(size: 8, weight: .semibold)).lineLimit(1)
                        .padding(.horizontal, 2).padding(.vertical, 2).frame(maxWidth: .infinity, alignment: .leading)
                        .background(record.owner == owner ? SpotterPalette.wash : secondaryLilac, in: RoundedRectangle(cornerRadius: 3))
                }.buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }.frame(minHeight: 52, alignment: .topLeading)
            .background(inside ? SpotterPalette.card : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(key == spotterDay() ? SpotterPalette.accent : SpotterPalette.line, lineWidth: 1).allowsHitTesting(false))
            .foregroundStyle(inside ? SpotterPalette.ink : SpotterPalette.muted)
    }
}

@MainActor
private struct SecondaryTrainingDetail: View {
    let api: NativeAPI
    let owner: String
    let record: NativeWorkoutEntry

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 13) {
                Text(record.title).font(.largeTitle.weight(.heavy))
                Text("\(record.day) · \(record.durationMinutes) 分钟").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                if !record.data["note"].string.isEmpty { SecondaryNotice(message: record.data["note"].string) }
                if let session = record.session {
                    ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                        let rows = session.rows.indices.contains(index) ? session.rows[index] : []
                        VStack(alignment: .leading, spacing: 6) {
                            Text(move["name"].string).font(.headline)
                            ForEach(Array(rows.enumerated()), id: \.offset) { set, row in
                                if row["done"].bool {
                                    let duration = row["seconds"].number
                                    Text("第 \(set + 1) 组 · \(statNumber(row["weight"].number)) \(move["unit"].string) × \(Int(row["reps"].number)) 次" + (duration > 0 ? " · \(Int(duration)) 秒" : ""))
                                        .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                                    if case .object = row["right"] {
                                        Text("右侧 · \(statNumber(row["right"]["weight"].number)) \(move["unit"].string) × \(Int(row["right"]["reps"].number)) 次")
                                            .font(.caption).foregroundStyle(SpotterPalette.muted)
                                    }
                                }
                            }
                        }.padding(12).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()
                    }
                }
                if record.owner == owner { NativeHeartView(api: api, owner: owner, entry: record) }
            }.secondaryPage()
        }.background(SpotterPalette.background).navigationTitle("训练详情").navigationBarTitleDisplayMode(.inline)
    }
}

@MainActor
struct NativeSettings: View {
    @ObservedObject var account: NativeAccount
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var showDelete = false
    @State private var working = false
    @State private var note: String?
    @State private var deleted = false
    @State private var revokeInSettings = false
    @State private var handle: NativeHandleProfile?
    @State private var username = ""
    @State private var usernameTag = ""
    @State private var handleBusy = false
    @State private var handleNotice: String?
    @State private var handleError = false
    @State private var showRestSchedule = false
    let owner: String
    var onDeleted: () -> Void
    var refreshPlans: @MainActor () async -> Void = {}
    var openTraining: (() -> Void)? = nil

    private enum Page: String, CaseIterable, Identifiable {
        case account = "账号", workout = "训练偏好", protein = "蛋白粉仓库", timer = "计时提醒", schedule = "计划与日程", reminders = "训练提醒"
        case units = "单位与统计", equipment = "器械", appearance = "外观与辅助功能", modules = "功能模块", data = "数据导入与导出"
        case watches = "手表与健康", integrations = "集成", coach = "AI 教练", about = "关于与更新"
        var id: Self { self }

        var detail: String {
            switch self {
            case .account: return "用户名、登录绑定、云端同步和隐私"
            case .workout: return "默认组数和次数、下一组、动作节奏"
            case .protein: return "常喝的蛋白粉、一勺粉量和杯量"
            case .timer: return "休息时间、提示声音和震动、保持屏幕常亮"
            case .schedule: return "训练计划、固定休息日和临时休息"
            case .reminders: return "待训练计划、每日提醒时间"
            case .units: return "新动作的重量单位、动作名称、1RM 估算方式"
            case .equipment: return "健身房配置和可用器械"
            case .appearance: return "文字大小和减少动画"
            case .modules: return "首页营养、训练计划、每周打卡和好友入口"
            case .data: return "导出训练资料、恢复 Spotter 备份"
            case .watches: return "Apple Watch 与 Apple 健康"
            case .integrations: return "健康数据、AI 工具"
            case .coach: return "训练对话、计划草稿与 Agent 连接"
            case .about: return "帮助、更新和版本"
            }
        }

        var icon: String {
            switch self {
            case .account: return "person.crop.circle"
            case .workout: return "dumbbell"
            case .protein: return "shippingbox"
            case .timer: return "timer"
            case .schedule: return "calendar"
            case .reminders: return "bell"
            case .units: return "ruler"
            case .equipment: return "slider.horizontal.3"
            case .appearance: return "textformat.size"
            case .modules: return "square.grid.2x2"
            case .data: return "externaldrive"
            case .watches: return "applewatch"
            case .integrations: return "powerplug"
            case .coach: return "sparkles"
            case .about: return "info.circle"
            }
        }

        var color: Color {
            switch self {
            case .protein: return secondaryTeal
            case .integrations: return secondaryLilac
            case .coach: return SpotterPalette.wash
            default: return secondarySlate
            }
        }
    }

    private var matches: [Page] {
        Page.allCases.filter { page in
            search.split(whereSeparator: \.isWhitespace).allSatisfy {
                (page.rawValue + " " + page.detail).localizedCaseInsensitiveContains(String($0))
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 17) {
                Button { dismiss() } label: { Label("今日", systemImage: "arrow.left").font(.subheadline.weight(.semibold)) }
                    .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.muted).frame(minHeight: 36)
                Text("设置").font(.system(.largeTitle, weight: .heavy)).foregroundStyle(SpotterPalette.ink).accessibilityAddTraits(.isHeader)
                HStack(spacing: 9) {
                    Image(systemName: "magnifyingglass").foregroundStyle(SpotterPalette.muted)
                    TextField("搜索设置", text: $search).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if !search.isEmpty {
                        Button { search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(SpotterPalette.muted) }
                            .buttonStyle(.spotterPress).accessibilityLabel("清除设置搜索")
                    }
                }.padding(.horizontal, 13).frame(minHeight: 45).secondaryCard(radius: 13)

                if search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    accountHeader
                    rows([.workout, .protein, .timer, .schedule, .reminders], title: "训练")
                    rows([.units, .equipment, .appearance, .modules], title: "首选项")
                    rows([.watches, .integrations, .coach], title: "连接")
                    rows([.data], title: "数据")
                    rows([.about])
                } else if matches.isEmpty {
                    SecondaryNotice(message: "没有匹配的设置")
                } else {
                    rows(matches, title: "搜索结果")
                }
            }.secondaryPage()
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationDestination(for: Page.self) { destination($0) }
        .toolbar(.hidden, for: .navigationBar)
        .task { await loadHandle() }
        .sheet(isPresented: $showRestSchedule, onDismiss: { Task { await refreshPlans() } }) {
            NativeRestSchedule(api: account.api, owner: owner, addToday: false)
        }
    }

    private var accountHeader: some View {
        let name = account.profile?.name ?? "训练搭子用户"
        return NavigationLink(value: Page.account) {
            HStack(spacing: 12) {
                Text(name.first.map(String.init) ?? "我").font(.title3.weight(.heavy))
                    .foregroundStyle(SpotterPalette.deep).frame(width: 44, height: 44)
                    .background(SpotterPalette.wash, in: Circle()).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                    Text(handle?.handle ?? "云端账号").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            }.padding(12).frame(minHeight: 69).secondaryCard()
        }.buttonStyle(.spotterPress)
    }

    private func rows(_ pages: [Page], title: String? = nil) -> some View {
        SecondaryGroup(title: title) {
            ForEach(pages) { page in
                if page != pages.first { Divider().overlay(SpotterPalette.line) }
                link(page)
            }
        }
    }

    private func link(_ page: Page) -> some View {
        NavigationLink(value: page) { SecondaryRow(title: page.rawValue, detail: page.detail, icon: page.icon, color: page.color) }
            .buttonStyle(.spotterPress)
    }

    @ViewBuilder private func destination(_ page: Page) -> some View {
        switch page {
        case .protein: NativeProteinView(api: account.api, owner: owner).toolbar(.visible, for: .navigationBar)
        case .equipment: NativeEquipmentPreferences()
        default:
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(page.rawValue).font(.system(.largeTitle, weight: .heavy)).foregroundStyle(SpotterPalette.ink).accessibilityAddTraits(.isHeader)
                    switch page {
                    case .account: accountContent
                    case .workout: NativeWorkoutPreferences()
                    case .timer: NativeTimerPreferences()
                    case .schedule: scheduleContent
                    case .reminders: NativeTrainingReminderSettings(owner: owner)
                    case .units: NativeUnitsPreferences()
                    case .equipment: EmptyView()
                    case .appearance: NativeAppearancePreferences()
                    case .modules: NativeModulePreferences()
                    case .data: NativeBackupSettings(api: account.api, owner: owner, didImport: refreshPlans)
                    case .watches: NativeHealthSummary(api: account.api, owner: owner)
                    case .integrations:
                        rows([.watches], title: "健康与设备")
                        rows([.coach], title: "数据和 AI")
                    case .coach: coachContent
                    case .about: aboutContent
                    case .protein: EmptyView()
                    }
                }.secondaryPage()
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar)
        }
    }

    private var scheduleContent: some View {
        SecondaryGroup(title: "训练安排") {
            if let openTraining {
                Button(action: openTraining) {
                    SecondaryRow(title: "我的计划", detail: "在训练页查看和编辑计划", icon: "list.clipboard")
                }.buttonStyle(.plain)
                Divider()
            }
            Button { showRestSchedule = true } label: {
                SecondaryRow(title: "管理休息日", detail: "每周固定休息日和临时休息日期", icon: "calendar.badge.clock")
            }.buttonStyle(.plain)
        }
    }

    private var coachContent: some View {
        SecondaryGroup {
            NavigationLink {
                NativeCoachView(api: account.api, owner: owner).toolbar(.visible, for: .navigationBar)
            } label: { SecondaryRow(title: "打开 AI 教练", icon: "sparkles") }.buttonStyle(.plain)
            Divider()
            NativeCoachSharingSettings(owner: owner, origin: account.api.origin).padding(13)
        }
    }

    private var accountContent: some View {
        VStack(alignment: .leading, spacing: 15) {
            usernameContent
            VStack(alignment: .leading, spacing: 10) {
                Text("绑定登录方式").font(.headline).accessibilityAddTraits(.isHeader)
                Text("绑定后，Apple 和 Google 都会打开这个训练搭子账号。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                providerRow("Apple", icon: "apple.logo", option: account.providerStatus.apple) { await account.linkApple() }
                providerRow("Google", icon: "g.circle", option: account.providerStatus.google) { await account.linkGoogle() }
                if let error = account.errorMessage { SecondaryNotice(message: error, warning: true) }
            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()

            SecondaryGroup(title: "账户与同步") {
                NavigationLink { NativeBodyData(api: account.api, owner: owner).toolbar(.visible, for: .navigationBar) } label: {
                    SecondaryRow(title: "身体档案", detail: "查看体重、身体数据与性别", icon: "person.text.rectangle")
                }.buttonStyle(.spotterPress)
                Divider()
                Button {
                    Task { await refreshPlans(); await loadHandle() }
                } label: {
                    SecondaryRow(title: "立即同步", icon: "arrow.clockwise", accessory: nil)
                }.buttonStyle(.plain).disabled(handleBusy || account.isBusy)
                Divider()
                Button { Task { await account.signOut() } } label: {
                    SecondaryRow(title: "退出当前账号", icon: "rectangle.portrait.and.arrow.right", accessory: nil)
                }.buttonStyle(.plain).disabled(account.isBusy)
            }

            SecondaryGroup(title: "关系与隐私") {
                NavigationLink {
                    NativeFriends(api: account.api, owner: owner, initialBuddySearch: true, refreshPlans: refreshPlans)
                        .toolbar(.visible, for: .navigationBar)
                } label: { SecondaryRow(title: "搭子空间", detail: "通过用户名找训练搭子", icon: "person.2") }
                    .buttonStyle(.plain)
                Divider()
                NavigationLink {
                    NativeFriends(api: account.api, owner: owner, initialPage: .privacy, refreshPlans: refreshPlans)
                        .toolbar(.visible, for: .navigationBar)
                } label: { SecondaryRow(title: "好友分享设置", detail: "调整好友和搭子可见的数据", icon: "lock.shield") }
                    .buttonStyle(.plain)
                Divider()
                NavigationLink { NativeCoachingView(api: account.api, owner: owner).toolbar(.visible, for: .navigationBar) } label: {
                    SecondaryRow(title: "教练与学员", icon: "graduationcap")
                }.buttonStyle(.plain)
                if let privacy = URL(string: account.api.origin + "/privacy") {
                    Divider()
                    Link(destination: privacy) { SecondaryRow(title: "隐私政策", icon: "shield") }.buttonStyle(.plain)
                }
            }

            SecondaryGroup {
                Button(role: .destructive) { showDelete = true } label: {
                    Label("删除账号", systemImage: "trash").font(.subheadline.weight(.semibold)).foregroundStyle(.red)
                        .padding(.horizontal, 13).frame(maxWidth: .infinity, minHeight: 55, alignment: .leading)
                }.buttonStyle(.plain).disabled(working || account.isBusy)
            }
            if let note { SecondaryNotice(message: note, warning: true) }
        }
        .confirmationDialog("永久删除训练搭子账号？", isPresented: $showDelete, titleVisibility: .visible) {
            Button("删除账号和数据", role: .destructive) { Task { await deleteAccount() } }
            Button("取消", role: .cancel) {}
        } message: { Text("你的训练、饮食、计划和登录绑定会一并删除。") }
        .alert("账号已删除", isPresented: $deleted) {
            Button("完成") { Task { await account.signOut() } }
        } message: {
            if revokeInSettings { Text("可在 iPhone「设置 → 你的姓名 → 通过 Apple 登录」中撤销训练搭子的 Apple 授权。") }
        }
    }

    private var usernameContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("用户名").font(.headline).accessibilityAddTraits(.isHeader)
            if let handle {
                HStack {
                    Text(handle.handle).font(.system(.subheadline, design: .monospaced)).textSelection(.enabled)
                    Spacer()
                    Button {
                        UIPasteboard.general.string = handle.handle
                        handleNotice = "已复制用户名。"; handleError = false
                    } label: { Label("复制用户名", systemImage: "doc.on.doc") }
                    .labelStyle(.iconOnly).buttonStyle(SecondaryButtonStyle())
                }
                HStack(spacing: 6) {
                    TextField("输入新的用户名", text: $username)
                        .textFieldStyle(.roundedBorder).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .submitLabel(.done).onSubmit { Task { await saveHandle() } }
                        .accessibilityLabel("新的用户名")
                    Text("#").font(.subheadline.monospaced()).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                    TextField("0000", text: $usernameTag).textFieldStyle(.roundedBorder)
                        .font(.subheadline.monospaced()).keyboardType(.numberPad).frame(width: 66)
                        .accessibilityLabel("四位数字标签")
                        .onChange(of: usernameTag) { value in
                            let digits = String(value.precomposedStringWithCompatibilityMapping.filter { ("0"..."9").contains($0) }.prefix(4))
                            if digits != value { usernameTag = digits }
                        }
                    Button("保存") { Task { await saveHandle() } }
                        .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(!canSaveHandle)
                }
                Text("名字用 3–24 个英文字母、数字、点或下划线，两端须为字母或数字。标签为四位数字。完整组合需唯一。")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            } else if handleBusy {
                ProgressView("正在读取用户名…")
            } else {
                Button("重新读取用户名") { Task { await loadHandle() } }.buttonStyle(SecondaryButtonStyle())
            }
            if let handleNotice { SecondaryNotice(message: handleNotice, warning: handleError) }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()
    }

    private var proposedUsername: String {
        username.precomposedStringWithCompatibilityMapping.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var canSaveHandle: Bool {
        guard let handle, !handleBusy, !account.isBusy,
              proposedUsername != handle.username || usernameTag != handle.tag,
              usernameTag.count == 4, usernameTag.allSatisfy({ ("0"..."9").contains($0) }) else { return false }
        return proposedUsername.range(of: "^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$", options: .regularExpression) != nil
    }

    private func loadHandle() async {
        guard !handleBusy else { return }
        handleBusy = true
        defer { handleBusy = false }
        do {
            let result = try await account.api.spotterRead("/api/auth/profile", as: NativeHandleResponse.self)
            handle = result.profile
            username = result.profile.username
            usernameTag = result.profile.tag
            handleNotice = nil
        } catch is CancellationError { }
        catch { handleNotice = error.localizedDescription; handleError = true }
    }

    private func saveHandle() async {
        guard canSaveHandle else { return }
        handleBusy = true
        defer { handleBusy = false }
        do {
            let result = try await account.api.spotterSend("/api/auth/profile", body: [
                "username": proposedUsername, "tag": usernameTag, "expectedOwner": owner
            ])
            let updated = try JSONDecoder().decode(NativeHandleResponse.self, from: result).profile
            handle = updated
            username = updated.username
            usernameTag = updated.tag
            handleNotice = "已更新用户名。"; handleError = false
        } catch { handleNotice = error.localizedDescription; handleError = true }
    }

    private var aboutContent: some View {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return SecondaryGroup(title: "训练搭子 · Spotter") {
            SecondaryRow(title: "App 版本", detail: "\(version) (\(build))", icon: "info.circle", accessory: nil)
            Divider()
            NativeSupportLinks().frame(maxWidth: .infinity, minHeight: 54, alignment: .leading).padding(.horizontal, 13)
        }
    }

    private func providerRow(_ provider: String, icon: String, option: NativeProviderStatus.Option,
                             action: @escaping @MainActor () async -> Void) -> some View {
        Button { Task { await action() } } label: {
            HStack {
                Label(provider, systemImage: icon).font(.subheadline.weight(.semibold))
                Spacer()
                SecondaryBadge(text: option.linked ? "已绑定" : option.enabled ? "绑定" : "待开通", green: option.linked)
            }.padding(.horizontal, 11).frame(minHeight: 45).secondaryCard(radius: 10).contentShape(Rectangle())
        }
        .buttonStyle(.plain).foregroundStyle(SpotterPalette.ink)
        .disabled(option.linked || !option.enabled || account.isBusy)
    }

    private func deleteAccount() async {
        working = true
        defer { working = false }
        do {
            let response = try await account.api.spotterSend("/api/auth/delete-account", body: ["expectedOwner": owner, "confirm": true])
            let result = try JSONSerialization.jsonObject(with: response) as? [String: Any]
            revokeInSettings = result?["appleRevocation"] as? String == "manual"
            onDeleted()
            NativeCoachConsent.revoke(owner: owner)
            deleted = true
        } catch { note = error.localizedDescription }
    }
}

private struct NativeHandleProfile: Decodable {
    let username: String
    let tag: String
    let handle: String
}

private struct NativeHandleResponse: Decodable { let profile: NativeHandleProfile }

private struct NativeSettingToggle: View {
    let title: String
    let detail: String
    @Binding var value: Bool

    var body: some View {
        Toggle(isOn: $value) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(SpotterPalette.muted)
            }
        }.tint(SpotterPalette.accent).padding(13)
    }
}

private struct NativeWorkoutPreferences: View {
    @AppStorage(NativePreferenceKey.sets) private var sets = 3
    @AppStorage(NativePreferenceKey.reps) private var reps = 10
    @AppStorage(NativePreferenceKey.showNext) private var showNext = true
    @AppStorage(NativePreferenceKey.showTempo) private var showTempo = true
    @AppStorage(NativePreferenceKey.showEffort) private var showEffort = true
    @AppStorage(NativePreferenceKey.autoAdvance) private var autoAdvance = false

    var body: some View {
        SecondaryGroup(title: "新动作") {
            Stepper("默认组数 · \(sets) 组", value: $sets, in: 1...30).padding(13)
            Divider()
            Stepper("默认次数 · \(reps) 次", value: $reps, in: 1...100).padding(13)
        }
        SecondaryGroup(title: "训练记录") {
            NativeSettingToggle(title: "显示下一组", detail: "在训练详情顶部显示下一个未完成组。", value: $showNext)
            Divider()
            NativeSettingToggle(title: "自动切换动作", detail: "完成一个动作的所有组后，打开下一个待练动作。", value: $autoAdvance)
            Divider()
            NativeSettingToggle(title: "显示动作节奏", detail: "显示计划写明的动作节奏。", value: $showTempo)
            Divider()
            NativeSettingToggle(title: "显示 RPE", detail: "在组次下方显示已录入的主观用力程度。", value: $showEffort)
        }
    }
}

private struct NativeTimerPreferences: View {
    @AppStorage(NativePreferenceKey.defaultRest) private var rest = 30
    @AppStorage(NativePreferenceKey.restSound) private var sound = false
    @AppStorage(NativePreferenceKey.restHaptics) private var haptics = false
    @AppStorage(NativePreferenceKey.keepAwake) private var keepAwake = false

    var body: some View {
        SecondaryGroup(title: "组间休息") {
            Stepper("默认休息 · \(rest) 秒", value: $rest, in: 0...600, step: 5).padding(13)
            Divider()
            NativeSettingToggle(title: "提示声音", detail: "训练页面打开时，组间休息倒数结束后提示。", value: $sound)
            Divider()
            NativeSettingToggle(title: "提示触感", detail: "训练页面打开时，组间休息倒数结束后振动。", value: $haptics)
        }
        SecondaryGroup(title: "训练计时") {
            NativeSettingToggle(title: "训练时保持常亮", detail: "训练页面打开且计时进行时延缓自动锁屏。", value: $keepAwake)
        }
    }
}

private struct NativeTrainingReminderSettings: View {
    @AppStorage private var enabled: Bool
    @AppStorage private var minute: Int
    @State private var showPreview = false

    init(owner: String) {
        _enabled = AppStorage(wrappedValue: false, NativePreferenceKey.reminderKey(owner, field: "enabled"))
        _minute = AppStorage(wrappedValue: 18 * 60, NativePreferenceKey.reminderKey(owner, field: "minute"))
    }

    private var time: Binding<Date> {
        Binding(get: {
            Calendar.current.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: Date()) ?? Date()
        }, set: { value in
            let parts = Calendar.current.dateComponents([.hour, .minute], from: value)
            minute = (parts.hour ?? 18) * 60 + (parts.minute ?? 0)
        })
    }

    var body: some View {
        SecondaryGroup {
            NativeSettingToggle(title: "每日训练提醒", detail: "在 App 打开时提醒当天未完成的训练。", value: $enabled)
            Divider()
            DatePicker("提醒时间", selection: time, displayedComponents: .hourAndMinute).padding(13).disabled(!enabled)
            Divider()
            Button { showPreview = true } label: {
                SecondaryRow(title: "试试提醒", icon: "bell.badge", accessory: nil)
            }.buttonStyle(.plain)
        }
        .alert("训练提醒", isPresented: $showPreview) { Button("好", role: .cancel) {} } message: {
            Text(NativePreferenceKey.reminderTitle)
        }
    }
}

private struct NativeUnitsPreferences: View {
    @AppStorage(NativePreferenceKey.unit) private var unit = "kg"
    @AppStorage(NativePreferenceKey.exerciseLanguage) private var language = "zh"
    @AppStorage(NativePreferenceKey.oneRepMax) private var oneRepMax = "epley"

    var body: some View {
        SecondaryGroup {
            Picker("新动作的重量单位", selection: $unit) {
                Text("千克（kg）").tag("kg")
                Text("磅（lb）").tag("lb")
            }.padding(13)
            Divider()
            Picker("动作库名称", selection: $language) {
                Text("中文").tag("zh")
                Text("English").tag("en")
                Text("中英文").tag("both")
            }.padding(13)
            Divider()
            Picker("1RM 估算方式", selection: $oneRepMax) {
                Text("Epley").tag("epley")
                Text("Brzycki").tag("brzycki")
            }.padding(13)
        }
        SecondaryNotice(message: "切换单位只影响新添加的动作。训练容量和统计会统一换算为 kg。")
    }
}

private struct NativeEquipmentPreferences: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(NativeGymPreferences.storageKey) private var saved = Data()
    @AppStorage(NativePreferenceKey.equipment) private var legacy = ""
    @State private var name = ""

    private var preferences: NativeGymPreferences { .read(saved, legacy: legacy) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 17) {
                Button { dismiss() } label: { Label("设置", systemImage: "arrow.left").font(.subheadline.weight(.semibold)) }
                    .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.muted).frame(minHeight: 44)
                Text("器械").font(.system(.largeTitle, weight: .heavy)).foregroundStyle(SpotterPalette.ink)
                    .accessibilityAddTraits(.isHeader)
                gymPicker
                NativeGymEquipmentGrid(preferences: preferences, toggle: { key in update { $0.toggle(key) } },
                                       toggleAll: { update { $0.toggleAll() } })
                Text("动作库可按当前配置筛选器械。配置留空时显示所有器械。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.horizontal, 12)
            }.secondaryPage()
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    private var gymPicker: some View {
        SecondaryGroup(title: "健身房") {
            HStack(spacing: 10) {
                Text("当前器械配置").font(.subheadline.weight(.bold))
                Spacer(minLength: 4)
                Menu {
                    Picker("当前器械配置", selection: Binding(get: { preferences.gym.id }, set: { id in
                        update { $0.select(id) }
                    })) {
                        ForEach(preferences.profiles) { Text($0.name).tag($0.id) }
                    }
                } label: {
                    HStack(spacing: 7) {
                        Text(preferences.gym.name).lineLimit(1)
                        Image(systemName: "chevron.down").font(.caption).accessibilityHidden(true)
                    }
                    .foregroundStyle(SpotterPalette.ink)
                    .padding(.horizontal, 10).frame(minHeight: 38).secondaryCard(radius: 11)
                }
                .accessibilityLabel("当前器械配置")
                .accessibilityValue(preferences.gym.name)
            }.padding(13)
            Divider()
            VStack(alignment: .leading, spacing: 6) {
                Text("添加健身房").font(.subheadline.weight(.bold))
                HStack(spacing: 9) {
                    TextField("名称", text: $name)
                        .padding(.horizontal, 10)
                        .frame(minHeight: 37)
                        .secondaryCard(radius: 10)
                        .submitLabel(.done)
                        .onSubmit(add)
                        .accessibilityLabel("健身房名称")
                    Button("添加", action: add)
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(!preferences.canAdd(name))
                        .opacity(preferences.canAdd(name) ? 1 : 0.5)
                }
            }.padding(13)
        }
    }

    private func add() {
        var next = preferences
        guard next.add(name), let data = try? JSONEncoder().encode(next) else { return }
        saved = data
        name = ""
    }

    private func update(_ change: (inout NativeGymPreferences) -> Void) {
        var next = preferences
        change(&next)
        if let data = try? JSONEncoder().encode(next) { saved = data }
    }
}

struct NativeGymEquipmentGrid: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let preferences: NativeGymPreferences
    var toggle: (String) -> Void
    var toggleAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("可用器械").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(preferences.allSelected ? "清空" : "全选", action: toggleAll)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.accent)
                    .buttonStyle(.spotterPress)
                    .accessibilityLabel(preferences.allSelected ? "清空器械" : "全选器械")
            }.padding(.horizontal, 12)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading),
                                     count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 0) {
                ForEach(NativeGymPreferences.equipment) { option in
                    let selected = preferences.gym.gear.contains(option.id)
                    Button { toggle(option.id) } label: {
                        HStack(spacing: 8) {
                            Image(systemName: selected ? "checkmark.square.fill" : "square")
                                .font(.system(size: 20))
                                .foregroundStyle(selected ? SpotterPalette.accent : SpotterPalette.muted)
                                .accessibilityHidden(true)
                            Text(option.label).font(.subheadline).foregroundStyle(SpotterPalette.ink)
                        }
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 6).secondaryCard()
        }
    }
}

private struct NativeAppearancePreferences: View {
    @AppStorage(NativePreferenceKey.largerText) private var largerText = false
    @AppStorage(NativePreferenceKey.reduceMotion) private var reduceMotion = false

    var body: some View {
        SecondaryGroup {
            NativeSettingToggle(title: "加大文字", detail: "增大使用系统动态字体的文字。", value: $largerText)
            Divider()
            NativeSettingToggle(title: "减少动画", detail: "减少应用内的界面过渡。", value: $reduceMotion)
        }
    }
}

private struct NativeModulePreferences: View {
    @AppStorage(NativePreferenceKey.friendsTab) private var friends = true
    @AppStorage(NativePreferenceKey.nutritionModule) private var nutrition = true
    @AppStorage(NativePreferenceKey.weeklyCheckins) private var checkins = true
    @AppStorage(NativePreferenceKey.planShortcut) private var plans = true

    var body: some View {
        SecondaryGroup {
            NativeSettingToggle(title: "好友入口", detail: "在底栏和今日页显示好友与搭子。", value: $friends)
            Divider()
            NativeSettingToggle(title: "今日饮食", detail: "在今日页显示饮食记录。", value: $nutrition)
            Divider()
            NativeSettingToggle(title: "每周打卡", detail: "在今日页显示本周训练打卡。", value: $checkins)
            Divider()
            NativeSettingToggle(title: "计划快捷入口", detail: "在今日页显示添加计划快捷入口。", value: $plans)
        }
    }
}

private struct NativeBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json, .commaSeparatedText] }
    let bytes: Data

    init(bytes: Data) { self.bytes = bytes }
    init(configuration: ReadConfiguration) throws {
        guard let bytes = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        self.bytes = bytes
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: bytes) }
}

@MainActor
private struct NativeBackupSettings: View {
    let api: NativeAPI
    let owner: String
    let didImport: @MainActor () async -> Void

    @State private var scope = Scope.all
    @State private var format = Format.json
    @State private var exportDocument: NativeBackupDocument?
    @State private var exportType = UTType.json
    @State private var filename = "spotter"
    @State private var isExporting = false
    @State private var isImporting = false
    @State private var showRestore = false
    @State private var selectedFile: Data?
    @State private var preview: String?
    @State private var notice: String?
    @State private var warning = false
    @State private var busy = false

    private enum Scope: String, CaseIterable {
        case all, training, nutrition, body, templates
        var name: String {
            switch self {
            case .all: return "全部数据"
            case .training: return "训练资料"
            case .nutrition: return "饮食记录"
            case .body: return "身体数据"
            case .templates: return "训练模板"
            }
        }
        var supportsCSV: Bool { self == .training || self == .body }
    }

    private enum Format: String, CaseIterable {
        case json, csv
        var type: UTType { self == .json ? .json : .commaSeparatedText }
    }

    private struct RestoreResult: Decodable { let added: Int; let skipped: Int }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SecondaryGroup(title: "导出备份") {
                Picker("数据范围", selection: $scope) {
                    ForEach(Scope.allCases, id: \.self) { Text($0.name).tag($0) }
                }.padding(13)
                Divider()
                Picker("文件格式", selection: $format) {
                    ForEach(Format.allCases.filter { $0 == .json || scope.supportsCSV }, id: \.self) { Text($0.rawValue.uppercased()).tag($0) }
                }.padding(13)
                Divider()
                Button { Task { await export() } } label: { SecondaryRow(title: "保存备份文件", icon: "square.and.arrow.up") }
                    .buttonStyle(.plain).disabled(busy)
            }
            SecondaryGroup(title: "恢复备份") {
                Button { isImporting = true } label: {
                    SecondaryRow(title: "选择 Spotter JSON 备份", detail: "将缺少的条目恢复到当前账号。", icon: "square.and.arrow.down")
                }.buttonStyle(.plain).disabled(busy)
            }
            if let notice { SecondaryNotice(message: notice, warning: warning) }
        }
        .onChange(of: scope) { value in if !value.supportsCSV { format = .json } }
        .fileExporter(isPresented: $isExporting, document: exportDocument, contentType: exportType, defaultFilename: filename) { result in
            switch result {
            case .success: report("备份文件已保存。")
            case .failure(let error): report(error.localizedDescription, failed: true)
            }
            exportDocument = nil
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json]) { result in
            Task { await loadFile(result) }
        }
        .confirmationDialog("恢复到当前账号？", isPresented: $showRestore, titleVisibility: .visible) {
            Button("恢复备份") { Task { await restore() } }
            Button("取消", role: .cancel) { selectedFile = nil }
        } message: { Text(preview ?? "") }
    }

    private func report(_ message: String, failed: Bool = false) { notice = message; warning = failed }

    private func export() async {
        guard !busy else { return }
        let chosenScope = scope
        let chosenFormat = format
        busy = true
        defer { busy = false }
        do {
            let bytes = try await api.request("/api/data?scope=\(chosenScope.rawValue)&format=\(chosenFormat.rawValue)")
            exportDocument = NativeBackupDocument(bytes: bytes)
            exportType = chosenFormat.type
            filename = "spotter-\(chosenScope.rawValue)-\(spotterDay())"
            isExporting = true
        } catch { report(error.localizedDescription, failed: true) }
    }

    private func loadFile(_ result: Result<URL, Error>) async {
        do {
            let url = try result.get()
            let (data, label) = try await Task.detached(priority: .userInitiated) {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize
                guard let size, size <= 8_000_000 else { throw CocoaError(.fileReadTooLarge) }
                let data = try Data(contentsOf: url)
                guard data.count <= 8_000_000 else { throw CocoaError(.fileReadTooLarge) }
                let file = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                guard file?["format"] as? String == "spotter-backup", file?["version"] as? Int == 1,
                      let training = file?["training"] as? [Any], let library = file?["library"] as? [Any], let heart = file?["heart"] as? [Any] else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                return (data, "\(training.count) 条训练、\(library.count) 条个人资料、\(heart.count) 条心率记录。")
            }.value
            selectedFile = data
            preview = label
            showRestore = true
        } catch { report("无法读取 Spotter 备份。请选择 8 MB 以内的 Spotter JSON 文件。", failed: true) }
    }

    private func restore() async {
        guard !busy, let selectedFile else { return }
        busy = true
        defer { busy = false; self.selectedFile = nil }
        do {
            var components = URLComponents()
            components.path = "/api/data"
            components.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
            guard let path = components.string else { throw URLError(.badURL) }
            let response = try await api.request(path, method: "POST", json: selectedFile)
            let result = try JSONDecoder().decode(RestoreResult.self, from: response)
            report("已恢复 \(result.added) 条，跳过 \(result.skipped) 条。")
            await didImport()
        } catch { report(error.localizedDescription, failed: true) }
    }
}

private enum NativeConnectionKind: String {
    case friend, buddy

    var invitationTitle: String { self == .buddy ? "找训练搭子" : "添加好友" }
    var requestTitle: String { self == .buddy ? "搭子申请" : "好友申请" }
}

private struct SecondaryFriend: Decodable, Identifiable {
    struct Sharing: Decodable, Equatable {
        var training: Bool
        var nutrition: Bool
        var nutritionDetails: Bool

        var body: [String: Bool] { ["training": training, "nutrition": nutrition, "nutritionDetails": nutritionDetails] }
    }

    let id: String
    let name: String
    let handle: String?
    let buddy: Bool
    let checkedIn: Bool?
    let sharing: Sharing?
}

private struct SecondaryFriendList: Decodable {
    struct Invite: Decodable {
        let code: String
        let expiresAt: String
    }
    let friends: [SecondaryFriend]
    let invite: Invite?
}

private struct SecondarySocial: Decodable {
    struct Preferences: Decodable {
        var closed: Bool
        var discoverable: Bool
        var recentOnly: Bool
        var body: [String: Bool] { ["closed": closed, "discoverable": discoverable, "recentOnly": recentOnly] }
    }
    struct Request: Decodable, Identifiable {
        let id: String
        let personId: String
        let name: String
        let kind: String?

        var connectionKind: NativeConnectionKind { kind == "buddy" ? .buddy : .friend }
    }
    let preferences: Preferences
    let incoming: [Request]
    let outgoing: [Request]
}

private struct SecondaryFriendFeed: Decodable {
    struct Day: Decodable, Identifiable {
        struct Item: Decodable, Identifiable {
            struct Workout: Decodable, Identifiable { let id: String; let title: String; let minutes: Int; let sets: Int }
            let friend: SecondaryFriend
            let workouts: [Workout]?
            var id: String { friend.id }
        }
        let date: String
        let items: [Item]
        var id: String { date }
    }
    let days: [Day]
}

private func friendPath(_ query: [URLQueryItem]) -> String {
    var parts = URLComponents()
    parts.path = "/api/friends"
    parts.queryItems = query
    return parts.string ?? "/api/friends"
}

enum NativeFriendsPage: String, CaseIterable { case contacts = "联系人", feed = "朋友圈", privacy = "权限设置" }

@MainActor
struct NativeFriends: View {
    let api: NativeAPI
    let owner: String
    let buddySearchRequest: Int
    let refreshPlans: @MainActor () async -> Void

    @State private var page: NativeFriendsPage
    @State private var data: SecondaryFriendList?
    @State private var social: SecondarySocial?
    @State private var feed: SecondaryFriendFeed?
    @State private var dialog: Dialog?
    @State private var inviteTab = InviteTab.search
    @State private var inviteKind = NativeConnectionKind.friend
    @State private var handledBuddyRequest = 0
    @State private var code = ""
    @State private var search = ""
    @State private var results: [SearchPerson]?
    @State private var notice: String?
    @State private var error = false
    @State private var busy = false

    private enum Dialog: String, Identifiable { case invite = "添加好友", requests = "新的朋友"; var id: Self { self } }
    private enum InviteTab: String, CaseIterable { case search = "搜索用户名", code = "邀请链接" }
    private struct SearchPerson: Decodable, Identifiable { let id: String; let name: String; let handle: String? }
    private struct SearchResponse: Decodable { let results: [SearchPerson] }

    init(api: NativeAPI, owner: String, initialPage: NativeFriendsPage = .contacts, initialBuddySearch: Bool = false,
         buddySearchRequest: Int = 0,
         refreshPlans: @escaping @MainActor () async -> Void) {
        self.api = api
        self.owner = owner
        self.buddySearchRequest = buddySearchRequest
        self.refreshPlans = refreshPlans
        _page = State(initialValue: initialPage)
        _dialog = State(initialValue: initialBuddySearch ? .invite : nil)
        _inviteKind = State(initialValue: initialBuddySearch ? .buddy : .friend)
    }

    private var listPath: String { friendPath([URLQueryItem(name: "today", value: spotterDay())]) }
    private var socialPath: String { "/api/friends?section=social&includeBuddy=1" }
    private var cleanedCode: String { code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("好友").font(.system(.largeTitle, weight: .heavy)).accessibilityAddTraits(.isHeader)
                    Spacer()
                    NavigationLink {
                        NativeCoachingView(api: api, owner: owner).onDisappear { Task { await refreshPlans() } }
                    } label: { Label("教练与学员", systemImage: "graduationcap") }.buttonStyle(SecondaryButtonStyle())
                }.padding(.bottom, 4)
                SecondarySegment(options: NativeFriendsPage.allCases, value: $page, title: \.rawValue)
                if dialog == nil, let notice { SecondaryNotice(message: notice, warning: error) }
                switch page {
                case .contacts: contacts
                case .feed: feedContent
                case .privacy: privacy
                }
            }.secondaryPage()
        }
        .foregroundStyle(SpotterPalette.ink).background(SpotterPalette.background)
        .task { await load() }
        .onAppear { presentRequestedBuddySearch() }
        .onChange(of: buddySearchRequest) { _ in presentRequestedBuddySearch() }
        .onChange(of: search) { _ in results = nil }
        .task(id: page) {
            if page == .feed, feed == nil { await loadFeed() }
        }
        .refreshable { await load(); if page == .feed { await loadFeed() } }
        .sheet(item: $dialog) { item in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 13) {
                        if item == .invite { invitation }
                        else { requests }
                        if let notice { SecondaryNotice(message: notice, warning: error) }
                    }.secondaryPage()
                }.background(SpotterPalette.background)
                    .navigationTitle(item == .invite ? inviteKind.invitationTitle : item.rawValue).navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button("完成") { closeDialog() }.disabled(busy) }
                    }
            }.presentationDragIndicator(.visible).interactiveDismissDisabled(busy)
        }
    }

    private var contacts: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Text("联系人").font(.headline)
                if let data { SecondaryBadge(text: "\(data.friends.count) 位") }
                Spacer()
            }
            HStack(spacing: 7) {
                Button { open(.invite) } label: { Label("添加好友", systemImage: "person.badge.plus") }
                    .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy)
                Button { open(.invite, kind: .buddy) } label: { Label("找搭子", systemImage: "person.2") }
                    .buttonStyle(SecondaryButtonStyle()).disabled(busy)
            }
            Button { open(.requests) } label: {
                let count = social?.incoming.count ?? 0
                SecondaryRow(title: "新的朋友", detail: count > 0 ? "\(count) 条申请" : nil, icon: "person.badge.plus", color: SpotterPalette.wash)
                    .secondaryCard()
            }.buttonStyle(.plain)
            if let data {
                let buddies = data.friends.filter(\.buddy)
                let ordinary = data.friends.filter { !$0.buddy }
                if !buddies.isEmpty { contactGroup("训练搭子", friends: buddies) }
                if !ordinary.isEmpty { contactGroup("普通好友", friends: ordinary) }
                if data.friends.isEmpty { SecondaryNotice(message: "添加好友后，可从联系人查看对方分享的每日记录。") }
            } else if !error { ProgressView("正在读取好友…") }
            else { Button("重新读取") { Task { await load() } }.buttonStyle(SecondaryButtonStyle()) }
        }
    }

    private func contactGroup(_ title: String, friends: [SecondaryFriend]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                Text(title).font(.subheadline.weight(.semibold))
                if title == "普通好友" { SecondaryBadge(text: "\(friends.count) 位") }
            }.padding(.horizontal, 13).padding(.vertical, 10)
            ForEach(friends) { friend in
                Divider().padding(.horizontal, 12)
                friendLink(friend)
            }
        }.secondaryCard()
    }

    private func friendLink(_ friend: SecondaryFriend, day: String? = nil, summary: [SecondaryFriendFeed.Day.Item.Workout] = []) -> some View {
        NavigationLink {
            SecondaryFriendDetail(api: api, friend: data?.friends.first(where: { $0.id == friend.id }) ?? friend,
                                  initialDay: day, listPath: listPath) { await load(); await refreshPlans() }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                avatar(friend.name, buddy: friend.buddy)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 5) {
                        Text(friend.name).font(.subheadline.weight(.semibold))
                        if friend.buddy { SecondaryBadge(text: "训练搭子", green: true) }
                        if friend.checkedIn == true { SecondaryBadge(text: "已打卡", green: true) }
                    }
                    if let handle = friend.handle { Text(handle).font(.caption.monospaced()).foregroundStyle(SpotterPalette.muted) }
                    if day == nil { Text("查看每日记录").font(.caption).foregroundStyle(SpotterPalette.muted) }
                    else if summary.isEmpty { Text("已打卡").font(.caption).foregroundStyle(SpotterPalette.muted) }
                    ForEach(summary) { workout in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(workout.title).font(.subheadline.weight(.semibold))
                            Text("\(workout.minutes) 分钟 · \(workout.sets) 组").font(.caption).foregroundStyle(SpotterPalette.muted)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(8)
                            .background(SpotterPalette.wash.opacity(0.62), in: RoundedRectangle(cornerRadius: 9))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                    .padding(.top, 7)
            }.padding(12).frame(minHeight: 58).contentShape(Rectangle())
        }.buttonStyle(.plain)
    }

    private var feedContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let feed {
                if feed.days.isEmpty { SecondaryNotice(message: "朋友圈暂时没有新的训练打卡。") }
                ForEach(feed.days) { day in
                    SecondaryGroup(title: day.date == spotterDay() ? "今天" : day.date) {
                        ForEach(day.items) { item in
                            if item.id != day.items.first?.id { Divider().padding(.horizontal, 12) }
                            friendLink(item.friend, day: day.date, summary: item.workouts ?? [])
                        }
                    }
                }
            } else if !error { ProgressView("正在读取朋友圈…") }
            else { Button("重新读取") { Task { await loadFeed() } }.buttonStyle(SecondaryButtonStyle()) }
        }
    }

    private var privacy: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack { SecondaryTile(icon: "lock", color: secondaryLilac); Text("朋友圈权限").font(.headline) }
                if let social {
                    privacySwitch("关闭朋友圈", detail: "向普通好友隐藏训练和饮食记录。搭子的共享设置照常生效。", value: social.preferences.closed, key: \.closed)
                    privacySwitch("允许通过用户名找到我", detail: "其他用户可输入你的用户名或完整的用户名#编号。", value: social.preferences.discoverable, key: \.discoverable)
                    privacySwitch("仅显示最近 3 天", detail: "你与搭子、好友互相查看最近 3 天的活动。", value: social.preferences.recentOnly, key: \.recentOnly)
                } else if !error { ProgressView("正在读取朋友圈权限…") }
                else { Button("重新读取") { Task { await load() } }.buttonStyle(SecondaryButtonStyle()) }
            }.padding(12).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()
            if let data, !data.friends.isEmpty {
                SecondaryGroup(title: "好友分享范围") {
                    ForEach(data.friends) { friend in
                        if friend.id != data.friends.first?.id { Divider().padding(.horizontal, 12) }
                        friendLink(friend)
                    }
                }
            }
        }
    }

    private func privacySwitch(_ title: String, detail: String, value: Bool, key: WritableKeyPath<SecondarySocial.Preferences, Bool>) -> some View {
        SecondaryToggle(title: title, detail: detail, value: Binding(get: { value }, set: { next in
            guard var preferences = social?.preferences else { return }
            preferences[keyPath: key] = next
            Task { await mutateSocial(["action": "social-preferences", "preferences": preferences.body], confirmation: "朋友圈权限已保存。") }
        })).disabled(busy)
    }

    private var invitation: some View {
        VStack(alignment: .leading, spacing: 11) {
            if inviteKind == .buddy {
                SecondaryNotice(message: "对方接受申请后，双方成为训练搭子。分享范围遵循各自的隐私设置。")
                searchPanel
            } else {
                SecondaryNotice(message: "添加后默认互相分享训练打卡、详情和饮食记录状态，具体范围遵循双方的分享设置。")
                SecondarySegment(options: InviteTab.allCases, value: $inviteTab, title: \.rawValue)
                if inviteTab == .search { searchPanel } else { codePanel }
            }
        }
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("对方的用户名").font(.subheadline.weight(.semibold))
            HStack {
                TextField("例如 spotter#1234", text: $search).textFieldStyle(.roundedBorder).submitLabel(.search)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityLabel("对方的用户名")
                    .onSubmit { Task { await findFriends() } }
                Button { Task { await findFriends() } } label: { Label("搜索", systemImage: "magnifyingglass") }
                    .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy || search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if let results {
                if results.isEmpty {
                    SecondaryNotice(message: inviteKind == .buddy ? "暂无匹配用户。请核对用户名，或请对方开启用户名搜索。" : "暂无匹配用户。请核对用户名、请对方开启用户名搜索，或使用邀请码。")
                }
                ForEach(results) { result in
                    let waiting = social?.outgoing.contains { $0.personId == result.id && $0.connectionKind == inviteKind } == true
                    let received = social?.incoming.contains { $0.personId == result.id && $0.connectionKind == inviteKind } == true
                    HStack {
                        avatar(result.name)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(result.name).font(.subheadline.weight(.semibold))
                            if let handle = result.handle { Text(handle).font(.caption.monospaced()).foregroundStyle(SpotterPalette.muted) }
                        }
                        Spacer()
                        Button(received ? "处理申请" : waiting ? "已申请" : "发送申请") {
                            if received { open(.requests) }
                            else { Task { await mutateSocial(["action": "request", "id": result.id, "kind": inviteKind.rawValue], confirmation: inviteKind.requestTitle + "已发送。") } }
                        }.buttonStyle(SecondaryButtonStyle()).disabled(busy || waiting)
                    }.padding(.vertical, 5)
                }
            }
        }
    }

    private var codePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("我的邀请码").font(.headline)
            if let invite = data?.invite {
                Text(invite.code).font(.footnote.monospaced()).textSelection(.enabled)
                if let date = inviteDate(invite.expiresAt) {
                    Text("有效至 \(date.formatted(date: .abbreviated, time: .shortened))，使用一次后失效。")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                HStack {
                    ShareLink(item: api.origin + "/#friend-invite=" + invite.code) { Label("分享链接", systemImage: "square.and.arrow.up") }
                        .buttonStyle(SecondaryButtonStyle(primary: true))
                    Button("复制邀请码") { UIPasteboard.general.string = invite.code; report("已复制邀请码。") }
                        .buttonStyle(SecondaryButtonStyle())
                }
                Button("停用邀请码") { Task { await mutateList(["action": "revoke"], confirmation: "邀请码已停用。") } }
                    .buttonStyle(.plain).foregroundStyle(SpotterPalette.accent).disabled(busy)
            } else {
                Button("生成邀请码") { Task { await mutateList(["action": "invite"], confirmation: "邀请码已生成。") } }
                    .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy)
            }
            Divider()
            Text("对方的邀请码").font(.subheadline.weight(.semibold))
            TextField("输入或粘贴好友邀请码", text: $code).textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("添加为好友") { Task { await mutateList(["action": "join", "code": cleanedCode], confirmation: "好友已添加。") } }
                .buttonStyle(SecondaryButtonStyle()).disabled(busy || cleanedCode.range(of: "^[a-f0-9]{32}$", options: .regularExpression) == nil)
        }
    }

    private var requests: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let social {
                if social.incoming.isEmpty && social.outgoing.isEmpty { SecondaryNotice(message: "还没有好友或搭子申请。") }
                if !social.incoming.isEmpty { requestGroup("收到的申请", values: social.incoming, incoming: true) }
                if !social.outgoing.isEmpty { requestGroup("发出的申请", values: social.outgoing, incoming: false) }
            } else if !error { ProgressView("正在读取好友申请…") }
        }
    }

    private func requestGroup(_ title: String, values: [SecondarySocial.Request], incoming: Bool) -> some View {
        SecondaryGroup(title: title) {
            ForEach(values) { request in
                HStack(spacing: 7) {
                    avatar(request.name)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(request.name).font(.subheadline.weight(.semibold))
                        Text(request.connectionKind.requestTitle).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 3)
                    if incoming { requestButton("接受", request: request, decision: "accept", confirmation: request.connectionKind == .buddy ? "已连接训练搭子。" : "好友已添加。") }
                    requestButton(incoming ? "拒绝" : "撤回", request: request, decision: incoming ? "decline" : "cancel",
                                  confirmation: incoming ? "已拒绝申请。" : "申请已撤回。")
                }.padding(11)
            }
        }
    }

    private func requestButton(_ title: String, request: SecondarySocial.Request, decision: String, confirmation: String) -> some View {
        Button(title) { Task { await mutateSocial(["action": "respond", "id": request.id, "decision": decision], confirmation: confirmation) } }
            .buttonStyle(SecondaryButtonStyle(primary: decision == "accept")).disabled(busy)
    }

    private func open(_ item: Dialog, kind: NativeConnectionKind = .friend) {
        notice = nil
        error = false
        if item == .invite {
            inviteTab = .search
            inviteKind = kind
            search = ""
            results = nil
        }
        dialog = item
    }

    private func presentRequestedBuddySearch() {
        guard buddySearchRequest > handledBuddyRequest else { return }
        handledBuddyRequest = buddySearchRequest
        page = .contacts
        open(.invite, kind: .buddy)
    }

    private func closeDialog() { dialog = nil; notice = nil; error = false }
    private func report(_ text: String, failure: Bool = false) { notice = text; error = failure }

    private func load() async {
        async let contacts = api.spotterRead(listPath, as: SecondaryFriendList.self)
        async let preferences = api.spotterRead(socialPath, as: SecondarySocial.self)
        do { data = try await contacts; social = try await preferences }
        catch { report(error.localizedDescription, failure: true) }
    }

    private func loadFeed() async {
        do { feed = try await api.spotterRead("/api/friends?feed=1", as: SecondaryFriendFeed.self) }
        catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { report(error.localizedDescription, failure: true) }
    }

    private func findFriends() async {
        let value = search.trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = inviteKind
        guard !busy, !value.isEmpty else { return }
        guard value.count <= 29 else { report("请输入用户名或完整的用户名#编号。", failure: true); return }
        notice = nil
        busy = true
        defer { busy = false }
        do {
            let result = try await api.spotterRead(friendPath([URLQueryItem(name: "search", value: value), URLQueryItem(name: "mode", value: kind.rawValue)]), as: SearchResponse.self)
            guard dialog == .invite, inviteKind == kind, search.trimmingCharacters(in: .whitespacesAndNewlines) == value else { return }
            results = result.results
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func mutateList(_ body: [String: Any], confirmation: String) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let response = try await api.spotterSend(listPath, body: body)
            data = try JSONDecoder().decode(SecondaryFriendList.self, from: response)
            if body["action"] as? String == "join" { code = ""; closeDialog(); await refreshPlans() }
            report(confirmation)
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func mutateSocial(_ body: [String: Any], confirmation: String) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            var request = body
            request["expectedOwner"] = owner
            let response = try await api.spotterSend("/api/friends?includeBuddy=1", body: request)
            social = try JSONDecoder().decode(SecondarySocial.self, from: response)
            if body["decision"] as? String == "accept" { await load(); await refreshPlans() }
            if body["action"] as? String == "social-preferences" { feed = nil }
            report(confirmation)
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func inviteDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

private func avatar(_ name: String, buddy: Bool = false) -> some View {
    Text(name.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init) ?? "友")
        .font(.subheadline.weight(.heavy)).foregroundStyle(SpotterPalette.deep)
        .frame(width: 35, height: 35)
        .background(buddy ? SpotterPalette.wash : secondaryLilac, in: RoundedRectangle(cornerRadius: 9))
        .accessibilityHidden(true)
}

private struct SecondaryToggle: View {
    let title: String
    let detail: String
    @Binding var value: Bool

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            Toggle(isOn: $value) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.subheadline.weight(.semibold))
                    Text(detail).font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }.tint(SpotterPalette.accent).padding(.vertical, 8)
        }
    }
}

@MainActor
private struct SecondaryFriendDetail: View {
    let api: NativeAPI
    let friend: SecondaryFriend
    let listPath: String
    let changed: @MainActor () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var record: Record?
    @State private var sharing: SecondaryFriend.Sharing?
    @State private var saved: SecondaryFriend.Sharing?
    @State private var busy = false
    @State private var showRemove = false
    @State private var error: String?
    @State private var loadRevision = 0

    private struct Record: Decodable {
        let restricted: Bool?
        let workoutCheckin: Bool
        let dietCheckin: Bool?
        let training: [NativeJSON]?
        let nutrition: [NativeJSON]?
    }

    init(api: NativeAPI, friend: SecondaryFriend, initialDay: String?, listPath: String,
         changed: @escaping @MainActor () async -> Void) {
        self.api = api
        self.friend = friend
        self.listPath = listPath
        self.changed = changed
        _date = State(initialValue: initialDay.flatMap(SecondaryDate.parse) ?? SecondaryDate.today)
        _sharing = State(initialValue: friend.sharing)
        _saved = State(initialValue: friend.sharing)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    avatar(friend.name, buddy: friend.buddy)
                    Text(friend.name).font(.title2.weight(.heavy))
                    if friend.buddy { SecondaryBadge(text: "训练搭子", green: true) }
                }
                VStack(alignment: .leading, spacing: 7) {
                    Text(date == SecondaryDate.today ? "今天的记录" : "\(spotterDay(date).suffix(5)) 的记录").font(.headline)
                    HStack {
                        stepButton("前一天", symbol: "chevron.left") { date = SecondaryDate.shift(date, -1) }
                            .disabled(spotterDay(date) <= "1900-01-01")
                        Spacer()
                        DatePicker("好友记录日期", selection: $date, in: (SecondaryDate.parse("1900-01-01") ?? date)...SecondaryDate.today, displayedComponents: .date).labelsHidden()
                        Spacer()
                        stepButton("后一天", symbol: "chevron.right") { date = SecondaryDate.shift(date, 1) }.disabled(date >= SecondaryDate.today)
                    }.background(SpotterPalette.wash.opacity(0.58), in: RoundedRectangle(cornerRadius: 9))
                }.padding(12).secondaryCard()
                if let record {
                    if record.restricted == true { SecondaryNotice(message: "这一天的记录未开放查看。") }
                    else { dailyRecords(record) }
                } else if error == nil { ProgressView("正在读取当天记录…") }
                else { Button("重新读取") { loadRevision += 1 }.buttonStyle(SecondaryButtonStyle()) }
                if let sharing { sharingCard(sharing) }
                if let error { SecondaryNotice(message: error, warning: true) }
                if !friend.buddy {
                    Button("移除好友", role: .destructive) { showRemove = true }
                        .buttonStyle(.plain).foregroundStyle(.red).disabled(busy).frame(minHeight: 44)
                }
            }.secondaryPage()
        }.background(SpotterPalette.background)
            .navigationTitle("好友").navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
            .task(id: "\(spotterDay(date)):\(loadRevision)") { await load() }
            .confirmationDialog("移除好友", isPresented: $showRemove, titleVisibility: .visible) {
                Button("确认移除", role: .destructive) { Task { await mutate(["action": "remove", "id": friend.id], remove: true) } }
                Button("取消", role: .cancel) {}
            } message: { Text("移除后，你和\(friend.name)在好友页的分享会停止。") }
    }

    private func dailyRecords(_ record: Record) -> some View {
        VStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    SecondaryTile(icon: "dumbbell"); Text("训练").font(.headline); Spacer()
                    SecondaryBadge(text: record.workoutCheckin ? "已打卡" : "未打卡", green: record.workoutCheckin)
                }
                if let training = record.training {
                    ForEach(Array(training.enumerated()), id: \.offset) { _, workout in
                        if workout["exercises"].array.isEmpty { workoutHeader(workout).padding(10).secondaryCard(radius: 9) }
                        else {
                            DisclosureGroup {
                                ForEach(Array(workout["exercises"].array.enumerated()), id: \.offset) { _, exercise in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(exercise["name"].string).font(.subheadline.weight(.semibold))
                                        ForEach(Array(exercise["sets"].array.enumerated()), id: \.offset) { index, set in
                                            let seconds = Int(set["seconds"].number)
                                            let unit = exercise["unit"].string
                                            Text("\(index + 1) 组 · \(statNumber(set["weight"].number)) \(unit) × \(Int(set["reps"].number)) 次" + (seconds > 0 ? " · \(seconds) 秒" : ""))
                                                .font(.caption).foregroundStyle(SpotterPalette.muted)
                                            if case .object = set["right"] {
                                                Text("右侧 · \(statNumber(set["right"]["weight"].number)) \(unit) × \(Int(set["right"]["reps"].number)) 次")
                                                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                                            }
                                        }
                                    }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 5)
                                }
                            } label: { workoutHeader(workout) }.padding(10).secondaryCard(radius: 9)
                        }
                    }
                } else { Label("训练详情未共享", systemImage: "lock").font(.caption).foregroundStyle(SpotterPalette.muted) }
            }.padding(12).secondaryCard()
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    SecondaryTile(icon: "fork.knife", color: secondaryTeal); Text("饮食").font(.headline); Spacer()
                    if let checkin = record.dietCheckin { SecondaryBadge(text: checkin ? "已记录" : "未记录", green: checkin) }
                }
                if let nutrition = record.nutrition {
                    ForEach(Array(nutrition.enumerated()), id: \.offset) { _, meal in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(meal["meal"].string) · \(meal["name"].string)").font(.subheadline.weight(.semibold))
                            Text("\(statNumber(meal["calories"].number)) kcal · 蛋白质 \(statNumber(meal["protein"].number)) g")
                                .font(.caption).foregroundStyle(SpotterPalette.muted)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 4)
                    }
                } else { Label("饮食详情未共享", systemImage: "lock").font(.caption).foregroundStyle(SpotterPalette.muted) }
            }.padding(12).secondaryCard()
        }
    }

    private func workoutHeader(_ workout: NativeJSON) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workout["title"].string).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
            Text("\(Int(workout["minutes"].number)) 分钟 · \(Int(workout["sets"].number)) 组").font(.caption).foregroundStyle(SpotterPalette.muted)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sharingCard(_ value: SecondaryFriend.Sharing) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { SecondaryTile(icon: "lock", color: secondaryLilac); Text("我分享给\(friend.name)").font(.headline) }
            if !friend.buddy {
                SecondaryToggle(title: "训练详情", detail: "已完成的动作、组数、重量和次数", value: shareValue(\.training))
            }
            SecondaryToggle(title: friend.buddy ? "饮食记录与详情" : "饮食记录状态", detail: "当天有没有记录餐食", value: shareValue(\.nutrition))
            if !friend.buddy {
                SecondaryToggle(title: "饮食详情", detail: value.nutrition ? "餐次、食物、克数和营养" : "先开启饮食记录状态", value: shareValue(\.nutritionDetails))
                    .disabled(!value.nutrition)
            }
            Button("保存分享范围") { Task { await mutate(["action": "share", "id": friend.id, "sharing": value.body]) } }
                .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy || value == saved)
        }.padding(12).secondaryCard().disabled(busy)
    }

    private func shareValue(_ key: WritableKeyPath<SecondaryFriend.Sharing, Bool>) -> Binding<Bool> {
        Binding(get: { sharing?[keyPath: key] ?? false }, set: { next in
            guard var new = sharing else { return }
            new[keyPath: key] = next
            if key == \.nutrition && (friend.buddy || !next) { new.nutritionDetails = next }
            sharing = new
        })
    }

    private func load() async {
        record = nil
        error = nil
        let day = spotterDay(date)
        do {
            let path = friendPath([URLQueryItem(name: "friend", value: friend.id), URLQueryItem(name: "date", value: day)])
            let next = try await api.spotterRead(path, as: Record.self)
            if !Task.isCancelled && day == spotterDay(date) { record = next }
        } catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { if day == spotterDay(date) { self.error = error.localizedDescription } }
    }

    private func mutate(_ body: [String: Any], remove: Bool = false) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let response = try await api.spotterSend(listPath, body: body)
            if let refreshed = try JSONDecoder().decode(SecondaryFriendList.self, from: response).friends.first(where: { $0.id == friend.id }) {
                saved = refreshed.sharing
                sharing = refreshed.sharing
            }
            error = nil
            await changed()
            if remove { dismiss() }
        } catch { self.error = error.localizedDescription }
    }
}
