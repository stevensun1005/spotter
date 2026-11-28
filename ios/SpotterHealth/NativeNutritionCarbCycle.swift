import SwiftUI

@MainActor
struct NativeNutritionCarbCycleSettings: View {
    private typealias CarbDay = NativeNutritionCarbCycle.Day

    private enum Mode: String, CaseIterable {
        case target = "跟随营养目标"
        case fixed = "固定克数"
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    let api: NativeAPI
    let owner: String
    let date: Date
    let payload: NutritionPayload
    let onOpenGoals: () -> Void
    @State private var mode: Mode
    @State private var days: [CarbDay]
    @State private var fixedGrams: [String: String]
    @State private var busy = false
    @State private var error: String?

    private static let weekdayTitles = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    init(api: NativeAPI, owner: String, date: Date, payload: NutritionPayload, onOpenGoals: @escaping () -> Void) {
        self.api = api
        self.owner = owner
        self.date = date
        self.payload = payload
        self.onOpenGoals = onOpenGoals
        let saved = payload.rows.first { $0.kind == "nutrition-plan" }?.carbCycle
        let base = payload.plannedTargets(on: spotterDay(date), carbCycle: nil)
        let followsTarget = saved == nil || saved?.basis == .target
        let grams = followsTarget ? NativeNutritionCarbCycle.grams(from: base.carbs) : saved?.grams ?? [:]
        let schedule = saved?.days.compactMap(CarbDay.init(rawValue:)) ?? []
        _mode = State(initialValue: followsTarget ? .target : .fixed)
        _fixedGrams = State(initialValue: grams.mapValues(nutritionInput))
        _days = State(initialValue: schedule.count == 7 ? schedule : Array(repeating: .medium, count: 7))
    }

    private var savedPlan: NutritionPayload.Row? { payload.rows.first { $0.kind == "nutrition-plan" } }
    private var base: NutritionPayload.Values { payload.plannedTargets(on: spotterDay(date), carbCycle: nil) }
    private var draft: NativeNutritionCarbCycle? {
        let kinds = days.map(\.rawValue)
        if mode == .target {
            return .init(days: kinds, grams: NativeNutritionCarbCycle.grams(from: base.carbs), basis: .target)
        }
        let amounts = CarbDay.allCases.compactMap { fixedGrams[$0.rawValue].flatMap(nutritionValue) }
        let limit = NativeNutritionCarbCycle.maximumGrams
        guard amounts.count == 3, amounts.allSatisfy({ (0...limit).contains($0) }),
              amounts[0] <= amounts[1], amounts[1] <= amounts[2] else { return nil }
        return .init(days: kinds, grams: Dictionary(uniqueKeysWithValues: zip(CarbDay.allCases.map(\.rawValue), amounts)))
    }

    var body: some View {
        let draft = self.draft
        NativeNutritionSheet(title: "碳循环设置", busy: busy) {
            Section {
                baseTarget
                SpotterSegments("碳水计算方式", options: Mode.allCases, value: $mode) { $0.rawValue }
            } header: {
                Text("目标基准")
            } footer: {
                Text(mode == .target ? "营养目标或减脂阶段变化时，各档碳水会自动重新计算。" : "调整营养目标后，各档碳水仍按这里填写的克数计算。")
            }
            Section {
                ForEach(CarbDay.allCases, id: \.self) { tierRow($0, draft: draft) }
            } header: {
                Text("碳水档位")
            } footer: {
                if mode == .fixed && draft == nil {
                    Text("请输入 0–1500 克，低碳 ≤ 中碳 ≤ 高碳。")
                } else {
                    Text("碳水每增减 1 克，热量相应增减 4 千卡。蛋白质和脂肪沿用当日目标。")
                }
            }
            Section {
                let dates = SpotterWeekDateStrip.dates(containing: date)
                ForEach(dates.indices, id: \.self) { index in
                    scheduleRow(index: index, date: dates[index], draft: draft)
                }
            } header: {
                Text("每周安排与预览")
            } footer: {
                Text("按周重复。预览为所选日期所在的一周，不含单独计入的运动消耗。")
            }
            Section {
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                Button(busy ? "保存中…" : "保存碳循环") {
                    if let draft { Task { await save(draft) } }
                }
                    .buttonStyle(.spotterPrimaryControl)
                    .disabled(busy || draft == nil)
                    .accessibilityIdentifier("nutrition-cycle-save")
                if savedPlan?.carbCycle != nil {
                    Button("停用碳循环", role: .destructive) { Task { await save(nil) } }
                        .disabled(busy)
                }
            }
        }
        .disabled(busy)
    }

