import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Encoder, Profile } from "@garmin/fitsdk";
import { strToU8, zipSync } from "fflate";

const root = new URL("../", import.meta.url);
const testWorker = { DB: null };
globalThis[Symbol.for("spotter-heart-test-worker")] = testWorker;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return {
    url: "data:text/javascript,export const env = globalThis[Symbol.for('spotter-heart-test-worker')];",
    shortCircuit: true,
  };
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

test("automatic heart attachment matches the owner's workout window and never overwrites an existing upload", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const migration of ["0000_bored_cardiac.sql", "0001_burly_prima.sql"]) {
    sqlite.exec(readFileSync(new URL("drizzle/" + migration, root), "utf8"));
  }
  testWorker.DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...values) {
        return {
          async first() { return statement.get(...values) ?? null; },
          async run() { return { meta: { changes: statement.run(...values).changes } }; },
        };
      } };
    },
  };
  t.after(() => { testWorker.DB = null; });
  const { readHeart, saveHeart } = await import("../features/heart/server.ts");
  const owner = "owner";
  const started = Date.parse("2026-11-24T16:00:00Z");
  const ended = started + 40 * 60_000;
  const id = crypto.randomUUID();
  sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, 'log', ?, ?)")
    .run(owner, id, JSON.stringify({ started, ended, minutes: 40 }), "2026-11-24");
  const at = ended - 1;
  const file = { source: "fit", from: at, to: at, samples: [{ at, bpm: 131 }] };
  const watch = { source: "apple", from: at, to: at, samples: [{ at, bpm: 126 }] };
  assert.equal(await saveHeart(owner, id, file), true);
  assert.equal(await saveHeart(owner, id, watch, true), false);
  assert.deepEqual(await readHeart(owner, id), file);
  assert.equal(await saveHeart(owner, id, watch), true);
  assert.deepEqual(await readHeart(owner, id), watch);
  await assert.rejects(saveHeart("other-account", id, watch, true), { status: 404 });
  const beyond = { source: "apple", from: ended + 1, to: ended + 1, samples: [{ at: ended + 1, bpm: 126 }] };
  await assert.rejects(saveHeart(owner, id, beyond, true), { status: 400 });
});

test("documented custom exercises use the same cover as their demo and participate in filters", async () => {
  const { customCatalogueEntry, customCover, matchesCustomArea } = await import("../features/exercises/custom-catalogue.ts");
  const { exerciseAreaOptions } = await import("../features/exercises/catalogue-areas.ts");
  const { guideClassifications } = await import("../features/exercises/custom-catalogue-classifications.ts");
  const { catalogueCover } = await import("../features/exercises/catalogue-demo.ts");
  const { blankProfile, exerciseProfile } = await import("../features/library/model.ts");
  const { filterRows } = await import("../features/exercises/catalog-search.ts");
  const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
  const data = read("public/open-gym/index.json");
  const guides = read("features/exercises/training-guides.json");
  const entries = Object.keys(guides).map((name) => customCatalogueEntry(name, undefined, data));
  for (const entry of entries) {
    assert.ok(Object.hasOwn(guideClassifications, entry.name), entry.name);
    assert.ok(exerciseAreaOptions.some(({ id }) => id === entry.area), entry.name);
    const cover = customCover(entry);
    assert.equal(cover, catalogueCover(entry.demo), entry.name);
    assert.ok(cover, entry.name);
    if (cover.startsWith("/")) assert.ok(existsSync(new URL("public" + cover, root)), entry.name);
    else assert.match(cover, /^data:image\/svg\+xml,/);
  }
  const byName = (name) => entries.find((entry) => entry.name === name);
  assert.ok(matchesCustomArea(byName("半跪肩关节慢速绕环"), "shoulders:rotator cuff"));
  assert.ok(matchesCustomArea(byName("半跪胸椎侧弯"), "back:thoracic"));
  assert.equal(byName("轻松骑车或快走").equipment, "");
  const cable = filterRows(entries, { query: "单臂绳索开胸转体", part: "back", type: "mobility",
    equipment: "cable", terms: [], any: false, gear: [] }).rows;
  assert.deepEqual(cable.map(({ name }) => name), ["单臂绳索开胸转体"]);

  const name = "合成动作甲";
  const original = customCatalogueEntry(name, blankProfile(name), data);
  assert.ok(matchesCustomArea(original, "custom:unclassified"));
  assert.equal(customCover(original), undefined);
  const personal = exerciseProfile.parse({ ...blankProfile(name), versionOf: "杠铃卧推",
    classification: { area: "shoulders:rotator cuff", equipment: "dumbbell", type: "strength" } });
  const classified = customCatalogueEntry(name, personal, data);
  assert.ok(matchesCustomArea(classified, "shoulders:rotator cuff"));
  assert.equal(matchesCustomArea(classified, "custom:unclassified"), false);
  assert.equal(classified.equipment, "dumbbell");
  assert.equal(customCover(classified), undefined, "A privately named variation must not show an unrelated base exercise");
});

