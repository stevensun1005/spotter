import test from "node:test";
import { strict as assert } from "node:assert";
import { suspensionAttachmentIllustrations as demos } from "../features/exercises/suspension-attachment-illustrations.ts";

const separation = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const activeStraps = (demo) => demo.dynamic.filter(([kind]) => kind === "line");

test("suspension straps stay taut and heels stay planted in all key poses", () => {
  for (const [id, demo] of Object.entries(demos)) {
    const [start] = demo.frames;
    for (const [, index, x, y] of activeStraps(demo)) {
      const anchor = [x, y];
      const length = separation(start[index], anchor);
      for (const pose of demo.frames) {
        assert.ok(Math.abs(separation(pose[index], anchor) - length) < 0.001, id);
        assert.deepEqual(pose[8], start[8], id);
        assert.deepEqual(pose[10], start[10], id);
      }
    }
  }
});

test("suspension versions preserve attachments, grip and starting height", () => {
  assert.equal(activeStraps(demos["6237"]).length, 1);
  assert.equal(activeStraps(demos["1123"]).length, 1);
  assert.equal(activeStraps(demos["6232"]).length, 2);
  assert.ok(demos["4923"].dynamic.some(([kind]) => kind === "ring"));
  assert.ok(demos["1090"].dynamic.some(([kind]) => kind === "pad"));
  assert.ok(demos["5007"].dynamic.some(([kind]) => kind === "thumb-up"));
  assert.ok(demos["5006"].dynamic.some(([kind]) => kind === "palm-up"));
  assert.ok(demos["4450"].dynamic.some(([kind]) => kind === "palm-down"));
  assert.ok(demos["4451"].frames[0][1][1] > demos["4450"].frames[0][1][1] + 25);
  assert.ok(separation(demos["4450"].frames[4][4], demos["4450"].frames[4][6]) >
    separation(demos["5006"].frames[4][4], demos["5006"].frames[4][6]) + 15);
});
