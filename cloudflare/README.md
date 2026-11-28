# 训练搭子 · Cloudflare

这个目录提供 Spotter 网页和 iPhone 共用的 API。Cloudflare Worker 使用 Vinext、D1 和 Drizzle。Apple、Google 及访问码登录均由 Spotter 的会话服务管理。产品入口见 [Spotter 网页](https://spotter-free.couple-ledger-service.workers.dev) 和 [原生 App](../docs/iphone-app.md)。

## 开发

使用 Node.js 24 或更新版本，在 `cloudflare/` 运行以下命令。

```sh
npm ci
npm run dev
npm run typecheck
npm test
```

`npm run dev` 启动带热更新的本地网页，使用终端显示的地址。可用 `npm run dev -- --host 127.0.0.1 --port 5173` 明确指定地址和端口。`npm run build` 生成 Worker 和静态资源，`npm start` 用 Wrangler 在回环地址预览构建产物。两个预览共用 `.wrangler/state` 中的本地 D1。`npm run db:generate` 在修改 Drizzle schema 后生成迁移。

- `app/` 和 `features/` 提供页面、API 路由和业务逻辑。
- `worker/` 是 Worker 入口。`db/` 和 `drizzle/` 管理 D1 binding 和迁移。
- `shared/` 包含 iPhone 和网页使用的帮助、食物库等资源。
- `scripts/cloudflare-env.mjs` 将 Wrangler 和 Miniflare 的状态及日志放在本地目录。`dist/`、`.vinext/` 和 `.wrangler/` 为生成产物或本地状态。

### 本地 D1 与登录

在 `cloudflare/` 构建并生成带本地占位 D1 ID 的预览配置，再对**本地**数据库应用迁移。Wrangler 使用 `drizzle/` 中的 SQL 并跟踪已执行的版本。

```sh
npm run build
node --import ./scripts/cloudflare-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
```

要在网页试写或验收登录流程，在本地 D1 的 `spotter_access_accounts` 添加合成账号。表字段为 `id`、小写 `email`、`display_name` 和访问码的 SHA-256 十六进制哈希 `access_hash`。以下命令为 `qa@example.test` 生成访问码和本地 SQL 文件。访问码仅显示在当前终端。

```sh
mkdir -p .wrangler
node --input-type=module > .wrangler/local-access-account.sql <<'JS'
import { createHash, randomBytes, randomUUID } from "node:crypto";
const accessCode = randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(accessCode).digest("hex");
console.error(`本地测试访问码：${accessCode}`);
console.log(`INSERT INTO spotter_access_accounts (id,email,display_name,access_hash) VALUES ('${randomUUID()}','qa@example.test','本地测试','${hash}') ON CONFLICT(email) DO UPDATE SET access_hash=excluded.access_hash;`);
JS
node --import ./scripts/cloudflare-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file .wrangler/local-access-account.sql
```

运行 `npm run dev` 或 `npm start`。用合成邮箱和生成的访问码到本地 `/sign-in` 登录，网页通过 HttpOnly 会话 Cookie 识别账号。测试数据、明文访问码和密钥保存在 Git 之外。开发预览可以匿名打开示例数据，实际登录、保存和账号删除都走应用的账号接口。

## 产品功能与接口

- 训练可直接按计划开始，或先开空白训练，编辑每组的重量、次数和时长。返回后可恢复草稿。导入文本、视频链接或计划 JSON 从「设置 → 计划与日程 → 粘贴已有内容」进入。每批最多 20 个计划，保存时跳过相同内容。[计划助手](docs/plan-assistant.md)
- 训练周期支持阶段、模板快照、复制周、进阶及减量，预览确认后才排入日历。动作可设置手填 1RM 百分比和目标 RPE，实际训练记录独立填写。[周期编排](docs/relay-planning.md)
- 「设置 → AI 教练」的站内对话、训练草稿和用户自己的 Agent 连接各自管理权限。新建个人连接默认勾选全部权限，可在创建前逐项取消。外部 Agent 使用自己的模型和个人连接令牌。[AI 教练配置](docs/ai-coach.md) · [Agent 接入](docs/agent-api.md)
- 教练通过单独邀请建立有方向的训练关系。学员确认发送来的计划或周期后才加入本人日历。教练可看该训练的完成状态与主动反馈。学员可另行授权分享实际组记录。[教练系统](docs/coaching.md)
- 个人训练详情的心率支持 Apple 健康 ZIP/XML、Garmin FIT/TCX、WHOOP CSV/ZIP 及通用 CSV。可在 iPhone Safari 的训练详情使用页面提供的快捷指令预览训练时段的心率后保存。iPhone App 使用 Apple 健康授权读取和同步。[设备同步](../docs/health-device-sync.md)
- WHOOP 心率汇总同步需要把 `https://<站点域名>/api/health/whoop/callback` 登记为开发者应用回调，在 Worker 配置 `WHOOP_CLIENT_ID` 和 `WHOOP_CLIENT_SECRET`。授权后可同步选定训练的已有心率统计。

### 动作演示核对

运行 `node scripts/audit-exercise-animations.mjs --list-missing` 查看缺演示条目，运行 `--list-unreviewed` 查看已有演示但尚未核对的条目。逐项核对封面、演示关键帧、名称、器械和步骤，再用 `--record-reviewed <编号数组.json>` 记录本批结果。素材或步骤改变后，条目会重新进入待核对列表。动作目录与素材许可见 [第三方声明](../NOTICE.md)。

## Cloudflare 部署

为 Worker 配置 `spotter-free` D1，使用生产数据库 ID 之前先在本地完成构建、验证迁移和试部署。以下为实际目标的部署顺序，请替换账号与数据库 ID。

```sh
npm run build
npm run cf:dry-run
CLOUDFLARE_ACCOUNT_ID=your-account-id SPOTTER_D1_DATABASE_ID=your-d1-id npm run cf:prepare
npx --no-install wrangler d1 migrations apply DB --config dist/server/wrangler.production.json --remote
npx --no-install wrangler deploy --config dist/server/wrangler.production.json
```

生产访问码通过管理员创建，使用至少 24 随机字节的 Base64url 字符串。D1 仅保存访问码哈希。iPhone 通过同一服务的 `/api/state` 核对当前登录账号。[Apple、Google 登录与账号删除设置](../docs/cloudflare-login.md)

启用 Apple 登录时，将 `SPOTTER_APPLE_TOKEN_KEY` 设置为随机 32 字节的 Base64url Worker Secret，用于加密保存 Apple 撤销凭据。替换密钥前为已有凭据安排迁移或重新授权。站内 AI 通过 Worker Secret `ANTHROPIC_API_KEY` 和 `AI_COACH_ENABLED=true` 启用，具体限额和模型见 [AI 教练配置](docs/ai-coach.md)。

### TestFlight 社交接口

如需独立的测试渠道，`spotter-beta-api` 使用同一个 `spotter-free` D1 与会话处理 Beta App 的好友和头像。配置该 Worker 后，用 `SPOTTER_BETA_SOCIAL_API_ENABLED=YES` 归档相应 TestFlight 构建。

```sh
CLOUDFLARE_ACCOUNT_ID=your-account-id SPOTTER_D1_DATABASE_ID=your-d1-id node scripts/prepare-beta-api.mjs
npx --no-install wrangler d1 migrations list spotter-free --remote --config work/spotter-beta-api.wrangler.json
npx --no-install wrangler d1 migrations apply spotter-free --remote --config work/spotter-beta-api.wrangler.json
npx --no-install wrangler deploy --config work/spotter-beta-api.wrangler.json
```

### 社交通知

通知使用 `0020_social_notifications.sql`。`SPOTTER_NOTIFICATIONS_AUDIENCE=all` 向已登录的 Spotter 账号开放通知。也可以用 `SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS` 按邮箱或账号 ID 限制测试范围。好友分享范围、接收设置和 15 分钟搭子提醒间隔由服务端校验。

系统推送使用授权给 `app.spotter.health` 的 APNs 密钥。Worker Secrets 为 `SPOTTER_APNS_TEAM_ID`、`SPOTTER_APNS_KEY_ID` 和 `SPOTTER_APNS_PRIVATE_KEY`。开发环境可另设 `SPOTTER_APNS_SANDBOX_KEY_ID` 和 `SPOTTER_APNS_SANDBOX_PRIVATE_KEY`。推送送达失败时，已写入的通知仍可在站内查看。
