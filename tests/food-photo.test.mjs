import assert from "node:assert/strict";
import { test } from "node:test";
import { foodPhotoPrompt, parseFoodPhotoResult } from "../features/nutrition/food-photo-model.ts";

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
