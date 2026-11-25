import Foundation

enum NativePreferenceKey {
    static let sets = "spotter.native.workout.sets"
    static let reps = "spotter.native.workout.reps"
    static let showNext = "spotter.native.workout.showNext"
    static let showTempo = "spotter.native.workout.showTempo"
    static let showEffort = "spotter.native.workout.showEffort"
    static let autoAdvance = "spotter.native.workout.autoAdvance"
    static let defaultRest = "spotter.native.workout.defaultRest"
    static let restSound = "spotter.native.workout.restSound"
    static let restHaptics = "spotter.native.workout.restHaptics"
    static let keepAwake = "spotter.native.workout.keepAwake"
    static let unit = "spotter.native.workout.unit"
    static let exerciseLanguage = "spotter.native.catalogue.language"
    static let oneRepMax = "spotter.native.stats.1rm"
    static let equipment = "spotter.native.catalogue.gear"
    static let reduceMotion = "spotter.native.appearance.reduceMotion"
    static let largerText = "spotter.native.appearance.largerText"
    static let friendsTab = "spotter.native.modules.friends"
    static let nutritionModule = "spotter.native.modules.nutrition"
    static let weeklyCheckins = "spotter.native.modules.weeklyCheckins"
    static let planShortcut = "spotter.native.modules.planShortcut"
    static let reminderTitle = "到训练时间了，今天还有计划未完成。"

    static func reminderKey(_ owner: String, field: String) -> String {
        "spotter.native.reminder.\(field).\(owner)"
    }

    static var newMoveSets: Int { bounded(sets, default: 3, range: 1...30) }
    static var newMoveReps: Int { bounded(reps, default: 10, range: 1...100) }
    static var newMoveUnit: String { UserDefaults.standard.string(forKey: unit) == "lb" ? "lb" : "kg" }
    static var restSeconds: Int { bounded(defaultRest, default: 30, range: 0...600) }

    static func newMove(name: String, sets: Int = newMoveSets, reps: Int = newMoveReps, unit: String = newMoveUnit) -> NativeJSON {
        .object(["name": .string(name), "sets": .number(Double(sets)), "reps": .number(Double(reps)),
                 "weight": .number(0), "unit": .string(unit), "seconds": .number(0)])
    }

    private static func bounded(_ key: String, default initial: Int, range: ClosedRange<Int>) -> Int {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: key) != nil else { return initial }
        return min(range.upperBound, max(range.lowerBound, defaults.integer(forKey: key)))
    }
}


