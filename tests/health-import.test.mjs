import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Encoder, Profile } from "@garmin/fitsdk";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { importHeartFile } = await import("../features/heart/file-import.ts");
const { timeValue } = await import("../features/heart/file-formats.ts");
const { heartSchema, sampleCollection } = await import("../features/heart/model.ts");

test("FIT and TCX imports match separate workouts across midnight and remain repeatable", async () => {
  const from = Date.parse("2026-11-23T23:59:00-05:00");
  const first = { from, to: from + 120_000 };
  const second = { from: from + 3_600_000, to: from + 3_720_000 };
  const points = [
    [from - 1_000, 65], [from + 30_000, 110], [from + 90_000, 130],
    [second.from + 30_000, 150], [second.from + 90_000, 160],
  ];
  const encoder = new Encoder();
  encoder.writeMesg({ mesgNum: Profile.MesgNum.FILE_ID, type: "activity", timeCreated: new Date(from), manufacturer: "garmin", productName: "Synthetic Watch" });
  for (const [at, bpm] of points) encoder.writeMesg({ mesgNum: Profile.MesgNum.RECORD, timestamp: new Date(at), heartRate: bpm });
  const fit = new File([encoder.close()], "synthetic.fit");
  const tcx = new File(['<TrainingCenterDatabase><Creator><Name>Garmin &amp; Test</Name></Creator>' + points.map(([at, bpm]) =>
    `<tcx:Trackpoint><tcx:Time>${new Date(at).toISOString()}</tcx:Time><tcx:HeartRateBpm><tcx:Value>${bpm}</tcx:Value></tcx:HeartRateBpm></tcx:Trackpoint>`
  ).join("") + '</TrainingCenterDatabase>'], "synthetic.tcx");
  for (const file of [fit, tcx]) {
    const morning = await importHeartFile(file, first);
    const evening = await importHeartFile(file, second);
    assert.deepEqual(morning.samples.map(({ bpm }) => bpm), [110, 130]);
    assert.deepEqual(evening.samples.map(({ bpm }) => bpm), [150, 160]);
    assert.equal(morning.minimum, 110);
    assert.equal(evening.average, 155);
    assert.deepEqual(await importHeartFile(file, first), morning);
    await assert.rejects(importHeartFile(file, { from: second.to + 1, to: second.to + 60_000 }), /时间吻合/);
  }
  assert.equal((await importHeartFile(tcx, first)).sourceName, "Garmin & Test");
  assert.equal((await importHeartFile(fit, first)).sourceName, "garmin · Synthetic Watch");
  await assert.rejects(importHeartFile(new File([new Uint8Array(32)], "broken.fit"), first), /FIT/);
});

test("imports require a timezone and deduplicate repeated timestamps", async () => {
  const at = Date.parse("2026-11-23T20:00:00Z");
  assert.ok(Number.isNaN(timeValue("2026-11-23 15:00:00")));
  assert.equal(timeValue("2026-11-23 15:00:00", "UTC-05:00"), at);
  assert.equal(timeValue("2026-11-23 20:00:00", "UTC"), at);
  assert.equal(timeValue("2026-11-24T05:00:00+09:00"), at);
  const csv = new File(["time,bpm\n2026-11-23T15:00:00-05:00,120\n2026-11-23T20:00:00Z,120\n"], "synthetic.csv");
  const result = await importHeartFile(csv, { from: at, to: at + 60_000 });
  assert.equal(result.samples.length, 1);
  assert.equal(result.average, 120);
});

test("heart summaries retain minimum and maximum from all samples before downsampling", () => {
  const from = Date.parse("2026-11-23T20:00:00Z");
  const samples = sampleCollection({ from, to: from + 3_000_000 });
  for (let i = 0; i < 2_000; i++) samples.add(from + i * 1_000, i === 2 ? 40 : i === 1_333 ? 220 : 120);
  const result = samples.collect("fit");
  assert.equal(result.minimum, 40);
  assert.equal(result.maximum, 220);
  assert.ok(result.samples.length <= 720);
  assert.ok(result.samples.some(({ bpm }) => bpm === 40));
  assert.ok(result.samples.some(({ bpm }) => bpm === 220));
  assert.ok(heartSchema.safeParse(result).success);
  assert.equal(heartSchema.safeParse({ ...result, minimum: 250 }).success, false);
});

test("Apple export provenance only includes sources inside the workout", async () => {
  const from = Date.parse("2026-11-23T20:00:00Z");
  const xml = `<HealthData><Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Synthetic's Watch &amp; Test" startDate="2026-11-23 15:00:20 -0500" value="120"/><Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Outside source" startDate="2026-11-23 16:00:20 -0500" value="90"/></HealthData>`;
  const result = await importHeartFile(new File([xml], "export.xml"), { from, to: from + 60_000 });
  assert.equal(result.sourceName, "Synthetic's Watch & Test");
  assert.equal(result.samples.length, 1);
});
