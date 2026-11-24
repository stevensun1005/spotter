import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hingeIllustrations } from "../features/exercises/hinge-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
const catalog = new Map(rows.map((row) => [row.id, row]));
const demo = (id) => hingeIllustrations[id];
const kinds = (id) => new Set(demo(id).dynamic.map(([kind]) => kind));

test("reviewed hinges have distinct playable keyframes within the demonstration canvas", () => {
  assert.ok(Object.keys(hingeIllustrations).length >= 160);
  for (const [id, motion] of Object.entries(hingeIllustrations)) {
    assert.ok(catalog.has(id), id);
    assert.ok(motion.reference, id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    const width = motion.frames[0].length;
    for (const frame of motion.frames) {
      assert.equal(frame.length, width, id);
      for (const [x,y] of frame) assert.ok(x > 0 && x < 320 && y > 0 && y < 180, id);
    }
  }
});

test("blocked, deficit, Smith, and banded variations retain their specific setups", () => {
  assert.ok(demo("6034").props.some((line) => line[1] === 135));
  assert.equal(demo("5702").frames[0][8][1], 147);
  assert.equal(demo("6034").frames[0][8][1], 157);
  assert.ok(demo("0886").props.some((line) => line[0] === 185 && line[2] === 185));
  assert.ok(kinds("4841").has("band"));
  assert.ok(demo("4841").dynamic.some(([kind, , , y]) => kind === "band" && y === 22));
  assert.ok(demo("4173").dynamic.some(([kind, , , y]) => kind === "band" && y === 157));
  assert.ok(kinds("5912").has("chain"));
  const strokes = [];
  paintMotionFrame(demo("5912"), demo("5912").ms, (color) => strokes.push(color), () => {});
  assert.ok(strokes.includes("#d2c6a8"));
});

test("reverse extension raises legs while standard extension raises torso", () => {
  const [flatStart, flatEnd] = demo("5803").frames;
  assert.deepEqual(flatStart[1], flatEnd[1]);
  assert.ok(flatEnd[8][1] < flatStart[8][1]);
  const [raise, lower] = demo("5813").frames;
  assert.deepEqual(raise[2], lower[2]);
  assert.deepEqual(raise[8], lower[8]);
  assert.ok(raise[1][1] < lower[1][1]);
  assert.ok(demo("3180").props.some(([x1, y1, x2, y2]) => x2 - x1 > 65 && y2 - y1 > 20));
  assert.ok(kinds("9009").has("stability-ball"));
  const [supermanStart, supermanPeak] = demo("2394").frames;
  const [headStart, headPeak] = demo("3228").frames;
  assert.ok(supermanPeak[8][1] < supermanStart[8][1]);
  assert.equal(headPeak[8][1], headStart[8][1]);
});

test("single-leg and supported variants distinguish same-side loading and rear-foot support", () => {
  assert.ok(demo("7648").dynamic.some(([kind, index]) => kind === "dumbbell" && index === 4));
  assert.ok(demo("3338").dynamic.some(([kind, index]) => kind === "dumbbell" && index === 6));
  assert.notDeepEqual(demo("2806").props, demo("10865").props);
  const [top] = demo("10865").frames;
  assert.ok(top[10][1] < top[8][1]);
  assert.ok(demo("2750").props.some(([x1, y1, x2, y2]) => x1 === 219 && x2 === 219 && y2 > y1));
});