test("the custom hamstring sweep stays upright with a straight front leg on both sides", async () => {
  const { customCatalogueEntry, customCover } = await import("../features/exercises/custom-catalogue.ts");
  const { exerciseDemo } = await import("../features/exercises/catalogue-demo.ts");
  const { researchedGuide } = await import("../features/exercises/guidance.ts");
  const name = "腘绳肌扫地式活动";
  const entry = customCatalogueEntry(name, undefined, undefined);
  const motion = entry.demo.illustration;
  assert.equal(exerciseDemo(name, name, undefined, true).illustration, motion);
  assert.match(customCover(entry), /^data:image\/svg\+xml,/);
  for (const frame of motion.frames) {
    const [head, shoulder, hip] = frame;
    assert.equal(head[0], shoulder[0]);
    assert.equal(shoulder[0], hip[0]);
    for (const [knee, ankle] of [[frame[7], frame[8]], [frame[9], frame[10]]]) {
      assert.deepEqual(knee, [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2]);
    }
  }
  assert.ok(motion.frames.some((frame) => frame[11][1] < frame[8][1]));
  assert.ok(motion.frames.some((frame) => frame[12][1] < frame[10][1]));
  assert.ok(new Set(motion.frames.map((frame) => frame[4].join(","))).size > 2);
  assert.match(researchedGuide(name).description, /上身直立/);
  assert.match(researchedGuide(name).steps[0], /前膝保持自然伸直/);
});

