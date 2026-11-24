import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { planSchema, cleanPlan } = await import("../features/plans/model.ts");
const { startSession } = await import("../features/training/model.ts");
const { agentPlanWrite, agentWriteTools } = await import("../features/agent/write-model.ts");
const { prescriptionText } = await import("../features/plans/prescription.ts");
const move = { name: "哑铃卧推", sets: 3, reps: 8, weight: 0, unit: "kg", seconds: 0 };
const base = { title: "合成处方", date: "2026-11-24", category: "力量训练", minutes: 30, shared: false, video: "", exercises: [move] };

test("manual 1RM percentages convert units without becoming actual effort records", () => {
  const plan = planSchema.parse({ ...base, exercises: [{ ...move, targetRpe: 8, loadPercent: { percent: 80, reference: 100, unit: "lb" } }] });
  assert.equal(plan.exercises[0].weight, 36.29);
  assert.match(prescriptionText(plan.exercises[0]), /手填参考 100 lb/);
  const session = startSession(plan, "synthetic", base.date);
  assert.equal(session.rows[0][0].weight, 36.29);
  assert.equal(session.rows[0][0].rpe, undefined, "a target must not prefill the athlete's actual RPE");
  assert.equal(cleanPlan(plan).success, true);
  assert.equal(planSchema.parse(base).exercises[0].weight, 0, "unknown legacy loads stay unknown");
});

test("agent schemas expose and validate the same prescriptions as the editor", () => {
  const plans = [{ ...base, exercises: [{ ...move, loadPercent: { percent: 75, reference: 100, unit: "kg" }, targetRpe: 7.5 }] }];
  const parsed = agentPlanWrite.parse({ profileRef: "spotter_" + "a".repeat(32), confirmed: true, plans });
  assert.equal(parsed.plans[0].exercises[0].weight, 75);
  const fields = agentWriteTools[0].inputSchema.properties.plans.items.properties.exercises.items.properties;
  assert.equal(fields.targetRpe.multipleOf, 0.5);
  assert.ok(fields.loadPercent.properties.reference.exclusiveMinimum === 0);
  for (const invalid of [
    { ...move, targetRpe: 7.1 },
    { ...move, loadPercent: { percent: 80, reference: 0, unit: "kg" } },
    { ...move, unit: "lb", loadPercent: { percent: 150, reference: 2000, unit: "kg" } },
  ]) assert.equal(planSchema.safeParse({ ...base, exercises: [invalid] }).success, false);
});
