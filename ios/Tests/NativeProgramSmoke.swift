import Foundation

@main
struct NativeProgramSmoke {
    static func main() throws {
        let template = NativeJSON.object([
            "title": .string("基础力量"), "date": .string("2026-01-01"), "category": .string("力量训练"),
            "minutes": .number(40), "shared": .bool(true), "video": .string(""),
            "templateId": .string(NativeTrainingProgram.newID()), "exercises": .array([
                .object(["name": .string("杠铃深蹲"), "sets": .number(3), "reps": .number(5), "repsMax": .number(7),
                         "unit": .string("kg"), "seconds": .number(0), "weight": .number(100),
                         "loadPercent": .object(["percent": .number(80), "reference": .number(125), "unit": .string("kg")])]),
                .object(["name": .string("平板支撑"), "sets": .number(2), "reps": .number(0), "seconds": .number(45),
                         "weight": .number(0), "unit": .string("lb"), "sourceSlot": .string("W-warmup")]),
            ]),
        ])
        let phase = NativeTrainingProgram.Phase(name: "基础阶段", fromWeek: 1, toWeek: 3, color: .mint)
        var program = NativeTrainingProgram(title: "三周训练", startDate: "2026-10-31", weeks: 3, phases: [phase])
        try program.build(days: [.init(day: 1, plan: template), .init(day: 3, plan: template)],
                          progression: .init(weightPerWeek: 2.5, repsPerWeek: 2, deloadWeeks: [3], deloadPercent: 80))
        precondition(program.sessions.count == 6)
        precondition(program.date(week: 1, day: 3) == "2026-11-02")
        precondition(program.date(week: 3, day: 3) == "2026-11-16")
        precondition(program.sessions.allSatisfy { $0.phaseId == phase.id && $0.plan["templateId"] == .null && !$0.plan["shared"].bool })
        let first = program.sessions(in: 1)[0]
        let second = program.sessions(in: 2)[0]
        let third = program.sessions(in: 3)[0]
        precondition(first.plan["exercises"].array[0]["loadPercent"] != .null)
        precondition(second.plan["exercises"].array[0]["weight"].number == 102.5)
        precondition(third.plan["exercises"].array[0]["weight"].number == 84)
        precondition(third.plan["exercises"].array[0]["repsMax"].number == 11)
        precondition(third.plan["exercises"].array[1]["weight"].number == 0)
        precondition(third.plan["exercises"].array[1]["seconds"].number == 45)
        precondition(third.plan["exercises"].array[1]["reps"].number == 0)

        var changed = first
        changed.plan["title"] = .string("个性化训练")
        program.replace(changed)
        try program.copyWeek(1, to: [2])
        let copied = program.sessions(in: 2)[0]
        precondition(copied.id == second.id && copied.plan["title"].string == "个性化训练")
        precondition(copied.plan["date"].string == "2026-11-07")
        precondition(copied.plan["programSessionId"].string == second.id)
        try program.adjust(from: 2, through: 2, mode: .percent, weight: 85, reps: -2)
        let adjusted = program.sessions(in: 2)[0].plan["exercises"].array
        precondition(adjusted[0]["weight"].number == 85 && adjusted[0]["loadPercent"] == .null)
        precondition(adjusted[0]["reps"].number == 3 && adjusted[0]["repsMax"].number == 5)
        precondition(adjusted[1] == first.plan["exercises"].array[1])
        let beforeInvalidAdjustment = program
        do {
            try program.adjust(from: 1, through: 3, mode: .delta, weight: -200, reps: 0)
            preconditionFailure("Invalid adjustment succeeded")
        } catch is NativePlanImport.Problem {
            precondition(program == beforeInvalidAdjustment)
        }

        let rules = try NativeProgramRules(principles: " 优先用动作库 ", avoid: ["  ", " 俯卧撑 "]).validated()
        precondition(rules.principles == "优先用动作库" && rules.avoid == ["俯卧撑"])
        let exported = try JSONEncoder().encode(NativeProgramExport(program: program, rules: rules))
        let imported = try NativeTrainingProgram.importDraft(String(decoding: exported, as: UTF8.self))
        precondition(imported.id != program.id && imported.phases[0].id != phase.id)
        precondition(imported.sessions.allSatisfy { $0.phaseId == imported.phases[0].id && $0.plan["programId"].string == imported.id })
        precondition(Set(imported.sessions.map(\.id)).isDisjoint(with: program.sessions.map(\.id)))
        precondition(imported.sessions.map { $0.plan["date"] } == program.sessions.map { $0.plan["date"] })
        let validLeap = NativeTrainingProgram.date("2028-02-29")
        precondition(validLeap != nil && NativeTrainingProgram.date("2027-02-29") == nil)
        print("PASS native program draft, stable copy IDs, weekly progression, protected load rules, and Cloudflare JSON")
    }
}
