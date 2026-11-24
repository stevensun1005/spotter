import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve: (specifier, context, next) => next(
  specifier === "./foods" && context.parentURL?.endsWith("/food-photo-model.ts") ? "./foods.ts" : specifier,
  context,
) });
const { foodPhotoPrompt, mealPhotoPrompt, parseFoodPhotoResult, parseMealPhotoResult } = await import("../features/nutrition/food-photo-model.ts");

test("food label photo response fills a per-100g draft only with complete numeric nutrition", () => {
  const draft = { name: "燕麦片", per100g: { calories: 381, protein: 13.5, carbs: 62.2, fat: 0 } };
  assert.deepEqual(parseFoodPhotoResult("```json\n" + JSON.stringify(draft) + "\n```"), { draft });
  assert.deepEqual(parseFoodPhotoResult(JSON.stringify(draft)), { draft });
  for (const unclear of [
    { name: "燕麦片", per100g: { ...draft.per100g, fat: null } },
    { name: "燕麦片", per100g: { ...draft.per100g, calories: "381" } },
    { name: "燕麦片", per100g: { ...draft.per100g, fat: 101 } },
    { name: "燕麦片", per100g: { ...draft.per100g, fat: undefined } },
    { ...draft, unit: "ml" },
  ]) assert.match(parseFoodPhotoResult(JSON.stringify(unclear)).error, /四项有效营养/);
  assert.equal(parseFoodPhotoResult('{"needs":["每份重量","总脂肪"]}').error, "还需补拍或确认每份重量、总脂肪。");
  assert.match(foodPhotoPrompt, /4\.184/);
  assert.match(foodPhotoPrompt, /不要从食品外观/);
});

test("meal photo imports require verified portion totals and stop on missing information", () => {
  const draft = { name: "燕麦和酸奶", grams: 260, calories: 320, protein: 20, carbs: 43, fat: 7 };
  assert.deepEqual(parseMealPhotoResult(JSON.stringify(draft)), { draft });
  assert.match(parseMealPhotoResult(JSON.stringify({ ...draft, grams: 9000 })).error, /有效营养/);
  assert.match(parseMealPhotoResult(JSON.stringify({ ...draft, grams: undefined, fat: undefined })).error, /有效营养/);
  assert.equal(parseMealPhotoResult('{"needs":["燕麦份量"]}').error, "还需补拍或确认燕麦份量。");
  assert.match(mealPhotoPrompt, /等待我确认再保存/);
});
