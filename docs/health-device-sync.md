# 健康设备同步

Spotter iPhone App 使用 HealthKit 读取系统授权的数据，网页与 App 共用 Cloudflare Worker 会话及 D1。想在网页查看特定训练的健康资料时，先登录同一个 Spotter 账号。开发和真机验收使用隔离的 HTTPS 测试服务与合成账号。[iPhone App 构建与发布](iphone-app.md) · [Cloudflare 网页与 iPhone 登录](cloudflare-login.md)

## 读取与保存

| 数据 | 操作入口 | 保存方式 |
| --- | --- | --- |
| Apple 健康读数 | iPhone「设置 → 手表与健康」，点「授权 Apple 健康」并在系统面板选择类别 | 在健康页按日期范围预览可读数据。前台会刷新选中的指标。 |
| 体重、体脂率、去脂体重、腰围 | 同一页展开「同步到我的账号」，核对「同步身体记录到账号」所选指标 | 样本按 UUID 去重。时间按本地日期显示，体重以 kg 存储。 |
| 训练心率曲线 | iPhone 训练详情用「从 Apple 健康同步」，或在健康页开启「自动补录训练心率」 | 单条按已有训练实际起止时间匹配。自动模式处理近 7 天尚未保存心率的已完成训练，保留已有心率。 |
| Apple Watch 完训摘要 | iPhone 开练后连接配对的手表，或从手表开始已同步的计划 | 已配对的手表回传本场训练适用的活跃热量、总热量和平均心率。明细取相应训练窗口内的可用数据。 |
| 导出的心率数据 | 网页「训练详情 → 训练心率」，可在 iPhone Safari 使用页面的 Apple 健康快捷指令 | 先确认与训练时段吻合的点位，再保存 Apple 健康 ZIP/XML、Garmin FIT/TCX、WHOOP CSV/ZIP 或通用 CSV。 |

读数取决于 HealthKit 授权、设备来源和所选日期范围。系统不会向应用区分读取授权被拒绝与没有可用样本。训练以实际起止时间匹配，同日多场分别核对。训练心率与身体读数默认按本人账号保存。好友和搭子只可见各自授权的分享投影。[Apple HealthKit 授权说明](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)

## Cloudflare 接口

| 路由 | 用途 |
| --- | --- |
| `GET /api/health?id=<训练编号>` | 在当前账号读取训练心率。 |
| `POST /api/health` | 保存或移除心率。自动补录使用 `onlyIfMissing` 保留已有记录。 |
| `GET /api/health/workout-summary?id=<训练编号>`、`POST /api/health/workout-summary` | 读取及写入选定训练的手表摘要。 |
| `GET /api/library?section=body`、`POST /api/library` | 查重及保存用户选择的身体记录。 |
| `/api/health/whoop`、`/api/health/whoop/callback` | 在服务端配置 WHOOP OAuth 后连接，并同步可匹配的已有活动统计。 |

服务端按会话身份和训练归属限制读写。原生 App 在 Keychain 保存会话凭据，健康记录及授权凭据不写入测试日志。代码入口见 [原生健康页](../ios/SpotterHealth/NativeHealth.swift) · [完训摘要同步](../ios/SpotterHealth/NativeWorkoutHealthSync.swift) · [Cloudflare 健康路由](../cloudflare/app/api/health/)。

## 厂商设备

设备厂商向 Apple 健康写入 Spotter 已支持的数据类型时，iPhone App 可按系统授权读取。Garmin FIT/TCX 和 WHOOP CSV/ZIP 可从网页版训练详情导入。体脂秤分段指标需要厂商提供的设备与导出来源。厂商接入和支持范围见 [iPhone App 设备说明](../ios/README.md#通过-apple-健康连接其他设备)。

## 验证

从仓库根目录运行 `npm run test:health-native` 验证 Swift 健康载荷、时间窗口、单位、重试和协议的合成测试。`npm run test:ios-app` 包括原生心率文件导入及 Watch 消息的冒烟测试。Cloudflare 的 `npm test` 验证健康接口和账号归属。测试数据使用合成样本，模拟器编译和协议检查与真机授权分别验收。

真机需要匹配签名团队、Bundle ID 及 HealthKit 权限。用已配对的 Apple Watch 和已获同意的测试账号，核对两次同日训练、跨午夜、样本迟到、重复同步不同来源、手工心率保护、退出及切换账号。iPhone 需能访问该构建所配的 HTTPS 服务。看到真实手表回传和 D1 保存结果后，再记录本轮联调状态。[真机安装与验证](../ios/README.md#真机安装与验证)
