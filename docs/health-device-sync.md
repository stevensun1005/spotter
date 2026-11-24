# 健康设备同步与 Sites 接入

## 本轮边界

开发基线是独立版 `main@78d09dc`，工作分支为 `codex/health-device-sync`。开始时工作目录为空；克隆后的 main 没有未提交改动。仅修改独立版和 iPhone 工程，不发布 Sites，不改 Sites 权限、环境变量、数据库或动作库。

Sites 参考源码以只读方式取得，检查到的提交是 `fd27f3d8d4112e9a2fbaf9aeae81ccb661267a6f`。这代表取得的源代码版本，不代表本轮在正式站完成了功能验证。

## 两种现有接入的区别

| 项目 | 独立版 | 当前 Sites 试用版 |
| --- | --- | --- |
| 运行环境 | Next.js / Node.js 24 | Vinext / Cloudflare Worker |
| 身份 | 本地账号和 HttpOnly 会话 | Sites Sign in with ChatGPT 的站点用户 ID |
| 存储 | `node:sqlite`，版本化本地迁移 | D1 `DB`，Drizzle SQL 迁移 |
| Apple 心率 | iPhone HealthKit → 设备令牌 → `/api/health/apple/sync` | Safari 快捷指令 → DOM 自定义事件 → 网页预览 → `/api/health` |
| 授权 | 网页生成五分钟一次性码，App 兑换并用 Keychain 保存凭据 | iPhone 快捷指令的健康读取授权；保存依赖浏览器登录态 |
| 上传训练归属 | 设备令牌映射账号，服务端再校验训练 ID 和时间窗 | 网页登录账号，服务端再校验训练 ID 和时间窗 |
| 身体记录 | 本轮新增私密健康记录模块 | 已有 `library` 的 `nutrition` / `weight` / `kg` |
| 共享 | 沿用现有计划、训练和搭子规则 | 另有好友、分享卡片等规则；本轮不改 |

Sites 的 `features/heart/apple-shortcut.tsx` 先将训练起止时间以 ISO 8601 提供给快捷指令，再接收 `spotter-apple-health` 事件中的 CSV。`shortcut-data.ts` 筛选训练时段，用户预览确认后保存。这里没有设备令牌端点，原生 App 不能只换一个网址就直接使用。

## 后续接入 Sites 的顺序

1. 等动作库补齐、核对并获得统一更新指令后，再在 Sites 专用开发分支移植；保留同一 `project_id`、访问权限及现有 D1 数据。
2. 在 Sites 内复用 HealthKit 数据协议、时间匹配、单位转换和界面；将同步存储适配为异步 D1，新增迁移，不覆盖原表或账号。
3. 配对码由已登录 Sites 用户发起，所有归属保存该站点的稳定 `userId`，不能拿独立版账号 ID、邮箱或其他站点 ID 直接替代。
4. 先验证 Sites dispatch 对无浏览器会话的原生设备请求的行为。私密站点可能在进入 Worker 之前要求登录；仅在 Worker 新增 Bearer 端点不等于外部 App 已能访问。必须用合成测试设备验证实际 HTTPS 响应。
5. 如果平台不能为私密站点提供适当的设备授权通道，继续保留快捷指令；另建经过授权的独立 HTTPS 同步服务作为桥接，再设计用户可撤销的账号绑定。平台级 SIWC bypass token 不可嵌入 iPhone App、仓库或网页。
6. 体重映射到 Sites 身体记录的 kg 口径；保留 HealthKit UUID 和来源作为幂等元数据。活动量单独存储，运动记录只关联已有打卡。原始心率、身体及活动数据不自动纳入搭子、好友、分享卡片或 MCP 导出。
7. 在本地 D1 和隔离 HTTPS 测试站完成双账号、重配、撤销、重试和同日两练，再按明确的统一发布指令更新正式站。保留旧快捷指令及文件导入作为补同步入口。

## 真机验收

需有能使用 HealthKit 的 Apple 开发团队、可用唯一 Bundle ID 和 provisioning profile；手机连接并信任 Mac、解锁、开启开发者模式。网页和 App 使用同一个可由手机访问的 HTTPS 测试 origin。iPhone 的 `localhost` 指向手机自身，不能代替 Mac 服务；不降低 ATS 或在正式 Sites 上试写。

用户在系统健康弹窗选择允许的类型。HealthKit 不提供可靠的“读取已拒绝”状态，授权请求成功也不代表每种类型都可读；空结果应检查授权、可读历史范围、训练时间和手表是否已同步。[Apple 授权说明](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)。

验收顺序：网页生成一次性码 → App 配对 → 用户健康授权 → Apple Watch 记录进入 iPhone 健康 → 按网页实际起止时间同步 → 详情核对曲线、均值、最低、最高和来源 → 同日第二练核对归属 → 再次同步核对幂等 → 断网后恢复重试 → 网页或 App 断开连接 → 旧令牌被拒绝。

历史读取和实时心率分开验收。这是 iPhone HealthKit 历史读取方案，没有 watchOS 实时 workout session。后台 observer 需要额外 entitlement、注册和真机触发验证；不能由前台同步或模拟器构建推断后台已可用。[Apple 后台投递要求](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)。

## 其他设备

