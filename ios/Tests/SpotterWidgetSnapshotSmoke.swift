import Foundation

@main
struct SpotterWidgetSnapshotSmoke {
    static func main() throws {
        let date = ISO8601DateFormatter().date(from: "2026-11-23T02:30:00Z")!
        let toronto = TimeZone(identifier: "America/Toronto")!
        let utc = TimeZone(secondsFromGMT: 0)!
        precondition(SpotterWidgetSnapshot.dayKey(for: date, timeZone: toronto) == "2026-11-22")
        precondition(SpotterWidgetSnapshot.weekStartKey(for: date, timeZone: toronto) == "2026-11-16")
        precondition(SpotterWidgetSnapshot.dayKey(for: date, timeZone: utc) == "2026-11-23")
        precondition(SpotterWidgetSnapshot.weekStartKey(for: date, timeZone: utc) == "2026-11-23")
        precondition(SpotterWidgetSnapshot.weekDays(startingAt: "2026-11-16")
            == ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"])
        precondition(SpotterWidgetSnapshot.weekDays(startingAt: "2026-11-17").isEmpty)
        precondition(SpotterWidgetSnapshot.isDayKey("2024-02-29"))
        precondition(!SpotterWidgetSnapshot.isDayKey("2026-02-29"))
        precondition(SpotterWidgetSnapshot.isEntryID("synthetic-plan"))
        precondition(!SpotterWidgetSnapshot.isEntryID(" plan\n"))
        let heatmap = SpotterWidgetSnapshot.yearDays(endingAt: date, timeZone: toronto)
        let heatmapDays = heatmap.compactMap { $0 }
        precondition(heatmap.count == 371 && heatmapDays.count == 365)
        precondition(heatmapDays.first == "2025-11-23" && heatmapDays.last == "2026-11-22")
        precondition(heatmap.prefix(6).allSatisfy { $0 == nil })
        precondition(SpotterWidgetSnapshot.yearDays(endingOn: "2024-03-01").contains("2024-02-29"))
        precondition(SpotterWidgetSnapshot.yearDays(endingOn: "2023-02-29").isEmpty)

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SpotterWidgetStore(directoryURL: directory)
        let file = directory.appendingPathComponent("spotter-training-widget-v1.json")
        let unavailable = SpotterWidgetStore(directoryURL: nil)

        let workout = SpotterWidgetSnapshot.Workout(title: "  示范\n训练  ", day: "2026-11-22", minutes: 40)
        let exactWorkout = SpotterWidgetSnapshot.Workout(title: "示范训练", day: "2026-11-22", minutes: 40, planID: "synthetic-plan")
        let paused = SpotterWidgetSnapshot.Active(title: "示范训练", completedSets: 1, totalSets: 3, isRunning: false)
        let running = SpotterWidgetSnapshot.Active(title: "示范训练", completedSets: 1, totalSets: 3, isRunning: true)
        let week = [true, false, true, false, false, false, false]
        func snapshot(at updatedAt: Date = date, active: SpotterWidgetSnapshot.Active = paused,
                      day: String = "2026-11-22", first: String = "2026-11-16", days: [Bool] = week) -> SpotterWidgetSnapshot {
            SpotterWidgetSnapshot(updatedAt: updatedAt, day: day, todayCompleted: 1, weekStart: first,
                                  weekCheckins: days, nextWorkout: workout, activeWorkout: active)
        }

        precondition(workout.title == "示范 训练")
        precondition(store.read(at: date) == nil && !store.remove())
        precondition(!unavailable.write(snapshot()) && unavailable.read(at: date) == nil && !unavailable.remove())
        precondition(!store.write(snapshot(days: [true])))
        precondition(!store.write(snapshot(day: "2026-11-19", first: "2026-11-17")))
        precondition(!store.write(snapshot(day: "2026-11-31", first: "2026-11-30")))

        let initial = snapshot()
        precondition(store.write(initial))
        precondition(store.read(at: date) == initial)
        precondition(!store.write(snapshot(at: date.addingTimeInterval(60))))
        precondition(store.read(at: date)?.updatedAt == date)
        precondition(store.read(at: date.addingTimeInterval(-301)) == nil)
        precondition(store.read(at: initial.expiresAt.addingTimeInterval(-1)) == initial)
        precondition(store.read(at: initial.expiresAt) == nil)

        let changed = snapshot(at: date.addingTimeInterval(60), active: running)
        precondition(store.write(changed))
        let heartbeat = snapshot(at: date.addingTimeInterval(181 * 60), active: running)
        precondition(store.write(heartbeat))
        precondition(store.read(at: heartbeat.updatedAt) == heartbeat)
        let json = try Data(contentsOf: file)
        var document = try JSONSerialization.jsonObject(with: json) as! [String: Any]
        precondition(Set(document.keys) == Set(["updatedAt", "day", "todayCompleted", "weekStart", "weekCheckins",
                                                "nextWorkout", "activeWorkout"]))
        document["futureField"] = true
        try JSONSerialization.data(withJSONObject: document).write(to: file, options: .atomic)
        precondition(store.read(at: heartbeat.updatedAt) == heartbeat)
        document["weekCheckins"] = [true]
        try JSONSerialization.data(withJSONObject: document).write(to: file, options: .atomic)
        precondition(store.read(at: heartbeat.updatedAt) == nil)
        try Data(repeating: 0x61, count: 16_385).write(to: file, options: .atomic)
        precondition(store.read(at: heartbeat.updatedAt) == nil)
        precondition(store.remove())
        precondition(store.read(at: heartbeat.updatedAt) == nil && !store.remove())

        let buddy = SpotterWidgetSnapshot.Buddy(
            id: "synthetic-buddy", name: " 示例\n搭子 ", ownDays: [.completed, .rest, .none, .planned, .none, .none, .none],
            buddyDays: [.unavailable, .completed, .none, .rest, .none, .none, .planned], todayTitle: " 示例\t训练 ")
        let meals = (1...4).map { SpotterWidgetSnapshot.Nutrition.FrequentMeal(id: "meal-\($0)", name: " 常用\n餐 \($0) ") }
        let nutrition = SpotterWidgetSnapshot.Nutrition(
            calories: 1_840, protein: 112, carbs: 204, fat: 63, waterML: 1_250,
            goals: .init(calories: 2_300, protein: 145, carbs: 260, fat: 75), frequentMeals: meals)
        let weekly = SpotterWidgetSnapshot.Weekly(weekStart: "2026-11-09", dailyMinutes: [44, 0, 52, 0, 0, 48, 0],
                                                trainingDays: 3, totalMinutes: 144, completedSets: 51, previousTrainingDays: 3)
        let yearly = SpotterWidgetSnapshot.Year(dailyMinutes: ["2025-11-23": 20, "2026-11-16": 0, "2026-11-22": 48])
        let progress = [
            SpotterWidgetSnapshot.WeekDay(trainingState: .planned, trainingProgress: 0.5,
                                          nutritionProgress: 0.75, hasNutritionRecord: true),
            .init(trainingState: .rest, trainingProgress: 0, nutritionProgress: nil, hasNutritionRecord: false)
        ] + Array(repeating: .init(trainingState: .unavailable, trainingProgress: 0,
                                    nutritionProgress: nil, hasNutritionRecord: nil), count: 5)
        func collection(at updatedAt: Date = date, nutrition: SpotterWidgetSnapshot.Nutrition? = nutrition,
                        year: SpotterWidgetSnapshot.Year? = yearly, progressWeek: [SpotterWidgetSnapshot.WeekDay]? = progress)
        -> SpotterWidgetSnapshot {
            SpotterWidgetSnapshot(updatedAt: updatedAt, day: "2026-11-22", todayCompleted: 1, weekStart: "2026-11-16",
                                  weekCheckins: week, nextWorkout: exactWorkout, activeWorkout: nil,
                                  buddy: buddy, nutrition: nutrition, weekly: weekly, year: year, progressWeek: progressWeek)
        }
        let cards = collection()
        precondition(buddy.name == "示例 搭子" && buddy.todayTitle == "示例 训练")
        precondition(nutrition.frequentMeals.count == 3 && nutrition.frequentMeals.first?.name == "常用 餐 1")
        precondition(!store.write(collection(year: .init(dailyMinutes: ["2025-11-22": 40]))))
        precondition(!store.write(collection(year: .init(dailyMinutes: ["2026-11-23": 40]))))
        precondition(!store.write(collection(nutrition: .init(calories: 0, protein: 0, carbs: 0, fat: 0, waterML: .infinity))))
        precondition(!store.write(collection(progressWeek: Array(progress.dropLast()))))
        precondition(!store.write(collection(progressWeek: Array(repeating: .init(
            trainingState: .none, trainingProgress: 0, nutritionProgress: 1.1, hasNutritionRecord: true), count: 7))))
        precondition(store.write(cards))
        precondition(store.read(at: date) == cards)
        precondition(store.read(at: date)?.nextWorkout?.planID == "synthetic-plan")
        precondition(store.read(at: date)?.progressWeek?[1].hasNutritionRecord == false)
        precondition(store.read(at: date)?.progressWeek?[2].hasNutritionRecord == nil)
        precondition(store.read(at: date)?.year?.dailyMinutes["2026-11-16"] == 0)
        precondition(!store.write(collection(at: date.addingTimeInterval(60))))
        let newNutrition = SpotterWidgetSnapshot.Nutrition(calories: 1_840, protein: 112, carbs: 204, fat: 63, waterML: 1_500)
        precondition(store.write(collection(at: date.addingTimeInterval(60), nutrition: newNutrition)))
        precondition(store.read(at: date)?.nutrition?.waterML == 1_500)
        precondition(store.read(at: date)?.nutrition?.frequentMeals.isEmpty == true)
        precondition(store.remove())
        print("PASS widget snapshots: civil-day boundaries, workout routes, weekly rings, rolling year, refresh, expiry and sign-out removal")
    }
}
