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
      assert.ok(frame.length >= 11, id);
      for (const [x, y] of frame) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 180, id);
    }
  }

  const angle = (id) => catalogueIllustrations[id].frames[0][1][1] - catalogueIllustrations[id].frames[0][2][1];
  assert.ok(Math.abs(angle("5013")) <= 10);
  assert.ok(angle("5011") < -30);
  assert.ok(angle("5010") > 10);
  const gripWidth = (id) => {
    const frame = catalogueIllustrations[id].frames[0];
    return Math.abs(frame[4][0] - frame[6][0]);
  };
  assert.ok(gripWidth("1173") > gripWidth("5091"));
  assert.ok(catalogueIllustrations["4836"].dynamic.some(([kind]) => kind === "palm-up"));
  assert.equal(catalogueIllustrations["3681"].dynamic.filter(([kind]) => kind === "palm-up").length, 0);
  assert.notDeepEqual(catalogueIllustrations["2571"].frames, catalogueIllustrations["3663"].frames);

  const floorCurl = catalogueIllustrations["0181"];
  assert.equal(floorCurl.frames[0][1][1], 149);
  assert.deepEqual(floorCurl.frames[0][3], floorCurl.frames[1][3]);
  assert.deepEqual(floorCurl.dynamic, [["cable", 4, 246, 145], ["cable", 6, 246, 145], ["bar", 4, 6]]);

  const singleCalf = catalogueIllustrations["1178"];
  assert.equal(singleCalf.dynamic.filter(([kind]) => kind === "foot").length, 1);
  assert.equal(singleCalf.dynamic.filter(([kind]) => kind === "dumbbell").length, 1);
  assert.ok(singleCalf.frames[0][8][1] > singleCalf.frames[1][8][1]);

  const alternatingBug = catalogueIllustrations["1243"].frames;
  assert.deepEqual(alternatingBug[0][4], alternatingBug[1][4]);
  assert.notDeepEqual(alternatingBug[0][6], alternatingBug[1][6]);
  assert.notDeepEqual(alternatingBug[0][8], alternatingBug[1][8]);
  assert.deepEqual(alternatingBug[0][10], alternatingBug[1][10]);
  assert.deepEqual(alternatingBug[0][6], alternatingBug[3][6]);
  assert.notDeepEqual(alternatingBug[0][4], alternatingBug[3][4]);
  assert.notDeepEqual(alternatingBug[0][10], alternatingBug[3][10]);

  const smithThrust = catalogueIllustrations["3110"];
  const floorBridge = catalogueIllustrations["2471"];
  assert.ok(smithThrust.props.length > 5);
  assert.equal(floorBridge.props.length, 0);
  assert.ok(smithThrust.frames[0][1][1] < floorBridge.frames[0][1][1]);
});

