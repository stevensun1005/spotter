import AuthenticationServices
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
    @State private var friendInvite: String?
    @State private var widgetDestination: NativeWidgetDestination?

    var body: some View {
        Group {
            if account.isRestoring {
                ProgressView("正在登录训练搭子")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SpotterPalette.background)
            } else if let profile = account.profile {
                NativeSpotterTabs(account: account, owner: profile.id,
                                  inboundInvite: $friendInvite, widgetDestination: $widgetDestination)
                    .id(profile.id)
            } else {
                NativeSignIn(account: account)
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
        .task(id: activeAccountID) {
            if let owner = activeAccountID { await account.ensureAccountHandle(for: owner) }
        }
        .onChange(of: account.isRestoring) { restoring in
            // A locked phone hides the saved session. Keep the widget account and the running
            // Live Activity until the restore can read it again.
            if !restoring && !account.isSessionLocked {
                NativeTrainingWidgetBridge.useAccount(account.profile?.id, origin: account.api.origin)
                if account.profile == nil { clearTrainingLiveActivity() }
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active { retryLockedRestore() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.protectedDataDidBecomeAvailableNotification)) { _ in
            retryLockedRestore()
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

    private var activeAccountID: String? {
        scenePhase == .active ? account.profile?.id : nil
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

    private func retryLockedRestore() {
        guard account.isSessionLocked, account.profile == nil, !account.isBusy else { return }
        Task { await account.restore() }
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
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var email = ""
    @State private var accessCode = ""
    @State private var allowAI = false
    @State private var showsAccessCode = false
    @ScaledMetric(relativeTo: .body) private var providerHeight = 52.0

    var body: some View {
        GeometryReader { viewport in
            ScrollView {
                VStack(spacing: 24) {
                    identity
                    signInCard
                    footer
                }
                .frame(maxWidth: 434)
                .padding(.horizontal, 22)
                .padding(.vertical, 28)
                .frame(maxWidth: .infinity, minHeight: viewport.size.height)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background {
            SpotterPalette.background
                .overlay {
                    RadialGradient(colors: [accent.fill.opacity(0.20), .clear],
                                   center: .top, startRadius: 0, endRadius: 390)
                }
                .ignoresSafeArea()
        }
    }

    private var identity: some View {
        VStack(spacing: 9) {
            Image("SignInMark")
                .resizable()
                .scaledToFit()
                .frame(width: 104, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 27, style: .continuous))
                .shadow(color: SpotterPalette.deep.opacity(0.16), radius: 16, y: 7)
                .padding(.bottom, 10)
                .accessibilityHidden(true)
            Text("训练搭子")
                .font(.largeTitle.weight(.heavy))
                .accessibilityAddTraits(.isHeader)
            Text("记录训练与饮食，和搭子一起进步。")
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
                .multilineTextAlignment(.center)
        }
    }

    private var signInCard: some View {
        VStack(spacing: 11) {
            NativeAppleSignInButton(style: colorScheme == .dark ? .white : .black,
                                    enabled: account.providerStatus.apple.enabled && !account.isBusy) {
                Task { await account.signInApple(allowAI: allowAI) }
            }
            .id(colorScheme)
            .frame(height: providerHeight)
            .frame(maxWidth: .infinity)
            if !account.providerStatus.apple.enabled { providerUnavailable("Apple") }
            googleSignIn
            if !account.providerStatus.google.enabled { providerUnavailable("Google") }

            Divider().padding(.top, 2)
            Button {
                withAnimation(motion) { showsAccessCode.toggle() }
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "envelope").accessibilityHidden(true)
                    Text("使用邮箱和访问码")
                    Spacer(minLength: 4)
                    Image(systemName: showsAccessCode ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .accessibilityHidden(true)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(SpotterPalette.muted)
                .padding(.horizontal, 4)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("spotter-login-access-code")
            .accessibilityValue(showsAccessCode ? "已展开" : "已收起")
            .disabled(account.isBusy)
            if showsAccessCode { accessCodeForm }

            if let error = account.errorMessage {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("spotter-login-error")
            }
            if account.isBusy { ProgressView("正在登录").font(.footnote) }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 8)
        .spotterCard(radius: 26)
    }

    private var googleSignIn: some View {
        let enabled = account.providerStatus.google.enabled
        return Button {
            Task { await account.signInGoogle(allowAI: allowAI) }
        } label: {
            Text("使用 Google 登录")
                .font(.body.weight(.semibold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, minHeight: providerHeight)
                .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.spotterPress)
        .accessibilityIdentifier("spotter-login-google")
        .disabled(!enabled || account.isBusy)
        .opacity(enabled ? 1 : 0.56)
    }

    private func providerUnavailable(_ provider: String) -> some View {
        Text("\(provider) 登录暂不可用")
            .font(.caption)
            .foregroundStyle(SpotterPalette.muted)
    }

    private var accessCodeForm: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("已有访问码？先用原账号登录，再到设置绑定登录方式。")
                .font(.footnote)
                .foregroundStyle(SpotterPalette.muted)
            field("邮箱") {
                TextField("", text: $email)
                    .accessibilityLabel("邮箱")
                    .accessibilityIdentifier("spotter-login-email")
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            field("访问码") {
                SecureField("", text: $accessCode)
                    .accessibilityLabel("访问码")
                    .accessibilityIdentifier("spotter-login-code")
                    .textContentType(.password)
            }
            Button {
                Task { await account.signIn(email: email, accessCode: accessCode, allowAI: allowAI) }
            } label: {
                Text("登录")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.deep)
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(accent.fill, in: RoundedRectangle(cornerRadius: 11))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityIdentifier("spotter-login-submit")
            .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || accessCode.isEmpty)
        }
        .padding(.bottom, 8)
        .disabled(account.isBusy)
    }

    private var footer: some View {
        VStack(spacing: 15) {
            DisclosureGroup("AI 教练数据授权（选填）") {
                NativeCoachSharingChoice(allowed: $allowAI, origin: account.api.origin)
                    .padding(.top, 8)
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(SpotterPalette.muted)
            .padding(.horizontal, 6)
            .disabled(account.isBusy)
            NativeSupportLinks()
        }
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

}

private struct NativeAppleSignInButton: UIViewRepresentable {
    let style: ASAuthorizationAppleIDButton.Style
    let enabled: Bool
    let action: () -> Void

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(authorizationButtonType: .signIn, authorizationButtonStyle: style)
        button.cornerRadius = 14
        button.accessibilityIdentifier = "spotter-login-apple"
        button.addTarget(context.coordinator, action: #selector(Coordinator.signIn), for: .touchUpInside)
        return button
    }

    func updateUIView(_ button: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.action = action
        button.isEnabled = enabled
    }

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    final class Coordinator: NSObject {
        var action: () -> Void

        init(action: @escaping () -> Void) { self.action = action }

        @objc func signIn() {
            action()
        }
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
        case .today: return "house"
        case .training: return "dumbbell"
        case .stats: return "chart.bar.xaxis"
        case .friends: return "person.2"
        }
    }

    var identifier: String {
        switch self {
        case .today: return "today"
        case .training: return "training"
        case .stats: return "stats"
        case .friends: return "friends"
        }
    }

    var guideStep: NativeGuideStep? {
        switch self {
        case .today: return .todayTab
        case .training: return .trainingTab
        case .friends: return .friendsTab
        case .stats: return nil
        }
    }
}

@MainActor
private struct NativeSpotterTabs: View {
    private static let compactCoachDetent = PresentationDetent.fraction(0.44)
    /// 底栏样式，改这一行就能在同一份代码里对比。
    /// `.floating`：自绘底栏浮在页面上方，内容可以滚到底栏下面。
    /// `.docked`：自绘底栏排在页面下方，页面止于底栏上沿，不依赖安全区调整。
    /// `.system`：系统底栏。iOS 26 用 `Tab(role: .search)`，更早的系统用 `.tabItem`。
    private enum DockStyle { case system, docked, floating }
    private static let dockStyle = DockStyle.floating
    private static var usesCustomDock: Bool { dockStyle != .system }

    private enum TabDestination: Hashable {
        case section(NativeSpotterSection)
        case coach
    }

    @ObservedObject var account: NativeAccount
    @StateObject private var workouts: NativeWorkoutStore
    @StateObject private var avatars: NativeAvatarStore
    @StateObject private var remarks: NativeSocialRemarks
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.spotterAccent) private var accent
    @EnvironmentObject private var socialNotifications: NativeSocialNotifications
    @State private var selected: NativeSpotterSection = .today
    @State private var showCoach = false
    @State private var coachUsesMainWindow = false
    @State private var coachDetent = Self.compactCoachDetent
    @State private var showSettings = false
    @State private var showPlanImport = false
    @State private var showPrograms = false
    @State private var showNutrition = false
    @State private var homeDate = Date()
    @State private var nutritionDetailDate = Date()
    @State private var nutritionUsesHomeDate = false
    @StateObject private var nutritionWeek: NativeNutritionWeek
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
    @State private var beginGuideAfterWelcome = false
    @State private var guideStep: NativeGuideStep?
    @State private var guideCoachGoal: String?
    @StateObject private var permissionOnboarding: NativePermissionOnboarding
    @AppStorage private var didFinishWelcome: Bool
    @AppStorage(NativePreferenceKey.officialTemplates) private var showsOfficialTemplates = true
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
    @AppStorage(NativePreferenceKey.workoutPresentation) private var workoutPresentation: NativeWorkoutPresentation = .classic
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.dynamicTypeSize) private var systemTextSize
    @Environment(\.colorScheme) private var surroundingColorScheme
    let owner: String
    @Binding var inboundInvite: String?
    @Binding var widgetDestination: NativeWidgetDestination?

    private enum TrainingLaunch {
        case workout(String)
        case plan(NativeWorkoutEntry)
        case template(NativeJSON)
        case nutrition(Date)
        case rest
        case body
    }

    private var allowsMotion: Bool { !reduceMotion && !systemReduceMotion }

    init(account: NativeAccount, owner: String, inboundInvite: Binding<String?>,
         widgetDestination: Binding<NativeWidgetDestination?>) {
        self.account = account
        self.owner = owner
        let identity = SHA256.hash(data: Data((account.api.origin + "\n" + owner).utf8))
            .map { String(format: "%02x", $0) }.joined()
        _didFinishWelcome = AppStorage(wrappedValue: false, "spotter.native.welcome.v3." + identity)
        _permissionOnboarding = StateObject(wrappedValue: NativePermissionOnboarding(origin: account.api.origin, owner: owner))
        _inboundInvite = inboundInvite
        _widgetDestination = widgetDestination
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
        _nutritionWeek = StateObject(wrappedValue: NativeNutritionWeek(api: account.api, owner: owner))
        _avatars = StateObject(wrappedValue: NativeAvatarStore(api: account.api, owner: owner))
        _remarks = StateObject(wrappedValue: NativeSocialRemarks(api: account.api, owner: owner))
        _trainingPreferences = StateObject(wrappedValue: NativeAccountPreferences(api: account.api, owner: owner))
        _reminderEnabled = AppStorage(wrappedValue: false, NativePreferenceKey.reminderKey(owner, field: "enabled"))
        _reminderMinute = AppStorage(wrappedValue: 18 * 60, NativePreferenceKey.reminderKey(owner, field: "minute"))
    }

    var body: some View {
        navigationTabs
        .nativeGuideLayer(.dock)
        .background(SpotterPalette.background.ignoresSafeArea())
        .overlay(alignment: .top) { notificationBanner }
        .animation(allowsMotion ? .easeInOut(duration: 0.23) : nil, value: socialNotifications.banner?.id)
        .task { await refreshHome() }
        .task(id: scenePhase) {
            avatars.setForeground(scenePhase == .active)
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(NativeAvatarStore.refreshInterval)) }
                catch { return }
                avatars.refreshVisible()
            }
        }
        .onChange(of: selected) { section in
            avatars.refreshVisible()
            if section == .friends { Task { await remarks.refresh() } }
        }
        .onChange(of: workouts.networkAvailable) { available in
            if available == true {
                avatars.refreshVisible()
                Task { await remarks.refresh() }
            }
        }
        .onAppear {
            refreshLiveActivity()
            if !didFinishWelcome && guideStep == nil && !beginGuideAfterWelcome {
                showWelcome = true
            } else if didFinishWelcome {
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
            if available {
                stageInvite()
                stageWidgetDestination()
                stageSocialNotification()
            }
        }
        .onChange(of: socialNotifications.requestedItem) { _ in stageSocialNotification() }
        .onChange(of: inboundInvite) { _ in stageInvite() }
        .onChange(of: showsFriends) { visible in
            if !visible && selected == .friends { selected = .today }
        }
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
            let date = showNutrition ? nutritionDetailDate : homeDate
            Task {
                async let widget: Void = workouts.refreshWidgetNutrition(force: true)
                if showsNutrition || showNutrition {
                    await nutritionWeek.refreshWeek(containing: date, force: true)
                }
                await widget
            }
        }
        .onChange(of: workouts.pendingCheckins.map(\.id)) { _ in
            Task { await attachHealthHeartRate() }
        }
        .onReceive(NativeWorkoutHealthSync.shared.$updatedWorkout) { key in
            guard key?.owner == owner else { return }
            Task { await syncWorkoutHealthSummaries() }
        }
        .task(id: reminderSchedule) {
            guard scenePhase == .active else { return }
            await NativeTrainingNotifications.shared.schedule(reminderSchedule)
        }
        .task(id: restAlert) {
            await NativeTrainingNotifications.shared.scheduleRest(restAlert)
        }
        .background {
            NativeCoachOverlay(visible: !showWelcome && guideStep == nil, presenting: showCoach && !coachUsesMainWindow) {
                floatingCoachContent
            }
        }
        .sheet(isPresented: coachPresentation(inMainWindow: true), onDismiss: coachClosed) {
            coachPanel
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
                                   avatars.clear()
                                   remarks.clear()
                                   NativeTrainingWidgetBridge.useAccount(nil, origin: account.api.origin)
                                   refreshLiveActivity()
                                   NativeCoachView.removeSavedConversation(api: account.api, owner: owner)
                                   NativeNutritionDetail.clearFavoriteMeals(api: account.api, owner: owner)
                                   trainingPreferences.clear()
                                   permissionOnboarding.clear()
                                   NativeWorkoutHealthSync.shared.clear(origin: account.api.origin, owner: owner)
                                   didFinishWelcome = false
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
        .fullScreenCover(isPresented: $showNutrition, onDismiss: {
            widgetNutritionEntry = nil
            nutritionUsesHomeDate = false
        }) {
            NativeNutritionDetail(api: account.api, owner: owner, logs: workouts.logs, initialDate: nutritionDetailDate,
                                  initialWidgetEntry: widgetNutritionEntry, week: nutritionWeek, onDateChange: { date in
                nutritionDetailDate = date
                if nutritionUsesHomeDate { homeDate = date }
            })
        }
        .sheet(isPresented: $showRest, onDismiss: { Task { await workouts.load() } }) {
            NativeRestSchedule(api: account.api, owner: owner)
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showBody) {
            NavigationStack {
                NativeBodyData(api: account.api, owner: owner, showsClose: true, onProfileSaved: workouts.useSavedAnatomyVariant)
            }
        }
        .sheet(isPresented: $showTrainingLaunch, onDismiss: finishTrainingLaunch) {
            NativeTrainingLaunch(start: { queueTrainingLaunch(.workout($0)) },
                                 rest: { queueTrainingLaunch(.rest) }, bodyAction: { queueTrainingLaunch(.body) },
                                 scheduled: workouts.todayPendingPlans, startPlan: { queueTrainingLaunch(.plan($0)) },
                                 recordNutrition: showsNutrition ? { queueTrainingLaunch(.nutrition(homeDate)) } : nil,
                                 templates: workouts.libraryRows.filter { $0["kind"].string == "template" && !$0["id"].string.isEmpty },
                                 startTemplate: { queueTrainingLaunch(.template($0)) })
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showActiveWorkout, onDismiss: {
            showWorkoutReceipt()
            stageInvite()
            stageWidgetDestination()
            stageSocialNotification()
        }) {
            NativeActiveWorkoutView(store: workouts) { finishedWorkout = $0 }
        }
        .sheet(item: $workoutReceipt) { entry in
            NavigationStack { NativeWorkoutDetailView(store: workouts, entry: entry, showsClose: true) }
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showWelcome, onDismiss: startGuideIfRequested) {
            NativeWelcomeView(permissionOnboarding: permissionOnboarding, begin: {
                beginGuideAfterWelcome = true
                showWelcome = false
            }, skip: {
                didFinishWelcome = true
                showWelcome = false
            })
            .interactiveDismissDisabled()
        }
        .modifier(NativePermissionReminder(controller: permissionOnboarding,
                                           canPresent: isAvailableForWidget && !showActiveWorkout && workouts.active == nil))
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
        .environmentObject(avatars)
        .environmentObject(remarks)
        .environment(\.spotterReduceMotion, reduceMotion)
        .environment(\.spotterGuide, guideContext)
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
        view.homeDate = $homeDate
        view.openAllPlans = { selected = .training }
        view.openStats = { selected = .stats }
        view.openCoach = { openCoach() }
        if showsFriends { view.openFriends = openFriends }
        if showsNutrition {
            view.openNutrition = { openHomeNutrition($0) }
            view.nutritionRing = { nutritionWeek.ringDay($0, logs: workouts.logs) }
            view.refreshNutritionWeek = { await nutritionWeek.refreshWeek(containing: $0, force: $1) }
            view.homeNutrition = { date, collapse in
                AnyView(NativeHomeNutrition(api: account.api, owner: owner, logs: workouts.logs, date: date,
                                           week: nutritionWeek, onCollapse: collapse) {
                    let guidingMeal = guideStep == .mainMeal
                    if guidingMeal { advanceGuide(from: .mainMeal) }
                    openHomeNutrition(date, recordMeal: guidingMeal)
                })
            }
        }
        return view
    }

    private func openHomeNutrition(_ date: Date, recordMeal: Bool = false) {
        nutritionDetailDate = date
        nutritionUsesHomeDate = true
        widgetNutritionEntry = recordMeal ? .recordMeal : nil
        showNutrition = true
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

    private var guidePath: [NativeGuideStep] {
        NativeGuideStep.path(officialTemplates: showsOfficialTemplates, nutrition: showsNutrition, friends: showsFriends)
    }

    private var guideContext: NativeGuideContext? {
        guard let guideStep, let index = guidePath.firstIndex(of: guideStep) else { return nil }
        return NativeGuideContext(step: guideStep, number: index + 1, count: guidePath.count,
                                  advance: advanceGuide, skipSection: skipGuideSection, close: finishGuide,
                                  navigationAction: guideNavigationAction(for: guideStep))
    }

    private func guideNavigationAction(for step: NativeGuideStep) -> (title: String, perform: () -> Void)? {
        let destination: NativeSpotterSection
        switch step {
        case .trainingTab: destination = .training
        case .todayTab: destination = .today
        case .friendsTab: destination = .friends
        case .coach: return ("打开 AI 教练", { openCoach(startFromGuide: true) })
        default: return nil
        }
        return ("打开" + destination.rawValue, { selectTab(destination) })
    }

    private func startGuideIfRequested() {
        guard beginGuideAfterWelcome else { return }
        beginGuideAfterWelcome = false
        selected = .today
        guideStep = .trainingTab
    }

    private func advanceGuide(from step: NativeGuideStep) {
        guard guideStep == step, let index = guidePath.firstIndex(of: step) else { return }
        if guidePath.indices.contains(index + 1) { guideStep = guidePath[index + 1] }
        else { finishGuide() }
    }

    private func skipGuideSection(from step: NativeGuideStep) {
        guard guideStep == step, let index = guidePath.firstIndex(of: step),
              let next = guidePath.dropFirst(index + 1).first(where: { $0.section != step.section }) else { return }
        guideStep = next
    }

    private func finishGuide() {
        guideStep = nil
        didFinishWelcome = true
    }

    private func selectTab(_ section: NativeSpotterSection) {
        selected = section
        switch section {
        case .today: advanceGuide(from: .todayTab)
        case .training: advanceGuide(from: .trainingTab)
        case .friends: advanceGuide(from: .friendsTab)
        case .stats: break
        }
    }

    private func refreshHome() async {
        trainingPreferences.activate()
        async let preferences: Void = trainingPreferences.sync()
        async let nutrition: Void = workouts.refreshWidgetNutrition()
        async let contactNames: Void = remarks.refresh()
        await workouts.load()
        refreshWidget()
        async let history: Void = workouts.refreshWidgetHistory()
        await attachHealthHeartRate()
        await preferences
        await nutrition
        await history
        await contactNames
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
            totalSets: session.totalSets,
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
        didFinishWelcome && guideStep == nil &&
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
            nutritionDetailDate = .now
            nutritionUsesHomeDate = false
            switch destination {
            case .frequentMeals: widgetNutritionEntry = .frequentMeals
            case .water(let day) where day == spotterDay(): widgetNutritionEntry = .water
            default: widgetNutritionEntry = nil
            }
            showNutrition = true
        }
    }

    private func attachHealthHeartRate() async {
        async let summaries: Void = syncWorkoutHealthSummaries()
        let waiting = Set(workouts.pendingCheckins.map(\.id))
        let uploaded = workouts.logs.filter { !waiting.contains($0.id) }
        await NativeAutomaticHeartSync.shared.run(api: account.api, owner: owner, entries: uploaded)
        await summaries
    }

    private func syncWorkoutHealthSummaries() async {
        guard account.profile?.id == owner else { return }
        let waiting = Set(workouts.pendingCheckins.map(\.id))
        let uploaded = workouts.logs.filter { !waiting.contains($0.id) }
        await NativeWorkoutHealthSync.shared.run(api: account.api, owner: owner, entries: uploaded)
    }

    private func stageInvite() {
        guard let code = inboundInvite, isAvailableForWidget, !showActiveWorkout, !inviteBusy else { return }
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

    private func openCoach(startFromGuide: Bool = false) {
        guard !showCoach else { return }
        coachUsesMainWindow = guideStep != nil
        if startFromGuide {
            advanceGuide(from: .coach)
            guideCoachGoal = "general"
            coachDetent = .large
        } else {
            coachDetent = Self.compactCoachDetent
        }
        showCoach = true
    }

    private func coachPresentation(inMainWindow: Bool) -> Binding<Bool> {
        Binding(get: { showCoach && coachUsesMainWindow == inMainWindow }, set: { value in
            if coachUsesMainWindow == inMainWindow { showCoach = value }
        })
    }

    private var coachPanel: some View {
        NativeCoachView(api: account.api, owner: owner, compact: coachDetent != .large,
                        onExpand: { coachDetent = .large }, onStartWorkout: { selected = .training; showCoach = false },
                        initialTrainingGoal: guideCoachGoal, workoutStore: workouts)
            .presentationDetents([Self.compactCoachDetent, .large], selection: $coachDetent)
            .presentationDragIndicator(.visible)
    }

    private func coachClosed() {
        guideCoachGoal = nil
        if guideStep?.section == .coach { finishGuide() }
        stageInvite()
        Task { await workouts.load() }
    }

    private var floatingCoachContent: some View {
        Color.clear
            .overlay(alignment: .bottomTrailing) {
                if !showCoach {
                    coachButton
                        .background { NativeCoachOverlayTouchTarget() }
                        .padding(.trailing, 14)
                        .padding(.bottom, coachBottomPadding)
                }
            }
            .sheet(isPresented: coachPresentation(inMainWindow: false), onDismiss: coachClosed) { coachPanel }
            .foregroundStyle(SpotterPalette.ink)
            .tint(accent.tint)
            .environment(\.spotterAccent, accent)
            .environment(\.spotterReduceMotion, reduceMotion)
            .environment(\.colorScheme, surroundingColorScheme)
            .environment(\.spotterAccountPreferences, trainingPreferences)
            .environmentObject(avatars)
            .environmentObject(remarks)
            .environmentObject(socialNotifications)
            .dynamicTypeSize(largerText ? max(systemTextSize, .xxLarge) : systemTextSize)
    }

    private var coachBottomPadding: CGFloat {
        if showActiveWorkout, let session = workouts.active?.session, workoutPresentation.usesFocusedLayout(for: session) {
            return NativeFloatingDock.reservedHeight + 59
        }
        return NativeFloatingDock.reservedHeight
    }

    private var coachButton: some View {
        NativeFloatingCoachButton(interactive: allowsMotion) { openCoach(startFromGuide: guideStep == .coach) }
    }

    private func openTrainingLaunch() {
        if workouts.active != nil { openActiveWorkout() }
        else { showTrainingLaunch = true }
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
        case .template(let entry):
            workouts.startTemplate(plan: NativePlan(raw: entry["plan"]), id: entry["id"].string)
            openActiveWorkout()
        case .nutrition(let date): openHomeNutrition(date, recordMeal: true)
        case .rest: showRest = true
        case .body: showBody = true
        case nil: break
        }
    }

    private func openActiveWorkout() {
        guard workouts.active != nil else { return }
        refreshLiveActivity()
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

    @ViewBuilder private var navigationTabs: some View {
        if Self.dockStyle == .floating {
            ZStack(alignment: .bottom) {
                customDockPages
                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    customDock
                }
                // 键盘弹出时底栏留在原位，和系统底栏一样被键盘盖住。
                .ignoresSafeArea(.keyboard, edges: .bottom)
            }
            .overlay(alignment: .bottomTrailing) { guidedCoachButton }
        } else if Self.dockStyle == .docked {
            VStack(spacing: 0) {
                customDockPages
                customDock
            }
            // 键盘弹出时底栏留在原位，页面自己避让键盘。
            .ignoresSafeArea(.keyboard, edges: .bottom)
            .overlay(alignment: .bottomTrailing) { guidedCoachButton }
        } else if #available(iOS 26.0, *) {
            let selection = Binding<TabDestination>(get: { .section(selected) }, set: { destination in
                switch destination {
                case .section(let section): selectTab(section)
                case .coach: openCoach(startFromGuide: guideStep == .coach)
                }
            })
            TabView(selection: selection) {
                ForEach(contentSections, id: \.self) { section in
                    Tab(section.rawValue, systemImage: section.icon, value: TabDestination.section(section)) {
                        tabScene(section, active: selected == section)
                    }
                }
                Tab("AI 教练", systemImage: "sparkles", value: TabDestination.coach, role: .search) {
                    Color.clear.accessibilityHidden(true)
                }
            }
            .tabBarMinimizeBehavior(.never)
        } else {
            TabView(selection: Binding(get: { selected }, set: { selectTab($0) })) {
                ForEach(contentSections, id: \.self) { section in
                    tabScene(section, active: selected == section)
                        .tabItem { Label(section.rawValue, systemImage: section.icon) }
                        .tag(section)
                }
            }
        }
    }

    /// 自绘底栏时，页面仍交给系统 TabView 管理，只是隐藏系统底栏。
    private var customDockPages: some View {
        TabView(selection: Binding(get: { selected }, set: { selectTab($0) })) {
            ForEach(contentSections, id: \.self) { section in
                tabScene(section, active: selected == section)
                    .tag(section)
            }
        }
    }

    private var customDock: some View {
        NativeFloatingDock(sections: contentSections, selected: selected,
                           hasActiveWorkout: workouts.active != nil, isBusy: workouts.isBusy,
                           select: { selectTab($0) }, openTraining: openTrainingLaunch)
    }

    @ViewBuilder private var guidedCoachButton: some View {
        if guideStep == .coach {
            coachButton
                .padding(.trailing, 14)
                .padding(.bottom, coachBottomPadding)
        }
    }

    private func tabScene(_ section: NativeSpotterSection, active: Bool) -> some View {
        NavigationStack {
            sectionContent(section, active: active)
                .nativeGuideLayer(.tabContent)
                .toolbar(.hidden, for: .navigationBar)
                .modifier(DockHost())
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if active { quickActions }
                }
        }
    }

    /// 自绘底栏时隐藏系统底栏，并让所在导航栈给底栏让位。系统底栏样式下原样返回，行为和改动前一致。
    private struct DockHost: ViewModifier {
        @ViewBuilder func body(content: Content) -> some View {
            switch NativeSpotterTabs.dockStyle {
            case .system:
                content
            case .docked:
                content
                    .toolbar(.hidden, for: .tabBar)
                    .background { NativeDockClearance(height: 0).accessibilityHidden(true) }
            case .floating:
                content
                    .toolbar(.hidden, for: .tabBar)
                    .background { NativeDockClearance(height: NativeFloatingDock.reservedHeight).accessibilityHidden(true) }
            }
        }
    }

    @ViewBuilder private func sectionContent(_ section: NativeSpotterSection, active: Bool) -> some View {
        switch section {
        case .today: today
        case .training:
            NativeWorkoutView(store: workouts, openWorkout: openActiveWorkout, showsAllPlans: true, openSettings: { showSettings = true }, openCoach: { openCoach() },
                              openImport: { showPlanImport = true }, openPrograms: { showPrograms = true })
        case .stats:
            NativeSpotterStats(store: workouts, api: account.api, owner: owner, widgetStatsRequest: $widgetStatsRequest)
        case .friends:
            NativeFriends(api: account.api, owner: owner, buddySearchRequest: buddySearchRequest,
                          notificationRequest: active && isAvailableForWidget && socialNotifications.belongs(to: owner)
                              ? socialNotifications.requestedItem : nil,
                          openOwnLog: { openOwnFeedWorkout($0) },
                          openOwnLogDay: { id, day in openOwnFeedWorkout(id, day: day) },
                          refreshPlans: { await workouts.load() })
                .id(friendsRevision)
        }
    }

    @ViewBuilder private var quickActions: some View {
        if let active = workouts.active, let session = active.session {
            NativeWorkoutStatusStrip(title: active.displayTitle, session: session,
                                     watchContext: .init(owner: owner, workoutID: active.id, isRunning: session.isRunning),
                                     open: openActiveWorkout)
                .background(.bar, in: Capsule())
                .font(.subheadline.weight(.semibold)).foregroundStyle(accent.tint)
                .lineLimit(1).minimumScaleFactor(0.8)
                .padding(.trailing, 56)
                .padding(.horizontal, 14).padding(.vertical, 4)
        } else if Self.usesCustomDock {
            Color.clear.frame(height: 56).allowsHitTesting(false).accessibilityHidden(true)
        } else {
            Button(action: openTrainingLaunch) {
                Label("开练", systemImage: "play.fill").frame(minHeight: 44)
                    .padding(.horizontal, 14).spotterGlass(in: Capsule(), tint: accent.selection, interactive: allowsMotion)
            }
            .buttonStyle(.spotterGlassPress).disabled(workouts.isBusy)
            .accessibilityLabel("开始训练").accessibilityIdentifier("spotter-dock-play")
        }
    }
}

/// 标签和开练共用一个悬浮胶囊。
@MainActor
private struct NativeFloatingDock: View {
    static let barHeight: CGFloat = 60
    static let topGap: CGFloat = 6
    static let bottomGap: CGFloat = 4
    /// 底栏连同上下留白的总高度。浮在页面上方时，各标签的导航栈按这个高度让出底部。
    static let reservedHeight: CGFloat = topGap + barHeight + bottomGap

    @Environment(\.spotterAccent) private var accent
    @ScaledMetric(relativeTo: .caption2) private var tabLabelSize: CGFloat = 11
    let sections: [NativeSpotterSection]
    let selected: NativeSpotterSection
    let hasActiveWorkout: Bool
    let isBusy: Bool
    let select: (NativeSpotterSection) -> Void
    let openTraining: () -> Void

    var body: some View {
        rail.frame(maxWidth: 530)
            .padding(.horizontal, 12)
            .padding(.top, Self.topGap)
            .padding(.bottom, Self.bottomGap)
    }

    private var rail: some View {
        HStack(spacing: 0) {
            ForEach(sections, id: \.self) { section in
                if section == .stats { trainingButton }
                Button { select(section) } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.icon)
                            .font(.system(size: 20, weight: .medium))
                            .frame(height: 24)
                        Text(section.rawValue)
                            .font(.system(size: min(max(tabLabelSize, 11), 14), weight: .semibold))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(NativeDockTabStyle(selected: selected == section, glow: accent.fill))
                .accessibilityLabel(section.rawValue)
                .accessibilityAddTraits(selected == section ? .isSelected : [])
                // 辅助功能大字号下也可长按放大查看。
                .accessibilityShowsLargeContentViewer { Label(section.rawValue, systemImage: section.icon) }
                .accessibilityIdentifier("spotter-dock-tab-" + section.identifier)
                .nativeGuideTarget(section.guideStep)
            }
        }
        .padding(.horizontal, 6)
        .frame(height: Self.barHeight)
        .clipShape(Capsule())
        .modifier(NativeDockSurface(shape: Capsule(), tint: nil, interactive: false))
        .accessibilityElement(children: .contain)
        .modifier(NativeDockTabBarTrait())
        .accessibilityIdentifier("spotter-dock-tabs")
    }

    private var trainingButton: some View {
        Button(action: openTraining) {
            Image(systemName: "play.fill")
                .font(.system(size: 21, weight: .semibold))
                .offset(x: 1)
                .foregroundStyle(SpotterPalette.deep)
                .frame(width: 52, height: 52)
                .background(accent.fill, in: Circle())
                .overlay { Circle().strokeBorder(accent.tint.opacity(0.16)).allowsHitTesting(false) }
                .contentShape(Circle())
        }
        .buttonStyle(.spotterPress)
        .disabled(isBusy && !hasActiveWorkout)
        .accessibilityLabel(hasActiveWorkout ? "继续训练" : "开始训练")
        .accessibilityIdentifier("spotter-dock-play")
        .padding(.horizontal, 3)
    }
}

