import { z } from "zod";
import { dateSchema } from "@/shared/dates";

export const carbDays = ["低碳", "中碳", "高碳"] as const;
export const carbCycleSchema = z.object({
  days: z.array(z.enum(carbDays)).length(7),
  basis: z.literal("target").optional(),
  grams: z.object({ 低碳: z.number().min(0).max(1500), 中碳: z.number().min(0).max(1500), 高碳: z.number().min(0).max(1500) })
    .refine((grams) => grams.低碳 <= grams.中碳 && grams.中碳 <= grams.高碳),
});
export const cutStagesSchema = z.array(z.object({ date: dateSchema, calories: z.number().int().min(1200).max(20000) }))
  .max(8).refine((stages) => new Set(stages.map(({ date }) => date)).size === stages.length);

export const nutritionPlanningItem = z.object({ kind: z.literal("nutrition-plan"), carbCycle: carbCycleSchema.optional(), cut: cutStagesSchema.optional() });
export const nutritionEnergyItem = z.object({
  kind: z.literal("nutrition-energy"), id: dateSchema,
  workouts: z.array(z.object({ id: z.string().uuid(), calories: z.number().min(1).max(5000) })).max(50)
    .refine((workouts) => new Set(workouts.map(({ id }) => id)).size === workouts.length),
});

export type NutritionPlanningItem = z.infer<typeof nutritionPlanningItem>;
export type NutritionEnergyItem = z.infer<typeof nutritionEnergyItem>;
export type CarbCycle = z.infer<typeof carbCycleSchema>;
export type CarbDay = typeof carbDays[number];
