import SwiftUI

struct NativePlanMoveChoice: Encodable {
    enum Action: String, Encodable { case previewMove, move }

    private(set) var action: Action = .previewMove
    private(set) var token: String?
    let id: String
    let from: String
    let revision: String
    let date: String
    let shift: Bool
    let nextAvailable: Bool

    init(plan: NativeWorkoutEntry, date: String, shift: Bool, nextAvailable: Bool) {
        id = plan.id
        from = plan.day
        revision = plan.updated
        self.date = date
        self.shift = shift
        self.nextAvailable = nextAvailable
    }

    func confirmed(token: String) -> Self {
        var request = self
        request.action = .move
        request.token = token
        return request
    }
}

struct NativePlanMovePreview: Decodable {
    struct Change: Decodable, Identifiable {
        let id: String
        let title: String
        let from: String
        let date: String
    }

    let token: String
    let changes: [Change]

    func checked(for choice: NativePlanMoveChoice) throws -> Self {
        guard token.utf8.count == 64, token.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }),
              !changes.isEmpty, Set(changes.map(\.id)).count == changes.count,
              changes.contains(where: { $0.id == choice.id && $0.from == choice.from }),
              choice.shift || changes.count == 1,
              changes.allSatisfy({ UUID(uuidString: $0.id) != nil && nativePlanDate($0.date) != nil }) else {
            throw NativeAPIError.invalidResponse
        }
        return self
    }
}

struct NativePlanMoveReceipt: Decodable {
    let moved: Int
    let date: String
}

struct NativeMissedPlansCard: View {
    let plans: [NativeWorkoutEntry]
    let open: (NativeWorkoutEntry) -> Void

    @Environment(\.spotterAccent) private var accent

    var body: some View {
        if let latest = plans.first {
            VStack(alignment: .leading, spacing: 9) {
                Label("待调整训练", systemImage: "calendar.badge.clock")
                    .font(.headline).accessibilityAddTraits(.isHeader)
                planRow(latest)
                if plans.count > 1 {
                    SpotterDisclosure("查看其余 \(plans.count - 1) 节") {
                        LazyVStack(spacing: 5) {
                            ForEach(plans.dropFirst(), id: \.key) { plan in planRow(plan) }
                        }
                    }
                }
            }
            .padding(13).spotterCard()
        }
    }

    private func planRow(_ plan: NativeWorkoutEntry) -> some View {
        Button { open(plan) } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(plan.displayTitle).font(.subheadline.weight(.semibold))
                    Text("原定 \(plan.day)").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .frame(minHeight: 44)
            .background(accent.selection.opacity(0.42), in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityElement(children: .combine)
        .accessibilityHint("预览日期调整")
    }
}

@MainActor
struct NativePlanMoveSheet: View {
    @ObservedObject var store: NativeWorkoutStore
    let entry: NativeWorkoutEntry
    let didMove: (NativePlanMoveReceipt) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterAccent) private var accent
    @Environment(\.dynamicTypeSize) private var textSize
    @State private var target: Date
    @State private var shift = false
    @State private var review: Review?
    @State private var operation: Operation?
    @State private var problem: String?

    private enum Operation { case preview, commit }

    private struct Review {
        let choice: NativePlanMoveChoice
        let preview: NativePlanMovePreview
    }