test("a workout without a plan can be synced and backed up as an empty draft", async () => {
  const { backupSchema, emptyBackup } = await import("../features/data/model.ts");
  const { planSchema } = await import("../features/plans/model.ts");
  const draft = training.startFreeSession("2026-11-23");
  assert.equal(draft.planId, "");
  assert.equal(draft.date, "2026-11-23");
  assert.equal(draft.clock.runningSince, draft.started);
  assert.deepEqual(draft.plan.exercises, []);
  assert.deepEqual(draft.rows, []);
  const cardio = training.startFreeSession(draft.date, "cardio");
  const hiit = training.startFreeSession(draft.date, "hiit");
  assert.equal(cardio.plan.category, "有氧训练");
  assert.equal(hiit.plan.title, "HIIT 训练");
  assert.equal(hiit.plan.category, "有氧训练");
  assert.deepEqual(training.draftSessionSchema.parse(hiit), hiit);
  assert.deepEqual(training.draftSessionSchema.parse(draft), draft);
  assert.equal(training.draftSessionSchema.safeParse({ ...draft, planId: "existing-plan" }).success, false);
  assert.equal(training.draftSessionSchema.safeParse({ ...draft, finishedVideo: true }).success, false);
  assert.equal(training.sessionSchema.safeParse(draft).success, false);
  assert.equal(planSchema.safeParse(draft.plan).success, false);
  const record = { id: "8d19c754-6937-464b-b2ee-3ecf83c5fada", kind: "draft", data: draft };
  assert.deepEqual(backupSchema.parse({ ...emptyBackup(), training: [record] }).training, [record]);
  assert.equal(backupSchema.safeParse({ ...emptyBackup(), training: [{ ...record, kind: "log" }] }).success, false);
});

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
  const { catalogueAreas, matchesCatalogueArea } = await import("../features/exercises/catalogue-areas.ts");
  const read = (name) => JSON.parse(readFileSync(new URL("public/open-gym/" + name, root), "utf8"));
  const { rows, variants } = read("index.json");
  const additions = JSON.parse(readFileSync(new URL("features/exercises/spotter-catalogue-additions.json", root), "utf8"));
  assert.equal(rows.length, 5630 + additions.length);
  const { plannedCatalogueExercise } = await import("../features/exercises/catalogue-identity.ts");
  const { spotterCatalogueVideo } = await import("../features/exercises/catalogue-video.ts");
  const data = { rows, variants };
  for (const entry of additions) {
    assert.equal(plannedCatalogueExercise(data, { name: entry.name })?.id, entry.id);
    assert.ok(spotterCatalogueVideo(entry.id), entry.id);
    assert.ok(entry.equipment && entry.target && Object.keys(entry.muscles).length > 0, entry.id);
    assert.ok(read("details/" + Math.floor(Number(entry.id) / 100) + ".json")[entry.id]?.steps?.length, entry.id);
  }
  const slider = additions.find((entry) => entry.needs?.includes("exercise sliders"));
  assert.ok(slider);
  assert.ok(filterRows(rows, { query: "", part: "", type: "", equipment: "exercise sliders", terms: [], any: true, gear: [] })
    .rows.some((entry) => entry.id === slider.id));
  for (const [name, id] of [["后脚抬高分腿蹲", "2290"], ["哑铃胸前屈肘伸臂", "0436"], ["站姿哑铃推肩", "0426"]]) {
    assert.equal(plannedCatalogueExercise(data, { name })?.id, id);
    assert.ok(spotterCatalogueVideo(id), id);
  }
  assert.equal(Object.keys(variants).length, 924);
  assert.equal(new Set(rows.map((entry) => entry.id)).size, rows.length);
  const parts = new Set(rows.map((entry) => entry.part));
  for (const part of parts) assert.ok(catalogueAreas.some((area) => area.id === part), part);
  for (const area of catalogueAreas.filter(({ id }) => id !== "custom")) {
    assert.ok(rows.some((entry) => matchesCatalogueArea(entry, area.id)), area.id);
    for (const child of area.children ?? []) {
      const matches = rows.filter((entry) => matchesCatalogueArea(entry, child.id));
      assert.ok(matches.length > 0, child.id);
      assert.ok(matches.every((entry) => matchesCatalogueArea(entry, area.id)), child.id);
    }
  }
  const squat = rows.find((entry) => entry.id === "3593");
  assert.ok(matchesCatalogueArea(squat, "upper legs:quads"));
  assert.equal(matchesCatalogueArea(squat, "upper legs:hamstrings"), false);
  assert.equal(matchesCatalogueArea(squat, "custom"), false);
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
  assert.equal(media.length, 1256);
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

test("period statistics keep unit conversions, hot spots, and previous periods consistent", async () => {
  const { periodRange, previousRange, summarize, cumulative } = await import("../features/stats/model.ts");
  const date = "2024-02-29";
  const month = periodRange("month", date, 0, 30, { from: date, to: date });
  assert.deepEqual(month, { from: "2024-02-01", to: date });
  assert.deepEqual(previousRange("month", month, date, 0, 30), { from: "2024-01-01", to: "2024-01-31" });
  const move = { name: "杠铃卧推", catalogueId: "0025", sets: 2, reps: 6, weight: 45, unit: "lb", seconds: 0 };
  const plan = { title: "力量", date, category: "力量训练", minutes: 40, video: "", shared: false, exercises: [move] };
  const data = { ...training.startSession(plan, "plan", date), minutes: 40 };
  data.rows[0][0] = { reps: 8, weight: 20, seconds: 0, done: true, kind: "warmup" };
  data.rows[0][1] = { ...data.rows[0][1], done: true, right: { weight: 50, reps: 6 } };
  const log = { id: "log", kind: "log", owner: "self", updated: "", data };
  const catalogue = [{ id: "0025", name: move.name, en: "bench press", equipment: "barbell", muscles: { chest: 100, triceps: 45 } }];
  const summary = summarize([log, { ...log, kind: "draft" }], catalogue, "weighted");
  assert.deepEqual({ sets: summary.total.sets, sessions: summary.total.sessions, minutes: summary.total.minutes }, { sets: 2, sessions: 1, minutes: 40 });
  assert.ok(Math.abs(summary.total.volume - (20 * 8 + 45 * 6 + 50 * 6) * 0.45359237) < 1e-6);
  assert.deepEqual(summary.primary.buckets, { chest: 1 });
  assert.deepEqual(summary.secondary.buckets, { arms: 1 });
  assert.ok(Math.abs(summary.exercises.get("0025").max.value - 50 * 0.45359237 * 1.2) < 1e-6);
  assert.deepEqual(cumulative(summary, month, "sets", 5), [0, 0, 0, 0, 2]);
  assert.equal(summarize([log], catalogue, "bodyweight").total.sessions, 0);
});

