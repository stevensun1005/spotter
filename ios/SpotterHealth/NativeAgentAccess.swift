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

    case templatesManage = "templates:manage", exerciseDemos = "exercise-demos:write"

    static let read: [Self] = [.context, .trainingRead, .nutritionRead, .templatesRead]
    static let write: [Self] = [.planDraft, .planWrite, .nutritionWrite, .trainingWrite, .bodyWrite, .templatesWrite, .templatesManage, .exerciseDemos]

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
        case .templatesManage: return "改名、编辑或删除个人模板"
        case .exerciseDemos: return "添加或移除个人演示动图"
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

private func nativeAgentPrompt(origin: String, profileRef: String) -> String {
    """
    你是我的训练搭子 Agent。内部核对的账号标识是 \(profileRef)。
    使用已配置的连接。远程 MCP 用 \(origin)/api/agent/mcp（Streamable HTTP），自定义 HTTP 可从 \(origin)/api/agent/schema 导入 OpenAPI。仅在工具凭据栏配置个人令牌，作为发往此站点的 Authorization: Bearer。不要在聊天中索取或回显令牌，也不要把它放进链接或日志。
    开始新对话或换连接时，先调用只读的 get_spotter_agent_profile，使用 HTTP 时调用 GET /api/agent/profile。在内部核对返回的 profileRef 是否与上面的账号一致，并以返回的权限为准。核对成功后沿用该连接和 profileRef。账号标识、权限代码、令牌、原始响应和日志仅供工具内部使用。当前只是在测试连接时，只核对连接，成功后用中文回复「已连接训练搭子。你想先做什么？」并等待任务。
    没有可用工具时，请我先配置受支持的连接。账号不一致时停止，请我在正确账号下配置连接。返回 401 时提示检查工具凭据和连接是否到期或撤销。遇到登录页或平台拒绝（如上游 403 或 Cloudflare 1010），停止请求并建议检查受支持的连接方式。Spotter 提示某项权限不足时，用中文说明哪项任务需要权限。仅说明仍存在的错误和可行的下一步。每次写入均遵守该操作的用户确认流程。

    读取与分析：用 read_spotter_records（GET /api/agent/records）分开读取已授权的 training、nutrition 或 templates。按 nextOffset 分页，用户未指定日期时以最近 30 天为参考（模板不用日期）。说明数据覆盖、趋势和缺项。
    核对动作：生成或导入包含动作的计划、周期或模板前，先用 read:context 调用 read_spotter_planning_context（GET /api/agent/context），查我自己的 Spotter 动作库和内置目录。按各自的 nextOffset 翻页。以相同的标准目录 ID、已有明确对应的别名或规范化后完全相同的名称确认同一动作，并沿用已有动作的名称和目录 ID（如有）。器械、握法或姿势不同等相近变式各自保留。遇到多个可能结果时先和我核对。缺少读取权限时说明，并在取得权限后确认是否有新动作。
    安排训练：按目标、器械、每周天数和开始日期，用核对过的动作和模板起草。保留组次、节奏、单位和分侧。只有跟练链接时保留 video，放进「跟练视频」。用 stage_spotter_plans 提交私人草稿，调用 preview_spotter_draft 核对最新预览。我确认后才用 commit_spotter_draft 排日历。完整周期用 stage_spotter_program、preview_spotter_program、commit_spotter_program。重复提交同一草稿沿用 requestId。
    新增记录：餐食用 add_spotter_meals，按实际日期、餐次、份量和营养写入，估算项标明。常用食物可用 add_spotter_foods。已完成训练、身体测量、饮水及个人模板用 import_spotter_records，选对应类别并使用同一条记录 ID 重试。只写我确认的实际内容。
    编辑个人模板：先读 templates，获取 templateId（记录 id）和 revision。用 preview_spotter_template_change（POST /api/agent/templates）预览改名、动作编辑或删除。修改动作时保留其余组次和动作元数据。拿到我的确认后才用 commit_spotter_template_change 提交本次 previewToken。遇到版本冲突重新读取。
    动作示范。在我要求为计划或模板添加示范后，先核对动作库，再用 read:context 调用 get_spotter_exercise_demo_skill（POST /api/agent/exercise-demo-skill），传 profileRef、准确 name 和已有的 catalogueId。只加新动作时，可以问我是否需要制作示范。
    收到 reuse_catalogue 或 reuse_personal 时沿用已有动作和示范。收到 render_personal 时，从 Spotter 站点打开返回的 skill.downloadUrl，按包内 SKILL.md 本地生成 GIF。渲染器只需要动作说明。
    所有新做或重做的示范默认使用 Spotter 原创 3D 风格。用连续蒙皮的浅灰人体、深色运动服、浅灰背景、柔和阴影、目标肌肉高亮和准确器械，渲染完整动作循环。封面从成片取帧。不要以线条人、静帧或外部现成素材代替。
    我确认该动图后，使用 exercise-demos:write 调用 manage_spotter_exercise_demo（POST /api/agent/exercise-demos），传 action:save、profileRef、准确 name、纯 base64 的 gifBase64 及 confirmed:true。GIF 最大 768 KiB，最长边 480 像素，2–90 帧，总画面像素不超过 900 万。替换或移除也须先确认。无法制作时照常保存计划或模板，并告诉我示范还未添加。

    我会告诉你要做哪件事。完成后用实际回执告诉我新增、修改、删除或跳过的记录和日期。
    """
}

