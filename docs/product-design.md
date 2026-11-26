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

主导航把页面、进行中训练提示条和底栏排入各自的垂直区域。页面与二级详情共用止于底栏上方的可滚动区域。打卡月历按可用高度排版，空间太小时可滚动查看整个月。饮食详情的快捷操作和 AI 教练的输入栏也各自预留空间。较矮屏幕和辅助功能大字体下，训练详情及分享的扩展操作可随内容滚动到完整入口。

| 入口 | 用户操作 | 实现位置 |
| --- | --- | --- |
| 今日 → 饮食记录 | 从饮食卡片看当天热量、蛋白质、碳水、脂肪和饮水。点卡片进入明细，点卡片右上角的叉收起，点圆形饮食图标展开。快捷项为「记录正餐」「加餐」「饮水」「常用餐」「拍照记录」。 | [首页训练和饮食容器](../ios/SpotterHealth/NativeWorkouts.swift) · [饮食](../ios/SpotterHealth/NativeNutrition.swift) |
| 今日 → 训练日程、今日训练 | 在一周日程中选日期。本人当天计划可点「动作演示」按顺序查看动作详情，也可继续训练草稿或在已完成项点「查看记录」。同日其他计划可从计划菜单打开演示。计划菜单允许移动或删除，打卡历史保留。 | [首页训练](../ios/SpotterHealth/NativeWorkouts.swift) · [计划改期](../ios/SpotterHealth/NativePlanSchedule.swift) |
| 训练 → 我的计划 | 「新建计划」填写日期、类型、动作和组次。「添加计划」含「AI 教练起草」「粘贴已有内容」「训练周期」。可以导入训练文字、计划 JSON 或受支持的跟练链接，先核对再保存。「待训练」列表在底部集中展示已排期的「跟练视频」。 | [训练视图](../ios/SpotterHealth/NativeWorkouts.swift) · [计划导入](../ios/SpotterHealth/NativePlanImport.swift) |
| 训练 → 个人模板 | 可新建、从计划或打卡另存，也可用模板「安排训练」。打开个人模板后可点每个动作名查看弹出的动作卡片。iPhone 用「改名」「编辑动作」或「编辑模板」更新，网页点「编辑」进入「编辑模板」。两端删除均需确认，已保存的跟练链接均列于底部「跟练视频」。 | [原生训练与模板](../ios/SpotterHealth/NativeWorkouts.swift) · [个人模板服务](../cloudflare/features/library/server.ts) |
| 训练 → 官方模板 | 官方模板默认可见，可到「设置 → 功能模块」关闭。按「增肌」「减脂」「减肥」「功能性训练」及初级、中级或高级筛选。打开模板查看每周运动日与休息日，点动作名弹出动作卡片。设「周期开始日」后点「使用这个模板」，经排期预览和确认才加入日历。 | [官方模板](../ios/SpotterHealth/NativeOfficialTemplates.swift) · [模板资源](../ios/SpotterHealth/Resources/official-training-templates.json) · [周期编排](../ios/SpotterHealth/NativePrograms.swift) |
| 训练 → 动作库 | 搜索和器械栏下直接显示动作卡片，器械栏的更多选项保留高级筛选及常用动作。卡片进入可见区域后循环播放已有示范，减少动效时显示封面。点按打开「要点」「历史」「统计」「变式」，可查看主要与辅助肌群、主器械和所需附件。变式卡片可打开自己的详情，同一训练中的不同变式各自累计历史。 | [动作库浏览和详情](../ios/SpotterHealth/NativeCatalogueView.swift) · [目录资源读取](../ios/SpotterHealth/NativeCatalogueData.swift) · [网页动作库](../cloudflare/features/exercises/) |
| 中央开始训练 | 继续进行中的训练，或选计划、临时训练及有氧等入口。有氧可选跑步、跑步机、户外/室内骑车、划船机、椭圆机、步行、爬楼、游泳、跳绳等。实际训练保存计时，支持的项目可填距离或速度。 | [训练入口及逐组记录](../ios/SpotterHealth/NativeWorkouts.swift) · [训练模型](../ios/SpotterHealth/NativeWorkoutModels.swift) · [服务端有氧字段](../cloudflare/features/training/cardio.ts) |
| 统计 → 训练统计 / 打卡历史 | 用紧凑的对象和周期选项，按周、月、季、年、最近或自定义日期回顾训练容量、次数/天数、时长和完成组数。历史以月历显示自己的训练及对方允许共享的记录。点日期或打卡看详情。 | [统计与月历](../ios/SpotterHealth/NativeWebSecondary.swift) · [网页统计](../cloudflare/features/stats/) · [网页历史](../cloudflare/features/history/) |
| 好友 → 联系人 / 朋友圈 / 权限设置 | 「添加好友」「找搭子」通过账号用户名搜索，普通好友也可用邀请链接。联系人详情按日查看共享训练和饮食，可为对方设置私人备注，并设定本人给对方的权限。朋友圈显示自己和好友近期可见的打卡及加油。 | [好友界面](../ios/SpotterHealth/NativeWebSecondary.swift) · [好友规则](../cloudflare/features/friends/) · [搭子模型](../cloudflare/features/pair/) |
| 底栏星形按钮 → Spotter 教练 | 可自由对话、点推荐操作、用计划问答生成草稿、拍照或从相册附图。向上展开可进入大面板。App 进程运行期间保持当前对话，完全退出后重新打开时从新对话开始。 | [原生教练](../ios/SpotterHealth/NativeCoach.swift) · [推荐卡片](../ios/SpotterHealth/NativeCoachRecommendations.swift) · [网页教练](../cloudflare/features/ai-coach/) |

