import { HttpError } from "@/server/http";
import { dateSchema } from "@/shared/dates";
import type { MealEntry } from "@/features/library/model";
import type { Session } from "@/features/training/model";
import { activePair } from "@/features/pair/server";
import { completedMoves } from "./public-training";
import type { Checkin, Person } from "@/shared/state";
import type { Friend, FriendDay, FriendList, FriendMutation, SharedMeal, SharedWorkout, Sharing } from "./model";

type Buddy = Person & { selfNutrition: number; peerNutrition: number };

type Link = {
  first_id: string;
  second_id: string;
  first_name: string;
  second_name: string;
  first_training: number;
  second_training: number;
  first_nutrition: number;
  second_nutrition: number;
  first_nutrition_status: number | null;
  second_nutrition_status: number | null;
};

const inviteLifetime = 24 * 60 * 60 * 1000;
const buddySubquery = (alias: "f" | "pair") =>
  "SELECT 1 FROM members m JOIN members p ON p.room = m.room WHERE m.user = " + alias + ".first_id AND p.user = " + alias + ".second_id";
const activeLink = "(f.linked = 1 OR EXISTS (" + buddySubquery("f") + "))";
const friendMissing = () => new HttpError(404, "找不到这位好友。");

function sides(owner: string, friend: string) {
  return owner < friend ? { first: owner, second: friend, self: "first", peer: "second" } as const :
    { first: friend, second: owner, self: "second", peer: "first" } as const;
}

function getBuddy(db: D1Database, owner: string) {
  return db.prepare("SELECT p.user AS id, p.name, m.share_nutrition AS selfNutrition, p.share_nutrition AS peerNutrition " +
    "FROM members m JOIN members p ON p.room = m.room AND p.user <> m.user WHERE m.user = ?").bind(owner).first<Buddy>();
}

function friendFromLink(row: Link, owner: string, buddy: Buddy | null): Friend {
  const self = row.first_id === owner ? "first" : "second";
  const peer = self === "first" ? "second" : "first";
  const id = peer === "first" ? row.first_id : row.second_id;
  if (buddy?.id === id) return pairedFriend(buddy);
  const flags = (side: "first" | "second"): Sharing => {
    const details = side === "first" ? row.first_nutrition : row.second_nutrition;
    const status = side === "first" ? row.first_nutrition_status : row.second_nutrition_status;
    const nutrition = Boolean(status ?? details);
    return {
      training: Boolean(side === "first" ? row.first_training : row.second_training),
      nutrition,
      nutritionDetails: nutrition && Boolean(details),
    };
  };
  return { id, name: peer === "first" ? row.first_name : row.second_name,
    buddy: false, sharing: flags(self), shared: flags(peer) };
}

function pairedFriend({ id, name, selfNutrition, peerNutrition }: Buddy): Friend {
  const sharing = (enabled: number): Sharing => ({ training: true, nutrition: Boolean(enabled), nutritionDetails: Boolean(enabled) });
  return { id, name, buddy: true, sharing: sharing(selfNutrition), shared: sharing(peerNutrition) };
}

async function getFriend(db: D1Database, owner: string, id: string) {
  if (owner === id) throw friendMissing();
  const { first, second } = sides(owner, id);
  const [row, buddy] = await Promise.all([
    db.prepare("SELECT f.* FROM friend_links f WHERE f.first_id = ? AND f.second_id = ? AND " + activeLink).bind(first, second).first<Link>(),
    getBuddy(db, owner),
  ]);
  if (row) return friendFromLink(row, owner, buddy);
  if (buddy?.id === id) return pairedFriend(buddy);
  throw friendMissing();
}

export async function listFriends(db: D1Database, owner: string, day?: string): Promise<FriendList> {
  const [links, invite, buddy] = await Promise.all([
    db.prepare("SELECT f.* FROM friend_links f WHERE (f.first_id = ? OR f.second_id = ?) AND " + activeLink).bind(owner, owner).all<Link>(),
    db.prepare("SELECT code, expires_at AS expiresAt FROM friend_invites WHERE owner = ? AND expires_at > ?")
      .bind(owner, new Date().toISOString()).first<NonNullable<FriendList["invite"]>>(),
    getBuddy(db, owner),
  ]);
  const friends = links.results.map((row) => friendFromLink(row, owner, buddy));
  if (buddy && !friends.some((item) => item.buddy)) friends.push(pairedFriend(buddy));
  friends.sort((a, b) => Number(b.buddy) - Number(a.buddy) || a.name.localeCompare(b.name, "zh-CN"));
  if (day && friends.length) {
    const { results } = await db.prepare(
      "SELECT DISTINCT e.owner FROM entries e WHERE e.owner IN (SELECT value FROM json_each(?)) " +
      "AND e.kind = 'log' AND json_extract(e.payload, '$.date') = ? AND (" +
      "EXISTS (SELECT 1 FROM friend_links f WHERE f.first_id = MIN(?, e.owner) " +
      "AND f.second_id = MAX(?, e.owner) AND f.linked = 1) OR " +
      "EXISTS (SELECT 1 FROM members m JOIN members p ON p.room = m.room WHERE m.user = ? AND p.user = e.owner))"
    ).bind(JSON.stringify(friends.map((friend) => friend.id)), day, owner, owner, owner).all<{ owner: string }>();
    const checked = new Set(results.map((row) => row.owner));
    return { friends: friends.map((friend) => ({ ...friend, checkedIn: checked.has(friend.id) })), invite };
  }
  return { friends, invite };
}

