import SwiftUI
import UIKit

struct SpotterControlButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    var primary = false
    var glass = false

    @ViewBuilder func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        let label = configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(configuration.role == .destructive ? Color.red : (primary ? SpotterPalette.deep : SpotterPalette.ink))
            .padding(.horizontal, 11)
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(shape)
        Group {
            if #available(iOS 26.0, *), glass, enabled, motion != nil {
                label.spotterGlass(in: shape)
            } else {
                Group {
                    if glass {
                        label.spotterGlass(in: shape, interactive: false)
                    } else {
                        label.background(primary ? accent.fill : SpotterPalette.background, in: shape)
                            .overlay { shape.strokeBorder(primary ? .clear : SpotterPalette.line).allowsHitTesting(false) }
                    }
                }
                .spotterPressFeedback(configuration.isPressed)
            }
        }
        .opacity(enabled ? 1 : 0.56)
    }
}

extension ButtonStyle where Self == SpotterControlButtonStyle {
    static var spotterControl: Self { .init() }
    static var spotterPrimaryControl: Self { .init(primary: true) }
    static var spotterGlassControl: Self { .init(glass: true) }
}

struct SpotterChoiceStyle: ButtonStyle {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.isEnabled) private var enabled
    let selected: Bool
    var horizontalPadding: CGFloat = 10
    var minimumWidth: CGFloat = 44

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        configuration.label
            .foregroundStyle(selected ? SpotterPalette.ink : SpotterPalette.muted)
            .padding(.horizontal, horizontalPadding)
            .frame(minWidth: minimumWidth, minHeight: 44)
            .background(selected ? accent.selection : SpotterPalette.background.opacity(0.76), in: shape)
            .contentShape(shape)
            .spotterPressFeedback(configuration.isPressed)
            .opacity(enabled ? 1 : 0.56)
    }
}

struct SpotterWeekDateStrip: View {
    static let expandedHeight: CGFloat = 64
    static let compactHeight: CGFloat = 44

    struct Day: Identifiable {
        let date: Date
        var progress: Double = 0
        let accessibilityStatus: String
        var isEnabled = true
        var showsMarker = false
        var secondaryProgress: Double? = nil

        var id: Date { date }
    }

    let days: [Day]
    let selection: Date
    var ringPalette: SpotterProgressRingPalette = .training
    var compression: CGFloat? = nil
    let onSelect: (Date) -> Void

    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @ScaledMetric(relativeTo: .footnote) private var ringSize = 34.0

