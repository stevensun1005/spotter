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
const { readAccountProfile, saveAccountNickname, saveAccountUsername } = await import("../features/auth/profile-server.ts");
const { updateProfileInput } = await import("../features/auth/profile.ts");
const { defaultSocialPreferences } = await import("../features/friends/social-model.ts");
const { changeFriends, listFriends } = await import("../features/friends/server.ts");
const { disconnectPair, joinPair, membership } = await import("../features/pair/server.ts");

function fixture(t, beforeMigration = () => {}) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const migrations = new URL("drizzle/", root);
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    beforeMigration(sqlite, name);
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

function addAccount(db, person) {
  db.sqlite.prepare("INSERT INTO spotter_access_accounts (id, email, display_name, access_hash) VALUES (?, ?, ?, ?)")
    .run(person.id, person.id + "@example.invalid", person.name, "0".repeat(64));
}

test("handle editing enforces uniqueness of the pair, supports leading zeros and searches by either name or full handle", async (t) => {
  const db = fixture(t);
  addAccount(db, alex);
  addAccount(db, sam);
  addAccount(db, lee);
  const original = await readAccountProfile(db, alex.id);
  assert.match(original.handle, /^spotter\.[a-f0-9]{16}#[0-9]{4}$/);
  const parsed = updateProfileInput.parse({ username: "  Ａlex.Fit ", tag: " ０００７ ", expectedOwner: alex.id });
  const updated = await saveAccountUsername(db, alex.id, parsed.username, parsed.tag);
  assert.equal(updated.handle, "alex.fit#0007");
  assert.equal(updateProfileInput.safeParse({ username: "a#1234", expectedOwner: alex.id }).success, false);
  assert.equal(updateProfileInput.safeParse({ username: "alex.fit", tag: "123", expectedOwner: alex.id }).success, false);
  assert.equal(updateProfileInput.safeParse({ username: "alex.fit", tag: 1234, expectedOwner: alex.id }).success, false);
  await assert.rejects(saveAccountUsername(db, sam.id, "alex.fit", "0007"), { status: 409 });
  const other = await saveAccountUsername(db, sam.id, "alex.fit", "0042");
  assert.equal(other.handle, "alex.fit#0042");
  assert.equal((await saveAccountUsername(db, sam.id, "alex.fit")).handle, other.handle);
  const exact = [{ id: alex.id, name: alex.name, handle: updated.handle }];
  assert.deepEqual(await searchPeople(db, lee.id, "alex.fit", "friend"), [...exact, { id: sam.id, name: sam.name, handle: other.handle }]);
  assert.deepEqual(await searchPeople(db, sam.id, updated.handle.toUpperCase(), "buddy"), exact);
  assert.deepEqual(await searchPeople(db, sam.id, "alex", "friend"), []);
  assert.deepEqual(await searchPeople(db, alex.id, updated.handle, "friend"), []);
  await assert.rejects(changeSocial(db, alex, {
    action: "social-preferences", preferences: defaultSocialPreferences, expectedOwner: sam.id,
  }), { status: 403 });
  await save(db, alex, { discoverable: false });
  assert.deepEqual(await searchPeople(db, sam.id, updated.handle, "friend"), []);
  assert.deepEqual(await searchPeople(db, sam.id, updated.handle, "buddy"), []);
});

test("tag migration leaves existing handles untouched and permits a new distinct tag", async (t) => {
  const db = fixture(t, (sqlite, migration) => {
    if (migration !== "0017_account_handle_tags.sql") return;
    addAccount({ sqlite }, alex);
    sqlite.prepare("INSERT INTO spotter_account_handles (owner, username, tag) VALUES (?, ?, ?)").run(alex.id, "existing", "0014");
  });
  assert.equal((await readAccountProfile(db, alex.id)).handle, "existing#0014");
  addAccount(db, sam);
  assert.equal((await saveAccountUsername(db, sam.id, "existing", "0015")).handle, "existing#0015");
  await assert.rejects(saveAccountUsername(db, sam.id, "existing", "0014"), { status: 409 });
});

test("nickname changes reach existing buddies and friends without changing their handles or sharing flags", async (t) => {
  const db = fixture(t);
  const unnamed = { ...alex, name: "Spotter 用户" };
  for (const person of [unnamed, sam, lee]) {
    addAccount(db, person);
    await readAccountProfile(db, person.id);
  }
  const { handle } = await saveAccountUsername(db, alex.id, "alex.fit", "0042");
  await save(db, unnamed, { discoverable: true, closed: true, recentOnly: true });
  assert.deepEqual(await searchPeople(db, sam.id, handle, "buddy"), [{ id: alex.id, name: handle, handle }]);
  await request(db, lee, unnamed);
  const [friendInvite] = (await socialState(db, unnamed.id)).incoming;
  await changeSocial(db, unnamed, { action: "request", kind: "buddy", id: sam.id, expectedOwner: unnamed.id });
  const [buddyInvite] = (await socialState(db, sam.id, true)).incoming;
  await saveAccountNickname(db, unnamed.id, "训练小队");
  assert.equal((await socialState(db, sam.id, true)).incoming[0].name, "训练小队");
  assert.equal((await socialState(db, lee.id)).outgoing[0].name, "训练小队");
  assert.deepEqual(await searchPeople(db, sam.id, handle, "buddy"), [{ id: alex.id, name: "训练小队", handle }]);
  await respond(db, unnamed, friendInvite.id, "accept");
  await respond(db, sam, buddyInvite.id, "accept");
  assert.equal((await membership(db, sam.id)).partnerName, "训练小队");

  assert.deepEqual(await saveAccountNickname(db, unnamed.id, "阿力"), {
    name: "阿力", username: "alex.fit", tag: "0042", handle, discoverable: true,
  });
  assert.equal((await membership(db, sam.id)).partnerName, "阿力");
  assert.equal((await listFriends(db, sam.id)).friends[0].name, "阿力");
  assert.equal((await listFriends(db, lee.id)).friends[0].name, "阿力");
  assert.deepEqual((await socialState(db, unnamed.id)).preferences, { discoverable: true, closed: true, recentOnly: true });
  assert.equal((await readAccountProfile(db, sam.id)).name, sam.name);
});

test("username buddy requests remain separate until accepted by the recipient", async (t) => {
  const db = fixture(t);
  for (const person of [alex, sam, lee]) {
    addAccount(db, person);
    await readAccountProfile(db, person.id);
  }
  const ask = (from, to) => changeSocial(db, from, { action: "request", kind: "buddy", id: to.id, expectedOwner: from.id });
  await ask(alex, sam);
  await ask(sam, alex);
  assert.equal((await socialState(db, sam.id)).incoming.length, 0);
  const [pending] = (await socialState(db, sam.id, true)).incoming;
  assert.equal(pending.kind, "buddy");
  await respond(db, lee, pending.id, "accept");
  await respond(db, alex, pending.id, "accept");
  assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM members").get().count, 0);
  await respond(db, sam, pending.id, "accept");
  await respond(db, sam, pending.id, "accept");
  const members = db.sqlite.prepare("SELECT user, room, share_nutrition FROM members ORDER BY user").all();
  assert.equal(members.length, 2);
  assert.equal(members[0].room, members[1].room);
  assert.deepEqual(members.map((member) => [member.user, member.share_nutrition]), [[alex.id, 0], [sam.id, 0]]);
  assert.equal((await socialState(db, sam.id, true)).incoming.length, 0);
  await assert.rejects(ask(lee, sam), { status: 409 });
});

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

test("beta friend requests and codes start with private nutrition and retain an established sharing choice", async (t) => {
  const db = fixture(t);
  await save(db, sam, { discoverable: true });
  await changeSocial(db, alex, { action: "request", id: sam.id }, true);
  const social = await socialState(db, sam.id, true, true);
  assert.equal(social.betaSocialDefaults, true);
  assert.equal((await socialState(db, sam.id, true)).betaSocialDefaults, undefined);
  await changeSocial(db, sam, { action: "respond", id: social.incoming[0].id, decision: "accept" }, true);
  const privateNutrition = { training: true, nutrition: false, nutritionDetails: false };
  const [alexFriend] = (await listFriends(db, alex.id)).friends;
  assert.deepEqual(alexFriend.sharing, privateNutrition);
  assert.deepEqual(alexFriend.shared, privateNutrition);

  await changeFriends(db, sam, { action: "invite" });
  await changeFriends(db, lee, { action: "join", code: (await listFriends(db, sam.id)).invite.code }, true);
  const [leeFriend] = (await listFriends(db, lee.id)).friends;
  assert.deepEqual(leeFriend.sharing, privateNutrition);
  assert.deepEqual(leeFriend.shared, privateNutrition);

  const chosen = { training: false, nutrition: true, nutritionDetails: true };
  await changeFriends(db, alex, { action: "share", id: sam.id, sharing: chosen }, true);
  await changeFriends(db, sam, { action: "invite" }, true);
  await changeFriends(db, alex, { action: "join", code: (await listFriends(db, sam.id)).invite.code }, true);
  assert.deepEqual((await listFriends(db, alex.id)).friends[0].sharing, chosen);
  assert.deepEqual((await listFriends(db, alex.id)).friends[0].shared, privateNutrition);
});

for (const { title, senderBeta, senderChoice, receiverBeta, receiverChoice, expected } of [
  { title: "separate choices and retry protection", senderBeta: true, senderChoice: true, receiverBeta: true, receiverChoice: false, expected: [1, 0] },
  { title: "legacy sender stays private", senderBeta: false, senderChoice: true, receiverBeta: true, receiverChoice: true, expected: [0, 1] },
  { title: "stable acceptance stays private", senderBeta: true, senderChoice: true, receiverBeta: false, receiverChoice: true, expected: [0, 0] },
  { title: "missing choices stay private", senderBeta: true, receiverBeta: true, expected: [0, 0] },
]) {
  test("beta buddy nutrition: " + title, async (t) => {
    const db = fixture(t);
    for (const person of [alex, sam, lee]) {
      addAccount(db, person);
      await readAccountProfile(db, person.id);
    }
    await changeSocial(db, alex, { action: "request", kind: "buddy", id: sam.id, shareNutrition: senderChoice }, senderBeta);
    const pending = (await socialState(db, sam.id, true)).incoming[0];
    const row = db.sqlite.prepare("SELECT sender_share_nutrition FROM buddy_requests WHERE id = ?").get(pending.id);
    assert.equal(row.sender_share_nutrition, senderBeta && senderChoice !== undefined ? Number(senderChoice) : null);
    const accept = { action: "respond", id: pending.id, decision: "accept", shareNutrition: receiverChoice };
    await changeSocial(db, lee, accept, true);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS count FROM members").get().count, 0);
    await changeSocial(db, sam, accept, receiverBeta);
    await changeSocial(db, sam, { ...accept, shareNutrition: !receiverChoice }, receiverBeta);
    assert.deepEqual(db.sqlite.prepare("SELECT share_nutrition FROM members ORDER BY user").all().map((row) => row.share_nutrition), expected);
    const [relation] = (await listFriends(db, alex.id)).friends;
    assert.equal(relation.buddy, true);
    assert.equal(relation.sharing.nutritionDetails, Boolean(expected[0]));
    assert.equal(relation.shared.nutritionDetails, Boolean(expected[1]));
    assert.equal((await socialState(db, sam.id, true)).incoming.length, 0);
  });
}

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
