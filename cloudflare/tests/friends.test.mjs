import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const lastMigration = "0007_buddy_nutrition.sql";
const runtime = { owner: "test-alex", env: {} };
const runtimeKey = Symbol.for("spotter-buddy-tests");
globalThis[runtimeKey] = runtime;
const mock = (code) => ({ url: "data:text/javascript," + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return mock('export const env = globalThis[Symbol.for("spotter-buddy-tests")].env;');
  if (specifier === "@/app/chatgpt-auth" || (specifier === "../../chatgpt-auth" && context.parentURL?.endsWith("/app/api/workout/route.ts"))) {
    return mock('export async function getChatGPTUser() { const { owner } = globalThis[Symbol.for("spotter-buddy-tests")]; return owner ? { userId: owner, fullName: "Test User", email: "example@example.invalid" } : null; }');
  }
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });
const { buddyCheckins, changeFriends, friendDay, friendFeed, listFriends, shareAccess } = await import("../features/friends/server.ts");
const { changeSocial } = await import("../features/friends/social-server.ts");

const { disconnectPair, sendPairCheer } = await import("../features/pair/server.ts");
const { publicPartnerSession } = await import("../features/friends/public-training.ts");
const { sessionTotals } = await import("../features/training/model.ts");
const { GET: loadWorkout } = await import("../app/api/workout/route.ts");
const { GET: loadFriends, POST: mutateFriends } = await import("../app/api/friends/route.ts");

function fixture(t, beforeMigration = false) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const drizzle = new URL("drizzle/", root);
  for (const file of readdirSync(drizzle).filter((name) => name.endsWith(".sql") && (!beforeMigration || name !== lastMigration)).sort()) {
    sqlite.exec(readFileSync(new URL(file, drizzle), "utf8"));
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
        async all() { return { results: statement.all(...parameters) }; },
        async run() { return { meta: { changes: statement.run(...parameters).changes } }; },
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

const alex = { id: "test-alex", name: "Alex" };
const sam = { id: "test-sam", name: "Sam" };
const lee = { id: "test-lee", name: "Lee" };
const date = "2026-11-23";
const disabled = { training: false, nutrition: false, nutritionDetails: false };
const friendDefaults = { training: true, nutrition: true, nutritionDetails: false };
const buddyDefaults = { training: true, nutrition: true, nutritionDetails: true };

function seedBodyProfile(db, owner, sex) {
  const profile = { kind: "body-profile", values: { heightCm: 175, age: 30, sex, ageAsOf: date } };
  db.sqlite.prepare("INSERT INTO personal_library (owner, id, kind, payload, updated) VALUES (?, 'body-profile', 'body-profile', ?, ?)")
    .run(owner, JSON.stringify(profile), date);
}

function seedRecords(db, owner) {
  const plan = { title: "力量", category: "力量训练", exercises: [
    { name: "卧推", unit: "kg", catalogueId: "0025", sourceSlot: "W1", sourceName: "私人来源", cue: "私人提示" },
    { name: "跳过动作", unit: "kg" },
  ] };
  const rows = [[{ done: true, weight: 40, reps: 8, seconds: 0, rpe: 9 }, { done: false, weight: 900, reps: 5, seconds: 0 }],
    [{ done: false, weight: 0, reps: 8, seconds: 0 }]];
  const workout = { date, plan, rows, minutes: 25, note: "只给自己看的备注", proteinShake: true, finishedVideo: false };
  db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, ?)")
    .run(owner, "log", "log", JSON.stringify(workout), date);
  db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, ?)")
    .run(owner, "draft", "draft", JSON.stringify({ ...workout, plan: { title: "草稿" } }), date);
  const meal = { type: "meal", meal: "早餐", name: "燕麦片", grams: 40, calories: 151.6, protein: 5.3, carbs: 27.1, fat: 2.6, foodId: "custom-food-id" };
  db.sqlite.prepare("INSERT INTO personal_library (owner, id, kind, day, payload, updated) VALUES (?, ?, 'nutrition', ?, ?, ?)")
    .run(owner, "food", date, JSON.stringify({ entry: meal }), date);
  db.sqlite.prepare("INSERT INTO personal_library (owner, id, kind, day, payload, updated) VALUES (?, ?, 'nutrition', ?, ?, ?)")
    .run(owner, "private-weight", date, JSON.stringify({ entry: { type: "weight", kg: 80 } }), date);
}

