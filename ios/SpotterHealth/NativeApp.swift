import Combine
import CryptoKit
import SwiftUI
import UIKit
import UserNotifications
import WidgetKit

enum SpotterTheme: String, CaseIterable, Identifiable {
    case system, light, dark

    static let storageKey = "spotter.native.appearance.theme"
    var id: Self { self }
    var title: String {
        switch self {
        case .system: return "跟随系统"
        case .light: return "浅色"
        case .dark: return "深色"
        }
    }
    var interfaceStyle: UIUserInterfaceStyle {
        switch self {
        case .system: return .unspecified
        case .light: return .light
        case .dark: return .dark
        }
    }
}

private struct SpotterWindowAppearance: UIViewRepresentable {
    let theme: SpotterTheme

    func makeUIView(context: Context) -> Observer {
        let view = Observer(frame: .zero)
        view.isUserInteractionEnabled = false
        view.accessibilityElementsHidden = true
        return view
    }

    func updateUIView(_ view: Observer, context: Context) {
        view.style = theme.interfaceStyle
        view.applyStyle()
    }

    final class Observer: UIView {
        var style = UIUserInterfaceStyle.unspecified

        override func didMoveToWindow() {
            super.didMoveToWindow()
            applyStyle()
        }

        func applyStyle() {
            DispatchQueue.main.async { [weak self] in
                guard let self, let window, window.overrideUserInterfaceStyle != style else { return }
                window.overrideUserInterfaceStyle = style
            }
        }
    }
}

enum SpotterAccent: String, CaseIterable, Identifiable {
    case lime, mint, blue, violet

    static let storageKey = "spotter.native.appearance.accent"
    var id: Self { self }
    var title: String {
        switch self {
        case .lime: return "青柠"
        case .mint: return "薄荷"
        case .blue: return "天空蓝"
        case .violet: return "丁香紫"
        }
    }
    var fill: Color {
        switch self {
        case .lime: return SpotterPalette.color(0xd0f67b)
        case .mint: return SpotterPalette.color(0xaaf0c1)
        case .blue: return SpotterPalette.color(0xa9ddff)
        case .violet: return SpotterPalette.color(0xdac3ff)
        }
    }
    var tint: Color {
        switch self {
        case .lime: return SpotterPalette.accent
        case .mint: return SpotterPalette.adaptive(0x236547, 0xaaf0c1)
        case .blue: return SpotterPalette.adaptive(0x225982, 0xa9ddff)
        case .violet: return SpotterPalette.adaptive(0x65428f, 0xdac3ff)
        }
    }
    var selection: Color {
        switch self {
        case .lime: return SpotterPalette.wash
        case .mint: return SpotterPalette.adaptive(0xddf4e6, 0x254237)
        case .blue: return SpotterPalette.adaptive(0xe1f1fc, 0x253d4d)
        case .violet: return SpotterPalette.adaptive(0xefe5fc, 0x3e3151)
        }
    }
}

private struct SpotterAccentKey: EnvironmentKey {
    static let defaultValue: SpotterAccent = .lime
}

enum SpotterPalette {
    static let accent = adaptive(0x466036, 0xb6dc86)
    static let background = adaptive(0xf2f4ee, 0x141a17)
    static let card = adaptive(0xffffff, 0x1f2823)
    static let deep = color(0x18251d)
    static let ink = adaptive(0x1b2820, 0xe7eee9)
    static let muted = adaptive(0x59675e, 0xa6b4a9)
    static let line = adaptive(0xe0e7dd, 0x39463d)
    static let wash = adaptive(0xeaf3df, 0x26332a)
    static let lilac = adaptive(0xeeeafb, 0x373049)

    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255,
              blue: Double(hex & 255) / 255)
    }

    static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255,
                           blue: CGFloat(hex & 255) / 255, alpha: 1)
        })
    }
}

struct SpotterGlassGroup<Content: View>: View {
    let spacing: CGFloat
    let content: Content

    init(spacing: CGFloat = 8, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
    }
}

extension View {
    func spotterGlass(cornerRadius: CGFloat = 16, tint: Color? = nil, interactive: Bool = true) -> some View {
        spotterGlass(in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous), tint: tint, interactive: interactive)
    }

    @ViewBuilder
    func spotterGlass<Shape: InsettableShape>(in shape: Shape, tint: Color? = nil, interactive: Bool = true) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.tint(tint).interactive(interactive), in: shape)
        } else {
            background {
                shape.fill(.ultraThinMaterial)
                    .overlay { shape.fill(tint ?? SpotterPalette.card.opacity(0.84)) }
            }
                .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        }
    }
}

private struct SpotterReduceMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var spotterAccent: SpotterAccent {
        get { self[SpotterAccentKey.self] }
        set { self[SpotterAccentKey.self] = newValue }
    }

    var spotterReduceMotion: Bool {
        get { self[SpotterReduceMotionKey.self] }
        set { self[SpotterReduceMotionKey.self] = newValue }
    }

    var spotterInteractionMotion: Animation? {
        accessibilityReduceMotion || spotterReduceMotion ? nil : .spring(response: 0.27, dampingFraction: 0.86)
    }
}

private struct SpotterPressFeedback: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    let pressed: Bool

    @ViewBuilder func body(content: Content) -> some View {
        if systemReduceMotion || reduceMotion {
            content.opacity(pressed ? 0.86 : 1)
        } else {
            content
                .scaleEffect(pressed ? 0.98 : 1)
                .animation(pressed ? nil : .easeOut(duration: 0.11), value: pressed)
        }
    }
}

extension View {
    func spotterPressFeedback(_ pressed: Bool) -> some View {
        modifier(SpotterPressFeedback(pressed: pressed))
    }
}

struct SpotterPressButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    @Environment(\.spotterInteractionMotion) private var motion
    var usesNativeGlass = false

    @ViewBuilder func makeBody(configuration: Configuration) -> some View {
        let label = configuration.label.opacity(enabled ? 1 : 0.54)
        if #available(iOS 26.0, *), usesNativeGlass, motion != nil {
            label
        } else {
            label.spotterPressFeedback(configuration.isPressed)
        }
    }
}

extension ButtonStyle where Self == SpotterPressButtonStyle {
    static var spotterPress: Self { .init() }
    static var spotterGlassPress: Self { .init(usesNativeGlass: true) }
}

extension NativeAPI {
    func spotterRead<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        let data = try await request(path)
        return try JSONDecoder().decode(type, from: data)
    }

    @discardableResult
    func spotterSend(_ path: String, body: [String: Any]) async throws -> Data {
        try await request(path, method: "POST", json: JSONSerialization.data(withJSONObject: body))
    }
}

func spotterDay(_ date: Date = .now) -> String {
    NativeWorkoutSession.day(date)
}

@MainActor
struct NativeSpotterApp: View {
    @StateObject private var account = NativeAccount()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(SpotterTheme.storageKey) private var theme: SpotterTheme = .light
    @AppStorage(SpotterAccent.storageKey) private var accent: SpotterAccent = .lime
    @State private var sawSignIn = false
    @State private var friendInvite: String?
    @State private var widgetDestination: NativeWidgetDestination?

