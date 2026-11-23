import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Encoder, Profile } from "@garmin/fitsdk";
import { strToU8, zipSync } from "fflate";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });

const set = await import("../features/training/set-editor.ts");
const training = await import("../features/training/model.ts");
const { importHeartFile } = await import("../features/heart/file-import.ts");
const { heartSchema } = await import("../features/heart/model.ts");

test("keypad edits survive validation and preserve side loads and unit conversion", () => {
  const plan = {
    title: "力量", date: "2026-11-23", minutes: 30, category: "力量训练", shared: false, video: "",
    exercises: [{ name: "卧推", sets: 2, weight: 20, unit: "kg", reps: 6, seconds: 0 }],
  };
  const original = training.startSession(plan, "example", plan.date);
  const left = { move: 0, row: 0, field: "weight" };
  let session = set.changeNumber(original, left, "22.5");
  session = set.copySetNumber(session, left, 1);
  session = set.changeNumber(session, { ...left, field: "rightWeight" }, "25");
  session = set.changeNumber(session, { ...left, field: "rightReps" }, "8");
  session = set.changeNumber(session, { ...left, field: "rpe" }, "8.5");
  session = set.changeSet(session, 0, 0, (line) => ({ ...line, kind: "drop", done: true }));
  session = set.appendSet(session, 0, 0);
  assert.equal(original.plan.exercises[0].sets, 2);
  assert.equal(session.plan.exercises[0].sets, 3);
  assert.equal(session.rows[0][1].weight, 22.5);
  assert.equal(session.rows[0][2].done, false);
  assert.equal(session.rows[0][2].rpe, undefined);
  assert.equal(session.rows[0][0].rpe, 8.5);
  assert.equal(training.sessionTotals(session).volume, 335);
  session = set.flipWeightUnit(session, 0);
  assert.equal(session.plan.exercises[0].unit, "lb");
  assert.ok(Math.abs(training.sessionTotals(session).volume - 335) < 0.1);
  assert.ok(training.sessionSchema.safeParse(session).success);
  assert.equal(set.changeNumber(session, { ...left, field: "rpe" }, "8.1"), session);
});

test("wearable adapters import heart rate within the selected workout", async () => {
  const from = Date.parse("2026-11-23T20:00:00Z");
  const to = from + 60_000;
  const window = { from, to };
  const apple = '<HealthData>' +
    '<Record type="HKQuantityTypeIdentifierHeartRate" startDate="2026-11-23 14:59:58 -0500" value="63"/>' +
    '<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" startDate="2026-11-23 15:00:05 -0500" value="59"/>' +
    '<Record startDate="2026-11-23 15:00:24 -0500" value="123" type="HKQuantityTypeIdentifierHeartRate"/>' +
    '<Record startDate="2026-11-23 15:00:48 -0500" value="133" type="HKQuantityTypeIdentifierHeartRate"/>' +
    '</HealthData>';
  const bundle = zipSync({ "apple_health_export/export.xml": strToU8(apple), "apple_health_export/export_cda.xml": strToU8("ignored") });
  const results = [];
  results.push(await importHeartFile(new File([bundle], "export.zip"), window));
  assert.deepEqual(results[0].samples.map((item) => item.bpm), [123, 133]);
  const tcx = '<TrainingCenterDatabase><Trackpoint><Time>2026-11-23T20:00:24Z</Time>' +
    '<HeartRateBpm><Value>123</Value></HeartRateBpm></Trackpoint></TrainingCenterDatabase>';
  results.push(await importHeartFile(new File([tcx], "ride.tcx"), window));
  assert.equal(results[1].maximum, 123);
  const whoop = 'Workout start time,Workout end time,Workout timezone,Average HR (bpm),Max HR (bpm),Activity name\r\n' +
    '2026-11-23 15:00:00,2026-11-23 15:01:00,UTC-05:00,128,142,"Class, gym"\r\n';
  const whoopZip = zipSync({ "workouts.csv": strToU8(whoop), "sleep.csv": strToU8("ignored") });
  results.push(await importHeartFile(new File([whoopZip], "whoop.zip"), window));
  assert.equal(results[2].source, "whoop");
  assert.deepEqual(results[2].samples, []);
  assert.equal(results[2].average, 128);
  const encoder = new Encoder();
  encoder.writeMesg({ mesgNum: Profile.MesgNum.FILE_ID, type: "activity", timeCreated: new Date(from) });
  encoder.writeMesg({ mesgNum: Profile.MesgNum.RECORD, timestamp: new Date(from + 24_000), heartRate: 124 });
  encoder.writeMesg({ mesgNum: Profile.MesgNum.RECORD, timestamp: new Date(from + 48_000), heartRate: 144 });
  results.push(await importHeartFile(new File([encoder.close()], "garmin.fit"), window));
  assert.equal(results[3].source, "fit");
  assert.equal(results[3].maximum, 144);
  results.push(await importHeartFile(new File(["time,bpm\n2026-11-23T20:00:24Z,126\n"], "watch.csv"), window));
  assert.equal(results[4].average, 126);
  assert.ok(results.every((item) => heartSchema.safeParse(item).success));
  await assert.rejects(importHeartFile(new File([tcx], "ride.tcx"), { from: to, to: to + 1000 }), /时间吻合/);
});

