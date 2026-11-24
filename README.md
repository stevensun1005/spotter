<div align="center">

<img src="docs/assets/spotter-banner.svg" alt="Spotter 训练搭子 · 排训练、逐组记录、和搭子打卡" width="100%">

# 训练搭子 · Spotter

**把训练排进日历，把每一组练过的东西记下来，和搭子一起坚持。**

[看看怎么用](#从一堂训练开始) · [选择版本](#选择版本) · [三步跑起来](#三步跑起来) · [自行部署](#自行部署) · [English](README.en.md)

</div>

训练计划在 PDF 里，实际重量记在手机备忘录，练完还要发消息和搭子说一声。**Spotter** 把这几步放进一个适合在健身房里操作的网页。从计划开始，逐组记下实际重量和次数，打卡后可以回看当时练了什么。

## 从一堂训练开始

| 把计划排进去 | 到健身房逐组记 | 练完和搭子打卡 |
| --- | --- | --- |
| 粘贴训练文字、JSON 或 B 站／YouTube 链接，预览日期、动作和组次后保存。 | 打开独立训练页，点重量、次数或秒数调出数字键盘。热身、递减组、左右侧和 RPE 都能记。 | 在历史里回看这堂训练，在统计里看训练次数、时长、组数和容量。配对后可以互看打卡、加油。 |

| 你会说的话 | 在训练搭子里怎么做 |
| --- | --- |
| 「这周有三堂课，帮我排到周一、周三和周六。」 | 用 Agent 整理成有日期的计划，再走导入预览。只有视频链接时，可以只存链接。 |
| 「卧推前两组 40 磅，最后一组加到 45。」 | 在每组分别记实际重量和次数。训练页可以对照计划组次。 |
| 「我先回首页，等会接着练。」 | 从训练草稿继续，已经填好的组不用重录。 |
| 「想看看这次练了多久、心率怎么样。」 | 打开这条打卡详情。导入设备文件后，可核对匹配到本次训练时段的心率。 |

## 选择版本

| | GitHub 默认分支 · 独立版 | 私密 Sites · 试用版 |
| --- | --- | --- |
| **入口** | 本仓库 `main`。在电脑运行或部署到自己的服务器。 | 邀请访问的试用站。[查看 Sites 源码](https://github.com/stevensun1005/spotter/tree/sites/source-2026-11-24)。 |
| **账号和数据** | 独立注册登录、搭子邀请码，数据保存在服务端 SQLite。 | Sites 登录与 Cloudflare D1，使用试用站自己的账号和数据。 |
| **功能** | 计划导入、逐组记录、训练草稿、双人配对、历史统计和心率导入。 | 另有多周训练周期、离线打卡同步、动作库、好友和教练权限、AI 教练与饮食。 |

### iPhone App 开发版

打开 `ios/SpotterHealth.xcodeproj`，选择 **Spotter** scheme。App 默认连接 [Cloudflare 独立试用版](https://spotter-free.couple-ledger-service.workers.dev)，并包含原生健康模块。构建、模拟器开发包和跨电脑更新流程见 [iPhone App 说明](docs/iphone-app.md)。

### Sites 试用版里可以这样用

**训练和搭子。** 多周训练周期可以按模板排程，临时有事可调整日期。训练中可以按超级组轮换、设置休息计时，离线完成的打卡会在联网后同步。好友与搭子的分享范围可在设置里查看。

**AI 教练。** 在同一段对话里查训练统计、记体重或起草计划。草稿可以继续改动作、组次和时间，再点「添加到今日训练」。使用自己的 Agent 时，按授权通过 Sites MCP 或个人 API 读写。[AI 教练配置](https://github.com/stevensun1005/spotter/blob/sites/source-2026-11-24/docs/ai-coach.md) · [Agent 接入](https://github.com/stevensun1005/spotter/blob/sites/source-2026-11-24/docs/agent-api.md)

**饮食和蛋白粉。** 拍照填餐食草稿，核对份量和营养后保存。也可以拍包装加入蛋白粉仓库，预设一勺的克数、杯量和冲泡液体，记一杯时带入整杯营养。

<details>
<summary><strong>复制一句话开始</strong></summary>

发给有权限访问训练搭子的 Agent，用已有计划排日程。

```text
把附件里的训练计划加到训练搭子，从下周一开始。
保留动作、组次、计时和原视频链接。没有写重量的填 0。
保存到我自己的账号，先核对会新增哪些日期，默认不共享。
```

在 Sites 的 AI 教练里，直接排一堂训练。

```text
今天在家练上半身，只有 30 分钟，有一对哑铃。
把动作、组次和休息时间排进草稿，我看过再加到今天。
```

只发训练资料时，Agent 会先问是否导入。明确说「加进去」后，按 [项目约定](AGENTS.md) 核对日期和目标账号。

</details>

## 三步跑起来

以下步骤适用于 **`main` 独立版**，需要 **Node.js 24 或更高版本**。

1. 下载项目并安装依赖。

   ```sh
   git clone https://github.com/stevensun1005/spotter.git
   cd spotter
   npm ci
   ```

2. 将 [`.env.example`](.env.example) 复制为 `.env.local`。生成你自己的开通码，把输出填入 `SPOTTER_SETUP_CODE`。

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
   ```

3. 运行 `npm run dev` 并打开 [本地网页](http://127.0.0.1:3000)。用开通码注册第一个账号，再从「搭子空间」生成邀请。搭子用邀请码注册时会完成配对。

<details>
<summary><strong>命令行导入现有计划</strong></summary>

在能访问目标 SQLite 数据库的环境里运行。先用 `--dry-run` 核对账号、日期和预计新增数，确认后移除此参数。相同计划会跳过。

```sh
npm run plans:import -- --user your-login --dry-run plans.json
```

导入工具使用环境中配置的 `SPOTTER_DB_PATH`，本地开发默认使用 `.data/spotter.sqlite`。网页导入每批最多 20 项。

</details>

## 心率从哪里来

| 设备或服务 | 独立版接入方式 |
| --- | --- |
| **Apple Watch / iPhone 健康** | 导入 Apple 健康 ZIP 或 `export.xml`。也可在 Mac 用 Xcode 签名安装 [iPhone 配套应用](ios/README.md)，配对后授权读取 HealthKit 心率。 |
| **Garmin Connect** | 从单次活动导出 FIT 或 TCX，在打卡详情中选择文件并预览。 |
| **WHOOP** | 导入 `workouts.csv` 或含它的 ZIP。配置开发者应用后，可以单次授权同步平均和最高心率。 |
| **其他设备** | 导入带心率的 FIT、TCX，或包含 `time,bpm` 的 CSV。建议用带时区的 ISO 8601 时间。 |

心率按实际训练时段匹配。文件先在浏览器里解析，核对预览后再把匹配结果存入本人账号。

iPhone 配套应用还可按权限同步体重、系统运动、步数、活跃能量和运动时长。体重和活动按本人账号保存，系统运动按时段关联已有打卡。前台和手动同步的验证范围、隐私及 Sites 接入说明见 [健康设备同步说明](docs/health-device-sync.md)。

## 自行部署

`main` 使用 **Next.js、React 和 SQLite**。在有持久磁盘的服务器上安装 Node.js 24，执行 `npm ci` 和 `npm run build`，再配置运行环境。

| 环境变量 | 要填什么 |
| --- | --- |
| `SPOTTER_ORIGIN` | 实际 HTTPS 网址，末尾省略斜杠，例如 `https://workout.example.com`。 |
| `SPOTTER_DB_PATH` | 服务账号可读写的持久磁盘绝对路径，例如 `/var/lib/spotter/spotter.sqlite`。 |
| `SPOTTER_SETUP_CODE` | 首次创建账号使用的私密开通码。 |

用非 root 服务账号运行 `npm start`，将域名的 HTTPS 反向代理转发至 `127.0.0.1:3000`。给进程设置自动重启并定期备份 SQLite。从实际使用的网络核对登录、打开训练、保存打卡和读取历史。

<details>
<summary><strong>配置 WHOOP 在线同步</strong></summary>

在 WHOOP 开发者应用登记 `<SPOTTER_ORIGIN>/api/health/whoop/callback`，并为服务设置 `WHOOP_CLIENT_ID` 和 `WHOOP_CLIENT_SECRET`。用户授权后可在训练详情中获取匹配的单次活动心率摘要。授权令牌仅在本次同步使用。

</details>

## 开发与数据

| 目录 | 维护什么 |
| --- | --- |
| [`app/`](app/) | 页面入口、样式和 HTTP 路由 |
| [`features/`](features/) | 按领域拆分的计划、训练、搭子、历史、统计和设备功能 |
| [`server/`](server/) · [`shared/`](shared/) | SQLite、会话、共享类型及 UI |
| [`ios/`](ios/) | iPhone 配套应用与 HealthKit 授权 |
| [`tools/`](tools/) · [`tests/`](tests/) | 计划导入 CLI 与验证 |

```sh
npm run typecheck
npm run build
npm test
```

测试用临时数据库和合成账号校验注册、搭子邀请、共享权限、打卡保存与服务重启后的读回。真实训练资料、设备数据、数据库和密钥留在 Git 之外。独立版与 Sites 分开存储，迁移时需单独导出并映射到新账号。
