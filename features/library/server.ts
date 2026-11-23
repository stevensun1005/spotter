import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import type { LibraryItem, LibraryRow } from "./model";
import { openSchedule, scheduleSchema } from "@/features/plans/schedule";

function database() {
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return env.DB;
}

export async function readLibrary(owner: string, day?: string): Promise<LibraryRow[]> {
  const db = database();
  const statement = day
    ? db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND (kind = 'targets' OR (kind = 'nutrition' AND day = ?)) ORDER BY updated DESC").bind(owner, day)
    : db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind IN ('exercise', 'template', 'schedule') ORDER BY updated DESC").bind(owner);
  const { results } = await statement.all<{ payload: string; updated: string }>();
  return results.map(({ payload, updated }) => ({ ...JSON.parse(payload) as LibraryItem, updated }));
}

export async function saveLibrary(owner: string, item: LibraryItem) {
  const id = item.kind === "exercise" ? item.item.name : item.kind === "targets" || item.kind === "schedule" ? item.kind : item.id;
  const day = item.kind === "nutrition" ? item.date : null;
  await database().prepare(
    "INSERT INTO personal_library (owner, kind, id, day, payload, updated) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner, kind, id) DO UPDATE SET day = excluded.day, payload = excluded.payload, updated = excluded.updated"
  ).bind(owner, item.kind, id, day, JSON.stringify(item), new Date().toISOString()).run();
}

export async function removeLibrary(owner: string, kind: "template" | "nutrition", id: string) {
  await database().prepare("DELETE FROM personal_library WHERE owner = ? AND kind = ? AND id = ?").bind(owner, kind, id).run();
}

export async function readSchedule(owner: string) {
  const row = await database().prepare("SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'").bind(owner).first<{ payload: string }>();
  if (!row) return openSchedule;
  return scheduleSchema.parse(JSON.parse(row.payload).values);
}
