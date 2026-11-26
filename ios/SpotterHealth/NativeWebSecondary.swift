import Charts
import SwiftUI
import UIKit
import UniformTypeIdentifiers

private let secondaryLilac = SpotterPalette.adaptive(0xebe6f5, 0x373049)
private let secondaryTeal = SpotterPalette.adaptive(0xdbf0eb, 0x24443d)
private let secondarySlate = SpotterPalette.adaptive(0xe6edf0, 0x303d41)

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

private struct SecondarySelectionMenu<Option: Hashable>: View {
    let label: String
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String

    var body: some View {
        SpotterMenuPicker(label, selection: $selection, options: options.map { ($0, title($0)) }) {
            HStack(spacing: 5) {
                Text(title(selection)).font(.subheadline.weight(.semibold)).lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(SpotterPalette.muted)
                    .accessibilityHidden(true)
            }
            .fixedSize(horizontal: true, vertical: false)
            .foregroundStyle(SpotterPalette.ink)
        }
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
        HStack(spacing: 6) { actions }

            .fixedSize(horizontal: true, vertical: false)
    }
}

private typealias SecondaryButtonStyle = SpotterControlButtonStyle

private struct SecondaryBadge: View {
    let text: String
    var green = false

    var body: some View {
        Text(text).font(.caption2.weight(.semibold))
            .foregroundStyle(green ? SpotterPalette.ink : SpotterPalette.muted)
            .padding(.horizontal, 7).padding(.vertical, 4)
            .background(green ? SpotterPalette.wash : SpotterPalette.background, in: Capsule())
    }
}

private struct SecondaryTile: View {
    let icon: String
    var color = SpotterPalette.wash
    var size: CGFloat = 34
    var onBrightFill = false

