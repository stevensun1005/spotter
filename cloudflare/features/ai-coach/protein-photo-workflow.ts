import type { MealEntry } from "@/features/library/model";
import { foods } from "@/features/nutrition/foods";
import type { MealPhotoDraft, ProteinPhotoProduct } from "@/features/nutrition/food-photo-model";
import type { ProteinProduct } from "@/features/training/protein";
import { proteinPhotoQuestion, type ProteinPhotoIntent } from "./protein-photo-intent";

export type ProteinRecipe = {
  id: string;
  meal: MealEntry["meal"];
  intent: ProteinPhotoIntent;
  product?: ProteinPhotoProduct;
};

const normalized = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const quantity = (n: number) => Math.round(n * 100) / 100;

export function combineProteinLabels(current: ProteinPhotoProduct | undefined, next: ProteinPhotoProduct, sameProductConfirmed = false): ProteinPhotoProduct {
  const differentName = current?.name && next.name && normalized(current.name) !== normalized(next.name);
  if (differentName && !sameProductConfirmed) {
    throw new Error("这张背标的品名和正面读到的不同。确认是同一款，就回复「就是这款」。");
  }
  return { ...current, ...next, name: current?.name ?? next.name };
}

export function milkFor(fat: number | undefined) {
  const referenceId = fat === 2 ? "fdc-171267" : fat === 3.25 ? "fdc-171265" : undefined;
  const food = foods.find(({ id }) => id === referenceId);
  if (food) return { name: food.name, per100ml: food.per100g };
}

export function prepareProteinPhoto(recipe: ProteinRecipe, products: readonly ProteinProduct[]) {
  const { intent, product } = recipe;
  if (!product?.name) return { question: "请拍清蛋白粉的产品名。如果有背面的营养表，也可以一起补拍。" } as const;
  const name = product.name;
  const known = products.find((item) => normalized(item.name) === normalized(name));
  const verifiedScoop = (intent.scoopGramsEstimated ? undefined : intent.scoopGrams) ?? product.scoopGrams;
  const scoopGrams = verifiedScoop ?? intent.scoopGrams ?? known?.scoopGrams;
  const milkMl = intent.milkMl;
  const milk = milkFor(intent.milkFatPercent) ??
    (known?.mixer && intent.milkFatPercent === undefined && /牛奶|牛乳|^milk\b/i.test(known.mixer.name) ? known.mixer : undefined);
  const powder = product.per100g ?? known?.powder;
  const needs = proteinPhotoQuestion({ ...intent, scoopGrams });
  if (needs) return { question: needs } as const;
  if (scoopGrams === undefined || milkMl === undefined || intent.scoopsPerCup === undefined) {
    return { question: "这杯用了多少克蛋白粉和多少毫升牛奶？" } as const;
  }
  if (milkMl > 0 && !milk) return { question: "牛奶是 2% 还是全脂？我会保留你给的毫升数。" } as const;
  const warehouseProduct: ProteinProduct = {
    id: known?.id ?? recipe.id,
    name,
    scoopGrams,
    scoopEstimated: !verifiedScoop && (intent.scoopGrams !== undefined ? intent.scoopGramsEstimated : known?.scoopEstimated) ? true : undefined,
    cupMl: milkMl || known?.cupMl || 250,
    powder,
    powderEstimated: !product.per100g ? known?.powderEstimated : undefined,
    mixer: milkMl > 0 ? milk : undefined,
  };
  const servings = intent.servings.flatMap(({ date, cups }) => cups === undefined ? [] : [{ date, cups }]);
  if (servings.length > 2) return { question: "一次可记两天。请说这次先记哪两天，例如「只记昨天和今天」。" } as const;
  if ((servings.length || intent.warehouse) && !powder) {
    return { warehouseProduct, servings, estimate: {
      name, powderGrams: scoopGrams * intent.scoopsPerCup, milkMl, milk,
    }, question: "还缺蛋白粉营养表。可以拍背标，或点「采用估算营养」继续保存配方。" } as const;
  }
  const draft = powder ? proteinDrinkDraft(warehouseProduct, intent.scoopsPerCup, milkMl) : undefined;
  return { warehouseProduct, servings, draft } as const;
}

function proteinDrinkDraft(product: ProteinProduct, scoops: number, milkMl: number): MealPhotoDraft | undefined {
  const { powder, mixer } = product;
  if (!powder) return;
  const powderGrams = product.scoopGrams * scoops;
  // The food library values are an approximation for milk by volume.
  const nutrient = (key: "calories" | "protein" | "carbs" | "fat") =>
    quantity((powder[key] * powderGrams + (mixer?.per100ml[key] ?? 0) * milkMl) / 100);
  return { name: product.name, grams: quantity(powderGrams + milkMl), calories: nutrient("calories"),
    protein: nutrient("protein"), carbs: nutrient("carbs"), fat: nutrient("fat") };
}

export function addMilkToPowderEstimate(
  draft: MealPhotoDraft, { name, powderGrams, milkMl, milk }: { name: string; powderGrams: number; milkMl: number; milk?: ProteinProduct["mixer"] },
): MealPhotoDraft | undefined {
  if (draft.grams === undefined || Math.abs(draft.grams - powderGrams) > 1) return;
  const nutrient = (key: "calories" | "protein" | "carbs" | "fat") =>
    quantity(draft[key] + (milk?.per100ml[key] ?? 0) * milkMl / 100);
  return { name, grams: quantity(powderGrams + milkMl), calories: nutrient("calories"),
    protein: nutrient("protein"), carbs: nutrient("carbs"), fat: nutrient("fat") };
}

export function estimatedPowderPer100g(draft: MealPhotoDraft, powderGrams: number): ProteinProduct["powder"] {
  if (draft.grams === undefined || Math.abs(draft.grams - powderGrams) > 1 || powderGrams <= 0 ||
      draft.calories > 10 * powderGrams || draft.protein + draft.carbs + draft.fat > 1.03 * powderGrams ||
      Math.max(draft.protein, draft.carbs, draft.fat) > powderGrams) return;
  const per100g = (value: number) => quantity(value * 100 / powderGrams);
  return { calories: per100g(draft.calories), protein: per100g(draft.protein), carbs: per100g(draft.carbs), fat: per100g(draft.fat) };
}

export function multiplyProteinDrink(draft: MealPhotoDraft, cups: number): MealPhotoDraft {
  return {
    name: draft.name, grams: draft.grams === undefined ? undefined : quantity(draft.grams * cups),
    calories: quantity(draft.calories * cups), protein: quantity(draft.protein * cups),
    carbs: quantity(draft.carbs * cups), fat: quantity(draft.fat * cups),
  };
}
