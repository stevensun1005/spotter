<div align="center">

<img src="docs/assets/spotter-banner.svg" alt="Spotter 训练搭子" width="100%">

# 训练搭子 · Spotter

**手机优先的训练记录和搭子打卡工具。排计划、逐组记训练，练完互相看进度。**

[体验网页](https://spotter-free.couple-ledger-service.workers.dev) · [主要功能](#主要功能) · [快速开始](#快速开始) · [自行部署](#自行部署) · [English](README.en.md)

</div>

## 为什么做训练搭子

计划在日历里，实际重量在备忘录里，练完还要给搭子发消息。在 Spotter 打开今天的训练，记下每一组实际完成的重量和次数，完成后就能和搭子互看打卡。临时想练也可以从空白训练开始。

在浏览器可以先看示例数据。登录后可保存个人记录，也可以把独立版部署到自己的服务器。[体验网页](https://spotter-free.couple-ledger-service.workers.dev)

## 主要功能

### 计划和训练

- **按计划练，也可以临时开练。** 导入文字、计划 JSON 或跟练视频。用个人模板安排重复训练，或开一堂空白训练，再从动作库添加动作。
- **记实际完成的每一组。** 重量、次数、时长、左右侧、热身组、递减组和主观用力程度都有各自的记录项。训练页支持休息计时和恢复草稿。
- **用历史规划下一次。** 查看训练容量、次数、时长、活跃日历和肌群分布。查看动作历史，按完成记录获得下一组或下一次的负重建议。

### 搭子和分享

- **用邀请码配对。** 在同一日历里看自己和搭子的训练打卡，点记录进入详情，练完可以互相加油。
- **按关系分享。** 搭子、普通好友和教练分别管理。饮食分享有独立开关，教练下发的计划需要学员确认后进入日程。
- **保留断网时的练习记录。** Cloudflare 和 Sites 版可暂存打卡，恢复联网后同步。

### 饮食和 AI

- **记餐、喝水和体重。** 从食物库选食物并按份量计算营养，也可以拍照识别餐食。蛋白粉仓库保存每勺粉量、杯量和冲泡材料，按整杯配方记入饮食。
- **在对话里处理训练。** 站内 AI 教练可以查训练统计、记体重、起草计划。草稿可继续在聊天里改，核对后再加到日程。
- **让自己的 Agent 接入。** 外部工具可以持本人授权，读取训练上下文、提交计划草稿或添加记录。模型功能需要服务端配置。[AI 教练配置](cloudflare/docs/ai-coach.md) · [Agent 接入](cloudflare/docs/agent-api.md)

在 Sites 版的教练对话里说「喝了蛋白粉」，仓库只有一款时会直接按配方记一杯。有多款可以直接点名，没点名时教练会问你选哪款。其他功能的适用版本见下表。

## 运行方式

| 版本 | 入口 | 适合做什么 |
| --- | --- | --- |
| **独立 Node 版** | 仓库根目录，Next.js + SQLite | 在自己的服务器上运行计划导入、逐组记录、搭子、历史统计和设备数据导入。 |
| **Cloudflare 版** | [体验网页](https://spotter-free.couple-ledger-service.workers.dev) · [源码](cloudflare/) | Workers + D1。提供动作库、多周周期、断网打卡同步、饮食和 AI。与默认配置的 iPhone App 共用账号和数据库。 |
| **私密 Sites 版** | [试用站](https://spotter-duo.stezero.chatgpt.site) · [源码分支](https://github.com/stevensun1005/spotter/tree/sites/source-2026-11-24) | 邀请访问的试用环境，使用 Sites 登录和单独的 D1。适合试用站内 AI、搭子和训练记录的新功能。 |

各部署环境使用各自的账号和数据库。迁移记录时需从源环境导出，在目标环境核对账号后导入。

## 快速开始

下面启动的是仓库根目录的独立 Node 版，需要 **Node.js 24 或更新版本**。

1. 下载并安装依赖。

   ```sh
   git clone https://github.com/stevensun1005/spotter.git
   cd spotter
   npm ci
   ```

2. 把 [`.env.example`](.env.example) 复制成 `.env.local`。生成开通码，把输出填到 `SPOTTER_SETUP_CODE`。

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
   ```

3. 运行 `npm run dev`，打开[本地网页](http://127.0.0.1:3000)，用开通码注册第一个账号。在搭子空间生成邀请，发给一起训练的人。

<details>
<summary>用命令行批量导入计划</summary>

在可访问目标 SQLite 数据库的环境里，先预览日期、账号和新增数量。

```sh
npm run plans:import -- --user your-login --dry-run plans.json
```

核对后移除 `--dry-run` 再运行。完全相同的计划会跳过。数据库默认在 `.data/spotter.sqlite`，可以通过 `SPOTTER_DB_PATH` 指定。

</details>

## 自行部署

| 环境 | 部署方式 |
| --- | --- |
| **一台带持久磁盘的服务器** | 在根目录执行 `npm ci`、`npm run build`。设置 `SPOTTER_ORIGIN` 为不带尾斜杠的 HTTPS 站点地址，`SPOTTER_DB_PATH` 为可读写的持久磁盘绝对路径，`SPOTTER_SETUP_CODE` 为私密开通码。用普通服务账号运行 `npm start`，将 HTTPS 代理到 `127.0.0.1:3000`，定期备份 SQLite。 |
| **Cloudflare Workers + D1** | 在 [`cloudflare/`](cloudflare/) 构建，准备独立 D1、应用数据库迁移后部署。参考 [部署步骤](cloudflare/README.md#cloudflare-部署)和 [Apple、Google 登录配置](docs/cloudflare-login.md)。 |

## iPhone 和健康设备

- **iPhone 原生 App。** 在 Mac 的 Xcode 打开 `ios/SpotterHealth.xcodeproj`，选择 **Spotter** scheme，目标为 iOS 16 或更新版本。SwiftUI 训练界面直接调用 Cloudflare API，并使用系统登录、相机、Charts 和 HealthKit。真机安装需要签名。[iPhone App 构建与发布](docs/iphone-app.md)
- **健康同步。** 原生 HealthKit 配对与同步使用独立 Node 服务的设备接口。同步类型取决于用户授权，详见[健康设备同步](docs/health-device-sync.md)。
- **从文件导入心率。** 在训练详情导入 Apple 健康 ZIP/XML、Garmin FIT/TCX、WHOOP CSV/ZIP，或包含 `time,bpm` 的通用 CSV。核对训练时段与样本后，将结果保存到本人账号。WHOOP 汇总同步也可单独配置。

## 开发与文档

| 想做什么 | 从这里开始 |
| --- | --- |
| 改网页或接口 | [`app/`](app/) 页面和路由 · [`features/`](features/) 业务逻辑 · [`server/`](server/) 账号和存储 |
| 改 Cloudflare 或 iPhone 版 | [`cloudflare/`](cloudflare/) 网页与 Worker · [`ios/`](ios/) iPhone 源码 |
| 配 AI 或外部工具 | [计划助手](cloudflare/docs/plan-assistant.md) · [AI 教练](cloudflare/docs/ai-coach.md) · [Agent 接入](cloudflare/docs/agent-api.md) |
| 了解分享与教练机制 | [教练与学员](cloudflare/docs/coaching.md) · [项目约定](AGENTS.md) |
| 查账号、隐私和数据导出 | [隐私说明](https://spotter-free.couple-ledger-service.workers.dev/privacy) · [使用支持](https://spotter-free.couple-ledger-service.workers.dev/support) |

```sh
npm run typecheck
npm run build
npm test
```

提交问题或改动时，注明使用的版本、复现步骤和验证结果。示例数据用合成账号，个人训练、健康记录、数据库与密钥留在 Git 之外。

## 许可证与致谢

Spotter 自有代码和文档使用 [MIT 许可证](LICENSE)。openGym 的动作目录、翻译及肌肉数据保留其适用的 AGPL-3.0 和原始条目的 MIT 许可。人体图、动作媒体与其他第三方组件沿用各自条款，完整入口见[第三方声明](NOTICE.md)。感谢 [openGym](https://github.com/DuarteSantos8/openGym) 的维护者与贡献者。
