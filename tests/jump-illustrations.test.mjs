import assert from "node:assert/strict";
import test from "node:test";
import { jumpIllustrations as motions } from "../features/exercises/jump-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("jump variations draw changing finite poses", () => {
  for (const [id, animation] of Object.entries(motions)) {
    const pose = frame => {
      const draws = [];
      paintMotionFrame(animation, animation.ms * frame, (color, width, points) => {
        assert.ok(points.every(point => point.every(Number.isFinite)), id);
        draws.push([color, width, points]);
      }, (color, radius, point) => {
        assert.ok(point.every(Number.isFinite), id);
        draws.push([color, radius, point]);
      });
      return JSON.stringify(draws);
    };
    assert.ok(new Set(animation.frames.map((_, frame) => pose(frame))).size > 1, id);
  }
});

test("jump outlines keep box landings and rope timing aligned with their equipment", () => {
  const standard = motions["3650"];
  const single = motions["5166"];
  assert.equal(standard.frames[2][11][1], standard.props[0][1]);
  assert.equal(single.frames[2][11][1], single.props[0][1]);
  assert.ok(single.frames[2][12][1] < single.frames[2][11][1] - 10);
  assert.ok(motions["4198"].props.length > standard.props.length);
  assert.ok(motions["4166"].dynamic.some(([type]) => type === "trap-bar"));
  assert.ok(motions["10987"].dynamic.some(([type]) => type === "dumbbell"));
  const ropePasses = (id) => motions[id].frames.filter(frame => frame[16][1] > Math.max(frame[11][1], frame[12][1])).length;
  assert.equal(ropePasses("4829"), 1);
  assert.equal(ropePasses("3885"), 2);
});