    private var baseTarget: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "target")
                .font(.body.weight(.semibold))
                .foregroundStyle(accent.tint)
                .frame(width: 36, height: 36)
                .background(accent.selection, in: RoundedRectangle(cornerRadius: 10))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("当日营养目标").font(.subheadline.weight(.semibold))
                Text(base.calories > 0
                     ? "\(nutritionNumber(base.calories)) 千卡 · 碳水 \(nutritionNumber(base.carbs)) g"
                     : "设置热量目标后，碳循环会应用到饮食记录。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted).monospacedDigit()
            }
            Spacer(minLength: 0)
            Button("编辑", action: onOpenGoals)
                .buttonStyle(.borderless)
                .font(.footnote.weight(.semibold))
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("编辑营养目标")
        }
    }

    private func tierRow(_ tier: CarbDay, draft: NativeNutritionCarbCycle?) -> some View {
        let name = tier.rawValue
        return LabeledContent {
            if mode == .target {
                Text(base.calories > 0 ? "\(nutritionNumber(draft?.grams[name] ?? 0)) g" : "—")
                    .font(.subheadline.weight(.semibold))
            } else {
                HStack(spacing: 6) {
                    TextField("0", text: Binding(get: { fixedGrams[name, default: ""] }, set: { fixedGrams[name] = $0 }))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .accessibilityLabel("\(name)碳水，单位克")
                        .accessibilityIdentifier("nutrition-cycle-grams-\(name)")
                    Text("g").foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Circle().fill(tint(tier)).frame(width: 7, height: 7).accessibilityHidden(true)
                Text(name).font(.subheadline.weight(.semibold))
                if mode == .target {
                    Text(tier.share, format: .percent).font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }
        }
        .monospacedDigit()
    }

    private func scheduleRow(index: Int, date: Date, draft: NativeNutritionCarbCycle?) -> some View {
        let weekday = Self.weekdayTitles[index]
        let selected = days[index]
        let color = tint(selected)
        let target = draft.map { payload.plannedTargets(on: spotterDay(date), carbCycle: $0) }
        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text(weekday).font(.subheadline.weight(.semibold))
                if let target, target.calories > 0 {
                    Text("碳水 \(nutritionNumber(target.carbs)) g · \(nutritionNumber(target.calories)) 千卡")
                        .font(.caption).foregroundStyle(SpotterPalette.muted).monospacedDigit()
                } else if mode == .fixed, let grams = draft?.grams[selected.rawValue] {
                    Text("碳水 \(nutritionNumber(grams)) g").font(.caption).foregroundStyle(SpotterPalette.muted).monospacedDigit()
                }
            }
            Spacer(minLength: 0)
            SpotterMenuPicker(weekday + "碳水档位", selection: $days[index], options: CarbDay.allCases.map { ($0, $0.rawValue) }) {
                HStack(spacing: 5) {
                    Text(selected.rawValue).font(.subheadline.weight(.semibold))
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold)).accessibilityHidden(true)
                }
                .foregroundStyle(color)
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(color.opacity(0.12), in: Capsule())
                .frame(minHeight: 44)
            }
            .fixedSize(horizontal: true, vertical: false)
            .accessibilityIdentifier("nutrition-cycle-weekday-\(index)")
        }
    }

    private func tint(_ tier: CarbDay) -> Color {
        switch tier {
        case .low: SpotterAccent.blue.tint
        case .medium: accent.tint
        case .high: SpotterPalette.adaptive(0x80461f, 0xf2b995)
        }
    }

    private func save(_ cycle: NativeNutritionCarbCycle?) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        var record: [String: Any] = ["kind": "nutrition-plan"]
        if let stages = savedPlan?.cut {
            record["cut"] = stages.map { ["date": $0.date, "calories": $0.calories] }
        }
        if let cycle {
            var cycleRecord: [String: Any] = ["days": cycle.days, "grams": cycle.grams]
            if let basis = cycle.basis { cycleRecord["basis"] = basis.rawValue }
            record["carbCycle"] = cycleRecord
        }
        do {
            try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": record])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
