# 训练搭子 iPhone App

完整 App 选择 **Spotter** scheme，产品为 `Spotter.app`。SwiftUI 界面使用 Cloudflare 账号和 API。旧 SpotterHealth scheme 仍构建同一产品。Cloudflare App 的现有功能和打包流程见 [App 说明](../docs/iphone-app.md)。

Cloudflare 版在「设置 → 手表与健康」通过一个入口请求训练、活动、睡眠、身体测量与饮食相关的读取权限。可在 Apple 的授权界面按类别选择。健康页和身体数据页在前台监听样本变化，Apple 健康收到数据后刷新。体重、体脂率、去脂体重和腰围可在核对后同步到当前账号。训练详情可按实际打卡时段匹配心率。

Cloudflare 版的 Watch App 支持从手表开练、查看当前动作和心率、完成组次及结束训练。此前同步到手表的当天力量或计时计划可以离线开练，结束后等待回传。训练详情按当次训练显示可用的活跃热量、总热量和平均心率。表盘和智能叠放也可添加训练入口。安装、授权及真机验证见 [Apple Watch 训练和小组件](../docs/iphone-app.md#apple-watch-训练和小组件)。

### 通过 Apple 健康连接其他设备

- Garmin Connect 在前台完成设备同步后，会把支持的活动、睡眠、心率和体重数据写入 Apple 健康。可在训练详情同步 Apple 健康里与本次训练时段吻合的心率。FIT 和 TCX 文件可在网页版训练详情导入。 [Garmin 同步说明](https://support.garmin.com/sv-SE/?faq=lK5FPB9iPF5PXFkIpFlFPA)
- Google Health 的 iOS 版可向 Apple 健康写入活动、睡眠、体重和部分生命体征。数据范围以设备和 Google Health 的写入权限为准。 [Google Health 同步说明](https://support.google.com/googlehealth/answer/17037331?hl=en)
- WHOOP 可写入训练、心率、睡眠和活动数据。恢复、负荷等专属指标需要厂商接口。 [WHOOP 同步说明](https://support.whoop.com/s/article/Apple-Health-Integration?language=en_US)
- RENPHO 可通过 Apple 健康分享体重、体脂率、去脂体重等全身指标。公开的 HealthKit 类型不包含左右臂、左右腿或躯干的脂肪和肌肉估算。分段数据需要支持该功能的体脂秤与厂商导出。 [RENPHO 同步与导出](https://renpho.com/pages/faq-for-renpho-health-app) · [HealthKit 类型](https://developer.apple.com/documentation/healthkit/data-types)

## 本地构建与合成验证

从仓库根目录执行。

```sh
xcodebuild -project ios/SpotterHealth.xcodeproj -scheme Spotter -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath work/ios-derived CODE_SIGNING_ALLOWED=NO build
npm run test:health-native
npm run test:ios-app
```

健康合成测试检查 HTTPS origin、实际训练窗口、同日两次训练、重复样本归并、曲线采样、单位、重试和时区。测试使用合成数据。真机另行验证 HealthKit 授权、Watch 回传、Keychain 与实际 HTTPS 请求。Cloudflare 接口及持久化行为使用 `npm test` 验证。 [同步协议与验收](../docs/health-device-sync.md)

## 真机安装与验证

1. 在 Mac 的 Xcode 打开 `SpotterHealth.xcodeproj`，选择 **Spotter** scheme。项目已声明 HealthKit entitlement 和读取用途说明。为 iPhone、Watch 和小组件选择适合当前构建的签名团队和描述文件。正式主 App Bundle ID 为 `app.spotter.health`。
2. 连接并解锁 iPhone，信任此 Mac，按系统要求开启开发者模式，再选手机运行。真机验证使用该构建的 HTTPS 测试 API 和独立的 D1 测试账号。确保配对手表和 iPhone 同时安装相容构建。
3. 用测试账号登录，在「设置 → 手表与健康」授权需要的读取类别。用同一账号查看网页记录。在训练详情核对实际起止时间和对应心率，在身体页核对手动同步的测量记录。
4. 在 iPhone 开练再连接手表，或在手表选择已同步的当日计划。完成训练后，核对网页、iPhone 和手表显示的组次、心率和完训摘要。另测授权变更、重新进入、断网恢复、同日两场训练、重复同步和账号切换。

签名凭据和真实健康数据保存在 Git 之外。测试范围和当前构建的签名配置见 [App 说明](../docs/iphone-app.md)。

### 搭子提醒与好友打卡通知

通知中心和偏好使用已登录账号。系统推送还需要为 `app.spotter.health` 启用 Push Notifications，并安装包含 `aps-environment` 的 provisioning profile。TestFlight 使用生产 APNs。只有通过系统通知授权的设备才注册推送。没有 APNs 配置时，支持通知的后端仍可提供站内通知。

归档 TestFlight 时，给 Xcode 传入 `SPOTTER_PHONE_ENTITLEMENTS=SpotterHealth/SpotterHealthPush.entitlements` 和 `SPOTTER_APNS_ENVIRONMENT=production`。使用开发签名及独立测试凭据时，环境值设为 `development`。系统推送 entitlement 仅加在 iPhone 宿主，不影响 Widget 和手表签名。

真机验证使用两个同意测试的账号。先在接收设备的「设置 → 通知」开启锁屏提醒。分别验证当前搭子发出提醒、好友打卡、重复同步、关闭各类通知，以及点击通知打开对应联系人。
