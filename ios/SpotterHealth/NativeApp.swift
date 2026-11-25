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
    static let shadow = deep.opacity(0.13)

    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255,
              blue: Double(hex & 255) / 255)
    }
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
    let parts = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 2000, parts.month ?? 1, parts.day ?? 1)
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("登录训练搭子")
                    .font(.largeTitle.weight(.bold))
                    .accessibilityAddTraits(.isHeader)
                VStack(spacing: 8) {
                    providerButton("使用 Apple 登录", symbol: "apple.logo", enabled: account.providerStatus.apple.enabled) { await account.signInApple() }
                    providerButton("使用 Google 登录", enabled: account.providerStatus.google.enabled) { await account.signInGoogle() }
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
                        Task { await account.signIn(email: email, accessCode: accessCode) }
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
    let owner: String

    init(account: NativeAccount, owner: String) {
        self.account = account
        self.owner = owner
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
    }

    var body: some View {
        TabView(selection: $selected) {
            section(.today) {
                NativeWorkoutView(
                    store: workouts,
                    openSettings: { showSettings = true },
                    openNutrition: { showNutrition = true },
                    openAllPlans: { selected = .training },
                    openCoach: openCoach,
                    openFriends: { selected = .friends },
                    openRest: { showRest = true },
                    openBody: { showBody = true },
                    homeNutrition: AnyView(NativeHomeNutrition(api: account.api, owner: owner, logs: workouts.logs) { showNutrition = true })
                )
            }
            section(.training) {
                NativeWorkoutView(store: workouts, showsAllPlans: true, openSettings: { showSettings = true },
                                  openCoach: openCoach)
            }
            section(.stats) {
                NativeSpotterStats(store: workouts, api: account.api, owner: owner)
            }
            section(.friends) {
                NativeFriends(api: account.api, owner: owner) { await workouts.load() }
            }
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { dock }
        .task { await workouts.load() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await workouts.load() } }
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
                NativeSettings(account: account, owner: owner, onDeleted: workouts.clearLocalData)
            }
        }
        .fullScreenCover(isPresented: $showNutrition) {
            NativeNutritionDetail(api: account.api, owner: owner, logs: workouts.logs)
        }
        .sheet(isPresented: $showRest, onDismiss: { Task { await workouts.load() } }) {
            NativeRestSchedule(api: account.api, owner: owner)
        }
        .fullScreenCover(isPresented: $showBody, onDismiss: { Task { await workouts.load() } }) {
            NativeBodyData(api: account.api, owner: owner)
        }
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
        HStack(spacing: 8) {
            HStack(spacing: 2) {
                ForEach(NativeSpotterSection.allCases, id: \.self) { section in
                    Button {
                        selected = section
                    } label: {
                        VStack(spacing: 3) {
                            Image(section.icon).renderingMode(.template).resizable().frame(width: 21, height: 21)
                            Text(section.rawValue).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                        }
                        .foregroundStyle(selected == section ? SpotterPalette.deep : SpotterPalette.muted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(selected == section ? SpotterPalette.wash : .clear,
                                    in: RoundedRectangle(cornerRadius: 15))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(section.rawValue)
                    .accessibilityAddTraits(selected == section ? .isSelected : [])
                }
            }
            .padding(4)
            .frame(height: 60)
            .background {
                RoundedRectangle(cornerRadius: 21).fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 21).fill(.white.opacity(0.84)))
            }
            .overlay(RoundedRectangle(cornerRadius: 21).strokeBorder(SpotterPalette.line).allowsHitTesting(false))
            .shadow(color: SpotterPalette.shadow, radius: 10, y: 6)
            Button(action: openCoach) {
                Image("DockCoach").renderingMode(.template).resizable()
                    .frame(width: 21, height: 21)
                    .foregroundStyle(SpotterPalette.color(0x2d543e))
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 14))
                    .frame(width: 60, height: 60)
                    .background(SpotterPalette.color(0xdaeacb), in: RoundedRectangle(cornerRadius: 21))
                    .overlay(RoundedRectangle(cornerRadius: 21).strokeBorder(SpotterPalette.color(0x9fbb91)).allowsHitTesting(false))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("打开 AI 教练")
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 8)
    }
}
