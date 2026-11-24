import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { verticalPullIllustrations as illustrations } from "../features/exercises/vertical-pull-illustrations.ts";
import { pullingIllustrations as cataloguePulls } from "../features/exercises/pulling-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("reviewed vertical pulls paint a cover and distinct exercise phases", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(Object.keys(illustrations).length, 69);
  for (const [id, demo] of Object.entries(illustrations)) {
    assert.match(byId.get(id)?.en ?? "", /chin|pull|hang|muscle up/i);
    const signatures = new Set();
    for (let phase = 0; phase < demo.frames.length; phase++) {
      const points = [];
      const record = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(demo, phase * demo.ms, (_color, _width, path) => path.forEach(record),
        (_color, _radius, center) => record(center));
      signatures.add(points.join("|"));
    }
    assert.ok(signatures.size >= 2, id);
  }
});

test("vertical pull variants preserve equipment, body support and one-arm mechanics", () => {
  const hasAttachment = (id, kind, joint) => illustrations[id].dynamic.some(([type, index]) =>
    type === kind && (joint === undefined || index === joint));

  assert.ok(hasAttachment("1088", "pad", 4));
  assert.ok(hasAttachment("7512", "ring", 4));
  assert.ok(!hasAttachment("1088", "ring"));
  assert.ok(hasAttachment("1222", "bar", 14));
  assert.ok(hasAttachment("10660", "band", 8));
  assert.ok(hasAttachment("0970", "band", 8));
  assert.ok(hasAttachment("10903", "band", 7));
  assert.ok(hasAttachment("3290", "dumbbell", 6));
  assert.ok(hasAttachment("2986", "plate", 13));
  assert.ok(hasAttachment("9304", "pad", 7));
  assert.ok(!hasAttachment("5844", "pad", 7));

  const negative = illustrations["7385"].frames;
  assert.ok(negative[0][0][1] + 9 < negative[0][4][1]);
  assert.deepEqual(negative.map((frame) => frame[0][1]), negative.map((frame) => frame[0][1]).sort((a, b) => a - b));
  assert.ok(negative.every((frame) => frame[4][1] === negative[0][4][1]));

  const oneArm = illustrations["7512"].frames;
  for (const [frame, elbow, wrist] of [[oneArm[2], 5, 6], [oneArm[5], 3, 4]]) {
    assert.ok(Math.abs(frame[1][1] - frame[elbow][1]) <= 4);
    assert.ok(Math.abs(frame[1][0] - frame[wrist][0]) > 55);
  }
  const assisted = illustrations["9510"];
  assert.equal(assisted.partnerFrames.length, assisted.frames.length);
  assert.ok(assisted.partnerFrames.every((frame, index) =>
    Math.abs(frame[4][1] - assisted.frames[index][2][1]) < 1));

  const straight = illustrations["5844"].frames;
  assert.ok(straight.every((frame) => Math.abs(frame[3][1] - (frame[1][1] + frame[4][1]) / 2) < 1));
  assert.notDeepEqual(illustrations["1127"].frames, illustrations["1088"].frames);
  assert.notDeepEqual(illustrations["3487"].frames, illustrations["3550"].frames);
});

test("catalogue chin-up attachments connect locally to the bar or weight belt", () => {
  const legAnchor = (id) => cataloguePulls[id].dynamic.find(([kind]) => kind === "band");
  assert.deepEqual(legAnchor("4718").slice(1), [8, 150, 33]);
  assert.deepEqual(legAnchor("4206").slice(1), [7, 150, 33]);
  for (const id of ["0841", "4102", "4181"]) {
    const clip = cataloguePulls[id];
    assert.ok(clip.dynamic.some(([kind, from, to]) => kind === "line" && from === 2 && to === 13));
    for (const frame of clip.frames) {
      assert.equal(frame[13][0], frame[2][0]);
      assert.ok(frame[13][1] > frame[2][1]);
    }
  }
  const supported = (id) => cataloguePulls[id].frames.map((frame) => frame[10][1]);
  assert.ok(supported("9511").every((y) => y === 138));
  assert.equal(new Set(supported("9512")).size, 2);
});
