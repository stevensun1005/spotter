import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(new URL("../" + specifier.slice(2) + ".ts", import.meta.url).href, context);
  }
  if (specifier === "./protein-photo-intent") return next(specifier + ".ts", context);
  return next(specifier, context);
} });
const { parseProteinPhotoIntent } = await import("../features/ai-coach/protein-photo-intent.ts");
const { addMilkToPowderEstimate, combineProteinLabels, estimatedPowderPer100g, multiplyProteinDrink, prepareProteinPhoto } =
  await import("../features/ai-coach/protein-photo-workflow.ts");
const date = "2026-11-24";
const name = "测试用草莓蛋白粉";
const first = parseProteinPhotoIntent("一勺+600ml 2%牛奶算一杯，添加到蛋白粉仓库，昨天和今天喝的蛋白粉也记一下", date);
const continued = parseProteinPhotoIntent("每次就是一勺+600ml 2%牛奶，每次就喝一杯", date, first);
const recipe = { id: "a6c341ab-d6bf-4b96-859c-24473e5f0f09", meal: "加餐", intent: continued, product: { name } };

test("a plain-text follow-up retains the warehouse, prior dates, and recipe, leaving only scoop weight unresolved", () => {
  assert.equal(continued.warehouse, true);
  assert.deepEqual(continued.servings, [{ date: "2026-11-23", cups: 1 }, { date, cups: 1 }]);
  assert.equal(continued.milkMl, 600);
  assert.match(prepareProteinPhoto(recipe, []).question, /一勺是多少克/);
});

test("back label completes the original photo and both days use the full milk and powder portions", () => {
  const product = combineProteinLabels(recipe.product, {
    scoopGrams: 30, per100g: { calories: 400, protein: 80, carbs: 8, fat: 5 },
  });
  assert.equal(product.name, name);
  const complete = prepareProteinPhoto({ ...recipe, product }, []);
  assert.deepEqual(complete.draft, { name, grams: 630, calories: 420, protein: 43.8, carbs: 31.2, fat: 13.38 });
  assert.deepEqual(complete.servings.map(({ cups }) => multiplyProteinDrink(complete.draft, cups)), [complete.draft, complete.draft]);
  assert.throws(() => combineProteinLabels(product, { name: "另一款蛋白粉", scoopGrams: 50 }), /品名和正面读到的不同/);
  assert.deepEqual(combineProteinLabels({ name }, { name: "简写品名", scoopGrams: 31 }, true), { name, scoopGrams: 31 });
});

test("an allowed powder estimate keeps the milk and warehouse facts separate", () => {
  const intent = parseProteinPhotoIntent("按30g估，先按估算记", date, continued);
  const incomplete = prepareProteinPhoto({ ...recipe, intent }, []);
  assert.equal(incomplete.warehouseProduct.powder, undefined);
  const estimate = { name: "通用蛋白粉", grams: 30, calories: 120, protein: 24, carbs: 2.4, fat: 1.5 };
  assert.deepEqual(addMilkToPowderEstimate(estimate, incomplete.estimate),
    { name, grams: 630, calories: 420, protein: 43.8, carbs: 31.2, fat: 13.38 });
  assert.deepEqual(estimatedPowderPer100g(estimate, 30), { calories: 400, protein: 80, carbs: 8, fat: 5 });
  assert.equal(addMilkToPowderEstimate({ ...estimate, grams: 630 }, incomplete.estimate), undefined);
});
