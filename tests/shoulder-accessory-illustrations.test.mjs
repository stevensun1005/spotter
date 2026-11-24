import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { shoulderAccessoryIllustrations as demos } from "../features/exercises/shoulder-accessory-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("reviewed shoulder accessory entries paint covers and moving phases", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const names = new Map(rows.map((row) => [row.id, row.en]));
  assert.equal(Object.keys(demos).length, 55);
  for (const [id, demo] of Object.entries(demos)) {
    assert.match(names.get(id) ?? "", /rais|shrug|prone|can exercise|t spine press|floor slide|high pull/i);
    const phases = new Set();
    for (let index = 0; index < demo.frames.length; index++) {
      const points = [];
      const record = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(demo, index * demo.ms, (_color, _width, path) => path.forEach(record),
        (_color, _radius, center) => record(center));
      phases.add(points.join("|"));
    }
    assert.ok(phases.size >= 2, id);
  }
});

test("crossed cable raises, palm turns, and scapular movements visibly preserve their variants", () => {
  const [down, up] = demos["10901"].frames;
  assert.deepEqual(down[6], up[6]);
  assert.equal(down[4][1] - up[4][1], down[11][1] - up[11][1]);
  assert.deepEqual(down[12], up[12]);
  assert.ok(down[11][1] > up[11][1]);

  const cable = demos["4111"];
  assert.ok(Math.abs(cable.frames[0][4][1] - cable.dynamic[0][3]) <= 4);
  assert.deepEqual(cable.frames[0][2], cable.frames[1][2]);
  for (const id of ["4043", "4049"]) {
    const [start, lift] = demos[id].frames;
    assert.deepEqual(start[4], lift[4]);
    assert.deepEqual(start[6], lift[6]);
    assert.ok(start[0][1] > lift[0][1]);
  }

  const cross = demos["9872"];
  for (const [hand, oppositeShoulder, openingSign] of [[4, 12, 1], [6, 11, -1]]) {
    assert.ok((cross.frames[0][hand][1] - cross.frames[0][oppositeShoulder][1]) * openingSign < 0);
    assert.ok((cross.frames[1][hand][1] - cross.frames[1][oppositeShoulder][1]) * openingSign > 0);
  }
  assert.equal(demos["9873"].dynamic.filter(([kind]) => kind === "cable").length, 1);
  assert.ok(demos["9874"].props[0][0] < demos["9873"].props[0][0]); // Mat replaces bench.

  const palm = demos["3825"].frames;
  assert.deepEqual(palm[1][4], palm[2][4]);
  assert.equal(palm[1][11][1] - palm[1][4][1], -(palm[2][11][1] - palm[2][4][1]));
});
