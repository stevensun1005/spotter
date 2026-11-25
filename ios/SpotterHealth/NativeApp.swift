import SwiftUI
import UIKit
import UserNotifications

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
        accessibilityReduceMotion || spotterReduceMotion ? nil : .spring(response: 0.30, dampingFraction: 0.84)
    }
}

private struct SpotterPressFeedback: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    let pressed: Bool

    func body(content: Content) -> some View {
        let animate = !systemReduceMotion && !reduceMotion
        content
            .scaleEffect(pressed && animate ? 0.945 : 1)
            .brightness(pressed && animate ? 0.035 : 0)
            .opacity(pressed ? 0.86 : 1)
            .animation(animate ? (pressed ? .easeOut(duration: 0.11) : .spring(response: 0.30, dampingFraction: 0.72)) : nil,
                       value: pressed)
    }
}

extension View {
    func spotterPressFeedback(_ pressed: Bool) -> some View {
        modifier(SpotterPressFeedback(pressed: pressed))
    }
}

struct SpotterPressButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.spotterPressFeedback(configuration.isPressed)
            .opacity(enabled ? 1 : 0.54)
    }
}

extension ButtonStyle where Self == SpotterPressButtonStyle {
    static var spotterPress: Self { .init() }
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
    @AppStorage(SpotterTheme.storageKey) private var theme: SpotterTheme = .light
    @AppStorage(SpotterAccent.storageKey) private var accent: SpotterAccent = .lime
    @State private var sawSignIn = false
    @State private var friendInvite: String?

