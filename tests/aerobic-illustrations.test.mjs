
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

const { aerobicIllustrations: illustrations } = await import("../features/exercises/aerobic-illustrations.ts");

test("low-impact side stepping momentarily lifts exactly one foot and returns to a planted stance", () => {
  for (const id of ["4436", "4438", "0565", "8874"]) {
    const [ready, moving, landed] = illustrations[id].frames;
    assert.deepEqual(moving[10], ready[10], id);
    assert.ok(moving[8][1] < ready[8][1], id);
    assert.equal(landed[8][1], ready[8][1], id);
  }
  assert.ok(illustrations["8874"].dynamic.some(([kind]) => kind === "knee-band"));
});

test("step-down variants preserve low platform, wedge and unsupported raised heel", () => {
  const flat = illustrations["9602"], wedge = illustrations["9604"], raised = illustrations["9605"];
  assert.equal(flat.frames[0][8][1] + 1, flat.frames[0][11][1]);
  assert.ok(wedge.props.length > flat.props.length);
  assert.equal(raised.props.length, flat.props.length);
  assert.ok(raised.frames[0][8][1] < wedge.frames[0][8][1]);
  for (const id of ["9601", "9602", "9603", "9604", "9605"]) {
    const [high, , low] = illustrations[id].frames;
    assert.deepEqual(low[8], high[8], id);
    assert.equal(low[10][1], 155, id);
  }
});

test("bike pedals oppose each other at the crank and the pool drill retains its support", () => {
  for (const frame of illustrations["5214"].frames) {
    const [near, far, crank] = [frame[8], frame[10], frame[13]];
    for (const axis of [0, 1]) assert.ok(Math.abs(near[axis] + far[axis] - 2 * crank[axis]) < 0.01);
  }
  const pool = illustrations["10729"];
  for (const frame of pool.frames) assert.deepEqual(frame.slice(3, 7), pool.frames[0].slice(3, 7));
});

test("weighted step-up presses at the standing phase and RDL stays on the lead foot through the hinge", () => {
  const [start, , standing] = illustrations["4185"].frames;
  assert.ok(standing[4][1] < standing[0][1]);
  assert.ok(standing[8][1] < start[8][1]);
  const [, firstPlanted, firstHinge, , secondPlanted, secondHinge] = illustrations["3651"].frames;
  assert.deepEqual(firstPlanted[8], firstHinge[8]);
  assert.deepEqual(secondPlanted[10], secondHinge[10]);
});