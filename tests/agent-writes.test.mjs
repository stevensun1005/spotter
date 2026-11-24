import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });
const { agentFoodWrite, agentPlanWrite, agentRecordId, agentWriteTools, isAgentWriteTool } = await import("../features/agent/write-model.ts");

const { parseImport } = await import("../features/import/parse.ts");
const { exerciseTempo } = await import("../features/exercises/tempo.ts");

const auth = { profileRef: "spotter_" + "a".repeat(32), confirmed: true };
const plan = {
  title: " 练胸 ",
  date: "2026-11-23",
  category: "力量训练",
  exercises: [{ name: "杠铃卧推", sets: 3, reps: 10, unit: "kg", weight: 0, seconds: 0 }],
};
const food = { name: " 原味燕麦 ", per100g: { calories: 381, protein: 13, carbs: 60, fat: 1 } };
test("Agent plan writes normalize their stable IDs, default quantities, and privacy", async () => {
  const result = agentPlanWrite.parse({ ...auth, plans: [{ ...plan, shared: true }] });
  const [first] = result.plans;
  assert.equal(first.title, "练胸");
  assert.equal(first.shared, false);
  assert.equal(first.minutes, 0);
  assert.equal(first.video, "");
  const [retried] = agentPlanWrite.parse({ ...auth, plans: [{ ...plan, title: "练胸", minutes: 0 }] }).plans;
  assert.equal(await agentRecordId("plan", first), await agentRecordId("plan", retried));
  assert.notEqual(await agentRecordId("plan", first), await agentRecordId("plan", { ...first, date: "2026-11-24" }));
  assert.equal(agentPlanWrite.safeParse({ ...auth, plans: [{ ...plan, exercises: [] }] }).success, false);
  assert.equal(agentPlanWrite.safeParse({ ...auth, plans: [{ ...plan, date: "2026-02-30" }] }).success, false);
  assert.equal(agentPlanWrite.safeParse({ ...auth, plans: Array(21).fill(plan) }).success, false);
  assert.equal(agentPlanWrite.safeParse({ ...auth, owner: "untrusted", plans: [plan] }).success, false);
  assert.equal(agentPlanWrite.safeParse({ ...auth, confirmed: false, plans: [plan] }).success, false);
});

test("tempo survives plan import and defaults match the movement type for legacy plans", () => {
  const [saved] = agentPlanWrite.parse({
    ...auth, plans: [{ ...plan, exercises: [{ ...plan.exercises[0], tempo: " 3 / 1 / x / 0 " }] }],
  }).plans;
  assert.equal(saved.exercises[0].tempo, "3-1-X-0");
  assert.equal(parseImport(JSON.stringify(saved), saved.date)[0].exercises[0].tempo, "3-1-X-0");
  assert.equal(parseImport("哑铃卧推 3×10 · 节奏 3110", saved.date)[0].exercises[0].tempo, "3-1-1-0");
  assert.equal(agentWriteTools[0].inputSchema.properties.plans.items.properties.exercises.items.properties.tempo.type, "string");
  assert.deepEqual(exerciseTempo(saved.exercises[0]), { label: "计划节奏", text: "3-1-X-0", numeric: true });
  assert.deepEqual(exerciseTempo(plan.exercises[0]), { label: "建议节奏", text: "2-0-1-0", numeric: true });
  assert.equal(exerciseTempo({ name: "平板支撑", seconds: 30 }).text, "保持姿势并呼吸 30 秒");
  assert.equal(exerciseTempo({ name: "健身单车" }, { type: "cardio" }).numeric, false);
  assert.equal(exerciseTempo({ name: "敏捷球训练" }, { type: "plyometrics" }).text, "快速发力，稳定后再做下一次");
});

test("Agent food writes require complete numeric per-100g data and match only supported tools", async () => {
  const [parsed] = agentFoodWrite.parse({ ...auth, foods: [food] }).foods;
  assert.equal(parsed.name, "原味燕麦");
  const [retried] = agentFoodWrite.parse({ ...auth, foods: [{ name: "原味燕麦", per100g: { fat: 1, carbs: 60, protein: 13, calories: 381 } }] }).foods;
  assert.equal(await agentRecordId("food", parsed), await agentRecordId("food", retried));
  assert.notEqual(await agentRecordId("food", parsed), await agentRecordId("plan", parsed));
  assert.equal(agentFoodWrite.safeParse({ ...auth, foods: [{ ...food, per100g: { ...food.per100g, fat: null } }] }).success, false);
  assert.equal(agentFoodWrite.safeParse({ ...auth, foods: [{ ...food, per100g: { ...food.per100g, fat: 101 } }] }).success, false);
  assert.equal(agentFoodWrite.safeParse({ ...auth, profileRef: "missing-owner-guard", foods: [food] }).success, false);
  assert.equal(isAgentWriteTool("add_spotter_foods"), true);
  assert.equal(isAgentWriteTool("add_spotter_plans"), true);
  assert.equal(isAgentWriteTool("read_spotter_records"), false);
});
