# 训练搭子 Spotter 软件设计

本文记录用户实际操作、客户端和服务端实现，以及功能改动时需要一起维护的资料。功能状态以本文链接的源码和实际验证为准。生产、测试和私密试用的发布记录另行核对。

## 产品与运行环境

Spotter 围绕「安排训练 → 逐组记录 → 完成打卡 → 回顾和分享」组织功能。饮食、身体记录和设备数据都是本人账号的独立记录。用户可以自行训练，也可以邀请搭子、连接普通好友，或与教练建立独立关系。

| 环境 | 客户端与后端 | 身份和数据边界 |
| --- | --- | --- |
| iPhone App | [SwiftUI 源码](../ios/SpotterHealth/) → 原生 `NativeAPI` → Cloudflare HTTPS API | 默认和 Cloudflare 网页使用同一账号与 D1。登录后才进入主界面，已验证的账号可离线访问在本机缓存的训练。 |
| Apple Watch | [watchOS 配套 App](../ios/SpotterWatch/) → HealthKit、Workout Mirroring、WatchConnectivity → iPhone | 训练期间使用 iPhone 当前草稿，训练结束由 iPhone 打卡。健康数据按账号和训练关联。 |
| 小组件与实时活动 | [WidgetKit 与 ActivityKit](../ios/SpotterWidget/) → [App Group 摘要](../ios/SpotterWidgetShared/) | App 生成最小展示摘要，Widget 使用该摘要和经校验的 App 入口。 |
| Cloudflare 网页 | [网页与 API](../cloudflare/app/) → [业务模块](../cloudflare/features/) → Workers + D1 | 产品网页和 App 的云端数据入口。TestFlight 的部分好友和头像请求可走独立 Beta Worker，使用同一个 D1 和账号会话。 |
| 私密 Sites | [试用站](https://spotter-duo.stezero.chatgpt.site) · [Sites 源码分支](https://github.com/stevensun1005/spotter/tree/sites/source-2026-11-24) | 用 Sites 账号、访问控制和独立 D1。功能以已发布的站点版本为准。iPhone 的默认 Cloudflare 账号和数据需经明确迁移才会出现在这里。 |
| 独立 Node 自托管版 | [Next.js 页面/API](../app/) → [功能](../features/) → [服务端](../server/) → SQLite | 独立账号、设备令牌及数据库，支持计划、逐组训练、搭子和设备导入。 |

## 登录与初次使用

1. iPhone 使用「通过 Apple 登录」或 Google 登录。已有账号可用访问码。登录后从「今日 → 设置 → 账号」编辑头像、昵称和 `用户名#编号`，或绑定另一种登录方式。绑定动作在已登录的账号下完成。之后分别用 Apple 或 Google 登录，服务端按各自身份找到同一个 Spotter 账号。
2. 昵称是联系人、朋友圈和搭子界面的主要显示名称。用户名和数字编号可编辑，完整组合必须唯一，用于查找好友或搭子。个人账号页管理登录绑定、隐私及删除账号。
3. 初次进入支持当前引导版本的客户端会看到欢迎页。可以按需「授权 Apple 健康」「允许 iPhone 通知」，随后选择「开始使用引导」或「跳过引导」。引导高亮真实训练、饮食、社交和 AI 入口，最后带用户从教练菜单走到「用自己的 AI」的使用教学。试填训练或餐食及试搜搭子时，保存或发送按钮会限制写入。可以跳过一节或结束引导。以后从「设置 → 关于与更新 → 重新查看使用引导」重开，原有账号的完成进度继续有效。
4. 可选权限的提醒按账号和服务地址记录。仍需授权或核对时，两次提醒至少相隔 14 天。系统对相机、照片、麦克风和语音识别的授权在使用相应功能时出现。Apple 健康读不到样本时，界面区分需授权、需核对、已能读取部分数据和用户已确认。

实现见 [NativeApp](../ios/SpotterHealth/NativeApp.swift)、[NativeAccount](../ios/SpotterHealth/NativeAccount.swift)、[NativeWelcome](../ios/SpotterHealth/NativeWelcome.swift)、[NativePermissionOnboarding](../ios/SpotterHealth/NativePermissionOnboarding.swift) 和 [Cloudflare 账号与 OAuth](../cloudflare/features/auth/)。原生 API 会话保存在设备 Keychain。OAuth 配置见 [Apple 和 Google 登录](cloudflare-login.md)。

在「设置 → 账号 → 头像」保存或移除照片后，首页的今日搭子打卡、联系人、朋友圈、账号页及打开的训练分享卡共用同一个头像状态。切换标签、App 回到前台或网络恢复时，会刷新当前显示的头像，前台也会定期补查。已删除的头像回到首字占位。照片只缓存在当前账号的 App 进程内，写入仍由本人通过 `/api/auth/avatar` 完成。读取接口 `/api/auth/avatars` 使用当前会话，只返回本人、可见好友、搭子及有效教练关系的头像。[原生头像状态](../ios/SpotterHealth/NativeAccountAvatar.swift) · [服务端头像可见性](../cloudflare/features/auth/visible-avatars.ts)

## iPhone 导航与核心流程

底栏依次为「今日」「训练」、中央开始/继续训练按钮、「统计」「好友」，右侧独立星形按钮打开 AI 教练。好友入口可在功能模块隐藏。固定底栏和主要分段菜单使用适用版本的 SwiftUI 液态玻璃。普通表单和卡片按钮采用项目控件的按压反馈。外观遵循主题、文字大小和减少动态效果偏好。组件在 [NativeApp](../ios/SpotterHealth/NativeApp.swift) 和 [NativeControls](../ios/SpotterHealth/NativeControls.swift)。

| 入口 | 用户操作 | 实现位置 |
| --- | --- | --- |
| 今日 → 饮食记录 | 从饮食卡片看当天热量、蛋白质、碳水、脂肪和饮水。点卡片进入明细，点卡片右上角的叉收起，点圆形饮食图标展开。快捷项为「记录正餐」「加餐」「饮水」「常用餐」「拍照记录」。 | [首页训练和饮食容器](../ios/SpotterHealth/NativeWorkouts.swift) · [饮食](../ios/SpotterHealth/NativeNutrition.swift) |
| 今日 → 训练日程、今日训练 | 在一周日程中选日期。打开当天计划、继续训练草稿，或在已完成项点「查看记录」。计划菜单允许移动或删除，打卡历史保留。 | [首页训练](../ios/SpotterHealth/NativeWorkouts.swift) · [计划改期](../ios/SpotterHealth/NativePlanSchedule.swift) |
| 训练 → 我的计划 | 「新建计划」填写日期、类型、动作和组次。「添加计划」含「AI 教练起草」「粘贴已有内容」「训练周期」。可以导入训练文字、计划 JSON 或受支持的跟练链接，先核对再保存。「待训练」列表在底部集中展示已排期的「跟练视频」。 | [训练视图](../ios/SpotterHealth/NativeWorkouts.swift) · [计划导入](../ios/SpotterHealth/NativePlanImport.swift) |
| 训练 → 个人模板 | 可新建、从计划或打卡另存，也可用模板「安排训练」。iPhone 用「改名」「编辑动作」或「编辑模板」更新，网页点「编辑」进入「编辑模板」。两端删除均需确认，已保存的跟练链接均列于底部「跟练视频」。 | [原生训练与模板](../ios/SpotterHealth/NativeWorkouts.swift) · [个人模板服务](../cloudflare/features/library/server.ts) |
| 训练 → 官方模板 | 官方模板默认可见，可到「设置 → 功能模块」关闭。按「增肌」「减脂」「减肥」「功能性训练」及初级、中级或高级筛选。打开模板查看每周运动日与休息日，设「周期开始日」后点「使用这个模板」，经排期预览和确认才加入日历。 | [官方模板](../ios/SpotterHealth/NativeOfficialTemplates.swift) · [模板资源](../ios/SpotterHealth/Resources/official-training-templates.json) · [周期编排](../ios/SpotterHealth/NativePrograms.swift) |
| 训练 → 动作库 | 按名称、肌群、器械等查找。支持可用器械筛选、动作详情和加入训练。媒体和动作识别保留目录 ID，动作目录与用户记录分开维护。 | [动作库浏览](../ios/SpotterHealth/NativeCatalogueView.swift) · [目录资源读取](../ios/SpotterHealth/NativeCatalogueData.swift) · [网页动作库](../cloudflare/features/exercises/) |
| 中央开始训练 | 继续进行中的训练，或选计划、临时训练及有氧等入口。有氧可选跑步、跑步机、户外/室内骑车、划船机、椭圆机、步行、爬楼、游泳、跳绳等。实际训练保存计时，支持的项目可填距离或速度。 | [训练入口及逐组记录](../ios/SpotterHealth/NativeWorkouts.swift) · [训练模型](../ios/SpotterHealth/NativeWorkoutModels.swift) · [服务端有氧字段](../cloudflare/features/training/cardio.ts) |
| 统计 → 训练统计 / 打卡历史 | 按周、月、季、年、最近或自定义日期回顾训练容量、次数/天数、时长和完成组数。历史以月历显示自己的训练及对方允许共享的记录。点日期或打卡看详情。 | [统计与月历](../ios/SpotterHealth/NativeWebSecondary.swift) · [网页统计](../cloudflare/features/stats/) · [网页历史](../cloudflare/features/history/) |
| 好友 → 联系人 / 朋友圈 / 权限设置 | 「添加好友」「找搭子」通过账号用户名搜索，普通好友也可用邀请链接。联系人详情按日查看共享训练和饮食、设定本人给对方的权限。朋友圈显示自己和好友近期可见的打卡及加油。 | [好友界面](../ios/SpotterHealth/NativeWebSecondary.swift) · [好友规则](../cloudflare/features/friends/) · [搭子模型](../cloudflare/features/pair/) |
| 底栏星形按钮 → Spotter 教练 | 可自由对话、点推荐操作、用计划问答生成草稿、拍照或从相册附图。向上展开可进入大面板。App 进程运行期间保持当前对话，完全退出后重新打开时从新对话开始。 | [原生教练](../ios/SpotterHealth/NativeCoach.swift) · [推荐卡片](../ios/SpotterHealth/NativeCoachRecommendations.swift) · [网页教练](../cloudflare/features/ai-coach/) |

### 训练、计划与详情

- 训练计时根据起止时间和已累计时长计算，切到后台或锁屏不会自动暂停。可逐组记重量、次数、时长、左右侧及适用的 RPE。组间休息可调整、跳过或倒计时。完成组和训练前次表现可用于下一组参考。
- 「训练周期」支持多个周、阶段、模板快照、复制周、进阶/减量和可选的 %1RM、目标 RPE。保存周期草稿与预览排期是同一流程的不同动作。确认时服务端核对当前 revision 和预览令牌，保护已完成、进行中及手动改动的训练。
- 训练草稿和打卡分别按账号和服务地址暂存。打卡先写本机，再用同一记录 ID 上传 `/api/workout`；联网或重试时沿用原 ID。活动、日历、历史和数据导出以实际完成记录为准。普通删除计划保留既有完成记录。
- 个人模板修改按当前版本保存。改动动作后，仍跟随模板动作的训练使用最新版。删除模板前确认影响，服务端保留已排的训练并解除模板关联，完成打卡仍按原记录展示。[模板关联与解除](../cloudflare/features/plans/template-server.ts)
- 训练详情集中显示训练时间、动作和组次、完成摘要、「训练数据」、「训练心率」及底部肌群分布。自己的记录可编辑、另存模板及分享。分享卡可选样式、显示明细、合并当天训练，并通过系统分享或保存图片。附带心率由本人选择且默认关闭。

修改时核对 [原生模型](../ios/SpotterHealth/NativeWorkoutModels.swift)、[训练页与详情](../ios/SpotterHealth/NativeWorkouts.swift)、[分享卡](../ios/SpotterHealth/NativeWorkoutShare.swift)、[Cloudflare 训练模型和同步](../cloudflare/features/training/) 及 [周期服务](../cloudflare/features/programs/)。

### 饮食与身体

- 「记录正餐」进入早餐、午餐和晚餐选择；「最近记过」点按后沿用上次份量直接记入。手动填食物名、份量和营养后点「保存」。饮水按毫升，食物和宏量营养用克，能量用千卡。数据以当前用户当地日期归档。
- 「常用餐」可从食物组成 1–3 项的组合。App 本机保存组合；使用组合生成的餐食记录写入云端。首页拍照记录直接打开相机，识别结果支持查看、补充、编辑与撤销。可读的标签和用户明确的份量优先，常用「一碗」「一杯」可按可解释的份量估算，并保留估算信息。
- 「设置 → 蛋白粉仓库」保存产品、一勺粉量、冲泡材料和杯量，可拍照读标签、核对后保存为训练默认。完训选择已喝蛋白粉时，随打卡写逐笔餐食记录。已有记录与重复请求仍按稳定 ID 防重。
- 「设置 → 账号 → 身体档案」或开始训练面板的「身体数据」查看体重、身体测量和身体档案。相关 Apple 健康样本可在本机核对，再同步选定值。身体目标、档案和饮食记录维持各自数据类型。

实现见 [饮食](../ios/SpotterHealth/NativeNutrition.swift)、[蛋白粉](../ios/SpotterHealth/NativeProtein.swift)、[身体档案](../ios/SpotterHealth/NativePersonalData.swift)、[个人库模型](../cloudflare/features/library/model.ts) 和 [饮食业务](../cloudflare/features/nutrition/)。

### 搭子、教练与通知

- 好友与搭子依关系各自授权。好友主页的「权限设置」管理朋友圈范围，个人详情管理定向分享。新关系的饮食默认值及搭子确认表单由当前后端返回的 `betaSocialDefaults` 决定。已有关系使用已保存的开关。原始心率、身体测量和活动数据保持私密。
- 「设置 → 功能模块」开启「教练与学员入口」后，入口显示在「好友 → 联系人 → 找搭子」旁，默认隐藏。教练可下发训练计划或多周周期，学员预览确认后导入自己的计划。反馈、完成进度和可见的实际组记录由教练系统自己的权限管理。[教练系统](../cloudflare/docs/coaching.md)
- 「设置 → 通知」管理搭子提醒、好友打卡和系统通知权限。好友页铃铛打开站内通知中心。受支持的账号在联系人详情可提醒搭子训练。线上推送同时受服务端开通范围、接收偏好、提醒间隔、APNs 及设备权限约束。训练提醒和组间休息提醒也可由系统本地通知运行。

实现见 [社交界面](../ios/SpotterHealth/NativeWebSecondary.swift)、[学员界面](../ios/SpotterHealth/NativeCoaching.swift)、[通知客户端](../ios/SpotterHealth/NativeSocialNotifications.swift) 和 [服务端通知](../cloudflare/features/notifications/)。

### AI 教练、导入与外部 Agent

- 站内 AI 使用当前账号的请求授权。用户主动提出记餐时，文本上下文用于核对食物、餐次和数量；明确请求后可以直接保存并显示回执。询问营养、浏览建议或试填内容无需写入记录。训练计划经预览确认后入日程。系统读取的 Apple 健康原始数据不随站内教练请求发送。
- 生成训练计划可用表单问答或对话，推荐可引用动作目录和官方模板。卡片按实际可用动作显示查看详情、加入训练或查看计划等操作。AI 用量在「设置 → AI 教练」，服务端按账号限制每 UTC 日 200、每 UTC 月 2,000 条消息，并另有月度费用预算。
- 「设置 → 外部 Agent」可创建和撤销个人连接，网页从「添加计划 → 用自己的 AI」进入。连接名称、有效期及可读写范围在创建时选择。「复制提示词」提供一份通用文本，内含 MCP 和 OpenAPI 地址，以及编排训练、记饮食、分析记录、管理模板和演示动图的指令。连接创建后自动定位到提示词卡片，在同一卡片用「复制令牌」取得只在本次创建后提供的连接凭据。提示词粘贴到自己的 AI 对话框，令牌只填入外部工具的凭据设置。[原生连接](../ios/SpotterHealth/NativeAgentAccess.swift) · [网页连接](../cloudflare/features/agent-access/access-panel.tsx)
- App 的「设置 → 外部 Agent → 使用教学」和教练「用自己的 AI」的连接页共用四步教学。教程带用户选权限、配置自己的客户端、复制提示词执行示例，并在「我的连接」核对最近使用时间或撤销。新手引导高亮真实入口，使用教学只展示说明和示例。[SwiftUI 使用教学](../ios/SpotterHealth/NativeAgentAccess.swift)
- 外部 Agent 按当前账号的 `profileRef` 与连接权限校验归属。权限区分编排资料、训练草稿、排期、分类读取和写入。健康原始读数、身体数据与搭子或好友的记录均在外部 Agent 读取范围之外。明确授权后才记餐，重试同一餐食复用原 UUID。[Agent 权限](../cloudflare/features/agent-access/model.ts)
- 外部 Agent 管理个人模板时，用 `templates:read` 读取模板 ID 和版本，用 `templates:manage` 预览改名、替换整份动作列表或删除。预览展示对关联计划的影响，用户确认后提交同一个预览令牌。版本已变或预览到期时需重新核对。[模板修改服务](../cloudflare/features/agent-access/template-change.ts)
- 连接获得 `exercise-demos:write` 后，外部 Agent 可针对用户确认的动作上传、替换或移除私人演示 GIF。GIF 上限 768 KiB，宽高各不超过 480 像素，限 2–90 帧，并限制解码总像素。动作详情只向登录的所有者展示该附件。App 回到前台或刷新训练时同步动作资料。现有 JSON 备份包含动作资料，GIF 文件随账号保存在 Cloudflare。[演示校验和存储](../cloudflare/features/exercises/personal-demo.ts) · [原生动作详情](../ios/SpotterHealth/NativeCatalogueView.swift) · [网页动作详情](../cloudflare/features/exercises/exercise-view.tsx)
- 在教练点「怎么用训练搭子？」或输入「怎么拍照记餐」「外部 Agent 在哪」等操作问题，会按当前端列出入口和按钮。iPhone 可继续追问「那饮食呢？」。已收录的问答由客户端直接回答，即使一般 AI 对话额度用完也可使用。导航回答只指导操作。明确记餐、生成计划和训练咨询继续走各自流程。
- 共用的 [产品帮助资料](../cloudflare/shared/product-help.json) 按主题 ID、别名和 iPhone / 网页步骤维护。[iPhone 查询](../ios/SpotterHealth/NativeProductHelp.swift) 在本机读取打包资源。[网页查询](../cloudflare/features/ai-coach/product-help.ts) 复用于浏览器和服务端，API 在验证账号后优先处理操作问答。

实现见 [站内 AI 配置](../cloudflare/docs/ai-coach.md)、[Agent 接入](../cloudflare/docs/agent-api.md)、[AI 服务端](../cloudflare/features/ai-coach/)、[Agent 权限模块](../cloudflare/features/agent-access/) 和 [NativeAgentAccess](../ios/SpotterHealth/NativeAgentAccess.swift)。

## 设备、健康数据、Widget

| 使用方式 | 路径与数据边界 | 实现 |
| --- | --- | --- |
| iPhone 查看 Apple 健康 | 「设置 → 手表与健康 → 授权 Apple 健康」，由系统选择具体类别。健康和身体页面在前台支持读取刷新。系统样本取决于设备、系统可读类型和用户选择。 | [HealthKitReader](../ios/SpotterHealth/HealthKitReader.swift) · [NativeHealth](../ios/SpotterHealth/NativeHealth.swift) |
| Apple Watch 实时训练 | iPhone 打开训练后，在「Apple Watch 心率」点「连接」。第一次在手表确认权限。在表上可看动作和组次、记录或撤销当前组、调节休息、暂停或继续。实时心率为当前训练内的配对设备通信，过期读数会隐藏。完成打卡从 iPhone 发起。 | [Watch App](../ios/SpotterWatch/SpotterWatchApp.swift) · [iPhone 镜像管理](../ios/SpotterHealth/NativeWatchHeartRate.swift) |
| 手表完成摘要与历史心率 | 打卡后按真实训练时间和连接令牌归属摘要，显示活跃热量、总热量和平均心率。总热量使用同段活跃与静息热量；缺项显示「—」。训练详情「训练心率」右上角的圆形同步按钮可补读曲线和相符的 Apple Watch 运动；正式记入的摘要和原始心率独立存储。训练热量只作训练展示。 | [Watch 数据协议](../ios/SpotterHealth/NativeWatchHeartRatePacket.swift) · [摘要补传](../ios/SpotterHealth/NativeWorkoutHealthSync.swift) · [摘要 API](../cloudflare/app/api/health/workout-summary/route.ts) |
| Garmin、WHOOP、Google 和 RENPHO | 这些来源已写入 Apple 健康的受支持字段随 HealthKit 读取；源设备未写入的字段需要厂商能力。网页训练详情有 FIT/TCX、Apple 健康导出、WHOOP CSV/ZIP 和通用 CSV 入口。WHOOP 在线同步是网页功能，需要已配置的厂商 OAuth。RENPHO 分段肌肉和脂肪依赖支持分段的秤与可用导出，目前没有从 Apple 健康取得这类分段指标的入口。 | [设备说明](../ios/README.md) · [网页心率导入](../cloudflare/features/heart/) |
| 独立 Node 的原生配对 | 网页生成五分钟的一次性配对码。手机在测试/自托管 HTTPS 地址使用 Keychain 设备令牌，按账号及窗口上传选定的心率、体重、活动和运动。重复样本与已写运动保持幂等。重新配对替换旧凭据，断开后旧设备失效。 | [Apple 设备 API](../app/api/health/apple/) · [配对与同步说明](health-device-sync.md) |
| 私密 Sites 的 iPhone 历史导入 | 在 iPhone Safari 的打卡详情用快捷指令读取训练时段；预览后由网页账号保存。也支持网页文件流程，是否可用以已发布版为准。 | [Sites 接入差异](health-device-sync.md#两种现有接入的区别) |
| 主屏小组件 | 长按 iPhone 主屏 → 添加小组件 → 搜索「训练搭子」。「搭子督练」支持小号或中号，小号并排查看本周进度。「今日饮食」和「我的训练周报」为中号。「年度训练热力图」为中号或大号。周报展示最近完整周；热力图展示最近 365 天。点摘要打开对应 App 页面。 | [Widget 卡片](../ios/SpotterWidget/SpotterWidget.swift) · [共享摘要](../ios/SpotterWidgetShared/) |
| 锁屏实时活动和灵动岛 | 「设置 → 计时提醒 → 锁屏实时训练」。活动训练时显示时间和完成组数，展开可查看下一组、休息倒数和近期 Watch 心率。可点按回到进行中的训练。支持能力取决于 iOS 版本、设备和系统设置。 | [App ActivityKit 管理](../ios/SpotterHealth/NativeTrainingLiveActivity.swift) · [锁屏与灵动岛](../ios/SpotterWidget/SpotterWorkoutLiveActivity.swift) |

主屏小组件使用当前账号的限时摘要，签出后清理。iOS 系统可以隐藏小组件敏感内容。健康说明中的模拟器编译或合成协议验证不能证明真机授权、实际心率及 Watch 后台队列已验证。[App 与设备核验](iphone-app.md)

## 网页交互与版本差异

| 网页位置 | 操作与实现 |
| --- | --- |
| Cloudflare 网页 → 今日 / 训练 / 统计 / 好友 | [Dashboard](../cloudflare/app/dashboard.tsx) 组装同名的四个标签、开始训练、设置、饮食和 AI 面板。运动计划、日程、统计和编排规则与 iPhone 使用同一云端数据。浏览器的控件布局和本地展示偏好由网页自己的组件维护。 |
| 网页计划与训练 | 「添加计划」在站内 AI 和「用自己的 AI」间选择。训练流程使用单独的 [训练页面](../cloudflare/app/training/)，支持编辑组次、历史建议和计时。浏览器在断网时把待传打卡加入队列，原 ID 在恢复网络后重传。 |
| 网页已完成训练 → 训练心率 | 选择文件或厂商同步入口，核对匹配时段及来源后保存。浏览器由 [心率功能组件](../cloudflare/features/heart/) 解析并预览导入。SwiftUI 训练详情以 Apple 健康的圆形同步入口为主。 |
| 私密 Sites | 发布基线从站点源码分支核对。登录和运行时环境由 Sites 管理，快捷指令、旧 MCP 及网页功能以该部署实际版为准。权限、站点标识和 D1 按独立发布流程管理。 |
| 独立 Node → 今日/计划/统计/导入 | [Dashboard](../features/dashboard/) 负责布局与交互，训练详情由 [独立训练路由](../app/training/) 处理。独立版的登录、计划、训练和设备接口位于仓库根目录，使用不同的存储和部署命令。 |

## 设置、接口与资料维护

| 设置组 | 内容与存储 |
| --- | --- |
| 账号、通知、AI 教练、外部 Agent | 账号资料和授权由各自服务接口管理。可编辑昵称、头像和账号标识、绑定 Apple/Google、改共享偏好及删除账号。通知可区分站内记录和系统推送。 |
| 训练偏好、器械、单位与统计、计时提醒 | 健身房和器械配置、默认重量单位、休息时长在 App 和 Cloudflare 网页使用同一账号偏好。组间提醒、系统提醒权限与展示设置也依赖本机。 |
| 外观与辅助功能、功能模块 | 跟随系统或覆盖浅/深色，多种强调色、字体与减少动画。主题和若干入口开关保存在本机。 |
| 计划与日程、训练周期、训练提醒 | 管理休息日、周期草稿、预览与批量改期。完成训练由各客户端使用同一校验和数据口径。 |
| 手表与健康、集成、数据导入与导出 | 健康读取取决于系统授权。可导出相关业务记录或恢复 Spotter 备份。跨环境迁移先分别核对源服务、目标账号及实际支持的数据类别。 |
| 关于与更新 | 版本、帮助和「重新查看使用引导」。 |

设置入口汇总在 [NativeWebSecondary](../ios/SpotterHealth/NativeWebSecondary.swift) 和 [网页设置](../cloudflare/features/settings/)。下面列出 Cloudflare 常见数据接口和校验点。

| 数据 | 接口与约束 |
| --- | --- |
| 账号、训练状态及训练偏好 | `/api/auth/*`、`/api/state`、`/api/workout-preferences`。服务端账号 ID 是实际归属，昵称和邮箱作显示或联系用途。切号后，待发请求带预期账号校验。头像批量读取以当前会话对每个请求账号校验关系，最多 32 个，返回 `private, no-store`。 |
| 日程、草稿、打卡、周期 | `/api/workout`、`/api/programs`。校验 UUID、日期、时间、组次及版本，保持完成记录和下次训练的独立状态。 |
| 饮食、常用食物、身体档案、模板和备份 | `/api/library`、`/api/data`。按账号和记录种类存储。复用 UUID 的写入可区分已处理和新增，避免从不同入口重复记。 |
| 心率和私密手表摘要 | `/api/health`、`/api/health/workout-summary`。摘要用独立表，保留来源和训练时窗。删除日志时数据库级联删除手表摘要；摘要形状遵循同一段能量及心率统计。 |
| 社交、教练及通知 | `/api/friends`、`/api/friends/engagement`、`/api/coaching`、`/api/notifications`。按当前关系和可见字段构建响应，通知发送按服务端开通范围和防重复规则执行。 |
| 私人动作演示 | 登录后通过 `/api/exercises/demo` 读取。外部 Agent 用 `/api/agent/exercise-demos` 或对应 MCP 工具写入，按账号及规范化动作名称关联 GIF。 |
| AI 及外部 Agent | `/api/ai-coach`、`/api/food-photo`、`/api/coach-protein`、`/api/agent/*`。站内 AI 另计账号额度；Agent 请求各自认证、授权并校验身份。 |

数据库定义见 [Cloudflare Schema](../cloudflare/db/schema.ts) 和 [Drizzle migrations](../cloudflare/drizzle/)。数据模型改动要同时核对 Swift 解码、浏览器编辑、历史记录以及有重试的客户端。生效前保留兼容数据和可复现迁移。健康值、令牌、配对码、登录码、OAuth 回调凭据和真实用户数据库均留在 Git、测试夹具和日志之外。

## 变更与发布验证

1. 确认目标环境、账号和代码分支。设计有用户可见入口变化时，同时更新本文与 [产品帮助资料](../cloudflare/shared/product-help.json)。新增 API、权限或字段时更新对应业务文档、模型和运行手册。
2. 根目录运行 `npm test` 与 `npm run build`。Cloudflare 变更在 `cloudflare/` 分别执行 `npm test`、`npm run build`，有构建部署变化时跑 `npm run cf:dry-run`。
3. 原生改动运行 `npm run test:ios-app`、Xcode 模拟器构建，交互改动核对点击、恢复、无网情况、小屏和减少动态效果。Node 健康同步协议可运行 `npm run test:health-native`，模拟权限和数据使用合成账号。
4. 最终打包前获取需要的远端代码，执行 `npm run ios:source-check` 和 `npm run ios:package`，记录源码和 Cloudflare 后端版本。使用 [App 构建说明](iphone-app.md#构建) 和 [Cloudflare 部署说明](../cloudflare/README.md#cloudflare-部署) 核对适用配置。
5. 真机验收单独记录 iPhone、Apple Watch、系统授权、后台补传、APNs、登录绑定和开发/分发签名的实际状态。合成测试只填写合成结果，按目标环境验证供应商 OAuth 与已部署 API。

| 渠道 | 验证与发布记录 |
| --- | --- |
| 本地与模拟器 | 记录命令、结果和被测构建，设备、健康授权与锁屏推送另记。 |
| Cloudflare | 核对 Worker、对应 D1 迁移、现有 Secrets、发布版本与真实 HTTPS API。Beta Worker 与正式 Worker 分别验证。 |
| 私密 Sites | 使用 Sites 的独立流程，保留站点身份、访问权限和数据。按用户授权在目标站点发布，更新后核对目标站点版本。 |
| TestFlight 内测 | 核对构建是否已处理、是否加入正确内测组，以及实际能否安装。 |
| TestFlight 外测 | 核对外测组选择、Beta 审核和邀请状态。能上传与外测已批准分别记录。 |
| 正式 App Store | 核对 App 版本、所选构建、商店资料与审核状态。提交审核、通过审核及发布各自记录。App 版本取 Xcode 的 `MARKETING_VERSION`，构建号取 `CURRENT_PROJECT_VERSION`。 |

每次完成变更，把涉及的入口、实现和权限写回本文，并在同一提交或 PR 记录核对结果。维护动作详见 [AGENTS.md](../AGENTS.md)。

## 变更记录

| 版本 | 功能与实现 | 核对 |
| --- | --- | --- |
| 1.0 Build 40 | 使用引导用 SwiftUI 锚点聚焦真实按钮。扩充有氧选项，Watch 用镜像和 WatchConnectivity 补传完训摘要。Agent API 增加按权限读取和记餐。AI 教练在两端使用共用帮助资料回答导航问题。 | Xcode 模拟器以合成账号验证 14 步引导及用量为零时的操作问答。服务端测试覆盖训练匹配、权限、账号隔离与写入去重。实际心率及断连恢复待配对设备验证。 |
| 1.0 Build 41 | `NativeAvatarStore` 统一当前会话中的头像。本人保存或移除后立即更新，其他头像在切页、回到前台、恢复网络或前台每 60 秒刷新。新增外部 Agent 四步教学、真实入口引导、统一提示词及连接创建回执。待训练和个人模板都提供跟练视频分区。App 和网页提供模板改名、修改动作及确认删除。Cloudflare 提供模板变更预览与提交，以及个人动作 GIF 的写入与读取。 | iPhone 模拟器通过头像刷新、四步教学及模板管理验证。Cloudflare 测试覆盖 GIF 权限与账号隔离、去重及模板事务回滚。 |

2026-11-25 发布记录。1.0 Build 40 的 App 构建提交为 `d251c088`，Cloudflare 92 对应 `e5733516`。模拟器包及 iPhone、Watch、小组件的分发签名均通过核对。Cloudflare 已部署并核对 HTTPS 接口，私密 Sites 保留原发布。TestFlight 的训练搭子内测与公开外测组均显示 Build 40 为 Testing。App Store 已用 Build 40 重新提交 1.0，状态为 Waiting for Review。
