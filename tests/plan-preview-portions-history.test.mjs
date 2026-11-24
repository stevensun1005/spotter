import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const path = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(path)) return next(path.href, context);
  }
  return next(specifier, context);
} });
const { addPlanMove, phaseOf, setMovePhase } = await import("../features/plans/move-phase.ts");
const { planBlank, planSchema } = await import("../features/plans/model.ts");
const { portionGrams, saveFoodPortion } = await import("../features/nutrition/portions.ts");
const { emptyBackup, scopeBackup, backupSchema } = await import("../features/data/model.ts");
const { moveHistoryId, orderedOwnLogs } = await import("../features/history/day-order.ts");
const move = (name, props = {}) => ({ name, sets: 3, reps: 8, weight: 10, unit: "kg", seconds: 0, ...props });

test("a warm-up can be added or converted without changing working circuit metadata", () => {
  const work = move("哑铃卧推", { block: "A", station: "卧推凳", cue: "单手", restSeconds: 45 });
  const moves = addPlanMove([work], move("轻负荷热身"), "warmup");
  const persisted = planSchema.parse({ ...planBlank("2026-11-24"), title: "合成训练", exercises: moves });
  assert.deepEqual(persisted.exercises.map(phaseOf), ["warmup", "work"]);
  assert.deepEqual(persisted.exercises[1], work);
  const legacy = move("W1 半跪胸椎转动", { sourceSlot: "W1", block: "W", cue: "缓慢完成" });
  const converted = setMovePhase(legacy, "work");
  assert.equal(phaseOf(converted), "work");
  assert.equal(converted.cue, legacy.cue);
  assert.equal(converted.name, "半跪胸椎转动");
  assert.equal(converted.block, undefined);
});

test("saved portions use measured grams and stay in the private nutrition backup scope", () => {
  const portions = saveFoodPortion([{ name: "Ｃｕｐ", grams: 40 }], { name: "cup", grams: 35 });
  assert.deepEqual(portions, [{ name: "cup", grams: 35 }]);
  assert.equal(portionGrams("1.5", portions[0]), 52.5);
  assert.equal(portionGrams("35"), 35);
  assert.equal(portionGrams("", portions[0]), undefined);
  const row = { kind: "food-portions", id: "usda-example", portions };
  const backup = backupSchema.parse({ ...emptyBackup(), library: [row] });
  assert.deepEqual(scopeBackup(backup, "nutrition").library, [row]);
  assert.deepEqual(scopeBackup(backup, "training").library, []);
  assert.equal(backupSchema.safeParse({ ...backup, library: [{ ...row, portions: [...portions, { name: "ＣＵＰ", grams: 50 }] }] }).success, false);
});

test("same-day ordering moves only the owner's records and leaves newer unranked records stable", () => {
  const logs = [{ id: "new", owner: "self" }, { id: "x", owner: "partner" }, { id: "a", owner: "self" }, { id: "b", owner: "self" }];
  const order = moveHistoryId(["a", "b"], "b", -1);
  assert.deepEqual(orderedOwnLogs(logs, "self", [...order, "x"]).map(({ id }) => id), ["b", "x", "a", "new"]);
  assert.deepEqual(logs.map(({ id }) => id), ["new", "x", "a", "b"]);
});
