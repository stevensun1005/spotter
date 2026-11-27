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

    init(_ label: String, options: [Option], value: Binding<Option>,
         guideTarget: @escaping (Option) -> NativeGuideStep? = { _ in nil },
         title: @escaping (Option) -> String) {
        self.label = label
        self.options = options
        _value = value
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
