import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const boundary = Symbol.for("spotter-offline-checkin-test");
const worker = { owner: "member:a", env: {} };
globalThis[boundary] = worker;
const mocked = (code) => ({ url: "data:text/javascript," + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return mocked('export const env = globalThis[Symbol.for("spotter-offline-checkin-test")].env;');
  }
  if ((specifier === "../../chatgpt-auth" && context.parentURL?.endsWith("/app/api/workout/route.ts")) || specifier === "@/app/chatgpt-auth") {
    return mocked('export async function getChatGPTUser() { const userId = globalThis[Symbol.for("spotter-offline-checkin-test")].owner; return userId ? { userId, email: "offline-example@example.com" } : null; }');
  }
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });

const { POST } = await import("../app/api/workout/route.ts");
const {
  finalizeCheckin, hasWorkoutCheckinKey, isCheckinQueued, mergePendingCheckins, queueCheckin, readCheckins, replayCheckin,
} = await import("../features/training/checkin-outbox.ts");
const { draftSessionSchema, sessionSchema, startFreeSession, startSession } = await import("../features/training/model.ts");
const { crossedRestDeadline, restReminderMode } = await import("../features/training/rest-reminder.ts");

const owner = "member:a";
const another = "member";
const logId = "03f1eaab-2612-4955-8c54-f3246ec7ebc4";
const secondId = "e1815a88-0139-43a4-a975-0d08b386e0ca";
const plan = {
  title: "离线训练", date: "2026-11-23", minutes: 0, category: "力量训练", shared: false, video: "",
  exercises: [{ name: "哑铃卧推", sets: 1, reps: 10, weight: 20, unit: "kg", seconds: 0 }],
};
const start = new Date(2026, 10, 23, 23, 56).getTime();
const end = new Date(2026, 10, 24, 0, 1).getTime();
function workout(done = true) {
  const session = startSession(plan, "", plan.date);
  session.started = start;
  session.clock = { elapsed: 0, runningSince: start };
  session.rows[0][0].done = done;
  return session;
}

function memoryStorage() {
  const items = new Map();
  return {
    get length() { return items.size; },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, data) => items.set(key, data),
    removeItem: (key) => items.delete(key),
  };
}

function database(t) {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE entries (owner TEXT, id TEXT, kind TEXT, payload TEXT, updated TEXT, PRIMARY KEY(owner, id))");
  worker.env.DB = {
    prepare(query) {
      const statement = sql.prepare(query);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return { meta: { changes: statement.run(...values).changes } }; },
      };
    },
  };
  t.after(() => { worker.env.DB = undefined; sql.close(); });
  return sql;
}

