
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

const { stepLungeIllustrations: illustrations } = await import("../features/exercises/step-lunge-illustrations.ts");

test("suspension cradle holds the rear foot while hand-assisted and power row variants use the grips", () => {
  const cradle = illustrations["1100"], hands = illustrations["1099"], row = illustrations["7279"];
  for (const frame of cradle.frames) assert.deepEqual(frame[10], cradle.frames[0][10]);
  assert.ok(cradle.dynamic.some(([type, point]) => type === "ring" && point === 10));
  assert.ok(hands.dynamic.some(([type, point]) => type === "ring" && point === 4));
  assert.ok(hands.frames[0][10][1] > cradle.frames[0][10][1]);
  for (const frame of row.frames) assert.ok(Math.abs(Math.hypot(frame[4][0] - 244, frame[4][1] - 28) - 88) < 0.001);
  assert.ok(row.frames[2][3][0] < row.frames[2][1][0]);
});

test("reverse-knee-forward follows the same working foot from behind to raised knee to front", () => {
  const [ready, , reverse, , knee, , forward] = illustrations["7412"].frames;
  assert.ok(reverse[10][0] < ready[10][0]);
  assert.ok(knee[10][1] < ready[10][1]);
  assert.ok(forward[10][0] > ready[10][0]);
  assert.equal(reverse[8][0], forward[8][0]);
});

test("the overhead pulse keeps feet planted while the long lunge bends lower", () => {
  const [, , low, pulse] = illustrations["3702"].frames;
  assert.deepEqual(low[8], pulse[8]);
  assert.deepEqual(low[10], pulse[10]);
  assert.ok(pulse[2][1] < low[2][1]);
  assert.ok(low[4][1] < low[0][1] && pulse[4][1] < pulse[0][1]);
  assert.ok(illustrations["9700"].frames[2][2][1] > illustrations["1460"].frames[2][2][1]);
});

test("walking alternates stance and loaded variants show the correct implements", () => {
  const [, , first, firstRise, , second] = illustrations["1460"].frames;
  assert.equal(first[10][0], firstRise[10][0]);
  assert.ok(second[8][0] > first[10][0]);
  assert.ok(illustrations["3655"].frames[1][10][1] < illustrations["1460"].frames[1][10][1]);
  assert.ok(illustrations["4409"].dynamic.some(([type]) => type === "barbell-end"));
  assert.equal(illustrations["4441"].dynamic.filter(([type]) => type === "kettlebell").length, 2);
  assert.ok(illustrations["8701"].dynamic.some(([type]) => type === "sandbag"));
});