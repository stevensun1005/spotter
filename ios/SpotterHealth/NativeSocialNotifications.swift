import SwiftUI
import UIKit
import UserNotifications

struct NativeSocialNotification: Decodable, Identifiable, Equatable {
    enum Kind: String, Decodable {
        case buddyReminder = "buddy-reminder"
        case friendWorkout = "friend-workout"
    }

    let id: String
    let kind: Kind
    let actorName: String
    let createdAt: String
    var read: Bool
    let actorId: String?
    let workoutId: String?
    let date: String?

    func title(displayName: String) -> String {
        switch kind {
        case .buddyReminder: return "\(displayName) 提醒你训练"
        case .friendWorkout: return "\(displayName) 完成了训练"
        }
    }

    var symbol: String { kind == .buddyReminder ? "bell.badge" : "dumbbell" }

    var timeLabel: String {
        let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(createdAt)
        let fallback = try? Date.ISO8601FormatStyle().parse(createdAt)
        return (date ?? fallback)?.formatted(date: .abbreviated, time: .shortened) ?? ""
    }
}

struct NativeSocialNotificationPreferences: Encodable, Decodable, Equatable {
    var buddyReminders: Bool
    var friendWorkouts: Bool
}

@MainActor
final class NativeSocialNotifications: ObservableObject {
    static let shared = NativeSocialNotifications()

    @Published private(set) var items: [NativeSocialNotification] = []
    @Published private(set) var preferences: NativeSocialNotificationPreferences?
    @Published private(set) var pushAvailable = false
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var deviceRegistered = false
    @Published private(set) var registrationIssue: String?
    @Published private(set) var loading = false
    @Published private(set) var saving = false
    @Published private(set) var error: String?
    @Published private(set) var banner: NativeSocialNotification?
    @Published private(set) var requestedItem: NativeSocialNotification?

    private struct Snapshot: Decodable {
        let items: [NativeSocialNotification]
        let preferences: NativeSocialNotificationPreferences
        let pushAvailable: Bool
    }

    private struct Scope: Equatable {
        let origin: String
        let owner: String
    }

    private let center = UNUserNotificationCenter.current()
    private let installationId: String
    private var api: NativeAPI?
    private var scope: Scope?
    private var generation = 0
    private var refreshSequence = 0
    private var acceptedSequence = 0
    private var refreshing = 0
    private var fetched = false
    private var token: String?
    private var registeredToken: String?
    private var registeringToken: String?
    private var pendingTap: String?
    private var bannerExpiry: Task<Void, Never>?

    private init() {
        let key = "spotter.native.notifications.installation"
        if let value = UserDefaults.standard.string(forKey: key), UUID(uuidString: value) != nil {
            installationId = value
        } else {
            let value = UUID().uuidString.lowercased()
            UserDefaults.standard.set(value, forKey: key)
            installationId = value
        }
    }

