import SwiftUI

/// What the person picked in the estimator. Saved with the targets as `preference`.
private struct NativeNutritionGoalChoice {
    var goal: NativeNutritionGoal?
    var activitySource: NativeNutritionActivitySource
    var manualActivity: NativeNutritionActivity? {
        didSet {
            guard manualActivity != nil else { return }
            // Picking a level is a choice in the current model, so the training days shown beside it are kept with it.
            activityNeedsReview = false
            if activitySource == .manual && trainingDays == nil { trainingDays = loggedTrainingDays }
        }
    }
    /// nil until the person picks a number or an activity level. Until then recent workouts are counted.
    var trainingDays: Int?
    var pace = NativeNutritionPace.standard
    /// The saved activity level comes from the earlier estimator, where it also covered exercise, so it has to be picked again.
    private(set) var activityNeedsReview = false
    private let loggedTrainingDays: Int

    /// `loggedTrainingDays` is the weekly count from recent workouts, used until the person has their own number.
    init(preference: NativeJSON?, loggedTrainingDays: Int = 0, activitySource: NativeNutritionActivitySource = .manual,
         manualActivity: NativeNutritionActivity? = nil) {
        let saved = preference ?? .null
        let goal = NativeNutritionGoal(rawValue: saved["goal"].string)
        let activity = NativeNutritionActivity(rawValue: saved["activity"].string)
        self.goal = goal
        self.activitySource = activitySource
        pace = NativeNutritionPace(rawValue: saved["pace"].string) ?? .standard
        self.loggedTrainingDays = min(7, max(0, loggedTrainingDays))
        let savedDays: Int?
        if case .number(let days) = saved["trainingDays"], let whole = Int(exactly: days), (0...7).contains(whole) {
            savedDays = whole
        } else {
            savedDays = nil
        }
        if activitySource != .manual {
            self.manualActivity = manualActivity
        } else if let savedDays {
            trainingDays = savedDays
            self.manualActivity = activity ?? manualActivity
        } else if let manualActivity {
            self.manualActivity = manualActivity
        } else {
            // A preference without training days was saved by the earlier estimator.
            activityNeedsReview = activity != nil
        }
    }

    /// Training days the estimate uses: the person's own number, or the count from recent workouts.
    var effectiveTrainingDays: Int { trainingDays ?? loggedTrainingDays }
    var recentTrainingDays: Int { loggedTrainingDays }

    func merged(into preference: [String: Any], input: NativeNutritionGoalInput) -> [String: Any] {
        let goal = input.goal
        var next = preference
        next["goal"] = goal.rawValue
        next["activity"] = input.activity.rawValue
        next["trainingDays"] = input.trainingDays
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
    struct Snapshot: Sendable {
        let heightCm: Double
        let age: Int
        let male: Bool
        let weightKg: Double
        let bodyFatPercent: Double?
    }

    var profile = NativeJSON.null
    var weights: [NativeNutritionGoalReading] = []
    var bodyFat: [NativeNutritionGoalReading] = []

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
                weights.append(NativeNutritionGoalReading(day: day, updated: row["updated"].string, value: kg))
            } else if type == "measurement", entry["metric"].string == "fat", case .number(let percent) = entry["value"], percent.isFinite {
                bodyFat.append(NativeNutritionGoalReading(day: day, updated: row["updated"].string, value: percent))
            }
        }
    }

    private func latest(_ readings: [NativeNutritionGoalReading], through day: String) -> NativeNutritionGoalReading? {
        readings.filter { $0.day <= day }.max(by: { ($0.day, $0.updated) < ($1.day, $1.updated) })
    }

    /// The values the estimate needs as of a day, or nil while height, age, sex or weight is missing.
    func snapshot(on day: String) -> Snapshot? {
        Self.snapshot(profile: profile, weightKg: latest(weights, through: day)?.value,
                      bodyFatPercent: NativeNutritionGoalRules.latestBodyFat(bodyFat, through: day)?.value, on: day)
    }

    static func snapshot(profile: NativeJSON, weightKg: Double?, bodyFatPercent: Double? = nil, on day: String) -> Snapshot? {
        let heightCm = profile["heightCm"].number
        let sex = profile["sex"].string
        guard heightCm > 0, let savedAge = Int(exactly: profile["age"].number), savedAge > 0,
              sex == "male" || sex == "female", let weightKg else { return nil }
        return Snapshot(heightCm: heightCm,
                        age: NativeNutritionGoalInput.age(savedAge, recordedOn: profile["ageAsOf"].string, on: day),
                        male: sex == "male", weightKg: weightKg, bodyFatPercent: bodyFatPercent)
    }
}