@MainActor
struct NativeAgentTutorialView: View {
    var onFinish: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var page = 0
    @AccessibilityFocusState private var focusHeading: Bool

    private enum Step: Int, CaseIterable {
        case permission, configuration, prompts, verification

        var title: String {
            switch self {
            case .permission: return "创建连接，选好权限"
            case .configuration: return "到自己的 AI 添加工具"
            case .prompts: return "复制提示词，发一个任务"
            case .verification: return "查看结果，管理连接"
            }
        }

        var icon: String {
            switch self {
            case .permission: return "key.horizontal"
            case .configuration: return "point.3.connected.trianglepath.dotted"
            case .prompts: return "text.bubble"
            case .verification: return "checkmark.shield"
            }
        }

        var instruction: String {
            switch self {
            case .permission:
                return "在「外部 Agent」点「新建 Agent 连接」，填写连接名称和有效期。权限默认全选，可以直接点底部的「创建连接」，也可以先点「取消全选」再按要做的任务勾选。每个 AI 工具可以单独建一条连接。"
            case .configuration:
                return "连接创建成功后会回到「复制提示词」。首次设置工具时，在这张卡上点「复制令牌」，填到自己 AI 的工具凭据栏。"
            case .prompts:
                return "点「复制提示词」并粘贴到自己 AI 的对话框。它会核对连接，成功后你就可以告诉它要做什么。"
            case .verification:
                return "让 AI 说明实际读取或保存的结果。回到「我的连接」，刷新后可看「最近使用」、权限和到期时间。"
            }
        }
    }

