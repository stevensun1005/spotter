import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

async function availablePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((err) => err ? reject(err) : resolve()));
  return port;
}

test("independent app auth, pairing, sharing and persistence", { timeout: 45_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "spotter-test-"));
  const db = join(directory, "test.sqlite");
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const code = randomBytes(16).toString("hex");
  const password = randomBytes(18).toString("hex");
  let server;
  let output = "";
  const stop = async () => {
    if (!server || server.exitCode !== null) return;
    const ended = once(server, "exit");
    server.kill();
    await ended;
  };
  t.after(async () => {
    await stop();
    for (const filename of await readdir(directory)) await unlink(join(directory, filename));
    await rmdir(directory);
  });
  const start = async () => {
    output = "";
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", SPOTTER_ORIGIN: base, SPOTTER_DB_PATH: db, SPOTTER_SETUP_CODE: code,
        WHOOP_CLIENT_ID: "test-only", WHOOP_CLIENT_SECRET: randomBytes(24).toString("hex") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { output += data; });
    for (let tries = 0; tries < 100; tries++) {
      if (server.exitCode !== null) break;
      const response = await fetch(base + "/api/state", { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.status === 401) return;
      await delay(120);
    }
    assert.fail("Production server failed to start. Run npm run build before npm test.\n" + output);
  };
  const request = (route, cookie, data, origin = base) => fetch(base + "/api/" + route, {
    method: data ? "POST" : "GET",
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(data && { Origin: origin, "Content-Type": "application/json" }),
    },
    body: data && JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  const expect = async (route, cookie, data, status = 200, origin) => {
    const result = await request(route, cookie, data, origin);
    assert.equal(result.status, status, await result.clone().text());
    return result;
  };
  const state = async (cookie) => (await expect("state", cookie)).json();
  const signup = (username, invite) => ({ username, name: username, password, invite });
  const cookie = (response) => {
    const header = response.headers.get("set-cookie");
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=lax/i);
    return header.split(";")[0];
  };

  await start();
  await expect("state", null, null, 401);
  const open = await fetch(base);
  assert.match(await open.text(), /登录训练搭子/);
  await expect("auth/register", null, signup("owner", "0".repeat(32)), 403);
  await expect("auth/register", null, signup("owner", code), 403, "https://other.example");
  const owner = cookie(await expect("auth/register", null, signup("owner", code)));
  const dashboard = await fetch(base, { headers: { Cookie: owner } });
  assert.equal(dashboard.status, 200, output);
  assert.ok((await dashboard.text()).includes("今天练什么"), output);
  await expect("auth/register", null, signup("duplicate-setup", code), 403);
  await expect("partner", owner, { action: "create" });
  const { room: { invite }, me: ownerAccount } = await state(owner);
  const partner = cookie(await expect("auth/register", null, signup("partner", invite)));
  await expect("auth/register", null, signup("uninvited", invite), 403);
  assert.equal((await state(partner)).room.partner.id, ownerAccount.id);
  assert.equal((await state(owner)).room.invite, null);

  const date = new Date().toISOString().slice(0, 10);
  const plan = {
    title: "卧推", date, category: "力量训练", minutes: 35, shared: false, video: "",
    exercises: [{ name: "哑铃卧推", sets: 1, reps: 8, weight: 10, unit: "kg", seconds: 0 }],
  };
  const privatePlan = randomUUID();
  const sharedPlan = randomUUID();
  await expect("plans", owner, { items: [
    { id: privatePlan, data: plan }, { id: sharedPlan, data: { ...plan, shared: true } },
  ] });
  const importFile = join(directory, "agent-plans.json");
  await writeFile(importFile, JSON.stringify([{ ...plan, title: "自动套用计划格式" }]));
  const autoImport = (...args) => JSON.parse(execFileSync(process.execPath, [
    "tools/import-plans.mjs", "--user", "owner", importFile, ...args,
  ], { encoding: "utf8", env: { ...process.env, SPOTTER_DB_PATH: db } }));
  assert.equal(autoImport("--dry-run").added, 1);
  assert.ok(!(await state(owner)).entries.some((row) => row.data.title === "自动套用计划格式"));
  assert.equal(autoImport().added, 1);
  assert.equal(autoImport().skipped, 1);
  assert.ok((await state(owner)).entries.some((row) => row.data.title === "自动套用计划格式"));
  const logId = randomUUID();
  const session = {
    plan, date, planId: sharedPlan, started: Date.now(), minutes: 29, note: "训练日志",
    finishedVideo: false, rows: [[{ weight: 10, reps: 8, seconds: 0, done: true }]],
  };
  await expect("training", owner, { action: "draft", id: logId, data: session });
  const workoutPage = await fetch(base + "/training/" + logId, { headers: { Cookie: owner } });
  assert.equal(workoutPage.status, 200);
  assert.match(await workoutPage.text(), /正在读取训练草稿/);
  const invalidWorkout = await fetch(base + "/training/invalid-id", { headers: { Cookie: owner }, redirect: "manual" });
  assert.equal(invalidWorkout.headers.get("location"), "/");
  await expect("health?id=" + logId, owner, null, 404);
  assert.deepEqual((await state(partner)).entries.map((row) => row.id), [sharedPlan]);
  await expect("training", owner, { action: "log", id: logId, data: session });
  await expect("training", owner, { action: "log", id: logId, data: { ...session, note: "重试" } });
  await expect("training", owner, { action: "draft", id: logId, data: session }, 409);
  const heart = {
    source: "apple", from: session.started + 1000, to: session.started + 2000, average: 118, maximum: 124,
    samples: [{ at: session.started + 1000, bpm: 112 }, { at: session.started + 2000, bpm: 124 }],
  };
  const heartUrl = "health?id=" + logId;
  await expect("health", owner, { action: "save", id: logId, data: heart });
  await expect(heartUrl, partner, null, 404);
  await expect("health", partner, { action: "remove", id: logId }, 404);
  assert.equal(JSON.stringify(await state(partner)).includes('"bpm"'), false);
  const wrongTime = { ...heart, from: session.started - 1000, to: session.started - 1000, samples: [{ at: session.started - 1000, bpm: 124 }] };
  await expect("health", owner, { action: "save", id: logId, data: wrongTime }, 400);
  const authorize = await expect("health/whoop", owner, { id: logId });
  const grant = new URL((await authorize.json()).url);
  assert.equal(grant.origin, "https://api.prod.whoop.com");
  assert.equal(grant.searchParams.get("scope"), "read:workout");
  assert.equal(grant.searchParams.get("redirect_uri"), base + "/api/health/whoop/callback");
  assert.match(grant.searchParams.get("state"), /^[A-Za-z0-9_-]{8}$/);
  const flowCookie = cookie(authorize);
  const callback = (account, state) => fetch(base + "/api/health/whoop/callback?" + new URLSearchParams({
    state, error: "access_denied",
  }), { headers: { Cookie: account + "; " + flowCookie }, redirect: "manual" });
  const denied = await callback(partner, grant.searchParams.get("state"));
  assert.equal(denied.headers.get("location"), base + "/");
  const cancelled = await callback(owner, grant.searchParams.get("state"));
  assert.equal(new URL(cancelled.headers.get("location")).searchParams.get("whoop"), "cancelled");
  await expect("health/apple", null, null, 401);
  const applePair = await (await expect("health/apple", owner, { action: "pair" })).json();
  const claimed = await (await expect("health/apple/pair", null, { code: applePair.code })).json();
  await expect("health/apple/pair", null, { code: applePair.code }, 401);
  const apple = (body, method = body ? "POST" : "GET") => fetch(base + "/api/health/apple/sync", {
    method,
    headers: { Authorization: "Bearer " + claimed.token, ...(body && { Origin: base, "Content-Type": "application/json" }) },
    body: body && JSON.stringify(body),
  });
  assert.deepEqual((await (await apple()).json()).workouts, []);
  assert.equal((await (await expect("health/apple", partner)).json()).connected, false);
  await expect("partner", partner, { action: "cheer", date });
  assert.ok((await state(owner)).entries.some((row) => row.kind === "cheer"));

  await stop();
  await start();
  const partnerEntries = (await state(partner)).entries;
  assert.ok(partnerEntries.some((row) => row.id === sharedPlan));
  assert.equal(partnerEntries.find((row) => row.id === logId).data.note, session.note);
  assert.ok(partnerEntries.every((row) => row.id !== privatePlan));
  assert.deepEqual((await (await expect(heartUrl, owner)).json()).data, heart);
  await expect("health", owner, { action: "remove", id: logId });
  assert.equal((await (await expect(heartUrl, owner)).json()).data, null);
  const pending = (await (await apple()).json()).workouts;
  assert.deepEqual(pending, [{ id: logId, from: session.started, to: session.started + session.minutes * 60_000 }]);
  assert.equal((await apple({ id: logId, data: wrongTime })).status, 400);
  assert.equal((await (await apple({ id: logId, data: heart })).json()).saved, true);
  assert.equal((await (await apple({ id: logId, data: heart })).json()).saved, false);
  assert.deepEqual((await (await expect(heartUrl, owner)).json()).data, heart);
  const recordAt = session.started - 60_000;
  const records = {
    selected: ["bodyMass", "workouts", "steps"], from: recordAt - 60_000, to: recordAt + 60_000, timeZone: "UTC",
    bodyMass: [{ id: randomUUID(), at: recordAt, value: 80, unit: "kg", sourceName: "Synthetic Scale", sourceId: "test.scale" }],
    workouts: [{ id: randomUUID(), from: recordAt, to: recordAt + 30_000, durationSeconds: 30, activity: "Synthetic exercise", sourceName: "Synthetic Watch", sourceId: "test.watch" }],
    activity: [{ date: new Date(recordAt).toISOString().slice(0, 10), from: recordAt, to: recordAt + 30_000, steps: 100, sourceName: "Synthetic merged activity", sourceId: "test.statistics" }],
  };
  const sendRecords = () => fetch(base + "/api/health/apple/records", { method: "POST",
    headers: { Authorization: "Bearer " + claimed.token, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify(records) });
  const upload = await sendRecords();
  assert.equal(upload.status, 200);
  assert.equal((await upload.json()).saved, 3);
  assert.equal((await (await sendRecords()).json()).saved, 0);
  const personalHealth = (await (await expect("health/apple", owner)).json()).health;
  assert.equal(personalHealth.bodyMass[0].kg, 80);
  assert.equal(personalHealth.activity[0].steps, 100);
  assert.equal(personalHealth.workouts[0].matchedWorkoutId, null);
  assert.deepEqual((await (await expect("health/apple", partner)).json()).health, { bodyMass: [], activity: [], workouts: [] });
  assert.equal(JSON.stringify(await state(partner)).includes("Synthetic Scale"), false);
  await stop();
  await start();
  assert.deepEqual((await (await expect("health/apple", owner)).json()).health, personalHealth);
  assert.equal((await (await apple({}, "DELETE")).json()).connected, false);
  assert.equal((await apple()).status, 401);
  assert.equal((await sendRecords()).status, 401);
  await expect("auth/logout", owner, {});
  await expect("state", owner, null, 401);
  await expect("auth/login", null, { username: "owner", password: "wrong-password" }, 401);
  const renewed = cookie(await expect("auth/login", null, { username: "OWNER", password }));
  assert.equal((await state(renewed)).me.id, ownerAccount.id);
});
