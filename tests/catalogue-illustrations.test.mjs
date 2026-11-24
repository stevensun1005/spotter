import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { catalogueIllustrations } from "../features/exercises/catalogue-illustrations.ts";

test("original exercise illustrations are playable and scoped to exact catalogue IDs", async () => {
  const index = JSON.parse(await readFile(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const rows = new Set(index.rows.map((row) => row.id));
  for (const [id, motion] of Object.entries(catalogueIllustrations)) {
    assert.ok(rows.has(id), id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of motion.frames) {
      assert.equal(frame.length, 11, id);
      for (const [x, y] of frame) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 180, id);
    }
  }

  const angle = (id) => catalogueIllustrations[id].frames[0][1][1] - catalogueIllustrations[id].frames[0][2][1];
  assert.ok(Math.abs(angle("5013")) <= 10);
  assert.ok(angle("5011") < -30);
  assert.ok(angle("5010") > 10);
  const triceps = catalogueIllustrations["0176"].frames;
  assert.deepEqual(triceps[0][3], triceps[1][3]);
  assert.notDeepEqual(triceps[0][4], triceps[1][4]);
  assert.notDeepEqual(catalogueIllustrations["2571"].frames, catalogueIllustrations["3663"].frames);
});

