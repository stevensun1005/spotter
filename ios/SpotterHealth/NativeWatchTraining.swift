import Foundation

extension NativeWatchWorkoutSnapshot {
    init(session: NativeWorkoutSession, previous: NativeWorkoutSession.SetPosition?,
         countdown: NativeWorkoutSession.SetCountdown? = nil, history: NativeExerciseHistory? = nil) {
        func milliseconds(_ value: NativeJSON, max: Int) -> Int? {
            guard case .number(let number) = value, (0...Double(max)).contains(number) else { return nil }
            return Int(number.rounded(.up))
        }

        func text(_ value: String, fallback: String, limit: Int = 100) -> String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? fallback : String(decoding: trimmed.utf16.prefix(limit), as: UTF16.self)
        }

        func weight(_ value: NativeJSON) -> Double {
            let number = value.number
            guard (0...2_000).contains(number) else { return 0 }
            return (number * 1_000).rounded() / 1_000
        }

        let clock = session.raw["clock"]
        let rows = session.rows
        let next = session.nextSet(after: previous).map { Position(move: $0.move, row: $0.row) }
        let exercises = session.plan.exercises.prefix(30).enumerated().map { index, move in
            let label = NativeExerciseLabel(move)
            let recorded = index == next?.move ? previousHistory(history, for: move) : nil
            let historicalRows = recorded.flatMap { record in
                rows.indices.contains(index) ? NativeExerciseHistory.previousRows(for: rows[index], from: record, move: move) : nil
            } ?? []
            let sets: [Set] = rows.indices.contains(index) ? rows[index].prefix(30).enumerated().map { row, set in
                let right: Side? = if case .object = set["right"] {
                    .init(weight: weight(set["right"]["weight"]), reps: milliseconds(set["right"]["reps"], max: 999) ?? 0)
                } else { nil }
                let matchingRow = row == next?.row && historicalRows.indices.contains(row) ? historicalRows[row] : nil
                let prior: Side? = matchingRow.flatMap { historical in
                    guard let recorded else { return nil }
                    let converted = NativeExerciseHistory.convert(historical["weight"].number, from: recorded.unit, to: NativeExerciseHistory.unit(of: move))
                    return Side(weight: weight(.number(converted)), reps: milliseconds(historical["reps"], max: 999) ?? 0)
                }
                return .init(index: row, weight: weight(set["weight"]), reps: milliseconds(set["reps"], max: 999) ?? 0,
                             seconds: milliseconds(set["seconds"], max: 18_000) ?? 0, done: set["done"].bool, right: right, previous: prior)
            } : []
            return Exercise(index: index, name: text(label.name, fallback: "动作"),
                            unit: move["unit"].string == "lb" ? "lb" : "kg", isTimed: move["seconds"].number > 0, sets: sets,
                            block: label.slot.isEmpty ? nil : text(label.slot, fallback: "", limit: 16),
                            tempo: NativeExerciseTempo.display(move, category: session.plan.category)?.value,
                            allowsSeparateSides: NativeWorkoutSession.isPerSideLoad(move) ? true : nil)
        }

        let deadline = milliseconds(session.raw["rest"]["until"],
                                    max: Self.maximumElapsedMilliseconds + Self.maximumRestMilliseconds)
        self.init(title: text(session.plan.title, fallback: "训练"),
                  elapsedMilliseconds: milliseconds(clock["elapsed"], max: Self.maximumElapsedMilliseconds) ?? session.elapsedMilliseconds(),
                  runningSinceMilliseconds: milliseconds(clock["runningSince"], max: 9_999_999_999_999).map(Int64.init),
                  restElapsedDeadlineMilliseconds: deadline,
                  restLabel: deadline == nil ? nil : text(session.raw["rest"]["kind"].string, fallback: "组间休息", limit: 30),
                  next: next?.isValid == true ? next : nil, exercises: exercises,
                  activeSetTimer: countdown.map { timer in
                      .init(position: .init(move: timer.position.move, row: timer.position.row), durationSeconds: timer.targetSeconds,
                            elapsedDeadlineMilliseconds: timer.startedAtElapsed + timer.targetSeconds * 1_000)
                  }, timeBasedFinish: session.cardioActivity != nil || session.raw["finishedVideo"].bool ? true : nil)
    }
}


