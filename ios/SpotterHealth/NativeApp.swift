import SwiftUI

enum SpotterPalette {
    static let accent = color(0x466036)
    static let lime = color(0xd0f67b)
    static let background = color(0xf2f4ee)
    static let card = Color.white
    static let deep = color(0x18251d)
    static let ink = color(0x1b2820)
    static let muted = color(0x59675e)
    static let line = color(0xe0e7dd)
    static let wash = color(0xeaf3df)
    static let lilac = color(0xeeeafb)

    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255,
              blue: Double(hex & 255) / 255)
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
    @ViewBuilder
    func spotterGlass(cornerRadius: CGFloat = 16, tint: Color? = nil, interactive: Bool = true) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        if #available(iOS 26.0, *) {
            glassEffect(.regular.tint(tint).interactive(interactive), in: shape)
        } else {
            background {
                shape.fill(.ultraThinMaterial)
                    .overlay { shape.fill(tint ?? .white.opacity(0.84)) }
            }
                .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        }
    }
}

private struct SpotterReduceMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var spotterReduceMotion: Bool {
        get { self[SpotterReduceMotionKey.self] }
        set { self[SpotterReduceMotionKey.self] = newValue }
    }
}

private struct SpotterPressFeedback: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    let pressed: Bool

    func body(content: Content) -> some View {
        let animate = !systemReduceMotion && !reduceMotion
        content
            .scaleEffect(pressed && animate ? 0.97 : 1)
            .opacity(pressed ? 0.82 : 1)
            .animation(animate ? .easeOut(duration: 0.14) : nil, value: pressed)
    }
}

extension View {
    func spotterPressFeedback(_ pressed: Bool) -> some View {
        modifier(SpotterPressFeedback(pressed: pressed))
    }
}

struct SpotterPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.spotterPressFeedback(configuration.isPressed)
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

    var body: some View {
        Group {
            if account.isRestoring {
                ProgressView("正在登录训练搭子")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SpotterPalette.background)
            } else if let profile = account.profile {
                NativeSpotterTabs(account: account, owner: profile.id)
                    .id(profile.id)
            } else {
                NativeSignIn(account: account)
            }
        }
        .foregroundStyle(SpotterPalette.ink)
        .tint(SpotterPalette.accent)
        .preferredColorScheme(.light)
        .task { await account.restore() }
    }
}

@MainActor
private struct NativeSignIn: View {
    @ObservedObject var account: NativeAccount
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
                            .padding(.horizontal, 15)
                            .frame(minHeight: 42)
                            .background(SpotterPalette.lime, in: RoundedRectangle(cornerRadius: 9))
                    }
                    .buttonStyle(.plain)
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
        .buttonStyle(.plain)
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