    private var environment: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SpotterAPNsEnvironment") as? String,
              ["production", "development"].contains(value) else { return nil }
        return value
    }

    var canUseSystemPush: Bool { pushAvailable && environment != nil }
    var unreadCount: Int { items.filter { !$0.read }.count }

    func belongs(to owner: String) -> Bool { scope?.owner == owner }

    func useAccount(_ api: NativeAPI, owner: String?) {
        let next = owner.map { Scope(origin: api.origin, owner: $0) }
        guard next != scope else { return }
        if scope != nil {
            pendingTap = nil
            clearDeliveredSocialNotifications()
            if environment != nil {
                UIApplication.shared.unregisterForRemoteNotifications()
                token = nil
            }
        }
        generation += 1
        refreshing = 0
        scope = next
        self.api = owner == nil ? nil : api
        items = []
        preferences = nil
        pushAvailable = false
        loading = false
        saving = false
        error = nil
        requestedItem = nil
        registeredToken = nil
        registeringToken = nil
        deviceRegistered = false
        registrationIssue = nil
        fetched = false
        bannerExpiry?.cancel()
        banner = nil
    }

    func runWhileActive() async {
        guard scope != nil else { return }
        let revision = generation
        await refreshPermission()
        while generation == revision && !Task.isCancelled {
            await refresh(announce: true)
            guard generation == revision && !Task.isCancelled else { return }
            if registeredToken == nil, canUseSystemPush, hasPermission {
                let cachedToken = token
                if let cachedToken { await registerDevice(cachedToken) }
                else { UIApplication.shared.registerForRemoteNotifications() }
            }
            do { try await Task.sleep(for: .seconds(35)) }
            catch { return }
        }
    }

    func refresh(announce: Bool = false) async {
        guard let api, let scope else { return }
        let revision = generation
        refreshSequence += 1
        let sequence = refreshSequence
        refreshing += 1
        loading = true
        defer {
            if generation == revision {
                refreshing -= 1
                loading = refreshing > 0
            }
        }

        do {
            let data = try await api.request("/api/notifications", method: "GET", json: nil, for: scope.owner)
            let snapshot = try JSONDecoder().decode(Snapshot.self, from: data)
            guard generation == revision, !Task.isCancelled, sequence >= acceptedSequence else { return }
            let known = Set(items.map(\.id))
            if announce, fetched, registeredToken == nil,
               let item = snapshot.items.first(where: { !$0.read && !known.contains($0.id) }) {
                showBanner(item)
            }
            acceptedSequence = sequence
            fetched = true
            items = snapshot.items
            preferences = snapshot.preferences
            pushAvailable = snapshot.pushAvailable
            error = nil
            if let pendingTap {
                self.pendingTap = nil
                if let item = items.first(where: { $0.id == pendingTap }) { await open(item) }
            }
        } catch where generation == revision && !Task.isCancelled && sequence >= acceptedSequence {
            acceptedSequence = sequence
            self.error = error.localizedDescription
        } catch { }
    }

    func updatePreferences(_ value: NativeSocialNotificationPreferences) async {
        guard !saving, let scope else { return }
        let revision = generation
        saving = true
        defer { if generation == revision { saving = false } }
        do {
            try await post("preferences", ["buddyReminders": value.buddyReminders, "friendWorkouts": value.friendWorkouts], owner: scope.owner)
            guard generation == revision else { return }
            await refresh()
        } catch where generation == revision && !Task.isCancelled {
            self.error = error.localizedDescription
        } catch { }
    }

    func sendReminder(to buddyId: String, owner: String) async throws {
        try await post("nudge", ["buddyId": buddyId], owner: owner)
    }

    func markAllRead() async {
        guard let scope else { return }
        await markRead(id: nil, owner: scope.owner)
    }

    func open(_ item: NativeSocialNotification) async {
        guard let scope, let verified = items.first(where: { $0.id == item.id }) else { return }
        requestedItem = verified
        if banner?.id == item.id { dismissBanner() }
        if !verified.read { await markRead(id: verified.id, owner: scope.owner) }
    }

    func read(_ item: NativeSocialNotification) async {
        guard let scope, items.contains(where: { $0.id == item.id && !$0.read }) else { return }
        await markRead(id: item.id, owner: scope.owner)
    }

    func clearRequest(_ id: String) {
        if requestedItem?.id == id { requestedItem = nil }
    }

    private func markRead(id: String?, owner: String) async {
        let revision = generation
        do {
            let fields = id.map { ["id": $0] } ?? [:]
            try await post("read", fields, owner: owner)
            guard generation == revision else { return }
            await refresh()
        } catch where generation == revision && !Task.isCancelled {
            self.error = error.localizedDescription
        } catch { }
    }

    private func post(_ action: String, _ fields: [String: Any], owner: String) async throws {
        guard let api, scope?.owner == owner else { throw NativeAPIError.accountChanged }
        let revision = generation
        var body = fields
        body["action"] = action
        body["expectedOwner"] = owner
        let json = try JSONSerialization.data(withJSONObject: body)
        _ = try await api.request("/api/notifications", method: "POST", json: json, for: owner)
        guard generation == revision else { throw NativeAPIError.accountChanged }
    }

    func refreshPermission() async {
        let revision = generation
        let status = await center.notificationSettings().authorizationStatus
        guard generation == revision else { return }
        authorizationStatus = status
        if !hasPermission, registeredToken != nil, let scope {
            registeredToken = nil
            deviceRegistered = false
            try? await post("remove-device", ["installationId": installationId], owner: scope.owner)
        }
    }

    func enableSystemPush() async {
        guard canUseSystemPush, scope != nil else { return }
        let revision = generation
        do { _ = try await center.requestAuthorization(options: [.alert, .sound]) }
        catch { if generation == revision { self.error = error.localizedDescription } }
        await refreshPermission()
        guard generation == revision, hasPermission else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    private var hasPermission: Bool {
        [.authorized, .provisional, .ephemeral].contains(authorizationStatus)
    }

    func receivedToken(_ data: Data) {
        let value = data.map { String(format: "%02x", $0) }.joined()
        guard !value.isEmpty else { return }
        token = value
        Task { await registerDevice(value) }
    }

    func registrationFailed() {
        guard scope != nil, canUseSystemPush else { return }
        registrationIssue = "系统推送暂未注册成功，请稍后重试。"
    }

    private func registerDevice(_ value: String) async {
        guard pushAvailable, hasPermission, let scope, let environment,
              registeredToken != value, registeringToken != value else { return }
        let revision = generation
        registeringToken = value
        defer { if generation == revision, registeringToken == value { registeringToken = nil } }
        do {
            try await post("device", ["token": value, "installationId": installationId, "environment": environment], owner: scope.owner)
            if generation == revision, token == value {
                registeredToken = value
                deviceRegistered = true
                registrationIssue = nil
            }
        } catch where generation == revision && !Task.isCancelled {
            registrationFailed()
        } catch { }
    }

    func tappedPush(id: String) async {
        pendingTap = id
        if scope != nil { await refresh() }
    }

    func shouldPresentPush(id: String) async -> Bool {
        guard scope != nil else { return false }
        let revision = generation
        await refresh()
        return generation == revision && items.contains { $0.id == id && !$0.read }
    }

    func dismissBanner() {
        bannerExpiry?.cancel()
        banner = nil
    }

    private func showBanner(_ item: NativeSocialNotification) {
        dismissBanner()
        banner = item
        bannerExpiry = Task {
            do { try await Task.sleep(for: .seconds(7)) }
            catch { return }
            if banner?.id == item.id { banner = nil }
        }
    }

    private func clearDeliveredSocialNotifications() {
        Task {
            let delivered = await center.deliveredNotifications()
            let social = delivered.compactMap { notification in
                notification.request.content.userInfo["notificationId"] is String ? notification.request.identifier : nil
            }
            center.removeDeliveredNotifications(withIdentifiers: social)
        }
    }
}

