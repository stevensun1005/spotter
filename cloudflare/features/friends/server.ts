import { HttpError } from "@/server/http";
import { accountName } from "@/features/auth/display-name";
import { publicName } from "./public-name";
import { asDate, dateSchema, offsetDate } from "@/shared/dates";
import { anatomyVariant } from "@/features/body/profile";
import type { MealEntry } from "@/features/library/model";
import type { Session } from "@/features/training/model";
import { activePair, validTimeZone } from "@/features/pair/server";
import { completedMoves, publicMoveInfo } from "./public-training";
import type { Checkin, Person } from "@/shared/state";
import type { Friend, FriendDay, FriendFeed, FriendList, FriendMutation, SharedMeal, SharedWorkout, SharedWorkoutSummary, Sharing } from "./model";

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
const buddySubquery = (alias: "f") =>
  "SELECT 1 FROM members m JOIN members p ON p.room = m.room WHERE m.user = " + alias + ".first_id AND p.user = " + alias + ".second_id";
const activeLink = "(f.linked = 1 OR EXISTS (" + buddySubquery("f") + "))";
const linkNames = "f.first_id, f.second_id, " + accountName("f.first_id", "f.first_name") + " AS first_name, " +
  accountName("f.second_id", "f.second_name") + " AS second_name, f.first_training, f.second_training, " +
  "f.first_nutrition, f.second_nutrition, f.first_nutrition_status, f.second_nutrition_status";
const friendMissing = () => new HttpError(404, "找不到这位好友。");

function sides(owner: string, friend: string) {
  return owner < friend ? { first: owner, second: friend, self: "first", peer: "second" } as const :
    { first: friend, second: owner, self: "second", peer: "first" } as const;
}

function getBuddy(db: D1Database, owner: string) {
  return db.prepare("SELECT p.user AS id, " + accountName("p.user", "p.name") + " AS name, m.share_nutrition AS selfNutrition, p.share_nutrition AS peerNutrition " +
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
    db.prepare("SELECT " + linkNames + " FROM friend_links f WHERE f.first_id = ? AND f.second_id = ? AND " + activeLink).bind(first, second).first<Link>(),
    getBuddy(db, owner),
  ]);
  if (row) return friendFromLink(row, owner, buddy);
  if (buddy?.id === id) return pairedFriend(buddy);
  throw friendMissing();
}

export function friendCurrentDay(request?: Request) {
  const zone = (request as (Request & { cf?: { timezone?: string } }) | undefined)?.cf?.timezone;
  return asDate(Date.now(), zone && zone.length <= 64 && validTimeZone(zone) ? zone : "UTC");
}

export function friendDateLimited(peer: string) {
  return "EXISTS (SELECT 1 FROM friend_profiles WHERE recent_only = 1 AND (owner = ? OR owner = " + peer + "))";
}

export function friendDateVisible(owner: string, peer: string, day: string, today: string) {
  return {
    condition: "(NOT " + friendDateLimited(peer) + " OR " + day + " BETWEEN ? AND ?)",
    args: [owner, offsetDate(today, -2), today] as const,
  };
}

