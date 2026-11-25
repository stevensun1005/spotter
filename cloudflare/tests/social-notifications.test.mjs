import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const key = Symbol.for("spotter-social-notifications-test");
const runtime = { owner: "", env: {}, deliveries: [], sendResult: "sent" };
globalThis[key] = runtime;
const mocked = (code) => ({ url: "data:text/javascript," + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return mocked('export const env = globalThis[Symbol.for("spotter-social-notifications-test")].env;');
  if (specifier === "@/app/chatgpt-auth" || (specifier === "../../chatgpt-auth" && context.parentURL?.endsWith("/workout/route.ts"))) {
    return mocked('export async function getChatGPTUser() { const { owner } = globalThis[Symbol.for("spotter-social-notifications-test")]; return owner ? { userId: owner, fullName: "Test User", email: owner + "@example.invalid" } : null; }');
  }
  if (specifier === "@/features/notifications/apns" ||
      (specifier === "./apns" && context.parentURL?.endsWith("/notifications/server.ts"))) {
    return mocked('const runtime = globalThis[Symbol.for("spotter-social-notifications-test")]; export const pushAvailable = (_, environment = "production") => environment === "production"; export async function sendPush(_, token, environment, notification) { runtime.deliveries.push({ token, environment, notification }); return runtime.sendResult; }');
  }
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { GET, POST } = await import("../app/api/notifications/route.ts");
const { POST: checkin } = await import("../app/api/workout/route.ts");
const { sessionCookieName, sessionTokenHash } = await import("../features/auth/server.ts");
const { startSession } = await import("../features/training/model.ts");
const { asDate } = await import("../shared/dates.ts");

const origin = "https://spotter.example";
const keys = {
  alex: "a".repeat(64), sam: "b".repeat(64), lee: "c".repeat(64),
  closed: "d".repeat(64), stranger: "e".repeat(64), muted: "f".repeat(64),
};

async function fixture(t) {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys = ON");
  const drizzle = new URL("drizzle/", root);
  for (const file of readdirSync(drizzle).filter((name) => name.endsWith(".sql")).sort()) {
    sql.exec(readFileSync(new URL(file, drizzle), "utf8"));
  }
  runtime.env.DB = {
    prepare(query) {
      const statement = sql.prepare(query);
      let bound = [];
      return {
        bind(...args) { bound = args; return this; },
        async first() { return statement.get(...bound) ?? null; },
        async all() { return { results: statement.all(...bound) }; },
        async run() {
          if (!query.includes("RETURNING")) return { results: [], meta: { changes: statement.run(...bound).changes } };
          const results = statement.all(...bound);
          return { results, meta: { changes: results.length } };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  for (const [id, token] of Object.entries(keys)) {
    sql.prepare("INSERT INTO spotter_access_accounts (id, email, display_name, access_hash) VALUES (?, ?, ?, ?)")
      .run(id, id + "@example.invalid", id === "alex" ? "Alex" : id, "a".repeat(64));
    sql.prepare("INSERT INTO spotter_access_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
      .run(await sessionTokenHash(token), id, Math.floor(Date.now() / 1000) + 600);
  }
  sql.exec("INSERT INTO rooms (id, invite, owner) VALUES ('room', 'invite', 'alex')");
  sql.exec("INSERT INTO members (user, room, name) VALUES ('alex','room','Alex'), ('sam','room','Sam')");
  for (const friend of ["sam", "lee", "closed", "muted"]) {
    sql.prepare("INSERT INTO friend_links (first_id,second_id,first_name,second_name,linked) VALUES ('alex',?,'Alex',?,1)")
      .run(friend, friend);
  }
  sql.exec("INSERT INTO friend_profiles (owner, name, search_name, closed) VALUES ('closed', 'Closed', 'closed', 0)");
  runtime.deliveries.length = 0;
  runtime.sendResult = "sent";
  t.after(() => {
    runtime.env.DB = undefined;
    delete runtime.env.SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS;
    sql.close();
  });
  return sql;
}

function bodyRequest(path, owner, body, from = origin) {
  runtime.owner = owner;
  return new Request(origin + path, {
    method: "POST",
    headers: {
      origin: from, "content-type": "application/json",
      ...(keys[owner] && { cookie: sessionCookieName + "=" + keys[owner] }),
    },
    body: JSON.stringify({ expectedOwner: owner, ...body }),
  });
}

function send(owner, body, from = origin) {
  return POST(bodyRequest("/api/notifications", owner, body, from));
}

async function inbox(owner) {
  runtime.owner = owner;
  const response = await GET(new Request(origin + "/api/notifications"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return response.json();
}

test("a buddy reminder is account-scoped, configurable and throttled, and its inbox supports read state", async (t) => {
  await fixture(t);
  assert.equal((await send("", { action: "nudge", buddyId: "sam" })).status, 401);
  assert.equal((await send("alex", { action: "nudge", buddyId: "sam" }, "https://unrelated.example")).status, 403);
  assert.equal((await send("alex", { action: "nudge", buddyId: "sam", expectedOwner: "sam" })).status, 403);
  assert.equal((await send("alex", { action: "nudge", buddyId: "alex" })).status, 409);
  assert.equal((await send("alex", { action: "nudge", buddyId: "lee" })).status, 409);
  assert.equal((await send("sam", { action: "preferences", buddyReminders: false, friendWorkouts: true })).status, 200);
  assert.match((await (await send("alex", { action: "nudge", buddyId: "sam" })).json()).error, /关闭/);
  assert.equal((await send("sam", { action: "preferences", buddyReminders: true, friendWorkouts: false })).status, 200);
  const response = await send("alex", { action: "nudge", buddyId: "sam" });
  assert.equal(response.status, 200);
  const { ok, id } = await response.json();
  assert.equal(ok, true);
  assert.equal((await send("alex", { action: "nudge", buddyId: "sam" })).status, 429);

  const { items, preferences, pushAvailable } = await inbox("sam");
  assert.deepEqual(preferences, { buddyReminders: true, friendWorkouts: false });
  assert.equal(pushAvailable, true);
  assert.deepEqual(items, [{ id, kind: "buddy-reminder", actorId: "alex", actorName: "Alex", createdAt: items[0].createdAt, read: false }]);
  assert.equal((await send("stranger", { action: "read", id })).status, 200);
  assert.equal((await inbox("sam")).items[0].read, false);
  assert.deepEqual((await inbox("stranger")).items, []);
  assert.equal((await send("sam", { action: "read", id })).status, 200);
  assert.equal((await inbox("sam")).items[0].read, true);
});

test("device registration follows the active session and removes invalid APNs tokens", async (t) => {
  const sql = await fixture(t);
  const installationId = crypto.randomUUID();
  const token = "cf".repeat(32);
  const device = { action: "device", installationId, token, environment: "production" };
  assert.equal((await send("sam", device)).status, 200);
  assert.equal((await send("alex", { action: "remove-device", installationId })).status, 200);
  assert.equal(sql.prepare("SELECT owner FROM notification_devices").get().owner, "sam");

  runtime.sendResult = "invalid";
  assert.equal((await send("alex", { action: "nudge", buddyId: "sam" })).status, 200);
  assert.equal(runtime.deliveries.length, 1);
  assert.equal(runtime.deliveries[0].token, token);
  assert.equal(runtime.deliveries[0].notification.kind, "buddy-reminder");
  assert.equal(sql.prepare("SELECT count(*) AS total FROM notification_devices").get().total, 0);
  assert.equal((await inbox("sam")).items.length, 1);

  assert.equal((await send("sam", device)).status, 200);
  assert.equal((await send("lee", device)).status, 200);
  assert.equal((await send("sam", { action: "remove-device", installationId })).status, 200);
  assert.equal(sql.prepare("SELECT owner FROM notification_devices").get().owner, "lee");
  sql.prepare("DELETE FROM spotter_access_sessions WHERE account_id = 'lee'").run();
  assert.equal(sql.prepare("SELECT count(*) AS total FROM notification_devices").get().total, 0);
});

function workout(ended) {
  const date = asDate(ended, "UTC");
  const plan = { title: "Private workout name", date, minutes: 0, category: "力量训练", shared: false, video: "",
    exercises: [{ name: "哑铃卧推", sets: 1, reps: 10, weight: 20, unit: "kg", seconds: 0 }] };
  const data = { ...startSession(plan, "", date), ended, started: ended - 30 * 60_000, minutes: 30,
    clock: { elapsed: 30 * 60_000, runningSince: null }, note: "private note" };
  data.rows[0][0].done = true;
  return data;
}

test("only new, recent check-ins notify eligible connected friends or buddies once", async (t) => {
  const sql = await fixture(t);
  sql.exec("INSERT INTO friend_profiles (owner, name, search_name, closed) VALUES ('alex', 'Alex', 'alex', 1)");
  assert.equal((await send("muted", { action: "preferences", buddyReminders: true, friendWorkouts: false })).status, 200);
  const data = workout(Date.now() - 1_000);
  const id = crypto.randomUUID();
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", { action: "draft", id, data }))).status, 200);
  assert.deepEqual((await inbox("sam")).items, []);
  const log = { action: "log", id, data };
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", log))).status, 200);
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", log))).status, 200);
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", { ...log, id: crypto.randomUUID(),
    data: workout(Date.now() - 3 * 86_400_000) }))).status, 200);

  const buddy = await inbox("sam");
  assert.equal(buddy.items.length, 1);
  assert.equal(buddy.items[0].kind, "friend-workout");
  assert.equal(buddy.items[0].actorName, "Alex");
  assert.doesNotMatch(JSON.stringify(buddy), /private workout name|private note/i);
  for (const owner of ["alex", "lee", "stranger", "muted", "closed"]) assert.deepEqual((await inbox(owner)).items, []);

  // Opening the profile permits the next workout for accepted friends. The buddy's dual relationship still dedupes.
  sql.exec("UPDATE friend_profiles SET closed = 0 WHERE owner = 'alex'");
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", { ...log, id: crypto.randomUUID() }))).status, 200);
  assert.equal((await inbox("sam")).items.length, 2);
  assert.equal((await inbox("lee")).items.length, 1);
  assert.deepEqual((await inbox("muted")).items, []);
  assert.equal((await send("sam", { action: "read" })).status, 200);
  assert.equal((await inbox("sam")).items.every((item) => item.read), true);

  sql.exec("DELETE FROM friend_links WHERE first_id = 'alex' AND second_id = 'lee'");
  assert.deepEqual((await inbox("lee")).items, []);
});

test("internal allowlist limits inbox, two-way reminders and fanout while ordinary accounts can still check in", async (t) => {
  const sql = await fixture(t);
  runtime.env.SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS = " SAM@Example.Invalid, LEE ";
  runtime.owner = "alex";
  assert.equal((await GET(new Request(origin + "/api/notifications"))).status, 403);
  assert.equal((await send("alex", { action: "device", installationId: crypto.randomUUID(),
    token: "cd".repeat(32), environment: "production" })).status, 403);
  assert.equal((await send("alex", { action: "nudge", buddyId: "sam" })).status, 403);
  assert.equal((await send("sam", { action: "nudge", buddyId: "alex" })).status, 409);

  const id = crypto.randomUUID();
  assert.equal((await checkin(bodyRequest("/api/workout", "alex", {
    action: "log", id, data: workout(Date.now()),
  }))).status, 200);
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM entries WHERE id = ? AND kind = 'log'").get(id).count, 1);
  assert.deepEqual(sql.prepare("SELECT recipient FROM notifications ORDER BY recipient").all().map((row) => row.recipient),
    ["lee", "sam"]);
  assert.equal((await inbox("sam")).items[0].actorId, "alex");
  assert.equal((await inbox("lee")).items[0].actorId, "alex");

  runtime.env.SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS = " , , ";
  runtime.owner = "sam";
  assert.equal((await GET(new Request(origin + "/api/notifications"))).status, 403);
});
