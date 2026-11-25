import { publicName } from "@/features/friends/public-name";
import { accountName } from "@/features/auth/display-name";
import { discoverablePerson } from "@/features/friends/discovery";
import type { FriendRequest } from "@/features/friends/social-model";
import { HttpError } from "@/server/http";
import type { Person } from "@/shared/state";

// Callers supply SQL expressions for two owner IDs. Their values are always bound.
export function canPair(first: string, second: string) {
  return "NOT EXISTS (SELECT 1 FROM members m JOIN members peer ON peer.room = m.room AND peer.user <> m.user " +
    "WHERE m.user IN (" + first + ", " + second + "))";
}

const paired = "EXISTS (SELECT 1 FROM members m JOIN members peer ON peer.room = m.room " +
  "WHERE m.user = r.sender AND peer.user = r.receiver)";

type BuddyRequestRow = {
  id: string;
  sender: string;
  receiver: string;
  sender_name: string;
  receiver_name: string;
  sender_handle: string;
  receiver_handle: string;
  created_at: string;
};

export async function buddyRequests(db: D1Database, owner: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  const { results } = await db.prepare(
    "SELECT r.id, r.sender, r.receiver, r.created_at, " + accountName("r.sender", "r.sender_name") + " AS sender_name, " +
    accountName("r.receiver", "r.receiver_name") + " AS receiver_name, " +
    "s.username || '#' || s.tag AS sender_handle, t.username || '#' || t.tag AS receiver_handle " +
    "FROM buddy_requests r JOIN spotter_account_handles s ON s.owner = r.sender " +
    "JOIN spotter_account_handles t ON t.owner = r.receiver " +
    "WHERE (r.first_id = ? OR r.second_id = ?) AND NOT " + paired + " ORDER BY r.created_at DESC, r.id"
  ).bind(owner, owner).all<BuddyRequestRow>();
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];
  for (const row of results) {
    const details = { id: row.id, createdAt: row.created_at, kind: "buddy" } as const;
    if (row.receiver === owner) incoming.push({ ...details, personId: row.sender, name: row.sender_name, handle: row.sender_handle });
    else outgoing.push({ ...details, personId: row.receiver, name: row.receiver_name, handle: row.receiver_handle });
  }
  return { incoming, outgoing };
}

export async function sendBuddyRequest(db: D1Database, sender: Person, receiver: string, shareNutrition?: boolean) {
  if (sender.id === receiver) throw new HttpError(400, "不能加自己为搭子。");
  const [first, second] = [sender.id, receiver].sort();
  const recipient = await db.prepare(discoverablePerson).bind(receiver, receiver).first<{ name: string }>();
  const choice = shareNutrition === undefined ? [] : [Number(shareNutrition)];

  const [sent, existing, eligible] = await db.batch([
    db.prepare(
      "INSERT INTO buddy_requests (first_id, second_id, id, sender, receiver, sender_name, receiver_name, created_at" +
      (choice.length ? ", sender_share_nutrition" : "") + ") " +
      "SELECT ?, ?, ?, ?, a.id, ?, ?, ?" + (choice.length ? ", ?" : "") + " FROM spotter_access_accounts a " +
      "JOIN spotter_account_handles h ON h.owner = a.id LEFT JOIN friend_profiles p ON p.owner = a.id " +
      "WHERE a.id = ? AND COALESCE(p.discoverable, 1) = 1 AND EXISTS (SELECT 1 FROM spotter_account_handles WHERE owner = ?) AND " +
      canPair("?", "a.id") + " ON CONFLICT(first_id, second_id) DO NOTHING"
    ).bind(first, second, crypto.randomUUID(), sender.id, publicName(sender.name), publicName(recipient?.name ?? ""),
      new Date().toISOString(), ...choice, receiver, sender.id, sender.id),
    db.prepare("SELECT 1 FROM buddy_requests WHERE first_id = ? AND second_id = ?").bind(first, second),
    db.prepare(
      "SELECT 1 FROM spotter_account_handles h LEFT JOIN friend_profiles p ON p.owner = h.owner " +
      "WHERE h.owner = ? AND COALESCE(p.discoverable, 1) = 1"
    ).bind(receiver),
  ]);
  if (sent.meta.changes || existing.results.length) return;
  if (!eligible.results.length) throw new HttpError(404, "找不到这位用户，请重新搜索。");
  throw new HttpError(409, "你或对方已有训练搭子。");
}