    var body: some View {
        Group {
            if account.isRestoring {
                ProgressView("正在登录训练搭子")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SpotterPalette.background)
            } else if let profile = account.profile {
                NativeSpotterTabs(account: account, owner: profile.id, offerWelcome: sawSignIn,
                                  inboundInvite: $friendInvite, widgetDestination: $widgetDestination)
                    .id(profile.id)
            } else {
                NativeSignIn(account: account).onAppear { sawSignIn = true }
            }
        }
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .buttonStyle(.spotterPress)
        .environment(\.spotterAccent, accent)
        .environmentObject(NativeSocialNotifications.shared)
        .background { SpotterWindowAppearance(theme: theme).accessibilityHidden(true) }
        .task {
            NativeWidgetMealAction.api = account.api
            await account.restore()
        }
        .task(id: notificationTaskKey) {
            let notifications = NativeSocialNotifications.shared
            notifications.useAccount(account.api, owner: account.profile?.id)
            if scenePhase == .active { await notifications.runWhileActive() }
        }
        .onChange(of: account.isRestoring) { restoring in
            if !restoring {
                NativeTrainingWidgetBridge.useAccount(account.profile?.id, origin: account.api.origin)
                if account.profile == nil { clearTrainingLiveActivity() }
            }
        }
        .onChange(of: account.profile?.id) { owner in
            NativeTrainingWidgetBridge.useAccount(owner, origin: account.api.origin)
            NativeCoachView.useConversationAccount(api: account.api, owner: owner)
            if owner == nil {
                clearTrainingLiveActivity()
                if #available(iOS 17.0, *) { NativeWatchHeartRate.shared.updateWorkout(context: nil, snapshot: nil) }
                Task {
                    await NativeTrainingNotifications.shared.scheduleRest(nil)
                    await NativeTrainingNotifications.shared.clear()
                }
            }
        }
        .onOpenURL(perform: openExternalURL)
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { acceptInviteURL(url) }
        }
    }

    private var notificationTaskKey: String {
        (account.profile?.id ?? "") + (scenePhase == .active ? ":active" : ":inactive")
    }

    private func openExternalURL(_ url: URL) {
        if let destination = NativeWidgetDestination(url) {
            widgetDestination = destination
        } else {
            acceptInviteURL(url)
        }
    }

    private func clearTrainingLiveActivity() {
        if #available(iOS 16.1, *) {
            NativeTrainingLiveActivity.shared.sync(workoutKey: nil, state: nil, foreground: false)
        }
    }

    private func acceptInviteURL(_ url: URL) {
        let parts = url.pathComponents.filter { $0 != "/" }
        let code: String?
        if url.scheme == "https", url.host == URL(string: AppConfiguration.defaultOrigin)?.host,
           parts.count == 2, parts.first == "invite" {
            code = parts.last
        } else if url.scheme == "spotter", url.host == "friend-invite", parts.count == 1 {
            code = parts.first
        } else {
            code = nil
        }
        if let code, code.range(of: "^[a-fA-F0-9]{32}$", options: .regularExpression) != nil {
            friendInvite = code.lowercased()
        }
    }
}

private enum NativeWidgetDestination: Equatable {
    case training, history, buddy, nutrition, frequentMeals, weekly, year
    case water(day: String)
    case cheer(partner: String)

    init?(_ url: URL) {
        guard url.scheme == "spotter", url.host == "widget", url.user == nil, url.password == nil,
              url.port == nil, url.fragment == nil,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        let query = parts.queryItems ?? []
        if url.path == "/water", query.count == 2,
           query.first(where: { $0.name == "ml" })?.value == "250",
           let day = query.first(where: { $0.name == "day" })?.value, day == spotterDay() {
            self = .water(day: day)
            return
        }
        if url.path == "/buddy-cheer", query.count == 1, query.first?.name == "buddy",
           let partner = query.first?.value, (1...120).contains(partner.utf16.count),
           partner == partner.trimmingCharacters(in: .whitespacesAndNewlines),
           partner.rangeOfCharacter(from: .controlCharacters) == nil {
            self = .cheer(partner: partner)
            return
        }
        guard query.isEmpty else { return nil }
        switch url.path {
        case "/training": self = .training
        case "/history": self = .history
        case "/buddy": self = .buddy
        case "/nutrition": self = .nutrition
        case "/frequent-meals": self = .frequentMeals
        case "/weekly": self = .weekly
        case "/year": self = .year
        default: return nil
        }
    }
}

@MainActor
private enum NativeTrainingWidgetBridge {
    private static let scopeKey = "spotter.native.widget.owner-scope"

    static func useAccount(_ owner: String?, origin: String) {
        let scope = owner.map { owner in
            SHA256.hash(data: Data((origin + "\n" + owner).utf8))
                .map { String(format: "%02x", $0) }.joined()
        }
        let defaults = UserDefaults.standard
        let previous = defaults.string(forKey: scopeKey)
        guard scope == nil || previous != scope else { return }
        let removed = SpotterWidgetStore.shared.remove()
        defaults.set(scope, forKey: scopeKey)
        if removed || previous != nil { reload() }
    }

    static func publish(_ store: NativeWorkoutStore, now: Date = .now) {
        var calendar = Calendar(identifier: .gregorian)
        let timeZone = TimeZone.current
        calendar.timeZone = timeZone
        let day = SpotterWidgetSnapshot.dayKey(for: now, timeZone: timeZone)
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        guard let weekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start else { return }

        let firstDay = SpotterWidgetSnapshot.dayKey(for: weekStart, timeZone: timeZone)
        let weekDays = SpotterWidgetSnapshot.weekDays(startingAt: firstDay)
        let result = SpotterWidgetStore.shared.read(at: now)
        let previous = result?.day == day ? result : nil
        let knownOverview = store.widgetOverviewDay == day
        let logs = store.logs.filter { $0.owner == store.owner && $0.day <= day }
        let checkedInDates = Set(logs.map(\.day))
        let nutrition = store.widgetNutritionDay == day ? store.widgetNutrition : previous?.nutrition
        let partner = knownOverview
            ? buddy(store, day: day, weekDays: weekDays, checkedInDates: checkedInDates)
            : previous?.buddy
        let weekly = knownOverview
            ? trainingWeek(logs, weekStart: weekStart, calendar: calendar)
            : previous?.weekly
        let year = store.widgetYear(endingAt: now) ?? previous?.year
        guard knownOverview || previous != nil || nutrition != nil else { return }

        let snapshot = SpotterWidgetSnapshot(
            updatedAt: now, day: day,
            todayCompleted: min(10_000, logs.filter { $0.day == day }.count),
            weekStart: firstDay, weekCheckins: weekDays.map(checkedInDates.contains),
            nextWorkout: nil, activeWorkout: nil,
            buddy: partner, nutrition: nutrition, weekly: weekly, year: year
        )
        if SpotterWidgetStore.shared.write(snapshot) { reload() }
    }

