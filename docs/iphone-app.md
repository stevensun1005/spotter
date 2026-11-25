# 训练搭子 iPhone 原生 App

**Spotter** scheme 构建 SwiftUI 版 iPhone App，Bundle ID 为 `app.spotter.health`，支持 iOS 16 及以上。App 与 [Cloudflare 网页](https://spotter-free.couple-ledger-service.workers.dev) 通过 HTTPS 访问同一个账号和 D1 数据库。构建 10 是之前的网页壳版本，构建 11 起主界面由 SwiftUI 实现，构建 12 使用 Cloudflare 移动网页的配色、布局及项目资产。

## 使用与数据

- 登录后进入今日、训练、统计和好友四个原生标签页。底部四个标签使用网页的图标和半透明导航栏，右侧 AI 教练按钮打开可展开的对话面板。相机、照片、分享及账号授权使用 iOS 系统界面。
- Apple 登录通过 AuthenticationServices 验证，Google 使用系统授权窗口。访问码继续支持已有账号。到「设置 → 账号」可把另一个登录方式绑定到同一账号。会话保存在本设备 Keychain。
- 打开计划或自由训练后可以逐组记重量、次数和时长。计时按时间戳计算，可以跨前后台和锁屏。打卡重试沿用训练 ID，账号切换后分别读取各自的草稿。
- 统计使用 Swift Charts。「打卡历史」按月查看自己的训练和搭子已共享的打卡。点记录进详情，点日期查看当天的训练，自己的同日训练可以排序。今日页和训练页的「查看记录」也打开同一份训练详情。
- 自己的训练可编辑、另存为模板或生成图片分享卡。分享卡可切换样式、合并当天训练和隐藏明细。附带心率默认关闭。图片可以保存到照片或通过系统分享菜单发送。历史训练详情也可以按实际起止时间同步 Apple 健康心率。
- 体重可以读取并手动同步到账号。步数、活跃能量和系统运动时长可按日期在 App 查看。
- AI 面板支持文本对话、计划问答、草稿预览和保存，以及系统相机和照片选择器。确认识别的餐食后可以写入饮食记录。AI 请求继续走 Cloudflare 的权限和用量限制。
- 设置中的蛋白粉仓库可拍照在设备上读取标签，核对后保存配方并设为训练默认。完成训练时勾选喝过蛋白粉，会用同一笔打卡保存对应的饮食记录。好友页的教练入口支持学员邀请、下发计划和接收计划。
- 原生账号设置提供退出和删除账号。Google 需要 Cloudflare 具备 Google OAuth 配置才可发起真实授权。系统 Apple 授权、Apple Watch 来源和相机须用有对应权限的 iPhone 验收。

## 网页功能对照

按私密 Sites v78 的源码及 App 共用的 Cloudflare API 核对。以下覆盖训练、统计、社交和个人设置的主要入口。

| 功能 | SwiftUI 支持情况 |
| --- | --- |
| 今日、统计与训练详情 | 月历筛选、同日排序、计划和自由训练详情、记录编辑、另存模板、搭子近七天和加油。 |
| 训练分享 | 模板样式、肌群图、逐组明细、同日合并、选填心率、系统保存与分享。 |
| 计划导入 | 训练文本、B 站或 YouTube 跟练链接和 JSON 共用一个核对入口，从训练页、设置或 AI 教练进入。 |
| 训练周期 | 创建私人草稿、套用个人模板、编辑训练与阶段、复制周、调整起始日及周数、管理编排偏好、导入或导出周期 JSON、预览和确认排期。 |
| 计划与休息日 | 今日和训练页的计划菜单支持移动单堂、顺延同周期训练、查找下一个可训练日和删除计划。删除计划会保留已有打卡。 |
| 训练心率 | Apple 健康原生读取与 FIT、TCX、时间戳 CSV、WHOOP CSV／ZIP 文件导入。文件在本机解析，核对后仅保存匹配本次训练的心率。WHOOP 在线授权与同步仍通过网页。 |
| 外观 | 跟随系统、浅色和深色，青柠、薄荷、天空蓝和丁香紫强调色，以及文字大小和减少动态效果。外观偏好保存在本机。 |

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
