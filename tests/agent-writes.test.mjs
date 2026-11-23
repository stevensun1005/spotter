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
const { agentFoodWrite, agentPlanWrite, agentRecordId, isAgentWriteTool } = await import("../features/agent/write-model.ts");

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