test("a completed workout can be renamed without changing its logged data", async (t) => {
  const db = fixture(t);
  const { updateLog } = await import("../features/history/update-log.ts");
  const { sessionSchema, startSession } = await import("../features/training/model.ts");
  const plan = {
    title: "原计划", date, minutes: 45, category: "力量训练", shared: false, video: "",
    exercises: [{ name: "哑铃卧推", catalogueId: "1234", cue: "保持肩胛稳定", sets: 1, reps: 10, weight: 20, unit: "kg", seconds: 0 }],
  };
  const original = startSession(plan, "example", date);
  original.rows[0][0].done = true;
  original.minutes = 28;
  original.note = "完成训练";
  original.proteinShake = true;
  const id = crypto.randomUUID();
  db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, 'log', ?, ?)")
    .run(alex.id, id, JSON.stringify(original), date);

  const next = sessionSchema.parse({ ...original, plan: { ...plan, title: "  上半身 · 胸、背、三头  " } });
  const updated = date + "T12:00:00Z";
  const expected = { ...original, plan: { ...plan, title: "上半身 · 胸、背、三头" } };
  assert.deepEqual(await updateLog(db, alex.id, id, date, next, updated), { data: expected, updated });
  const saved = db.sqlite.prepare("SELECT payload FROM entries WHERE owner = ? AND id = ?").get(alex.id, id);
  assert.deepEqual(JSON.parse(saved.payload), expected);
  await assert.rejects(updateLog(db, alex.id, id, date, next, updated), { status: 409 });
  await assert.rejects(updateLog(db, sam.id, id, updated, next, updated), { status: 409 });
});

test("a one-use friend invite shares work and diet status, with food details opt-in", async (t) => {
  const db = fixture(t);
  seedRecords(db, sam.id);
  seedBodyProfile(db, sam.id, "female");
  await assert.rejects(friendDay(db, alex.id, sam.id, date), { status: 404 });

  await changeFriends(db, sam, { action: "invite" });
  const { code } = (await listFriends(db, sam.id)).invite;
  await assert.rejects(changeFriends(db, sam, { action: "join", code }), { status: 409 });
  await changeFriends(db, alex, { action: "join", code });
  await assert.rejects(changeFriends(db, lee, { action: "join", code }), { status: 409 });
  assert.equal((await listFriends(db, sam.id)).invite, null);
  assert.deepEqual((await listFriends(db, alex.id)).friends, [
    { id: sam.id, name: sam.name, buddy: false, sharing: friendDefaults, shared: friendDefaults },
  ]);

  const defaults = await friendDay(db, alex.id, sam.id, date);
  assert.equal(defaults.anatomyVariant, "female");
  assert.doesNotMatch(JSON.stringify(defaults), /heightCm|ageAsOf|"sex"/);
  assert.equal(defaults.workoutCheckin, true);
  assert.equal(defaults.dietCheckin, true);
  assert.equal(defaults.nutrition, null);
  const [workout] = defaults.training;
  assert.equal(workout.title, "力量");
  assert.equal(workout.sets, 1);
  assert.equal(workout.exercises.length, 1);
  assert.equal(workout.exercises[0].catalogueId, "0025");
  assert.equal(workout.exercises[0].warmup, true);
  assert.equal(workout.exercises[0].sets[0].weight, 40);
  assert.doesNotMatch(JSON.stringify(workout), /只给自己看的备注|私人来源|私人提示|proteinShake|rpe|900|跳过动作/);

  await changeFriends(db, alex, { action: "share", id: sam.id, sharing: disabled });
  assert.equal((await friendDay(db, alex.id, sam.id, date)).training.length, 1);
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { training: false, nutrition: true } });
  const legacyWrite = await friendDay(db, alex.id, sam.id, date);
  assert.equal(legacyWrite.workoutCheckin, true);
  assert.equal(legacyWrite.dietCheckin, true);
  assert.equal(legacyWrite.training, null);
  assert.equal(legacyWrite.anatomyVariant, undefined);
  assert.equal(legacyWrite.nutrition, null);
  assert.equal((await friendDay(db, alex.id, sam.id, "2026-11-24")).dietCheckin, false);

  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { training: false, nutrition: true, nutritionDetails: true } });
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { training: false, nutrition: true } });
  const detailed = await friendDay(db, alex.id, sam.id, date);
  assert.equal(detailed.nutrition.length, 1);
  assert.equal(detailed.nutrition[0].grams, 40);
  assert.doesNotMatch(JSON.stringify(detailed.nutrition), /custom-food-id|private-weight/);

  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { ...disabled, nutritionDetails: true } });
  const privateDiet = await friendDay(db, alex.id, sam.id, date);
  assert.equal(privateDiet.dietCheckin, null);
  assert.equal(privateDiet.nutrition, null);
  assert.equal(privateDiet.friend.shared.nutritionDetails, false);

  await changeFriends(db, sam, { action: "remove", id: alex.id });
  assert.deepEqual((await listFriends(db, alex.id)).friends, []);
  await assert.rejects(friendDay(db, alex.id, sam.id, date), { status: 404 });
});