@MainActor
private struct NativeFloatingCoachButton: View {
    @Environment(\.spotterAccent) private var accent
    let interactive: Bool
    let openCoach: () -> Void

    private static let ring: [Color] = SpotterAccent.allCases.map(\.tint) + [SpotterAccent.lime.tint]

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 17, style: .continuous)
        return Button(action: openCoach) {
            ZStack {
                Circle()
                    .strokeBorder(AngularGradient(colors: Self.ring, center: .center, angle: .degrees(-90)), lineWidth: 2.5)
                    .frame(width: 30, height: 30)
                Image(systemName: "sparkles")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(accent.tint)
            }
            .frame(width: 48, height: 48)
            .modifier(NativeDockSurface(shape: shape, tint: accent.selection.opacity(0.85), interactive: interactive))
            .contentShape(shape)
        }
        .buttonStyle(.spotterGlassPress)
        .accessibilityLabel("打开 AI 教练")
        .accessibilityShowsLargeContentViewer { Label("AI 教练", systemImage: "sparkles") }
        .accessibilityIdentifier("spotter-quick-coach")
        .nativeGuideTarget(.coach)
    }
}

/// 选中或按下的标签点亮：前景换成正文色，脚下透出一团强调色的光。按下即亮，松手后才切页。
private struct NativeDockTabStyle: ButtonStyle {
    @Environment(\.spotterInteractionMotion) private var motion
    let selected: Bool
    let glow: Color

