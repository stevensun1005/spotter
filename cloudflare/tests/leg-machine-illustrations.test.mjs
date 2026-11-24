import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url)));
const { legMachineIllustrations: motions } = await import("../features/exercises/leg-machine-illustrations.ts");
const { paintMotionFrame } = await import("../features/exercises/motion-drawing.ts");

function pathBetween(motion, pose, ankle = 8, frontToe = 11) {
  const expected = [motion.frames[pose][ankle], motion.frames[pose][frontToe]];
  let found = false;
  paintMotionFrame(motion, pose * motion.ms, (color, width, path) => {
    if (color === "#f2eee5" && width === 5 && JSON.stringify(path) === JSON.stringify(expected)) found = true;
  }, () => {});
  return found;
}

test("lower-leg demos use exact catalogue IDs and draw moving feet through the same renderer as their cover", () => {
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const [id, motion] of Object.entries(motions)) {
    assert.equal(byId.get(id)?.id, id);
    assert.ok(motion.reference);
    assert.ok(new Set(motion.frames.map(frame => JSON.stringify(frame))).size > 1, id);
    assert.ok(motion.frames.every(frame => frame.length === motion.frames[0].length && frame.every(point => point.length === 2 && point.every(Number.isFinite))), id);
    assert.ok(pathBetween(motion, 0) && pathBetween(motion, 1), id);
  }
});

test("reformer contact, one-leg loading, and resistance band anchor follow the named variants", () => {
  const [toe, standard, heel, calf] = ["10654", "10655", "10656", "10657"].map(id => motions[id]);
  assert.deepEqual(toe.frames[0][11], toe.frames[1][11]);
  assert.deepEqual(calf.frames[0][11], calf.frames[1][11]);
  assert.notDeepEqual(heel.frames[0][11], standard.frames[0][11]);
  assert.ok(heel.frames[0][11][1] < heel.frames[0][8][1]);
  assert.deepEqual(motions["7177"].frames[0][10], motions["7177"].frames[1][10]);
  assert.notDeepEqual(motions["7176"].frames[0][10], motions["7176"].frames[1][10]);
  assert.ok(motions["10746"].dynamic.some(([kind, index, anchorX]) => kind === "band" && index === 8 && anchorX < motions["10746"].frames[0][2][0]));
  assert.ok(motions["3508"].dynamic.some(([kind, index, anchorX]) => kind === "band" && index === 8 && anchorX > motions["3508"].frames[0][2][0]));
});
