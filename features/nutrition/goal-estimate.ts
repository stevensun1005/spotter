import { z } from "zod";
import type { NutritionValues } from "@/features/library/model";

export const nutritionGoal = z.enum(["maintain", "recompose", "gain", "lose"]);
export const nutritionActivity = z.enum(["sedentary", "light", "moderate", "high"]);
export const nutritionGoalInput = z.object({
  age: z.number().int().min(18).max(120),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(10).max(700),
  activity: nutritionActivity,
  goal: nutritionGoal,
});

export type NutritionGoal = z.infer<typeof nutritionGoal>;
export type NutritionActivity = z.infer<typeof nutritionActivity>;
export type NutritionGoalInput = z.infer<typeof nutritionGoalInput>;
export type NutritionGoalEstimate = {
  restingCalories: number;
  maintenanceCalories: number;
  values: NutritionValues;
};

const activityFactors: Record<NutritionActivity, number> = { sedentary: 1.4, light: 1.5, moderate: 1.6, high: 1.8 };
const proteinPerKg: Record<NutritionGoal, number> = { maintain: 1.6, recompose: 1.8, gain: 1.8, lose: 2 };

export function estimateNutritionGoal(input: NutritionGoalInput, water = 0): NutritionGoalEstimate | undefined {
  const parsed = nutritionGoalInput.safeParse(input);
  if (!parsed.success || !Number.isFinite(water) || water < 0 || water > 20000) return;
  const { age, sex, heightCm, weightKg, activity, goal } = parsed.data;
  if (goal === "lose" && weightKg / (heightCm / 100) ** 2 <= 18.5) return;

  // Mifflin–St Jeor estimates resting energy; activity and modest adjustments estimate intake.
  const resting = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const maintenance = resting * activityFactors[activity];
  const adjustment = goal === "gain" ? Math.min(250, maintenance * 0.08) : goal === "lose" ? -Math.min(300, maintenance * 0.1) : 0;
  const calories = Math.round((maintenance + adjustment) / 25) * 25;
  if (calories < 1200 || calories > 20000) return;

  // Allocate 25% to fat and preserve roughly 45% of estimated energy for carbohydrate.
  const fat = Math.round(calories * 0.25 / 9);
  const protein = Math.min(Math.floor((calories * 0.55 - fat * 9) / 4),
    Math.max(Math.ceil(calories * 0.1 / 4), Math.round(weightKg * proteinPerKg[goal])));
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return {
    restingCalories: Math.round(resting),
    maintenanceCalories: Math.round(maintenance),
    values: { calories, protein, carbs, fat, water },
  };
}