/// Keeps optional fields from the current Cloudflare schema intact when editing native sets.
enum NativeJSON: Codable, Equatable, Sendable {
    case object([String: NativeJSON]), array([NativeJSON]), string(String), number(Double), bool(Bool), null

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let item = try? value.decode(Bool.self) { self = .bool(item) }
        else if let item = try? value.decode(String.self) { self = .string(item) }
        else if let item = try? value.decode(Double.self) { self = .number(item) }
        else if let item = try? value.decode([NativeJSON].self) { self = .array(item) }
        else { self = .object(try value.decode([String: NativeJSON].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self {
        case .object(let item): try value.encode(item)
        case .array(let item): try value.encode(item)
        case .string(let item): try value.encode(item)
        case .number(let item): try value.encode(item)
        case .bool(let item): try value.encode(item)
        case .null: try value.encodeNil()
        }
    }
    var object: [String: NativeJSON] { if case .object(let value) = self { return value }; return [:] }
    var array: [NativeJSON] { if case .array(let value) = self { return value }; return [] }
    var string: String { if case .string(let value) = self { return value }; return "" }
    var number: Double {
        if case .number(let value) = self, value.isFinite, abs(value) <= 9_007_199_254_740_991 { return value }
        return 0
    }
    var bool: Bool { if case .bool(let value) = self { return value }; return false }
    subscript(_ key: String) -> NativeJSON {
        get { object[key] ?? .null }
        set { var copy = object; copy[key] = newValue; self = .object(copy) }
    }
}

struct NativePlan: Equatable, Sendable {
    var raw: NativeJSON
    var title: String { raw["title"].string }
    var date: String { raw["date"].string }
    var category: String { raw["category"].string }
    var exercises: [NativeJSON] { raw["exercises"].array }
    var video: String { raw["video"].string }
}

struct NativeWorkoutSession: Equatable, Sendable {
    var raw: NativeJSON
    var plan: NativePlan { NativePlan(raw: raw["plan"]) }
    var rows: [[NativeJSON]] { raw["rows"].array.map(\.array) }
    var started: Int { Int(raw["started"].number) }
    var isRunning: Bool { if case .number = raw["clock"]["runningSince"] { return true }; return false }
    var completedSets: Int { rows.flatMap { $0 }.filter { $0["done"].bool }.count }
    var volumeKg: Double {
        rows.enumerated().reduce(0) { total, group in
            guard group.offset < plan.exercises.count else { return total }
            let move = plan.exercises[group.offset]
            let description = move["name"].string + " " + move["cue"].string
            let excludes = description.range(of: "总重|合计|总次数|(?:只做|仅做?)[左右]", options: .regularExpression) != nil
            let perSide = !excludes && description.range(of: "每手|单手|每侧(?:重量|配重|负重)|单臂|双(?:绳索|滑轮).*推胸|(?:single|one)[ -]arm", options: [.regularExpression, .caseInsensitive]) != nil
            let load = group.element.filter { $0["done"].bool }.reduce(0.0) { sum, line in
                let left = line["weight"].number * line["reps"].number
                let right: Double
                if case .object = line["right"] { right = line["right"]["weight"].number * line["right"]["reps"].number }
                else { right = perSide && left > 0 ? left : 0 }
                return sum + left + right
            }
            return total + load * (move["unit"].string == "lb" ? 0.45359237 : 1)
        }
    }
    func elapsedMilliseconds(at now: Int = Self.nowMilliseconds) -> Int {
        let clock = raw["clock"]
        guard case .object = clock else {
            return min(86_400_000, max(0, Int(raw["minutes"].number * 60_000)))
        }
        let saved = Int(clock["elapsed"].number)
        let delta: Int
        if case .number(let since) = clock["runningSince"] { delta = max(0, now - Int(since)) }
        else { delta = 0 }
        return min(86_400_000, max(0, saved + delta))
    }
    mutating func pause(at now: Int = Self.nowMilliseconds) {
        raw["clock"] = .object(["elapsed": .number(Double(elapsedMilliseconds(at: now))), "runningSince": .null])
    }
    mutating func resume(at now: Int = Self.nowMilliseconds) {
        guard !isRunning else { return }
        raw["clock"] = .object(["elapsed": .number(Double(elapsedMilliseconds(at: now))), "runningSince": .number(Double(now))])
    }
    static var nowMilliseconds: Int { Int((Date().timeIntervalSince1970 * 1000).rounded()) }
    static func day(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    static func start(plan: NativePlan, planId: String, now: Int = nowMilliseconds) -> NativeWorkoutSession {
        let rows = plan.exercises.map { move in
            NativeJSON.array((0..<max(1, min(30, Int(move["sets"].number)))).map { _ in .object([
                "weight": move["weight"], "reps": move["reps"], "seconds": move["seconds"], "done": .bool(false),
            ]) })
        }
        return NativeWorkoutSession(raw: .object([
            "plan": plan.raw, "planId": .string(planId), "date": .string(day()), "started": .number(Double(now)),
            "clock": .object(["elapsed": .number(0), "runningSince": .number(Double(now))]), "minutes": .number(0),
            "note": .string(""), "finishedVideo": .bool(false), "rows": .array(rows),
        ]))
    }
    static func free(now: Int = nowMilliseconds) -> NativeWorkoutSession {
        start(plan: NativePlan(raw: .object([
            "title": .string("自由训练"), "date": .string(day()), "category": .string("力量训练"), "minutes": .number(0),
            "shared": .bool(false), "video": .string(""), "exercises": .array([]),
        ])), planId: "", now: now)
    }
    mutating func addExercise(name: String) {
        let title = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard !title.isEmpty, plan.exercises.count < 30 else { return }
        var moves = plan.exercises
        let new = NativePreferenceKey.newMove(name: title)
        moves.append(new)
        raw["plan"]["exercises"] = .array(moves)
        var groups = raw["rows"].array
        groups.append(.array((0..<Int(new["sets"].number)).map { _ in
            .object(["weight": .number(0), "reps": new["reps"], "seconds": .number(0), "done": .bool(false)])
        }))
        raw["rows"] = .array(groups)
    }
    mutating func setLine(move: Int, row: Int, key: String, value: NativeJSON) {
        var groups = rows
        guard groups.indices.contains(move), groups[move].indices.contains(row) else { return }
        groups[move][row][key] = value
        raw["rows"] = .array(groups.map(NativeJSON.array))
    }
    mutating func addSet(move: Int) {
        var groups = rows
        guard groups.indices.contains(move), groups[move].count < 30 else { return }
        let previous = groups[move].last ?? .object(["weight": .number(0), "reps": .number(10), "seconds": .number(0)])
        var next = previous
        next["done"] = .bool(false)
        groups[move].append(next)
        raw["rows"] = .array(groups.map(NativeJSON.array))
        var moves = plan.exercises
        moves[move]["sets"] = .number(Double(groups[move].count))
        raw["plan"]["exercises"] = .array(moves)
    }
    func finalizing(at now: Int = Self.nowMilliseconds) throws -> NativeWorkoutSession {
        let cardio = raw["cardio"]["activity"].string == "incline-walk"
        let cardioDuration = raw["cardio"]["durationSeconds"].number > 0 ? Int(raw["cardio"]["durationSeconds"].number) : min(43_200, elapsedMilliseconds(at: now) / 1000)
        guard cardio ? cardioDuration > 0 : completedSets > 0 || raw["finishedVideo"].bool else { throw NativeWorkoutProblem.noCompletedSet }
        guard !raw["finishedVideo"].bool || !plan.video.isEmpty else { throw NativeWorkoutProblem.invalid }
        guard started > 0, rows.count == plan.exercises.count, raw["note"].string.count <= 1500,
              rows.enumerated().allSatisfy({ index, lines in
                  lines.count == Int(plan.exercises[index]["sets"].number) && !lines.isEmpty && lines.count <= 30 && lines.allSatisfy { line in
                      let weight = line["weight"].number, reps = line["reps"].number, seconds = line["seconds"].number
                      let effort = line["rpe"] == .null || (line["rpe"].number >= 1 && line["rpe"].number <= 10 && (line["rpe"].number * 2).rounded() == line["rpe"].number * 2)
                      let right = line["right"] == .null || ((0...2000).contains(line["right"]["weight"].number) && (0...999).contains(line["right"]["reps"].number) && line["right"]["reps"].number.rounded() == line["right"]["reps"].number)
                      return weight.isFinite && (0...2000).contains(weight) && reps.rounded() == reps && (0...999).contains(reps) &&
                          seconds.rounded() == seconds && (0...18000).contains(seconds) && effort && right
                  }
              }) else { throw NativeWorkoutProblem.invalid }
        var result = self
        result.pause(at: now)
        result.raw["date"] = .string(Self.day(Date(timeIntervalSince1970: Double(now) / 1000)))
        result.raw["ended"] = .number(Double(max(started, min(now, started + 86_400_000))))
        if cardio { result.raw["cardio"]["durationSeconds"] = .number(Double(cardioDuration)) }
        let supplied = Int(raw["minutes"].number)
        let minutes = cardio ? max(1, Int((Double(cardioDuration) / 60).rounded())) :
            supplied > 0 ? min(720, supplied) : min(720, max(1, Int((Double(elapsedMilliseconds(at: now)) / 60_000).rounded())))
        result.raw["minutes"] = .number(Double(minutes))
        return result
    }
}

enum NativeWorkoutProblem: LocalizedError {
    case noCompletedSet, invalid, accountChanged
    var errorDescription: String? {
        switch self {
        case .noCompletedSet: return "请至少完成一组动作，或标记视频跟练完成。"
        case .invalid: return "训练数据超出允许范围，请检查组数、重量、次数和时长。"
        case .accountChanged: return "登录账号已切换，请切回记录训练的账号后同步。"
        }
    }
}

struct NativeWorkoutEntry: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var owner: String
    var kind: String
    var updated: String
    var data: NativeJSON
    var session: NativeWorkoutSession? { kind == "draft" || kind == "log" ? NativeWorkoutSession(raw: data) : nil }
    var title: String { kind == "plan" ? data["title"].string : data["plan"]["title"].string }
    var day: String { data["date"].string }
    var durationMinutes: Int { Int(data["minutes"].number) }
    var startedAt: Date? { data["started"].number > 0 ? Date(timeIntervalSince1970: data["started"].number / 1000) : nil }
    var endedAt: Date? { workoutWindow.map { Date(timeIntervalSince1970: Double($0.to) / 1000) } }
    var workoutWindow: (from: Int, to: Int)? {
        let from = Int(data["started"].number)
        guard from > 0 else { return nil }
        let saved = Int(data["ended"].number)
        return (from, saved > from ? saved : from + max(1, durationMinutes) * 60_000)
    }
}

struct NativeWorkoutState: Decodable {
    struct Viewer: Decodable { var id: String; var name: String? }
    var me: Viewer
    var entries: [NativeWorkoutEntry]
    var room: NativeJSON?
}

struct NativeProteinRecipeEditor: Identifiable {
    let id: String
    var original: NativeJSON
    var name = ""
    var scoop = ""
    var cup = ""
    var powder: [String: String] = [:]
    var liquid: [String: String] = [:]
    var mixerName = ""
    var usesMixer = false
    var perServing = false
    var servingGrams = ""
    var estimated = false
    var scoopEstimated = false
    var makeDefault = true
    var recognized = ""

    init(product: NativeJSON? = nil, makeDefault: Bool = true) {
        id = product?["id"].string ?? UUID().uuidString.lowercased()
        original = product ?? .object([:])
        self.makeDefault = makeDefault
        guard let product else { return }
        name = product["name"].string
        scoop = product["scoopGrams"].number.formatted(.number.grouping(.never))
        cup = product["cupMl"].number.formatted(.number.grouping(.never))
        estimated = product["powderEstimated"].bool; scoopEstimated = product["scoopEstimated"].bool
        for key in ["calories", "protein", "carbs", "fat"] {
            if case .number = product["powder"][key] { powder[key] = String(product["powder"][key].number) }
            if case .number = product["mixer"]["per100ml"][key] { liquid[key] = String(product["mixer"]["per100ml"][key].number) }
        }
        if case .object = product["mixer"] { usesMixer = true; mixerName = product["mixer"]["name"].string }
    }

    func product() throws -> NativeJSON {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, name.count <= 100,
              let grams = Self.number(scoop), (0.1...250).contains(grams), let ml = Self.number(cup), (1...2000).contains(ml) else {
            throw NativeProteinRecipeProblem.fields
        }
        let basis: Double
        if perServing { guard let value = Self.number(servingGrams), value > 0 else { throw NativeProteinRecipeProblem.fields }; basis = value }
        else { basis = 100 }
        var result = original.object
        result["id"] = .string(id); result["name"] = .string(name.trimmingCharacters(in: .whitespacesAndNewlines))
        result["scoopGrams"] = .number(grams); result["cupMl"] = .number(ml)
        result["powder"] = try nutrition(powder, multiplier: 100 / basis)
        if estimated { result["powderEstimated"] = .bool(true) } else { result.removeValue(forKey: "powderEstimated") }
        if scoopEstimated { result["scoopEstimated"] = .bool(true) } else { result.removeValue(forKey: "scoopEstimated") }
        if usesMixer {
            guard !mixerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, mixerName.count <= 60 else { throw NativeProteinRecipeProblem.fields }
            var mixer = original["mixer"].object
            mixer["name"] = .string(mixerName.trimmingCharacters(in: .whitespacesAndNewlines)); mixer["per100ml"] = try nutrition(liquid, multiplier: 1)
            result["mixer"] = .object(mixer)
        } else { result.removeValue(forKey: "mixer") }
        return .object(result)
    }

    private func nutrition(_ values: [String: String], multiplier: Double) throws -> NativeJSON {
        var result: [String: NativeJSON] = [:]
        for key in ["calories", "protein", "carbs", "fat"] {
            guard let value = Self.number(values[key] ?? ""), value >= 0, value * multiplier <= (key == "calories" ? 1000 : 100) else { throw NativeProteinRecipeProblem.fields }
            result[key] = .number((value * multiplier * 100).rounded() / 100)
        }
        return .object(result)
    }
    private static func number(_ value: String) -> Double? {
        guard let number = Double(value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")), number.isFinite else { return nil }
        return number
    }
}

enum NativeProteinRecipeProblem: LocalizedError {
    case fields
    var errorDescription: String? { "请核对产品名、粉量、液体量和四项营养。每份数值需要填写该份克数，才能换算为每 100 克。" }
}

