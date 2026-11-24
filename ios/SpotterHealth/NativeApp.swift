import Charts
import SwiftUI
import UIKit

enum SpotterPalette {
    static let accent = Color(red: 0.31, green: 0.47, blue: 0.23)
    static let lime = Color(red: 0.83, green: 0.96, blue: 0.53)
    static let background = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
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
        .tint(SpotterPalette.accent)
        .task { await account.restore() }
    }
}

@MainActor
private struct NativeSignIn: View {
    @ObservedObject var account: NativeAccount
    @State private var showAccessCode = false
    @State private var email = ""
    @State private var accessCode = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 26) {
                VStack(spacing: 15) {
                    Image(systemName: "figure.strengthtraining.traditional")
                        .font(.system(size: 52, weight: .medium))
                        .foregroundStyle(Color(red: 0.16, green: 0.25, blue: 0.11))
                        .frame(width: 112, height: 112)
                        .background(SpotterPalette.lime, in: RoundedRectangle(cornerRadius: 28))
                        .accessibilityHidden(true)
                    Text("训练搭子")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("登录后同步你的训练计划和记录。")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                VStack(spacing: 12) {
                    providerButton("通过 Apple 登录", symbol: "apple.logo", primary: true,
                                   enabled: account.providerStatus.apple.enabled) { await account.signInApple() }
                    providerButton("通过 Google 登录", symbol: "g.circle", primary: false,
                                   enabled: account.providerStatus.google.enabled) { await account.signInGoogle() }
                    if !account.providerStatus.apple.enabled || !account.providerStatus.google.enabled {
                        Text("灰色的登录方式暂未开通。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Button(showAccessCode ? "收起访问码登录" : "使用已有邮箱和访问码") {
                        withAnimation(.easeInOut(duration: 0.2)) { showAccessCode.toggle() }
                    }
                    .font(.subheadline.weight(.semibold))
                    if showAccessCode {
                        VStack(spacing: 10) {
                            TextField("邮箱", text: $email)
                                .keyboardType(.emailAddress)
                                .textContentType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textFieldStyle(.roundedBorder)
                            SecureField("访问码", text: $accessCode)
                                .textContentType(.password)
                                .textFieldStyle(.roundedBorder)
                            Button {
                                Task { await account.signIn(email: email, accessCode: accessCode) }
                            } label: {
                                Text("登录").frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(account.isBusy || email.trimmingCharacters(in: .whitespaces).isEmpty || accessCode.isEmpty)
                        }
                    }
                    if account.isBusy { ProgressView() }
                    if let error = account.errorMessage {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }
                }
                .padding(spotterCardPadding)
                .spotterCard()
                NativeSupportLinks()
            }
            .frame(maxWidth: 455)
            .padding(.horizontal, 22)
            .padding(.top, 58)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
    }

    private func providerButton(_ title: String, symbol: String, primary: Bool, enabled: Bool,
                                action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Label(title, systemImage: symbol)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(primary ? Color.white : Color.primary)
                .background(primary ? Color.black : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled || account.isBusy)
        .opacity(enabled ? 1 : 0.5)
    }
}

let spotterCardPadding: CGFloat = 18

extension View {
    func spotterCard() -> some View {
        background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 22))
    }
}

private struct NativeSupportLinks: View {
    var body: some View {
        HStack(spacing: 18) {
            if let privacy = URL(string: AppConfiguration.defaultOrigin + "/privacy"),
               let support = URL(string: AppConfiguration.defaultOrigin + "/support") {
                Link("隐私说明", destination: privacy)
                Link("帮助与支持", destination: support)
            }
        }.font(.footnote)
    }
}

@MainActor
private struct NativeSpotterTabs: View {
    @ObservedObject var account: NativeAccount
    @StateObject private var workouts: NativeWorkoutStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var showCoach = false
    @State private var showSettings = false
    let owner: String

    init(account: NativeAccount, owner: String) {
        self.account = account
        self.owner = owner
        _workouts = StateObject(wrappedValue: NativeWorkoutStore(api: account.api, owner: owner))
    }