export async function listFriends(db: D1Database, owner: string, day?: string, today = friendCurrentDay()): Promise<FriendList> {
  const [links, invite, buddy] = await Promise.all([
    db.prepare("SELECT " + linkNames + " FROM friend_links f WHERE (f.first_id = ? OR f.second_id = ?) AND " + activeLink).bind(owner, owner).all<Link>(),
    db.prepare("SELECT code, expires_at AS expiresAt FROM friend_invites WHERE owner = ? AND expires_at > ?")
      .bind(owner, new Date().toISOString()).first<NonNullable<FriendList["invite"]>>(),
    getBuddy(db, owner),
  ]);
  const friends = links.results.map((row) => friendFromLink(row, owner, buddy));
  if (buddy && !friends.some((item) => item.buddy)) friends.push(pairedFriend(buddy));
  friends.sort((a, b) => Number(b.buddy) - Number(a.buddy) || a.name.localeCompare(b.name, "zh-CN"));
  if (day && friends.length) {
    const visible = friendDateVisible(owner, "contact.value", "target.day", today);
    const { results } = await db.prepare(
      "SELECT contact.value AS owner, EXISTS (SELECT 1 FROM entries e WHERE e.owner = contact.value " +
      "AND e.kind = 'log' AND json_extract(e.payload, '$.date') = target.day) AS checkedIn " +
      "FROM json_each(?) contact CROSS JOIN (SELECT ? AS day) target WHERE " +
      relationshipAccess("SELECT ? AS viewer, contact.value AS peer", "checkin") + " AND " + visible.condition
    ).bind(JSON.stringify(friends.map((friend) => friend.id)), day, owner, ...visible.args).all<{ owner: string; checkedIn: number }>();
    const statuses = new Map(results.map(({ owner, checkedIn }) => [owner, Boolean(checkedIn)]));
    return { friends: friends.map((friend) => ({ ...friend, checkedIn: statuses.get(friend.id) })), invite };
  }
  return { friends, invite };
}

type Scope = "checkin" | "training" | "dietCheckin" | "nutrition";

// Verify the relationship and consent in the same query that reads the friend's data.
function relationshipAccess(selection: string, scope: Scope) {
  const buddy = " FROM members m JOIN members p ON p.room = m.room WHERE m.user = pair.peer AND p.user = pair.viewer";
  const paired = "EXISTS (SELECT 1" + buddy + ")";
  const openFriend = "(f.linked = 1 AND NOT EXISTS (SELECT 1 FROM friend_profiles WHERE owner = pair.peer AND closed = 1))";
  const flag = (name: string) => "(CASE WHEN pair.peer = f.first_id THEN f.first_" + name + " ELSE f.second_" + name + " END)";
  const details = flag("nutrition");
  const dietStatus = "CASE WHEN " + paired + " THEN (SELECT m.share_nutrition" + buddy + ")" +
    " ELSE COALESCE(" + flag("nutrition_status") + ", " + details + ", 1) END = 1";
  const allowed = {
    checkin: "1",
    training: "(" + paired + " OR " + flag("training") + " = 1)",
    dietCheckin: dietStatus,
    nutrition: "(" + dietStatus + " AND (" + paired + " OR " + details + " = 1))",
  }[scope];
  return "EXISTS (SELECT 1 FROM (" + selection + ") AS pair " +
    "LEFT JOIN friend_links f ON f.first_id = MIN(pair.viewer, pair.peer) AND f.second_id = MAX(pair.viewer, pair.peer) " +
    "WHERE pair.viewer <> pair.peer AND (" + paired + " OR " + openFriend + ") AND " + allowed + ")";
}

export function shareAccess(owner: string, friend: string, scope: Scope) {
  return { condition: relationshipAccess("SELECT ? AS viewer, ? AS peer", scope), identifiers: [owner, friend] as const };
}

export async function buddyCheckins(db: D1Database, owner: string, friend: string, connection: string,
  today = friendCurrentDay()): Promise<Checkin[]> {
  const day = "json_extract(e.payload, '$.date')";
  const visible = friendDateVisible(owner, "e.owner", day, today);
  const { results } = await db.prepare(
    "SELECT " + day + " AS date, COUNT(*) AS count FROM entries e WHERE e.owner = ? AND e.kind = 'log' AND " +
    activePair + " AND " + visible.condition + " GROUP BY date ORDER BY date DESC"
  ).bind(friend, connection, owner, friend, ...visible.args).all<{ date: unknown; count: number }>();
  return results.flatMap(({ date, count }) => typeof date === "string" && dateSchema.safeParse(date).success ? [{ date, count }] : []);
}

function publicWorkout(id: string, data: Session): SharedWorkout {
  const exercises = completedMoves(data).map(({ move, name, sets }) => ({ name, unit: move.unit, sets, ...publicMoveInfo(move) }));
  return { id, title: data.plan.title, category: data.plan.category, minutes: data.minutes, finishedVideo: data.finishedVideo,
    sets: exercises.reduce((total, move) => total + move.sets.length, 0), exercises };
}

