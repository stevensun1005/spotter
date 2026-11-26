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
        expect(session.hasCheckinContent(at: started + 125_000), "A completed set can be checked in")
        var trial = session
        trial.raw["defaultRestOverride"] = .number(75)
        trial.raw["note"] = .string("trial note")
        trial.raw["proteinShake"] = .bool(true)
        trial.raw["rest"] = .object(["until": .number(96_000), "kind": .string("组间休息")])
        trial.setLine(move: 0, row: 0, key: "weight", value: .number(30))
        trial.pause(at: started + 125_000)
        let restarted = trial.restarting(at: started + 160_000)
        expect(restarted.isRunning && restarted.started == started + 160_000 &&
               restarted.elapsedMilliseconds(at: started + 160_000) == 0, "Restart starts a fresh clock")
        expect(restarted.plan.raw == trial.plan.raw && restarted.raw["planId"] == trial.raw["planId"] &&
               restarted.raw["defaultRestOverride"].number == 75, "Restart preserves the prescribed workout and rest preference")
        expect(!restarted.hasCheckinContent(at: started + 160_000) && restarted.rows[0][0]["weight"].number == 12 &&
               restarted.raw["note"].string.isEmpty && restarted.raw["proteinShake"] == .null &&
               restarted.restStatus(at: started + 160_000) == nil, "Restart clears measurements, completed sets, notes and rest")
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

        var bench = NativePreferenceKey.newMove(name: "卧推", sets: 2, reps: 6, unit: "kg")
        bench["catalogueId"] = .string("bench")
        bench["repsMax"] = .number(10)
        func benchLog(_ day: String, load: Double, first: Double, second: Double) -> NativeWorkoutEntry {
            let prescription = NativePlan(raw: .object([
                "title": .string("Synthetic push"), "category": .string("力量训练"), "exercises": .array([bench]),
            ]))
            var recorded = NativeWorkoutSession.start(plan: prescription, planId: "", now: started)
            recorded.raw["date"] = .string(day)
            for (row, reps) in [first, second].enumerated() {
                recorded.setLine(move: 0, row: row, key: "weight", value: .number(load))
                recorded.setLine(move: 0, row: row, key: "reps", value: .number(reps))
                recorded.setLine(move: 0, row: row, key: "done", value: .bool(true))
            }
            return NativeWorkoutEntry(id: UUID().uuidString, owner: entry.owner, kind: "log", updated: day, data: recorded.raw)
        }
        let mostRecentBench = benchLog("2026-11-21", load: 50, first: 10, second: 10)
        let priorBench = benchLog("2026-11-18", load: 50, first: 10, second: 10)
        let olderBench = benchLog("2026-11-15", load: 50, first: 6, second: 6)
        var friendBench = benchLog("2026-11-22", load: 80, first: 10, second: 10)
        friendBench.owner = "not-the-signed-in-account"
        var otherVariation = benchLog("2026-11-22", load: 70, first: 10, second: 10)
        otherVariation.data["plan"]["exercises"] = .array([.object(["name": .string("卧推"), "catalogueId": .string("other")])])
        let exerciseHistory = NativeExerciseHistory(logs: [olderBench, mostRecentBench, priorBench, friendBench, otherVariation, mostRecentBench], owner: entry.owner)
        let benchProgress = exerciseHistory.matching(.init(bench))
        expect(benchProgress.map(\.day) == ["2026-11-21", "2026-11-18", "2026-11-15"],
               "Exercise history excludes other accounts, variants and duplicate logs")
        expect(benchProgress.first?.bestReps(at: 50) == 10 && benchProgress.last?.bestReps(at: 50) == 6,
               "Same-weight history tracks increases in reps separately from load")
        if let record = benchProgress.last, let work = record.rows.first {
            var warmup = work
            warmup["kind"] = .string("warmup")
            var uncompleted = work
            uncompleted["done"] = .bool(false)
            expect(record.completedRows.count == 2 && record.volumeKg == 600,
                   "Exercise charts count the logged repetitions and use the existing training volume formula")
            expect(record.estimatedMaxKg(work, formula: "epley") == 60 &&
                   abs((record.estimatedMaxKg(work, formula: "brzycki") ?? 0) - 50 * 36 / 31) < 0.001 &&
                   record.estimatedMaxKg(warmup, formula: "epley") == nil &&
                   record.estimatedMaxKg(uncompleted, formula: "epley") == nil,
                   "1RM uses the selected formula and valid completed working sets only")
        } else { preconditionFailure("Exercise data is available") }
        var unnamedVariant = mostRecentBench
        unnamedVariant.data["plan"]["exercises"] = .array([.object(["name": .string("A1 卧推（反握）")])])
        let variantProgress = NativeExerciseHistory(logs: [unnamedVariant, priorBench], owner: entry.owner)
        expect(variantProgress.matching(.init(bench)).map(\.workoutID) == [priorBench.id] &&
               variantProgress.matching(.init(.object(["name": .string("卧推（反握）")]), personalOnly: true))
                   .map(\.workoutID) == [unnamedVariant.id],
               "Old qualified variant names remain separate from the base exercise")
        let increase = exerciseHistory.increase(for: bench)
        expect(increase?.weight == 52.5 && increase?.rightWeight == nil,
               "Two successful sessions at the target produce a modest, opt-in increase")
        let incompleteHistory = NativeExerciseHistory(logs: [mostRecentBench, olderBench], owner: entry.owner)
        expect(incompleteHistory.increase(for: bench) == nil, "A session under the target blocks the increase")
        var fixed = bench
        fixed["loadPercent"] = .number(75)
        expect(exerciseHistory.increase(for: fixed) == nil, "Progression respects a prescribed percent")

        let splitHistory = NativeExerciseHistory(logs: [entry], owner: entry.owner)
        let splitMove = result.plan.exercises[0]
        if let previous = splitHistory.matching(.init(splitMove)).first,
           let source = previous.rows.first {
            var inPounds = splitMove
            inPounds["unit"] = .string("lb")
            let currentRow: NativeJSON = .object(["weight": .number(0), "reps": .number(6), "done": .bool(false), "rpe": .number(7)])
            let matchedRows = NativeExerciseHistory.previousRows(for: [currentRow, currentRow], from: previous, move: inPounds)
            expect(matchedRows.count == 2 && matchedRows[0] != nil && matchedRows[1] == nil,
                   "Set positions preserve skipped rows")
            let copied = NativeExerciseHistory.copied(currentRow, from: source, record: previous, move: inPounds)
            expect(copied["weight"].number == 26.46 && copied["right"]["weight"].number == 30.86 &&
                   copied["right"]["reps"].number == 8 && copied["rpe"].number == 7 && !copied["done"].bool,
                   "Only recorded quantities copy into unfinished sets, converting both weights without changing today's RPE")
            var completed = currentRow
            completed["done"] = .bool(true)
            expect(NativeExerciseHistory.copied(completed, from: source, record: previous, move: inPounds) == completed,
                   "A completed set is protected")
        } else { preconditionFailure("Personal split-set history is available") }
        for activity in NativeWorkoutSession.CardioActivity.allCases {
            var scheduled = NativeWorkoutSession.free(cardio: activity, now: started)
            if activity.tracksDistance {
                scheduled.raw["cardio"]["distanceKm"] = .number(1.8)
                scheduled.raw["cardio"]["speedKmh"] = .number(activity.maximumSpeedKmh > 50 ? 56 : 7)
            }
            let log = try scheduled.finalizing(at: started + 97_000)
            expect(log.cardioActivity == activity && log.watchCardioActivity == activity &&
                   log.raw["cardio"]["durationSeconds"].number == 97 && log.rows.isEmpty,
                   "Every cardio activity retains its Watch family and completes with elapsed time and no strength sets")
            expect(log.raw["cardio"]["distanceKm"] == scheduled.raw["cardio"]["distanceKm"] &&
                   log.raw["cardio"]["speedKmh"] == scheduled.raw["cardio"]["speedKmh"], "Optional cardio metrics survive completion")
            let restarted = log.restarting(at: started + 100_000)
            expect(restarted.cardioActivity == activity && restarted.raw["cardio"]["distanceKm"] == .null &&
                   !restarted.hasCheckinContent(at: started + 100_999) &&
                   restarted.hasCheckinContent(at: started + 101_000), "Restart keeps the cardio activity and clears recorded metrics")
            do { _ = try scheduled.finalizing(at: started); preconditionFailure("Zero-duration cardio check-in rejected") }
            catch NativeWorkoutProblem.invalidCardioDuration { }
        }
        let cardioPresets = NativeWorkoutSession.CardioActivity.planPresets
        let presetPlan = NativePlan(raw: .object([
            "category": .string("有氧训练"),
            "exercises": .array([NativeWorkoutSession.CardioActivity.rowing.planMove!]),
        ]))
        let plannedRow = NativeWorkoutSession.start(plan: presetPlan, planId: "rower-plan", now: started)
        expect(plannedRow.cardioActivity == nil && plannedRow.watchCardioActivity == .rowing && plannedRow.rows.count == 1,
               "A planned row keeps its timed set and starts the corresponding Watch workout")
        var mixedPlan = presetPlan
        mixedPlan.raw["exercises"] = .array([presetPlan.exercises[0], NativeWorkoutSession.CardioActivity.running.planMove!])
        expect(NativeWorkoutSession.start(plan: mixedPlan, planId: "mixed-cardio", now: started).watchCardioActivity == .cardio,
               "A multi-activity cardio plan uses a mixed Watch workout")
        expect(cardioPresets.allSatisfy { preset in
            guard let move = preset.planMove else { return false }
            return move["sets"].number == 1 && move["reps"].number == 0 && move["seconds"].number > 0 &&
                NativeWorkoutSession.CardioActivity.fromPlannedMove(move) == preset
        }, "Cardio plan presets are timed catalogue moves with stable activity identities")
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

        var timedWorkout = NativeWorkoutSession.start(plan: plan, planId: "", now: started)
        expect(timedWorkout.restStatus(at: started) == nil && timedWorkout.runningRestDeadlineMilliseconds == nil,
               "A workout without a rest has no countdown or deadline")
        let firstCompletion = timedWorkout.completeSet(at: a1, now: started + 10_000)!
        expect(timedWorkout.restStatus(at: started + 10_000) == .init(kind: "换动作", remainingSeconds: 25) &&
               timedWorkout.runningRestDeadlineMilliseconds == started + 35_000,
               "Marking the first set schedules the superset transition using the current workout clock")
        expect(timedWorkout.completeSet(at: a1, now: started + 12_000) == nil &&
               timedWorkout.runningRestDeadlineMilliseconds == started + 35_000,
               "A duplicate completion cannot overwrite the rest deadline")
        let secondCompletion = timedWorkout.completeSet(at: b1, after: firstCompletion.position, now: started + 15_000)!
        timedWorkout.setLine(move: 1, row: 0, key: "weight", value: .number(20))
        timedWorkout.raw["note"] = .string("Keep later edits")
        expect(timedWorkout.undoSetCompletion(secondCompletion, at: started + 20_000) &&
               timedWorkout.line(at: a1)?["done"].bool == true && timedWorkout.line(at: b1)?["done"].bool == false &&
               timedWorkout.line(at: b1)?["weight"].number == 20 && timedWorkout.raw["note"].string == "Keep later edits",
               "Undo reopens the exact last set and keeps other sets and later edits")
        expect(timedWorkout.restStatus(at: started + 20_000) == .init(kind: "换动作", remainingSeconds: 15) &&
               !timedWorkout.undoSetCompletion(secondCompletion, at: started + 21_000),
               "Undo restores only the still-running prior rest and cannot be repeated with a stale receipt")
        let repeatCompletion = timedWorkout.completeSet(at: b1, after: a1, now: started + 22_000)!
        expect(timedWorkout.undoSetCompletion(repeatCompletion, at: started + 36_000) &&
               timedWorkout.restStatus(at: started + 36_000) == nil,
               "Undo cannot restart an expired prior rest")
        let timerCompletion = timedWorkout.completeSet(at: b1, after: a1, now: started + 40_000)!
        expect(timedWorkout.adjustRest(by: 15, at: started + 42_000) &&
               timedWorkout.runningRestDeadlineMilliseconds == started + 105_000,
               "Adding rest extends the deadline rather than restarting the countdown")
        timedWorkout.pause(at: started + 44_000)
        expect(timedWorkout.runningRestDeadlineMilliseconds == nil &&
               timedWorkout.restStatus(at: started + 100_000)?.remainingSeconds == 61,
               "Pausing freezes remaining rest and cancels the wall-clock deadline")
        expect(timedWorkout.adjustRest(by: -15, at: started + 100_000) &&
               timedWorkout.restStatus(at: started + 120_000)?.remainingSeconds == 46,
               "Adjustment during pause changes the frozen remaining time")
        timedWorkout.resume(at: started + 120_000)
        expect(timedWorkout.runningRestDeadlineMilliseconds == started + 166_000 &&
               timedWorkout.restStatus(at: started + 165_500)?.remainingSeconds == 1,
               "Resuming shifts the exact deadline by the time spent paused")
        expect(timedWorkout.adjustRest(by: -15, at: started + 165_500) &&
               timedWorkout.restStatus(at: started + 165_500)?.remainingSeconds == 0,
               "Adjusting near zero clamps to now and never displays a negative rest")
        expect(timedWorkout.adjustRest(by: 15, at: started + 200_000) &&
               timedWorkout.restStatus(at: started + 200_000)?.remainingSeconds == 15,
               "Extending an expired rest starts the extra time from now")
        expect(timedWorkout.adjustRest(by: 1_000, at: started + 200_000) &&
               timedWorkout.restStatus(at: started + 200_000)?.remainingSeconds == 600,
               "Rest adjustments respect the supported ten-minute maximum")
        timedWorkout.clearRest()
        expect(timedWorkout.restStatus(at: started + 200_000) == nil &&
               timedWorkout.runningRestDeadlineMilliseconds == nil &&
               !timedWorkout.adjustRest(by: 15, at: started + 200_000) &&
               timedWorkout.line(at: timerCompletion.position)?["done"].bool == true,
               "Skipping rest removes its deadline and keeps the completed set")

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
        } else { print("PASS native workout: clock, rest adjustment, set undo, side volume, set reuse, supersets, cardio/HIIT, check-in ID, time window, sharing and imports") }
    }
}
