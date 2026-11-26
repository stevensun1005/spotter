import Foundation

struct NativeOfficialTrainingCatalogue: Decodable {
    let schemaVersion: Int
    let templates: [NativeOfficialTrainingTemplate]

    static let bundled: Result<Self, Error> = Result {
        guard let url = Bundle.main.url(forResource: "official-training-templates", withExtension: "json") else {
            throw NativePlanImport.Problem("找不到官方模板资源。")
        }
        return try load(Data(contentsOf: url))
    }

    static func load(_ data: Data) throws -> Self {
        let catalogue = try JSONDecoder().decode(Self.self, from: data)
        let templates = catalogue.templates
        guard catalogue.schemaVersion == 1,
              Set(templates.map(\.id)).count == templates.count,
              Set(templates.map(\.title)).count == templates.count else {
            throw NativePlanImport.Problem("官方模板资源格式无效。")
        }
        for goal in NativeOfficialTrainingTemplate.Goal.allCases {
            for level in NativeOfficialTrainingTemplate.Level.allCases {
                guard catalogue.matching(goal: goal, level: level).count >= 5 else {
                    throw NativePlanImport.Problem("官方模板有训练目标或水平尚未配齐。")
                }
            }
        }
        for template in templates { try template.validate() }
        return catalogue
    }

    func matching(goal: NativeOfficialTrainingTemplate.Goal? = nil,
                  level: NativeOfficialTrainingTemplate.Level? = nil) -> [NativeOfficialTrainingTemplate] {
        templates.filter { (goal == nil || $0.goal == goal) && (level == nil || $0.level == level) }
    }
}

struct NativeOfficialTrainingTemplate: Decodable, Identifiable {
    enum Goal: String, Decodable, CaseIterable, Identifiable {
        case hypertrophy
        case fatLoss = "fat-loss"
        case weightLoss = "weight-loss"
        case functional

        var id: Self { self }
        var title: String {
            switch self {
            case .hypertrophy: return "增肌"
            case .fatLoss: return "减脂"
            case .weightLoss: return "减肥"
            case .functional: return "功能性训练"
            }
        }
        var symbol: String {
            switch self {
            case .hypertrophy: return "dumbbell.fill"
            case .fatLoss: return "figure.run"
            case .weightLoss: return "figure.walk"
            case .functional: return "figure.mixed.cardio"
            }
        }
    }

    enum Level: String, Decodable, CaseIterable, Identifiable {
        case beginner, intermediate, advanced

        var id: Self { self }
        var title: String {
            switch self {
            case .beginner: return "初级"
            case .intermediate: return "中级"
            case .advanced: return "高级"
            }
        }
    }

    struct TrainingDay: Decodable, Identifiable {
        let day: Int
        let title: String
        let category: String
        let minutes: Int
        let defaultRestSeconds: Int?
        let durationNote: String?
        let exercises: [Exercise]

        var id: Int { day }

        fileprivate func plan(date: String, unit: String) -> NativeJSON {
            var fields: [String: NativeJSON] = [
                "title": .string(title), "date": .string(date), "category": .string(category),
                "minutes": .number(Double(minutes)), "video": .string(""), "shared": .bool(false),
                "exercises": .array(exercises.map { $0.move(unit: unit) }),
            ]
            if let defaultRestSeconds { fields["defaultRestSeconds"] = .number(Double(defaultRestSeconds)) }
            if let durationNote { fields["durationNote"] = .string(durationNote) }
            return .object(fields)
        }
    }

    private struct WeekPlan: Decodable {
        let week: Int
        let days: [TrainingDay]
    }

    struct Exercise: Decodable {
        let name: String
        let sets: Int
        let reps: Int?
        let repsMax: Int?
        let seconds: Int?
        let restSeconds: Int?
        let targetRpe: Double?
        let catalogueId: String?
        let cue: String?
        let block: String?
        let station: String?
        let tempo: String?
        let sourceSlot: String?
        let sourceName: String?

        func move(unit: String) -> NativeJSON {
            var fields: [String: NativeJSON] = [
                "name": .string(name), "sets": .number(Double(sets)), "reps": .number(Double(reps ?? 0)),
                "weight": .number(0), "unit": .string(unit), "seconds": .number(Double(seconds ?? 0)),
            ]
            if let repsMax { fields["repsMax"] = .number(Double(repsMax)) }
            if let restSeconds { fields["restSeconds"] = .number(Double(restSeconds)) }
            if let targetRpe { fields["targetRpe"] = .number(targetRpe) }
            if let catalogueId { fields["catalogueId"] = .string(catalogueId) }
            if let cue { fields["cue"] = .string(cue) }
            if let block { fields["block"] = .string(block) }
            if let station { fields["station"] = .string(station) }
            if let tempo { fields["tempo"] = .string(tempo) }
            if let sourceSlot { fields["sourceSlot"] = .string(sourceSlot) }
            if let sourceName { fields["sourceName"] = .string(sourceName) }
            return .object(fields)
        }

