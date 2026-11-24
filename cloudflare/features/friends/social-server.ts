import { HttpError } from "@/server/http";
import type { Person } from "@/shared/state";
import { defaultSocialPreferences, type FriendRequest, type SocialMutation, type SocialPerson, type SocialPreferences, type SocialState } from "./social-model";

type PreferenceRow = { closed: number; discoverable: number; recent_only: number };
type RequestRow = {
  id: string;
  sender: string;
  receiver: string;
  sender_name: string;
  receiver_name: string;
  created_at: string;
};

const toPreferences = (row: PreferenceRow): SocialPreferences => ({
  closed: Boolean(row.closed), discoverable: Boolean(row.discoverable), recentOnly: Boolean(row.recent_only),
});

export async function readSocialPreferences(db: D1Database, owner: string): Promise<SocialPreferences> {
  const row = await db.prepare("SELECT closed, discoverable, recent_only FROM friend_profiles WHERE owner = ?")
    .bind(owner).first<PreferenceRow>();
  return row ? toPreferences(row) : { ...defaultSocialPreferences };
}

// The caller supplies SQL column expressions. User identifiers are bound separately.
function connected(first: string, second: string) {
  return "(EXISTS (SELECT 1 FROM friend_links f WHERE f.first_id = " + first + " AND f.second_id = " + second +
    " AND f.linked = 1) OR EXISTS (SELECT 1 FROM members m JOIN members peer ON peer.room = m.room WHERE m.user = " +
    first + " AND peer.user = " + second + "))";
}

function searchName(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

function publicName(value: string) {
  const name = value.trim().slice(0, 80);
  return name && !searchName(name).includes("@") ? name : "训练好友";
}

export async function socialState(db: D1Database, owner: string): Promise<SocialState> {
  const [preferences, { results }] = await Promise.all([
    readSocialPreferences(db, owner),
    db.prepare("SELECT id, sender, receiver, sender_name, receiver_name, created_at FROM friend_requests r " +
      "WHERE (sender = ? OR receiver = ?) AND NOT " + connected("r.first_id", "r.second_id") +
      " ORDER BY created_at DESC, id").bind(owner, owner).all<RequestRow>(),
  ]);
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];
  for (const row of results) {
    if (row.receiver === owner) incoming.push({ id: row.id, personId: row.sender, name: row.sender_name, createdAt: row.created_at });
    else outgoing.push({ id: row.id, personId: row.receiver, name: row.receiver_name, createdAt: row.created_at });
  }
  return { preferences, incoming, outgoing };
}

export async function searchPeople(db: D1Database, owner: string, raw: string): Promise<SocialPerson[]> {
  if (raw.length > 160) throw new HttpError(400, "搜索词太长。");
  const query = searchName(raw);
  if (!query || query.includes("@") || (query.length < 2 && !/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(query))) return [];
  const { results } = await db.prepare(
    "WITH viewer(id) AS (VALUES (?)) " +
    "SELECT p.owner AS id, p.name FROM friend_profiles p CROSS JOIN viewer v " +
    "WHERE p.owner <> v.id AND p.discoverable = 1 AND instr(p.search_name, ?) > 0 AND NOT " +
    connected("MIN(v.id, p.owner)", "MAX(v.id, p.owner)") +
    " ORDER BY CASE WHEN p.search_name = ? THEN 0 WHEN instr(p.search_name, ?) = 1 THEN 1 ELSE 2 END, p.search_name, p.owner LIMIT 20"
  ).bind(owner, query, query, query).all<SocialPerson>();
  return results;
}

export async function changeSocial(db: D1Database, user: Person, mutation: SocialMutation) {
  const name = publicName(user.name);
  if (mutation.action === "social-preferences") {
    const { closed, discoverable, recentOnly } = mutation.preferences;
    if (discoverable && name === "训练好友") throw new HttpError(400, "请先为 ChatGPT 账号设置显示名称，再开启好友搜索。");
    await db.prepare(
      "INSERT INTO friend_profiles (owner, name, search_name, closed, discoverable, recent_only) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(owner) DO UPDATE SET name = excluded.name, search_name = excluded.search_name, closed = excluded.closed, " +
      "discoverable = excluded.discoverable, recent_only = excluded.recent_only"
    ).bind(user.id, name, searchName(name), Number(closed), Number(discoverable), Number(recentOnly)).run();
    return;
  }

  if (mutation.action === "request") {
    if (user.id === mutation.id) throw new HttpError(400, "不能加自己为好友。");
    const [first, second] = [user.id, mutation.id].sort();
    const [sent, available] = await db.batch<{ existing: number }>([
      db.prepare(
        "INSERT INTO friend_requests (first_id, second_id, id, sender, receiver, sender_name, receiver_name, created_at) " +
        "SELECT ?, ?, ?, ?, p.owner, ?, p.name, ? FROM friend_profiles p WHERE p.owner = ? AND p.discoverable = 1 AND NOT " +
        connected("?", "?") + " ON CONFLICT(first_id, second_id) DO NOTHING"
      ).bind(first, second, crypto.randomUUID(), user.id, name, new Date().toISOString(), mutation.id, first, second, first, second),
      db.prepare("SELECT 1 AS existing WHERE " + connected("?", "?") +
        " OR EXISTS (SELECT 1 FROM friend_requests WHERE first_id = ? AND second_id = ?)").bind(first, second, first, second, first, second),
    ]);
    if (!sent.meta.changes && !available.results.length) throw new HttpError(404, "找不到这位用户，请重新搜索。");
    return;
  }

  if (mutation.decision === "accept") {
    // Link the users and consume the specific request together, while preserving any existing terms.
    await db.batch([
      db.prepare(
        "INSERT INTO friend_links (first_id, second_id, first_name, second_name, linked, " +
        "first_training, second_training, first_nutrition, second_nutrition, first_nutrition_status, second_nutrition_status) " +
        "SELECT r.first_id, r.second_id, CASE WHEN r.receiver = r.first_id THEN ? ELSE r.sender_name END, " +
        "CASE WHEN r.receiver = r.second_id THEN ? ELSE r.sender_name END, 1, 1, 1, 0, 0, 1, 1 FROM friend_requests r " +
        "WHERE r.id = ? AND r.receiver = ? AND NOT " + connected("r.first_id", "r.second_id") +
        " ON CONFLICT(first_id, second_id) DO UPDATE SET first_name = excluded.first_name, second_name = excluded.second_name, " +
        "linked = 1, first_training = 1, second_training = 1, first_nutrition = 0, second_nutrition = 0, " +
        "first_nutrition_status = 1, second_nutrition_status = 1 WHERE friend_links.linked = 0"
      ).bind(name, name, mutation.id, user.id),
      db.prepare("DELETE FROM friend_requests WHERE id = ? AND receiver = ?").bind(mutation.id, user.id),
    ]);
    return;
  }

  const actor = mutation.decision === "cancel" ? "sender" : "receiver";
  await db.prepare("DELETE FROM friend_requests WHERE id = ? AND " + actor + " = ?").bind(mutation.id, user.id).run();
}