test("the yearly activity grid keeps complete chronological weeks and only includes the selected person's check-ins", async () => {
  const { buildActivityCalendar } = await import("../features/stats/activity-model.ts");
  const end = "2024-03-02";
  const move = { name: "杠铃卧推", sets: 2, reps: 6, weight: 45, unit: "lb", seconds: 0 };
  const plan = { title: "力量", date: end, category: "力量训练", minutes: 40, video: "", shared: false, exercises: [move] };
  const session = training.startSession(plan, "plan", end);
  session.rows[0][0].done = true;
  const log = (id, date, owner = "self", kind = "log") => ({ id, kind, owner, updated: "", data: { ...session, date } });
  const records = [
    log("leap", "2024-02-29"), log("same-day", "2024-02-29"), log("start", "2023-03-04"),
    log("earlier", "2023-03-03"), log("future", "2024-03-03"),
    log("draft", end, "self", "draft"), log("partner", end, "partner"),
  ];
  const self = buildActivityCalendar(records, "self", end);
  assert.equal(self.from, "2023-03-04");
  assert.equal(self.blankDays, 6);
  assert.equal(self.weeks, 53);
  assert.equal(self.dates.length, 365);
  assert.equal(self.dates.at(-1).date, end);
  assert.equal(self.total, 3);
  assert.deepEqual(self.dates.find(({ date }) => date === "2024-02-29"), {
    date: "2024-02-29", sessions: 2, sets: 2, volume: 2 * 45 * 6 * 0.45359237, minutes: 0,
  });
  assert.equal(self.dates.at(-1).sessions, 0);
  assert.ok(self.months.some(({ id }) => id === "2024-03"));
  assert.equal(new Set(self.months.map(({ position }) => position)).size, self.months.length);
  const partner = buildActivityCalendar(records, "partner", end);
  assert.equal(partner.total, 1);
  assert.equal(partner.daily.get(end).sessions, 1);
});

test("activity colors use completed daily volume, bodyweight sets or recorded time", async () => {
  const { activityLevel, buildActivityCalendar } = await import("../features/stats/activity-model.ts");
  function log(id, date, weight, sets, minutes) {
    const plan = { title: "训练", date, category: sets ? "力量训练" : "有氧训练", minutes: 80, video: "", shared: false,
      exercises: sets ? [{ name: "卧推", sets: sets + 1, reps: 10, weight, unit: "kg", seconds: 0 }] : [] };
    const data = training.startSession(plan, "", date);
    data.minutes = minutes;
    data.rows[0]?.slice(0, sets).forEach((line) => { line.done = true; });
    return { id, kind: "log", owner: "self", updated: "", data };
  }
  const { daily } = buildActivityCalendar([
    log("short-a", "2024-04-01", 20, 1, 5), log("short-b", "2024-04-01", 20, 1, 5),
    log("heavy", "2024-04-02", 100, 2, 35),
    log("bodyweight", "2024-04-03", 0, 8, 20),
    log("cardio", "2024-04-04", 0, 0, 45),
    log("no-amount", "2024-04-05", 0, 0, 0),
  ], "self", "2024-04-05");
  assert.deepEqual(daily.get("2024-04-01"), { sessions: 2, sets: 2, volume: 400, minutes: 10 });
  assert.deepEqual(daily.get("2024-04-02"), { sessions: 1, sets: 2, volume: 2000, minutes: 35 });
  assert.deepEqual([...daily.values()].map(activityLevel), [1, 3, 2, 3, 0]);
});

