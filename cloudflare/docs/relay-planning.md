# 周期编排与用户 Agent 接入

本轮只修改 Sites 网页源码，不修改 iPhone App，不部署正式站、不改变访问权限或生产数据。另一台电脑尚未完成的改动未取得，不能视为已经包含；收到用户通知后再核对 Git、Sites 源码和实际发布版本。

## 与项目现有流程整合

Relay 的公开介绍包含自有动作库、编排原则、可编辑多周周期及预览分发。本轮依据这些公开能力实现 Spotter 自己的模块，沿用原有界面、动作库、模板、日历和逐组记录；没有复制其代码、素材、私有提示词或算法。

| 核心能力 | Spotter 入口及行为 |
| --- | --- |
| 自有动作与编排规则 | 继续使用原动作库、视频和个人模板；训练周期内保存私人原则、器械、进阶偏好与避开动作，授权 Agent 可读取。 |
| 多周与阶段 | 训练周期最多 52 周、364 节；明确开始日、相对训练日与阶段，使用模板当前内容的快照。 |
| 批量编辑 | 复制周，固定或比例调重，明确每周重量/次数进阶和减量周；未知重量 0 保持未知，计时动作不加次数。 |
| 训练处方 | 原有组别、器械站、次数范围、休息、节奏继续使用；新增用户手填 1RM 百分比、参考单位和目标 RPE。百分比换算保留两位小数，不自动推算历史 1RM。 |
| 预览后入日历 | 明确显示新增、更新、相同、自定义、已开始/已完成、休息日及已删除状态；不覆盖受保护记录。移除周期容器不删除日历或训练历史。 |
| 用户自己的 AI | 「添加计划 → 用自己的 AI」统一复制提示词、查看草稿与管理过期/可撤销的连接。新建连接默认全选授权，可取消不需要的权限；直接写日历需要 `plans:write` 和每批确认；模型在用户自己的 Agent 中运行。 |
| 可编辑草稿 | 普通 Agent 草稿先在网页校验和编辑，再确认；长周期走周期接口，不将超过 20 节的内容截断。 |
| 迁移和备份 | 周期 JSON 可单独导出，导入会生成新的私人草稿，不覆盖当前编排规则或历史。令牌不进入导出。 |

公开参考：[Relay 产品](https://www.relayathletic.com/)、[周期设计](https://www.relayathletic.com/program-design)、[训练块和组](https://www.relayathletic.com/docs/coaching-guide/workout-blocks-and-sets)、[分配与同步](https://www.relayathletic.com/docs/coaching-guide/program-assignment-and-sync)、[MCP 接入](https://www.relayathletic.com/blog/relay-mcp-setup)。本轮未加入教练收费、客户管理、品牌定制或语音识别。

## 源码与持久化

- `features/programs/`：模型、周期构建、私人规则、D1 乐观锁/原子提交与周期界面；`app/api/programs/` 组装浏览器路由。
- `features/agent-access/`、`app/api/agent/`：连接、权限、分页上下文、草稿、确认、OpenAPI 和外部 MCP；既有 `app/mcp/route.ts` 加入相同编排工具，保持平台身份认证。
- `features/plans/`、`features/training/`、`features/history/`：共享处方口径，目标 RPE 不预填为实际 RPE，手动单位换算与百分比处方一致。
- `db/schema.ts` 和 `drizzle/0005_agent_programs.sql`：新增账号限定数据表及相应 Drizzle 快照，保留原有表和数据。迁移只新建表，不重写旧训练。

## 验证记录

使用 Node.js 24、合成账号和本地空 D1；测试数据、临时凭据和数据库均不进入 Git。

- 自动测试覆盖现有训练/动作库/好友规则以及新周期、手填处方、权限、过期、撤销、限流、账号隔离、草稿 revision、幂等和预览后的并发变更。实际统计及构建 commit 记录在交付报告中。
- 本地 HTTP：无浏览器身份的个人 Bearer 可取上下文和提交草稿；同 requestId 重试复用草稿；未授予 `plans:write` 时写日历 403、错误 profileRef 403、跨站写请求 403、撤销后 401。
- 本地浏览器：创建 4 周周期，手填 40 kg 参考的 75% 得到 30 kg，第四周减 5 kg 得到 25 kg；首次确认新增 4 节，重复预览为 0 新增/4 相同。Agent 草稿编辑、未保存关闭提示、校验及确认新增 1 节均通过。检查手机和桌面布局。
- 实际生产路由的合成 MCP 测试覆盖旧工具保留，以及新计划/周期的起草→预览→确认；个人令牌的工具发现与调用都检查 scope。
- 尚未部署正式 Sites，未实际授权 GPT/Claude/Grok/Muse 等各品牌客户端。私密 Sites 的平台门禁可能先于 REST Bearer 处理，须另行验证实际客户端；应用令牌不会绕过平台登录。详情见 [Agent API](agent-api.md)。

本轮的新周期/API 功能没有进入 App。App 使用所选 HTTPS 站点的实际已发布页面，后续网页统一上线并完成客户端验证后，再按用户节奏更新 App。
