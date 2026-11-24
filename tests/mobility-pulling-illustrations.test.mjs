import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { mobilityIllustrations as mobility } from "../features/exercises/mobility-illustrations.ts";
import { pullingIllustrations as pulling } from "../features/exercises/pulling-illustrations.ts";
import { lungeIllustrations as lunges } from "../features/exercises/lunge-illustrations.ts";

test("new mobility, pulling and lunge demos are mapped to exact catalogue rows and preserve equipment", async () => {
  const { rows } = JSON.parse(await readFile(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const entries = new Set(rows.map((row) => row.id));
  for (const [id, motion] of Object.entries({ ...mobility, ...pulling, ...lunges })) {
    assert.ok(entries.has(id), id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size >= 2, id);
    for (const frame of motion.frames) {
      assert.ok(frame.length >= 11, id);
      assert.equal(frame.length, motion.frames[0].length, id);
      for (const [x, y] of frame) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 180, id + ": " + [x, y]);
    }
  }
  assert.ok(pulling["5522"].dynamic.some(([kind]) => kind === "ring"));
  assert.ok(pulling["0841"].dynamic.some(([kind]) => kind === "plate"));
  assert.ok(pulling["4206"].dynamic.some(([kind, joint]) => kind === "band" && joint === 7));
  assert.ok(pulling["2997"].dynamic.some(([kind, joint]) => kind === "band" && joint === 8));
  assert.notDeepEqual(pulling["4948"].frames, pulling["1204"].frames);
  assert.ok(mobility["11903"].props[0][0] === mobility["11903"].props[0][2]);
  assert.equal(mobility["11904"].frames.at(-1)[9][1], 153);
  assert.ok(mobility["1250"].dynamic.some(([kind]) => kind === "plate"));
  assert.ok(lunges["7326"].props.length > lunges["1581"].props.length);
  assert.notDeepEqual(lunges["7581"].dynamic, lunges["7582"].dynamic);
  assert.equal(new Set(lunges["5825"].frames.map((frame) => frame[4][0])).size, 1);
});
