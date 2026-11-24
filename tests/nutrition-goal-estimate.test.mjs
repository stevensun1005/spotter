import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateNutritionGoal } from "../features/nutrition/goal-estimate.ts";

const profile = { age: 35, sex: "female", heightCm: 168, weightKg: 66, activity: "moderate", goal: "maintain" };

test("adult nutrition goals derive from body inputs and activity without replacing the water goal", () => {
  const maintain = estimateNutritionGoal(profile, 1550);
  assert.deepEqual(maintain, {
    restingCalories: 1374, maintenanceCalories: 2198,
    values: { calories: 2200, protein: 106, carbs: 307, fat: 61, water: 1550 },
  });
  assert.ok(estimateNutritionGoal({ ...profile, age: 45 }).values.calories < maintain.values.calories);
  assert.ok(estimateNutritionGoal({ ...profile, sex: "male" }).values.calories > maintain.values.calories);
  assert.ok(estimateNutritionGoal({ ...profile, heightCm: 180, weightKg: 74 }).values.calories > maintain.values.calories);
  assert.ok(estimateNutritionGoal({ ...profile, activity: "light" }).values.calories < maintain.values.calories);
  assert.ok(estimateNutritionGoal({ ...profile, activity: "high" }).values.calories > maintain.values.calories);
});

test("recomposition keeps maintenance calories, and gain and loss make modest changes", () => {
  const maintain = estimateNutritionGoal(profile).values;
  const recompose = estimateNutritionGoal({ ...profile, goal: "recompose" }).values;
  const gain = estimateNutritionGoal({ ...profile, goal: "gain" }).values;
  const lose = estimateNutritionGoal({ ...profile, goal: "lose" }).values;
  assert.equal(recompose.calories, maintain.calories);
  assert.equal(recompose.protein, 119);
  assert.ok(gain.calories > maintain.calories && gain.calories - maintain.calories <= 250);
  assert.ok(lose.calories < maintain.calories && maintain.calories - lose.calories <= 300);
  for (const { calories, protein, carbs, fat } of [maintain, recompose, gain, lose]) {
    assert.ok(Math.abs(protein * 4 + carbs * 4 + fat * 9 - calories) <= 2);
    assert.ok(carbs * 4 >= calories * 0.45 - 2);
  }
});

test("incomplete data, minors, invalid values, and low-weight loss produce no estimate", () => {
  assert.equal(estimateNutritionGoal({ ...profile, heightCm: undefined }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, age: 17 }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, weightKg: Infinity }), undefined);
  assert.equal(estimateNutritionGoal(profile, -1), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, weightKg: 49, goal: "lose" }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, heightCm: 100, weightKg: 25 }), undefined);
});
