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

    static func bytes(_ image: String) -> Data? {
        guard image.utf8.count <= ((byteLimit + 2) / 3) * 4 else { return nil }
        return Data(base64Encoded: image)
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
    struct Appearance {
        var foreground: Color? = nil
        var background: Color? = nil
        var cornerRadius: CGFloat? = nil
        var fallbackIcon: String? = nil
        var outlined = true
    }

    @Environment(\.spotterAccent) private var accent
    let name: String
    let photo: NativeAccountAvatarPhoto?
    let size: CGFloat
    var appearance = Appearance()

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: appearance.cornerRadius ?? size / 2)
        Group {
            if let photo {
                Image(uiImage: photo.image).resizable().scaledToFill()
            } else {
                Group {
                    if let symbol = appearance.fallbackIcon { Image(systemName: symbol) }
                    else { Text(name.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init)?.uppercased() ?? "我") }
                }
                    .font(.system(size: size * 0.40, weight: .bold, design: .rounded))
                    .foregroundStyle(appearance.foreground ?? accent.tint)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(appearance.background ?? accent.selection)
            }
        }
        .frame(width: size, height: size)
        .clipShape(shape)
        .overlay {
            if appearance.outlined { shape.strokeBorder(SpotterPalette.line, lineWidth: 1).allowsHitTesting(false) }
        }
        .accessibilityHidden(true)
    }
}

@MainActor
struct NativePersonAvatar: View {
    @EnvironmentObject private var avatars: NativeAvatarStore
    let id: String?
    let name: String
    let size: CGFloat
    var appearance = NativeAccountAvatar.Appearance()

    var body: some View {
        let subject = id
        NativeAccountAvatar(name: name, photo: subject.flatMap { avatars.photo(for: $0) }, size: size, appearance: appearance)
            .onAppear { if let subject { avatars.watch(subject) } }
            .onDisappear { if let subject { avatars.unwatch(subject) } }
            .id(subject)
    }
}

@MainActor
enum NativeAccountAvatarAPI {
    private struct AvatarResponse: Decodable {
        let image: String?

        func photo() throws -> NativeAccountAvatarPhoto? {
            guard let image else { return nil }
            guard let data = NativeAccountAvatarPhoto.bytes(image), let photo = NativeAccountAvatarPhoto(jpeg: data) else {
                throw NativeAPIError.invalidResponse
            }
            return photo
        }
    }

    private struct AvatarBatch: Decodable { let avatars: [String: String?] }

    static func get(api: NativeAPI, owner: String, ids: [String]) async throws -> [String: String?] {
        var components = URLComponents()
        components.path = "/api/auth/avatars"
        components.queryItems = ids.map { URLQueryItem(name: "ids", value: $0) }
        // URLSearchParams treats a literal plus as a space.
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let path = components.string else { throw NativeAPIError.invalidRequest }
        let response = try await api.request(path, method: "GET", json: nil, for: owner)
        return try JSONDecoder().decode(AvatarBatch.self, from: response).avatars
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
final class NativeAvatarStore: ObservableObject {
    static let refreshInterval: TimeInterval = 60

    let owner: String
    private let api: NativeAPI
    @Published private var photos: [String: NativeAccountAvatarPhoto] = [:]
    private var observers: [String: Int] = [:]
    private var lastAttempt: [String: Date] = [:]
    private var pending: Task<Void, Never>?
    private var foreground = false
    private var generation = 0
    private var ownRevision = 0

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
    }

    deinit { pending?.cancel() }

    func photo(for id: String) -> NativeAccountAvatarPhoto? { photos[id] }

    func watch(_ id: String) {
        guard !id.isEmpty, id.utf8.count <= 250 else { return }
        observers[id, default: 0] += 1
        schedule()
    }

    func unwatch(_ id: String) {
        guard let count = observers[id] else { return }
        if count > 1 { observers[id] = count - 1 }
        else { observers.removeValue(forKey: id) }
    }

    func setForeground(_ active: Bool) {
        guard foreground != active else { return }
        foreground = active
        if active { refreshVisible() }
        else { cancelPending() }
    }

    func refreshVisible() {
        guard foreground, pending == nil else { return }
        lastAttempt.removeAll(keepingCapacity: true)
        schedule()
    }

    func confirmOwnPhoto(_ photo: NativeAccountAvatarPhoto?, for id: String) {
        guard id == owner else { return }
        ownRevision &+= 1
        lastAttempt[id] = .now
        if photos[id]?.jpeg != photo?.jpeg { photos[id] = photo }
    }

    func forgetPeer(_ id: String) {
        guard id != owner else { return }
        cancelPending()
        if photos[id] != nil { photos.removeValue(forKey: id) }
        refreshVisible()
    }

    func clear() {
        ownRevision &+= 1
        setForeground(false)
        photos.removeAll()
        lastAttempt.removeAll()
    }

    private func cancelPending() {
        generation &+= 1
        pending?.cancel()
        pending = nil
    }

    private func dueIDs() -> [String] {
        let now = Date.now
        return observers.keys.filter { id in
            now.timeIntervalSince(lastAttempt[id] ?? .distantPast) >= Self.refreshInterval
        }.sorted()
    }

    private func schedule() {
        guard foreground, pending == nil, !dueIDs().isEmpty else { return }
        let generation = self.generation
        pending = Task { [weak self] in
            // Collect all the identity chips that appeared in a single view update.
            do { try await Task.sleep(for: .milliseconds(90)) } catch { return }
            await self?.loadVisible(generation: generation)
        }
    }

    private func loadVisible(generation: Int) async {
        guard generation == self.generation, foreground else { return }
        defer {
            if generation == self.generation {
                pending = nil
                schedule()
            }
        }
        let ids = dueIDs()
        // A fully percent-encoded 250-byte ID can consume 750 bytes of the request path.
        let batchSize = 10
        for start in stride(from: 0, to: ids.count, by: batchSize) {
            guard !Task.isCancelled, generation == self.generation else { return }
            let batch = ids[start ..< min(start + batchSize, ids.count)].filter { observers[$0] != nil }
            guard !batch.isEmpty else { continue }
            let ownRevision = self.ownRevision
            for id in batch { lastAttempt[id] = .now }
            do {
                let response = try await NativeAccountAvatarAPI.get(api: api, owner: owner, ids: batch)
                guard !Task.isCancelled, generation == self.generation else { return }
                var updated = photos
                var changed = false
                for id in batch where id != owner || ownRevision == self.ownRevision {
                    let bytes = (response[id] ?? nil).flatMap(NativeAccountAvatarPhoto.bytes)
                    guard bytes != updated[id]?.jpeg else { continue }
                    // Both a removed image and a no-longer-authorized identity should return to initials.
                    updated[id] = bytes.flatMap { NativeAccountAvatarPhoto(jpeg: $0) }
                    changed = true
                }
                if changed { photos = updated }
            } catch let error as NativeAPIError where error.statusCode == 404 && batch.contains(owner) {
                // Older servers still expose the signed-in account's individual photo.
                do {
                    let photo = try await NativeAccountAvatarAPI.get(api: api, owner: owner)
                    guard !Task.isCancelled, generation == self.generation, ownRevision == self.ownRevision else { continue }
                    if photos[owner]?.jpeg != photo?.jpeg { photos[owner] = photo }
                } catch {}
            } catch {}
        }
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
