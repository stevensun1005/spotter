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
    static let officialTemplates = "spotter.native.modules.officialTemplates"
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

struct NativeExerciseTempo {
    let value: String
    let prescribed: Bool
    private var explosive = false

    var label: String { prescribed ? "计划节奏" : "建议节奏" }
    var accessibilityDescription: String {
        "\(label) \(value)" + (explosive ? "，向心快速发力" : "")
    }

    private static let separators = CharacterSet(charactersIn: "-/／–—－")
    private static let notation = #"(?:[0-9]{1,2}\s*[-/／–—－]\s*){2}(?:[0-9]{1,2}|x)(?:\s*[-/／–—－]\s*[0-9]{1,2})?|[0-9]{2}[0-9x][0-9]?"#
    private static let valuePattern = try? NSRegularExpression(pattern: "^(?:\(notation))$", options: .caseInsensitive)
    private static let cuePattern = try? NSRegularExpression(
        pattern: #"(?:tempo|节奏|节拍)\s*[:：=]?\s*("# + notation + #")(?![0-9x]|\s*[-/／–—－]\s*[0-9x])"#,
        options: .caseInsensitive
    )

    static func fromCue(_ text: String) -> String? {
        guard !text.isEmpty, let match = cuePattern?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let value = Range(match.range(at: 1), in: text) else { return nil }
        return normalized(String(text[value]))
    }

    static func display(_ move: NativeJSON, category: String = "") -> Self? {
        let raw = move["tempo"].string.trimmingCharacters(in: .whitespacesAndNewlines)
        if let recorded = normalized(raw) ?? fromCue(move["cue"].string) ?? fromCue(move["name"].string) {
            let phases = recorded.split(separator: "-").prefix(3)
            return Self(value: phases.map { $0 == "X" ? "0" : String($0) }.joined(separator: "-"),
                        prescribed: true, explosive: phases.contains("X"))
        }
        guard raw.isEmpty, category == "力量训练", move["reps"].number > 0, move["seconds"].number == 0,
              !NativeExerciseLabel(move).warmup, NativeWorkoutSession.CardioActivity.fromPlannedMove(move) == nil else { return nil }
        return Self(value: "2-0-1", prescribed: false)
    }

    private static func normalized(_ value: String) -> String? {
        guard !value.isEmpty, valuePattern?.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil else { return nil }
        let parts = value.uppercased().components(separatedBy: separators)
        if parts.count == 1 { return value.uppercased().map(String.init).joined(separator: "-") }
        return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.joined(separator: "-")
    }
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
            if let tempo = NativeExerciseTempo.fromCue(fields[6]) { move["tempo"] = .string(tempo) }
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
    enum CardioActivity: String, CaseIterable, Identifiable, Sendable {
        case running
        case treadmillRunning = "treadmill-running"
        case cycling
        case stationaryCycling = "stationary-cycling"
        case rowing, elliptical, walking
        case incline = "incline-walk"
        case stairClimbing = "stair-climbing"
        case swimming
        case jumpRope = "jump-rope"
        case hiit, cardio

        var id: String { rawValue }

        var title: String {
            switch self {
            case .running: "跑步"
            case .treadmillRunning: "跑步机"
            case .cycling: "户外骑行"
            case .stationaryCycling: "室内骑行"
            case .rowing: "划船机"
            case .elliptical: "椭圆机"
            case .walking: "步行"
            case .incline: "爬坡走"
            case .stairClimbing: "登阶机"
            case .swimming: "游泳"
            case .jumpRope: "跳绳"
            case .hiit: "HIIT 训练"
            case .cardio: "综合有氧"
            }
        }

        var initialTitle: String { self == .cardio ? "有氧训练" : title }

        var symbol: String {
            switch self {
            case .running: "figure.run"
            case .treadmillRunning: "figure.run.treadmill"
            case .cycling: "figure.outdoor.cycle"
            case .stationaryCycling: "figure.indoor.cycle"
            case .rowing: "figure.rower"
            case .elliptical: "figure.elliptical"
            case .walking: "figure.walk"
            case .incline: "figure.hiking"
            case .stairClimbing: "figure.stair.stepper"
            case .swimming: "figure.pool.swim"
            case .jumpRope: "figure.jumprope"
            case .hiit: "bolt"
            case .cardio: "waveform.path.ecg"
            }
        }

