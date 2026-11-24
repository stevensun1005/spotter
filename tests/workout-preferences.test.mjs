import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { parseWorkoutPreferences } = await import("../features/settings/workout-prefs.ts");
const { startSession } = await import("../features/training/model.ts");
const { changeNumber, copySetNumber } = await import("../features/training/set-editor.ts");

test("workout preference defaults migrate legacy alerts and validate only the invalid fields", () => {
  const previous = parseWorkoutPreferences(undefined, "both");
  assert.equal(previous.alertSound, "chime");
  assert.equal(previous.alertVibrate, true);
  assert.equal(previous.defaultRest, 30);
  const edited = parseWorkoutPreferences({ defaultRest: 0, layout: "unknown", alertSound: "off", defaultUnit: "lb", newSets: 0 }, "both");
  assert.equal(edited.defaultRest, 0);
  assert.equal(edited.layout, "cards");
  assert.equal(edited.alertSound, "off");
  assert.equal(edited.alertVibrate, true);
  assert.equal(edited.defaultUnit, "lb");
  assert.equal(edited.newSets, 3);
});

test("RIR editing and copying maintain canonical RPE records and reject unsupported effort values", () => {
  const plan = { title: "合成力量训练", date: "2026-11-24", minutes: 30, category: "力量训练", shared: false, video: "",
    exercises: [{ name: "卧推", sets: 2, weight: 20, unit: "kg", reps: 6, seconds: 0 }] };
  const session = startSession(plan, "example", plan.date);
  const target = { move: 0, row: 0, field: "rpe" };
  const edited = changeNumber(session, target, "2.5", "rir");
  assert.equal(edited.rows[0][0].rpe, 7.5);
  assert.equal(copySetNumber(edited, target, 1).rows[0][1].rpe, 7.5);
  assert.equal(changeNumber(edited, target, "0", "rir").rows[0][0].rpe, 10);
  assert.equal(changeNumber(edited, target, "", "rir").rows[0][0].rpe, undefined);
  assert.equal(changeNumber(edited, target, "9.5", "rir"), edited);
});
