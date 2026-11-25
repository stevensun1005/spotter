import Foundation
#if canImport(FoundationXML)
import FoundationXML
#endif

struct NativeImportedHeart: Codable, Sendable {
    let source: String
    let from: Int
    let to: Int
    let average: Int?
    let minimum: Int?
    let maximum: Int?
    let sourceName: String?
    let samples: [HeartPoint]

    var label: String {
        sourceName ?? ["apple": "Apple 健康", "whoop": "WHOOP", "fit": "FIT（Garmin 等）", "tcx": "TCX", "csv": "CSV"][source] ?? source
    }

    var lowest: Int? { minimum ?? samples.map(\.bpm).min() }
}

enum NativeHeartFileError: LocalizedError, Equatable {
    case unsupported, size, invalidFIT, invalidTCX, invalidZIP, multipleActivities, archiveWithoutActivity
    case invalidCSV, missingColumns, noMatch, tooManySamples

    var errorDescription: String? {
        switch self {
        case .unsupported: return "请选择 FIT、TCX、CSV 或含 WHOOP workouts.csv 的 ZIP。"
        case .size: return "文件过大，请选取单次活动或较小的心率导出。"
        case .invalidFIT: return "FIT 文件不完整或格式无效，请重新导出。"
        case .invalidTCX: return "无法完整读取 TCX，请重新导出活动。"
        case .invalidZIP: return "无法读取这份 ZIP，请解压后选择单次活动或 WHOOP workouts.csv。"
        case .multipleActivities: return "ZIP 含有多份活动文件，请解压后选择要导入的那一份。"
        case .archiveWithoutActivity: return "ZIP 没有 FIT、TCX 或 WHOOP workouts.csv。"
        case .invalidCSV: return "CSV 格式不完整，请在设备应用中重新导出。"
        case .missingColumns: return "CSV 需要时间与 BPM 列，或 WHOOP 训练起止时间与心率摘要。"
        case .noMatch: return "找不到与这次训练时段相符的心率。请检查活动时间、时区和导出文件。"
        case .tooManySamples: return "文件中的心率点过多，请导出单次活动或较短时段。"
        }
    }
}

enum NativeHeartFileImport {
    static let fileLimit = 16 * 1024 * 1024
    static let zipLimit = 128 * 1024 * 1024

    static func read(_ url: URL, window: WorkoutWindow) throws -> NativeImportedHeart {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }

        let size = try file.seekToEnd()
        let format = url.pathExtension.lowercased()
        if format == "zip" {
            guard size <= zipLimit else { throw NativeHeartFileError.size }
            let entry = try NativeHeartZIP.read(file, size: Int(size))
            return try read(entry.data, format: entry.format, window: window)
        }
        guard size <= fileLimit else { throw NativeHeartFileError.size }
        try file.seek(toOffset: 0)
        let bytes = try file.read(upToCount: fileLimit + 1) ?? Data()
        return try read(bytes, format: format, window: window)
    }

    static func read(_ bytes: Data, format: String, window: WorkoutWindow) throws -> NativeImportedHeart {
        guard window.canRead else { throw NativeHeartFileError.noMatch }
        guard bytes.count <= fileLimit else { throw NativeHeartFileError.size }
        let result: NativeImportedHeart?
        switch format {
        case "fit": result = try NativeHeartFIT.read(bytes, window: window)
        case "tcx": result = try NativeHeartTCX.read(bytes, window: window)
        case "csv": result = try NativeHeartCSV.read(bytes, window: window)
        default: throw NativeHeartFileError.unsupported
        }
        guard let result else { throw NativeHeartFileError.noMatch }
        return result
    }
}

struct NativeHeartFileSamples {
    private var points: [Int: Int] = [:]
    let window: WorkoutWindow

    mutating func add(_ at: Int?, _ value: Double?) throws {
        guard let at, (window.from...window.to).contains(at), let rate = Self.roundedRate(value) else { return }
        points[at] = rate
        guard points.count <= 200_000 else { throw NativeHeartFileError.tooManySamples }
    }

    func collect(_ source: String) -> NativeImportedHeart? {
        let readings = points.map { HeartPoint(at: $0.key, bpm: $0.value) }
        guard let reduced = HeartPayload.reduce(readings, within: window) else { return nil }
        return NativeImportedHeart(source: source, from: reduced.from, to: reduced.to, average: reduced.average,
                                   minimum: reduced.minimum, maximum: reduced.maximum, sourceName: nil, samples: reduced.samples)
    }

    static func roundedRate(_ value: Double?) -> Int? {
        guard let rounded = value?.rounded(), (1...300).contains(rounded) else { return nil }
        return Int(rounded)
    }
}

struct NativeHeartFileSummary {
    let window: WorkoutWindow
    let source: String
    private(set) var closest: NativeImportedHeart?

    init(window: WorkoutWindow, source: String) {
        self.window = window
        self.source = source
    }