    init(store: NativeWorkoutStore, entry: NativeWorkoutEntry, didMove: @escaping (NativePlanMoveReceipt) -> Void) {
        self.store = store
        self.entry = entry
        self.didMove = didMove
        let current = nativePlanDate(entry.day) ?? .now
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: current) ?? current
        _target = State(initialValue: max(Calendar.current.startOfDay(for: .now), tomorrow))
    }

    private var activePlan: NativeWorkoutEntry? { store.plansByKey[entry.key] }
    private var canMove: Bool { activePlan.map(store.canMovePlan) ?? false }
    private var targetDay: String { spotterDay(target) }
    private var canShift: Bool { !(activePlan?.data["programId"].string ?? "").isEmpty }
    private var extendsCycle: Bool { shift && canShift }
    private var isRestDay: Bool { store.isPlanRestDay(target) }
    private var busy: Bool { operation != nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center, spacing: 10) {
                        Image(systemName: "calendar.badge.clock").accessibilityHidden(true)
                            .font(.body.weight(.semibold)).foregroundStyle(accent.tint)
                            .frame(width: 40, height: 40).background(accent.selection, in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 4) {
                            Text((activePlan ?? entry).displayTitle).font(.headline)
                            Text("原定 \((activePlan ?? entry).day)")
                                .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }.padding(14).spotterCard()

                    if let plan = activePlan, canMove {
                        if let review { reviewPanel(review, plan: plan).transition(.opacity) }
                        else { selectionPanel(plan).transition(.opacity) }
                    } else {
                        Text(activePlan == nil ? "计划已删除或不可用。" : "已开始或已完成的训练保留原日期。")
                            .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    }
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle")
                            .font(.footnote).foregroundStyle(.red)
                    }
                    if let review, canMove {
                        Button(operation == .commit ? "正在移动…" : "确认移动 \(review.preview.changes.count) 节") {
                            Task { await commit(review) }
                        }
                        .buttonStyle(SpotterNativeButtonStyle(primary: true))
                        .disabled(busy || store.isBusy)
                    }
                }.padding(14)
                    .animation(motion, value: review != nil)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("移动训练")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        }
        .onChange(of: activePlan?.updated) { updated in
            if let review, review.choice.revision != updated {
                self.review = nil
                problem = "计划已变更，请重新核对日期。"
            }
        }
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func selectionPanel(_ plan: NativeWorkoutEntry) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            DatePicker("新日期", selection: $target, displayedComponents: .date)
            if canShift {
                scopePicker(selection: extendsCycle) { shift = $0 }
            }
            if extendsCycle {
                Text("保留原间隔，跳过休息日和已占用的日期。已开始及已打卡的训练保留原日期。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if isRestDay {
                Text("这天设为不安排训练。请选择另一日。")
                    .font(.footnote).foregroundStyle(.red)
            } else if extendsCycle && targetDay <= plan.day {
                Text("顺延日期要晚于原定日期。")
                    .font(.footnote).foregroundStyle(.red)
            }
            if plan.day < spotterDay() {
                Button("找下一个可训练日") {
                    Task { await inspect(plan, date: spotterDay(), shift: extendsCycle, nextAvailable: true) }
                }.buttonStyle(SpotterNativeButtonStyle(primary: false))
            }
            Button(operation == .preview ? "正在核对…" : "预览日期变更") {
                Task { await inspect(plan, date: targetDay, shift: extendsCycle, nextAvailable: false) }
            }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(isRestDay || targetDay == plan.day || (extendsCycle && targetDay < plan.day))
        }
        .padding(14).spotterCard()
        .animation(motion, value: extendsCycle)
        .disabled(busy || store.isBusy)
        .onChange(of: targetDay) { _ in problem = nil }
        .onChange(of: shift) { _ in problem = nil }
    }

    private func reviewPanel(_ review: Review, plan: NativeWorkoutEntry) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("核对日期变更").font(.headline).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                Text("\(review.preview.changes.count) 节")
                    .font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                    .padding(.horizontal, 8).padding(.vertical, 4).background(accent.selection, in: Capsule())
            }
            if canShift {
                let date = review.choice.date
                let nextAvailable = review.choice.nextAvailable
                scopePicker(selection: review.choice.shift) { newShift in
                    Task { await inspect(plan, date: date, shift: newShift, nextAvailable: nextAvailable) }
                }
            }
            if operation == .preview {
                ProgressView("正在核对日期…").font(.footnote)
            }
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(review.preview.changes) { change in
                    changeRow(change)
                    if change.id != review.preview.changes.last?.id { Divider().overlay(SpotterPalette.line) }
                }
            }
            Button("修改日期") { self.review = nil; problem = nil }
                .buttonStyle(SpotterNativeButtonStyle(primary: false))
        }
        .padding(14).spotterCard()
        .disabled(busy || store.isBusy)
    }

    private func scopePicker(selection: Bool, choose: @escaping @MainActor @Sendable (Bool) -> Void) -> some View {
        SpotterGlassSegments(options: [false, true], value: Binding(get: { selection }, set: choose), glass: false) {
            $0 ? "后续一起顺延" : "只移动这一堂"
        }
    }

    private func changeRow(_ change: NativePlanMovePreview.Change) -> some View {
        let title = NativePlan(raw: .object(["title": .string(change.title)])).displayTitle
        let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 5)) : AnyLayout(HStackLayout(spacing: 6))
        return VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold))
            layout {
                Text(change.from).foregroundStyle(SpotterPalette.muted)
                Image(systemName: "arrow.right").font(.caption2.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                Text(change.date).fontWeight(.semibold).foregroundStyle(accent.tint)
                    .padding(.horizontal, 7).padding(.vertical, 4).background(accent.selection, in: Capsule())
            }
            .font(.footnote.monospacedDigit())
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 9)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue("从 \(change.from) 移到 \(change.date)")
    }

    private func inspect(_ plan: NativeWorkoutEntry, date: String, shift: Bool, nextAvailable: Bool) async {
        guard !busy, !store.isBusy else { return }
        operation = .preview
        problem = nil
        defer { operation = nil }
        let choice = NativePlanMoveChoice(plan: plan, date: date, shift: shift && canShift, nextAvailable: nextAvailable)
        do {
            let preview = try await store.previewPlanMove(choice)
            guard activePlan?.updated == choice.revision else {
                review = nil
                problem = "计划已变更，请重新核对日期。"
                return
            }
            self.shift = choice.shift
            if choice.nextAvailable, let moved = preview.changes.first(where: { $0.id == choice.id }),
               let offered = nativePlanDate(moved.date) { target = offered }
            review = Review(choice: choice, preview: preview)
        } catch { await show(error, resetReview: false) }
    }

    private func commit(_ review: Review) async {
        guard !busy, !store.isBusy else { return }
        operation = .commit
        problem = nil
        defer { operation = nil }
        do {
            let receipt = try await store.movePlan(review.choice, using: review.preview)
            didMove(receipt)
            dismiss()
        } catch { await show(error, resetReview: true) }
    }

    private func show(_ error: Error, resetReview: Bool) async {
        problem = error.localizedDescription
        if (error as? NativeAPIError)?.statusCode == 409 {
            if resetReview { review = nil }
            await store.load()
        }
    }
}

@MainActor
struct NativePlanDeleteSheet: View {
    @ObservedObject var store: NativeWorkoutStore
    let entry: NativeWorkoutEntry
    let didDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var problem: String?
    @State private var needsReview = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    Text("确定删除「\(entry.displayTitle)」？已打卡的历史仍可查看。")
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle")
                            .font(.footnote).foregroundStyle(.red)
                    }
                    Button(role: .destructive) { Task { await delete() } } label: {
                        Label(busy ? "正在删除…" : "确认删除", systemImage: "trash")
                    }.buttonStyle(.spotterControl)
                        .disabled(busy || store.isBusy || needsReview)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard().padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("删除训练计划")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func delete() async {
        guard !busy && !needsReview else { return }
        busy = true
        problem = nil
        defer { busy = false }
        do {
            try await store.removePlan(entry)
            didDelete()
            dismiss()
        } catch {
            problem = error.localizedDescription
            if (error as? NativeAPIError)?.statusCode == 409 {
                needsReview = true
                await store.load()
            }
        }
    }
}