test("buddies always share training and can hide diet without changing their partner's permission", async (t) => {
  const db = fixture(t);
  db.sqlite.prepare("INSERT INTO rooms (id, owner, invite) VALUES ('test-room', ?, 'test-room-code')").run(alex.id);
  const member = db.sqlite.prepare("INSERT INTO members (user, room, name) VALUES (?, 'test-room', ?)");
  member.run(alex.id, alex.name);
  member.run(sam.id, sam.name);
  seedRecords(db, sam.id);
  const training = shareAccess(alex.id, sam.id, "training");
  const trainingAllowed = () => db.sqlite.prepare("SELECT " + training.condition + " AS allowed").get(...training.identifiers).allowed;

  const [buddy] = (await listFriends(db, alex.id)).friends;
  assert.equal(buddy.buddy, true);
  assert.deepEqual(buddy.shared, buddyDefaults);
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, "test-room"), [{ date, count: 1 }]);
  assert.equal(trainingAllowed(), 1);
  assert.equal((await friendDay(db, alex.id, sam.id, date)).nutrition.length, 1);

  await assert.rejects(changeFriends(db, alex, { action: "remove", id: sam.id }), { status: 409 });
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: disabled });
  const changed = await friendDay(db, alex.id, sam.id, date);
  assert.equal(trainingAllowed(), 1);
  assert.equal(changed.training.length, 1);
  assert.equal(changed.nutrition, null);
  assert.equal(changed.dietCheckin, null);
  assert.deepEqual(changed.friend.shared, { ...disabled, training: true });
  assert.deepEqual(changed.friend.sharing, buddyDefaults);

  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { training: false, nutrition: true, nutritionDetails: false } });
  const enabled = await friendDay(db, alex.id, sam.id, date);
  assert.equal(enabled.nutrition.length, 1);
  assert.deepEqual(enabled.friend.shared, buddyDefaults);
});

test("legacy friends keep their existing preferences when diet status is introduced", async (t) => {
  const db = fixture(t);
  seedRecords(db, sam.id);
  db.sqlite.prepare("INSERT INTO friend_links (first_id, second_id, first_name, second_name, linked, first_training, second_nutrition) " +
    "VALUES (?, ?, ?, ?, 1, 1, 1)").run(alex.id, sam.id, alex.name, sam.name);
  const detail = await friendDay(db, alex.id, sam.id, date);
  assert.equal(detail.workoutCheckin, true);
  assert.equal(detail.training, null);
  assert.equal(detail.dietCheckin, true);
  assert.equal(detail.nutrition.length, 1);
  assert.deepEqual(detail.friend.sharing, { ...disabled, training: true });
  assert.deepEqual(detail.friend.shared, { ...buddyDefaults, training: false });

  await changeFriends(db, sam, { action: "invite" });
  const { code } = (await listFriends(db, sam.id)).invite;
  await changeFriends(db, alex, { action: "join", code });
  assert.deepEqual((await listFriends(db, alex.id)).friends[0], detail.friend);
});


