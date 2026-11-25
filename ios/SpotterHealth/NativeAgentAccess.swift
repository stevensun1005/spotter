import SwiftUI
import UIKit
import UniformTypeIdentifiers

private enum NativeAgentScope: String, CaseIterable, Identifiable {
    case context = "read:context"
    case trainingRead = "training:read", nutritionRead = "nutrition:read"
    case templatesRead = "templates:read"
    case planDraft = "plans:draft", planWrite = "plans:write"
    case nutritionWrite = "nutrition:write", trainingWrite = "training:write"
    case bodyWrite = "body:write", templatesWrite = "templates:write"

    static let read: [Self] = [.context, .trainingRead, .nutritionRead, .templatesRead]
    static let write: [Self] = [.planDraft, .planWrite, .nutritionWrite, .trainingWrite, .bodyWrite, .templatesWrite]

    var id: Self { self }
    var title: String {
        switch self {
        case .context: return "读取编排资料"
        case .trainingRead: return "读取训练计划与打卡"
        case .nutritionRead: return "读取饮食与饮水"
        case .templatesRead: return "读取个人模板"
        case .planDraft: return "保存训练草稿"
        case .planWrite: return "将确认的计划加入日历"
        case .nutritionWrite: return "新增饮食与饮水"
        case .trainingWrite: return "新增已完成的训练记录"
        case .bodyWrite: return "新增身体记录"
        case .templatesWrite: return "新增个人模板"
        }
    }
}

private struct NativeAgentConnection: Decodable, Identifiable {
    let id: String
    let name: String
    let scopes: [String]
    let expiresAt: String
    let lastUsedAt: String?
    var revokedAt: String?

    private static func date(_ value: String) -> Date? {
        (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(value)) ??
            (try? Date.ISO8601FormatStyle().parse(value))
    }

    var expires: Date? { Self.date(expiresAt) }
    var lastUsed: Date? { lastUsedAt.flatMap(Self.date) }
    var active: Bool { revokedAt == nil && (expires ?? .distantPast) > .now }
    var status: String { revokedAt != nil ? "已撤销" : active ? "生效中" : "已过期" }
}

private enum NativeAgentConnectionAPI {
    struct List: Decodable {
        let connections: [NativeAgentConnection]
        let profileRef: String
    }

    struct Issue: Encodable {
        let action = "create"
        let name: String
        let scopes: [String]
        let expiresInDays: Int
    }

    struct Issued: Decodable {
        let connection: NativeAgentConnection
        let token: String
    }

    private struct Revoke: Encodable {
        let action = "revoke"
        let id: String
    }

    private static let path = "/api/agent/connections"

    static func list(api: NativeAPI, owner: String) async throws -> List {
        let data = try await api.request(path, method: "GET", json: nil, for: owner)
        let list = try JSONDecoder().decode(List.self, from: data)
        guard list.profileRef.range(of: #"^spotter_[a-f0-9]{32}$"#, options: .regularExpression) != nil else {
            throw NativeAPIError.invalidResponse
        }
        return list
    }

    static func issue(_ request: Issue, api: NativeAPI, owner: String) async throws -> Issued {
        let data = try await api.request(path, method: "POST", json: JSONEncoder().encode(request), for: owner)
        let result = try JSONDecoder().decode(Issued.self, from: data)
        guard result.token.range(of: #"^spotter_agent_[a-f0-9]{64}$"#, options: .regularExpression) != nil else {
            throw NativeAPIError.invalidResponse
        }
        return result
    }

    static func revoke(_ id: String, api: NativeAPI, owner: String) async throws {
        guard UUID(uuidString: id) != nil else { throw NativeAPIError.invalidResponse }
        _ = try await api.request(path, method: "POST", json: JSONEncoder().encode(Revoke(id: id)), for: owner)
    }
}

private enum NativeAgentPurpose: String, CaseIterable {
    case analyze = "分析记录"
    case plan = "制定并添加计划"
    case nutrition = "记录饮食"

