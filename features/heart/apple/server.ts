import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { database } from "@/server/db";
import { HttpError } from "@/server/http";
import type { Session } from "@/features/training/model";
import { heartSchema, workoutWindow } from "../model";
import { saveHeart, workoutId } from "../server";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const life = 5 * 60_000;
const recentDays = 14 * 86_400_000;
export const appleControl = z.object({ action: z.enum(["pair", "disconnect"]) });
export const applePairInput = z.object({ code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/) });
export const appleSyncInput = z.object({ id: workoutId, data: heartSchema })
  .refine(({ data }) => data.source === "apple" && data.samples.length > 0);

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

export function pendingAppleWorkouts(owner: string) {
  const now = Date.now();
  const rows = database().prepare(
    "SELECT e.id, e.payload FROM entries e " +
    "LEFT JOIN workout_heart h ON h.owner = e.owner AND h.workout_id = e.id " +
    "WHERE e.owner = ? AND e.kind = 'log' AND h.workout_id IS NULL AND json_extract(e.payload, '$.started') BETWEEN ? AND ? " +
    "ORDER BY json_extract(e.payload, '$.started') DESC LIMIT 24"
  ).all(owner, now - recentDays, now) as { id: string; payload: string }[];
  return rows.map(({ id, payload }) => ({ id, ...workoutWindow(JSON.parse(payload) as Session) }));
}

export function attachAppleHeart(owner: string, { id, data }: z.infer<typeof appleSyncInput>) {
  return saveHeart(owner, id, data, false);
}
