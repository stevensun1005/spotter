import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  return next(specifier, context);
} });

const { accountAvatarUpdate, readAccountAvatar, saveAccountAvatar } = await import("../features/auth/account-avatar.ts");

const sample = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAcFBgYGBQcGBgYICAcJCxIMCwoKCxcQEQ0SGxccHBoXGhkdISokHR8oIBkaJTIlKCwtLzAvHSM0ODQuNyouLy7/2wBDAQgICAsKCxYMDBYuHhoeLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi7/wAARCAAGAAYDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqASAr/9k=",
  "base64"
);

function database(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const migration of ["0011_spotter_access.sql", "0021_account_avatars.sql"]) {
    sqlite.exec(readFileSync(new URL("drizzle/" + migration, root), "utf8"));
  }
  const insert = sqlite.prepare("INSERT INTO spotter_access_accounts (id, email, display_name, access_hash) VALUES (?, ?, ?, ?)");
  for (const owner of ["one", "two"]) insert.run(owner, owner + "@example.invalid", owner, "0".repeat(64));
  return { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...values) { return {
      async first() { return statement.get(...values) ?? null; },
      async run() { return { meta: { changes: statement.run(...values).changes } }; },
    }; } };
  } };
}

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
