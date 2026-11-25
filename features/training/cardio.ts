import { z } from "zod";

export const maxCardioMinutes = 720;
export const maxCardioSeconds = maxCardioMinutes * 60;
export const maxCardioDistanceKm = 500;
export const maxCardioSpeedKmh = 50;
const maxCyclingSpeedKmh = 120;
const cardioActivities = [
  "incline-walk", "cardio", "hiit", "running", "treadmill-running", "cycling",
  "stationary-cycling", "rowing", "elliptical", "walking", "stair-climbing", "swimming", "jump-rope",
] as const;

export const cardioActivityTitles = {
  "incline-walk": "爬坡走",
  cardio: "有氧训练",
  hiit: "HIIT 训练",
  running: "跑步",
  "treadmill-running": "跑步机",
  cycling: "户外骑行",
  "stationary-cycling": "室内骑行",
  rowing: "划船机",
  elliptical: "椭圆机",
  walking: "步行",
  "stair-climbing": "登阶机",
  swimming: "游泳",
  "jump-rope": "跳绳",
} satisfies Record<(typeof cardioActivities)[number], string>;

export function cardioMaximumSpeedKmh(activity: (typeof cardioActivities)[number]) {
  return activity === "cycling" || activity === "stationary-cycling" ? maxCyclingSpeedKmh : maxCardioSpeedKmh;
}

export const inclineReadings = {
  percent: { min: -100, max: 100, step: "any" },
  level: { min: 0, max: 1000, step: "any" },
} as const;

export const cardioSchema = z.object({
  activity: z.enum(cardioActivities),
  durationSeconds: z.number().int().min(1).max(maxCardioSeconds).optional(),
  incline: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("percent"), value: z.number().min(inclineReadings.percent.min).max(inclineReadings.percent.max).optional() }).strict(),
    z.object({ kind: z.literal("level"), value: z.number().min(inclineReadings.level.min).max(inclineReadings.level.max).optional() }).strict(),
  ]).optional(),
  distanceKm: z.number().min(0).max(maxCardioDistanceKm).optional(),
  speedKmh: z.number().min(0).max(maxCyclingSpeedKmh).optional(),
}).strict().refine(({ activity, incline, speedKmh }) =>
  (activity === "incline-walk" || incline === undefined) && (speedKmh === undefined || speedKmh <= cardioMaximumSpeedKmh(activity)));

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
