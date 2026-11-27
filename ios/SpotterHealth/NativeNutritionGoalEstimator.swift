import SwiftUI

/// What the person picked in the estimator. Saved with the targets as `preference`.
struct NativeNutritionGoalChoice: Equatable {
    var goal: NativeNutritionGoal?
    var activity: NativeNutritionActivity? {
        didSet {
            guard activity != nil else { return }
            // Picking a level is a choice in the current model, so the training days shown beside it are kept with it.
            activityNeedsReview = false
            if trainingDays == nil { trainingDays = loggedTrainingDays }
        }
    }
    /// nil until the person picks a number, picks an activity level or fills in an estimate. Until then recent workouts are counted.
    var trainingDays: Int?
    var pace = NativeNutritionPace.standard
    /// The saved activity level comes from the earlier estimator, where it also covered exercise, so it has to be picked again.
    private(set) var activityNeedsReview = false
    private let loggedTrainingDays: Int
    private let savedGoal: NativeNutritionGoal?
    private let savedPace: NativeNutritionPace

    /// `loggedTrainingDays` is the weekly count from recent workouts, used until the person has their own number.
    init(preference: NativeJSON?, loggedTrainingDays: Int = 0) {
        let saved = preference ?? .null
        let goal = NativeNutritionGoal(rawValue: saved["goal"].string)
        let activity = NativeNutritionActivity(rawValue: saved["activity"].string)
        self.goal = goal
        savedGoal = goal
        pace = NativeNutritionPace(rawValue: saved["pace"].string) ?? .standard
        savedPace = pace
        self.loggedTrainingDays = min(7, max(0, loggedTrainingDays))
        if case .number(let days) = saved["trainingDays"], let whole = Int(exactly: days), (0...7).contains(whole) {
            trainingDays = whole
            self.activity = activity
        } else {
            // A preference without training days was saved by the earlier estimator.
            activityNeedsReview = activity != nil
        }
    }

    /// Training days the estimate uses: the person's own number, or the count from recent workouts.
    var effectiveTrainingDays: Int { trainingDays ?? loggedTrainingDays }

    /// Nothing was changed on a preference from the earlier estimator, so it stays saved as it is.
    private var keepsSaved: Bool {
        activityNeedsReview && activity == nil && goal != nil && goal == savedGoal && trainingDays == nil && pace == savedPace
    }

    /// Only one of goal and activity is chosen, so the choice cannot be saved.
    var isIncomplete: Bool { !keepsSaved && (goal == nil) != (activity == nil) }

    /// Writes the choice into the saved preference and leaves the rest of it untouched.
    /// With neither goal nor activity chosen the result is empty, which removes the saved preference.
    func merged(into preference: [String: Any]) -> [String: Any] {
        if keepsSaved { return preference }
        guard let goal, let activity else { return goal == nil && activity == nil ? [:] : preference }
        var next = preference
        next["goal"] = goal.rawValue
        next["activity"] = activity.rawValue
        next["trainingDays"] = effectiveTrainingDays
        if goal == .lose || goal == .gain {
            next["pace"] = pace.rawValue
        } else {
            next.removeValue(forKey: "pace")
        }
        // The server accepts a weight range only together with the recomposition goal.
        if goal != .recompose { next.removeValue(forKey: "weightRange") }
        return next
    }
}

/// Body profile and dated readings from `/api/library?section=body`.
struct NativeNutritionGoalBody: Decodable, Sendable {
    struct Reading: Sendable {
        let day: String
        let updated: String
        let value: Double
    }

    struct Snapshot: Sendable {
        let heightCm: Double
        let age: Int
        let male: Bool
        let weightKg: Double
        let bodyFatPercent: Double?
    }

    /// A body-fat reading older than this is not used.
    static let bodyFatMaxAgeDays = 90

    var profile = NativeJSON.null
    var weights: [Reading] = []
    var bodyFat: [Reading] = []

