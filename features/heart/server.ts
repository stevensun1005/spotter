import { z } from "zod";
import { database } from "@/server/db";
import { HttpError } from "@/server/http";
import type { Session } from "@/features/training/model";
import { acceptsHeart, heartSchema, workoutWindow, type HeartData } from "./model";

export const workoutId = z.string().uuid();
export const heartMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: workoutId, data: heartSchema }),
  z.object({ action: z.literal("remove"), id: workoutId }),
]);

export function requireHeartWorkout(owner: string, id: string) {
  const row = database().prepare("SELECT payload FROM entries WHERE owner = ? AND id = ? AND kind = 'log'")
    .get(owner, id) as { payload: string } | undefined;
  if (!row) throw new HttpError(404, "找不到你已完成的训练。");
  return workoutWindow(JSON.parse(row.payload) as Session);
}

export function readHeart(owner: string, id: string) {
  requireHeartWorkout(owner, id);
  const row = database().prepare("SELECT payload FROM workout_heart WHERE owner = ? AND workout_id = ?")
    .get(owner, id) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as HeartData : null;
}

export function saveHeart(owner: string, id: string, data: HeartData, replace = true) {
  const window = requireHeartWorkout(owner, id);
  if (!acceptsHeart(window, data)) throw new HttpError(400, "心率活动与这次训练的时间不吻合。");
  const saved = database().prepare(
    "INSERT INTO workout_heart (owner, workout_id, payload) VALUES (?, ?, ?) " +
    (replace ? "ON CONFLICT(owner, workout_id) DO UPDATE SET payload = excluded.payload" :
      "ON CONFLICT(owner, workout_id) DO NOTHING")
  ).run(owner, id, JSON.stringify(data)).changes > 0;
  if (saved && replace) database().prepare("DELETE FROM apple_heart_sync WHERE owner = ? AND workout_id = ?").run(owner, id);
  return saved;
}

export function removeHeart(owner: string, id: string) {
  requireHeartWorkout(owner, id);
  database().prepare("DELETE FROM workout_heart WHERE owner = ? AND workout_id = ?").run(owner, id);
}
