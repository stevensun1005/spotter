import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import { planSchema, type Plan } from "@/features/plans/model";

const sets = z.object({
  reps: z.number().int().min(0).max(999),
  weight: z.number().min(0).max(2000),
  seconds: z.number().int().min(0).max(18000),
  done: z.boolean(),
  kind: z.enum(["warmup", "drop"]).optional(),
  rpe: z.number().min(1).max(10).multipleOf(0.5).optional(),
  right: z.object({
    weight: z.number().min(0).max(2000),
    reps: z.number().int().min(0).max(999),
  }).optional(),
});
export const sessionSchema = z.object({
  plan: planSchema,
  planId: z.string().max(60),
  date: dateSchema,
  started: z.number().int().positive(),
  ended: z.number().int().positive().optional(),
  minutes: z.number().int().min(0).max(720),
  note: z.string().max(1500),
  finishedVideo: z.boolean(),
  rows: z.array(z.array(sets).min(1).max(30)).max(30),
}).refine((value) =>
  (value.ended === undefined || (value.ended >= value.started && value.ended - value.started <= 86_400_000)) &&
  value.rows.length === value.plan.exercises.length &&
    value.rows.every((row, i) => row.length === value.plan.exercises[i].sets));

export type Session = z.infer<typeof sessionSchema>;
export type SetLine = z.infer<typeof sets>;

export function startSession(plan: Plan, planId: string, date: string): Session {
  return {
    plan, planId, date, started: Date.now(), minutes: 0, note: "",
    finishedVideo: false,
    rows: plan.exercises.map((item) => Array.from({ length: item.sets }, () => ({
      weight: item.weight, reps: item.reps, seconds: item.seconds, done: false,
    }))),
  };
}

export function sessionTotals(session: Session) {
  let sets = 0;
  let volume = 0;
  session.rows.forEach((row, i) => row.forEach((line) => {
    if (!line.done) return;
    sets++;
    const rightVolume = line.right ? line.right.reps * line.right.weight : 0;
    volume += (line.reps * line.weight + rightVolume) * (session.plan.exercises[i].unit === "lb" ? 0.45359237 : 1);
  }));
  return { sets, volume };
}