test("backup scopes keep body measurements distinct from nutrition", async () => {
  const { backupSchema, emptyBackup, scopeBackup } = await import("../features/data/model.ts");
  const row = { kind: "nutrition", date: "2026-11-23", id: "a0014d9d-483e-4755-99f9-7fb75d53fa31" };
  const file = { ...emptyBackup(), library: [
    { ...row, entry: { type: "weight", kg: 74.2 } },
    { ...row, entry: { type: "measurement", metric: "waist", value: 78.4 } },
    { ...row, entry: { type: "water", ml: 500 } },
  ] };
  assert.equal(backupSchema.safeParse(file).success, true);
  assert.deepEqual(scopeBackup(file, "body").library.map((item) => item.entry.type), ["weight", "measurement"]);
  assert.deepEqual(scopeBackup(file, "nutrition").library.map((item) => item.entry.type), ["water"]);
  assert.equal(backupSchema.safeParse({ ...file, library: [{ ...row, entry: { type: "measurement", metric: "fat", value: 300 } }] }).success, false);
});

test("workout guidance covers custom variants and preserves Y-shaped exercise names", async () => {
  const { parsePlanMove } = await import("../features/exercises/move-name.ts");
  const { exerciseMuscles, researchedGuide } = await import("../features/exercises/guidance.ts");
  assert.equal(parsePlanMove("Y 字举臂弹力带侧向走").name, "Y 字举臂弹力带侧向走");
  assert.equal(parsePlanMove("A1 上斜俯卧哑铃展臂（试重）").name, "上斜俯卧哑铃展臂");
  assert.ok(researchedGuide("A1 上斜俯卧哑铃展臂").steps.length >= 3);
  assert.equal(exerciseMuscles("上斜俯卧哑铃展臂")["rear-delts"], 100);
  assert.equal(exerciseMuscles("杠杆式坐姿脚尖抬起", { target: "shins", muscles: {} }).tibialis, 100);
  assert.deepEqual(exerciseMuscles("放松呼吸"), {});
  assert.match(researchedGuide("站姿正握慢放弯举").steps.join(" "), /掌心/);
});

test("catalogue demos follow the selected exercise and apply only reviewed corrections", async () => {
  const { catalogueMotion } = await import("../features/exercises/motion-data.ts");
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const demo = (id) => catalogueMotion(rows.find((row) => row.id === id));
  for (const id of ["0025", "0047", "0176", "0289", "0314"]) assert.equal(demo(id).id, id);
  assert.equal(demo("0176").illustration, undefined);
  assert.ok(demo("6813").illustration.dynamic.some(([gear]) => gear === "barbell-end"));
  assert.equal(demo("8297").id, "0237");
  assert.equal(demo("0979").id, "1015");
  for (const id of ["1015", "1671", "8299", "11253", "3863", "2906", "4029", "2473", "7743", "3525", "5066", "0564", "5473"]) {
    assert.equal(demo(id).id, undefined);
    assert.ok(demo(id).illustration.frames.length > 1, id);
  }
});

test("catalogue cards use the same reviewed media as the selected exercise", async () => {
  const { catalogueDemo, catalogueCover } = await import("../features/exercises/catalogue-demo.ts");
  const { catalogueMotion } = await import("../features/exercises/motion-data.ts");
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  for (const row of rows) {
    const demo = catalogueDemo(row);
    const base = "/open-gym/spotter-3d/" + row.id;
    assert.equal(demo.video, base + ".mp4", row.id);
    assert.equal(catalogueCover(demo), base + ".jpg", row.id);
  }
  const { illustration } = catalogueMotion(rows.find(({ id }) => id === "2204"));
  assert.match(decodeURIComponent(catalogueCover({ illustration })), /^data:image\/svg\+xml,<svg/);
});

test("reviewed catalogue names keep existing workouts linked", async () => {
  const { fromCatalogue } = await import("../features/exercises/open-gym.ts");
  const catalog = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url), "utf8"));
  const oldNames = {
    "杠铃仰卧牧师凳弯举": "0059",
    "barbell lying preacher curl": "0059",
    "绳索上斜下压": "0172",
    "cable incline pushdown": "0172",
  };
  for (const [name, id] of Object.entries(oldNames)) {
    const row = catalog.rows.find((item) => item.id === id);
    assert.equal(fromCatalogue(catalog, { name }), row);
    assert.equal(fromCatalogue(catalog, { name: row.en }), row);
  }
});

