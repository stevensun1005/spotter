
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return next(source.href, context);
    }
    return next(specifier, context);
  },
});

const { lowerBodyResistanceIllustrations: illustrations } =
  await import("../features/exercises/lower-body-resistance-illustrations.ts");

test("chains hang from both sleeves and hanging-band weights use a different load", () => {
  for (const id of ["1509", "4064"]) {
    const entry = illustrations[id];
    assert.deepEqual(entry.dynamic.filter(([kind]) => kind === "chain"), [["chain", 13, 0, 157], ["chain", 14, 0, 157]]);
    assert.ok(entry.frames[2][13][1] > entry.frames[0][13][1], id);
  }
  assert.ok(illustrations["1509"].props.length > illustrations["4064"].props.length);
  assert.equal(illustrations["3184"].dynamic.filter(([kind]) => kind === "kettlebell").length, 2);
  for (const frame of illustrations["3184"].frames) {
    assert.equal(frame[15][1] - frame[13][1], 36);
    assert.equal(frame[16][1] - frame[14][1], 36);
  }
});

test("safety bars have a cambered shaft, shoulder padding, and the designated heel elevation", () => {
  for (const id of ["4218", "4219"]) {
    const entry = illustrations[id];
    assert.ok(entry.dynamic.some(([kind, joint]) => kind === "pad" && joint === 17), id);
    assert.ok(entry.dynamic.some(([kind, a, b]) => kind === "bar" && a === 15 && b === 16), id);
    assert.ok(entry.frames[0][13][1] > entry.frames[0][15][1], id);
  }
  assert.ok(illustrations["4219"].frames[0][8][1] < illustrations["4218"].frames[0][8][1]);
  assert.ok(illustrations["4219"].props.length > illustrations["4218"].props.length);
});

test("lateral variants step before squatting, remain low, or step out while rising as instructed", () => {
  const bandSquat = illustrations["7206"].frames;
  const bandLow = illustrations["7203"].frames;
  const risingStep = illustrations["8374"].frames;
  assert.equal(bandSquat[1][2][1], bandSquat[0][2][1], "side step is upright");
  assert.ok(bandSquat[3][2][1] > bandSquat[1][2][1], "squat comes after step");
  for (const frame of bandLow) assert.equal(frame[2][1], bandLow[0][2][1]);
  assert.ok(risingStep[1][2][1] > risingStep[2][2][1], "rising as foot lifts");
  assert.ok(risingStep[2][8][1] < risingStep[1][8][1], "swing foot clears the floor");
});

test("hip and upper-body sequences keep the correct joints planted and moving", () => {
  const cable = illustrations["8876"].frames;
  for (const point of [0, 1, 2]) assert.deepEqual(cable[2][point], cable[0][point]);
  assert.ok(cable[2][7][0] < cable[0][7][0] && cable[2][7][1] < cable[0][7][1]);
  const glute = illustrations["6747"].frames;
  for (const point of [1, 2, 4, 6, 9, 10]) assert.deepEqual(glute[2][point], glute[0][point]);
  assert.ok(glute[2][8][1] < glute[0][8][1]);
  assert.ok(illustrations["5529"].frames[2][2][1] > illustrations["3707"].frames[2][2][1]);
  assert.ok(illustrations["3707"].frames[4][4][1] < illustrations["3707"].frames[4][0][1]);
});