# 训练搭子 · Spotter

用手机安排训练、逐组记录、和一个搭子互相打卡。独立 Node.js 服务提供页面、账号和 API。SQLite 数据库保存在服务端的持久磁盘。页面和素材随项目构建，计划导入在浏览器里完成。可以直接粘贴训练文本、B 站或 YouTube 链接，也可以粘贴任意 AI 按页面提示词生成的 JSON。

## 本地启动

需要 Node.js 24。复制 `.env.example` 为 `.env.local`，运行以下命令生成首次开通码，把结果放进 `SPOTTER_SETUP_CODE`。开通码是私密的。

```sh
npm ci
node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
npm run dev
```

打开 [本地网页](http://127.0.0.1:3000)，选择「使用开通码或邀请码注册」。第一个账号开通后，从「搭子空间」创建双人空间，将网址和邀请码发给搭子。第二人用邀请码注册，注册和配对会同时完成。训练草稿和未共享计划仅本人可见。配对双方可以互看已完成打卡、共享计划和加油。

直接在 Codex 给出训练内容即可。只发内容时会先询问是否导入。明确说「加进去」就由 Codex 从内容生成计划并在有权限的目标账号里保存。项目约定见 [AGENTS.md](AGENTS.md)。

仓库也提供服务端工具。运行 `npm run plans:import -- --user <用户名> <计划.json>`，可用 `--dry-run` 先检查账号、新增数量和日期。工具复用网页的计划模型，使用 `SPOTTER_DB_PATH` 指向的数据库，完全相同的计划会自动跳过。

```sh
npm run build
npm test
```

测试用单独的临时数据库和两组假账号。它从正式构建启动服务，检查邀请码的一次性、共享范围、打卡和服务重启后的读回。

## 手机逐组记录与心率

点重量、次数或秒数打开数字键盘。单位按钮会按真实重量换算本动作的组记录。也可以加组、标记热身或递减、分别记左右侧、录入 RPE，或把当前字段填到上方或下方各组。

打卡完成后打开详情中的「训练心率」。也可以从历史重新打开。按打卡的开始及结束时间匹配数据，较旧的记录用已保存的训练时长估算结束时间。

| 来源 | 在手机上怎么用 |
| --- | --- |
| Apple Watch / iPhone 健康 | 安装 iPhone [配套应用](ios/README.md)，在网页的账号面板生成配对码。打开配套应用直接读取 HealthKit 心率。也支持 ZIP 和 `export.xml`。 |
| Garmin Connect | 打开单次活动，导出 FIT 原始文件或 TCX，选择导出文件。 |
| WHOOP | 选择导出的 `workouts.csv` 或含它的 ZIP。配置 WHOOP 开发者应用后，详情页也能通过授权同步单次训练的平均和最高心率。 |
| 其他设备 | 导入带心率的 FIT、TCX，或带有 `time,bpm` 列的 CSV。CSV 的时间推荐用带时区的 ISO 8601，例如 `2026-11-23T20:24:00Z`。 |

文件在浏览器读取并预览。你确认后，数据库只保存匹配的心率和摘要。心率仅账号本人可见。曲线最多保存 720 个采样点，平均、最低和最高值用全部匹配采样计算；WHOOP 等只提供摘要的来源按实际字段显示。CSV 时间必须带时区，避免将两次训练匹配到错误时段。

配套应用可逐项开启体重、系统运动、步数、活跃能量和运动时长，并选择历史范围。体重进入统计页的私人身体记录，活动按 iPhone 时区显示每日汇总，系统运动只关联已有打卡。重复同步更新已有记录，手动导入的心率不会被原生同步覆盖。账号面板显示最近同步结果；读不到样本时检查读取权限、范围和手表同步状态。当前支持前台和手动同步，Apple Watch 实时心率与后台触发尚未接入。

本地验证、真机验收及以后适配 Sites 的身份、D1 和私密站点授权边界见 [健康设备同步说明](docs/health-device-sync.md)。当前正式 Sites 保留快捷指令方案；本轮不发布或迁移它的数据。

WHOOP 在线同步需要在开发者平台登记 `<SPOTTER_ORIGIN>/api/health/whoop/callback`，并在服务器配置 `WHOOP_CLIENT_ID` 与 `WHOOP_CLIENT_SECRET`。配置和授权后可按单次训练读取 `read:workout`，不会留存授权令牌。WHOOP 提供训练摘要时显示平均和最高心率。

## 代码布局

| 模块 | 职责 |
| --- | --- |
| `app/` | 页面入口、样式入口和 HTTP 路由 |
| `features/auth/` | 账号开通、认证、会话和登录页面 |
| `features/plans/` | 计划数据、编辑器、列表和保存 |
| `features/import/` | 文本、链接和 JSON 的解析与导入预览 |
| `features/training/` | 组数记录、草稿队列、训练计时和完成打卡 |
| `features/heart/` | 心率文件解析、时间匹配、WHOOP 授权和仅本人可见的心率记录 |
| `ios/` | iPhone 配套应用、原生 HealthKit 授权和设备配对 |
| `features/health/` | 仅本人可见的体重、活动汇总、系统运动关联和同步结果 |
| `features/partner/` | 双人配对、共享状态和加油 |
| `features/history/`、`features/stats/` | 训练日历、单次记录和汇总 |
| `features/dashboard/` | 首页、导航和云端状态 |
| `server/`、`shared/` | SQLite 和 HTTP 基础层，共享类型、日期和界面组件 |

## 部署到自己的服务器

在单台持久磁盘服务器上安装 Node.js 24，执行 `npm ci` 和 `npm run build`。运行时在环境变量或当前目录的 `.env.local` 中配置：

| 变量 | 生产值 |
| --- | --- |
| `SPOTTER_ORIGIN` | 实际 HTTPS 网址，如 `https://workout.example.com`，末尾无斜杠 |
| `SPOTTER_DB_PATH` | 持久磁盘上的绝对路径，如 `/var/lib/spotter/spotter.sqlite` |
| `SPOTTER_SETUP_CODE` | 首次开通时使用的 32 位十六进制随机值 |

使用非 root 服务账号运行 `npm start`。将域名的 HTTPS 反向代理转发至 `127.0.0.1:3000`，并为应用配置进程重启和持久目录备份。服务账号需有权读写数据库目录。使用 SQLite 的在线备份或云盘快照保护训练历史。从目标网络实测首页、登录、打开训练以及打卡读回。视频能否播放由其原平台和当前网络决定。

独立版使用新的账号和数据库。旧版 Sites 部署的数据保存在原库，迁移现有记录需要单独导出并映射到新账号。
