import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { mealTypes, nutritionEntry } from "@/features/library/model";
import { dateSchema } from "@/shared/dates";
import { importAgentRecords } from "./records";
import type { AgentPrincipal } from "./model";

const meals = z.object({
  id: z.string().uuid(),
  date: dateSchema,
  meal: z.enum(mealTypes),
  name: z.string().trim().min(1).max(100),
  grams: z.number().finite().positive().optional(),
  calories: z.number().finite().min(0),
  protein: z.number().finite().min(0),
  carbs: z.number().finite().min(0),
  fat: z.number().finite().min(0),
}).strict();

export const mealWriteInput = z.object({
  profileRef: profileRefSchema,
  confirmed: z.literal(true),
  meals: z.array(meals).min(1).max(20).refine((items) => new Set(items.map(({ id }) => id)).size === items.length),
}).strict();

export const mealWriteTool = {
  name: "add_spotter_meals",
  title: "添加餐食",
  description: "用户明确要求记餐后，向当前账号的指定日期和餐次追加 1–20 项。每项用 UUID，重试重复使用原 ID。热量为千卡，宏量营养和份量为克。",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["profileRef", "confirmed", "meals"],
    properties: {
      profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
      confirmed: { type: "boolean", const: true },
      meals: { type: "array", minItems: 1, maxItems: 20, items: {
        type: "object", additionalProperties: false,
        required: ["id", "date", "meal", "name", "calories", "protein", "carbs", "fat"],
        properties: {
          id: { type: "string", format: "uuid" }, date: { type: "string", format: "date" }, meal: { type: "string", enum: mealTypes },
          name: { type: "string", minLength: 1, maxLength: 100 }, grams: { type: "number", exclusiveMinimum: 0 },
          calories: { type: "number", minimum: 0 }, protein: { type: "number", minimum: 0 },
          carbs: { type: "number", minimum: 0 }, fat: { type: "number", minimum: 0 },
        },
      } },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} as const;

export async function addAgentMeals(principal: AgentPrincipal, { profileRef, confirmed, meals }: z.infer<typeof mealWriteInput>) {
  const library = meals.map(({ id, date, ...fields }) => ({
    kind: "nutrition" as const, id, date, entry: nutritionEntry.parse({ type: "meal", ...fields }),
  }));
  const written = await importAgentRecords(principal, {
    profileRef, confirmed, scope: "nutrition",
    backup: { format: "spotter-backup", version: 1, training: [], library, heart: [] },
  });
  return { ...written, dates: [...new Set(meals.map(({ date }) => date))].sort() };
}
