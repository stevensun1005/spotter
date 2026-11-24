import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  return specifier.startsWith("@/") ? next(new URL(specifier.slice(2) + ".ts", root).href, context)
    : next(specifier, context);
} });
const { asksProteinWarehouseStatus, confirmsSameProteinProduct, parseProteinPhotoIntent, proteinPhotoQuestion } =
  await import("../features/ai-coach/protein-photo-intent.ts");
const today = "2026-11-24";
const yesterday = "2026-11-23";

test("a photographed protein drink retains its recipe and warehouse/diary intent through the exact follow-up", () => {
  const initial = parseProteinPhotoIntent(
    "我喝这个蛋白粉 一勺（内置的勺子）+600ml 2%牛奶算一杯 帮我添加到蛋白粉仓库里 同时昨天和今天喝的蛋白粉也记一下", today,
  );
  assert.equal(initial.warehouse, true);
  assert.equal(initial.logRequested, true);
  assert.equal(initial.scoopsPerCup, 1);
  assert.equal(initial.milkMl, 600);
  assert.equal(initial.milkFatPercent, 2);
  assert.deepEqual(initial.servings, [{ date: yesterday }, { date: today }]);
  assert.match(proteinPhotoQuestion(initial), /一勺是多少克/);
  assert.doesNotMatch(proteinPhotoQuestion(initial), /牛奶|600/);

  const followUp = parseProteinPhotoIntent("我每次就是一勺+600ml 2%牛奶作为一杯 每次就喝一杯", today, initial);
  assert.equal(followUp.warehouse, true);
  assert.equal(followUp.logRequested, true);
  assert.deepEqual(followUp.servings, [{ date: yesterday, cups: 1 }, { date: today, cups: 1 }]);
  assert.equal(followUp.milkMl, 600);
  assert.equal(followUp.milkFatPercent, 2);
  assert.equal(followUp.nutritionEstimated, false);
  assert.match(proteinPhotoQuestion(followUp), /一勺是多少克/);

  const resolved = parseProteinPhotoIntent("先按30g估", today, followUp);
  assert.equal(resolved.scoopGrams, 30);
  assert.equal(resolved.scoopGramsEstimated, true);
  assert.equal(resolved.nutritionEstimated, false);
  assert.equal(proteinPhotoQuestion(resolved), undefined);
  assert.deepEqual(resolved.servings, followUp.servings);
  const allowedNutrition = parseProteinPhotoIntent("先按估算记", today, resolved);
  assert.equal(allowedNutrition.nutritionEstimated, true);
  const verifiedLabel = parseProteinPhotoIntent("包装上每勺 32 克", today, allowedNutrition);
  assert.equal(verifiedLabel.scoopGrams, 32);
  assert.equal(verifiedLabel.scoopGramsEstimated, false);
});

test("supports date-specific amounts and avoids writing today's diary when the date was ambiguous", () => {
  const result = parseProteinPhotoIntent("一杯用一勺蛋白粉和600ｍＬ ２％牛奶，每勺32克，昨天两杯、今天1杯，帮我记录", today);
  assert.deepEqual(result.servings, [{ date: yesterday, cups: 2 }, { date: today, cups: 1 }]);
  assert.equal(result.milkMl, 600);
  assert.equal(result.milkFatPercent, 2);
  assert.equal(result.scoopsPerCup, 1);
  assert.equal(result.scoopGrams, 32);
  assert.equal(proteinPhotoQuestion(result), undefined);

  const uncertain = parseProteinPhotoIntent("帮我记一下前几天喝的蛋白粉，一杯一勺，每勺30克，600毫升牛奶", today);
  assert.equal(uncertain.logRequested, true);
  assert.deepEqual(uncertain.servings, []);
  assert.match(proteinPhotoQuestion(uncertain), /哪一天/);
  assert.deepEqual(parseProteinPhotoIntent("昨天一杯", today, uncertain).servings, [{ date: yesterday, cups: 1 }]);
});

test("warehouse-only setup and rejected estimates do not authorize diary rows or nutrition guesses", () => {
  const cupboardOnly = parseProteinPhotoIntent("把蛋白粉添加到仓库，一杯一勺，600毫升 2%牛奶", today);
  assert.equal(cupboardOnly.warehouse, true);
  assert.equal(cupboardOnly.logRequested, false);
  assert.deepEqual(cupboardOnly.servings, []);
  assert.equal(parseProteinPhotoIntent("别按30g估", today, cupboardOnly).scoopGrams, undefined);
  assert.equal(parseProteinPhotoIntent("不要按通用营养估算", today, cupboardOnly).nutritionEstimated, false);
  assert.equal(parseProteinPhotoIntent("可以按通用营养估算吗？", today, cupboardOnly).nutritionEstimated, false);
  assert.equal(parseProteinPhotoIntent("帮我记一杯牛奶", today), undefined);
  assert.equal(parseProteinPhotoIntent("蛋白粉怎么冲好喝？", today), undefined);
});