    nonisolated private static var localCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar
    }

    nonisolated static func dates(containing date: Date) -> [Date] {
        let calendar = localCalendar
        let offset = (calendar.component(.weekday, from: date) + 5) % 7
        guard let monday = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: date)) else { return [] }
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    var body: some View {
        let calendar = Self.localCalendar
        HStack(spacing: 2) {
            ForEach(days) { day in
                dayButton(day, calendar: calendar)
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    }

    private func dayButton(_ day: Day, calendar: Calendar) -> some View {
        let selected = calendar.isDate(day.date, inSameDayAs: selection)
        let today = calendar.isDateInToday(day.date)
        let weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][calendar.component(.weekday, from: day.date) - 1]
        let progress = compression ?? 0
        let expansion = 1 - progress
        let diameter = min(ringSize, 34) - 8 * progress
        let height = compression.map { _ in Self.compactHeight + (Self.expandedHeight - Self.compactHeight) * expansion }
        return Button { onSelect(day.date) } label: {
            VStack(spacing: 4 * expansion) {
                Text(weekday)
                    .font(.caption2.weight(selected ? .bold : .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .foregroundStyle(selected ? accent.tint : SpotterPalette.muted)
                    .frame(height: compression.map { _ in 15 * expansion }, alignment: .top)
                    .clipped()
                    .opacity(expansion)
                ZStack {
                    SpotterDayProgressRings(primary: day.progress, secondary: day.secondaryProgress,
                                            primaryPalette: ringPalette, size: diameter)
                    Text(calendar.component(.day, from: day.date), format: .number)
                        .font(.subheadline.weight(selected || today ? .bold : .semibold).monospacedDigit())
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                        .foregroundStyle(SpotterPalette.ink)
                        .frame(width: max(1, diameter - (day.secondaryProgress == nil ? 8 : 13 - 4 * progress)))
                }
                HStack(spacing: 3) {
                    if today { Circle().fill(accent.tint).frame(width: 4, height: 4) }
                    if day.showsMarker { Circle().strokeBorder(accent.tint, lineWidth: 1).frame(width: 4, height: 4) }
                }
                .frame(height: 4 * expansion)
                .clipped()
                .opacity(expansion)
                .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, minHeight: height == nil ? 56 : nil)
            .padding(.vertical, height == nil ? 4 : 0)
            .frame(height: height)
            .background(selected ? accent.selection : .clear, in: Capsule())
            .contentShape(Rectangle())
            .animation(motion, value: selected)
        }
        .buttonStyle(.spotterPress)
        .disabled(!day.isEnabled)
        .accessibilityLabel("\(spotterDay(day.date))，\(weekday)\(today ? "，今天" : "")")
        .accessibilityValue(day.accessibilityStatus)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("spotter-week-day-\(spotterDay(day.date))")
    }
}

enum SpotterProgressRingPalette {
    case training, nutrition

    var tint: Color {
        switch self {
        case .training: return SpotterPalette.accent
        case .nutrition: return SpotterPalette.color(0xb2dbf7)
        }
    }

    var track: Color { tint.opacity(0.22) }
}

struct SpotterDayProgressRings: View {
    let primary: Double
    let secondary: Double?
    let primaryPalette: SpotterProgressRingPalette
    var size: CGFloat = 34

    @Environment(\.spotterInteractionMotion) private var motion

    var body: some View {
        let outerWidth = secondary == nil ? min(size * 0.09, 3) : min(size * 0.08, 2.75)
        let innerWidth = min(size * 0.06, 2)
        return ZStack {
            arc(primary, palette: primaryPalette, lineWidth: outerWidth, inset: outerWidth / 2)
            if let secondary {
                arc(secondary, palette: .nutrition, lineWidth: innerWidth,
                    inset: outerWidth + size * 0.04 + innerWidth / 2)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }

    private func arc(_ value: Double, palette: SpotterProgressRingPalette, lineWidth: CGFloat, inset: CGFloat) -> some View {
        let progress = value.isFinite ? min(max(value, 0), 1) : 0
        let circle = Circle().inset(by: inset)
        return ZStack {
            circle.stroke(palette.track, lineWidth: lineWidth * 0.75)
            circle
                .trim(from: 0, to: progress)
                .stroke(palette.tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .opacity(progress > 0 ? 1 : 0)
        }
        .animation(motion == nil ? nil : .easeOut(duration: 0.22), value: progress)
    }
}

struct SpotterWeekNavigation: View {
    @Environment(\.spotterAccent) private var accent

    let selection: Date
    let calendarLabel: String
    var canGoBack = true
    var canGoForward = true
    var compactDays = false
    let onMove: (Int) -> Void
    var onOpenCalendar: (() -> Void)? = nil

    private var dateLabel: String {
        let calendar = Calendar(identifier: .gregorian)
        if compactDays, calendar.isDateInToday(selection) { return "今天" }
        let parts = calendar.dateComponents([.year, .month, .day], from: selection)
        guard let year = parts.year, let month = parts.month, let day = parts.day else { return spotterDay(selection) }
        let short = "\(month)月\(day)日"
        return year == calendar.component(.year, from: .now) ? short : "\(year)年\(short)"
    }

    var body: some View {
        HStack(spacing: 0) {
            arrow(compactDays ? "前一天" : "上一周", icon: "chevron.left", offset: -1, enabled: canGoBack)
            if let onOpenCalendar {
                Button(action: onOpenCalendar) {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accent.tint)
                        dateText
                    }
                    .padding(.horizontal, 2)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .accessibilityLabel("\(calendarLabel)，\(spotterDay(selection))")
            } else {
                dateText
                    .padding(.horizontal, 2)
                    .frame(minWidth: 72, minHeight: 44)
                    .accessibilityLabel(calendarLabel)
                    .accessibilityValue(spotterDay(selection))
                    .accessibilityIdentifier("spotter-home-date-label")
            }
            arrow(compactDays ? "后一天" : "下一周", icon: "chevron.right", offset: 1, enabled: canGoForward)
        }
        .background {
            Capsule()
                .fill(compactDays ? SpotterPalette.card : SpotterPalette.background)
                .overlay {
                    if compactDays { Capsule().strokeBorder(SpotterPalette.line) }
                }
                .frame(height: compactDays ? 34 : nil)
                .allowsHitTesting(false)
        }
        .buttonStyle(.spotterPress)
    }

    private var dateText: some View {
        Text(dateLabel)
            .font((compactDays ? Font.footnote : .subheadline).weight(.semibold).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    private func arrow(_ name: String, icon: String, offset: Int, enabled: Bool) -> some View {
        Button { onMove(offset) } label: {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(accent.tint)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(name)
        .disabled(!enabled)
    }
}

struct SpotterWeekCalendarSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Binding var selection: Date
    let title: String
    var bounds: ClosedRange<Date>? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                Group {
                    if let bounds {
                        DatePicker(title, selection: $selection, in: bounds, displayedComponents: .date)
                    } else {
                        DatePicker(title, selection: $selection, displayedComponents: .date)
                    }
                }
                .datePickerStyle(.graphical)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "zh_CN"))
                .padding(12)
                .spotterCard()
                .padding(14)
            }
            .background(SpotterPalette.background)
            .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }
        .tint(accent.tint)
        .presentationDragIndicator(.visible)
        .onChange(of: spotterDay(selection)) { _ in dismiss() }
    }
}

extension View {
    func spotterGlassCluster(spacing: CGFloat = 4) -> some View {
        SpotterGlassGroup(spacing: spacing) { self }
    }

    func spotterGlassToolbar() -> some View {
        padding(4).spotterGlass(cornerRadius: 26, interactive: false)
    }

    @ViewBuilder func spotterSwipeToDelete(id: String, openRow: Binding<String?>,
                                          accessibilityLabel: String = "删除", action: @escaping () -> Void) -> some View {
        if #available(iOS 18.0, *) {
            modifier(SpotterSwipeDelete(id: id, openRow: openRow, deleteLabel: accessibilityLabel, action: action))
        } else { self }
    }
}

