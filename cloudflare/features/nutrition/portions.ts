import type { FoodPortions } from "@/features/library/model";
import { maxFoodGrams } from "./foods";

export type Portion = FoodPortions["portions"][number];
export const portionKey = (name: string) => name.trim().normalize("NFKC").toLowerCase();

export function portionGrams(amount: string, portion?: Portion) {
  const grams = Number(amount) * (portion?.grams ?? 1);
  const rounded = Math.round(grams * 1_000) / 1_000;
  return Number.isFinite(grams) && grams >= 0.1 && grams <= maxFoodGrams ? rounded : undefined;
}

export function saveFoodPortion(current: Portion[], portion: Portion) {
  const key = portionKey(portion.name);
  return current.some((item) => portionKey(item.name) === key)
    ? current.map((item) => portionKey(item.name) === key ? portion : item)
    : [...current, portion];
}
