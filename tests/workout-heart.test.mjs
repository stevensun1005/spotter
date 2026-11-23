import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