    private var step: Step { Step.allCases[page] }
    private var lastPage: Bool { page == Step.allCases.count - 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                Text(step.instruction)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                details
            }
            .frame(maxWidth: 520, alignment: .leading)
            .padding(16)
            .frame(maxWidth: .infinity)
        }
        .id(step)
        .foregroundStyle(SpotterPalette.ink)
        .background(SpotterPalette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { controls }
        .navigationTitle("用自己的 AI")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("关闭", action: finish) }
        }
        .onChange(of: step) { _ in focusHeading = true }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 9) {
            ProgressView(value: Double(page + 1), total: Double(Step.allCases.count))
                .tint(accent.tint)
                .accessibilityHidden(true)
            Label("第 \(page + 1) 步，共 \(Step.allCases.count) 步", systemImage: step.icon)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(accent.tint)
            Text(step.title)
                .font(.title2.weight(.heavy))
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($focusHeading)
                .accessibilityIdentifier("spotter-agent-tutorial-step")
        }
    }

    @ViewBuilder private var details: some View {
        switch step {
        case .permission:
            tip("分析记录", icon: "chart.xyaxis.line", detail: "只想分析时，可以只保留要分析的读取项，例如「读取训练计划与打卡」或「读取饮食与饮水」。")
            tip("训练计划", icon: "calendar", detail: "打开「读取编排资料」，让 AI 先核对你的动作库并沿用同一动作。创建草稿需打开「保存训练草稿」，排入日历还需打开「将确认的计划加入日历」。")
            tip("模板与动作示范", icon: "film.stack", detail: "管理模板时，开启「读取个人模板」和「改名、编辑或删除个人模板」。让 Agent 用 Spotter 技能为新动作做示范时，开启「读取编排资料」和「添加或移除个人演示动图」。")
            tip("记饮食", icon: "fork.knife", detail: "打开「新增饮食与饮水」。需要在记餐前核对当天已有记录时，也可打开「读取饮食与饮水」。")
        case .configuration:
            tip("MCP 客户端", icon: "point.3.connected.trianglepath.dotted", detail: "在自己 AI 的工具或连接器设置里，添加远程 MCP 工具，传输方式选 Streamable HTTP，使用复制的提示词里的 MCP 地址。把令牌放进凭据栏，或设置 Authorization 请求头，值为 Bearer 后接空格和令牌。")
            tip("自定义 HTTP 工具", icon: "network", detail: "用复制的提示词里的 OpenAPI 地址导入接口说明，使用相同的 Bearer 认证。你的 AI 客户端需要支持配置工具及认证头。")
            tip("令牌放在凭据设置", icon: "lock", detail: "对话里粘贴「复制提示词」得到的文字。令牌只填到 AI 工具的凭据栏。")
        case .prompts:
            tip("分析记录示例", icon: "chart.xyaxis.line", detail: "「看我最近 7 天的训练记录，总结频率和训练重点。」")
            tip("制定计划示例", icon: "calendar", detail: "「帮我整理下周三练的哑铃计划。先查我的动作库，相同动作沿用，变式各自保留。保存草稿后给我看日期和组次。」")
            tip("记录饮食示例", icon: "fork.knife", detail: "「帮我记今天早餐的一杯牛奶，约 250 毫升。先让我核对份量和营养。」")
        case .verification:
            tip("核对你的记录", icon: "checkmark.circle", detail: "确认计划预览后，到「训练 → 我的计划」查排入的日期。确认餐食后，到「今日 → 饮食记录」看对应餐次。")
            tip("检查权限和连接状态", icon: "slider.horizontal.3", detail: "提示连不上时，检查工具地址、令牌和有效期。能连接但无法完成任务时，核对这条连接是否有对应权限。")
            tip("停用一条连接", icon: "key.slash", detail: "在「我的连接」选择对应的「撤销连接」。旧令牌会失效，需要再次使用时可新建连接。")
        }
    }

    private func tip(_ title: String, icon: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(accent.tint)
            Text(detail)
                .font(.subheadline)
                .foregroundStyle(SpotterPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(13)
        .spotterCard()
    }

    private var controls: some View {
        HStack(spacing: 10) {
            if page > 0 {
                Button("上一步") { page -= 1 }
                    .buttonStyle(.spotterControl)
                    .accessibilityIdentifier("spotter-agent-tutorial-prev")
            }
            Button {
                if lastPage { finish() }
                else { page += 1 }
            } label: {
                Text(lastPage ? "完成教学" : "下一步")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterPrimaryControl)
            .accessibilityIdentifier("spotter-agent-tutorial-next")
        }
        .frame(maxWidth: 520)
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(SpotterPalette.background)
    }

    private func finish() {
        dismiss()
        onFinish?()
    }
}

@MainActor
struct NativeAgentAccessView: View {
    let api: NativeAPI
    let owner: String
    var showsClose = false

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterGuide) private var guide
    @State private var connections: [NativeAgentConnection] = []
    @State private var profileRef: String?
    @State private var issued: NativeAgentConnectionAPI.Issued?
    @State private var tokenCopied = false
    @State private var loading = false
    @State private var creating = false
    @State private var revokeCandidate: NativeAgentConnection?
    @State private var revoking: String?
    @State private var errorMessage: String?
    @State private var notice: String?

    private var isGuidedTutorial: Bool { guide?.step == .agentTutorial }

    var body: some View {
        ScrollViewReader { scroll in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    intro
                    if let profileRef { setup(profileRef).id("agent-prompt") }
                    connectionList
                }
                .frame(maxWidth: 520, alignment: .leading)
                .padding(15)
                .frame(maxWidth: .infinity)
            }
            .onChange(of: creating) { open in
                if !open && issued != nil { scroll.scrollTo("agent-prompt", anchor: .top) }
            }
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .nativeGuideLayer(.agentAccess)
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
                NativeAgentCreateView(api: api, owner: owner) { result in
                    let connection = result.connection
                    connections = [connection] + connections.filter { $0.id != connection.id }
                    issued = result
                    tokenCopied = false
                    notice = nil
                    creating = false
                }
            }
            .presentationDragIndicator(.visible)
        }
        .onDisappear {
            issued = nil
            tokenCopied = false
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
            .disabled(profileRef == nil || revoking != nil || isGuidedTutorial)
            .accessibilityIdentifier("spotter-agent-create")
            NavigationLink {
                NativeAgentTutorialView(onFinish: { guide?.advance(.agentTutorial) })
            } label: {
                Label("使用教学", systemImage: "book").frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterControl)
            .accessibilityIdentifier("spotter-agent-tutorial")
            .nativeGuideTarget(.agentTutorial)
        }
        .padding(15)
        .spotterCard()
    }

    private func setup(_ profileRef: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if issued != nil {
                Label("连接创建成功", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpotterPalette.deep)
                    .accessibilityIdentifier("spotter-agent-created")
            }
            Text("复制提示词").font(.headline).accessibilityAddTraits(.isHeader)
            Text("复制后粘贴到你自己的 AI 对话框，告诉它你想做什么。连接地址和全部用法都在里面。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
            Button("复制提示词", systemImage: "doc.on.doc") {
                copy(nativeAgentPrompt(origin: api.origin, profileRef: profileRef), note: "提示词已复制。")
            }
            .buttonStyle(.spotterPrimaryControl)
            .accessibilityIdentifier("spotter-agent-copy-prompt")
            if let issued {
                Divider()
                Text("首次连接时，把令牌填到 AI 工具的凭据栏。离开本页后随时可在「我的连接」撤销。")
                    .font(.footnote).foregroundStyle(SpotterPalette.muted)
                Button(tokenCopied ? "已复制令牌" : "复制令牌", systemImage: "key.horizontal") {
                    UIPasteboard.general.setItems([[UTType.plainText.identifier: issued.token]],
                        options: [.localOnly: true, .expirationDate: Date.now.addingTimeInterval(120)])
                    tokenCopied = true
                    notice = "令牌会在本机剪贴板保留两分钟。"
                }
                .buttonStyle(.spotterControl)
                .accessibilityIdentifier("spotter-agent-copy-token")
            }
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
                    }
                    .buttonStyle(.spotterControl)
                    .disabled(loading || revoking != nil || isGuidedTutorial)
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
            if issued?.connection.id == connection.id { issued = nil; tokenCopied = false }
            await load()
        } catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
