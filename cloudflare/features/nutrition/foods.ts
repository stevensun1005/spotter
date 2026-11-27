import catalog from "../../shared/food-catalog.json" with { type: "json" };

export type Food = {
  id: string;
  name: string;
  aliases: readonly string[];
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  source?: string;
  emoji?: string;
  category?: string;
  group?: string;
  portions?: readonly { name: string; grams: number }[];
  brand?: string;
};

export const maxFoodGrams = 3000;

type CatalogFood = (typeof catalog.foods)[number] & { en?: string; brand?: string; ref?: string };
type CatalogSource = { title: string; url?: string };

const sources: Record<string, CatalogSource> = catalog.sources;

function sourceUrl(item: CatalogFood) {
  if (item.ref?.startsWith("https://")) return item.ref;
  return sources[item.src]?.url;
}

// Shared with the iPhone app through `cloudflare/shared/food-catalog.json`. Values are kcal, protein,
// total carbohydrate and fat per 100 g edible weight. Each item names its source in `src` and `ref`.
export const foods: readonly Food[] = (catalog.foods as readonly CatalogFood[]).map((item) => ({
  id: item.id,
  name: item.name,
  aliases: [...(item.en ? [item.en] : []), ...item.aliases],
  per100g: item.per100g,
  source: sourceUrl(item),
  emoji: item.emoji,
  category: item.category,
  group: item.group,
  portions: item.portions,
  ...(item.brand ? { brand: item.brand } : {}),
}));

// The original everyday list. Food recommendations and recipes rank only these, so a large catalog of
// oils, snacks and restaurant items does not crowd out simple whole foods.
export const coreFoods: readonly Food[] = foods.filter(({ id }) => id.startsWith("fdc-"));

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
