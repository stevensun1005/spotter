import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import { acceptsHeart, workoutWindow } from "@/features/heart/model";
import { resolvePlanTemplate, withoutTemplateLink } from "@/features/plans/template-link";
import { dateBounds, emptyBackup, libraryKey, scopeBackup, type Backup, type DataScope, type DateBounds } from "./model";

function database() {
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return env.DB;
}

export async function exportBackup(owner: string, scope: DataScope, bounds: DateBounds = {}, includeHeart = true) {
  const db = database();
  const dates = dateBounds.parse(bounds);
  const from = dates.from ?? "0000-01-01";
  const to = dates.to ?? "9999-12-31";
  const primary = scope === "training" || scope === "all";
  type Doc = { kind: string; id: string; payload: string };
  const [rows, personal, heart] = await Promise.all([
    primary ? db.prepare(
      "SELECT id, kind, payload FROM entries WHERE owner = ? AND kind IN ('plan', 'draft', 'log') AND json_extract(payload, '$.date') BETWEEN ? AND ? ORDER BY id"
    ).bind(owner, from, to).all<Doc>() : undefined,
    db.prepare("SELECT payload FROM personal_library WHERE owner = ? AND (day IS NULL OR day BETWEEN ? AND ?) ORDER BY kind, id").bind(owner, from, to).all<Doc>(),
    primary && includeHeart ? db.prepare(
      "SELECT h.workout_id AS id, h.payload FROM workout_heart h JOIN entries e ON h.owner = e.owner AND h.workout_id = e.id " +
      "WHERE h.owner = ? AND e.kind = 'log' AND json_extract(e.payload, '$.date') BETWEEN ? AND ?"
    ).bind(owner, from, to).all<Doc>() : undefined,
  ]);
  const file = emptyBackup();
  file.library = personal.results.map(({ payload }) => JSON.parse(payload));
  const templates = new Map(file.library.flatMap((item) => item.kind === "template" ? [[item.id, item.plan] as const] : []));
  file.training = rows?.results.map(({ id, kind, payload }) => {
    const row = { id, kind, data: JSON.parse(payload) } as Backup["training"][number];
    return row.kind === "plan" && row.data.templateId
      ? { ...row, data: resolvePlanTemplate(row.data, templates.get(row.data.templateId)) }
      : row;
  }) ?? [];
  file.heart = heart?.results.map(({ id, payload }) => ({ id, data: JSON.parse(payload) })) ?? [];
  return scopeBackup(file, scope);
}

// Chunk JSON bindings, while keeping the restore in one D1 transaction.
function chunks<T>(rows: T[]) {
  const packets: string[] = [];
  const encoder = new TextEncoder();
  let parts: string[] = [];
  let size = 2;
  for (const row of rows) {
    const value = JSON.stringify(row);
    const bytes = encoder.encode(value).byteLength + 1;
    if (parts.length && size + bytes > 80_000) {
      packets.push("[" + parts.join(",") + "]");
      parts = [];
      size = 2;
    }
    parts.push(value);
    size += bytes;
  }
  if (parts.length) packets.push("[" + parts.join(",") + "]");
  return packets;
}

export async function importBackup(owner: string, file: Backup) {
  const db = database();
  const now = new Date().toISOString();
  const workouts = new Map(file.training.flatMap((row) => row.kind === "log" ? [[row.id, row.data] as const] : []));
  const library = file.library.map((item) => ({
    id: libraryKey(item), kind: item.kind, day: item.kind === "nutrition" ? item.date : null,
    item: item.kind === "template" ? { ...item, plan: withoutTemplateLink(item.plan) } : item,
  }));
  const heart = file.heart.flatMap((row) => {
    const log = workouts.get(row.id);
    return log && acceptsHeart(workoutWindow(log), row.data) ? [{ ...row, started: log.started, date: log.date }] : [];
  });
  const statements = [
    ...chunks(file.training.map((item) => item.kind === "plan" ? { ...item, data: { ...item.data, shared: false } } : item)).map((chunk) => db.prepare(
      "INSERT INTO entries (owner, id, kind, payload, updated) " +
      "SELECT ?, json_extract(value,'$.id'), json_extract(value,'$.kind'), json_extract(value,'$.data'), ? FROM json_each(?) WHERE 1 " +
      "ON CONFLICT(owner,id) DO NOTHING"
    ).bind(owner, now, chunk)),
    ...chunks(library).map((chunk) => db.prepare(
      "INSERT INTO personal_library (owner, id, kind, day, payload, updated) " +
      "SELECT ?, json_extract(value,'$.id'), json_extract(value,'$.kind'), json_extract(value,'$.day'), json_extract(value,'$.item'), ? FROM json_each(?) WHERE 1 " +
      "ON CONFLICT(owner,kind,id) DO NOTHING"
    ).bind(owner, now, chunk)),
    ...chunks(heart).map((chunk) => db.prepare(
      "INSERT INTO workout_heart (owner, workout_id, payload) SELECT ?, e.id, json_extract(h.value,'$.data') " +
      "FROM json_each(?) h JOIN entries e ON e.owner = ? AND e.id = json_extract(h.value,'$.id') AND e.kind = 'log' " +
      "AND json_extract(e.payload,'$.started') = json_extract(h.value,'$.started') AND json_extract(e.payload,'$.date') = json_extract(h.value,'$.date') " +
      "WHERE 1 ON CONFLICT(owner,workout_id) DO NOTHING"
    ).bind(owner, chunk, owner)),
  ];
  const count = file.training.length + file.library.length + file.heart.length;
  const results = statements.length ? await db.batch(statements) : [];
  const added = results.reduce((total, item) => total + (item.meta.changes ?? 0), 0);
  return { added, skipped: count - added };
}
