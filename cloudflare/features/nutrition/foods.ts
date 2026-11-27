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

/** `fromWords` holds a Latin-script label joined from each word onward: "big mac" gives "bigmac" and "mac". */
type SearchKey = { key: string; fromWords?: readonly string[] };

const hanOrKana = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// Latin-script labels match from the start of a word, so "tea" does not find "sirloin steak"
// while "big mac" still finds "McDonald's Big Mac".
function searchKey(label: string): SearchKey {
  const key = normalizeFoodName(label);
  if (hanOrKana.test(label)) return { key };
  const words = label.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return { key, fromWords: words.map((_, index) => words.slice(index).join("")) };
}

const startsWith = ({ key, fromWords }: SearchKey, needle: string) => key.startsWith(needle) || Boolean(fromWords?.some((rest) => rest.startsWith(needle)));
const includes = (label: SearchKey, needle: string) => label.fromWords ? startsWith(label, needle) : label.key.includes(needle);

const searchKeys = new WeakMap<Food, { name: SearchKey; aliases: SearchKey[] }>();

function keysOf(food: Food) {
  let keys = searchKeys.get(food);
  if (!keys) {
    keys = { name: searchKey(food.name), aliases: food.aliases.map(searchKey).filter(({ key }) => key) };
    searchKeys.set(food, keys);
  }
  return keys;
}

/** Lower ranks first: exact name, exact alias, name start, inside the name, alias start, inside an alias. */
function searchRank(food: Food, needle: string) {
  const { name, aliases } = keysOf(food);
  if (name.key === needle) return 0;
  if (aliases.some(({ key }) => key === needle)) return 1;
  if (name.key.startsWith(needle)) return 2;
  if (includes(name, needle)) return 3;
  if (aliases.some((alias) => startsWith(alias, needle))) return 4;
  if (aliases.some((alias) => includes(alias, needle))) return 5;
  return undefined;
}

// Ties keep catalog order, so the original 22 foods come first among equal matches.
export function searchFoods(query: string, choices: readonly Food[] = foods): Food[] {
  const needle = normalizeFoodName(query);
  if (!needle) return [...choices];

  return choices.map((food) => ({ food, rank: searchRank(food, needle) }))
    .filter((match): match is { food: Food; rank: number } => match.rank !== undefined)
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
