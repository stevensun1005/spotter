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

@MainActor
struct NativePlanMoveSheet: View {
    @ObservedObject var store: NativeWorkoutStore
    let entry: NativeWorkoutEntry
    let didMove: (NativePlanMoveReceipt) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var target: Date
    @State private var shift = false
    @State private var review: Review?
    @State private var busy = false
    @State private var problem: String?

    private struct Review {
        let choice: NativePlanMoveChoice
        let preview: NativePlanMovePreview
    }

    init(store: NativeWorkoutStore, entry: NativeWorkoutEntry, didMove: @escaping (NativePlanMoveReceipt) -> Void) {
        self.store = store
        self.entry = entry
        self.didMove = didMove
        let current = nativePlanDate(entry.day) ?? .now
        _target = State(initialValue: Calendar.current.date(byAdding: .day, value: 1, to: current) ?? current)
    }

    private var activePlan: NativeWorkoutEntry? { store.plansByKey[entry.key] }
    private var canMove: Bool { activePlan.map(store.canMovePlan) ?? false }
    private var targetDay: String { spotterDay(target) }
    private var canShift: Bool { !(activePlan?.data["programId"].string ?? "").isEmpty }
    private var extendsCycle: Bool { shift && canShift }
    private var isRestDay: Bool { store.isPlanRestDay(target) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Image(systemName: "calendar.badge.clock").accessibilityHidden(true)
                        Text((activePlan ?? entry).displayTitle).font(.headline)
                        Spacer(minLength: 4)
                        Text((activePlan ?? entry).day).font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }.padding(14).spotterCard()

                    if let plan = activePlan, canMove {
                        if let review { reviewPanel(review).transition(.opacity) }
                        else { selectionPanel(plan).transition(.opacity) }
                    } else {
                        Text(activePlan == nil ? "计划已删除或不可用。" : "已开始或已完成的训练保留原日期。")
                            .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    }
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle")
                            .font(.footnote).foregroundStyle(.red)
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
            if let review, review.choice.revision != updated { self.review = nil }
        }
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func selectionPanel(_ plan: NativeWorkoutEntry) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            DatePicker("新日期", selection: $target, displayedComponents: .date)
            if canShift {
                Toggle("同时顺延本周期后续训练", isOn: $shift)
                    .font(.subheadline.weight(.semibold))
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
                    Task { await inspect(plan, date: spotterDay(), nextAvailable: true) }
                }.buttonStyle(SpotterNativeButtonStyle(primary: false))
            }
            Button("预览日期变更") { Task { await inspect(plan, date: targetDay, nextAvailable: false) } }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(isRestDay || targetDay == plan.day || (extendsCycle && targetDay < plan.day))
        }
        .padding(14).spotterCard()
        .animation(motion, value: extendsCycle)
        .disabled(busy || store.isBusy)
        .onChange(of: targetDay) { _ in problem = nil }
        .onChange(of: shift) { _ in problem = nil }
    }

    private func reviewPanel(_ review: Review) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("核对日期变更").font(.headline).accessibilityAddTraits(.isHeader)
            ForEach(review.preview.changes) { change in
                VStack(alignment: .leading, spacing: 3) {
                    Text(NativePlan(raw: .object(["title": .string(change.title)])).displayTitle)
                        .font(.subheadline.weight(.semibold))
                    Text("\(change.from) → \(change.date)").font(.footnote).foregroundStyle(SpotterPalette.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            Button("修改日期或范围") { self.review = nil; problem = nil }
                .buttonStyle(SpotterNativeButtonStyle(primary: false))
            Button(busy ? "正在移动…" : "确认移动 \(review.preview.changes.count) 节") {
                Task { await commit(review) }
            }.buttonStyle(SpotterNativeButtonStyle(primary: true))
        }
        .padding(14).spotterCard()
        .disabled(busy || store.isBusy)
    }

    private func inspect(_ plan: NativeWorkoutEntry, date: String, nextAvailable: Bool) async {
        guard !busy else { return }
        busy = true
        problem = nil
        defer { busy = false }
        let choice = NativePlanMoveChoice(plan: plan, date: date, shift: extendsCycle, nextAvailable: nextAvailable)
        do { review = Review(choice: choice, preview: try await store.previewPlanMove(choice)) }
        catch { await show(error) }
    }

    private func commit(_ review: Review) async {
        guard !busy else { return }
        busy = true
        problem = nil
        defer { busy = false }
        do {
            let receipt = try await store.movePlan(review.choice, using: review.preview)
            didMove(receipt)
            dismiss()
        } catch { await show(error) }
    }

    private func show(_ error: Error) async {
        problem = error.localizedDescription
        if (error as? NativeAPIError)?.statusCode == 409 {
            review = nil
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