test("exercise animations slow existing loops and keep plan variants distinct", async () => {
  const { exerciseMotion, slowFrameMs } = await import("../features/exercises/motion-data.ts");
  assert.equal(slowFrameMs(180), 360);
  assert.equal(exerciseMotion("上斜俯卧哑铃展臂", "上斜俯卧哑铃展臂").id, "0326");
  const single = exerciseMotion("哑铃单臂站姿锤式弯举", "哑铃单臂站姿锤式弯举", undefined, "1671", true);
  assert.equal(single.id, undefined);
  assert.notDeepEqual(single.illustration.frames[0][4], single.illustration.frames[1][4]);
  assert.deepEqual(single.illustration.frames[0][6], single.illustration.frames[1][6]);
  const pressdown = exerciseMotion("跪姿绳索三头下压", "跪姿绳索三头下压");
  assert.equal(pressdown.id, undefined);
  assert.deepEqual(pressdown.illustration.frames[0][2], pressdown.illustration.frames[1][2]);
  assert.notDeepEqual(pressdown.illustration.frames[0][4], pressdown.illustration.frames[1][4]);
  assert.equal(exerciseMotion("绳索跪姿三头肌伸展", "绳索跪姿三头肌伸展", undefined, "0176", true).id, "0176");
  assert.ok(exerciseMotion("跪姿过头绳索臂屈伸", "跪姿过头绳索臂屈伸").illustration);
  assert.equal(exerciseMotion("弹力带水平帕洛夫推举", "弹力带水平帕洛夫推举", undefined, "0979", true).id, "1015");
  assert.ok(exerciseMotion("Y 字举臂弹力带侧向走", "Y 字举臂弹力带侧向走").illustration);
});

test("today's merged poster uses only the owner's completed sets and selected heart data", async () => {
  const { shareHeart, shareSummary } = await import("../features/share/model.ts");
  const { researchedGuide } = await import("../features/exercises/guidance.ts");
  const plan = {
    title: "测试训练", date: "2026-11-23", category: "力量训练", minutes: 12, shared: false, video: "",
    exercises: [{ name: "跪姿绳索三头下压", sets: 2, reps: 10, weight: 40, unit: "lb", seconds: 0 }],
  };
  const first = training.startSession(plan, "plan", plan.date);
  const data = { ...first, minutes: 12, rows: [[{ ...first.rows[0][0], weight: 38.75, done: true }, first.rows[0][1]]] };
  const log = { id: "a", kind: "log", owner: "me", data };
  const scope = { log, owner: "me", merge: true, logs: [
    log, { ...log, id: "b" }, { ...log, id: "c", owner: "partner" },
    { ...log, id: "d", data: { ...data, date: "2026-11-22" } },
  ] };
  const summary = shareSummary(scope);
  assert.deepEqual(summary.workouts.map((workout) => workout.id), ["a", "b"]);
  assert.deepEqual(summary.workouts[0].moves[0].sets, ["38.75 lb × 10 次"]);
  assert.equal(summary.sets, 2);
  assert.equal(summary.minutes, 24);
  assert.ok(Math.abs(summary.volume - 775 * 0.45359237) < 0.01);
  assert.equal(researchedGuide(plan.exercises[0].name).muscles.triceps, 100);
  assert.equal(summary.primary.triceps, 2);
  const heart = { source: "apple", from: data.started, to: data.started + 1000, samples: [{ at: data.started, bpm: 125 }] };
  assert.deepEqual(shareHeart(scope, { a: heart, c: heart }).map(({ id, minimum }) => [id, minimum]), [["a", 125]]);
});