private func previousHistory(_ history: NativeExerciseHistory?, for move: NativeJSON) -> NativeExerciseHistory.Record? {
    guard move["seconds"].number == 0 else { return nil }
    return history?.matching(.init(move)).first {
        $0.isTimed == false && $0.warmup == NativeExerciseLabel(move).warmup
    }
}

struct NativeWatchLaunchOption: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let title: String
    let day: String
    let isResume: Bool
    var plan: NativeJSON? = nil

    var valid: Bool {
        !id.isEmpty && id.utf16.count <= 100 && (1...100).contains(title.utf16.count) &&
            day.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    }
}

struct NativeWatchTrainingCatalog: Codable, Equatable, Sendable {
    static let key = "spotterWatchPlans"
    static let maxSize = 55 * 1_024

    let binding: String?
    var options: [NativeWatchLaunchOption]

    func encoded() -> Data? {
        var catalog = self
        while let data = try? JSONEncoder().encode(catalog) {
            if data.count <= Self.maxSize { return data }
            if let index = catalog.options.lastIndex(where: { $0.plan != nil }) {
                catalog.options[index].plan = nil
            } else { return nil }
        }
        return nil
    }

    static func decode(_ data: Data) -> Self? {
        guard data.count <= maxSize, let packet = try? JSONDecoder().decode(Self.self, from: data),
              packet.binding.map({ $0.utf16.count == 64 }) ?? packet.options.isEmpty,
              packet.options.count <= 8, packet.options.allSatisfy(\.valid) else { return nil }
        return packet
    }
}

struct NativeWatchNearbyLaunch: Codable, Sendable {
    static let key = "spotterWatchStart"
    let binding: String
    let optionID: String
}

struct NativeWatchOfflineCheckin: Codable, Equatable, Sendable {
    static let key = "spotterWatchCheckin"
    static let acceptedKey = "spotterWatchCheckinAccepted"
    static let maxSize = 320 * 1_024

    let id: UUID
    let binding: String
    var finished: NativeJSON
    var summary: NativeWorkoutHealthSummary? = nil

    func encoded() -> Data? {
        guard let bytes = try? JSONEncoder().encode(self), bytes.count <= Self.maxSize else { return nil }
        return bytes
    }

    static func decode(_ bytes: Data) -> Self? {
        guard bytes.count <= maxSize, let value = try? JSONDecoder().decode(Self.self, from: bytes),
              value.binding.utf16.count == 64, !value.finished["planId"].string.isEmpty,
              value.finished["date"].string.utf16.count == 10,
              (946_684_800_000...4_102_444_800_000).contains(value.finished["started"].number),
              (value.finished["started"].number...value.finished["started"].number + 86_400_000)
                .contains(value.finished["ended"].number),
              value.finished["plan"]["exercises"].array.count <= 30,
              value.finished["rows"].array.count == value.finished["plan"]["exercises"].array.count else { return nil }
        return value
    }
}