    mutating func add(from: Int?, to: Int?, average: Double?, maximum: Double?) {
        guard let from, let to, from >= 946_684_800_000, to <= 4_102_444_800_000, to > from,
              to - from <= 86_400_000 else { return }
        let overlap = min(window.to, to) - max(window.from, from)
        guard overlap > 0, overlap * 2 >= to - from else { return }
        let avg = NativeHeartFileSamples.roundedRate(average)
        let max = NativeHeartFileSamples.roundedRate(maximum)
        guard avg != nil || max != nil, (avg ?? 0) <= (max ?? 300) else { return }
        let distance = abs(from - window.from) + abs(to - window.to)
        if let closest, abs(closest.from - window.from) + abs(closest.to - window.to) <= distance { return }
        closest = .init(source: source, from: from, to: to, average: avg, minimum: nil, maximum: max, sourceName: nil, samples: [])
    }
}

private struct NativeHeartTimestamp {
    private static let separator = try! NSRegularExpression(pattern: #"^([0-9]{4}-[0-9]{2}-[0-9]{2})[T ]([0-9]{2}:[0-9]{2}:[0-9]{2})(\.[0-9]{1,3})?\s*(Z|[+-][0-9]{2}:?[0-9]{2})?$"#,
                                                             options: .caseInsensitive)
    private let seconds = ISO8601DateFormatter()
    private let fractions: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    func parse(_ source: String, zone: String = "") -> Int? {
        let input = source.trimmingCharacters(in: .whitespacesAndNewlines)
        if (input.count == 10 || input.count == 13), input.utf8.allSatisfy({ (48...57).contains($0) }), let value = Int(input) {
            return input.count == 10 ? value * 1_000 : value
        }
        guard input.utf8.count <= 64,
              let match = Self.separator.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)) else { return nil }
        func part(_ index: Int) -> String {
            Range(match.range(at: index), in: input).map { String(input[$0]) } ?? ""
        }
        var offset = part(4).uppercased()
        if offset.isEmpty {
            offset = zone.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            if offset == "UTC" || offset == "GMT" { offset = "Z" }
            else if offset.hasPrefix("UTC+") || offset.hasPrefix("UTC-") || offset.hasPrefix("GMT+") || offset.hasPrefix("GMT-") {
                offset.removeFirst(3)
            }
        }
        if offset.range(of: #"^[+-][0-9]{4}$"#, options: .regularExpression) != nil { offset.insert(":", at: offset.index(offset.startIndex, offsetBy: 3)) }
        guard offset == "Z" || offset.range(of: #"^[+-](0[0-9]|1[0-4]):[0-5][0-9]$"#, options: .regularExpression) != nil else { return nil }
        let fraction = part(3)
        let value = part(1) + "T" + part(2) + fraction + offset
        let date = (fraction.isEmpty ? seconds : fractions).date(from: value)
        return date.map(epochMilliseconds)
    }
}

private enum NativeHeartCSV {
    static func read(_ bytes: Data, window: WorkoutWindow) throws -> NativeImportedHeart? {
        var columns: Columns?
        let timestamp = NativeHeartTimestamp()
        var samples = NativeHeartFileSamples(window: window)
        var summary = NativeHeartFileSummary(window: window, source: "whoop")
        try rows(bytes) { row in
            guard let columns else {
                columns = try Columns(row)
                return
            }
            func value(_ index: Int?) -> String {
                guard let index, row.indices.contains(index) else { return "" }
                return row[index].trimmingCharacters(in: .whitespacesAndNewlines)
            }
            let zone = value(columns.zone)
            switch columns.kind {
            case .summary(let from, let to, let average, let maximum):
                summary.add(from: timestamp.parse(value(from), zone: zone), to: timestamp.parse(value(to), zone: zone),
                            average: Double(value(average)), maximum: Double(value(maximum)))
            case .samples(let time, let heart):
                try samples.add(timestamp.parse(value(time), zone: zone), Double(value(heart)))
            }
        }
        guard columns != nil else { throw NativeHeartFileError.missingColumns }
        return summary.closest ?? samples.collect("csv")
    }

    private struct Columns {
        enum Kind {
            case summary(from: Int, to: Int, average: Int?, maximum: Int?)
            case samples(time: Int, heart: Int)
        }
        let zone: Int?
        let kind: Kind

