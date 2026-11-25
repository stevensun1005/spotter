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
        print("Watch heart rate smoke checks passed")
    }
}
