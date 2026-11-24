import { foods, scaleNutrition, type Food } from "./foods";

const source = new Map(foods.map((food) => [food.id, food]));

function makeRecipe(title: string, method: string, entries: readonly (readonly [number, number])[]) {
  const ingredients = entries.flatMap(([id, grams]) => {
    const food = source.get("fdc-" + id);
    return food ? [{ food, grams, amounts: scaleNutrition(food.per100g, grams) }] : [];
  });
  if (ingredients.length !== entries.length) return [];
  const totals = ingredients.reduce((total, { amounts }) => ({ calories: total.calories + amounts.calories,
    protein: total.protein + amounts.protein, carbs: total.carbs + amounts.carbs, fat: total.fat + amounts.fat }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return [{ title, method, ingredients, totals }];
}

export const recipes = [
  ...makeRecipe("蓝莓燕麦酸奶碗", "用水煮熟燕麦，放温后拌入酸奶，铺上蓝莓。", [[173904, 45], [170894, 170], [171711, 80]]),
  ...makeRecipe("鸡蛋牛油果全麦吐司", "烤脆吐司，将牛油果压泥抹上，铺水煮蛋片。", [[173424, 100], [171705, 45], [172688, 70]]),
  ...makeRecipe("豆腐红薯饭碗", "豆腐切块加热至熟透，红薯切片，和热米饭一起装碗。", [[172475, 130], [168484, 120], [169757, 100]]),
  ...makeRecipe("草莓香蕉酸奶杯", "水果洗净切块，和原味酸奶交替装杯。", [[167762, 80], [173944, 85], [170894, 160]]),
  ...makeRecipe("豆浆花生燕麦粥", "燕麦加豆浆小火煮稠，关火后拌入花生酱。", [[173904, 45], [175215, 240], [172470, 12]]),
];

export type Recipe = typeof recipes[number];
export const nutrients = ["protein", "carbs", "fat"] as const;

export function mealFit(values: Food["per100g"], remaining: Food["per100g"]) {
  const covered = nutrients.reduce((score, nutrient) => score + (remaining[nutrient] > 0
    ? Math.min(1, values[nutrient] / remaining[nutrient]) : 0), 0);
  const overBudget = remaining.calories > 0 ? Math.max(0, values.calories / remaining.calories - 1) : 0;
  return covered - overBudget;
}
