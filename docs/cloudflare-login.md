# Cloudflare 网页与 iPhone 登录

iPhone App 默认打开与 Cloudflare 网页相同的 HTTPS 站点。两端使用这个 Worker 的会话服务和 D1。Apple、Google 或已有访问码登录后，训练、饮食、仓库、计划和关系以同一个 Spotter 账号 ID 保存。独立 Node 服务与私密 Sites 各自管理自己的账号和数据。

iPhone 正式版的训练页面要求登录。使用者用自己的 Apple 或 Google 账号登录。发布者使用 Apple Developer 和 App Store Connect 管理签名和上架。Google Auth Platform 的 OAuth 客户端由项目管理员配置一次。

已有 Cloudflare 记录时，先使用原邮箱和访问码登录，在「设置 → 账号」绑定 Apple 和 Google。新账号可先用任一已配置的平台登录，再绑定另一个。绑定要求在同一 Spotter 会话中通过平台授权。若已经建立两个各自含有记录的 Spotter 账号，请分别登录核对账号，绑定流程会拒绝占用另一个账号的登录身份。

## 部署与启用

Cloudflare Worker 源码位于 `cloudflare/`。运行 `npm ci`、`npm test` 和 `npm run build`，再按该目录 README 配置正式 Wrangler 文件。启用登录前，先应用所有待执行的 D1 迁移。

在 Worker 的 **Settings → Variables and Secrets** 设置 `SPOTTER_OAUTH_ORIGIN` 为实际公开 HTTPS origin。当前值为 `https://spotter-free.couple-ledger-service.workers.dev`。设置值末尾省略斜杠。各平台可以分别启用，网页和新版 App 会显示对应状态。

| 平台 | 添加到平台控制台的 HTTPS 回调 | Cloudflare 变量 |
| --- | --- | --- |
| Google | `https://spotter-free.couple-ledger-service.workers.dev/api/auth/oauth/google/callback` | `GOOGLE_OAUTH_CLIENT_ID`，`GOOGLE_OAUTH_CLIENT_SECRET` |
| Apple | `https://spotter-free.couple-ledger-service.workers.dev/api/auth/oauth/apple/callback` | `APPLE_OAUTH_CLIENT_ID`，`APPLE_OAUTH_TEAM_ID`，`APPLE_OAUTH_KEY_ID`，`APPLE_OAUTH_PRIVATE_KEY` |

Google 使用 **Web application** 类型的 OAuth 客户端，配置应用名称和授权测试账号，按平台要求准备公开上线所需的品牌信息和域名。 [Google Web OAuth 文档](https://developers.google.com/identity/protocols/oauth2/web-server)

Apple 使用与启用 Sign in with Apple 的主 App ID 关联的 **Services ID** 作为 `APPLE_OAUTH_CLIENT_ID`。在 Services ID 配置域名和回调。私钥使用 Apple 下载的 PKCS#8 PEM 内容。 [Apple Web 登录配置](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)

把 `GOOGLE_OAUTH_CLIENT_SECRET` 和 `APPLE_OAUTH_PRIVATE_KEY` 设为 Worker Secret。重新部署后，访问 Cloudflare 的 `/api/auth/oauth` 核对对应 `enabled` 状态。iPhone 使用系统授权窗口，并在登录完成后让同一站点为 App 设置会话。Google 的授权页面需要通过系统浏览器打开。 [Google OAuth 浏览器要求](https://developers.google.com/identity/protocols/oauth2/policies)

验收时先用现有 Cloudflare 帐号走「设置 → 账号」，分别绑定 Apple 和 Google。然后退出并用两种方式登录，各核对一次训练和饮食。再用另一端登录同一个账号核对本次记录。
