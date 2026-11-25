import SwiftUI

struct SpotterControlButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(configuration.role == .destructive ? Color.red : SpotterPalette.ink)
            .padding(.horizontal, 11)
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .spotterGlass(cornerRadius: 13, tint: accent.selection.opacity(0.38), interactive: enabled && motion != nil)
            .spotterPressFeedback(configuration.isPressed)
            .opacity(enabled ? 1 : 0.56)
    }
}

extension ButtonStyle where Self == SpotterControlButtonStyle {
    static var spotterControl: Self { .init() }
}

struct SpotterMenu<Items: View, Label: View>: View {
    let items: Items
    let label: Label

    init(@ViewBuilder content: () -> Items, @ViewBuilder label: () -> Label) {
        self.items = content()
        self.label = label()
    }

    var body: some View {
        Menu { items } label: { label }
            .buttonStyle(.spotterControl)
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
