# 用户自己的 AI Agent 接入 Spotter

使用外部 Agent 工具接口时，用户自己的 AI Agent 负责理解目标和准备数据，Spotter 校验并处理已授权的请求。可新增计划、训练记录、餐食、常用食物、身体数据和模板。站内对话和拍照识别复用同一套服务，见 [站内 AI 配置](ai-coach.md)。

## 两种入口

| 方式 | 入口与身份 | 可用条件 |
| --- | --- | --- |
| 现有 Sites 授权连接 | `/mcp`，继续使用 Sites 平台提供的授权身份；先调用 `get_spotter_agent_profile` | 客户端能够连接该站点的受支持 MCP 授权入口 |
| 个人 Agent API | `/api/agent/*`，`Authorization: Bearer <个人连接令牌>` | HTTP 请求必须实际到达 Worker；私密 Sites 平台可能在此之前要求登录 |

个人令牌不是 Sites 平台绕过令牌，不能绕过私密站点的访问策略。若自定义 HTTP 请求先收到登录页、跳转或平台拒绝，应用层 Bearer 校验尚未执行；不要将其描述为 API 已连接。优先使用平台支持的 MCP 连接，或后续提供独立、受支持的 API 授权入口。当前未改变 Sites 访问权限，也未向 Agent 下发平台级 bypass token。

## 创建个人连接

在 iPhone App 的「设置 → 外部 AI Agent」，或网页的「添加计划 → 用自己的 AI」中，为每个 Agent 单独创建连接。默认仅选择读取编排上下文和提交草稿。有效期为 1–90 天，最多 20 个有效连接。

- `read:context`：读取自己的动作库、模板、编排规则、周期概要及内置动作搜索。
- `training:read`、`nutrition:read`、`templates:read`：分别授权读取个人训练计划和打卡、餐食和饮水、个人训练模板。Apple 健康读数、身体数据、好友和搭子记录保持私密。
- `plans:draft`：提交或读取个人计划、周期草稿，不能自动排入日历。
- `plans:write`：在用户明确授权并提供确认字段后，将已预览的草稿排入日历。此权限由用户显式勾选，不默认授予。
- `training:write`、`nutrition:write`、`body:write`、`templates:write`：分别授权新增已完成训练、饮食和水及常用食物、身体数据、个人模板。创建连接时分别勾选。
- `templates:manage`：预览后改名、修改动作或删除个人模板。另勾选 `templates:read` 获取模板编号和版本。
- `exercise-demos:write`：对用户确认过的自定义动作保存、替换或移除个人演示 GIF。

原始令牌仅在创建响应中展示一次，服务端只保存 SHA-256 哈希。网页列表显示名称、权限、有效期和最近使用时间；可随时撤销。新请求会检查过期和撤销状态；已在处理的请求可能完成。每个令牌每分钟最多 60 个请求，超出返回 429。

将个人令牌配置到 Agent 工具运行环境的凭据栏，不作为模型 API key，不放进普通聊天提示、URL、Git 或日志。账号说明编号 `profileRef` 只用于核对账号，不能代替授权令牌。

新建连接成功后回到「复制提示词」，一段指令包含分析记录、训练计划、饮食、身体、模板、动图，以及 MCP 和 OpenAPI 地址。首次连接可在同一张卡复制令牌，把它存到工具连接的凭据栏，再将提示词粘贴到 Agent 对话框。App 可从「设置 → 外部 Agent → 使用教学」查看详细步骤。

## REST 工作流

所有写入使用 `Content-Type: application/json`。本节的 origin、令牌、账号编号、UUID 和日期均为占位或合成示例。

1. `GET /api/agent/profile`：返回此连接的 `profileRef` 和权限。
2. `GET /api/agent/schema`：取得 OpenAPI 3.1 和 Plan/Program 结构。
3. `GET /api/agent/context?profileRef=...&query=卧推&offset=0&limit=50`：读取编排所需内容。个人库和内置动作分别报告 `nextOffset`；按返回值继续分页。每页 1–100 项，不读取身体、心率、饮食、好友或搭子数据。
4. Agent 先用当前账号的动作库核对输入，再生成草稿。标准目录 ID 一致、明确登记为同一动作的别名或规范化后完全相同的名称可用于复用。沿用已匹配的动作名称和目录 ID（如有）。器械、握法或姿势不同等相近变式各自保留，多个可能结果交给用户核对。保留器械站、组别、休息、节奏、次数范围和单位。未知重量用 0。目标 RPE 与实际记录分开，%1RM 需要用户提供参考值和单位。
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

## 读取记录与记餐

- `GET /api/agent/records?profileRef=...&scope=training&from=2026-11-01&to=2026-11-30` 按对应权限读取一类记录。选 `nutrition` 读取餐食和饮水，选 `templates` 读取个人训练模板。日期包含首尾，训练和饮食最多查 366 天，省略两端时查最近 30 天。用返回的 `nextOffset` 继续分页，每页最多 50 条。模板查询无需日期。
- `POST /api/agent/meals` 接受 `profileRef`、`confirmed: true` 以及最多 20 项的 `meals`。每项提供 `id`、`date`、`meal`、`name`、`calories`、`protein`、`carbs`、`fat` 和可选的 `grams`。热量用千卡，份量和宏量营养用克。餐次为早餐、午餐、晚餐或加餐。明确记餐后才写入，重试复用原 UUID。

