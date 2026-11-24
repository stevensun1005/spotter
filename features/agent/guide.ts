import type { DataScope } from "@/features/data/model";
import type { LibraryItem } from "@/features/library/model";
import type { Plan } from "@/features/plans/model";
import { agentPlanningGuide } from "@/features/import/ai-instructions";
import { measurements, recordedMetrics } from "@/features/body/measurements";

export const agentGuideScopes = [
  ["all", "全部说明"],
  ["training", "训练"],
  ["nutrition", "饮食"],
  ["body", "身体"],
  ["templates", "模板"],
] as const satisfies readonly [DataScope, string][];

type AgentScope = Exclude<DataScope, "all">;
const guideDetails: Record<AgentScope, readonly string[]> = {
  training: [],
  nutrition: [
    "## 饮食",
    "- 包装食品或常用食物用 add_spotter_foods 保存到个人食物库，每批 1–20 项。foods 数组每项提供 name 和 per100g，其中 calories 为千卡，protein、carbs、fat 为克。",
    "- 使用包装可读的营养值。标签按份标注时，只有给了每份重量才能换成每 100 克；仅标每 100 毫升时，先核对对应重量。看不清的营养值先询问。",
    "- 保存常用食物与记录一餐分别处理。实际早餐、午餐、晚餐、加餐用 import_spotter_records 的 nutrition 类别，在 backup.library 中使用 kind 为 nutrition、entry.type 为 meal 的记录，包含明确日期、餐次、名称、营养和已知克数。",
    "- 浏览器里从「饮食」进入任一餐次，选择「新增自定义食物」可保存常用食物，也可以搜索已保存的食物，填克数后记到当餐。",
  ],
  body: [
    "## 身体",
    "- 有用户授权的体重、体脂或围度记录，用 import_spotter_records 的 body 类别，写入 backup.library。测量记录的 kind 为 nutrition，给予 UUID id 和 YYYY-MM-DD 日期。体重的 entry.type 为 weight，使用 kg。其他测量的 entry.type 为 measurement，包含 metric 和 value。",
    "- 可用的 metric 包括 " + recordedMetrics.map((metric) => metric + "（" + [measurements[metric].name, measurements[metric].unit].filter(Boolean).join(" ") + "）").join("、") + "。保存前核对原始单位。",
    "- 身高、年龄和用于营养估算的性别属于一个 body-profile 档案，values 支持 heightCm、age、sex（male 或 female）和可选的 ageAsOf（年龄记录日期）。已有档案可在身体数据页更新。",
  ],
  templates: [
    "## 模板",
    "- 用 import_spotter_records 的 templates 类别写入 backup.library。每条 kind 为 template，包含 UUID id 和完整的 plan；动作、组次、单位及休息时间沿用确认过的计划。",
    "- 浏览器里从「训练 → 个人模板」创建和编辑模板。",
  ],
};

function jsonBlock(value: unknown) {
  const fence = String.fromCharCode(96).repeat(3);
  return fence + "json\n" + JSON.stringify(value, null, 2) + "\n" + fence;
}

