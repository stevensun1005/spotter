import Foundation

@main
struct NativeWatchHeartRateSmoke {
    static func main() {
        let now = Date(timeIntervalSince1970: 1_795_623_500)
        let started = now.addingTimeInterval(-20)

        func sample(_ bpm: Double = 138.2, offset: TimeInterval = -1, version: Int = 1,
                    after: Date? = nil, requestedAt: Date? = nil) -> NativeWatchHeartRatePacket? {
            let time = Int64(now.addingTimeInterval(offset).timeIntervalSince1970 * 1_000)
            let data = Data("{\"kind\":\"heartRate\",\"version\":\(version),\"bpm\":\(bpm),\"measuredAtMilliseconds\":\(time)}".utf8)
            return .init(data, requestedAt: requestedAt ?? started, after: after, now: now)
        }

        guard case .reading(let reading) = sample() else { fatalError("A current Watch measurement should be accepted") }
        precondition(reading.bpm == 138 && reading.isFresh(at: now))
        precondition(!reading.isFresh(at: now.addingTimeInterval(30)))
        precondition(sample(offset: -32, requestedAt: now.addingTimeInterval(-40)) == nil)
        precondition(sample(offset: -21) == nil)
        precondition(sample(offset: 6) == nil)
        precondition(sample(after: reading.measuredAt) == nil)
        precondition(sample(offset: -2, after: reading.measuredAt) == nil)
        precondition(sample(19) == nil && sample(261) == nil && sample(version: 2) == nil)
        precondition(NativeWatchHeartRatePacket(Data(count: 513), requestedAt: started, after: nil, now: now) == nil)

        let paused = Data(#"{"kind":"status","version":1,"status":"paused"}"#.utf8)
        guard case .status(.paused) = NativeWatchHeartRatePacket(paused, requestedAt: started, after: nil, now: now)
        else { fatalError("Watch pause state was lost") }

        let context = NativeWatchWorkoutContext(owner: "test-one", workoutID: "workout-one", isRunning: true)
        precondition(context.matches(.init(owner: "test-one", workoutID: "workout-one", isRunning: false)))
        precondition(!context.matches(.init(owner: "test-one", workoutID: "workout-two", isRunning: true)))
        precondition(!context.matches(.init(owner: "test-two", workoutID: "workout-one", isRunning: true)))

        testWorkoutMirror(at: now)
        print("Watch heart rate and workout mirror smoke checks passed")
    }

    static func testWorkoutMirror(at now: Date) {
        typealias Snapshot = NativeWatchWorkoutSnapshot
        typealias Command = NativeWatchWorkoutCommand
        let nowMilliseconds = Int64(now.timeIntervalSince1970 * 1_000)
        let position = Snapshot.Position(move: 0, row: 0)
        let reps = Snapshot.Exercise(index: 0, name: "锤式弯举", unit: "lb", isTimed: false,
                                     sets: [.init(index: 0, weight: 20, reps: 8, seconds: 0, done: false)])
        let snapshot = Snapshot(title: "力量训练", elapsedMilliseconds: 1_500, runningSinceMilliseconds: nowMilliseconds - 2_000,
                                restElapsedDeadlineMilliseconds: 5_001, restLabel: "组间休息", next: position, exercises: [reps])
        let token = UUID()
        let message = NativeWatchWorkoutStatePacket(token: token, revision: 3, snapshot: snapshot)
        let encoded = message.encoded()!
        let watchCopy = NativeWatchWorkoutStatePacket.decode(encoded)!
        precondition(watchCopy.token == token && watchCopy.revision == 3 && watchCopy.snapshot == snapshot)
        precondition(snapshot.elapsed(at: now) == 3_500 && snapshot.restRemainingSeconds(at: now) == 2)

        let complete = Command(token: token, revision: 3, action: .completeSet, position: position, weight: 22.5, reps: 8)
        let phoneCopy = Command.decode(complete.encoded()!)!
        precondition(phoneCopy.id == complete.id && phoneCopy.weight == 22.5 && watchCopy.allows(phoneCopy))
        precondition(!watchCopy.allows(Command(token: UUID(), revision: 3, action: .completeSet, position: position)))
        precondition(!watchCopy.allows(Command(token: token, revision: 2, action: .completeSet, position: position)))
        precondition(!watchCopy.allows(Command(token: token, revision: 3, action: .completeSet, position: .init(move: 0, row: 1))))
        precondition(!watchCopy.allows(Command(token: token, revision: 3, action: .completeSet, position: position, seconds: 15)))
        precondition(Command(token: token, revision: 3, action: .completeSet, position: position, weight: -1).encoded() == nil)
        precondition(Command(token: token, revision: 3, action: .adjustRest, adjustment: 300).encoded() == nil)
        precondition(Command(token: token, revision: 3, action: .setRunning).encoded() == nil)
        precondition(watchCopy.allows(Command(token: token, revision: 3, action: .adjustRest, adjustment: -15)))

        let done = Snapshot.Exercise(index: 0, name: "锤式弯举", unit: "lb", isTimed: false,
                                     sets: [.init(index: 0, weight: 22.5, reps: 8, seconds: 0, done: true)])
        let saved = Snapshot(title: "力量训练", elapsedMilliseconds: 3_500, runningSinceMilliseconds: nil,
                             restElapsedDeadlineMilliseconds: nil, restLabel: nil, next: nil, exercises: [done])
        let acknowledgement = NativeWatchWorkoutAcknowledgement(id: complete.id, applied: true)
        let newMessage = NativeWatchWorkoutStatePacket(token: token, revision: 4, snapshot: saved, acknowledgement: acknowledgement)
        precondition(!newMessage.allows(complete))
        precondition(NativeWatchWorkoutStatePacket.decode(newMessage.encoded()!)?.acknowledgement == acknowledgement)
        precondition(saved.elapsed(at: now.addingTimeInterval(60)) == 3_500)
        precondition(!newMessage.allows(Command(token: token, revision: 4, action: .skipRest)))

        let timed = Snapshot.Exercise(index: 0, name: "平板支撑", unit: "kg", isTimed: true,
                                      sets: [.init(index: 0, weight: 0, reps: 0, seconds: 0, done: false)])
        let timedSnapshot = Snapshot(title: "核心训练", elapsedMilliseconds: 0, runningSinceMilliseconds: nowMilliseconds,
                                      restElapsedDeadlineMilliseconds: nil, restLabel: nil, next: position, exercises: [timed])
        precondition(timedSnapshot.allows(Command(token: token, revision: 0, action: .completeSet, position: position, seconds: 30)))
        precondition(!timedSnapshot.allows(Command(token: token, revision: 0, action: .completeSet, position: position, reps: 1)))

        let fullWorkout = (0..<30).map { move in
            Snapshot.Exercise(index: move, name: String(repeating: "深", count: 100), unit: "lb", isTimed: false,
                              sets: (0..<30).map { .init(index: $0, weight: 1_999.123, reps: 989, seconds: 16_999,
                                                         done: false, right: .init(weight: 1_900.456, reps: 977)) })
        }
        let full = Snapshot(title: "完整计划", elapsedMilliseconds: 0, runningSinceMilliseconds: nowMilliseconds,
                             restElapsedDeadlineMilliseconds: nil, restLabel: nil, next: position, exercises: fullWorkout)
        let fullPacket = NativeWatchWorkoutStatePacket(token: token, revision: 0, snapshot: full).encoded()
        precondition(fullPacket.flatMap(NativeWatchWorkoutStatePacket.decode)?.snapshot.exercises.last?.sets.count == 30)
    }
}
