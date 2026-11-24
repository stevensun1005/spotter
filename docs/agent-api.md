# 用户自己的 AI Agent 接入 Spotter

Spotter 提供工具接口，由用户自己的 AI Agent 负责理解目标、生成和修改计划。站点不调用模型 API，不保存 GPT、Claude、Grok、Muse 等模型服务的密钥。能否接入取决于客户端是否支持目标站点的授权 MCP 或自定义 HTTP 工具；本轮没有把任何品牌客户端列为已在线验证。

## 两种入口

| 方式 | 入口与身份 | 可用条件 |
| --- | --- | --- |
| 现有 Sites 授权连接 | `/mcp`，继续使用 Sites 平台提供的授权身份；先调用 `get_spotter_agent_profile` | 客户端能够连接该站点的受支持 MCP 授权入口 |
| 个人 Agent API | `/api/agent/*`，`Authorization: Bearer <个人连接令牌>` | HTTP 请求必须实际到达 Worker；私密 Sites 平台可能在此之前要求登录 |

个人令牌不是 Sites 平台绕过令牌，不能绕过私密站点的访问策略。若自定义 HTTP 请求先收到登录页、跳转或平台拒绝，应用层 Bearer 校验尚未执行；不要将其描述为 API 已连接。优先使用平台支持的 MCP 连接，或后续提供独立、受支持的 API 授权入口。当前未改变 Sites 访问权限，也未向 Agent 下发平台级 bypass token。

## 在网页创建连接

在「AI 连接」中为每个 Agent 单独创建连接，默认仅选择读取上下文和提交草稿。有效期为 1–90 天，最多 20 个有效连接。

- `read:context`：读取自己的动作库、模板、编排规则、周期概要及内置动作搜索。
- `plans:draft`：提交或读取个人计划、周期草稿，不能自动排入日历。
- `plans:write`：在用户明确授权并提供确认字段后，将已预览的草稿排入日历。此权限由用户显式勾选，不默认授予。

原始令牌仅在创建响应中展示一次，服务端只保存 SHA-256 哈希。网页列表显示名称、权限、有效期和最近使用时间；可随时撤销。新请求会检查过期和撤销状态；已在处理的请求可能完成。每个令牌每分钟最多 60 个请求，超出返回 429。

将个人令牌配置到 Agent 工具运行环境的凭据栏，不作为模型 API key，不放进普通聊天提示、URL、Git 或日志。账号说明编号 `profileRef` 只用于核对账号，不能代替授权令牌。

## REST 工作流

所有写入使用 `Content-Type: application/json`。本节的 origin、令牌、账号编号、UUID 和日期均为占位或合成示例。

1. `GET /api/agent/profile`：返回此连接的 `profileRef` 和权限。
2. `GET /api/agent/schema`：取得 OpenAPI 3.1 和 Plan/Program 结构。
3. `GET /api/agent/context?profileRef=...&query=卧推&offset=0&limit=50`：读取编排所需内容。个人库和内置动作分别报告 `nextOffset`；按返回值继续分页。每页 1–100 项，不读取身体、心率、饮食、好友或搭子数据。
4. Agent 在自己的模型中生成草稿，保持动作 ID、原名、器械站、组别、休息、节奏、次数范围和单位；未知重量用 0。目标 RPE 与实际记录分开，%1RM 需要用户明确提供参考值和单位。
5. `POST /api/agent/drafts`：保存可编辑草稿，尚不加入日历。

```json
{
  "profileRef": "spotter_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "requestId": "11111111-1111-4111-8111-111111111111",
  "title": "合成示例：上肢训练",
  "plans": [{
    "title": "上肢力量",
    "date": "2026-12-01",
    "category": "力量训练",
    "minutes": 45,
    "shared": false,
    "video": "",
    "exercises": [{
      "name": "哑铃卧推", "sets": 3, "reps": 8,
      "weight": 0, "unit": "kg", "seconds": 0,
      "restSeconds": 90, "tempo": "2-0-1-0", "targetRpe": 7
    }]
  }]
}
```