    var permissions: String {
        switch self {
        case .analyze: return "选择要分析的范围，例如读取训练计划与打卡、读取饮食与饮水。"
        case .plan: return "选择读取编排资料和保存训练草稿。需要从 Agent 保存到日历时，再打开「将确认的计划加入日历」。"
        case .nutrition: return "选择「新增饮食与饮水」。需要核对当天记录时，可同时选择「读取饮食与饮水」。"
        }
    }

    func prompt(origin: String, profileRef: String) -> String {
        let setup = """
        你是我的训练搭子 Agent。用工具连接 Spotter 账号 \(profileRef)。
        MCP 地址是 \(origin)/api/agent/mcp。支持自定义 HTTP 的客户端可使用 \(origin)/api/agent/schema 获取接口结构。
        请从客户端凭据设置取 Bearer 令牌，先调用 get_spotter_agent_profile（HTTP：GET /api/agent/profile）。核对返回的 profileRef 是 \(profileRef)，并检查获准权限。后续请求都传这个 profileRef。连接失败或权限不足时明确告诉我，不要声称已读取或保存。
        """
        let assignment: String
        switch self {
        case .analyze:
            assignment = """
            分析我指定日期内的个人数据。通过 read_spotter_records（HTTP：GET /api/agent/records）分别读取必要的 scope：training、nutrition 或 templates。带上 from 和 to（YYYY-MM-DD）；未提供日期时按最近 30 天。按 nextOffset 分页直到读完所需范围。列出数据覆盖日期、变化趋势、缺失项和可执行建议。这个任务只读取，不写入。
            """
        case .plan:
            assignment = """
            先询问目标、器械、每周可练天数和开始日期。用 read_spotter_planning_context（HTTP：GET /api/agent/context）查实际动作、个人模板和休息日，保留记录里的动作编号、重量单位和组次。用 stage_spotter_plans（HTTP：POST /api/agent/drafts）保存私密草稿，重试沿用 requestId，拿到预览后把日期、动作和冲突给我核对。在我确认这份预览后才用 commit_spotter_draft（HTTP：POST /api/agent/commit），带 draftId、最新 revision 和 confirmed:true。最后报出实际新增与跳过数量。
            """
        case .nutrition:
            assignment = """
            记我明确要求新增的餐食。核对日期、餐次、食物、份量和营养数值；估算指标要说明。若有读取饮食权限，先查看当天并核对重复。用 add_spotter_meals（HTTP：POST /api/agent/meals），带 profileRef、confirmed:true 和 meals 数组。每餐含 UUID id、date、meal、name、calories、protein、carbs、fat，可选 grams；重试沿用同一 UUID。只新增我已确认的餐食，按实际接口回执说明记入日期、餐次及新增或跳过数量。
            """
        }
        return setup + "\n\n" + assignment
    }
}

@MainActor
struct NativeAgentAccessView: View {
    let api: NativeAPI
    let owner: String
    var showsClose = false

    @Environment(\.dismiss) private var dismiss
    @State private var connections: [NativeAgentConnection] = []
    @State private var profileRef: String?
    @State private var purpose: NativeAgentPurpose = .analyze
    @State private var loading = false
    @State private var creating = false
    @State private var revokeCandidate: NativeAgentConnection?
    @State private var revoking: String?
    @State private var errorMessage: String?
    @State private var notice: String?

