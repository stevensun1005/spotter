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
    static let coachingEntry = "spotter.native.modules.coaching"
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
    var displayTitle: String {
        guard raw["week"] != .null, raw["day"] != .null else { return title }
        return title.replacingOccurrences(of: #"^W\d{2} D\d\s*·\s*"#, with: "", options: .regularExpression)
    }
    var weekDay: String {
        [raw["week"] == .null ? "" : "第 \(Int(raw["week"].number)) 周",
         raw["day"] == .null ? "" : "第 \(Int(raw["day"].number)) 练"].filter { !$0.isEmpty }.joined(separator: " · ")
    }
    var date: String { raw["date"].string }
    var category: String { raw["category"].string }
    var exercises: [NativeJSON] { raw["exercises"].array }
    var video: String { raw["video"].string }
}

enum NativePlanImport {
    static let categories = ["力量训练", "有氧训练", "拉伸恢复", "跟练视频", "其他"]
    static let maximumBytes = 450_000
    private static let videoHosts: Set<String> = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
        "bilibili.com", "www.bilibili.com", "m.bilibili.com", "b23.tv"]

    struct Problem: LocalizedError {
        let errorDescription: String?
        init(_ message: String) { errorDescription = message }
    }

    static func parse(_ input: String, today: String) throws -> [NativeJSON] {
        guard input.utf8.count <= maximumBytes else { throw Problem("内容太大，请分批导入。") }
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{feff}")))
            .replacingOccurrences(of: #"^```(?:json)?\s*|\s*```$"#, with: "", options: [.regularExpression, .caseInsensitive])
        guard !raw.isEmpty else { throw Problem("请先粘贴训练内容或视频链接。") }
        let plans: [NativeJSON]
        if raw.first == "[" || raw.first == "{" {
            guard let decoded = try? JSONDecoder().decode(NativeJSON.self, from: Data(raw.utf8)) else {
                throw Problem("JSON 格式有误，请检查内容是否完整。")
            }
            let program = decoded["program"].object.isEmpty ? decoded : decoded["program"]
            if decoded["format"].string == "spotter-program" || (!program["sessions"].array.isEmpty && !program["startDate"].string.isEmpty) {
                throw Problem("这份文件是完整训练周期，请到「训练周期 → 导入周期」预览。")
            }
            if decoded["format"].string == "spotter-backup" {
                throw Problem("这份文件是个人备份，请在「设置 → 数据导入与导出」恢复。")
            }
            let items = raw.first == "[" ? decoded.array : [decoded]
            plans = items.map { item in
                var row = item.object
                for key in ["templateId", "ownExercises", "programId", "programSessionId", "phaseId"] { row.removeValue(forKey: key) }
                row["shared"] = .bool(false)
                return .object(row)
            }
        } else {
            plans = textPlans(raw, today: today)
        }
        guard !plans.isEmpty else { throw Problem("未找到训练计划。可用「哑铃卧推 3×10，12 kg」、视频链接或计划 JSON。") }
        guard plans.count <= 20 else { throw Problem("普通计划每批最多 20 堂，请拆分后预览。") }
        for plan in plans { try validate(plan) }
        return plans
    }

    static func validate(_ plan: NativeJSON) throws {
        let title = plan["title"].string.trimmingCharacters(in: .whitespacesAndNewlines)
        let date = plan["date"].string
        let video = plan["video"].string
        let moves = plan["exercises"].array
        let parts = date.split(separator: "-").compactMap { Int($0) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        let validDate = parts.count == 3 && date.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil &&
            DateComponents(calendar: calendar, year: parts[0], month: parts[1], day: parts[2]).isValidDate
        guard (1...100).contains(title.utf16.count), validDate, categories.contains(plan["category"].string),
              number(plan["minutes"], in: 0...720, integer: true), moves.count <= 30,
              case .array = plan["exercises"], case .string = plan["video"],
              video.isEmpty || validVideo(video), !moves.isEmpty || !video.isEmpty else {
            throw Problem("请检查计划的名称、日期、时长、动作数和 B 站或 YouTube 链接。")
        }
        for move in moves {
            let name = move["name"].string.trimmingCharacters(in: .whitespacesAndNewlines)
            let maximum = move["repsMax"]
            guard (1...100).contains(name.utf16.count), number(move["sets"], in: 1...30, integer: true),
                  number(move["reps"], in: 0...999, integer: true), number(move["weight"], in: 0...2000),
                  number(move["seconds"], in: 0...18000, integer: true), ["kg", "lb"].contains(move["unit"].string),
                  maximum == .null || (number(maximum, in: 1...999, integer: true) && move["reps"].number > 0 && maximum.number >= move["reps"].number),
                  move["restSeconds"] == .null || number(move["restSeconds"], in: 0...600, integer: true) else {
                throw Problem("「\(name.isEmpty ? "未命名动作" : name)」的组数、次数、重量或时间超出范围。")
            }
        }
    }

    private static func number(_ value: NativeJSON, in bounds: ClosedRange<Double>, integer: Bool = false) -> Bool {
        guard case .number(let exact) = value, bounds.contains(exact) else { return false }
        return !integer || exact.rounded() == exact
    }

    private static func validVideo(_ value: String) -> Bool {
        guard value.utf16.count <= 1200, let url = URLComponents(string: value),
              url.scheme?.lowercased() == "https", url.user == nil, url.password == nil, let host = url.host?.lowercased() else { return false }
        return videoHosts.contains(host)
    }

    private static func textPlans(_ raw: String, today: String) -> [NativeJSON] {
        let lines = raw.components(separatedBy: .newlines).map {
            $0.replacingOccurrences(of: #"^[\s#*>•-]+|^\d+[.)、]\s*"#, with: "", options: .regularExpression)
                .replacingOccurrences(of: "**", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "|")))
        }.filter { !$0.isEmpty }
        let prescription = #"^(.+?)\s*(?:[：:|]\s*|\s+)(\d{1,2})\s*(?:组\s*(?:[×xX*]|每组)?\s*|[×xX*]\s*)(\d{1,3})(?:\s*[-–~～至]\s*(\d{1,3}))?\s*(秒|次)?(.*)$"#
        let moves = lines.compactMap { line -> NativeJSON? in
            guard let fields = captures(prescription, in: line).first else { return nil }
            let name = fields[1].trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "|：:")))
            let timed = fields[5] == "秒"
            let weight = captures(#"(\d+(?:\.\d+)?)\s*(kg|lbs?|公斤|磅)"#, in: fields[6]).first
            let unit = weight?[2].lowercased() ?? "kg"
            var move = NativePreferenceKey.newMove(name: name, sets: Int(fields[2]) ?? 0,
                                                    reps: timed ? 0 : Int(fields[3]) ?? 0,
                                                    unit: unit.hasPrefix("lb") || unit == "磅" ? "lb" : "kg")
            move["weight"] = .number(weight.flatMap { Double($0[1]) } ?? 0)
            if timed { move["seconds"] = .number(Double(fields[3]) ?? 0) }
            if !timed, let maximum = Double(fields[4]) { move["repsMax"] = .number(maximum) }
            if let rest = captures(#"(?:休息|rest)\s*[:：]?\s*(\d{1,3})\s*(?:秒|s\b)"#, in: fields[6]).first {
                move["restSeconds"] = .number(Double(rest[1]) ?? 0)
            }
            if let tempo = captures(#"(?:tempo|节奏|节拍)\s*[:：=]?\s*((?:[0-9]{1,2}\s*[-/／–]\s*){2}(?:[0-9]{1,2}|x)\s*[-/／–]\s*[0-9]{1,2}|[0-9]{2}[0-9x][0-9])(?![\d-])"#, in: fields[6]).first {
                let value = tempo[1].uppercased()
                move["tempo"] = .string(value.count == 4 ? value.map(String.init).joined(separator: "-") :
                    value.replacingOccurrences(of: #"\s*[-/／–]\s*"#, with: "-", options: .regularExpression))
            }
            return move
        }
        let title = lines.first { line in
            !line.contains("https://") && !line.contains("|") && !moves.contains { line.contains($0["name"].string) }
        }.map { String($0.prefix(100)) }
        let minutes = captures(#"(\d{1,3})\s*(?:分钟|min\b)"#, in: raw).first.flatMap { Double($0[1]) } ?? 0
        var seen: Set<String> = []
        var links = captures(#"https://[^\s<>\"，。；）]+"#, in: raw).map {
            $0[0].replacingOccurrences(of: #"[\])!?，。；,;]+$"#, with: "", options: .regularExpression)
        }.filter { validVideo($0) && seen.insert($0).inserted }
        func plan(title: String, category: String, video: String, moves: [NativeJSON]) -> NativeJSON {
            .object(["title": .string(title), "date": .string(today), "category": .string(category), "minutes": .number(min(720, minutes)),
                     "shared": .bool(false), "video": .string(video), "exercises": .array(moves)])
        }
        var result: [NativeJSON] = []
        if !moves.isEmpty {
            result.append(plan(title: title ?? "导入的力量训练", category: "力量训练", video: links.isEmpty ? "" : links.removeFirst(), moves: moves))
        }
        for link in links {
            let host = URLComponents(string: link)?.host?.lowercased() ?? ""
            let platform = host.hasSuffix("bilibili.com") || host == "b23.tv" ? "B 站" : "YouTube"
            result.append(plan(title: title ?? "\(platform) 跟练", category: "跟练视频", video: link, moves: []))
        }
        return result
    }

    private static func captures(_ pattern: String, in text: String) -> [[String]] {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return [] }
        return expression.matches(in: text, range: NSRange(text.startIndex..., in: text)).map { match in
            (0..<match.numberOfRanges).map { index in
                Range(match.range(at: index), in: text).map { String(text[$0]) } ?? ""
            }
        }
    }
}

struct NativeWorkoutSession: Equatable, Sendable {
    var raw: NativeJSON
    var plan: NativePlan { NativePlan(raw: raw["plan"]) }
    var rows: [[NativeJSON]] { raw["rows"].array.map(\.array) }
    var started: Int { Int(raw["started"].number) }
    var isRunning: Bool { if case .number = raw["clock"]["runningSince"] { return true }; return false }
    var completedSets: Int { rows.flatMap { $0 }.filter { $0["done"].bool }.count }
    var volumeKg: Double {
        let exercises = plan.exercises
        return rows.enumerated().reduce(0) { total, group in
            guard exercises.indices.contains(group.offset) else { return total }
            let move = exercises[group.offset]
            let perSide = Self.isPerSideLoad(move)
            return group.element.filter { $0["done"].bool }.reduce(total) { sum, line in
                sum + Self.setVolumeKg(line, move: move, perSide: perSide)
            }
        }
    }
    static func isPerSideLoad(_ move: NativeJSON) -> Bool {
        let description = move["name"].string + " " + move["cue"].string
        guard description.range(of: "总重|合计|总次数|(?:只做|仅做?)[左右]", options: .regularExpression) == nil else { return false }
        return description.range(of: "每手|单手|每侧(?:重量|配重|负重)|单臂|双(?:绳索|滑轮).*推胸|(?:single|one)[ -]arm", options: [.regularExpression, .caseInsensitive]) != nil
    }
    static func setVolumeKg(_ line: NativeJSON, move: NativeJSON, perSide: Bool) -> Double {
        let left = line["weight"].number * line["reps"].number
        let right: Double
        if case .object = line["right"] { right = line["right"]["weight"].number * line["right"]["reps"].number }
        else { right = left > 0 && perSide ? left : 0 }
        return (left + right) * (move["unit"].string == "lb" ? 0.45359237 : 1)
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
        let parts = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 2000, parts.month ?? 1, parts.day ?? 1)
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

struct NativeExerciseLabel {
    let name: String
    let slot: String
    let warmup: Bool

    init(_ move: NativeJSON) {
        let rawName = move["name"].string.trimmingCharacters(in: .whitespacesAndNewlines)
        var displayName = rawName
        var legacySlot = ""
        if let prefix = rawName.range(of: #"^(?:[A-Z]\d+\s+|[A-Z]\s+热身组\s*·\s*|E\s+(?![A-Za-z]))"#, options: .regularExpression) {
            let matched = rawName[prefix].trimmingCharacters(in: .whitespacesAndNewlines)
            legacySlot = matched.contains("热身组") ? String(matched.prefix(1)) + "-warmup" : matched
            let trimmed = String(rawName[prefix.upperBound...])
                .replacingOccurrences(of: #"(?:（[^（）]+）)?(?:\s*·\s*.+)?$"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { displayName = trimmed }
        }
        name = displayName
        let sourceSlot = move["sourceSlot"].string
        slot = sourceSlot.isEmpty ? legacySlot : sourceSlot
        warmup = move["warmup"].bool || move["block"].string.split(separator: "-").first == "W"
            || slot.range(of: #"^(?:W\d*|[A-Z]-warmup)$"#, options: .regularExpression) != nil
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
    struct Key: Hashable, Sendable { let owner: String; let id: String }
    var id: String
    var owner: String
    var kind: String
    var updated: String
    var data: NativeJSON
    var session: NativeWorkoutSession? { kind == "draft" || kind == "log" ? NativeWorkoutSession(raw: data) : nil }
    var title: String { kind == "plan" ? data["title"].string : data["plan"]["title"].string }
    var displayTitle: String { NativePlan(raw: kind == "plan" ? data : data["plan"]).displayTitle }
    var day: String { data["date"].string }
    var durationMinutes: Int { Int(data["minutes"].number) }
    var key: Key { Key(owner: owner, id: id) }
    var planKey: Key? {
        let planID = data["planId"].string
        return kind == "log" && !planID.isEmpty ? Key(owner: owner, id: planID) : nil
    }
    var startedAt: Date? { data["started"].number > 0 ? Date(timeIntervalSince1970: data["started"].number / 1000) : nil }
    var endedAt: Date? { workoutWindow.map { Date(timeIntervalSince1970: Double($0.to) / 1000) } }
    var workoutWindow: (from: Int, to: Int)? {
        let from = Int(data["started"].number)
        guard from > 0 else { return nil }
        let saved = Int(data["ended"].number)
        return (from, saved > from ? saved : from + max(1, durationMinutes) * 60_000)
    }
}

struct NativeWorkoutShareSummary {
    struct Move {
        let name: String
        let slot: String
        let sets: [String]
    }

    struct Workout: Identifiable {
        let id: String
        let title: String
        let moves: [Move]
    }

    let day: String
    let title: String
    let minutes: Int
    let sets: Int
    let volume: Double
    let workouts: [Workout]

    init(entry: NativeWorkoutEntry, logs: [NativeWorkoutEntry]) {
        day = entry.day
        title = logs.count > 1 ? "当天训练" : Self.title(entry)
        minutes = logs.reduce(0) { $0 + max(0, $1.durationMinutes) }
        sets = logs.reduce(0) { $0 + ($1.session?.completedSets ?? 0) }
        volume = logs.reduce(0) { $0 + ($1.session?.volumeKg ?? 0) }
        workouts = logs.map { log in
            var moves: [Move] = []
            if let session = log.session {
                let rows = session.rows
                var counters: [String: Int] = [:]
                for (index, move) in session.plan.exercises.enumerated() {
                    let label = NativeExerciseLabel(move)
                    let phase = move["block"].string.split(separator: "-").first.map(String.init)
                    let computed = phase.map { phase in
                        counters[phase, default: 0] += 1
                        return phase + String(counters[phase, default: 0])
                    }
                    guard rows.indices.contains(index) else { continue }
                    let completed = rows[index].filter { $0["done"].bool }
                    guard !completed.isEmpty else { continue }
                    let unit = move["unit"].string == "lb" ? "lb" : "kg"
                    let perSide = NativeWorkoutSession.isPerSideLoad(move)
                    let details = completed.map { Self.setText($0, unit: unit, warmup: label.warmup, perSide: perSide) }
                    moves.append(Move(name: label.name, slot: label.warmup ? "W" : computed ?? label.slot, sets: details))
                }
            }
            return Workout(id: log.id, title: Self.title(log), moves: moves)
        }
    }

    static func entries(for entry: NativeWorkoutEntry, among logs: [NativeWorkoutEntry], owner: String, merge: Bool) -> [NativeWorkoutEntry] {
        guard entry.kind == "log", !owner.isEmpty, entry.owner == owner else { return [] }
        guard merge, !entry.day.isEmpty else { return [entry] }
        var records: [String: NativeWorkoutEntry] = [:]
        for log in logs where log.kind == "log" && log.owner == owner && log.day == entry.day {
            records[log.id] = log
        }
        records[entry.id] = entry
        return records.values.sorted { left, right in
            let a = left.data["started"].number, b = right.data["started"].number
            return a == b ? left.id < right.id : a < b
        }
    }

    static func number(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    private static func title(_ entry: NativeWorkoutEntry) -> String { entry.title.isEmpty ? "训练记录" : entry.title }

    private static func setText(_ line: NativeJSON, unit: String, warmup: Bool, perSide: Bool) -> String {
        let kind = line["kind"].string
        let prefix = kind == "warmup" && !warmup ? "W · " : kind == "drop" ? "递减 · " : ""
        let weight = line["weight"].number
        let reps = Int(line["reps"].number)
        let seconds = Int(line["seconds"].number)
        let formattedWeight = number(weight) + " " + unit
        if seconds > 0 {
            return prefix + String(format: "%02d:%02d", seconds / 60, seconds % 60) + (weight > 0 ? " · " + formattedWeight : "")
        }
        let right = line["right"]
        if case .object = right {
            return prefix + "左 \(formattedWeight) × \(reps) · 右 \(number(right["weight"].number)) \(unit) × \(Int(right["reps"].number))"
        }
        return prefix + (weight > 0 ? formattedWeight + " × " : "") + String(reps) + (perSide && weight > 0 ? " 次／侧" : " 次")
    }
}

struct NativeWorkoutState: Decodable, Sendable {
    struct Viewer: Decodable, Sendable { var id: String; var name: String? }
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

