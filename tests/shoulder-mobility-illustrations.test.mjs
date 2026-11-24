import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { shoulderMobilityIllustrations as demos } from "../features/exercises/shoulder-mobility-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("shoulder mobility covers and poses paint for exact exercise IDs", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, demo] of Object.entries(demos)) {
    assert.ok(byId.has(id), id);
    const drawn = new Set();
    for (let frame = 0; frame < demo.frames.length; frame++) {
      const rendered = [];
      const check = (p) => {
        assert.ok(p.every(Number.isFinite), id);
        rendered.push(p.join(","));
      };
      paintMotionFrame(demo, frame * demo.ms, (_color, _width, path) => path.forEach(check),
        (_color, _radius, p) => check(p));
      drawn.add(rendered.join("|"));
    }
    assert.ok(drawn.size > 1, id);
  }
});

test("rotations, wall supports, position holds and shoulder circles retain their reviewed distinctions", () => {
  const cableHigh = demos["5087"], cableLow = demos["6755"];
  const anchorY = (item) => item.dynamic.find(([k]) => k === "cable").at(-1);
  assert.ok(anchorY(cableHigh) < anchorY(cableLow));
  for (const frame of cableHigh.frames) assert.deepEqual(frame[3], cableHigh.frames[0][3]);
  assert.ok(cableHigh.frames[2][4][1] < cableHigh.frames[0][4][1]);
  assert.ok(demos["5089"].frames[2][4][1] > demos["5089"].frames[0][4][1]);

  assert.ok(demos["3693"].props.length > 0);
  assert.equal(demos["3684"].props.length, 0);
  assert.ok(demos["10934"].dynamic.some(([kind]) => kind === "pad"));
  assert.ok(demos["5311"].dynamic.some(([kind]) => kind === "stability-ball"));
  assert.ok(demos["5026"].dynamic.some(([kind]) => kind === "band"));
  assert.ok(demos["5026"].dynamic.some(([kind]) => kind === "pad"));
  assert.ok(demos["2945"].props[0][0] < demos["2945"].frames[0][1][0]);

  const isometric = demos["10126"];
  assert.deepEqual(isometric.frames[1], isometric.frames.at(-1));
  assert.ok((isometric.frames.length - 2) * isometric.ms >= 10000);
  const clasp = demos["1976"];
  assert.ok(clasp.frames.at(-1)[4][0] < clasp.frames.at(-1)[1][0]);
  const circle = demos["0256"];
  for (const frame of circle.frames) assert.deepEqual(frame[4], circle.frames[0][4]);
  assert.notDeepEqual(circle.frames[2][3], circle.frames[0][3]);
  assert.ok(demos["8655"].dynamic.every(([kind]) => kind === "palm-up"));
});
