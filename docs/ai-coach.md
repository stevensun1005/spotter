# 配置站内 AI 教练与拍照识别

从底部「AI 教练」、设置或添加计划打开。顶部可切换「站内 AI」和「用自己的 AI」。

- 对教练说「记体重」，它会追问数值，收到明确的测量结果后直接保存到本人账号，也可以一次说出日期、数值和单位。
- 对教练说「看本周训练统计」，它会在对话里回复已完成的训练次数、天数、时长、组数和容量。
- 在对话里说要练什么，教练根据已有条件提问或给出草稿。继续发消息可以改动作、组数和时间。新版可展开逐堂查看，并可点「添加到今日训练」或保存到指定日期。每次最多规划 28 天、12 堂。

自由对话、训练计划生成与修改、餐食和食品包装照片识别统一使用 Claude Haiku 5.5，推理强度为 `medium`。计划草稿可预览、编辑和保存。手动粘贴在「设置 → 计划与日程 → 粘贴已有内容」。

从「首页 → 饮食记录 → AI 识别」进入 AI 教练的餐食拍照页。日期和餐次随记录带入，拍照或选图后填入食物、份量和营养草稿，确认保存后回到原来那天的饮食记录。食品包装可从食物库的拍照入口识别每 100 克数值。识别和教练对话共用该账号的每月额度。 [Claude 图片输入文档](https://platform.claude.com/docs/en/build-with-claude/vision)

AI 教练的输入栏有「拍照」和「相册」。选图后可以输入或听写份量，例如「200 mL 牛奶、1 勺 30 g 的蛋白粉」。默认记在今天，可在照片旁切换餐次。点击「识别并记餐」后，信息足够时直接加入饮食记录并标为估算。需要补充时，教练会在对话里提问，可以保留照片并继续说明。包装营养表需要核对时，可在蛋白粉仓库先填写产品和勺量保存，再补营养数据。

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
ANTHROPIC_API_KEY=<粘贴你在 Claude Console 创建的 Key>
```

`seedy@sites.test` 是本机预览的合成账号。启动或重启预览后，在网页完成本地登录，进入「设置 → AI 教练」。

```sh
npm run dev:ai-coach
```

本机地址为 [http://127.0.0.1:5180](http://127.0.0.1:5180/)。API 是同一端口上的 `GET /api/ai-coach` 和 `POST /api/ai-coach`。出站请求由服务端发给 [Claude Messages API](https://platform.claude.com/docs/en/api/messages)。

## 配置托管环境

在 Cloudflare Worker 的 **Variables and Secrets** 中设置 `AI_COACH_ENABLED=true`，并将 `ANTHROPIC_API_KEY` 设为秘密。部署前应用 D1 待执行的迁移。使用 Sites 托管此源码时，在其 **Runtime environment variables** 中设置相同变量，并随该站点发布数据库迁移。

从干净工作区构建发布包。Cloudflare Vite 可能把本机 `.dev.vars` 复制到本地构建目录，上传前请确认归档中没有任何本机环境文件。详见 [Cloudflare 本地变量说明](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/)。

开启后，所有已登录的 Spotter 账号均可使用。每个账号每个 UTC 自然月最多消耗 US$10 的模型用量。在请求发出前预留该请求可能产生的费用，收到模型用量后按 Haiku 5.5 的标准价格结算。上游用量无法确认时保留预留额，剩余额度不足以发起下一次请求时返回 429。Claude Console 中用量归属于 Key 所在的 Workspace 和关联组织。 [Haiku 5.5 价格](https://platform.claude.com/docs/en/models/haiku-5-5/overview) · [API 额度](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)

## 发送和保存的数据

- 对话发送输入内容和有限长度的近期聊天。只有勾选「附上个人训练安排」才会加入选定日期范围内的个人计划摘要。
- 继续调整训练时，模型会收到待调整的草稿。确认保存后才写入训练日程。
- 记体重和查询统计走训练搭子自己的数据流程。这些消息和结果不会进入后续发给模型的对话历史。
- 拍照识别只在点「识别照片」时发送重新编码的图片和本次备注。返回值先填入草稿，图片和识别结果不会被识别接口存入训练搭子记录。
- 自动加入的上下文限于本人安排。心率、体重、饮食、打卡原始记录、搭子、好友和学员资料都在范围之外。
- 对话保存在当前页面内存。生成草稿后可编辑，确认后写入自己的训练日历，也可重开对话清掉当前聊天。
- 查看 Key 与用量请进 Claude Console。Key 留在本机 `.dev.vars` 或托管平台的服务端秘密值。
