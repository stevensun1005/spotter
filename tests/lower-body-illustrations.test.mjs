import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lowerBodyIllustrations as illustrations } from "../features/exercises/lower-body-illustrations.ts";

const file = (path) => JSON.parse(readFileSync(new URL(`../public/open-gym/${path}`, import.meta.url), "utf8"));

test("lower-body animations resolve exact catalogue IDs and keep distinctive equipment and positions", () => {
  const entries = new Map(file("index.json").rows.map((row) => [row.id, row]));
  for (const [id, demo] of Object.entries(illustrations)) {
    assert.ok(entries.has(id), id);
    const details = file(`details/${Math.floor(Number(id) / 100)}.json`)[id];
    assert.ok(details?.steps.length, id);
    assert.ok(new Set(demo.frames.map((frame) => JSON.stringify(frame))).size > 1, id);
    for (const frame of demo.frames) {
      assert.ok(frame.length >= 11, id);
      for (const [x, y] of frame) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 180, `${id} position ${x},${y}`);
    }
  }

  const kinds = (id) => illustrations[id].dynamic.map(([kind]) => kind);
  assert.equal(kinds("5314").filter((kind) => kind === "dumbbell").length, 2);
  assert.deepEqual(kinds("7586"), ["cable"]);
  assert.deepEqual(kinds("0569"), ["stability-ball"]);
  assert.deepEqual(kinds("5304"), ["trap-bar"]);
  assert.deepEqual(kinds("1546"), []);
  assert.ok(illustrations["1546"].props.length > 0);
  assert.ok(illustrations["7550"].props.length > illustrations["7590"].props.length);
  assert.ok(illustrations["0884"].props.length > illustrations["6797"].props.length);
  assert.ok(illustrations["10864"].props[0][1] < illustrations["4579"].props[0][1]);

  const normalStep = illustrations["0479"];
  assert.ok(normalStep.frames[2][9][1] < normalStep.frames[2][10][1]);
  assert.ok(Math.abs(normalStep.frames[2][2][1] - normalStep.frames[2][9][1]) <= 2);
  assert.notDeepEqual(illustrations["3616"].frames[0][8], illustrations["3617"].frames[0][8]);
  for (const id of ["2951", "2224", "4327"]) {
    assert.deepEqual(illustrations[id].frames[0][2], illustrations[id].frames[1][2]);
    assert.notDeepEqual(illustrations[id].frames[0][11], illustrations[id].frames[1][11]);
  }
  assert.equal(illustrations["4327"].frames[0][11][0], illustrations["4327"].frames[1][11][0]);
});


test("foot contact and peak positions agree with the reviewed lower-body steps", () => {
  for (const id of ["4499", "4703"]) {
    const [standing, , , press] = illustrations[id].frames;
    assert.deepEqual(press[8], standing[8]);
    assert.deepEqual(press[10], standing[10]);
    assert.ok(press[4][1] < press[0][1]);
  }
  const [regular, , , calfRaise] = illustrations["7469"].frames;
  assert.ok(calfRaise[8][1] < regular[8][1]);
  assert.deepEqual(calfRaise[11], regular[11]);
  for (const id of ["11879", "10864", "0479"]) {
    const peak = illustrations[id].frames[2];
    const [hip, knee, foot] = [peak[2], peak[7], peak[8]];
    assert.ok(Math.abs(knee[0] - (hip[0] + foot[0]) / 2) < 7, id);
    assert.ok(peak[0][1] >= 9, id);
  }
  for (const frame of illustrations["7593"].frames) {
    const [top, end] = [frame[11], frame[12]];
    for (const [x, y] of [frame[8], frame[10]]) {
      const deckX = top[0] + (end[0] - top[0]) * (y - top[1]) / (end[1] - top[1]);
      assert.ok(Math.abs(x - deckX) <= 3);
      assert.ok(y > top[1] && y < end[1]);
    }
  }
  const [extended, curl] = illustrations["0569"].frames;
  assert.deepEqual(extended[2], curl[2]);
  assert.ok(curl[8][0] < extended[8][0]);
  assert.ok(Math.abs(extended[2][1] - (extended[1][1] + extended[7][1]) / 2) <= 2);
});