// Verify the relationship and consent in the same query that reads the friend's data.
export function shareAccess(owner: string, friend: string, scope: "checkin" | "training" | "dietCheckin" | "nutrition") {
  const { first, second, peer } = sides(owner, friend);
  const paired = "EXISTS (" + buddySubquery("pair") + ")";
  const details = "f." + peer + "_nutrition";
  const pairedDiet = "(SELECT m.share_nutrition FROM members m JOIN members p ON p.room = m.room " +
    "WHERE m.user = pair." + peer + "_id AND p.user = pair." + (peer === "first" ? "second" : "first") + "_id)";
  const dietStatus = "CASE WHEN " + paired + " THEN " + pairedDiet +
    " ELSE COALESCE(f." + peer + "_nutrition_status, " + details + ", 1) END = 1";
  const allowed = {
    checkin: "1",
    training: "(" + paired + " OR f." + peer + "_training = 1)",
    dietCheckin: dietStatus,
    nutrition: "(" + dietStatus + " AND (" + paired + " OR " + details + " = 1))",
  }[scope];
  return {
    condition: "EXISTS (SELECT 1 FROM (SELECT ? AS first_id, ? AS second_id) AS pair " +
      "LEFT JOIN friend_links f ON f.first_id = pair.first_id AND f.second_id = pair.second_id " +
      "WHERE pair.first_id <> pair.second_id AND (" + paired + " OR f.linked = 1) AND " + allowed + ")",
    identifiers: [first, second] as const,
  };
}

export async function buddyCheckins(db: D1Database, owner: string, friend: string, connection: string): Promise<Checkin[]> {
  const { results } = await db.prepare(
    "SELECT json_extract(payload, '$.date') AS date, COUNT(*) AS count FROM entries WHERE owner = ? AND kind = 'log' AND " +
    activePair + " GROUP BY date ORDER BY date DESC"
  ).bind(friend, connection, owner, friend).all<{ date: unknown; count: number }>();
  return results.flatMap(({ date, count }) => typeof date === "string" && dateSchema.safeParse(date).success ? [{ date, count }] : []);
}

function publicWorkout(id: string, data: Session): SharedWorkout {
  const exercises = completedMoves(data).map(({ move: { unit }, name, sets }) => ({ name, unit, sets }));
  return { id, title: data.plan.title, category: data.plan.category, minutes: data.minutes, finishedVideo: data.finishedVideo,
    sets: exercises.reduce((total, move) => total + move.sets.length, 0), exercises };
}

function publicMeal(id: string, entry: MealEntry): SharedMeal {
  const { meal, name, grams, calories, protein, carbs, fat } = entry;
  return { id, meal, name, grams, calories, protein, carbs, fat };
}

export async function friendDay(db: D1Database, owner: string, id: string, date: string): Promise<FriendDay> {
  const friend = await getFriend(db, owner, id);
  const checkin = shareAccess(owner, id, "checkin");
  const training = shareAccess(owner, id, "training");
  const dietCheckin = shareAccess(owner, id, "dietCheckin");
  const nutrition = shareAccess(owner, id, "nutrition");
  const workoutFilter = " FROM entries WHERE owner = ? AND kind = 'log' AND json_extract(payload, '$.date') = ? AND ";
  const mealFilter = " FROM personal_library WHERE owner = ? AND kind = 'nutrition' AND day = ? AND json_extract(payload, '$.entry.type') = 'meal' AND ";
  type Row = { id: string; payload: string };
  const [workedOut, workouts, ate, meals] = await Promise.all([
    db.prepare("SELECT 1" + workoutFilter + checkin.condition + " LIMIT 1").bind(id, date, ...checkin.identifiers).first(),
    friend.shared.training ? db.prepare("SELECT id, payload" + workoutFilter + training.condition + " ORDER BY updated DESC")
      .bind(id, date, ...training.identifiers).all<Row>() : null,
    friend.shared.nutrition ? db.prepare("SELECT 1" + mealFilter + dietCheckin.condition + " LIMIT 1")
      .bind(id, date, ...dietCheckin.identifiers).first() : null,
    friend.shared.nutritionDetails ? db.prepare("SELECT id, payload" + mealFilter + nutrition.condition + " ORDER BY updated DESC")
      .bind(id, date, ...nutrition.identifiers).all<Row>() : null,
  ]);
  return { friend, date,
    workoutCheckin: Boolean(workedOut), dietCheckin: friend.shared.nutrition ? Boolean(ate) : null,
    training: workouts?.results.map(({ id, payload }) => publicWorkout(id, JSON.parse(payload) as Session)) ?? null,
    nutrition: meals?.results.map(({ id, payload }) => publicMeal(id, (JSON.parse(payload) as { entry: MealEntry }).entry)) ?? null,
  };
}