每批最多 20 次训练，普通草稿请求不超过 500 KB。相同重试保留 `requestId`，不同内容用新 ID。响应包含 `id`、`revision`、ISO 时间、完整计划和日期冲突预览。网页可以编辑未提交草稿；Agent 修改后的新版本可使用新 requestId 起草。

`GET /api/agent/drafts` 列出自己的草稿，`GET /api/agent/drafts?id=<UUID>` 返回预览。草稿有效期 30 天。网页编辑走浏览器会话和同源校验，保存时携带上次 `revision`，并返回新的 revision。

用户确认后，有 `plans:write` 的 Agent 才能调用 `POST /api/agent/commit`：

```json
{
  "profileRef": "spotter_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "draftId": "11111111-1111-4111-8111-111111111111",
  "revision": "<最新预览返回的64位哈希>",
  "confirmed": true
}
```

如果只授予草稿权限，用户在网页预览、编辑并确认即可。返回实际 `added`、`skipped`、日期范围和计划 ID；重复确认返回已记录的结果，不重复插入。日期设置、草稿或相关记录变化时返回 409，需重新预览。这个接口只追加计划，不覆盖已完成、进行中或已经修改的记录，计划默认私密。

## 完整多周周期

`Program` 使用稳定 UUID 关联周期、阶段和每次训练，不依赖标题解析。最多 52 周、364 次训练，请求不超过 1.5 MB；超过限制会拒绝，不会截断。结构见 `/api/agent/schema` 的 `components.schemas.Program`。

`POST /api/agent/programs` 有三个动作：

- `stage`：`{action, profileRef, program, revision}`，首次 revision 为 null，之后使用最新返回值；仅保存周期草稿。
- `preview`：`{action, profileRef, programId, revision}`，返回各训练的新建、更新、自定义、保护和冲突状态，以及预览 `token`。
- `commit`：`{action, profileRef, programId, revision, previewToken, confirmed:true}`，`previewToken` 取上一步的 token。只有获得写入权限和用户授权才执行；已自定义、已开始、已完成或删除的记录保持现有保护规则。

周期各训练的日期必须等于 `startDate + (week-1)*7 + day-1`；day 为相对周期起始日的 1–7。阶段不能重叠，计划不得共享或引用可变的模板链接。周期 API 与网页使用同一套校验和提交逻辑。

## MCP 工具

现有 `/mcp` 保留原有账号、计划、食品和备份工具，增加：

- `read_spotter_planning_context`
- `stage_spotter_plans` → `preview_spotter_draft` → `commit_spotter_draft`
- `stage_spotter_program` → `preview_spotter_program` → `commit_spotter_program`

新增工具的输入均要求核对 `profileRef`。旧站点连接由已认证的 Sites 账号确定 owner；API 令牌连接的 owner 由令牌确定，不接收调用者传入 owner。

`/api/agent/mcp` 提供同一套编排工具，按令牌 scope 过滤发现列表，并在实际调用时再次检查权限。支持 JSON Streamable HTTP 的请求/响应子集：`server/discover`、`initialize`、`ping`、`tools/list`、`tools/call` 和通知；没有 SSE 或主动服务器推送。兼容 2026-07-28 的 stateless discovery，以及 2025-11-25、2025-06-18、2025-03-26 的 initialize 入口；参见 [MCP 官方协议版本说明](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)。不要据此声称客户端或协议全功能认证已完成。

## 验证范围

合成 D1/生产路由测试覆盖：过期、撤销、账号隔离、权限限制、限流、草稿编辑锁、确认幂等、休息日/历史保护；旧 Sites `/mcp` 工具仍可发现，新工具可完成计划及周期的草稿→预览→提交；外部 REST 在无浏览器会话的测试环境按 Bearer 工作。所有样本为合成数据，没有访问真实用户健康记录。

测试不等于私密 Sites dispatch 已允许任意外部 HTTP 客户端；未对每个 GPT/Claude/Grok/Muse 客户端执行真实在线授权。本轮按用户约定不发布正式 Sites，后续上线及真实客户端验证以实际结果为准。