- 已写入 Apple 健康的第三方数据由 HealthKit 读取，保留可获得的源名称和 bundle 标识；设备本身支持但未写入健康的字段不会自动出现。
- 活动累计使用 HealthKit 的统计合并值，不把 Watch、iPhone 和第三方重复样本直接相加。[Apple 统计说明](https://developer.apple.com/documentation/healthkit/hkstatistics)。
- WHOOP 沿用现有 OAuth，只有在隔离测试环境配置真实测试凭据及准确回调后才验证在线授权；合成 OAuth state 检查不代表厂商授权成功。
- Garmin 优先验证 FIT / TCX 的选定时段心率导入；这些文件导入不创建新的训练打卡。直连需要实际开发者权限和回调，不能从文件导入通过推断直连可用。

不同来源的系统运动，仅在唯一匹配同一打卡、同运动类型、首尾各差不超过 60 秒且重合至少 90% 时合并显示来源；不相加能量或时长，不删除原始私密来源记录。同源记录、未唯一匹配的记录保持独立。活动量使用 HealthKit 的合并统计，按账号和当地日期覆盖；同一批重复日期或样本 UUID 会被拒绝。

## 本地协议与验证命令

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run test:health-native
xcodebuild -project ios/SpotterHealth.xcodeproj -scheme SpotterHealth -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath work/ios-derived CODE_SIGNING_ALLOWED=NO build
```

`npm run build` 使用 Next.js 支持的 webpack 后端。本机默认 Turbopack 在 CSS 子进程绑定端口时因权限失败；webpack 产物已实际启动并通过 HTTP 测试。没有更改应用部署地址或正式站配置。

`test:health-native` 是可选 macOS 检查，需要 `swiftc`。它编译实际 Swift 数据模型，生成纯合成心率和健康记录，再经过生产 API 路由的 JSON 校验、账号配对、重复上传、训练关联、隐私及撤销检查。临时 SQLite 和二进制结束后删除。它没有执行 HTTPS 网络传输或 HealthKit 系统授权；普通 `npm test` 不依赖 Xcode。

| 接口 | 权限与口径 |
| --- | --- |
| `GET/POST /api/health/apple` | 网页当前账号；读取私密概览/状态，签发配对码或断连 |
| `POST /api/health/apple/pair` | 一次性配对码兑换设备令牌，五分钟过期；服务端只存哈希 |
| `GET /api/health/apple/sync` | 设备令牌；`from/to` 为绝对毫秒，最多 366 天，`limit` 最大 100，跟随 `nextCursor` |
| `POST /api/health/apple/sync` | 设备令牌；`{id,data}` 写入匹配训练心率，或 `action: report` 报告整次结果 |
| `POST /api/health/apple/records` | 设备令牌；选定类型、IANA 时区和最多 31 天范围；体重、运动、活动批次幂等更新 |
| `DELETE /api/health/apple/sync` | 设备令牌；撤销当前连接，保留账号已有私密历史 |

`selected` 是本次选择，`received` 是本次实际读到样本的类型，`emptyTypes` 是没有读到的选定类型，均不代表系统授权状态。旧客户端未报告 `received` 时保持未知。网页概览显示各类最近 30 条，再按当前统计日期过滤；历史数据仍保存在私密表中。

## 验证记录

所有服务端验证使用临时 SQLite、合成训练和测试账号，真实健康数据不进入 Git 或日志。

| 环境 | 结果 |
| --- | --- |
| 本地 Node 服务 | `npm run build`、`npm run typecheck` 通过；`npm test` 17/17 通过。包含实际 HTTP 服务、两账号共享边界、重启读回、新健康接口、配对过期/重配/断连、同日两练、跨午夜、DST、kg/lb、历史分页、重复与延迟同步、手工数据保护、实际读取类别和 FIT/TCX 导入。 |
| Swift 本地合成 | NativeSmoke 及 `npm run test:health-native` 通过；实际 Swift 编码经服务端生产路由校验、重复上传、归属、隐私及断连通过。URLProtocol 合成验证断网恢复、持续断网最多三次、503 恢复、401/取消不重试；Toronto 25 小时 DST 日检查通过。 |
| 本地网页 | 隔离合成账号浏览器验收：390 和 320 像素宽无横向溢出，心率曲线/均值/极值/来源、连接状态、身体/活动和系统运动正常；80 kg 显示为 176.37 lb。 |
| Xcode 模拟器 | 最终 iOS Simulator SDK Debug 构建通过，`CODE_SIGNING_ALLOWED=NO`。没有把编译通过当作健康授权或手表读回验证。 |
| 签名与 iPhone | 发现已配对 iPhone 和有效开发证书；默认 `app.spotter.health` 签名构建缺对应 development provisioning profile。用户当前不便操作设备，未安装、未授权、未验证 Watch 真机闭环。仍需有效团队、唯一 Bundle ID 和包含设备及 HealthKit 的 profile。 |
| HTTPS 测试服务 | 仓库未配置，未部署；没有端到端 HTTPS 真机验证。 |
| 正式 Sites | 仅检查站点信息和参考源码；未发布、未写数据、未改权限。收尾复核仍为第 45 版、访问权限修订 2。 |

WHOOP 只验证既有 OAuth state / 账号 / 回调构造和拒绝路径（测试内使用合成凭据），没有真实厂商授权。Garmin FIT/TCX 使用合成文件验证，未开通开发者直连。重试已做合成故障验证；iPhone 实际断网恢复、Keychain 系统行为、实时心率和后台触发仍需另行真机验收。