test("share headings use workout slots and all volume views count logged sides once", async () => {
  const { exerciseHistory } = await import("../features/exercises/history.ts");
  const { cleanPlan } = await import("../features/plans/model.ts");
  const { shareSummary } = await import("../features/share/model.ts");
  const { summarize } = await import("../features/stats/model.ts");
  const move = { sets: 1, reps: 8, weight: 10, unit: "kg", seconds: 0 };
  const raw = {
    title: "分侧练习", date: "2026-11-23", category: "力量训练", minutes: 20, shared: false, video: "",
    exercises: [
      { ...move, name: "W1 动态热身", weight: 0 },
      { ...move, name: "哑铃单臂卧推", block: "A", sourceSlot: "A1" },
      { ...move, name: "单臂推举", block: "A", sourceSlot: "A3" },
      { ...move, name: "绳索单臂划船", block: "A-2", sourceSlot: "A2" },
      { ...move, name: "哑铃飞鸟", block: "B", cue: "每手" },
      { ...move, name: "绳索三头下压", block: "C", cue: "双手共用一个配重" },
      { ...move, name: "后撤弓步回位接双绳索快推胸", block: "D", cue: "每侧换腿" },
      { ...move, name: "站姿单臂绳索下拉", cue: "仅做左侧" },
    ],
  };
  const plan = cleanPlan(raw).data;
  assert.equal(plan.exercises[0].sourceSlot, "W1");
  const started = training.startSession(plan, "plan", plan.date);
  const rows = started.rows.map(([line], i) => [{ ...line, done: i !== 2 }]);
  rows[3][0].right = { weight: 12, reps: 6 };
  rows[6][0].kind = "warmup";
  const data = { ...started, minutes: 20, rows };
  const log = { id: "a", kind: "log", owner: "me", data };
  const share = shareSummary({ log, logs: [], owner: "me", merge: false });
  const expected = 160 + 152 + 160 + 80 + 160 + 80;
  assert.equal(training.sessionTotals(data).volume, expected);
  assert.equal(summarize([log], [], "all").total.volume, expected);
  assert.equal(share.volume, expected);
  assert.equal(exerciseHistory("绳索单臂划船", [log], "me")[0].volume, 152);
  assert.equal(exerciseHistory("绳索单臂划船", [log], "me")[0].weight, 12);
  const moves = share.workouts[0].moves;
  assert.deepEqual(moves.map((item) => item.slot), ["W", "A1", "A3", "B1", "C1", "D1", undefined]);
  assert.deepEqual(moves[1].sets, ["10 kg × 8 次／侧"]);
  assert.deepEqual(moves[2].sets, ["左 10 kg × 8 · 右 12 kg × 6"]);
  assert.deepEqual(moves[5].sets, ["W · 10 kg × 8 次／侧"]);
  rows[3][0].right = { weight: 0, reps: 0 };
  assert.equal(training.sessionTotals(data).volume, expected - 72);
  rows[6][0].right = { weight: 9, reps: 8 };
  assert.equal(training.sessionTotals(data).volume, expected - 72 - 8);
});

test("share anatomy uses completed working volume, including load on both sides and overlapping muscle regions", async () => {
  const { shareSummary } = await import("../features/share/model.ts");
  const { summarize } = await import("../features/stats/model.ts");
  const move = { sets: 1, reps: 10, weight: 10, unit: "kg", seconds: 0 };
  const plan = {
    title: "容量测试", date: "2026-11-23", category: "力量训练", minutes: 30, shared: false, video: "",
    exercises: [
      { ...move, name: "卧推测试", catalogueId: "0011", weight: 40 },
      { ...move, name: "上斜卧推测试", catalogueId: "0012", weight: 20 },
      { ...move, name: "深蹲测试", catalogueId: "0013", sets: 3 },
      { ...move, name: "后撤弓步回位接双绳索快推胸" },
      { ...move, name: "自重测试", catalogueId: "0014", weight: 0 },
    ],
  };
  const catalogue = [
    { id: "0011", name: "卧推测试", en: "Flat press", muscles: { chest: 100 } },
    { id: "0012", name: "上斜卧推测试", en: "Incline press", muscles: { "upper-chest": 100, chest: 40 } },
    { id: "0013", name: "深蹲测试", en: "Squat", muscles: { quadriceps: 100 } },
    { id: "0014", name: "自重测试", en: "Bodyweight", muscles: { abs: 100, obliques: 40 } },
  ];
  const started = training.startSession(plan, "plan", plan.date);
  const rows = started.rows.map((lines) => lines.map((line) => ({ ...line, done: true })));
  rows[2][1] = { ...rows[2][1], weight: 100, kind: "warmup" };
  rows[2][2] = { ...rows[2][2], weight: 150, done: false };
  const data = { ...started, minutes: 30, rows };
  const log = { id: "work", kind: "log", owner: "me", data };
  const input = { log, logs: [], owner: "me", merge: false, catalogue };
  const summary = shareSummary(input);
  const { muscleWork } = summarize([log], catalogue, "all");
  assert.equal(muscleWork.get("upper-chest").loaded, 800);
  assert.equal(muscleWork.get("lower-chest").loaded, 680);
  assert.equal(muscleWork.get("quadriceps").loaded, 140);
  assert.equal(summary.muscles["upper-chest"], 100);
  assert.equal(summary.muscles.quadriceps, 17.5);
  assert.equal(summary.muscles.gluteal, 5);
  assert.equal(summary.muscles.abs, 34);
  assert.equal(summary.muscles.hamstring, undefined);

  const bodyLog = { ...log, data: { ...data, rows: data.rows.map((lines, i) =>
    lines.map((line) => ({ ...line, done: i === 4 }))) } };
  const body = shareSummary({ ...input, log: bodyLog });
  assert.equal(body.volume, 0);
  assert.equal(body.muscles.abs, 100);
  assert.ok(body.muscles.obliques < 35);
});

