import assert from "node:assert/strict";
import test from "node:test";
import { agilityIllustrations as motions } from "../features/exercises/agility-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("agility variants draw changing finite poses and complete fixture points", () => {
  for (const [id, animation] of Object.entries(motions)) {
    const states = animation.frames.map((frame, index) => {
      assert.equal(frame.length, animation.frames[0].length, id);
      const draws = [];
      paintMotionFrame(animation, animation.ms * index, (color, width, points) => {
        assert.ok(points.every(point => point.every(Number.isFinite)), id);
        draws.push([color, width, points]);
      }, (color, radius, point) => {
        assert.ok(point.every(Number.isFinite), id);
        draws.push([color, radius, point]);
      });
      return JSON.stringify(draws);
    });
    assert.ok(new Set(states).size > 1, id);
  }
});

test("locomotion variants keep their step support, footwear pitch, and moving equipment", () => {
  const stairs = motions["3009"];
  const treads = stairs.props.filter(([, y1, , y2]) => y1 === y2);
  for (const frame of stairs.frames) {
    for (const [x, y] of [frame[11], frame[12]]) {
      assert.ok(treads.some(([start, level, end]) => start <= x && x <= end && y + 1 === level));
    }
  }
  const heel = motions["10294"].frames[0], toe = motions["4802"].frames[0];
  assert.ok(heel[11][1] < heel[8][1]);
  assert.ok(toe[11][1] > toe[8][1]);
  assert.notDeepEqual(motions["10848"].props, motions["2140"].props);
  assert.ok(motions["5991"].dynamic.some(([type, from]) => type === "ball" && from === 14));
  assert.ok(motions["2712"].dynamic.some(([type]) => type === "sandbag"));
});