        var prescription: String {
            if let seconds, seconds > 0 {
                if seconds.isMultiple(of: 60) { return "\(sets) 组 × \(seconds / 60) 分钟" }
                return "\(sets) 组 × \(seconds) 秒"
            }
            let count = reps ?? 0
            let range = repsMax.flatMap { $0 > count ? "\(count)–\($0)" : nil } ?? "\(count)"
            return "\(sets) 组 × \(range) 次"
        }

        fileprivate func validate() throws {
            let byRep = (reps ?? 0) > 0
            let byTime = (seconds ?? 0) > 0
            guard byRep != byTime,
                  catalogueId == nil || catalogueId?.range(of: #"^[0-9]{4,6}$"#, options: .regularExpression) != nil,
                  cue == nil || (1...220).contains(cue?.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count ?? 0) else {
                throw NativePlanImport.Problem("官方动作的次数、时间或说明无效。")
            }
        }
    }

    let id: String
    let goal: Goal
    let level: Level
    let title: String
    let summary: String
    let equipment: String
    let weeks: Int
    private let days: [TrainingDay]?
    private let schedule: [WeekPlan]?

    var isWeekSpecific: Bool { schedule != nil }

    func trainingDays(for week: Int) -> [TrainingDay] {
        guard (1...weeks).contains(week) else { return [] }
        let sessions = schedule.map { $0.first(where: { $0.week == week })?.days ?? [] } ?? days ?? []
        return sessions.sorted { $0.day < $1.day }
    }

    var sessionCount: Int {
        schedule.map { $0.reduce(0) { $0 + $1.days.count } } ?? (days?.count ?? 0) * weeks
    }

    var weeklySessionRange: ClosedRange<Int> {
        let counts = schedule?.map { $0.days.count } ?? [days?.count ?? 0]
        return (counts.min() ?? 0)...(counts.max() ?? 0)
    }

    var weeklySessionLabel: String {
        let range = weeklySessionRange
        let frequency = range.lowerBound == range.upperBound
            ? "\(range.lowerBound)" : "\(range.lowerBound)–\(range.upperBound)"
        return "每周 \(frequency) 节"
    }

    fileprivate func validate() throws {
        let invalid = NativePlanImport.Problem("官方模板「\(title)」的周期信息无效。")
        guard id.range(of: #"^[a-z0-9][a-z0-9-]{1,79}$"#, options: .regularExpression) != nil,
              (1...100).contains(title.utf16.count), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !equipment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              (1...52).contains(weeks) else { throw invalid }
        if let schedule {
            guard days?.isEmpty != false, schedule.count == weeks,
                  Set(schedule.map(\.week)) == Set(1...weeks) else { throw invalid }
        }
        for week in schedule?.map(\.days) ?? [days ?? []] {
            guard (1...7).contains(week.count), Set(week.map(\.day)).count == week.count,
                  week.allSatisfy({ (1...7).contains($0.day) }) else { throw invalid }
            for day in week {
                try day.exercises.forEach { try $0.validate() }
                try NativeTrainingProgram.validatePlan(day.plan(date: "2026-01-01", unit: "kg"))
            }
        }
    }

    func draft(startDay: Date, timeZone: TimeZone = .current, unit: String = NativePreferenceKey.newMoveUnit) throws -> NativeTrainingProgram {
        let startDate = NativeTrainingProgram.dayString(startDay, timeZone: timeZone)
        var program = NativeTrainingProgram(title: title, startDate: startDate, weeks: weeks,
                                            phases: [.init(name: isWeekSpecific ? "周期训练" : "每周训练", fromWeek: 1, toWeek: weeks, color: .mint)])
        if isWeekSpecific {
            let sessions = (1...weeks).flatMap { week in
                trainingDays(for: week).map { day in
                    let date = program.date(week: week, day: day.day)
                    return program.link(.init(week: week, day: day.day, plan: day.plan(date: date, unit: unit)))
                }
            }
            program.sessions = sessions
            try program.validate()
            return program
        }
        let sessions = trainingDays(for: 1).map { day in
            NativeTrainingProgram.BaseDay(day: day.day, plan: day.plan(date: program.date(week: 1, day: day.day), unit: unit))
        }
        try program.build(days: sessions, progression: .init())
        return program
    }
}
