import SwiftUI

struct NativeCoachRecommendation: Codable, Equatable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable {
        case official, scheduled, exercise

        var label: String {
            switch self {
            case .official: return "官方模板"
            case .scheduled: return "我的计划"
            case .exercise: return "动作库"
            }
        }

        var symbol: String {
            switch self {
            case .official: return "calendar.badge.plus"
            case .scheduled: return "calendar"
            case .exercise: return "dumbbell"
            }
        }
    }

    let kind: Kind
    let key: String
    let title: String
    let detail: String
    var id: String { kind.rawValue + ":" + key }
}

struct NativeCoachRecommendationQuery: Sendable {
    enum Subject: Sendable { case official, scheduled, exercise }

    var subject: Subject
    var goal: NativeOfficialTrainingTemplate.Goal?
    var level: NativeOfficialTrainingTemplate.Level?
    var frequency: Int?
    var home = false
    var noBench = false
    var today = false
    var area: String?
    var gear: Gear?
    var name: String?
    var excluded: Set<String> = []

    struct Gear: Sendable {
        let key: String
        let terms: [String]

        func matches(_ equipment: String) -> Bool {
            terms.contains { equipment.localizedCaseInsensitiveContains($0) }
        }
    }

    private static let equipment = [
        Gear(key: "body weight", terms: ["无器械", "没器械", "没有器械", "不需要器械", "徒手", "自重", "bodyweight", "body weight", "no equipment"]),
        Gear(key: "dumbbell", terms: ["哑铃", "dumbbell"]),
        Gear(key: "barbell", terms: ["杠铃", "barbell"]),
        Gear(key: "kettlebell", terms: ["壶铃", "kettlebell"]),
        Gear(key: "cable", terms: ["绳索", "cable"]),
        Gear(key: "band", terms: ["弹力带", "阻力带", "resistance band"]),
    ]

    private static let areas: [(String, [String])] = [
        ("chest", ["胸部", "练胸", "胸肌", "chest"]),
        ("back", ["背部", "练背", "背肌", "back"]),
        ("shoulders", ["肩部", "练肩", "肩肌", "三角肌", "shoulder"]),
        ("upper legs", ["腿部", "练腿", "臀腿", "腿肌", "leg"]),
        ("waist", ["核心", "练腹", "腹肌", "core", "abs"]),
        ("upper arms", ["手臂", "肱二头", "肱三头", "二头", "三头", "arm"]),
    ]

    static func parse(_ input: String, refining previous: Self? = nil, shown: [NativeCoachRecommendation] = []) -> Self? {
        let value = input.precomposedStringWithCompatibilityMapping.lowercased()
        let contains: ([String]) -> Bool = { terms in terms.contains { value.contains($0) } }
        guard !contains(["疼痛", "受伤", "术后", "康复", "hurt", "injury", "post surgery",
                         "不要推荐", "不用推荐", "别推荐", "不推荐", "do not recommend"]) else { return nil }

        let goal: NativeOfficialTrainingTemplate.Goal? = contains(["增肌", "塑形", "hypertrophy", "build muscle"]) ? .hypertrophy
            : contains(["减脂", "fat loss"]) ? .fatLoss
            : contains(["减肥", "减重", "weight loss"]) ? .weightLoss
            : contains(["功能性", "活动能力", "functional"]) ? .functional : nil
        let level: NativeOfficialTrainingTemplate.Level? = contains(["初级", "新手", "入门", "beginner"]) ? .beginner
            : contains(["中级", "进阶", "intermediate"]) ? .intermediate
            : contains(["高级", "advanced"]) ? .advanced : nil
        let gear = equipment.first { $0.matches(value) }
        let area = areas.first { contains($0.1) }?.0
        let frequency = weeklyFrequency(value)
        let home = contains(["在家", "居家", "家里", "at home"])
        let noBench = contains(["无凳", "没凳子", "没有凳", "不用凳", "no bench"])
        let another = contains(["换一", "再来几个", "换几个", "其他选项", "another", "more options"])
        let asking = contains(["推荐", "挑个", "挑些", "挑几个", "找几个", "找个", "推荐一下", "recommend", "suggest", "find"])
        let wantsPlan = contains(["计划", "模板", "排期", "周期", "plan", "program", "template"])
        let wantsExercise = contains(["动作", "动作库", "exercise", "movement"]) || area != nil
        let own = contains(["我的", "今天我", "今日我", "已有", "现有", "已排", "安排了", "my ", "scheduled"])
        let today = contains(["今天", "今日", "today"])

        var query: Self
        if own && (asking && wantsPlan || today && contains(["练什么", "what", "安排"])) {
            query = Self(subject: .scheduled)
        } else if asking && (wantsPlan || !wantsExercise && goal != nil) {
            query = Self(subject: .official)
        } else if asking && wantsExercise {
            query = Self(subject: .exercise)
        } else if let previous, value.count <= 36,
                  !contains(["饮食", "早餐", "午餐", "晚餐", "蛋白粉", "喝", "吃", "记体重", "统计", "nutrition", "meal"]),
                  another || goal != nil || level != nil || gear != nil || area != nil || frequency != nil || home || noBench {
            query = previous
        } else {
            return nil
        }

        if another { query.excluded.formUnion(shown.map(\.id)) }
        else { query.excluded.removeAll() }
        if let goal { query.goal = goal }
        if let level { query.level = level }
        if let frequency { query.frequency = frequency }
        if let area { query.area = area }
        if let gear { query.gear = gear }
        if home { query.home = true }
        if noBench { query.noBench = true }
        if today { query.today = true }
        if query.subject == .exercise && asking {
            let askedName = value.replacingOccurrences(
                of: #"^.*?(?:推荐|挑几个|找几个|找个|recommend|suggest|find)\s*(?:一下|几个|一些|一两个|两个|个|适合)?\s*|(?:动作|练习|exercises?|movements?)[。！？!? ]*$"#,
                with: "", options: .regularExpression
            ).trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
            if !askedName.isEmpty && askedName.count <= 36 &&
                area == nil && gear?.terms.contains(askedName) != true &&
                !["适合新手", "推荐", "动作库", "训练", "健身"].contains(askedName) {
                query.name = askedName
            }
        } else if query.subject == .exercise && (gear != nil || area != nil) {
            query.name = nil
        }
        return query
    }