    func makeBody(configuration: Configuration) -> some View {
        let lit = selected || configuration.isPressed
        return configuration.label
            .symbolVariant(lit ? .fill : .none)
            .foregroundStyle(lit ? SpotterPalette.ink : SpotterPalette.muted)
            .background(alignment: .bottom) {
                // 光心压在标签底边以下，只让光晕的外缘漫上来，深色模式下文字仍然清楚。
                RadialGradient(colors: [glow.opacity(0.6), glow.opacity(0)],
                               center: UnitPoint(x: 0.5, y: 1.2), startRadius: 0, endRadius: 38)
                    .frame(maxWidth: 76)
                    .frame(height: 38)
                    .opacity(lit ? 1 : 0)
                    .animation(lit || motion == nil ? nil : .easeOut(duration: 0.18), value: lit)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
    }
}

/// iOS 26 用液态玻璃。更早的系统用毛玻璃材质叠一层半透明卡片色，内容仍能从底栏下透出来。
private struct NativeDockSurface<Surface: InsettableShape>: ViewModifier {
    let shape: Surface
    let tint: Color?
    let interactive: Bool

    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.spotterGlass(in: shape, tint: tint, interactive: interactive)
        } else {
            content
                .background {
                    shape.fill(.ultraThinMaterial)
                        .overlay { shape.fill(tint ?? SpotterPalette.card.opacity(0.45)) }
                }
                .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        }
    }
}

