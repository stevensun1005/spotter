import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const routeEnv = globalThis.__spotterAvatarEnv = {};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__spotterAvatarEnv;", shortCircuit: true };
  if (specifier === "@/app/chatgpt-auth") return { url: "data:text/javascript,export async function getChatGPTUser(){return globalThis.__spotterAvatarUser}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { accountAvatarUpdate, readAccountAvatar, saveAccountAvatar } = await import("../features/auth/account-avatar.ts");
const { GET: lookup } = await import("../app/api/auth/avatars/route.ts");

const sample = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAcFBgYGBQcGBgYICAcJCxIMCwoKCxcQEQ0SGxccHBoXGhkdISokHR8oIBkaJTIlKCwtLzAvHSM0ODQuNyouLy7/2wBDAQgICAsKCxYMDBYuHhoeLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi7/wAARCAAGAAYDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqASAr/9k=",
  "base64"
);

function database(t, accounts = ["one", "two"]) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const migration of readdirSync(new URL("drizzle/", root)).filter((file) => file.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL("drizzle/" + migration, root), "utf8"));
  }
  const insert = sqlite.prepare("INSERT INTO spotter_access_accounts (id, email, display_name, access_hash) VALUES (?, ?, ?, ?)");
  for (const owner of accounts) insert.run(owner, owner + "@example.invalid", owner, "0".repeat(64));
  return { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...values) { return {
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { meta: { changes: statement.run(...values).changes } }; },
    }; } };
  } };
}

test("avatar lookup returns current photos only across existing relationships", async (t) => {
  const db = database(t, ["viewer", "friend", "buddy", "student", "stranger", "pending"]);
  routeEnv.DB = db;
  t.after(() => { delete routeEnv.DB; delete globalThis.__spotterAvatarUser; });
  const image = sample.toString("base64");
  for (const owner of ["viewer", "friend", "buddy", "student", "stranger", "pending"]) {
    await saveAccountAvatar(db, owner, { expectedOwner: owner, image });
  }
  const saved = (await readAccountAvatar(db, "viewer")).image;
  db.sqlite.exec(`
    INSERT INTO friend_links (first_id, second_id, first_name, second_name, linked) VALUES ('friend','viewer','Friend','Viewer',1);
    INSERT INTO rooms (id, invite, owner) VALUES ('room','test-code','viewer');
    INSERT INTO members (user, room, name) VALUES ('viewer','room','Viewer'),('buddy','room','Buddy');
    INSERT INTO coaching_links (id, coach_id, coach_name, student_id, student_name, created_at)
      VALUES ('team','viewer','Viewer','student','Student','2026-11-25');
    INSERT INTO friend_requests (first_id,second_id,id,sender,receiver,sender_name,receiver_name,created_at)
      VALUES ('pending','viewer','request','pending','viewer','Pending','Viewer','2026-11-25');
  `);
  const call = (ids, userId) => {
    globalThis.__spotterAvatarUser = userId ? { userId } : null;
    const url = new URL("https://spotter.example.invalid/api/auth/avatars");
    ids.forEach((id) => url.searchParams.append("ids", id));
    return lookup(new Request(url));
  };
  const ids = ["viewer", "friend", "buddy", "student", "stranger", "pending", "nonexistent", "friend"];
  assert.equal((await call(ids)).status, 401);
  assert.equal((await call([], "viewer")).status, 400);
  assert.equal((await call(Array.from({ length: 33 }, (_, index) => String(index)), "viewer")).status, 400);
  const permitted = await call(ids, "viewer");
  assert.equal(permitted.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await permitted.json(), { avatars: { viewer: saved, friend: saved, buddy: saved, student: saved } });
  assert.deepEqual(await (await call(ids, "stranger")).json(), { avatars: { stranger: saved } });
  assert.deepEqual(await (await call(["viewer"], "student")).json(), { avatars: { viewer: saved } });

  await saveAccountAvatar(db, "buddy", { expectedOwner: "buddy", image: null });
  db.sqlite.exec(`
    INSERT INTO friend_profiles (owner,name,search_name,closed) VALUES ('friend','Friend','friend',1);
    UPDATE coaching_links SET ended_at='2026-11-26' WHERE id='team';
  `);
  assert.deepEqual(await (await call(ids, "viewer")).json(), { avatars: { viewer: saved, buddy: null } });
  db.sqlite.exec("DELETE FROM members WHERE user='buddy';");
  assert.deepEqual(await (await call(ids, "viewer")).json(), { avatars: { viewer: saved } });
});

test("avatars are private, remove JPEG metadata, and cascade on account deletion", async (t) => {
  const db = database(t);
  const exif = Buffer.from("Exif\x00\x00private test metadata");
  const image = Buffer.concat([sample.subarray(0, 2), Buffer.from([0xff, 0xe1, 0, exif.length + 2]), exif, sample.subarray(2)]);
  const saved = await saveAccountAvatar(db, "one", { expectedOwner: "one", image: image.toString("base64") });
  assert.equal(Buffer.from(saved.image, "base64").includes(exif), false);
  assert.deepEqual(await readAccountAvatar(db, "one"), saved);
  assert.deepEqual(await readAccountAvatar(db, "two"), { image: null });
  await assert.rejects(saveAccountAvatar(db, "two", { expectedOwner: "one", image: null }), { status: 403 });
  assert.deepEqual(await readAccountAvatar(db, "one"), saved);
  assert.deepEqual(await saveAccountAvatar(db, "one", { expectedOwner: "one", image: null }), { image: null });
  assert.deepEqual(await readAccountAvatar(db, "one"), { image: null });
  await saveAccountAvatar(db, "one", { expectedOwner: "one", image: image.toString("base64") });
  db.sqlite.prepare("DELETE FROM spotter_access_accounts WHERE id = ?").run("one");
  assert.deepEqual(await readAccountAvatar(db, "one"), { image: null });
});

test("avatars reject invalid JPEGs, too-large images, and unrelated request fields", async (t) => {
  const db = database(t);
  const oversized = Buffer.from(sample);
  const frameStart = oversized.indexOf(Buffer.from([0xff, 0xc0]));
  oversized.writeUInt16BE(257, frameStart + 7);
  for (const image of [
    "invalid-encoding",
    sample.subarray(0, -2).toString("base64"),
    Buffer.concat([sample, Buffer.from("extra")]).toString("base64"),
    oversized.toString("base64"),
    Buffer.alloc(60_001).toString("base64"),
  ]) {
    await assert.rejects(saveAccountAvatar(db, "one", { expectedOwner: "one", image }), { status: 400 });
  }
  assert.equal(accountAvatarUpdate.safeParse({ expectedOwner: "one", image: null, owner: "two" }).success, false);
  assert.deepEqual(await readAccountAvatar(db, "one"), { image: null });
});
