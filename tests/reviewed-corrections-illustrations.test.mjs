import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { reviewedCorrectionIllustrations as illustrations } from "../features/exercises/reviewed-corrections-illustrations.ts";
import reviewedDetails from "../features/exercises/reviewed-corrections-details.json" with { type: "json" };

test("Smith incline serratus raise has a sloped bench, fixed elbows and vertical rails", () => {
  const { frames: [base, reach], props } = illustrations["0759"];
  const displacement = reach[1][1] - base[1][1];
  assert.ok(displacement < 0);
  assert.ok(props.some(([x1, y1, x2, y2]) => x2 > x1 && y2 > y1));
  for (const joint of [1, 3, 4, 5, 6, 11, 12]) {
    assert.deepEqual(reach[joint], [base[joint][0], base[joint][1] + displacement]);
  }
  for (const end of [11, 12]) {
    assert.ok(props.some(([x1, y1, x2, y2]) => x1 === x2 && x1 === base[end][0] && y1 > base[end][1] && y2 < reach[end][1]));
  }
});

test("barbell behind-neck press starts at the nape without a machine", () => {
  const { frames: [base, extended], props, dynamic } = illustrations["0788"];
  assert.ok(!props?.length);
  assert.ok(dynamic.some(([kind]) => kind === "bar"));
  assert.ok(base[4][1] > base[0][1] && base[4][1] < base[1][1]);
  assert.ok(extended[4][1] < extended[0][1]);
});

test("floor calf raise lifts each heel while retaining both toe contacts", () => {
  const { frames: [base, raised], props, dynamic } = illustrations["1397"];
  assert.ok(!props?.length);
  for (const ankle of [8, 10]) {
    assert.ok(raised[ankle][1] < base[ankle][1]);
    assert.ok(dynamic.some(([kind, index, , y]) => kind === "foot" && index === ankle && y === 158));
  }
});

test("three-bench dip keeps both hands and heels on the elevated supports", () => {
  const { frames: [base, lowered], props } = illustrations["1753"];
  assert.ok(lowered[2][1] > base[2][1]);
  for (const joint of [4, 6, 8, 10]) assert.deepEqual(lowered[joint], base[joint]);
  for (const contact of [4, 6, 8, 10]) {
    const [x, y] = base[contact];
    assert.ok(props.some(([x1, y1, x2, y2]) => y1 === y2 && y1 >= y && y1 <= y + 5 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)));
  }
});

test("reviewed instructions survive catalogue generation", () => {
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  for (const [id, { name, en, equipment, part, type, target, muscles, needs, ...expected }] of Object.entries(reviewedDetails)) {
    const shard = new URL("../public/open-gym/details/" + Math.floor(+id / 100) + ".json", import.meta.url);
    const actual = JSON.parse(readFileSync(shard, "utf8"))[id];
    for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value);
    const row = rows.find((item) => item.id === id);
    if (name !== undefined) assert.equal(row?.name, name);
    if (en !== undefined) assert.equal(row?.en, en);
    if (equipment !== undefined) assert.equal(row?.equipment, equipment);
    if (part !== undefined) assert.equal(row?.part, part);
    if (target !== undefined) assert.equal(row?.target, target);
    if (muscles !== undefined) assert.deepEqual(row?.muscles, muscles);
    if (needs !== undefined) assert.deepEqual(row?.needs, needs);
    if (type !== undefined) assert.equal(row?.type, type);
  }
  assert.match(reviewedDetails["0759"].steps.join(" "), /保持肘部伸直.+肩胛骨/);
  assert.match(reviewedDetails["1753"].steps.join(" "), /左右两侧各放一张.+第三张供脚跟支撑/);
});

test("cable incline motions retain the high and low anchors for their respective exercises", () => {
  const high = illustrations["0172"].dynamic.find(([kind]) => kind === "cable");
  const low = illustrations["0173"].dynamic.find(([kind]) => kind === "cable");
  assert.ok(high[3] < 35 && low[3] > 130);
  for (const elbow of [3, 5]) assert.deepEqual(illustrations["0173"].frames[0][elbow], illustrations["0173"].frames[1][elbow]);
});

test("the kneeling neutral grip curl rotates at the wrists with both forearms supported", () => {
  const { frames: [base, curled], dynamic } = illustrations["0365"];
  assert.deepEqual(base.slice(0, 11), curled.slice(0, 11));
  assert.ok(base[7][1] >= 150 && base[9][1] >= 150);
  assert.equal(dynamic.filter(([kind]) => kind === "thumb-up").length, 2);
  assert.equal(dynamic.filter(([kind]) => kind === "hammer-weight").length, 2);
});

test("bench scapular dips keep the elbows fixed and move the torso", () => {
  const { frames: [base, raised] } = illustrations["3012"];
  assert.deepEqual(raised.slice(3, 7), base.slice(3, 7));
  assert.ok(raised[2][1] < base[2][1]);
});
