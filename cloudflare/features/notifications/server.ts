import * as workers from "cloudflare:workers";
import { accountName } from "@/features/auth/display-name";
import { publicName } from "@/features/friends/public-name";
import { sharedCheckinCondition } from "@/features/friends/server";
import { HttpError } from "@/server/http";
import { offsetDate } from "@/shared/dates";
import { pushAvailable, sendPush } from "./apns";

export type NotificationKind = "buddy-reminder" | "friend-workout";
type PushEnvironment = "production" | "development";
export type NotificationEvent = { id: string };
export type NotificationPreferences = { buddyReminders: boolean; friendWorkouts: boolean };
type NotificationAudience = string[] | null;

const nudgeCooldown = 15 * 60 * 1_000;
const day = 86_400_000;
const senderName = accountName("n.actor", "'训练好友'");
const buddyCanRead = "EXISTS (SELECT 1 FROM members viewer JOIN members peer ON viewer.room = peer.room " +
  "WHERE viewer.user = n.recipient AND peer.user = n.actor AND viewer.room = n.reference)";
const friendCanRead = sharedCheckinCondition("n.recipient", "n.actor") +
  " AND (NOT EXISTS (SELECT 1 FROM friend_profiles f WHERE f.recent_only = 1 " +
  "AND f.owner IN (n.actor, n.recipient)) OR n.created_at >= ?)";
const canRead = "((n.kind = 'buddy-reminder' AND " + buddyCanRead + ") OR " +
  "(n.kind = 'friend-workout' AND " + friendCanRead + "))";
const receiveEnabled = "CASE n.kind WHEN 'buddy-reminder' THEN COALESCE(p.buddy_reminders, 1) " +
  "ELSE COALESCE(p.friend_workouts, 1) END = 1";

export function notificationAudience(env: Cloudflare.Env): NotificationAudience {
  if (env.SPOTTER_NOTIFICATIONS_AUDIENCE?.trim().toLowerCase() === "all") return null;
  const configured = env.SPOTTER_NOTIFICATIONS_ALLOWED_ACCOUNTS?.trim();
  if (!configured) return null;
  return Array.from(new Set(configured.toLowerCase().split(/[,;\s]+/u)
    .filter((account) => account.length > 0 && account.length <= 300))).slice(0, 100);
}

export function notificationsAllowedFor(audience: NotificationAudience, id: string, email: string) {
  return audience === null || audience.includes(id.trim().toLowerCase()) || audience.includes(email.trim().toLowerCase());
}

function allowedRecipient(audience: NotificationAudience): { sql: string; args: string[] } {
  if (audience === null) return { sql: "", args: [] };
  return {
    sql: " AND EXISTS (SELECT 1 FROM json_each(?) allowed " +
      "WHERE allowed.value IN (LOWER(TRIM(receiver.id)), LOWER(TRIM(receiver.email))))",
    args: [JSON.stringify(audience)],
  };
}

export async function notificationInbox(db: D1Database, owner: string, now = Date.now()) {
  const [items, preferences] = await Promise.all([
    db.prepare("SELECT n.id, n.kind, n.actor AS actorId, " + senderName + " AS actorName, n.created_at AS createdAt, n.read_at AS readAt " +
      "FROM notifications n WHERE n.recipient = ? AND " + canRead + " ORDER BY n.created_at DESC, n.id DESC LIMIT 50")
      .bind(owner, now - 2 * day)
      .all<{ id: string; kind: NotificationKind; actorId: string; actorName: string; createdAt: number; readAt: number | null }>(),
    db.prepare("SELECT buddy_reminders AS buddyReminders, friend_workouts AS friendWorkouts " +
      "FROM notification_preferences WHERE owner = ?").bind(owner)
      .first<{ buddyReminders: number; friendWorkouts: number }>(),
  ]);
  return {
    items: items.results.map(({ id, kind, actorId, actorName, createdAt, readAt }) => ({
      id, kind, actorId, actorName: publicName(actorName), createdAt: new Date(createdAt).toISOString(), read: readAt !== null,
    })),
    preferences: {
      buddyReminders: Boolean(preferences?.buddyReminders ?? true),
      friendWorkouts: Boolean(preferences?.friendWorkouts ?? true),
    },
  };
}

