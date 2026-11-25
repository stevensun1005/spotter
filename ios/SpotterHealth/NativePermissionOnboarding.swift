import SwiftUI
import UserNotifications

enum NativeOptionalPermission: String, CaseIterable, Identifiable {
    case health, notifications

    var id: Self { self }

    var name: String {
        switch self {
        case .health: return "Apple 健康"
        case .notifications: return "iPhone 通知"
        }
    }

    var icon: String {
        switch self {
        case .health: return "heart.text.square"
        case .notifications: return "bell.badge"
        }
    }
}

struct NativePermissionReminderSchedule {
    static let interval: TimeInterval = 14 * 24 * 60 * 60

    static func isDue(lastPresented: Date?, now: Date) -> Bool {
        guard let lastPresented else { return true }
        return now.timeIntervalSince(lastPresented) >= interval
    }
}

@MainActor
final class NativePermissionOnboarding: ObservableObject {
    enum HealthStatus {
        case checking, unavailable, needsAccess, needsReview, readable, userConfirmed
    }

    @Published private(set) var health: HealthStatus = .checking
    @Published private(set) var notifications: UNAuthorizationStatus?
    @Published private(set) var operation: NativeOptionalPermission?
    @Published private(set) var error: String?

    private let healthPreferences: NativeHealthPreferences
    private let reader = HealthKitReader()
    private let center = UNUserNotificationCenter.current()
    private let defaults = UserDefaults.standard
    private let owner: String
    private var refreshRevision = 0

    init(origin: String, owner: String) {
        healthPreferences = NativeHealthPreferences(origin: origin, owner: owner)
        self.owner = owner
    }

    func refresh() async {
        refreshRevision &+= 1
        let revision = refreshRevision
        let systemSettings = await center.notificationSettings()
        guard revision == refreshRevision, !Task.isCancelled else { return }
        notifications = systemSettings.authorizationStatus
        let healthStatus = await checkHealth()
        guard revision == refreshRevision, !Task.isCancelled else { return }
        health = healthStatus
    }

    func requestHealth() async {
        guard operation == nil else { return }
        operation = .health
        error = nil
        defer { operation = nil }
        do {
            try await reader.authorizeNativeMetrics()
            try Task.checkCancellation()
            healthPreferences.hasRequestedNativeAccess = true
            await refresh()
        } catch is CancellationError {
        } catch {
            self.error = "暂时无法打开 Apple 健康授权，请稍后再试。"
        }
    }

    func confirmHealthInSettings() {
        guard health == .needsReview else { return }
        defaults.set(true, forKey: healthPreferences.key("permissionHelpConfirmed"))
        health = .userConfirmed
    }

    func requestNotifications(using socialNotifications: NativeSocialNotifications) async {
        guard operation == nil else { return }
        operation = .notifications
        error = nil
        defer { operation = nil }
        do {
            if socialNotifications.belongs(to: owner), socialNotifications.canUseSystemPush {
                await socialNotifications.enableSystemPush()
            } else {
                // This system permission also helps accounts using on-device reminders.
                _ = try await center.requestAuthorization(options: [.alert, .sound])
                await socialNotifications.refreshPermission()
            }
            await refresh()
        } catch {
            self.error = "暂时无法打开通知授权，请稍后再试。"
        }
    }

    var hasNotifications: Bool {
        guard let notifications else { return false }
        return [.authorized, .provisional, .ephemeral].contains(notifications)
    }

    func needsReminder(_ permission: NativeOptionalPermission) -> Bool {
        switch permission {
        case .health: return health == .needsAccess || health == .needsReview
        case .notifications: return notifications == .notDetermined || notifications == .denied
        }
    }

    func dueReminders(now: Date = .now) -> [NativeOptionalPermission] {
        NativeOptionalPermission.allCases.filter { permission in
            needsReminder(permission) && NativePermissionReminderSchedule.isDue(
                lastPresented: defaults.object(forKey: reminderKey(permission)) as? Date, now: now
            )
        }
    }

    func markPresented(_ permissions: [NativeOptionalPermission], now: Date = .now) {
        for permission in permissions {
            defaults.set(now, forKey: reminderKey(permission))
        }
    }

    func clear() {
        refreshRevision &+= 1
        defaults.removeObject(forKey: healthPreferences.key("permissionHelpConfirmed"))
        NativeOptionalPermission.allCases.forEach { defaults.removeObject(forKey: reminderKey($0)) }
    }

    private func reminderKey(_ permission: NativeOptionalPermission) -> String {
        healthPreferences.key("permissionHelpLastShown." + permission.rawValue)
    }

    private func checkHealth() async -> HealthStatus {
        guard HealthKitReader.nativeDataAvailable else { return .unavailable }
        guard healthPreferences.hasRequestedNativeAccess else { return .needsAccess }
        if (try? await reader.nativeAuthorizationNeedsPrompt()) == true {
            defaults.removeObject(forKey: healthPreferences.key("permissionHelpConfirmed"))
            return .needsAccess
        }
        // HealthKit deliberately hides the result of read authorization. A
        // visible sample or the person's own confirmation are separate states.
        if await reader.hasReadableNativeSample() { return .readable }
        return defaults.bool(forKey: healthPreferences.key("permissionHelpConfirmed")) ? .userConfirmed : .needsReview
    }
}