extension NativeWorkoutSession {
    mutating func completeWatchSet(_ command: NativeWatchWorkoutCommand, at position: SetPosition,
                                   after previous: SetPosition?, countdown: SetCountdown?,
                                   now: Int = Self.nowMilliseconds) -> SetCompletion? {
        guard let line = line(at: position), nextSet(after: previous) == position else { return nil }
        if let weight = command.weight { setLine(move: position.move, row: position.row, key: "weight", value: .number(weight)) }
        if let reps = command.reps { setLine(move: position.move, row: position.row, key: "reps", value: .number(Double(reps))) }
        if let seconds = command.seconds { setLine(move: position.move, row: position.row, key: "seconds", value: .number(Double(seconds))) }
        if command.rightWeight != nil || command.rightReps != nil {
            var right = line["right"]
            if right == .null { right = .object(["weight": line["weight"], "reps": line["reps"]]) }
            if let value = command.rightWeight { right["weight"] = .number(value) }
            if let value = command.rightReps { right["reps"] = .number(Double(value)) }
            setLine(move: position.move, row: position.row, key: "right", value: right)
        }
        let measured = countdown.flatMap { $0.position == position ? $0.recordedSeconds(at: elapsedMilliseconds(at: now)) : nil }
        return completeSet(at: position, after: previous, measuredSeconds: measured, now: now)
    }
}

struct NativeWatchOfflineWorkout: Codable, Equatable, Sendable {
    let id: UUID
    let binding: String
    private(set) var raw: NativeJSON
    private(set) var revision = 0
    private(set) var previous: NativeWorkoutSession.SetPosition?
    private(set) var countdown: NativeWorkoutSession.SetCountdown?

    var workout: NativeWorkoutSession { .init(raw: raw) }

    var state: NativeWatchWorkoutStatePacket {
        .init(token: id, revision: revision, snapshot: .init(session: workout, previous: previous, countdown: countdown))
    }

    init?(option: NativeWatchLaunchOption, binding: String, now: Int = NativeWorkoutSession.nowMilliseconds) {
        guard !option.isResume, option.valid, let rawPlan = option.plan else { return nil }
        let plan = NativePlan(raw: rawPlan)
        guard (1...30).contains(plan.exercises.count), plan.video.isEmpty, plan.exercises.allSatisfy({
            (1...30).contains($0["sets"].number) && $0["sets"].number.rounded() == $0["sets"].number
        }) else { return nil }
        let session = NativeWorkoutSession.start(plan: plan, planId: option.id, now: now)
        guard NativeWatchWorkoutSnapshot(session: session, previous: nil).isValid else { return nil }
        self.id = UUID()
        self.binding = binding
        self.raw = session.raw
    }

    mutating func apply(_ command: NativeWatchWorkoutCommand, now: Int = NativeWorkoutSession.nowMilliseconds) -> Bool {
        guard command.encoded() != nil, state.allows(command) else { return false }
        var workout = self.workout
        let position = command.position.map { NativeWorkoutSession.SetPosition(move: $0.move, row: $0.row) }
        switch command.action {
        case .completeSet:
            guard let position, let completion = workout.completeWatchSet(command, at: position, after: previous,
                                                                          countdown: countdown, now: now) else { return false }
            previous = completion.position
            countdown = nil
        case .setRunning:
            if command.running == true { workout.resume(at: now) }
            else { workout.pause(at: now) }
        case .startSetTimer:
            guard let position else { return false }
            if let seconds = command.seconds {
                workout.setLine(move: position.move, row: position.row, key: "seconds", value: .number(Double(seconds)))
            }
            guard let target = workout.countdownTarget(at: position) else { return false }
            countdown = .init(workoutID: id.uuidString, position: position, startedAtElapsed: workout.elapsedMilliseconds(at: now),
                              targetSeconds: target)
            workout.clearRest()
            workout.resume(at: now)
        case .cancelSetTimer:
            countdown = nil
        case .skipRest:
            workout.clearRest()
        case .adjustRest:
            guard let adjustment = command.adjustment, workout.adjustRest(by: adjustment, at: now) else { return false }
        case .finishWorkout, .refresh:
            return false
        }
        raw = workout.raw
        revision += 1
        return true
    }

    func finalizing(now: Int = NativeWorkoutSession.nowMilliseconds) throws -> NativeWatchOfflineCheckin {
        .init(id: id, binding: binding, finished: try workout.finalizing(at: now).raw)
    }
}