export async function respondBuddyRequest(db: D1Database, user: Person, id: string, decision: "accept" | "decline" | "cancel",
  betaSocialDefaults = false, shareNutrition?: boolean) {
  const actor = decision === "cancel" ? "sender" : "receiver";
  const addressed = await db.prepare("SELECT 1 FROM buddy_requests WHERE id = ? AND " + actor + " = ?").bind(id, user.id).first();
  if (!addressed) return false;
  if (decision !== "accept") {
    await db.prepare("DELETE FROM buddy_requests WHERE id = ? AND " + actor + " = ?").bind(id, user.id).run();
    return true;
  }

  const room = crypto.randomUUID();
  const invite = crypto.randomUUID().replace(/-/g, "");
  const names = publicName(user.name);
  const candidate =
    "SELECT r.*, sender.room AS sender_room, receiver.room AS receiver_room, " +
    "COALESCE(receiver.room, sender.room, ?) AS target_room FROM buddy_requests r " +
    "LEFT JOIN members sender ON sender.user = r.sender LEFT JOIN members receiver ON receiver.user = r.receiver " +
    "WHERE r.id = ? AND r.receiver = ? AND " + canPair("r.sender", "r.receiver");
  const candidateArgs = [room, id, user.id];
  const accepted = "SELECT r.* FROM buddy_requests r WHERE r.id = ? AND r.receiver = ? AND " + paired;
  const dietChoice = betaSocialDefaults ? "CASE WHEN s.side = 0 THEN ? ELSE COALESCE(c.sender_share_nutrition, 0) END" : "0";
  const receiverChoice = betaSocialDefaults ? [Number(shareNutrition === true)] : [];
  const [, joined, , , consumed] = await db.batch([
    db.prepare(
      "INSERT INTO rooms (id, invite, owner) " +
      "SELECT c.target_room, ?, c.receiver FROM (" + candidate + ") c WHERE c.sender_room IS NULL AND c.receiver_room IS NULL"
    ).bind(invite, ...candidateArgs),
    db.prepare(
      "INSERT INTO members (user, room, name, share_nutrition) " +
      "SELECT CASE WHEN s.side = 0 THEN c.receiver ELSE c.sender END, c.target_room, " +
      "CASE WHEN s.side = 0 THEN ? ELSE c.sender_name END, " + dietChoice + " FROM (" + candidate + ") c " +
      "CROSS JOIN (SELECT 0 AS side UNION ALL SELECT 1) s WHERE 1 " +
      "ON CONFLICT(user) DO UPDATE SET room = excluded.room, name = excluded.name, share_nutrition = excluded.share_nutrition"
    ).bind(names, ...receiverChoice, ...candidateArgs),
    db.prepare(
      "DELETE FROM friend_requests AS f WHERE EXISTS (SELECT 1 FROM (" + accepted + ") a " +
      "WHERE a.first_id = f.first_id AND a.second_id = f.second_id)"
    ).bind(id, user.id),
    db.prepare(
      "DELETE FROM rooms WHERE owner IN (SELECT sender FROM (" + accepted + ")) " +
      "AND NOT EXISTS (SELECT 1 FROM members WHERE room = rooms.id)"
    ).bind(id, user.id),
    db.prepare(
      "DELETE FROM buddy_requests AS b WHERE EXISTS (SELECT 1 FROM (" + accepted + ") a " +
      "WHERE b.first_id IN (a.first_id, a.second_id) OR b.second_id IN (a.first_id, a.second_id))"
    ).bind(id, user.id),
  ]);
  if (!joined.meta.changes && !consumed.meta.changes &&
      await db.prepare("SELECT 1 FROM buddy_requests WHERE id = ? AND receiver = ?").bind(id, user.id).first()) {
    throw new HttpError(409, "你或对方已有训练搭子。");
  }
  return true;
}