function pair(db, left = alex, right = sam, connection = crypto.randomUUID()) {
  db.sqlite.prepare("INSERT INTO rooms (id, invite, owner) VALUES (?, ?, ?)").run(connection, crypto.randomUUID(), left.id);
  const member = db.sqlite.prepare("INSERT INTO members (user, room, name) VALUES (?, ?, ?)");
  member.run(left.id, connection, left.name);
  member.run(right.id, connection, right.name);
  return connection;
}

function setPrivacy(db, person, overrides) {
  return changeSocial(db, person, {
    action: "social-preferences", preferences: { closed: false, discoverable: false, recentOnly: false, ...overrides },
  });
}

function copyLog(db, owner, id, day) {
  db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) " +
    "SELECT owner, ?, kind, json_set(payload, '$.date', ?), ? FROM entries WHERE owner = ? AND id = 'log'")
    .run(id, day, day, owner);
}

test("friends feed limits dates and omits unshared workout metadata", async (t) => {
  const db = fixture(t);
  const outsider = { id: "outsider", name: "Outsider" };
  pair(db);
  db.sqlite.prepare("INSERT INTO friend_links (first_id, second_id, first_name, second_name, linked) VALUES (?, ?, ?, ?, 1)")
    .run(alex.id, lee.id, alex.name, lee.name);
  await changeFriends(db, lee, { action: "share", id: alex.id, sharing: disabled });
  for (const person of [alex, sam, lee, outsider]) seedRecords(db, person.id);
  copyLog(db, sam.id, "future", "2026-11-26");
  copyLog(db, sam.id, "old", "2026-11-22");
  copyLog(db, sam.id, "latest", "2026-11-25");
  copyLog(db, outsider.id, "latest", "2026-11-25");

  const { days } = await friendFeed(db, alex.id, "2026-11-25");
  assert.deepEqual(days.map(({ date }) => date), ["2026-11-25", "2026-11-24", "2026-11-23"]);
  assert.deepEqual(days[0].items, [{
    friend: { id: sam.id, name: sam.name, buddy: true },
    workouts: [{ id: "latest", title: "力量", category: "力量训练", minutes: 25, sets: 1, exercises: 1 }],
  }]);
  assert.deepEqual(days[1].items, []);
  assert.deepEqual(days[2].items[1], { friend: { id: lee.id, name: lee.name, buddy: false }, workouts: null });
  const serialized = JSON.stringify(days);
  for (const privateText of ["私人来源", "只给自己看的备注", "燕麦片", outsider.id, "future", '"old"']) {
    assert.equal(serialized.includes(privateText), false);
  }
  await setPrivacy(db, sam, { closed: true });
  await setPrivacy(db, lee, { closed: true });
  assert.deepEqual((await friendFeed(db, alex.id, "2026-11-25")).days.map(({ items }) => items.map(({ friend }) => friend.id)),
    [[sam.id], [], [sam.id]]);
  assert.deepEqual((await listFriends(db, alex.id)).friends.map(({ id }) => id), [sam.id, lee.id]);
});

test("friends API requires authentication and routes social and legacy operations", async (t) => {
  const origin = "https://example.invalid";
  const endpoint = origin + "/api/friends";
  const db = fixture(t);
  runtime.owner = null;
  runtime.env.DB = db;
  t.after(() => { runtime.owner = alex.id; runtime.env.DB = undefined; });
  const post = (action) => mutateFriends(new Request(endpoint, {
    method: "POST", body: JSON.stringify(action), headers: { origin, "Content-Type": "application/json" },
  }));
  assert.equal((await loadFriends(new Request(endpoint + "?feed=1"))).status, 401);
  assert.equal((await post({ action: "invite" })).status, 401);
  runtime.owner = alex.id;
  const preferences = { closed: true, discoverable: false, recentOnly: true };
  assert.deepEqual(await (await post({ action: "social-preferences", preferences })).json(), { preferences, incoming: [], outgoing: [] });
  assert.deepEqual(await (await loadFriends(new Request(endpoint + "?section=social"))).json(), { preferences, incoming: [], outgoing: [] });
  assert.deepEqual(await (await loadFriends(new Request(endpoint + "?search=somebody"))).json(), { results: [] });
  assert.match((await (await post({ action: "invite" })).json()).invite.code, /^[a-f0-9]{32}$/);
});

