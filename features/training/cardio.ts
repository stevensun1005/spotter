import { z } from "zod";

export const maxCardioMinutes = 720;
export const maxCardioSeconds = maxCardioMinutes * 60;
export const maxCardioDistanceKm = 500;
export const maxCardioSpeedKmh = 50;
export const cardioActivityTitles = {
  "incline-walk": "爬坡走",
  cardio: "有氧训练",
  hiit: "HIIT 训练",
} as const;

export const inclineReadings = {
  percent: { min: -100, max: 100, step: "any" },
  level: { min: 0, max: 1000, step: "any" },
} as const;

export const cardioSchema = z.object({
  activity: z.enum(["incline-walk", "cardio", "hiit"]),
  durationSeconds: z.number().int().min(1).max(maxCardioSeconds).optional(),
  incline: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("percent"), value: z.number().min(inclineReadings.percent.min).max(inclineReadings.percent.max).optional() }).strict(),
    z.object({ kind: z.literal("level"), value: z.number().min(inclineReadings.level.min).max(inclineReadings.level.max).optional() }).strict(),
  ]).optional(),
  distanceKm: z.number().min(0).max(maxCardioDistanceKm).optional(),
  speedKmh: z.number().min(0).max(maxCardioSpeedKmh).optional(),
}).strict().refine(({ activity, incline }) => activity === "incline-walk" || incline === undefined);

export type Cardio = z.infer<typeof cardioSchema>;

export function cardioSeconds(cardio: Cardio, elapsedMs: number) {
  return cardio.durationSeconds ?? Math.min(maxCardioSeconds, Math.floor(elapsedMs / 1000));
}

export function cardioMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

export function formatCardioDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return [minutes > 0 ? minutes + " 分钟" : "", remaining > 0 || minutes === 0 ? remaining + " 秒" : ""].filter(Boolean).join(" ");
}
