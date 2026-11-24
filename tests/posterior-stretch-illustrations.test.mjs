import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return next(source.href, context);
    }
    return next(specifier, context);
  },
});

const { posteriorStretchIllustrations: demos } = await import("../features/exercises/posterior-stretch-illustrations.ts");
const rows = new Map(JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"))
  .rows.map((row) => [row.id, row]));

test("posterior stretches animate valid reviewed poses for known instructions", () => {
  const details = new Map();
  assert.ok(Object.keys(demos).length >= 75);
  for (const [id, motion] of Object.entries(demos)) {
    assert.ok(rows.has(id), id);
    assert.equal(motion.reference, true, id);
    const shard = Math.floor(Number(id) / 100);
    if (!details.has(shard)) {
      const json = new URL("../public/open-gym/details/" + shard + ".json", import.meta.url);
      details.set(shard, JSON.parse(readFileSync(json, "utf8")));
    }
    assert.ok(details.get(shard)[id]?.steps.length, id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of motion.frames) {
      assert.equal(frame.length, motion.frames[0].length, id);
      for (const [x, y] of frame) assert.ok(x > 0 && x < 320 && y > 0 && y < 180, id);
    }
  }
});

test("hamstring stretches keep raised support, towels and toe directions distinct", () => {
  const [wallStart, wallPeak] = demos["7622"].frames;
  assert.equal(wallStart[8][0], wallPeak[8][0]);
  assert.ok(demos["7622"].props.some(([x1, y1, x2, y2]) => x1 === x2 && y2 - y1 > 100 && Math.abs(x1 - wallStart[8][0]) < 10));
  assert.ok(demos["1922"].dynamic.some(([kind, , attachment]) => kind === "bar" && attachment === 11));
  assert.ok(demos["10744"].dynamic.some(([kind, , attachment]) => kind === "band" && attachment === 11));
  assert.ok(demos["1912"].frames[1][8][1] < demos["1911"].frames[1][8][1]);
  assert.ok(demos["3468"].frames[1][11][1] < demos["3468"].frames[1][8][1]);
  assert.ok(demos["1908"].frames[1][11][1] > demos["1908"].frames[1][8][1]);
});

test("lunge flows and twists show foot placement and corresponding sides", () => {
  const [leftStart, leftEnd] = demos["3478"].frames;
  const [rightStart, rightEnd] = demos["3477"].frames;
  assert.deepEqual(leftStart[1], leftEnd[1]);
  assert.deepEqual(rightStart[1], rightEnd[1]);
  assert.ok(leftEnd[7][1] < leftStart[7][1]);
  assert.ok(rightEnd[7][1] > rightStart[7][1]);
  const [neutral, extension, reach] = demos["1604"].frames;
  assert.equal(extension[11][1], extension[8][1]);
  assert.ok(reach[4][1] < reach[1][1]);
  assert.ok(extension[7][0] < neutral[7][0]);
  const [couch] = demos["4557"].frames;
  assert.ok(couch[10][1] < couch[9][1]);
  assert.ok(demos["1561"].dynamic.some(([kind]) => kind === "stability-ball"));
});
