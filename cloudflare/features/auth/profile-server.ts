import { HttpError } from "@/server/http";
import { searchName } from "@/features/friends/public-name";
import { accountName } from "./display-name";
import type { AccountProfile } from "./profile";

type ProfileRow = { name: string; username: string; tag: string; discoverable: number | null };

function load(db: D1Database, owner: string) {
  return db.prepare("SELECT " + accountName("h.owner") + " AS name, h.username, h.tag, p.discoverable FROM spotter_account_handles h " +
    "LEFT JOIN friend_profiles p ON p.owner = h.owner WHERE h.owner = ?").bind(owner).first<ProfileRow>();
}

function profile(row: ProfileRow): AccountProfile {
  return { name: row.name, username: row.username, tag: row.tag, handle: row.username + "#" + row.tag,
    discoverable: row.discoverable !== 0 };
}

export async function readAccountProfile(db: D1Database, owner: string) {
  const existing = await load(db, owner);
  if (existing) return profile(existing);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = "spotter." + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const [randomTag] = crypto.getRandomValues(new Uint32Array(1));
    const tag = String(randomTag % 10_000).padStart(4, "0");
    await db.prepare("INSERT INTO spotter_account_handles (owner, username, tag) " +
      "SELECT id, ?, ? FROM spotter_access_accounts WHERE id = ? ON CONFLICT DO NOTHING").bind(username, tag, owner).run();
    const saved = await load(db, owner);
    if (saved) return profile(saved);
  }
  if (!await db.prepare("SELECT 1 FROM spotter_access_accounts WHERE id = ?").bind(owner).first()) {
    throw new HttpError(401, "请先登录后再查看账号。");
  }
  throw new HttpError(503, "暂时无法设置用户名，请稍后重试。");
}

export async function saveAccountUsername(db: D1Database, owner: string, username: string, tag?: string) {
  await readAccountProfile(db, owner);
  const updated = await db.prepare("UPDATE OR IGNORE spotter_account_handles SET username = ?, tag = COALESCE(?, tag) WHERE owner = ? RETURNING owner")
    .bind(username, tag ?? null, owner).first();
  if (!updated) throw new HttpError(409, "这个用户名和编号的组合已被使用，请修改其中一项。");
  return readAccountProfile(db, owner);
}

export async function saveAccountNickname(db: D1Database, owner: string, name: string) {
  const [updated] = await db.batch([
    db.prepare("UPDATE spotter_access_accounts SET display_name = ? WHERE id = ?").bind(name, owner),
    db.prepare("UPDATE friend_profiles SET name = ?, search_name = ? WHERE owner = ? " +
      "AND EXISTS (SELECT 1 FROM spotter_access_accounts WHERE id = ?)").bind(name, searchName(name), owner, owner),
  ]);
  if (!updated.meta.changes) throw new HttpError(401, "请先登录后再修改昵称。");
  return readAccountProfile(db, owner);
}
