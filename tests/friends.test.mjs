import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });
const { buddyCheckins, changeFriends, friendDay, listFriends, shareAccess } = await import("../features/friends/server.ts");

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const drizzle = new URL("drizzle/", root);
  for (const file of readdirSync(drizzle).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, drizzle), "utf8"));
  }
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
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

function seedRecords(db, owner) {
  const plan = { title: "力量", category: "力量训练", exercises: [{ name: "卧推", unit: "kg" }, { name: "跳过动作", unit: "kg" }] };
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

test("a one-use friend invite shares work and diet status, with food details opt-in", async (t) => {
  const db = fixture(t);
  seedRecords(db, sam.id);
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
  assert.equal(defaults.workoutCheckin, true);
  assert.equal(defaults.dietCheckin, true);
  assert.equal(defaults.nutrition, null);
  const [workout] = defaults.training;
  assert.equal(workout.title, "力量");
  assert.equal(workout.sets, 1);
  assert.equal(workout.exercises.length, 1);
  assert.equal(workout.exercises[0].sets[0].weight, 40);
  assert.doesNotMatch(JSON.stringify(workout), /只给自己看的备注|proteinShake|rpe|900|跳过动作/);

  await changeFriends(db, alex, { action: "share", id: sam.id, sharing: disabled });
  assert.equal((await friendDay(db, alex.id, sam.id, date)).training.length, 1);
  await changeFriends(db, sam, { action: "share", id: alex.id, sharing: { training: false, nutrition: true } });
  const legacyWrite = await friendDay(db, alex.id, sam.id, date);
  assert.equal(legacyWrite.workoutCheckin, true);
  assert.equal(legacyWrite.dietCheckin, true);
  assert.equal(legacyWrite.training, null);
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
  assert.deepEqual(await buddyCheckins(db, sam.id), [{ date, count: 1 }]);
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
