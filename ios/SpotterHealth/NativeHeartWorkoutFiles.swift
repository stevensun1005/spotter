import Foundation
import zlib

enum NativeHeartFIT {
    private struct Field {
        let number: UInt8
        let size: Int
        let type: UInt8
    }

    private struct Definition {
        let global: Int
        let littleEndian: Bool
        let fields: [Field]
        let developerSize: Int
    }

    // Garmin activity profile: Session (18), Record (20), timestamp (253).
    private static let fitEpoch = 631_065_600
    private static let crcTable: [UInt16] = [
        0, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
        0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
    ]

    static func read(_ data: Data, window: WorkoutWindow) throws -> NativeImportedHeart? {
        let bytes = NativeHeartBinary(data)
        guard bytes.count >= 14 else { throw NativeHeartFileError.invalidFIT }
        var samples = NativeHeartFileSamples(window: window)
        var summary = NativeHeartFileSummary(window: window, source: "fit")
        var offset = 0
        // A FIT stream can contain multiple independent files, each with its own definitions and CRC.
        while offset < bytes.count {
            try Task.checkCancellation()
            let header = Int(bytes[offset])
            guard (header == 12 || header >= 14), offset + header + 2 <= bytes.count,
                  bytes.u32(offset + 8) == 0x5449462e else { throw NativeHeartFileError.invalidFIT }
            let firstRecord = offset + header
            let end = firstRecord + bytes.u32(offset + 4)
            guard end + 2 <= bytes.count else { throw NativeHeartFileError.invalidFIT }
            if header >= 14 {
                let headerCRC = bytes.u16(offset + 12)
                if headerCRC != 0, headerCRC != Int(try crc(bytes, from: offset, to: offset + 12)) {
                    throw NativeHeartFileError.invalidFIT
                }
            }
            guard bytes.u16(end) == Int(try crc(bytes, from: offset, to: end)) else { throw NativeHeartFileError.invalidFIT }
            try records(bytes, from: firstRecord, to: end, samples: &samples, summary: &summary)
            offset = end + 2
        }
        return samples.collect("fit") ?? summary.closest
    }

    private static func records(_ bytes: NativeHeartBinary, from: Int, to: Int, samples: inout NativeHeartFileSamples,
                                summary: inout NativeHeartFileSummary) throws {
        var offset = from
        var definitions: [Definition?] = Array(repeating: nil, count: 16)
        var lastTimestamp: Int?
        while offset < to {
            try Task.checkCancellation()
            let header = bytes[offset]
            offset += 1
            let compressed = header & 0x80 != 0
            let local = Int(compressed ? (header >> 5) & 3 : header & 15)
            if !compressed && header & 0x40 != 0 {
                definitions[local] = try definition(bytes, offset: &offset, end: to, developers: header & 0x20 != 0)
                continue
            }
            guard let definition = definitions[local] else { throw NativeHeartFileError.invalidFIT }
            var timestamp: Int?
            if compressed {
                guard let previous = lastTimestamp else { throw NativeHeartFileError.invalidFIT }
                let timeOffset = Int(header & 31)
                let next = (previous & ~31) + timeOffset + (timeOffset < previous & 31 ? 32 : 0)
                guard next < 0xffff_ffff else { throw NativeHeartFileError.invalidFIT }
                timestamp = next
            }
            var start: Int?
            var average: Double?
            var maximum: Double?
            var heart: Double?
            for field in definition.fields {
                if compressed && field.number == 253 && field.size == 4 && field.type == 6 { continue }
                guard offset + field.size <= to else { throw NativeHeartFileError.invalidFIT }
                if field.size == 4, field.type == 6 {
                    let value = bytes.u32(offset, littleEndian: definition.littleEndian)
                    if value != 0xffff_ffff {
                        if field.number == 253 { timestamp = value }
                        else if definition.global == 18 && field.number == 2 { start = value }
                    }
                } else if field.size == 1, field.type == 2, bytes[offset] != 0xff {
                    if definition.global == 20 && field.number == 3 { heart = Double(bytes[offset]) }
                    else if definition.global == 18 && field.number == 16 { average = Double(bytes[offset]) }
                    else if definition.global == 18 && field.number == 17 { maximum = Double(bytes[offset]) }
                }
                offset += field.size
            }
            guard offset + definition.developerSize <= to else { throw NativeHeartFileError.invalidFIT }
            offset += definition.developerSize
            if let timestamp { lastTimestamp = timestamp }
            if definition.global == 20 { try samples.add(timestamp.map(epoch), heart) }
            else if definition.global == 18 {
                summary.add(from: start.map(epoch), to: timestamp.map(epoch), average: average, maximum: maximum)
            }
        }
    }

