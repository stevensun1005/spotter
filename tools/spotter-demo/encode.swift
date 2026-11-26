import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

struct InvalidFrame: Error {
    var path: String
}

func writeClip(directory: URL, output: URL) async throws {
    let frameURLs = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .filter { $0.lastPathComponent.hasPrefix("frame-") && $0.pathExtension == "png" }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
    guard (24...130).contains(frameURLs.count) else { throw CocoaError(.fileReadCorruptFile) }
    let width = 704
    let height = 396
    let fps: Int32 = 20
    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    writer.shouldOptimizeForNetworkUse = true
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoColorPropertiesKey: [
            AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
            AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
            AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
        ],
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 700_000,
            AVVideoExpectedSourceFrameRateKey: fps,
            AVVideoMaxKeyFrameIntervalKey: fps,
        ],
    ])
    let frames = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ])
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
    writer.startSession(atSourceTime: .zero)
    guard let pool = frames.pixelBufferPool, !frameURLs.isEmpty else { throw CocoaError(.fileReadUnknown) }
    for (index, url) in frameURLs.enumerated() {
        while !input.isReadyForMoreMediaData {
            guard writer.status == .writing else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
            try await Task.sleep(for: .milliseconds(2))
        }
        try autoreleasepool {
            var pixel: CVPixelBuffer?
            let code = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixel)
            guard code == kCVReturnSuccess, let pixel,
                  let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
                  image.width == width, image.height == height else { throw InvalidFrame(path: url.path) }
            CVPixelBufferLockBaseAddress(pixel, [])
            guard let context = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height,
                                          bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixel),
                                          space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                          bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue) else {
                CVPixelBufferUnlockBaseAddress(pixel, [])
                throw InvalidFrame(path: url.path)
            }
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            CVPixelBufferUnlockBaseAddress(pixel, [])
            guard frames.append(pixel, withPresentationTime: CMTime(value: Int64(index), timescale: fps)) else {
                throw writer.error ?? CocoaError(.fileWriteUnknown)
            }
        }
    }
    writer.endSession(atSourceTime: CMTime(value: Int64(frameURLs.count), timescale: fps))
    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
}

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: spotter-demo-encode <frame directory> <new .mp4 path>\n", stderr)
    exit(2)
}
let input = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: false)
do {
    try await writeClip(directory: input, output: output)
} catch {
    fputs("Spotter demo H.264 encoding failed.\n", stderr)
    exit(1)
}