    var body: some View {
        Image(systemName: icon).font(.system(size: min(18, size * 0.48), weight: .semibold))
            .foregroundStyle(onBrightFill ? SpotterPalette.deep : SpotterPalette.ink)
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

enum NativeWidgetStatsRequest: Equatable {
    case history, weekly, year
}

@MainActor
struct NativeSpotterStats: View {
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterAccent) private var accent
    @EnvironmentObject private var remarks: NativeSocialRemarks
    @ObservedObject var store: NativeWorkoutStore
    let api: NativeAPI
    let owner: String
    var widgetStatsRequest: Binding<NativeWidgetStatsRequest?>? = nil

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
    @State private var editingDates = false
    @State private var showsWeek = false
    @State private var selectedWorkout: NativeWorkoutEntry?

    private var sharedLogs: [NativeWorkoutEntry] {
        guard let partner else { return [] }
        return store.entries.filter { $0.kind == "log" && $0.owner == partner.id }
    }

    private var subjectLogs: [NativeWorkoutEntry] { partnerSelected && partner != nil ? sharedLogs : store.logs }
    private var range: ClosedRange<Date> { range(at: step) }
    private var completeComparison: ClosedRange<Date> {
        if comparison == .year {
            return SecondaryDate.shift(range.lowerBound, -1, component: .year)...SecondaryDate.shift(range.upperBound, -1, component: .year)
        }
        if period == .custom {
            return SecondaryDate.shift(range.lowerBound, -rangeCount(range))...SecondaryDate.shift(range.lowerBound, -1)
        }
        return self.range(at: step - 1)
    }

    private var elapsedRange: ClosedRange<Date> {
        range.lowerBound...max(range.lowerBound, min(range.upperBound, SecondaryDate.today))
    }

    private var comparedRange: ClosedRange<Date> {
        let previous = completeComparison
        guard elapsedRange.upperBound < range.upperBound else { return previous }
        let end = SecondaryDate.shift(previous.lowerBound, rangeCount(elapsedRange) - 1)
        return previous.lowerBound...min(previous.upperBound, end)
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
        VStack(spacing: 9) {
            SpotterGlassSegments(options: Page.allCases, value: $page, title: \.rawValue)
                .padding(.horizontal, 14)
            if page == .overview {
                ScrollView {
                    overview
                        .frame(maxWidth: 620)
                        .padding(.horizontal, 14).padding(.bottom, 16)
                        .frame(maxWidth: .infinity)
                }
                .refreshable { await store.load(); await loadStatsHistory(); await loadPartner() }
                .transition(.opacity)
            } else {
                SecondaryHistory(store: store)
                    .frame(maxWidth: 680)
                    .padding(.horizontal, 14).padding(.bottom, 5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity)
            }
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .foregroundStyle(SpotterPalette.ink)
        .background(SpotterPalette.background)
        .animation(motion, value: page)
        .onAppear(perform: openWidgetStats)
        .onChange(of: widgetStatsRequest?.wrappedValue) { _ in openWidgetStats() }
        .task { await loadPartner() }
        .task(id: page == .overview ? historyKey : nil) {
            if page == .overview { await loadStatsHistory() }
        }
        .sheet(isPresented: $editingDates) {
            SecondaryDateRangeSheet(start: customStart, end: customEnd) { start, end in
                withAnimation(motion) {
                    customStart = start
                    customEnd = end
                }
            }
        }
        .sheet(isPresented: $showsWeek) { weekDetails }
        .sheet(item: $selectedWorkout) { entry in
            NavigationStack { NativeWorkoutDetailView(store: store, entry: entry, showsClose: true) }
                .presentationDragIndicator(.visible)
        }
    }

    private func openWidgetStats() {
        guard let request = widgetStatsRequest, let destination = request.wrappedValue else { return }
        request.wrappedValue = nil
        switch destination {
        case .history:
            page = .history
        case .weekly:
            partnerSelected = false
            period = .week
            step = -1
            metric = .sessions
            page = .overview
        case .year:
            partnerSelected = false
            period = .custom
            customEnd = SecondaryDate.today
            customStart = SecondaryDate.shift(customEnd, -364)
            step = 0
            metric = .minutes
            page = .overview
        }
    }

    private var historyKey: String {
        "\(spotterDay(elapsedRange.lowerBound))|\(spotterDay(elapsedRange.upperBound))|\(comparison.rawValue)|\(spotterDay(comparedRange.lowerBound))|\(spotterDay(comparedRange.upperBound))"
    }

    private func loadStatsHistory() async {
        guard rangeCount(range) <= 3_660 else { return }
        let recentYear = SecondaryDate.shift(elapsedRange.upperBound, -364)
        var first = min(elapsedRange.lowerBound, recentYear)
        var last = elapsedRange.upperBound
        if comparison != .off {
            first = min(first, comparedRange.lowerBound)
            last = max(last, comparedRange.upperBound)
        }
        await store.loadHistory(from: spotterDay(first), through: spotterDay(last))
    }

    private var canStepForward: Bool {
        period == .custom ? SecondaryDate.shift(customEnd, rangeCount(range)) <= SecondaryDate.today : step < 0
    }

    private var canStepBack: Bool {
        let first = period == .custom ? SecondaryDate.shift(customStart, -rangeCount(range)) : self.range(at: step - 1).lowerBound
        return spotterDay(first) >= "1900-01-01" && rangeCount(range) <= 3_660
    }

    private func shiftPeriod(_ delta: Int) {
        if period == .custom {
            let distance = rangeCount(range) * delta
            customStart = SecondaryDate.shift(customStart, distance)
            customEnd = SecondaryDate.shift(customEnd, distance)
        } else { step += delta }
    }

    private var overview: some View {
        let current = logs(elapsedRange)
        let former = comparison == .off ? nil : logs(comparedRange)
        let subjectID = (partnerSelected ? partner?.id : nil) ?? store.owner
        return LazyVStack(spacing: 9) {
            rangePicker
            if rangeCount(range) > 3_660 {
                SecondaryNotice(message: "请选择有效日期，范围最长 10 年。", warning: true)
            } else {
                if period == .week, !partnerSelected { weekProgress }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)], spacing: 7) {
                    ForEach(SecondaryMetric.allCases, id: \.self) { tile($0, current: current, former: former) }
                }
                comparisonCard(current: current, former: former)
                trendCard(current: current, former: former)
                SecondaryActivityCalendar(entries: subjectLogs, end: min(range.upperBound, SecondaryDate.today))
                SecondaryMusclePanel(entries: current, subjectFigure: store.anatomyVariant(for: subjectID))
                    .id(subjectID)
                SecondaryPerformance(entries: current, compared: former) { selectedWorkout = $0 }
            }
        }
    }

    private var rangePicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let partner, !sharedLogs.isEmpty {
                let name = remarks.name(for: partner.id, fallback: partner.name)
                SpotterGlassSegments(options: [false, true], value: $partnerSelected, glass: false, title: { $0 ? "搭子 · \(name)" : "我" })
            }
            SpotterGlassSegments(options: Period.allCases, value: $period, title: \.rawValue)
                .onChange(of: period) { value in
                    step = 0
                    if value == .custom { editingDates = true }
                }
            if period == .recent {
                SpotterMenuPicker("最近天数", selection: $recent, options: [7, 30, 90, 365].map { ($0, "\($0) 天") })
                    .onChange(of: recent) { _ in step = 0 }
                    .transition(.opacity)
            }
            HStack(spacing: 5) {
                stepButton("上一周期", symbol: "chevron.left") { withAnimation(motion) { shiftPeriod(-1) } }
                    .disabled(!canStepBack)
                if period == .custom {
                    Button { editingDates = true } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "calendar").foregroundStyle(accent.tint)
                            rangeTitle
                            Image(systemName: "chevron.down").font(.caption2).foregroundStyle(SpotterPalette.muted)
                        }.frame(maxWidth: .infinity)
                    }.buttonStyle(.spotterControl).accessibilityLabel("编辑自定义日期")
                } else {
                    rangeTitle.frame(maxWidth: .infinity)
                }
                stepButton("下一周期", symbol: "chevron.right") { withAnimation(motion) { shiftPeriod(1) } }.disabled(!canStepForward)
            }

        }.padding(9).secondaryCard().animation(motion, value: period)
    }

    private var rangeTitle: some View {
        VStack(spacing: 2) {
            Text(periodTitle).font(.subheadline.weight(.bold)).foregroundStyle(SpotterPalette.ink)
            Text(label(range)).font(.caption2.monospacedDigit()).foregroundStyle(SpotterPalette.muted)
        }
        .lineLimit(1).minimumScaleFactor(0.70)
    }

    private var weekPlans: [NativeWorkoutEntry] {
        let from = spotterDay(range.lowerBound)
        let through = spotterDay(range.upperBound)
        return store.plans.filter { $0.owner == owner && $0.day >= from && $0.day <= through }
            .sorted { $0.day == $1.day ? $0.displayTitle < $1.displayTitle : $0.day < $1.day }
    }

    private var weekReceipts: [NativeWorkoutEntry.Key: NativeWorkoutEntry] {
        var result: [NativeWorkoutEntry.Key: NativeWorkoutEntry] = [:]
        for entry in store.logs {
            if let key = entry.planKey, result[key] == nil { result[key] = entry }
        }
        return result
    }

    private var weekProgress: some View {
        let plans = weekPlans
        let receipts = weekReceipts
        let finished = plans.filter { receipts[$0.key] != nil }.count
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("本周计划进度", systemImage: "checklist").font(.headline)
                Spacer(minLength: 4)
                if !plans.isEmpty {
                    Button { showsWeek = true } label: {
                        Label("查看明细", systemImage: "chevron.right").font(.caption.weight(.semibold))
                    }.buttonStyle(.spotterControl)
                }
            }
            if plans.isEmpty {
                Text("这周还没有安排训练计划。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            } else {
                Text("已完成 \(finished) / \(plans.count) 堂").font(.subheadline.weight(.semibold)).monospacedDigit()
                ProgressView(value: Double(finished), total: Double(plans.count)).tint(accent.tint)
                    .accessibilityLabel("计划完成进度")
                    .accessibilityValue("\(finished) 堂，共 \(plans.count) 堂")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12).secondaryCard()
    }

    private var weekDetails: some View {
        let receipts = weekReceipts
        return NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(weekPlans, id: \.key) { plan in
                        if let receipt = receipts[plan.key] {
                            NavigationLink {
                                NativeWorkoutDetailView(store: store, entry: receipt)
                            } label: {
                                SecondaryRow(title: plan.displayTitle, detail: "\(plan.day) · 已完成", icon: "checkmark.circle")
                                    .secondaryCard()
                            }.buttonStyle(.spotterPress)
                        } else {
                            SecondaryRow(title: plan.displayTitle, detail: "\(plan.day) · 待完成", icon: "calendar", accessory: nil)
                                .secondaryCard()
                        }
                    }
                }.secondaryPage()
            }
            .background(SpotterPalette.background)
            .navigationTitle("本周计划进度").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { showsWeek = false }.buttonStyle(.spotterPress)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    private func tile(_ key: SecondaryMetric, current: [NativeWorkoutEntry], former: [NativeWorkoutEntry]?) -> some View {
        let lead = key == .volume
        let value = key.value(in: current)
        let difference = former.map { value - key.value(in: $0) } ?? 0
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(key == .sessions ? "训练次数 / 天数" : key.rawValue).font(.caption.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 2)
                SecondaryTile(icon: key.icon, color: lead ? accent.fill : SpotterPalette.wash, size: 25, onBrightFill: lead)
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
        let value = metric.value(in: current) / Double(metric == .volume ? rangeCount(elapsedRange) : 1)
        let prior = former.map { metric.value(in: $0) / Double(metric == .volume ? rangeCount(comparedRange) : 1) } ?? 0
        let scale = max(1, value, prior)
        return VStack(alignment: .leading, spacing: 9) {
            SecondaryActionHeader(title: "周期对比") {
                metricSelect("对比指标", value: $metric)
                SecondarySelectionMenu(label: "比较范围", options: Compare.allCases, selection: $comparison, title: \.rawValue)
            }
            if elapsedRange.upperBound < range.upperBound, former != nil {
                Label("按本期已过去的天数对比", systemImage: "calendar.badge.clock")
                    .font(.caption2.weight(.medium)).foregroundStyle(SpotterPalette.muted)
            }
            comparisonRow("本期", value: value, scale: scale, period: elapsedRange, empty: current.isEmpty)
            if let former { comparisonRow("对比期", value: prior, scale: scale, period: comparedRange, empty: former.isEmpty) }
        }.padding(12).secondaryCard()
    }

    private func comparisonRow(_ title: String, value: Double, scale: Double, period: ClosedRange<Date>, empty: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(title).font(.caption)
                Spacer()
                Text(empty ? "—" : statNumber(value)).font(.title3.weight(.heavy)).foregroundStyle(SpotterPalette.ink).monospacedDigit()
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
        let points = max(2, min(120, max(rangeCount(elapsedRange), former == nil ? 0 : rangeCount(comparedRange))))
        let here = cumulative(current, in: elapsedRange, points: points)
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
                    AxisMarks(values: Set([0, (points - 1) / 2, points - 1]).sorted()) { value in
                        if let index = value.as(Int.self) {
                            AxisValueLabel { Text(spotterDay(SecondaryDate.shift(elapsedRange.lowerBound, (rangeCount(elapsedRange) - 1) * index / (points - 1))).suffix(5)) }
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
        Image(systemName: symbol).font(.subheadline.weight(.semibold)).frame(width: 22)
    }.buttonStyle(.spotterControl).accessibilityLabel(name)
}

private struct SecondaryDateRangeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State var start: Date
    @State var end: Date
    let apply: (Date, Date) -> Void
    @State private var edge = Edge.start

    private enum Edge: String, CaseIterable {
        case start = "开始", end = "结束"
    }

    private var valid: Bool { (1...3_660).contains(SecondaryDate.days(start, through: end)) }
    private var firstDate: Date { SecondaryDate.parse("1900-01-01") ?? start }
    private var selectedDate: Binding<Date> {
        Binding(get: { edge == .start ? start : end }, set: { selected in
            let day = SecondaryDate.calendar.startOfDay(for: selected)
            if edge == .start {
                start = day
                if end < start { end = start }
            } else {
                end = day
                if start > end { start = end }
            }
        })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 9) {
                        edgeButton(.start, date: start)
                        Image(systemName: "arrow.right").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                            .accessibilityHidden(true)
                        edgeButton(.end, date: end)
                    }

                    DatePicker(edge == .start ? "开始日期" : "结束日期", selection: selectedDate,
                               in: firstDate...SecondaryDate.today, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .labelsHidden()
                        .environment(\.locale, Locale(identifier: "zh_CN"))
                        .tint(accent.tint)
                        .padding(7).secondaryCard(radius: 20)
                    HStack(spacing: 7) {
                        ForEach([7, 30, 90], id: \.self) { count in
                            Button("近 \(count) 天") {
                                withAnimation(motion) {
                                    end = SecondaryDate.today
                                    start = SecondaryDate.shift(end, 1 - count)
                                }
                            }.buttonStyle(.spotterControl)
                        }
                    }

                    if !valid {
                        Label("日期范围最长 10 年", systemImage: "exclamationmark.circle")
                            .font(.footnote).foregroundStyle(.red)
                    }
                }.secondaryPage()
            }
            .background(SpotterPalette.background)
            .navigationTitle("选择日期范围").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.buttonStyle(.spotterPress) }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Button {
                    apply(start, end)
                    dismiss()
                } label: {
                    Text("应用范围 · \(SecondaryDate.days(start, through: end)) 天").frame(maxWidth: .infinity)
                }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(!valid)
                .padding(.horizontal, 16).padding(.vertical, 8)
                .background(SpotterPalette.background)
            }
        }
        .presentationDragIndicator(.visible)
    }

    private func edgeButton(_ value: Edge, date: Date) -> some View {
        Button { withAnimation(motion) { edge = value } } label: {
            VStack(alignment: .leading, spacing: 4) {
                Label(value.rawValue, systemImage: "calendar").font(.caption2.weight(.semibold))
                    .foregroundStyle(edge == value ? accent.tint : SpotterPalette.muted)
                Text(spotterDay(date)).font(.subheadline.weight(.bold)).monospacedDigit()
                    .lineLimit(1).minimumScaleFactor(0.72)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(10)
            .background(edge == value ? accent.selection : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.spotterPress)
        .accessibilityAddTraits(edge == value ? .isSelected : [])
    }
}

private struct SecondaryActivityCalendar: View {
    let entries: [NativeWorkoutEntry]
    let end: Date
    @State private var selected: String?
    @Environment(\.spotterInteractionMotion) private var motion

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
                            LazyHStack(spacing: 3) {
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
        return Button { withAnimation(motion) { selected = key } } label: {
            RoundedRectangle(cornerRadius: 2).fill(Self.colors[level])
                .overlay(RoundedRectangle(cornerRadius: 2).strokeBorder(selected == key ? SpotterPalette.ink : SpotterPalette.line, lineWidth: 1))
                .frame(width: 14, height: 14)
        }.buttonStyle(.spotterPress).accessibilityLabel("\(key) · \(description(entries))")
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

struct SecondaryAnatomy: View {
    let counts: [String: Int]
    var assistingCounts: [String: Int]? = nil
    var subjectFigure: Figure? = nil
    @State private var manualFigure = Figure.male
    @State private var artwork = [String: Drawing]()
    @State private var selected: String?
    @State private var loaded = false

    typealias Figure = NativeAnatomyVariant

    private var figure: Figure { subjectFigure ?? manualFigure }

    private enum Side: String, CaseIterable {
        case front, back
        var title: String { self == .front ? "正面" : "背面" }
    }

    private struct Source: Decodable { let viewBox: String; let regions: [String: [String]] }
    fileprivate struct Region: Sendable { let key: String; let paths: [Path] }
    struct Drawing: Sendable {
        fileprivate let box: CGRect
        fileprivate let regions: [Region]

        func placement(in size: CGSize) -> (scale: CGFloat, offset: CGPoint) {
            let scale = min(size.width / box.width, size.height / box.height)
            return (scale, CGPoint(x: (size.width - box.width * scale) / 2 - box.minX * scale,
                                   y: (size.height - box.height * scale) / 2 - box.minY * scale))
        }
    }

    private static let colors = [0xd5e3ff, 0xb3c9ff, 0x8caaff, 0x4f72cb, 0x273e9c].map { SpotterPalette.color(UInt32($0)) }
    private static let primaryFill = colors[4]
    private static let assistingFill = colors[2]
    private static let neutral = SpotterPalette.color(0xdce4ef)
    private static let exterior = SpotterPalette.color(0xf3f6fc)
    private static let outline = SpotterPalette.color(0xf7f9fe)
    nonisolated private static let aliases = [
        "upper-chest": "chest", "lower-chest": "chest", "upper-abs": "abs", "lower-abs": "abs",
        "front-deltoid": "front-delts", "rear-deltoid": "rear-delts", "deltoids": "side-delts",
        "upper-trapezius": "trapezius", "lower-trapezius": "trapezius", "inner-quad": "quadriceps",
        "outer-quad": "quadriceps", "rhomboids": "upper-back", "rotator-cuff": "rear-delts"
    ]
    nonisolated static func expandedMuscles(_ muscles: [String: Int]) -> [String: Int] {
        var expanded = muscles
        for (region, group) in aliases where expanded[region] == nil { expanded[region] = muscles[group] }
        return expanded
    }
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
            if subjectFigure == nil {
                SpotterGlassSegments(options: Figure.allCases, value: $manualFigure, glass: false, title: \.title)
                    .accessibilityLabel("肌群图体型")
            }
            if loaded, !artwork.isEmpty {
                HStack(spacing: 9) {
                    ForEach(Side.allCases, id: \.self) { side in
                        if let drawing = artwork["\(figure.rawValue)-\(side.rawValue)"] { diagram(drawing, side: side) }
                    }
                }
                Text(selected.map(description) ?? "点图上任一区域可以查看名称")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                legend
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

    private func count(_ region: String) -> Int {
        if assistingCounts != nil { return counts[region, default: 0] }
        return counts[region] ?? Self.aliases[region].flatMap { counts[$0] } ?? 0
    }

    private func description(_ region: String) -> String {
        let label = name(region) ?? region
        let primary = count(region)
        guard let assistingCounts else { return "\(label) · \(primary) 组" }
        let assisting = assistingCounts[region, default: 0]
        var roles = [String]()
        if primary > 0 { roles.append("主要参与 \(primary) 组") }
        if assisting > 0 { roles.append("辅助参与 \(assisting) 组") }
        return "\(label) · \(roles.isEmpty ? "未参与" : roles.joined(separator: "，"))"
    }

    @ViewBuilder private var legend: some View {
        if assistingCounts != nil {
            HStack(spacing: 6) {
                colorChip(Self.primaryFill)
                Text("主要参与")
                colorChip(Self.assistingFill).padding(.leading, 6)
                Text("辅助参与")
            }
            .font(.caption).foregroundStyle(SpotterPalette.muted)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("深蓝色表示主要参与，浅蓝色表示辅助参与")
        } else {
            HStack(spacing: 4) {
                Text("未训练")
                colorChip(Self.neutral)
                Text("少")
                ForEach(Self.colors.indices, id: \.self) { index in colorChip(Self.colors[index]) }
                Text("多")
            }
            .font(.caption2).foregroundStyle(SpotterPalette.muted)
            .accessibilityLabel("蓝色越深代表完成组数越多")
        }
    }

    private func colorChip(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 13, height: 9).accessibilityHidden(true)
    }

    private func fill(_ region: String, highest: Int) -> Color {
        let total = count(region)
        if let assistingCounts {
            if total > 0 { return Self.primaryFill }
            if assistingCounts[region, default: 0] > 0 { return Self.assistingFill }
        } else if total > 0 {
            let level = max(0, min(4, Int(ceil(Double(total) / Double(highest) * 5)) - 1))
            return Self.colors[level]
        }
        return name(region) == nil ? Self.exterior : Self.neutral
    }

    private func diagram(_ drawing: Drawing, side: Side) -> some View {
        let highest = max(1, counts.values.max() ?? 0)
        let accessible = drawing.regions.filter { region in
            name(region.key) != nil && (count(region.key) > 0 || (assistingCounts?[region.key] ?? 0) > 0)
        }.map { description($0.key) }
        return VStack(spacing: 4) {
            GeometryReader { geometry in
                Canvas { context, size in
                    let placement = drawing.placement(in: size)
                    var canvas = context
                    canvas.translateBy(x: placement.offset.x, y: placement.offset.y)
                    canvas.scaleBy(x: placement.scale, y: placement.scale)
                    for region in drawing.regions {
                        let color = fill(region.key, highest: highest)
                        for path in region.paths {
                            canvas.fill(path, with: .color(color))
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

    nonisolated static func loadArtwork() -> [String: Drawing] { artworkCache }

    nonisolated private static let artworkCache: [String: Drawing] = {
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
    }()

    static func poster(_ artwork: [String: Drawing], figure: Figure, intensity: [String: Double], tile: Color) -> some View {
        HStack(spacing: 0) {
            ForEach(Side.allCases, id: \.self) { side in
                if let drawing = artwork["\(figure.rawValue)-\(side.rawValue)"] {
                    Canvas { context, size in
                        let frame = CGSize(width: max(1, size.width - 25), height: max(1, size.height - 25))
                        let placement = drawing.placement(in: frame)
                        let scale = placement.scale
                        var offset = placement.offset
                        offset.x += (size.width - frame.width) / 2
                        offset.y += 3
                        var canvas = context
                        canvas.translateBy(x: offset.x, y: offset.y)
                        canvas.scaleBy(x: scale, y: scale)
                        for region in drawing.regions {
                            let value = intensity[region.key, default: 0]
                            let fill = value >= 70 ? colors[4] : value >= 35 ? colors[2] : value > 0 ? colors[1] : neutral
                            for path in region.paths {
                                canvas.fill(path, with: .color(fill))
                                canvas.stroke(path, with: .color(tile), lineWidth: 0.7 / scale)
                            }
                        }
                        let bounds = drawing.box.applying(CGAffineTransform(scaleX: scale, y: scale))
                            .offsetBy(dx: offset.x, dy: offset.y)
                        let labels = callouts[side] ?? []
                        for lane in labels.indices {
                            let onLeft = lane == 0
                            let entries = labels[lane].sorted { $0.point(figure).y < $1.point(figure).y }
                            let textX: CGFloat = onLeft ? 3 : size.width - 3
                            let minGap: CGFloat = 10
                            var lastY = bounds.minY + 4
                            for (index, callout) in entries.enumerated() {
                                let point = callout.point(figure)
                                let tip = CGPoint(x: offset.x + point.x * scale, y: offset.y + point.y * scale)
                                let y = min(bounds.maxY - 3 - CGFloat(entries.count - 1 - index) * minGap,
                                            max(tip.y, lastY + minGap))
                                lastY = y
                                let score = intensity[callout.region, default: 0]
                                let ink = score > 0 ? colors[4] : SpotterPalette.color(0x596a87)
                                let label = context.resolve(Text(callout.title)
                                    .font(.system(size: 7, weight: score >= 70 ? .bold : .medium)).foregroundColor(ink))
                                let labelWidth = label.measure(in: CGSize(width: size.width, height: size.height)).width
                                let direction: CGFloat = onLeft ? 1 : -1
                                let lineStart = textX + direction * (labelWidth + 1)
                                var line = Path()
                                line.move(to: CGPoint(x: lineStart, y: y))
                                line.addLine(to: CGPoint(x: lineStart + direction * 2, y: y))
                                line.addLine(to: tip)
                                context.stroke(line, with: .color(ink.opacity(score > 0 ? 0.60 : 0.32)), lineWidth: 0.5)
                                context.draw(label, at: CGPoint(x: textX, y: y), anchor: onLeft ? .leading : .trailing)
                            }
                        }
                        context.draw(Text(side.title).font(.system(size: 8, weight: .semibold))
                            .foregroundColor(SpotterPalette.color(0x596a87)), at: CGPoint(x: size.width / 2, y: size.height - 9))
                    }
                    .accessibilityLabel(side.title + "肌群图")
                    .accessibilityAddTraits(.isImage)
                }
            }
        }
        .frame(height: 187)
    }

    private struct Callout {
        let region: String
        let title: String
        let male: CGPoint
        let female: CGPoint
        init(_ region: String, _ title: String, _ maleX: CGFloat, _ maleY: CGFloat, _ femaleX: CGFloat, _ femaleY: CGFloat) {
            self.region = region
            self.title = title
            male = CGPoint(x: maleX, y: maleY)
            female = CGPoint(x: femaleX, y: femaleY)
        }
        func point(_ figure: Figure) -> CGPoint { figure == .male ? male : female }
    }

    private static let callouts: [Side: [[Callout]]] = [
        .front: [[.init("upper-chest", "上胸", 307, 341, 276, 326),
                  .init("lower-chest", "中下胸", 307, 402, 274, 376),
                  .init("serratus", "前锯肌", 275, 431, 248, 484),
                  .init("biceps", "二头", 202, 450, 180, 402),
                  .init("upper-abs", "腹部", 335, 508, 300, 460),
                  .init("outer-quad", "股四", 260, 868, 232, 878)],
                 [.init("front-deltoid", "前束", 481, 339, 412, 302),
                  .init("deltoids", "中束", 492, 350, 438, 292),
                  .init("forearm", "前臂", 574, 591, 516, 558),
                  .init("adductors", "内收肌", 422, 778, 366, 770),
                  .init("tibialis", "胫前肌", 450, 1087, 390, 1124)]],
        .back: [[.init("rear-deltoid", "后束", 948, 354, 1029, 296),
                 .init("triceps", "三头", 940, 481, 1019, 438),
                 .init("lower-back", "下背", 1049, 563, 1119, 530),
                 .init("hamstring", "腿后侧", 998, 878, 1073, 886),
                 .init("calves", "小腿", 987, 1061, 1063, 1094)],
                [.init("trapezius", "斜方肌", 1125, 319, 1191, 290),
                 .init("upper-back", "上背", 1183, 390, 1237, 334),
                 .init("lats", "背阔肌", 1152, 493, 1211, 450),
                 .init("gluteal", "臀肌", 1138, 707, 1199, 694)]]
    ]
}

struct SecondaryMusclePanel: View {
    let entries: [NativeWorkoutEntry]
    var subjectFigure: NativeAnatomyVariant? = nil
    var participationOnly = false
    @State private var layer = Layer.primary
    @State private var catalogue: Catalog?
    @State private var unavailable = false

    private enum Layer: String, CaseIterable { case primary = "主要训练", secondary = "辅助参与" }
    private struct Catalog: Sendable {
        let byID: [String: [String: Int]]
        let byName: [String: [String: Int]]
        let guides: [String: [String: Int]]

        func muscles(_ move: NativeJSON, name: String) -> [String: Int] {
            let key = SecondaryMusclePanel.nameKey(name)
            return guides[SecondaryMusclePanel.nameKey(move["sourceName"].string)] ?? guides[key]
                ?? byID[move["catalogueId"].string] ?? byName[key] ?? [:]
        }
    }
    private struct MuscleCatalogue: Decodable {
        struct Move: Decodable { let id: String; let name: String; let en: String; let target: String; let muscles: [String: Int] }
        let rows: [Move]
    }
    private struct Guide: Decodable { let muscles: [String: Int] }
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
        Group {
            if participationOnly { content }
            else { content.padding(12).secondaryCard() }
        }
        .task {
            let loaded = await Task.detached(priority: .utility) { Self.loadCatalogue() }.value
            catalogue = loaded
            unavailable = loaded == nil
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 9) {
            if !participationOnly {
                Text("肌群训练分布").font(.headline)
                Text("按完成的正式组计数，不含热身。每组可能训练多个肌群。").font(.caption).foregroundStyle(SpotterPalette.muted)
                SpotterGlassSegments(options: Layer.allCases, value: $layer, glass: false, title: \.rawValue)
            }
            if let catalogue {
                if participationOnly {
                    let (primary, assisting) = participation(catalogue)
                    SecondaryAnatomy(counts: primary, assistingCounts: assisting, subjectFigure: subjectFigure)
                } else {
                    let (totals, counts) = distribution(catalogue)
                    let highest = max(1, totals.max() ?? 0)
                    SecondaryAnatomy(counts: counts, subjectFigure: subjectFigure)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3), spacing: 7) {
                        ForEach(Self.groups.indices, id: \.self) { index in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(Self.groups[index].0).font(.caption.weight(.semibold))
                                Text("\(totals[index]) 组").font(.caption2).foregroundStyle(SpotterPalette.muted)
                                ProgressView(value: Double(totals[index]), total: Double(highest)).tint(SpotterPalette.color(0x4f72cb))
                            }.padding(8).background(SpotterPalette.wash.opacity(0.43), in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            } else if unavailable { SecondaryNotice(message: "暂时无法读取肌群标注。") }
            else { ProgressView("正在读取肌群标注…") }
        }
    }

    nonisolated private static func nameKey(_ name: String) -> String {
        name.precomposedStringWithCompatibilityMapping.lowercased().filter { !$0.isWhitespace }
    }

    nonisolated private static func loadCatalogue() -> Catalog? { catalogueCache }

    nonisolated private static let catalogueCache: Catalog? = {
        let decoder = JSONDecoder()
        guard let url = Bundle.main.url(forResource: "index", withExtension: "json"), let data = try? Data(contentsOf: url),
              let value = try? decoder.decode(MuscleCatalogue.self, from: data) else { return nil }
        var byID = [String: [String: Int]]()
        var byName = [String: [String: Int]]()
        var ambiguous = Set<String>()
        for move in value.rows {
            let muscles = move.muscles.isEmpty && move.target == "shins" ? ["tibialis": 100] : move.muscles
            guard !muscles.isEmpty else { continue }
            byID[move.id] = muscles
            for name in Set([nameKey(move.name), nameKey(move.en)]) where !name.isEmpty && !ambiguous.contains(name) {
                if let previous = byName[name], previous != muscles {
                    byName.removeValue(forKey: name)
                    ambiguous.insert(name)
                } else { byName[name] = muscles }
            }
        }
        var guides = [String: [String: Int]]()
        if let url = Bundle.main.url(forResource: "training-guides", withExtension: "json"),
           let data = try? Data(contentsOf: url), let source = try? decoder.decode([String: Guide].self, from: data) {
            for (name, guide) in source { guides[nameKey(name)] = guide.muscles }
        }
        return Catalog(byID: byID, byName: byName, guides: guides)
    }()

    nonisolated static func posterIntensity(_ entries: [NativeWorkoutEntry]) -> [String: Double] {
        guard let catalogue = loadCatalogue() else { return [:] }
        var scores = [String: (loaded: Double, unloaded: Double, primary: Bool)]()
        for entry in entries {
            guard let session = entry.session else { continue }
            let rows = session.rows
            for (index, move) in session.plan.exercises.enumerated() where rows.indices.contains(index) {
                let label = NativeExerciseLabel(move)
                guard !label.warmup else { continue }
                let perSide = NativeWorkoutSession.isPerSideLoad(move)
                var totalLoad = 0.0
                var unloaded = 0.0
                for line in rows[index] where line["done"].bool && line["kind"].string != "warmup" {
                    let load = NativeWorkoutSession.setVolumeKg(line, move: move, perSide: perSide)
                    totalLoad += load
                    if load == 0 && (line["reps"].number > 0 || line["seconds"].number > 0 || line["right"]["reps"].number > 0) {
                        unloaded += 1
                    }
                }
                guard totalLoad > 0 || unloaded > 0 else { continue }
                let muscles = SecondaryAnatomy.expandedMuscles(catalogue.muscles(move, name: label.name))
                for (name, strength) in muscles where strength > 0 && name != "cardiovascular system" {
                    let weight = Double(strength) / 100
                    let previous = scores[name, default: (0, 0, false)]
                    scores[name] = (previous.loaded + totalLoad * weight, previous.unloaded + unloaded * weight,
                                    previous.primary || strength >= 75)
                }
            }
        }
        let peakLoad = scores.values.map(\.loaded).max() ?? 0
        let peakUnloaded = scores.values.map(\.unloaded).max() ?? 0
        return scores.mapValues { score in
            let loaded = peakLoad > 0 ? 100 * score.loaded / peakLoad : 0
            let unloaded = peakUnloaded > 0 ? (peakLoad > 0 ? 34 : 100) * score.unloaded / peakUnloaded : 0
            let intensity = max(loaded, unloaded)
            return score.primary ? intensity : min(intensity, 34)
        }
    }

    private func forEachCompletedMovement(_ catalogue: Catalog, perform: ([String: Int], Int) -> Void) {
        for entry in entries {
            guard let session = entry.session else { continue }
            let rows = session.rows
            for (index, move) in session.plan.exercises.enumerated() where rows.indices.contains(index) {
                let label = NativeExerciseLabel(move)
                guard !label.warmup else { continue }
                let count = rows[index].filter { $0["done"].bool && $0["kind"].string != "warmup" }.count
                guard count > 0 else { continue }
                perform(catalogue.muscles(move, name: label.name), count)
            }
        }
    }

    private func participation(_ catalogue: Catalog) -> (primary: [String: Int], assisting: [String: Int]) {
        var primary = [String: Int]()
        var assisting = [String: Int]()
        forEachCompletedMovement(catalogue) { muscles, count in
            for (region, strength) in SecondaryAnatomy.expandedMuscles(muscles) where strength > 0 && region != "cardiovascular system" {
                if strength >= 75 { primary[region, default: 0] += count }
                else { assisting[region, default: 0] += count }
            }
        }
        return (primary, assisting)
    }

    private func distribution(_ catalogue: Catalog) -> ([Int], [String: Int]) {
        var totals = Array(repeating: 0, count: Self.groups.count)
        var regionCounts = [String: Int]()
        forEachCompletedMovement(catalogue) { muscles, count in
            let regions = Set(muscles.compactMap { name, value -> String? in
                name != "cardiovascular system" && value > 0 && (layer == .primary ? value >= 75 : value < 75) ? name : nil
            })
            for region in regions { regionCounts[region, default: 0] += count }
            for index in Self.groups.indices where !Self.groups[index].1.isDisjoint(with: regions) { totals[index] += count }
        }
        return (totals, regionCounts)
    }
}

private struct SecondaryPerformance: View {
    let entries: [NativeWorkoutEntry]
    let compared: [NativeWorkoutEntry]?
    let onRecord: (NativeWorkoutEntry) -> Void
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
        let entry: NativeWorkoutEntry
    }

    var body: some View {
        let prior = compared.map(results)
        let current = results(entries).values.sorted { $0.value > $1.value }
        let gain = mostImproved(current, compared: prior)
        return VStack(alignment: .leading, spacing: 10) {
            Text("动作表现").font(.headline)
            SpotterGlassSegments(options: Metric.allCases, value: $metric, glass: false, title: \.rawValue)
            if let gain {
                Button { onRecord(gain.lift.entry) } label: {
                    HStack(spacing: 7) {
                        Label(gain.lift.title, systemImage: "arrow.up.right").font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                        Spacer(minLength: 4)
                        Text("+\(statNumber(gain.delta)) kg").font(.subheadline.weight(.bold)).monospacedDigit().lineLimit(1)
                    }
                    .foregroundStyle(SpotterPalette.ink)
                    .padding(10).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.spotterPress)
                    .accessibilityHint("对比期进步最多，打开训练记录")
            }
            if current.isEmpty { SecondaryNotice(message: "此周期没有可计算的负重纪录。") }
            else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(Array(current.prefix(8))) { lift in
                        Button { onRecord(lift.entry) } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Label(lift.title, systemImage: "dumbbell").font(.caption.weight(.semibold)).lineLimit(2)
                                    Spacer(minLength: 1)
                                    Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).accessibilityHidden(true)
                                }
                                Text("\(statNumber(lift.value)) kg").font(.title3.weight(.heavy)).foregroundStyle(SpotterPalette.accent).monospacedDigit()
                                Text("\(statNumber(lift.weight)) kg × \(Int(lift.reps)) 次 · \(lift.day.suffix(5))").font(.caption2)
                                if let prior {
                                    Text(prior[lift.id].map { "对比期 \(statNumber($0.value)) kg" } ?? "对比期暂无记录").font(.caption2)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(9)
                            .background(SpotterPalette.wash.opacity(0.54), in: RoundedRectangle(cornerRadius: 11))
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityHint("查看这条训练记录")
                    }
                }
            }
            Text("重量统一换算为 kg。分侧记录按较重一侧统计个人纪录。").font(.caption2).foregroundStyle(SpotterPalette.muted)
        }.padding(12).secondaryCard()
    }

    private func mostImproved(_ current: [Result], compared: [String: Result]?) -> (lift: Result, delta: Double)? {
        guard let compared else { return nil }
        var best: (lift: Result, delta: Double)?
        for lift in current {
            guard let previous = compared[lift.id] else { continue }
            let difference = lift.value - previous.value
            if difference >= 0.1 && difference > (best?.delta ?? 0) {
                best = (lift, difference)
            }
        }
        return best
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
                            result[key] = Result(id: key, title: title, day: entry.day, value: value, weight: weight, reps: reps, entry: entry)
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
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.spotterInteractionMotion) private var motion
    @EnvironmentObject private var remarks: NativeSocialRemarks
    @ScaledMetric(relativeTo: .caption) private var dateHeight: CGFloat = 29
    @ScaledMetric(relativeTo: .caption2) private var chipHeight: CGFloat = 25
    @State private var month = SecondaryDate.monthStart(SecondaryDate.today)
    @State private var scope = Scope.all
    @State private var selection: Selection?
    @State private var draftOrder: [String]?
    @State private var savingOrder = false
    @State private var orderError: String?

    private enum Scope: String, CaseIterable, Identifiable {
        case all = "全部", mine = "我的记录", partner = "搭子记录"
        var id: Self { self }
    }
    private enum Selection: Identifiable {
        case monthPicker, day(String), workout(NativeWorkoutEntry)
        enum Identity: Hashable {
            case monthPicker, day(String), workout(NativeWorkoutEntry.Key)
        }
        var id: Identity {
            switch self {
            case .monthPicker: return .monthPicker
            case .day(let day): return .day(day)
            case .workout(let entry): return .workout(entry.key)
            }
        }
    }

    private static let ownTone = SpotterPalette.color(0x476a42)
    private static let partnerTone = SpotterPalette.color(0x694b99)
    private let cardInset: CGFloat = 10
    private let sectionSpacing: CGFloat = 7
    private let navigationButtonSize: CGFloat = 44
    private let weekdayHeight: CGFloat = 19
    private let legendHeight: CGFloat = 44
    private let weekSpacing: CGFloat = 2

    private var owner: String { store.owner }
    private var partnerID: String? {
        let id = store.partnerID
        guard !id.isEmpty, id != owner, store.room["partnerTrainingShared"] != .bool(false) else { return nil }
        return id
    }
    private var partnerName: String { remarks.name(for: partnerID, fallback: store.partnerName) }
    private var visibleScope: Scope { partnerID == nil ? .mine : scope }

    private var grouped: [String: [NativeWorkoutEntry]] {
        var entries = visibleScope == .partner ? [] : store.logs
        if visibleScope != .mine { entries += store.partnerLogs }
        let first = spotterDay(gridStart)
        let last = spotterDay(gridEnd)
        var byDay = Dictionary(grouping: entries.filter { $0.day >= first && $0.day <= last }, by: \.day)
        for row in store.libraryRows where row["kind"].string == "history-order" {
            let day = row["id"].string
            if let entries = byDay[day] {
                byDay[day] = ordered(entries, by: row["entries"].array.map(\.string))
            }
        }
        return byDay
    }

    private var gridStart: Date { SecondaryDate.weekStart(month) }
    private var nextMonth: Date { SecondaryDate.shift(month, 1, component: .month) }
    private var gridEnd: Date { SecondaryDate.shift(gridStart, weeks * 7 - 1) }
    private var weeks: Int {
        (SecondaryDate.days(gridStart, through: SecondaryDate.shift(nextMonth, -1)) + 6) / 7
    }
    private var columns: [GridItem] { Array(repeating: GridItem(.flexible(minimum: 0), spacing: 3), count: 7) }

    var body: some View {
        let records = grouped
        return GeometryReader { size in
            let chrome = navigationButtonSize + weekdayHeight + legendHeight + cardInset * 2
                + sectionSpacing * 3 + CGFloat(weeks - 1) * weekSpacing
            let minimumRowHeight = min(dateHeight, 38) + 4
            let minimumHeight = chrome + minimumRowHeight * CGFloat(weeks)
            let rowHeight = floor((max(size.size.height, minimumHeight) - chrome) / CGFloat(weeks))
            if size.size.height < minimumHeight {
                ScrollView {
                    calendarCard(records, rowHeight: rowHeight)
                        .frame(minHeight: minimumHeight)
                }
            } else {
                calendarCard(records, rowHeight: rowHeight)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("训练月历")
        .onChange(of: partnerID) { _ in scope = .all }
        .task(id: month) {
            await store.loadHistory(from: spotterDay(gridStart), through: spotterDay(gridEnd))
        }
        .sheet(item: $selection, onDismiss: endOrdering) { selection in
            NavigationStack {
                switch selection {
                case .monthPicker:
                    SecondaryHistoryMonthPicker(month: month) {
                        goToMonth($0)
                        self.selection = nil
                    }
                case .day(let day): dayDetail(day)
                case .workout(let record): recordDetail(record).toolbar { closeAction }
                }
            }
            .presentationDragIndicator(.visible)
            .presentationDetents(selection.id == .monthPicker ? [.medium, .large] : [.large])
            .interactiveDismissDisabled(savingOrder)
        }
    }

    private func calendarCard(_ records: [String: [NativeWorkoutEntry]], rowHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: sectionSpacing) {
            monthHeader.frame(height: navigationButtonSize)
            LazyVGrid(columns: columns, spacing: 0) {
                ForEach(["一", "二", "三", "四", "五", "六", "日"], id: \.self) {
                    Text($0).font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                        .lineLimit(1).minimumScaleFactor(0.65)
                        .frame(height: weekdayHeight)
                        .accessibilityLabel("星期\($0)")
                }
            }
            LazyVGrid(columns: columns, spacing: weekSpacing) {
                ForEach(0..<(weeks * 7), id: \.self) { index in
                    let date = SecondaryDate.shift(gridStart, index)
                    calendarCell(date, records: records[spotterDay(date), default: []],
                                 inside: date >= month && date < nextMonth, rowHeight: rowHeight)
                }
            }
            monthFooter(records)
        }
        .padding(cardInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .secondaryCard(radius: 20)
    }

    private var monthHeader: some View {
        let calendar = SecondaryDate.calendar
        let year = calendar.component(.year, from: month).formatted(.number.grouping(.never))
        let monthNumber = calendar.component(.month, from: month)
        return HStack(alignment: .center, spacing: 5) {
            Button { selection = .monthPicker } label: {
                HStack(spacing: 5) {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline, spacing: 5) {
                            Text("\(year) 年").font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                            Text("\(monthNumber) 月").font(.title2.weight(.heavy))
                        }.fixedSize(horizontal: true, vertical: false)
                        Text("\(year)/\(monthNumber)").font(.headline).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold)).foregroundStyle(SpotterPalette.muted)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: navigationButtonSize)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("选择月份")
            .accessibilityValue("\(year) 年 \(monthNumber) 月")
            .accessibilityIdentifier("history-month-selector")
            Spacer(minLength: 0)
            if partnerID != nil {
                SpotterMenuPicker("记录筛选", selection: $scope, options: Scope.allCases.map { ($0, $0.rawValue) }) {
                    Image(systemName: "line.3.horizontal.decrease")
                        .foregroundStyle(scope != .all ? SpotterPalette.accent : SpotterPalette.ink)
                }
            }
            monthStep("上个月", symbol: "chevron.left", direction: -1)
            monthStep("下个月", symbol: "chevron.right", direction: 1)
        }

    }

    private func goToMonth(_ date: Date) {
        withAnimation(motion) { month = SecondaryDate.monthStart(date) }
    }

    private func headerIcon(_ symbol: String) -> some View {
        Image(systemName: symbol).font(.subheadline.weight(.semibold))
            .foregroundStyle(SpotterPalette.ink)
            .frame(width: 22)
    }

    private func monthStep(_ label: String, symbol: String, direction: Int) -> some View {
        Button {
            goToMonth(SecondaryDate.shift(month, direction, component: .month))
        } label: {
            headerIcon(symbol)
        }
        .buttonStyle(.spotterControl)
        .accessibilityLabel(label)
    }

    private func monthFooter(_ records: [String: [NativeWorkoutEntry]]) -> some View {
        let start = spotterDay(month)
        let end = spotterDay(nextMonth)
        let monthlyRecords = records.filter { $0.key >= start && $0.key < end }.values
        let ownDays = monthlyRecords.filter { $0.contains { $0.owner == owner } }.count
        let partnerDays = monthlyRecords.filter { $0.contains { $0.owner != owner } }.count
        return HStack(spacing: 10) {
            if visibleScope != .partner { legend("我", days: ownDays, tone: Self.ownTone) }
            if partnerID != nil, visibleScope != .mine { legend(partnerName, days: partnerDays, tone: Self.partnerTone) }
            Spacer(minLength: 0)
            if month != SecondaryDate.monthStart(SecondaryDate.today) {
                Button { goToMonth(SecondaryDate.today) } label: {
                    Text("本月").font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .buttonStyle(.spotterControl)
                .accessibilityLabel("回到本月")
                .accessibilityIdentifier("history-current-month")
            }
        }
        .frame(height: legendHeight)
    }

    private func legend(_ name: String, days: Int, tone: Color) -> some View {
        HStack(spacing: 4) {
            Capsule().fill(tone).frame(width: 12, height: 7).accessibilityHidden(true)
            Text(name).font(.caption).foregroundStyle(SpotterPalette.muted)
                .lineLimit(1).minimumScaleFactor(0.65)
            if days > 0 {
                Text("\(days) 天").font(.caption2.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                    .lineLimit(1).minimumScaleFactor(0.65).layoutPriority(1)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name)本月有 \(days) 个打卡日")
    }

    private func calendarCell(_ date: Date, records: [NativeWorkoutEntry], inside: Bool, rowHeight: CGFloat) -> some View {
        let key = spotterDay(date)
        let isToday = key == spotterDay(SecondaryDate.today)
        let mine = records.filter { $0.owner == owner }
        let other = records.first { $0.owner != owner }
        let headerSize = min(dateHeight, max(18, rowHeight - 3))
        let chipSize = min(chipHeight, 25)
        let capacity = min(2, max(0, Int((rowHeight - headerSize - 4) / (chipSize + 2))))
        let previewOrder = if let own = mine.first, let other { [own, other] } else { Array(records.prefix(2)) }
        let previews = Array(previewOrder.prefix(capacity))
        let extra = records.count - previews.count
        let badgeSize = min(headerSize - 2, 28)
        let hasAbbreviatedChips = !records.isEmpty && previews.isEmpty
        let counts = [isToday ? "今天" : "", key, "\(records.count) 次打卡",
                      mine.isEmpty ? "" : "我 \(mine.count) 次",
                      other == nil ? "" : "\(partnerName) \(records.count - mine.count) 次"]
            .filter { !$0.isEmpty }.joined(separator: "，")
        return VStack(alignment: .leading, spacing: 2) {
            Rectangle().fill(SpotterPalette.line).frame(height: 1).accessibilityHidden(true)
            Button { selection = .day(key) } label: {
                VStack(spacing: 1) {
                    HStack(spacing: 1) {
                        Text(SecondaryDate.calendar.component(.day, from: date).formatted())
                            .font(.subheadline.weight(.bold)).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.55)
                            .foregroundStyle(isToday ? .white : (inside ? SpotterPalette.ink : SpotterPalette.muted))
                            .frame(width: badgeSize, height: badgeSize)
                            .background(isToday ? SpotterPalette.color(0x375b3b) : .clear, in: Circle())
                        if extra > 0 {
                            Text(previews.isEmpty ? "\(extra)" : "+\(extra)")
                                .font(.caption2.weight(.bold)).monospacedDigit().minimumScaleFactor(0.50)
                                .foregroundStyle(Self.ownTone).lineLimit(1)
                        }
                    }
                    if hasAbbreviatedChips && rowHeight >= headerSize + 10 {
                        HStack(spacing: 3) {
                            if !mine.isEmpty { Circle().fill(Self.ownTone).frame(width: 5, height: 5) }
                            if other != nil { Circle().fill(Self.partnerTone).frame(width: 5, height: 5) }
                        }.accessibilityHidden(true)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: previews.isEmpty ? max(0, rowHeight - 3) : headerSize, alignment: .top)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel(counts)
            ForEach(previews, id: \.key) { record in
                Button { selection = .workout(record) } label: {
                    Text(record.title).font(.caption2.weight(.bold)).lineLimit(2).minimumScaleFactor(0.85)
                        .padding(.horizontal, 3).frame(maxWidth: .infinity, alignment: .leading).frame(height: chipSize)
                        .foregroundStyle(.white)
                        .background(record.owner == owner ? Self.ownTone : Self.partnerTone, in: RoundedRectangle(cornerRadius: 5))
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("\(record.title)，\(record.owner == owner ? "我" : partnerName)，\(key)")
            }
        }
        .frame(maxWidth: .infinity).frame(height: rowHeight, alignment: .topLeading)
    }

    @ToolbarContentBuilder
    private var closeAction: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("关闭") { selection = nil }
                .disabled(savingOrder)
        }
    }

    private func dayDetail(_ day: String) -> some View {
        let daily = grouped[day, default: []]
        let ownIDs = daily.filter { $0.owner == owner }.map(\.id)
        let shown = draftOrder.map { ordered(daily, by: $0) } ?? daily
        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if draftOrder != nil || (2...150).contains(ownIDs.count) {
                    HStack(spacing: 8) {
                        if let draftOrder {
                            Button(savingOrder ? "保存中…" : "保存排序") {
                                Task { await saveOrder(day, ids: draftOrder) }
                            }.buttonStyle(.spotterControl).disabled(savingOrder)
                            Button("取消排序", action: endOrdering)
                                .buttonStyle(.spotterControl).disabled(savingOrder)
                        } else {
                            Button("排序我的训练") { withAnimation(motion) { draftOrder = ownIDs } }.buttonStyle(.spotterControl)
                        }
                    }

                }
                if let orderError { SecondaryNotice(message: orderError, warning: true) }
                if daily.isEmpty {
                    SecondaryNotice(message: visibleScope == .partner ? "搭子这一天还没有训练记录。" : "这一天还没有训练记录。")
                }
                ForEach(shown, id: \.key) { record in
                    HStack(spacing: 5) {
                        NavigationLink { recordDetail(record) } label: {
                            let mine = record.owner == owner
                            let category = record.data["plan"]["category"].string
                            SecondaryRow(title: record.title, detail: [mine ? "我" : partnerName, category, "\(record.durationMinutes) 分钟"]
                                .filter { !$0.isEmpty }.joined(separator: " · "), icon: "dumbbell", color: mine ? SpotterPalette.wash : secondaryLilac)
                                .secondaryCard()
                        }
                        .buttonStyle(.spotterPress)
                        .disabled(draftOrder != nil)
                        if record.owner == owner, let ids = draftOrder, let index = ids.firstIndex(of: record.id) {
                            orderButton(record, index: index, direction: -1, ids: ids)
                            orderButton(record, index: index, direction: 1, ids: ids)
                        }
                    }
                }
            }.secondaryPage()
        }
        .background(SpotterPalette.background)
        .navigationTitle("\(day.suffix(5)) 的打卡").navigationBarTitleDisplayMode(.inline)
        .toolbar { closeAction }
    }

    @ViewBuilder
    private func recordDetail(_ record: NativeWorkoutEntry) -> some View {
        let candidates = record.owner == owner ? store.logs : store.partnerLogs
        if let current = candidates.first(where: { $0.key == record.key }) {
            NativeWorkoutDetailView(store: store, entry: current)
        } else {
            SecondaryNotice(message: "这条训练记录已不可用。").padding()
        }
    }

    private func orderButton(_ record: NativeWorkoutEntry, index: Int, direction: Int, ids: [String]) -> some View {
        let target = index + direction
        let name = direction < 0 ? "上移" : "下移"
        return Button {
            guard ids.indices.contains(target) else { return }
            var updated = ids
            updated.swapAt(index, target)
            withAnimation(motion) { draftOrder = updated }
        } label: {
            headerIcon(direction < 0 ? "arrow.up" : "arrow.down")
        }
        .buttonStyle(.spotterControl)
        .accessibilityLabel("\(name) \(record.title)")
        .disabled(savingOrder || !ids.indices.contains(target))
    }

    private func ordered(_ entries: [NativeWorkoutEntry], by ids: [String]) -> [NativeWorkoutEntry] {
        guard !ids.isEmpty else { return entries }
        var ranks: [String: Int] = [:]
        for (index, id) in ids.enumerated() { ranks[id] = index }
        let own = entries.filter { $0.owner == owner }.sorted {
            ranks[$0.id, default: ids.count] < ranks[$1.id, default: ids.count]
        }
        var next = own.makeIterator()
        return entries.map { $0.owner == owner ? (next.next() ?? $0) : $0 }
    }

    private func saveOrder(_ day: String, ids: [String]) async {
        guard !savingOrder else { return }
        savingOrder = true
        orderError = nil
        defer { savingOrder = false }
        do {
            try await store.saveHistoryOrder(day: day, entryIDs: ids)
            endOrdering()
        } catch { orderError = error.localizedDescription }
    }

    private func endOrdering() {
        draftOrder = nil
        orderError = nil
    }
}

private struct SecondaryHistoryMonthPicker: View {
    @Environment(\.dismiss) private var dismiss
    @State private var year: Int
    @State private var monthNumber: Int
    private let years: ClosedRange<Int>
    let select: (Date) -> Void

    init(month: Date, select: @escaping (Date) -> Void) {
        let calendar = SecondaryDate.calendar
        let selectedYear = calendar.component(.year, from: month)
        let currentYear = calendar.component(.year, from: SecondaryDate.today)
        _year = State(initialValue: selectedYear)
        _monthNumber = State(initialValue: calendar.component(.month, from: month))
        years = min(1900, selectedYear)...max(currentYear + 1, selectedYear)
        self.select = select
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 0) {
                Picker("年份", selection: $year) {
                    ForEach(years, id: \.self) {
                        Text("\($0, format: .number.grouping(.never)) 年").tag($0)
                    }
                }
                .frame(maxWidth: .infinity)
                .clipped()
                Picker("月份", selection: $monthNumber) {
                    ForEach(1...12, id: \.self) { Text("\($0) 月").tag($0) }
                }
                .frame(maxWidth: .infinity)
                .clipped()
            }
            .pickerStyle(.wheel)
            .frame(height: 180)
            .secondaryCard()

            Button("回到本月") { select(SecondaryDate.today) }
                .buttonStyle(.spotterControl)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: 460)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SpotterPalette.background)
        .navigationTitle("跳转到月份")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("查看") {
                    if let month = SecondaryDate.calendar.date(from: DateComponents(year: year, month: monthNumber, day: 1)) {
                        select(month)
                    }
                }
                .accessibilityIdentifier("history-apply-month")
            }
        }
    }
}

@MainActor
struct NativeSettings: View {
    @ObservedObject var account: NativeAccount
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var avatars: NativeAvatarStore
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
    @State private var nicknameDraft: String?
    @State private var nicknameBusy = false
    @State private var nicknameNotice: String?
    @State private var nicknameError = false
    @State private var showRestSchedule = false
    @State private var showProfileEditor = false
    let owner: String
    var onDeleted: () -> Void
    var refreshPlans: @MainActor () async -> Void = {}
    var openTraining: (() -> Void)? = nil
    var workoutStore: NativeWorkoutStore? = nil
    var trainingPreferences: NativeAccountPreferences? = nil
    var restartWelcome: (() -> Void)? = nil

    private enum Page: String, CaseIterable, Identifiable {
        case account = "账号", workout = "训练偏好", protein = "蛋白粉仓库", timer = "计时提醒", schedule = "计划与日程", planImport = "粘贴已有内容", programs = "训练周期", reminders = "训练提醒"
        case units = "单位与统计", equipment = "器械", appearance = "外观与辅助功能", modules = "功能模块", data = "数据导入与导出"
        case watches = "手表与健康", integrations = "集成", coach = "AI 教练", agent = "外部 Agent", about = "关于与更新"
        case notifications = "通知"
        var id: Self { self }

        var detail: String {
            switch self {
            case .account: return "头像、昵称、用户名、登录绑定和隐私"
            case .workout: return "默认组数和次数、下一组、动作节奏"
            case .protein: return "常喝的蛋白粉、一勺粉量和杯量"
            case .timer: return "休息时间、提示声音和震动、保持屏幕常亮"
            case .schedule: return "训练计划、固定休息日和临时休息"
            case .planImport: return "训练文本、计划 JSON 和跟练视频"
            case .programs: return "多周训练、周期草稿和排期"
            case .reminders: return "待训练计划、每日提醒时间"
            case .notifications: return "搭子提醒、好友打卡、iPhone 通知权限"
            case .units: return "新动作的重量单位、动作名称、1RM 估算方式"
            case .equipment: return "健身房配置和可用器械"
            case .appearance: return "主题、强调色、文字大小和减少动画"
            case .modules: return "今日饮食、官方模板、好友和教练入口"
            case .data: return "导出训练资料、恢复 Spotter 备份"
            case .watches: return "Apple Watch 与 Apple 健康"
            case .integrations: return "健康数据、AI 工具"
            case .coach: return "训练对话、计划草稿和数据授权"
            case .agent: return "个人 API 令牌、读取与写入权限、提示词"
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
            case .planImport: return "list.bullet.clipboard"
            case .programs: return "calendar.badge.plus"
            case .reminders: return "bell"
            case .notifications: return "bell.badge"
            case .units: return "ruler"
            case .equipment: return "slider.horizontal.3"
            case .appearance: return "textformat.size"
            case .modules: return "square.grid.2x2"
            case .data: return "externaldrive"
            case .watches: return "applewatch"
            case .integrations: return "powerplug"
            case .coach: return "sparkles"
            case .agent: return "link"
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
                    rows([.notifications, .units, .equipment, .appearance, .modules], title: "首选项")
                    rows([.watches, .integrations, .coach, .agent], title: "连接")
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
        .navigationTitle("设置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button { dismiss() } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("返回")
                    .accessibilityIdentifier("spotter-settings-back")
            }
        }
        .task { await loadHandle() }
        .sheet(isPresented: $showRestSchedule, onDismiss: { Task { await refreshPlans() } }) {
            NativeRestSchedule(api: account.api, owner: owner, addToday: false)
        }
    }

    private var profileName: String { account.profile?.name ?? handle?.handle ?? "我的账号" }

    private var accountHeader: some View {
        NavigationLink(value: Page.account) {
            HStack(spacing: 12) {
                profileIdentity(avatarSize: 54)
                Spacer(minLength: 5)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            }
            .padding(14)
            .frame(minHeight: 80)
            .secondaryCard(radius: 18)
        }
        .buttonStyle(.spotterPress)
    }

    private func profileIdentity(avatarSize: CGFloat) -> some View {
        HStack(spacing: 12) {
            NativePersonAvatar(id: owner, name: profileName, size: avatarSize)
            VStack(alignment: .leading, spacing: 4) {
                Text(profileName).font(avatarSize > 60 ? .title2.bold() : .headline)
                    .foregroundStyle(SpotterPalette.ink)
                if let handle {
                    Text(handle.handle)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(SpotterPalette.muted)
                }
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
        }
    }

    private var accountProfileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            profileIdentity(avatarSize: 72)
            Divider()
            Button {
                showProfileEditor = true
            } label: {
                HStack {
                    Label("编辑资料", systemImage: "pencil")
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).accessibilityHidden(true)
                }
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 42)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("spotter-edit-account-profile")
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .secondaryCard(radius: 20)
    }

    private var profileEditor: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    NativeAccountAvatarEditor(api: account.api, owner: owner, name: profileName, current: Binding(
                        get: { avatars.photo(for: owner) },
                        set: { avatars.confirmOwnPhoto($0, for: owner) }
                    ))
                    nicknameContent
                    usernameContent
                }
                .secondaryPage()
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("编辑资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { showProfileEditor = false }
                }
            }
        }
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
        case .equipment: NativeEquipmentPreferences(sync: trainingPreferences)
        case .planImport: NativePlanImportView(api: account.api, owner: owner, didImport: refreshPlans)
        case .programs: NativeProgramsView(api: account.api, owner: owner, didSchedule: refreshPlans, store: workoutStore)
        case .agent: NativeAgentAccessView(api: account.api, owner: owner)
        default:
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch page {
                    case .account: accountContent
                    case .workout: NativeWorkoutPreferences()
                    case .timer: NativeTimerPreferences(sync: trainingPreferences)
                    case .schedule: scheduleContent
                    case .planImport: EmptyView()
                    case .programs: EmptyView()
                    case .reminders: NativeTrainingReminderSettings(owner: owner)
                    case .notifications: NativeSocialNotificationSettings(owner: owner)
                    case .units: NativeUnitsPreferences(sync: trainingPreferences)
                    case .equipment: EmptyView()
                    case .appearance: NativeAppearancePreferences()
                    case .modules: NativeModulePreferences()
                    case .data: NativeBackupSettings(api: account.api, owner: owner, didImport: refreshPlans)
                    case .watches: NativeHealthSummary(api: account.api, owner: owner, workouts: workoutStore)
                    case .integrations:
                        rows([.watches], title: "健康与设备")
                        rows([.coach, .agent], title: "数据和 AI")
                    case .coach: coachContent
                    case .agent: EmptyView()
                    case .about: aboutContent
                    case .protein: EmptyView()
                    }
                }.secondaryPage()
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle(page.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar)
        }
    }

    private var scheduleContent: some View {
        SecondaryGroup(title: "训练安排") {
            if let openTraining {
                Button(action: openTraining) {
                    SecondaryRow(title: "我的计划", detail: "在训练页查看和编辑计划", icon: "list.clipboard")
                }.buttonStyle(.spotterPress)
                Divider()
            }
            Button { showRestSchedule = true } label: {
                SecondaryRow(title: "管理休息日", detail: "每周固定休息日和临时休息日期", icon: "calendar.badge.clock")
            }.buttonStyle(.spotterPress)
            Divider()
            link(.planImport)
            Divider()
            link(.programs)
        }
    }

    private var coachContent: some View {
        SecondaryGroup {
            NativeCoachMessageUsage(api: account.api)
            Divider()
            NavigationLink {
                NativeCoachView(api: account.api, owner: owner, workoutStore: workoutStore)
                    .toolbar(.visible, for: .navigationBar)
            } label: { SecondaryRow(title: "打开 AI 教练", icon: "sparkles") }.buttonStyle(.spotterPress)
            Divider()
            link(.agent)
            Divider()
            NativeCoachSharingSettings(owner: owner, origin: account.api.origin).padding(13)
        }
    }

    private var accountContent: some View {
        VStack(alignment: .leading, spacing: 15) {
            accountProfileCard
            VStack(alignment: .leading, spacing: 10) {
                Text("绑定登录方式").font(.headline).accessibilityAddTraits(.isHeader)
                Text("绑定后，Apple 和 Google 都会打开这个训练搭子账号。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                providerRow("Apple", icon: "apple.logo", option: account.providerStatus.apple) { await account.linkApple() }
                providerRow("Google", icon: "g.circle", option: account.providerStatus.google) { await account.linkGoogle() }
                if let error = account.errorMessage { SecondaryNotice(message: error, warning: true) }
            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()

            SecondaryGroup(title: "账户与同步") {
                NavigationLink {
                    NativeBodyData(api: account.api, owner: owner, onProfileSaved: { workoutStore?.useSavedAnatomyVariant($0) })
                        .toolbar(.visible, for: .navigationBar)
                } label: {
                    SecondaryRow(title: "身体档案", detail: "查看体重、身体数据与性别", icon: "person.text.rectangle")
                }.buttonStyle(.spotterPress)
                Divider()
                Button {
                    Task { await refreshPlans(); await loadHandle() }
                } label: {
                    SecondaryRow(title: "立即同步", detail: workoutStore?.status, icon: "arrow.clockwise", accessory: nil)
                }.buttonStyle(.spotterPress).disabled(handleBusy || nicknameBusy || account.isBusy)
                if let trainingPreferences { NativePreferenceSyncStatus(sync: trainingPreferences) }
                Divider()
                Button { Task { await account.signOut() } } label: {
                    SecondaryRow(title: "退出当前账号", icon: "rectangle.portrait.and.arrow.right", accessory: nil)
                }.buttonStyle(.spotterPress).disabled(account.isBusy)
            }

            SecondaryGroup(title: "关系与隐私") {
                NavigationLink {
                    NativeFriends(api: account.api, owner: owner, initialBuddySearch: true, refreshPlans: refreshPlans)
                        .toolbar(.visible, for: .navigationBar)
                } label: { SecondaryRow(title: "搭子空间", detail: "通过用户名找训练搭子", icon: "person.2") }
                    .buttonStyle(.spotterPress)
                Divider()
                NavigationLink {
                    NativeFriends(api: account.api, owner: owner, initialPage: .privacy, refreshPlans: refreshPlans)
                        .toolbar(.visible, for: .navigationBar)
                } label: { SecondaryRow(title: "好友分享设置", detail: "调整好友和搭子可见的数据", icon: "lock.shield") }
                    .buttonStyle(.spotterPress)
                if let privacy = URL(string: account.api.origin + "/privacy") {
                    Divider()
                    Link(destination: privacy) { SecondaryRow(title: "隐私政策", icon: "shield") }.buttonStyle(.spotterPress)
                }
            }

            SecondaryGroup {
                Button(role: .destructive) { showDelete = true } label: {
                    Label("删除账号", systemImage: "trash").font(.subheadline.weight(.semibold)).foregroundStyle(.red)
                        .padding(.horizontal, 13).frame(maxWidth: .infinity, minHeight: 55, alignment: .leading)
                }.buttonStyle(.spotterPress).disabled(working || account.isBusy)
            }
            if let note { SecondaryNotice(message: note, warning: true) }
        }
        .sheet(isPresented: $showProfileEditor) { profileEditor }
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

    private var nicknameContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("昵称").font(.headline).accessibilityAddTraits(.isHeader)
            TextField("输入昵称", text: Binding(get: { nicknameDraft ?? account.profile?.name ?? "" }, set: { nicknameDraft = $0 }))
                .textFieldStyle(.roundedBorder).textContentType(.nickname).submitLabel(.done)
                .accessibilityLabel("昵称")
                .onSubmit { Task { await saveNickname() } }
                .disabled(nicknameBusy)
            Text("搭子、好友和搜索结果默认显示昵称。昵称最多 32 个字符。")
                .font(.caption).foregroundStyle(SpotterPalette.muted)
            Button(nicknameBusy ? "正在保存…" : "保存昵称") { Task { await saveNickname() } }
                .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(!canSaveNickname)
            if let nicknameNotice { SecondaryNotice(message: nicknameNotice, warning: nicknameError) }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).secondaryCard()
    }

    private var proposedNickname: String? {
        nicknameDraft?.split(whereSeparator: \.isWhitespace).joined(separator: " ").precomposedStringWithCanonicalMapping
    }

    private var canSaveNickname: Bool {
        guard let proposedNickname, proposedNickname != account.profile?.name,
              account.profile?.id == owner, !handleBusy, !nicknameBusy, !account.isBusy else { return false }
        return (1...32).contains(proposedNickname.unicodeScalars.count)
    }

    private func saveNickname() async {
        guard canSaveNickname, let proposedNickname else { return }
        nicknameBusy = true
        nicknameNotice = nil
        defer { nicknameBusy = false }
        do {
            let body = try JSONEncoder().encode(NicknameUpdate(name: proposedNickname, expectedOwner: owner))
            let data = try await account.api.request("/api/auth/profile", method: "PATCH", json: body, for: owner)
            let result = try JSONDecoder().decode(NativeHandleResponse.self, from: data).profile
            guard let name = result.name, !name.isEmpty else { throw NativeAPIError.invalidResponse }
            try useProfileName(name)
            nicknameDraft = nil
            nicknameNotice = "已更新昵称。"
            nicknameError = false
        } catch is CancellationError { }
        catch { nicknameNotice = error.localizedDescription; nicknameError = true }
    }

    private func useProfileName(_ name: String) throws {
        try account.useConfirmedName(name, for: owner)
        workoutStore?.useConfirmedViewerName(name)
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
                Text("用于搜索好友和搭子。由 3–24 个英文字母、数字、点或下划线组成，两端须为字母或数字。标签为四位数字，完整组合需唯一。")
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
        guard let handle, !handleBusy, !nicknameBusy, !account.isBusy,
              proposedUsername != handle.username || usernameTag != handle.tag,
              usernameTag.count == 4, usernameTag.allSatisfy({ ("0"..."9").contains($0) }) else { return false }
        return proposedUsername.range(of: "^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$", options: .regularExpression) != nil
    }

    private func loadHandle() async {
        guard !handleBusy, !nicknameBusy else { return }
        handleBusy = true
        defer { handleBusy = false }
        do {
            let result = try await account.api.spotterRead("/api/auth/profile", as: NativeHandleResponse.self)
            if let name = result.profile.name, !name.isEmpty { try useProfileName(name) }
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
            if let name = updated.name, !name.isEmpty { try useProfileName(name) }
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
            if let restartWelcome {
                Divider()
                Button(action: restartWelcome) {
                    SecondaryRow(title: "重新查看使用引导", icon: "sparkle.magnifyingglass")
                }.buttonStyle(.spotterPress)
            }
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
        .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.ink)
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
    let name: String?
}

private struct NativeHandleResponse: Decodable { let profile: NativeHandleProfile }
private struct NicknameUpdate: Encodable { let name: String; let expectedOwner: String }

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

@MainActor
private struct NativeSocialNotificationSettings: View {
    @EnvironmentObject private var notifications: NativeSocialNotifications
    @Environment(\.openURL) private var openURL
    @State private var showInbox = false
    let owner: String

    private var isScoped: Bool { notifications.belongs(to: owner) }
    private var unreadCount: Int { isScoped ? notifications.unreadCount : 0 }

    var body: some View {
        SecondaryGroup(title: "好友和搭子") {
            if isScoped, notifications.preferences != nil {
                NativeSettingToggle(title: "搭子提醒我训练", detail: "接收当前训练搭子发给你的提醒。", value: binding(\.buddyReminders))
                Divider()
                NativeSettingToggle(title: "好友完成训练", detail: "好友完成训练并向你共享打卡后发送提醒。", value: binding(\.friendWorkouts))
            } else if notifications.loading {
                ProgressView("正在读取通知设置…").padding(13)
            }
            if isScoped, let error = notifications.error {
                SecondaryNotice(message: error, warning: true).padding(10)
                Button("重试") { Task { await notifications.refresh() } }
                    .buttonStyle(SecondaryButtonStyle()).padding(.horizontal, 13).padding(.bottom, 8)
            }
            Divider()
            Button { showInbox = true } label: {
                SecondaryRow(title: "通知收件箱", detail: unreadCount > 0 ? "\(unreadCount) 条未读" : nil,
                             icon: "tray", color: SpotterPalette.wash)
            }.buttonStyle(.spotterPress)
        }.disabled(notifications.saving)
        SecondaryGroup(title: "在 iPhone 上接收") {
            if isScoped, notifications.canUseSystemPush {
                if let issue = notifications.registrationIssue {
                    SecondaryNotice(message: issue, warning: true).padding(10)
                }
                Button {
                    if notifications.authorizationStatus != .denied, !notifications.deviceRegistered {
                        Task { await notifications.enableSystemPush() }
                    } else if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                } label: {
                    if notifications.authorizationStatus != .denied, !notifications.deviceRegistered {
                        SecondaryRow(title: notifications.authorizationStatus == .notDetermined ? "允许 iPhone 通知" : "连接 iPhone 通知",
                                     detail: "在 App 关闭时仍可收到训练通知。",
                                     icon: "bell", color: SpotterPalette.wash)
                    } else {
                        SecondaryRow(title: "打开 iPhone 通知设置", detail: notifications.authorizationStatus == .denied ? "系统通知权限已关闭" : "管理横幅、声音和锁屏显示",
                                     icon: "gearshape", color: SpotterPalette.wash)
                    }
                }.buttonStyle(.spotterPress)
            } else {
                SecondaryRow(title: "站内通知", detail: "这台设备暂不能接收系统推送。你仍可在 App 内查看通知。",
                             icon: "bell.badge", color: SpotterPalette.wash, accessory: nil)
            }
        }
        .task { await notifications.refreshPermission(); await notifications.refresh() }
        .sheet(isPresented: $showInbox) {
            NativeNotificationInbox(owner: owner) { item in Task { await notifications.read(item) } }
                .presentationDragIndicator(.visible)
        }
    }

    private func binding(_ key: WritableKeyPath<NativeSocialNotificationPreferences, Bool>) -> Binding<Bool> {
        Binding(get: { isScoped && notifications.preferences?[keyPath: key] == true }, set: { value in
            guard isScoped, var preferences = notifications.preferences else { return }
            preferences[keyPath: key] = value
            Task { await notifications.updatePreferences(preferences) }
        })
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

private struct NativePreferenceSyncStatus: View {
    @ObservedObject var sync: NativeAccountPreferences

    var body: some View {
        if let notice = sync.notice {
            Text(notice).font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.horizontal, 13).padding(.bottom, 9)
        }
    }
}

private struct NativeCoachMessageUsage: View {
    private struct Config: Decodable {
        var enabled: Bool
        var quota: Quota?
    }

    private struct Quota: Decodable {
        let dailyLimit: Int
        let dailyRemaining: Int
        let monthlyLimit: Int
        let monthlyRemaining: Int
        let dailyResetsAt: String
        let monthlyResetsAt: String
    }

    let api: NativeAPI
    @State private var config: Config?
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Label("AI 消息用量", systemImage: "chart.bar").font(.headline)
            if let quota = config?.quota {
                allowance("今天", remaining: quota.dailyRemaining, limit: quota.dailyLimit, reset: quota.dailyResetsAt)
                allowance("本月", remaining: quota.monthlyRemaining, limit: quota.monthlyLimit, reset: quota.monthlyResetsAt)
            } else if failed {
                Button { Task { await load() } } label: { Label("暂时无法读取用量，点此重试", systemImage: "arrow.clockwise") }
                    .buttonStyle(.spotterPress).font(.subheadline)
            } else if config != nil {
                Text("AI 教练当前不可用。").font(.subheadline).foregroundStyle(SpotterPalette.muted)
            } else {
                ProgressView("正在读取用量").font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(13)
        .task { await load() }
    }

    private func allowance(_ label: String, remaining: Int, limit: Int, reset: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                Spacer()
                Text("剩余 \(remaining.formatted()) / \(limit.formatted()) 条")
                    .fontWeight(.semibold).monospacedDigit()
            }.font(.subheadline)
            ProgressView(value: Double(limit - remaining), total: Double(max(1, limit))).tint(SpotterPalette.accent)
            if let time = ISO8601DateFormatter().date(from: reset) {
                Text("重置于 \(time.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            }
        }
    }

    private func load() async {
        failed = false
        do { config = try await api.spotterRead("/api/ai-coach", as: Config.self) }
        catch { if !Task.isCancelled { failed = true } }
    }
}

private struct NativeTimerPreferences: View {
    @AppStorage(NativePreferenceKey.defaultRest) private var rest = 30
    @AppStorage(NativePreferenceKey.restSound) private var sound = false
    @AppStorage(NativePreferenceKey.restHaptics) private var haptics = false
    @AppStorage(NativePreferenceKey.keepAwake) private var keepAwake = false
    @AppStorage(NativeTrainingNotifications.restPreference) private var backgroundRestAlerts = false
    @AppStorage(NativeTrainingNotifications.liveActivityPreference) private var showsTrainingLiveActivity = true
    @Environment(\.openURL) private var openURL
    @State private var askingForNotifications = false
    @State private var notificationDenied = false
    var sync: NativeAccountPreferences?

    var body: some View {
        SecondaryGroup(title: "组间休息") {
            Stepper("默认休息 · \(rest) 秒", value: Binding(get: { rest }, set: { value in
                rest = value
                sync?.save(rest: value)
            }), in: 0...600, step: 5).padding(13)
            Divider()
            NativeSettingToggle(title: "提示声音", detail: "训练页面打开时，组间休息倒数结束后提示。", value: $sound)
            Divider()
            NativeSettingToggle(title: "提示触感", detail: "训练页面打开时，组间休息倒数结束后振动。", value: $haptics)
            Divider()
            NativeSettingToggle(title: "锁屏时提醒", detail: "App 进入后台或锁屏后，在组间休息结束时发送系统通知。", value: Binding(
                get: { backgroundRestAlerts },
                set: { value in
                    if value { Task { await requestRestNotifications() } }
                    else { backgroundRestAlerts = false; notificationDenied = false }
                }
            ))
            .disabled(askingForNotifications)
            if notificationDenied, let url = URL(string: UIApplication.openSettingsURLString) {
                Button { openURL(url) } label: {
                    SecondaryRow(title: "打开 iPhone 设置", detail: "允许通知后，再开启锁屏提醒。", icon: "bell.slash")
                }.buttonStyle(.spotterPress)
            }
        }
        SecondaryGroup(title: "训练计时") {
            NativeSettingToggle(title: "训练时保持常亮", detail: "训练页面打开且计时进行时延缓自动锁屏。", value: $keepAwake)
            if #available(iOS 16.1, *) {
                Divider()
                NativeSettingToggle(title: "锁屏实时训练", detail: "在锁屏和灵动岛显示下一组、完成组数和休息倒计时。", value: $showsTrainingLiveActivity)
            }
        }
    }

    private func requestRestNotifications() async {
        guard !askingForNotifications else { return }
        askingForNotifications = true
        let allowed = await NativeTrainingNotifications.shared.enable()
        backgroundRestAlerts = allowed
        notificationDenied = !allowed
        askingForNotifications = false
    }
}

private struct NativeTrainingReminderSettings: View {
    @AppStorage private var enabled: Bool
    @AppStorage private var minute: Int
    @State private var showPreview = false
    @State private var permissionMessage: String?
    @Environment(\.openURL) private var openURL

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
            NativeSettingToggle(title: "每日训练提醒", detail: "按已排训练发送提醒，锁屏时也可收到。", value: Binding(
                get: { enabled },
                set: { value in
                    if value { Task { await requestNotifications() } }
                    else { enabled = false; permissionMessage = nil }
                }
            ))
            Divider()
            DatePicker("提醒时间", selection: time, displayedComponents: .hourAndMinute).padding(13).disabled(!enabled)
            if enabled {
                Divider()
                Button("检查系统通知权限") { Task { await requestNotifications() } }
                    .buttonStyle(.spotterPress).padding(13)
            }
            if let permissionMessage {
                Text(permissionMessage).font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.horizontal, 13)
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    Button("打开 iPhone 设置") { openURL(url) }.buttonStyle(.spotterPress).padding(13)
                }
            }
            Divider()
            Button { showPreview = true } label: {
                SecondaryRow(title: "试试提醒", icon: "bell.badge", accessory: nil)
            }.buttonStyle(.spotterPress)
        }
        .alert("训练提醒", isPresented: $showPreview) { Button("好", role: .cancel) {} } message: {
            Text(NativePreferenceKey.reminderTitle)
        }
    }

    private func requestNotifications() async {
        if await NativeTrainingNotifications.shared.enable() {
            enabled = true
            permissionMessage = nil
        } else {
            enabled = false
            permissionMessage = "系统通知未开启。可以在 iPhone 设置中选取训练搭子并允许通知。"
        }
    }
}

