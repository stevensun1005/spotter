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

// Folds width, case and accents, so "creme brulee" finds "crème brûlée" and "ＲＯＬＬＥＤ" finds "rolled".
function foldFoodText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").normalize("NFC").toLowerCase();
}

function normalizeFoodName(value: string) {
  return foldFoodText(value).replace(/[^\p{L}\p{N}]/gu, "");
}

const eastAsianOrRun = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

/** A label's words: Latin words stay whole and each Chinese, Japanese or Korean character is a word of its own. */
function foodWords(value: string) {
  return foldFoodText(value).split(/[^\p{L}\p{N}]+/u).flatMap((chunk) => chunk.match(eastAsianOrRun) ?? []);
}

/** `fromWords` holds the label joined from each word onward: "big mac" gives "bigmac" and "mac". */
type SearchKey = { key: string; fromWords: readonly string[] };

// Labels match from the start of a word, so "tea" does not find "sirloin steak" and "pie" does not find
// "Rice Krispies", while "big mac" still finds "McDonald's Big Mac" and "饭" finds "米饭".
function searchKey(label: string): SearchKey {
  const words = foodWords(label);
  return { key: normalizeFoodName(label), fromWords: words.map((_, index) => words.slice(index).join("")) };
}

const fromAWord = ({ fromWords }: SearchKey, needle: string) => fromWords.some((rest) => rest.startsWith(needle));

const searchKeys = new WeakMap<Food, { name: SearchKey; aliases: SearchKey[] }>();

function keysOf(food: Food) {
  let keys = searchKeys.get(food);
  if (!keys) {
    keys = { name: searchKey(food.name), aliases: food.aliases.map(searchKey).filter(({ key }) => key) };
    searchKeys.set(food, keys);
  }
  return keys;
}

/**
 * Lower ranks first: exact name, exact alias, name start, a word inside the name, then any alias from the
 * start of one of its words. Whole-alias and later-word matches share a tier, so "steak" finds striploin
 * steak before "steak sauce". The iPhone app ranks these five the same way and adds two looser tiers.
 */
function searchRank(food: Food, needle: string) {
  const { name, aliases } = keysOf(food);
  if (name.key === needle) return 0;
  if (aliases.some(({ key }) => key === needle)) return 1;
  if (name.key.startsWith(needle)) return 2;
  if (fromAWord(name, needle)) return 3;
  if (aliases.some((alias) => fromAWord(alias, needle))) return 4;
  return undefined;
}

// Within a rank, everyday foods come before chain and brand items, then catalog order applies, so the
// original 22 foods come first among equal matches and "apple pie" means apple pie before a chain's.
export function searchFoods(query: string, choices: readonly Food[] = foods): Food[] {
  const needle = normalizeFoodName(query);
  if (!needle) return [...choices];

  return choices.map((food) => ({ food, rank: searchRank(food, needle) }))
    .filter((match): match is { food: Food; rank: number } => match.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || Number(Boolean(a.food.brand)) - Number(Boolean(b.food.brand)))
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