    var body: some View {
        TabView {
            NavigationStack {
                NativeWorkoutView(store: workouts)
                    .navigationTitle("今日")
                    .toolbar { commonToolbar }
            }
            .tabItem { Label("今日", systemImage: "house") }
            NavigationStack {
                NativeWorkoutView(store: workouts, showsAllPlans: true)
                    .navigationTitle("训练")
                    .toolbar { commonToolbar }
            }
            .tabItem { Label("训练", systemImage: "dumbbell") }
            NavigationStack {
                NativeSpotterStats(store: workouts, api: account.api, owner: owner)
                    .navigationTitle("统计")
                    .toolbar { commonToolbar }
            }
            .tabItem { Label("统计", systemImage: "chart.bar.xaxis") }
            NavigationStack {
                NativeFriends(api: account.api, owner: owner) { await workouts.load() }
                    .navigationTitle("好友")
                    .toolbar { commonToolbar }
            }
            .tabItem { Label("好友", systemImage: "person.2") }
        }
        .task { await workouts.load() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await workouts.load() } }
        }
        .sheet(isPresented: $showCoach, onDismiss: { Task { await workouts.load() } }) {
            NavigationStack { NativeCoachView(api: account.api, owner: owner) }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSettings, onDismiss: { Task { await workouts.load() } }) {
            NavigationStack { NativeSettings(account: account, owner: owner, onDeleted: workouts.clearLocalData) }
        }
    }

    @ToolbarContentBuilder private var commonToolbar: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button { showSettings = true } label: {
                Image(systemName: "person.crop.circle").accessibilityLabel("账号与设置")
            }
        }
        ToolbarItem(placement: .navigationBarTrailing) {
            Button { showCoach = true } label: {
                Image(systemName: "sparkles").accessibilityLabel("打开 AI 教练")
            }
            .tint(SpotterPalette.accent)
        }
    }
}

@MainActor
private struct NativeSpotterStats: View {
    @ObservedObject var store: NativeWorkoutStore
    let api: NativeAPI
    let owner: String

    private var recent: [NativeWorkoutEntry] {
        let first = Calendar.current.date(byAdding: .day, value: -6, to: .now).map(spotterDay) ?? spotterDay()
        return store.logs.filter { $0.day >= first && $0.day <= spotterDay() }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("过去 7 天").font(.headline)
                    HStack(spacing: 32) {
                        metric("训练次数", value: "\(recent.count)")
                        metric("训练分钟", value: "\(recent.reduce(0) { $0 + $1.durationMinutes })")
                    }
                    if !recent.isEmpty {
                        let minutes = Dictionary(grouping: recent, by: \.day)
                            .mapValues { $0.reduce(0) { $0 + $1.durationMinutes } }
                        Chart(minutes.keys.sorted(), id: \.self) { day in
                            BarMark(x: .value("日期", String(day.suffix(5))),
                                    y: .value("分钟", minutes[day, default: 0]))
                                .foregroundStyle(SpotterPalette.accent)
                        }
                        .frame(height: 120)
                    }
                }
                .padding(spotterCardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .spotterCard()
                NavigationLink {
                    NativeWorkoutHistoryView(store: store) { entry in
                        AnyView(NativeHeartView(api: api, owner: owner, entry: entry))
                    }
                    .navigationTitle("训练历史")
                } label: {
                    Label("训练历史", systemImage: "clock.arrow.circlepath")
                }.buttonStyle(.borderedProminent)
                NativeHealthSummary(api: api, owner: owner)
                NativeFoodLog(api: api, owner: owner)
            }
            .padding(16)
        }
        .background(SpotterPalette.background)
        .refreshable { await store.load() }
    }

    private func metric(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(.title, design: .rounded, weight: .bold)).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
    }
}

@MainActor
private struct NativeSettings: View {
    @ObservedObject var account: NativeAccount
    @Environment(\.dismiss) private var dismiss
    @State private var showDelete = false
    @State private var working = false
    @State private var note: String?
    @State private var deleted = false
    @State private var revokeInSettings = false
    let owner: String
    var onDeleted: () -> Void

