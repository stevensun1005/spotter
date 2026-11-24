import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { database, transaction } from "@/server/db";
import { HttpError } from "@/server/http";
import type { Session } from "@/features/training/model";
import { heartSchema, workoutWindow } from "../model";
import { readHeart, saveHeart, workoutId } from "../server";
import { recordHealthSync } from "@/features/health/server";
import { healthTypes } from "@/features/health/model";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const life = 5 * 60_000;
const recentDays = 14 * 86_400_000;
export const appleControl = z.object({ action: z.enum(["pair", "disconnect"]) });
export const applePairInput = z.object({ code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/) });
export const appleSyncInput = z.object({ id: workoutId, data: heartSchema })
  .refine(({ data }) => data.source === "apple" && data.samples.length > 0);
export const appleSyncReport = z.object({
  action: z.literal("report"), from: z.number().int().min(946_684_800_000), to: z.number().int().max(4_102_444_800_000),
  saved: z.number().int().min(0).max(100_000), skipped: z.number().int().min(0).max(100_000), empty: z.boolean(),
  selected: z.array(z.enum(["heartRate", ...healthTypes])).min(1).max(6).default(["heartRate"]),
  received: z.array(z.enum(["heartRate", ...healthTypes])).max(6).optional(),
}).refine((v) => v.to > v.from && v.to - v.from <= 366 * 86_400_000 && new Set(v.selected).size === v.selected.length &&
  (!v.empty || (v.saved === 0 && v.skipped === 0)) &&
  (!v.received || (new Set(v.received).size === v.received.length && v.received.every((type) => v.selected.includes(type)) && v.empty === (v.received.length === 0))));

export function reportAppleSync(owner: string, report: z.infer<typeof appleSyncReport>) {
  const { action: _action, ...data } = report;
  const result = { ...data, ...(data.received ? { emptyTypes: data.selected.filter((type) => !data.received!.includes(type)) } : {}), at: Date.now(), result: data.empty ? "empty" as const : "synced" as const };
  recordHealthSync(owner, result);
  return result;
}

export function appleConnection(owner: string) {
  return Boolean(database().prepare("SELECT 1 FROM apple_health_link WHERE owner = ? AND token_hash IS NOT NULL").get(owner));
}

export function issueAppleCode(owner: string) {
  const code = randomBytes(16).toString("hex");
  const expires = Date.now() + life;
  database().prepare(
    "INSERT INTO apple_health_link (owner, code_hash, code_expires) VALUES (?, ?, ?) " +
    "ON CONFLICT(owner) DO UPDATE SET code_hash = excluded.code_hash, code_expires = excluded.code_expires"
  ).run(owner, digest(code), expires);
  return { code, expires };
}

export function claimAppleCode(code: string) {
  const token = randomBytes(32).toString("hex");
  const updated = database().prepare(
    "UPDATE apple_health_link SET token_hash = ?, code_hash = NULL, code_expires = NULL " +
    "WHERE code_hash = ? AND code_expires > ?"
  ).run(digest(token), digest(code), Date.now());
  if (!updated.changes) throw new HttpError(401, "配对码无效、已使用或已过期。");
  return token;
}

export function appleDeviceOwner(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (token) {
    const row = database().prepare("SELECT owner FROM apple_health_link WHERE token_hash = ?").get(digest(token));
    if (row && typeof row.owner === "string") return row.owner;
  }
  throw new HttpError(401, "此 iPhone 的连接已失效，请重新配对。");
}

export function disconnectApple(owner: string) {
  database().prepare("DELETE FROM apple_health_link WHERE owner = ?").run(owner);
}

export function pendingAppleWorkouts(owner: string, request?: Request) {
  const now = Date.now();
  const parameters = request ? new URL(request.url).searchParams : new URLSearchParams();
  const supplied = parameters.has("from") || parameters.has("to");
  const query = z.object({
    from: z.coerce.number().int().min(946_684_800_000).default(now - recentDays),
    to: z.coerce.number().int().max(4_102_444_800_000).default(now),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    cursor: z.string().max(500).optional(),
  }).safeParse(Object.fromEntries(parameters));
  if (!query.success || query.data.to <= query.data.from || query.data.to - query.data.from > 366 * 86_400_000) {
    throw new HttpError(400, "请选择不超过 366 天的同步范围。");
  }
  const { from, to, limit, cursor } = query.data;
  let position: [number, string] | undefined;
  if (cursor) {
    try {
      position = z.tuple([z.number().int(), z.string().uuid()]).parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
    } catch { throw new HttpError(400, "同步分页无效，请重新开始同步。"); }
  }
  const cursorSql = position ? "AND (json_extract(e.payload, '$.started') < ? OR (json_extract(e.payload, '$.started') = ? AND e.id < ?)) " : "";
  const rows = database().prepare(
    "SELECT e.id, e.payload FROM entries e " +
    "LEFT JOIN workout_heart h ON h.owner = e.owner AND h.workout_id = e.id " +
    "LEFT JOIN apple_heart_sync s ON s.owner = e.owner AND s.workout_id = e.id " +
    "WHERE e.owner = ? AND e.kind = 'log' AND (h.workout_id IS NULL " + (supplied ? "OR s.workout_id IS NOT NULL" : "") + ") " +
    "AND json_extract(e.payload, '$.started') >= ? AND json_extract(e.payload, '$.started') < ? " + cursorSql +
    "ORDER BY json_extract(e.payload, '$.started') DESC, e.id DESC LIMIT ?"
  ).all(owner, from, to, ...(position ? [position[0], position[0], position[1]] : []), limit + 1) as { id: string; payload: string }[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? Buffer.from(JSON.stringify([(JSON.parse(last.payload) as Session).started, last.id])).toString("base64url") : null;
  return { workouts: page.map(({ id, payload }) => ({ id, ...workoutWindow(JSON.parse(payload) as Session) })), nextCursor };
}

export function attachAppleHeart(owner: string, { id, data }: z.infer<typeof appleSyncInput>) {
  const db = database();
  return transaction(db, () => {
    const existing = readHeart(owner, id);
    const native = db.prepare("SELECT 1 FROM apple_heart_sync WHERE owner = ? AND workout_id = ?").get(owner, id);
    // A retry is a no-op; a later read may enrich native samples after Watch catches up.
    // Permission changes or a partial HealthKit read must not shrink the saved history.
    const complete = !existing || (data.from <= existing.from && data.to >= existing.to && data.samples.length >= existing.samples.length);
    let saved = false;
    if ((!existing || native) && complete && JSON.stringify(existing) !== JSON.stringify(data)) {
      saved = saveHeart(owner, id, data, Boolean(native));
      if (saved) db.prepare("INSERT OR IGNORE INTO apple_heart_sync (owner, workout_id) VALUES (?, ?)").run(owner, id);
    }
    recordHealthSync(owner, { at: Date.now(), result: "synced", saved: saved ? 1 : 0, skipped: saved ? 0 : 1, empty: false, selected: ["heartRate"], received: ["heartRate"], emptyTypes: [], from: data.from, to: data.to });
    return saved;
  });
}