    init(from decoder: Decoder) throws {
        let rows = try NativeJSON(from: decoder)["rows"]
        guard case .array(let items) = rows else { throw NativeAPIError.invalidResponse }
        for row in items {
            let kind = row["kind"].string
            if kind == "body-profile" {
                if profile == .null { profile = row["values"] }
                continue
            }
            let day = row["date"].string
            guard kind == "nutrition", NativeEnergyCalibration.dayNumber(day) != nil else { continue }
            let entry = row["entry"]
            let type = entry["type"].string
            if type == "weight", case .number(let kg) = entry["kg"], kg.isFinite {
                weights.append(Reading(day: day, updated: row["updated"].string, value: kg))
            } else if type == "measurement", entry["metric"].string == "fat", case .number(let percent) = entry["value"], percent.isFinite {
                bodyFat.append(Reading(day: day, updated: row["updated"].string, value: percent))
            }
        }
    }

    private func latest(_ readings: [Reading], through day: String) -> Reading? {
        readings.filter { $0.day <= day }.max(by: { ($0.day, $0.updated) < ($1.day, $1.updated) })
    }

    /// The values the estimate needs as of a day, or nil while height, age, sex or weight is missing.
    func snapshot(on day: String) -> Snapshot? {
        let heightCm = profile["heightCm"].number
        let sex = profile["sex"].string
        guard heightCm > 0, let savedAge = Int(exactly: profile["age"].number), savedAge > 0,
              sex == "male" || sex == "female", let weight = latest(weights, through: day) else { return nil }
        var bodyFatPercent: Double?
        if let fat = latest(bodyFat, through: day), NativeNutritionGoalRules.bodyFatRange.contains(fat.value),
           let measured = NativeEnergyCalibration.dayNumber(fat.day), let today = NativeEnergyCalibration.dayNumber(day),
           today - measured <= Self.bodyFatMaxAgeDays {
            bodyFatPercent = fat.value
        }
        return Snapshot(heightCm: heightCm,
                        age: NativeNutritionGoalInput.age(savedAge, recordedOn: profile["ageAsOf"].string, on: day),
                        male: sex == "male", weightKg: weight.value, bodyFatPercent: bodyFatPercent)
    }
}

private struct NativeNutritionGoalExport: Decodable {
    let library: [NutritionPayload.Row]
}

/// Form rows that work out daily targets from body data, activity, goal and recent records.
@MainActor
struct NativeNutritionGoalEstimator: View {
    private struct Resolved {
        var snapshot: NativeNutritionGoalBody.Snapshot?
        var input: NativeNutritionGoalInput?
        var calibration: NativeEnergyCalibration?
        var estimate: NativeNutritionGoalEstimate?
    }

    let api: NativeAPI
    let owner: String
    @Binding var choice: NativeNutritionGoalChoice
    let targetWeightKg: Double?
    let onApply: (NativeNutritionGoalEstimate) -> Void

    @State private var bodyData: NativeNutritionGoalBody?
    @State private var intake: [String: Double]?
    @State private var loading = true
    @State private var loadError: String?
    @State private var intakeRequested = false
    /// The person's own choice. Before they make one, records are used unless their error is large.
    @State private var recordsChoice: Bool?
    @State private var today = spotterDay()

    private var goalOptions: [(NativeNutritionGoal?, String)] {
        var options: [(NativeNutritionGoal?, String)] = [(nil, "选择目标")]
        for goal in NativeNutritionGoal.allCases { options.append((goal, goal.title)) }
        return options
    }

    private var activityOptions: [(NativeNutritionActivity?, String)] {
        var options: [(NativeNutritionActivity?, String)] = [(nil, "选择活动量")]
        for activity in NativeNutritionActivity.allCases { options.append((activity, activity.title)) }
        return options
    }

    private var trainingOptions: [(Int, String)] {
        var options: [(Int, String)] = [(0, "不训练")]
        for days in 1...7 { options.append((days, "\(days) 天")) }
        return options
    }

