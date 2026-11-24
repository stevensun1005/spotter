import assert from "node:assert/strict";
import test from "node:test";
import { coreIllustrations as motions } from "../features/exercises/core-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("core illustrations render finite, changing poses", () => {
  for (const [id, motion] of Object.entries(motions)) {
    const renderPose = (frame) => {
      const representation = [];
      paintMotionFrame(motion, frame * motion.ms, (color, width, path) => {
        assert.ok(path.every(point => point.every(Number.isFinite)), id);
        representation.push([color, width, ...path]);
      }, (color, radius, position) => {
        assert.ok(position.every(Number.isFinite), id);
        representation.push([color, radius, ...position]);
      });
      return JSON.stringify(representation);
    };
    assert.ok(motion.frames.every(frame => frame.length === motion.frames[0].length), id);
    assert.ok(new Set(motion.frames.map((_, frame) => renderPose(frame))).size > 1, id);
  }
});

test("core variations keep the supporting body part and prescribed equipment", () => {
  const upper = motions["4727"];
  const reverse = motions["0482"];
  assert.deepEqual(upper.frames[0][2], upper.frames[1][2]);
  assert.deepEqual(reverse.frames[0][1], reverse.frames[1][1]);
  assert.ok(reverse.frames[1][2][1] < reverse.frames[0][2][1]);
  assert.notDeepEqual(motions["3279"].props, motions["3389"].props);
  assert.notDeepEqual(motions["1190"].props, motions["2523"].props);
  assert.ok(motions["0269"].dynamic.some(([kind]) => kind === "stability-ball"));
  assert.ok(motions["6693"].dynamic.some(([kind]) => kind === "cable"));
  assert.ok(motions["1020"].dynamic.some(([kind]) => kind === "band"));
  assert.ok(motions["5308"].dynamic.some(([kind]) => kind === "ez-bar"));
});
