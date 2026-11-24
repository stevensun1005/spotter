import { env } from "cloudflare:workers";
import { z } from "zod";
import { HttpError } from "@/server/http";
import type { Session } from "@/features/training/model";
import { acceptsHeart, heartSchema, workoutWindow, type HeartData } from "./model";

export const workoutId = z.string().uuid();
export const heartMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: workoutId, data: heartSchema, expectedOwner: z.string().min(1).max(300).optional() }),
  z.object({ action: z.literal("remove"), id: workoutId }),
]);

function database() {
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return env.DB;
}

export async function requireHeartWorkout(owner: string, id: string) {
  const row = await database().prepare("SELECT payload FROM entries WHERE owner = ? AND id = ? AND kind = 'log'")
    .bind(owner, id).first<{ payload: string }>();
  if (!row) throw new HttpError(404, "找不到你已完成的训练。");
  return workoutWindow(JSON.parse(row.payload) as Session);
}

export async function readHeart(owner: string, id: string) {
  await requireHeartWorkout(owner, id);
  const row = await database().prepare("SELECT payload FROM workout_heart WHERE owner = ? AND workout_id = ?")
    .bind(owner, id).first<{ payload: string }>();
  return row ? JSON.parse(row.payload) as HeartData : null;
}

export async function saveHeart(owner: string, id: string, data: HeartData) {
  const window = await requireHeartWorkout(owner, id);
  if (!acceptsHeart(window, data)) throw new HttpError(400, "心率活动与这次训练的时间不吻合。");
  await database().prepare(
    "INSERT INTO workout_heart (owner, workout_id, payload) VALUES (?, ?, ?) " +
    "ON CONFLICT(owner, workout_id) DO UPDATE SET payload = excluded.payload"
  ).bind(owner, id, JSON.stringify(data)).run();
}

export async function removeHeart(owner: string, id: string) {
  await requireHeartWorkout(owner, id);
  await database().prepare("DELETE FROM workout_heart WHERE owner = ? AND workout_id = ?").bind(owner, id).run();
}