    private static func weeklyFrequency(_ value: String) -> Int? {
        let pattern = #"(?:每周|一周)\s*([1-7一二两三四五六七])\s*(?:次|天|练|节)|([1-7])\s*(?:days|times)\s*(?:per|a)\s*week"#
        guard let match = value.range(of: pattern, options: .regularExpression) else { return nil }
        let expression = value[match]
        if let digit = expression.first(where: { "1234567".contains($0) }) { return digit.wholeNumberValue }
        let numbers: [Character: Int] = ["一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7]
        return expression.dropFirst(2).compactMap { numbers[$0] }.first
    }
}

enum NativeCoachRecommendationSource {

    static func official(_ query: NativeCoachRecommendationQuery) -> [NativeCoachRecommendation] {
        guard let catalogue = try? NativeOfficialTrainingCatalogue.bundled.get() else { return [] }
        let templates = catalogue.templates.filter { template in
            let gear = template.equipment
            let householdOnly = equipmentMatchesHome(gear, useTrainingEquipment: false)
            let matchesGear = query.gear?.key == "body weight"
                ? householdOnly || query.gear?.matches(gear) == true
                : query.gear == nil || query.gear?.matches(gear) == true
            return (query.goal == nil || template.goal == query.goal) &&
                template.level == (query.level ?? .beginner) &&
                (query.frequency.map(template.weeklySessionRange.contains) ?? true) &&
                matchesGear && (!query.noBench || !gear.contains("凳")) &&
                (!query.home || equipmentMatchesHome(gear, useTrainingEquipment: true))
        }
        let ordered = query.goal == nil
            ? NativeOfficialTrainingTemplate.Goal.allCases.compactMap { goal in templates.first { $0.goal == goal } }
                + templates
            : templates
        return choices(ordered.map {
            .init(kind: .official, key: $0.id, title: $0.title,
                  detail: "\($0.goal.title) · \($0.level.title) · \($0.weeks) 周 · \($0.weeklySessionLabel) · \($0.equipment)")
        }, excluding: query.excluded)
    }

    private static func equipmentMatchesHome(_ equipment: String, useTrainingEquipment: Bool) -> Bool {
        let household: Set<String> = [
            "无器械", "徒手", "自重", "垫子", "运动鞋", "低台阶", "稳定支撑", "稳固支撑",
            "稳固椅子", "稳固座椅", "稳定的椅子", "扶手", "带扶手的低台阶", "可扶的低台阶",
        ]
        let portable: Set<String> = ["哑铃", "壶铃", "弹力带", "跳绳", "牢固固定点", "固定点"]
        let required = equipment.split(whereSeparator: { "、，,和与".contains($0) })
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        return !required.isEmpty && required.allSatisfy {
            household.contains($0) || useTrainingEquipment && portable.contains($0)
        }
    }

    static func scheduled(_ query: NativeCoachRecommendationQuery, owner: String, entries: [NativeWorkoutEntry],
                          day: String) -> [NativeCoachRecommendation] {
        let upcoming = entries.filter {
            $0.owner == owner && $0.kind == "plan" && (query.today ? $0.day == day : $0.day >= day)
        }.sorted { ($0.day, $0.title) < ($1.day, $1.title) }
        return choices(upcoming.map { .init(kind: .scheduled, key: $0.id, title: $0.displayTitle,
                                           detail: "\($0.day) · \($0.data["category"].string)") }, excluding: query.excluded)
    }

