import assert from "node:assert/strict";
import test from "node:test";
import { legRaiseIllustrations as motions } from "../features/exercises/leg-raise-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("leg raise illustrations draw distinct, finite poses", () => {
  for (const [id, animation] of Object.entries(motions)) {
    const pose = frame => {
      const shapes = [];
      paintMotionFrame(animation, animation.ms * frame, (color, width, points) => {
        assert.ok(points.every(point => point.every(Number.isFinite)), id);
        shapes.push([color, width, points]);
      }, (color, radius, point) => {
        assert.ok(point.every(Number.isFinite), id);
        shapes.push([color, radius, point]);
      });
      return JSON.stringify(shapes);
    };
    assert.ok(new Set(animation.frames.map((_, frame) => pose(frame))).size > 1, id);
  }
});

test("leg raise equipment signatures and supporting joints preserve the variants", () => {
  assert.notDeepEqual(motions["5107"].props, motions["0826"].props);
  assert.notDeepEqual(motions["0826"].props, motions["11878"].props);
  assert.notDeepEqual(motions["4768"].props, motions["6548"].props);
  assert.ok(motions["2887"].dynamic.some(([type]) => type === "cable"));
  assert.ok(motions["5031"].dynamic.some(([type]) => type === "ball"));
  assert.equal(motions["11091"].frames[0][4][1], motions["3891"].frames[0][4][1]);
  assert.ok(motions["11091"].frames[0][6][1] > motions["3891"].frames[0][6][1]);
  assert.deepEqual(motions["0619"].frames[0][10], motions["0619"].frames[1][10]);
  assert.ok(motions["3891"].frames[2][11][1] <= motions["3891"].props[0][1]);
});
