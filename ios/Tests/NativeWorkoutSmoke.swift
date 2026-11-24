import Foundation

@main
struct NativeWorkoutSmoke {
    static func main() throws {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        let started = 1_795_536_000_000
        var plan = NativePlan(raw: .object([
            "title": .string("Synthetic native strength"), "date": .string("2026-11-24"), "category": .string("力量训练"),
            "minutes": .number(30), "shared": .bool(false), "video": .string(""),
            "futurePlanField": .object(["kept": .bool(true)]),
            "exercises": .array([.object([
                "name": .string("单臂划船"), "sets": .number(2), "reps": .number(10), "weight": .number(12), "unit": .string("kg"),
                "seconds": .number(0), "catalogueId": .string("12345"), "cue": .string("每手重量"), "tempo": .string("2-1-2"), "block": .string("A"),
            ])]),
        ]))
        var session = NativeWorkoutSession.start(plan: plan, planId: UUID().uuidString.lowercased(), now: started)
        expect(session.elapsedMilliseconds(at: started + 61_000) == 61_000, "Clock survives lock without timer ticks")
        session.pause(at: started + 61_000)
        expect(session.elapsedMilliseconds(at: started + 120_000) == 61_000, "Paused time stays frozen")
        session.resume(at: started + 120_000)
        expect(session.elapsedMilliseconds(at: started + 125_000) == 66_000, "Resuming adds wall-clock delta")
        session.setLine(move: 0, row: 0, key: "done", value: .bool(true))
        session.raw["futureSessionField"] = .string("preserved")
        expect(session.volumeKg == 240, "Per-side loads match Cloudflare capacity")
        session.setLine(move: 0, row: 0, key: "right", value: .object(["weight": .number(14), "reps": .number(8)]))
        expect(session.volumeKg == 232, "Explicit right side is not doubled again")
        session.addSet(move: 0)
        expect(session.rows[0].count == 3 && session.plan.exercises[0]["sets"].number == 3, "Rows and prescription stay aligned")
        expect(!session.rows[0][2]["done"].bool, "New set is unfinished")
        let result = try session.finalizing(at: started + 180_000)
        expect(result.raw["ended"].number == Double(started + 180_000), "Actual end is saved for HealthKit matching")
        expect(result.raw["clock"]["runningSince"] == .null, "A completed check-in stops the clock")
        expect(result.raw["futureSessionField"].string == "preserved", "Future session metadata survives editing")
        expect(result.plan.raw["futurePlanField"]["kept"].bool, "Future plan metadata survives editing")
        expect(result.plan.exercises[0]["catalogueId"].string == "12345", "Catalogue and prescription fields survive")
        let id = UUID().uuidString.lowercased()
        let entry = NativeWorkoutEntry(id: id, owner: "synthetic-owner", kind: "log", updated: "2026-11-24T00:00:00Z", data: result.raw)
        let encoded = try JSONEncoder().encode(entry)
        let restored = try JSONDecoder().decode(NativeWorkoutEntry.self, from: encoded)
        expect(restored == entry && restored.id == id, "Recovery reuses the same check-in ID")
        expect(restored.workoutWindow?.from == started && restored.workoutWindow?.to == started + 180_000, "History keeps the exact time window")
        do { _ = try NativeWorkoutSession.free(now: started).finalizing(at: started + 60_000); preconditionFailure("Empty check-in rejected") }
        catch NativeWorkoutProblem.noCompletedSet { }
        plan.raw["exercises"] = .array([])
        var free = NativeWorkoutSession.free(now: started)
        free.addExercise(name: " 新动作 ")
        expect(free.plan.exercises[0]["name"].string == "新动作" && free.rows[0].count == 3, "Free training uses an actual named move")
        if CommandLine.arguments.contains("--contract-fixture") {
            struct Upload: Encodable { let action = "log"; let expectedOwner = "synthetic-owner"; let id: String; let data: NativeJSON }
            let data = try JSONEncoder().encode(Upload(id: id, data: result.raw))
            print(String(decoding: data, as: UTF8.self))
        } else { print("PASS native workout: Cloudflare fields, lock clock, pause/resume, side volume, sets, check-in ID, exact time window") }
    }
}
