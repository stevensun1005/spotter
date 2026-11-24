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

const { macroRatios, splitCalories, targetForDate, recordedExerciseEnergy } = await import("../features/nutrition/nutrition-planning.ts");
const { libraryDay, libraryScope, scopeBackup, emptyBackup } = await import("../features/data/model.ts");
const { libraryItem } = await import("../features/library/model.ts");
const { recipes } = await import("../features/nutrition/nutrition-recipes.ts");

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

test("recipe nutrition is computed from the same catalogue values used by the diary", () => {
  assert.ok(recipes.length >= 4);
  for (const recipe of recipes) {
    assert.ok(recipe.ingredients.length >= 2);
    assert.equal(recipe.totals.calories, recipe.ingredients.reduce((total, ingredient) => total + ingredient.amounts.calories, 0));
    assert.ok(recipe.ingredients.every(({ food, grams }) => food.per100g.calories > 0 && grams > 0));
  }
});