### 训练、计划与详情

- 训练计时根据起止时间和已累计时长计算，切到后台或锁屏不会自动暂停。可逐组记重量、次数、时长、左右侧及适用的 RPE。组间休息可调整、跳过或倒计时。完成组和训练前次表现可用于下一组参考。
- iPhone 训练底栏的「退出」会暂停计时、保存草稿并返回，「最小化」会继续计时。重新打开暂停的训练仍保持暂停。右上角「结束训练」可保存有内容的训练，试练没有可打卡内容时可返回继续记录或删除这次草稿。
- 暂停后，训练页底部可确认「重新开始」或「删除本次训练」，底栏上方的暂停状态条也可删除。iOS 18 及以上可在首页向右滑暂停中或未打开的训练草稿，再点「删除」确认。草稿的「…」菜单在所有支持的版本提供删除。重开沿用训练项目并换新草稿 ID，删除只同步该次草稿的移除。当天排定的计划和之前的打卡会保留。[原生训练](../ios/SpotterHealth/NativeWorkouts.swift) · [全局状态条](../ios/SpotterHealth/NativeApp.swift)
- 「训练周期」支持多个周、阶段、模板快照、复制周、进阶/减量和可选的 %1RM、目标 RPE。保存周期草稿与预览排期是同一流程的不同动作。确认时服务端核对当前 revision 和预览令牌，保护已完成、进行中及手动改动的训练。
- 训练草稿和打卡分别按账号和服务地址暂存。打卡先写本机，再用同一记录 ID 上传 `/api/workout`；联网或重试时沿用原 ID。活动、日历、历史和数据导出以实际完成记录为准。普通删除计划保留既有完成记录。
- 个人模板修改按当前版本保存。改动动作后，仍跟随模板动作的训练使用最新版。删除模板前确认影响，服务端保留已排的训练并解除模板关联，完成打卡仍按原记录展示。[模板关联与解除](../cloudflare/features/plans/template-server.ts)
- 训练详情集中显示训练时间、动作和组次、完成摘要、「训练数据」、「训练心率」及底部肌群分布。自己的记录可编辑、另存模板及分享。分享卡可选样式、显示明细、合并当天训练，并通过系统分享或保存图片。附带心率由本人选择且默认关闭。
- 展开 iPhone 训练详情的「肌群分布」，同一张正背面人体图以深蓝色显示主要参与，浅蓝色显示辅助参与。完成的正式组计入分布。一个肌群同时有两种角色时以深蓝色显示，点按或用 VoiceOver 可查看各自组数。[图表实现](../ios/SpotterHealth/NativeWebSecondary.swift)
- 训练详情和统计根据记录者选用人体图。本人可在「设置 → 账号 → 身体档案」填写性别并保存。看已共享的搭子训练时，使用搭子对应的体型。档案未填写时可手动切换。本人分享卡默认沿用本人档案，可针对图片另选体型。App 复用 `/api/workout` 返回的体型标识，依当前搭子关系核对归属。本人标识随按账号和服务地址区分的本地快照保留以供离线使用。[训练数据与归属](../ios/SpotterHealth/NativeWorkouts.swift) · [体型标识接口](../cloudflare/app/api/workout/route.ts)

