import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { gripIllustrations as illustrations } from "../features/exercises/grip-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("verified hand and forearm entries animate and paint their visible first frame", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const byId = new Map(rows.map(({ id, en }) => [id, en]));
  assert.equal(Object.keys(illustrations).length, 22);
  for (const [id, motion] of Object.entries(illustrations)) {
    assert.match(byId.get(id) ?? "", /finger|hand|wrist|pinch|forearm|supination|pronator/i);
    const frames = new Set();
    for (let i = 0; i < motion.frames.length; i++) {
      const points = [];
      const record = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(motion, i * motion.ms, (_color, _width, path) => path.forEach(record),
        (_color, _radius, center) => record(center));
      frames.add(points.join("|"));
    }
    assert.ok(frames.size > 1, id);
  }
});

test("rollers keep forearms still, fingers extend independently, and equipment stays attached", () => {
  for (const id of ["0859", "8882"]) {
    const motion = illustrations[id];
    const allHeights = motion.frames.map((frame) => frame[16][1]);
    assert.ok(allHeights[0] - Math.min(...allHeights) > 50);
    for (const frame of motion.frames) assert.deepEqual(frame.slice(3, 7), motion.frames[0].slice(3, 7));
  }
  assert.ok(illustrations["6269"].dynamic.some(([kind]) => kind === "cable"));
  assert.ok(illustrations["1610"].dynamic.some(([kind]) => kind === "barbell-end"));
  assert.ok(illustrations["1611"].dynamic.some(([kind]) => kind === "dumbbell"));
  const open = illustrations["11783"].frames[1], closed = illustrations["11783"].frames[0];
  assert.ok(Math.abs(open[19][0] - open[27][0]) - Math.abs(closed[19][0] - closed[27][0]) >= 30);
  assert.ok(illustrations["8877"].dynamic.filter(([kind]) => kind === "band").length >= 5);
  assert.ok(illustrations["3833"].dynamic.filter(([kind]) => kind === "digit").length >= 10);
  assert.ok(illustrations["11794"].props.length > illustrations["11791"].props.length);
});