    private static func buddy(_ store: NativeWorkoutStore, day: String, weekDays: [String],
                              checkedInDates: Set<String>) -> SpotterWidgetSnapshot.Buddy? {
        let id = store.partnerID
        guard !id.isEmpty, weekDays.count == 7, !store.room["connectionId"].string.isEmpty else { return nil }
        let shared = store.room["partnerTrainingShared"] != .bool(false)
        let cutoff = store.room["partnerCheckinsFrom"].string
        let partnerLogs = store.partnerLogs
        let sharedDates = Set(store.room["partnerCheckins"].array.filter { $0["count"].number > 0 }
            .map { $0["date"].string }).union(partnerLogs.map(\.day))
        let sharedPlans = store.plans.filter { $0.owner == id && $0.data["shared"].bool }
        let myPlanDates = Set(store.plans.filter {
            $0.owner == store.owner && !store.hasCompletedPlan(id: $0.id)
        }.map(\.day))
        let partnerPlanDates = Set(sharedPlans.map(\.day))

        let ownDays = weekDays.map { key -> SpotterWidgetSnapshot.DayState in
            if checkedInDates.contains(key) { return .completed }
            if myPlanDates.contains(key) { return .planned }
            if let date = nativePlanDate(key), store.isPlanRestDay(date) { return .rest }
            return .none
        }
        let buddyDays = weekDays.map { key -> SpotterWidgetSnapshot.DayState in
            guard shared, cutoff.isEmpty || (key >= cutoff && key <= day) else { return .unavailable }
            if sharedDates.contains(key) { return .completed }
            return partnerPlanDates.contains(key) ? .planned : .none
        }
        let todayIsShared = shared && (cutoff.isEmpty || day >= cutoff)
        let title = todayIsShared ? (partnerLogs.first { $0.day == day }?.displayTitle ??
            sharedPlans.first { $0.day == day }?.displayTitle) : nil
        let cheered = store.entries.contains { $0.kind == "cheer" && $0.owner == store.owner && $0.day == day }
        return .init(id: id, name: store.partnerName, ownDays: ownDays, buddyDays: buddyDays, todayTitle: title, cheered: cheered)
    }

    private static func trainingWeek(_ logs: [NativeWorkoutEntry], weekStart: Date,
                                     calendar: Calendar) -> SpotterWidgetSnapshot.Weekly? {
        guard let first = calendar.date(byAdding: .day, value: -7, to: weekStart),
              let previous = calendar.date(byAdding: .day, value: -14, to: weekStart) else { return nil }
        let firstDay = SpotterWidgetSnapshot.dayKey(for: first, timeZone: calendar.timeZone)
        let previousDay = SpotterWidgetSnapshot.dayKey(for: previous, timeZone: calendar.timeZone)
        let endDay = SpotterWidgetSnapshot.dayKey(for: weekStart, timeZone: calendar.timeZone)
        let weekLogs = logs.filter { $0.day >= firstDay && $0.day < endDay }
        let priorDays = Set(logs.filter { $0.day >= previousDay && $0.day < firstDay }.map(\.day))
        let minutesByDay = NativeWorkoutStore.widgetMinutes(for: weekLogs)
        let minutes = SpotterWidgetSnapshot.weekDays(startingAt: firstDay).map { minutesByDay[$0] ?? 0 }
        return .init(weekStart: firstDay, dailyMinutes: minutes, trainingDays: minutesByDay.count,
                     totalMinutes: minutes.reduce(0, +), completedSets: weekLogs.reduce(0) { $0 + ($1.session?.completedSets ?? 0) },
                     previousTrainingDays: priorDays.count)
    }

    private static func reload() {
        for kind in SpotterWidgetStore.widgetKinds {
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
    }
}

@MainActor
private struct NativeSignIn: View {
    @ObservedObject var account: NativeAccount
    @Environment(\.spotterAccent) private var accent
    @State private var email = ""
    @State private var accessCode = ""
    @State private var allowAI = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("登录训练搭子")
                    .font(.largeTitle.weight(.bold))
                    .accessibilityAddTraits(.isHeader)
                VStack(spacing: 8) {
                    providerButton("使用 Apple 登录", symbol: "apple.logo", enabled: account.providerStatus.apple.enabled) { await account.signInApple(allowAI: allowAI) }
                    providerButton("使用 Google 登录", enabled: account.providerStatus.google.enabled) { await account.signInGoogle(allowAI: allowAI) }
                }
                Text("已有访问码？先用原账号登录，再到设置绑定登录方式。")
                    .font(.subheadline)
                    .foregroundStyle(SpotterPalette.muted)
                VStack(alignment: .leading, spacing: 10) {
                    field("邮箱") {
                        TextField("", text: $email)
                            .accessibilityLabel("邮箱")
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    field("访问码") {
                        SecureField("", text: $accessCode)
                            .accessibilityLabel("访问码")
                            .textContentType(.password)
                    }
                    if let error = account.errorMessage {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                    Button {
                        Task { await account.signIn(email: email, accessCode: accessCode, allowAI: allowAI) }
                    } label: {
                        Text("登录")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(SpotterPalette.deep)
                            .padding(.horizontal, 15)
                            .frame(minHeight: 42)
                            .background(accent.fill, in: RoundedRectangle(cornerRadius: 9))
                    }
                    .buttonStyle(.spotterPress)
                    .disabled(account.isBusy || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || accessCode.isEmpty)
                }
                NativeCoachSharingChoice(allowed: $allowAI, origin: account.api.origin)
                    .disabled(account.isBusy)
                NativeSupportLinks()
                if account.isBusy { ProgressView().accessibilityLabel("正在登录") }
            }
            .frame(maxWidth: 580, alignment: .leading)
            .padding(spotterCardPadding)
            .spotterCard()
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .frame(maxWidth: .infinity)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
    }

    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
            content()
                .padding(.horizontal, 10)
                .frame(minHeight: 42)
                .spotterCard(radius: 9)
        }
    }

    private func providerButton(_ title: String, symbol: String? = nil, enabled: Bool, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            HStack(spacing: 8) {
                if let symbol { Image(systemName: symbol).accessibilityHidden(true) }
                Text(title).font(.subheadline.weight(.semibold))
                Spacer()
                if !enabled {
                    Text("待配置")
                        .font(.footnote)
                        .foregroundStyle(SpotterPalette.muted)
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .spotterCard(radius: 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .disabled(!enabled || account.isBusy)
        .opacity(enabled ? 1 : 0.56)
    }
}

let spotterCardPadding: CGFloat = 18

extension View {
    func spotterCard(radius: CGFloat = 19) -> some View {
        background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: radius))
            .overlay {
                RoundedRectangle(cornerRadius: radius)
                    .strokeBorder(SpotterPalette.line, lineWidth: 1)
                    .allowsHitTesting(false)
            }
    }
}

