# 训练搭子 iPhone App 开发版

本轮 App 为 1.0（构建 2），连接私密 Sites 已发布的第 70 版。App 的站点设置显示原生构建号和打包时核对的网页版本，构建清单记录原生和网页的源码。

## 第 70 版核对

- Sites 第 70 版发布源码为 `d735bb3a781bffa1049f3a03fbb301999583e326`。GitHub 快照 `origin/sites/source-2026-11-24` 的提交 `2455ab8d9fd4b433367aca8fc0cf4c04fe8b5086` 与发布源码逐一核对了 3,484 个路径，差异仅为 `.openai/hosting.json` 中的项目 ID。
- 当前网页版包含聊天式 AI 教练、五步图文计划问答、好友互动和隐私设置、按训练量着色的活动日历、首页饮食日记，以及通过 AI 教练拍照记录餐食。AI 对话、自动生成计划和照片识别使用同一个 Sites 端模型配置。
- 原生 App 补充了餐食拍照和饮食语音录入的系统用途说明。相机和语音识别由系统权限与 WebKit 功能决定，真机授权和实际录入仍待验证。

## 这份 App 的组成

- 现有 `ios/SpotterHealth.xcodeproj` 增加 **Spotter** scheme，产品为 **Spotter.app**，显示名称为「训练搭子」。旧 SpotterHealth scheme 继续可构建同一产品。
- 训练、计划、逐组记录、历史、统计和搭子功能复用所选站点的网页代码，由 WKWebView 加载；没有复制一份冻结的 React 页面。这是混合 App，仍需要服务端，不能称为全部离线或纯 Swift 原生重写。
- 默认打开现有私密 Sites。原有登录与数据仍受该站点的权限控制，App 不会为其生成绕过登录的令牌，也不会迁移、发布或修改其数据。
- 网站可在 App 的设置中改为其他 HTTPS origin。地址不接受 HTTP、路径、账号或查询参数。网页 Cookie/草稿使用持久 WebKit 数据存储；设备健康令牌继续在 Keychain，两者不混用。
- 原生顶部提供健康入口、刷新和设置；站内导航保留在 App，普通视频外链交给系统浏览器。同源导出文件通过系统分享面板交付，临时文件在分享结束后清理。
- 加载失败有重试入口。训练页的草稿沿用原有网页规则；没有承诺首次离线启动、离线查看全部历史或脱网云端打卡。

## 健康账号边界

App 根视图持有同一个 `HealthSyncCoordinator`，因此自动同步不依赖用户先打开健康面板。打开或回到前台时先确认当前网页账号，再根据既有连接和选定范围同步。

WebView 只由原生向可信同源主页面发起 `/api/state` 读取，传出最少的账号 ID；没有注册可被其他页面调用的 JS 消息入口。身份未知、跳转、换站、登出或切换账号会撤销同步上下文。每次上传前即时核验网页登录身份，并与设备令牌派生的 owner 对照。

新增 `GET /api/health/apple/device`，仅接受既有设备 Bearer 令牌，返回该令牌绑定的账号。客户端不能用 query 或 body 选择 owner。这个接口只存在于本轮独立版源码，不能据此声称当前 Sites 已有原生健康接口。

当前 Sites 仍使用快捷指令链路；Sites 平台登录在 WKWebView 中的实际闭环、原生健康接入、Apple Watch 授权和真机安装仍需后续验收。有效的 development provisioning profile、签名团队/Bundle ID 和可由手机访问的测试服务仍是设备验收条件，详见 [健康交接](health-device-sync.md)。

## 本地构建与打包

```sh
npm run build
npm test
npm run typecheck
npm run test:health-native
npm run test:ios-app
xcodebuild -project ios/SpotterHealth.xcodeproj -scheme Spotter -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath work/app-derived CODE_SIGNING_ALLOWED=NO build

# 工作区提交干净、App 分支已推送后运行
npm run ios:source-check
npm run ios:package
```

打包工具在构建前后各拉取并核对 `origin/main`、`origin/codex/health-device-sync`、`origin/codex/spotter-iphone-app` 是否都已包含在当前 HEAD 中。存在未提交源码、远端遗漏或构建期间发生变化时拒绝打包；它不自动合并或覆盖源码。

产物是被 Git 忽略的 `outputs/Spotter-Simulator-<commit>.zip` 和同名 JSON 记录，包含构建 commit、分支和核验的远端 SHA。打包还核验 App 内的 `SpotterWebRelease` 和拉取到的 GitHub 网页快照。Sites 的发布状态由发布记录另行核对。网页加载实时站点，构建记录中的版本用于追溯。**这是 iOS 模拟器开发包，不能直接安装到真实 iPhone。**

## 已运行的验证

| 检查 | 结果与限制 |
| --- | --- |
| Node 生产构建/类型 | `npm run build`、`npm run typecheck` 通过 |
| 服务端与导入 | `npm test` 24/24 通过，含另一电脑推送检测、未提交文件保护、设备账号身份、原有权限/同步与 FIT/TCX |
| 原生协议 | `test:health-native` 通过，实际 Swift 编码与服务端生产路由兼容 |
| App 原生策略 | `test:ios-app` 覆盖 HTTPS/同源策略、视频外链、危险 scheme 拒绝、网页切号/登出/身份竞态和健康绑定 |
| 模拟器 | 使用 Spotter scheme 构建；第 70 版的具体检查结果以本次交付为准。先前开发包已在 iPhone 17 Pro / iOS 26.5 通过本地 HTTPS 载入合成账号的实际训练页面 |
| 会话持久化 | 本地夹具通过真实 HTTPS 响应为合成账号设置 Cookie；App 重启后未再注入 Cookie，实际请求携带持久会话并载入训练页。此项不代表正式 Sites 登录流程或人工填写登录表单已验收 |
| UI 交互范围 | 已检查真实模拟器截图；当前 CUA 没有可控制的 Simulator app surface，未用其他 UI 自动化替代点击，不声称所有原生菜单、文件选择器和正式登录已完整点测 |
| 真机/正式站 | 未安装真机、未执行真实健康授权、未发布 Sites，原有权限与数据保留 |

本地 HTTPS 只用于隔离模拟器验证，临时证书只装入测试模拟器，没有修改 Mac 或 iPhone 的信任，也没有降低 App 的 HTTPS 校验。

## 后续版本的补齐步骤

1. 取得用户给出的完成通知，以及实际远端分支或 Sites 保存的源码版本。
2. 重新拉取，核对训练业务、动作库、数据结构、账号权限和原生代码的差异；保留双边修改，解决冲突后重跑上述检查。
3. 核对所选站点实际发布的网页版本和源码快照，再更新 `ios/SpotterHealth/Info.plist` 中的 `SpotterWebRelease`。App 使用站点实际发布的功能。
4. 用新的源码 commit 重新生成 App 包和构建记录，再替换本轮开发包。正式 Sites 仍等动作库补齐核对后的统一更新指令。
