# 配置站内 AI 教练与拍照识别

从「设置 → AI 教练」或「添加计划 → 站内 AI 教练」打开：

- **自由对话**是教练的默认入口。可以直接问训练问题，或打开饮食、训练统计、体重和训练记录。
- 点「生成计划」或在输入框提出排训练计划，教练会在同一对话里逐步询问动作限制、场景、预设、正式与热身动作以及计划设置。可生成 1、2 或 4 周，每批最多 12 堂。

两种方式都沿用「添加计划」中的预览和保存流程。Haiku 5.5 是默认模型，Sonnet 5.5 可以单独开启。复制提示词、粘贴计划和外部 Agent 连接仍使用原入口。

从「首页 → 饮食记录 → AI 识别」进入 AI 教练的餐食拍照页。日期和餐次随记录带入，拍照或选图后填入食物、份量和营养草稿，确认保存后回到原来那天的饮食记录。食品包装可从食物库的拍照入口识别每 100 克数值。识别复用站内 AI 的 Haiku 模型、账号允许名单和每日额度。 [Claude 图片输入文档](https://platform.claude.com/docs/en/build-with-claude/vision)

## 在本机试用

在网页开发分支 `codex/sites-ai-coach` 的根目录运行。要求 Node.js 22.13 或更新版本。

```sh
npm run install:ci
npm run build
```

依照 [本地 D1 迁移](../README.md#local-d1-migrations) 按编号应用待执行的迁移。新检出且使用空数据库时，应用 `drizzle/` 中的全部 SQL。已有本地数据库只应用尚未执行的迁移。

在已关联额度的 Claude Console 组织中创建 API Key。将下面几项加入网页源码根目录的 `.dev.vars`。这个文件由 Git 忽略，由本机 Worker 读取。

```dotenv
AI_COACH_ENABLED=true
AI_COACH_ALLOWED_EMAILS=seedy@sites.test
ANTHROPIC_API_KEY=<粘贴你在 Claude Console 创建的 Key>
AI_COACH_SONNET_ENABLED=false
```

`seedy@sites.test` 是本机预览的合成账号。启动或重启预览后，在网页完成本地登录，进入「设置 → AI 教练」。

```sh
npm run dev:ai-coach
```

本机地址为 [http://127.0.0.1:5180](http://127.0.0.1:5180/)。API 是同一端口上的 `GET /api/ai-coach` 和 `POST /api/ai-coach`。出站请求由服务端发给 [Claude Messages API](https://platform.claude.com/docs/en/api/messages)。

## 配置 Sites 的试用环境

在用于测试的私密 Sites 项目中，把同名变量配置到 **Runtime environment variables**。将 `ANTHROPIC_API_KEY` 通过 Sites 的环境变量工具设为服务端秘密值。`AI_COACH_ALLOWED_EMAILS` 填实际被允许使用 AI 的 Sites 登录邮箱，多个地址用逗号分隔。发布时 Sites 自动应用 `0010_ai_coach_quota.sql`。更新运行时变量后，重新部署这个网页版本以应用新配置，再从现有 HTTPS 网址进入「AI 教练」。

从干净工作区构建发布包。Cloudflare Vite 可能把本机 `.dev.vars` 复制到本地构建目录，上传前请确认归档中没有任何本机环境文件。详见 [Cloudflare 本地变量说明](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/)。

默认关闭，缺少开关、Key 或允许名单时保持关闭。打开后，每个账号每天最多 20 次调用，整个部署每天最多 30 次，按 UTC 日重置。`AI_COACH_SONNET_ENABLED=true` 会显示 Sonnet 5.5。Claude Console 中用量归属于 Key 所在的 Workspace 和关联组织，可在那里查看用量、额度和预算设置。相关规则见 [API 额度说明](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)。

## 发送和保存的数据

- 对话发送输入内容和有限长度的近期聊天。只有勾选「附上个人训练安排」才会加入选定日期范围内的个人计划摘要。
- 问答定制在点「生成计划草稿」时发送本次选择的条件和动作列表。填写步骤在网页本地完成。
- 拍照识别只在点「识别照片」时发送重新编码的图片和本次备注。返回值先填入草稿，图片和识别结果不会被识别接口存入训练搭子记录。
- 自动加入的上下文限于本人安排。心率、体重、饮食、打卡原始记录、搭子、好友和学员资料都在范围之外。
- 对话保存在当前页面内存。生成草稿后可编辑，确认后写入自己的训练日历，也可重开对话清掉当前聊天。
- 查看 Key 与用量请进 Claude Console。Key 留在本机 `.dev.vars` 或 Sites 服务端环境变量。