struct NativeSupportLinks: View {
    var body: some View {
        HStack(spacing: 6) {
            if let privacy = URL(string: AppConfiguration.defaultOrigin + "/privacy"),
               let support = URL(string: AppConfiguration.defaultOrigin + "/support") {
                Link("隐私说明", destination: privacy)
                Text("·").foregroundStyle(SpotterPalette.muted)
                Link("应用支持", destination: support)
            }
        }
        .font(.subheadline)
    }
}

private enum NativeSpotterSection: String {
    case today = "今日"
    case training = "训练"
    case stats = "统计"
    case friends = "好友"

    var icon: String {
        switch self {
        case .today: return "DockToday"
        case .training: return "DockTraining"
        case .stats: return "DockStats"
        case .friends: return "DockFriends"
        }
    }
}

@MainActor
private struct NativeSpotterTabs: View {
    private static let compactCoachDetent = PresentationDetent.fraction(0.44)

    @ObservedObject var account: NativeAccount
    @StateObject private var workouts: NativeWorkoutStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.spotterAccent) private var accent
    @EnvironmentObject private var socialNotifications: NativeSocialNotifications
    @State private var selected: NativeSpotterSection = .today
    @State private var dockPosition = NativeDockPosition()
    @State private var showCoach = false
    @State private var coachDetent = Self.compactCoachDetent
    @State private var showSettings = false
    @State private var showPlanImport = false
    @State private var showPrograms = false
    @State private var showNutrition = false
    @State private var showRest = false
    @State private var showBody = false
    @State private var showTrainingLaunch = false
    @State private var showActiveWorkout = false
    @State private var nextLaunch: TrainingLaunch?
    @State private var finishedWorkout: NativeWorkoutEntry?
    @State private var workoutReceipt: NativeWorkoutEntry?
    @State private var buddySearchRequest = 0
    @State private var showWelcome = false
    @State private var replayWelcomeAfterSettings = false
    @State private var welcomeCoachGoal: String?
    @State private var inboundInviteConfirmation: String?
    @State private var inviteBusy = false
    @State private var inviteMessage: String?
    @State private var friendsRevision = 0
    @State private var widgetStatsRequest: NativeWidgetStatsRequest?
    @State private var widgetNutritionEntry: NativeNutritionWidgetEntry?
    @State private var widgetCheerPartner: String?
    @State private var widgetCheerMessage: String?
    @State private var showNotificationInbox = false
    @StateObject private var trainingPreferences: NativeAccountPreferences
    @AppStorage private var reminderEnabled: Bool
    @AppStorage private var reminderMinute: Int
    @AppStorage(NativePreferenceKey.friendsTab) private var showsFriends = true
    @AppStorage(NativePreferenceKey.nutritionModule) private var showsNutrition = true
    @AppStorage(NativePreferenceKey.reduceMotion) private var reduceMotion = false
    @AppStorage(NativePreferenceKey.largerText) private var largerText = false
    @AppStorage(NativeTrainingNotifications.restPreference) private var backgroundRestAlerts = false
    @AppStorage(NativeTrainingNotifications.liveActivityPreference) private var showsTrainingLiveActivity = true
    @AppStorage(NativePreferenceKey.restSound) private var restSound = false
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.dynamicTypeSize) private var systemTextSize
    let owner: String
    let offerWelcome: Bool
    @Binding var inboundInvite: String?
    @Binding var widgetDestination: NativeWidgetDestination?

    private enum TrainingLaunch {
        case workout(String)
        case plan(NativeWorkoutEntry)
        case rest
        case body
    }

    private var allowsMotion: Bool { !reduceMotion && !systemReduceMotion }

    init(account: NativeAccount, owner: String, offerWelcome: Bool, inboundInvite: Binding<String?>,
         widgetDestination: Binding<NativeWidgetDestination?>) {
        self.account = account
        self.owner = owner
        self.offerWelcome = offerWelcome
        _inboundInvite = inboundInvite
        _widgetDestination = widgetDestination
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
        _trainingPreferences = StateObject(wrappedValue: NativeAccountPreferences(api: account.api, owner: owner))
        _reminderEnabled = AppStorage(wrappedValue: false, NativePreferenceKey.reminderKey(owner, field: "enabled"))
        _reminderMinute = AppStorage(wrappedValue: 18 * 60, NativePreferenceKey.reminderKey(owner, field: "minute"))
    }

    var body: some View {
        navigationTabs
        .background(SpotterPalette.background.ignoresSafeArea())
        .overlay(alignment: .top) { notificationBanner }
        .animation(allowsMotion ? .easeInOut(duration: 0.23) : nil, value: socialNotifications.banner?.id)
        .task { await refreshHome() }
        .onAppear {
            if offerWelcome, !UserDefaults.standard.bool(forKey: welcomeKey) {
                showWelcome = true
            } else {
                stageInvite()
                stageWidgetDestination()
                stageSocialNotification()
            }
        }
        .task(id: workouts.widgetRevision) {
            do {
                try await Task.sleep(for: .milliseconds(250))
                refreshWidget()
            } catch {}
        }
        .onChange(of: widgetDestination) { _ in stageWidgetDestination() }
        .onChange(of: isAvailableForWidget) { available in
            if available { stageWidgetDestination(); stageSocialNotification() }
        }
        .onChange(of: socialNotifications.requestedItem) { _ in stageSocialNotification() }
        .onChange(of: inboundInvite) { _ in stageInvite() }
        .onChange(of: showsFriends) { visible in if !visible && selected == .friends { selected = .today } }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                Task {
                    async let overview: Void = refreshHome()
                    await workouts.syncLocalChanges()
                    await overview
                }
            }
            if phase == .background { refreshWidget() }
            refreshLiveActivity()
        }
        .onChange(of: workouts.active) { _ in
            updateWatchWorkout()
            refreshLiveActivity()
        }
        .task { updateWatchWorkout() }
        .onReceive(liveHeartRateUpdates) { _ in refreshLiveActivity() }
        .onChange(of: showsTrainingLiveActivity) { _ in refreshLiveActivity() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            if scenePhase == .active { Task { await refreshHome() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in
            Task { await workouts.refreshWidgetNutrition(force: true) }
        }
        .onChange(of: workouts.pendingCheckins.map(\.id)) { _ in
            Task { await attachHealthHeartRate() }
        }
        .task(id: reminderSchedule) {
            guard scenePhase == .active else { return }
            await NativeTrainingNotifications.shared.schedule(reminderSchedule)
        }
        .task(id: restAlert) {
            await NativeTrainingNotifications.shared.scheduleRest(restAlert)
        }
        .sheet(isPresented: $showCoach, onDismiss: {
            stageInvite()
            Task { await workouts.load() }
        }) {
            NativeCoachView(api: account.api, owner: owner, compact: coachDetent != .large,
                            onExpand: { coachDetent = .large },
                            onStartWorkout: { selected = .training; showCoach = false })
                .presentationDetents([Self.compactCoachDetent, .large], selection: $coachDetent)
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showSettings, onDismiss: {
            if replayWelcomeAfterSettings {
                replayWelcomeAfterSettings = false
                showWelcome = true
            }
            Task { await refreshHome() }
        }) {
            NavigationStack {
                NativeSettings(account: account, owner: owner, onDeleted: {
                                   workouts.clearLocalData()
                                   NativeTrainingWidgetBridge.useAccount(nil, origin: account.api.origin)
                                   refreshLiveActivity()
                                   NativeCoachView.removeSavedConversation(api: account.api, owner: owner)
                                   NativeNutritionDetail.clearFavoriteMeals(api: account.api, owner: owner)
                                   trainingPreferences.clear()
                               },
                               refreshPlans: { await refreshHome() }, openTraining: { selected = .training; showSettings = false },
                               workoutStore: workouts, trainingPreferences: trainingPreferences, restartWelcome: {
                                   replayWelcomeAfterSettings = true
                                   showSettings = false
                               })
            }
        }
        .sheet(isPresented: $showPlanImport) {
            NavigationStack {
                NativePlanImportView(api: account.api, owner: owner, didImport: { await workouts.load() })
            }.presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showPrograms) {
            NavigationStack {
                NativeProgramsView(api: account.api, owner: owner, didSchedule: { await workouts.load() }, store: workouts)
            }.presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showNotificationInbox) {
            NativeNotificationInbox(owner: owner) { item in Task { await socialNotifications.read(item) } }
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showNutrition, onDismiss: { widgetNutritionEntry = nil }) {
            NativeNutritionDetail(api: account.api, owner: owner, logs: workouts.logs,
                                  initialWidgetEntry: widgetNutritionEntry)
        }
        .sheet(isPresented: $showRest, onDismiss: { Task { await workouts.load() } }) {
            NativeRestSchedule(api: account.api, owner: owner)
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showBody) {
            NavigationStack {
                NativeBodyData(api: account.api, owner: owner, showsClose: true)
            }
        }
        .sheet(isPresented: $showTrainingLaunch, onDismiss: finishTrainingLaunch) {
            NativeTrainingLaunch(start: { queueTrainingLaunch(.workout($0)) },
                                 rest: { queueTrainingLaunch(.rest) }, bodyAction: { queueTrainingLaunch(.body) },
                                 scheduled: workouts.todayPendingPlans, startPlan: { queueTrainingLaunch(.plan($0)) })
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showActiveWorkout, onDismiss: {
            showWorkoutReceipt()
            stageWidgetDestination()
            stageSocialNotification()
        }) {
            NativeActiveWorkoutView(store: workouts) { finishedWorkout = $0 }
        }
        .sheet(item: $workoutReceipt) { entry in
            NavigationStack { NativeWorkoutDetailView(store: workouts, entry: entry, showsClose: true) }
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showWelcome, onDismiss: {
            welcomeCoachGoal = nil
            stageInvite()
            stageWidgetDestination()
            Task { await workouts.load() }
        }) {
            if let goal = welcomeCoachGoal {
                NativeCoachView(api: account.api, owner: owner, compact: false,
                                onStartWorkout: { selected = .training; showWelcome = false },
                                initialTrainingGoal: goal)
            } else {
                NativeWelcomeView { goal in
                    UserDefaults.standard.set(true, forKey: welcomeKey)
                    if let goal { welcomeCoachGoal = goal }
                    else { showWelcome = false }
                }
                .interactiveDismissDisabled()
            }
        }
        .alert("接受好友邀请？", isPresented: Binding(
            get: { inboundInviteConfirmation != nil },
            set: { if !$0 { inboundInviteConfirmation = nil } }
        ), presenting: inboundInviteConfirmation) { code in
            Button("接受邀请") { Task { await redeemInvite(code) } }
            Button("取消", role: .cancel) {}
        } message: { _ in Text("接受后会按你的好友分享设置显示训练动态。") }
        .alert("好友邀请", isPresented: Binding(
            get: { inviteMessage != nil },
            set: { if !$0 { inviteMessage = nil } }
        )) { Button("好", role: .cancel) {} } message: { Text(inviteMessage ?? "") }
        .confirmationDialog("给搭子打气？", isPresented: Binding(
            get: { widgetCheerPartner != nil },
            set: { if !$0 { widgetCheerPartner = nil } }
        ), titleVisibility: .visible, presenting: widgetCheerPartner) { partner in
            Button("打气") {
                Task {
                    do {
                        try await workouts.cheer(expectedPartner: partner)
                        widgetCheerMessage = "已给今天的训练搭子打气。"
                    } catch { widgetCheerMessage = error.localizedDescription }
                }
            }
        }
        .alert("搭子督练", isPresented: Binding(
            get: { widgetCheerMessage != nil },
            set: { if !$0 { widgetCheerMessage = nil } }
        )) { Button("好", role: .cancel) {} } message: { Text(widgetCheerMessage ?? "") }
        .dynamicTypeSize(largerText ? max(systemTextSize, .xxLarge) : systemTextSize)
        .environment(\.spotterAccountPreferences, trainingPreferences)
        .environment(\.spotterReduceMotion, reduceMotion)
        .transaction {
            if reduceMotion || systemReduceMotion {
                $0.animation = nil
                $0.disablesAnimations = true
            }
        }
    }

    @ViewBuilder private var notificationBanner: some View {
        if socialNotifications.belongs(to: owner), let item = socialNotifications.banner {
            NativeSocialNotificationBanner(item: item, open: { Task { await socialNotifications.open(item) } },
                                           dismiss: socialNotifications.dismissBanner)
                .padding(.horizontal, 12).padding(.top, 5)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private func stageSocialNotification() {
        guard isAvailableForWidget, !showActiveWorkout, socialNotifications.belongs(to: owner),
              let item = socialNotifications.requestedItem else { return }
        if showsFriends { selected = .friends }
        else {
            socialNotifications.clearRequest(item.id)
            showNotificationInbox = true
        }
    }

    private var today: some View {
        var view = NativeWorkoutView(store: workouts, openWorkout: openActiveWorkout)
        view.openSettings = { showSettings = true }
        view.openAllPlans = { selected = .training }
        view.openStats = { selected = .stats }
        view.openCoach = { openCoach() }
        if showsFriends { view.openFriends = openFriends }
        if showsNutrition {
            view.openNutrition = { showNutrition = true }
            view.homeNutrition = AnyView(NativeHomeNutrition(api: account.api, owner: owner, logs: workouts.logs) { showNutrition = true })
        }
        return view
    }

    private func openFriends() {
        if workouts.room["partner"]["id"].string.isEmpty { buddySearchRequest += 1 }
        selected = .friends
    }

    private var reminderSchedule: NativeTrainingNotifications.Schedule {
        let days = reminderEnabled
            ? Set(workouts.plans.lazy.filter { $0.owner == owner && !workouts.hasCompletedPlan(id: $0.id) }.map(\.day))
            : []
        return .init(enabled: reminderEnabled, time: reminderMinute, days: days, active: scenePhase == .active)
    }

    private var restAlert: NativeTrainingNotifications.RestAlert? {
        guard backgroundRestAlerts, let deadline = workouts.active?.session?.runningRestDeadlineMilliseconds else { return nil }
        return .init(deadlineMilliseconds: deadline, playsSound: restSound)
    }

    private var welcomeKey: String { "spotter.native.welcome.v1." + owner }

    private func refreshHome() async {
        trainingPreferences.activate()
        async let preferences: Void = trainingPreferences.sync()
        async let nutrition: Void = workouts.refreshWidgetNutrition()
        await workouts.load()
        refreshWidget()
        async let history: Void = workouts.refreshWidgetHistory()
        await attachHealthHeartRate()
        await preferences
        await nutrition
        await history
        refreshWidget()
    }

    private func refreshWidget() {
        guard account.profile?.id == owner else { return }
        NativeTrainingWidgetBridge.useAccount(owner, origin: account.api.origin)
        NativeTrainingWidgetBridge.publish(workouts)
    }

    private func refreshLiveActivity() {
        guard #available(iOS 16.1, *), account.profile?.id == owner else { return }
        let manager = NativeTrainingLiveActivity.shared
        guard showsTrainingLiveActivity, let entry = workouts.active, entry.owner == owner,
              let session = entry.session else {
            manager.sync(workoutKey: nil, state: nil, foreground: false)
            return
        }

        let identity = [account.api.origin, owner, entry.id].joined(separator: "\n")
        let key = SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
        let next = session.nextSet(after: workouts.undoableSet)
        let name = next.flatMap { position -> String? in
            guard session.plan.exercises.indices.contains(position.move) else { return nil }
            let name = session.plan.exercises[position.move]["name"].string.trimmingCharacters(in: .whitespacesAndNewlines)
            return name.isEmpty ? "动作" : String(name.prefix(45))
        }
        let now = Date.now
        let deadline = session.runningRestDeadlineMilliseconds.flatMap { milliseconds -> Date? in
            let date = Date(timeIntervalSince1970: Double(milliseconds) / 1000)
            return date > now ? date : nil
        }
        let restSeconds = session.restStatus()?.remainingSeconds ?? 0
        let counterStart: Date? = if session.isRunning {
            Date(timeIntervalSince1970: (session.raw["clock"]["runningSince"].number - session.raw["clock"]["elapsed"].number) / 1_000)
        } else { nil }
        let heartReading: NativeWatchHeartRateReading? = if #available(iOS 17.0, *) {
            NativeWatchHeartRate.shared.latest(for: .init(owner: owner, workoutID: entry.id, isRunning: session.isRunning))
                .flatMap { $0.isFresh(at: now) ? $0 : nil }
        } else { nil }
        let state = SpotterTrainingActivityAttributes.ContentState(
            completedSets: session.completedSets,
            totalSets: session.rows.reduce(0) { $0 + $1.count },
            nextMovement: name, nextSet: next.map { $0.row + 1 }, isRunning: session.isRunning,
            restDeadline: deadline, pausedRestSeconds: !session.isRunning && restSeconds > 0 ? restSeconds : nil,
            elapsedStartedAt: counterStart, elapsedSeconds: session.isRunning ? nil : session.elapsedMilliseconds() / 1_000,
            heartBPM: heartReading?.bpm, heartExpiresAt: heartReading?.measuredAt.addingTimeInterval(30)
        )
        manager.sync(workoutKey: key, state: state, foreground: scenePhase == .active)
    }

    private var liveHeartRateUpdates: AnyPublisher<Void, Never> {
        guard #available(iOS 17.0, *) else { return Empty().eraseToAnyPublisher() }
        let readings = NativeWatchHeartRate.shared.$reading.removeDuplicates()
        return readings.filter { $0 == nil }.map { _ in () }
            .merge(with: readings.filter { $0 != nil }
                .throttle(for: .seconds(5), scheduler: RunLoop.main, latest: true).map { _ in () })
            .receive(on: RunLoop.main)
            .eraseToAnyPublisher()
    }

    private func updateWatchWorkout() {
        guard #available(iOS 17.0, *) else { return }
        let watch = NativeWatchHeartRate.shared
        guard let entry = workouts.active, entry.owner == owner, let session = entry.session else {
            watch.updateWorkout(context: nil, snapshot: nil)
            return
        }
        let workoutID = entry.id
        watch.updateWorkout(context: .init(owner: owner, workoutID: workoutID, isRunning: session.isRunning),
                            snapshot: .init(session: session, previous: workouts.undoableSet)) { [weak workouts] command in
            workouts?.applyWatchAction(command, workoutID: workoutID)
        }
    }

    private var isAvailableForWidget: Bool {
        !showWelcome && !showCoach && !showSettings && !showPlanImport && !showPrograms &&
        !showNutrition && !showRest && !showBody && !showTrainingLaunch &&
        workoutReceipt == nil && inboundInviteConfirmation == nil &&
        widgetCheerPartner == nil && widgetCheerMessage == nil
    }

    private func stageWidgetDestination() {
        guard isAvailableForWidget, let destination = widgetDestination else { return }
        if showActiveWorkout, destination != .training {
            showActiveWorkout = false
            return
        }
        widgetDestination = nil
        switch destination {
        case .training:
            selected = .today
            if workouts.active != nil { openActiveWorkout() }
        case .history:
            widgetStatsRequest = .history
            selected = .stats
        case .weekly, .year:
            widgetStatsRequest = destination == .weekly ? .weekly : .year
            selected = .stats
        case .buddy, .cheer:
            selected = showsFriends ? .friends : .today
            if case .cheer(let partner) = destination { widgetCheerPartner = partner }
        case .nutrition, .frequentMeals, .water:
            switch destination {
            case .frequentMeals: widgetNutritionEntry = .frequentMeals
            case .water(let day) where day == spotterDay(): widgetNutritionEntry = .water
            default: widgetNutritionEntry = nil
            }
            showNutrition = true
        }
    }

    private func attachHealthHeartRate() async {
        let waiting = Set(workouts.pendingCheckins.map(\.id))
        let uploaded = workouts.logs.filter { !waiting.contains($0.id) }
        await NativeAutomaticHeartSync.shared.run(api: account.api, owner: owner, entries: uploaded)
    }

    private func stageInvite() {
        guard let code = inboundInvite, !showWelcome, !showCoach, !inviteBusy else { return }
        inboundInvite = nil
        inboundInviteConfirmation = code
    }

    private func redeemInvite(_ code: String) async {
        guard !inviteBusy else { return }
        inviteBusy = true
        defer { inviteBusy = false }
        do {
            try await account.api.spotterSend("/api/friends", body: ["action": "join", "code": code, "expectedOwner": owner])
            showsFriends = true
            selected = .friends
            friendsRevision += 1
            inviteMessage = "已添加好友。"
        } catch {
            inviteMessage = error.localizedDescription
        }
    }

    private func openCoach() {
        guard !showCoach else { return }
        coachDetent = Self.compactCoachDetent
        showCoach = true
    }

    private func openTrainingLaunch() {
        let plans = workouts.todayPendingPlans
        if workouts.active != nil { openActiveWorkout() }
        else if plans.count == 1, let entry = plans.first {
            workouts.startScheduled(entry)
            openActiveWorkout()
        } else { showTrainingLaunch = true }
    }

    private func queueTrainingLaunch(_ action: TrainingLaunch) {
        nextLaunch = action
        showTrainingLaunch = false
    }

    private func finishTrainingLaunch() {
        let action = nextLaunch
        nextLaunch = nil
        switch action {
        case .workout(let kind):
            workouts.startFreeWorkout(kind: kind)
            openActiveWorkout()
        case .plan(let entry):
            workouts.startScheduled(entry)
            openActiveWorkout()
        case .rest: showRest = true
        case .body: showBody = true
        case nil: break
        }
    }

    private func openActiveWorkout() {
        guard workouts.active != nil else { return }
        showActiveWorkout = true
    }

    private func showWorkoutReceipt() {
        workoutReceipt = finishedWorkout
        finishedWorkout = nil
    }

    private func openOwnFeedWorkout(_ id: String, day: String? = nil) {
        if let entry = workouts.logs.first(where: { $0.id == id }) {
            workoutReceipt = entry
        } else {
            Task {
                if let day { await workouts.loadHistory(from: day, through: day) }
                else { await workouts.load() }
                workoutReceipt = workouts.logs.first { $0.id == id }
            }
        }
    }

    private var contentSections: [NativeSpotterSection] {
        showsFriends ? [.today, .training, .stats, .friends] : [.today, .training, .stats]
    }

    private var navigationTabs: some View {
        TabView(selection: $selected) {
            ForEach(contentSections, id: \.self) { section in tabScene(section).tag(section) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if let active = workouts.active, let session = active.session, !showActiveWorkout {
                    NativeWorkoutStatusStrip(title: active.displayTitle, session: session, open: openActiveWorkout)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                dock
            }
            .animation(allowsMotion ? .spring(response: 0.34, dampingFraction: 0.85) : nil,
                       value: workouts.active != nil && !showActiveWorkout)
            .background {
                GeometryReader { geometry in
                    let top = geometry.frame(in: .global).minY
                    Color.clear
                        .onAppear { dockPosition.update(top) }
                        .onChange(of: top) { dockPosition.update($0) }
                        .accessibilityHidden(true)
                }
            }
        }
    }

    private func tabScene(_ section: NativeSpotterSection) -> some View {
        NavigationStack {
            sectionContent(section)
                .toolbar(.hidden, for: .navigationBar)
                .toolbar(.hidden, for: .tabBar)
        }
    }

    @ViewBuilder private func sectionContent(_ section: NativeSpotterSection) -> some View {
        switch section {
        case .today: today
        case .training:
            NativeWorkoutView(store: workouts, openWorkout: openActiveWorkout, showsAllPlans: true, openSettings: { showSettings = true }, openCoach: { openCoach() },
                              openImport: { showPlanImport = true }, openPrograms: { showPrograms = true })
        case .stats:
            NativeStatsTab(store: workouts, api: account.api, owner: owner, dockPosition: dockPosition,
                           widgetStatsRequest: $widgetStatsRequest)
        case .friends:
            NativeFriends(api: account.api, owner: owner, buddySearchRequest: buddySearchRequest,
                          notificationRequest: selected == .friends && isAvailableForWidget && socialNotifications.belongs(to: owner)
                              ? socialNotifications.requestedItem : nil,
                          openOwnLog: { openOwnFeedWorkout($0) },
                          openOwnLogDay: { id, day in openOwnFeedWorkout(id, day: day) },
                          refreshPlans: { await workouts.load() })
                .id(friendsRevision)
        }
    }

    private var dock: some View {
        HStack(spacing: 8) {
            NativeDockTabRail(sections: contentSections, selection: $selected, play: dockPlay)

            Button { openCoach() } label: {
                Image("DockCoach").renderingMode(.template).resizable()
                    .frame(width: 23, height: 23)
                    .foregroundStyle(accent.tint)
                    .frame(width: 51, height: 55)
                    .contentShape(RoundedRectangle(cornerRadius: 23))
                    .spotterGlass(cornerRadius: 23, tint: accent.selection.opacity(0.85), interactive: allowsMotion)
            }
            .buttonStyle(.spotterGlassPress)
            .accessibilityLabel("打开 AI 教练")
        }
        .spotterGlassCluster(spacing: 4)
        .frame(maxWidth: 530)
        .padding(.horizontal, 10)
        .padding(.top, 4)
        .padding(.bottom, 4)
    }

    private var dockPlay: some View {
        Button(action: openTrainingLaunch) {
            Image(systemName: "play.fill")
                .font(.system(size: 19, weight: .semibold))
                .offset(x: 1)
                .foregroundStyle(accent.tint)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Capsule())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(workouts.active == nil ? "开始训练" : "继续训练")
        .accessibilityIdentifier("spotter-dock-play")
        .disabled(workouts.active == nil && workouts.isBusy)
    }
}

@MainActor
private final class NativeDockPosition: ObservableObject {
    @Published private(set) var top: CGFloat?

    func update(_ position: CGFloat) {
        if top != position { top = position }
    }
}

@MainActor
private struct NativeStatsTab: View {
    let store: NativeWorkoutStore
    let api: NativeAPI
    let owner: String
    @ObservedObject var dockPosition: NativeDockPosition
    let widgetStatsRequest: Binding<NativeWidgetStatsRequest?>

    var body: some View {
        NativeSpotterStats(store: store, api: api, owner: owner, dockTop: dockPosition.top,
                           widgetStatsRequest: widgetStatsRequest)
    }
}

private struct NativeDockTabRail<Play: View>: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @GestureState private var dragDistance: CGFloat? = nil
    let sections: [NativeSpotterSection]
    @Binding var selection: NativeSpotterSection
    let play: Play

    private let spacing: CGFloat = 2
    private let playWidth: CGFloat = 53

    var body: some View {
        GeometryReader { geometry in
            let width = max(0, (geometry.size.width - playWidth - CGFloat(sections.count) * spacing) / CGFloat(sections.count))
            let offsets = sections.indices.map { index in
                CGFloat(index) * (width + spacing) + (index >= (sections.firstIndex(of: .stats) ?? 2) ? playWidth + spacing : 0)
            }
            let base = offsets[sections.firstIndex(of: selection) ?? 0]
            let position = min(offsets.last ?? base, max(offsets.first ?? base, base + (dragDistance ?? 0)))
            let touchTab = nearest(to: position, offsets: offsets)
            ZStack(alignment: .leading) {
                Capsule().fill(accent.selection.opacity(0.2))
                    .spotterGlass(in: Capsule(), tint: accent.fill.opacity(0.36), interactive: false)
                    .overlay { Capsule().strokeBorder(.white.opacity(0.62)) }
                    .frame(width: width)
                    .scaleEffect(dragDistance != nil && motion != nil ? 1.06 : 1)
                    .offset(x: position)
                    .animation(dragDistance == nil ? motion : nil, value: selection)
                    .animation(dragDistance == nil ? motion : nil, value: dragDistance == nil)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                HStack(spacing: spacing) {
                    ForEach(sections, id: \.self) { section in
                        if section == .stats { play.frame(width: playWidth) }
                        tab(section, highlighted: touchTab == section).frame(width: width)
                    }
                }
            }
            .contentShape(Rectangle())
            .highPriorityGesture(
                DragGesture(minimumDistance: 12)
                    .updating($dragDistance) { value, distance, transaction in
                        guard abs(value.translation.width) > abs(value.translation.height) else { return }
                        transaction.animation = nil
                        distance = value.translation.width
                    }
                    .onEnded { value in
                        guard abs(value.translation.width) > abs(value.translation.height) else { return }
                        let momentum = value.predictedEndTranslation.width - value.translation.width
                        let destination = base + value.translation.width + min(18, max(-18, momentum))
                        selection = nearest(to: destination, offsets: offsets)
                    }
            )
        }
        .padding(4)
        .frame(height: 59)
        .spotterGlass(in: Capsule(), interactive: false)
        .overlay { Capsule().strokeBorder(.white.opacity(0.36)).allowsHitTesting(false) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("spotter-dock-tabs")
    }

    private func nearest(to position: CGFloat, offsets: [CGFloat]) -> NativeSpotterSection {
        guard let index = offsets.indices.min(by: { abs(offsets[$0] - position) < abs(offsets[$1] - position) }) else { return selection }
        return sections[index]
    }

    private func tab(_ section: NativeSpotterSection, highlighted: Bool) -> some View {
        Button { selection = section } label: {
            VStack(spacing: 3) {
                Image(section.icon).renderingMode(.template).resizable().frame(width: 21, height: 21)
                Text(section.rawValue).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .foregroundStyle(highlighted ? accent.tint : SpotterPalette.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Capsule())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(section.rawValue)
        .accessibilityAddTraits(selection == section ? .isSelected : [])
    }
}

private struct NativeWorkoutStatusStrip: View {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    let title: String
    let session: NativeWorkoutSession
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 10) {
                Image(systemName: session.isRunning ? "figure.strengthtraining.traditional" : "pause.fill")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(accent.tint)
                    .frame(width: 31, height: 31)
                    .background(accent.selection, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.semibold)).lineLimit(1)
                    Text(session.isRunning ? "\(session.completedSets) 组已完成" : "计时已暂停")
                        .font(.caption).foregroundStyle(SpotterPalette.muted).lineLimit(1)
                }
                Spacer(minLength: 4)
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    timer(at: Int(context.date.timeIntervalSince1970 * 1_000))
                }
                Image(systemName: "chevron.up")
                    .font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                    .accessibilityHidden(true)
            }
            .foregroundStyle(SpotterPalette.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(minHeight: 46)
            .contentShape(.rect)
            .spotterGlass(cornerRadius: 20, tint: accent.fill.opacity(0.20), interactive: motion != nil)
        }
        .buttonStyle(.spotterGlassPress)
        .accessibilityIdentifier("spotter-active-workout-strip")
        .accessibilityHint("返回进行中的训练")
        .frame(maxWidth: 530)
        .padding(.horizontal, 10)
        .padding(.top, 4)
    }

    private func timer(at now: Int) -> some View {
        let rest = session.restStatus(at: now)
        let remaining = rest?.remainingSeconds ?? 0
        let elapsed = session.elapsedMilliseconds(at: now)
        return Group {
            if rest != nil && remaining == 0 {
                Text("休息结束").font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
            } else {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(rest != nil ? "休息" : "训练用时").font(.caption2)
                    Text(NativeWorkoutView.duration(rest != nil ? remaining * 1_000 : elapsed))
                        .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                }
                .foregroundStyle(rest != nil ? accent.tint : SpotterPalette.ink)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

@MainActor
final class NativeTrainingNotifications {
    struct Schedule: Equatable {
        let enabled: Bool
        let time: Int
        let days: Set<String>
        let active: Bool
    }

    struct RestAlert: Equatable {
        let deadlineMilliseconds: Int
        let playsSound: Bool
    }

    static let shared = NativeTrainingNotifications()
    static let restPreference = "spotter.native.workout.restNotification"
    static let liveActivityPreference = "spotter.native.training.live-activity"
    private let center = UNUserNotificationCenter.current()
    private let prefix = "spotter.training.reminder."
    private let restIdentifier = "spotter.training.rest-end"
    private var generation = 0
    private var restGeneration = 0

    func enable() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound])) == true
    }

    func clear() async {
        await schedule(.init(enabled: false, time: 0, days: [], active: true))
    }

    func scheduleRest(_ alert: RestAlert?) async {
        restGeneration += 1
        let revision = restGeneration
        center.removePendingNotificationRequests(withIdentifiers: [restIdentifier])
        guard let alert else {
            center.removeDeliveredNotifications(withIdentifiers: [restIdentifier])
            return
        }
        let permission = await center.notificationSettings().authorizationStatus
        guard revision == restGeneration, !Task.isCancelled,
              [.authorized, .provisional, .ephemeral].contains(permission) else { return }

        let deadline = Date(timeIntervalSince1970: Double(alert.deadlineMilliseconds) / 1_000)
        let seconds = deadline.timeIntervalSinceNow
        guard seconds > 0 else { return }
        let content = UNMutableNotificationContent()
        content.title = "组间休息结束"
        content.body = "可以回到训练搭子继续下一组。"
        if alert.playsSound { content.sound = .default }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
        try? await center.add(.init(identifier: restIdentifier, content: content, trigger: trigger))
    }

    func schedule(_ schedule: Schedule) async {
        generation += 1
        let revision = generation
        let pending = await center.pendingNotificationRequests().filter { $0.identifier.hasPrefix(prefix) }
        guard revision == generation, !Task.isCancelled else { return }
        guard schedule.enabled else {
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier))
            return
        }
        let permission = await center.notificationSettings().authorizationStatus
        guard revision == generation, !Task.isCancelled else { return }
        guard [.authorized, .provisional, .ephemeral].contains(permission) else { return }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date()
        let dates: [(String, DateComponents)] = schedule.days.sorted().compactMap { day in
            let fields = day.split(separator: "-").compactMap { Int($0) }
            guard fields.count == 3, let date = calendar.date(from: .init(
                year: fields[0], month: fields[1], day: fields[2], hour: schedule.time / 60, minute: schedule.time % 60
            )), date > now else { return nil }
            return (prefix + day + "." + String(schedule.time), calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date))
        }
        let upcoming = dates.prefix(28)
        let identifiers = Set(upcoming.map { $0.0 })
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { !identifiers.contains($0.identifier) }.map(\.identifier))
        let existing = Set(pending.map(\.identifier))
        for (id, components) in upcoming where !existing.contains(id) {
            guard revision == generation, !Task.isCancelled else { return }
            let content = UNMutableNotificationContent()
            content.title = "训练提醒"
            content.body = NativePreferenceKey.reminderTitle
            content.sound = .default
            try? await center.add(UNNotificationRequest(identifier: id, content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
        }
    }
}