    private var paceOptions: [(NativeNutritionPace, String)] {
        guard let goal = choice.goal else { return [] }
        let verb = goal == .lose ? "少吃" : "多吃"
        var options: [(NativeNutritionPace, String)] = []
        for pace in NativeNutritionPace.allCases {
            guard let share = NativeNutritionGoalRules.paceShare(goal, pace) else { continue }
            let percent = Int((share * 100).rounded())
            options.append((pace, "\(pace.title)：每天\(verb)约 \(percent)%"))
        }
        return options
    }

    var body: some View {
        let resolved = resolve()
        Section {
            // One container keeps the task on a row that stays the same row while the status inside it changes.
            VStack(alignment: .leading) { status(resolved) }
                .task(id: owner) { await load() }
            SpotterMenuPicker("目标方向", selection: $choice.goal, options: goalOptions)
            SpotterMenuPicker("日常活动（不含训练）", selection: $choice.activity, options: activityOptions)
            if choice.activityNeedsReview && choice.activity == nil {
                Text("「日常活动」现在只算平时走动，训练另按每周训练天数计，请重新选择。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            SpotterMenuPicker("每周训练", selection: trainingDays, options: trainingOptions)
            if !paceOptions.isEmpty {
                SpotterMenuPicker("进度", selection: $choice.pace, options: paceOptions)
            }
            if let calibration = resolved.calibration { records(calibration) }
            if let estimate = resolved.estimate {
                result(estimate, snapshot: resolved.snapshot)
            } else if let input = resolved.input {
                Text(input.isInRange ? "当前档案不适合此目标，请选择其他目标。" : "当前资料超出成人估算范围，请核对身体档案。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
        } header: {
            Text("按身体数据计算")
        } footer: {
            Text("估算值，适用于健康成年人；孕期、哺乳期或有疾病时请遵医嘱。")
        }
    }

    private var trainingDays: Binding<Int> {
        Binding(get: { choice.effectiveTrainingDays }, set: { choice.trainingDays = $0 })
    }

    /// Whether the records are used for a calibration that is ready.
    private func usesRecords(_ measured: NativeEnergyCalibration.Measurement) -> Bool {
        recordsChoice ?? (measured.confidence != .low)
    }

    @ViewBuilder private func status(_ resolved: Resolved) -> some View {
        if let snapshot = resolved.snapshot {
            let fat = snapshot.bodyFatPercent.map { " · 体脂 \(nutritionNumber($0))%" } ?? ""
            Text("\(nutritionNumber(snapshot.heightCm)) cm · \(amount(snapshot.weightKg)) kg · \(snapshot.age) 岁\(fat)")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        } else if loading {
            ProgressView("正在读取身体数据…")
        } else if let loadError {
            Button(loadError) { Task { await load(retry: true) } }.foregroundStyle(SpotterPalette.accent)
        } else {
            Text("在「设置 → 账号 → 身体档案」填写身高、年龄和性别，并记录体重后即可计算。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        }
    }

    @ViewBuilder private func records(_ calibration: NativeEnergyCalibration) -> some View {
        let weeks = NativeEnergyCalibration.windowDays / 7
        if let measured = calibration.result {
            Toggle("按近 \(weeks) 周的记录校准维持热量",
                   isOn: Binding(get: { usesRecords(measured) }, set: { recordsChoice = $0 }))
            Text(recordsSummary(calibration, measured))
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        } else {
            Text(recordsMissing(calibration, weeks: weeks))
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        }
    }

    private func recordsMissing(_ calibration: NativeEnergyCalibration, weeks: Int) -> String {
        typealias Rules = NativeEnergyCalibration
        switch calibration.missing {
        case .some(.lowDays):
            let share = Int((Rules.maxLowDayShare * 100).rounded())
            return "近 \(weeks) 周的饮食记录里，记得特别少的日子超过 \(share)%，分不清是没记全还是确实吃得少，暂不按记录校准。"
        case .some(.implausible):
            return "按近 \(weeks) 周的记录推算不出合理的维持热量，多半是饮食没记全，暂不按记录校准。"
        default:
            let share = Int((Rules.minLoggedShare * 100).rounded())
            let needed = "近 \(weeks) 周在有饮食记录的日子里称重满 \(Rules.minWeighIns) 天（首尾相隔至少 \(Rules.minSpanDays) 天），其间完整记录至少 \(Rules.minLoggedDays) 天饮食且不少于这些天数的 \(share)%，就可以按实际记录校准。"
            let current = "现在可用的称重有 \(calibration.weighIns) 天，首尾相隔 \(calibration.spanDays) 天，其间完整记录 \(calibration.loggedDays) 天。"
            return needed + current + skippedText(calibration)
        }
    }

    private func recordsSummary(_ calibration: NativeEnergyCalibration, _ measured: NativeEnergyCalibration.Measurement) -> String {
        let change = (measured.weeklyChangeKg > 0 ? "+" : "") + amount(measured.weeklyChangeKg)
        var text = "称重 \(calibration.weighIns) 天，每周 \(change) kg；"
        text += "其间完整饮食记录 \(calibration.loggedDays) 天，日均 \(nutritionNumber(measured.averageIntake)) 千卡；"
        text += "推算维持约 \(nutritionNumber(measured.measuredCalories)) 千卡（±\(nutritionNumber(measured.measuredError))，未计漏记），可信度\(measured.confidence.title)。"
        if calibration.lowDays > 0 { text += "有 \(calibration.lowDays) 天记得特别少，分不清是没记全还是确实吃得少，按一半计入，误差已加大。" }
        if measured.intakeShift { text += "记录期间饮食量有明显变化，体重变化里可能有水分，误差已加大。" }
        switch measured.limit {
        case .low: text += "推算值比公式低很多，可能有漏记的饮食，采用值已限制在合理范围内。"
        case .high: text += "推算值比公式高很多，可能是日常活动选低了，或体重变化里有水分，采用值已限制在合理范围内。"
        case .inside: break
        }
        if measured.confidence == .low { text += "可信度低，默认不采用。" }
        return text + skippedText(calibration)
    }

    private func skippedText(_ calibration: NativeEnergyCalibration) -> String {
        calibration.skippedDays > 0
            ? "饮食记录刚开始，或中断 \(NativeEnergyCalibration.logStartGapDays) 天以上后重新开始时，前 \(calibration.skippedDays) 天不计入，那几天的体重变化里水分多。"
            : ""
    }

    @ViewBuilder private func result(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?) -> some View {
        row("每日热量", "\(nutritionNumber(estimate.calories)) 千卡")
        row("蛋白质 · 碳水 · 脂肪",
            "\(nutritionNumber(estimate.protein)) · \(nutritionNumber(estimate.carbs)) · \(nutritionNumber(estimate.fat)) g")
        Text(explanation(estimate, snapshot: snapshot))
            .font(.footnote).foregroundStyle(SpotterPalette.muted)
        ForEach(estimate.notes, id: \.self) { note in
            Text(noteText(note, estimate)).font(.footnote).foregroundStyle(SpotterPalette.muted)
        }
        Button("填入下方目标") {
            choice.trainingDays = choice.effectiveTrainingDays
            onApply(estimate)
        }
        .foregroundStyle(SpotterPalette.accent)
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).font(.subheadline)
            Spacer(minLength: 8)
            Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }

    private func amount(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    /// Week counts up to this are shown as a soonest date. Longer ones only as a lower bound, because maintenance falls with weight.
    private static let projectionWeeks = 12.0

    /// When the target weight would be reached at the estimated weekly change. Empty when the estimate is moving away from it.
    private func arrival(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?) -> String {
        guard let targetWeightKg, let snapshot, estimate.weeklyChangeKg != 0 else { return "" }
        let weeks = ((targetWeightKg - snapshot.weightKg) / estimate.weeklyChangeKg).rounded(.up)
        guard weeks > 0, weeks < 1000 else { return "" }
        let meters = snapshot.heightCm / 100
        if estimate.weeklyChangeKg < 0 && targetWeightKg <= NativeNutritionGoalRules.minLossBmi * meters * meters {
            return "。目标体重 \(amount(targetWeightKg)) kg 低于偏瘦线（BMI \(amount(NativeNutritionGoalRules.minLossBmi))），不估算到达时间"
        }
        if weeks <= Self.projectionWeeks { return "，最快约 \(Int(weeks)) 周到 \(amount(targetWeightKg)) kg，实际通常会慢一些" }
        return "，到 \(amount(targetWeightKg)) kg 至少要 \(Int(weeks)) 周，体重变化后请重新计算"
    }

    private func explanation(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?) -> String {
        let restingBasis = estimate.usesLeanMass ? "按体脂率和训练量" : "按身高、体重、年龄"
        let maintenanceBasis = estimate.usesRecords ? "按记录校准" : "按活动量"
        var text = "基础代谢约 \(nutritionNumber(estimate.restingCalories)) 千卡（\(restingBasis)），"
        text += "维持约 \(nutritionNumber(estimate.maintenanceCalories)) 千卡（\(maintenanceBasis)）。"
        // Training is already inside maintenance, so adding the same workout to the day's target would count it twice.
        let counted = choice.effectiveTrainingDays > 0 || estimate.usesRecords
            ? "维持热量已包含训练消耗，同一次训练不用再通过「计入运动消耗」加到当天目标。" : ""
        guard estimate.adjustmentCalories != 0 else { return text + "按维持热量吃。" + counted }
        let gaining = estimate.adjustmentCalories > 0
        let eating = gaining ? "多吃" : "少吃"
        let direction = gaining ? "增" : "减"
        text += "每天\(eating) \(nutritionNumber(abs(estimate.adjustmentCalories))) 千卡，"
        text += "预计每周约\(direction) \(amount(abs(estimate.weeklyChangeKg))) kg"
        return text + arrival(estimate, snapshot: snapshot) + "。" + counted
    }

    private func noteText(_ note: NativeNutritionGoalEstimate.Note, _ estimate: NativeNutritionGoalEstimate) -> String {
        typealias Rules = NativeNutritionGoalRules
        let floors = "男性 \(Int(Rules.calorieFloor(male: true)))、女性 \(Int(Rules.calorieFloor(male: false))) 千卡"
        // Advice to slow down is only given when a slower pace exists and would change the target.
        let canSlow = estimate.adjustmentCalories < 0 && choice.pace != .slow
        switch note {
        case .recordsTooLow:
            return "按记录推算的维持热量低于最低摄入量，多半是饮食没记全，这次按公式估算。"
        case .paceLimited:
            let loss = "减重每周不超过体重的 \(amount(Rules.maxWeeklyLossShare * 100))%、每天最多少吃 \(Int(Rules.maxDailyDeficit)) 千卡"
            let gain = "增重每周不超过 \(amount(Rules.maxWeeklyGainShare * 100))%、每天最多多吃 \(Int(Rules.maxDailySurplus)) 千卡"
            return "已放慢进度：\(loss)；\(gain)。"
        case .nearUnderweight:
            guard estimate.adjustmentCalories < 0 else { return "体重已接近偏瘦线（BMI \(amount(Rules.minLossBmi))），这次没有设缺口。" }
            return "体重接近偏瘦线（BMI \(amount(Rules.minLossBmi))），已放慢进度：按这个速度 \(Int(Rules.lowWeightWeeks)) 周内不会低于偏瘦线。"
        case .calorieFloor:
            return "已上调到最低摄入量（\(floors)），缺口比所选进度小。"
        case .belowFloor:
            let reason = choice.goal == .lose ? "因为估算的维持热量本身就低，所以没有设缺口。" : "因为估算的维持热量本身就低。"
            return "这个热量低于一般的最低摄入量（\(floors)），\(reason)长期吃这么少不容易吃够营养，建议先问医生或营养师。"
        case .proteinLimited:
            return "蛋白质已限制在总热量的 \(amount(Rules.proteinMaxShare * 100))% 以内。"
        case .lowCarbs:
            return "碳水低于 \(Int(Rules.lowCarbGrams)) g，训练状态可能受影响。"
                + (canSlow && !estimate.notes.contains(.calorieFloor) ? "可以放慢进度。" : "")
        case .largeDeficit:
            return "每天少吃超过 \(Int(Rules.muscleGainDeficit)) 千卡时，力量训练很难再长肌肉。" + (canSlow ? "想边减脂边增肌，可以选慢一些的进度。" : "")
        }
    }

    private func resolve() -> Resolved {
        var resolved = Resolved()
        guard let bodyData, let snapshot = bodyData.snapshot(on: today) else { return resolved }
        resolved.snapshot = snapshot
        guard let goal = choice.goal, let activity = choice.activity else { return resolved }
        var input = NativeNutritionGoalInput(age: snapshot.age, male: snapshot.male, heightCm: snapshot.heightCm,
                                             weightKg: snapshot.weightKg, activity: activity, trainingDays: choice.effectiveTrainingDays,
                                             goal: goal, pace: choice.pace, bodyFatPercent: snapshot.bodyFatPercent)
        resolved.input = input
        guard let formula = input.estimate() else { return resolved }
        resolved.estimate = formula
        guard let intake else { return resolved }
        let calibration = NativeEnergyCalibration.measure(
            through: today, intake: intake.map { (day: $0.key, calories: $0.value) },
            weights: bodyData.weights.map { (day: $0.day, kg: $0.value) },
            formulaCalories: formula.maintenanceCalories, restingCalories: formula.restingCalories)
        resolved.calibration = calibration
        if let measured = calibration.result, usesRecords(measured) {
            input.measuredMaintenance = measured.calories
            resolved.estimate = input.estimate() ?? formula
        }
        return resolved
    }

    /// Reads the body data once, then the food records once. After a failure only the retry button reads again,
    /// so a task that SwiftUI restarts cannot loop.
    private func load(retry: Bool = false) async {
        if bodyData == nil {
            guard retry || loadError == nil else { return }
            loading = true
            loadError = nil
            // A cancelled run leaves the spinner to the run that replaced it.
            defer { if !Task.isCancelled { loading = false } }
            today = spotterDay()
            do {
                let data = try await api.request("/api/library?section=body", method: "GET", json: nil, for: owner)
                try Task.checkCancellation()
                bodyData = try JSONDecoder().decode(NativeNutritionGoalBody.self, from: data)
            } catch is CancellationError {
                return
            } catch {
                // A cancelled request is not a failure the person has to retry.
                if !Task.isCancelled { loadError = "身体数据读取失败，点此重试。" }
                return
            }
        }
        guard intake == nil, !intakeRequested else { return }
        intakeRequested = true
        let now = Date.now
        // Calibration is optional. The formula estimate works without these records.
        let calendar = Calendar.current
        guard let first = calendar.date(byAdding: .day, value: -NativeEnergyCalibration.foodDays, to: now),
              let last = calendar.date(byAdding: .day, value: -1, to: now) else { return }
        let path = "/api/data?scope=nutrition&from=\(spotterDay(first))&to=\(spotterDay(last))"
        guard let data = try? await api.request(path, method: "GET", json: nil, for: owner), !Task.isCancelled else {
            // Cancelled before an answer came: the next run asks again. A failed request is not repeated.
            if Task.isCancelled { intakeRequested = false }
            return
        }
        let totals = await Task.detached(priority: .utility) { () -> [String: Double]? in
            guard let export = try? JSONDecoder().decode(NativeNutritionGoalExport.self, from: data) else { return nil }
            var totals: [String: Double] = [:]
            for row in export.library {
                guard row.kind == "nutrition", let day = row.date, let entry = row.entry, entry.type == "meal" else { continue }
                totals[day, default: 0] += entry.calories ?? 0
            }
            return totals
        }.value
        if Task.isCancelled {
            intakeRequested = false
        } else if let totals {
            intake = totals
        }
    }
}
