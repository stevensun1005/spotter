import { z } from "zod";

export const healthTypes = ["bodyMass", "workouts", "steps", "activeEnergy", "exerciseTime"] as const;
export type HealthType = typeof healthTypes[number];
const instant = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
const provenance = {
  sourceName: z.string().trim().min(1).max(160),
  sourceId: z.string().trim().min(1).max(200),
};
const interval = { from: instant, to: instant };
const sampleId = z.string().uuid().toLowerCase();
const bodyMass = z.object({ id: sampleId, at: instant, value: z.number().positive().max(1500), unit: z.enum(["kg", "lb"]), ...provenance });
const workout = z.object({
  id: sampleId, ...interval, activity: z.string().trim().min(1).max(120),
  durationSeconds: z.number().nonnegative().max(604_800), activeEnergyKcal: z.number().nonnegative().max(100_000).optional(), ...provenance,
}).refine((v) => v.to > v.from && v.to - v.from <= 604_800_000 && v.durationSeconds <= (v.to - v.from) / 1000 + 1);
const activity = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ...interval,
  steps: z.number().int().nonnegative().max(300_000).optional(),
  activeEnergyKcal: z.number().nonnegative().max(100_000).optional(),
  exerciseMinutes: z.number().nonnegative().max(1560).optional(), ...provenance,
}).refine((v) => v.to > v.from && v.to - v.from <= 26 * 3_600_000);

export const healthBatchSchema = z.object({
  selected: z.array(z.enum(healthTypes)).min(1).max(5), ...interval,
  timeZone: z.string().max(100).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }),
  bodyMass: z.array(bodyMass).max(3000).default([]),
  workouts: z.array(workout).max(1000).default([]),
  activity: z.array(activity).max(32).default([]),
}).superRefine((v, ctx) => {
  const selected = new Set(v.selected);
  const inRange = (from: number, to: number) => from >= v.from && to <= v.to;
  if (v.to <= v.from || v.to - v.from > 31 * 86_400_000 || selected.size !== v.selected.length ||
      new Set(v.bodyMass.map((r) => r.id)).size !== v.bodyMass.length ||
      new Set(v.workouts.map((r) => r.id)).size !== v.workouts.length ||
      new Set(v.activity.map((r) => r.date)).size !== v.activity.length ||
      (v.bodyMass.length && !selected.has("bodyMass")) || (v.workouts.length && !selected.has("workouts")) ||
      v.bodyMass.some((r) => !inRange(r.at, r.at) || r.at >= v.to) ||
      v.workouts.some((r) => !inRange(r.from, r.to) || (r.activeEnergyKcal !== undefined && !selected.has("activeEnergy"))) ||
      v.activity.some((r) => !inRange(r.from, r.to) ||
        (r.steps !== undefined && !selected.has("steps")) ||
        (r.activeEnergyKcal !== undefined && !selected.has("activeEnergy")) ||
        (r.exerciseMinutes !== undefined && !selected.has("exerciseTime")) ||
        [r.steps, r.activeEnergyKcal, r.exerciseMinutes].every((n) => n === undefined))) {
    ctx.addIssue({ code: "custom", message: "同步数据超出所选类型或时间范围。" });
  }
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-CA", { timeZone: v.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { return; }
  for (const r of v.activity) {
    const parts = formatter.formatToParts(r.from);
    const date = ["year", "month", "day"].map((p) => parts.find((part) => part.type === p)?.value).join("-");
    if (date !== r.date) ctx.addIssue({ code: "custom", message: "活动日期与时区不吻合。" });
  }
});
export type HealthBatch = z.infer<typeof healthBatchSchema>;
export type BodyMassRecord = Omit<HealthBatch["bodyMass"][number], "value" | "unit"> & { kg: number };
export type HealthWorkout = HealthBatch["workouts"][number] & { matchedWorkoutId: string | null; sourceNames?: string[]; sourceIds?: string[] };
export type ActivityRecord = HealthBatch["activity"][number] & { timeZone: string };
export type HealthSyncResult = {
  at: number; result: "synced" | "empty"; saved: number; skipped: number; empty: boolean;
  selected: (HealthType | "heartRate")[]; from: number; to: number;
  received?: (HealthType | "heartRate")[];
  emptyTypes?: (HealthType | "heartRate")[];
};
export type HealthOverview = { bodyMass: BodyMassRecord[]; activity: ActivityRecord[]; workouts: HealthWorkout[] };