export function createAgentGuide({ scope, profileRef, origin }: { scope: DataScope; profileRef: string; origin: string }) {
  const trainingGuide = agentPlanningGuide(origin, profileRef) + "\n## 已完成的训练记录\n已经完成的训练须确认用户确实完成，再按独立的训练记录／备份流程处理；支持旧工具的客户端可使用 import_spotter_records 的 training 类别和有效 spotter-backup 中的 log，不把它作为新计划。\n";
  if (scope === "training") return trainingGuide;
  const scopes = scope === "all" ? agentGuideScopes.slice(1).map(([item]) => item as AgentScope) : [scope];
  const title = agentGuideScopes.find(([item]) => item === scope)?.[1];
  const exampleDate = "2026-01-01";
  const exampleId = "12345678-1234-4234-8234-123456789000";
  const examplePlan: Plan = { title: "上肢力量", date: exampleDate, category: "力量训练", minutes: 45, shared: false, video: "",
    exercises: [{ name: "哑铃卧推", sets: 3, reps: 10, weight: 0, unit: "kg", seconds: 0, tempo: "2-0-1-0" }] };
  const importExample = (kind: AgentScope, entry: LibraryItem) => jsonBlock({
    profileRef, scope: kind, confirmed: true, backup: { format: "spotter-backup", version: 1, training: [], library: [entry], heart: [] },
  });
  const examples: Record<AgentScope, readonly string[]> = {
    training: [],
    nutrition: [
      "### add_spotter_foods 参数示例",
      jsonBlock({ profileRef, confirmed: true, foods: [{ name: "品牌和食品名", per100g: { calories: 380, protein: 13, carbs: 65, fat: 8 } }] }),
      "### 用 import_spotter_records 记一餐",
      importExample("nutrition", { kind: "nutrition", id: exampleId, date: exampleDate,
        entry: { type: "meal", meal: "早餐", name: "干燕麦片", grams: 40, calories: 151.6, protein: 5.26, carbs: 27.08, fat: 2.608 } }),
    ],
    body: [
      "### 用 import_spotter_records 记体重",
      importExample("body", { kind: "nutrition", id: exampleId, date: exampleDate, entry: { type: "weight", kg: 65 } }),
    ],
    templates: [
      "### 用 import_spotter_records 保存模板",
      importExample("templates", { kind: "template", id: exampleId, plan: examplePlan }),
    ],
  };
  const connection = [
    "# 训练搭子 · 数据 AI 写入说明",
    "范围 " + title,
    "站点 " + origin + "/",
    "个人账号标识 " + profileRef,
    "## 开始前",
    "1. 在已连接「训练搭子」私密插件的 ChatGPT 或 Codex 中使用工具。登录需由用户在受支持的客户端完成。账号标识只用来核对账号，本站实际访问由已授权的登录会话决定。",
    "2. 先调用 get_spotter_agent_profile，确认返回的 profileRef 和本页一致。随后读取或写入时都传本页的 profileRef。若登录账号不匹配，请用户切换到正确账号。",
    "3. 按本说明列出的类别和用户授权的日期操作。写入前给出简短预览；用户明确说「导入」「加进去」即授权对应内容。只发材料时问是否导入，确认后才传 confirmed: true。",
    "4. 成功后报告实际新增、跳过数量和有关日期。如果工具返回失败，请说明状态。示例里的名称、日期和数值仅用于展示结构。",
    "",
    "## 读取和导入",
    "- read_spotter_records 每次只读一个 scope。可传 from、to（YYYY-MM-DD）和 offset；按返回的 nextOffset 翻页。可选类别为 " + scopes.join("、") + "。",
    "- import_spotter_records 传 profileRef、单一 scope、confirmed: true 和 backup。可使用站点导出的有效 spotter-backup v1 数据，也可按下方示例从已确认的材料构造。结构是 format、version、training、library、heart，未使用的数组留空。每条新记录使用新 UUID，重试沿用同一个 ID，已有 ID 跳过。普通饮食、身体和模板条目放 library，训练计划和已完成训练放 training。",
    "",
    "## 使用浏览器操作的 AI",
    "- 能操作浏览器的 AI 可使用用户已经自行登录并授权使用的站点会话。在「更多 → 数据导出与导入 → 其他数据的 AI 写入说明」核对账号标识，再按用户授权通过页面表单保存。",
    "- 训练计划统一打开「添加计划 → 粘贴已有内容」预览；需要起草或连接 Agent 时使用「添加计划 → 用自己的 AI」。适用的备份仍从「更多 → 数据导出与导入 → 恢复备份」上传并确认。",
    "- 个人账号 Sites 的网站邀请仅提供网站访问权限。训练搭子插件的连接由客户端和账号的权限单独管理。只有文本工具的 AI 可先准备可导入材料，并向用户说明保存状态。",
  ];
  return [...connection, ...scopes.flatMap((item) => item === "training" ? ["", trainingGuide] : ["", ...guideDetails[item], "", ...examples[item].flatMap((part) => ["", part])])].join("\n") + "\n";
}
