import Foundation

@main
struct NativeOfficialTemplateSmoke {
    static func main() throws {
        let url = URL(fileURLWithPath: "ios/SpotterHealth/Resources/official-training-templates.json")
        let data = try Data(contentsOf: url)
        let catalogue = try NativeOfficialTrainingCatalogue.load(data)
        precondition(catalogue.matching().count == catalogue.templates.count)
        precondition(catalogue.matching(goal: .functional).allSatisfy { $0.goal == .functional })
        precondition(catalogue.matching(level: .advanced).allSatisfy { $0.level == .advanced })
        let timeZone = TimeZone(identifier: "America/Toronto")!
        let beforeMidnight = ISO8601DateFormatter().date(from: "2026-11-01T02:00:00Z")!
        var signatures: [String: Set<String>] = [:]
        var timedMoves = 0
        var prescribedBreaks = 0
        var recoveryDays = 0
        var repeatedTimedMoves = 0
        var categories: Set<String> = []
        for template in catalogue.templates {
            let program = try template.draft(startDay: beforeMidnight, timeZone: timeZone, unit: "lb")
            precondition(program.startDate == "2026-10-31" && program.weeks == template.weeks)
            precondition(program.sessions.count == template.sessionCount)
            precondition(program.sessions.allSatisfy { session in
                session.plan["shared"] == .bool(false) &&
                session.plan["date"].string == program.date(week: session.week, day: session.day) &&
                session.plan["templateId"] == .null &&
                session.plan["exercises"].array.allSatisfy { $0["unit"] == .string("lb") && $0["weight"] == .number(0) }
            })
            let andAgain = try template.draft(startDay: beforeMidnight, timeZone: timeZone, unit: "lb")
            precondition(andAgain.id != program.id)
            precondition(Set(andAgain.sessions.map(\.id)).isDisjoint(with: program.sessions.map(\.id)))

            let firstWeek = template.trainingDays(for: 1)
            recoveryDays += 7 - firstWeek.count
            let signature = program.sessions(in: 1).map { session in
                let source = firstWeek.first { $0.day == session.day }!
                let plan = NativePlan(raw: session.plan)
                let workout = NativeWorkoutSession.start(plan: plan, planId: session.id, now: 1)
                precondition(source.category == plan.category && source.exercises.count == workout.rows.count)
                categories.insert(plan.category)
                var timedNames: Set<String> = []
                for (index, exercise) in source.exercises.enumerated() {
                    let move = plan.exercises[index]
                    let rows = workout.rows[index]
                    precondition(move["name"].string == exercise.name && rows.count == exercise.sets)
                    precondition(rows.allSatisfy { $0["seconds"].number == Double(exercise.seconds ?? 0) &&
                        $0["reps"].number == Double(exercise.reps ?? 0) })
                    precondition(move["restSeconds"] == (exercise.restSeconds.map { .number(Double($0)) } ?? .null))
                    if exercise.restSeconds != nil { prescribedBreaks += 1 }
                    if exercise.seconds != nil {
                        timedMoves += 1
                        if !timedNames.insert(exercise.name).inserted { repeatedTimedMoves += 1 }
                    }
                }
                let movements = plan.exercises.map { move in
                    [move["name"].string, move["sets"].number.formatted(), move["reps"].number.formatted(),
                     move["seconds"].number.formatted()].joined(separator: ":")
                }
                return "\(session.day):" + movements.joined(separator: ",")
            }.joined(separator: ";")
            let group = "\(template.goal.rawValue)/\(template.level.rawValue)"
            signatures[group, default: []].insert(signature)
        }
        precondition(signatures.count == 12 && signatures.values.allSatisfy { $0.count >= 5 })
        precondition(timedMoves > 0 && prescribedBreaks > 0 && recoveryDays > 0 && repeatedTimedMoves > 0)
        precondition(categories == ["力量训练", "有氧训练", "拉伸恢复"])
        let advanced = catalogue.matching(goal: .functional, level: .advanced)
        if let cycle = advanced.first(where: \.isWeekSpecific) {
            try verifyFunctionalCycle(cycle, start: beforeMidnight, timeZone: timeZone)
        } else {
            preconditionFailure("Missing the week-specific official 12-week functional cycle.")
        }
        print("PASS \(catalogue.templates.count) official training templates across 12 goal/level groups, private dated drafts, distinct repeated/timed moves, breaks, and recovery days")
    }

    private static func verifyFunctionalCycle(_ template: NativeOfficialTrainingTemplate, start: Date, timeZone: TimeZone) throws {
        let program = try template.draft(startDay: start, timeZone: timeZone, unit: "lb")
        precondition(template.weeks == 12 && template.weeklySessionRange == 4...4)
        precondition(program.sessions.count == 48 && template.sessionCount == 48)
        precondition(program.sessions.first?.plan["date"].string == "2026-10-31")
        precondition(program.sessions.last?.plan["date"].string == "2027-01-21")
        var weeklySignatures = Set<Data>()
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        for week in 1...12 {
            let days = template.trainingDays(for: week)
            let sessions = program.sessions(in: week)
            precondition(days.map(\.day) == [1, 2, 4, 6] && sessions.map(\.day) == days.map(\.day))
            weeklySignatures.insert(try encoder.encode(sessions.map { $0.plan["exercises"] }))
            for (day, session) in zip(days, sessions) {
                let expected = day.exercises.map { $0.move(unit: "lb") }
                precondition(session.plan["exercises"].array == expected)
                precondition(expected.allSatisfy {
                    $0["weight"] == .number(0) && $0["unit"] == .string("lb") &&
                    !$0["catalogueId"].string.isEmpty
                })
                precondition(session.plan["shared"] == .bool(false))
                precondition(session.plan["programId"] == .string(program.id) && session.phaseId != nil)
                precondition(session.plan["programSessionId"] == .string(session.id))
                precondition(session.plan["defaultRestSeconds"] == (day.defaultRestSeconds.map { .number(Double($0)) } ?? .null))
                precondition(session.plan["durationNote"] == (day.durationNote.map(NativeJSON.string) ?? .null))
            }
        }
        precondition(weeklySignatures.count > 1, "The explicit weeks must preserve their distinct prescriptions.")
    }
}
