
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

const { lowerBodyEquipmentIllustrations: illustrations } = await import("../features/exercises/lower-body-equipment-illustrations.ts");
const catalog = new Set(JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"))
  .rows.map(({ id }) => id));

test("reviewed lower-body equipment illustrations reference catalogue entries and animate within the viewport", () => {
  for (const [id, { frames, reference, dynamic }] of Object.entries(illustrations)) {
    assert.ok(catalog.has(id), id);
    assert.ok(reference, id);
    assert.ok(new Set(frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of frames) {
      assert.equal(frame.length, frames[0].length, id);
      assert.ok(frame.every(([x, y]) => x >= 0 && x <= 320 && y >= 0 && y <= 180), id);
      assert.ok(dynamic.every(([, joint]) => frame[joint]), id);
    }
  }
});

test("the reformer keeps one foot planted while the other moves with the carriage", () => {
  for (const id of ["10850", "10851", "10852"]) {
    const [initial, moving] = illustrations[id].frames;
    assert.deepEqual(moving[8], initial[8], id);
    assert.notEqual(moving[10][0], initial[10][0], id);
    assert.equal(moving[10][0] - initial[10][0], moving[13][0] - initial[13][0], id);
  }
  assert.notDeepEqual(illustrations["10851"].frames[1][9], illustrations["10852"].frames[1][9]);
});

test("lever knee flexion holds the thigh against the pad and tibialis raises keep the heel planted", () => {
  const [extended, flexed] = illustrations["9676"].frames;
  assert.deepEqual(flexed[2], extended[2]);
  assert.deepEqual(flexed[7], extended[7]);
  assert.ok(flexed[8][1] < extended[8][1]);
  assert.ok(flexed[13][1] < extended[13][1]);
  for (const id of ["8536", "9272", "9803", "10859"]) {
    const [resting, raised] = illustrations[id].frames;
    assert.deepEqual(raised[8], resting[8], id);
    assert.ok(raised[11][1] < resting[11][1], id);
  }
});

test("a lever hack squat uses a fixed pivot and the single-leg sled press alternates the unloading leg", () => {
  for (const id of ["5516", "9929"]) {
    assert.ok(illustrations[id].dynamic.some(([kind, joint, x, y]) => kind === "bar" && joint === 11 && x === 214 && y === 54));
  }
  const frames = illustrations["10198"].frames;
  assert.notDeepEqual(frames[2][10], frames[1][10]);
  assert.deepEqual(frames[2][8], frames[1][8]);
  assert.notDeepEqual(frames[8][8], frames[7][8]);
  assert.deepEqual(frames[8][10], frames[7][10]);
});