private struct NativeNutritionGoalExport: Decodable {
    let library: [NutritionPayload.Row]
}

/// Works out daily targets from body data, activity, goal and recent records.
@MainActor
struct NativeNutritionGoalEstimator: View {
    private struct Resolved {
        var snapshot: NativeNutritionGoalBody.Snapshot?
        var input: NativeNutritionGoalInput?
        var calibration: NativeEnergyCalibration?
        var estimate: NativeNutritionGoalEstimate?
    }

    private enum HealthReadStatus {
        case unavailable, needsAccess, reading, insufficient, failed
        case ready(NativeNutritionActivityEvidence)

        var needsFallback: Bool {
            switch self {
            case .unavailable, .needsAccess, .insufficient, .failed: return true
            case .reading, .ready: return false
            }
        }
    }

    private struct HealthReadKey: Equatable {
        let owner: String
        let day: String
        let timeZone: String
        let revision: Int
        let enabled: Bool
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(\.scenePhase) private var scenePhase

    private let api: NativeAPI
    private let owner: String
    private let savedTargets: NutritionPayload.Row?
    private let plannedWorkouts: [NativeWorkoutEntry]?
    private let onBodyProfileSaved: @MainActor (NativeAnatomyVariant?) -> Void
    @State private var choice: NativeNutritionGoalChoice
    @State private var saving = false
    @State private var saveError: String?

    @State private var showsBodyProfile = false
    @State private var bodyData: NativeNutritionGoalBody?
    @State private var intake: [String: Double]?
    @State private var loading = true
    @State private var loadError: String?
    @State private var intakeLoading = false
    @State private var intakeLoadFailed = false
    /// The person's own choice. Before they make one, records are used unless their error is large.
    @State private var recordsChoice: Bool?
    @State private var today = spotterDay()
    @State private var timeZone = TimeZone.current.identifier
    @State private var healthReader = HealthKitReader()
    @State private var healthReadResult: (key: HealthReadKey, status: HealthReadStatus)?
    @State private var requestedHealthAccess: Bool
    @State private var requestingHealthAccess = false
    @State private var healthAccessFailed = false
    @State private var healthRevision = 0

    init(api: NativeAPI, owner: String, savedTargets: NutritionPayload.Row?, logs: [NativeWorkoutEntry],
         plannedWorkouts: [NativeWorkoutEntry]? = nil,
         onBodyProfileSaved: @escaping @MainActor (NativeAnatomyVariant?) -> Void) {
        self.api = api
        self.owner = owner
        self.savedTargets = savedTargets
        self.plannedWorkouts = plannedWorkouts
        self.onBodyProfileSaved = onBodyProfileSaved
        let trained = logs.filter { $0.owner == owner }.map(\.day)
        let preferences = NativeNutritionEstimatePreferences.read(api: api, owner: owner)
        _choice = State(initialValue: NativeNutritionGoalChoice(
            preference: savedTargets?.preference,
            loggedTrainingDays: NativeNutritionGoalInput.weeklyTrainingDays(trained, today: spotterDay()),
            activitySource: preferences?.source ?? .manual,
            manualActivity: preferences?.manualActivity.flatMap(NativeNutritionActivity.init(rawValue:))))
        let healthPreferences = NativeHealthPreferences(origin: api.origin, owner: owner)
        _requestedHealthAccess = State(initialValue: healthPreferences.hasRequestedNativeAccess
            || UserDefaults.standard.bool(forKey: healthPreferences.key("nutritionActivityRequested")))
    }

    private var usesHealth: Bool { choice.activitySource == .appleHealth || choice.activitySource == .automatic }
    private var usesCalendar: Bool { choice.activitySource == .calendar || choice.activitySource == .automatic }
    private var healthKey: HealthReadKey {
        HealthReadKey(owner: owner, day: today, timeZone: timeZone, revision: healthRevision,
                      enabled: usesHealth && requestedHealthAccess)
    }

    private var healthStatus: HealthReadStatus {
        if !HealthKitReader.nativeDataAvailable { return .unavailable }
        if !requestedHealthAccess { return .needsAccess }
        guard let healthReadResult, healthReadResult.key == healthKey else { return .reading }
        return healthReadResult.status
    }

