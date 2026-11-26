import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import type { LibraryItem, LibraryRow } from "./model";
import { libraryDay, libraryKey } from "@/features/data/model";
import { nextRevision } from "@/features/plans/schedule";
import { withoutTemplateLink } from "@/features/plans/template-link";
import { freezeTemplatePlans, type TemplateWriteGuard } from "@/features/plans/template-server";
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
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND (kind IN ('targets', 'food', 'food-portions', 'nutrition-plan') " +
      "OR (kind IN ('nutrition', 'nutrition-energy') AND day = ?)) ORDER BY updated DESC").bind(owner, day)
    : db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind IN ('exercise', 'template', 'schedule', 'stats-pins', 'protein-preference', 'protein-warehouse', 'history-order') ORDER BY updated DESC").bind(owner);
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

type TemplateItem = Extract<LibraryItem, { kind: "template" }>;

export function updateTemplateRevision(db: D1Database, owner: string, item: TemplateItem, revision: string, updated: string, guard?: TemplateWriteGuard) {
  const payload = JSON.stringify({ ...item, plan: withoutTemplateLink(item.plan) });
  return db.prepare(
    "UPDATE personal_library SET day=?, payload=?, updated=? WHERE owner=? AND kind='template' AND id=? AND updated=?" +
    (guard ? " AND " + guard.condition : "")
  ).bind(libraryDay(item), payload, updated, owner, item.id, revision, ...(guard?.values ?? []));
}

export function removeTemplateRevision(db: D1Database, owner: string, id: string, revision: string, updated: string, guard?: TemplateWriteGuard) {
  return [
    freezeTemplatePlans(db, owner, id, updated, revision, guard),
    db.prepare("DELETE FROM personal_library WHERE owner=? AND kind='template' AND id=? AND updated=?" + (guard ? " AND " + guard.condition : ""))
      .bind(owner, id, revision, ...(guard?.values ?? [])),
  ];
}

export async function saveLibrary(owner: string, item: LibraryItem, revision?: string | null) {
  if (item.kind === "nutrition" && item.sourceWorkoutId) throw new HttpError(400, "在对应的训练记录中编辑蛋白粉打卡。");
  const id = libraryKey(item);
  const day = libraryDay(item);
  const payload = JSON.stringify(item.kind === "template" ? { ...item, plan: withoutTemplateLink(item.plan) } : item);
  const protectedWrite = item.kind === "template" || item.kind === "schedule" || item.kind === "body-profile" || item.kind === "protein-warehouse";
  const createMeal = item.kind === "nutrition" && item.entry.type === "meal" && revision === null;
  const editMeal = item.kind === "nutrition" && Boolean(revision);
  const updated = nextRevision(new Date().toISOString(), protectedWrite || editMeal ? [revision] : []);
  const db = database();
  const result = item.kind === "template" && revision ? await updateTemplateRevision(db, owner, item, revision, updated).run()
    : (protectedWrite || editMeal) && revision ? await db.prepare(
    "UPDATE personal_library SET day=?, payload=?, updated=? WHERE owner=? AND kind=? AND id=? AND updated=?" +
    (editMeal ? " AND json_extract(payload, '$.sourceWorkoutId') IS NULL" : "")
  ).bind(day, payload, updated, owner, item.kind, id, revision).run() : await db.prepare(
    "INSERT INTO personal_library (owner, kind, id, day, payload, updated) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, kind, id) " +
    (protectedWrite || createMeal ? "DO NOTHING" : "DO UPDATE SET day=excluded.day,payload=excluded.payload,updated=excluded.updated") +
    (item.kind === "nutrition" && !createMeal ? " WHERE json_extract(personal_library.payload, '$.sourceWorkoutId') IS NULL" : "")
  ).bind(owner, item.kind, id, day, payload, updated).run();
  if (createMeal && !result.meta.changes) {
    // The same submission can be retried after a lost response without overwriting a later edit.
    const existing = await db.prepare(
      "SELECT updated FROM personal_library WHERE owner=? AND kind='nutrition' AND id=? AND payload=?"
    ).bind(owner, id, payload).first<{ updated: string }>();
    if (existing) return existing.updated;
    throw new HttpError(409, "这条饮食记录已变更，请在饮食日记中查看。");
  }
  if (protectedWrite && !result.meta.changes) {
    if (item.kind === "body-profile") throw new HttpError(409, "身体档案已在另一处变更，请刷新后重新编辑。");
    if (item.kind === "protein-warehouse") throw new HttpError(409, "仓库已在另一台设备更新，请确认最新产品后重试。");
    throw staleLibraryItem();
  }
  if (item.kind === "nutrition" && !result.meta.changes) {
    throw new HttpError(409, editMeal ? "这条饮食记录已变更，请在饮食日记中查看。" : "在对应的训练记录中编辑蛋白粉打卡。");
  }
  return updated;
}

export async function removeLibrary(owner: string, kind: "template" | "nutrition", id: string, revision?: string) {
  const db = database();
  if (kind === "template") {
    if (!revision) throw staleLibraryItem();
    const [, removed] = await db.batch(removeTemplateRevision(db, owner, id, revision, nextRevision(new Date().toISOString(), [revision])));
    if (!removed?.meta.changes) throw staleLibraryItem();
  } else {
    const removed = await db.prepare("DELETE FROM personal_library WHERE owner = ? AND kind = ? AND id = ? " +
      "AND json_extract(payload, '$.sourceWorkoutId') IS NULL AND (? IS NULL OR updated=?)")
      .bind(owner, kind, id, revision ?? null, revision ?? null).run();
    if (!removed.meta.changes && await db.prepare("SELECT 1 FROM personal_library WHERE owner = ? AND kind = ? AND id = ?")
      .bind(owner, kind, id).first()) throw new HttpError(409, revision
        ? "这条饮食记录已变更，请在饮食日记中查看。"
        : "在对应的训练记录中取消蛋白粉打卡。");
  }
}
