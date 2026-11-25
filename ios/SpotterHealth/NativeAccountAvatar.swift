import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct NativeAccountAvatarPhoto {
    private static let byteLimit = 60_000
    let jpeg: Data
    let image: UIImage

    init?(jpeg: Data) {
        guard jpeg.count <= Self.byteLimit, let image = UIImage(data: jpeg) else { return nil }
        self.jpeg = jpeg
        self.image = image
    }

    static func makeJPEG(from input: Data) -> Data? {
        guard input.count <= 32_000_000, let source = CGImageSourceCreateWithData(
            input as CFData, [kCGImageSourceShouldCache: false] as CFDictionary
        ), let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 768
        ] as CFDictionary) else { return nil }
        let edge = min(thumbnail.width, thumbnail.height)
        let crop = CGRect(x: (thumbnail.width - edge) / 2, y: (thumbnail.height - edge) / 2, width: edge, height: edge)
        let size = 256
        guard let center = thumbnail.cropping(to: crop),
              let color = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                      bytesPerRow: 0, space: color, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
        else { return nil }
        let frame = CGRect(x: 0, y: 0, width: size, height: size)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(frame)
        context.interpolationQuality = .high
        context.draw(center, in: frame)
        guard let square = context.makeImage() else { return nil }

        for quality in [0.82, 0.70, 0.55] {
            let output = NSMutableData()
            guard let encoder = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
            CGImageDestinationAddImage(encoder, square, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
            if CGImageDestinationFinalize(encoder), output.length <= byteLimit { return output as Data }
        }
        return nil
    }
}

struct NativeAccountAvatar: View {
    @Environment(\.spotterAccent) private var accent
    let name: String
    let photo: NativeAccountAvatarPhoto?
    var size: CGFloat

    var body: some View {
        Group {
            if let photo {
                Image(uiImage: photo.image).resizable().scaledToFill()
            } else {
                Text(name.first.map(String.init)?.uppercased() ?? "我")
                    .font(.system(size: size * 0.40, weight: .bold, design: .rounded))
                    .foregroundStyle(accent.tint)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(accent.selection)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(SpotterPalette.line, lineWidth: 1).allowsHitTesting(false))
        .accessibilityHidden(true)
    }
}

@MainActor
enum NativeAccountAvatarAPI {
    private struct AvatarResponse: Decodable {
        let image: String?

        func photo() throws -> NativeAccountAvatarPhoto? {
            guard let image else { return nil }
            guard let data = Data(base64Encoded: image), let photo = NativeAccountAvatarPhoto(jpeg: data) else {
                throw NativeAPIError.invalidResponse
            }
            return photo
        }
    }

    static func get(api: NativeAPI, owner: String) async throws -> NativeAccountAvatarPhoto? {
        let response = try await api.request("/api/auth/avatar", method: "GET", json: nil, for: owner)
        return try JSONDecoder().decode(AvatarResponse.self, from: response).photo()
    }

    static func save(api: NativeAPI, owner: String, photo: NativeAccountAvatarPhoto?) async throws -> NativeAccountAvatarPhoto? {
        let image: Any = photo.map { $0.jpeg.base64EncodedString() as Any } ?? NSNull()
        let body = try JSONSerialization.data(withJSONObject: ["image": image, "expectedOwner": owner])
        let response = try await api.request("/api/auth/avatar", method: "PATCH", json: body, for: owner)
        return try JSONDecoder().decode(AvatarResponse.self, from: response).photo()
    }
}

@MainActor
struct NativeAccountAvatarEditor: View {
    let api: NativeAPI
    let owner: String
    let name: String
    @Binding var current: NativeAccountAvatarPhoto?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var draft: NativeAccountAvatarPhoto?
    @State private var isPreparing = false
    @State private var isSaving = false
    @State private var note: String?
    @State private var hasError = false

    var body: some View {
        VStack(spacing: 12) {
            NativeAccountAvatar(name: name, photo: draft ?? current, size: 82)
            Text("头像").font(.headline).accessibilityAddTraits(.isHeader)
            if isPreparing || isSaving {
                ProgressView(isPreparing ? "正在准备照片…" : "正在保存…")
                    .font(.footnote)
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 9) { editorActions }
                VStack(spacing: 8) { editorActions }
            }
            if let note {
                Label(note, systemImage: hasError ? "exclamationmark.circle" : "checkmark.circle")
                    .font(.footnote).foregroundStyle(hasError ? .red : SpotterPalette.muted)
                    .accessibilityIdentifier("spotter-profile-avatar-status")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(15)
        .spotterCard()
        .task(id: selectedPhoto) { await prepareSelectedPhoto() }
    }

    @ViewBuilder private var editorActions: some View {
        let pickerTitle = current == nil ? "选择照片" : "更换照片"
        PhotosPicker(selection: $selectedPhoto, matching: .images) {
            Label(pickerTitle, systemImage: "photo")
        }
        .buttonStyle(SpotterNativeButtonStyle(primary: draft == nil))
        .disabled(isPreparing || isSaving)
        .accessibilityIdentifier("spotter-profile-avatar-picker")

        if let draft {
            Button("保存头像") { Task { await save(draft) } }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(isPreparing || isSaving)
                .accessibilityIdentifier("spotter-profile-avatar-save")
        } else if current != nil {
            Button("移除头像", role: .destructive) { Task { await save(nil) } }
                .buttonStyle(SpotterNativeButtonStyle(primary: false))
                .disabled(isPreparing || isSaving)
        }
    }

    private func prepareSelectedPhoto() async {
        guard let selectedPhoto else { return }
        isPreparing = true
        note = nil
        defer { isPreparing = false }
        do {
            guard let source = try await selectedPhoto.loadTransferable(type: Data.self) else {
                throw NativeAPIError.invalidResponse
            }
            let jpeg = await Task.detached(priority: .userInitiated) { NativeAccountAvatarPhoto.makeJPEG(from: source) }.value
            try Task.checkCancellation()
            guard let jpeg, let prepared = NativeAccountAvatarPhoto(jpeg: jpeg) else { throw NativeAPIError.invalidResponse }
            draft = prepared
        } catch is CancellationError {
        } catch {
            note = "无法读取这张照片，请选择其他照片。"
            hasError = true
        }
    }

    private func save(_ photo: NativeAccountAvatarPhoto?) async {
        guard !isSaving, !isPreparing else { return }
        isSaving = true
        note = nil
        defer { isSaving = false }
        do {
            current = try await NativeAccountAvatarAPI.save(api: api, owner: owner, photo: photo)
            draft = nil
            selectedPhoto = nil
            note = photo == nil ? "已移除头像。" : "已保存头像。"
            hasError = false
        } catch is CancellationError {
        } catch {
            note = error.localizedDescription
            hasError = true
        }
    }
}