test("three-day privacy remains reciprocal when a buddy closes their friends circle", async (t) => {
  const db = fixture(t);
  runtime.owner = alex.id;
  runtime.env.DB = db;
  t.after(() => { runtime.env.DB = undefined; });
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-26T01:30:00Z") });
  const request = new Request("https://example.invalid/api/workout?today=2026-11-22&timezone=Pacific/Honolulu");
  Object.defineProperty(request, "cf", { value: { timezone: "America/Toronto" } });
  const today = "2026-11-25";
  const old = "2026-11-22";
  const connection = pair(db);
  for (const person of [alex, sam]) {
    seedRecords(db, person.id);
    copyLog(db, person.id, "old", old);
  }
  copyLog(db, sam.id, "future", "2026-11-26");
  seedBodyProfile(db, sam.id, "female");
  db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, 'next-plan', 'plan', ?, ?)")
    .run(sam.id, JSON.stringify({ date: "2026-11-26", shared: true, title: "Private future" }), today);
  assert.equal((await friendDay(db, alex.id, sam.id, old, today)).workoutCheckin, true);

  await setPrivacy(db, sam, { recentOnly: true });
  for (const [viewer, peer] of [[alex, sam], [sam, alex]]) {
    const restricted = await friendDay(db, viewer.id, peer.id, old, today);
    assert.deepEqual({ ...restricted, friend: undefined }, {
      friend: undefined, date: old, restricted: true, workoutCheckin: false, dietCheckin: null, training: null, nutrition: null,
    });
    const allowed = await friendDay(db, viewer.id, peer.id, date, today);
    assert.equal(allowed.restricted, undefined);
    assert.equal(allowed.workoutCheckin, true);
    assert.equal(allowed.training.length, 1);
    assert.equal(allowed.nutrition.length, 1);
    assert.equal((await listFriends(db, viewer.id, old, today)).friends[0].checkedIn, undefined);
  }
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, connection, today), [{ date, count: 1 }]);
  const limited = await (await loadWorkout(request)).json();
  assert.deepEqual(limited.entries.filter((entry) => entry.owner === sam.id).map((entry) => entry.id), ["log"]);
  assert.equal(limited.entries.some((entry) => entry.owner === alex.id && entry.id === "old"), true);
  assert.deepEqual(limited.room.partnerCheckins, [{ date, count: 1 }]);
  assert.equal(limited.room.partnerCheckinsFrom, date);
  assert.equal(limited.room.partnerTrainingShared, true);

  await setPrivacy(db, sam, { closed: true, recentOnly: true });
  const buddy = await friendDay(db, alex.id, sam.id, date, today);
  assert.equal(buddy.restricted, undefined);
  assert.equal(buddy.workoutCheckin, true);
  assert.equal(buddy.training.length, 1);
  assert.equal(buddy.dietCheckin, true);
  assert.equal(buddy.nutrition.length, 1);
  assert.equal(buddy.anatomyVariant, "female");
  assert.equal((await friendDay(db, sam.id, alex.id, date, today)).workoutCheckin, true);
  assert.equal((await listFriends(db, alex.id, date, today)).friends[0].checkedIn, true);
  assert.equal((await friendDay(db, alex.id, sam.id, old, today)).restricted, true);
  const shared = await (await loadWorkout(request)).json();
  assert.deepEqual(shared.entries.filter((entry) => entry.owner === sam.id).map((entry) => entry.id), ["log"]);
  assert.deepEqual(shared.room.partnerCheckins, [{ date, count: 1 }]);
  assert.equal(shared.room.partnerCheckinsFrom, date);
  assert.deepEqual(shared.room.partner, { id: sam.id, name: sam.name, anatomyVariant: "female" });
  assert.equal(shared.room.partnerTrainingShared, true);
});

