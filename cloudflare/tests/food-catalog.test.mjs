import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { foods, maxFoodGrams, searchFoods } from "../features/nutrition/foods.ts";

const catalog = JSON.parse(readFileSync(new URL("../shared/food-catalog.json", import.meta.url), "utf8"));
const coreFoods = foods.filter(({ id }) => id.startsWith("fdc-"));
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

test("food search puts the food a name or everyday word means first", () => {
  const named = new Map(foods.map((food) => [key(food.name), food.id]));
  for (const food of foods) assert.equal(searchFoods(food.name)[0].id, food.id, food.name);
  for (const food of coreFoods) {
    for (const alias of food.aliases) assert.equal(searchFoods(alias)[0].id, named.get(key(alias)) ?? food.id, `${food.name} ${alias}`);
  }
  const expected = {
    rice: "fdc-169757", 米饭: "fdc-169757", 面包: "fdc-172688", bread: "fdc-172688", 燕麦粥: "fdc-173905", porridge: "fdc-173905",
    牛排: "usda-23391", 热狗: "usda-21118", "hot dog": "usda-21118", hamburger: "usda-21109", 汉堡: "usda-21109",
    "big mac": "ca-mcdonald-s-big-mac", 芝士: "usda-01009", 冰淇淋: "usda-19095",
    // Everyday foods come before chain items that match just as well.
    "apple pie": "usda-18301", 苹果批: "usda-18301", "onion rings": "ca-onion-rings-breaded-and-fried-fast-food",
    "chicken strips": "usda-21401", 鸡柳: "usda-21401", 芝士汉堡: "usda-21091", 芝士披萨: "ca-cheese-pizza-medium-12-inch-1-6-fast-food",
    薯條: "ca-french-fries-fast-food", 鸡翅: "usda-05103", 辣肠披萨: "usda-21302", 黑咖啡: "usda-14209",
    // A whole alias does not outrank the same word later in another food's alias ("steak sauce", "pea soup").
    steak: "usda-23388", duck: "usda-05140", peas: "usda-11313", mushrooms: "usda-11260",
    // Accents are optional.
    "creme sure": "usda-01178", fletan: "usda-15036", "bagel de montreal": "ca-st-viateur-bagel-st-viateur-montreal-style-sesame-bagel",
  };
  for (const [query, id] of Object.entries(expected)) assert.equal(searchFoods(query)[0].id, id, query);
  for (const food of foods.filter(({ brand }) => !brand)) {
    for (const alias of food.aliases) assert.ok(!searchFoods(alias)[0].brand, `${food.name} ${alias}`);
  }
  // English matches whole words from their start, also beside Chinese text, so "tea" finds tea and not
  // "sirloin steak", and "pie" does not find "Rice Krispies".
  assert.ok(searchFoods("tea").slice(0, 5).every(({ name }) => name.includes("茶")));
  for (const [query, id] of [["pie", "usda-08065"], ["pie", "usda-19438"], ["ham", "usda-18173"], ["bar", "ca-cadbury-cadbury-wunderbar"]]) {
    assert.ok(!searchFoods(query).some((food) => food.id === id), `${query} ${id}`);
  }
});
