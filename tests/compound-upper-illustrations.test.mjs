import test from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { compoundUpperIllustrations as compound } from "../features/exercises/compound-upper-illustrations.ts";
import { upperFormCheckIllustrations as form } from "../features/exercises/upper-form-checks-illustrations.ts";
import { paintMotionFrame } from "../features/exercises/motion-drawing.ts";

test("all new upper body and form checks render finite covers and moving phases", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url))).rows;
  const ids = new Set(rows.map(({ id }) => id));
  const illustrations = { ...compound, ...form };
  assert.equal(Object.keys(illustrations).length, 51);
  for (const [id, illustration] of Object.entries(illustrations)) {
    assert.ok(ids.has(id), id);
    const phases = new Set();
    for (let index = 0; index < illustration.frames.length; index++) {
      const points = [];
      const take = (point) => {
        assert.ok(point.every(Number.isFinite), id);
        points.push(point.join(","));
      };
      paintMotionFrame(illustration, illustration.ms * index, (_color, _width, path) => path.forEach(take),
        (_color, _radius, center) => take(center));
      phases.add(points.join("|"));
    }
    assert.ok(phases.size > 1, id);
  }
});

test("distinct extension heights and equipment, pike support, ring end positions and form checks stay exact", () => {
  const pulley = (id) => compound[id].dynamic.find(([type]) => type === "cable")[3];
  assert.ok(pulley("3040") < 40);
  assert.ok(pulley("4115") > 130);
  for (const id of ["3040", "3353", "4115", "5916", "5528", "3745", "5863", "4803", "4804"]) {
    const { frames } = compound[id];
    assert.deepEqual(frames[0][3], frames[1][3], id);
    assert.notDeepEqual(frames[0][4], frames[1][4], id);
  }
  assert.ok(compound["3915"].frames[0][8][1] < compound["3904"].frames[0][8][1]);
  assert.equal(compound["4521"].dynamic.filter(([type]) => type === "handled-bell").length, 2);
  assert.ok(Math.min(...compound["8750"].frames.map((frame) => frame[0][1])) < 45);
  assert.ok(Math.min(...compound["10663"].frames.map((frame) => frame[0][1])) > 75);

  assert.ok(form["2338"].frames[0][2][1] > form["2338"].partnerFrames[0][2][1]);
  assert.ok(form["2342"].frames[0][3][1] > form["2342"].partnerFrames[0][3][1]);
  assert.ok(form["2346"].partnerFrames[0][3][0] - form["2346"].partnerFrames[0][4][0] >
    form["2346"].frames[0][3][0] - form["2346"].frames[0][4][0]);
});
