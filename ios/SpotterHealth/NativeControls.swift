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
    private var direction: CGFloat { layoutDirection == .leftToRight ? 1 : -1 }
    private var reveal: CGFloat { min(actionWidth, max(0, (isOpen ? actionWidth : 0) + (drag ?? 0))) }

    func body(content: Content) -> some View {
        content
            .offset(x: direction * reveal)
            .background(alignment: .leading) {
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

struct SpotterGlassSegments<Option: Hashable>: View {
    let options: [Option]
    @Binding var value: Option
    let title: (Option) -> String
    let glass: Bool
    let guideTarget: (Option) -> NativeGuideStep?
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(\.isEnabled) private var enabled
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var selection

    init(options: [Option], value: Binding<Option>, glass: Bool = true,
         guideTarget: @escaping (Option) -> NativeGuideStep? = { _ in nil },
         title: @escaping (Option) -> String) {
        self.options = options
        _value = value
        self.glass = glass
        self.guideTarget = guideTarget
        self.title = title
    }

    @ViewBuilder var body: some View {
        if glass {
            SpotterGlassGroup(spacing: 5) { buttons }
                .spotterGlassToolbar()
        } else {
            buttons.padding(3)
                .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var buttons: some View {
        let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 3)) : AnyLayout(HStackLayout(spacing: 3))
        return layout {
            ForEach(options, id: \.self) { option in
                let selected = option == value
                Button {
                    if !selected { value = option }
                    if let target = guideTarget(option) { guide?.advance(target) }
                } label: {
                    label(for: option, selected: selected)
                }
                .buttonStyle(glass && selected ? .spotterGlassPress : .spotterPress)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .nativeGuideTarget(guideTarget(option))
            }
        }
        .animation(motion, value: value)
    }

    @Environment(\.spotterGuide) private var guide

    @ViewBuilder private func label(for option: Option, selected: Bool) -> some View {
        let label = Text(title(option))
            .font(.caption.weight(selected ? .bold : .semibold))
            .lineLimit(textSize.isAccessibilitySize ? 2 : 1)
            .minimumScaleFactor(0.76)
            .multilineTextAlignment(.center)
            .foregroundStyle(selected ? SpotterPalette.ink : SpotterPalette.muted)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Capsule())

        if !selected {
            label
        } else if glass, #available(iOS 26.0, *) {
            label
                .glassEffect(.regular.tint(accent.fill.opacity(colorScheme == .dark ? 0.30 : 0.46))
                    .interactive(enabled && motion != nil), in: Capsule())
                .glassEffectID("selection", in: selection)
        } else {
            label.background {
                Capsule().fill(accent.selection)
                    .matchedGeometryEffect(id: "selection", in: selection)
            }
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
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var dynamicType
    @Binding private var selection: Value
    @State private var expanded = false

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
        if #available(iOS 16.4, *) {
            Button { expanded = true } label: { label }
                .buttonStyle(.spotterControl)
                .accessibilityLabel(title)
                .accessibilityValue(currentTitle)
                .popover(isPresented: $expanded) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(title).font(.caption.weight(.semibold))
                            .foregroundStyle(SpotterPalette.muted)
                            .padding(.horizontal, 9)
                            .accessibilityAddTraits(.isHeader)
                        if options.count > 5 || dynamicType.isAccessibilitySize {
                            ScrollView { choices }.frame(maxHeight: 275)
                        } else {
                            choices
                        }
                    }
                    .padding(11)
                    .frame(idealWidth: 268, maxWidth: 290)
                    .presentationCompactAdaptation(.popover)
                }
        } else {
            SpotterMenu {
                ForEach(options, id: \.0) { value, title in
                    Button { choose(value) } label: {
                        if value == selection { SwiftUI.Label(title, systemImage: "checkmark") }
                        else { Text(title) }
                    }
                }
            } label: { label }
            .accessibilityLabel(title)
            .accessibilityValue(currentTitle)
        }
    }

    private var currentTitle: String { options.first { $0.0 == selection }?.1 ?? "" }

    private var choices: some View {
        LazyVStack(alignment: .leading, spacing: 3) {
            ForEach(options, id: \.0) { value, title in
                let selected = value == selection
                Button { choose(value) } label: {
                    HStack(spacing: 10) {
                        Text(title).font(.subheadline.weight(selected ? .semibold : .regular))
                        Spacer(minLength: 1)
                        if selected {
                            Image(systemName: "checkmark").font(.caption.weight(.bold))
                                .foregroundStyle(accent.tint).accessibilityHidden(true)
                        }
                    }
                    .foregroundStyle(SpotterPalette.ink)
                    .padding(.horizontal, 10)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .background(selected ? accent.selection : .clear, in: RoundedRectangle(cornerRadius: 10))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }

    private func choose(_ value: Value) {
        withAnimation(motion) { selection = value }
        expanded = false
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