        init(_ row: [String]) throws {
            let header = row.map { $0.lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: "", options: .regularExpression) }
            func lookup(_ keys: String...) -> Int? { header.firstIndex { keys.contains($0) } }
            zone = lookup("timezone", "workouttimezone", "cycletimezone", "activitytimezone", "timezoneoffset", "workouttimezoneoffset")
            let from = header.firstIndex { $0.hasPrefix("workoutstart") && !$0.contains("zone") || $0.hasPrefix("activitystart") && !$0.contains("zone") }
            let to = header.firstIndex { $0.hasPrefix("workoutend") && !$0.contains("zone") || $0.hasPrefix("activityend") && !$0.contains("zone") }
            let average = lookup("averagehr", "averagehrbpm", "averageheartrate", "averageheartratebpm", "avghr", "avghrbpm")
            let maximum = lookup("maxhr", "maxhrbpm", "maxheartrate", "maxheartratebpm", "maximumheartrate", "maximumheartratebpm", "peakhrbpm")
            if let from, let to, average != nil || maximum != nil { kind = .summary(from: from, to: to, average: average, maximum: maximum) }
            else if let time = lookup("time", "timestamp", "datetime", "date", "startdate"), let heart = lookup("heartrate", "heartratebpm", "bpm", "hr", "hrbpm", "value") {
                kind = .samples(time: time, heart: heart)
            } else { throw NativeHeartFileError.missingColumns }
        }
    }

    private static func rows(_ data: Data, consume: ([String]) throws -> Void) throws {
        let bytes = Array(data)
        var index = bytes.starts(with: [0xef, 0xbb, 0xbf]) ? 3 : 0
        var row: [String] = []
        var field: [UInt8] = []
        var quoted = false
        var closedQuote = false
        func endField() throws {
            guard row.count < 512, let value = String(bytes: field, encoding: .utf8) else { throw NativeHeartFileError.invalidCSV }
            row.append(value)
            field.removeAll(keepingCapacity: true)
            closedQuote = false
        }
        func endRow() throws {
            guard !row.isEmpty || !field.isEmpty else { closedQuote = false; return }
            try endField()
            try consume(row)
            row.removeAll(keepingCapacity: true)
        }
        while index < bytes.count {
            if index.isMultiple(of: 4096) { try Task.checkCancellation() }
            let byte = bytes[index]
            index += 1
            if quoted {
                if byte != 34 { field.append(byte) }
                else if index < bytes.count && bytes[index] == 34 { field.append(byte); index += 1 }
                else { quoted = false; closedQuote = true }
            } else if byte == 44 { try endField() }
            else if byte == 10 || byte == 13 {
                if byte == 13 && index < bytes.count && bytes[index] == 10 { index += 1 }
                try endRow()
            } else if closedQuote {
                guard byte == 32 || byte == 9 else { throw NativeHeartFileError.invalidCSV }
            } else if byte == 34 && field.isEmpty { quoted = true }
            else { field.append(byte) }
            guard field.count <= 131_072 else { throw NativeHeartFileError.invalidCSV }
        }
        guard !quoted else { throw NativeHeartFileError.invalidCSV }
        try endRow()
    }
}

private final class NativeHeartTCX: NSObject, XMLParserDelegate {
    private var samples: NativeHeartFileSamples
    private let timestamp = NativeHeartTimestamp()
    private var elements: [String] = []
    private var foundTrackpoint = false
    private var time: String?
    private var bpm: String?
    private var field: Field?
    private var content = ""
    private var error: Error?

    private enum Field { case time, bpm }

    init(window: WorkoutWindow) { samples = .init(window: window) }

    static func read(_ data: Data, window: WorkoutWindow) throws -> NativeImportedHeart? {
        let delegate = NativeHeartTCX(window: window)
        let parser = XMLParser(data: data)
        parser.shouldProcessNamespaces = true
        parser.externalEntityResolvingPolicy = .never
        parser.delegate = delegate
        let success = parser.parse()
        if let error = delegate.error { throw error }
        guard success, delegate.foundTrackpoint else { throw NativeHeartFileError.invalidTCX }
        return delegate.samples.collect("tcx")
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        guard elements.count < 64, !Task.isCancelled else {
            error = Task.isCancelled ? CancellationError() : NativeHeartFileError.invalidTCX
            parser.abortParsing()
            return
        }
        let parent = elements.last
        let ancestor = elements.dropLast().last
        elements.append(elementName)
        if elementName == "Trackpoint" {
            foundTrackpoint = true; time = nil; bpm = nil
        } else if elementName == "Time", parent == "Trackpoint" { field = .time; content = "" }
        else if elementName == "Value", parent == "HeartRateBpm", ancestor == "Trackpoint" { field = .bpm; content = "" }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        guard field != nil else { return }
        guard content.utf8.count + string.utf8.count <= 128 else { error = NativeHeartFileError.invalidTCX; parser.abortParsing(); return }
        content.append(string)
    }

    func parser(_ parser: XMLParser, foundInternalEntityDeclarationWithName name: String, value: String?) {
        error = NativeHeartFileError.invalidTCX
        parser.abortParsing()
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName: String?) {
        _ = elements.popLast()
        switch (elementName, field) {
        case ("Time", .time): time = content; field = nil
        case ("Value", .bpm): bpm = content; field = nil
        default: break
        }
        guard elementName == "Trackpoint", let time, let bpm else { return }
        do { try samples.add(timestamp.parse(time), Double(bpm.trimmingCharacters(in: .whitespacesAndNewlines))) }
        catch { self.error = error; parser.abortParsing() }
    }
}