private struct NativeUnitsPreferences: View {
    @AppStorage(NativePreferenceKey.unit) private var unit = "kg"
    @AppStorage(NativePreferenceKey.exerciseLanguage) private var language = "zh"
    @AppStorage(NativePreferenceKey.oneRepMax) private var oneRepMax = "epley"
    var sync: NativeAccountPreferences?

    var body: some View {
        SecondaryGroup {
            SpotterMenuPicker("新动作的重量单位", selection: Binding(get: { unit }, set: { value in
                unit = value
                sync?.save(unit: value)
            }), options: [("kg", "千克（kg）"), ("lb", "磅（lb）")]).padding(9)
            Divider()
            SpotterMenuPicker("动作库名称", selection: $language, options: [("zh", "中文"), ("en", "English"), ("both", "中英文")]).padding(9)
            Divider()
            SpotterMenuPicker("1RM 估算方式", selection: $oneRepMax, options: [("epley", "Epley"), ("brzycki", "Brzycki")]).padding(9)
        }
        SecondaryNotice(message: "切换单位只影响新添加的动作。训练容量和统计会统一换算为 kg。")
    }
}

private struct NativeEquipmentPreferences: View {
    @AppStorage(NativeGymPreferences.storageKey) private var saved = Data()
    @AppStorage(NativePreferenceKey.equipment) private var legacy = ""
    @State private var name = ""
    var sync: NativeAccountPreferences?

