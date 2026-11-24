import { HttpError } from "@/server/http";
import { asDate } from "@/shared/dates";

type Membership = { connectionId: string; invite: string; creator: string; partnerId: string | null; partnerName: string | null };

export const activePair = "EXISTS (SELECT 1 FROM members m JOIN members p ON p.room = m.room " +
  "WHERE m.room = ? AND m.user = ? AND p.user = ? AND p.user <> m.user)";

export function membership(db: D1Database, user: string) {
  return db.prepare(
    "SELECT r.id AS connectionId, r.invite, r.owner AS creator, p.user AS partnerId, p.name AS partnerName " +
    "FROM members m JOIN rooms r ON r.id = m.room " +
    "LEFT JOIN members p ON p.room = m.room AND p.user <> m.user WHERE m.user = ?"
  ).bind(user).first<Membership>();
}

const pairChanged = () => new HttpError(409, "搭子已变更，请刷新后重试。");

export async function disconnectPair(db: D1Database, owner: string, partner: string, connection: string) {
  const [, removed] = await db.batch([
    db.prepare("DELETE FROM friend_links WHERE first_id = MIN(?, ?) AND second_id = MAX(?, ?) AND linked = 0 AND " +
      activePair).bind(owner, partner, owner, partner, connection, owner, partner),
    db.prepare("DELETE FROM members WHERE room = ? AND " + activePair).bind(connection, connection, owner, partner),
    db.prepare("DELETE FROM rooms WHERE id = ? AND NOT EXISTS (SELECT 1 FROM members WHERE room = ?)").bind(connection, connection),
  ]);
  if (!removed.meta.changes) throw pairChanged();
}

export function validTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: value }); return true; }
  catch { return false; }
}

export async function sendPairCheer(db: D1Database, owner: string, partner: string, connection: string, timeZone: string,
  sentAt = new Date()) {
  const date = asDate(sentAt, timeZone);
  const id = "cheer-" + connection + "-" + date;
  const payload = JSON.stringify({ date, connection, recipient: partner });
  const saved = await db.prepare(
    "INSERT INTO entries (owner, id, kind, payload, updated) SELECT ?, ?, 'cheer', ?, ? WHERE " + activePair +
    " ON CONFLICT(owner, id) DO NOTHING"
  ).bind(owner, id, payload, sentAt.toISOString(), connection, owner, partner).run();
  if (!saved.meta.changes) {
    const current = await db.prepare("SELECT 1 WHERE " + activePair).bind(connection, owner, partner).first();
    if (!current) throw pairChanged();
  }
}
