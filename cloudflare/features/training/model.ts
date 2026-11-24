import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import { planBlank, planSchema, type Plan } from "@/features/plans/model";
import { maxWorkoutMs } from "./clock";
import { setVolumeKg } from "./volume";
import { cardioMinutes, cardioSchema } from "./cardio";
import { proteinProductSchema } from "./protein";

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
const sessionFields = z.object({
  plan: planSchema.innerType(),
  planId: z.string().max(60),
  date: dateSchema,
  started: z.number().int().positive(),
  ended: z.number().int().positive().optional(),
  clock: z.object({ elapsed: z.number().int().min(0).max(maxWorkoutMs), runningSince: z.number().int().positive().nullable() }).optional(),
  minutes: z.number().int().min(0).max(720),
  cardio: cardioSchema.optional(),
  note: z.string().max(1500),
  finishedVideo: z.boolean(),
  proteinShake: z.boolean().optional(),
  proteinProduct: proteinProductSchema.optional(),
  rest: z.object({
    until: z.number().int().min(0).max(maxWorkoutMs + 600_000),
    kind: z.enum(["换动作", "轮间休息", "组间休息", "换站"]),
  }).optional(),
  defaultRestOverride: z.number().int().min(0).max(600).optional(),
  rows: z.array(z.array(sets).min(1).max(30)).max(30),
}).refine((value) =>
  (value.ended === undefined || (value.ended >= value.started && value.ended - value.started <= 86_400_000)) &&
  (!value.proteinProduct || value.proteinShake === true) &&
  value.rows.length === value.plan.exercises.length &&
  value.rows.every((row, i) => row.length === value.plan.exercises[i].sets) &&
  (!value.cardio || (value.plan.category === "有氧训练" && value.planId === "" && !value.plan.video && !value.plan.exercises.length && !value.finishedVideo)));

export const draftSessionSchema = sessionFields.refine(({ plan, planId, finishedVideo }) =>
  Boolean(plan.video || plan.exercises.length) || (planId === "" && !finishedVideo));
export const sessionSchema = sessionFields.refine(({ plan, cardio, minutes }) => cardio
  ? cardio.durationSeconds !== undefined && minutes === cardioMinutes(cardio.durationSeconds)
  : Boolean(plan.video || plan.exercises.length));

export type Session = z.infer<typeof sessionSchema>;
export type SetLine = z.infer<typeof sets>;

export function startSession(plan: Plan, planId: string, date: string): Session {
  const started = Date.now();
  return {
    plan, planId, date, started, clock: { elapsed: 0, runningSince: started }, minutes: 0, note: "",
    finishedVideo: false,
    rows: plan.exercises.map((item) => Array.from({ length: item.sets }, () => ({
      weight: item.weight, reps: item.reps, seconds: item.seconds, done: false,
    }))),
  };
}

export const freeWorkoutTitle = "自由训练";

const freeWorkoutPresets = {
  strength: { title: freeWorkoutTitle, category: "力量训练" },
  cardio: { title: "有氧训练", category: "有氧训练" },
  incline: { title: "爬坡走", category: "有氧训练" },
  hiit: { title: "HIIT 训练", category: "有氧训练" },
} satisfies Record<string, Pick<Plan, "title" | "category">>;

export type FreeWorkoutKind = keyof typeof freeWorkoutPresets;

export function startFreeSession(date: string, kind: FreeWorkoutKind = "strength"): Session {
  const session = startSession({ ...planBlank(date), ...freeWorkoutPresets[kind], exercises: [] }, "", date);
  return kind === "incline" ? { ...session, cardio: { activity: "incline-walk" } } : session;
}

export function sessionTotals(session: Session) {
  let sets = 0;
  let volume = 0;
  session.rows.forEach((row, i) => row.forEach((line) => {
    if (!line.done) return;
    sets++;
    volume += setVolumeKg(line, session.plan.exercises[i]);
  }));
  return { sets, volume };
}

export function hasCompletedWorkout(data: Session) {
  return data.cardio ? Boolean(data.cardio.durationSeconds) : data.finishedVideo || sessionTotals(data).sets > 0;
}

export function checkinProblem(data: Session) {
  if (data.finishedVideo && !data.plan.video) return "这次训练没有视频链接。";
  if (!hasCompletedWorkout(data)) return data.cardio ? "请记录有氧训练时长。" : "请至少完成一组动作或标记视频跟练完成。";
  return "";
}