        var tracksDistance: Bool { self != .stairClimbing && self != .jumpRope }

        var maximumSpeedKmh: Double { self == .cycling || self == .stationaryCycling ? 120 : 50 }

        private var cataloguePreset: (id: String, seconds: Int)? {
            switch self {
            case .running: ("0685", 900)
            case .treadmillRunning: ("2197", 900)
            case .cycling: ("5214", 1_200)
            case .stationaryCycling: ("2138", 1_200)
            case .rowing: ("1161", 600)
            case .elliptical: ("2141", 900)
            case .walking: ("2258", 1_200)
            case .incline: ("3666", 900)
            case .stairClimbing: ("2311", 600)
            case .jumpRope: ("2612", 60)
            case .swimming, .hiit, .cardio: nil
            }
        }

        static var planPresets: [Self] { allCases.filter { $0.cataloguePreset != nil } }

        var planMove: NativeJSON? {
            guard let preset = cataloguePreset else { return nil }
            var move = NativePreferenceKey.newMove(name: title, sets: 1, reps: 0)
            move["catalogueId"] = .string(preset.id)
            move["seconds"] = .number(Double(preset.seconds))
            return move
        }

        private static let catalogueActivities: [String: Self] = {
            var activities: [String: Self] = [
                "3004": .walking, "2259": .walking, "2279": .stationaryCycling,
                "0798": .stationaryCycling, "2192": .elliptical, "4259": .elliptical,
            ]
            for activity in planPresets {
                if let preset = activity.cataloguePreset { activities[preset.id] = activity }
            }
            return activities
        }()

        static func fromPlannedMove(_ move: NativeJSON) -> Self? {
            catalogueActivities[move["catalogueId"].string]
        }
    }

    struct SetPosition: Codable, Hashable, Sendable { let move: Int; let row: Int }

    struct SetCompletion: Codable, Equatable, Sendable {
        let position: SetPosition
        let previousPosition: SetPosition?
        let previousRest: NativeJSON
    }

    struct RestStatus: Equatable {
        let kind: String
        let remainingSeconds: Int
    }

    private static let maximumElapsedMilliseconds = 86_400_000
    static let maximumRestSeconds = 600

