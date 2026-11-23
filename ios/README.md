# 训练搭子心率

配套应用使用 iPhone 的 HealthKit。Apple Watch 记录同步到 iPhone「健康」后，配套应用只读取对应的心率采样，并发送到你的训练搭子独立版。支持 iOS 16 及以上。

## 安装与验证

1. 在 Mac 上用 Xcode 打开 `SpotterHealth.xcodeproj`。在 Signing & Capabilities 选择有 **HealthKit** 权限的签名团队，使用这个团队可用的唯一 Bundle ID。连接自己的 iPhone，选择 **SpotterHealth** scheme 和该手机，运行应用。
2. 独立版部署到 iPhone 能访问的 HTTPS 网址，`SPOTTER_ORIGIN` 使用该站点的实际 origin。
3. 在手机网页登录自己的账号，打开右上角账号面板，生成五分钟有效的一次性配对码。在配套应用输入网站与配对码，按系统提示允许读取「心率」。
4. 在网页完成一次训练打卡。待手表心率出现在 iPhone「健康」后打开配套应用，或点「同步训练心率」。返回网页登录时在该次训练详情核对来源、采样和摘要。

网页和配套应用均可断开连接。每个账号保留一个有效 iPhone 连接。已关联心率的训练会跳过，重新配对会使旧设备凭据失效。配套应用在打开或回到前台时同步最近 14 天、最多 24 次尚未关联心率的训练，这一版的同步在 App 前台运行。HealthKit 若未授权读取或对应时段没有数据，应用会提示检查权限和训练时间。

## 构建命令

```sh
xcodebuild -project ios/SpotterHealth.xcodeproj -scheme SpotterHealth -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

模拟器可检查构建与页面。HealthKit 授权与表上历史的读回以签名后的 iPhone 实测为准。
