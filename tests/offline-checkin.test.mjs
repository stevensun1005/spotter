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
  if (specifier === "../../chatgpt-auth" && context.parentURL?.endsWith("/app/api/workout/route.ts")) {
    return mocked('export async function getChatGPTUser() { return { userId: globalThis[Symbol.for("spotter-offline-checkin-test")].owner, email: "offline-example@example.com" }; }');
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
