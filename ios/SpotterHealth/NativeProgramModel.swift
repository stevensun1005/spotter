import Foundation

struct NativeTrainingProgram: Codable, Equatable, Identifiable {
    struct Phase: Codable, Equatable, Identifiable {
        enum Hue: String, Codable, CaseIterable, Identifiable {
            case mint, lime, lilac, amber
            var id: Self { self }
            var title: String {
                switch self {
                case .mint: return "薄荷"
                case .lime: return "青柠"
                case .lilac: return "雾紫"
                case .amber: return "琥珀"
                }
            }
        }

        var id = NativeTrainingProgram.newID()
        var name: String
        var fromWeek: Int
        var toWeek: Int
        var color: Hue

        func contains(_ week: Int) -> Bool { fromWeek <= week && week <= toWeek }
    }

    struct Session: Codable, Equatable, Identifiable {
        var id = NativeTrainingProgram.newID()
        var week: Int
        var day: Int
        var phaseId: String?
        var plan: NativeJSON
    }

    struct BaseDay: Equatable, Identifiable {
        let day: Int
        var templateID: String?
        var plan: NativeJSON
        var id: Int { day }
    }

    struct Progression {
        var weightPerWeek = 0.0
        var repsPerWeek = 0
        var deloadWeeks: Set<Int> = []
        var deloadPercent = 80.0
    }

    enum WeightMode: String, CaseIterable, Identifiable {
        case delta, percent
        var id: Self { self }
        var title: String { self == .delta ? "固定重量" : "原重量比例" }
    }

    var id = Self.newID()
    var title = ""
    var startDate: String
    var weeks = 4
    var phases: [Phase] = []
    var sessions: [Session] = []

    static func newID() -> String { UUID().uuidString.lowercased() }

