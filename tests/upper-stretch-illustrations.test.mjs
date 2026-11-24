import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { upperStretchIllustrations as demos } from "../features/exercises/upper-stretch-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("thoracic and chest stretches render an exact entry and changed poses", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const ids = new Set(rows.map((row) => row.id));
  for (const [id, demo] of Object.entries(demos)) {
    assert.ok(ids.has(id), id);
    const signatures = new Set();
    for (let frame = 0; frame < demo.frames.length; frame++) {
      const output = [];
      const check = (p) => {
        assert.ok(p.every(Number.isFinite), id);
        output.push(p.join(","));
      };
      paintMotionFrame(demo, frame * demo.ms, (_color, _width, path) => path.forEach(check),
        (_color, _radius, point) => check(point));
      signatures.add(output.join("|"));
    }
    assert.ok(signatures.size >= 2, id);
  }
});

test("thoracic curves and partner contact match the distinct setup", () => {
  const cat = demos["1051"];
  assert.equal(cat.spine.length, 3);
  const spineArc = cat.spine.map((i) => cat.frames[1][i][1]);
  assert.ok(spineArc[1] < spineArc[0] && spineArc[1] < spineArc[2]);
  assert.deepEqual(cat.frames[1][4], cat.frames[0][4]);
  assert.deepEqual(cat.frames[1][7], cat.frames[0][7]);

  const openBook = demos["4601"];
  assert.deepEqual(openBook.frames[0].slice(7), openBook.frames.at(-1).slice(7));
  assert.notDeepEqual(openBook.frames[0][4], openBook.frames.at(-1)[4]);

  const threeLegs = demos["6298"];
  assert.ok(threeLegs.frames.at(-1)[8][1] < threeLegs.frames.at(-1)[7][1]);
  assert.deepEqual(threeLegs.frames[0][10], threeLegs.frames.at(-1)[10]);
  assert.ok(threeLegs.spine.length > 1);

  for (const [id, joint] of [["1790", 4], ["1789", 4], ["1778", 4], ["1779", 3], ["1786", 3], ["1973", 4]]) {
    const demo = demos[id];
    assert.equal(demo.partnerFrames.length, demo.frames.length, id);
    for (let i = 0; i < demo.frames.length; i++) {
      assert.deepEqual(demo.partnerFrames[i][4], demo.frames[i][joint], id);
      assert.deepEqual(demo.partnerFrames[i][6], demo.frames[i][joint + 2], id);
    }
  }
  assert.ok(demos["1790"].frames.at(-1)[4][1] < demos["1790"].frames[0][4][1]);
  assert.ok(demos["1789"].frames.at(-1)[4][1] > demos["1789"].frames[0][4][1]);
});
