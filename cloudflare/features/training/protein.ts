import { z } from "zod";
import type { Session } from "./model";

export const proteinPreference = z.object({
  kind: z.literal("protein-preference"),
  enabled: z.boolean(),
  defaultProductId: z.string().uuid().optional(),
});

export const maxProteinProducts = 20;
const proteinNutrition = z.object({
  calories: z.number().finite().min(0).max(1000),
  protein: z.number().finite().min(0).max(100),
  carbs: z.number().finite().min(0).max(100),
  fat: z.number().finite().min(0).max(100),
});
export type ProteinNutrition = z.infer<typeof proteinNutrition>;

export const proteinProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  scoopGrams: z.number().finite().min(0.1).max(250),
  cupMl: z.number().finite().min(1).max(2000),
  powder: proteinNutrition.optional(),
  powderEstimated: z.literal(true).optional(),
  scoopEstimated: z.literal(true).optional(),
  mixer: z.object({ name: z.string().trim().min(1).max(60), per100ml: proteinNutrition }).optional(),
});
export type ProteinProduct = z.infer<typeof proteinProductSchema>;

export const proteinWarehouse = z.object({
  kind: z.literal("protein-warehouse"),
  products: z.array(proteinProductSchema).max(maxProteinProducts).refine((items) =>
    new Set(items.map(({ id }) => id)).size === items.length),
});

export function defaultWorkoutProteinProduct(products: readonly ProteinProduct[], defaultProductId?: string): ProteinProduct | undefined {
  const preferred = products.find(({ id }) => id === defaultProductId);
  if (preferred) return preferred.powder ? preferred : undefined;
  const complete = products.filter(({ powder }) => powder);
  return complete.length === 1 ? complete[0] : undefined;
}

export function proteinServingGrams({ scoopGrams, cupMl }: ProteinProduct): number {
  // Approximate the full drink's liquid weight as 1 g/mL.
  return Math.round((scoopGrams + cupMl) * 100) / 100;
}

export function proteinServingNutrition(product: ProteinProduct): ProteinNutrition | undefined {
  const { powder, mixer, scoopGrams, cupMl } = product;
  if (!powder) return;
  const serving = (nutrient: keyof ProteinNutrition) => Math.round(
    powder[nutrient] * scoopGrams + (mixer?.per100ml[nutrient] ?? 0) * cupMl,
  ) / 100;
  return { calories: serving("calories"), protein: serving("protein"), carbs: serving("carbs"), fat: serving("fat") };
}

export function withoutProteinShake(data: Session): Session {
  if (data.proteinShake === undefined && data.proteinProduct === undefined) return data;
  const shared = { ...data };
  delete shared.proteinShake;
  delete shared.proteinProduct;
  return shared;
}