    private var calendarEvidence: NativeNutritionCalendarActivity? {
        guard let plannedWorkouts else { return nil }
        let sessions = plannedWorkouts.lazy.filter { $0.owner == owner && $0.kind == "plan" }.map { plan in
            (id: plan.id, day: plan.day, minutes: Int(exactly: plan.data["minutes"].number) ?? 0)
        }
        return NativeNutritionCalendarActivity.upcoming(Array(sessions), today: today)
    }

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
        let schedule = usesCalendar ? calendarEvidence : nil
        let resolved = resolve(schedule: schedule)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    profileCard(resolved)
                    settingsCard(schedule: schedule)
                    if let estimate = resolved.estimate, let input = resolved.input {
                        result(estimate, snapshot: resolved.snapshot, trainingDays: input.trainingDays)
                    } else if let input = resolved.input {
                        Text(input.isInRange ? "当前身体档案不适用这个目标，请选择其他目标。" : "当前资料超出成人估算范围，请核对身体档案。")
                            .font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }
                    if let calibration = resolved.calibration {
                        recordsCard(calibration)
                    } else if !usesCalendar && resolved.estimate != nil && (intakeLoading || intakeLoadFailed) {
                        recordsStatus
                    }
                    Text("估算适用于健康成年人。孕期、哺乳期或有疾病时请遵医嘱。")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        .padding(.horizontal, 4)
                }
                .frame(maxWidth: 540)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity)
            }
            .disabled(saving)
            .background(SpotterPalette.background.ignoresSafeArea())
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if let estimate = resolved.estimate, let input = resolved.input {
                    saveBar(estimate, input: input)
                }
            }
            .navigationTitle("营养目标")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showsBodyProfile) {
                NativeBodyData(api: api, owner: owner, returnsToNutritionEstimate: true, onProfileSaved: onBodyProfileSaved)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { NutritionDismissButton { dismiss() }.disabled(saving) }
            }
        }
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(saving)
        .task(id: showsBodyProfile) {
            guard !showsBodyProfile else { return }
            await load(refreshBody: bodyData != nil || loadError != nil)
        }
        .task(id: healthKey) { await readHealthActivity(healthKey) }
        .onChange(of: usesCalendar) { includesCalendar in
            if !includesCalendar, bodyData?.snapshot(on: today) != nil {
                Task { await loadIntake() }
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active { refreshCivilDay() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
            refreshCivilDay()
        }
    }

    private var trainingDays: Binding<Int> {
        Binding(get: { choice.effectiveTrainingDays }, set: { choice.trainingDays = $0 })
    }

    @ViewBuilder private func profileCard(_ resolved: Resolved) -> some View {
        if !loading && resolved.snapshot == nil && loadError == nil {
            Button { showsBodyProfile = true } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        heading("身体档案", icon: "person.crop.circle")
                        Text("补齐身高、年龄、性别和体重后继续估算")
                            .font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                        .foregroundStyle(accent.tint).accessibilityHidden(true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .spotterCard(radius: 20)
            }
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("nutrition-estimator-open-body-profile")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                heading("身体档案", icon: "person.crop.circle")
                if loading {
                    ProgressView("正在读取身体数据…")
                        .font(.footnote)
                } else if let snapshot = resolved.snapshot {
                    let details = [
                        "\(nutritionNumber(snapshot.heightCm)) cm",
                        "\(amount(snapshot.weightKg)) kg",
                        "\(snapshot.age) 岁",
                        snapshot.bodyFatPercent.map { "体脂 \(nutritionNumber($0))%" }
                    ].compactMap { $0 }
                    Text(details.joined(separator: " · "))
                        .font(.subheadline.weight(.medium).monospacedDigit())
                        .accessibilityIdentifier("nutrition-estimator-profile")
                } else if let loadError {
                    Text(loadError).font(.footnote).foregroundStyle(SpotterPalette.muted)
                    Button("重试") { Task { await load(retry: true) } }
                        .buttonStyle(.spotterControl)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .spotterCard(radius: 20)
        }
    }

    private func settingsCard(schedule: NativeNutritionCalendarActivity?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            heading("目标与活动", icon: "slider.horizontal.3")
                .padding(.bottom, 2)
            optionLink("目标方向", value: choice.goal?.title ?? "选择目标", id: "goal") {
                NativeNutritionGoalOptions(title: "目标方向", detail: nil, selection: $choice.goal, options: goalOptions) {
                    Section {
                        NavigationLink {
                            NativeManualNutritionGoalForm(values: savedTargets?.values ?? .init(), saving: saving) { values in
                                await saveTargets(values)
                            }
                        } label: {
                            Label("手动填写", systemImage: "square.and.pencil")
                                .frame(minHeight: 44)
                        }
                        .accessibilityIdentifier("nutrition-goals-open-manual")
                        .listRowBackground(SpotterPalette.card)
                    }
                }
            }
            option("日常活动", selection: $choice.activitySource,
                   options: NativeNutritionActivitySource.allCases.map { ($0, $0.title) }, id: "activity-source")
            if usesHealth {
                healthActivityStatus
            }
            if !usesHealth || (choice.activitySource == .automatic && healthStatus.needsFallback) {
                option("平时走动", detail: "不含训练", selection: $choice.manualActivity, options: activityOptions, id: "activity")
                if choice.activityNeedsReview && choice.manualActivity == nil {
                    activityNote("平时走动不含训练。请选择当前的活动量。")
                }
            }
            if usesCalendar {
                calendarActivityStatus(schedule)
            } else if choice.activitySource == .manual {
                option("每周训练", selection: trainingDays, options: trainingOptions, id: "training-days")
            }
            if !paceOptions.isEmpty {
                option("进度", selection: $choice.pace, options: paceOptions, id: "pace")
            }
        }
        .padding(14)
        .spotterCard(radius: 20)
    }

    @ViewBuilder private var healthActivityStatus: some View {
        let lookback = NativeNutritionHealthActivity.lookbackDays
        let minimum = NativeNutritionActivityEvidence.minimumDays
        switch healthStatus {
        case .unavailable:
            activityNote("这台设备无法读取 Apple 健康。")
        case .needsAccess:
            activityNote("用近 \(lookback) 个完整日的步数估算平时走动，需至少有 \(minimum) 天记录。")
            Button(requestingHealthAccess ? "正在连接…" : "连接 Apple 健康") {
                Task { await requestHealthAccess() }
            }
            .buttonStyle(.spotterControl)
            .disabled(requestingHealthAccess)
            .accessibilityIdentifier("nutrition-estimator-connect-health")
            if healthAccessFailed { activityNote("读取授权未完成，请重试。") }
        case .reading:
            ProgressView("正在读取 Apple 健康…").font(.footnote)
                .padding(.horizontal, 4)
        case .insufficient, .failed:
            if case .insufficient = healthStatus {
                activityNote("近 \(lookback) 天的有效步数不足 \(minimum) 天。请确认「健康」已允许读取步数和体能训练。")
            } else {
                activityNote("Apple 健康暂时读不到数据。")
            }
            Button("重新读取") { healthRevision &+= 1 }
                .buttonStyle(.spotterControl)
        case .ready(let evidence):
            VStack(alignment: .leading, spacing: 3) {
                Text("Apple 健康 · 近 \(lookback) 天")
                    .font(.footnote.weight(.semibold))
                Text("平时日均约 \(nutritionNumber(Double(evidence.averageSteps))) 步 · \(evidence.observedDays) 天有记录")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                if choice.activitySource == .appleHealth {
                    Text("平均每周训练 \(evidence.trainingDays) 天").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }
            .padding(.horizontal, 4)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("nutrition-estimator-health-evidence")
        }
        if choice.activitySource == .automatic && healthStatus.needsFallback {
            activityNote("可先用手动活动量配合训练日历估算。")
        }
    }

    @ViewBuilder private func calendarActivityStatus(_ schedule: NativeNutritionCalendarActivity?) -> some View {
        if let schedule {
            VStack(alignment: .leading, spacing: 3) {
                Text("训练日历 · 未来 \(NativeNutritionCalendarActivity.horizonDays) 天")
                    .font(.footnote.weight(.semibold))
                Text(schedule.sessionCount == 0 ? "没有已排训练" :
                    "\(schedule.sessionCount) 堂 · \(schedule.trainingDays) 天 · 约 \(schedule.trainingMinutes) 分钟")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                if choice.activitySource == .automatic {
                    Text("建议值按周平均。跨天或日历有改动时重新估算。")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }
            .padding(.horizontal, 4)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("nutrition-estimator-calendar-evidence")
        } else {
            activityNote("训练日历还未载入。可以稍后重试，也可以先用手动估算。")
        }
    }

    private func activityNote(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.horizontal, 4)
    }

    private func option<Value: Hashable>(_ title: String, detail: String? = nil, selection: Binding<Value>,
                                         options: [(Value, String)], id: String) -> some View {
        let value = options.first { $0.0 == selection.wrappedValue }?.1 ?? "未选择"
        return optionLink(title, detail: detail, value: value, id: id) {
            NativeNutritionGoalOptions(title: title, detail: detail, selection: selection, options: options) {}
        }
    }

    private func optionLink<Destination: View>(_ title: String, detail: String? = nil, value: String, id: String,
                                               @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    optionTitle(title, detail: detail).fixedSize(horizontal: true, vertical: false)
                    Spacer(minLength: 0)
                    optionValue(value).fixedSize(horizontal: true, vertical: false)
                }
                VStack(alignment: .leading, spacing: 5) {
                    optionTitle(title, detail: detail)
                    optionValue(value)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 7)
        }
        .buttonStyle(.spotterControl)
        .accessibilityIdentifier("nutrition-estimator-\(id)")
        .accessibilityLabel(title)
        .accessibilityValue(value)
        .accessibilityHint(detail ?? "")
    }

    private func optionTitle(_ title: String, detail: String?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
            if let detail { Text(detail).font(.caption).foregroundStyle(SpotterPalette.muted) }
        }
    }

    private func optionValue(_ value: String) -> some View {
        HStack(spacing: 6) {
            Text(value).font(.footnote.weight(.medium)).foregroundStyle(accent.tint)
            Image(systemName: "chevron.right")
                .font(.caption2.weight(.bold)).foregroundStyle(SpotterPalette.muted)
                .accessibilityHidden(true)
        }
    }

    private func heading(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .labelStyle(.titleAndIcon)
            .font(.headline)
            .accessibilityAddTraits(.isHeader)
    }

    /// Whether the records are used for a calibration that is ready.
    private func usesRecords(_ measured: NativeEnergyCalibration.Measurement) -> Bool {
        recordsChoice ?? (measured.confidence != .low)
    }

    private func recordsCard(_ calibration: NativeEnergyCalibration) -> some View {
        let weeks = NativeEnergyCalibration.windowDays / 7
        return VStack(alignment: .leading, spacing: 8) {
            heading("饮食与体重校准", icon: "chart.line.uptrend.xyaxis")
            if let measured = calibration.result {
                Toggle("采用近 \(weeks) 周记录",
                       isOn: Binding(get: { usesRecords(measured) }, set: { recordsChoice = $0 }))
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("nutrition-estimator-use-records")
                Text("推算维持约 \(nutritionNumber(measured.measuredCalories)) 千卡/天 · 可信度\(measured.confidence.title)")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                SpotterDisclosure("校准依据") {
                    Text(recordsSummary(calibration, measured))
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        .padding(.horizontal, 4)
                }
            } else {
                SpotterDisclosure("查看校准条件") {
                    Text(recordsMissing(calibration, weeks: weeks))
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        .padding(.horizontal, 4)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .spotterCard(radius: 20)
    }

    private var recordsStatus: some View {
        VStack(alignment: .leading, spacing: 8) {
            heading("饮食与体重校准", icon: "chart.line.uptrend.xyaxis")
            if intakeLoading {
                ProgressView("正在读取近四周记录…")
                    .font(.footnote)
            } else {
                Text("记录读取失败，当前目标按身体档案和活动量估算。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                Button("重试读取记录") { Task { await loadIntake(retry: true) } }
                    .buttonStyle(.spotterControl)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .spotterCard(radius: 20)
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
        var text = "称重 \(calibration.weighIns) 天，体重每周变化 \(change) kg。"
        text += "其间完整饮食记录 \(calibration.loggedDays) 天，日均 \(nutritionNumber(measured.averageIntake)) 千卡。"
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

    private func result(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?,
                        trainingDays: Int) -> some View {
        let layout = textSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 7))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 8))
        let calories = nutritionNumber(estimate.calories)
        return VStack(alignment: .leading, spacing: 12) {
            heading("每日目标估算", icon: "bolt.circle")
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    calorieAmount(calories).fixedSize(horizontal: true, vertical: false)
                    calorieUnit.fixedSize(horizontal: true, vertical: false)
                }
                VStack(alignment: .leading, spacing: 2) {
                    calorieAmount(calories)
                    calorieUnit
                }
            }
            layout {
                macro("碳水", grams: estimate.carbs, color: 0x7764c3)
                macro("蛋白质", grams: estimate.protein, color: 0xbd632f)
                macro("脂肪", grams: estimate.fat, color: 0xbd5061)
            }
            SpotterDisclosure("查看估算依据") {
                Text(explanation(estimate, snapshot: snapshot, trainingDays: trainingDays))
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                    .padding(.horizontal, 4)
            }
            if !estimate.notes.isEmpty {
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(estimate.notes, id: \.self) { note in
                        Label {
                            Text(noteText(note, estimate))
                        } icon: {
                            Image(systemName: "info.circle").accessibilityHidden(true)
                        }
                    }
                }
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
                .padding(.horizontal, 4)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 20)
                .fill(.linearGradient(colors: [SpotterPalette.adaptive(0xeaf6ff, 0x253846), SpotterPalette.card],
                                      startPoint: .topLeading, endPoint: .bottomTrailing))
        }
        .spotterCard(radius: 20)
    }

    private func calorieAmount(_ value: String) -> some View {
        Text(value)
            .font(.largeTitle.weight(.bold).monospacedDigit())
            .contentTransition(motion == nil ? .identity : .numericText())
            .animation(motion, value: value)
            .accessibilityLabel("每日约 \(value) 千卡")
            .accessibilityIdentifier("nutrition-estimator-result")
    }

    private var calorieUnit: some View {
        Text("千卡 / 天")
            .font(.subheadline.weight(.medium)).foregroundStyle(SpotterPalette.muted)
            .accessibilityHidden(true)
    }

    private func macro(_ label: String, grams: Double, color: UInt32) -> some View {
        let amount = "\(nutritionNumber(grams)) g"
        return VStack(alignment: .leading, spacing: 4) {
            Label {
                Text(label)
            } icon: {
                Circle().fill(SpotterPalette.color(color)).frame(width: 6, height: 6)
                    .accessibilityHidden(true)
            }
            .font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
            Text(amount).font(.subheadline.weight(.semibold).monospacedDigit())
                .contentTransition(motion == nil ? .identity : .numericText())
                .animation(motion, value: grams)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpotterPalette.card.opacity(0.74), in: RoundedRectangle(cornerRadius: 11))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(amount)
    }

    private func saveBar(_ estimate: NativeNutritionGoalEstimate, input: NativeNutritionGoalInput) -> some View {
        VStack(spacing: 6) {
            if let saveError {
                Text(saveError).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
            }
            Button {
                let values = ["calories": estimate.calories, "protein": estimate.protein, "carbs": estimate.carbs,
                              "fat": estimate.fat, "water": savedTargets?.values?.water ?? 0]
                Task { saveError = await saveTargets(values, estimateInput: input) }
            } label: {
                Label(saving ? "保存中…" : "保存", systemImage: "checkmark")
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterPrimaryControl)
            .disabled(saving)
            .accessibilityIdentifier("nutrition-estimator-save")
        }
        .frame(maxWidth: 540)
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity)
        .background(SpotterPalette.background.shadow(.drop(color: SpotterPalette.deep.opacity(0.08), radius: 12, y: -5)))
    }

    private func saveTargets(_ values: [String: Double], estimateInput: NativeNutritionGoalInput? = nil) async -> String? {
        guard !saving else { return nil }
        var record: [String: Any] = ["kind": "targets", "values": values]
        var preference: [String: Any] = [:]
        if let saved = savedTargets?.preference, let data = try? JSONEncoder().encode(saved),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            preference = object
        }
        if let estimateInput { preference = choice.merged(into: preference, input: estimateInput) }
        if !preference.isEmpty { record["preference"] = preference }
        if let weight = savedTargets?.targetWeightKg { record["targetWeightKg"] = weight }
        saving = true
        defer { saving = false }
        do {
            try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": record])
            if estimateInput != nil {
                NativeNutritionEstimatePreferences(source: choice.activitySource, manualActivity: choice.manualActivity?.rawValue)
                    .save(api: api, owner: owner)
            }
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    private func amount(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    /// Week counts up to this are shown as a soonest date. Longer ones only as a lower bound, because maintenance falls with weight.
    private static let projectionWeeks = 12.0

    /// When the target weight would be reached at the estimated weekly change. Empty when the estimate is moving away from it.
    private func arrival(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?) -> String {
        guard let targetWeightKg = savedTargets?.targetWeightKg, let snapshot, estimate.weeklyChangeKg != 0 else { return "" }
        let weeks = ((targetWeightKg - snapshot.weightKg) / estimate.weeklyChangeKg).rounded(.up)
        guard weeks > 0, weeks < 1000 else { return "" }
        let meters = snapshot.heightCm / 100
        if estimate.weeklyChangeKg < 0 && targetWeightKg <= NativeNutritionGoalRules.minLossBmi * meters * meters {
            return "。目标体重 \(amount(targetWeightKg)) kg 低于偏瘦线（BMI \(amount(NativeNutritionGoalRules.minLossBmi))），不估算到达时间"
        }
        if weeks <= Self.projectionWeeks { return "，最快约 \(Int(weeks)) 周到 \(amount(targetWeightKg)) kg，实际通常会慢一些" }
        return "，到 \(amount(targetWeightKg)) kg 至少要 \(Int(weeks)) 周，体重变化后请重新计算"
    }

    private func explanation(_ estimate: NativeNutritionGoalEstimate, snapshot: NativeNutritionGoalBody.Snapshot?,
                             trainingDays: Int) -> String {
        let restingBasis = estimate.usesLeanMass ? "按体脂率和训练量" : "按身高、体重、年龄"
        let maintenanceBasis = estimate.usesRecords ? "按记录校准" : "按活动量"
        var text = "基础代谢约 \(nutritionNumber(estimate.restingCalories)) 千卡（\(restingBasis)），"
        text += "维持约 \(nutritionNumber(estimate.maintenanceCalories)) 千卡（\(maintenanceBasis)）。"
        // Training is already inside maintenance, so adding the same workout to the day's target would count it twice.
        let counted = trainingDays > 0 || estimate.usesRecords
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
            return "已放慢进度。\(loss)，\(gain)。"
        case .nearUnderweight:
            guard estimate.adjustmentCalories < 0 else { return "体重已接近偏瘦线（BMI \(amount(Rules.minLossBmi))），这次没有设缺口。" }
            return "体重接近偏瘦线（BMI \(amount(Rules.minLossBmi))），已放慢进度。按这个速度 \(Int(Rules.lowWeightWeeks)) 周内不会低于偏瘦线。"
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

    private func resolve(schedule: NativeNutritionCalendarActivity?) -> Resolved {
        var resolved = Resolved()
        guard let bodyData, let snapshot = bodyData.snapshot(on: today) else { return resolved }
        resolved.snapshot = snapshot
        guard let goal = choice.goal, !usesCalendar || schedule != nil else { return resolved }
        let health: NativeNutritionActivityEvidence?
        if usesHealth, case .ready(let evidence) = healthStatus { health = evidence } else { health = nil }
        let canUseManualActivity = !usesHealth || (choice.activitySource == .automatic && healthStatus.needsFallback)
        guard let activity = health?.activity ?? (canUseManualActivity ? choice.manualActivity : nil) else { return resolved }
        let trainingDays = schedule?.trainingDays ?? health?.trainingDays ?? choice.effectiveTrainingDays
        var input = NativeNutritionGoalInput(age: snapshot.age, male: snapshot.male, heightCm: snapshot.heightCm,
                                             weightKg: snapshot.weightKg, activity: activity, trainingDays: trainingDays,
                                             goal: goal, pace: choice.pace, bodyFatPercent: snapshot.bodyFatPercent)
        input.plannedTrainingMinutes = schedule.map { Double($0.trainingMinutes) }
        input.averageNonWorkoutSteps = health?.averageSteps
        if schedule != nil { input.restingTrainingDays = health?.trainingDays ?? choice.recentTrainingDays }
        resolved.input = input
        guard let formula = input.estimate() else { return resolved }
        resolved.estimate = formula
        guard !usesCalendar, let intake else { return resolved }
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

    private func requestHealthAccess() async {
        guard HealthKitReader.nativeDataAvailable, !requestingHealthAccess else { return }
        requestingHealthAccess = true
        healthAccessFailed = false
        defer { requestingHealthAccess = false }
        do {
            try await healthReader.authorizeNutritionActivity()
            try Task.checkCancellation()
            let preferences = NativeHealthPreferences(origin: api.origin, owner: owner)
            UserDefaults.standard.set(true, forKey: preferences.key("nutritionActivityRequested"))
            requestedHealthAccess = true
        } catch is CancellationError {
        } catch {
            healthAccessFailed = true
        }
    }

    private func readHealthActivity(_ key: HealthReadKey) async {
        guard key.enabled, HealthKitReader.nativeDataAvailable, healthReadResult?.key != key else { return }
        let date = Date.now
        guard spotterDay(date) == key.day, TimeZone.current.identifier == key.timeZone else { return }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        do {
            let readings = try await healthReader.recentNutritionActivity(through: date, calendar: calendar)
            try Task.checkCancellation()
            let evidence = NativeNutritionActivityEvidence.health(readings, today: key.day)
            healthReadResult = (key, evidence.map(HealthReadStatus.ready) ?? .insufficient)
        } catch is CancellationError {
        } catch {
            if !Task.isCancelled { healthReadResult = (key, .failed) }
        }
    }

    private func refreshCivilDay() {
        today = spotterDay()
        timeZone = TimeZone.current.identifier
    }

    private func load(retry: Bool = false, refreshBody: Bool = false) async {
        if refreshBody || bodyData == nil {
            guard retry || refreshBody || loadError == nil else { return }
            loading = true
            bodyData = nil
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
                if !Task.isCancelled { loadError = "身体数据读取失败。" }
                return
            }
        }
        if !usesCalendar, bodyData?.snapshot(on: today) != nil { await loadIntake() }
    }

    private func loadIntake(retry: Bool = false) async {
        guard intake == nil, !intakeLoading, retry || !intakeLoadFailed else { return }
        intakeLoading = true
        intakeLoadFailed = false
        defer { intakeLoading = false }
        let now = Date.now
        // Calibration is optional. The formula estimate works without these records.
        let calendar = Calendar.current
        guard let first = calendar.date(byAdding: .day, value: -NativeEnergyCalibration.foodDays, to: now),
              let last = calendar.date(byAdding: .day, value: -1, to: now) else { return }
        let path = "/api/data?scope=nutrition&from=\(spotterDay(first))&to=\(spotterDay(last))"
        guard let data = try? await api.request(path, method: "GET", json: nil, for: owner), !Task.isCancelled else {
            if !Task.isCancelled { intakeLoadFailed = true }
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
        guard !Task.isCancelled else { return }
        intake = totals
        intakeLoadFailed = totals == nil
    }
}


/// Keep the selection in the same navigation stack as the calculator.
private struct NativeNutritionGoalOptions<Value: Hashable, Additional: View>: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    let title: String
    let detail: String?
    @Binding var selection: Value
    let options: [(Value, String)]
    @ViewBuilder let additional: () -> Additional

    var body: some View {
        List {
            Section {
                ForEach(options, id: \.0) { value, label in
                    let selected = selection == value
                    Button {
                        selection = value
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Text(label).foregroundStyle(SpotterPalette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 4)
                            if selected {
                                Image(systemName: "checkmark")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(accent.tint)
                                    .accessibilityHidden(true)
                            }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .listRowBackground(selected ? accent.selection : SpotterPalette.card)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            } footer: {
                if let detail { Text(detail).foregroundStyle(SpotterPalette.muted) }
            }
            additional()
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

@MainActor
private struct NativeManualNutritionGoalForm: View {
    @Environment(\.spotterAccent) private var accent
    @State private var fields: [NutritionMetric: String]
    @State private var error: String?
    let saving: Bool
    let save: ([String: Double]) async -> String?

    init(values: NutritionPayload.Values, saving: Bool, save: @escaping ([String: Double]) async -> String?) {
        self.saving = saving
        self.save = save
        _fields = State(initialValue: Dictionary(uniqueKeysWithValues: NutritionMetric.allCases.map { ($0, nutritionInput($0[values])) }))
    }

    var body: some View {
        Form {
            Section("每日营养目标") {
                ForEach(NutritionMetric.allCases) { metric in
                    LabeledContent(metric.title) {
                        HStack(spacing: 6) {
                            TextField("0", text: Binding(get: { fields[metric, default: ""] }, set: { fields[metric] = $0 }))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                                .foregroundStyle(SpotterPalette.ink)
                                .accessibilityLabel("\(metric.title)，单位\(metric.unit)")
                                .accessibilityIdentifier("nutrition-goal-field-\(metric.rawValue)")
                            Text(metric.unit).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                                .accessibilityHidden(true)
                        }
                    }
                    .listRowBackground(SpotterPalette.card)
                }
            }
            if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            Button(saving ? "保存中…" : "保存") {
                let values = NutritionMetric.allCases.compactMap { metric -> (String, Double)? in
                    guard let value = fields[metric].flatMap(nutritionValue), (0...20000).contains(value) else { return nil }
                    return (metric.rawValue, value)
                }
                guard values.count == NutritionMetric.allCases.count else {
                    error = "请填写 0–20000 范围内的目标值。"
                    return
                }
                error = nil
                Task { error = await save(Dictionary(uniqueKeysWithValues: values)) }
            }
            .buttonStyle(.spotterPress)
            .foregroundStyle(accent.tint)
            .accessibilityIdentifier("nutrition-manual-goal-save")
        }
        .disabled(saving)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle("手动填写")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(saving)
    }
}