export async function friendFeed(db: D1Database, owner: string, today = friendCurrentDay(), ownName: string | null = "我"): Promise<FriendFeed> {
  const dates = [today, offsetDate(today, -1), offsetDate(today, -2)];
  const { friends } = await listFriends(db, owner);
  const people = ownName === null ? friends : [{ id: owner, name: publicName(ownName), buddy: false }, ...friends];
  const visibleOwners = JSON.stringify(people.map(({ id }) => id));
  const visibleDays = JSON.stringify(dates);
  const days: FriendFeed["days"] = dates.map((date) => ({ date, items: [] }));

  const day = "json_extract(e.payload, '$.date')";
  const pair = "SELECT ? AS viewer, e.owner AS peer";
  const [workoutRows, cheerRows] = await Promise.all([
    db.prepare(
      "SELECT e.owner, e.id, " + day + " AS date, CASE WHEN e.owner = ? OR " + relationshipAccess(pair, "training") +
      " THEN e.payload END AS payload FROM entries e WHERE e.owner IN (SELECT value FROM json_each(?)) " +
      "AND e.kind = 'log' AND " + day + " IN (SELECT value FROM json_each(?)) AND (e.owner = ? OR " +
      relationshipAccess(pair, "checkin") + ") ORDER BY e.updated DESC, e.id ASC"
    ).bind(owner, owner, visibleOwners, visibleDays, owner, owner)
      .all<{ owner: string; id: string; date: string; payload: string | null }>(),
    db.prepare(
      "SELECT c.recipient, c.day, COUNT(*) AS count, MAX(c.sender = ?) AS given FROM friend_feed_cheers c " +
      "WHERE c.recipient IN (SELECT value FROM json_each(?)) AND c.day IN (SELECT value FROM json_each(?)) AND " +
      relationshipAccess("SELECT c.sender AS viewer, c.recipient AS peer", "checkin") + " GROUP BY c.recipient, c.day"
    ).bind(owner, visibleOwners, visibleDays).all<{ recipient: string; day: string; count: number; given: number }>(),
  ]);

  const key = (id: string, date: string) => JSON.stringify([id, date]);
  const workoutsByPersonDay = new Map<string, SharedWorkoutSummary[] | null>();
  for (const { owner: id, date, payload, id: workoutId } of workoutRows.results) {
    const personDay = key(id, date);
    if (!payload) {
      workoutsByPersonDay.set(personDay, null);
      continue;
    }
    const { title, category, minutes, sets, exercises } = publicWorkout(workoutId, JSON.parse(payload) as Session);
    const workouts = workoutsByPersonDay.get(personDay) ?? [];
    workouts.push({ id: workoutId, title, category, minutes, sets, exercises: exercises.length });
    workoutsByPersonDay.set(personDay, workouts);
  }
  const cheersByPersonDay = new Map(cheerRows.results.map((row) => [key(row.recipient, row.day), row]));
  for (const day of days) {
    for (const { id, name, buddy } of people) {
      const personDay = key(id, day.date);
      const workouts = workoutsByPersonDay.get(personDay);
      if (workouts === undefined) continue;
      const own = id === owner;
      const cheer = cheersByPersonDay.get(personDay);
      day.items.push({ friend: { id, name, buddy }, own, workouts,
        cheer: { count: cheer?.count ?? 0, given: Boolean(cheer?.given), available: !own } });
    }
  }
  return { days };
}