test("closing friends circle hides ordinary friend records while buddy nutrition follows its own switch", async (t) => {
  const db = fixture(t);
  const today = "2026-11-25";
  const connection = pair(db);
  seedRecords(db, sam.id);
  await changeFriends(db, sam, { action: "invite" });
  const { code } = (await listFriends(db, sam.id)).invite;
  await changeFriends(db, lee, { action: "join", code });
  await changeFriends(db, sam, { action: "share", id: lee.id, sharing: { training: true, nutrition: true, nutritionDetails: true } });
  const before = await friendDay(db, lee.id, sam.id, date, today);
  assert.equal(before.training.length, 1);
  assert.equal(before.nutrition.length, 1);

  await setPrivacy(db, sam, { closed: true });
  assert.deepEqual({ ...(await friendDay(db, lee.id, sam.id, date, today)), friend: undefined }, {
    friend: undefined, date, restricted: true, workoutCheckin: false, dietCheckin: null, training: null, nutrition: null,
  });
  const [ordinaryFriend] = (await listFriends(db, lee.id, date, today)).friends;
  assert.equal(ordinaryFriend.id, sam.id);
  assert.equal(ordinaryFriend.checkedIn, undefined);
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, connection, today), [{ date, count: 1 }]);

  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: disabled });
  const buddy = await friendDay(db, alex.id, sam.id, date, today);
  assert.equal(buddy.workoutCheckin, true);
  assert.equal(buddy.training.length, 1);
  assert.equal(buddy.dietCheckin, null);
  assert.equal(buddy.nutrition, null);
  await disconnectPair(db, alex.id, sam.id, connection);
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, connection, today), []);
});

test("workout GET serves only performed sets and keeps the same two-sided volume", async (t) => {
  const db = fixture(t);
  runtime.owner = alex.id;
  runtime.env.DB = db;
  t.after(() => { runtime.env.DB = undefined; });
  const connection = pair(db);
  seedBodyProfile(db, alex.id, "male");
  seedBodyProfile(db, sam.id, "female");
  const session = {
    plan: {
      title: "正课", category: "力量训练", exercises: [
        { name: "双绳索推胸", unit: "lb", cue: "每手 私人动作提示", station: "私人器材位置", weight: 999 },
        { name: "单臂划船", unit: "kg", cue: "总重 私人备注", weight: 888 },
        { name: "跳过动作", unit: "kg", weight: 777 },
      ],
      video: "https://youtu.be/private-session-video",
    },
    date, minutes: 34, started: 1795461300000, planId: "private-plan", ended: 1795461600000,
    note: "私人训练笔记", proteinShake: true, finishedVideo: false,
    rows: [
      [{ weight: 30, reps: 10, seconds: 0, done: true, rpe: 9 }, { weight: 999, reps: 9, seconds: 0, done: false }],
      [{ weight: 25, reps: 10, seconds: 0, done: true }],
      [{ weight: 777, reps: 10, seconds: 0, done: false }],
    ],
  };
  const entry = db.sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, ?)");
  entry.run(sam.id, "same-id", "log", JSON.stringify(session), date);
  entry.run(sam.id, "completed-shared", "log", JSON.stringify({ ...session, planId: "shared-plan" }), date);
  entry.run(sam.id, "private-plan", "plan", JSON.stringify({ ...session.plan, shared: false }), date);
  entry.run(sam.id, "shared-plan", "plan", JSON.stringify({ ...session.plan, shared: true, templateId: "private-id" }), date);
  entry.run(sam.id, "private-draft", "draft", JSON.stringify(session), date);
  entry.run(alex.id, "same-id", "log", JSON.stringify(session), date);
  const projected = publicPartnerSession(session);
  assert.deepEqual(sessionTotals(projected), sessionTotals(session));
  assert.deepEqual(projected.plan.exercises.map((item) => item.sets), [1, 1]);
  assert.doesNotMatch(JSON.stringify(projected), /私人|private|proteinShake|rpe|999|777|跳过动作|1795461300000/);

  const response = await loadWorkout();
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.me.anatomyVariant, "male");
  assert.equal(state.room.partner.anatomyVariant, "female");
  assert.doesNotMatch(JSON.stringify(state), /heightCm|ageAsOf|"sex"/);
  assert.deepEqual(state.entries.filter((item) => item.owner === sam.id).map((item) => item.id).sort(), ["completed-shared", "same-id", "shared-plan"]);
  const buddy = state.entries.find((item) => item.owner === sam.id && item.id === "same-id");
  assert.deepEqual(buddy.data, JSON.parse(JSON.stringify(projected)));
  assert.equal(state.entries.find((item) => item.id === "completed-shared").data.planId, "shared-plan");
  assert.equal(state.entries.find((item) => item.owner === alex.id && item.kind === "log").data.note, session.note);
  assert.equal(state.entries.find((item) => item.id === "shared-plan").data.templateId, undefined);

  await disconnectPair(db, alex.id, sam.id, connection);
  const disconnected = await (await loadWorkout()).json();
  assert.equal(disconnected.me.anatomyVariant, "male");
  assert.equal(disconnected.room, null);
  assert.doesNotMatch(JSON.stringify(disconnected), /female/);
});

