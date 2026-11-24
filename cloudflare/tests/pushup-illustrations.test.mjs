import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { pushupIllustrations } from "../features/exercises/pushup-illustrations.ts";

test("push-up animations cover exact catalogue entries and keep support and movement distinct", async () => {
  const index = JSON.parse(await readFile(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const pushups = new Set(index.rows.filter((row) => /push ups?/.test(row.en)).map((row) => row.id));
  for (const [id, illustration] of Object.entries(pushupIllustrations)) {
    assert.ok(pushups.has(id), id);
    assert.ok(new Set(illustration.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of illustration.frames) {
      assert.equal(frame.length, 11, id);
      assert.ok(frame.every(([x, y]) => x >= 0 && x <= 320 && y >= 0 && y <= 180), id);
    }
  }

  const motion = (id) => pushupIllustrations[id];
  const elevatedHands = motion("5637").frames[0];
  const elevatedFeet = motion("5866").frames[0];
  assert.ok(elevatedHands[4][1] < elevatedHands[8][1]);
  assert.ok(elevatedFeet[4][1] > elevatedFeet[8][1]);
  assert.ok(motion("0278").dynamic.some(([kind, joint]) => kind === "stability-ball" && joint === 8));
  assert.ok(motion("0657").dynamic.some(([kind, joint]) => kind === "stability-ball" && joint === 6));
  assert.ok(motion("3580").dynamic.every(([kind]) => kind === "kettlebell"));
  assert.ok(motion("3993").dynamic.every(([kind]) => kind === "dumbbell"));
  assert.equal(motion("10882").frames.every((frame) => frame[7][1] === 154), true);
  assert.ok(motion("5460").frames[2][4][1] < motion("5460").frames[0][4][1]);
  assert.deepEqual(motion("9325").frames[1], motion("9325").frames.at(-1));
  assert.notDeepEqual(motion("5187").frames.at(-1), motion("3457").frames.at(-1));
});