    static func exercises(_ query: NativeCoachRecommendationQuery, index: NativeCatalogIndex) -> [NativeCoachRecommendation] {
        let noCriteria = query.area == nil && query.gear == nil && query.name == nil && !query.home
        let desiredGear = query.gear?.key ?? (query.home ? "body weight" : nil)
        let gears: Set<String> = Set([desiredGear, desiredGear == "band" ? "resistance band" : nil,
                                      desiredGear == "barbell" ? "olympic barbell" : nil].compactMap { $0 })
        let results = index.results(query: query.name ?? "", area: query.area ?? "", gear: gears)
        let candidates = results.featured + results.sections.flatMap(\.rows)
        let starter = noCriteria ? ["1760", "0293", "0276"].compactMap { index.entry(withID: $0) } : []
        let grounded = (starter + candidates).filter { entry in
            !entry.isPersonal && (gears.isEmpty || gears.contains(entry.equipment))
        }
        return choices(grounded.map { .init(kind: .exercise, key: $0.id, title: $0.name,
                                           detail: [index.label($0.part), index.label($0.equipment)].joined(separator: " · ")) },
                       excluding: query.excluded)
    }

    private static func choices(_ values: [NativeCoachRecommendation], excluding excluded: Set<String>) -> [NativeCoachRecommendation] {
        var ids = excluded
        var choices: [NativeCoachRecommendation] = []
        for value in values where ids.insert(value.id).inserted {
            choices.append(value)
            if choices.count == 3 { break }
        }
        return choices
    }
}

@MainActor
struct NativeCoachRecommendationSheet: View {
    let request: NativeCoachRecommendationRequest
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var catalogue: NativeCatalogIndex?
    @State private var loading = true
    @State private var exerciseToAdd: NativeCataloguePlanMove?
    @State private var queuedDraft: NativePlanDraft?
    @State private var draft: NativePlanDraft?
    @State private var openedScheduledPlan = false

    private var reference: NativeCoachRecommendation { request.reference }

    var body: some View {
        Group {
            switch reference.kind {
            case .official:
                if let template = try? NativeOfficialTrainingCatalogue.bundled.get().templates.first(where: { $0.id == reference.key }) {
                    NavigationStack { NativeOfficialTemplatePreview(template: template, store: store) }
                } else { missing }
            case .scheduled:
                if let entry = store.plans.first(where: { $0.id == reference.key && $0.owner == store.owner }) {
                    // 计划编辑页全屏打开；关闭后一并收起推荐页。
                    Color.clear.onAppear {
                        guard !openedScheduledPlan else { return }
                        openedScheduledPlan = true
                        draft = NativePlanDraft(entry: entry)
                    }
                } else { missing }
            case .exercise:
                if let catalogue, let entry = catalogue.entry(withID: reference.key) {
                    NativeCatalogueExerciseDetail(store: store, index: catalogue, entry: entry) {
                        exerciseToAdd = NativeCataloguePlanMove(entry: $0)
                    }
                } else if loading { ProgressView("正在读取动作…") }
                else { missing }
            }
        }
        .task(id: reference.id) {
            guard reference.kind == .exercise else { return }
            catalogue = try? await NativeCatalogIndex.bundled()
            loading = false
            if request.startsWithAdd, let entry = catalogue?.entry(withID: reference.key) {
                exerciseToAdd = NativeCataloguePlanMove(entry: entry)
            }
        }
        .sheet(item: $exerciseToAdd, onDismiss: showQueuedDraft) { move in
            NativeCataloguePlanPicker(store: store, move: move) { selected in
                queuedDraft = move.draft(addingTo: selected, on: spotterDay())
                exerciseToAdd = nil
            }
        }
        .fullScreenCover(item: $draft, onDismiss: {
            if reference.kind == .scheduled { dismiss() }
        }) { value in
            NavigationStack {
                NativePlanEditorPanel(store: store, draft: value) { _ in }
            }
        }
    }

    private func showQueuedDraft() {
        draft = queuedDraft
        queuedDraft = nil
    }

    private var missing: some View {
        NavigationStack {
            Label("这项内容暂时不可用，可返回对话再选一项。", systemImage: "exclamationmark.circle")
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
                .padding(16)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
    }
}

struct NativeCoachRecommendationRequest: Identifiable {
    let reference: NativeCoachRecommendation
    let startsWithAdd: Bool
    var id: String { reference.id + (startsWithAdd ? ":add" : ":detail") }
}