## 管理个人训练模板

通过 `GET /api/agent/records?scope=templates&profileRef=...` 读取模板的 `id` 和 `revision`。对 `POST /api/agent/templates` 提交 `{action:"preview",profileRef,templateId,revision,change}`。改名或编辑动作使用 `change: {kind:"update",title?,exercises?}`，填写至少一项；删除使用 `change: {kind:"delete"}`。如果要修改个别动作，先读原模板再提供完整的更新后动作列表。

向用户展示变更和已安排训练受影响的情况。用户确认后提交 `{action:"commit",profileRef,previewToken,confirmed:true}`。预览有效 15 分钟，成功回执可重试 24 小时。其他客户端改过模板时重新预览。删除会保留并解除已排训练的模板关联，已打卡历史仍可查看。对应 MCP 工具为 `preview_spotter_template_change` 和 `commit_spotter_template_change`。

## 用 Spotter 技能生成动作示范

从视频或其他材料整理计划、周期或模板时，先调用 `read_spotter_planning_context` 或 `GET /api/agent/context`。确认用户要动作示范后，使用同一个连接调用 `get_spotter_exercise_demo_skill` 或 `POST /api/agent/exercise-demo-skill`，请求包含 `profileRef`、`name` 和已核准动作的可选 `catalogueId`。查询需要 `read:context`。

所有新演示和替换动画都默认用 Spotter 原创 3D 样片风格，包括为个人动作生成的 GIF。使用技能内的连续蒙皮浅灰人体、深色运动短裤和鞋、浅灰背景、柔和阴影及局部肌肉高亮。准确搭建设备、握法、支点和运动轨迹，渲染完整循环。封面从成片取帧。目录动作 `2966`、`3668` 和 `5609` 是可预览的样片。线条人、静帧拼接、近似动作及现成外部媒体不作为默认输出。暂时不能做出准确演示时，报告该动作的演示还未生成。

- `reuse_catalogue` 返回同一标准动作的 ID。已升级的动作还返回原创 3D 媒体路径，直接用该 ID。其他标准动作继续显示原示范，也可在本地做单独的预览。
- `reuse_personal` 表示当前账号已有同名个人示范。要替换时，经用户确认后渲染并上传。
- `render_personal` 返回 [Spotter 渲染技能](../../skills/spotter-exercise-demo/SKILL.md) 的下载地址和保存权限。Agent 在自己可执行的工具环境运行技能，按实际动作编制人体与器械关键帧，用浏览器本地生成并核对 GIF。包内有离线渲染页面和命令行入口。训练记录、用户照片和账号凭据不进渲染配方。
- 用户明确要求保存该动作的示范且令牌具备 `exercise-demos:write` 时，通过 `POST /api/agent/exercise-demos` 或 `manage_spotter_exercise_demo` 提交 `{action:"save",profileRef,name,gifBase64,confirmed:true}`。使用原始 GIF 的 base64，最长边 480 像素、大小不超过 768 KiB、有 2–90 帧且总画面像素不超过 900 万。服务按账号和动作名保存，原样重试使用同一个名字。移除用 `{action:"remove",profileRef,name,confirmed:true}`。

iPhone 和 Cloudflare 网页在本人动作详情中读取已保存的演示。没有示范也可保存计划。原始跟练链接仍保存在计划的 `video`，在「跟练视频」显示。

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

`/api/agent/mcp` 按令牌权限提供编排及记录工具，并在调用时再次检查权限。按需提供 `read_spotter_records`、`add_spotter_meals`、`get_spotter_exercise_demo_skill` 和 `manage_spotter_exercise_demo`。支持 JSON Streamable HTTP 的请求、响应和通知。发现、初始化和工具调用兼容相应协议版本。 [MCP 官方协议版本说明](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)

### 直接添加记录

先读取 `profileRef`。取得本次写入授权后，调用 `/api/agent/records` 或 `import_spotter_records`。单批使用一个 `scope`，填 `training`、`nutrition`、`body` 或 `templates`，带上 `confirmed: true`，并在 `backup` 中提供 1–20 条同类记录。照片由外部 Agent 自己识别时，将用户核对过的食物、份量和营养写成 `kind: "nutrition"` 的 `meal` 条目。`nutrition:write` 还可以调用 `add_spotter_foods` 新增常用食物。

重试需复用 UUID，服务返回实际新增和跳过数量。已保存的条目按追加规则去重。计划和周期使用上述草稿及确认流程。可用请求结构见 `/api/agent/schema`。

## 验证范围

合成 D1/生产路由测试覆盖：过期、撤销、账号隔离、权限限制、限流、草稿编辑锁、确认幂等、休息日/历史保护；旧 Sites `/mcp` 工具仍可发现，新工具可完成计划及周期的草稿→预览→提交；外部 REST 在无浏览器会话的测试环境按 Bearer 工作。所有样本为合成数据，没有访问真实用户健康记录。

应用层使用合成账号验证。外部客户端还需完成私密 Sites 的平台授权。
