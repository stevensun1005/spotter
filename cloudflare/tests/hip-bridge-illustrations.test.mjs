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

const { hipBridgeIllustrations: illustrations } = await import("../features/exercises/hip-bridge-illustrations.ts");
const catalog = new Map(JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"))
  .rows.map((row) => [row.id, row]));

test("reviewed hip and bridge variants have valid targeted, animating poses", () => {
  const entries = Object.entries(illustrations);
  assert.ok(entries.length >= 80);
  for (const [id, motion] of entries) {
    assert.ok(catalog.has(id), id);
    assert.ok(motion.reference, id);
    const path = new URL("../public/open-gym/details/" + Math.floor(Number(id) / 100) + ".json", import.meta.url);
    const detail = JSON.parse(readFileSync(path, "utf8"))[id];
    assert.ok(detail.steps.length, id);
    assert.ok(new Set(motion.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    const width = motion.frames[0].length;
    for (const frame of motion.frames) {
      assert.equal(frame.length, width, id);
      for (const [x, y] of frame) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 180, id);
    }
  }
});

test("bridge equipment follows the support level of the shoulders or feet and preserves unilateral stances", () => {
  const [mat, feet, shoulders] = ["0145", "10549", "5774"].map((id) => illustrations[id]);
  assert.equal(mat.frames[0][1][1], feet.frames[0][1][1]);
  assert.ok(shoulders.frames[0][1][1] < mat.frames[0][1][1]);
  assert.ok(feet.frames[0][8][1] < mat.frames[0][8][1]);
  assert.ok(illustrations["1078"].dynamic.some(([kind, index]) => kind === "ring" && index === 8));
  assert.ok(illustrations["7384"].dynamic.some(([kind]) => kind === "barbell-end"));
  assert.notEqual(illustrations["11054"].frames[1][10][0], illustrations["7384"].frames[1][10][0]);
});

test("cable kickbacks distinguish ankle, toe and lateral or rear movement", () => {
  const [inside] = illustrations["2756"].frames;
  const [outside] = illustrations["2755"].frames;
  assert.ok(inside[11][0] < inside[8][0]);
  assert.ok(outside[11][0] > outside[8][0]);
  const [low, high] = illustrations["6739"].frames;
  assert.deepEqual(low[10], high[10]);
  assert.ok(high[7][1] < low[7][1]);
  assert.ok(high[8][1] > high[7][1]);
  for (const frame of illustrations["6038"].frames) {
    assert.equal(frame[13][1], frame[14][1]);
    assert.ok(frame[13][1] < frame[8][1]);
  }
  for (const frame of illustrations["3874"].frames) assert.equal(frame[13][1], frame[14][1]);
});

test("side bridge rotation keeps the legs stacked and the bridge jack opens both feet", () => {
  const frames = illustrations["0820"].frames;
  for (const frame of frames) assert.deepEqual(frame.slice(7, 11), frames[0].slice(7, 11));
  const [close, air, wide] = illustrations["10057"].frames;
  assert.ok(air[8][1] < close[8][1]);
  assert.ok(wide[8][0] > close[8][0]);
  assert.ok(wide[10][0] < close[10][0]);
});
