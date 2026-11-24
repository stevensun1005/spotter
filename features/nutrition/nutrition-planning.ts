import { emptyNutrition, type LibraryRow, type NutritionValues } from "@/features/library/model";
import { weekdayIndex } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";

export type MacroRatios = { protein: number; carbs: number; fat: number };

export function macroRatios({ protein, carbs, fat }: NutritionValues): MacroRatios {
  const energy = (protein + carbs) * 4 + fat * 9;
  if (!energy) return { protein: 25, carbs: 45, fat: 30 };
  const proteinShare = Math.floor(protein * 400 / energy);
  const carbShare = Math.floor(carbs * 400 / energy);
  return { protein: proteinShare, carbs: carbShare, fat: 100 - proteinShare - carbShare };
}

export function splitCalories(calories: number, ratios: MacroRatios, water: number): NutritionValues {
  return { calories, protein: Math.round(calories * ratios.protein / 400), carbs: Math.round(calories * ratios.carbs / 400),
    fat: Math.round(calories * ratios.fat / 900), water };
}

export function recordedExerciseEnergy(rows: readonly LibraryRow[], date: string, ownLogs?: readonly TrainingEntry[]) {
  const entry = rows.find((row) => row.kind === "nutrition-energy" && row.id === date);
  if (entry?.kind !== "nutrition-energy") return 0;
  const ids = ownLogs && new Set(ownLogs.filter((log) => log.kind === "log" && log.data.date === date).map(({ id }) => id));
  return entry.workouts.reduce((total, item) => total + (!ids || ids.has(item.id) ? item.calories : 0), 0);
}

export function targetForDate(rows: readonly LibraryRow[], date: string, ownLogs?: readonly TrainingEntry[]): NutritionValues {
  const base = rows.find((row) => row.kind === "targets")?.values ?? emptyNutrition;
  const plan = rows.find((row) => row.kind === "nutrition-plan");
  const stage = plan?.cut?.filter((stage) => stage.date <= date).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  let target = stage ? splitCalories(stage.calories, macroRatios(base), base.water) : { ...base };
  const cycle = plan?.carbCycle;
  if (cycle && target.calories > 0) {
    const carbs = cycle.grams[cycle.days[weekdayIndex(date)]];
    target = { ...target, calories: Math.max(0, target.calories + 4 * (carbs - target.carbs)), carbs };
  }
  if (target.calories > 0) target.calories += recordedExerciseEnergy(rows, date, ownLogs);
  return target;
}
