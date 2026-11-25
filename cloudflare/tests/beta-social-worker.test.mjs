import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { default: worker } = await import("../worker/beta-social.ts");
const { sessionCookieName, startAccountSession } = await import("../features/auth/server.ts");
const { readFriendsRequest } = await import("../features/friends/http.ts");

const origin = "https://spotter-beta.example.invalid";
const avatarPath = "/api/auth/avatar";
const socialPath = "/api/friends?section=social&includeBuddy=1";
const avatarJPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAcFBgYGBQcGBgYICAcJCxIMCwoKCxcQEQ0SGxccHBoXGhkdISokHR8oIBkaJTIlKCwtLzAvHSM0ODQuNyouLy7/2wBDAQgICAsKCxYMDBYuHhoeLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi7/wAARCAAGAAYDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqASAr/9k=";

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrations = new URL("drizzle/", root);
  for (const migration of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(migration, migrations), "utf8"));
  }
  const addAccount = sqlite.prepare("INSERT INTO spotter_access_accounts VALUES (?, ?, ?, ?)");
  const addHandle = sqlite.prepare("INSERT INTO spotter_account_handles (owner, username, tag) VALUES (?, ?, ?)");
  for (const account of ["one", "two"]) {
    addAccount.run(account, account + "@example.invalid", "Beta " + account, "0".repeat(64));
    addHandle.run(account, account, "0042");
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...values) {
        assert.equal(values.length, (sql.match(/\?/g) ?? []).length);
        return {
          async first() { return statement.get(...values) ?? null; },
          async all() { return { results: statement.all(...values) }; },
          async run() { return { meta: { changes: statement.run(...values).changes } }; },
        };
      } };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const tokens = { one: await startAccountSession(db, "one"), two: await startAccountSession(db, "two") };
  async function call(path, { as, method = "GET", body, siteOrigin = origin, cookie } = {}) {
    const headers = new Headers();
    if (cookie) headers.set("Cookie", cookie);
    else if (as) headers.set("Cookie", sessionCookieName + "=" + tokens[as]);
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      headers.set("Origin", siteOrigin);
    }
    return worker.fetch(new Request(origin + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db });
  }
  return { call, db, sqlite, tokens };
}

async function read(response, expectedStatus = 200) {
  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return response.json();
}

async function friendRequest(call, kind, senderChoice, receiverChoice) {
  const request = { action: "request", kind, id: "two", shareNutrition: senderChoice, expectedOwner: "one" };
  await read(await call(socialPath, {
    as: "one", method: "POST", body: request, siteOrigin: "https://wrong.example.invalid",
  }), 403);
  const outgoing = await read(await call(socialPath, { as: "one", method: "POST", body: request }));
  assert.equal(outgoing.outgoing.length, 1);
  assert.equal(outgoing.outgoing[0].personId, "two");
  const incoming = await read(await call(socialPath, { as: "two" }));
  const id = incoming.incoming[0].id;
  assert.equal(incoming.incoming[0].personId, "one");
  const accept = { action: "respond", id, decision: "accept", shareNutrition: receiverChoice, expectedOwner: "two" };
  await read(await call(socialPath, { as: "one", method: "POST", body: accept }), 403);
  await read(await call(socialPath, { as: "two", method: "POST", body: accept }));
  const after = await read(await call(socialPath, { as: "two" }));
  assert.deepEqual(after.incoming, []);
  const result = await read(await call("/api/friends", { as: "one" }));
  assert.equal(result.friends.length, 1);
  return result.friends[0];
}

test("beta Worker serves only its intended API paths and requires a valid current session", async (t) => {
  const { call, sqlite, tokens } = await fixture(t);
  for (const wrongPath of ["/", "/api/me", "/api/auth/session", "/api/friends/", "/api/%66riends"]) {
    await read(await call(wrongPath, { as: "one" }), 404);
  }
  for (const required of [avatarPath, socialPath]) await read(await call(required), 401);
  await read(await call(socialPath, { cookie: sessionCookieName + "=" + "0".repeat(64) }), 401);
  await read(await call(socialPath, { cookie: sessionCookieName + "=" + tokens.one + "; " + sessionCookieName + "=" + tokens.two }), 401);
  await read(await call(avatarPath, { as: "one", method: "POST" }), 405);
  await read(await call(socialPath, { as: "one", method: "PATCH" }), 405);
  sqlite.prepare("UPDATE spotter_access_sessions SET expires_at = 0 WHERE account_id = ?").run("one");
  await read(await call(socialPath, { as: "one" }), 401);
  await read(await call(socialPath, { as: "two" }));
});

test("beta avatar API keeps photos owner-only and validates mutations", async (t) => {
  const { call } = await fixture(t);
  assert.deepEqual(await read(await call(avatarPath, { as: "one" })), { image: null });
  const body = { image: avatarJPEG, expectedOwner: "one" };
  await read(await call(avatarPath, { as: "one", method: "PATCH", body, siteOrigin: "https://wrong.example.invalid" }), 403);
  await read(await call(avatarPath, { as: "one", method: "PATCH" }), 403);
  await read(await call(avatarPath, { as: "two", method: "PATCH", body }), 403);
  await read(await call(avatarPath, { as: "one", method: "PATCH", body: { ...body, image: "AAAA" } }), 400);
  const saved = await read(await call(avatarPath, { as: "one", method: "PATCH", body }));
  assert.ok(saved.image);
  assert.deepEqual(await read(await call(avatarPath, { as: "one" })), saved);
  assert.deepEqual(await read(await call(avatarPath + "?owner=one", { as: "two" })), { image: null });
  assert.deepEqual(await read(await call(avatarPath, {
    as: "one", method: "PATCH", body: { image: null, expectedOwner: "one" },
  })), { image: null });
});

test("beta Worker exposes its capability and starts ordinary friends with private nutrition", async (t) => {
  const { call, db } = await fixture(t);
  const beta = await read(await call(socialPath, { as: "two" }));
  assert.equal(beta.betaSocialDefaults, true);
  assert.equal(beta.preferences.discoverable, true);

  const stable = await read(await readFriendsRequest(new Request(origin + socialPath), db, { id: "two", name: "Beta two" }));
  assert.equal(stable.betaSocialDefaults, undefined);
  const lookup = await read(await call("/api/friends?search=two%230042&mode=friend", { as: "one" }));
  assert.deepEqual(lookup.results, [{ id: "two", name: "Beta two", handle: "two#0042" }]);

  const ordinary = await friendRequest(call, "friend", true, true);
  const noNutrition = { training: true, nutrition: false, nutritionDetails: false };
  assert.equal(ordinary.buddy, false);
  assert.deepEqual([ordinary.sharing, ordinary.shared], [noNutrition, noNutrition]);
});

test("beta Worker applies independently consented buddy nutrition flags", async (t) => {
  const { call } = await fixture(t);
  const buddy = await friendRequest(call, "buddy", true, false);
  assert.equal(buddy.buddy, true);
  assert.deepEqual(buddy.sharing, { training: true, nutrition: true, nutritionDetails: true });
  assert.deepEqual(buddy.shared, { training: true, nutrition: false, nutritionDetails: false });
});