test("disconnect revokes both implicit views and preserves separately configured friendship", async (t) => {
  const db = fixture(t);
  seedRecords(db, sam.id);
  await changeFriends(db, sam, { action: "invite" });
  const { code } = (await listFriends(db, sam.id)).invite;
  await changeFriends(db, alex, { action: "join", code });
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: disabled });
  const connection = pair(db);
  assert.deepEqual((await friendDay(db, alex.id, sam.id, date)).friend.shared, buddyDefaults);
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { ...disabled, nutrition: true } });
  await assert.rejects(disconnectPair(db, lee.id, sam.id, connection), { status: 409 });
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, connection), [{ date, count: 1 }]);
  await disconnectPair(db, alex.id, sam.id, connection);
  assert.deepEqual(await buddyCheckins(db, alex.id, sam.id, connection), []);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rooms").get().n, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM members").get().n, 0);
  const after = await friendDay(db, alex.id, sam.id, date);
  assert.equal(after.friend.buddy, false);
  assert.deepEqual(after.friend.shared, disabled);
  assert.equal(after.workoutCheckin, true);
  assert.equal(after.training, null);
  assert.equal(after.dietCheckin, null);
  assert.equal((await listFriends(db, alex.id, date)).friends[0].checkedIn, true);
  assert.equal((await listFriends(db, alex.id, "2026-11-24")).friends[0].checkedIn, false);
  assert.deepEqual((await listFriends(db, lee.id, date)).friends, []);
});

test("cheers are idempotent per local day and cannot follow a new or unrelated connection", async (t) => {
  const db = fixture(t);
  runtime.owner = alex.id;
  runtime.env.DB = db;
  t.after(() => { runtime.env.DB = undefined; });
  const earlier = pair(db);
  const sendTime = new Date("2026-11-24T03:30:00Z");
  await sendPairCheer(db, sam.id, alex.id, earlier, "America/Toronto", sendTime);
  await sendPairCheer(db, sam.id, alex.id, earlier, "America/Toronto", new Date("2026-11-24T03:50:00Z"));
  await assert.rejects(sendPairCheer(db, lee.id, alex.id, earlier, "Asia/Shanghai", sendTime), { status: 409 });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE kind = 'cheer'").get().n, 1);
  const getCheer = async () => (await (await loadWorkout()).json()).entries.find((entry) => entry.kind === "cheer");
  assert.deepEqual((await getCheer()).data, { date: "2026-11-23" });
  await disconnectPair(db, alex.id, sam.id, earlier);
  const next = pair(db, alex, lee);
  assert.equal(await getCheer(), undefined);
  await assert.rejects(sendPairCheer(db, alex.id, sam.id, earlier, "America/Toronto", sendTime), { status: 409 });
  await sendPairCheer(db, lee.id, alex.id, next, "Asia/Shanghai", sendTime);
  assert.deepEqual((await getCheer()).data, { date: "2026-11-24" });
});

test("migration preserves the previously effective diet opt-out for an existing pair", async (t) => {
  const db = fixture(t, true);
  pair(db);
  db.sqlite.prepare("INSERT INTO friend_links (first_id, second_id, first_name, second_name, first_nutrition_status, second_nutrition_status) " +
    "VALUES (?, ?, ?, ?, 0, 1)").run(alex.id, sam.id, alex.name, sam.name);
  db.sqlite.exec(readFileSync(new URL("drizzle/" + lastMigration, root), "utf8"));
  const [buddy] = (await listFriends(db, alex.id)).friends;
  assert.equal(buddy.sharing.nutrition, false);
  assert.equal(buddy.shared.nutrition, true);
});
