import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { armIllustrations } from "../features/exercises/arm-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("curl frames reference real catalogue rows and paint a valid first frame", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, demo] of Object.entries(armIllustrations)) {
    assert.match(byId.get(id)?.en ?? "", /curl|biceps (?:hold|clutch)/i);
    assert.ok(new Set(demo.frames.map((frame) => JSON.stringify(frame))).size >= 2, id);
    const valid = (point) => assert.ok(point.every(Number.isFinite), id);
    paintMotionFrame(demo, 0, (_color, _width, path) => path.forEach(valid),
      (_color, _radius, center) => valid(center));
  }
});

test("curl variants preserve the verified cable anchor, stance and joint path", () => {
  const lowAnchor = (id) => armIllustrations[id].dynamic.find(([type]) => type === "cable").slice(2);
  assert.ok(lowAnchor("0183")[0] < armIllustrations["0183"].frames[0][0][0]);
  assert.ok(lowAnchor("4350")[0] > armIllustrations["4350"].frames[0][8][0]);
  assert.ok(lowAnchor("11763")[0] < armIllustrations["11763"].frames[0][2][0]);
  assert.ok(lowAnchor("6266")[1] < armIllustrations["6266"].frames[0][3][1]);

  const standing = armIllustrations["5669"].frames;
  assert.deepEqual(standing[0][3], standing[2][3]);
  const drag = armIllustrations["2413"].frames;
  assert.ok(drag[2][3][0] < drag[0][3][0]);
  const smith = armIllustrations["4546"].frames;
  assert.equal(new Set(smith.map((frame) => frame[15][0])).size, 1);
  assert.equal(new Set(smith.map((frame) => frame[16][0])).size, 1);
  assert.ok(smith[2][15][1] < smith[0][15][1]);

  const alternating = armIllustrations["6147"].frames;
  assert.deepEqual(alternating[2][6], alternating[0][6]);
  assert.deepEqual(alternating[6][4], alternating[0][4]);
  assert.notDeepEqual(alternating[2][4], alternating[0][4]);
  assert.notDeepEqual(alternating[6][6], alternating[0][6]);
  assert.equal(armIllustrations["6265"].dynamic[0][0], "palm-down");

  assert.ok(armIllustrations["3988"].props.some(([x1, y1, x2, y2]) => x1 !== x2 && y1 !== y2));
  assert.ok(armIllustrations["1681"].dynamic.some(([kind]) => kind === "stability-ball"));
  const hold = armIllustrations["11864"].frames;
  assert.deepEqual(hold[1], hold[4]);
  assert.notDeepEqual(hold[4], hold[5]);
});
