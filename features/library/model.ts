import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import { planSchema, videoUrl } from "@/features/plans/model";
import { scheduleSchema } from "@/features/plans/schedule";

export const exerciseName = z.string().trim().min(1).max(100);
const video = z.object({ label: z.string().trim().min(1).max(45), url: videoUrl.refine(Boolean) });
export const exerciseProfile = z.object({
  name: exerciseName,
  pinned: z.boolean(),
  note: z.string().trim().max(2000),
  videos: z.array(video).max(8),
  versionOf: exerciseName.optional(),
}).refine((item) => item.name !== item.versionOf);
export type ExerciseProfile = z.infer<typeof exerciseProfile>;
export const blankProfile = (name: string): ExerciseProfile => ({ name, pinned: false, note: "", videos: [] });

export const mealTypes = ["早餐", "午餐", "晚餐", "加餐"] as const;
const amount = z.number().finite().min(0).max(20000);
export const nutritionValues = z.object({ calories: amount, protein: amount, carbs: amount, fat: amount, water: amount });
export const nutritionEntry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meal"), meal: z.enum(mealTypes), name: z.string().trim().min(1).max(100),
    calories: amount, protein: amount, carbs: amount, fat: amount }),
  z.object({ type: z.literal("water"), ml: amount.positive() }),
  z.object({ type: z.literal("weight"), kg: z.number().finite().min(10).max(700) }),
]);
export type NutritionEntry = z.infer<typeof nutritionEntry>;
export type NutritionValues = z.infer<typeof nutritionValues>;
export const emptyNutrition: NutritionValues = { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 };

export const uuid = z.string().uuid();
const saveProfile = z.object({ kind: z.literal("exercise"), item: exerciseProfile });
const template = z.object({ kind: z.literal("template"), id: uuid, plan: planSchema });
const nutrition = z.object({ kind: z.literal("nutrition"), id: uuid, date: dateSchema, entry: nutritionEntry });
const targets = z.object({ kind: z.literal("targets"), values: nutritionValues });
export const libraryItem = z.discriminatedUnion("kind", [saveProfile, template, nutrition, targets, z.object({ kind: z.literal("schedule"), values: scheduleSchema })]);
export type LibraryItem = z.infer<typeof libraryItem>;
export type LibraryRow = LibraryItem & { updated: string };
export const libraryMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), data: libraryItem }),
  z.object({ action: z.literal("remove"), kind: z.enum(["template", "nutrition"]), id: uuid }),
]);