export async function changeFriends(db: D1Database, user: Person, mutation: FriendMutation) {
  const now = new Date().toISOString();
  if (mutation.action === "invite") {
    await db.prepare(
      "INSERT INTO friend_invites (owner, name, code, expires_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(owner) DO UPDATE SET name = excluded.name, code = excluded.code, expires_at = excluded.expires_at"
    ).bind(user.id, user.name, crypto.randomUUID().replace(/-/g, ""), new Date(Date.now() + inviteLifetime).toISOString()).run();
    return;
  }
  if (mutation.action === "revoke") {
    await db.prepare("DELETE FROM friend_invites WHERE owner = ?").bind(user.id).run();
    return;
  }
  if (mutation.action === "join") {
    const validInvite = "code = ? AND owner <> ? AND expires_at > ?";
    // Accept and consume the code in one D1 transaction, even if two people try it concurrently.
    const [linked] = await db.batch([
      db.prepare(
        "INSERT INTO friend_links (first_id, second_id, first_name, second_name, linked, first_training, second_training, first_nutrition_status, second_nutrition_status) " +
        "SELECT CASE WHEN owner < ? THEN owner ELSE ? END, CASE WHEN owner < ? THEN ? ELSE owner END, " +
        "CASE WHEN owner < ? THEN name ELSE ? END, CASE WHEN owner < ? THEN ? ELSE name END, 1, 1, 1, 1, 1 " +
        "FROM friend_invites WHERE " + validInvite +
        " ON CONFLICT(first_id, second_id) DO UPDATE SET linked = 1, first_name = excluded.first_name, second_name = excluded.second_name, " +
        ["first_training", "second_training", "first_nutrition", "second_nutrition", "first_nutrition_status", "second_nutrition_status"]
          .map((field) => field + " = CASE WHEN friend_links.linked = 0 THEN excluded." + field + " ELSE friend_links." + field + " END").join(", ")
      ).bind(user.id, user.id, user.id, user.id, user.id, user.name, user.id, user.name, mutation.code, user.id, now),
      db.prepare("DELETE FROM friend_invites WHERE " + validInvite).bind(mutation.code, user.id, now),
    ]);
    if (!linked.meta.changes) throw new HttpError(409, "邀请码无效、已使用、已过期或是你自己的。");
    return;
  }
  const relation = await getFriend(db, user.id, mutation.id);
  const { first, second, self } = sides(user.id, mutation.id);
  if (mutation.action === "remove") {
    if (relation.buddy) throw new HttpError(409, "当前搭子可在这里调整共享范围。");
    const removed = await db.prepare("DELETE FROM friend_links AS f WHERE f.first_id = ? AND f.second_id = ? AND f.linked = 1 AND NOT EXISTS (" +
      buddySubquery("f") + ")").bind(first, second).run();
    if (!removed.meta.changes) throw friendMissing();
    return;
  }
  const trainingFlag = self + "_training";
  const nutritionFlag = self + "_nutrition";
  const statusFlag = self + "_nutrition_status";
  const nutrition = Number(mutation.sharing.nutrition);
  if (relation.buddy) {
    const updated = await db.prepare(
      "UPDATE members SET share_nutrition = ? WHERE user = ? AND " +
      "EXISTS (SELECT 1 FROM members p WHERE p.room = members.room AND p.user = ?)"
    ).bind(nutrition, user.id, mutation.id).run();
    if (!updated.meta.changes) throw friendMissing();
    return;
  }
  const details = mutation.sharing.nutritionDetails === undefined ? null : Number(mutation.sharing.nutritionDetails);
  const previouslyShared = "CASE WHEN COALESCE(" + statusFlag + ", " + nutritionFlag + ") = 1 THEN " + nutritionFlag + " ELSE 0 END";
  const updated = await db.prepare("UPDATE friend_links SET " + trainingFlag + " = ?, " + statusFlag + " = ?, " + nutritionFlag +
    " = CASE WHEN ? = 1 THEN COALESCE(?, " + previouslyShared + ") ELSE 0 END WHERE first_id = ? AND second_id = ? AND linked = 1")
    .bind(Number(mutation.sharing.training), nutrition, nutrition, details, first, second).run();
  if (!updated.meta.changes) throw friendMissing();
}
