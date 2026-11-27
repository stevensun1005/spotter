import { strict as assert } from "node:assert";
import test from "node:test";
import { foods, scaleNutrition, searchFoods } from "../features/nutrition/foods.ts";
import { commonMealFoods, splitFoodQuery } from "../features/nutrition/recent-foods.ts";

test("Chinese and English portion syntax finds the exact food and fills its portion nutrition", () => {
  assert.deepEqual(splitFoodQuery("燕麦 ６０ 克"), { name: "燕麦", grams: "60" });
  assert.deepEqual(splitFoodQuery("60.5g 原味燕麦"), { name: "原味燕麦", grams: "60.5" });
  assert.deepEqual(splitFoodQuery("oatmeal 60.5 grams"), { name: "oatmeal", grams: "60.5" });
  assert.deepEqual(splitFoodQuery("2% milk"), { name: "2% milk" });
  assert.deepEqual(splitFoodQuery("150 grams chicken"), { name: "chicken", grams: "150" });
  // An amount alone, or a word that only starts with "g", is not split into a food name.
  for (const query of ["150g", "150 grams", "100 granola", "100 gâteau au chocolat"]) assert.deepEqual(splitFoodQuery(query), { name: query });
  assert.deepEqual(splitFoodQuery("150g鸡胸肉"), { name: "鸡胸肉", grams: "150" });
  const { name, grams } = splitFoodQuery("燕麦60g");
  const result = searchFoods(name)[0];
  assert.equal(result.id, "fdc-173904");
  assert.equal(scaleNutrition(result.per100g, Number(grams)).calories, 227.4);
});

test("recurring foods prefer the selected meal and reuse the latest portion from that meal", () => {
  const presets = [foods[1], foods[2], foods[0]];
  const recent = [
    { meal: "晚餐", foodId: foods[0].id, grams: 30 },
    { meal: "早餐", foodId: foods[0].id, grams: 55 },
    { meal: "早餐", foodId: foods[1].id, grams: 70 },
    { meal: "早餐", foodId: foods[0].id, grams: 46 },
    { meal: "早餐", foodId: "removed-custom-food", grams: 80 },
  ];
  assert.deepEqual(commonMealFoods(presets, recent, "早餐").map(({ food, grams }) => [food.id, grams]), [
    [foods[0].id, 55], [foods[1].id, 70], [foods[2].id, undefined],
  ]);
  assert.equal(commonMealFoods(presets, recent, "晚餐")[0].grams, 30);
  assert.deepEqual(commonMealFoods(presets, [], "早餐").map(({ food }) => food.id), presets.map(({ id }) => id));
});
