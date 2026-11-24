import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".ts")) return next(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    return { format: "module", source, shortCircuit: true };
  },
});

test("Apple device sync uses private, scoped, retryable records", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "spotter-health-"));
  process.env.SPOTTER_DB_PATH = join(directory, "synthetic.sqlite");
  process.env.SPOTTER_ORIGIN = "http://127.0.0.1:3077";
  const { database } = await import("../server/db.ts");
  const apple = await import("../features/heart/apple/server.ts");
  const health = await import("../features/health/server.ts");
  const { healthBatchSchema } = await import("../features/health/model.ts");
  const { readHeart, saveHeart, removeHeart } = await import("../features/heart/server.ts");
  const pairRoute = await import("../app/api/health/apple/pair/route.ts");
  const syncRoute = await import("../app/api/health/apple/sync/route.ts");
  const recordsRoute = await import("../app/api/health/apple/records/route.ts");
  const db = database();
  t.after(async () => { db.close(); delete globalThis.spotterDb; await rm(directory, { recursive: true, force: true }); });
  const owner = randomUUID();
  const other = randomUUID();
  for (const [id, username] of [[owner, "synthetic-owner"], [other, "synthetic-other"]]) {
    db.prepare("INSERT INTO accounts (id, username, name, password_hash) VALUES (?, ?, ?, ?)").run(id, username, username, "synthetic-unused");
  }
  const origin = process.env.SPOTTER_ORIGIN;
  const req = (path, token, body, method = body ? "POST" : "GET") => new Request(origin + path, {
    method, headers: { ...(token && { Authorization: "Bearer " + token }), ...(body && { Origin: origin, "Content-Type": "application/json" }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  const fail = (status) => (error) => error?.status === status;
  let token;

  await t.test("codes expire and are single use; re-pairing revokes the old device", async () => {
    const expired = apple.issueAppleCode(owner);
    db.prepare("UPDATE apple_health_link SET code_expires = ? WHERE owner = ?").run(Date.now() - 1, owner);
    assert.equal((await pairRoute.POST(req("/api/health/apple/pair", null, { code: expired.code }))).status, 401);
    const issued = apple.issueAppleCode(owner);
    const response = await pairRoute.POST(req("/api/health/apple/pair", null, { code: issued.code }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    token = (await response.json()).token;
    assert.equal(apple.appleDeviceOwner(req("/", token)), owner);
    assert.throws(() => apple.claimAppleCode(issued.code), fail(401));
    const replacement = apple.issueAppleCode(owner);
    const oldToken = token;
    token = apple.claimAppleCode(replacement.code);
    assert.throws(() => apple.appleDeviceOwner(req("/", oldToken)), fail(401));
    const link = db.prepare("SELECT * FROM apple_health_link WHERE owner = ?").get(owner);
    assert.equal(link.code_hash, null);
    assert.notEqual(link.token_hash, token);
    assert.equal(JSON.stringify(link).includes(token), false);
  });

  const start = Date.parse("2026-11-22T14:00:00-05:00");
  const second = start + 4 * 3_600_000;
  const midnight = Date.parse("2026-11-22T23:50:00-05:00");
  const plan = { title: "合成训练", date: "2026-11-22", minutes: 30, category: "力量训练", shared: false, video: "", exercises: [] };
  function addLog(account, from, to = from + 30 * 60_000) {
    const id = randomUUID();
    const session = { plan, planId: "", date: "2026-11-22", started: from, ended: to, minutes: 1, note: "合成数据", finishedVideo: false, rows: [] };
    db.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, 'log', ?, ?)").run(account, id, JSON.stringify(session), new Date().toISOString());
    return id;
  }
  const firstId = addLog(owner, start);
  const secondId = addLog(owner, second);
  const midnightId = addLog(owner, midnight);
  const otherId = addLog(other, start);
  const heart = (from) => ({ source: "apple", from: from + 1000, to: from + 2000, minimum: 110, average: 120, maximum: 130,
    sourceName: "Synthetic Watch", sourceBundleId: "test.watch", samples: [{ at: from + 1000, bpm: 110 }, { at: from + 2000, bpm: 130 }] });
  const query = (suffix = "") => req("/api/health/apple/sync?from=" + start + "&to=" + (midnight + 3_600_000) + suffix, token);

  await t.test("same-day sessions use actual ends; pagination and UTC survive midnight", async () => {
    const page = apple.pendingAppleWorkouts(owner, query("&limit=1"));
    assert.equal(page.workouts[0].id, midnightId);
    assert.equal(page.workouts[0].to, midnight + 30 * 60_000);
    assert.ok(page.nextCursor);
    const next = apple.pendingAppleWorkouts(owner, query("&limit=1&cursor=" + page.nextCursor));
    assert.equal(next.workouts[0].id, secondId);
    const last = apple.pendingAppleWorkouts(owner, query("&limit=1&cursor=" + next.nextCursor));
    assert.equal(last.workouts[0].id, firstId);
    assert.equal(last.nextCursor, null);
    assert.throws(() => apple.pendingAppleWorkouts(owner, query("&cursor=invalid")), fail(400));
    assert.throws(() => apple.pendingAppleWorkouts(owner, req("/api/health/apple/sync?from=0&to=" + Date.now(), token)), fail(400));
  });

  await t.test("native uploads reject other accounts and mismatched sessions; retries do not duplicate", async () => {
    assert.equal((await syncRoute.POST(req("/api/health/apple/sync", token, { id: otherId, data: heart(start) }))).status, 404);
    assert.equal((await syncRoute.POST(req("/api/health/apple/sync", token, { id: secondId, data: heart(start) }))).status, 400);
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: heart(start) }), true);
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: heart(start) }), false);
    const delayed = heart(start);
    delayed.to += 1000;
    delayed.samples.push({ at: delayed.to, bpm: 120 });
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: delayed }), true);
    assert.deepEqual(readHeart(owner, firstId).samples, delayed.samples);
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: heart(start) }), false);
    assert.deepEqual(readHeart(owner, firstId).samples, delayed.samples);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM workout_heart WHERE owner = ?").get(owner).n, 1);
    assert.equal(readHeart(other, otherId), null);
  });

  await t.test("manual import remains authoritative after a previous native upload", () => {
    saveHeart(owner, firstId, { ...heart(start), source: "fit" });
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: heart(start) }), false);
    assert.equal(readHeart(owner, firstId).source, "fit");
    removeHeart(owner, firstId);
    assert.equal(apple.attachAppleHeart(owner, { id: firstId, data: heart(start) }), true);
  });

  const dayFrom = Date.parse("2026-11-22T00:00:00-05:00");
  const dayTo = dayFrom + 86_400_000;
  const provenance = { sourceName: "Synthetic HealthKit merged", sourceId: "healthkit.statistics" };
  const batch = {
    selected: ["bodyMass", "workouts", "steps", "activeEnergy", "exerciseTime"], from: dayFrom, to: dayTo + 86_400_000, timeZone: "America/Toronto",
    bodyMass: [{ id: randomUUID(), at: start, value: 176.3698097479, unit: "lb", ...provenance }],
    workouts: [{ id: randomUUID(), from: midnight, to: midnight + 30 * 60_000, activity: "Traditional strength training", durationSeconds: 1800, activeEnergyKcal: 150, ...provenance }],
    activity: [{ date: "2026-11-22", from: dayFrom, to: dayTo, steps: 8000, activeEnergyKcal: 450, exerciseMinutes: 30, ...provenance }],
  };

  await t.test("selected types, dates, IANA zones and numeric ranges are validated", () => {
    assert.ok(healthBatchSchema.safeParse(batch).success);
    assert.equal(healthBatchSchema.safeParse({ ...batch, selected: ["steps"] }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, timeZone: "not/a-zone" }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, activity: [{ ...batch.activity[0], date: "2026-11-23" }] }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, bodyMass: [{ ...batch.bodyMass[0], at: dayFrom - 1 }] }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, to: dayFrom + 32 * 86_400_000 }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, activity: [{ ...batch.activity[0], steps: -1 }] }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, activity: [...batch.activity, ...batch.activity] }).success, false);
    assert.equal(healthBatchSchema.safeParse({ ...batch, bodyMass: [...batch.bodyMass, { ...batch.bodyMass[0], id: batch.bodyMass[0].id.toUpperCase() }] }).success, false);
    const dstFrom = Date.parse("2026-11-01T00:00:00-04:00");
    const dstTo = Date.parse("2026-11-02T00:00:00-05:00");
    assert.ok(healthBatchSchema.safeParse({ selected: ["steps"], from: dstFrom, to: dstTo, timeZone: "America/Toronto",
      activity: [{ ...batch.activity[0], date: "2026-11-01", from: dstFrom, to: dstTo, activeEnergyKcal: undefined, exerciseMinutes: undefined }],
    }).success);
  });

  await t.test("body mass converts to kg; activities replace totals and workouts enrich existing logs", async () => {
    const logsBefore = db.prepare("SELECT COUNT(*) AS n FROM entries WHERE kind = 'log'").get().n;
    const first = await recordsRoute.POST(req("/api/health/apple/records", token, batch));
    assert.equal(first.status, 200);
    assert.equal((await first.json()).saved, 3);
    const retry = health.saveHealthBatch(owner, healthBatchSchema.parse(batch));
    assert.equal(retry.saved, 0);
    assert.equal(retry.skipped, 3);
    const overview = health.healthOverview(owner);
    assert.ok(Math.abs(overview.bodyMass[0].kg - 80) < 0.00001);
    assert.equal(overview.workouts[0].matchedWorkoutId, midnightId);
    assert.equal(overview.activity[0].steps, 8000);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM entries WHERE kind = 'log'").get().n, logsBefore);
    const revised = { ...batch, activity: [{ ...batch.activity[0], steps: 9000 }] };
    health.saveHealthBatch(owner, healthBatchSchema.parse(revised));
    assert.equal(health.healthOverview(owner).activity[0].steps, 9000);
    const justEnergy = { selected: ["activeEnergy"], from: batch.from, to: batch.to, timeZone: batch.timeZone,
      activity: [{ date: "2026-11-22", from: dayFrom, to: dayTo, activeEnergyKcal: 460, ...provenance }] };
    health.saveHealthBatch(owner, healthBatchSchema.parse(justEnergy));
    assert.equal(health.healthOverview(owner).activity[0].steps, 9000);
    assert.equal(health.healthOverview(owner).activity[0].activeEnergyKcal, 460);
    assert.deepEqual(health.healthOverview(other), { bodyMass: [], activity: [], workouts: [] });
    assert.equal(health.lastHealthSync(other), null);
  });

  await t.test("cross-source workout copies share one view without summing energy or adding logs", () => {
    const duplicate = { ...batch.workouts[0], id: randomUUID(), sourceName: "Synthetic second app", sourceId: "test.second-app" };
    health.saveHealthBatch(owner, healthBatchSchema.parse({ ...batch, bodyMass: [], activity: [], workouts: [duplicate] }));
    let workouts = health.healthOverview(owner).workouts;
    assert.equal(workouts.length, 1);
    assert.equal(workouts[0].activeEnergyKcal, 150);
    assert.deepEqual(new Set(workouts[0].sourceNames), new Set([provenance.sourceName, duplicate.sourceName]));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM health_workout WHERE owner = ?").get(owner).n, 2);
    const sameSource = { ...batch.workouts[0], id: randomUUID() };
    health.saveHealthBatch(owner, healthBatchSchema.parse({ ...batch, bodyMass: [], activity: [], workouts: [sameSource] }));
    workouts = health.healthOverview(owner).workouts;
    assert.equal(workouts.length, 2, "distinct records from the same source must not be silently collapsed");
    const ambiguousId = addLog(owner, midnight + 1000, midnight + 30 * 60_000);
    assert.ok(ambiguousId);
    assert.ok(health.healthOverview(owner).workouts.every((record) => record.matchedWorkoutId === null));
  });

  await t.test("sync status distinguishes selected types from actual readable data", async () => {
    const report = { action: "report", from: dayFrom, to: dayTo, selected: ["heartRate", "bodyMass"], received: ["bodyMass"], saved: 0, skipped: 1, empty: false };
    const result = await syncRoute.POST(req("/api/health/apple/sync", token, report));
    assert.equal(result.status, 200);
    assert.deepEqual(health.lastHealthSync(owner).emptyTypes, ["heartRate"]);
    assert.deepEqual(health.lastHealthSync(owner).received, ["bodyMass"]);
    const none = { ...report, saved: 0, skipped: 0, empty: true, received: [] };
    assert.equal((await syncRoute.POST(req("/api/health/apple/sync", token, none))).status, 200);
    assert.equal(health.lastHealthSync(owner).result, "empty");
    assert.equal((await syncRoute.POST(req("/api/health/apple/sync", token, { ...report, selected: ["steps"] }))).status, 400);
    assert.equal((await syncRoute.POST(req("/api/health/apple/sync", token, { ...report, empty: true }))).status, 400);
  });

  await t.test("empty imports are actionable; reconnect and disconnect isolate both accounts", async () => {
    const result = health.saveHealthBatch(owner, healthBatchSchema.parse({ selected: ["bodyMass"], from: dayFrom, to: dayTo, timeZone: "America/Toronto" }));
    assert.equal(result.result, "empty");
    assert.equal(result.saved, 0);
    const otherToken = apple.claimAppleCode(apple.issueAppleCode(other).code);
    assert.equal(apple.appleDeviceOwner(req("/", otherToken)), other);
    const malformed = new Request(origin + "/api/health/apple/records", { method: "POST", headers: { Authorization: "Bearer " + token, Origin: "https://untrusted.invalid", "Content-Type": "application/json" }, body: JSON.stringify(batch) });
    assert.equal((await recordsRoute.POST(malformed)).status, 403);
    assert.equal((await syncRoute.DELETE(req("/api/health/apple/sync", token, {}, "DELETE"))).status, 200);
    assert.equal((await syncRoute.GET(req("/api/health/apple/sync", token))).status, 401);
    assert.equal((await recordsRoute.POST(req("/api/health/apple/records", token, batch))).status, 401);
    assert.equal(apple.appleDeviceOwner(req("/", otherToken)), other);
    assert.equal(apple.appleConnection(other), true);
  });
});
