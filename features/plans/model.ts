import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import { parsePlanMove } from "@/features/exercises/move-name";

export const categories = ["力量训练", "有氧训练", "拉伸恢复", "跟练视频", "其他"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const move = z.object({
  name: text(100),
  catalogueId: z.string().regex(/^\d{4,6}$/).optional(),
  block: z.string().regex(/^[A-Z](?:-[2-9]|-[12]\d|-30)?$/).optional(),
  station: text(60).optional(),
  cue: text(220).optional(),
  sourceSlot: z.string().regex(/^[A-Z](?:\d+|-warmup)?$/).optional(),
  sourceName: text(100).optional(),
  sets: z.number().int().min(1).max(30),
  reps: z.number().int().min(0).max(999),
  weight: z.number().min(0).max(2000),
  unit: z.enum(["kg", "lb"]),
  seconds: z.number().int().min(0).max(18000),
  restSeconds: z.number().int().min(0).max(600).optional(),
  repsMax: z.number().int().min(1).max(999).optional(),
}).refine(({ reps, repsMax }) => repsMax === undefined || reps > 0 && repsMax >= reps);
export const videoUrl = z.string().max(1200).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      /^(?:(?:www\.|m\.)?(?:youtube\.com|bilibili\.com)|youtu\.be|b23\.tv)$/.test(url.hostname);
  } catch {
    return false;
  }
});
export const planSchema = z.object({
  title: text(100),
  date: dateSchema,
  category: z.enum(categories),
  minutes: z.number().int().min(0).max(720),
  durationNote: z.string().trim().max(380).optional(),
  defaultRestSeconds: z.number().int().min(0).max(600).optional(),
  shared: z.boolean(),
  video: videoUrl,
  exercises: z.array(move).max(30),
}).refine((value) => value.exercises.length > 0 || value.video.length > 0, "请至少添加一个动作或视频。");

export type Move = z.infer<typeof move>;
export type Plan = z.infer<typeof planSchema>;

export type PlannedWorkout = { id: string; data: Plan };

export const moveBlank = (): Move => ({ name: "", sets: 3, reps: 10, weight: 0, unit: "kg", seconds: 0 });
export const planBlank = (date: string): Plan => ({
  title: "", date, category: "力量训练", minutes: 0, shared: false, video: "", exercises: [moveBlank()],
});
export const examples = (date: string): Plan => ({
  ...planBlank(date),
  title: "上肢力量训练",
  minutes: 45,
  exercises: [
    { ...moveBlank(), name: "哑铃卧推", weight: 12, reps: 10 },
    { ...moveBlank(), name: "坐姿划船", weight: 25, reps: 12 },
    { ...moveBlank(), name: "哑铃肩推", weight: 8, reps: 10 },
    { ...moveBlank(), name: "哑铃弯举", weight: 6, reps: 12 },
  ],
});

export function cleanPlan(value: Plan) {
  const exercises = value.exercises.filter((item) => item.name.trim()).map((item) => {
    const parsed = parsePlanMove(item.name);
    return {
      ...item, name: parsed.name, station: item.station?.trim() || undefined,
      cue: item.cue?.trim() || parsed.cue, block: item.block ?? parsed.sourceSlot?.[0],
      sourceSlot: item.sourceSlot ?? parsed.sourceSlot,
    };
  });
  return planSchema.safeParse({ ...value, exercises });
}
