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

    func matching(goal: NativeOfficialTrainingTemplate.Goal, level: NativeOfficialTrainingTemplate.Level) -> [NativeOfficialTrainingTemplate] {
        templates.filter { $0.goal == goal && $0.level == level }
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
        let exercises: [Exercise]

        var id: Int { day }

        fileprivate func plan(date: String, unit: String) -> NativeJSON {
            .object([
                "title": .string(title), "date": .string(date), "category": .string(category),
                "minutes": .number(Double(minutes)), "video": .string(""), "shared": .bool(false),
                "exercises": .array(exercises.map { $0.move(unit: unit) }),
            ])
        }
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
    let days: [TrainingDay]

    fileprivate func validate() throws {
        guard id.range(of: #"^[a-z0-9][a-z0-9-]{1,79}$"#, options: .regularExpression) != nil,
              (1...100).contains(title.utf16.count), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !equipment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              (1...52).contains(weeks), (1...7).contains(days.count),
              Set(days.map(\.day)).count == days.count, days.allSatisfy({ (1...7).contains($0.day) }) else {
            throw NativePlanImport.Problem("官方模板「\(title)」的周期信息无效。")
        }
        for day in days {
            for exercise in day.exercises { try exercise.validate() }
            try NativeTrainingProgram.validatePlan(day.plan(date: "2026-01-01", unit: "kg"))
        }
    }

    func draft(startDay: Date, timeZone: TimeZone = .current, unit: String = NativePreferenceKey.newMoveUnit) throws -> NativeTrainingProgram {
        let startDate = NativeTrainingProgram.dayString(startDay, timeZone: timeZone)
        var program = NativeTrainingProgram(title: title, startDate: startDate, weeks: weeks,
                                            phases: [.init(name: "每周训练", fromWeek: 1, toWeek: weeks, color: .mint)])
        let sessions = days.map { day in
            NativeTrainingProgram.BaseDay(day: day.day, plan: day.plan(date: program.date(week: 1, day: day.day), unit: unit))
        }
        try program.build(days: sessions, progression: .init())
        return program
    }
}