test("explicit corrections can remove a pending diary action or an individual date", () => {
  const initial = parseProteinPhotoIntent("蛋白粉一勺，每勺32克，加600毫升牛奶，昨天今天各喝一杯，记一下", today);
  assert.deepEqual(initial.servings, [{ date: yesterday, cups: 1 }, { date: today, cups: 1 }]);
  const oneDay = parseProteinPhotoIntent("昨天不要记，只记录今天一杯", today, initial);
  assert.deepEqual(oneDay.servings, [{ date: today, cups: 1 }]);
  const noDiary = parseProteinPhotoIntent("别记录了，只放进蛋白粉仓库", today, oneDay);
  assert.equal(noDiary.warehouse, true);
  assert.equal(noDiary.logRequested, false);
  assert.deepEqual(noDiary.servings, []);
});

test("the exact photo message using 添加至 keeps both warehouse and dated diary actions", () => {
  const initial = parseProteinPhotoIntent(
    "我每次喝一杯 一勺蛋白粉（内置的勺子）600ml 2%牛奶 帮我添加至蛋白粉仓库 然后昨天和今天喝的蛋白粉就是这个 帮我把数据补上", today,
  );
  assert.equal(initial.warehouse, true);
  assert.equal(initial.logRequested, true);
  assert.equal(initial.milkMl, 600);
  assert.equal(initial.milkFatPercent, 2);
  assert.equal(initial.scoopsPerCup, 1);
  assert.deepEqual(initial.servings, [{ date: yesterday, cups: 1 }, { date: today, cups: 1 }]);
  const next = parseProteinPhotoIntent("按 30 克估", today, initial);
  const final = parseProteinPhotoIntent("先按估算记", today, next);
  assert.equal(final.warehouse, true);
  assert.equal(final.logRequested, true);
  assert.equal(final.scoopGrams, 30);
  assert.equal(final.nutritionEstimated, true);
  assert.deepEqual(final.servings, initial.servings);
});

test("warehouse phrasing, explicit only, and cancellations resolve independently of diary", () => {
  for (const command of ["存到仓库", "录到蛋白粉仓库", "入库", "保存至我的蛋白粉仓库"]) {
    const intent = parseProteinPhotoIntent(command, today);
    assert.equal(intent.warehouse, true, command);
    assert.equal(intent.logRequested, false, command);
  }
  const both = parseProteinPhotoIntent("每次一杯，蛋白粉一勺，600ml 2%牛奶，添加至仓库，昨天今天都记上", today);
  const only = parseProteinPhotoIntent("只加入仓库并设为训练后默认", today, both);
  assert.equal(only.warehouse, true);
  assert.equal(only.logRequested, false);
  assert.deepEqual(only.servings, []);
  assert.equal(only.milkMl, 600);
  const diaryOnly = parseProteinPhotoIntent("不要加入蛋白粉仓库", today, both);
  assert.equal(diaryOnly.warehouse, false);
  assert.deepEqual(diaryOnly.servings, both.servings);
  assert.equal(parseProteinPhotoIntent("别把这款录到仓库", today, both).warehouse, false);
  assert.equal(parseProteinPhotoIntent("别把这一桶蛋白粉录到仓库", today, both).warehouse, false);
  assert.equal(parseProteinPhotoIntent("别录到仓库，还是帮我添加至蛋白粉仓库", today, both).warehouse, true);
});

test("warehouse status is a local read and is never parsed as a write", () => {
  const previous = parseProteinPhotoIntent("把蛋白粉添加至仓库", today);
  for (const question of ["记入蛋白粉仓库了吗", "仓库加好了吗？", "有没有录到仓库", "查看我的蛋白粉仓库", "蛋白粉仓库有这款吗？", "没加到蛋白粉仓库吗？"]) {
    assert.equal(asksProteinWarehouseStatus(question), true, question);
    assert.equal(parseProteinPhotoIntent(question, today, previous), undefined, question);
  }
  assert.equal(asksProteinWarehouseStatus("帮我添加至蛋白粉仓库"), false);
  assert.equal(asksProteinWarehouseStatus("请把这桶保存至我的蛋白粉仓库"), false);
});

test("matching two labels requires an explicit same-product confirmation", () => {
  for (const confirmation of ["就是这款", "确认是同一款", "我确认这是同一款", "对，是同款。"]) {
    assert.equal(confirmsSameProteinProduct(confirmation), true, confirmation);
  }
  for (const other of ["不是这款", "就是这款吗？", "这款", "拍背面", "先按估算记"]) {
    assert.equal(confirmsSameProteinProduct(other), false, other);
  }
});