    private static func definition(_ bytes: NativeHeartBinary, offset: inout Int, end: Int, developers: Bool) throws -> Definition {
        guard offset + 5 <= end, bytes[offset + 1] <= 1 else { throw NativeHeartFileError.invalidFIT }
        let littleEndian = bytes[offset + 1] == 0
        let global = bytes.u16(offset + 2, littleEndian: littleEndian)
        let count = Int(bytes[offset + 4])
        offset += 5
        guard offset + count * 3 <= end else { throw NativeHeartFileError.invalidFIT }
        var fields: [Field] = []
        fields.reserveCapacity(count)
        for _ in 0..<count {
            guard bytes[offset + 1] > 0 else { throw NativeHeartFileError.invalidFIT }
            fields.append(.init(number: bytes[offset], size: Int(bytes[offset + 1]), type: bytes[offset + 2] & 0x1f))
            offset += 3
        }
        var extra = 0
        if developers {
            guard offset < end else { throw NativeHeartFileError.invalidFIT }
            let developerCount = Int(bytes[offset])
            offset += 1
            guard offset + developerCount * 3 <= end else { throw NativeHeartFileError.invalidFIT }
            for _ in 0..<developerCount { extra += Int(bytes[offset + 1]); offset += 3 }
        }
        return Definition(global: global, littleEndian: littleEndian, fields: fields, developerSize: extra)
    }

    private static func epoch(_ timestamp: Int) -> Int { (timestamp + fitEpoch) * 1_000 }

    private static func crc(_ bytes: NativeHeartBinary, from: Int, to: Int) throws -> UInt16 {
        var result: UInt16 = 0
        for i in from..<to {
            if i.isMultiple(of: 16_384) { try Task.checkCancellation() }
            let byte = UInt16(bytes[i])
            result = (result >> 4) ^ crcTable[Int((result ^ byte) & 15)]
            result = (result >> 4) ^ crcTable[Int((result ^ (byte >> 4)) & 15)]
        }
        return result
    }
}

enum NativeHeartZIP {
    private static let directoryLimit = 8 * 1024 * 1024

    private struct Entry {
        let name: [UInt8]
        let format: String
        let method: Int
        let flags: Int
        let offset: Int
        let compressed: Int
        let uncompressed: Int
        let crc: Int
    }

    static func read(_ file: FileHandle, size: Int) throws -> (data: Data, format: String) {
        guard size >= 22 else { throw NativeHeartFileError.invalidZIP }
        let tailOffset = max(0, size - 65_557)
        let tail = NativeHeartBinary(try exact(file, offset: tailOffset, length: size - tailOffset))
        guard let end = stride(from: tail.count - 22, through: 0, by: -1).first(where: { position in
            tail.u32(position) == 0x06054b50 && position + 22 + tail.u16(position + 20) == tail.count
        }) else { throw NativeHeartFileError.invalidZIP }
        let records = tail.u16(end + 10)
        let directorySize = tail.u32(end + 12)
        let directoryOffset = tail.u32(end + 16)
        guard tail.u16(end + 4) == 0, tail.u16(end + 6) == 0, records == tail.u16(end + 8), records <= 4096,
              directorySize <= directoryLimit, directoryOffset + directorySize <= tailOffset + end else {
            throw NativeHeartFileError.invalidZIP
        }
        let directory = NativeHeartBinary(try exact(file, offset: directoryOffset, length: directorySize))
        let entry = try select(directory, records: records)
        guard entry.offset + 30 <= directoryOffset, entry.flags & 0x2041 == 0, entry.method == 0 || entry.method == 8 else {
            throw NativeHeartFileError.invalidZIP
        }
        guard entry.uncompressed <= NativeHeartFileImport.fileLimit, entry.compressed <= NativeHeartFileImport.fileLimit + 65_536 else {
            throw NativeHeartFileError.size
        }
        let local = NativeHeartBinary(try exact(file, offset: entry.offset, length: 30))
        let nameLength = local.u16(26)
        let offset = entry.offset + 30 + nameLength + local.u16(28)
        guard local.u32(0) == 0x04034b50, local.u16(8) == entry.method, local.u16(6) == entry.flags,
              offset + entry.compressed <= directoryOffset, nameLength == entry.name.count,
              Array(try exact(file, offset: entry.offset + 30, length: nameLength)) == entry.name else {
            throw NativeHeartFileError.invalidZIP
        }
        try Task.checkCancellation()
        let compressed = try exact(file, offset: offset, length: entry.compressed)
        let result = entry.method == 0 ? compressed : try inflateRaw(compressed, size: entry.uncompressed)
        let checksum = result.withUnsafeBytes { bytes in crc32(0, bytes.bindMemory(to: UInt8.self).baseAddress, uInt(bytes.count)) }
        guard result.count == entry.uncompressed, Int(checksum) == entry.crc else { throw NativeHeartFileError.invalidZIP }
        return (result, entry.format)
    }