function request(body) {
  return new Request("https://spotter.example/api/workout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

test("queued check-ins keep tap-time date, duration and distinct keys for same-browser accounts", () => {
  const storage = memoryStorage();
  const receipt = finalizeCheckin(workout(), end);
  assert.equal(receipt.data.date, "2026-11-24");
  assert.equal(receipt.data.ended, end);
  assert.equal(receipt.data.minutes, 5);
  assert.equal(receipt.data.clock.runningSince, null);
  assert.throws(() => finalizeCheckin(workout(false), end), /至少完成一组/);

  const first = queueCheckin(storage, owner, logId, receipt);
  const next = queueCheckin(storage, owner, logId, finalizeCheckin(workout(), end + 180_000));
  assert.deepEqual(next, first);
  queueCheckin(storage, owner, secondId, receipt);
  queueCheckin(storage, another, logId, receipt);
  assert.deepEqual(readCheckins(storage, owner).map((row) => row.id), [logId, secondId]);
  assert.deepEqual(readCheckins(storage, another).map((row) => [row.owner, row.id]), [[another, logId]]);
  assert.equal(hasWorkoutCheckinKey(another, storage.key(0)), false);
  assert.equal(hasWorkoutCheckinKey(owner, storage.key(0)), true);
  assert.equal(isCheckinQueued(storage, owner, logId), true);

  const old = { ...first, kind: "draft" };
  const other = { ...first, owner: another };
  assert.deepEqual(mergePendingCheckins([old, other], readCheckins(storage, owner), owner)
    .map((entry) => [entry.owner, entry.id, entry.kind]),
    [[owner, logId, "log"], [owner, secondId, "log"], [another, logId, "log"]]);
  assert.equal(mergePendingCheckins([first], [first], owner)[0], first);
});

test("real log endpoint retries lost replies by UUID and rejects wrong-account drafts or check-ins", async (t) => {
  const sql = database(t);
  const storage = memoryStorage();
  const queued = queueCheckin(storage, owner, logId, finalizeCheckin(workout(), end));
  worker.owner = another;
  for (const action of ["draft", "log"]) {
    const response = await POST(request({ action, expectedOwner: owner, id: logId, data: queued.data }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "account_mismatch");
  }
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 0);
  await assert.rejects(replayCheckin(storage, owner, logId, async (body) => {
    const response = await POST(request({ action: "log", ...body }));
    assert.equal(response.status, 403);
    throw new Error("switch account");
  }), /switch account/);
  assert.equal(isCheckinQueued(storage, owner, logId), true);

  worker.owner = owner;
  const existingDraft = await POST(request({ action: "draft", id: logId, data: workout() }));
  assert.equal(existingDraft.status, 200);
  await assert.rejects(replayCheckin(storage, owner, logId, async (body) => {
    const response = await POST(request({ action: "log", ...body }));
    assert.equal(response.status, 200);
    throw new Error("reply lost after save");
  }), /reply lost after save/);
  assert.equal(isCheckinQueued(storage, owner, logId), true);
  const first = sql.prepare("SELECT payload, updated FROM entries WHERE owner = ? AND id = ?").get(owner, logId);
  const receipt = await replayCheckin(storage, owner, logId, async (body) => {
    assert.equal(body.expectedOwner, owner);
    assert.equal(body.id, logId);
    assert.equal(body.data.ended, end);
    const response = await POST(request({ action: "log", ...body }));
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.deepEqual(receipt.data, JSON.parse(first.payload));
  assert.equal(receipt.updated, first.updated);
  assert.equal(isCheckinQueued(storage, owner, logId), false);
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 1);
  const lateDraft = await POST(request({ action: "draft", expectedOwner: owner, id: logId, data: workout() }));
  assert.equal(lateDraft.status, 409);
  assert.equal(await replayCheckin(storage, owner, logId, () => assert.fail("synced queue should be empty")), undefined);
});

test("incline walks keep exact workout time, machine units and zero-percent grades through checkout, replay and historical edits", async (t) => {
  database(t);
  worker.owner = owner;
  const draft = startFreeSession(plan.date, "incline");
  draft.started = start;
  draft.clock = { elapsed: 37_000, runningSince: null };
  draft.cardio.incline = { kind: "level", value: 6.5 };
  draft.cardio.distanceKm = 0.72;
  draft.cardio.speedKmh = 5.1;
  assert.equal(draftSessionSchema.safeParse(draft).success, true);
  assert.equal(sessionSchema.safeParse(draft).success, false);
  assert.equal((await POST(request({ action: "draft", id: logId, expectedOwner: owner, data: draft }))).status, 200);
  const storage = memoryStorage();
  const receipt = finalizeCheckin(draft, end);
  assert.equal(receipt.data.cardio.durationSeconds, 37);
  assert.deepEqual(receipt.data.rows, []);
  assert.equal(receipt.data.minutes, 1);
  assert.equal(finalizeCheckin({ ...draft, cardio: { ...draft.cardio, durationSeconds: 245 } }, end).data.minutes, 4);
  assert.throws(() => finalizeCheckin({ ...draft, clock: { elapsed: 0, runningSince: null } }, end), /记录有氧训练时长/);
  assert.equal(draftSessionSchema.safeParse({ ...draft, cardio: { ...draft.cardio, incline: { kind: "level", value: -2.5 } } }).success, false);

  queueCheckin(storage, owner, logId, receipt);
  const saved = await replayCheckin(storage, owner, logId, async (body) => {
    const response = await POST(request({ action: "log", ...body }));
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.deepEqual(saved.data.cardio, { ...draft.cardio, durationSeconds: 37 });
  const changes = { ...saved.data, minutes: 4, cardio: { ...saved.data.cardio, durationSeconds: 245, incline: { kind: "percent", value: 0 } } };
  const updated = await POST(request({ action: "editLog", id: logId, revision: saved.updated, data: changes }));
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).data.cardio, changes.cardio);
  const { backupSchema, emptyBackup } = await import("../features/data/model.ts");
  const restored = backupSchema.parse({ ...emptyBackup(), training: [{ kind: "log", id: logId, data: changes }] });
  assert.deepEqual(restored.training[0].data.cardio, changes.cardio);
});

test("a rest reminder crosses only its active deadline once", () => {
  assert.equal(restReminderMode("sound"), "sound");
  assert.equal(restReminderMode("unknown"), "visual");
  const before = { until: 5000, elapsed: 4900 };
  const after = { until: 5000, elapsed: 5000 };
  assert.equal(crossedRestDeadline(undefined, after), false);
  assert.equal(crossedRestDeadline(before, before), false);
  assert.equal(crossedRestDeadline(before, after), true);
  assert.equal(crossedRestDeadline(after, after), false);
  assert.equal(crossedRestDeadline(before, { until: undefined, elapsed: 5000 }), false);
  assert.equal(crossedRestDeadline(before, { until: 5010, elapsed: 5010 }), false);
});

test("CSV export is account-scoped, date-filtered and safe for spreadsheets", async (t) => {
  const { GET } = await import("../app/api/data/route.ts");
  const sql = database(t);
  sql.exec("CREATE TABLE personal_library (owner TEXT, id TEXT, kind TEXT, day TEXT, payload TEXT)");
  const addTraining = sql.prepare("INSERT INTO entries (owner,id,kind,payload) VALUES (?,?,?,?)");
  const date = "2026-11-24";
  const started = Date.parse("2026-11-24T19:00:00Z");
  const strength = workout();
  strength.date = date;
  strength.started = started;
  strength.ended = started + 1_200_000;
  strength.minutes = 20;
  strength.plan = { ...plan, title: "\u200b ＝SUM(\"1,2\")", exercises: [{ ...plan.exercises[0], sets: 3, block: "A", sourceSlot: "A1" }] };
  strength.rows = [[{ ...strength.rows[0][0], kind: "warmup", seconds: 25, rpe: 7, right: { weight: 21, reps: 9 } },
    { weight: 20, reps: 99, seconds: 0, done: false }, { weight: 10, reps: 5, seconds: 0, kind: "drop", done: true }]];
  addTraining.run(owner, "STRENGTH", "log", JSON.stringify(strength));
  addTraining.run(owner, "DRAFT", "draft", JSON.stringify(strength));
  addTraining.run(another, "OTHER_ACCOUNT", "log", JSON.stringify(strength));
  addTraining.run(owner, "OLDER", "log", JSON.stringify({ ...strength, date: "2026-11-23" }));
  const cardio = { ...startFreeSession(date, "incline"), started: started + 3_600_000, minutes: 4,
    cardio: { activity: "incline-walk", durationSeconds: 245, distanceKm: 0.4, speedKmh: 5.8, incline: { kind: "percent", value: -5 } } };
  addTraining.run(owner, "CARDIO", "log", JSON.stringify(cardio));
  const video = { ...startFreeSession(date), started: started + 7_200_000, finishedVideo: true,
    plan: { ...plan, category: "跟练视频", title: "已完成跟练", video: "https://youtu.be/example", exercises: [] } };
  addTraining.run(owner, "VIDEO", "log", JSON.stringify(video));
  const addBody = sql.prepare("INSERT INTO personal_library VALUES (?,?,'nutrition',?,?)");
  const body = (person, id, day, entry) => addBody.run(person, id, day, JSON.stringify({ kind: "nutrition", id, date: day, entry }));
  body(owner, "WEIGHT", date, { type: "weight", kg: 73.4 });
  body(owner, "WAIST", date, { type: "measurement", metric: "waist", value: 82.5 });
  body(another, "OTHER_BODY", date, { type: "weight", kg: 60 });
  body(owner, "OLDER_BODY", "2026-11-23", { type: "weight", kg: 65 });
  body(owner, "WATER", date, { type: "water", ml: 250 });
  const download = (scope, format = "csv") =>
    GET(new Request("https://spotter.example/api/data?format=" + format + "&scope=" + scope + "&from=" + date + "&to=" + date));
  worker.owner = undefined;
  assert.equal((await download("training")).status, 401);
  worker.owner = owner;
  const response = await download("training");
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition"), /attachment; filename=spotter-training-.+\.csv$/);
  const csv = Buffer.from(await response.arrayBuffer()).toString("utf8");
  assert.ok(csv.startsWith("\uFEFF\"日期\""));
  const [header, warmup, drop, aerobic, followed] = csv.trimEnd().split("\r\n");
  assert.match(header, /"重量单位".*"RPE".*"循环组别"/);
  assert.ok(warmup.includes("\"'\u200b ＝SUM(\"\"1,2\"\")\""));
  assert.match(warmup, /"2026-11-24T19:00:00.000Z".*1,"热身",20,"kg",10,21,9,7,25,"A","A1"/);
  assert.match(drop, /"STRENGTH".*3,"递减",10,"kg",5/);
  assert.match(aerobic, /"CARDIO".*"爬坡走",245,0\.4,5\.8,-5,"%","有氧记录"/);
  assert.match(followed, /"VIDEO".*"是".*"视频跟练"/);
  assert.equal(csv.trimEnd().split("\r\n").length, 5);
  assert.doesNotMatch(csv, /OTHER_ACCOUNT|DRAFT|OLDER|,99,/);

  const measurements = await (await download("body")).text();
  assert.match(measurements, /"WEIGHT","体重",73\.4,"kg"/);
  assert.match(measurements, /"WAIST","腰围",82\.5,"cm"/);
  assert.doesNotMatch(measurements, /OTHER_BODY|OLDER_BODY|WATER|STRENGTH/);
  assert.equal((await download("nutrition")).status, 400);
  const json = await download("body", "json");
  assert.equal(json.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal((await json.json()).library.length, 2);
});
