import SwiftUI

@MainActor
struct NativeProgramPlanEditor: View {
    let date: String
    let store: NativeWorkoutStore?
    let templates: [NativeProgramTemplate]
    let save: (NativeJSON) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var plan: NativeJSON
    @State private var moves: [NativeJSON]
    @State private var templateID = ""
    @State private var catalogueSelection: CatalogueSelection?
    @State private var issue: String?

    init(plan: NativeJSON, date: String, store: NativeWorkoutStore?, templates: [NativeProgramTemplate] = [], save: @escaping (NativeJSON) -> Void) {
        self.date = date
        self.store = store
        self.templates = templates
        self.save = save
        _plan = State(initialValue: plan)
        _moves = State(initialValue: plan["exercises"].array)
    }

    var body: some View {
        Form {
            Section {
                LabeledContent("训练日期", value: date)
                if !templates.isEmpty {
                    Picker("个人模板", selection: $templateID) {
                        Text("自定义训练").tag("")
                        ForEach(templates) { item in Text(item.title).tag(item.id) }
                    }.onChange(of: templateID) { id in
                        let source = templates.first { $0.id == id }?.plan ?? NativePlanDraft(day: date).plan
                        plan = NativeTrainingProgram.privatePlan(source, date: date)
                        moves = plan["exercises"].array
                    }
                }
                TextField("训练名称", text: planText("title", limit: 100))
                Picker("训练类型", selection: planText("category", limit: 20)) {
                    ForEach(NativePlanImport.categories, id: \.self) { Text($0).tag($0) }
                }
                LabeledContent("预计时长（分钟）") {
                    TextField("分钟", value: planNumber("minutes"), format: .number)
                        .keyboardType(.numberPad).multilineTextAlignment(.trailing)
                }
                TextField("预计时长说明（可选）", text: planText("durationNote", limit: 380), axis: .vertical)
                TextField("B 站或 YouTube 跟练链接", text: planText("video", limit: 1200))
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                LabeledContent("默认休息（秒）") {
                    TextField("可选", value: planOptionalNumber("defaultRestSeconds"), format: .number)
                        .keyboardType(.numberPad).multilineTextAlignment(.trailing)
                }
            } header: {
                Text("训练内容")
            } footer: {
                Text("此处编辑私人周期草稿。确认排期后才会更新日历。")
            }
            exerciseSection(warmup: true)
            exerciseSection(warmup: false)
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
        }
        .scrollContentBackground(.hidden).background(SpotterPalette.background).foregroundStyle(SpotterPalette.ink)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("编辑这一节").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("完成编辑", action: submit).fontWeight(.bold) }
        }
        .sheet(item: $catalogueSelection) { selection in
            if let store {
                NavigationStack {
                    NativeCatalogueBrowser(store: store) { entry in
                        pick(entry, for: selection)
                        catalogueSelection = nil
                    }
                    .padding(.horizontal, 12)
                    .background(SpotterPalette.background)
                    .navigationTitle("动作库").navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("关闭") { catalogueSelection = nil } }
                    }
                }.presentationDragIndicator(.visible)
            }
        }
    }

    private func exerciseSection(warmup: Bool) -> some View {
        Section(warmup ? "热身动作" : "正式动作") {
            ForEach(moves.indices.filter { NativeExerciseLabel(moves[$0]).warmup == warmup }, id: \.self) { index in
                DisclosureGroup {
                    exerciseFields(index, warmup: warmup)
                } label: {
                    let move = moves[index]
                    VStack(alignment: .leading, spacing: 3) {
                        Text(move["name"].string.isEmpty ? "未命名动作" : move["name"].string).font(.body.weight(.semibold))
                        Text(Self.prescription(move)).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                }
            }
            if store != nil {
                Button { catalogueSelection = .add(warmup) } label: { Label("从动作库添加", systemImage: "plus.circle") }
                    .disabled(moves.count >= 30)
            }
            Button {
                add(NativePreferenceKey.newMove(name: ""), warmup: warmup)
            } label: { Label("填写自定义动作", systemImage: "pencil") }.disabled(moves.count >= 30)
        }
    }

    @ViewBuilder private func exerciseFields(_ index: Int, warmup: Bool) -> some View {
        TextField("动作名称", text: moveText(index, "name", limit: 100))
        TextField("组别，例如 A 或 A-2", text: moveText(index, "block", limit: 4)).textInputAutocapitalization(.characters)
        TextField("器械站（可选）", text: moveText(index, "station", limit: 60))
        TextField("动作备注（可选）", text: moveText(index, "cue", limit: 220))
        TextField("节奏（可选）", text: moveText(index, "tempo", limit: 80))
        numberField("组数", moveNumber(index, "sets"))
        numberField("次数", moveNumber(index, "reps"))
        optionalNumberField("次数上限", moveOptionalNumber(index, "repsMax"))
        numberField("计时（秒）", moveNumber(index, "seconds"))
        optionalNumberField("组间／轮间休息（秒）", moveOptionalNumber(index, "restSeconds"))
        Picker("重量单位", selection: moveText(index, "unit", limit: 2)) {
            Text("kg").tag("kg")
            Text("lb").tag("lb")
        }
        DisclosureGroup("负荷方式与目标 RPE") {
            Toggle("使用手填 1RM 百分比", isOn: Binding(get: { move(index)["loadPercent"] != .null }, set: { value in
                let load: NativeJSON? = value ? .object(["reference": .number(0), "percent": .number(0), "unit": move(index)["unit"]]) : nil
                setMove(index, "loadPercent", load)
                if value { setMove(index, "fixedLoad", nil) }
            }))
            if move(index)["loadPercent"] != .null {
                numberField("1RM 百分比 %", loadNumber(index, "percent"), decimals: true)
                numberField("已确认的 1RM 参考重量", loadNumber(index, "reference"), decimals: true)
                Picker("参考重量单位", selection: Binding(get: { move(index)["loadPercent"]["unit"].string }, set: { setLoad(index, "unit", .string($0)) })) {
                    Text("kg").tag("kg")
                    Text("lb").tag("lb")
                }
                if let weight = try? NativeTrainingProgram.prescribedWeight(move(index)["loadPercent"], unit: move(index)["unit"].string) {
                    LabeledContent("处方重量", value: "\(weight.formatted()) \(move(index)["unit"].string)")
                }
            } else {
                numberField("训练重量", moveNumber(index, "weight"), decimals: true)
            }
            optionalNumberField("目标 RPE", moveOptionalNumber(index, "targetRpe"), decimals: true)
        }
        Menu("动作操作", systemImage: "ellipsis.circle") {
            if store != nil { Button("从动作库替换", systemImage: "arrow.triangle.2.circlepath") { catalogueSelection = .replace(index) } }
            Button(warmup ? "转为正式动作" : "设为热身", systemImage: "arrow.up.arrow.down") {
                let source = move(index)
                guard moves.indices.contains(index) else { return }
                moves.remove(at: index)
                add(source, warmup: !warmup)
            }
            Button("移除动作", systemImage: "trash", role: .destructive) {
                if moves.indices.contains(index) { moves.remove(at: index) }
            }
        }
    }

    private func numberField(_ title: String, _ binding: Binding<Double>, decimals: Bool = false) -> some View {
        LabeledContent(title) {
            TextField(title, value: binding, format: .number.grouping(.never))
                .keyboardType(decimals ? .decimalPad : .numberPad).multilineTextAlignment(.trailing)
        }
    }

    private func optionalNumberField(_ title: String, _ binding: Binding<Double?>, decimals: Bool = false) -> some View {
        LabeledContent(title) {
            TextField("可选", value: binding, format: .number.grouping(.never))
                .keyboardType(decimals ? .decimalPad : .numberPad).multilineTextAlignment(.trailing)
        }
    }

    private func planText(_ field: String, limit: Int) -> Binding<String> {
        Binding(get: { plan[field].string }, set: { plan[field] = .string(String($0.prefix(limit))) })
    }

    private func planNumber(_ field: String) -> Binding<Double> {
        Binding(get: { plan[field].number }, set: { plan[field] = .number($0) })
    }

    private func planOptionalNumber(_ field: String) -> Binding<Double?> {
        Binding(get: { Self.optionalNumber(plan[field]) }, set: { value in
            var fields = plan.object
            fields[field] = value.map(NativeJSON.number)
            plan = .object(fields)
        })
    }

    private func moveText(_ index: Int, _ field: String, limit: Int) -> Binding<String> {
        Binding(get: { move(index)[field].string }, set: { value in
            if field == "name", move(index)[field].string != value {
                setMove(index, "catalogueId", nil)
                setMove(index, "sourceName", nil)
            }
            let text = String(value.prefix(limit))
            setMove(index, field, .string(field == "block" ? text.uppercased() : text))
        })
    }

    private func moveNumber(_ index: Int, _ field: String) -> Binding<Double> {
        Binding(get: { move(index)[field].number }, set: { value in
            setMove(index, field, .number(value))
            if field == "weight" { setMove(index, "fixedLoad", value > 0 ? .bool(true) : nil) }
            if field == "reps", value <= 0 || (move(index)["repsMax"] != .null && move(index)["repsMax"].number < value) {
                setMove(index, "repsMax", nil)
            }
        })
    }

    private func moveOptionalNumber(_ index: Int, _ field: String) -> Binding<Double?> {
        Binding(get: { Self.optionalNumber(move(index)[field]) }, set: { setMove(index, field, $0.map(NativeJSON.number)) })
    }

    private func loadNumber(_ index: Int, _ field: String) -> Binding<Double> {
        Binding(get: { move(index)["loadPercent"][field].number }, set: { setLoad(index, field, .number($0)) })
    }

    private static func optionalNumber(_ value: NativeJSON) -> Double? {
        if case .number(let number) = value { return number }
        return nil
    }

    private func move(_ index: Int) -> NativeJSON { moves.indices.contains(index) ? moves[index] : .null }

    private func setMove(_ index: Int, _ field: String, _ value: NativeJSON?) {
        guard moves.indices.contains(index) else { return }
        var move = moves[index].object
        move[field] = value
        moves[index] = .object(move)
    }

    private func setLoad(_ index: Int, _ field: String, _ value: NativeJSON) {
        var load = move(index)["loadPercent"]
        load[field] = value
        setMove(index, "loadPercent", load)
    }

    private func add(_ move: NativeJSON, warmup: Bool) {
        guard moves.count < 30 else { return }
        var fields = move.object
        let label = NativeExerciseLabel(move)
        if warmup != label.warmup {
            fields["name"] = .string(label.name)
            fields.removeValue(forKey: "warmup")
            if warmup || move["block"].string.split(separator: "-").first == "W" { fields.removeValue(forKey: "block") }
            fields["sourceSlot"] = warmup ? .string("W-warmup") : nil
        }
        let index = warmup ? moves.firstIndex { !NativeExerciseLabel($0).warmup } ?? moves.endIndex : moves.endIndex
        moves.insert(.object(fields), at: index)
    }

    private func pick(_ entry: NativeCatalogEntry, for selection: CatalogueSelection) {
        let picked = NativeCataloguePlanMove.planMove(entry)
        switch selection {
        case .add(let warmup): add(picked, warmup: warmup)
        case .replace(let index):
            setMove(index, "name", picked["name"])
            setMove(index, "catalogueId", entry.isPersonal ? nil : picked["catalogueId"])
            setMove(index, "sourceName", nil)
        }
    }

    private func submit() {
        do {
            var updated = NativeTrainingProgram.privatePlan(plan, date: date)
            for field in ["title", "video", "durationNote"] where updated[field] != .null {
                updated[field] = .string(updated[field].string.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            updated["exercises"] = .array(try moves.map { move in
                var fields = move.object
                for field in ["name", "block", "station", "cue", "tempo"] {
                    let value = move[field].string.trimmingCharacters(in: .whitespacesAndNewlines)
                    fields[field] = value.isEmpty && field != "name" ? nil : .string(value)
                }
                if move["loadPercent"] != .null {
                    fields["weight"] = .number(try NativeTrainingProgram.prescribedWeight(move["loadPercent"], unit: move["unit"].string))
                }
                return .object(fields)
            })
            try NativeTrainingProgram.validatePlan(updated)
            save(updated)
            dismiss()
        } catch { issue = error.localizedDescription }
    }

    static func prescription(_ move: NativeJSON) -> String {
        let sets = move["sets"].number.formatted()
        let reps = move["reps"].number.formatted()
        let seconds = move["seconds"].number
        let target = seconds > 0 ? "\(seconds.formatted()) 秒" : move["repsMax"] != .null ? "\(reps)–\(move["repsMax"].number.formatted()) 次" : "\(reps) 次"
        let load = move["weight"].number
        return "\(sets) 组 × \(target)" + (load > 0 ? " · \(load.formatted()) \(move["unit"].string)" : "")
    }

    private enum CatalogueSelection: Identifiable {
        case add(Bool), replace(Int)
        var id: String {
            switch self {
            case .add(let warmup): return warmup ? "warmup" : "work"
            case .replace(let index): return "replace-\(index)"
            }
        }
    }
}
