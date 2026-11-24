import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { rowingIllustrations } from "../features/exercises/rowing-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("authored rows paint valid covers and animated key poses for catalogue IDs", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, demo] of Object.entries(rowingIllustrations)) {
    assert.match(byId.get(id)?.en ?? "", /\brows?\b/i);
    const frameSignatures = new Set();
    for (let phase = 0; phase < demo.frames.length; phase++) {
      const paths = [];
      const take = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        paths.push(point.join(","));
      };
      paintMotionFrame(demo, phase * demo.ms, (_color, _width, path) => path.forEach(take),
        (_color, _radius, center) => take(center));
      frameSignatures.add(paths.join("|"));
    }
    assert.ok(frameSignatures.size >= 2, id);
  }
});

test("rowing variants retain support, pulleys, grip, and direct single-arm paths", () => {
  const lowCable = rowingIllustrations["0163"], highCable = rowingIllustrations["7597"];
  const pulleyY = (motion) => motion.dynamic.find(([kind]) => kind === "cable").at(-1);
  assert.ok(pulleyY(lowCable) > 125);
  assert.ok(pulleyY(highCable) < 45);
  assert.ok(lowCable.props.some(([x1, y1, x2, y2]) => x1 > 180 && x2 > 180 && y1 > 130 && y2 < 150 && y1 !== y2));
  assert.ok(highCable.props.some(([x1, y1, x2, y2]) => x1 > 130 && x2 > 130 && y1 < 85 && y2 < 105 && y1 !== y2));

  assert.deepEqual(rowingIllustrations["4225"].frames[0][2], rowingIllustrations["4225"].frames[1][2]);
  assert.ok(rowingIllustrations["4225"].dynamic.some(([item]) => item === "bar"));
  assert.ok(rowingIllustrations["9492"].dynamic.some(([item]) => item === "ez-bar"));

  const narrow = rowingIllustrations["4425"].frames[0];
  const wide = rowingIllustrations["4426"].frames[0];
  assert.ok(Math.abs(wide[4][0] - wide[6][0]) > Math.abs(narrow[4][0] - narrow[6][0]));
  assert.ok(narrow[4][1] > narrow[1][1]); // Prone on the bench, dumbbells hang below.
  assert.ok(rowingIllustrations["4423"].frames[0][4][1] < rowingIllustrations["4423"].frames[0][1][1]); // Inverted.

  const smith = rowingIllustrations["11762"].frames;
  assert.equal(smith[0][16][0], smith[1][16][0]);
  assert.equal(smith[0][17][0], smith[1][17][0]);
  assert.equal(smith[0][4][0], smith[1][4][0]);

  const alternates = rowingIllustrations["2980"].frames;
  assert.deepEqual(alternates[0][2], alternates[1][2]);
  assert.deepEqual(alternates[0][6], alternates[1][6]);
  assert.deepEqual(alternates[0][4], alternates[3][4]);
  assert.notDeepEqual(alternates[0][6], alternates[3][6]);
});
