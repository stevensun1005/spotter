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

const { changeSocial, searchPeople, socialState } = await import("../features/friends/social-server.ts");
const { defaultSocialPreferences } = await import("../features/friends/social-model.ts");
const { changeFriends, listFriends } = await import("../features/friends/server.ts");
const { disconnectPair, joinPair } = await import("../features/pair/server.ts");

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrations = new URL("drizzle/", root);
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
  }
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) {
          assert.equal(values.length, (sql.match(/\?/g) ?? []).length, "D1 requires an argument for each positional parameter");
          parameters = values;
          return this;
        },
        async first() { return statement.get(...parameters) ?? null; },
        async all() { return { results: statement.all(...parameters).map((row) => ({ ...row })) }; },
        async run() {
          return statement.columns().length ? this.all() : { meta: { changes: statement.run(...parameters).changes } };
        },
      };
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
}

const alex = { id: "alex", name: "Ａlex Test" };
const sam = { id: "sam", name: "小棠" };
const lee = { id: "lee", name: "Lee" };
const save = (db, person, flags) => changeSocial(db, person, { action: "social-preferences", preferences: { ...defaultSocialPreferences, ...flags } });
const request = (db, person, target) => changeSocial(db, person, { action: "request", id: target.id });
const respond = (db, person, id, decision) => changeSocial(db, person, { action: "respond", id, decision });

test("only accounts with opted-in names appear in a literal display-name search", async (t) => {
  const db = fixture(t);
  await save(db, sam, { closed: true, recentOnly: true });
  assert.deepEqual((await socialState(db, sam.id)).preferences, { closed: true, discoverable: false, recentOnly: true });
  assert.deepEqual((await socialState(db, lee.id)).preferences, defaultSocialPreferences);
  assert.deepEqual(await searchPeople(db, lee.id, "小"), []);
  await assert.rejects(request(db, lee, sam), { status: 404 });
  await assert.rejects(save(db, { ...lee, name: "example＠example.invalid" }, { discoverable: true }), { status: 400 });
  await save(db, sam, { discoverable: true });
  await save(db, alex, { discoverable: true });
  assert.deepEqual(await searchPeople(db, lee.id, "  小　"), [sam]);
  assert.deepEqual(await searchPeople(db, lee.id, "alex  test"), [alex]);
  assert.deepEqual(await searchPeople(db, sam.id, "小棠"), []);
  assert.deepEqual(await searchPeople(db, lee.id, "%%"), []);
});

test("friend requests preserve direction, isolate actors and survive retries", async (t) => {
  const db = fixture(t);
  await save(db, sam, { discoverable: true });
  await save(db, alex, { discoverable: true });
  await request(db, alex, sam);
  const [pending] = (await socialState(db, alex.id)).outgoing;
  assert.equal(pending.personId, sam.id);
  await request(db, alex, sam);
  await request(db, sam, alex);
  assert.deepEqual((await socialState(db, alex.id)).outgoing, [pending]);
  assert.deepEqual((await socialState(db, sam.id)).incoming, [{ ...pending, personId: alex.id, name: alex.name }]);
  await respond(db, lee, pending.id, "accept");
  await respond(db, alex, pending.id, "decline");
  await respond(db, sam, pending.id, "cancel");
  assert.deepEqual((await socialState(db, lee.id)).incoming, []);
  assert.deepEqual((await listFriends(db, alex.id)).friends, []);
  await respond(db, sam, pending.id, "decline");
  await request(db, alex, sam);
  const [next] = (await socialState(db, sam.id)).incoming;
  assert.notEqual(next.id, pending.id);
  await respond(db, sam, pending.id, "decline");
  await respond(db, alex, next.id, "cancel");
  assert.deepEqual((await socialState(db, sam.id)).incoming, []);

  await request(db, alex, sam);
  const [accepted] = (await socialState(db, sam.id)).incoming;
  await save(db, sam, { discoverable: false });
  await respond(db, sam, accepted.id, "accept");
  await respond(db, sam, accepted.id, "accept");
  await request(db, alex, sam);
  const flags = { training: true, nutrition: true, nutritionDetails: false };
  assert.deepEqual((await listFriends(db, alex.id)).friends, [{ ...sam, buddy: false, shared: flags, sharing: flags }]);
  assert.deepEqual((await socialState(db, alex.id)).outgoing, []);
});

test("accepting a pending request preserves a concurrent code link or buddy relationship", async (t) => {
  const db = fixture(t);
  await save(db, sam, { discoverable: true });
  await request(db, alex, sam);
  const [pending] = (await socialState(db, sam.id)).incoming;
  await changeFriends(db, sam, { action: "invite" });
  const { code } = (await listFriends(db, sam.id)).invite;
  await changeFriends(db, alex, { action: "join", code });
  const sharing = { training: false, nutrition: true, nutritionDetails: true };
  await changeFriends(db, alex, { action: "share", id: sam.id, sharing });
  await respond(db, sam, pending.id, "accept");
  assert.deepEqual((await listFriends(db, alex.id)).friends[0].sharing, sharing);

  await changeFriends(db, alex, { action: "remove", id: sam.id });
  assert.deepEqual((await socialState(db, sam.id)).incoming, []);
  await request(db, alex, sam);
  const [whilePairing] = (await socialState(db, sam.id)).incoming;
  db.sqlite.prepare("INSERT INTO rooms (id, invite, owner) VALUES ('pair', 'code', ?)").run(alex.id);
  db.sqlite.prepare("INSERT INTO members (user, room, name, share_nutrition) VALUES (?, 'pair', ?, 0)").run(alex.id, alex.name);
  await joinPair(db, sam.id, sam.name, "code");
  assert.deepEqual(await searchPeople(db, alex.id, "小棠"), []);
  assert.deepEqual((await socialState(db, sam.id)).incoming, []);
  const buddy = (await listFriends(db, alex.id)).friends[0];
  assert.ok(buddy.buddy);
  assert.deepEqual(buddy.sharing, { training: true, nutrition: false, nutritionDetails: false });
  await disconnectPair(db, alex.id, sam.id, "pair");
  assert.deepEqual((await socialState(db, sam.id)).incoming, []);
  await respond(db, sam, whilePairing.id, "accept");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM friend_links").get().count, 0);
});
