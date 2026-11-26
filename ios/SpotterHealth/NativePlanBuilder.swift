import SwiftUI

/// 新建 / 编辑训练计划和个人模板。版式与「开始训练」一致：顶部是标题与统计，中间是动作卡片，底部是操作栏。
struct NativePlanEditorPanel: View {
    let store: NativeWorkoutStore?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterGuide) private var guide
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @State var draft: NativePlanDraft
    @State private var busy = false
    @State private var error: String?
    @State private var exercisePreview: NativeTemplateExercisePreview?
    @State private var openedMove: Int?
    @State private var swipedMove: String?
    @State private var showsPicker = false
    @State private var showsDetails = false
    @State private var choosingRest = false
    @State private var confirmingLeave = false
    @State private var moveName = ""
    @FocusState private var focusedField: Field?
    private let original: NativeJSON
    private let saved: (String) -> Void
    private let reviewed: ((NativePlanDraft) -> Void)?
    private let start: ((NativePlanDraft) -> Void)?

    private enum Field: Hashable { case title, manualMove, moveName(Int), number(Int, String) }
    private static let restChoices = [30, 45, 60, 90, 120, 180]

    init(store: NativeWorkoutStore, draft: NativePlanDraft, saved: @escaping (String) -> Void,
         start: ((NativePlanDraft) -> Void)? = nil) {
        self.store = store
        self._draft = State(initialValue: draft)
        self._openedMove = State(initialValue: draft.plan["exercises"].array.isEmpty ? nil : 0)
        self.original = draft.plan
        self.saved = saved
        self.reviewed = nil
        self.start = start
    }

    init(imported draft: NativePlanDraft, reviewed: @escaping (NativePlanDraft) -> Void) {
        self.store = nil
        self._draft = State(initialValue: draft)
        self._openedMove = State(initialValue: draft.plan["exercises"].array.isEmpty ? nil : 0)
        self.original = draft.plan
        self.saved = { _ in }
        self.reviewed = reviewed
        self.start = nil
    }

    private var linked: Bool { !draft.isTemplate && !draft.plan["templateId"].string.isEmpty }
    private var moves: [NativeJSON] { draft.plan["exercises"].array }
    private var totalSets: Int { moves.reduce(0) { $0 + max(1, Int($1["sets"].number)) } }
    private var changed: Bool { draft.plan != original }
    private var kindName: String { draft.isTemplate ? "模板" : "计划" }
    private var title: String {
        if reviewed != nil { return "核对计划" }
        if draft.isTemplate { return draft.revision == nil ? "新建模板" : "编辑模板" }
        return draft.revision == nil ? "新建计划" : "编辑计划"
    }
    private var canStart: Bool { start != nil && store != nil && reviewed == nil }

    var body: some View {
        let compactHeight = verticalSizeClass == .compact
        VStack(spacing: 0) {
            if !compactHeight { header }
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if compactHeight { header }
                        content
                    }
                    .padding(14)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: moves.count) { [previous = moves.count] count in
                    guard count > previous, count > 0 else { return }
                    withAnimation(motion) { scroll.scrollTo(count - 1, anchor: .bottom) }
                }
            }
            .background(SpotterPalette.background)
            .clipShape(UnevenTopRoundedShape(radius: 23))
            actionBar
        }
        .background(SpotterPalette.wash.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .toolbar(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("完成") { focusedField = nil }.fontWeight(.semibold)
            }
        }
        .nativeGuideLayer(.planEditor) { dismiss() }
        .interactiveDismissDisabled(busy || changed)
        .confirmationDialog("放弃这次编辑？", isPresented: $confirmingLeave, titleVisibility: .visible) {
            Button("放弃更改", role: .destructive) { dismiss() }
            Button("继续编辑", role: .cancel) {}
        } message: { Text("返回后，这次对\(kindName)的修改不会保存。") }
        .confirmationDialog("统一休息", isPresented: $choosingRest, titleVisibility: .visible) {
            ForEach(Self.restChoices, id: \.self) { seconds in
                Button("\(seconds) 秒") { setRestForAll(seconds) }
            }
            Button("使用默认休息") { setRestForAll(nil) }
            Button("取消", role: .cancel) {}
        } message: { Text("为全部动作设置相同的组间休息。") }
        .sheet(item: $exercisePreview) { preview in
            if let store { NativeTemplateExerciseSheet(store: store, move: preview.move) }
        }
        .sheet(isPresented: $showsDetails) { details }
        .fullScreenCover(isPresented: $showsPicker) {
            if let store {
                NativePlanExercisePicker(store: store, kindName: kindName, remaining: { 30 - moves.count }) { entry in
                    appendMove(NativeCataloguePlanMove.planMove(entry))
                }
            }
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 10) {
                Button(action: leave) {
                    Text("返回").font(.system(size: 15, weight: .bold))
                }
                .buttonStyle(SpotterNativeButtonStyle(primary: false))
                .disabled(busy)
                .accessibilityIdentifier("plan-editor-back")
                Spacer(minLength: 4)
                Text(title).font(.system(size: 17, weight: .bold)).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 4)
                Button(busy ? "保存中" : reviewed == nil ? "保存" : "完成核对") { Task { await commit() } }
                    .font(.system(size: 15, weight: .bold))
                    .buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .disabled(busy || guide?.step == .planFields)
                    .accessibilityIdentifier("plan-editor-save")
            }
            HStack(alignment: .center, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "pencil.line").font(.system(size: 15)).foregroundStyle(SpotterPalette.muted)
                        .accessibilityHidden(true)
                    TextField("未命名" + kindName, text: text("title", maximum: 100))
                        .font(.system(size: 18, weight: .bold))
                        .focused($focusedField, equals: .title)
                        .submitLabel(.done)
                        .accessibilityLabel(kindName + "名称")
                        .accessibilityIdentifier("plan-editor-title")
                }
                .padding(.horizontal, 9).padding(.vertical, 8)
                .background(SpotterPalette.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 9))
                .nativeGuideTarget(.planFields)
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(totalSets) 组").font(.system(size: 14, weight: .bold)).monospacedDigit()
                    Text("\(moves.count) 个动作").font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                }
                .accessibilityElement(children: .combine)
            }
            HStack(spacing: 8) {
                if !draft.isTemplate {
                    DatePicker("训练日期", selection: Binding(
                        get: { nativePlanDate(draft.plan["date"].string) ?? Date() },
                        set: { draft.plan["date"] = .string(NativeWorkoutSession.day($0)) }
                    ), displayedComponents: .date)
                    .labelsHidden()
                    .accessibilityLabel("训练日期")
                }
                if !linked {
                    SpotterMenuPicker("训练类型", selection: text("category", maximum: 20),
                                      options: NativePlanImport.categories.map { ($0, $0) }) {
                        Label(draft.plan["category"].string.isEmpty ? "训练类型" : draft.plan["category"].string,
                              systemImage: "tag")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                Spacer(minLength: 0)
                if draft.plan["shared"].bool {
                    Label("搭子可见", systemImage: "person.2").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }
            if linked {
                Text("动作和组数来自个人模板。修改动作仅适用于本次训练。")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            if let error {
                Text(error).font(.system(size: 13)).foregroundStyle(.red)
                    .accessibilityIdentifier("plan-editor-error")
            }
        }
        .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 12)
    }

    // MARK: Content

    @ViewBuilder private var content: some View {
        if moves.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "dumbbell").font(.system(size: 20, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .foregroundStyle(SpotterPalette.accent)
                    .background(SpotterPalette.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    .accessibilityHidden(true)
                Text("添加动作，开始编排\(kindName)").font(.system(size: 15, weight: .semibold))
                Button("添加动作", action: openPicker).buttonStyle(SpotterNativeButtonStyle(primary: true))
            }
            .frame(maxWidth: .infinity).padding(30).spotterCard()
        }
        ForEach(Array(moves.enumerated()), id: \.offset) { index, move in
            exerciseCard(index, move: move).id(index)
        }
        if draft.plan["category"].string == "有氧训练" {
            NativeCardioPlanPresets { _ = appendMove($0) }
                .disabled(moves.count >= 30)
        }
        manualMoveRow
        if !linked, !draft.plan["video"].string.isEmpty {
            Button { showsDetails = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "play.rectangle").foregroundStyle(accent.tint).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("跟练视频").font(.system(size: 14, weight: .bold))
                        Text(draft.plan["video"].string).font(.caption).foregroundStyle(SpotterPalette.muted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                }
                .padding(13).frame(minHeight: 44).contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress).spotterCard()
        }
    }

    private var manualMoveRow: some View {
        HStack(spacing: 8) {
            Image(systemName: "character.cursor.ibeam").foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            TextField("手动输入动作名称", text: $moveName)
                .focused($focusedField, equals: .manualMove)
                .submitLabel(.done)
                .onSubmit(addManualMove)
            Button(action: addManualMove) {
                Image(systemName: "plus.circle.fill").font(.title3)
                    .frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("添加手输动作")
            .disabled(moveName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || moves.count >= 30)
        }
        .padding(.leading, 13).padding(.trailing, 4).padding(.vertical, 2)
        .spotterCard()
    }

    private func exerciseCard(_ index: Int, move: NativeJSON) -> some View {
        let open = openedMove == index
        let name = NativeExerciseLabel(move).name
        return VStack(alignment: .leading, spacing: 11) {
            Button {
                focusedField = nil
                withAnimation(motion) { openedMove = open ? nil : index; swipedMove = nil }
            } label: {
                HStack(spacing: 9) {
                    Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string)
                        .font(.system(size: 13, weight: .bold)).frame(width: 34, height: 30)
                        .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(move["name"].string.isEmpty ? "未命名动作" : move["name"].string)
                            .font(.system(size: 16, weight: .bold)).multilineTextAlignment(.leading)
                        Text(Self.summary(move)).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.down").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityValue(open ? "已展开" : "已收起")
            .accessibilityIdentifier("plan-editor-move-\(index)")
            if open {
                moveEditor(index, move: move, name: name)
                    .transition(.offset(y: -5).combined(with: .opacity))
            }
        }
        .padding(12)
        .spotterCard()
        .spotterSwipeToDelete(id: "plan-move-\(index)", openRow: $swipedMove,
                              accessibilityLabel: "删除 \(name.isEmpty ? "动作" : name)") { removeMove(index) }
    }

    private func moveEditor(_ index: Int, move: NativeJSON, name: String) -> some View {
        let timed = move["seconds"].number > 0
        let unit = move["unit"].string.isEmpty ? "kg" : move["unit"].string
        return VStack(alignment: .leading, spacing: 10) {
            TextField("动作名称", text: Binding(
                get: { move["name"].string },
                set: { setMove(index, key: "name", value: .string(String($0.prefix(100)))) }
            ))
            .font(.system(size: 15, weight: .semibold))
            .focused($focusedField, equals: .moveName(index))
            .padding(.horizontal, 10).padding(.vertical, 9)
            .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 10))
            .accessibilityLabel("动作名称")
            if !move["cue"].string.isEmpty {
                Text(move["cue"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
            }
            Picker("记录方式", selection: Binding(get: { timed }, set: { setTimed(index, $0) })) {
                Text("按次数").tag(false)
                Text("按时间").tag(true)
            }
            .pickerStyle(.segmented)
            HStack(spacing: 6) {
                setsStepper(index, value: max(1, Int(move["sets"].number)))
                numberBox(index, key: timed ? "seconds" : "reps", label: timed ? "秒数" : "次数",
                          value: move[timed ? "seconds" : "reps"].number, maximum: timed ? 18000 : 999, decimal: false)
                numberBox(index, key: "weight", label: unit, value: move["weight"].number, maximum: 2000, decimal: true)
            }
            HStack(spacing: 8) {
                SpotterMenuPicker("重量单位", selection: Binding(get: { unit }, set: { setMove(index, key: "unit", value: .string($0)) }),
                                  options: [("kg", "kg"), ("lb", "lb")]) {
                    Label(unit, systemImage: "scalemass").font(.caption.weight(.semibold))
                }
                SpotterMenu {
                    Button { setMove(index, key: "restSeconds", value: .null) } label: {
                        if move["restSeconds"] == .null { Label("使用默认休息", systemImage: "checkmark") } else { Text("使用默认休息") }
                    }
                    ForEach(Self.restChoices, id: \.self) { seconds in
                        Button { setMove(index, key: "restSeconds", value: .number(Double(seconds))) } label: {
                            if move["restSeconds"] == .number(Double(seconds)) { Label("\(seconds) 秒", systemImage: "checkmark") }
                            else { Text("\(seconds) 秒") }
                        }
                    }
                } label: {
                    Label(move["restSeconds"] == .null ? "默认休息" : "休息 \(Int(move["restSeconds"].number)) 秒", systemImage: "timer")
                        .font(.caption.weight(.semibold))
                }
                .accessibilityLabel("组间休息")
                Spacer(minLength: 0)
            }
            HStack(spacing: 8) {
                if store != nil, !name.isEmpty {
                    Button {
                        focusedField = nil
                        exercisePreview = .init(id: "plan-editor-preview-\(index)", move: move)
                    } label: {
                        Label("动作演示", systemImage: "play.rectangle").font(.caption.weight(.semibold))
                    }
                    .accessibilityIdentifier("plan-editor-demo-\(index)")
                }
                Spacer(minLength: 0)
                Button { moveExercise(index, by: -1) } label: { Image(systemName: "arrow.up").font(.caption.weight(.bold)) }
                    .disabled(index == 0)
                    .accessibilityLabel("上移 \(name)")
                Button { moveExercise(index, by: 1) } label: { Image(systemName: "arrow.down").font(.caption.weight(.bold)) }
                    .disabled(index >= moves.count - 1)
                    .accessibilityLabel("下移 \(name)")
                Button(role: .destructive) { removeMove(index) } label: {
                    Image(systemName: "trash").font(.caption.weight(.bold)).foregroundStyle(.red)
                }
                .accessibilityLabel("删除 \(name.isEmpty ? "动作" : name)")
            }
            .buttonStyle(.spotterControl)
        }
    }

    private func setsStepper(_ index: Int, value: Int) -> some View {
        VStack(spacing: 2) {
            Text("组数").font(.system(size: 10, weight: .semibold)).foregroundStyle(SpotterPalette.muted)
            HStack(spacing: 2) {
                Button { setMove(index, key: "sets", value: .number(Double(max(1, value - 1)))) } label: {
                    Image(systemName: "minus").font(.system(size: 13, weight: .bold)).frame(width: 30, height: 30).contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress).disabled(value <= 1).accessibilityLabel("减少一组")
                Text("\(value)").font(.system(size: 19, weight: .bold)).monospacedDigit().frame(minWidth: 24)
                Button { setMove(index, key: "sets", value: .number(Double(min(30, value + 1)))) } label: {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold)).frame(width: 30, height: 30).contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress).disabled(value >= 30).accessibilityLabel("增加一组")
            }
        }
        .frame(maxWidth: .infinity, minHeight: 56)
        .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(SpotterPalette.line, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("组数 \(value)")
    }

    private func numberBox(_ index: Int, key: String, label: String, value: Double, maximum: Double, decimal: Bool) -> some View {
        let focused = focusedField == .number(index, key)
        return VStack(spacing: 1) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(SpotterPalette.muted)
            NativePlanNumberField(label: label, value: value, decimal: decimal, editing: focused) { entry in
                let rounded = decimal ? (entry * 100).rounded() / 100 : entry.rounded()
                setMove(index, key: key, value: .number(min(maximum, max(0, rounded))))
            }
            .focused($focusedField, equals: .number(index, key))
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, minHeight: 56)
        .background(focused ? accent.selection : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused ? accent.tint : SpotterPalette.line, lineWidth: focused ? 2 : 1))
        .contentShape(Rectangle())
        .onTapGesture { focusedField = .number(index, key) }
    }

    // MARK: Action bar

    private var actionBar: some View {
        HStack(spacing: 3) {
            footerAction("更多", symbol: "ellipsis") { focusedField = nil; showsDetails = true }
                .accessibilityIdentifier("plan-editor-more")
            if canStart {
                footerAction("开始训练", symbol: "figure.run") { Task { await commit(thenStart: true) } }
                    .disabled(busy || store?.active != nil || store?.isBusy == true)
                    .accessibilityHint(store?.active != nil ? "已有进行中的训练，先结束或删除它" : "保存后立即开始这次训练")
                    .accessibilityIdentifier("plan-editor-start")
            }
            Button(action: openPicker) {
                VStack(spacing: 4) {
                    Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
                    Text("添加动作").font(.system(size: 10, weight: .bold)).lineLimit(1)
                }
                .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(SpotterChoiceStyle(selected: true, horizontalPadding: 1))
            .disabled(moves.count >= 30 || busy)
            .accessibilityIdentifier("plan-editor-add")
            footerAction("统一休息", symbol: "timer") { focusedField = nil; choosingRest = true }
                .disabled(moves.isEmpty || busy)
                .accessibilityIdentifier("plan-editor-rest")
        }
        .spotterGlassToolbar()
        .padding(.horizontal, 10).padding(.vertical, 5)
    }

    private func footerAction(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 19))
                Text(title).font(.system(size: 10, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(SpotterChoiceStyle(selected: false, horizontalPadding: 1))
    }

    private var details: some View {
        NavigationStack {
            Form {
                Section(kindName) {
                    if !linked {
                        HStack {
                            Text("预计分钟")
                            Spacer()
                            TextField("分钟", value: number("minutes", maximum: 720), format: .number)
                                .keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 70)
                        }
                    }
                    Toggle("与搭子共享\(kindName)", isOn: Binding(get: { draft.plan["shared"].bool }, set: { draft.plan["shared"] = .bool($0) }))
                }
                if !linked {
                    Section("跟练视频") {
                        TextField("粘贴 B 站或 YouTube 链接", text: text("video", maximum: 1200))
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(SpotterPalette.background)
            .navigationTitle(kindName + "设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { showsDetails = false }.fontWeight(.bold) } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: Editing

    private func text(_ key: String, maximum: Int) -> Binding<String> {
        Binding(get: { draft.plan[key].string }, set: { draft.plan[key] = .string(String($0.prefix(maximum))) })
    }

    private func number(_ key: String, maximum: Double) -> Binding<Double> {
        Binding(get: { draft.plan[key].number }, set: { if $0.isFinite { draft.plan[key] = .number(min(maximum, max(0, $0.rounded()))) } })
    }

    private func updateMoves(_ change: (inout [NativeJSON]) -> Void) {
        var list = moves
        change(&list)
        guard list != moves else { return }
        draft.plan["exercises"] = .array(list)
        if linked { draft.plan["ownExercises"] = .bool(true) }
        error = nil
    }

    private func setMove(_ index: Int, key: String, value: NativeJSON) {
        updateMoves { list in
            guard list.indices.contains(index) else { return }
            var fields = list[index].object
            if key == "name", list[index]["name"] != value {
                fields.removeValue(forKey: "catalogueId")
                fields.removeValue(forKey: "sourceName")
            }
            if value == .null { fields.removeValue(forKey: key) } else { fields[key] = value }
            if key == "reps", value.number <= 0 || (fields["repsMax"].map { $0.number < value.number } ?? false) {
                fields.removeValue(forKey: "repsMax")
            }
            list[index] = .object(fields)
        }
    }

    private func setTimed(_ index: Int, _ timed: Bool) {
        updateMoves { list in
            guard list.indices.contains(index) else { return }
            var fields = list[index].object
            if timed {
                if (fields["seconds"]?.number ?? 0) <= 0 { fields["seconds"] = .number(30) }
                fields["reps"] = .number(0)
                fields.removeValue(forKey: "repsMax")
            } else {
                fields["seconds"] = .number(0)
                if (fields["reps"]?.number ?? 0) <= 0 { fields["reps"] = .number(Double(NativePreferenceKey.newMoveReps)) }
            }
            list[index] = .object(fields)
        }
    }

    private func setRestForAll(_ seconds: Int?) {
        updateMoves { list in
            list = list.map { move in
                var fields = move.object
                if let seconds { fields["restSeconds"] = .number(Double(seconds)) } else { fields.removeValue(forKey: "restSeconds") }
                return .object(fields)
            }
        }
    }

    private func moveExercise(_ index: Int, by offset: Int) {
        let target = index + offset
        focusedField = nil
        // Let a field that is losing focus finish writing to its own row before the rows change places.
        DispatchQueue.main.async {
            withAnimation(motion) {
                updateMoves { list in
                    guard list.indices.contains(index), list.indices.contains(target) else { return }
                    list.swapAt(index, target)
                }
                openedMove = target
            }
        }
    }

    private func removeMove(_ index: Int) {
        focusedField = nil
        withAnimation(motion) {
            updateMoves { list in
                guard list.indices.contains(index) else { return }
                list.remove(at: index)
            }
            swipedMove = nil
            if let opened = openedMove {
                if opened == index { openedMove = nil } else if opened > index { openedMove = opened - 1 }
            }
        }
    }

    @discardableResult
    private func appendMove(_ move: NativeJSON) -> Bool {
        guard moves.count < 30 else { return false }
        updateMoves { $0.append(move) }
        openedMove = moves.count - 1
        return true
    }

    private func addManualMove() {
        let name = String(moveName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard !name.isEmpty, appendMove(NativePreferenceKey.newMove(name: name)) else { return }
        moveName = ""
    }

    private func openPicker() {
        focusedField = nil
        swipedMove = nil
        if store != nil { showsPicker = true } else { focusedField = .manualMove }
    }

    private func leave() {
        focusedField = nil
        if changed { confirmingLeave = true } else { dismiss() }
    }

    private func commit(thenStart: Bool = false) async {
        focusedField = nil
        if draft.plan["title"].string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            draft.plan["title"] = .string("未命名" + kindName)
        }
        if let reviewed {
            do { try NativePlanImport.validate(draft.plan); reviewed(draft); dismiss() }
            catch { self.error = error.localizedDescription }
            return
        }
        guard let store else { return }
        guard !moves.isEmpty || !draft.plan["video"].string.isEmpty else {
            error = "请至少添加一个动作或跟练视频。"
            return
        }
        if thenStart, store.active != nil {
            error = "已有进行中的训练。先结束或删除它，再开始新的训练。"
            return
        }
        busy = true; defer { busy = false }
        if draft.isTemplate {
            do { try await store.saveTemplate(id: draft.id, data: draft.plan, revision: draft.revision) }
            catch {
                self.error = error.localizedDescription
                if (error as? NativeAPIError)?.statusCode == 409 { await store.load() }
                return
            }
        } else if let message = await store.savePlan(id: draft.id, data: draft.plan, revision: draft.revision) {
            error = message
            return
        }
        saved(draft.plan["date"].string)
        if thenStart { start?(draft) }
        dismiss()
    }

    static func summary(_ move: NativeJSON) -> String {
        let sets = max(1, Int(move["sets"].number))
        let unit = move["unit"].string.isEmpty ? "kg" : move["unit"].string
        var parts: [String]
        if move["seconds"].number > 0 {
            parts = ["\(sets) 组 × \(Int(move["seconds"].number)) 秒"]
        } else {
            let maximum = move["repsMax"].number
            let reps = Int(move["reps"].number)
            parts = ["\(sets) 组 × " + (maximum > Double(reps) ? "\(reps)–\(Int(maximum))" : "\(reps)") + " 次"]
        }
        if move["weight"].number > 0 { parts.append("\(move["weight"].number.formatted()) \(unit)") }
        if case .number(let rest) = move["restSeconds"] { parts.append("休息 \(Int(rest)) 秒") }
        return parts.joined(separator: " · ")
    }
}

/// 数字输入框：每次按键都写回计划，保存时不会漏掉尚未确认的数字。
private struct NativePlanNumberField: View {
    let label: String
    let value: Double
    let decimal: Bool
    let editing: Bool
    let set: (Double) -> Void
    @State private var text = ""

    var body: some View {
        TextField(label, text: $text)
            .font(.system(size: 19, weight: .bold)).monospacedDigit()
            .multilineTextAlignment(.center)
            .keyboardType(decimal ? .decimalPad : .numberPad)
            .accessibilityLabel(label)
            .onAppear { text = Self.format(value) }
            .onChange(of: text) { entry in
                guard let parsed = Self.parse(entry) else { return }
                if parsed != value { set(parsed) }
            }
            .onChange(of: value) { current in
                if Self.parse(text) != current, !(editing && text.isEmpty) { text = Self.format(current) }
            }
            .onChange(of: editing) { active in
                if !active { text = Self.format(value) }
            }
    }

    private static func parse(_ text: String) -> Double? {
        let normalized = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty, let number = Double(normalized), number.isFinite else { return nil }
        return number
    }

    private static func format(_ value: Double) -> String {
        value.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX")))
    }
}

/// 计划编辑器的动作库选择页：沿用「动作库」的部位栏和器械筛选，可连续添加多个动作。
private struct NativePlanExercisePicker: View {
    @ObservedObject var store: NativeWorkoutStore
    let kindName: String
    let remaining: () -> Int
    let add: (NativeCatalogEntry) -> Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var added: [String] = []
    @State private var notice: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                NativeCatalogueBrowser(store: store) { entry in
                    if add(entry) {
                        withAnimation(motion) {
                            added.append(entry.name)
                            notice = nil
                        }
                    } else {
                        notice = "一个\(kindName)最多 30 个动作。"
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 6)
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(added.isEmpty ? "点动作旁的 + 加入\(kindName)" : "已添加 \(added.count) 个动作")
                            .font(.subheadline.weight(.semibold))
                        if let notice {
                            Text(notice).font(.caption).foregroundStyle(.red)
                        } else if !added.isEmpty {
                            Text(added.suffix(3).joined(separator: "、")).font(.caption)
                                .foregroundStyle(SpotterPalette.muted).lineLimit(1)
                        } else {
                            Text("还可添加 \(max(0, remaining())) 个").font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.updatesFrequently)
                    Spacer(minLength: 8)
                    Button("完成") { dismiss() }
                        .font(.system(size: 15, weight: .bold))
                        .buttonStyle(SpotterNativeButtonStyle(primary: true))
                        .accessibilityIdentifier("plan-picker-done")
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(SpotterPalette.wash.ignoresSafeArea(edges: .bottom))
            }
            .background(SpotterPalette.background)
            .navigationTitle("添加动作")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }.accessibilityLabel("关闭")
                }
            }
        }
    }
}