@available(iOS 18.0, *)
private struct SpotterSwipeDelete: ViewModifier {
    @Environment(\.layoutDirection) private var layoutDirection
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var drag: CGFloat?
    let id: String
    @Binding var openRow: String?
    let deleteLabel: String
    let action: () -> Void

    private let actionWidth: CGFloat = 66
    private var isOpen: Bool { openRow == id }
    /// Swipe toward the leading edge (left in Chinese/English) to reveal 删除 on the trailing edge, like iOS lists.
    private var direction: CGFloat { layoutDirection == .leftToRight ? -1 : 1 }
    private var reveal: CGFloat { min(actionWidth, max(0, (isOpen ? actionWidth : 0) + (drag ?? 0))) }

    func body(content: Content) -> some View {
        content
            .offset(x: direction * reveal)
            .background(alignment: .trailing) {
                Group {
                    if isOpen {
                        Button(role: .destructive, action: delete) { actionLabel }
                            .buttonStyle(.spotterPress)
                            .accessibilityLabel(deleteLabel)
                            .accessibilityIdentifier("spotter-swipe-delete-\(id)")
                    } else if reveal > 0 {
                        actionLabel.accessibilityHidden(true).allowsHitTesting(false)
                    }
                }
                .offset(x: direction * (reveal - actionWidth))
            }
            .clipped()
            .contentShape(Rectangle())
            .gesture(SpotterHorizontalPan(
                onDrag: { drag = direction * $0 },
                onEnd: { distance in
                    if let distance { settle(direction * distance) }
                    drag = nil
                }
            ))
            .animation(drag == nil ? motion : nil, value: isOpen)
            .animation(drag == nil ? motion : nil, value: drag == nil)
            .accessibilityElement(children: .contain)
            .accessibilityAction(named: Text(deleteLabel), delete)
    }