    private var mcpEndpoint: String { api.origin + "/api/agent/mcp" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                intro
                if let profileRef { setup(profileRef) }
                connectionList
            }
            .frame(maxWidth: 520, alignment: .leading)
            .padding(15)
            .frame(maxWidth: .infinity)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .navigationTitle("外部 Agent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            if showsClose {
                ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
            }
        }
        .task(id: owner) { await load() }
        .refreshable { if revoking == nil { await load() } }
        .sheet(isPresented: $creating) {
            NavigationStack {
                NativeAgentCreateView(api: api, owner: owner) { connection in
                    connections = [connection] + connections.filter { $0.id != connection.id }
                }
            }
            .presentationDragIndicator(.visible)
        }
        .alert("撤销这个 Agent 连接？", isPresented: Binding(
            get: { revokeCandidate != nil }, set: { if !$0 { revokeCandidate = nil } }
        ), presenting: revokeCandidate) { connection in
            Button("撤销连接", role: .destructive) { Task { await revoke(connection) } }
            Button("取消", role: .cancel) {}
        } message: { connection in
            Text("撤销后，\(connection.name) 的令牌无法发起新请求。")
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("连接你自己的 Agent", systemImage: "link")
                .font(.title2.weight(.heavy))
                .accessibilityAddTraits(.isHeader)
            Text("在支持 MCP 或自定义 HTTP 的工具里，按你授予的权限分析记录、安排训练或记饮食。")
                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            Button { creating = true } label: {
                Label("新建 Agent 连接", systemImage: "plus").frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterPrimaryControl)
            .disabled(profileRef == nil || revoking != nil)
            .accessibilityIdentifier("spotter-agent-create")
        }
        .padding(15)
        .spotterCard()
    }

    private func setup(_ profileRef: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("配置 Agent").font(.headline).accessibilityAddTraits(.isHeader)
            Text("把 MCP 地址填到工具连接设置，把令牌填到它的凭据栏，使用 Authorization: Bearer。提示词可以直接发给 Agent。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
            Text(mcpEndpoint)
                .font(.footnote.monospaced())
                .textSelection(.enabled)
            Button("复制 MCP 地址", systemImage: "doc.on.doc") { copy(mcpEndpoint, note: "MCP 地址已复制。") }
                .buttonStyle(.spotterControl)
            Divider()
            SpotterMenuPicker("提示词用途", selection: $purpose, options: NativeAgentPurpose.allCases.map { ($0, $0.rawValue) })
            Text(purpose.permissions)
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
            Button("复制提示词", systemImage: "doc.on.doc") {
                copy(purpose.prompt(origin: api.origin, profileRef: profileRef), note: "提示词已复制，含账号识别码。")
            }
            .buttonStyle(.spotterPrimaryControl)
            .accessibilityIdentifier("spotter-agent-copy-prompt")
            if let notice {
                Text(notice).font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
        }
        .padding(15)
        .spotterCard()
    }

    private var connectionList: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("我的连接").font(.headline).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 6)
                Button {
                    Task { await load() }
                } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("刷新连接列表")
                .disabled(loading || revoking != nil)
            }
            if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            if loading {
                ProgressView("读取中…").font(.footnote)
            } else if connections.isEmpty && errorMessage == nil {
                Text("还没有 Agent 连接。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            ForEach(connections) { connection in
                Divider()
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(connection.name).font(.subheadline.weight(.semibold))
                    Spacer(minLength: 8)
                    Text(connection.status).font(.caption.weight(.medium)).foregroundStyle(SpotterPalette.muted)
                }
                Text(connection.scopes.map { NativeAgentScope(rawValue: $0)?.title ?? $0 }.joined(separator: " · "))
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                if let expires = connection.expires {
                    Text("到期 \(expires.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                if let lastUsed = connection.lastUsed {
                    Text("最近使用 \(lastUsed.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                if connection.active {
                    Button(revoking == connection.id ? "正在撤销…" : "撤销连接", role: .destructive) {
                        revokeCandidate = connection
                    }.buttonStyle(.spotterControl).disabled(loading || revoking != nil)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .spotterCard()
    }

    private func copy(_ text: String, note: String) {
        UIPasteboard.general.string = text
        notice = note
    }

    private func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let list = try await NativeAgentConnectionAPI.list(api: api, owner: owner)
            guard !Task.isCancelled else { return }
            profileRef = list.profileRef
            connections = list.connections
            errorMessage = nil
        } catch is CancellationError { }
        catch {
            if (error as? NativeAPIError)?.statusCode == 404 {
                errorMessage = "当前站点暂未提供 Agent 连接。"
            } else { errorMessage = error.localizedDescription }
        }
    }

    private func revoke(_ connection: NativeAgentConnection) async {
        guard revoking == nil else { return }
        revoking = connection.id
        defer { revoking = nil }
        errorMessage = nil
        do {
            try await NativeAgentConnectionAPI.revoke(connection.id, api: api, owner: owner)
            if let index = connections.firstIndex(where: { $0.id == connection.id }) {
                connections[index].revokedAt = Date.now.ISO8601Format()
            }
            await load()
        } catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
private struct NativeAgentCreateView: View {
    let api: NativeAPI
    let owner: String
    let didIssue: (NativeAgentConnection) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.spotterAccent) private var accent
    @State private var name = ""
    @State private var days = 30
    @State private var scopes: Set<NativeAgentScope> = [.context, .planDraft]
    @State private var busy = false
    @State private var issued: NativeAgentConnectionAPI.Issued?
    @State private var errorMessage: String?
    @State private var copied = false
    @State private var revealsToken = false

    private var cleanName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        Form {
            if let issued {
                Section("保存这次的令牌") {
                    Text("关闭后无法再次查看这把令牌。请把它填到你信任的工具的凭据栏。")
                    if revealsToken {
                        Text(issued.token).font(.footnote.monospaced()).privacySensitive()
                    }
                    Button(revealsToken ? "隐藏令牌" : "显示令牌", systemImage: revealsToken ? "eye.slash" : "eye") {
                        revealsToken.toggle()
                    }
                    Button(copied ? "已复制令牌" : "复制令牌", systemImage: "key.horizontal") {
                        UIPasteboard.general.setItems([[UTType.plainText.identifier: issued.token]],
                            options: [.localOnly: true, .expirationDate: Date.now.addingTimeInterval(120)])
                        copied = true
                    }
                    .accessibilityIdentifier("spotter-agent-copy-token")
                    Text("令牌会在本机剪贴板保留两分钟。任何时候都可以在连接列表撤销。")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                }
            } else {
                Section("连接信息") {
                    TextField("连接名称，例如训练分析", text: $name)
                        .accessibilityIdentifier("spotter-agent-name")
                    Picker("有效期", selection: $days) {
                        ForEach([7, 30, 60, 90], id: \.self) { Text("\($0) 天").tag($0) }
                    }
                }
                scopeSection("读取权限", scopes: NativeAgentScope.read)
                scopeSection("写入权限", scopes: NativeAgentScope.write)
                Section {
                    if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
                    Button { Task { await create() } } label: {
                        if busy { ProgressView() }
                        else { Text("创建连接").fontWeight(.semibold) }
                    }
                    .disabled(busy || cleanName.isEmpty || cleanName.utf16.count > 60 || scopes.isEmpty)
                    .accessibilityIdentifier("spotter-agent-confirm-create")
                }
            }
        }
        .navigationTitle(issued == nil ? "新建 Agent 连接" : "连接已创建")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(busy)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(issued == nil ? "取消" : "完成") { dismiss() }.disabled(busy)
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase != .active { revealsToken = false }
        }
        .onDisappear { issued = nil }
    }

    private func scopeSection(_ title: String, scopes options: [NativeAgentScope]) -> some View {
        Section(title) {
            ForEach(options) { scope in
                let selected = scopes.contains(scope)
                Button {
                    if selected { scopes.remove(scope) }
                    else { scopes.insert(scope) }
                } label: {
                    HStack {
                        Text(scope.title)
                        Spacer(minLength: 8)
                        Image(systemName: selected ? "checkmark.square.fill" : "square")
                            .foregroundStyle(selected ? accent.tint : SpotterPalette.muted)
                            .accessibilityHidden(true)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .disabled(busy)
                .accessibilityValue(selected ? "已选择" : "未选择")
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier("spotter-agent-scope-" + scope.rawValue)
            }
        }
    }

    private func create() async {
        guard !busy, !cleanName.isEmpty, cleanName.utf16.count <= 60, !scopes.isEmpty else { return }
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            let request = NativeAgentConnectionAPI.Issue(name: cleanName, scopes: scopes.map(\.rawValue).sorted(), expiresInDays: days)
            let result = try await NativeAgentConnectionAPI.issue(request, api: api, owner: owner)
            didIssue(result.connection)
            issued = result
        } catch { errorMessage = error.localizedDescription }
    }
}