    private static func select(_ directory: NativeHeartBinary, records: Int) throws -> Entry {
        var offset = 0
        var selected: Entry?
        for _ in 0..<records {
            try Task.checkCancellation()
            guard offset + 46 <= directory.count, directory.u32(offset) == 0x02014b50,
                  directory.u16(offset + 34) == 0 else { throw NativeHeartFileError.invalidZIP }
            let nameLength = directory.u16(offset + 28)
            let nameOffset = offset + 46
            let next = nameOffset + nameLength + directory.u16(offset + 30) + directory.u16(offset + 32)
            guard next <= directory.count else { throw NativeHeartFileError.invalidZIP }
            let name = Array(directory.bytes[nameOffset..<(nameOffset + nameLength)])
            let path = String(decoding: name, as: UTF8.self).lowercased()
            let segments = path.split(whereSeparator: { $0 == "/" || $0 == "\\" })
            if !path.hasSuffix("/"), !path.hasSuffix("\\"), !segments.contains("__macosx"), let leaf = segments.last, !leaf.hasPrefix(".") {
                let extensionName = leaf.split(separator: ".").last
                let format = leaf == "workouts.csv" ? "csv" : extensionName == "fit" ? "fit" : extensionName == "tcx" ? "tcx" : nil
                if let format {
                    guard selected == nil else { throw NativeHeartFileError.multipleActivities }
                    selected = Entry(name: name, format: format, method: directory.u16(offset + 10), flags: directory.u16(offset + 8),
                                     offset: directory.u32(offset + 42), compressed: directory.u32(offset + 20),
                                     uncompressed: directory.u32(offset + 24), crc: directory.u32(offset + 16))
                }
            }
            offset = next
        }
        guard offset == directory.count else { throw NativeHeartFileError.invalidZIP }
        guard let selected else { throw NativeHeartFileError.archiveWithoutActivity }
        return selected
    }

    private static func exact(_ file: FileHandle, offset: Int, length: Int) throws -> Data {
        try file.seek(toOffset: UInt64(offset))
        let bytes = try file.read(upToCount: length) ?? Data()
        guard bytes.count == length else { throw NativeHeartFileError.invalidZIP }
        return bytes
    }

    private static func inflateRaw(_ compressed: Data, size: Int) throws -> Data {
        var buffer = Data(count: size + 1)
        let outputBufferCount = buffer.count
        var stream = z_stream()
        guard inflateInit2_(&stream, -MAX_WBITS, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size)) == Z_OK else {
            throw NativeHeartFileError.invalidZIP
        }
        defer { inflateEnd(&stream) }
        let status = compressed.withUnsafeBytes { input in
            buffer.withUnsafeMutableBytes { output in
                stream.next_in = UnsafeMutablePointer(mutating: input.bindMemory(to: Bytef.self).baseAddress)
                stream.avail_in = uInt(input.count)
                stream.next_out = output.bindMemory(to: Bytef.self).baseAddress
                stream.avail_out = uInt(outputBufferCount)
                return inflate(&stream, Z_FINISH)
            }
        }
        guard status == Z_STREAM_END, stream.total_out == size, stream.avail_in == 0 else { throw NativeHeartFileError.invalidZIP }
        buffer.removeLast()
        return buffer
    }
}

private struct NativeHeartBinary {
    let bytes: [UInt8]
    init(_ data: Data) { bytes = Array(data) }
    var count: Int { bytes.count }
    subscript(_ offset: Int) -> UInt8 { bytes[offset] }

    func u16(_ offset: Int, littleEndian: Bool = true) -> Int {
        let a = Int(bytes[offset]), b = Int(bytes[offset + 1])
        return littleEndian ? a | (b << 8) : (a << 8) | b
    }

    func u32(_ offset: Int, littleEndian: Bool = true) -> Int {
        let a = u16(offset, littleEndian: littleEndian), b = u16(offset + 2, littleEndian: littleEndian)
        return littleEndian ? a | (b << 16) : (a << 16) | b
    }
}
