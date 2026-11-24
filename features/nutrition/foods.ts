export type Food = {
  id: string;
  name: string;
  aliases: readonly string[];
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  source?: string;
};

export const maxFoodGrams = 3000;

const source = "https://fdc.nal.usda.gov/download-datasets/";

// USDA FoodData Central SR Legacy (April 2018). IDs match food.csv, and values
// are kcal, protein, total carbohydrate and fat from food_nutrient.csv per 100 g edible weight.
function usdaFood(
  fdcId: number, name: string, aliases: readonly string[], per100g: Food["per100g"],
): Food {
  return { id: "fdc-" + fdcId, name, aliases, per100g, source };
}

export const foods: readonly Food[] = [
  usdaFood(173904, "原味燕麦片（干）", ["燕麦", "燕麦片", "燕麥", "燕麥片", "干燕麦", "oats", "rolled oats", "dry oats", "oatmeal", "quick oats"],
    { calories: 379, protein: 13.15, carbs: 67.7, fat: 6.52 }),
  usdaFood(173424, "水煮鸡蛋", ["鸡蛋", "雞蛋", "水煮蛋", "熟鸡蛋", "egg", "eggs", "boiled egg", "hard-boiled egg"],
    { calories: 155, protein: 12.58, carbs: 1.12, fat: 10.61 }),
  usdaFood(171265, "全脂牛奶", ["牛奶", "纯牛奶", "純牛奶", "全脂奶", "milk", "whole milk", "3.25% milk"],
    { calories: 61, protein: 3.15, carbs: 4.8, fat: 3.25 }),
  usdaFood(170894, "原味脱脂希腊酸奶", ["希腊酸奶", "希臘酸奶", "希腊优格", "脱脂酸奶", "greek yogurt", "greek yoghurt", "nonfat greek yogurt"],
    { calories: 59, protein: 10.19, carbs: 3.6, fat: 0.39 }),
  usdaFood(173944, "香蕉", ["banana", "bananas"],
    { calories: 89, protein: 1.09, carbs: 22.84, fat: 0.33 }),
  usdaFood(172688, "全麦面包", ["全麥麵包", "全麦吐司", "全麦土司", "whole wheat bread", "wholemeal bread"],
    { calories: 252, protein: 12.45, carbs: 42.71, fat: 3.5 }),
  usdaFood(173905, "燕麦粥（水煮）", ["熟燕麦", "燕麥粥", "煮燕麦", "cooked oats", "cooked oatmeal", "oat porridge"],
    { calories: 71, protein: 2.54, carbs: 12, fat: 1.52 }),
  usdaFood(171267, "低脂牛奶（2%）", ["低脂奶", "低脂牛奶", "2% milk", "low-fat milk", "reduced fat milk"],
    { calories: 50, protein: 3.3, carbs: 4.8, fat: 1.98 }),
  usdaFood(171284, "原味全脂酸奶", ["酸奶", "原味酸奶", "原味优格", "原味優格", "plain yogurt", "plain yoghurt", "yogurt"],
    { calories: 61, protein: 3.47, carbs: 4.66, fat: 3.25 }),
  usdaFood(175215, "无糖豆浆", ["豆浆", "豆漿", "豆奶", "無糖豆漿", "soy milk", "soymilk", "unsweetened soy milk"],
    { calories: 33, protein: 2.86, carbs: 1.74, fat: 1.61 }),
  usdaFood(171688, "苹果（带皮）", ["苹果", "蘋果", "apple", "apples"],
    { calories: 52, protein: 0.26, carbs: 13.81, fat: 0.17 }),
  usdaFood(171711, "蓝莓", ["藍莓", "blueberry", "blueberries"],
    { calories: 57, protein: 0.74, carbs: 14.49, fat: 0.33 }),
  usdaFood(167762, "草莓", ["strawberry", "strawberries"],
    { calories: 32, protein: 0.67, carbs: 7.68, fat: 0.3 }),
  usdaFood(174924, "白面包", ["白麵包", "白吐司", "白土司", "white bread"],
    { calories: 266, protein: 8.85, carbs: 49.42, fat: 3.33 }),
  usdaFood(169757, "白米饭（熟）", ["米饭", "白饭", "米飯", "白飯", "熟米饭", "white rice", "cooked rice"],
    { calories: 130, protein: 2.69, carbs: 28.17, fat: 0.28 }),
  usdaFood(168484, "水煮红薯", ["红薯", "紅薯", "番薯", "地瓜", "熟红薯", "sweet potato", "boiled sweet potato"],
    { calories: 76, protein: 1.37, carbs: 17.72, fat: 0.14 }),
  usdaFood(168483, "烤红薯（去皮）", ["烤番薯", "烤地瓜", "baked sweet potato"],
    { calories: 90, protein: 2.01, carbs: 20.71, fat: 0.15 }),
  usdaFood(171705, "牛油果", ["鳄梨", "酪梨", "avocado", "avocados"],
    { calories: 160, protein: 2, carbs: 8.53, fat: 14.66 }),
  usdaFood(172470, "原味花生酱（无盐）", ["花生酱", "花生醬", "peanut butter", "unsalted peanut butter"],
    { calories: 598, protein: 22.21, carbs: 22.31, fat: 51.36 }),
  usdaFood(170567, "原味巴旦木", ["巴旦木", "扁桃仁", "杏仁", "almond", "almonds"],
    { calories: 579, protein: 21.15, carbs: 21.55, fat: 49.93 }),
  usdaFood(170554, "奇亚籽", ["奇亞籽", "chia", "chia seeds"],
    { calories: 486, protein: 16.54, carbs: 42.12, fat: 30.74 }),
  usdaFood(172475, "北豆腐（生）", ["北豆腐", "老豆腐", "硬豆腐", "豆腐", "tofu", "firm tofu"],
    { calories: 144, protein: 17.27, carbs: 2.78, fat: 8.72 }),
];

function normalizeFoodName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function searchFoods(query: string, choices: readonly Food[] = foods): Food[] {
  const needle = normalizeFoodName(query);
  if (!needle) return [...choices];

  return choices.map((food) => {
    const names = [food.name, ...food.aliases].map(normalizeFoodName);
    const rank = names.includes(needle) ? 0
      : names.some((name) => name.startsWith(needle)) ? 1
      : names.some((name) => name.includes(needle)) ? 2 : 3;
    return { food, rank };
  }).filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ food }) => food);
}

export function scaleNutrition(per100g: Food["per100g"], grams: number): Food["per100g"] {
  const factor = Number.isFinite(grams) && grams > 0 && grams <= maxFoodGrams ? grams / 100 : 0;
  return {
    calories: per100g.calories * factor,
    protein: per100g.protein * factor,
    carbs: per100g.carbs * factor,
    fat: per100g.fat * factor,
  };
}
