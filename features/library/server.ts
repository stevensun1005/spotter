import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import type { LibraryItem, LibraryRow } from "./model";
import { libraryKey } from "@/features/data/model";
import { openSchedule, scheduleSchema } from "@/features/plans/schedule";
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
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind = 'nutrition' AND json_extract(payload, '$.entry.type') IN ('weight','measurement') ORDER BY day ASC, updated DESC").bind(owner)
    : day
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND (kind IN ('targets', 'food') OR (kind = 'nutrition' AND day = ?)) ORDER BY updated DESC").bind(owner, day)
    : db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind IN ('exercise', 'template', 'schedule', 'stats-pins', 'protein-preference') ORDER BY updated DESC").bind(owner);
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

export async function saveLibrary(owner: string, item: LibraryItem) {
  const id = libraryKey(item);
  const day = item.kind === "nutrition" ? item.date : null;
  const payload = item.kind === "template" ? { ...item, plan: withoutTemplateLink(item.plan) } : item;
  await database().prepare(
    "INSERT INTO personal_library (owner, kind, id, day, payload, updated) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, kind, id) DO UPDATE SET day = excluded.day, payload = excluded.payload, updated = excluded.updated"
  ).bind(owner, item.kind, id, day, JSON.stringify(payload), new Date().toISOString()).run();
}

export async function removeLibrary(owner: string, kind: "template" | "nutrition", id: string) {
  const db = database();
  const remove = db.prepare("DELETE FROM personal_library WHERE owner = ? AND kind = ? AND id = ?").bind(owner, kind, id);
  if (kind === "template") {
    await db.batch([freezeTemplatePlans(db, owner, id, new Date().toISOString()), remove]);
  } else await remove.run();
}

export async function readSchedule(owner: string) {
  const row = await database().prepare("SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'").bind(owner).first<{ payload: string }>();
  if (!row) return openSchedule;
  return scheduleSchema.parse(JSON.parse(row.payload).values);
}
