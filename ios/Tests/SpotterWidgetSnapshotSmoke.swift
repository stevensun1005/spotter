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

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SpotterWidgetStore(directoryURL: directory)
        let file = directory.appendingPathComponent("spotter-training-widget-v1.json")
        let unavailable = SpotterWidgetStore(directoryURL: nil)

        let workout = SpotterWidgetSnapshot.Workout(title: "  示范\n训练  ", day: "2026-11-22", minutes: 40)
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
        print("PASS widget snapshot: local day/week rollover, minimal payload, expiry, coalesced refresh, corruption, and sign-out removal")
    }
}
