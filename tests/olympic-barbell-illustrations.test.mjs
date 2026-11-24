
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

const { olympicBarbellIllustrations: illustrations } = await import("../features/exercises/olympic-barbell-illustrations.ts");

test("clean and snatch setup differentiates bar height and supporting blocks", () => {
  const floor = illustrations["5287"], above = illustrations["1520"], below = illustrations["1521"], blocks = illustrations["1516"];
  assert.equal(floor.frames[0][13][1], 150);
  assert.ok(above.frames[0][13][1] < above.frames[0][7][1]);
  assert.ok(below.frames[0][13][1] > below.frames[0][7][1]);
  assert.equal(above.props.length, 0);
  assert.equal(below.props.length, 0);
  for (const id of ["1516", "1528", "1531", "1536"]) {
    const demo = illustrations[id];
    assert.equal(demo.props[0][1], demo.frames[0][13][1] + 10);
    assert.equal(demo.props[4][1], demo.frames[0][14][1] + 10);
  }
  assert.ok(blocks.frames[0][14][1] < floor.frames[0][14][1]);
  assert.ok(illustrations["1522"].frames[0][4][0] - illustrations["1522"].frames[0][6][0] >
    illustrations["1520"].frames[0][4][0] - illustrations["1520"].frames[0][6][0]);
});

test("squat, power and split catches land at different depths or footprints", () => {
  for (const [deepId, powerId, index] of [["1516", "1528", 3], ["1533", "1530", 4], ["1536", "1531", 3]]) {
    const deep = illustrations[deepId].frames[index], power = illustrations[powerId].frames[index];
    assert.ok(deep[2][1] > deep[7][1], deepId);
    assert.ok(power[2][1] < power[7][1], powerId);
  }
  for (const [id, i] of [["1537", 4], ["1538", 3]]) {
    const caught = illustrations[id].frames[i];
    assert.ok(caught[8][0] - caught[10][0] > 70, id);
    assert.equal(caught[12][1], 156, id);
  }
  const [, , , split, , frontFootRetreat] = illustrations["1538"].frames;
  assert.deepEqual(frontFootRetreat[10], split[10]);
  assert.ok(frontFootRetreat[8][0] < split[8][0]);
});

test("heaving balance keeps both feet planted and muscle snatch skips the second dip", () => {
  const fixed = illustrations["1524"].frames;
  for (const frame of fixed) {
    for (const joint of [8, 10, 11, 12]) assert.deepEqual(frame[joint], fixed[0][joint]);
  }
  const changing = illustrations["1534"].frames;
  assert.notDeepEqual(changing[0][8], changing[3][8]);
  const [, drive, turnover, lockedOut] = illustrations["1526"].frames;
  assert.deepEqual(turnover[2], drive[2]);
  assert.ok(lockedOut[13][1] < lockedOut[0][1]);
  assert.ok(lockedOut[2][1] < lockedOut[7][1]);
});

test("clean pull stays lower than high pull and thruster racks, squats and presses in order", () => {
  const regular = illustrations["1517"].frames[3], high = illustrations["10107"].frames[2];
  assert.ok(regular[13][1] > high[13][1], "lower bar finish");
  assert.ok(regular[3][1] < regular[4][1], "late elbow lift");
  const thruster = illustrations["5188"].frames;
  assert.ok(thruster[4][2][1] < thruster[4][7][1], "power clean catch first");
  assert.ok(thruster[6][2][1] > thruster[6][7][1], "front squat later");
  assert.ok(thruster[7][13][1] < thruster[7][0][1], "overhead press after squat");
});