export function saveNotificationPreferences(db: D1Database, owner: string, preferences: NotificationPreferences) {
  return db.prepare("INSERT INTO notification_preferences (owner, buddy_reminders, friend_workouts) VALUES (?, ?, ?) " +
    "ON CONFLICT(owner) DO UPDATE SET buddy_reminders = excluded.buddy_reminders, friend_workouts = excluded.friend_workouts")
    .bind(owner, Number(preferences.buddyReminders), Number(preferences.friendWorkouts)).run();
}

export async function registerNotificationDevice(db: D1Database, owner: string, sessionHash: string,
  device: { installationId: string; token: string; environment: PushEnvironment }, now = Date.now()) {
  // Device ownership follows the active session. Deleting the session revokes its registration automatically.
  const valid = "EXISTS (SELECT 1 FROM spotter_access_sessions WHERE account_id = ? AND token_hash = ? AND expires_at > ?)";
  const session = [owner, sessionHash, Math.floor(now / 1_000)];
  const [, registered] = await db.batch([
    db.prepare("DELETE FROM notification_devices WHERE token = ? AND installation_id <> ? AND " + valid)
      .bind(device.token, device.installationId, ...session),
    db.prepare("INSERT INTO notification_devices (installation_id, owner, session_hash, token, environment, updated_at) " +
      "SELECT ?, ?, ?, ?, ?, ? WHERE " + valid + " ON CONFLICT(installation_id) DO UPDATE SET owner = excluded.owner, " +
      "session_hash = excluded.session_hash, token = excluded.token, environment = excluded.environment, updated_at = excluded.updated_at")
      .bind(device.installationId, owner, sessionHash, device.token, device.environment, now, ...session),
  ]);
  if (!registered.meta.changes) throw new HttpError(401, "登录已失效，请重新登录后开启通知。");
}

export function removeNotificationDevice(db: D1Database, owner: string, sessionHash: string, installationId: string) {
  return db.prepare("DELETE FROM notification_devices WHERE owner = ? AND session_hash = ? AND installation_id = ?")
    .bind(owner, sessionHash, installationId).run();
}

export function markNotificationsRead(db: D1Database, owner: string, id?: string, now = Date.now()) {
  return db.prepare("UPDATE notifications SET read_at = ? WHERE recipient = ? AND read_at IS NULL" + (id ? " AND id = ?" : ""))
    .bind(now, owner, ...(id ? [id] : [])).run();
}

export async function createBuddyReminder(db: D1Database, owner: string, buddyId: string,
  audience: NotificationAudience, now = Date.now()) {
  const id = crypto.randomUUID();
  const eligibility = allowedRecipient(audience);
  const result = await db.prepare(
    "INSERT INTO notifications (id, recipient, actor, kind, reference, created_at) " +
    "SELECT ?, peer.user, me.user, 'buddy-reminder', me.room, ? FROM members me " +
    "JOIN members peer ON me.room = peer.room AND me.user <> peer.user " +
    "JOIN spotter_access_accounts receiver ON receiver.id = peer.user " +
    "LEFT JOIN notification_preferences p ON p.owner = peer.user " +
    "WHERE me.user = ? AND peer.user = ? AND COALESCE(p.buddy_reminders, 1) = 1 " +
    "AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient = peer.user " +
    "AND n.actor = me.user AND n.kind = 'buddy-reminder' AND n.created_at > ?)" + eligibility.sql + " RETURNING id"
  ).bind(id, now, owner, buddyId, now - nudgeCooldown, ...eligibility.args).first<NotificationEvent>();
  if (result) return result;

  const current = await db.prepare(
    "SELECT COALESCE(p.buddy_reminders, 1) AS canRemind FROM members me " +
    "JOIN members peer ON peer.room = me.room AND peer.user <> me.user " +
    "JOIN spotter_access_accounts receiver ON receiver.id = peer.user " +
    "LEFT JOIN notification_preferences p ON p.owner = peer.user WHERE me.user = ? AND peer.user = ?" + eligibility.sql
  ).bind(owner, buddyId, ...eligibility.args).first<{ canRemind: number }>();
  if (!current) throw new HttpError(409, "搭子已变更或暂未开放训练提醒。");
  if (!current.canRemind) throw new HttpError(409, "对方目前关闭了训练提醒。");
  throw new HttpError(429, "刚提醒过，15 分钟内无需重复发送。");
}

// Live check-ins carry a completion time. Suppress old backfills and implausibly future timestamps.
export function shouldNotifyWorkout(workout: { ended?: number; date: string }, today: string, now = Date.now()) {
  return workout.ended !== undefined && workout.ended >= now - day && workout.ended <= now + 5 * 60_000 &&
    workout.date >= offsetDate(today, -2) && workout.date <= offsetDate(today, 1);
}

