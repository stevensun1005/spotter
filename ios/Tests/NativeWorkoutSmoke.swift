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
        var second = entry
        second.id = UUID().uuidString.lowercased()
        second.data["started"] = .number(Double(started + 210_000))
        var otherOwner = second
        otherOwner.id = UUID().uuidString.lowercased()
        otherOwner.owner = "another-synthetic-owner"
        var otherDay = second
        otherDay.id = UUID().uuidString.lowercased()
        otherDay.data["date"] = .string("2000-01-01")
        var draft = second
        draft.id = UUID().uuidString.lowercased()
        draft.kind = "draft"
        let candidates = [second, entry, otherOwner, otherDay, draft, second]
        let shared = NativeWorkoutShareSummary.entries(for: entry, among: candidates, owner: entry.owner, merge: true)
        expect(shared == [entry, second], "Share merge keeps own completed records from the same day once, in time order")
        expect(NativeWorkoutShareSummary.entries(for: otherOwner, among: candidates, owner: entry.owner, merge: true).isEmpty,
               "A friend or partner record cannot generate an own-account poster")
        expect(NativeWorkoutShareSummary.entries(for: entry, among: candidates, owner: entry.owner, merge: false) == [entry],
               "The default poster includes just the selected workout")
        let poster = NativeWorkoutShareSummary(entry: entry, logs: shared)
        expect(poster.workouts[0].moves.first?.sets == ["左 12 kg × 10 · 右 14 kg × 8"] && poster.workouts[0].moves.first?.slot == "A1",
               "Poster rows preserve grouping and completed side loads without displaying unfinished sets")
        expect(poster.minutes == 2 * entry.durationMinutes && poster.sets == 2 && poster.volume == 464,
               "Poster totals use actual elapsed workout minutes, sets, and combined sides")
        do { _ = try NativeWorkoutSession.free(now: started).finalizing(at: started + 60_000); preconditionFailure("Empty check-in rejected") }
        catch NativeWorkoutProblem.noCompletedSet { }
        plan.raw["exercises"] = .array([])
        var free = NativeWorkoutSession.free(now: started)
        free.addExercise(name: " 新动作 ")
        expect(free.plan.exercises[0]["name"].string == "新动作" && free.rows[0].count == 3, "Free training uses an actual named move")
        let recentMove: NativeJSON = .object(["name": .string("划船"), "catalogueId": .string("12345"),
                                               "sets": .number(2), "reps": .number(9), "weight": .number(18),
                                               "seconds": .number(0), "unit": .string("lb")])
        free.addExercise(recentMove, previousSet: .object(["weight": .number(18), "reps": .number(9), "seconds": .number(0),
                                                           "done": .bool(true), "rpe": .number(7),
                                                           "right": .object(["weight": .number(16), "reps": .number(8)])]))
        expect(free.rows[1][0]["right"]["weight"].number == 16 && free.rows[1][0]["right"]["reps"].number == 8,
               "Reuse copies actual left/right weights and reps")
        expect(!free.rows[1][0]["done"].bool && free.rows[1][0]["rpe"] == .null &&
               free.plan.exercises[1]["catalogueId"].string == "12345", "Reused sets remain unfinished and retain the stable catalogue ID")
        for activity in [NativeWorkoutSession.CardioActivity.cardio, .hiit, .incline] {
            let scheduled = NativeWorkoutSession.free(cardio: activity, now: started)
            let log = try scheduled.finalizing(at: started + 97_000)
            expect(log.cardioActivity == activity && log.raw["cardio"]["durationSeconds"].number == 97 && log.rows.isEmpty,
                   "All cardio types complete with elapsed time and no strength sets")
            do { _ = try scheduled.finalizing(at: started); preconditionFailure("Zero-duration cardio check-in rejected") }
            catch NativeWorkoutProblem.invalidCardioDuration { }
        }
        var firstMove = recentMove
        firstMove["block"] = .string("A")
        var secondMove = firstMove
        secondMove["name"] = .string("哑铃推举")
        secondMove["restSeconds"] = .number(50)
        plan.raw["defaultRestSeconds"] = .number(25)
        plan.raw["exercises"] = .array([firstMove, secondMove])
        var superset = NativeWorkoutSession.start(plan: plan, planId: "", now: started)
        let a1 = NativeWorkoutSession.SetPosition(move: 0, row: 0)
        let b1 = NativeWorkoutSession.SetPosition(move: 1, row: 0)
        let a2 = NativeWorkoutSession.SetPosition(move: 0, row: 1)
        superset.setLine(move: 0, row: 0, key: "done", value: .bool(true))
        expect(superset.nextSet(after: a1) == b1 && superset.restBetween(a1, and: b1).kind == "换动作",
               "A superset advances to its second exercise before the next round")
        superset.setLine(move: 1, row: 0, key: "done", value: .bool(true))
        expect(superset.nextSet(after: b1) == a2 && superset.restBetween(b1, and: a2).seconds == 50 &&
               superset.restBetween(b1, and: a2).kind == "轮间休息", "Round rest uses the longest movement rest")

        let imported = try NativePlanImport.parse("""
        ## Synthetic lower body
        - 单侧低台下踩 3×8–10次，12.5 lb，休息 90 秒，节奏 30X0
        - 平板支撑 2组每组30秒
        https://youtu.be/synthetic
        """, today: "2026-11-24")
        let training = NativePlan(raw: imported[0])
        expect(imported.count == 1 && training.title == "Synthetic lower body" && training.date == "2026-11-24", "Pasted text creates a plan on the local day")
        expect(training.video == "https://youtu.be/synthetic" && !training.raw["shared"].bool, "A link is preserved and imports start private")
        expect(training.exercises[0]["unit"].string == "lb" && training.exercises[0]["weight"].number == 12.5, "Original weight and unit survive import")
        expect(training.exercises[0]["repsMax"].number == 10 && training.exercises[0]["restSeconds"].number == 90 && training.exercises[0]["tempo"].string == "3-0-X-0", "Rep ranges, rest and tempo survive import")
        expect(training.exercises[1]["seconds"].number == 30 && training.exercises[1]["reps"].number == 0, "Timed moves use seconds")
        let videos = try NativePlanImport.parse("https://b23.tv/test\nhttps://b23.tv/test", today: "2026-11-24")
        expect(videos.count == 1 && videos[0]["exercises"].array.isEmpty, "A unique video creates an exercise-free plan")
        let json = String(decoding: try JSONEncoder().encode(training.raw), as: UTF8.self)
        let fenced = try NativePlanImport.parse("```json\n\(json)\n```", today: "2026-12-01")
        expect(fenced == imported, "Fenced single JSON plans retain their original dates")
        for invalid in ["{\"format\":\"spotter-backup\"}", "{\"format\":\"spotter-program\"}", "https://youtube.com.example.org/watch/1", json.replacingOccurrences(of: "2026-11-24", with: "2026-11-31")] {
            do { _ = try NativePlanImport.parse(invalid, today: "2026-11-24"); preconditionFailure("Invalid plan import should fail") }
            catch is NativePlanImport.Problem { }
        }
        if CommandLine.arguments.contains("--contract-fixture") {
            struct Upload: Encodable { let action = "log"; let expectedOwner = "synthetic-owner"; let id: String; let data: NativeJSON }
            let data = try JSONEncoder().encode(Upload(id: id, data: result.raw))
            print(String(decoding: data, as: UTF8.self))
        } else { print("PASS native workout: clock, side volume, set reuse, supersets, cardio/HIIT, check-in ID, time window, sharing and imports") }
    }
}