    private var actionLabel: some View {
        VStack(spacing: 3) {
            Image(systemName: "trash").accessibilityHidden(true)
            Text("删除").lineLimit(1).minimumScaleFactor(0.6)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.white)
        .frame(width: actionWidth)
        .frame(maxHeight: .infinity)
        .background(.red, in: RoundedRectangle(cornerRadius: 10))
        .contentShape(Rectangle())
    }

    private func settle(_ distance: CGFloat) {
        if distance > actionWidth / 2 { openRow = id }
        if distance < -actionWidth / 2, isOpen { openRow = nil }
    }

    private func delete() {
        openRow = nil
        action()
    }
}

@available(iOS 18.0, *)
private struct SpotterHorizontalPan: UIGestureRecognizerRepresentable {
    let onDrag: (CGFloat) -> Void
    let onEnd: (CGFloat?) -> Void

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ gesture: UIGestureRecognizer) -> Bool {
            guard let pan = gesture as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: pan.view?.window)
            return abs(velocity.x) > abs(velocity.y)
        }

        func gestureRecognizer(_ gesture: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith otherGesture: UIGestureRecognizer) -> Bool {
            otherGesture is UIPanGestureRecognizer && otherGesture.view is UIScrollView
        }
    }

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.maximumNumberOfTouches = 1
        pan.delegate = context.coordinator
        return pan
    }

    func handleUIGestureRecognizerAction(_ pan: UIPanGestureRecognizer, context: Context) {
        let distance = pan.translation(in: pan.view?.window).x
        switch pan.state {
        case .began, .changed: onDrag(distance)
        case .ended: onEnd(distance)
        case .failed, .cancelled: onEnd(nil)
        default: break
        }
    }
}

struct SpotterSegments<Option: Hashable>: View {
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(\.spotterGuide) private var guide
    @Binding private var value: Option

    private let label: String
    private let options: [Option]
    private let title: (Option) -> String
    private let guideTarget: (Option) -> NativeGuideStep?
    private let usesUIKitControl: Bool

    init(_ label: String, options: [Option], value: Binding<Option>,
         usesUIKitControl: Bool = false,
         guideTarget: @escaping (Option) -> NativeGuideStep? = { _ in nil },
         title: @escaping (Option) -> String) {
        self.label = label
        self.options = options
        _value = value
        self.usesUIKitControl = usesUIKitControl
        self.guideTarget = guideTarget
        self.title = title
    }

    var body: some View {
        let target = options.compactMap(guideTarget).first
        let picker = Picker(label, selection: $value) {
            ForEach(options, id: \.self) { option in
                Text(title(option)).tag(option)
            }
        }

        Group {
            if options.count > 5 || textSize.isAccessibilitySize {
                picker.pickerStyle(.menu)
            } else if usesUIKitControl {
                SpotterUIKitSegments(label: label, options: options, titles: options.map(title), value: $value)
            } else {
                picker.pickerStyle(.segmented).labelsHidden()
            }
        }
        .frame(minHeight: 44)
        .nativeGuideTarget(target)
        .onChange(of: value) { option in
            if let step = guideTarget(option), guide?.step == step { guide?.advance(step) }
        }
    }
}