    static func date(_ value: String) -> Date? {
        guard value.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil else { return nil }
        let numbers = value.split(separator: "-").compactMap { Int($0) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        let components = DateComponents(calendar: calendar, year: numbers[0], month: numbers[1], day: numbers[2], hour: 12)
        return components.isValidDate ? components.date : nil
    }

    static func dayString(_ date: Date, timeZone: TimeZone = .gmt) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    static func pickerDate(_ day: String) -> Date? {
        guard let day = date(day) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        let fields = calendar.dateComponents([.year, .month, .day], from: day)
        calendar.timeZone = .current
        return calendar.date(from: fields)
    }

    func date(week: Int, day: Int) -> String {
        guard (1...52).contains(week), (1...7).contains(day), let start = Self.date(startDate) else { return startDate }
        return Self.dayString(start.addingTimeInterval(Double((week - 1) * 7 + day - 1) * 86_400))
    }

    func weekday(_ day: Int) -> String {
        guard let date = Self.date(date(week: 1, day: day)) else { return "第 \(day) 天" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return "周" + ["日", "一", "二", "三", "四", "五", "六"][calendar.component(.weekday, from: date) - 1]
    }

    func phase(for week: Int) -> Phase? { phases.first { $0.contains(week) } }

    func sessions(in week: Int) -> [Session] {
        sessions.filter { $0.week == week }.sorted { $0.day < $1.day }
    }

    mutating func build(days: [BaseDay], progression: Progression) throws {
        try validateMetadata()
        guard (1...7).contains(days.count), days.allSatisfy({ (1...7).contains($0.day) }), Set(days.map(\.id)).count == days.count else {
            throw Self.problem("请选择互不重复的每周训练日，至少有一节训练。")
        }
        guard (-200...200).contains(progression.weightPerWeek), (-100...100).contains(progression.repsPerWeek),
              (0...100).contains(progression.deloadPercent), progression.deloadWeeks.allSatisfy({ (1...weeks).contains($0) }) else {
            throw Self.problem("请核对每周进阶数值和减量周范围。")
        }
        for day in days { try Self.validatePlan(Self.privatePlan(day.plan, date: date(week: 1, day: day.day))) }
        var result: [Session] = []
        for week in 1...weeks {
            let factor = progression.deloadWeeks.contains(week) ? progression.deloadPercent / 100 : 1
            for base in days.sorted(by: { $0.day < $1.day }) {
                var plan = base.plan
                plan["exercises"] = .array(plan["exercises"].array.map { original in
                    var move = original.object
                    let weight = original["weight"].number
                    move["weight"] = .number(weight == 0 ? 0 : max(0, Self.roundWeight((weight + progression.weightPerWeek * Double(week - 1)) * factor)))
                    if original["seconds"].number == 0 {
                        let delta = Double(progression.repsPerWeek * (week - 1))
                        move["reps"] = .number(max(0, original["reps"].number + delta))
                        if original["repsMax"] != .null { move["repsMax"] = .number(max(1, original["repsMax"].number + delta)) }
                    }
                    if (progression.weightPerWeek != 0 && week > 1) || factor != 1 { move.removeValue(forKey: "loadPercent") }
                    if weight > 0 && (progression.weightPerWeek != 0 || factor != 1) { move["fixedLoad"] = .bool(true) }
                    return .object(move)
                })
                result.append(link(Session(week: week, day: base.day, plan: plan)))
            }
        }
        var draft = self
        draft.sessions = result
        try draft.validate()
        self = draft
    }

    mutating func replace(_ session: Session) {
        let updated = link(session)
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = updated
        } else {
            sessions.append(updated)
        }
        sortSessions()
    }

    mutating func copyWeek(_ week: Int, to targets: Set<Int>) throws {
        let source = sessions(in: week)
        guard !source.isEmpty, !targets.isEmpty, !targets.contains(week), targets.allSatisfy({ (1...weeks).contains($0) }) else {
            throw Self.problem("请从有训练的周复制，并选择其他目标周。")
        }
        var copied = sessions.filter { !targets.contains($0.week) }
        for target in targets {
            for entry in source {
                let existing = sessions.first { $0.week == target && $0.day == entry.day }
                copied.append(link(Session(id: existing?.id ?? Self.newID(), week: target, day: entry.day, plan: entry.plan)))
            }
        }
        var draft = self
        draft.sessions = copied
        draft.sortSessions()
        try draft.validate()
        self = draft
    }

    mutating func adjust(from: Int, through: Int, mode: WeightMode, weight: Double, reps: Int) throws {
        guard (1...weeks).contains(from), (from...weeks).contains(through) else { throw Self.problem("请核对所选周次范围。") }
        let weights: ClosedRange<Double> = mode == .delta ? -2000...2000 : 0...200
        guard weights.contains(weight), (-999...999).contains(reps) else { throw Self.problem("请填写有效的重量和次数变化。") }
        var draft = self
        draft.sessions = try sessions.map { session in
            guard (from...through).contains(session.week) else { return session }
            var updated = session
            updated.plan["exercises"] = .array(try session.plan["exercises"].array.map { original in
                var move = original.object
                let oldWeight = original["weight"].number
                let counted = original["seconds"].number == 0
                let oldReps = original["reps"].number
                let nextWeight = oldWeight == 0 ? 0 : Self.roundWeight(mode == .delta ? oldWeight + weight : oldWeight * weight / 100)
                let nextReps = counted && oldReps > 0 ? oldReps + Double(reps) : oldReps
                guard (0...2000).contains(nextWeight), (0...999).contains(nextReps) else {
                    throw Self.problem("调整后部分动作超出有效范围，请缩小改动数值。")
                }
                if counted, original["repsMax"] != .null {
                    if nextReps == 0 { move.removeValue(forKey: "repsMax") }
                    else {
                        let maximum = original["repsMax"].number + Double(reps)
                        guard (nextReps...999).contains(maximum) else {
                            throw Self.problem("调整后的次数上限超出有效范围，请缩小改动数值。")
                        }
                        move["repsMax"] = .number(maximum)
                    }
                }
                if nextWeight != oldWeight { move.removeValue(forKey: "loadPercent") }
                move["weight"] = .number(nextWeight)
                move["reps"] = .number(nextReps)
                return .object(move)
            })
            return updated
        }
        try draft.validate()
        self = draft
    }

    mutating func relink() throws {
        try validateMetadata()
        guard !sessions.contains(where: { $0.week > weeks }) else {
            throw Self.problem("请先移除末尾周次中的训练，再缩短周期。")
        }
        sessions = sessions.map(link)
        try validate()
    }

    func validate() throws {
        try validateMetadata()
        guard (1...364).contains(sessions.count) else { throw Self.problem("请至少填写一节训练。") }
        guard Set(sessions.map(\.id)).count == sessions.count,
              Set(sessions.map { "\($0.week):\($0.day)" }).count == sessions.count else {
            throw Self.problem("同一周和训练日只能安排一节训练。")
        }
        for session in sessions {
            guard UUID(uuidString: session.id) != nil, (1...weeks).contains(session.week), (1...7).contains(session.day),
                  session.plan["shared"] == .bool(false), session.plan["templateId"] == .null,
                  session.plan["date"].string == date(week: session.week, day: session.day) else {
                throw Self.problem("请检查训练日期、周次和私人草稿设置。")
            }
            if let phaseID = session.phaseId, !phases.contains(where: { $0.id == phaseID && $0.contains(session.week) }) {
                throw Self.problem("训练周次与所选阶段不符。")
            }
            for (field, expected) in [("programId", id), ("programSessionId", session.id), ("phaseId", session.phaseId)] {
                if session.plan[field] != .null, session.plan[field].string != expected {
                    throw Self.problem("训练的周期编号与草稿不符。")
                }
            }
            try Self.validatePlan(session.plan)
        }
        guard try JSONEncoder().encode(self).count <= 1_200_000 else { throw Self.problem("周期内容超过 1.2 MB，请缩短周期或分开保存。") }
    }

    private func validateMetadata() throws {
        guard UUID(uuidString: id) != nil, (1...100).contains(title.trimmed.utf16.count), (1...52).contains(weeks),
              Self.date(startDate) != nil, phases.count <= 52 else { throw Self.problem("请填写周期名称、开始日期和 1 至 52 周的长度。") }
        var occupied: Set<Int> = []
        var ids: Set<String> = []
        for phase in phases {
            guard UUID(uuidString: phase.id) != nil, ids.insert(phase.id).inserted,
                  (1...80).contains(phase.name.trimmed.utf16.count), 1 <= phase.fromWeek, phase.fromWeek <= phase.toWeek,
                  phase.toWeek <= weeks else { throw Self.problem("请填写有效的阶段名称与起止周次。") }
            for week in phase.fromWeek...phase.toWeek {
                guard occupied.insert(week).inserted else { throw Self.problem("训练阶段不能重叠。") }
            }
        }
    }

    func link(_ session: Session) -> Session {
        link(session, phaseID: phase(for: session.week)?.id)
    }

    private func link(_ session: Session, phaseID: String?) -> Session {
        var updated = session
        updated.phaseId = phaseID
        var plan = Self.privatePlan(session.plan, date: date(week: session.week, day: session.day)).object
        plan["programId"] = .string(id)
        plan["programSessionId"] = .string(session.id)
        plan["phaseId"] = updated.phaseId.map(NativeJSON.string)
        plan["week"] = .number(Double(session.week))
        plan["day"] = .number(Double(session.day))
        updated.plan = .object(plan)
        return updated
    }

    static func privatePlan(_ source: NativeJSON, date: String) -> NativeJSON {
        var plan = source.object
        for key in ["templateId", "ownExercises", "programId", "programSessionId", "phaseId", "week", "day"] {
            plan.removeValue(forKey: key)
        }
        plan["date"] = .string(date)
        plan["shared"] = .bool(false)
        return .object(plan)
    }

    static func validatePlan(_ plan: NativeJSON) throws {
        try NativePlanImport.validate(plan)
        if plan["defaultRestSeconds"] != .null {
            guard case .number(let rest) = plan["defaultRestSeconds"], (0...600).contains(rest), rest.rounded() == rest else {
                throw problem("默认休息需为 0 到 600 秒之间的整数。")
            }
        }
        for move in plan["exercises"].array {
            let block = move["block"].string
            if !block.isEmpty && block.range(of: #"^[A-Z](?:-[2-9]|-[12][0-9]|-30)?$"#, options: .regularExpression) == nil {
                throw problem("组别格式无效，例如 A 或 A-2。")
            }
            let effort = move["targetRpe"]
            if effort != .null && (!(1...10).contains(effort.number) || (effort.number * 2).rounded() != effort.number * 2) {
                throw problem("目标 RPE 需在 1 到 10 之间，并以 0.5 为间隔。")
            }
            if move["loadPercent"] != .null { _ = try prescribedWeight(move["loadPercent"], unit: move["unit"].string) }
        }
    }

    static func prescribedWeight(_ load: NativeJSON, unit: String) throws -> Double {
        let reference = load["reference"].number
        let percent = load["percent"].number
        let sourceUnit = load["unit"].string
        guard (1...150).contains(percent), reference > 0, reference <= 2000, ["kg", "lb"].contains(sourceUnit) else {
            throw problem("请填写有效的 1RM 参考重量和 1% 至 150% 的比例。")
        }
        let factor = sourceUnit == unit ? 1 : sourceUnit == "lb" ? 0.45359237 : 1 / 0.45359237
        let value = roundWeight(reference * factor * percent / 100)
        guard value <= 2000 else { throw problem("换算后的重量超出有效范围。") }
        return value
    }

    static func importDraft(_ text: String) throws -> Self {
        let input = text.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{feff}")))
        guard input.utf8.count <= 1_300_000 else { throw problem("周期文件最多支持 1.3 MB。") }
        let data = Data(input.utf8)
        let envelope = try JSONDecoder().decode(NativeJSON.self, from: data)
        var source: Self
        if envelope["format"] == .null {
            source = try JSONDecoder().decode(Self.self, from: data)
        } else {
            guard envelope["format"].string == "spotter-program", envelope["version"].number == 1 else {
                throw problem("请选择 Spotter 周期 JSON v1 文件。")
            }
            source = try JSONDecoder().decode(Self.self, from: JSONEncoder().encode(envelope["program"]))
        }
        try source.validate()
        source.id = newID()
        let phaseIDs = Dictionary(uniqueKeysWithValues: source.phases.map { ($0.id, newID()) })
        source.phases = source.phases.map { phase in
            var copy = phase
            copy.id = phaseIDs[phase.id] ?? newID()
            return copy
        }
        source.sessions = source.sessions.map { original in
            var copy = original
            copy.id = newID()
            let phaseID = original.phaseId.flatMap { phaseIDs[$0] }
            return source.link(copy, phaseID: phaseID)
        }
        try source.validate()
        return source
    }

    private mutating func sortSessions() { sessions.sort { ($0.week, $0.day) < ($1.week, $1.day) } }
    private static func roundWeight(_ weight: Double) -> Double { floor(weight * 100 + 0.5) / 100 }
    private static func problem(_ text: String) -> NativePlanImport.Problem { .init(text) }
}

struct NativeProgramRules: Codable, Equatable {
    var principles = ""
    var progression = ""
    var equipment = ""
    var avoid: [String] = []

