import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { coreFoods, foods, maxFoodGrams, searchFoods } from "../features/nutrition/foods.ts";

const catalog = JSON.parse(readFileSync(new URL("../shared/food-catalog.json", import.meta.url), "utf8"));
const key = (value) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

test("shared food catalog keeps every entry inside the meal and personal-food limits", () => {
  const categories = new Map(catalog.categories.map((category) => [category.id, new Set(category.groups.map(({ id }) => id))]));
  assert.equal(categories.size, catalog.categories.length);
  assert.equal(new Set(catalog.foods.map(({ id }) => id)).size, catalog.foods.length);
  assert.equal(new Set(catalog.foods.map(({ name }) => key(name))).size, catalog.foods.length);
  for (const food of catalog.foods) {
    assert.ok(food.id.length > 0 && food.id.length <= 80, food.id);
    assert.ok(food.name.length > 0 && food.name.length <= 100, food.id);
    assert.ok(categories.get(food.category)?.has(food.group), `${food.id} ${food.category}/${food.group}`);
    assert.ok(catalog.sources[food.src] && food.ref, `${food.id} source`);
    const { calories, protein, carbs, fat } = food.per100g;
    assert.ok(calories >= 0 && calories <= 1000, food.id);
    for (const value of [protein, carbs, fat]) assert.ok(value >= 0 && value <= 100, food.id);
    assert.ok(protein + carbs + fat <= 101, food.id);
    assert.ok(!food.aliases.some((alias) => key(alias) === key(food.name)), `${food.id} repeats its name`);
    for (const portion of food.portions) {
      assert.ok(portion.name.length > 0 && portion.name.length <= 20, `${food.id} ${portion.name}`);
      assert.ok(portion.grams >= 0.1 && portion.grams <= maxFoodGrams, `${food.id} ${portion.name}`);
    }
  }
  for (const id of categories.keys()) assert.ok(catalog.foods.some((food) => food.category === id), id);
});

test("catalog keeps the original foods first so earlier records and searches resolve the same way", () => {
  assert.equal(coreFoods.length, 22);
  assert.deepEqual(foods.slice(0, 22).map(({ id }) => id), coreFoods.map(({ id }) => id));
  assert.equal(foods.find(({ id }) => id === "fdc-171267")?.per100g.fat, 1.98);
  const [dry, cooked] = searchFoods("燕麦");
  assert.equal(dry.id, "fdc-173904");
  assert.equal(cooked.id, "fdc-173905");
  assert.equal(searchFoods("米饭")[0].id, "fdc-169757");
  assert.ok(foods.every((food) => !food.source || food.source.startsWith("https://")));
});
