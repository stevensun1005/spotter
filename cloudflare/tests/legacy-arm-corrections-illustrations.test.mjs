import test from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const url = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });

const { legacyArmCorrectionIllustrations: illustrations } = await import("../features/exercises/legacy-arm-corrections-illustrations.ts");

test("reviewed legacy arm corrections render a stable cover and more than one pose", () => {
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url)));
  const ids = new Set(rows.map(({ id }) => id));
  assert.equal(Object.keys(illustrations).length, 27);
  for (const [id, motion] of Object.entries(illustrations)) {
    assert.ok(ids.has(id));
    const poses = new Set();
    for (let index = 0; index < motion.frames.length; index++) {
      const points = [];
      const record = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(motion, index * motion.ms, (_color, _width, path) => path.forEach(record),
        (_color, _radius, center) => record(center));
      poses.add(points.join("|"));
    }
    assert.ok(poses.size > 1, id);
  }
});

test("legacy variants genuinely alternate, and Zottman lowering changes palm orientation", () => {
  for (const id of ["0285", "2403", "1676", "0387", "0414", "0415"]) {
    const { frames } = illustrations[id];
    const [down] = frames;
    assert.ok(frames.some((frame) => frame[4][1] < down[4][1] && frame[6][1] === down[6][1]), id);
    assert.ok(frames.some((frame) => frame[6][1] < down[6][1] && frame[4][1] === down[4][1]), id);
  }
  for (const id of ["0439", "2293", "2294", "1672"]) {
    const { frames } = illustrations[id];
    assert.deepEqual(frames[2].slice(0, 11), frames[3].slice(0, 11));
    assert.deepEqual(frames[1].slice(0, 11), frames[4].slice(0, 11));
    assert.notDeepEqual(frames[1][15], frames[4][15]);
  }
});

test("wrist curls hold the forearm still and 3122 presses overhead while seated", () => {
  for (const id of ["1016", "1411", "1412", "0079", "0126", "0125", "0247", "0397", "0366"]) {
    const [start, high] = illustrations[id].frames;
    assert.deepEqual(start.slice(0, 11), high.slice(0, 11));
    assert.ok(start[11][1] > high[11][1]);
  }
  const [start, high] = illustrations["3122"].frames;
  assert.ok(start[4][1] > start[0][1]);
  assert.ok(high[4][1] < high[0][1]);
  assert.deepEqual(start.slice(7, 11), high.slice(7, 11));
  assert.equal(illustrations["3122"].dynamic.filter(([kind]) => kind === "band").length, 2);
});
