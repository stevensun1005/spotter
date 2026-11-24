import { libraryMutation, type MealEntry } from "@/features/library/model";
import { send } from "@/shared/client";
import { mealPhotoDraftSchema, type MealPhotoDraft } from "./food-photo-model";

export type CoachMealSubmission = {
  owner: string;
  id: string;
  date: string;
  meal: MealEntry["meal"];
  draft: MealPhotoDraft;
};

export async function saveCoachMeal({ owner, id, date, meal, draft }: CoachMealSubmission): Promise<MealEntry> {
  const parsed = mealPhotoDraftSchema.safeParse(draft);
  if (!parsed.success) throw new Error("请核对食物名称、份量和营养数值。");
  const { name, grams, calories, protein, carbs, fat } = parsed.data;
  if (grams === undefined || protein + carbs + fat > grams + 3 || calories > grams * 10) {
    throw new Error("请核对食物份量和营养数值。");
  }
  const entry: MealEntry = { type: "meal", meal, name: name.slice(0, 96) + "（估算）", grams, calories, protein, carbs, fat };
  const mutation = libraryMutation.safeParse({
    action: "save", data: { kind: "nutrition", id, date, entry }, revision: null, expectedOwner: owner,
  });
  if (!owner?.trim() || !mutation.success) throw new Error("请重新打开饮食记录后再保存。");
  await send("/api/library", mutation.data);
  return entry;
}
