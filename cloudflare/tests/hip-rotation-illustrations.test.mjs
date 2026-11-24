
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

const { hipRotationIllustrations: illustrations } = await import("../features/exercises/hip-rotation-illustrations.ts");
const { fromCatalogue } = await import("../features/exercises/open-gym.ts");
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("0982 keeps its historic name as an alias to the corrected side-lying card and demonstration", () => {
  const catalogue = json("../public/open-gym/index.json");
  assert.equal(fromCatalogue(catalogue, { name: "弹力带仰卧髋外旋" }).id, "0982");
  assert.equal(fromCatalogue(catalogue, { name: "弹力带侧卧髋外旋" }).id, "0982");
  const row = catalogue.rows.find(({ id }) => id === "0982");
  assert.equal(row.name, "弹力带侧卧髋外旋");
  const details = json("../public/open-gym/details/9.json")["0982"];
  const reviewed = json("../features/exercises/reviewed-corrections-details.json")["0982"];
  assert.equal(reviewed.name, row.name);
  assert.deepEqual(reviewed.steps, details.steps);
  assert.ok(details.steps[0].startsWith("侧卧"));
  assert.equal(illustrations["0982"], illustrations["2150"]);
});

test("clam variations raise the upper knee while the pelvis and both heels remain stacked", () => {
  for (const id of ["0982", "2150", "2461"]) {
    const [ready, , open] = illustrations[id].frames;
    assert.ok(open[7][1] < ready[7][1], id);
    for (const point of [2, 8, 9, 10]) assert.deepEqual(open[point], ready[point], id);
    assert.deepEqual(open[8], open[10], id);
  }
  assert.ok(illustrations["2150"].dynamic.some(([kind]) => kind === "knee-band"));
  assert.ok(illustrations["2461"].dynamic.every(([kind]) => kind !== "knee-band"));
});

test("seated rotation swings the shin without moving the knee; resistance band version instead opens the knees", () => {
  for (const id of ["2771", "2772", "6749", "6787", "6788"]) {
    const entry = illustrations[id];
    for (const frame of entry.frames) assert.deepEqual(frame[7], entry.frames[0][7], id);
  }
  assert.ok(illustrations["2771"].frames[2][8][0] < illustrations["2771"].frames[0][8][0]);
  assert.ok(illustrations["2772"].frames[2][8][0] > illustrations["2772"].frames[0][8][0]);
  const [ready, , open] = illustrations["0995"].frames;
  assert.ok(open[7][0] > ready[7][0] && open[9][0] < ready[9][0]);
  assert.deepEqual(open[8], ready[8]);
  assert.deepEqual(open[10], ready[10]);
});

test("lying internal rotation moves against the side anchor and supported twists keep both hands planted", () => {
  const supine = illustrations["3023"];
  assert.ok(supine.topView);
  const [, , ax, ay] = supine.dynamic.find(([kind]) => kind === "band");
  const [start, , end] = supine.frames;
  assert.deepEqual(end[7], start[7]);
  assert.deepEqual(end[10], start[10]);
  assert.ok(Math.hypot(end[13][0] - ax, end[13][1] - ay) > Math.hypot(start[13][0] - ax, start[13][1] - ay));
  const arc = illustrations["2845"].frames;
  for (const frame of arc) {
    assert.deepEqual(frame[4], arc[0][4]);
    assert.deepEqual(frame[6], arc[0][6]);
    assert.ok(frame[8][1] < frame[4][1]);
  }
});