/// iOS 17 起把标签区标成标签栏，旁白会按标签栏朗读。
private struct NativeDockTabBarTrait: ViewModifier {
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.accessibilityAddTraits(.isTabBar)
        } else {
            content
        }
    }
}

/// 悬浮底栏盖在页面上方时，把它的高度加进所在导航栈的安全区。根页面和推入的详情页都会在底部让出位置，
/// 内容仍可滚到底栏下面。SwiftUI 的 `safeAreaInset` 加在导航栈外层时不会传给栈内页面，所以交给 UIKit。
private struct NativeDockClearance: UIViewRepresentable {
    let height: CGFloat

    func makeUIView(context: Context) -> Probe {
        let view = Probe(frame: .zero)
        view.isUserInteractionEnabled = false
        view.height = height
        return view
    }

    func updateUIView(_ view: Probe, context: Context) {
        guard view.height != height else { return }
        view.height = height
        // 高度变了才会走到这里。SwiftUI 更新期间不直接改 UIKit 布局，推到下一轮。
        DispatchQueue.main.async { [weak view] in view?.apply() }
    }

    final class Probe: UIView {
        var height: CGFloat = 0
        private weak var stack: UINavigationController?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil else { return }
            // 进窗口时当场设置，页面第一帧就带着底部留白。响应链还没接上时再等一轮。
            if !apply() {
                DispatchQueue.main.async { [weak self] in self?.apply() }
            }
        }

