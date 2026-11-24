import type { ProteinPhotoProduct } from "@/features/nutrition/food-photo-model";
import type { ProteinNutrition, ProteinProduct } from "@/features/training/protein";

export type NutritionFields = Record<keyof ProteinNutrition, string>;
export type ProteinEditor = {
  id: string; editing: boolean;
  name: string; scoopGrams: string; cupMl: string;
  powder?: NutritionFields;
  powderEstimated?: true;
  scoopEstimated?: true;
  mixer?: { name: string; per100ml: NutritionFields };
};

export function nutritionFields(nutrition: ProteinNutrition): NutritionFields {
  const { calories, protein, carbs, fat } = nutrition;
  return { calories: String(calories), protein: String(protein), carbs: String(carbs), fat: String(fat) };
}

export function editProteinProduct(product: ProteinProduct): ProteinEditor {
  return {
    id: product.id, editing: true, name: product.name, scoopGrams: String(product.scoopGrams), cupMl: String(product.cupMl),
    powder: product.powder && nutritionFields(product.powder), powderEstimated: product.powderEstimated,
    scoopEstimated: product.scoopEstimated,
    mixer: product.mixer && { name: product.mixer.name, per100ml: nutritionFields(product.mixer.per100ml) },
  };
}

const nameKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function findProteinProduct(products: readonly ProteinProduct[], name: string) {
  const key = nameKey(name);
  return key ? products.find((product) => nameKey(product.name) === key) : undefined;
}

export function mergeProteinPhotoIntoEditor(
  editor: ProteinEditor, photo: ProteinPhotoProduct, products: readonly ProteinProduct[],
): ProteinEditor {
  const existing = !editor.editing && photo.name ? findProteinProduct(products, photo.name) : undefined;
  const base = existing ? editProteinProduct(existing) : editor;
  return {
    ...base,
    name: base.editing ? base.name : photo.name ?? base.name,
    scoopGrams: photo.scoopGrams === undefined ? base.scoopGrams : String(photo.scoopGrams),
    scoopEstimated: photo.scoopGrams === undefined ? base.scoopEstimated : undefined,
    powder: photo.per100g ? nutritionFields(photo.per100g) : base.powder,
    powderEstimated: photo.per100g ? undefined : base.powderEstimated,
  };
}
