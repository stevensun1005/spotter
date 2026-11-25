# 训练搭子 iPhone App

完整 App 选择 **Spotter** scheme，产品为 `Spotter.app`。SwiftUI 界面使用 Cloudflare 账号和 API。旧 SpotterHealth scheme 仍构建同一产品。Cloudflare App 的现有功能和打包流程见 [App 说明](../docs/iphone-app.md)。

Cloudflare 版在「设置 → 手表与健康」通过一个入口请求训练、活动、睡眠、身体测量与饮食相关的读取权限。可在 Apple 的授权界面按类别选择。健康页和身体数据页在前台监听样本变化，Apple 健康收到数据后刷新。体重、体脂率、去脂体重和腰围可在核对后同步到当前账号。训练详情可按实际打卡时段匹配心率。

Cloudflare 版的 Watch 配套 App 通过 HealthKit 在训练时测量并发送实时心率。手表测量使用临时训练会话，结束后丢弃该会话。安装、授权及测试方法见 [训练中的 Apple Watch 心率](../docs/iphone-app.md#训练中的-apple-watch-心率)。

### 通过 Apple 健康连接其他设备

- Garmin Connect 在前台完成设备同步后，会把支持的活动、睡眠、心率和体重数据写入 Apple 健康。需要运动的细节时，可在训练详情导入 FIT 或 TCX。 [Garmin 同步说明](https://support.garmin.com/sv-SE/?faq=lK5FPB9iPF5PXFkIpFlFPA)
- Google Health 的 iOS 版可向 Apple 健康写入活动、睡眠、体重和部分生命体征。数据范围以设备和 Google Health 的写入权限为准。 [Google Health 同步说明](https://support.google.com/googlehealth/answer/17037331?hl=en)
- WHOOP 可写入训练、心率、睡眠和活动数据。恢复、负荷等专属指标需要厂商接口。 [WHOOP 同步说明](https://support.whoop.com/s/article/Apple-Health-Integration?language=en_US)
- RENPHO 可通过 Apple 健康分享体重、体脂率、去脂体重等全身指标。公开的 HealthKit 类型不包含左右臂、左右腿或躯干的脂肪和肌肉估算。分段数据需要支持该功能的体脂秤与厂商导出。 [RENPHO 同步与导出](https://renpho.com/pages/faq-for-renpho-health-app) · [HealthKit 类型](https://developer.apple.com/documentation/healthkit/data-types)

以下章节记录独立 Node 服务的设备配对与同步协议。该方案支持 iOS 16 及以上，默认只选择训练心率。

## 本地构建与合成验证

```sh
xcodebuild -project ios/SpotterHealth.xcodeproj -scheme Spotter -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath work/ios-derived CODE_SIGNING_ALLOWED=NO build
mkdir -p work
swiftc ios/SpotterHealth/HeartPayload.swift ios/SpotterHealth/BridgeClient.swift ios/Tests/NativeSmoke.swift -o work/native-smoke
work/native-smoke
npm run test:health-native
```

合成验证检查 HTTPS origin、历史训练、同日两次训练按实际起止时间匹配、重复样本归并、全量摘要、720 点曲线保留最高/最低值、仅选定类别的负载与 kg 传输。URLProtocol 模拟断网恢复、持续断网最多三次、503 恢复，以及 401 和取消均不重试；同时检查 Toronto 的 25 小时 DST 日。`test:health-native` 另外将实际 Swift 编码的合成载荷经过服务端生产 API 路由，验证配对、重复上传、账号隐私及断连；临时文件自动清理。两者不调用 HealthKit、不经过实际 HTTPS，不使用真实健康数据或设备令牌。服务端完整验证另外运行 `npm run build` 和 `npm test`。

模拟器 SDK 构建通过只表示源码可编译。HealthKit 读取权限、真实来源、手表到 iPhone 的同步和后台触发必须分别在真机验证。

## 真机安装与验证

1. 在 Mac 的 Xcode 打开 `SpotterHealth.xcodeproj`。项目已声明 **HealthKit** capability、`com.apple.developer.healthkit` entitlement 和读取用途说明，自动签名开启。仓库未固定签名团队；当前默认 Bundle ID 为 `app.spotter.health`。在 Signing & Capabilities 选择有 HealthKit 权限的开发团队，以及该团队可用的唯一 Bundle ID。个人团队及已有证书是否包含所需权限，以 Xcode 实际 provisioning 结果为准。不要将个人配置、Profile 或证书提交到 Git。
2. 连接并解锁 iPhone，信任此 Mac，按系统要求开启开发者模式。选择 **Spotter** scheme 与该手机，运行调试版。已有证书不能代替匹配 Bundle ID、设备和 HealthKit 的 development provisioning profile。
3. 准备 iPhone 可访问的独立版 **HTTPS 测试服务**，配置正确的 `SPOTTER_ORIGIN` 和独立测试数据库，在 App「设置」选择该站点。地址拒绝 HTTP、路径、查询参数和用户名/密码，原生设备请求不跟随重定向，不为本地验证放宽传输安全。没有 HTTPS 环境时先运行上述本地合成与构建验证。
4. 在 App 的训练页面登录测试账号，账号面板生成五分钟有效的一次性配对码。打开原生健康入口并输入配对码；App 核对当前网页账号和设备令牌归属相同才允许读取或上传。配对成功后，由本人在系统健康弹窗选择是否允许读取心率。后续在「选择同步数据」逐项打开体重、系统运动、步数、活跃能量或运动时长，逐项处理系统权限。
5. 网页完成训练后，等待 Apple Watch 数据出现在 iPhone 健康。App 手动点「同步所选健康数据」，或将 App 打开/回到前台。网页详情检查实际训练时段、来源、曲线和平均/最低/最高心率。使用同一天两次训练核对归属，再重复同步核对幂等；手表迟到样本可再次补同步。
6. 检查体重进入身体记录、活动进入概览、系统运动只按时间关联已有打卡；不会自动生成第二条训练。分别验证 kg/lb、跨午夜、时区、历史日期、断网重试与恢复。用两组测试账号验证无法互读健康数据。
7. 从网页断开后旧设备同步应返回失效，App 清理 Keychain 并要求重新配对。App 内断开需要服务端确认成功才移除本地凭据；断网时明确提示重试。重新配对会替换账号的旧凭据；更换账号后同步选项重置为仅心率。

截至本轮检查：Xcode 可用、发现已配对 iPhone 和有效开发证书；设备签名尝试提示 `app.spotter.health` 缺少 iOS App Development provisioning profile。因用户当前不便操作设备，本轮未安装、未请求真机健康授权，也未声称 Apple Watch 真机闭环通过。签名团队、Bundle ID 与 HealthKit provisioning 仍需上面步骤核验。

### 搭子提醒与好友打卡通知

通知中心和偏好使用已登录账号。系统推送还需要为 `app.spotter.health` 启用 Push Notifications，并安装包含 `aps-environment` 的 provisioning profile。TestFlight 使用生产 APNs。只有通过系统通知授权的设备才注册推送。没有 APNs 配置时，支持通知的后端仍可提供站内通知。

归档 TestFlight 时，给 Xcode 传入 `SPOTTER_PHONE_ENTITLEMENTS=SpotterHealth/SpotterHealthPush.entitlements` 和 `SPOTTER_APNS_ENVIRONMENT=production`。使用开发签名及独立测试凭据时，环境值设为 `development`。系统推送 entitlement 仅加在 iPhone 宿主，不影响 Widget 和手表签名。

真机验证使用两个同意测试的账号。先在接收设备的「设置 → 通知」开启锁屏提醒。分别验证当前搭子发出提醒、好友打卡、重复同步、关闭各类通知，以及点击通知打开对应联系人。

## 同步行为与权限边界

- 可选今天、14/30/90/365 天或自定义日期。日期按 iPhone 当前时区解释，传输使用绝对毫秒时间和 IANA 时区。心率按照网页保存的实际起止时间读取，旧训练沿用现有结束时间估算口径；不会按「同一天」粗匹配。
- 心率 `/api/health/apple/sync` 分页获取已完成训练（含可更新的原生心率），客户端跟随 `nextCursor`，不再限于最近 14 天/24 次。按一个来源流选择样本，优先 Apple Watch，避免多个追踪器样本相加。服务端幂等写入并保留已有更完整数据；手工文件记录由原有规则保护。
- 扩展数据送到 `/api/health/apple/records`。体重由 HealthKit 转为 kg，保留原样本 UUID 和来源；系统运动保留 UUID、时间、时长与来源。只有用户另外选了活跃能量才附带系统运动的能量。
- 步数、活跃能量和运动时长使用 HealthKit `HKStatisticsCollectionQuery` 的 `.cumulativeSum`，让系统默认合并来源，而非将各设备原始样本相加。页面来源因此明确写「Apple 健康（系统汇总）」。参见 [Apple HKStatistics 文档](https://developer.apple.com/documentation/healthkit/hkstatistics)。
- 历史扩展同步每批向前 23 个当地日历日，后续重叠前 7 天，单批不超过 31 个绝对日，覆盖跨午夜及最长 7 天运动。服务器按 UUID/活动日幂等写入；重试不叠加活动值。
- `/sync` 的最终报告包含选定类型、实际读取到样本的类型、范围、更新/跳过数量和空结果，网页显示最近结果。授权请求成功不代表获准读取每一类；Apple 出于隐私不透露读取被拒绝，App 只提示检查权限、日期范围和手表同步。没有可匹配训练时段时另外提示先打卡或调整范围。参见 [Apple 授权说明](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)。
- 设备凭据只在 Keychain，使用 `WhenUnlockedThisDeviceOnly`；网络使用临时 URLSession，不输出健康数据、配对码或令牌。断网/服务器暂时错误会短暂重试，下一次前台或手动同步可重新读取并幂等上传，不落地原始数据队列。
- 这套独立 Node 配对链路使用前台历史同步。Cloudflare 配套 App 的训练实时心率和前台样本刷新见上文。iPhone 后台 HealthKit delivery 暂未启用，仍需真机验证。

## 当前 Sites 试用版

私密 Sites 的快捷指令导入不是这些原生设备接口，Sites 身份和独立版账号数据库也不同。不要把正式 Sites URL 当作此 App 的测试配对服务。本轮不改 Sites 站点、访问权限或数据。未来需要在 Sites 服务器实现相同的短期一次性配对、设备令牌身份、按账号限定的训练窗口、私密原始数据存储和幂等端点，并在实际 HTTPS 环境完成端到端验证，再按项目统一上线节奏接入。详见仓库 `docs/` 的健康设备交接说明。