private enum NativeSpotterSection: String, CaseIterable {
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
    @State private var selected: NativeSpotterSection = .today
    @State private var showCoach = false
    @State private var coachDetent: PresentationDetent = .medium
    @State private var showSettings = false
    @State private var showNutrition = false
    @State private var showRest = false
    @State private var showBody = false
    @State private var buddySearchRequest = 0
    @State private var showTrainingReminder = false
    @AppStorage private var reminderEnabled: Bool
    @AppStorage private var reminderMinute: Int
    @AppStorage(NativePreferenceKey.friendsTab) private var showsFriends = true
    @AppStorage(NativePreferenceKey.nutritionModule) private var showsNutrition = true
    @AppStorage(NativePreferenceKey.reduceMotion) private var reduceMotion = false
    @AppStorage(NativePreferenceKey.largerText) private var largerText = false
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.dynamicTypeSize) private var systemTextSize
    let owner: String

    init(account: NativeAccount, owner: String) {
        self.account = account
        self.owner = owner
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
        _reminderEnabled = AppStorage(wrappedValue: false, NativePreferenceKey.reminderKey(owner, field: "enabled"))
        _reminderMinute = AppStorage(wrappedValue: 18 * 60, NativePreferenceKey.reminderKey(owner, field: "minute"))
    }

    var body: some View {
        TabView(selection: $selected) {
            section(.today) {
                today
            }
            section(.training) {
                NativeWorkoutView(store: workouts, showsAllPlans: true, openSettings: { showSettings = true },
                                  openCoach: openCoach)
            }
            section(.stats) {
                NativeSpotterStats(store: workouts, api: account.api, owner: owner)
            }
            if showsFriends {
                section(.friends) {
                    NativeFriends(api: account.api, owner: owner, buddySearchRequest: buddySearchRequest) { await workouts.load() }
                }
            }
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { dock }
        .task { await workouts.load() }
        .onChange(of: showsFriends) { visible in if !visible && selected == .friends { selected = .today } }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await workouts.load() } }
        }
        .task(id: reminderEnabled && scenePhase == .active && !showSettings) {
            guard reminderEnabled, scenePhase == .active, !showSettings else { return }
            while !Task.isCancelled {
                checkTrainingReminder()
                do { try await Task.sleep(nanoseconds: 15_000_000_000) } catch { return }
            }
        }
        .alert("训练提醒", isPresented: $showTrainingReminder) { Button("好", role: .cancel) {} } message: {
            Text(NativePreferenceKey.reminderTitle)
        }
        .sheet(isPresented: $showCoach, onDismiss: { Task { await workouts.load() } }) {
            NativeCoachView(api: account.api, owner: owner, compact: coachDetent == .medium,
                            onExpand: { coachDetent = .large },
                            onStartWorkout: { selected = .training; showCoach = false })
                .presentationDetents([.medium, .large], selection: $coachDetent)
                .presentationDragIndicator(.hidden)
        }
        .fullScreenCover(isPresented: $showSettings, onDismiss: { Task { await workouts.load() } }) {
            NavigationStack {
                NativeSettings(account: account, owner: owner, onDeleted: workouts.clearLocalData,
                               refreshPlans: { await workouts.load() }, openTraining: { selected = .training; showSettings = false })
            }
        }
        .fullScreenCover(isPresented: $showNutrition) {
            NativeNutritionDetail(api: account.api, owner: owner, logs: workouts.logs)
        }
        .sheet(isPresented: $showRest, onDismiss: { Task { await workouts.load() } }) {
            NativeRestSchedule(api: account.api, owner: owner)
        }
        .fullScreenCover(isPresented: $showBody) {
            NavigationStack {
                NativeBodyData(api: account.api, owner: owner, showsClose: true)
            }
        }
        .dynamicTypeSize(largerText ? max(systemTextSize, .xxLarge) : systemTextSize)
        .environment(\.spotterReduceMotion, reduceMotion)
        .transaction {
            if reduceMotion || systemReduceMotion {
                $0.animation = nil
                $0.disablesAnimations = true
            }
        }
    }

    private var today: some View {
        var view = NativeWorkoutView(store: workouts)
        view.openSettings = { showSettings = true }
        view.openAllPlans = { selected = .training }
        view.openCoach = openCoach
        view.openRest = { showRest = true }
        view.openBody = { showBody = true }
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

    private func checkTrainingReminder() {
        let now = Date()
        let parts = Calendar.current.dateComponents([.hour, .minute], from: now)
        let minute = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
        guard minute >= reminderMinute else { return }
        let today = NativeWorkoutSession.day(now)
        let deliveredKey = NativePreferenceKey.reminderKey(owner, field: "delivered")
        guard UserDefaults.standard.string(forKey: deliveredKey) != today else { return }
        let completed = Set(workouts.logs.map { $0.data["planId"].string })
        guard workouts.plans.contains(where: { $0.owner == owner && $0.day == today && !completed.contains($0.id) }) else { return }
        UserDefaults.standard.set(today, forKey: deliveredKey)
        showTrainingReminder = true
    }

    private func openCoach() {
        coachDetent = .medium
        showCoach = true
    }

    private func section<Content: View>(_ section: NativeSpotterSection, @ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            content()
                .toolbar(.hidden, for: .navigationBar)
                .toolbar(.hidden, for: .tabBar)
        }
        .tag(section)
    }

    private var dock: some View {
        SpotterGlassGroup(spacing: 4) {
            HStack(spacing: 8) {
                HStack(spacing: 2) {
                    ForEach(NativeSpotterSection.allCases.filter { showsFriends || $0 != .friends }, id: \.self) { section in
                        Button {
                            selected = section
                        } label: {
                            VStack(spacing: 3) {
                                Image(section.icon).renderingMode(.template).resizable().frame(width: 21, height: 21)
                                Text(section.rawValue).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                            }
                            .foregroundStyle(selected == section ? SpotterPalette.deep : SpotterPalette.muted)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(selected == section ? SpotterPalette.wash.opacity(0.88) : .clear,
                                        in: RoundedRectangle(cornerRadius: 15))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityLabel(section.rawValue)
                        .accessibilityAddTraits(selected == section ? .isSelected : [])
                    }
                }
                .animation(reduceMotion || systemReduceMotion ? nil : .easeOut(duration: 0.2), value: selected)
                .padding(4)
                .frame(height: 60)
                .spotterGlass(cornerRadius: 22, interactive: false)
                Button(action: openCoach) {
                    Image("DockCoach").renderingMode(.template).resizable()
                        .frame(width: 21, height: 21)
                        .foregroundStyle(SpotterPalette.color(0x2d543e))
                        .frame(width: 38, height: 38)
                        .background(.white.opacity(0.42), in: RoundedRectangle(cornerRadius: 14))
                        .frame(width: 60, height: 60)
                        .contentShape(RoundedRectangle(cornerRadius: 22))
                        .spotterGlass(cornerRadius: 22, tint: SpotterPalette.color(0xdaeacb).opacity(0.89))
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("打开 AI 教练")
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 8)
    }
}