    private var preferences: NativeGymPreferences { .read(saved, legacy: legacy) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 17) {
                gymPicker
                NativeGymEquipmentGrid(preferences: preferences, toggle: { key in update { $0.toggle(key) } },
                                       toggleAll: { update { $0.toggleAll() } })
                Text("器械配置随账号同步。配置留空时显示所有器械。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.horizontal, 12)
            }.secondaryPage()
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle("器械")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }

    private var gymPicker: some View {
        SecondaryGroup(title: "健身房") {
            SpotterMenuPicker("当前器械配置", selection: Binding(get: { preferences.gym.id }, set: { id in
                update { $0.select(id) }
            }), options: preferences.profiles.map { ($0.id, $0.name) }).padding(9)
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
        sync?.save(gyms: next)
        name = ""
    }

    private func update(_ change: (inout NativeGymPreferences) -> Void) {
        var next = preferences
        change(&next)
        if let data = try? JSONEncoder().encode(next) { saved = data; sync?.save(gyms: next) }
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
    @AppStorage(SpotterTheme.storageKey) private var theme: SpotterTheme = .light
    @AppStorage(SpotterAccent.storageKey) private var accent: SpotterAccent = .lime
    @AppStorage(NativePreferenceKey.largerText) private var largerText = false
    @AppStorage(NativePreferenceKey.reduceMotion) private var reduceMotion = false

    var body: some View {
        SecondaryGroup {
            SpotterMenuPicker("主题", selection: $theme, options: SpotterTheme.allCases.map { ($0, $0.title) })
                .accessibilityIdentifier("spotter-theme-picker")
                .padding(9)
            Divider()
            VStack(alignment: .leading, spacing: 10) {
                Text("强调色").font(.subheadline.weight(.semibold)).accessibilityAddTraits(.isHeader)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                    ForEach(SpotterAccent.allCases) { choice in
                        Button { accent = choice } label: {
                            VStack(spacing: 5) {
                                ZStack {
                                    Circle().fill(choice.fill)
                                    if accent == choice {
                                        Image(systemName: "checkmark").font(.caption.weight(.bold))
                                            .foregroundStyle(SpotterPalette.deep)
                                    }
                                }
                                .frame(width: 28, height: 28)
                                .accessibilityHidden(true)
                                Text(choice.title).font(.caption.weight(.semibold)).lineLimit(2).minimumScaleFactor(0.75)
                            }
                            .frame(maxWidth: .infinity, minHeight: 57)
                            .foregroundStyle(SpotterPalette.ink)
                        }
                        .buttonStyle(SpotterChoiceStyle(selected: accent == choice, horizontalPadding: 2))
                        .accessibilityAddTraits(accent == choice ? .isSelected : [])
                        .accessibilityIdentifier("spotter-appearance-\(choice.rawValue)")
                    }
                }

            }.padding(13)
            Divider()
            NativeSettingToggle(title: "加大文字", detail: "增大使用系统动态字体的文字。", value: $largerText)
            Divider()
            NativeSettingToggle(title: "减少动画", detail: "减少应用内的界面过渡。", value: $reduceMotion)
        }
    }
}

private struct NativeModulePreferences: View {
    @AppStorage(NativePreferenceKey.friendsTab) private var friends = true
    @AppStorage(NativePreferenceKey.coachingEntry) private var coaching = false
    @AppStorage(NativePreferenceKey.nutritionModule) private var nutrition = true
    @AppStorage(NativePreferenceKey.weeklyCheckins) private var checkins = true
    @AppStorage(NativePreferenceKey.planShortcut) private var plans = true
    @AppStorage(NativePreferenceKey.officialTemplates) private var official = true

