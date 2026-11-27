import { categories, moveBlank, planBlank, planSchema } from "@/features/plans/model";

export type PlanAiIntent = "create" | "organize";

// Both clipboard prompts and tool guides use the same plan model and rules.
// No account records or credentials are included in the ordinary chat prompt.
export function planPromptExample(today: string) {
  return planSchema.parse({ ...planBlank(today), title: "上肢力量", minutes: 45,
    exercises: [{ ...moveBlank(), name: "哑铃卧推", reps: 8, restSeconds: 90, tempo: "2-0-1-0" }] });
}

export const planContentRules = [
  "保留已有动作的 catalogueId 和原名，以及 block（组别）、station（器械站）、sourceSlot（原顺序）、cue（动作备注）、tempo（节奏）、restSeconds（组间／轮间休息）和 repsMax（次数上限）；没有依据的字段可以省略。",
  "每个动作包含 name、sets、reps、weight、unit、seconds。重量未知填 0，单位只能是 kg 或 lb，计时动作使用 seconds。保留分侧说明与实际单位，不把左右侧重量擅自相加。",
  "只有视频链接时，保留 video 原链接，exercises 留空，未知 minutes 填 0；不猜测视频中没有依据的动作或时长。一堂课含多个视频时，每个视频拆成一项。支持原有 YouTube 和 B站链接。",
  "targetRpe 是计划目标，不能冒充实际训练 RPE。loadPercent 仅在用户提供已确认的 1RM 参考时使用，包含 percent、reference、unit；不能自行编造参考重量或把历史 e1RM 当作真实 1RM。",
  "计划 shared 默认 false。训练计划、跟练视频与已完成打卡分别处理，不能把已经完成的训练擅自变成待训练计划。",
] as const;

export function planAiPrompt(today: string, intent: PlanAiIntent = "organize") {
  const task = intent === "create"
    ? "根据我在末尾填写的目标、每周可训练时间、器械和限制，起草新的训练计划。缺少会影响安排的关键信息时先向我确认。"
    : "把我在末尾附上的健身计划、训练笔记、YouTube 或 B站链接整理成可导入的训练计划，保留原来的动作、顺序、组次和单位。";
  return [
    task,
    "这是给我自己的 AI 的任务。Spotter 只接收和校验结果，不会替我调用模型。",
    "输出范围：普通计划每批 1–20 堂。若需要超过 20 堂的完整多周安排，先提示我改用「训练周期」或支持周期的 Agent 工具；不能删掉后面的训练，也不要静默截断。若材料是已完成的打卡，先说明需要走训练记录流程，不输出待训练计划。",
    "范围适合普通计划后，只返回 JSON 数组，每堂训练一个对象，按顺序列出。每项明确写出 date（YYYY-MM-DD）；未约定开始日就从 " + today + " 开始。",
    "category 只能是：" + categories.join("、") + "。minutes 用分钟，defaultRestSeconds 可填写默认动作间休息。",
    ...planContentRules,
    "结构示例（仅展示格式，不要无条件照抄示例动作或组次）：",
    JSON.stringify([planPromptExample(today)]),
    "生成后我会到「设置 → 计划与日程 → 粘贴已有内容」，预览、编辑并确认保存。返回 JSON 不代表已经写入 Spotter。",
    intent === "create" ? "我的训练目标、时间、器械和限制：" : "我的原始训练材料：",
  ].join("\n");
}

export function agentConnectionInstructions(origin: string, profileRef: string) {
  const site = origin.replace(/\/$/, "");
  return [
    "## 连接",
    "内部核对的账号说明编号：" + profileRef + "。账号说明编号只用于核对账号。",
    "使用已配置的连接。远程 MCP 用 " + site + "/api/agent/mcp（Streamable HTTP），自定义 HTTP 可从 " + site + "/api/agent/schema 导入 OpenAPI。支持本站授权的客户端也可用 " + site + "/mcp。仅在工具凭据栏配置个人令牌，作为发往此站点的 Authorization: Bearer。不要在聊天中索取或回显令牌，也不要把它放进链接或日志。",
    "开始新对话或换连接时，先调用只读的 get_spotter_agent_profile，使用 HTTP 时调用 GET /api/agent/profile。在内部核对返回的 profileRef 是否与上面的账号一致，并以返回的权限为准。核对成功后沿用该连接和 profileRef。账号标识、权限代码、令牌、原始响应和日志仅供工具内部使用。当前只是在测试连接时，只核对连接，成功后用中文回复「已连接训练搭子。你想先做什么？」并等待任务。",
    "没有可用工具时，请用户先配置受支持的连接。账号不一致时停止，请用户在正确账号下配置连接。返回 401 时提示检查工具凭据和连接是否到期或撤销。遇到登录页或平台拒绝（如上游 403 或 Cloudflare 1010），停止请求并建议检查受支持的连接方式。Spotter 提示某项权限不足时，用中文说明哪项任务需要权限。仅说明仍存在的错误和可行的下一步。每次写入均遵守该操作的用户确认流程。",
  ];
}

export function agentPlanningGuide(origin: string, profileRef: string, includeConnection = true) {
  return [
    ...(includeConnection ? ["# Spotter · 计划 Agent 接入说明", "", ...agentConnectionInstructions(origin, profileRef)] : []),
    "## 同一条起草流程",
    "1. REST 先 GET /api/agent/profile 核对账号和权限，再 GET /api/agent/schema 获取当前结构；GET /api/agent/context 携带 profileRef，读取获准的动作、模板和编排偏好。MCP 对应 read_spotter_planning_context。按各自 nextOffset 分页，不读取健康、身体、饮食、好友或搭子记录。",
    "2. 根据用户目标在自己的模型中起草。普通计划使用 Plan 结构；规则如下：",
    ...planContentRules.map((rule) => "   - " + rule),
    "3. REST POST /api/agent/drafts，参数 {profileRef,requestId,plans,title?}；MCP 对应 stage_spotter_plans。requestId 是新 UUID，同一份内容重试复用；每批最多 20 堂。草稿出现在「添加计划 → 用自己的 AI」中，可编辑和校验，尚未排入日历。",
    "4. REST GET /api/agent/drafts?id=<draftId> 或 MCP preview_spotter_draft 获取最新 revision 和冲突预览。若用户在网页修改了草稿，必须重新读取，不得用旧 revision 确认。",
    "5. 由用户在网页确认；只有用户明确授权本批写入且个人令牌具有 plans:write 时，才可 POST /api/agent/commit，参数 {profileRef,draftId,revision,confirmed:true}。MCP 对应 commit_spotter_draft。只有读取／草稿权限时不能直接排入日历，不能使用普通导入的同名更新选项绕过此边界。",
    "6. 完整周期使用 Program（最多 52 周、364 堂），保留完整 sessions，不截断为普通 20 堂草稿。REST /api/agent/programs 的 stage → preview → commit，或 MCP stage_spotter_program → preview_spotter_program → commit_spotter_program；确认时使用最新 revision 和 previewToken。网页周期草稿在「训练周期」查看。",
    "7. 报告实际 added/updated/skipped 和日期范围；失败时不能说已保存。保留其他账号、进行中、已完成和已独立修改的记录。",
    "", "没有工具连接的普通聊天 AI 使用「添加计划」里的起草／整理提示词，返回 JSON 后粘贴预览即可。客户端能否接入取决于其工具与认证能力，不因模型品牌而自动获得访问。旧 add_spotter_plans 工具保持兼容，新接入优先采用以上草稿与确认流程。",
  ].join("\n") + "\n";
}
