import { z } from "zod";
import { HttpError } from "@/server/http";
import type { Session } from "@/features/training/model";
import { workoutWindow } from "./model";

const milliseconds = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
const energy = z.number().finite().min(0).max(30_000);

export const workoutHealthId = z.string().uuid();
export const workoutHealthSummary = z.object({
  source: z.literal("apple-watch"),
  startedAtMilliseconds: milliseconds,
  endedAtMilliseconds: milliseconds,
  activeKilocalories: energy.optional(),
  totalKilocalories: energy.optional(),
  averageHeartRate: z.number().finite().min(20).max(260).optional(),
}).strict().refine((data) => {
  const duration = data.endedAtMilliseconds - data.startedAtMilliseconds;
  return duration > 0 && duration <= 86_400_000 &&
    (data.activeKilocalories !== undefined || data.totalKilocalories !== undefined || data.averageHeartRate !== undefined) &&
    (data.totalKilocalories === undefined || (data.activeKilocalories !== undefined && data.totalKilocalories >= data.activeKilocalories));
}, "训练摘要的时间或数值无效。");

export const workoutHealthUpload = z.object({
  expectedOwner: z.string().min(1).max(300),
  id: workoutHealthId,
  data: workoutHealthSummary,
}).strict();

async function completedWorkout(db: D1Database, owner: string, id: string) {
  const row = await db.prepare(
    "SELECT e.payload AS workout, s.payload AS summary FROM entries e " +
    "LEFT JOIN workout_health_summaries s ON s.owner = e.owner AND s.workout_id = e.id " +
    "WHERE e.owner = ? AND e.id = ? AND e.kind = 'log'"
  ).bind(owner, id).first<{ workout: string; summary: string | null }>();
  if (!row) throw new HttpError(404, "找不到你已完成的训练。");
  return row;
}

export async function readWorkoutHealthSummary(db: D1Database, owner: string, id: string) {
  const { summary } = await completedWorkout(db, owner, id);
  return { data: summary ? workoutHealthSummary.parse(JSON.parse(summary)) : null };
}

// Keep the most complete single measurement interval. Calories from one
// workout interval must never be combined with rest energy from another.
const fields = ["activeKilocalories", "totalKilocalories", "averageHeartRate"] as const;
const completeness = (payload: string) => fields.map((field) =>
  "(json_type(" + payload + ", '$." + field + "') IS NOT NULL)").join(" + ");

export async function saveWorkoutHealthSummary(db: D1Database, owner: string, input: z.infer<typeof workoutHealthUpload>) {
  if (input.expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请重新打开训练。");
  const { id, data } = input;
  const { workout } = await completedWorkout(db, owner, id);
  const window = workoutWindow(JSON.parse(workout) as Session);
  const { startedAtMilliseconds: from, endedAtMilliseconds: to } = data;
  const overlap = Math.min(to, window.to) - Math.max(from, window.from);
  // Allow a small device timestamp difference while still requiring almost all
  // samples to belong to this workout.
  if (from < window.from - 30_000 || to > window.to + 30_000 ||
      overlap <= 0 || overlap < (to - from) * 0.95) {
    throw new HttpError(400, "Apple Watch 摘要与这次训练的时间不吻合。");
  }
  await db.prepare(
    "INSERT INTO workout_health_summaries (owner, workout_id, payload) " +
    "SELECT owner, id, ? FROM entries WHERE owner = ? AND id = ? AND kind = 'log' AND payload = ? " +
    "ON CONFLICT (owner, workout_id) DO UPDATE SET payload = excluded.payload " +
    "WHERE (" + completeness("excluded.payload") + ") >= (" + completeness("workout_health_summaries.payload") + ")"
  ).bind(JSON.stringify(data), owner, id, workout).run();
  const saved = await readWorkoutHealthSummary(db, owner, id);
  if (!saved.data) throw new HttpError(409, "这条训练已变更，请刷新后重试。");
  return { data: saved.data };
}