    var body: some View {
        SecondaryGroup {
            NativeSettingToggle(title: "好友入口", detail: "在底栏和今日页显示好友与搭子。", value: $friends)
            Divider()
            NativeSettingToggle(title: "教练与学员入口", detail: "在好友页的「找搭子」旁显示。", value: $coaching)
            Divider()
            NativeSettingToggle(title: "今日饮食", detail: "在今日页显示饮食记录。", value: $nutrition)
            Divider()
            NativeSettingToggle(title: "每周打卡", detail: "在今日页显示本周训练打卡。", value: $checkins)
            Divider()
            NativeSettingToggle(title: "计划快捷入口", detail: "在今日页显示添加计划快捷入口。", value: $plans)
            Divider()
            NativeSettingToggle(title: "官方模板", detail: "在训练页显示官方每周训练模板。", value: $official)
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
                SpotterMenuPicker("数据范围", selection: $scope, options: Scope.allCases.map { ($0, $0.name) }).padding(9)
                Divider()
                SpotterMenuPicker("文件格式", selection: $format,
                                  options: Format.allCases.filter { $0 == .json || scope.supportsCSV }.map { ($0, $0.rawValue.uppercased()) }).padding(9)
                Divider()
                Button { Task { await export() } } label: { SecondaryRow(title: "保存备份文件", icon: "square.and.arrow.up") }
                    .buttonStyle(.spotterPress).disabled(busy)
            }
            SecondaryGroup(title: "恢复备份") {
                Button { isImporting = true } label: {
                    SecondaryRow(title: "选择 Spotter JSON 备份", detail: "将缺少的条目恢复到当前账号。", icon: "square.and.arrow.down")
                }.buttonStyle(.spotterPress).disabled(busy)
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
    let betaSocialDefaults: Bool?
}

private struct SecondaryFriendFeed: Decodable {
    struct Day: Decodable, Identifiable {
        struct Item: Decodable, Identifiable {
            struct Cheer: Decodable {
                let count: Int
                let given: Bool
                let available: Bool
            }

            struct Workout: Decodable, Identifiable {
                let id: String
                let title: String
                let category: String?
                let minutes: Int
                let sets: Int

                var icon: String {
                    switch category {
                    case "有氧训练": return "figure.run"
                    case "拉伸恢复": return "figure.cooldown"
                    case "跟练视频": return "play.rectangle"
                    case "其他": return "figure.walk"
                    default: return "dumbbell"
                    }
                }
            }
            let friend: SecondaryFriend
            let workouts: [Workout]?
            let cheer: Cheer?
            var id: String { friend.id }
        }
        let date: String
        let items: [Item]
        var id: String { date }
    }
    let days: [Day]
}

private let secondaryFriendEngagementPath = "/api/friends/engagement"

private struct SecondaryFriendEngagement: Decodable {
    struct Cheers: Decodable, Identifiable {
        struct Workout: Decodable, Identifiable {
            let id: String
            let title: String
        }
        let date: String
        let names: [String]
        let workouts: [Workout]
        var id: String { date }
    }

    struct Appointment: Decodable, Identifiable {
        let id: String
        let sender: String
        let recipient: String
        let startsAt: Double
        let note: String
        let status: String
        var date: Date { Date(timeIntervalSince1970: startsAt / 1000) }
        var statusLabel: String {
            switch status {
            case "accepted": "已约好"
            case "declined": "已婉拒"
            case "cancelled": "已取消"
            default: date < .now ? "已过期" : "待确认"
            }
        }
    }
    let cheers: [Cheers]
}

private func friendPath(_ query: [URLQueryItem]) -> String {
    var parts = URLComponents()
    parts.path = "/api/friends"
    parts.queryItems = query
    return parts.string ?? "/api/friends"
}

@MainActor
final class NativeSocialRemarks: ObservableObject {
    static let maximumLength = 40
    private static let path = "/api/social/remarks"

    let owner: String
    private let api: NativeAPI
    @Published private var values: [String: String] = [:]
    private var revision = 0
    private var refreshing = false
    private var closed = false

    private struct List: Decodable { let remarks: [String: String] }
    private struct Update: Encodable { let id: String; let remark: String; let expectedOwner: String }
    private struct Receipt: Decodable { let id: String; let remark: String? }

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
    }

    func remark(for id: String) -> String? { id == owner ? nil : values[id] }

    func name(for id: String?, fallback: String) -> String {
        id.flatMap { remark(for: $0) } ?? fallback
    }

    func refresh() async {
        guard !closed, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        let startedAt = revision
        var endpoint = URLComponents()
        endpoint.path = Self.path
        endpoint.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
        guard let path = endpoint.string else { return }
        do {
            let data = try await api.request(path, method: "GET", json: nil, for: owner)
            let next = try JSONDecoder().decode(List.self, from: data).remarks
            guard !Task.isCancelled, !closed, startedAt == revision else { return }
            if next != values { values = next }
        } catch { }
    }

    func save(_ remark: String, for id: String) async throws {
        guard !closed else { throw NativeAPIError.accountChanged }
        let body = try JSONEncoder().encode(Update(id: id, remark: remark, expectedOwner: owner))
        let data = try await api.request(Self.path, method: "PATCH", json: body, for: owner)
        guard !closed else { throw NativeAPIError.accountChanged }
        let receipt = try JSONDecoder().decode(Receipt.self, from: data)
        guard receipt.id == id else { throw NativeAPIError.invalidResponse }
        revision &+= 1
        if values[id] != receipt.remark { values[id] = receipt.remark }
    }

    func forget(_ id: String) {
        revision &+= 1
        if values[id] != nil { values.removeValue(forKey: id) }
    }

    func clear() {
        closed = true
        values.removeAll()
    }
}

enum NativeFriendsPage: String, CaseIterable { case contacts = "联系人", feed = "朋友圈", privacy = "权限设置" }

@MainActor
struct NativeFriends: View {
    let api: NativeAPI
    let owner: String
    let buddySearchRequest: Int
    let notificationRequest: NativeSocialNotification?
    let openOwnLog: (@MainActor (String) -> Void)?
    let openOwnLogDay: (@MainActor (String, String) -> Void)?
    let refreshPlans: @MainActor () async -> Void
    @AppStorage(NativePreferenceKey.coachingEntry) private var showsCoaching = false
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterGuide) private var guide
    @EnvironmentObject private var notifications: NativeSocialNotifications
    @EnvironmentObject private var remarks: NativeSocialRemarks