export async function changeFriendFeedCheer(db: D1Database, owner: string, friend: string, date: string, active: boolean, today: string) {
  if (owner === friend) throw new HttpError(400, "不能给自己的打卡加油。");
  if (!active) {
    await db.prepare("DELETE FROM friend_feed_cheers WHERE recipient = ? AND day = ? AND sender = ?")
      .bind(friend, date, owner).run();
    return;
  }
  if (date < offsetDate(today, -2) || date > today) throw new HttpError(404, "这条打卡已不在朋友圈里。");
  const { condition, identifiers } = shareAccess(owner, friend, "checkin");
  const result = await db.prepare(
    "INSERT INTO friend_feed_cheers (recipient, day, sender) SELECT ?, ?, ? WHERE " + condition +
    " AND EXISTS (SELECT 1 FROM entries WHERE owner = ? AND kind = 'log' AND json_extract(payload, '$.date') = ?) " +
    "ON CONFLICT(recipient, day, sender) DO UPDATE SET sender = excluded.sender RETURNING sender"
  ).bind(friend, date, owner, ...identifiers, friend, date).first();
  if (!result) throw new HttpError(404, "这条打卡已不在朋友圈里。");
}

function publicMeal(id: string, entry: MealEntry): SharedMeal {
  const { meal, name, grams, calories, protein, carbs, fat } = entry;
  return { id, meal, name, grams, calories, protein, carbs, fat };
}

export async function friendDay(db: D1Database, owner: string, id: string, date: string,
  today = friendCurrentDay()): Promise<FriendDay> {
  const friend = await getFriend(db, owner, id);
  const access = friendDateVisible(owner, "target.peer", "target.day", today);
  const visible = await db.prepare("SELECT 1 FROM (SELECT ? AS peer, ? AS day) AS target WHERE " +
    relationshipAccess("SELECT ? AS viewer, target.peer AS peer", "checkin") + " AND " + access.condition)
    .bind(id, date, owner, ...access.args).first();
  if (!visible) return { friend, date, restricted: true, workoutCheckin: false, dietCheckin: null, training: null, nutrition: null };
  const checkin = shareAccess(owner, id, "checkin");
  const training = shareAccess(owner, id, "training");
  const dietCheckin = shareAccess(owner, id, "dietCheckin");
  const nutrition = shareAccess(owner, id, "nutrition");
  const logAccess = friendDateVisible(owner, "entries.owner", "json_extract(entries.payload, '$.date')", today);
  const nutritionAccess = friendDateVisible(owner, "personal_library.owner", "personal_library.day", today);
  const workoutFilter = " FROM entries WHERE owner = ? AND kind = 'log' AND json_extract(payload, '$.date') = ? AND " + logAccess.condition + " AND ";
  const mealFilter = " FROM personal_library WHERE owner = ? AND kind = 'nutrition' AND day = ? " +
    "AND json_extract(payload, '$.entry.type') = 'meal' AND " + nutritionAccess.condition + " AND ";
  type Row = { id: string; payload: string };
  const [workedOut, workouts, ate, meals] = await Promise.all([
    db.prepare("SELECT 1" + workoutFilter + checkin.condition + " LIMIT 1").bind(id, date, ...logAccess.args, ...checkin.identifiers).first(),
    friend.shared.training ? db.prepare("SELECT id, payload, (SELECT json_extract(p.payload, '$.values.sex') " +
      "FROM personal_library p WHERE p.owner = entries.owner AND p.kind = 'body-profile') AS variant" +
      workoutFilter + training.condition + " ORDER BY updated DESC")
      .bind(id, date, ...logAccess.args, ...training.identifiers).all<Row & { variant: unknown }>() : null,
    friend.shared.nutrition ? db.prepare("SELECT 1" + mealFilter + dietCheckin.condition + " LIMIT 1")
      .bind(id, date, ...nutritionAccess.args, ...dietCheckin.identifiers).first() : null,
    friend.shared.nutritionDetails ? db.prepare("SELECT id, payload" + mealFilter + nutrition.condition + " ORDER BY updated DESC")
      .bind(id, date, ...nutritionAccess.args, ...nutrition.identifiers).all<Row>() : null,
  ]);
  return { friend, date,
    anatomyVariant: anatomyVariant(workouts?.results[0]?.variant),
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
      db.prepare("DELETE FROM friend_requests AS r WHERE EXISTS (SELECT 1 FROM friend_invites WHERE " + validInvite +
        " AND r.first_id = MIN(owner, ?) AND r.second_id = MAX(owner, ?))")
        .bind(mutation.code, user.id, now, user.id, user.id),
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
