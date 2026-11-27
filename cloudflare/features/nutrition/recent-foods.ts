import type { MealEntry } from "../library/model";
import type { Food } from "./foods";

export type RecentMealFood = { foodId: string; meal: MealEntry["meal"]; grams: number };

export function splitFoodQuery(input: string): { name: string; grams?: string } {
  const value = input.normalize("NFKC").trim();
  // "g" and "grams" must not run into a Latin word, so "150 grams", "100 granola" and "100 gâteau" are not
  // read as food "s", "ranola" or "âteau". Chinese may follow directly, as in "150g鸡胸肉".
  const amount = "(\\d+(?:\\.\\d+)?)\\s*(?:公克|克|(?:grams?|g)(?!\\p{Script=Latin}))";
  // The lookbehind keeps the amount from starting inside a number, so "150g" is not read as food "1" with 50 g.
  const suffix = new RegExp("^(.+?)\\s*(?<![\\d.])" + amount + "$", "iu").exec(value);
  if (suffix) return { name: suffix[1].trim(), grams: suffix[2] };
  const prefix = new RegExp("^" + amount + "\\s*(.+)$", "iu").exec(value);
  if (prefix) return { name: prefix[2].trim(), grams: prefix[1] };
  return { name: value };
}

export function commonMealFoods(choices: readonly Food[], rows: readonly RecentMealFood[], meal: MealEntry["meal"]) {
  const uses = new Map<string, { sameMeal: number; total: number; latestGrams: number; mealGrams?: number; rank: number }>();
  rows.forEach((row, rank) => {
    const current = uses.get(row.foodId) ?? { sameMeal: 0, total: 0, latestGrams: row.grams, rank };
    current.total++;
    if (row.meal === meal) {
      current.sameMeal++;
      current.mealGrams ??= row.grams;
    }
    uses.set(row.foodId, current);
  });
  return [...choices].sort((a, b) => {
    const first = uses.get(a.id), second = uses.get(b.id);
    return (second?.sameMeal ?? 0) - (first?.sameMeal ?? 0) || (second?.total ?? 0) - (first?.total ?? 0)
      || (first?.rank ?? rows.length) - (second?.rank ?? rows.length);
  }).map((food) => {
    const use = uses.get(food.id);
    return { food, grams: use?.mealGrams ?? use?.latestGrams };
  });
}
