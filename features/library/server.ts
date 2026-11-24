import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import type { LibraryItem, LibraryRow } from "./model";
import { libraryKey } from "@/features/data/model";
import { nextRevision } from "@/features/plans/schedule";
import { withoutTemplateLink } from "@/features/plans/template-link";
import { freezeTemplatePlans } from "@/features/plans/template-server";
import type { RecentMealFood } from "@/features/nutrition/recent-foods";

function database() {
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return env.DB;
}

export async function readLibrary(owner: string, day?: string, body = false): Promise<LibraryRow[]> {
  const db = database();
  const statement = body
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND (kind = 'body-profile' OR (kind = 'nutrition' AND json_extract(payload, '$.entry.type') IN ('weight','measurement'))) ORDER BY day ASC, updated DESC").bind(owner)
    : day
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND (kind IN ('targets', 'food', 'food-portions') OR (kind = 'nutrition' AND day = ?)) ORDER BY updated DESC").bind(owner, day)
    : db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind IN ('exercise', 'template', 'schedule', 'stats-pins', 'protein-preference', 'history-order') ORDER BY updated DESC").bind(owner);
  const { results } = await statement.all<{ payload: string; updated: string }>();
  return results.map(({ payload, updated }) => ({ ...JSON.parse(payload) as LibraryItem, updated }));
}

export async function readRecentMealFoods(owner: string, day: string): Promise<RecentMealFood[]> {
  const { results } = await database().prepare(
    "SELECT json_extract(payload, '$.entry.foodId') AS foodId, json_extract(payload, '$.entry.meal') AS meal, " +
    "json_extract(payload, '$.entry.grams') AS grams FROM personal_library WHERE owner = ? AND kind = 'nutrition' " +
    "AND day BETWEEN date(?, '-29 days') AND ? AND json_extract(payload, '$.entry.type') = 'meal' " +
    "AND json_type(payload, '$.entry.foodId') = 'text' AND json_type(payload, '$.entry.grams') IN ('integer','real') " +
    "ORDER BY day DESC, updated DESC, id DESC LIMIT 240"
  ).bind(owner, day, day).all<RecentMealFood>();
  return results;
}

const staleLibraryItem = () => new HttpError(409, "模板或计划设置已在另一处变更，请关闭此窗口，刷新后重新编辑。");

export async function saveLibrary(owner: string, item: LibraryItem, revision?: string | null) {
  const id = libraryKey(item);
  const day = item.kind === "nutrition" ? item.date : item.kind === "history-order" ? item.id : null;
  const payload = JSON.stringify(item.kind === "template" ? { ...item, plan: withoutTemplateLink(item.plan) } : item);
  const protectedWrite = item.kind === "template" || item.kind === "schedule" || item.kind === "body-profile";
  const updated = nextRevision(new Date().toISOString(), protectedWrite ? [revision] : []);
  const db = database();
  const result = protectedWrite && revision ? await db.prepare(
    "UPDATE personal_library SET payload=?, updated=? WHERE owner=? AND kind=? AND id=? AND updated=?"
  ).bind(payload, updated, owner, item.kind, id, revision).run() : await db.prepare(
    "INSERT INTO personal_library (owner, kind, id, day, payload, updated) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, kind, id) " +
    (protectedWrite ? "DO NOTHING" : "DO UPDATE SET day=excluded.day,payload=excluded.payload,updated=excluded.updated")
  ).bind(owner, item.kind, id, day, payload, updated).run();
  if (protectedWrite && !result.meta.changes) {
    if (item.kind === "body-profile") throw new HttpError(409, "身体档案已在另一处变更，请刷新后重新编辑。");
    throw staleLibraryItem();
  }
  return updated;
}

export async function removeLibrary(owner: string, kind: "template" | "nutrition", id: string, revision?: string) {
  const db = database();
  if (kind === "template") {
    if (!revision) throw staleLibraryItem();
    const [, removed] = await db.batch([
      freezeTemplatePlans(db, owner, id, nextRevision(new Date().toISOString(), [revision]), revision),
      db.prepare("DELETE FROM personal_library WHERE owner=? AND kind='template' AND id=? AND updated=?")
        .bind(owner, id, revision),
    ]);
    if (!removed?.meta.changes) throw staleLibraryItem();
  } else await db.prepare("DELETE FROM personal_library WHERE owner = ? AND kind = ? AND id = ?").bind(owner, kind, id).run();
}