    var body: some View {
        Group {
            if account.isRestoring {
                ProgressView("正在登录训练搭子")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SpotterPalette.background)
            } else if let profile = account.profile {
                NativeSpotterTabs(account: account, owner: profile.id, offerWelcome: sawSignIn, inboundInvite: $friendInvite)
                    .id(profile.id)
            } else {
                NativeSignIn(account: account).onAppear { sawSignIn = true }
            }
        }
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .buttonStyle(.spotterPress)
        .environment(\.spotterAccent, accent)
        .background { SpotterWindowAppearance(theme: theme).accessibilityHidden(true) }
        .task { await account.restore() }
        .onChange(of: account.profile?.id) { owner in
            if owner == nil { Task { await NativeTrainingNotifications.shared.clear() } }
        }
        .onOpenURL(perform: acceptInviteURL)
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { acceptInviteURL(url) }
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
    @ObservedObject var account: NativeAccount
    @StateObject private var workouts: NativeWorkoutStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.spotterAccent) private var accent
    @State private var selected: NativeSpotterSection = .today
    @State private var dockTop: CGFloat?
    @State private var showCoach = false
    @State private var coachDetent: PresentationDetent = .medium
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
    @StateObject private var trainingPreferences: NativeAccountPreferences
    @AppStorage private var reminderEnabled: Bool
    @AppStorage private var reminderMinute: Int
    @AppStorage(NativePreferenceKey.friendsTab) private var showsFriends = true
    @AppStorage(NativePreferenceKey.nutritionModule) private var showsNutrition = true
    @AppStorage(NativePreferenceKey.reduceMotion) private var reduceMotion = false
    @AppStorage(NativePreferenceKey.largerText) private var largerText = false
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.dynamicTypeSize) private var systemTextSize
    let owner: String
    let offerWelcome: Bool
    @Binding var inboundInvite: String?

    private enum TrainingLaunch {
        case workout(String)
        case plan(NativeWorkoutEntry)
        case rest
        case body
    }

    private var allowsMotion: Bool { !reduceMotion && !systemReduceMotion }

    init(account: NativeAccount, owner: String, offerWelcome: Bool, inboundInvite: Binding<String?>) {
        self.account = account
        self.owner = owner
        self.offerWelcome = offerWelcome
        _inboundInvite = inboundInvite
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
        _trainingPreferences = StateObject(wrappedValue: NativeAccountPreferences(api: account.api, owner: owner))
        _reminderEnabled = AppStorage(wrappedValue: false, NativePreferenceKey.reminderKey(owner, field: "enabled"))
        _reminderMinute = AppStorage(wrappedValue: 18 * 60, NativePreferenceKey.reminderKey(owner, field: "minute"))
    }

    var body: some View {
        navigationTabs
        .background(SpotterPalette.background.ignoresSafeArea())
        .task { await refreshHome() }
        .onAppear {
            if offerWelcome, !UserDefaults.standard.bool(forKey: welcomeKey) {
                showWelcome = true
            } else {
                stageInvite()
            }
        }
        .onChange(of: inboundInvite) { _ in stageInvite() }
        .onChange(of: showsFriends) { visible in if !visible && selected == .friends { selected = .today } }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await refreshHome() } }
        }
        .onChange(of: workouts.pendingCheckins.map(\.id)) { _ in
            Task { await attachHealthHeartRate() }
        }
        .task(id: reminderSchedule) {
            guard scenePhase == .active else { return }
            await NativeTrainingNotifications.shared.schedule(reminderSchedule)
        }
        .sheet(isPresented: $showCoach, onDismiss: {
            stageInvite()
            Task { await workouts.load() }
        }) {
            NativeCoachView(api: account.api, owner: owner, compact: coachDetent == .medium,
                            onExpand: { coachDetent = .large },
                            onStartWorkout: { selected = .training; showCoach = false })
                .presentationDetents([.medium, .large], selection: $coachDetent)
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
                                   NativeCoachView.removeSavedConversation(api: account.api, owner: owner)
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
        .fullScreenCover(isPresented: $showNutrition) {
            NativeNutritionDetail(api: account.api, owner: owner, logs: workouts.logs)
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
        .fullScreenCover(isPresented: $showActiveWorkout, onDismiss: showWorkoutReceipt) {
            NativeActiveWorkoutView(store: workouts) { finishedWorkout = $0 }
        }
        .sheet(item: $workoutReceipt) { entry in
            NavigationStack { NativeWorkoutDetailView(store: workouts, entry: entry, showsClose: true) }
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showWelcome, onDismiss: {
            welcomeCoachGoal = nil
            stageInvite()
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
        let days = Set(workouts.plans.filter { $0.owner == owner && !workouts.hasCompletedPlan(id: $0.id) }.map(\.day))
        return .init(enabled: reminderEnabled, time: reminderMinute, days: days, active: scenePhase == .active)
    }

    private var welcomeKey: String { "spotter.native.welcome.v1." + owner }

    private func refreshHome() async {
        trainingPreferences.activate()
        async let preferences: Void = trainingPreferences.sync()
        await workouts.load()
        await attachHealthHeartRate()
        await preferences
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
        coachDetent = .medium
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
            dock.background {
                GeometryReader { geometry in
                    let top = geometry.frame(in: .global).minY
                    Color.clear
                        .onAppear { dockTop = top }
                        .onChange(of: top) { dockTop = $0 }
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
            NativeSpotterStats(store: workouts, api: account.api, owner: owner, dockTop: dockTop)
        case .friends:
            NativeFriends(api: account.api, owner: owner, buddySearchRequest: buddySearchRequest,
                          openOwnLog: { openOwnFeedWorkout($0) },
                          openOwnLogDay: { id, day in openOwnFeedWorkout(id, day: day) },
                          refreshPlans: { await workouts.load() })
                .id(friendsRevision)
        }
    }

    private var dock: some View {
        HStack(spacing: 8) {
            ZStack(alignment: .leading) {
                dockIndicator
                HStack(spacing: dockSpacing) {
                    ForEach(contentSections, id: \.self) { section in
                        if section == .stats { dockPlay }
                        dockTab(section)
                    }
                }
            }
            .animation(allowsMotion ? .spring(response: 0.34, dampingFraction: 0.78) : nil, value: selected)
            .padding(4)
            .frame(height: 59)
            .spotterGlass(in: Capsule(), interactive: false)
            .overlay { Capsule().strokeBorder(.white.opacity(0.36)).allowsHitTesting(false) }

            Button { openCoach() } label: {
                Image("DockCoach").renderingMode(.template).resizable()
                    .frame(width: 23, height: 23)
                    .foregroundStyle(accent.tint)
                    .frame(width: 51, height: 55)
                    .contentShape(RoundedRectangle(cornerRadius: 23))
                    .spotterGlass(cornerRadius: 23, tint: accent.selection.opacity(0.85), interactive: allowsMotion)
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("打开 AI 教练")
        }
        .frame(maxWidth: 530)
        .padding(.horizontal, 10)
        .padding(.top, 4)
        .padding(.bottom, 4)
    }

    private let dockSpacing: CGFloat = 2
    private let dockPlayWidth: CGFloat = 53

    private var dockIndicator: some View {
        GeometryReader { geometry in
            if let index = contentSections.firstIndex(of: selected),
               let playIndex = contentSections.firstIndex(of: .stats) {
                let gaps = CGFloat(contentSections.count) * dockSpacing
                let width = max(0, (geometry.size.width - dockPlayWidth - gaps) / CGFloat(contentSections.count))
                let previousPlay = index < playIndex ? 0 : dockPlayWidth + dockSpacing
                Capsule().fill(accent.fill.opacity(0.13))
                    .spotterGlass(in: Capsule(), tint: accent.fill.opacity(0.40), interactive: allowsMotion)
                    .overlay { Capsule().strokeBorder(.white.opacity(0.65)) }
                    .frame(width: width)
                    .offset(x: CGFloat(index) * (width + dockSpacing) + previousPlay)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func dockTab(_ section: NativeSpotterSection) -> some View {
        Button { selected = section } label: {
            VStack(spacing: 3) {
                Image(section.icon).renderingMode(.template).resizable().frame(width: 21, height: 21)
                Text(section.rawValue).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .foregroundStyle(selected == section ? accent.tint : SpotterPalette.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Capsule())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(section.rawValue)
        .accessibilityAddTraits(selected == section ? .isSelected : [])
    }

    private var dockPlay: some View {
        Button(action: openTrainingLaunch) {
            Image(systemName: "play.fill")
                .font(.system(size: 19, weight: .semibold))
                .offset(x: 1)
                .foregroundStyle(SpotterPalette.deep)
                .frame(width: 47, height: 47)
                .contentShape(Circle())
                .background(SpotterAccent.lime.fill.opacity(0.24), in: Circle())
                .spotterGlass(in: Circle(), tint: SpotterAccent.lime.fill.opacity(0.72), interactive: allowsMotion)
                .overlay { Circle().strokeBorder(.white.opacity(0.56)).allowsHitTesting(false) }
                .frame(width: dockPlayWidth)
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(workouts.active == nil ? "开始训练" : "继续训练")
        .accessibilityIdentifier("spotter-dock-play")
        .disabled(workouts.active == nil && workouts.isBusy)
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

    static let shared = NativeTrainingNotifications()
    private let center = UNUserNotificationCenter.current()
    private let prefix = "spotter.training.reminder."
    private var generation = 0

    func enable() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound])) == true
    }

    func clear() async {
        await schedule(.init(enabled: false, time: 0, days: [], active: true))
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
