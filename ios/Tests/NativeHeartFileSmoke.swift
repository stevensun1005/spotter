import Foundation
import zlib

@main
struct NativeHeartFileSmoke {
    static func main() throws {
        let formatter = ISO8601DateFormatter()
        let start = epochMilliseconds(formatter.date(from: "2025-11-24T04:59:00Z")!)
        let id = "8aa45d43-62ac-4af2-afb7-a2917b48663d"
        let first = WorkoutWindow(id: id, from: start, to: start + 120_000)
        let second = WorkoutWindow(id: id, from: start + 3_600_000, to: start + 3_720_000)
        let fitStart = start / 1_000 - 631_065_600

        let sampleFIT = fitFile([
            definition(local: 0, global: 20, fields: [[253, 4, 0x86], [3, 1, 2]]),
            definition(local: 1, global: 20, fields: [[3, 1, 2]]),
            Data([0]) + little(fitStart - 1, 4) + Data([65]),
            Data([0]) + little(fitStart + 29, 4) + Data([105]),
            Data([0xa0 | UInt8((fitStart + 30) & 31), 110]),
            Data([0]) + little(fitStart + 90, 4) + Data([130]),
            Data([0]) + little(fitStart + 3_630, 4) + Data([150]),
            Data([0]) + little(fitStart + 3_690, 4) + Data([160]),
        ])
        let points = [(start - 1_000, 65), (start + 30_000, 110), (start + 90_000, 130),
                      (second.from + 30_000, 150), (second.from + 90_000, 160)]
        let xml = points.map { at, bpm in
            let time = formatter.string(from: Date(timeIntervalSince1970: Double(at) / 1_000))
            return "<tcx:Trackpoint><tcx:Time>\(time)</tcx:Time><tcx:HeartRateBpm><tcx:Value>\(bpm)</tcx:Value></tcx:HeartRateBpm></tcx:Trackpoint>"
        }.joined()
        let sampleTCX = Data("<tcx:TrainingCenterDatabase xmlns:tcx=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\">\(xml)</tcx:TrainingCenterDatabase>".utf8)
        for (file, format) in [(sampleFIT, "fit"), (sampleTCX, "tcx")] {
            let a = try NativeHeartFileImport.read(file, format: format, window: first)
            let b = try NativeHeartFileImport.read(file, format: format, window: second)
            let expected = format == "fit" ? [105, 110, 130] : [110, 130]
            check(a.samples.map(\.bpm) == expected && a.minimum == expected.first && a.maximum == 130, "first workout cutoff for \(format)")
            check(b.samples.map(\.bpm) == [150, 160] && b.average == 155, "second workout cutoff for \(format)")
        }
        let corrupted = sampleFIT.dropLast() + Data([sampleFIT.last! ^ 1])
        try fails(.invalidFIT) { try NativeHeartFileImport.read(corrupted, format: "fit", window: first) }

        let sessionFIT = fitFile([
            definition(local: 0, global: 18, fields: [[253, 4, 0x86], [2, 4, 0x86], [16, 1, 2], [17, 1, 2]], bigEndian: true),
            Data([0]) + big(fitStart + 121, 4) + big(fitStart - 1, 4) + Data([139, 181]),
        ])
        let session = try NativeHeartFileImport.read(sessionFIT, format: "fit", window: first)
        check(session.samples.isEmpty && session.average == 139 && session.maximum == 181, "FIT summary fallback and big endian")

        let csv = Data("\u{feff}time,bpm\r\n\"2025-11-23T23:59:30-0500\",120\r\n2025-11-24T04:59:30Z,130\r\n2025-11-24 04:59:45,170\r\n".utf8)
        let csvResult = try NativeHeartFileImport.read(csv, format: "csv", window: first)
        check(csvResult.samples.map(\.bpm) == [130], "CSV timezone, BOM and deduplication")
        let noZone = Data("time,bpm\n2025-11-24 04:59:45,170\n".utf8)
        try fails(.noMatch) { try NativeHeartFileImport.read(noZone, format: "csv", window: first) }
        let externalEntity = Data("<!DOCTYPE TrainingCenterDatabase [<!ENTITY x '130'>]><TrainingCenterDatabase></TrainingCenterDatabase>".utf8)
        try fails(.invalidTCX) { try NativeHeartFileImport.read(externalEntity, format: "tcx", window: first) }

        let whoop = Data(("Workout start time,Workout end time,Workout timezone,Average HR (bpm),Max HR (bpm),Activity name\r\n" +
            "2025-11-23 23:59:00,2025-11-24 00:01:00,UTC-05:00,144,187,\"Lifting, \"\"synthetic\"\"\"\r\n" +
            "2025-11-24 00:59:00,2025-11-24 01:01:00,UTC-05:00,151,192,Cardio\r\n").utf8)
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("spotter-native-heart-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let url = dir.appendingPathComponent("whoop.zip")
        try zip([("export/workouts.csv", whoop), ("export/sleep.csv", Data("ignored".utf8))]).write(to: url)
        let summary = try NativeHeartFileImport.read(url, window: first)
        let other = try NativeHeartFileImport.read(url, window: second)
        check(summary.source == "whoop" && summary.average == 144 && summary.maximum == 187 && summary.samples.isEmpty, "WHOOP ZIP deflate and workout summaries")
        check(other.average == 151 && other.maximum == 192, "WHOOP nearest matching workout")
        try zip([("workouts.csv", whoop), ("other.tcx", sampleTCX)]).write(to: url)
        try fails(.multipleActivities) { try NativeHeartFileImport.read(url, window: first) }
        var damagedZip = zip([("workouts.csv", whoop)])
        damagedZip[45] ^= 1
        try damagedZip.write(to: url)
        try fails(.invalidZIP) { try NativeHeartFileImport.read(url, window: first) }
        try fails(.size) {
            try NativeHeartFileImport.read(Data(count: NativeHeartFileImport.fileLimit + 1), format: "csv", window: first)
        }

        let longWindow = WorkoutWindow(id: id, from: start, to: start + 2_000_000)
        var samples = NativeHeartFileSamples(window: longWindow)
        for offset in 0..<2_000 {
            try samples.add(start + offset * 1_000, offset == 2 ? 44 : offset == 1_333 ? 224 : 120)
        }
        let reduced = samples.collect("csv")!
        check(reduced.samples.count <= 720 && reduced.samples.contains { $0.bpm == 44 } && reduced.samples.contains { $0.bpm == 224 }, "both extremes survive downsampling")
        print("PASS native heart import: FIT CRC and compressed timestamps, TCX, zoned CSV, WHOOP ZIP summaries, overlap and file limits")
    }

    private static func check(_ condition: @autoclosure () -> Bool, _ label: String) { precondition(condition(), label) }

    private static func fails(_ expected: NativeHeartFileError, _ call: () throws -> NativeImportedHeart) throws {
        do { _ = try call(); preconditionFailure("expected \(expected)") }
        catch let actual as NativeHeartFileError { check(actual == expected, "expected \(expected), got \(actual)") }
    }

    private static func little(_ value: Int, _ bytes: Int) -> Data {
        Data((0..<bytes).map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) })
    }

    private static func big(_ value: Int, _ bytes: Int) -> Data { Data(little(value, bytes).reversed()) }

    private static func definition(local: UInt8, global: Int, fields: [[UInt8]], bigEndian: Bool = false) -> Data {
        Data([0x40 | local, 0, bigEndian ? 1 : 0]) + (bigEndian ? big(global, 2) : little(global, 2)) +
            Data([UInt8(fields.count)]) + Data(fields.joined())
    }

    private static func fitFile(_ records: [Data]) -> Data {
        let body = records.reduce(into: Data()) { $0.append($1) }
        let header = Data([12, 0x20, 0, 0]) + little(body.count, 4) + Data(".FIT".utf8)
        let unsigned = header + body
        var crc = 0
        for byte in unsigned {
            crc ^= Int(byte)
            for _ in 0..<8 { crc = crc & 1 == 1 ? (crc >> 1) ^ 0xa001 : crc >> 1 }
        }
        return unsigned + little(crc, 2)
    }

    private static func zip(_ entries: [(String, Data)]) -> Data {
        var files = Data(), directory = Data()
        for (name, contents) in entries {
            let path = Data(name.utf8)
            let packed = deflateRaw(contents)
            let crc = Int(contents.withUnsafeBytes { crc32(0, $0.bindMemory(to: Bytef.self).baseAddress, uInt($0.count)) })
            let sizes = little(crc, 4) + little(packed.count, 4) + little(contents.count, 4)
            var central = little(0x02014b50, 4) + little(20, 2) + little(20, 2) + little(0, 2) + little(8, 2) + little(0, 4)
            central += sizes + little(path.count, 2) + Data(count: 12) + little(files.count, 4) + path
            directory += central
            var local = little(0x04034b50, 4) + little(20, 2) + little(0, 2) + little(8, 2) + little(0, 4)
            local += sizes + little(path.count, 2) + little(0, 2) + path + packed
            files += local
        }
        let end = little(0x06054b50, 4) + little(0, 4) + little(entries.count, 2) + little(entries.count, 2) +
            little(directory.count, 4) + little(files.count, 4) + little(0, 2)
        return files + directory + end
    }

    private static func deflateRaw(_ data: Data) -> Data {
        var stream = z_stream()
        precondition(deflateInit2_(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED, -MAX_WBITS, 8, Z_DEFAULT_STRATEGY,
                                   ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK)
        defer { deflateEnd(&stream) }
        let outputCount = Int(deflateBound(&stream, uLong(data.count)))
        var output = Data(count: outputCount)
        let status = data.withUnsafeBytes { input in output.withUnsafeMutableBytes { target in
            stream.next_in = UnsafeMutablePointer(mutating: input.bindMemory(to: Bytef.self).baseAddress)
            stream.avail_in = uInt(input.count)
            stream.next_out = target.bindMemory(to: Bytef.self).baseAddress
            stream.avail_out = uInt(target.count)
            return deflate(&stream, Z_FINISH)
        } }
        precondition(status == Z_STREAM_END)
        return Data(output.prefix(Int(stream.total_out)))
    }
}