    @State private var page: NativeFriendsPage
    @State private var data: SecondaryFriendList?
    @State private var social: SecondarySocial?
    @State private var feed: SecondaryFriendFeed?
    @State private var feedError: String?
    @State private var feedRevision = 0
    @State private var pendingCheer: PendingCheer?
    @State private var dialog: Dialog?
    @State private var inviteTab = InviteTab.search
    @State private var inviteKind = NativeConnectionKind.friend
    @State private var sharesBuddyNutrition = true
    @State private var pendingBuddyAcceptance: String?
    @State private var sharesAcceptedBuddyNutrition = true
    @State private var handledBuddyRequest = 0
    @State private var code = ""
    @State private var search = ""
    @State private var results: [SearchPerson]?
    @State private var notice: String?
    @State private var error = false
    @State private var busy = false
    @State private var engagement: SecondaryFriendEngagement?
    @State private var engagementError: String?
    @State private var engagementLoading = false
    @State private var selectedCheerWorkout: (id: String, date: String)?
    @State private var showNotifications = false
    @State private var inboxSelection: NativeSocialNotification?
    @State private var notificationDestination: FriendDestination?

    private enum Dialog: String, Identifiable {
        case invite = "添加好友", requests = "新的朋友", cheers = "收到的加油"
        var id: Self { self }
    }
    private enum InviteTab: String, CaseIterable { case search = "搜索用户名", code = "邀请链接" }
    private struct SearchPerson: Decodable, Identifiable { let id: String; let name: String; let handle: String? }
    private struct SearchResponse: Decodable { let results: [SearchPerson] }
    private struct PendingCheer {
        let friend: String
        let date: String
        let value: SecondaryFriendFeed.Day.Item.Cheer
    }
    private struct FriendDestination {
        let friend: SecondaryFriend
        let day: String?
    }

    init(api: NativeAPI, owner: String, initialPage: NativeFriendsPage = .contacts, initialBuddySearch: Bool = false,
         buddySearchRequest: Int = 0, notificationRequest: NativeSocialNotification? = nil,
         openOwnLog: (@MainActor (String) -> Void)? = nil,
         openOwnLogDay: (@MainActor (String, String) -> Void)? = nil,
         refreshPlans: @escaping @MainActor () async -> Void) {
        self.api = api
        self.owner = owner
        self.buddySearchRequest = buddySearchRequest
        self.notificationRequest = notificationRequest
        self.openOwnLog = openOwnLog
        self.openOwnLogDay = openOwnLogDay
        self.refreshPlans = refreshPlans
        _page = State(initialValue: initialPage)
        _dialog = State(initialValue: initialBuddySearch ? .invite : nil)
        _inviteKind = State(initialValue: initialBuddySearch ? .buddy : .friend)
    }

