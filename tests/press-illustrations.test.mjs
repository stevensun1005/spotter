import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { pressIllustrations as presses } from "../features/exercises/press-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("reviewed presses render the cover and moving exercise poses with valid coordinates", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(Object.keys(presses).length, 52);
  for (const [id, demo] of Object.entries(presses)) {
    assert.match(byId.get(id)?.en ?? "", /press/i);
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

test("specific press variants retain suspension type, grip rotation, and supported posture", () => {
  assert.ok(presses["3185"].dynamic.some(([kind, index]) => kind === "band" && index === 12));
  assert.ok(presses["4414"].dynamic.some(([kind]) => kind === "kettlebell"));
  assert.ok(presses["4201"].dynamic.some(([kind]) => kind === "chain"));
  assert.ok(presses["6272"].frames.every((frame) => frame[8][1] < 130 && frame[10][1] < 130));
  assert.ok(presses["5261"].frames[0][1][1] < presses["1214"].frames[0][1][1]);
  assert.ok(presses["4577"].frames.every((frame) => frame[9][1] >= 150 && frame[7][1] < 120));
  const arnold = presses["4067"].frames;
  const direction = (frame, origin, tip) => frame[tip][1] - frame[origin][1];
  assert.ok(direction(arnold[0], 4, 14) > 0);
  assert.equal(direction(arnold[1], 4, 14), 0);
  assert.ok(direction(arnold[1], 6, 16) > 0);
  assert.equal(direction(arnold[3], 6, 16), 0);
  for (const id of ["2919", "10863"]) {
    assert.ok(presses[id].frames.every((frame) =>
      frame[18][0] === 91 && frame[19][0] === 197 && frame[18][1] === frame[4][1]));
  }
  assert.ok(presses["11800"].frames[3][1][1] < presses["11800"].frames[2][1][1]);
  assert.ok(presses["3362"].frames[0][1][1] > presses["3364"].frames[0][1][1]);
});
