import assert from "node:assert/strict";
import { test } from "node:test";
import { foods, maxFoodGrams, scaleNutrition, searchFoods } from "../features/nutrition/foods.ts";

test("oat search distinguishes dry and cooked weights and scales each macro", () => {
  const [dry, cooked] = searchFoods("燕麦");
  assert.equal(dry.id, "fdc-173904");
  assert.equal(cooked.id, "fdc-173905");
  assert.equal(searchFoods("ＲＯＬＬＥＤ oats")[0], dry);
  assert.equal(searchFoods("熟燕麦")[0], cooked);
  assert.deepEqual(searchFoods("不存在的食物"), []);
  assert.equal(new Set(foods.map((food) => food.id)).size, foods.length);
  const result = scaleNutrition(dry.per100g, 40);
  const rounded = Object.values(result).map((amount) => Number(amount.toFixed(2)));
  assert.deepEqual(rounded, [151.6, 5.26, 27.08, 2.61]);
  assert.equal(Number(scaleNutrition(cooked.per100g, 40).calories.toFixed(2)), 28.4);
  assert.equal(scaleNutrition(dry.per100g, maxFoodGrams + 1).calories, 0);
});