test("workout clock excludes time away and refreshed plans preserve actual sets", async () => {
  const { pauseClock, resumeClock, workoutElapsed } = await import("../features/training/clock.ts");
  const { refreshDraftPlan } = await import("../features/training/refresh-plan.ts");
  const from = 1795478400000;
  const plan = {
    title: "卧推训练", date: "2026-11-23", category: "力量训练", minutes: 45, shared: false, video: "",
    exercises: [{ name: "杠铃卧推", sets: 1, reps: 6, seconds: 0, weight: 25, unit: "kg" }],
  };
  const started = { ...training.startSession(plan, "test", plan.date), started: from, clock: { elapsed: 0, runningSince: from } };
  const parked = pauseClock(started, from + 10000);
  assert.equal(workoutElapsed(parked, from + 3600000), 10000);
  const resumed = resumeClock(parked, from + 3600000);
  assert.equal(workoutElapsed(resumed, from + 3610000), 20000);
  started.rows[0][0].done = true;
  const latest = { ...plan, minutes: 55, durationNote: "预计 50–60 分钟", exercises: [{ ...plan.exercises[0], reps: 8, repsMax: 12, sets: 3, restSeconds: 90 }] };
  const lifted = refreshDraftPlan(parked, latest);
  assert.deepEqual(lifted.rows[0].map((row) => [row.done, row.reps]), [[true, 6], [false, 8], [false, 8]]);
  assert.equal(lifted.plan.minutes, 55);
  assert.ok(training.sessionSchema.safeParse(resumed).success);
});

test("rescheduling keeps spacing and skips blocked weekdays and dates", async () => {
  const { moveSchedule } = await import("../features/plans/schedule.ts");
  const first = { id:"a", title:"第一堂", date:"2026-11-23" };
  const second = { id:"b", title:"第二堂", date:"2026-11-25" };
  const settings = { weekdays:[3], dates:["2026-11-25"] };
  const moved = moveSchedule(first, "2026-11-24", [first, second], ["2026-11-27"], settings);
  assert.deepEqual(moved, [{ id:"a", date:"2026-11-24" }, { id:"b", date:"2026-11-28" }]);
  assert.equal(moveSchedule(first, "2026-11-25", [first], [], settings), null);
});

test("iPhone shortcut saves readings only inside the selected workout", async () => {
  const { shortcutHeart } = await import("../features/heart/shortcut-data.ts");
  const from = Date.parse("2026-11-23T20:00:00Z");
  const to = from + 60000;
  const result = shortcutHeart("2026-11-23T19:59:00Z,80\n2026-11-23T20:00:05Z,126\n2026-11-23T15:00:15-05:00,132", { from, to });
  assert.equal(result.source, "apple");
  assert.equal(result.average, 129);
  assert.equal(result.samples.length, 2);
  assert.throws(() => shortcutHeart("2026-11-23T19:59:00Z,80", { from, to }), /没有找到/);
});

test("complete openGym snapshot keeps IDs, translations, filtering and artwork separate", async () => {
  const { filterRows } = await import("../features/exercises/catalog-search.ts");
  const read = (name) => JSON.parse(readFileSync(new URL("public/open-gym/" + name, root), "utf8"));
  const { rows, variants } = read("index.json");
  assert.equal(rows.length, 5632);
  assert.equal(Object.keys(variants).length, 922);
  assert.equal(new Set(rows.map((entry) => entry.id)).size, rows.length);
  const bench = rows.find((entry) => entry.id === "0025");
  assert.equal(bench.muscles.chest, 100);
  assert.equal(bench.muscles["front-delts"], 40);
  const options = { query: "bench press", part: "chest", type: "strength", equipment: "barbell", terms: ["chest", "front-delts"], any: false, gear: [] };
  const results = filterRows(rows, options).rows;
  assert.ok(results.some((item) => item.id === bench.id));
  assert.ok(results.every((item) => item.equipment === "barbell" && item.muscles.chest && item.muscles["front-delts"]));
  const anatomy = read("anatomy.json");
  assert.ok(anatomy["male-front"].regions["upper-chest"].length > 0);
  assert.ok(anatomy["female-back"].regions.lats.length > 0);
  const media = rows.filter((item) => item.animation);
  assert.equal(media.length, 1257);
  assert.equal(read("flow/0025.json").frames.length, 3);
  for (const item of media) assert.ok(existsSync(new URL("public/open-gym/flow/" + item.id + ".json", root)));
  const index = new Map();
  for (const item of rows) {
    const shard = Math.floor(+item.id / 100);
    if (!index.has(shard)) index.set(shard, read("details/" + shard + ".json"));
    assert.ok(index.get(shard)[item.id]?.steps);
  }
});

