import { z } from "zod";
import { tempoMaxLength } from "@/features/exercises/tempo";
import { personalFood } from "@/features/library/model";
import { categories, cleanPlan, planSchema } from "@/features/plans/model";
import { profileRefSchema } from "./profile";

const maxItems = 20;
const planShape = planSchema.innerType().shape;
const agentPlanInput = planSchema.innerType().extend({
  minutes: planShape.minutes.default(0),
  shared: planShape.shared.optional(),
  video: planShape.video.default(""),
  exercises: planShape.exercises.default([]),
}).strict().transform((data, context) => {
  const plan = cleanPlan({ ...data, shared: false });
  if (plan.success) return plan.data;
  for (const issue of plan.error.issues) context.addIssue(issue);
  return z.NEVER;
});
const agentFoodInput = personalFood.pick({ name: true, per100g: true }).extend({
  per100g: personalFood.shape.per100g.strict(),
}).strict();

const authorizedWrite = z.object({ profileRef: profileRefSchema, confirmed: z.literal(true) });
export const agentPlanWrite = authorizedWrite.extend({ plans: z.array(agentPlanInput).min(1).max(maxItems) }).strict();
export const agentFoodWrite = authorizedWrite.extend({ foods: z.array(agentFoodInput).min(1).max(maxItems) }).strict();

const text = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const integer = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const amount = (maximum: number) => ({ type: "number", minimum: 0, maximum });
const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const writeAuth = {
  profileRef: {
    type: "string", pattern: "^spotter_[a-f0-9]{32}$",
    description: "从用户自己的训练搭子 Agent 文件复制账号识别码，须匹配已连接的账号。",
  },
  confirmed: { type: "boolean", const: true, description: "仅在用户已经明确授权本批写入后填写 true。" },
};
const planItem = {
  type: "object", additionalProperties: false, required: ["title", "date", "category"],
  properties: {
    title: text(100),
    date: { type: "string", format: "date", description: "明确的 YYYY-MM-DD 日期。" },
    category: { type: "string", enum: categories },
    minutes: { ...integer(0, 720), default: 0 },
    durationNote: text(380),
    defaultRestSeconds: integer(0, 600),
    shared: { type: "boolean", const: false, default: false },
    video: { type: "string", maxLength: 1200, default: "", description: "保留输入的 YouTube 或 B站链接。" },
    exercises: {
      type: "array", maxItems: 30, default: [],
      items: {
        type: "object", additionalProperties: false, required: ["name", "sets", "reps", "weight", "unit", "seconds"],
        properties: {
          name: text(100),
          catalogueId: { type: "string", pattern: "^\\d{4,6}$" },
          sets: integer(1, 30),
          reps: integer(0, 999),
          weight: amount(2000),
          unit: { type: "string", enum: ["kg", "lb"] },
          seconds: integer(0, 18000),
          block: { type: "string", pattern: "^[A-Z](?:-[2-9]|-[12]\\d|-30)?$" },
          station: text(60),
          cue: text(220),
          tempo: { ...text(tempoMaxLength), description: "保留原计划节奏，例如 2-0-1-0。未注明时省略。" },
          sourceSlot: { type: "string", pattern: "^[A-Z](?:\\d+|-warmup)?$" },
          sourceName: text(100),
          restSeconds: integer(0, 600),
          repsMax: integer(1, 999),
          targetRpe: { type: "number", minimum: 1, maximum: 10, multipleOf: 0.5, description: "计划目标 RPE，不是实际组记录。" },
          loadPercent: {
            type: "object", additionalProperties: false, required: ["percent", "reference", "unit"],
            properties: {
              percent: { type: "number", minimum: 1, maximum: 150 },
              reference: { type: "number", exclusiveMinimum: 0, maximum: 2000, description: "用户手动确认的 1RM，不能将历史 e1RM 自动当作真实 1RM。" },
              unit: { type: "string", enum: ["kg", "lb"] },
            },
          },
        },
      },
    },
  },
};
const foodItem = {
  type: "object", additionalProperties: false, required: ["name", "per100g"],
  properties: {
    name: text(100),
    per100g: {
      type: "object", additionalProperties: false, required: ["calories", "protein", "carbs", "fat"],
      properties: { calories: amount(1000), protein: amount(100), carbs: amount(100), fat: amount(100) },
    },
  },
};

export const agentWriteTools = [
  {
    name: "add_spotter_plans",
    title: "添加训练计划",
    description: "追加已确认的个人训练计划。可安排动作或跟练视频，需要动作或视频至少一种。已有计划不会被覆盖。",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["profileRef", "confirmed", "plans"],
      properties: { ...writeAuth, plans: { type: "array", items: planItem, minItems: 1, maxItems } },
    },
    annotations,
  },
  {
    name: "add_spotter_foods",
    title: "添加常用食物",
    description: "将食品包装上已经核对、换算为每 100 克的千卡和宏量营养添加到个人食物库。无明确数值时请用户补充，不能猜测。",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["profileRef", "confirmed", "foods"],
      properties: { ...writeAuth, foods: { type: "array", items: foodItem, minItems: 1, maxItems } },
    },
    annotations,
  },
] as const;

export type AgentWriteTool = typeof agentWriteTools[number]["name"];

export function isAgentWriteTool(value: unknown): value is AgentWriteTool {
  return agentWriteTools.some(({ name }) => value === name);
}

// The schemas normalize key order and whitespace before hashing. Keep the UUID stable
// across retries without requiring the caller to retain generated record IDs.
export async function agentRecordId(kind: "plan" | "food", content: unknown) {
  const source = new TextEncoder().encode(JSON.stringify(["spotter-agent-v1", kind, content]));
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", source)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