test("the share poster uses both anatomy views for the selected subject's figure", async () => {
  const { drawShareAnatomy } = await import("../features/share/anatomy-poster.ts");
  const geometry = JSON.parse(readFileSync(new URL("public/open-gym/anatomy.json", root), "utf8"));
  const drawn = new Set();
  const noop = () => {};
  const ctx = { save: noop, restore: noop, translate: noop, scale: noop, stroke: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, fillText: noop, measureText: () => ({ width: 22 }),
    fill: (path) => drawn.add(path.source) };
  const oldPath = globalThis.Path2D;
  globalThis.Path2D = class { constructor(source) { this.source = source; } };
  try {
    for (const sex of ["female", "male"]) {
      drawn.clear();
      drawShareAnatomy(ctx, geometry, {}, { x: 0, y: 0, width: 350, height: 260 }, "#fff", "sans-serif", sex);
      const front = geometry[`${sex}-front`].regions["upper-chest"][0];
      const back = geometry[`${sex}-back`].regions.lats[0];
      const other = sex === "female" ? "male" : "female";
      assert.ok(drawn.has(front) && drawn.has(back));
      assert.equal(drawn.has(geometry[`${other}-front`].regions["upper-chest"][0]), false);
    }
  } finally {
    if (oldPath === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = oldPath;
  }
});

test("optional protein preferences and check-ins survive private backups", async () => {
  const { withoutProteinShake } = await import("../features/training/protein.ts");
  const { libraryItem } = await import("../features/library/model.ts");
  const { backupSchema, emptyBackup, libraryKey, scopeBackup } = await import("../features/data/model.ts");
  const plan = {
    title: "训练", date: "2026-11-23", category: "力量训练", minutes: 10, shared: false, video: "",
    exercises: [{ name: "哑铃卧推", sets: 1, reps: 8, weight: 10, unit: "kg", seconds: 0 }],
  };
  const id = "e780ae49-7d6b-4c38-8ee0-2802b35fd70c";
  const legacy = training.startSession(plan, id, plan.date);
  assert.equal(training.sessionSchema.parse(legacy).proteinShake, undefined);
  const data = { ...legacy, proteinShake: true, rows: [[{ ...legacy.rows[0][0], done: true }]] };
  assert.equal(training.sessionSchema.parse({ ...data, proteinShake: false }).proteinShake, false);
  assert.deepEqual(withoutProteinShake(data), { ...legacy, rows: data.rows });
  assert.equal(data.proteinShake, true);

  const enabled = libraryItem.parse({ kind: "protein-preference", enabled: true });
  assert.equal(libraryKey(enabled), libraryKey({ ...enabled, enabled: false }));
  const backup = backupSchema.parse({ ...emptyBackup(), library: [enabled], training: [{ kind: "log", id, data }] });
  assert.equal(scopeBackup(backup, "training").training[0].data.proteinShake, true);
  assert.deepEqual(scopeBackup(backup, "training").library, [enabled]);
  assert.deepEqual(scopeBackup(backup, "nutrition").library, []);
});