    func validated() throws -> Self {
        var result = self
        result.principles = principles.trimmed
        result.progression = progression.trimmed
        result.equipment = equipment.trimmed
        result.avoid = avoid.map(\.trimmed).filter { !$0.isEmpty }
        guard result.principles.utf16.count <= 4000, result.progression.utf16.count <= 2000,
              result.equipment.utf16.count <= 1000, result.avoid.count <= 50,
              result.avoid.allSatisfy({ $0.utf16.count <= 100 }) else {
            throw NativePlanImport.Problem("请检查编排偏好字数，每个避开动作最多 100 字，共最多 50 个。")
        }
        return result
    }
}

struct NativeProgramRecord: Identifiable, Decodable {
    var program: NativeTrainingProgram
    let revision: String
    var scheduledAt: String?
    var id: String { program.id }

    private enum CodingKeys: String, CodingKey { case revision, scheduledAt }

    init(from decoder: Decoder) throws {
        program = try NativeTrainingProgram(from: decoder)
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        revision = try fields.decode(String.self, forKey: .revision)
        scheduledAt = try fields.decodeIfPresent(String.self, forKey: .scheduledAt)
        guard UUID(uuidString: revision) != nil else {
            throw DecodingError.dataCorruptedError(forKey: .revision, in: fields, debugDescription: "Invalid training program revision")
        }
    }
}

struct NativeProgramPreview: Identifiable, Decodable {
    enum Status: String, Decodable {
        case new, update, unchanged, custom, protected, blocked, deleted
        var title: String {
            switch self {
            case .new: return "新增计划"
            case .update: return "可更新"
            case .unchanged: return "无需变更"
            case .custom: return "保留自定义"
            case .protected: return "保护已有训练"
            case .blocked: return "本次跳过"
            case .deleted: return "保留删除状态"
            }
        }
    }

    struct Item: Identifiable, Decodable {
        let id: String
        let title: String
        let date: String
        let week: Int
        let day: Int
        let status: Status
        let reason: String
    }

    let programId: String
    let revision: String
    let token: String
    let items: [Item]
    var id: String { token }
    var added: Int { count(.new) }
    var updated: Int { count(.update) }
    var retained: Int { count(.protected) + count(.custom) }
    var skipped: Int { count(.blocked) + count(.deleted) + count(.unchanged) }
    var writable: Int { added + updated }
    private func count(_ status: Status) -> Int { items.filter { $0.status == status }.count }
}

struct NativeProgramExport: Encodable {
    let format = "spotter-program"
    let version = 1
    let program: NativeTrainingProgram
    let rules: NativeProgramRules
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