修改时核对 [原生模型](../ios/SpotterHealth/NativeWorkoutModels.swift)、[训练页与详情](../ios/SpotterHealth/NativeWorkouts.swift)、[分享卡](../ios/SpotterHealth/NativeWorkoutShare.swift)、[Cloudflare 训练模型和同步](../cloudflare/features/training/) 及 [周期服务](../cloudflare/features/programs/)。

### 饮食与身体

- 「记录正餐」进入早餐、午餐和晚餐选择。「最近记过」点按后沿用上次份量直接记入。手动记正餐或加餐时填食物名和三项宏量营养，重量选填。「热量（千卡）」留空时，随输入按 `4 × 蛋白质克数 + 4 × 碳水克数 + 9 × 脂肪克数` 显示估算，保存时使用该值。填写的热量（包括 0）优先，可用于包装标注值。编辑记录会先显示原热量，清空后可重新估算。饮水按毫升，数据以当前用户当地日期归档。
- 「常用餐」可从食物组成 1–3 项的组合。App 本机保存组合；使用组合生成的餐食记录写入云端。首页拍照记录直接打开相机，识别结果支持查看、补充、编辑与撤销。可读的标签和用户明确的份量优先，常用「一碗」「一杯」可按可解释的份量估算，并保留估算信息。
- 「我的常用餐」可右滑删除组合，已记的餐食会保留。常用餐和训练草稿共用 iOS 18 及以上的 [右滑操作](../ios/SpotterHealth/NativeControls.swift)，滑动只展开按钮。iOS 16 和 17 的常用餐使用系统左滑入口。独立餐食、饮水和体重记录用行内垃圾桶。
- 「设置 → 蛋白粉仓库」保存产品、一勺粉量、冲泡材料和杯量，可拍照读标签、核对后保存为训练默认。完训选择已喝蛋白粉时，随打卡写逐笔餐食记录。已有记录与重复请求仍按稳定 ID 防重。
- 「设置 → 账号 → 身体档案」或开始训练面板的「身体数据」查看体重、身体测量和身体档案。相关 Apple 健康样本可在本机核对，再同步选定值。身体目标、档案和饮食记录维持各自数据类型。

实现见 [饮食](../ios/SpotterHealth/NativeNutrition.swift)、[蛋白粉](../ios/SpotterHealth/NativeProtein.swift)、[身体档案](../ios/SpotterHealth/NativePersonalData.swift)、[个人库模型](../cloudflare/features/library/model.ts) 和 [饮食业务](../cloudflare/features/nutrition/)。

### 搭子、教练与通知

- 好友与搭子依关系各自授权。好友主页的「权限设置」管理朋友圈范围，个人详情管理定向分享。新关系的饮食默认值及搭子确认表单由当前后端返回的 `betaSocialDefaults` 决定。已有关系使用已保存的开关。原始心率、身体测量和活动数据保持私密。
- iPhone 首页「今日搭子打卡」上排只显示本人和搭子的头像、名称与状态，打卡后保持原高度。下方「搭子最近打卡」显示最近一条可见训练的标题并可点开。当日多次打卡时，从同一位置打开当天的训练列表。[首页打卡](../ios/SpotterHealth/NativeWorkouts.swift)
- iPhone 的「好友 → 联系人 → 找搭子」介绍一对一绑定、搭子的训练与可选饮食共享、普通好友的训练可见范围，并把睡眠和恢复分析标为后续规划。页末的「添加好友」切到普通好友申请。打开训练搭子资料后可点「约下次训练」，发出、接受、婉拒或取消邀约。邀约继续用 `/api/friends/engagement`，服务端校验当前账号和有效搭子关系，详情只显示这两人的邀约。[原生界面](../ios/SpotterHealth/NativeWebSecondary.swift) · [邀约服务](../cloudflare/features/friends/appointments.ts)
- 在「好友 → 联系人」打开已连接的好友或训练搭子，点「添加备注」或「编辑备注」。保存最多 40 个字符，资料页同时保留对方昵称。备注仅设置者可见，联系人、朋友圈、首页及统计中的对应姓名会优先显示它。移除后恢复显示昵称。系统推送和公开分享继续使用账号昵称。[原生好友详情](../ios/SpotterHealth/NativeWebSecondary.swift) · [网页联系人](../cloudflare/features/friends/friends-view.tsx)
- iPhone 普通好友详情右上角「⋯」提供「删除好友」。确认框显示对方名称与分享影响，点「确认删除」才提交现有好友移除请求，成功后返回上一页。点「取消」关闭确认框。[原生好友详情](../ios/SpotterHealth/NativeWebSecondary.swift)
- 「设置 → 功能模块」开启「教练与学员入口」后，入口显示在「好友 → 联系人 → 找搭子」旁，默认隐藏。教练可下发训练计划或多周周期，学员预览确认后导入自己的计划。反馈、完成进度和可见的实际组记录由教练系统自己的权限管理。[教练系统](../cloudflare/docs/coaching.md)
- 「设置 → 通知」管理搭子提醒、好友打卡和系统通知权限。好友页铃铛打开站内通知中心。受支持的账号在联系人详情可提醒搭子训练。线上推送同时受服务端开通范围、接收偏好、提醒间隔、APNs 及设备权限约束。训练提醒和组间休息提醒也可由系统本地通知运行。

