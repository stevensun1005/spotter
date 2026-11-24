import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mobilityReleaseIllustrations as demos } from "../features/exercises/mobility-release-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
const catalogue = new Map(rows.map((row) => [row.id, row]));

test("release demonstrations use the exact catalogue medium and animate bounded poses", () => {
  const entries = Object.entries(demos);
  assert.ok(entries.length >= 70);
  for (const [id, motion] of entries) {
    const row = catalogue.get(id);
    assert.ok(row, id);
    assert.ok(motion.reference, id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    const width = motion.frames[0].length;
    for (const frame of motion.frames) {
      assert.equal(frame.length, width, id);
      for (const [x, y] of frame) assert.ok(x > 0 && x < 320 && y > 0 && y < 180, id);
    }
    const kinds = new Set(motion.dynamic.map(([kind]) => kind));
    if (row.equipment === "massage ball") assert.ok(kinds.has("massage-ball"), id);
    if (row.equipment === "roller" && !row.en.startsWith("tiger tail")) {
      assert.ok(kinds.has("foam-roller") || kinds.has("foam-lengthwise"), id);
    }
  }
});

test("the roller and massage ball stay against their support surfaces", () => {
  const [early, , late] = demos["5373"].frames;
  assert.equal(early[13][0], late[13][0]);
  assert.ok(late[13][1] < early[13][1]);
  assert.ok(demos["5373"].props.some(([x1, , x2]) => x1 === x2 && x1 - early[13][0] === 19));
  assert.ok(demos["4483"].frames[0][13][1] > demos["4484"].frames[0][13][1]);
  const contact = [];
  paintMotionFrame(demos["4465"], 0, () => {}, (_color, radius, center) => {
    if (radius === 6) contact.push(center);
  });
  assert.ok(contact.some(([x,y]) => x > demos["4465"].frames[0][7][0] && y + 6 === 159));
});

test("thoracic extension anchors the foam while rolling moves the contact zone", () => {
  const [initial, , extension] = demos["11572"].frames;
  assert.deepEqual(initial[13], extension[13]);
  assert.deepEqual(initial[2], extension[2]);
  assert.ok(extension[0][1] > initial[0][1]);
  assert.notDeepEqual(demos["3566"].frames[0][13], demos["3566"].frames[2][13]);
  assert.ok(demos["5376"].dynamic.some(([kind]) => kind === "foam-lengthwise"));
  assert.ok(demos["4221"].dynamic.some(([kind, endpoint, other]) => kind === "bar" && endpoint === 13 && other === 14));
});
