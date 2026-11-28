import SwiftUI

enum NativeWorkoutExerciseAction: String {
    case detail, rest, reorder, replace, delete

    var title: String {
        switch self {
        case .detail: "动作详情"
        case .rest: "设置组间休息"
        case .reorder: "动作排序"
        case .replace: "替换动作"
        case .delete: "删除"
        }
    }

    var symbol: String {
        switch self {
        case .detail: "doc.text.magnifyingglass"
        case .rest: "timer"
        case .reorder: "arrow.up.arrow.down"
        case .replace: "arrow.triangle.swap"
        case .delete: "trash"
        }
    }
}

struct NativeWorkoutExerciseMenu: View {
    @Environment(\.spotterAccent) private var accent
    @ScaledMetric(relativeTo: .subheadline) private var menuWidth: CGFloat = 184
    let title: String
    let index: Int
    let canReplace: Bool
    let canReorder: Bool
    let canDelete: Bool
    let choose: (NativeWorkoutExerciseAction) -> Void
    @State private var showsMenu = false
    @State private var pendingAction: NativeWorkoutExerciseAction?

    var body: some View {
        Group {
            if #available(iOS 16.4, *) {
                compactMenu
            } else {
                Menu {
                    Section {
                        nativeAction(.detail)
                        nativeAction(.rest)
                    }
                    Section {
                        nativeAction(.reorder)
                        nativeAction(.replace)
                    }
                    nativeAction(.delete)
                } label: {
                    gear
                }
                .menuOrder(.fixed)
            }
        }
        .accessibilityLabel("\(title)的动作设置")
        .accessibilityIdentifier("workout-exercise-settings-\(index)")
    }

    private var gear: some View {
        Image(systemName: "gearshape")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(accent.tint)
            .frame(width: 32, height: 32)
            .background(accent.selection, in: Circle())
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
    }

    @available(iOS 16.4, *)
    private var compactMenu: some View {
        Button { showsMenu = true } label: { gear }
            .buttonStyle(.spotterPress)
            .popover(isPresented: $showsMenu, attachmentAnchor: .rect(.bounds), arrowEdge: .trailing) {
                VStack(spacing: 0) {
                    row(.detail)
                    row(.rest)
                    Divider().padding(.horizontal, 12)
                    row(.reorder)
                    row(.replace)
                    Divider().padding(.horizontal, 12)
                    row(.delete)
                }
                .padding(.vertical, 5)
                .frame(width: min(248, menuWidth))
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("workout-exercise-menu")
                .presentationCompactAdaptation(.popover)
                .onDisappear {
                    guard let pendingAction else { return }
                    self.pendingAction = nil
                    Task { @MainActor in choose(pendingAction) }
                }
            }
    }

    private func isEnabled(_ action: NativeWorkoutExerciseAction) -> Bool {
        switch action {
        case .detail, .rest: true
        case .reorder: canReorder
        case .replace: canReplace
        case .delete: canDelete
        }
    }

    private func nativeAction(_ action: NativeWorkoutExerciseAction) -> some View {
        Button(role: action == .delete ? .destructive : nil) { choose(action) } label: {
            Label(action.title, systemImage: action.symbol)
        }
        .disabled(!isEnabled(action))
        .accessibilityIdentifier("workout-exercise-action-\(action.rawValue)")
    }

    private func row(_ action: NativeWorkoutExerciseAction) -> some View {
        Button(role: action == .delete ? .destructive : nil) {
            pendingAction = action
            showsMenu = false
        } label: {
            HStack(spacing: 8) {
                Image(systemName: action.symbol)
                    .foregroundStyle(action == .delete ? Color.red : accent.tint)
                    .frame(width: 21)
                    .accessibilityHidden(true)
                Text(action.title)
                    .foregroundStyle(action == .delete ? Color.red : SpotterPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
            .opacity(isEnabled(action) ? 1 : 0.45)
        }
        .buttonStyle(.spotterPress)
        .disabled(!isEnabled(action))
        .accessibilityIdentifier("workout-exercise-action-\(action.rawValue)")
    }
}

struct NativeWorkoutExerciseRestEditor: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let defaultSeconds: Int
    let save: (Int?) -> Void
    @State private var usesDefault: Bool
    @State private var seconds: String

    init(title: String, seconds: Int?, defaultSeconds: Int, save: @escaping (Int?) -> Void) {
        self.title = title
        self.defaultSeconds = defaultSeconds
        self.save = save
        _usesDefault = State(initialValue: seconds == nil)
        _seconds = State(initialValue: String(seconds ?? defaultSeconds))
    }

    private var duration: Int? {
        guard let value = Int(seconds.trimmingCharacters(in: .whitespacesAndNewlines)),
              (0...NativeWorkoutSession.maximumRestSeconds).contains(value) else { return nil }
        return value
    }

    var body: some View {
        List {
            Section {
                Label(title, systemImage: "dumbbell")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Section {
                Toggle("使用训练默认休息", isOn: $usesDefault)
                    .accessibilityIdentifier("workout-exercise-rest-default")
                if usesDefault {
                    LabeledContent("默认时长", value: "\(defaultSeconds) 秒")
                } else {
                    LabeledContent("休息时长") {
                        HStack(spacing: 6) {
                            TextField("0–\(NativeWorkoutSession.maximumRestSeconds)", text: $seconds)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                                .frame(minWidth: 64, idealWidth: 80, maxWidth: 108)
                                .accessibilityLabel("休息时长，秒")
                                .accessibilityIdentifier("workout-exercise-settings-seconds")
                            Text("秒").foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                        }
                    }
                }
            } footer: {
                Text("设为 0 秒可跳过这个动作的常规组间休息。超级组轮间和换站时间按训练安排计算。")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(NativeWorkoutExerciseAction.rest.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("保存") {
                    save(usesDefault ? nil : duration)
                    dismiss()
                }
                .disabled(!usesDefault && duration == nil)
                .accessibilityIdentifier("workout-exercise-settings-save")
            }
        }
    }
}

struct NativeWorkoutExerciseOrderPanel: View {
    private struct Row: Identifiable {
        let id: String
        let name: String
        let slot: String
    }

    private struct OrderGroup: Identifiable {
        let id: String
        let rows: [Row]
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @ObservedObject var store: NativeWorkoutStore
    let workoutID: String
    let move: (Int, Int) -> Bool
    @State private var rejectedMove = false

    private func rows(for moves: [NativeJSON]) -> [Row] {
        var occurrences: [String: Int] = [:]
        return moves.map { raw in
            let label = NativeExerciseLabel(raw, preservingNameQualifiers: true)
            let key = [label.name, label.slot, raw["catalogueId"].string, raw["station"].string].joined(separator: "\n")
            let occurrence = occurrences[key, default: 0]
            occurrences[key] = occurrence + 1
            return Row(id: "\(key)\n\(occurrence)", name: label.name, slot: label.slot)
        }
    }

    var body: some View {
        let session = store.active?.id == workoutID ? store.active?.session : nil
        let order = session?.exerciseOrderGroups ?? []
        let exerciseRows = rows(for: session?.plan.exercises ?? [])
        let groups = order.compactMap { indexes -> OrderGroup? in
            let members = indexes.map { exerciseRows[$0] }
            return members.first.map { OrderGroup(id: $0.id, rows: members) }
        }
        List {
            Section {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(group.rows) { row in
                            HStack(spacing: 10) {
                                if !row.slot.isEmpty {
                                    Text(row.slot)
                                        .font(.caption.weight(.semibold)).monospacedDigit()
                                        .foregroundStyle(accent.tint)
                                }
                                Text(row.name)
                                    .foregroundStyle(SpotterPalette.ink)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .frame(minHeight: 44)
                    .accessibilityElement(children: .combine)
                }
                .onMove { source, destination in reorder(source, destination, order: order) }
            } footer: {
                Text("拖动右侧手柄调整顺序。A1、A2 等同一超级组的动作会一起移动。")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background)
        .navigationTitle(NativeWorkoutExerciseAction.reorder.title)
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.editMode, .constant(.active))
        .alert("无法移到这里", isPresented: $rejectedMove) {
            Button("好", role: .cancel) {}
        } message: {
            Text("请试试另一个位置。排序会保留训练中已有的超级组。")
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } }
        }
    }

    private func reorder(_ source: IndexSet, _ insertion: Int, order: [[Int]]) {
        guard let original = source.first else { return }
        let destination = insertion > original ? insertion - 1 : insertion
        guard order.indices.contains(destination), destination != original,
              let from = order[original].first, let to = order[destination].first else { return }
        rejectedMove = !move(from, to)
    }
}