private struct SpotterUIKitSegments<Option: Hashable>: UIViewRepresentable {
    @Environment(\.isEnabled) private var isEnabled
    let label: String
    let options: [Option]
    let titles: [String]
    @Binding var value: Option

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UISegmentedControl {
        let control = UISegmentedControl(items: titles)
        control.addTarget(context.coordinator, action: #selector(Coordinator.selectionChanged(_:)), for: .valueChanged)
        return control
    }

    func updateUIView(_ control: UISegmentedControl, context: Context) {
        context.coordinator.select = { index in
            guard options.indices.contains(index) else { return }
            value = options[index]
        }
        control.accessibilityLabel = label
        control.isEnabled = isEnabled

        if control.numberOfSegments != titles.count {
            control.removeAllSegments()
            for (index, title) in titles.enumerated() { control.insertSegment(withTitle: title, at: index, animated: false) }
        } else {
            for (index, title) in titles.enumerated() where control.titleForSegment(at: index) != title {
                control.setTitle(title, forSegmentAt: index)
            }
        }
        let selected = options.firstIndex(of: value) ?? UISegmentedControl.noSegment
        if control.selectedSegmentIndex != selected { control.selectedSegmentIndex = selected }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UISegmentedControl, context: Context) -> CGSize? {
        CGSize(width: proposal.width ?? uiView.intrinsicContentSize.width, height: 44)
    }

    final class Coordinator: NSObject {
        var select: (Int) -> Void = { _ in }

        @objc func selectionChanged(_ control: UISegmentedControl) {
            select(control.selectedSegmentIndex)
        }
    }
}

struct SpotterMenu<Items: View, Label: View>: View {
    let items: Items
    let label: Label
    let glass: Bool

    init(glass: Bool = false, @ViewBuilder content: () -> Items, @ViewBuilder label: () -> Label) {
        self.items = content()
        self.label = label()
        self.glass = glass
    }

    var body: some View {
        Menu { items } label: { label }
            .buttonStyle(glass ? .spotterGlassControl : .spotterControl)
    }
}

struct SpotterPickerLabel: View {
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 8) {
            Text(title).font(.subheadline)
            Spacer(minLength: 4)
            Text(value).font(.subheadline.weight(.semibold)).multilineTextAlignment(.trailing)
            Image(systemName: "chevron.up.chevron.down").font(.caption2.weight(.bold))
                .foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
        }
    }
}

struct SpotterMenuPicker<Value: Hashable, Label: View>: View {
    @Binding private var selection: Value

    private let title: String
    private let options: [(Value, String)]
    private let label: Label

    init(_ title: String, selection: Binding<Value>, options: [(Value, String)], @ViewBuilder label: () -> Label) {
        self.title = title
        _selection = selection
        self.options = options
        self.label = label()
    }

    var body: some View {
        SpotterMenu {
            Picker(title, selection: $selection) {
                ForEach(options, id: \.0) { value, title in
                    Text(title).tag(value)
                }
            }
            .pickerStyle(.inline)
        } label: {
            label
        }
        .accessibilityLabel(title)
        .accessibilityValue(options.first { $0.0 == selection }?.1 ?? "")
    }
}

extension SpotterMenuPicker where Label == SpotterPickerLabel {
    init(_ title: String, selection: Binding<Value>, options: [(Value, String)]) {
        self.init(title, selection: selection, options: options) {
            SpotterPickerLabel(title: title, value: options.first { $0.0 == selection.wrappedValue }?.1 ?? "未选择")
        }
    }
}

struct SpotterDisclosure<Content: View, Label: View>: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var expanded = false

    let content: Content
    let label: Label

    init(@ViewBuilder content: () -> Content, @ViewBuilder label: () -> Label) {
        self.content = content()
        self.label = label()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                withAnimation(motion) { expanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    label
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.bold))
                        .rotationEffect(.degrees(expanded ? 90 : 0))
                        .foregroundStyle(accent.tint)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 9)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .background(accent.selection.opacity(expanded ? 0.76 : 0.40), in: RoundedRectangle(cornerRadius: 10))
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .foregroundStyle(SpotterPalette.ink)
            .accessibilityValue(expanded ? "已展开" : "已收起")
            .accessibilityHint(expanded ? "收起内容" : "展开内容")

            if expanded {
                VStack(alignment: .leading, spacing: 8) { content }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity)
            }
        }
    }
}

extension SpotterDisclosure where Label == Text {
    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.init(content: content) { Text(title).font(.subheadline.weight(.semibold)) }
    }
}