    private var listPath: String { friendPath([URLQueryItem(name: "today", value: spotterDay())]) }
    private var socialPath: String { "/api/friends?section=social&includeBuddy=1" }
    private var feedPath: String { "/api/friends?feed=2" }
    private var betaSocialDefaults: Bool { social?.betaSocialDefaults == true }
    private var cleanedCode: String { code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    SpotterGlassSegments(options: NativeFriendsPage.allCases, value: $page,
                                         guideTarget: { $0 == .privacy ? .privacy : nil }, title: \.rawValue)
                    notificationButton
                }
                if dialog == nil, let notice { SecondaryNotice(message: notice, warning: error).transition(.opacity) }
                ZStack(alignment: .topLeading) {
                    switch page {
                    case .contacts: contacts
                    case .feed: feedContent
                    case .privacy: privacy
                    }
                }
                .transition(.opacity)
                .animation(motion, value: page)
            }.secondaryPage()
        }
        .foregroundStyle(SpotterPalette.ink).background(SpotterPalette.background)
        .task { await load() }
        .task(id: notificationRequest?.id) { await openRequestedNotification() }
        .onAppear { presentRequestedBuddySearch() }
        .onChange(of: buddySearchRequest) { _ in presentRequestedBuddySearch() }
        .onChange(of: search) { _ in results = nil }
        .task(id: page) {
            if page == .feed { await loadFeed() }
        }
        .task(id: guide?.step) {
            if guide?.step == .findBuddy { page = .contacts }
        }
        .refreshable {
            async let refreshRemarks: Void = remarks.refresh()
            await load()
            if page == .feed { await loadFeed() }
            await refreshRemarks
        }
        .navigationDestination(isPresented: Binding(get: { notificationDestination != nil }, set: { if !$0 { notificationDestination = nil } })) {
            if let destination = notificationDestination { friendDetail(destination.friend, day: destination.day) }
        }
        .sheet(isPresented: $showNotifications, onDismiss: {
            if let item = inboxSelection {
                inboxSelection = nil
                Task {
                    await notifications.open(item)
                    await openNotificationDestination(item)
                }
            }
        }) {
            NativeNotificationInbox(owner: owner) { inboxSelection = $0 }.presentationDragIndicator(.visible)
        }
        .sheet(item: $dialog, onDismiss: {
            guide?.advance(.buddySearch)
            openSelectedCheerWorkout()
        }) { item in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 13) {
                        switch item {
                        case .invite: invitation
                        case .requests: requests
                        case .cheers: receivedCheers
                        }
                        if let notice { SecondaryNotice(message: notice, warning: error).transition(.opacity) }
                    }.secondaryPage()
                }.background(SpotterPalette.background)
                    .nativeGuideLayer(.invitation) { closeDialog() }
                    .navigationTitle(item == .invite ? inviteKind.invitationTitle : item.rawValue).navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button("完成") { closeDialog() }.buttonStyle(.spotterPress).disabled(busy) }
                    }
            }
            .task {
                if item == .cheers { await loadEngagement() }
            }
            .presentationDetents(item == .invite && inviteKind == .friend && guide?.step != .buddySearch ? [.medium, .large] : [.large])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(busy)
        }
    }

    private var notificationButton: some View {
        let unreadCount = notifications.belongs(to: owner) ? notifications.unreadCount : 0
        return Button { showNotifications = true } label: {
            Image(systemName: unreadCount == 0 ? "bell" : "bell.badge.fill")
                .font(.headline).frame(width: 44, height: 44).secondaryCard(radius: 13)
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel("通知")
        .accessibilityValue(unreadCount > 0 ? "\(unreadCount) 条未读" : "无未读")
    }

    private func openRequestedNotification() async {
        guard let item = notificationRequest else { return }
        await openNotificationDestination(item)
    }

    private func openNotificationDestination(_ item: NativeSocialNotification) async {
        if data == nil { await load() }
        guard !Task.isCancelled, notifications.belongs(to: owner), notifications.requestedItem?.id == item.id else { return }
        notifications.clearRequest(item.id)
        if let actor = item.actorId, let friend = data?.friends.first(where: { $0.id == actor }) {
            page = .contacts
            notificationDestination = FriendDestination(friend: friend, day: item.date)
        } else {
            page = item.kind == .friendWorkout ? .feed : .contacts
        }
    }

    private var contacts: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Text("联系人").font(.headline)
                if let data { SecondaryBadge(text: "\(data.friends.count) 位") }
                Spacer()
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 7) { contactActions }

                    .fixedSize(horizontal: true, vertical: false)
                VStack(alignment: .leading, spacing: 7) { contactActions }
            }
            Button { open(.requests) } label: {
                let count = social?.incoming.count ?? 0
                SecondaryRow(title: "新的朋友", detail: count > 0 ? "\(count) 条申请" : nil, icon: "person.badge.plus", color: SpotterPalette.wash)
                    .secondaryCard()
            }.buttonStyle(.spotterPress)
            if let data {
                let buddies = data.friends.filter(\.buddy)
                let ordinary = data.friends.filter { !$0.buddy }
                if !buddies.isEmpty { contactGroup("训练搭子", friends: buddies) }
                if !ordinary.isEmpty { contactGroup("普通好友", friends: ordinary) }
                if data.friends.isEmpty { SecondaryNotice(message: "添加好友后，可从联系人查看对方分享的每日记录。") }
            } else if !error { ProgressView("正在读取好友…") }
            else { Button("重新读取") { Task { await load() } }.buttonStyle(SecondaryButtonStyle()) }
        }.animation(motion, value: data?.friends.map(\.id))
    }

    @ViewBuilder private var contactActions: some View {
        Button { open(.invite) } label: { Label("添加好友", systemImage: "person.badge.plus") }
            .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy)
        Button {
            open(.invite, kind: .buddy)
            guide?.advance(.findBuddy)
        } label: { Label("找搭子", systemImage: "person.2") }
            .buttonStyle(SecondaryButtonStyle()).disabled(busy)
            .nativeGuideTarget(.findBuddy)
        if showsCoaching {
            NavigationLink {
                NativeCoachingView(api: api, owner: owner).onDisappear { Task { await refreshPlans() } }
            } label: {
                Label("教练与学员", systemImage: "graduationcap")
            }.buttonStyle(SecondaryButtonStyle())
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

    private func friendDetail(_ friend: SecondaryFriend, day: String? = nil) -> some View {
        SecondaryFriendDetail(api: api, owner: owner, friend: data?.friends.first(where: { $0.id == friend.id }) ?? friend,
                              initialDay: day, listPath: listPath) {
            invalidateFeed()
            if page == .feed { await loadFeed() }
            await load()
            await refreshPlans()
        }
    }

    private func displayName(_ friend: SecondaryFriend) -> String {
        remarks.name(for: friend.id, fallback: friend.name)
    }

    private func friendLink(_ friend: SecondaryFriend) -> some View {
        NavigationLink { friendDetail(friend) } label: {
            HStack(spacing: 10) {
                avatar(displayName(friend), id: friend.id, buddy: friend.buddy)
                VStack(alignment: .leading, spacing: 5) {
                    Text(displayName(friend)).font(.subheadline.weight(.semibold))
                    Text(friend.buddy ? "训练搭子" : "查看每日记录").font(.caption).foregroundStyle(SpotterPalette.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                if friend.checkedIn == true { SecondaryBadge(text: "已打卡", green: true) }
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            }.padding(12).frame(minHeight: 58).contentShape(Rectangle())
        }.buttonStyle(.spotterPress)
    }

    private var feedContent: some View {
        LazyVStack(alignment: .leading, spacing: 18) {
            Button { open(.cheers) } label: {
                SecondaryRow(title: "收到的加油", detail: "查看好友最近为你的哪些打卡加油了",
                             icon: "heart.fill", color: accent.selection)
                    .secondaryCard()
            }.buttonStyle(.spotterPress)
            if let feed {
                let activeDays = feed.days.filter { !$0.items.isEmpty }
                if let feedError { SecondaryNotice(message: feedError, warning: true) }
                if activeDays.isEmpty { emptyFeed }
                ForEach(activeDays) { day in
                    feedDayHeading(day.date)
                    ForEach(day.items.filter(isOwn) + day.items.filter { !isOwn($0) }) { item in
                        feedCard(item, day: day.date)
                    }
                }
            } else if let feedError {
                VStack(alignment: .leading, spacing: 10) {
                    SecondaryNotice(message: feedError, warning: true)
                    Button("重新读取") { Task { await loadFeed() } }.buttonStyle(SecondaryButtonStyle())
                }.padding(14).secondaryCard()
            } else {
                ProgressView("正在读取朋友圈…")
                    .font(.subheadline).padding(24).frame(maxWidth: .infinity)
                    .secondaryCard(radius: 18)
            }
        }
        .animation(motion, value: feed?.days.map { $0.items.count })
        .animation(motion, value: feedError)
    }

    @ViewBuilder private var receivedCheers: some View {
        Text("近 14 天").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
        if let engagement {
            if engagement.cheers.isEmpty {
                SecondaryNotice(message: "这段时间还没有收到加油。")
            }
            ForEach(engagement.cheers) { day in
                VStack(alignment: .leading, spacing: 9) {
                    HStack(spacing: 8) {
                        SecondaryTile(icon: "heart.fill", color: accent.selection)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(day.date).font(.caption.monospacedDigit()).foregroundStyle(SpotterPalette.muted)
                            Text(day.names.joined(separator: "、") + " 给你加油了").font(.subheadline.weight(.semibold))
                        }
                    }
                    ForEach(day.workouts) { workout in
                        Button {
                            selectedCheerWorkout = (workout.id, day.date)
                            closeDialog()
                        } label: {
                            SecondaryRow(title: workout.title, icon: "dumbbell", color: SpotterPalette.wash)
                        }
                        .buttonStyle(.spotterPress)
                        .disabled(openOwnLogDay == nil && openOwnLog == nil)
                    }
                }.padding(11).secondaryCard()
            }
        } else {
            engagementLoadState
        }
    }

    @ViewBuilder private var engagementLoadState: some View {
        if let engagementError {
            SecondaryNotice(message: engagementError, warning: true)
            Button("重新读取") { Task { await loadEngagement() } }.buttonStyle(.spotterControl)
        } else {
            ProgressView("正在读取…").font(.footnote)
        }
    }

    private func openSelectedCheerWorkout() {
        guard let workout = selectedCheerWorkout else { return }
        selectedCheerWorkout = nil
        if let openOwnLogDay { openOwnLogDay(workout.id, workout.date) }
        else { openOwnLog?(workout.id) }
    }

    private func loadEngagement() async {
        guard !engagementLoading else { return }
        engagementLoading = true
        defer { engagementLoading = false }
        engagementError = nil
        do {
            let response = try await api.request(secondaryFriendEngagementPath, method: "GET", json: nil, for: owner)
            let current = try JSONDecoder().decode(SecondaryFriendEngagement.self, from: response)
            withAnimation(motion) { engagement = current }
        } catch is CancellationError {
        } catch { engagementError = error.localizedDescription }
    }

    private var emptyFeed: some View {
        let hasNoFriends = data?.friends.isEmpty == true
        return VStack(alignment: .center, spacing: 11) {
            Image(systemName: "person.2.wave.2").font(.title2.weight(.semibold))
                .foregroundStyle(accent.tint).frame(width: 58, height: 58)
                .background(accent.selection, in: Circle()).accessibilityHidden(true)
            Text("还没有新打卡").font(.headline).accessibilityAddTraits(.isHeader)
            Text(hasNoFriends ? "在这里查看自己的训练打卡，添加好友后也能看到对方分享的动态。" : "这里会显示你和好友近 3 天的训练打卡。")
                .font(.subheadline).foregroundStyle(SpotterPalette.muted).multilineTextAlignment(.center)
            if hasNoFriends {
                Button { open(.invite) } label: { Label("添加好友", systemImage: "person.badge.plus") }
                    .buttonStyle(SecondaryButtonStyle(primary: true))
            }
        }
        .padding(24).frame(maxWidth: .infinity).secondaryCard(radius: 20)
    }

    private func feedDayHeading(_ day: String) -> some View {
        let date = SecondaryDate.parse(day)
        let shortDate = date.map {
            let parts = SecondaryDate.calendar.dateComponents([.month, .day], from: $0)
            return "\(parts.month ?? 0)月\(parts.day ?? 0)日"
        } ?? day
        let relative: String?
        switch day {
        case spotterDay(): relative = "今天"
        case spotterDay(SecondaryDate.shift(SecondaryDate.today, -1)): relative = "昨天"
        default: relative = nil
        }
        return HStack(spacing: 8) {
            Circle().fill(accent.tint).frame(width: 7, height: 7).accessibilityHidden(true)
            if let relative {
                Text(relative).font(.headline)
                Text(shortDate).font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            } else {
                Text(shortDate).font(.headline)
            }
            Rectangle().fill(SpotterPalette.line).frame(height: 1).accessibilityHidden(true)
        }.padding(.horizontal, 3).accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
    }

    private func isOwn(_ item: SecondaryFriendFeed.Day.Item) -> Bool { item.id == owner }

    private func feedCard(_ item: SecondaryFriendFeed.Day.Item, day: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if isOwn(item) {
                feedHeader(item)
                ForEach(item.workouts ?? []) { workout in
                    if let openOwnLog {
                        Button { openOwnLog(workout.id) } label: {
                            feedWorkout(workout, opensRecord: true)
                        }.buttonStyle(.spotterPress).accessibilityHint("查看这条训练记录")
                    } else {
                        feedWorkout(workout)
                    }
                }
                if let cheer = item.cheer {
                    HStack {
                        Spacer(minLength: 0)
                        Label("收到 \(cheer.count) 次加油", systemImage: "heart")
                            .font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                            .padding(.horizontal, 8).padding(.vertical, 5)
                    }
                }
            } else {
                NavigationLink { friendDetail(item.friend, day: day) } label: {
                    VStack(alignment: .leading, spacing: 12) {
                        feedHeader(item)
                        if let workouts = item.workouts {
                            ForEach(workouts) { workout in feedWorkout(workout) }
                        } else {
                            Label("训练详情未共享", systemImage: "lock").font(.caption)
                                .foregroundStyle(SpotterPalette.muted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(11).background(SpotterPalette.background.opacity(0.64), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }.contentShape(Rectangle())
                }.buttonStyle(.spotterPress).accessibilityHint("查看这一天的好友记录")
                if let cheer = item.cheer, cheer.available { feedCheerButton(item, cheer: cheer, day: day) }
            }
        }
        .padding(13)
        .background {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(LinearGradient(colors: [accent.selection.opacity(isOwn(item) || item.friend.buddy ? 0.76 : 0.31), SpotterPalette.card],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
        }
        .overlay { RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
    }

    private func feedHeader(_ item: SecondaryFriendFeed.Day.Item) -> some View {
        HStack(spacing: 11) {
            avatar(displayName(item.friend), id: item.friend.id, buddy: isOwn(item) || item.friend.buddy, size: 44, circular: true)
            VStack(alignment: .leading, spacing: 3) {
                Text(displayName(item.friend)).font(.headline)
                if isOwn(item) || item.friend.buddy {
                    Text(isOwn(item) ? "我的打卡" : "训练搭子").font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
            Label("已打卡", systemImage: "checkmark.circle.fill")
                .font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.accent)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(SpotterPalette.wash, in: Capsule())
            if !isOwn(item) {
                Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            }
        }
    }

    private func feedCheerButton(_ item: SecondaryFriendFeed.Day.Item, cheer: SecondaryFriendFeed.Day.Item.Cheer, day: String) -> some View {
        let shown = pendingCheer.flatMap { $0.friend == item.id && $0.date == day ? $0.value : nil } ?? cheer
        return HStack {
            Spacer(minLength: 0)
            Button {
                Task { await updateCheer(item, cheer: cheer, day: day) }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: shown.given ? "heart.fill" : "heart").accessibilityHidden(true)
                    Text(shown.given ? "已加油" : "加油")
                    Text(shown.count.formatted()).monospacedDigit()
                }
                .font(.caption.weight(.semibold)).foregroundStyle(shown.given ? accent.tint : SpotterPalette.muted)
                .padding(.horizontal, 13).frame(minHeight: 44)
                .background(shown.given ? accent.selection : SpotterPalette.background, in: Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.spotterPress).disabled(pendingCheer != nil)
            .accessibilityLabel(shown.given ? "取消给\(displayName(item.friend))加油" : "给\(displayName(item.friend))加油")
            .accessibilityValue("\(shown.count) 次加油")
            .accessibilityIdentifier("feed-cheer-\(item.id)-\(day)")
        }
    }

    private func feedWorkout(_ workout: SecondaryFriendFeed.Day.Item.Workout, opensRecord: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 10) {
            SecondaryTile(icon: workout.icon, color: accent.selection, size: 36)
            VStack(alignment: .leading, spacing: 6) {
                Text(workout.title).font(.subheadline.weight(.semibold))
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 9) { feedWorkoutMetrics(workout) }.fixedSize(horizontal: true, vertical: false)
                    VStack(alignment: .leading, spacing: 5) { feedWorkoutMetrics(workout) }
                }.font(.caption).foregroundStyle(SpotterPalette.muted)
            }.frame(maxWidth: .infinity, alignment: .leading)
            if opensRecord {
                Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                    .frame(minHeight: 36)
            }
        }.padding(10)
            .background(SpotterPalette.background.opacity(0.72), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder private func feedWorkoutMetrics(_ workout: SecondaryFriendFeed.Day.Item.Workout) -> some View {
        Label("\(workout.minutes) 分钟", systemImage: "clock")
        if workout.sets > 0 { Label("\(workout.sets) 组", systemImage: "checklist") }
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
                if guide?.step == .buddySearch { searchPanel }
                relationshipComparison
                if betaSocialDefaults {
                    buddyNutritionChoice($sharesBuddyNutrition)
                }
                if guide?.step != .buddySearch { searchPanel }
                Divider()
                VStack(alignment: .leading, spacing: 7) {
                    Text("想加普通好友？").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    Button { open(.invite, kind: .friend) } label: { Label("添加好友", systemImage: "person.badge.plus") }
                        .buttonStyle(SecondaryButtonStyle()).disabled(busy || guide?.step == .buddySearch)
                }
            } else {
                SecondaryNotice(message: betaSocialDefaults ? "在这里完成添加后，默认可见训练打卡与详情。可在好友资料里开启饮食分享。" :
                                    "添加后默认互相分享训练打卡、详情和饮食记录状态，具体范围遵循双方的分享设置。")
                SpotterGlassSegments(options: InviteTab.allCases, value: $inviteTab, title: \.rawValue)
                ZStack(alignment: .topLeading) {
                    if inviteTab == .search { searchPanel } else { codePanel }
                }.transition(.opacity).animation(motion, value: inviteTab)
            }
        }
    }

    private var relationshipComparison: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("搭子和好友的区别").font(.headline).accessibilityAddTraits(.isHeader)
            SecondaryGroup {
                SecondaryRow(title: "训练搭子", detail: "对方接受后即绑定，每人同时只能有 1 位。搭子可看训练记录，以及你选择共享的饮食等私人数据。",
                             icon: "person.2.fill", color: accent.selection, accessory: nil)
                Divider().padding(.horizontal, 12)
                SecondaryRow(title: "普通好友", detail: betaSocialDefaults
                             ? "默认只看你共享的健身打卡和训练详情。饮食需你手动开启共享。"
                             : "可看你共享的健身打卡和训练详情，饮食可见范围由分享设置决定。",
                             icon: "person.crop.circle", color: secondaryLilac, accessory: nil)
            }
            Text("后续计划为搭子加入训练、睡眠和恢复分析，届时按你授权的范围共享。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        }
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("对方的用户名").font(.subheadline.weight(.semibold))
            HStack {
                TextField("例如 spotter#1234", text: $search).textFieldStyle(.roundedBorder).submitLabel(.search)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityLabel("对方的用户名")
                    .onSubmit { Task { await findFriends() } }
                    .nativeGuideTarget(.buddySearch)
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
                        avatar(result.name, id: data?.friends.contains(where: { $0.id == result.id }) == true ? result.id : nil)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(result.name).font(.subheadline.weight(.semibold))
                            if let handle = result.handle { Text(handle).font(.caption.monospaced()).foregroundStyle(SpotterPalette.muted) }
                        }
                        Spacer()
                        Button(received ? "处理申请" : waiting ? "已申请" : "发送申请") {
                            if received { open(.requests) }
                            else { sendConnectionRequest(to: result) }
                        }.buttonStyle(SecondaryButtonStyle()).disabled(busy || waiting || guide?.step == .buddySearch)
                    }.padding(.vertical, 5)
                }
            }
        }
    }

    private func sendConnectionRequest(to person: SearchPerson) {
        let kind = inviteKind
        var body: [String: Any] = ["action": "request", "id": person.id, "kind": kind.rawValue]
        if betaSocialDefaults && kind == .buddy { body["shareNutrition"] = sharesBuddyNutrition }
        Task { await mutateSocial(body, confirmation: kind.requestTitle + "已发送。") }
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
                    ShareLink(item: api.origin + "/invite/" + invite.code) { Label("分享链接", systemImage: "square.and.arrow.up") }
                        .buttonStyle(SecondaryButtonStyle(primary: true))
                    Button("复制邀请码") { UIPasteboard.general.string = invite.code; report("已复制邀请码。") }
                        .buttonStyle(SecondaryButtonStyle())
                }

                Button("停用邀请码") { Task { await mutateList(["action": "revoke"], confirmation: "邀请码已停用。") } }
                    .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.accent).disabled(busy)
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
                let confirmsBuddy = incoming && pendingBuddyAcceptance == request.id
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 7) {
                        avatar(request.name, id: data?.friends.contains(where: { $0.id == request.personId }) == true ? request.personId : nil)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(request.name).font(.subheadline.weight(.semibold))
                            Text(request.connectionKind.requestTitle).font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                        Spacer(minLength: 3)
                        if !confirmsBuddy {
                            HStack(spacing: 5) {
                                if incoming { acceptRequestButton(request) }
                                requestButton(incoming ? "拒绝" : "撤回", request: request, decision: incoming ? "decline" : "cancel",
                                              confirmation: incoming ? "已拒绝申请。" : "申请已撤回。")
                            }
                        }
                    }
                    if confirmsBuddy {
                        buddyNutritionChoice($sharesAcceptedBuddyNutrition)
                        HStack {
                            Button("返回") { withAnimation(motion) { pendingBuddyAcceptance = nil } }
                                .buttonStyle(SecondaryButtonStyle()).disabled(busy)
                            Button("确认成为搭子") {
                                let requestBody: [String: Any] = ["action": "respond", "id": request.id, "decision": "accept",
                                                                  "shareNutrition": sharesAcceptedBuddyNutrition]
                                Task { await mutateSocial(requestBody, confirmation: "已连接训练搭子。") }
                            }
                            .buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy)
                        }
                    }
                }.padding(11)
            }
        }
    }

    @ViewBuilder private func acceptRequestButton(_ request: SecondarySocial.Request) -> some View {
        if betaSocialDefaults && request.connectionKind == .buddy {
            Button("接受") {
                sharesAcceptedBuddyNutrition = true
                withAnimation(motion) { pendingBuddyAcceptance = request.id }
            }.buttonStyle(SecondaryButtonStyle(primary: true)).disabled(busy)
        } else {
            requestButton("接受", request: request, decision: "accept",
                          confirmation: request.connectionKind == .buddy ? "已连接训练搭子。" : "好友已添加。")
        }
    }

    private func buddyNutritionChoice(_ value: Binding<Bool>) -> some View {
        SecondaryToggle(title: "共享我的饮食记录和详情", detail: "搭子可以看见餐次、食物、克数和营养。日后可在搭子资料里关闭。", value: value)
            .disabled(busy)
    }

    private func requestButton(_ title: String, request: SecondarySocial.Request, decision: String, confirmation: String) -> some View {
        Button(title) { Task { await mutateSocial(["action": "respond", "id": request.id, "decision": decision], confirmation: confirmation) } }
            .buttonStyle(SecondaryButtonStyle(primary: decision == "accept")).disabled(busy)
    }

    private func open(_ item: Dialog, kind: NativeConnectionKind = .friend) {
        notice = nil
        error = false
        pendingBuddyAcceptance = nil
        if item == .invite {
            inviteTab = .search
            inviteKind = kind
            sharesBuddyNutrition = true
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
    private func report(_ text: String, failure: Bool = false) {
        withAnimation(motion) {
            notice = text
            error = failure
        }
    }

    private func load() async {
        async let contacts = api.spotterRead(listPath, as: SecondaryFriendList.self)
        async let preferences = api.spotterRead(socialPath, as: SecondarySocial.self)
        do { data = try await contacts; social = try await preferences }
        catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { report(error.localizedDescription, failure: true) }
    }

    private func invalidateFeed() {
        feedRevision += 1
        feed = nil
        feedError = nil
    }

    private func loadFeed() async {
        feedRevision += 1
        let revision = feedRevision
        feedError = nil
        do {
            let value = try await api.spotterRead(feedPath, as: SecondaryFriendFeed.self)
            if !Task.isCancelled, revision == feedRevision { feed = value }
        }
        catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { if !Task.isCancelled, revision == feedRevision { feedError = error.localizedDescription } }
    }

    private func updateCheer(_ item: SecondaryFriendFeed.Day.Item, cheer: SecondaryFriendFeed.Day.Item.Cheer, day: String) async {
        guard !isOwn(item), cheer.available, pendingCheer == nil else { return }
        let active = !cheer.given
        let value = SecondaryFriendFeed.Day.Item.Cheer(count: max(0, cheer.count + (active ? 1 : -1)), given: active, available: true)
        feedRevision += 1
        let revision = feedRevision
        withAnimation(motion) {
            pendingCheer = PendingCheer(friend: item.id, date: day, value: value)
            feedError = nil
        }
        defer { withAnimation(motion) { pendingCheer = nil } }
        do {
            let body: [String: Any] = ["action": "feed-cheer", "friend": item.id, "date": day, "active": active, "expectedOwner": owner]
            let result = try await api.request(feedPath, method: "POST", json: JSONSerialization.data(withJSONObject: body), for: owner)
            let updated = try JSONDecoder().decode(SecondaryFriendFeed.self, from: result)
            if revision == feedRevision {
                withAnimation(motion) { feed = updated }
            } else if page == .feed {
                await loadFeed()
            }
        } catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { if revision == feedRevision { feedError = error.localizedDescription } }
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
            withAnimation(motion) { results = result.results }
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func mutateList(_ body: [String: Any], confirmation: String) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let response = try await api.spotterSend(listPath, body: body)
            let updated = try JSONDecoder().decode(SecondaryFriendList.self, from: response)
            withAnimation(motion) { data = updated }
            if body["action"] as? String == "join" { invalidateFeed(); code = ""; closeDialog(); await refreshPlans() }
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
            let updated = try JSONDecoder().decode(SecondarySocial.self, from: response)
            withAnimation(motion) { social = updated }
            if body["decision"] as? String == "accept" {
                pendingBuddyAcceptance = nil
                invalidateFeed()
                await load()
                await refreshPlans()
            }
            if body["action"] as? String == "social-preferences" { invalidateFeed() }
            report(confirmation)
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func inviteDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

@MainActor
private func avatar(_ name: String, id: String?, buddy: Bool = false, size: CGFloat = 35, circular: Bool = false) -> some View {
    NativePersonAvatar(id: id, name: name.isEmpty ? "友" : name, size: size, appearance: .init(
        foreground: SpotterPalette.ink, background: buddy ? SpotterPalette.wash : secondaryLilac,
        cornerRadius: circular ? nil : 9, outlined: false
    ))
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
private struct SecondaryBuddyAppointments: View {
    let api: NativeAPI
    let owner: String
    let buddyID: String
    let buddyName: String

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var appointments: [SecondaryFriendEngagement.Appointment]?
    @State private var time = Date.now.addingTimeInterval(3_600)
    @State private var note = ""
    @State private var requestID = UUID().uuidString.lowercased()
    @State private var notice: String?
    @State private var failed = false
    @State private var busy = false
    @State private var loadRevision = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    invitation
                    if let notice { SecondaryNotice(message: notice, warning: failed).transition(.opacity) }
                    if let appointments {
                        if appointments.isEmpty { SecondaryNotice(message: "还没有近期训练邀约。") }
                        ForEach(appointments) { appointmentCard($0) }
                    } else if failed {
                        Button("重新读取") { loadRevision &+= 1 }.buttonStyle(.spotterControl)
                    } else {
                        ProgressView("正在读取训练邀约…").font(.footnote)
                    }
                }.secondaryPage()
            }
            .background(SpotterPalette.background)
            .navigationTitle("约下次训练").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }.buttonStyle(.spotterPress).disabled(busy)
                }
            }
        }
        .task(id: loadRevision) { await load() }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private var invitation: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("邀请 \(buddyName) 一起训练", systemImage: "person.2.fill").font(.headline)
            DatePicker("训练时间", selection: $time, in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                .tint(accent.tint).font(.subheadline)
                .onChange(of: time) { _ in requestID = UUID().uuidString.lowercased() }
                .disabled(busy)
            TextField("地点或备注（选填）", text: $note)
                .textFieldStyle(.roundedBorder)
                .onChange(of: note) { value in
                    if value.count > 180 { note = String(value.prefix(180)) }
                    requestID = UUID().uuidString.lowercased()
                }
                .disabled(busy)
            Button {
                let body: [String: Any] = ["action": "propose", "expectedOwner": owner, "id": requestID,
                    "partner": buddyID, "startsAt": Int(time.timeIntervalSince1970 * 1000), "note": note]
                Task { await mutate(body, proposed: true) }
            } label: {
                Label("发出训练邀约", systemImage: "paperplane.fill").frame(maxWidth: .infinity)
            }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
            .disabled(busy || appointments == nil || time <= .now)
        }
        .padding(13).secondaryCard()
    }

    private func appointmentCard(_ appointment: SecondaryFriendEngagement.Appointment) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(appointment.sender == owner ? "我发起的邀约" : "搭子的邀约", systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 3)
                SecondaryBadge(text: appointment.statusLabel, green: appointment.status == "accepted")
            }
            Text(appointment.date, format: .dateTime.month().day().hour().minute()).font(.headline)
            if !appointment.note.isEmpty { Text(appointment.note).font(.footnote).foregroundStyle(SpotterPalette.muted) }
            if appointment.date > .now {
                if appointment.recipient == owner && appointment.status == "pending" {
                    HStack {
                        appointmentButton("接受", action: "accept", item: appointment, primary: true)
                        appointmentButton("婉拒", action: "decline", item: appointment)
                    }
                } else if (appointment.sender == owner && appointment.status == "pending") || appointment.status == "accepted" {
                    appointmentButton("取消邀约", action: "cancel", item: appointment)
                }
            }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(13).secondaryCard()
    }

    private func appointmentButton(_ title: String, action: String, item: SecondaryFriendEngagement.Appointment, primary: Bool = false) -> some View {
        Button(title) {
            Task { await mutate(["action": action, "expectedOwner": owner, "id": item.id]) }
        }.buttonStyle(SecondaryButtonStyle(primary: primary)).disabled(busy)
    }

    private struct Response: Decodable { let appointments: [SecondaryFriendEngagement.Appointment] }

    private func load() async {
        notice = nil
        failed = false
        do {
            let data = try await api.request(secondaryFriendEngagementPath, method: "GET", json: nil, for: owner)
            try Task.checkCancellation()
            try apply(data)
        } catch is CancellationError {
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func mutate(_ body: [String: Any], proposed: Bool = false) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let json = try JSONSerialization.data(withJSONObject: body)
            let data = try await api.request(secondaryFriendEngagementPath, method: "POST", json: json, for: owner)
            try apply(data)
            if proposed {
                note = ""
                requestID = UUID().uuidString.lowercased()
            }
            report(proposed ? "训练邀约已发出。" : "训练邀约已更新。")
        } catch { report(error.localizedDescription, failure: true) }
    }

    private func apply(_ data: Data) throws {
        let response = try JSONDecoder().decode(Response.self, from: data)
        let related = response.appointments.filter { item in
            (item.sender == owner && item.recipient == buddyID) || (item.sender == buddyID && item.recipient == owner)
        }
        withAnimation(motion) { appointments = related }
    }

    private func report(_ message: String, failure: Bool = false) {
        withAnimation(motion) {
            notice = message
            failed = failure
        }
    }
}

