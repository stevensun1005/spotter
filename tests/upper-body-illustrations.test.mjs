import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { upperBodyIllustrations } from "../features/exercises/upper-body-illustrations.ts";

test("upper-body demonstrations keep exact catalogue equipment and show their claimed setup", async () => {
  const { rows } = JSON.parse(await readFile(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const requiredGear = new Map([
    ["barbell", ["bar", "barbell-end"]], ["ez barbell", ["ez-bar"]], ["dumbbell", ["dumbbell", "hammer-weight"]],
    ["kettlebell", ["kettlebell"]], ["weight plate", ["plate"]], ["trap bar", ["trap-bar"]],
    ["band", ["band"]], ["resistance band", ["band"]], ["cable", ["cable"]], ["sandbag", ["sandbag"]],
  ]);
  for (const [id, animation] of Object.entries(upperBodyIllustrations)) {
    const row = byId.get(id);
    assert.ok(row && row.id === id, id);
    const actualGear = new Set(animation.dynamic.map(([kind]) => kind));
    const expected = requiredGear.get(row.equipment);
    if (expected) assert.ok(expected.some((kind) => actualGear.has(kind)), id);
    assert.ok(new Set(animation.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of animation.frames) {
      assert.ok(frame.length >= 11 && frame.length === animation.frames[0].length, id);
      assert.ok(frame.every(([x, y]) => x >= 0 && x <= 320 && y >= 0 && y <= 180), id);
    }
  }
  const draw = (id) => upperBodyIllustrations[id];
  assert.equal(draw("11017").frames[0][7][1], 154);
  assert.notEqual(draw("11016").frames[0][7][1], 154);
  assert.ok(draw("11016").frames[1][4][1] < draw("11016").frames[0][4][1]);
  assert.deepEqual(draw("11016").frames[0][6], draw("11016").frames[1][6]);
  assert.ok(draw("3690").dynamic.some(([kind]) => kind === "stability-ball"));
  assert.ok(draw("4846").dynamic.some(([kind, joint, , y]) => kind === "kettlebell" && joint === 4 && y < 0));
  assert.equal(draw("4846").frames[0][1][1], 147);
  assert.ok(draw("4846").frames[0][3][1] >= 151);
  assert.ok(draw("4068").frames[0][4][1] < draw("4070").frames[0][4][1]);
  assert.ok(draw("5097").frames[0][0][1] > draw("5097").frames[0][2][1]);
  assert.ok(draw("5814").dynamic.every(([kind, , , y]) => kind === "cable" && y === 146));
  assert.ok(draw("11274").dynamic.every(([kind, , , y]) => kind === "cable" && y === 54));
  assert.notDeepEqual(draw("4238").frames[1].slice(3, 7), draw("4238").frames[3].slice(3, 7));
});

test("reviewed upper-body variants preserve their apparatus and distinctive path", () => {
  const draw = (id) => upperBodyIllustrations[id];
  for (const id of ["1224", "9385", "10116"]) {
    const demo = draw(id);
    const [bottom, top] = demo.frames;
    assert.deepEqual(bottom.slice(11).map((p) => p[0]), top.slice(11).map((p) => p[0]));
    for (const end of bottom.slice(11)) assert.ok(demo.props.some(([x1, , x2]) => x1 === x2 && x1 === end[0]));
  }
  assert.ok(draw("9385").frames[0][3][1] < draw("9385").frames[0][4][1]);

  const cross = draw("11254");
  assert.ok(cross.frames[0][4][0] < cross.frames[0][6][0]);
  assert.ok(cross.frames[1][4][0] > cross.frames[1][6][0]);
  assert.equal(draw("10559").dynamic.filter(([kind]) => kind === "dumbbell").length, 1);
  assert.ok((draw("7588").frames.length - 2) * draw("7588").ms >= 20000);
  assert.ok(draw("1124").frames[0][8][0] - draw("1124").frames[0][10][0] > 35);
  for (const id of ["1073", "1111", "1124", "1126"]) assert.equal(draw(id).dynamic.some(([kind]) => kind === "ring"), false);
  const kick = draw("6097").frames;
  assert.ok(kick[1][8][0] < kick[0][8][0] && kick[3][10][0] < kick[2][10][0]);
});
