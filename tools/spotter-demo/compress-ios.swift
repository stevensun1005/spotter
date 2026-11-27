import AVFoundation
import CoreVideo
import Foundation
import VideoToolbox

private struct MoviePair: Decodable {
    let source: String
    let destination: String
}

private struct EncodeError: LocalizedError {
    let message: String
    var errorDescription: String? { message }

    init(_ message: String) { self.message = message }
}

private func makeReader(for asset: AVURLAsset, track: AVAssetTrack,
                        settings: [String: Any]?) throws -> (AVAssetReader, AVAssetReaderTrackOutput) {
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw EncodeError("Cannot read the video track.") }
    reader.add(output)
    guard reader.startReading() else { throw reader.error ?? EncodeError("Cannot start reading.") }
    return (reader, output)
}

private func compress(_ pair: MoviePair, width: Int, height: Int,
                      bitrate: Int, codec: AVVideoCodecType) async throws {
    guard pair.source.hasPrefix("/"), pair.destination.hasPrefix("/") else {
        throw EncodeError("Source and destination must be absolute paths.")
    }
    let source = URL(fileURLWithPath: pair.source)
    let destination = URL(fileURLWithPath: pair.destination)
    let files = FileManager.default
    guard !files.fileExists(atPath: destination.path) else {
        throw EncodeError("Destination already exists: \(destination.path)")
    }
    let temporary = destination.deletingLastPathComponent()
        .appendingPathComponent(".spotter-video-\(UUID().uuidString).mp4")
    defer { try? files.removeItem(at: temporary) }

    let asset = AVURLAsset(url: source)
    let tracks = try await asset.loadTracks(withMediaType: .video)
    guard tracks.count == 1, let track = tracks.first else {
        throw EncodeError("Expected one source video track.")
    }
    let naturalSize = try await track.load(.naturalSize)
    let timeRange = try await track.load(.timeRange)
    let duration = try await asset.load(.duration)
    let transform = try await track.load(.preferredTransform)
    let frameRate = try await track.load(.nominalFrameRate)
    let timeScale = try await track.load(.naturalTimeScale)
    guard naturalSize.width * CGFloat(height) == naturalSize.height * CGFloat(width),
          transform.isIdentity, timeRange.isValid, duration.isNumeric,
          frameRate.isFinite, frameRate > 0, timeScale > 0 else {
        throw EncodeError("Unexpected source geometry or timing.")
    }

    let pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
    let pixelSettings: [String: Any] = [kCVPixelBufferPixelFormatTypeKey as String: pixelFormat]
    let (reader, trackOutput) = try makeReader(for: asset, track: track, settings: pixelSettings)
    defer { if reader.status == .reading { reader.cancelReading() } }
    let writer = try AVAssetWriter(outputURL: temporary, fileType: .mp4)
    defer { if writer.status == .writing { writer.cancelWriting() } }
    writer.shouldOptimizeForNetworkUse = true

    let fps = max(1, Int(frameRate.rounded()))
    let settings: [String: Any] = [
        AVVideoCodecKey: codec,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoColorPropertiesKey: [
            AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
            AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
            AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
        ],
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: bitrate,
            AVVideoExpectedSourceFrameRateKey: fps,
            AVVideoMaxKeyFrameIntervalKey: fps * 2,
            AVVideoAllowFrameReorderingKey: true,
        ],
    ]
    guard writer.canApply(outputSettings: settings, forMediaType: .video) else {
        throw EncodeError("Video encoder does not support the requested format.")
    }
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.mediaTimeScale = timeScale
    let pixelBuffers = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
        sourcePixelBufferAttributes: pixelSettings.merging([
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
        ]) { _, dimension in dimension })
    guard writer.canAdd(input) else { throw EncodeError("Cannot add the encoded video track.") }
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? EncodeError("Cannot start encoding.") }
    writer.startSession(atSourceTime: timeRange.start)
    guard let pool = pixelBuffers.pixelBufferPool else { throw EncodeError("Missing scaler buffer pool.") }

    var session: VTPixelTransferSession?
    let createStatus = VTPixelTransferSessionCreate(allocator: kCFAllocatorDefault, pixelTransferSessionOut: &session)
    guard createStatus == noErr, let session else {
        throw EncodeError("Cannot create the video scaler (\(createStatus)).")
    }
    defer { VTPixelTransferSessionInvalidate(session) }

    var sourceTimes: [CMTime] = []
    while let sample = trackOutput.copyNextSampleBuffer() {
        while !input.isReadyForMoreMediaData {
            guard writer.status == .writing else { throw writer.error ?? EncodeError("Encoder stopped.") }
            try await Task.sleep(for: .milliseconds(2))
        }
        try autoreleasepool {
            var scaled: CVPixelBuffer?
            let bufferStatus = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &scaled)
            guard bufferStatus == kCVReturnSuccess, let scaled, let frame = sample.imageBuffer else {
                throw EncodeError("Cannot allocate or decode frame \(sourceTimes.count + 1) (\(bufferStatus)).")
            }
            let scaleStatus = VTPixelTransferSessionTransferImage(session, from: frame, to: scaled)
            guard scaleStatus == noErr else {
                throw EncodeError("Cannot scale frame \(sourceTimes.count + 1) (\(scaleStatus)).")
            }
            let time = sample.presentationTimeStamp
            guard time.isNumeric, pixelBuffers.append(scaled, withPresentationTime: time) else {
                throw writer.error ?? EncodeError("Cannot encode frame \(sourceTimes.count + 1).")
            }
            sourceTimes.append(CMTimeSubtract(time, timeRange.start))
        }
    }
    guard reader.status == .completed, !sourceTimes.isEmpty else {
        throw reader.error ?? EncodeError("Source video did not finish decoding.")
    }
    writer.endSession(atSourceTime: timeRange.end)
    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? EncodeError("Encoder did not finish.") }

    let result = AVURLAsset(url: temporary)
    let encodedTracks = try await result.loadTracks(withMediaType: .video)
    guard encodedTracks.count == 1, let encoded = encodedTracks.first,
          try await encoded.load(.naturalSize) == CGSize(width: width, height: height),
          abs(try await result.load(.duration).seconds - duration.seconds) <= 1 / Double(frameRate) else {
        throw EncodeError("Encoded track geometry or duration changed.")
    }
    let expectedFormat = codec == .hevc ? kCMVideoCodecType_HEVC : kCMVideoCodecType_H264
    guard let format = try await encoded.load(.formatDescriptions).first,
          CMFormatDescriptionGetMediaSubType(format) == expectedFormat else {
        throw EncodeError("Encoded track does not use the expected codec.")
    }
    let (check, samples) = try makeReader(for: result, track: encoded, settings: pixelSettings)
    defer { if check.status == .reading { check.cancelReading() } }
    var resultTimes: [CMTime] = []
    while let sample = samples.copyNextSampleBuffer() {
        guard sample.imageBuffer != nil else { continue }
        resultTimes.append(sample.presentationTimeStamp)
    }
    guard check.status == .completed, sourceTimes.sorted() == resultTimes.sorted() else {
        throw check.error ?? EncodeError("Encoded timestamps changed (\(sourceTimes.count) source frames, \(resultTimes.count) output frames).")
    }
    try files.moveItem(at: temporary, to: destination)
}

private let arguments = CommandLine.arguments
guard arguments.count == 6,
      let width = Int(arguments[2]), width > 0, width.isMultiple(of: 2),
      let height = Int(arguments[3]), height > 0, height.isMultiple(of: 2),
      let bitrate = Int(arguments[4]), bitrate > 0,
      ["hevc", "h264"].contains(arguments[5]) else {
    fputs("Usage: compress-ios <input-output manifest.json> <width> <height> <bitrate> <hevc|h264>\n", stderr)
    exit(2)
}

do {
    let pairs = try JSONDecoder().decode([MoviePair].self, from: Data(contentsOf: URL(fileURLWithPath: arguments[1])))
    let codec: AVVideoCodecType = arguments[5] == "hevc" ? .hevc : .h264
    for pair in pairs {
        do {
            try await compress(pair, width: width, height: height, bitrate: bitrate, codec: codec)
        } catch {
            fputs("\(pair.source) → \(pair.destination): \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }
} catch {
    fputs("\(arguments[1]): \(error.localizedDescription)\n", stderr)
    exit(1)
}