实现见 [社交界面](../ios/SpotterHealth/NativeWebSecondary.swift)、[学员界面](../ios/SpotterHealth/NativeCoaching.swift)、[通知客户端](../ios/SpotterHealth/NativeSocialNotifications.swift) 和 [服务端通知](../cloudflare/features/notifications/)。

### AI 教练、导入与外部 Agent

- 站内 AI 使用当前账号的请求授权。用户主动提出记餐时，文本上下文用于核对食物、餐次和数量；明确请求后可以直接保存并显示回执。询问营养、浏览建议或试填内容无需写入记录。训练计划经预览确认后入日程。系统读取的 Apple 健康原始数据不随站内教练请求发送。
- 生成训练计划可用表单问答或对话，推荐可引用动作目录和官方模板。卡片按实际可用动作显示查看详情、加入训练或查看计划等操作。AI 用量在「设置 → AI 教练」，服务端按账号限制每 UTC 日 200、每 UTC 月 2,000 条消息，并另有月度费用预算。
- 「设置 → 外部 Agent」可创建和撤销个人连接，网页从「添加计划 → 用自己的 AI」进入。连接名称、有效期及可读写范围在创建时选择。「复制提示词」提供一份通用文本，内含 MCP 和 OpenAPI 地址，以及编排训练、记饮食、分析记录、管理模板和演示动图的指令。连接创建后自动定位到提示词卡片，在同一卡片用「复制令牌」取得只在本次创建后提供的连接凭据。提示词粘贴到自己的 AI 对话框，令牌只填入外部工具的凭据设置。[原生连接](../ios/SpotterHealth/NativeAgentAccess.swift) · [网页连接](../cloudflare/features/agent-access/access-panel.tsx)
- App 的「设置 → 外部 Agent → 使用教学」和教练「用自己的 AI」的连接页共用四步教学。教程带用户选权限、配置自己的客户端、复制提示词执行示例，并在「我的连接」核对最近使用时间或撤销。新手引导高亮真实入口，使用教学只展示说明和示例。[SwiftUI 使用教学](../ios/SpotterHealth/NativeAgentAccess.swift)
- 外部 Agent 按当前账号的 `profileRef` 与连接权限校验归属。权限区分编排资料、训练草稿、排期、分类读取和写入。健康原始读数、身体数据与搭子或好友的记录均在外部 Agent 读取范围之外。明确授权后才记餐，重试同一餐食复用原 UUID。[Agent 权限](../cloudflare/features/agent-access/model.ts)
- 外部 Agent 在生成或导入含动作的计划、周期和个人模板前，用 `read:context` 查当前账号的个人动作和内置目录。标准目录 ID 一致、明确登记为同一动作的别名或规范化后完全相同的名称可用于复用。相近变式各自保留。两端的复制提示词说明这个规则，iPhone 的使用教学同时提示开启「读取编排资料」。[编排资料接口](../cloudflare/features/agent-access/context.ts) · [网页提示词](../cloudflare/features/agent/guide.ts) · [原生提示词与教学](../ios/SpotterHealth/NativeAgentAccess.swift)
- 外部 Agent 管理个人模板时，用 `templates:read` 读取模板 ID 和版本，用 `templates:manage` 预览改名、替换整份动作列表或删除。预览展示对关联计划的影响，用户确认后提交同一个预览令牌。版本已变或预览到期时需重新核对。[模板修改服务](../cloudflare/features/agent-access/template-change.ts)
- 外部 Agent 收到附带演示的请求时，通过 `read:context` 查询同一动作，再调用 `get_spotter_exercise_demo_skill`。标准动作沿用目录 ID，已有的 Spotter 3D 示范可直接复用。新的个人动作可由 Agent 使用 [Spotter 动作渲染技能](../skills/spotter-exercise-demo/) 在本地生成并核对 GIF，再按现有确认流程保存。技能独立运行，只接收动作配方。选用一个相近动作时仍需保留其不同器械、握法和单侧等信息。[Agent 查询及写入规则](../cloudflare/docs/agent-api.md#用-spotter-技能生成动作示范)
- Spotter 3D 标准示范由 [已核准的目录 ID](../cloudflare/features/exercises/spotter-demo-assets.json) 统一选择，iPhone 离线视频和 Cloudflare 网页使用同一对应关系，其他动作继续显示已有演示。个人计划及其编辑页、训练过程和训练动作详情都可打开演示。旧计划只有名称时先匹配同一标准动作；同名歧义和个人变式保持独立。确认为同一个动作的别名写在 [目录精确别名](../cloudflare/features/exercises/catalogue-exact-aliases.json)，网页与 iPhone 共用。私有 GIF 只为当前账号的动作读取。扩充时用 [离线盘点工具](../tools/plan-exercise-demo-rollout.mjs) 依次整理个人计划、官方模板和整库。个人盘点报告留在本地，跨范围对同一目录 ID 去重，个人动作和同名歧义分别核对。
- 官方扩充以[公开原创条目](../cloudflare/features/exercises/spotter-catalogue-additions.json)和精确别名维护，统一生成目录索引、动作要点、器械和肌群数据。完全相同的动作复用原有 ID。主器材与所需附件都可用于动作库筛选。私人计划的排期、处方与账号记录留在所属账号中。
- 动作库底部不展示授权和目录下载链接。随产品分发的第三方许可声明从账号设置查阅，已有素材的归属及许可证继续保留。
- 标准示范随产品更新向所有账号提供，沿用「训练 → 动作库」入口。用户从已绑定的外部 Agent 为自定义动作生成示范时，结果按所属账号保存。覆盖统计按已登记且同时有 MP4 和 JPEG 的标准目录 ID 计算。
- iPhone 动作详情的「历史」按训练列已完成组次，「统计」按日汇总训练容量和组数，并按有效组显示最大重量及设置中选择的 1RM 估算方法。两页只读本人记录，可加载更早的训练。动作匹配优先用准确目录 ID，个人动作和相近变式保持独立。「今日训练」的「动作演示」在开练前列出计划动作。进行中的训练也有「动作演示」，打开「要点」和可用示范。「动作进步」仍打开「统计」。对旧计划使用标准目录的旧 ID 映射或唯一精确名称。动作身份不一致时保留个人动作，未保存私人 GIF 时显示「此动作暂时没有演示动图」，读取失败可重试。变式使用目录已有分组、明确关联的个人变式，以及相同训练模式与主要肌群的参考动作。
- 维护者可用 [批量渲染脚本](../tools/render-exercise-demo-batch.mjs) 按本地清单生成候选素材。清单的 `kind` 为 `catalogue` 或 `private`，`items` 提供目录编号或不含账号数据的本地编号、相对运动配方路径及可选的封面相位。脚本离线执行并输出与实际渲染器版本对应的校验收据和五张关键帧总览。从源码目录执行 `node tools/render-exercise-demo-batch.mjs --manifest work/batch.json --output work/candidates --renderer <解压后的 renderer.html> --chrome <Chrome 路径>`。标准 MP4 使用 macOS 的 AVFoundation 编码。再次运行同一清单会核对校验收据。标准候选包含 MP4 和 JPEG，私人候选包含 GIF 并留在 Git 之外。核对动作、器械和支撑点后再登记标准素材。
- [有氧及负重行走配方生成器](../tools/spotter-demo/write-cardio-recipes.mjs) 可按精确目录编号把公开运动源码写成上述批量清单。渲染技能支持单车、跑步机、椭圆机、台阶机、划船机、跳绳、负重行走及实心球等器械和动作要素。
- 连接获得 `exercise-demos:write` 后，外部 Agent 可针对用户确认的动作上传、替换或移除私人演示 GIF。GIF 上限 768 KiB，宽高各不超过 480 像素，限 2–90 帧，并限制解码总像素。动作详情只向登录的所有者展示该附件。App 回到前台或刷新训练时同步动作资料。现有 JSON 备份包含动作资料，GIF 文件随账号保存在 Cloudflare。[演示校验和存储](../cloudflare/features/exercises/personal-demo.ts) · [原生动作详情](../ios/SpotterHealth/NativeCatalogueView.swift) · [网页动作详情](../cloudflare/features/exercises/exercise-view.tsx)
- iPhone 标准动作演示由资源生成工具按网页版的动作 ID 选用现有绘制动画、Flow／姿势图或 MP4。演示随 App 安装，可离线使用。打开详情后，演示加载完成即自动播放，暂停后再播放会从当前帧继续。离开或切后台时暂停。开启减少动态效果时，可手动点「播放」。个人 GIF 继续使用账号授权读取。[资源生成](../tools/build-ios-catalogue.mjs) · [原生播放](../ios/SpotterHealth/NativeCatalogueView.swift)
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
| 联系人私人备注 | `/api/social/remarks` 按当前账号和有效好友或搭子关系读写。GET 只返回自己的备注，PATCH 用空字符串清除。客户端发送预期账号，切号时由接口拒绝。个人备注和对方昵称分别保存。 |
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
| 1.0 Build 41 动作复用 | 外部 Agent 写入计划、周期、模板、个人动作和 GIF 前查本账号动作库。只按标准目录 ID、已登记别名或规范化名称复用同一动作。保留握法等独立变式和原组次处方。iPhone 与网页提示词及教学使用同样的规则。 | Cloudflare 95 源码为 `91b476a`。服务端 362 项测试通过，覆盖原始记录保护、账号隔离、重试与动作变式。 |
| 1.0 Build 42 候选 | 在「好友 → 联系人」打开对方资料，可添加、修改或移除好友与搭子的私人备注。App 和 Cloudflare 网页按账号和关系授权，备注与昵称分别存储。 | Cloudflare 静态类型检查通过。合成账号验证网页保存、移除、首页同步及切换账号隔离。iPhone 与网页的 AI 教练操作路径测试通过。 |
| 1.0 Build 43 | iPhone 主导航将底栏和训练提示条作为页面区域的同级视图。月历在较矮的显示区域提供纵向滚动，饮食、教练、训练详情和分享的底部操作按可用空间安排。 | 旧版在 iPhone 17e 模拟器复现保存按钮与底栏重叠 27 点。新版在 iPhone 17e 标准字号和 iPhone SE（第三代）辅助功能大字下均完成保存。辅助功能大字下，六周月历的「回到本月」可点按。另验证 12 条饮食长列表和键盘打开时的 AI 教练输入。Xcode 模拟器、分发签名、原生冒烟测试及根目录 24 项测试通过。 |
| 1.0 Build 44 | `NativeNutritionEditor` 根据三项宏量营养预览并保存估算热量，可填写包装热量覆盖。沿用 `/api/library` 的记录结构与当前账号权限。 | Swift 语法检查通过，表单取值通过 10 项逻辑检查。 |
| 1.0 Build 44 | 训练详情的 `SecondaryMusclePanel` 将主要参与与辅助参与合并到一张图，沿用已完成正式组和动作库标注。仅调整本机呈现。 | Swift 语法检查和 11 项着色、计数组数逻辑检查通过。 |
| 1.0 Build 44 | 训练详情和统计使用当前记录者的体型，分享卡默认用本人档案。读取现有训练接口的体型标识。本人保存身体档案后立即生效，搭子体型随共享训练刷新。 | Swift 语法、15 项原生体型归属及兼容检查、17 项好友接口测试通过。 |
| 1.0 Build 44 | 找搭子页增加关系及分享说明和普通好友入口。训练邀约入口移入搭子详情。 | Swift 语法检查、6 项入口核对、4 项教练帮助检查和 17 项好友接口测试通过。 |
| 1.0 Build 44 | 首页搭子打卡小卡片统一使用头像、名称和状态。训练详情集中在下方的最近打卡入口。 | Swift 语法及 8 项卡片布局、详情入口和帮助资料的源码检查通过。 |
| 1.0 Build 45 | 普通好友的删除入口移到详情页右上角菜单。由确认框提交现有关系移除请求。 | Xcode 模拟器构建、确认入口和教练帮助的源码检查、17 项好友接口测试通过。 |
| 1.0 Build 45 | 补齐 SwiftUI 标准动作详情的离线演示和播放／暂停，按目录 ID 对应已有动作素材。 | Xcode 模拟器构建通过，包内 5,630 个标准动作的资源映射与源码一致。原生冒烟测试核对绘制、动图、本地视频和个人动作隔离。 |
| Build 45 后的 iPhone 源码 | 「训练 → 动作库」的绘制和 GIF 从详情挂载后按素材帧间隔播放，本地视频在播放器进入窗口时应用播放状态。暂停保留画面，按钮按前台播放状态显示。沿用已打包素材和个人动图的账号权限。 | Xcode 模拟器构建、原生冒烟测试、独立版网页构建和 24 项根目录测试通过。以合成账号比较演示区域截图，验证绘制动画、GIF 和本地视频首次打开即播放，暂停静止且恢复后继续播放。旧版卡帧在这三个模拟器样本上未复现，待真机确认。 |
| Build 45 后的 iPhone 源码 | 原生训练添加「退出」「重新开始」和暂停时的「删除本次训练」。草稿移除走账号限定的现有同步队列。首页训练草稿和常用餐提供右滑删除。 | Xcode 模拟器构建通过。以合成账号验证退出后计时冻结、重新打开、重开清空组次、删除草稿后从原计划开练、空训练结束和有效打卡。右滑草稿后再点按确认可删除草稿，删除常用餐后已记饮食仍保留。原生冒烟测试、独立版 24 项和 Cloudflare 17 项训练测试通过。 |
| Spotter 3D 演示开发分支 | 增加外部 Agent 渲染技能入口、配置提示、离线渲染和按目录 ID 复用。首批接入 20 段标准演示并补齐个人计划和训练的演示入口。 | Xcode 模拟器构建和原生冒烟通过，包内包含 20 段原创视频。Cloudflare 构建与 374 项测试、独立版构建与 25 项测试通过。已把生成的 5 个原创自定义 GIF 通过合成账号写入、读取和隔离检查。 |
| Spotter 3D 演示第二批 | 标准原创示范增至 32 支，沿用原有目录 ID、封面和播放入口。离线技能可渲染固定式弹力带脚踝束带、平凳、中立握引体架、高位横杆和俯卧腿弯举器械。原有处方及账号权限沿用。 | 网页与独立版构建、374 项 Cloudflare 测试、25 项独立版测试及 Xcode 模拟器构建和原生冒烟通过。验证 32 支视频实际播放、封面和 iOS 离线副本。11 支个人动图通过合成账号的保存、读取和跨账号隔离验证。 |
| 1.0 的 3D 演示开发分支 | 增至 133 段标准原创示范。官方模板涉及的 91 个不同动作都有原创 3D 示范。增加移动负荷、分段弹力带、显式掌面方向和离线批量渲染。已有计划仍使用原有名称和处方，对精确别名复用同一目录动作。 | 对标准视频核对播放、跳转、封面和 iPhone 离线文件。批量渲染验证标准 MP4、私人 GIF 和校验后复用。58 段私人 GIF 以合成账号核对原名上传、读取和跨账号隔离。 |
| 1.0 的 3D 演示开发分支 | 新增 38 个公共目录示范，共 171 个，覆盖杠铃、哑铃、徒手和有氧等动作。新增 35 个按目录 ID 的可重建运动配方及相应器械。公共示范和个人附件沿用既有查看入口与账号边界。 | 38 支新视频通过 Chrome 解码、播放和跳转检查。Xcode 模拟器构建包含 171 支与网页清单一致的视频和封面。原生冒烟、两套网页构建、25 项独立版测试、374 项 Cloudflare 测试和 3 项配方校验均通过。 |
| 1.0 的动作库界面开发版 | SwiftUI 动作库移除顶部推荐条，卡片在可见区域自动播放。动作详情增加要点、个人历史、趋势统计及可跳转的变式。统计总览压缩对象和周期控件，保留 44 pt 的最小触控高度及大字号布局。 | iPhone SE 模拟器用合成账号验证三类卡片示范的帧变化、四个标签、按动作计算容量和 1RM、变式往返、统计对象和自定义日期切换。Xcode 模拟器构建、原生冒烟、独立版及 Cloudflare 构建与测试通过。 |
| 1.0.1 Build 46 | TestFlight 构建包含当前 SwiftUI 动作详情、动作库播放、紧凑统计控件及已完成的 171 个原创 3D 示范。Apple 关闭已正式发布的 1.0 构建通道后，测试包版本升至 1.0.1。 | 内外测以 App Store Connect 中的构建处理、组分配和审核记录为准。后端沿用 Cloudflare 96。新增外部 Agent 渲染接口和下载包需随 Worker 更新上线。 |
| 1.0.1 Build 48 内测候选 | 官方库新增 55 个动作，另有 3 个同一动作复用原 ID。原创示范总数增至 228。iPhone 个人、官方模板支持点动作名弹出详情，网页个人模板和编辑页支持同样入口。 | iPhone 索引核对覆盖待迁移计划的全部动作位置。新增视频逐个解码确认画面变化。独立版和 Cloudflare 构建、测试及原生冒烟通过。 |
| Build 46 后的 iPhone 开发版 | 首页计划和进行中的训练可直接打开动作演示。按目录 ID 和唯一精确名称找回已有标准素材，个人动图按账号读取并显示可用状态。 | iPhone SE 模拟器用合成计划验证开练前示范自动播放、暂停和继续、缺少个人动图提示，以及训练中分别打开要点和统计。Xcode 模拟器构建、原生冒烟、独立版及 Cloudflare 构建与测试通过。 |

2026-11-25 发布记录。1.0 Build 40 的 App 构建提交为 `d251c088`，Cloudflare 92 对应 `e5733516`。模拟器包及 iPhone、Watch、小组件的分发签名均通过核对。Cloudflare 已部署并核对 HTTPS 接口，私密 Sites 保留原发布。TestFlight 的训练搭子内测与公开外测组均显示 Build 40 为 Testing。App Store 已用 Build 40 重新提交 1.0，状态为 Waiting for Review。

2026-11-25 发布记录。1.0 Build 42 的 App 源码为 `2f0334a`，后台 Cloudflare 96 对应 `8033dc8`。Xcode 校验了 iPhone、Watch 与小组件的分发签名，模拟器和网页合成账号验证了私密备注的新增、切换账号隔离和移除。TestFlight 训练搭子内测与公开外测均显示 Build 42 为 Testing。

2026-11-25 发布记录。1.0 Build 44 的 App 构建提交为 `753bd38`，Cloudflare 96 对应 `8033dc8`。源码基线、模拟器打包与启动、原生冒烟测试、根目录生产构建和 24 项根目录测试通过。iPhone、Apple Watch 和小组件的 1.0 (44) 分发签名均通过校验。TestFlight 训练搭子内测与公开外测组均显示 Build 44 为 Testing。本次发布范围为 TestFlight。

2026-11-25 发布记录。1.0 Build 45 的 App 构建提交为 `ea4f94e`，Cloudflare 96 对应 `8033dc8`。源码基线、模拟器打包和 iPhone 17e 启动、原生冒烟测试、根目录构建与 24 项测试、17 项好友接口测试通过。iPhone、Watch 与小组件分发签名通过校验，归档包含全部 5,630 个动作演示及素材授权说明。合成界面自动化看到了「删除好友」菜单项，系统菜单点按未能完成确认弹窗验证。TestFlight 训练搭子内测和公开外测均显示 Build 45 为 Testing。本次发布范围为 TestFlight。

2026-11-26 发布记录。1.0.1 Build 46 的 App 源码为 `f701001`。远端源码基线、模拟器打包、iPhone、Watch 与小组件分发签名通过核对，归档包含 171 个原创 3D 示范。App Store Connect 中「训练搭子内测」显示 Testing，「训练搭子公开外测」已提交 Beta 审核并显示 Waiting for Review。正式 App Store 执行「Remove App From Sale」，App Store Connect 显示全部 175 个国家和地区均不可用。当前 App 连接 Cloudflare 96，新增渲染技能 API 和下载包已合入源码，待单独部署。
| 1.0.1 Build 47 | 归档包含「今日训练」和进行中训练的独立动作演示入口、旧计划识别与个人动图状态。公开目录素材随 App 安装。个人动图从所属账号读取。 | 「训练搭子内测」显示 Testing。iPhone SE 模拟器逐项验证 16 个示范的画面变化，覆盖内置视频和个人 GIF。线上按账号对新增动图执行字节哈希回读校验。 |

2026-11-26 发布记录。1.0.1 Build 47 的 App 源码为 `078d468`。源码基线检查、模拟器打包及 iPhone、Watch、小组件的分发签名均通过。通过 Xcode 选择 TestFlight Internal Only 上传，App Store Connect 处理完成后将构建加入「训练搭子内测」，状态为 Testing。分发范围仅限内测。App 后端仍为 Cloudflare 96。本次生产操作仅写入经过核对的私有动图记录，Cloudflare Worker 和私密 Sites 无新部署。
