import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { ropeBarIllustrations as ropes } from "../features/exercises/rope-bar-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const url = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const { upperPullMobilityIllustrations: upper } = await import("../features/exercises/upper-pull-mobility-illustrations.ts");

test("new upper pull, mobility and rope IDs render finite covers and distinct poses", () => {
  const catalogue = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const names = new Set(catalogue.map(({ id }) => id));
  const illustrations = { ...upper, ...ropes };
  assert.equal(Object.keys(illustrations).length, 48);
  for (const [id, demo] of Object.entries(illustrations)) {
    assert.ok(names.has(id), id);
    const signatures = new Set();
    for (let phase = 0; phase < demo.frames.length; phase++) {
      const points = [];
      const take = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(demo, phase * demo.ms,
        (_color, _width, path) => path.forEach(take), (_color, _radius, center) => take(center));
      signatures.add(points.join("|"));
    }
    assert.ok(signatures.size > 1, id);
  }
});

test("ropes stay anchored and climbing variants keep their actual grip and feet", () => {
  const traverse = ropes["4216"].frames;
  assert.deepEqual(traverse[0][6], traverse[1][6]);
  assert.deepEqual(traverse[1][4], traverse[2][4]);
  assert.ok(traverse[7][4][0] > traverse[0][4][0] + 100);
  assert.ok(traverse[8][4][1] > 100);
  assert.ok(ropes["10731"].frames.every((frame) => frame[2][1] === frame[8][1] && frame[4][0] === frame[6][0]));
  assert.ok(ropes["10439"].frames.every((frame) => frame[4][0] !== frame[6][0]));
  for (const id of ["3379", "3384", "3371", "4131"]) {
    for (const frame of ropes[id].frames) {
      assert.deepEqual(frame[17], [260, 153]);
      assert.deepEqual(frame[24], [240, 151]);
    }
  }
  assert.ok(ropes["3384"].frames[2][2][1] > ropes["3384"].frames[1][2][1]);
  assert.notEqual(ropes["3373"].frames[1][4][0], ropes["3374"].frames[1][4][0]);
});

test("rows, wrist turns and digit stretches distinguish movement from contact points", () => {
  const [down, up] = upper["4974"].frames;
  assert.deepEqual(down[4], up[4]);
  assert.ok(down[8][0] > up[8][0]);
  assert.ok(upper["4974"].dynamic.some(([kind, foot]) => kind === "slider" && foot === 8));
  const [wide, close] = upper["4911"].frames;
  assert.ok(wide[4][0] - wide[6][0] > close[4][0] - close[6][0]);
  const [resting, supinated, , pronated] = upper["6267"].frames;
  assert.deepEqual(supinated.slice(0, 11), resting.slice(0, 11));
  assert.deepEqual(pronated.slice(0, 11), resting.slice(0, 11));
  assert.notDeepEqual(supinated[15], pronated[15]);
  const [loose, hold] = upper["9996"].frames;
  assert.deepEqual(loose.slice(11, 22), hold.slice(11, 22));
  assert.notDeepEqual(loose[24], hold[24]);
});