    var raw: NativeJSON
    var plan: NativePlan { NativePlan(raw: raw["plan"]) }
    var rows: [[NativeJSON]] { raw["rows"].array.map(\.array) }
    var started: Int { Int(raw["started"].number) }
    var isRunning: Bool { if case .number = raw["clock"]["runningSince"] { return true }; return false }
    var totalSets: Int { rows.reduce(0) { $0 + $1.count } }
    var completedSets: Int { rows.flatMap { $0 }.filter { $0["done"].bool }.count }
    var cardioActivity: CardioActivity? { CardioActivity(rawValue: raw["cardio"]["activity"].string) }
    var watchCardioActivity: CardioActivity? {
        if let cardioActivity { return cardioActivity }
        guard plan.category == "有氧训练" else { return nil }
        let activities = Set(plan.exercises.lazy.filter { !NativeExerciseLabel($0).warmup }.compactMap(CardioActivity.fromPlannedMove))
        return activities.count == 1 ? activities.first : .cardio
    }
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
            return min(Self.maximumElapsedMilliseconds, max(0, Int(raw["minutes"].number * 60_000)))
        }
        let saved = Int(clock["elapsed"].number)
        let delta: Int
        if case .number(let since) = clock["runningSince"] { delta = max(0, now - Int(since)) }
        else { delta = 0 }
        return min(Self.maximumElapsedMilliseconds, max(0, saved + delta))
    }
    mutating func pause(at now: Int = Self.nowMilliseconds) {
        raw["clock"] = .object(["elapsed": .number(Double(elapsedMilliseconds(at: now))), "runningSince": .null])
    }
    mutating func resume(at now: Int = Self.nowMilliseconds) {
        guard !isRunning else { return }
        raw["clock"] = .object(["elapsed": .number(Double(elapsedMilliseconds(at: now))), "runningSince": .number(Double(now))])
    }

    var runningRestDeadlineMilliseconds: Int? {
        guard case .number(let since) = raw["clock"]["runningSince"],
              let deadline = Self.restDeadline(raw["rest"]) else { return nil }
        return Int(exactly: (since + deadline - raw["clock"]["elapsed"].number).rounded(.up))
    }

    func restStatus(at now: Int = Self.nowMilliseconds) -> RestStatus? {
        let rest = raw["rest"]
        guard let deadline = Self.restDeadline(rest) else { return nil }
        let remaining = max(0, deadline - Double(elapsedMilliseconds(at: now)))
        return RestStatus(kind: rest["kind"].string, remainingSeconds: Int(ceil(remaining / 1_000)))
    }

    @discardableResult
    mutating func adjustRest(by seconds: Int, at now: Int = Self.nowMilliseconds) -> Bool {
        guard seconds != 0, let deadline = Self.restDeadline(raw["rest"]) else { return false }
        let elapsed = Double(elapsedMilliseconds(at: now))
        guard seconds > 0 || deadline > elapsed else { return false }
        let limit = elapsed + Double(Self.maximumRestSeconds) * 1_000
        let adjusted = min(limit, max(elapsed, max(elapsed, deadline) + Double(seconds) * 1_000))
        guard adjusted != deadline else { return false }
        raw["rest"]["until"] = .number(adjusted)
        return true
    }

    mutating func clearRest() {
        var fields = raw.object
        fields.removeValue(forKey: "rest")
        raw = .object(fields)
    }

    private static func restDeadline(_ rest: NativeJSON) -> Double? {
        guard case .number(let until) = rest["until"],
              (0...Double(Self.maximumElapsedMilliseconds + Self.maximumRestSeconds * 1_000)).contains(until) else { return nil }
        return until
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
    static func free(cardio: CardioActivity? = nil, now: Int = nowMilliseconds) -> NativeWorkoutSession {
        var session = start(plan: NativePlan(raw: .object([
            "title": .string(cardio?.initialTitle ?? "自由训练"), "date": .string(day()),
            "category": .string(cardio == nil ? "力量训练" : "有氧训练"), "minutes": .number(0),
            "shared": .bool(false), "video": .string(""), "exercises": .array([]),
        ])), planId: "", now: now)
        if let cardio { session.raw["cardio"] = .object(["activity": .string(cardio.rawValue)]) }
        return session
    }
    func restarting(at now: Int = Self.nowMilliseconds) -> Self {
        var fresh = Self.start(plan: plan, planId: raw["planId"].string, now: now)
        if let cardioActivity { fresh.raw["cardio"] = .object(["activity": .string(cardioActivity.rawValue)]) }
        if raw["defaultRestOverride"] != .null { fresh.raw["defaultRestOverride"] = raw["defaultRestOverride"] }
        return fresh
    }

    func hasCheckinContent(at now: Int = Self.nowMilliseconds) -> Bool {
        if cardioActivity != nil {
            return raw["cardio"]["durationSeconds"].number >= 1 || elapsedMilliseconds(at: now) >= 1_000
        }
        return completedSets > 0 || raw["finishedVideo"].bool
    }

    mutating func addExercise(name: String) {
        let title = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        addExercise(NativePreferenceKey.newMove(name: title))
    }
    mutating func addExercise(_ move: NativeJSON, previousSet: NativeJSON? = nil) {
        guard !move["name"].string.isEmpty, plan.exercises.count < 30, cardioActivity == nil else { return }
        var moves = plan.exercises
        moves.append(move)
        raw["plan"]["exercises"] = .array(moves)
        var initial: [String: NativeJSON] = [
            "weight": previousSet?["weight"] ?? move["weight"],
            "reps": previousSet?["reps"] ?? move["reps"],
            "seconds": previousSet?["seconds"] ?? move["seconds"],
            "done": .bool(false),
        ]
        if let previousSet, case .object = previousSet["right"] { initial["right"] = previousSet["right"] }
        var groups = raw["rows"].array
        groups.append(.array(Array(repeating: .object(initial), count: max(1, min(30, Int(move["sets"].number))))))
        raw["rows"] = .array(groups)
    }
    mutating func setLine(move: Int, row: Int, key: String, value: NativeJSON) {
        var groups = rows
        guard groups.indices.contains(move), groups[move].indices.contains(row) else { return }
        groups[move][row][key] = value
        raw["rows"] = .array(groups.map(NativeJSON.array))
    }

    func line(at position: SetPosition) -> NativeJSON? {
        let groups = rows
        guard groups.indices.contains(position.move), groups[position.move].indices.contains(position.row) else { return nil }
        return groups[position.move][position.row]
    }

    @discardableResult
    mutating func completeSet(at position: SetPosition, after previousPosition: SetPosition? = nil,
                              now: Int = Self.nowMilliseconds) -> SetCompletion? {
        guard plan.exercises.indices.contains(position.move), let line = line(at: position), !line["done"].bool else { return nil }
        let completion = SetCompletion(position: position, previousPosition: previousPosition, previousRest: raw["rest"])
        setLine(move: position.move, row: position.row, key: "done", value: .bool(true))
        clearRest()
        if let next = nextSet(after: position) {
            let rest = restBetween(position, and: next)
            if rest.seconds > 0 {
                raw["rest"] = .object(["until": .number(Double(elapsedMilliseconds(at: now)) + rest.seconds * 1_000),
                                      "kind": .string(rest.kind)])
            }
        }
        return completion
    }

    @discardableResult
    mutating func undoSetCompletion(_ completion: SetCompletion, at now: Int = Self.nowMilliseconds) -> Bool {
        let position = completion.position
        guard line(at: position)?["done"].bool == true else { return false }
        setLine(move: position.move, row: position.row, key: "done", value: .bool(false))
        let previousSetStillDone = completion.previousPosition.map { line(at: $0)?["done"].bool == true } ?? true
        if previousSetStillDone, let deadline = Self.restDeadline(completion.previousRest),
           deadline > Double(elapsedMilliseconds(at: now)) {
            raw["rest"] = completion.previousRest
        } else {
            clearRest()
        }
        return true
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
    private struct ExerciseBlockKey: Equatable {
        let id: String
        let station: String
        let warmup: Bool
    }

    private func exerciseBlocks() -> [[Int]] {
        let moves = plan.exercises
        let labels = moves.map { NativeExerciseLabel($0) }
        var blocks: [[Int]] = []
        var previousBlock: ExerciseBlockKey?
        for (index, move) in moves.enumerated() {
            let label = labels[index]
            let explicitBlock = move["block"].string
            let block = explicitBlock.isEmpty ? label.numberedSlot.map { String($0.phase) } ?? "" : explicitBlock
            let key = block.isEmpty ? nil : ExerciseBlockKey(id: block, station: move["station"].string, warmup: label.warmup)
            if let key, key == previousBlock {
                blocks[blocks.count - 1].append(index)
            } else {
                blocks.append([index])
            }
            previousBlock = key
        }
        return blocks.map { members in
            let numbered = members.compactMap { index in labels[index].numberedSlot.map { (index: index, order: $0.number) } }
            guard numbered.count == members.count else { return members }
            return numbered.sorted { ($0.order, $0.index) < ($1.order, $1.index) }.map(\.index)
        }
    }

    func isInSameGroup(_ first: Int, _ second: Int) -> Bool {
        exerciseBlocks().contains { $0.contains(first) && $0.contains(second) }
    }

    func nextSet(after completed: SetPosition? = nil) -> SetPosition? {
        let rows = self.rows
        let blocks = exerciseBlocks()
        let start = completed.flatMap { completed in blocks.firstIndex { $0.contains(completed.move) } } ?? 0
        for block in blocks.dropFirst(start) + blocks.prefix(start) {
            let rounds = block.map { rows.indices.contains($0) ? rows[$0].count : 0 }.max() ?? 0
            for row in 0..<rounds {
                if let move = block.first(where: {
                    rows.indices.contains($0) && rows[$0].indices.contains(row) && !rows[$0][row]["done"].bool
                }) {
                    return SetPosition(move: move, row: row)
                }
            }
        }
        return nil
    }

    func restBetween(_ completed: SetPosition, and next: SetPosition) -> (seconds: Double, kind: String) {
        let blocks = exerciseBlocks()
        let moves = plan.exercises
        let from = moves[completed.move]
        let destination = moves[next.move]
        let planDefault = plan.raw["defaultRestSeconds"]
        let override = raw["defaultRestOverride"]
        let fallback = override != .null ? override.number : planDefault != .null ? planDefault.number : Double(NativePreferenceKey.restSeconds)
        let fromBlock = blocks.first { $0.contains(completed.move) } ?? [completed.move]
        let sameBlock = fromBlock.contains(next.move)
        if sameBlock && completed.row == next.row && completed.move != next.move { return (fallback, "换动作") }
        let rest = override != .null || from["restSeconds"] == .null ? fallback : from["restSeconds"].number
        if !sameBlock && from["station"] != .null && destination["station"] != .null && from["station"] != destination["station"] {
            return (max(60, fallback, rest), "换站")
        }
        if sameBlock, fromBlock.count > 1 {
            let longest = fromBlock.map { override != .null || moves[$0]["restSeconds"] == .null ? fallback : moves[$0]["restSeconds"].number }.max() ?? rest
            return (longest, "轮间休息")
        }
        return (rest, "组间休息")
    }

    func finalizing(at now: Int = Self.nowMilliseconds) throws -> NativeWorkoutSession {
        let cardio = cardioActivity != nil
        let cardioDuration = raw["cardio"]["durationSeconds"].number > 0 ? Int(raw["cardio"]["durationSeconds"].number) : min(43_200, elapsedMilliseconds(at: now) / 1000)
        if cardio {
            guard (1...43_200).contains(cardioDuration), plan.exercises.isEmpty, plan.video.isEmpty else { throw NativeWorkoutProblem.invalidCardioDuration }
        } else if completedSets == 0 && !raw["finishedVideo"].bool { throw NativeWorkoutProblem.noCompletedSet }
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

    fileprivate var numberedSlot: (phase: Character, number: Int)? {
        guard !warmup, let phase = slot.first, phase.isASCII, phase.isUppercase,
              let number = Int(slot.dropFirst()), number > 0,
              slot.dropFirst().allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        return (phase, number)
    }

    init(_ move: NativeJSON, preservingNameQualifiers: Bool = false) {
        let rawName = move["name"].string.trimmingCharacters(in: .whitespacesAndNewlines)
        var displayName = rawName
        var legacySlot = ""
        if let prefix = rawName.range(of: #"^(?:[A-Z]\d+\s+|[A-Z]\s+热身组\s*·\s*|E\s+(?![A-Za-z]))"#, options: .regularExpression) {
            let matched = rawName[prefix].trimmingCharacters(in: .whitespacesAndNewlines)
            legacySlot = matched.contains("热身组") ? String(matched.prefix(1)) + "-warmup" : matched
            let suffix = preservingNameQualifiers ? #"(?:\s*·\s*.+)?$"# : #"(?:（[^（）]+）)?(?:\s*·\s*.+)?$"#
            let trimmed = String(rawName[prefix.upperBound...])
                .replacingOccurrences(of: suffix, with: "", options: .regularExpression)
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

struct NativeExerciseHistory: Sendable {
    struct Identity: Hashable, Sendable {
        let catalogueID: String
        let names: Set<String>
        let personalOnly: Bool

        init(_ move: NativeJSON, catalogueID: String? = nil, alternateNames: [String] = [], personalOnly: Bool = false) {
            self.catalogueID = personalOnly ? "" : catalogueID ?? move["catalogueId"].string
            self.personalOnly = personalOnly
            let candidates = [move["name"].string, move["sourceName"].string] + alternateNames
            names = Set((personalOnly ? Array(candidates.prefix(1)) : candidates).compactMap { name in
                let normalized = NativeExerciseLabel(.object(["name": .string(name)]), preservingNameQualifiers: true).name
                    .precomposedStringWithCompatibilityMapping.lowercased()
                    .split(whereSeparator: \.isWhitespace).joined(separator: " ")
                return normalized.isEmpty ? nil : normalized
            })
        }
    }

    struct Record: Identifiable, Sendable {
        var id: String { workoutID + ":" + String(moveIndex) }
        let workoutID: String
        let day: String
        let started: Double
        let title: String
        let moveIndex: Int
        let move: NativeJSON
        let identity: Identity
        let rows: [NativeJSON]
        let strength: Bool
        let perSide: Bool
        let warmup: Bool

        var unit: String { NativeExerciseHistory.unit(of: move) }
        var isTimed: Bool { move["seconds"].number > 0 }
        var completedRows: [NativeJSON] { rows.filter { $0["done"].bool } }
        var volumeKg: Double {
            completedRows.reduce(0) { $0 + NativeWorkoutSession.setVolumeKg($1, move: move, perSide: perSide) }
        }
        var resultRows: [NativeJSON] {
            guard !warmup else { return [] }
            return completedRows.filter { $0["kind"].string.isEmpty }
        }
        var greatestWeightKg: Double? { resultRows.compactMap(weightKg).max() }
        var longestSeconds: Double? {
            resultRows.map { $0["seconds"].number }.filter { $0 > 0 }.max()
        }

        func estimatedMaxKg(_ row: NativeJSON, formula: String) -> Double? {
            guard strength, !isTimed, !warmup, row["done"].bool, row["kind"].string.isEmpty,
                  row["seconds"].number <= 0 else { return nil }
            let factor = unit == "lb" ? 0.45359237 : 1
            return [row, row["right"]].compactMap { side -> Double? in
                let weight = side["weight"].number * factor
                let reps = side["reps"].number
                guard weight > 0, (1...10).contains(reps) else { return nil }
                if reps == 1 { return weight }
                return formula == "brzycki" ? weight * 36 / (37 - reps) : weight * (1 + reps / 30)
            }.max()
        }

        func weightKg(_ line: NativeJSON) -> Double? {
            guard !isTimed, Self.reps(line) > 0 else { return nil }
            return NativeExerciseHistory.convert(max(line["weight"].number, line["right"]["weight"].number), from: unit, to: "kg")
        }

        func bestReps(at loadKg: Double) -> Double? {
            resultRows.compactMap { row -> Double? in
                guard let weight = repsLoadKg(row), abs(weight - loadKg) < 0.051 else { return nil }
                return Self.reps(row)
            }.max()
        }

        func repsLoadKg(_ row: NativeJSON) -> Double? {
            guard let weight = weightKg(row) else { return nil }
            if row["right"] != .null {
                let right = NativeExerciseHistory.convert(row["right"]["weight"].number, from: unit, to: "kg")
                let left = NativeExerciseHistory.convert(row["weight"].number, from: unit, to: "kg")
                guard abs(right - left) < 0.051 else { return nil }
            }
            return weight
        }

        static func reps(_ line: NativeJSON) -> Double {
            if line["right"] != .null { return min(line["reps"].number, line["right"]["reps"].number) }
            return line["reps"].number
        }
    }

    struct Increase: Equatable, Sendable {
        let weight: Double
        let rightWeight: Double?
    }

    private var records: [Record] = []
    private var byCatalogue: [String: [Int]] = [:]
    private var byName: [String: [Int]] = [:]

    init(logs: [NativeWorkoutEntry] = [], owner: String = "", identify: (NativeJSON) -> Identity = { Identity($0) }) {
        let ordered = logs.filter { $0.kind == "log" && $0.owner == owner }
            .sorted {
                if $0.day != $1.day { return $0.day > $1.day }
                if $0.data["started"].number != $1.data["started"].number {
                    return $0.data["started"].number > $1.data["started"].number
                }
                return $0.updated > $1.updated
            }
        var seen: Set<String> = []
        for entry in ordered where seen.insert(entry.id).inserted {
            guard let session = entry.session else { continue }
            let groups = session.rows
            for (index, move) in session.plan.exercises.enumerated() where groups.indices.contains(index) {
                let rows = groups[index]
                guard rows.contains(where: { $0["done"].bool }) else { continue }
                let identity = identify(move)
                let position = records.count
                records.append(Record(workoutID: entry.id, day: entry.day, started: entry.data["started"].number,
                                      title: entry.displayTitle, moveIndex: index, move: move, identity: identity,
                                      rows: rows, strength: session.plan.category == "力量训练",
                                      perSide: NativeWorkoutSession.isPerSideLoad(move),
                                      warmup: NativeExerciseLabel(move).warmup))
                if !identity.catalogueID.isEmpty { byCatalogue[identity.catalogueID, default: []].append(position) }
                for name in identity.names { byName[name, default: []].append(position) }
            }
        }
    }

    func matching(_ identity: Identity) -> [Record] {
        let named = Set(identity.names.flatMap { byName[$0] ?? [] })
        let identifiedNames = Set(named.map { records[$0].identity.catalogueID }.filter { !$0.isEmpty })
        let legacy = named.filter { records[$0].identity.catalogueID.isEmpty && !records[$0].identity.personalOnly }
        if identity.personalOnly {
            return named.sorted().compactMap {
                let record = records[$0]
                return record.identity.catalogueID.isEmpty ? record : nil
            }
        }
        if identity.catalogueID.isEmpty {
            let candidates = identifiedNames.count > 1 ? legacy : named.filter { !records[$0].identity.personalOnly }
            return candidates.sorted().map { records[$0] }
        }
        let byID = Set(byCatalogue[identity.catalogueID] ?? [])
        return (identifiedNames.subtracting([identity.catalogueID]).isEmpty ? byID.union(legacy) : byID)
            .sorted().map { records[$0] }
    }

    static func previousRows(for current: [NativeJSON], from previous: Record, move: NativeJSON) -> [NativeJSON?] {
        guard previous.isTimed == (move["seconds"].number > 0),
              NativeExerciseLabel(move).warmup == previous.warmup else {
            return Array(repeating: nil, count: current.count)
        }
        let source = Dictionary(grouping: previous.rows) { $0["kind"].string }
        var indexes: [String: Int] = [:]
        return current.map { row in
            let kind = row["kind"].string
            let index = indexes[kind, default: 0]
            indexes[kind, default: 0] += 1
            guard let candidates = source[kind], candidates.indices.contains(index), candidates[index]["done"].bool else { return nil }
            return candidates[index]
        }
    }

    static func copied(_ destination: NativeJSON, from previous: NativeJSON, record: Record, move: NativeJSON) -> NativeJSON {
        guard !destination["done"].bool, previous["done"].bool,
              destination["right"] == .null || previous["right"] != .null,
              record.perSide == NativeWorkoutSession.isPerSideLoad(move) || previous["right"] != .null else { return destination }
        var result = destination
        let destinationUnit = unit(of: move)
        let left = convert(previous["weight"].number, from: record.unit, to: destinationUnit)
        let right = convert(previous["right"]["weight"].number, from: record.unit, to: destinationUnit)
        guard max(left, right) <= 2000 else { return destination }
        result["weight"] = .number(left)
        result["reps"] = .number(previous["reps"].number)
        result["seconds"] = .number(previous["seconds"].number)
        if previous["right"] != .null {
            result["right"] = .object(["weight": .number(right), "reps": previous["right"]["reps"]])
        }
        return result
    }

    func increase(for move: NativeJSON) -> Increase? {
        guard move["seconds"].number <= 0, !move["fixedLoad"].bool, move["loadPercent"].number <= 0,
              move["reps"].number >= 2, !NativeExerciseLabel(move).warmup else { return nil }
        let comparable = matching(Identity(move)).filter { $0.strength && !$0.isTimed && !$0.warmup }
        guard let latest = comparable.first, let earlier = comparable.first(where: { $0.workoutID != latest.workoutID }) else { return nil }
        let perSide = NativeWorkoutSession.isPerSideLoad(move)
        let destinationUnit = Self.unit(of: move)
        let sessions = comparable.filter { $0.workoutID == latest.workoutID || $0.workoutID == earlier.workoutID }
        let workingSets = sessions.map { record in record.rows.filter { $0["kind"].string.isEmpty } }
        guard workingSets.allSatisfy({ !$0.isEmpty }), workingSets.reduce(0, { $0 + $1.count }) >= 3 else { return nil }
        guard let baseline = workingSets.first?.first else { return nil }
        let base = Self.convert(baseline["weight"].number, from: latest.unit, to: destinationUnit)
        let split = baseline["right"] != .null
        let baseRight = split ? Self.convert(baseline["right"]["weight"].number, from: latest.unit, to: destinationUnit) : base
        let step = destinationUnit == "lb" ? 5.0 : 2.5
        guard min(base, baseRight) > 0, step <= 0.1 * min(base, baseRight), max(base, baseRight) + step <= 2_000 else { return nil }
        let effortLimit = move["targetRpe"].number > 0 ? min(8, move["targetRpe"].number) : 8
        let reachedTargets = zip(sessions, workingSets).allSatisfy { record, rows in
            let target = max(move["reps"].number, move["repsMax"].number, record.move["reps"].number, record.move["repsMax"].number)
            return (record.perSide == perSide || split) && rows.allSatisfy { row in
                guard row["done"].bool, Record.reps(row) >= target, (row["right"] != .null) == split,
                      row["rpe"] == .null || row["rpe"].number <= effortLimit else { return false }
                let weight = Self.convert(row["weight"].number, from: record.unit, to: destinationUnit)
                let right = split ? Self.convert(row["right"]["weight"].number, from: record.unit, to: destinationUnit) : weight
                return abs(weight - base) < 0.05 && abs(right - baseRight) < 0.05
            }
        }
        guard reachedTargets else { return nil }
        return Increase(weight: base + step, rightWeight: split ? baseRight + step : nil)
    }

    static func withIncrease(_ line: NativeJSON, suggestion: Increase) -> NativeJSON {
        guard !line["done"].bool, line["kind"].string.isEmpty, line["seconds"].number <= 0,
              line["weight"].number <= suggestion.weight,
              line["right"]["weight"].number <= (suggestion.rightWeight ?? 0),
              line["right"] == .null || suggestion.rightWeight != nil else { return line }
        var next = line
        next["weight"] = .number(suggestion.weight)
        if let right = suggestion.rightWeight {
            next["right"] = .object(["weight": .number(right), "reps": line["right"]["reps"] == .null ? line["reps"] : line["right"]["reps"]])
        }
        return next
    }

    static func unit(of move: NativeJSON) -> String { move["unit"].string == "lb" ? "lb" : "kg" }

    static func convert(_ value: Double, from: String, to: String) -> Double {
        guard value.isFinite, value >= 0 else { return 0 }
        let factor = from == to ? 1 : from == "lb" ? 0.45359237 : 1 / 0.45359237
        return (value * factor * 100).rounded() / 100
    }

    static func amount(_ row: NativeJSON, unit: String, showEffort: Bool = true) -> String {
        func quantity(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(0...2))) }
        let left = row["weight"].number > 0 ? quantity(row["weight"].number) + " " + unit + " × " : ""
        let leftReps = left + quantity(row["reps"].number) + " 次"
        let text: String
        if row["seconds"].number > 0 {
            text = quantity(row["seconds"].number) + " 秒" + (left.isEmpty ? "" : " · " + quantity(row["weight"].number) + " " + unit)
        } else if row["right"] != .null {
            let right = row["right"]
            text = "左 " + leftReps + " · 右 " + quantity(right["weight"].number) + " " + unit + " × " + quantity(right["reps"].number) + " 次"
        } else {
            text = leftReps
        }
        if showEffort, row["rpe"] != .null { return text + " · RPE " + quantity(row["rpe"].number) }
        return text
    }
}

enum NativeWorkoutProblem: LocalizedError {
    case noCompletedSet, invalidCardioDuration, invalid, accountChanged
    var errorDescription: String? {
        switch self {
        case .noCompletedSet: return "请至少完成一组动作，或标记视频跟练完成。"
        case .invalidCardioDuration: return "请记录实际有氧训练时长后再完成。"
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

enum NativeAnatomyVariant: String, Codable, CaseIterable, Sendable {
    case male, female

    var title: String { self == .male ? "男性图" : "女性图" }
}

struct NativeWorkoutState: Decodable, Sendable {
    struct Viewer: Decodable, Sendable {
        var id: String
        var name: String?
        var anatomyVariant: String?
    }
    var me: Viewer
    var entries: [NativeWorkoutEntry]
    var room: NativeJSON?
    var historyFrom: String?
    var completedPlanIds: [String]?
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