test("workout circuits alternate by round, skip missing sets, and finish before changing stations", async () => {
  const { nextSet, restFor, trainingBlocks } = await import("../features/training/sequence.ts");
  const first = { name: "推举", sets: 2, weight: 20, unit: "kg", reps: 10, seconds: 0, block: "A", station: "龙门架", restSeconds: 75 };
  const plan = {
    title: "组合", date: "2026-11-23", minutes: 35, category: "力量训练", shared: false, video: "", defaultRestSeconds: 30,
    exercises: [first, { ...first, name: "划船", sets: 1 }, { ...first, name: "面拉" },
      { ...first, block: "A-2", station: "哑铃区" }, { ...first, block: "B" }],
  };
  let session = training.startSession(plan, "combined", plan.date);
  assert.deepEqual(trainingBlocks(plan.exercises).map((block) => block.slots), [["A1", "A2", "A3"], ["A4"], ["B1"]]);
  const order = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [3, 0], [3, 1], [4, 0], [4, 1]]
    .map(([move, row]) => ({ move, row }));
  assert.deepEqual(nextSet(plan, session.rows), order[0]);
  for (const [index, here] of order.entries()) {
    session = set.changeSet(session, here.move, here.row, (line) => ({ ...line, done: true }));
    assert.deepEqual(nextSet(plan, session.rows, here), order[index + 1]);
  }
  assert.deepEqual(restFor(plan, order[0], order[1]), { seconds: 30, kind: "换动作" });
  assert.deepEqual(restFor(plan, order[2], order[3]), { seconds: 75, kind: "轮间休息" });
  assert.deepEqual(restFor(plan, order[4], order[5]), { seconds: 75, kind: "换站" });
  const adjusted = { ...session, defaultRestOverride: 0, rest: { kind: "换动作", until: 30_000 } };
  assert.deepEqual(training.sessionSchema.parse(adjusted), adjusted);
});

test("clean exercise labels and regrouped plans preserve previously completed sets", async () => {
  const { refreshDraftPlan } = await import("../features/training/refresh-plan.ts");
  const { parsePlanMove } = await import("../features/exercises/move-name.ts");
  assert.deepEqual(parsePlanMove("B1 后脚抬高分腿跳（每侧，落稳再跳） · 本周可省"), {
    name: "后脚抬高分腿跳", cue: "每侧，落稳再跳 · 本周可省", sourceSlot: "B1",
  });
  const first = { name: "A1 站姿单臂锤式弯举（每手）", sets: 2, weight: 20, unit: "lb", reps: 10, seconds: 0 };
  const rest = [
    { ...first, name: "A2 半跪绳索划船（每侧）" },
    { ...first, name: "A3 上斜俯卧哑铃展臂（每手）" },
  ];
  const plan = { title: "力量", date: "2026-11-23", minutes: 30, category: "力量训练", shared: false, video: "", exercises: [first, ...rest] };
  let session = training.startSession(plan, "example", plan.date);
  session = set.changeSet(session, 1, 0, (line) => ({ ...line, weight: 22.5, rpe: 8.5, done: true }));
  const latest = { ...plan, defaultRestSeconds: 30, exercises: [
    { ...first, name: "哑铃单臂站姿锤式弯举", sourceName: "站姿单臂锤式弯举", sourceSlot: "A1", block: "A", station: "可调凳＋哑铃", catalogueId: "1671" },
    { ...rest[1], name: "上斜俯卧哑铃展臂", sourceSlot: "A3", block: "A", station: "可调凳＋哑铃" },
    { ...rest[0], name: "半跪绳索划船", sourceSlot: "A2", block: "A-2", station: "龙门架" },
  ] };
  const refreshed = refreshDraftPlan(session, latest);
  assert.equal(refreshed.plan.exercises[0].catalogueId, "1671");
  assert.equal(refreshed.rows[1][0].done, false);
  assert.deepEqual(refreshed.rows[2][0], session.rows[1][0]);
  assert.equal(refreshDraftPlan(refreshed, latest), refreshed);
});