@MainActor
struct NativePermissionSetup: View {
    @ObservedObject var controller: NativePermissionOnboarding
    @EnvironmentObject private var socialNotifications: NativeSocialNotifications
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @Environment(\.spotterAccent) private var accent
    @State private var showHealthInstructions = false
    var reminders: [NativeOptionalPermission]? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(reminders ?? NativeOptionalPermission.allCases) { permission in
                permissionCard(permission)
            }
            if reminders == nil {
                Label("拍照记餐和语音输入会在使用时申请相机、麦克风或语音识别权限。", systemImage: "camera")
                    .font(.footnote)
                    .foregroundStyle(SpotterPalette.muted)
            }
            if let error = controller.error {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(SpotterPalette.muted)
            }
        }
        .onAppear { controller.markPresented(reminders ?? NativeOptionalPermission.allCases) }
        .task(id: scenePhase) {
            if scenePhase == .active, controller.operation == nil { await controller.refresh() }
        }
        .alert("核对 Apple 健康权限", isPresented: $showHealthInstructions) {
            if controller.health == .needsReview {
                Button("我已在「健康」中开启") { controller.confirmHealthInSettings() }
            }
            Button("关闭", role: .cancel) {}
        } message: {
            Text("在 iPhone「健康」App 中点头像，进入「App 与服务」→「训练搭子」，开启你愿意共享的项目。")
        }
    }

    private func permissionCard(_ permission: NativeOptionalPermission) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(permission.name, systemImage: permission.icon)
                .font(.headline)
                .foregroundStyle(SpotterPalette.ink)
            Text(permission == .health
                 ? "读取你选择的健康项目，在训练搭子查看步数、训练心率和身体变化。"
                 : "开启后可接收训练和休息提醒。已开通好友推送的账号也可接收好友打卡与搭子提醒。")
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
            switch permission {
            case .health: healthControl
            case .notifications: notificationControl
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .spotterCard()
    }

    @ViewBuilder private var healthControl: some View {
        switch controller.health {
        case .checking:
            ProgressView("检查 Apple 健康…").font(.footnote)
        case .unavailable:
            Text("这个设备暂时无法读取 Apple 健康。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        case .needsAccess:
            actionButton("授权 Apple 健康", permission: .health) {
                Task { await controller.requestHealth() }
            }
        case .needsReview:
            Text("暂未读到样本，可核对读取权限。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
            actionButton("核对 Apple 健康权限", permission: .health) { showHealthInstructions = true }
        case .readable, .userConfirmed:
            Label(controller.health == .readable ? "已能读取部分健康数据" : "你已确认开启健康权限", systemImage: "checkmark.circle.fill")
                .font(.footnote.weight(.semibold)).foregroundStyle(accent.tint)
            actionButton("管理 Apple 健康权限", permission: .health) { showHealthInstructions = true }
        }
    }

    @ViewBuilder private var notificationControl: some View {
        if controller.hasNotifications {
            Label("已允许系统通知", systemImage: "checkmark.circle.fill")
                .font(.footnote.weight(.semibold)).foregroundStyle(accent.tint)
        } else if controller.notifications == .denied {
            actionButton("打开 iPhone 通知设置", permission: .notifications) {
                if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
            }
        } else if controller.notifications == .notDetermined {
            actionButton("允许 iPhone 通知", permission: .notifications) {
                Task { await controller.requestNotifications(using: socialNotifications) }
            }
        } else {
            ProgressView("检查通知设置…").font(.footnote)
        }
    }

    private func actionButton(_ title: String, permission: NativeOptionalPermission,
                              perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            HStack(spacing: 8) {
                if controller.operation == permission { ProgressView() }
                Text(title)
            }
            .frame(maxWidth: .infinity, minHeight: 22)
        }
        .buttonStyle(SpotterNativeButtonStyle(primary: false))
        .disabled(controller.operation != nil)
        .accessibilityIdentifier("spotter-permission-" + permission.rawValue)
    }
}

@MainActor
struct NativePermissionReminder: ViewModifier {
    @ObservedObject var controller: NativePermissionOnboarding
    @Environment(\.scenePhase) private var scenePhase
    @State private var reminder: Reminder?
    let canPresent: Bool

    private struct Reminder: Identifiable {
        let permissions: [NativeOptionalPermission]
        var id: [NativeOptionalPermission] { permissions }
    }

    func body(content: Content) -> some View {
        content
            .task(id: scenePhase == .active && canPresent) {
                guard scenePhase == .active, canPresent, reminder == nil else { return }
                await controller.refresh()
                guard !Task.isCancelled else { return }
                let due = controller.dueReminders()
                if !due.isEmpty { reminder = Reminder(permissions: due) }
            }
            .sheet(item: $reminder) { reminder in
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("选用适合你的权限，让记录更顺手。")
                                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                            NativePermissionSetup(controller: controller, reminders: reminder.permissions)
                        }
                        .frame(maxWidth: 480, alignment: .leading)
                        .padding(20)
                        .frame(maxWidth: .infinity)
                    }
                    .background(SpotterPalette.background.ignoresSafeArea())
                    .navigationTitle("继续设置")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("稍后再说") { self.reminder = nil }
                        }
                    }
                }
                .presentationDragIndicator(.visible)
            }
    }
}
