import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import { planSchema, videoUrl } from "@/features/plans/model";
import { planRevisionSchema, scheduleSchema } from "@/features/plans/schedule";
import { muscleNames, types as exerciseTypes } from "@/features/exercises/labels";
import { exerciseAreaOptions } from "@/features/exercises/catalogue-areas";
import { proteinPreference } from "@/features/training/protein";
import { measurements, recordedMetrics } from "@/features/body/measurements";
import { bodyProfileItem } from "@/features/body/profile";
import { maxFoodGrams } from "@/features/nutrition/foods";
import { nutritionActivity, nutritionGoal } from "@/features/nutrition/goal-estimate";
import { nutritionEnergyItem, nutritionPlanningItem } from "@/features/nutrition/nutrition-planning-schema";

export const exerciseName = z.string().trim().min(1).max(100);
const video = z.object({ label: z.string().trim().min(1).max(45), url: videoUrl.refine(Boolean) });
export const exerciseClassification = z.object({
  area: z.string().refine((key) => key === "" || exerciseAreaOptions.some(({ id }) => id === key)),
  equipment: z.string().trim().max(50),
  type: z.string().refine((key) => key === "" || exerciseTypes.includes(key)),
});
export const exerciseProfile = z.object({
  name: exerciseName,
  pinned: z.boolean(),
  note: z.string().trim().max(2000),
  videos: z.array(video).max(8),
  versionOf: exerciseName.optional(),
  classification: exerciseClassification.optional(),
  guide: z.object({
    description: z.string().trim().max(400),
    steps: z.array(z.string().trim().min(1).max(400)).max(12),
    muscles: z.record(z.string().refine((key) => Object.hasOwn(muscleNames, key)), z.union([z.literal(100), z.literal(40)])),
  }).optional(),
}).refine((item) => item.name !== item.versionOf);
export type ExerciseProfile = z.infer<typeof exerciseProfile>;
export const blankProfile = (name: string): ExerciseProfile => ({ name, pinned: false, note: "", videos: [] });

export const mealTypes = ["早餐", "午餐", "晚餐", "加餐"] as const;
const amount = z.number().finite().min(0).max(20000);
const foodValues = z.object({ calories: amount, protein: amount, carbs: amount, fat: amount });
const foodName = z.string().trim().min(1).max(100);
export const nutritionValues = foodValues.extend({ water: amount });
export const nutritionEntry = z.discriminatedUnion("type", [
  foodValues.extend({ type: z.literal("meal"), meal: z.enum(mealTypes), name: foodName,
    calories: z.number().finite().min(0).max(maxFoodGrams * 10),
    grams: z.number().finite().min(0.1).max(maxFoodGrams).optional(), foodId: z.string().trim().min(1).max(80).optional() }),
  z.object({ type: z.literal("water"), ml: amount.positive() }),
  z.object({ type: z.literal("weight"), kg: z.number().finite().min(10).max(700) }),
  z.object({ type: z.literal("measurement"), metric: z.enum(recordedMetrics), value: z.number().finite() }),
]).refine((entry) => entry.type !== "measurement" || entry.value >= measurements[entry.metric].min && entry.value <= measurements[entry.metric].max);
export type NutritionEntry = z.infer<typeof nutritionEntry>;
export type MealEntry = Extract<NutritionEntry, { type: "meal" }>;
export type NutritionValues = z.infer<typeof nutritionValues>;
export const emptyNutrition: NutritionValues = { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 };

export const uuid = z.string().uuid();
const saveProfile = z.object({ kind: z.literal("exercise"), item: exerciseProfile });
const template = z.object({ kind: z.literal("template"), id: uuid, plan: planSchema });
const nutrition = z.object({ kind: z.literal("nutrition"), id: uuid, date: dateSchema, entry: nutritionEntry });
const targetWeightKg = z.number().finite().min(10).max(700);
export const nutritionGoalPreference = z.object({
  goal: nutritionGoal,
  activity: nutritionActivity,
  weightRange: z.object({ minKg: targetWeightKg, maxKg: targetWeightKg })
    .refine(({ minKg, maxKg }) => minKg <= maxKg).optional(),
}).refine(({ goal, weightRange }) => !weightRange || goal === "recompose");
const targets = z.object({ kind: z.literal("targets"), values: nutritionValues, preference: nutritionGoalPreference.optional(),
  targetWeightKg: targetWeightKg.optional() });
export const personalFood = z.object({ kind: z.literal("food"), id: uuid, name: foodName,
  per100g: foodValues.extend({ calories: amount.max(1000), protein: amount.max(100), carbs: amount.max(100), fat: amount.max(100) }),
});
export type PersonalFood = z.infer<typeof personalFood>;
export const foodPortion = z.object({ name: z.string().trim().min(1).max(20), grams: z.number().finite().min(0.1).max(maxFoodGrams) });
export const foodPortions = z.object({
  kind: z.literal("food-portions"), id: z.string().trim().min(1).max(80),
  portions: z.array(foodPortion).max(8).refine((portions) =>
    new Set(portions.map(({ name }) => name.normalize("NFKC").toLowerCase())).size === portions.length),
});
export type FoodPortions = z.infer<typeof foodPortions>;
export const historyOrder = z.object({
  kind: z.literal("history-order"), id: dateSchema,
  entries: z.array(uuid).max(150).refine((ids) => new Set(ids).size === ids.length),
});
export type HistoryOrder = z.infer<typeof historyOrder>;
const statsPins = z.object({ kind: z.literal("stats-pins"), ids: z.array(z.string().min(1).max(100)).max(80) });
export const libraryItem = z.discriminatedUnion("kind", [saveProfile, template, nutrition, targets, nutritionEnergyItem, nutritionPlanningItem,
  personalFood, foodPortions, historyOrder, statsPins, proteinPreference, bodyProfileItem, z.object({ kind: z.literal("schedule"), values: scheduleSchema })]);
export type LibraryItem = z.infer<typeof libraryItem>;
export type LibraryRow = LibraryItem & { updated: string };
export const libraryMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), data: libraryItem, revision: planRevisionSchema.nullable().optional(), expectedOwner: z.string().min(1).max(120).optional() }),
  z.object({ action: z.literal("remove"), kind: z.enum(["template", "nutrition"]), id: uuid, revision: planRevisionSchema.optional() }),
]);