@MainActor
final class SpotterNotificationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NativeSocialNotifications.shared.receivedToken(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NativeSocialNotifications.shared.registrationFailed()
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        guard let id = notification.request.content.userInfo["notificationId"] as? String,
              await NativeSocialNotifications.shared.shouldPresentPush(id: id) else { return [] }
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier,
              let id = response.notification.request.content.userInfo["notificationId"] as? String else { return }
        await NativeSocialNotifications.shared.tappedPush(id: id)
    }
}

@MainActor
struct NativeNotificationInbox: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var notifications: NativeSocialNotifications
    @EnvironmentObject private var remarks: NativeSocialRemarks
    let owner: String
    var onOpen: (NativeSocialNotification) -> Void = { _ in }

    private var items: [NativeSocialNotification] { notifications.belongs(to: owner) ? notifications.items : [] }
    private var unreadCount: Int { notifications.belongs(to: owner) ? notifications.unreadCount : 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 9) {
                    if notifications.belongs(to: owner), let error = notifications.error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if items.isEmpty {
                        if notifications.loading { ProgressView("正在读取通知…") }
                        else {
                            Label("还没有训练通知", systemImage: "bell.slash")
                                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                                .frame(maxWidth: .infinity, minHeight: 84)
                        }
                    }
                    ForEach(items) { item in
                        Button { onOpen(item); dismiss() } label: {
                            HStack(spacing: 11) {
                                Image(systemName: item.symbol).font(.headline)
                                    .frame(width: 36, height: 36)
                                    .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 9))
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.title(displayName: remarks.name(for: item.actorId, fallback: item.actorName)))
                                        .font(.subheadline.weight(item.read ? .medium : .semibold))
                                    if !item.timeLabel.isEmpty {
                                        Text(item.timeLabel).font(.caption).foregroundStyle(SpotterPalette.muted)
                                    }
                                }
                                Spacer(minLength: 4)
                                if !item.read {
                                    Circle().fill(SpotterPalette.accent).frame(width: 7, height: 7).accessibilityHidden(true)
                                }
                            }
                            .padding(12).frame(minHeight: 58)
                            .spotterCard(radius: 12).contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityValue(item.read ? "已读" : "未读")
                    }
                }.padding(16)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .foregroundStyle(SpotterPalette.ink)
            .navigationTitle("通知")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("完成") { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    Button("全部已读") { Task { await notifications.markAllRead() } }
                        .disabled(unreadCount == 0)
                }
            }
            .task { await notifications.refresh() }
            .refreshable { await notifications.refresh() }
        }
    }
}

@MainActor
struct NativeSocialNotificationBanner: View {
    @EnvironmentObject private var remarks: NativeSocialRemarks
    let item: NativeSocialNotification
    let open: () -> Void
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 1) {
            Button(action: open) {
                Label(item.title(displayName: remarks.name(for: item.actorId, fallback: item.actorName)), systemImage: item.symbol)
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            Button(action: dismiss) {
                Image(systemName: "xmark").font(.caption.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("关闭通知")
        }
        .padding(.leading, 12).padding(.vertical, 2)
        .foregroundStyle(SpotterPalette.ink)
        .spotterCard(radius: 13)
        .shadow(color: .black.opacity(0.12), radius: 9, y: 3)
    }
}