private struct NativeAgentCreateView: View {
    let api: NativeAPI
    let owner: String
    let didIssue: (NativeAgentConnectionAPI.Issued) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var name = ""
    @State private var days = 30
    @State private var scopes = Set(NativeAgentScope.allCases)
    @State private var busy = false
    @State private var errorMessage: String?

    private var cleanName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var allSelected: Bool { scopes.count == NativeAgentScope.allCases.count }
    private var canCreate: Bool { !busy && !cleanName.isEmpty && cleanName.utf16.count <= 60 && !scopes.isEmpty }

    var body: some View {
        Form {
            Section("连接信息") {
                TextField("连接名称，例如训练分析", text: $name)
                    .accessibilityIdentifier("spotter-agent-name")
                Picker("有效期", selection: $days) {
                    ForEach([7, 30, 60, 90], id: \.self) { Text("\($0) 天").tag($0) }
                }
            }
            scopeSection("读取权限", scopes: NativeAgentScope.read)
            Section {
                scopeRows(NativeAgentScope.write)
            } header: {
                Text("写入权限")
            } footer: {
                Text("新建连接默认全选授权。可以单独取消不需要的权限，也可以用底部按钮一键全选或取消全选。")
            }
        }
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { controls }
        .navigationTitle("新建 Agent 连接")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(busy)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
        }
    }

    private var controls: some View {
        let stacked = typeSize.isAccessibilitySize
        let layout = stacked ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))
        return VStack(alignment: .leading, spacing: 8) {
            if let errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            layout {
                Button {
                    scopes = allSelected ? [] : Set(NativeAgentScope.allCases)
                } label: {
                    Label(allSelected ? "取消全选" : "全选授权", systemImage: allSelected ? "square" : "checkmark.square")
                        .frame(maxWidth: stacked ? .infinity : nil)
                }
                .buttonStyle(.spotterControl)
                .disabled(busy)
                .accessibilityHint(allSelected ? "取消全部读取和写入权限" : "选中全部读取和写入权限")
                .accessibilityIdentifier("spotter-agent-scope-all")
                Button { Task { await create() } } label: {
                    Group {
                        if busy { ProgressView() }
                        else { Text("创建连接") }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.spotterPrimaryControl)
                .disabled(!canCreate)
                .accessibilityIdentifier("spotter-agent-confirm-create")
            }
        }
        .frame(maxWidth: 520, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(SpotterPalette.background)
    }

    private func scopeSection(_ title: String, scopes options: [NativeAgentScope]) -> some View {
        Section(title) { scopeRows(options) }
    }

    private func scopeRows(_ options: [NativeAgentScope]) -> some View {
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

    private func create() async {
        guard canCreate else { return }
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            let request = NativeAgentConnectionAPI.Issue(name: cleanName, scopes: scopes.map(\.rawValue).sorted(), expiresInDays: days)
            let result = try await NativeAgentConnectionAPI.issue(request, api: api, owner: owner)
            didIssue(result)
        } catch { errorMessage = error.localizedDescription }
    }
}
