import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { flyIllustrations } from "../features/exercises/fly-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("authored flies render a finite cover and distinct positions", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, demo] of Object.entries(flyIllustrations)) {
    assert.match(byId.get(id)?.en ?? "", /\b(?:flye?|pec deck|crossovers?)\b/i);
    const signatures = new Set();
    for (let index = 0; index < demo.frames.length; index++) {
      const coordinates = [];
      const check = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        coordinates.push(point.join(","));
      };
      paintMotionFrame(demo, index * demo.ms, (_color, _width, path) => path.forEach(check),
        (_color, _radius, point) => check(point));
      signatures.add(coordinates.join("|"));
    }
    assert.ok(signatures.size > 1, id);
  }
});

test("fly variants use the reviewed bench, anchor, pause and load path", () => {
  const floor = flyIllustrations["4149"], flat = flyIllustrations["1450"], incline = flyIllustrations["1449"];
  assert.equal(floor.props.length, 0);
  assert.ok(flat.props.every(([x1, y1, x2, y2]) => x1 === x2 || y1 === y2));
  const [x1, y1, x2, y2] = incline.props[0];
  assert.ok(Math.abs(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI - 30) < 2);
  assert.ok((incline.frames.length - 2) * incline.ms >= 15000);
  assert.deepEqual(incline.frames[1], incline.frames.at(-1));
  assert.ok(Math.abs(flyIllustrations["3175"].frames[0][7][1] - flyIllustrations["3175"].frames[0][8][1]) < 3);
  assert.ok(floor.frames[1][3][1] >= 155);

  const at = (id) => flyIllustrations[id].dynamic.find(([kind]) => kind === "band" || kind === "cable").at(-1);
  assert.ok(at("3757") < at("0913") && at("0913") < at("0908"));
  assert.ok(at("11273") > 125);
  const single = flyIllustrations["4122"];
  assert.equal(single.dynamic.filter(([kind]) => kind === "cable").length, 1);
  assert.ok(single.frames[0][4][0] < single.frames[0][1][0]);
  assert.ok(single.frames[1][4][0] > single.frames[1][1][0]);

  const orbit = flyIllustrations["3923"];
  const [, , pivotX, pivotY] = orbit.dynamic.find(([kind]) => kind === "line");
  for (const frame of orbit.frames) {
    assert.ok(Math.abs(Math.hypot(frame[4][0] - pivotX, frame[4][1] - pivotY) - 85) < 1e-8);
  }
  assert.equal(flyIllustrations["11284"].dynamic.filter(([kind]) => kind === "kettlebell").length, 1);
  assert.deepEqual(flyIllustrations["11284"].frames[1][13], flyIllustrations["11284"].frames[1][4]);
  assert.deepEqual(flyIllustrations["11284"].frames[3][13], flyIllustrations["11284"].frames[3][6]);
});
