
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

const { squatLungeVariantsIllustrations: illustrations } =
  await import("../features/exercises/squat-lunge-variants-illustrations.ts");

function bend([, , hip, , , , , knee, ankle]) {
  const thigh = [hip[0] - knee[0], hip[1] - knee[1]];
  const shin = [ankle[0] - knee[0], ankle[1] - knee[1]];
  return 180 - Math.acos((thigh[0] * shin[0] + thigh[1] * shin[1]) / (Math.hypot(...thigh) * Math.hypot(...shin))) * 180 / Math.PI;
}

test("wall slide quarter and half holds are shallower than parallel without foot travel", () => {
  const [quarter, half, parallel] = ["10926", "11451", "8956"].map((id) => illustrations[id]);
  assert.ok(bend(quarter.frames[1]) < 37);
  assert.ok(bend(half.frames[1]) >= 40 && bend(half.frames[1]) <= 60);
  assert.ok(bend(parallel.frames[1]) > 78);
  for (const entry of [quarter, half, parallel]) {
    for (const frame of entry.frames) {
      assert.deepEqual(frame[8], entry.frames[0][8]);
      assert.equal(frame[1][0], entry.frames[0][1][0]);
    }
  }
});

test("cossack raises the straight-leg toes and side squat keeps both feet flat", () => {
  for (const id of ["4562", "4732"]) {
    const [center, right, , left] = illustrations[id].frames;
    assert.deepEqual(right[10], center[10], id);
    assert.deepEqual(left[8], center[8], id);
    assert.ok(right[12][1] < center[12][1], id);
    assert.ok(left[11][1] < center[11][1], id);
  }
  for (const frame of illustrations["4754"].frames) {
    assert.ok(frame[11][1] >= frame[8][1]);
    assert.ok(frame[12][1] >= frame[10][1]);
  }
});

test("box rear lunge lowers the rear foot and the crossed lunge passes it behind the fixed foot", () => {
  const [boxReady, , boxDown] = illustrations["2837"].frames;
  assert.deepEqual(boxDown[8], boxReady[8]);
  assert.ok(boxDown[10][1] > boxReady[10][1]);
  const [ready, , down] = illustrations["1510"].frames;
  assert.deepEqual(down[8], ready[8]);
  assert.ok(ready[10][0] < ready[8][0]);
  assert.ok(down[10][0] > down[8][0]);
  assert.ok(down[10][1] < down[8][1]);
});

test("reverse Nordic inclines with straight hip alignment and shrimp keeps the rear foot in hand", () => {
  for (const id of ["4722", "9988"]) {
    for (const [head, , hip, , , , , knee] of illustrations[id].frames) {
      const collinearity = (head[0] - knee[0]) * (hip[1] - knee[1]) - (head[1] - knee[1]) * (hip[0] - knee[0]);
      assert.ok(Math.abs(collinearity) < 0.001, id);
    }
  }
  for (const frame of illustrations["3366"].frames) assert.deepEqual(frame[6], frame[10]);
  for (const frame of illustrations["10869"].frames) assert.ok(frame[0][1] >= 12);
});