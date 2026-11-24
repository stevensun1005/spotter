# 训练搭子 iPhone 原生 App

**Spotter** scheme 构建 SwiftUI 版 iPhone App，Bundle ID 为 `app.spotter.health`，支持 iOS 16 及以上。App 与 [Cloudflare 网页](https://spotter-free.couple-ledger-service.workers.dev) 通过 HTTPS 访问同一个账号和 D1 数据库。构建 10 是之前的网页壳版本，构建 11 起主界面与交互由 iPhone 原生实现。

## 使用与数据

- 登录后进入今日、训练、统计和好友四个原生标签页。系统提供 TabView、NavigationStack、半屏面板、照片选择器和分享界面。当前 iOS 支持的系统效果会随系统版本显示。
- Apple 登录通过 AuthenticationServices 验证，Google 使用系统授权窗口。访问码继续支持已有账号。到「设置 → 账号」可把另一个登录方式绑定到同一账号。会话保存在本设备 Keychain。
- 打开计划或自由训练后可以逐组记重量、次数和时长。计时按时间戳计算，可以跨前后台和锁屏。打卡重试沿用训练 ID，账号切换后分别读取各自的草稿。
- 统计使用 Swift Charts。在历史训练详情可按开始和结束时间读取 Apple 健康心率，保存曲线、摘要及来源。体重可以读取并手动同步到账号。步数、活跃能量和系统运动时长可按日期在 App 查看。
- AI 面板支持文本对话、计划问答、草稿预览和保存，以及系统相机和照片选择器。确认识别的餐食后可以写入饮食记录。AI 请求继续走 Cloudflare 的权限和用量限制。
- 设置中的蛋白粉仓库可拍照在设备上读取标签，核对后保存配方并设为训练默认。完成训练时勾选喝过蛋白粉，会用同一笔打卡保存对应的饮食记录。好友页的教练入口支持学员邀请、下发计划和接收计划。
- 原生账号设置提供退出和删除账号。Google 需要 Cloudflare 具备 Google OAuth 配置才可发起真实授权。系统 Apple 授权、Apple Watch 来源和相机须用有对应权限的 iPhone 验收。

## 构建

```sh
npm run build
npm test
npm run test:ios-app
npm run test:health-native
npm run ios:source-check
npm run ios:package
```

`ios:package` 在构建前后核对 `origin/main`、健康同步分支和 iPhone 开发分支，并核对 App 连接的 Cloudflare 提交。产物位于 `outputs/`，包括模拟器 ZIP 和构建清单。iPhone 安装使用 Xcode 签名或 TestFlight。

TestFlight 使用同一 **Spotter** scheme 的 Release 归档，分发目标是 App Store Connect 的 `app.spotter.health` 应用。签名描述文件须支持 HealthKit 以及 Sign in with Apple。原生 Apple 服务端使用 `APPLE_OAUTH_NATIVE_CLIENT_ID=app.spotter.health`。网页的 Apple Services ID 与原生 App ID 在同一 Apple Developer 配置下管理，详情见 [登录配置](cloudflare-login.md)。

私密 Sites 与独立 Node 自托管服务各有账号和数据。配对码和批量健康同步协议另见 [健康设备同步](health-device-sync.md)。
