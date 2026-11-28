import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { carbGramsFromTarget, macroRatios, plannedTargetForDate, splitCalories, targetForDate, recordedExerciseEnergy } = await import("../features/nutrition/nutrition-planning.ts");
const { libraryDay, libraryScope, scopeBackup, emptyBackup } = await import("../features/data/model.ts");
const { libraryItem } = await import("../features/library/model.ts");

const target = { kind: "targets", targetWeightKg: 75, values: { calories: 2200, protein: 100, carbs: 315, fat: 60, water: 2000 } };
const planning = { kind: "nutrition-plan", cut: [{ date: "2026-11-23", calories: 2000 }, { date: "2026-12-07", calories: 1900 }],
  carbCycle: { days: ["高碳", "低碳", "中碳", "中碳", "高碳", "低碳", "中碳"], grams: { 低碳: 180, 中碳: 230, 高碳: 300 } } };
const workoutId = "11111111-2222-4333-8444-555555555555";
const energy = { kind: "nutrition-energy", id: "2026-11-23", workouts: [{ id: workoutId, calories: 275 }] };

test("dated nutrition targets combine phases, weekday carbs and explicit exercise allowances", () => {
  const rows = [target, planning, energy];
  assert.equal(targetForDate(rows, "2026-11-23", []).calories, 2060);
  assert.equal(targetForDate(rows, "2026-11-23", [{ id: workoutId, kind: "log", data: { date: "2026-11-23" } }]).calories, 2335);
  assert.equal(targetForDate(rows, "2026-11-24").carbs, 180);
  assert.ok(targetForDate(rows, "2026-12-07").protein < targetForDate(rows, "2026-11-23").protein);
  assert.equal(targetForDate(rows, "2026-11-23").water, 2000);
  assert.equal(recordedExerciseEnergy(rows, "2026-11-24"), 0);
  assert.deepEqual(splitCalories(1600, { protein: 25, carbs: 50, fat: 25 }, 1800),
    { calories: 1600, protein: 100, carbs: 200, fat: 44, water: 1800 });
  assert.equal(Object.values(macroRatios(target.values)).reduce((a, b) => a + b), 100);
});

test("nutrition configuration is validated and included in the right backup scope", () => {
  for (const item of [target, planning, energy]) assert.ok(libraryItem.safeParse(item).success);
  assert.equal(libraryItem.safeParse({ ...energy, workouts: [energy.workouts[0], energy.workouts[0]] }).success, false);
  assert.equal(libraryItem.safeParse({ ...planning, cut: [planning.cut[0], planning.cut[0]] }).success, false);
  assert.equal(libraryDay(energy), "2026-11-23");
  assert.equal(libraryDay(planning), null);
  assert.equal(libraryScope(energy), "nutrition");
  assert.deepEqual(scopeBackup({ ...emptyBackup(), library: [target, planning, energy] }, "nutrition").library, [target, planning, energy]);
});

test("linked carb cycle follows current goals and cut phases without changing explicit exercise allowances", () => {
  const linked = { ...planning, carbCycle: { ...planning.carbCycle, basis: "target" } };
  const rows = [target, linked, energy];
  const monday = "2026-11-23";
  assert.equal(libraryItem.parse(linked).carbCycle.basis, "target");
  assert.equal(libraryItem.parse(planning).carbCycle.basis, undefined);
  assert.deepEqual(carbGramsFromTarget(1500), { 低碳: 1200, 中碳: 1500, 高碳: 1500 });
  assert.equal(plannedTargetForDate(rows, monday, null).carbs, 285);
  assert.equal(plannedTargetForDate(rows, monday, linked.carbCycle).calories, 2228);
  assert.deepEqual(targetForDate(rows, monday), { calories: 2503, carbs: 342, protein: 90, fat: 56, water: 2000 });
  const changed = { ...target, values: { ...target.values, calories: 2400, carbs: 365 } };
  assert.equal(targetForDate([changed, linked], monday).carbs, 360);
  assert.equal(targetForDate([changed, planning], monday).carbs, 300);
  assert.equal(targetForDate([linked], "2026-11-22").calories, 0);
});
