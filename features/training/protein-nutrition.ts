import type { LibraryItem } from "@/features/library/model";
import type { Session } from "./model";
import { proteinServingGrams, proteinServingNutrition, type ProteinProduct } from "./protein";

export function proteinMeal(product: ProteinProduct, date: string, id: string): Extract<LibraryItem, { kind: "nutrition" }> | undefined {
  const nutrients = proteinServingNutrition(product);
  if (!nutrients) return;
  const name = product.powderEstimated || product.scoopEstimated ? product.name.slice(0, 96) + "（估算）" : product.name;
  return { kind: "nutrition", id, date, proteinProductId: product.id, entry: {
    type: "meal", meal: "加餐", name, grams: proteinServingGrams(product), ...nutrients,
  } };
}

// The statement immediately after the workout write sees changes() for that write in the same D1 batch.
export function syncWorkoutProteinMeal(db: D1Database, owner: string, workoutId: string, data: Session, updated: string) {
  const meal = data.proteinShake && data.proteinProduct ? proteinMeal(data.proteinProduct, data.date, workoutId) : undefined;
  const linked = "json_extract(personal_library.payload, '$.sourceWorkoutId') = ?";
  if (!meal) return db.prepare(
    "DELETE FROM personal_library WHERE changes() > 0 AND owner=? AND kind='nutrition' AND id=? AND " + linked,
  ).bind(owner, workoutId, workoutId);
  return db.prepare(
    "INSERT INTO personal_library(owner,kind,id,day,payload,updated) " +
    "SELECT ?,'nutrition',?,?,?,? WHERE changes() > 0 " +
    "ON CONFLICT(owner,kind,id) DO UPDATE SET day=excluded.day,payload=excluded.payload,updated=excluded.updated WHERE " + linked,
  ).bind(owner, meal.id, meal.date, JSON.stringify({ ...meal, sourceWorkoutId: workoutId }), updated, workoutId);
}