    var body: some View {
        Form {
            Section("账号") {
                if let profile = account.profile { Label(profile.name, systemImage: "person.crop.circle.fill") }
                loginRow("Apple", enabled: account.providerStatus.apple.enabled, linked: account.providerStatus.apple.linked) {
                    await account.linkApple()
                }
                loginRow("Google", enabled: account.providerStatus.google.enabled, linked: account.providerStatus.google.linked) {
                    await account.linkGoogle()
                }
                if let error = account.errorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                Button("退出登录") { Task { await account.signOut() } }
            }
            Section("健康与隐私") {
                NavigationLink { ScrollView { NativeHealthSummary(api: account.api, owner: owner).padding() }.navigationTitle("Apple 健康") } label: {
                    Label("Apple 健康", systemImage: "heart.text.square")
                }
                NativeSupportLinks()
                Button("删除账号", role: .destructive) { showDelete = true }
                    .disabled(working || account.isBusy)
                if let note { Text(note).font(.footnote).foregroundStyle(.secondary) }
            }
            Section("饮食") {
                NavigationLink {
                    NativeProteinView(api: account.api, owner: owner)
                } label: {
                    Label("蛋白粉仓库", systemImage: "shippingbox")
                }
            }
            Section {
                let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
                let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "11"
                LabeledContent("App 版本", value: "\(version) (\(build))")
            }
        }
        .navigationTitle("设置")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("完成") { dismiss() } } }
        .confirmationDialog("永久删除训练搭子账号？", isPresented: $showDelete, titleVisibility: .visible) {
            Button("删除账号和数据", role: .destructive) { Task { await deleteAccount() } }
            Button("取消", role: .cancel) {}
        } message: {
            Text("你的训练、饮食、计划和登录绑定会一并删除。")
        }
        .alert("账号已删除", isPresented: $deleted) {
            Button("完成") { Task { await account.signOut() } }
        } message: {
            if revokeInSettings { Text("可在 iPhone「设置 → 你的姓名 → 通过 Apple 登录」中撤销训练搭子的 Apple 授权。") }
        }
    }

    private func loginRow(_ provider: String, enabled: Bool, linked: Bool,
                          action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            HStack {
                Text(provider)
                Spacer()
                Text(linked ? "已绑定" : enabled ? "绑定" : "待开通").foregroundStyle(.secondary)
            }
        }.disabled(linked || !enabled || account.isBusy)
    }

    private func deleteAccount() async {
        working = true
        defer { working = false }
        do {
            let response = try await account.api.spotterSend("/api/auth/delete-account", body: ["expectedOwner": owner, "confirm": true])
            let result = try JSONSerialization.jsonObject(with: response) as? [String: Any]
            revokeInSettings = result?["appleRevocation"] as? String == "manual"
            onDeleted()
            UserDefaults.standard.removeObject(forKey: "spotter.native.coach.consent." + owner)
            deleted = true
        } catch { note = error.localizedDescription }
    }
}

@MainActor
private struct NativeFriends: View {
    private struct Friend: Decodable, Identifiable {
        let id: String
        let name: String
        let buddy: Bool
        let checkedIn: Bool?
    }
    private struct FriendList: Decodable {
        struct Invite: Decodable { let code: String }
        let friends: [Friend]
        let invite: Invite?
    }
    let api: NativeAPI
    let owner: String
    let refreshPlans: @MainActor () async -> Void
    @State private var data: FriendList?
    @State private var code = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        List {
            Section("训练好友") {
                if let data {
                    if data.friends.isEmpty { Text("还没有添加训练好友。").foregroundStyle(.secondary) }
                    ForEach(data.friends) { friend in
                        HStack {
                            Label(friend.name, systemImage: friend.buddy ? "figure.2" : "person.circle")
                            Spacer()
                            if friend.checkedIn == true { Label("已打卡", systemImage: "checkmark.circle") }
                        }
                    }
                } else if message == nil { ProgressView() }
            }
            Section("邀请与加入") {
                if let invite = data?.invite { ShareLink(item: invite.code) { Label("分享好友邀请码", systemImage: "square.and.arrow.up") } }
                Button { Task { await mutate(["action": "invite"]) } } label: {
                    Label("生成好友邀请码", systemImage: "person.badge.plus")
                }.disabled(busy)
                TextField("输入好友邀请码", text: $code).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button("添加好友") { Task { await mutate(["action": "join", "code": code]) } }
                    .disabled(busy || code.trimmingCharacters(in: .whitespacesAndNewlines).count != 32)
            }
            Section("教练") {
                NavigationLink {
                    NativeCoachingView(api: api, owner: owner)
                        .onDisappear { Task { await refreshPlans() } }
                } label: { Label("教练与学员", systemImage: "person.2.badge.gearshape") }
            }
            if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do { data = try await api.spotterRead("/api/friends?today=" + spotterDay(), as: FriendList.self); message = nil }
        catch { message = error.localizedDescription }
    }

    private func mutate(_ values: [String: Any]) async {
        busy = true
        defer { busy = false }
        do {
            let response = try await api.spotterSend("/api/friends?today=" + spotterDay(), body: values)
            data = try JSONDecoder().decode(FriendList.self, from: response)
            code = ""
            message = nil
        } catch { message = error.localizedDescription }
    }
}
