import { z } from "zod";
import { mealPhotoDraftSchema } from "./food-photo-model";

export const nutritionProperties = Object.fromEntries(["calories", "protein", "carbs", "fat"].map((key) => [key, { type: "number" }]));
export const mealEstimateProperties = {
  name: { type: "string" }, grams: { type: "number" }, ...nutritionProperties,
  estimate: { type: ["string", "null"], description: "一句简短的估算依据。使用了家庭量具或同类食品估值时填写。" },
};

const completeMeal = mealPhotoDraftSchema.extend({
  grams: mealPhotoDraftSchema.shape.grams.unwrap(),
  estimate: z.string().trim().min(1).max(240).nullish(),
});

export const roundNutrition = (value: number) => Math.round(value * 100) / 100;

export function normalizeMealEstimate(input: unknown) {
  const parsed = completeMeal.safeParse(input);
  if (!parsed.success) return;
  const { name, grams, calories, protein, carbs, fat, estimate } = parsed.data;
  if (protein + carbs + fat > grams + 3 || calories > grams * 10) return;
  return {
    draft: { name, grams: roundNutrition(grams), calories: roundNutrition(calories), protein: roundNutrition(protein),
      carbs: roundNutrition(carbs), fat: roundNutrition(fat) },
    ...(estimate ? { estimate } : {}),
  };
}