        @discardableResult
        func apply() -> Bool {
            if stack == nil {
                // 沿响应链向上找到承载这个标签页的导航控制器。
                var responder = next
                while let current = responder {
                    if let found = current as? UINavigationController {
                        stack = found
                        break
                    }
                    responder = current.next
                }
            }
            guard let stack = stack else { return false }
            if stack.additionalSafeAreaInsets.bottom != height {
                stack.additionalSafeAreaInsets.bottom = height
            }
            // iOS 26 开着「降低透明度」时，隐藏的系统底栏会留下一条挡住触摸的白条，iOS 27 已修。
            // 这里只在 iOS 26 上让标签控制器再确认一次隐藏。
            if #available(iOS 26.0, *) {
                if #unavailable(iOS 27.0) {
                    if let tabs = stack.tabBarController, !tabs.isTabBarHidden {
                        tabs.setTabBarHidden(true, animated: false)
                    }
                }
            }
            return true
        }
    }
}

private struct NativeWorkoutStatusStrip: View {
    @Environment(\.spotterAccent) private var accent
    let title: String
    let session: NativeWorkoutSession
    let watchContext: NativeWatchWorkoutContext
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
                    HStack(spacing: 8) {
                        Text(progressText)
                            .font(.caption).monospacedDigit().foregroundStyle(SpotterPalette.muted).lineLimit(1)
                        if #available(iOS 17.0, *) {
                            NativeWatchWorkoutBPM(context: watchContext)
                        }
                    }
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
            .padding(.leading, 6)
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.spotterPress)
        .accessibilityIdentifier("spotter-active-workout-strip")
        .accessibilityHint("返回进行中的训练")
    }

    private var progressText: String {
        if !session.isRunning { return "计时已暂停" }
        let total = session.totalSets
        return total > 0 ? "\(session.completedSets)/\(total) 组" : "训练中"
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