@MainActor
private struct SecondaryFriendDetail: View {
    let api: NativeAPI
    let owner: String
    let friend: SecondaryFriend
    let listPath: String
    let changed: @MainActor () async -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var avatars: NativeAvatarStore
    @EnvironmentObject private var remarks: NativeSocialRemarks
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterAccent) private var accent
    @Environment(\.dynamicTypeSize) private var typeSize
    @EnvironmentObject private var notifications: NativeSocialNotifications
    @State private var date: Date
    @State private var record: Record?
    @State private var sharing: SecondaryFriend.Sharing?
    @State private var saved: SecondaryFriend.Sharing?
    @State private var busy = false
    @State private var showRemove = false
    @State private var showDatePicker = false
    @State private var showRemarkEditor = false
    @State private var showAppointments = false
    @State private var loadError: String?
    @State private var actionError: String?
    @State private var loadRevision = 0
    @State private var reminderSending = false
    @State private var reminderError: String?
    @State private var reminderSent = false

    private static let firstDay = SecondaryDate.parse("1900-01-01") ?? .distantPast
    private var remark: String? { remarks.remark(for: friend.id) }
    private var displayName: String { remark ?? friend.name }

    private struct Record: Decodable {
        let restricted: Bool?
        let workoutCheckin: Bool
        let dietCheckin: Bool?
        let training: [NativeJSON]?
        let nutrition: [NativeJSON]?
    }

    init(api: NativeAPI, owner: String, friend: SecondaryFriend, initialDay: String?, listPath: String,
         changed: @escaping @MainActor () async -> Void) {
        self.api = api
        self.owner = owner
        self.friend = friend
        self.listPath = listPath
        self.changed = changed
        let today = SecondaryDate.today
        let day = initialDay.flatMap(SecondaryDate.parse) ?? today
        _date = State(initialValue: min(today, max(Self.firstDay, day)))
        _sharing = State(initialValue: friend.sharing)
        _saved = State(initialValue: friend.sharing)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                profileCard
                if friend.buddy {
                    Button { showAppointments = true } label: {
                        SecondaryRow(title: "约下次训练", detail: "发邀约、确认时间和查看近期安排",
                                     icon: "calendar.badge.plus", color: accent.selection)
                            .secondaryCard(radius: 16)
                    }.buttonStyle(.spotterPress)
                }
                activityCard
                if let sharing { sharingCard(sharing) }
                if let actionError { SecondaryNotice(message: actionError, warning: true) }
                if !friend.buddy {
                    Button("移除好友", role: .destructive) { showRemove = true }
                        .buttonStyle(.spotterPress).foregroundStyle(.red).disabled(busy).frame(minHeight: 44)
                }
            }.secondaryPage()
        }.background(SpotterPalette.background)
            .navigationTitle(friend.buddy ? "训练搭子" : "好友").navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
            .task(id: "\(spotterDay(date)):\(loadRevision)") { await load() }
            .sheet(isPresented: $showDatePicker) {
                SecondaryFriendDateSheet(day: date, firstDay: Self.firstDay, apply: selectDay)
            }
            .sheet(isPresented: $showRemarkEditor) {
                SecondaryFriendRemarkEditor(remarks: remarks, friendID: friend.id, nickname: friend.name)
            }
            .sheet(isPresented: $showAppointments) {
                SecondaryBuddyAppointments(api: api, owner: owner, buddyID: friend.id, buddyName: displayName)
            }
            .confirmationDialog("移除好友", isPresented: $showRemove, titleVisibility: .visible) {
                Button("确认移除", role: .destructive) { Task { await mutate(["action": "remove", "id": friend.id], remove: true) } }
                Button("取消", role: .cancel) {}
            } message: { Text("移除后，你和\(displayName)在好友页的分享会停止。") }
    }

    private var profileCard: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
            : AnyLayout(HStackLayout(spacing: 10))
        return VStack(alignment: .leading, spacing: 10) {
            layout {
                HStack(spacing: 12) {
                    avatar(displayName, id: friend.id, buddy: friend.buddy, size: 47, circular: true)
                        .overlay { Circle().strokeBorder(accent.tint.opacity(0.18)).allowsHitTesting(false) }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(displayName).font(.title2.weight(.bold)).foregroundStyle(SpotterPalette.ink)
                            .accessibilityAddTraits(.isHeader)
                        if remark != nil {
                            Text("昵称 · \(friend.name)").font(.footnote).foregroundStyle(SpotterPalette.muted)
                        }
                        Text(friend.buddy ? "训练搭子" : "好友").font(.footnote.weight(.medium))
                            .foregroundStyle(accent.tint)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                if friend.buddy { reminderButton }
            }
            Button { showRemarkEditor = true } label: {
                HStack(spacing: 8) {
                    Label(remark == nil ? "添加备注" : "编辑备注", systemImage: "pencil.line")
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                        .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                }
                .padding(.horizontal, 11).frame(minHeight: 44)
                .background(SpotterPalette.card.opacity(0.65), in: RoundedRectangle(cornerRadius: 11))
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("friend-remark-edit")
            if let reminderError { SecondaryNotice(message: reminderError, warning: true) }
        }
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: 19).fill(
                LinearGradient(colors: [accent.selection, SpotterPalette.card], startPoint: .topLeading, endPoint: .bottomTrailing)
            )
        }
        .overlay { RoundedRectangle(cornerRadius: 19).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
    }

    private var reminderButton: some View {
        Button { Task { await remindBuddy() } } label: {
            HStack(spacing: 6) {
                if reminderSending { ProgressView().controlSize(.small).accessibilityHidden(true) }
                else { Image(systemName: reminderSent ? "checkmark" : "bell.badge").accessibilityHidden(true) }
                Text(reminderSent ? "提醒已发送" : "提醒训练")
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .buttonStyle(SecondaryButtonStyle(primary: !reminderSent))
        .disabled(reminderSending || reminderSent)
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("活动记录").font(.headline).accessibilityAddTraits(.isHeader)
            dayNavigation
            if let record {
                if record.restricted == true {
                    activityNote("这一天的记录未开放查看。", symbol: "lock")
                } else {
                    dailyRecords(record)
                }
            } else if let loadError {
                SecondaryNotice(message: loadError, warning: true)
                Button("重新读取") { loadRevision += 1 }.buttonStyle(.spotterControl)
            } else {
                ProgressView("正在读取当天记录…").font(.footnote).tint(accent.tint)
                    .frame(maxWidth: .infinity, minHeight: 70)
            }
        }
        .padding(14)
        .secondaryCard(radius: 19)
        .animation(motion, value: record != nil)
    }

    private var dayNavigation: some View {
        HStack(spacing: 2) {
            dayStep(-1, name: "前一天", symbol: "chevron.left", disabled: date <= Self.firstDay)
            Button { showDatePicker = true } label: {
                HStack(spacing: 7) {
                    Image(systemName: "calendar").foregroundStyle(accent.tint).accessibilityHidden(true)
                    Text(dayLabel).multilineTextAlignment(.center)
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                        .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(SpotterPalette.ink)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("好友记录日期")
            .accessibilityValue(dayLabel)
            dayStep(1, name: "后一天", symbol: "chevron.right", disabled: date >= SecondaryDate.today)
        }
        .padding(2)
        .background(accent.selection.opacity(0.6), in: RoundedRectangle(cornerRadius: 13))
    }

    private var dayLabel: String {
        let calendar = SecondaryDate.calendar
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = parts.year, let month = parts.month, let day = parts.day else { return spotterDay(date) }
        let shortDate = "\(month)月\(day)日"
        if date == SecondaryDate.today { return "今天 · \(shortDate)" }
        return year == calendar.component(.year, from: SecondaryDate.today) ? shortDate : "\(year)年\(shortDate)"
    }

    private func dayStep(_ direction: Int, name: String, symbol: String, disabled: Bool) -> some View {
        Button { selectDay(SecondaryDate.shift(date, direction)) } label: {
            Image(systemName: symbol).font(.footnote.weight(.bold))
                .foregroundStyle(SpotterPalette.ink).opacity(disabled ? 0.35 : 1)
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(name)
        .disabled(disabled)
    }

    private func selectDay(_ selection: Date) {
        let next = SecondaryDate.calendar.startOfDay(for: selection)
        guard next != date else { return }
        record = nil
        loadError = nil
        date = next
    }

    private func remindBuddy() async {
        guard friend.buddy, !reminderSending, !reminderSent else { return }
        reminderSending = true
        reminderError = nil
        defer { reminderSending = false }
        do {
            try await notifications.sendReminder(to: friend.id, owner: owner)
            reminderSent = true
        } catch {
            reminderError = error.localizedDescription
        }
    }

    private func dailyRecords(_ record: Record) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            activityHeader("训练", icon: "dumbbell", color: accent.selection,
                           status: record.workoutCheckin ? "已打卡" : "未打卡", complete: record.workoutCheckin)
            if let training = record.training {
                ForEach(Array(training.enumerated()), id: \.offset) { _, workout in
                    if workout["exercises"].array.isEmpty {
                        workoutHeader(workout).padding(10)
                            .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 10))
                    } else {
                        SpotterDisclosure {
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
                        } label: { workoutHeader(workout).padding(.vertical, 6) }
                    }
                }
            } else { activityNote("训练详情未共享", symbol: "lock") }

            Divider()

            activityHeader("饮食", icon: "fork.knife", color: secondaryTeal,
                           status: record.dietCheckin.map { $0 ? "已记录" : "未记录" }, complete: record.dietCheckin == true)
            if let nutrition = record.nutrition {
                ForEach(Array(nutrition.enumerated()), id: \.offset) { _, meal in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(meal["meal"].string) · \(meal["name"].string)").font(.subheadline.weight(.semibold))
                        Text("\(statNumber(meal["calories"].number)) kcal · 蛋白质 \(statNumber(meal["protein"].number)) g")
                            .font(.caption).foregroundStyle(SpotterPalette.muted)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 3)
                }
            } else { activityNote("饮食详情未共享", symbol: "lock") }
        }
    }

    private func activityHeader(_ title: String, icon: String, color: Color, status: String?, complete: Bool) -> some View {
        HStack(spacing: 9) {
            SecondaryTile(icon: icon, color: color, size: 32)
            Text(title).font(.subheadline.weight(.semibold)).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            if let status { SecondaryBadge(text: status, green: complete) }
        }
    }

    private func activityNote(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.footnote).foregroundStyle(SpotterPalette.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func workoutHeader(_ workout: NativeJSON) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workout["title"].string).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
            Text("\(Int(workout["minutes"].number)) 分钟 · \(Int(workout["sets"].number)) 组").font(.caption).foregroundStyle(SpotterPalette.muted)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sharingCard(_ value: SecondaryFriend.Sharing) -> some View {
        SpotterDisclosure {
            VStack(alignment: .leading, spacing: 5) {
                if !friend.buddy {
                    SecondaryToggle(title: "训练详情", detail: "已完成的动作、组数、重量和次数", value: shareValue(\.training))
                }
                SecondaryToggle(title: friend.buddy ? "饮食记录与详情" : "饮食记录状态",
                                detail: friend.buddy ? "餐次、食物、克数和营养" : "当天有没有记录餐食", value: shareValue(\.nutrition))
                if !friend.buddy {
                    SecondaryToggle(title: "饮食详情", detail: value.nutrition ? "餐次、食物、克数和营养" : "先开启饮食记录状态", value: shareValue(\.nutritionDetails))
                        .disabled(!value.nutrition)
                }
                Button {
                    Task { await mutate(["action": "share", "id": friend.id, "sharing": value.body]) }
                } label: {
                    Text("保存分享范围").frame(maxWidth: .infinity)
                }
                .buttonStyle(.spotterPrimaryControl).disabled(busy || value == saved)
            }
            .padding(.horizontal, 5).padding(.bottom, 4)
            .disabled(busy)
        } label: {
            HStack(spacing: 8) {
                SecondaryTile(icon: "lock", color: secondaryLilac, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text("我共享的内容").font(.subheadline.weight(.semibold))
                    Text(value == saved ? sharingSummary(saved ?? value) : "有未保存的改动")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }.padding(.vertical, 5)
        }
        .padding(6).secondaryCard(radius: 16)
    }

    private func sharingSummary(_ value: SecondaryFriend.Sharing) -> String {
        if friend.buddy { return value.nutrition ? "已共享饮食记录与详情" : "饮食记录未共享" }
        let types = [value.training ? "训练详情" : nil,
                     value.nutrition ? (value.nutritionDetails ? "饮食详情" : "饮食记录状态") : nil].compactMap { $0 }
        return types.isEmpty ? "详情未共享" : types.joined(separator: " · ")
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
        loadError = nil
        let day = spotterDay(date)
        do {
            let path = friendPath([URLQueryItem(name: "friend", value: friend.id), URLQueryItem(name: "date", value: day)])
            let next = try await api.spotterRead(path, as: Record.self)
            if !Task.isCancelled && day == spotterDay(date) { record = next }
        } catch is CancellationError { }
        catch let reason as URLError where reason.code == .cancelled { }
        catch { if !Task.isCancelled && day == spotterDay(date) { loadError = error.localizedDescription } }
    }

    private func mutate(_ body: [String: Any], remove: Bool = false) async {
        guard !busy else { return }
        busy = true
        actionError = nil
        defer { busy = false }
        do {
            let response = try await api.spotterSend(listPath, body: body)
            if let refreshed = try JSONDecoder().decode(SecondaryFriendList.self, from: response).friends.first(where: { $0.id == friend.id }) {
                saved = refreshed.sharing
                sharing = refreshed.sharing
            }
            if remove {
                avatars.forgetPeer(friend.id)
                remarks.forget(friend.id)
            }
            await changed()
            if remove { dismiss() }
        } catch { actionError = error.localizedDescription }
    }
}

@MainActor
private struct SecondaryFriendRemarkEditor: View {
    @Environment(\.dismiss) private var dismiss
    let remarks: NativeSocialRemarks
    let friendID: String
    let nickname: String
    private let previous: String
    @State private var draft: String
    @State private var busy = false
    @State private var problem: String?

    init(remarks: NativeSocialRemarks, friendID: String, nickname: String) {
        self.remarks = remarks
        self.friendID = friendID
        self.nickname = nickname
        let previous = remarks.remark(for: friendID) ?? ""
        self.previous = previous
        self._draft = State(initialValue: previous)
    }

    private var title: String { previous.isEmpty ? "添加备注" : "编辑备注" }
    private var candidate: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var length: Int { candidate.unicodeScalars.count }
    private var validLength: Bool { length <= NativeSocialRemarks.maximumLength }
    private var singleLine: Bool { candidate.rangeOfCharacter(from: .newlines) == nil }
    private var canSave: Bool { !busy && validLength && singleLine && candidate != previous }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("昵称 · \(nickname)").font(.footnote).foregroundStyle(SpotterPalette.muted)
                    TextField("姓名或称呼", text: $draft)
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.done)
                        .onSubmit { if canSave { Task { await save(candidate) } } }
                        .accessibilityIdentifier("friend-remark-name")
                        .disabled(busy)
                    HStack(alignment: .top, spacing: 6) {
                        Text("备注仅你可见。清空后显示对方昵称。")
                        Spacer(minLength: 4)
                        Text("\(length)/\(NativeSocialRemarks.maximumLength)").monospacedDigit()
                            .foregroundStyle(validLength ? SpotterPalette.muted : .red)
                    }.font(.footnote).foregroundStyle(SpotterPalette.muted)
                    if !singleLine { SecondaryNotice(message: "备注请写在一行内。", warning: true) }
                    if let problem { SecondaryNotice(message: problem, warning: true) }
                    if !previous.isEmpty {
                        Button("移除备注", role: .destructive) { Task { await save("") } }
                            .buttonStyle(.spotterPress).foregroundStyle(.red).frame(minHeight: 44).disabled(busy)
                    }
                }.padding(14).secondaryCard().padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "保存中" : "保存") { Task { await save(candidate) } }.disabled(!canSave)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func save(_ value: String) async {
        guard !busy else { return }
        busy = true
        problem = nil
        defer { busy = false }
        do {
            try await remarks.save(value, for: friendID)
            dismiss()
        } catch { problem = error.localizedDescription }
    }
}

private struct SecondaryFriendDateSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State var day: Date
    let firstDay: Date
    let apply: (Date) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                DatePicker("好友记录日期", selection: $day, in: firstDay...SecondaryDate.today, displayedComponents: .date)
                    .datePickerStyle(.graphical).labelsHidden()
                    .environment(\.calendar, SecondaryDate.calendar)
                    .environment(\.locale, Locale(identifier: "zh_CN"))
                    .tint(accent.tint)
                    .padding(8).secondaryCard(radius: 19).secondaryPage()
            }
            .background(SpotterPalette.background)
            .navigationTitle("选择日期").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") {
                        apply(day)
                        dismiss()
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
    }
}