export function workoutNotificationInsert(db: D1Database, owner: string, workoutId: string,
  now: number, audience: NotificationAudience) {
  const eventId = "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) " +
    "|| '-a' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))";
  const eligibility = allowedRecipient(audience);
  // This statement follows the check-in mutation in the same D1 batch. changes() is the preceding
  // statement's SQLite change count, so a replay of an existing workout never becomes a new event.
  return db.prepare(
    "WITH args(actor, workout, timestamp) AS (VALUES (?, ?, ?)), contacts(id) AS (" +
    "SELECT peer.user FROM args JOIN members me ON me.user = args.actor " +
    "JOIN members peer ON peer.room = me.room AND peer.user <> me.user UNION " +
    "SELECT CASE WHEN f.first_id = args.actor THEN f.second_id ELSE f.first_id END FROM args " +
    "JOIN friend_links f ON (f.first_id = args.actor OR f.second_id = args.actor) AND f.linked = 1" +
    ") INSERT INTO notifications (id, recipient, actor, kind, reference, created_at) " +
    "SELECT " + eventId + ", contacts.id, args.actor, 'friend-workout', args.workout, args.timestamp " +
    "FROM contacts CROSS JOIN args JOIN spotter_access_accounts receiver ON receiver.id = contacts.id " +
    "JOIN spotter_access_accounts actor ON actor.id = args.actor " +
    "LEFT JOIN notification_preferences p ON p.owner = contacts.id WHERE changes() > 0 " +
    "AND COALESCE(p.friend_workouts, 1) = 1 AND " + sharedCheckinCondition("contacts.id", "args.actor") + eligibility.sql +
    " ON CONFLICT DO NOTHING RETURNING id"
  ).bind(owner, workoutId, now, ...eligibility.args);
}

type NotificationTarget = {
  id: string; kind: NotificationKind; actorName: string; owner: string;
  token: string; environment: PushEnvironment; installationId: string; updatedAt: number;
};

async function deliver(db: D1Database, env: Cloudflare.Env, events: NotificationEvent[],
  environments: PushEnvironment[], now = Date.now()) {
  const eligibility = allowedRecipient(notificationAudience(env));
  const { results } = await db.prepare(
    "SELECT n.id, n.kind, " + senderName + " AS actorName, d.owner, d.token, d.environment, " +
    "d.installation_id AS installationId, d.updated_at AS updatedAt FROM notifications n " +
    "JOIN notification_devices d ON d.owner = n.recipient " +
    "JOIN spotter_access_sessions s ON s.token_hash = d.session_hash AND s.account_id = d.owner " +
    "JOIN spotter_access_accounts receiver ON receiver.id = n.recipient " +
    "LEFT JOIN notification_preferences p ON p.owner = n.recipient " +
    "WHERE n.id IN (SELECT value FROM json_each(?)) AND d.environment IN (SELECT value FROM json_each(?)) " +
    "AND s.expires_at > ? AND " + receiveEnabled + " AND " + canRead + eligibility.sql + " ORDER BY d.updated_at DESC LIMIT 20"
  ).bind(JSON.stringify(events.map(({ id }) => id)), JSON.stringify(environments), Math.floor(now / 1_000), now - 2 * day,
    ...eligibility.args)
    .all<NotificationTarget>();

  // Stay within the Worker subrequest budget. All events remain readable in the inbox.
  for (let index = 0; index < results.length; index += 4) {
    await Promise.all(results.slice(index, index + 4).map(async (target) => {
      const { id, kind, actorName, owner, token, environment, installationId, updatedAt } = target;
      if (await sendPush(env, token, environment, { id, kind, actorName }) === "invalid") {
        await db.prepare("DELETE FROM notification_devices WHERE owner = ? AND token = ? AND installation_id = ? AND updated_at = ?")
          .bind(owner, token, installationId, updatedAt).run();
      }
    }));
  }
}

export async function dispatchNotifications(db: D1Database, env: Cloudflare.Env, events: NotificationEvent[]) {
  if (!events.length) return;
  const environments = (["production", "development"] as const).filter((environment) => pushAvailable(env, environment));
  if (!environments.length) return;
  const pending = deliver(db, env, events, environments).catch(() => {
    console.warn("Spotter notification delivery failed");
  });
  if (typeof workers.waitUntil === "function") workers.waitUntil(pending);
  else await pending;
}
