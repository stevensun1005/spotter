import { catalogFamilies, catalogueTrainingPattern } from "@/features/exercises/catalog-families";
import { parsePlanMove } from "@/features/exercises/move-name";
import { fromCatalogue, searchable, type Catalog, type CatalogEntry } from "@/features/exercises/open-gym";
import type { Move } from "@/features/plans/model";
import { hasExerciseLoadHistory, type LoadHistory } from "./load-progression";
import type { SetLine } from "./model";
import { isWarmupMove } from "./sequence";
import { isPerSideLoad, toKg } from "./volume";

type Basis = "per-hand" | "total";
type Trial = { row: number; equipment: string };

export type InitialLoadSuggestion = Trial & (
  | { kind: "related"; weight: number; rightWeight?: number; basis: Basis; source: string }
  | { kind: "minimum"; weight?: number; rightWeight?: number; basis?: Basis; source?: undefined }
  | { kind: "retry"; weight?: undefined; rightWeight?: undefined; basis?: undefined; source?: undefined }
);

const freeWeights = new Set(["dumbbell", "kettlebell", "barbell", "olympic barbell", "ez barbell", "trap bar", "weight plate"]);
const loadedMachines = new Set(["cable", "leverage machine", "smith machine", "sled machine", "landmine"]);
const assistance = /\b(?:assist(?:ance|ed)?|counterbalanced)\b|助力|辅助/;
const unevenDumbbell = /\b(?:one dumbbell|single dumbbell|goblet|staggered|uneven|offset|two hands|both hands|asymmetric)\b|单只|单个|双手持|高脚杯|错位|不对称/;
const pairedDumbbell = /^dumbbell (?:alternate biceps curl|alternate hammer curl|(?:flat |incline |decline )?bench press|(?:flat |incline |decline )?fly(?:e)?|(?:standing |seated )?shoulder press)(?: v \d+)?$/;
const totalLoad = /总重|合计|总配重|总次数|(?:只做|仅做?)[左右]|\b(?:combined|total) (?:weight|load)\b/i;

function equipmentOf(entry: CatalogEntry | undefined) {
  if (!entry || entry.type !== "strength" || entry.hold || entry.distance || entry.machine === "assisted-pullup" ||
    assistance.test(searchable(entry.en) + " " + entry.name)) return;
  if (freeWeights.has(entry.equipment) || loadedMachines.has(entry.equipment)) return entry.equipment;
}

function combinedLoad(move: Move) {
  const parsed = parsePlanMove(move.name);
  return totalLoad.test(parsed.name + " " + (move.cue ?? parsed.cue ?? ""));
}

function basisFor(move: Move, entry: CatalogEntry, line: SetLine, startsHere = false): Basis | undefined {
  if (line.right) return "per-hand";
  if (combinedLoad(move)) return "total";
  if (isPerSideLoad(move)) return "per-hand";
  if (entry.equipment === "dumbbell" || entry.equipment === "kettlebell") {
    if (startsHere && entry.equipment === "dumbbell" && pairedDumbbell.test(searchable(entry.en))) return "per-hand";
    return;
  }
  return "total";
}

const repsDone = (line: SetLine) => Math.min(line.reps, line.right?.reps ?? line.reps);

export function recommendInitialLoad(move: Move, rows: readonly SetLine[], history: LoadHistory, catalogue: Catalog | undefined, weightStep = 2.5): InitialLoadSuggestion | undefined {
  if (!catalogue || move.seconds || move.reps < 2 || move.weight > 0 || move.loadPercent || move.fixedLoad || isWarmupMove(move)) return;
  const entry = fromCatalogue(catalogue, move);
  const equipment = equipmentOf(entry);
  if (!entry || !equipment) return;
  const pending = rows.findIndex((line) => !line.done && !line.kind);
  if (pending === -1 || rows[pending].weight || rows[pending].right?.weight || rows[pending].seconds) return;
  const slot = { row: pending, equipment };
  const complete = rows.filter((line) => line.done && !line.kind);
  if (complete.length) {
    if (complete.length === 1 && rows.indexOf(complete[0]) < pending && complete[0].weight > 0 && repsDone(complete[0]) < move.reps) {
      return { ...slot, kind: "retry" };
    }
    return;
  }
  if (hasExerciseLoadHistory(move, history)) return;

  const basis = basisFor(move, entry, rows[pending], true);
  const split = basis === "per-hand" && (!isPerSideLoad(move) || Boolean(rows[pending].right));
  const unsafeDumbbell = equipment === "dumbbell" && unevenDumbbell.test(searchable(entry.en) + " " + entry.name);
  const families = catalogFamilies(catalogue.rows);
  const family = families.get(entry.id);
  const pattern = catalogueTrainingPattern(entry)?.id;
  const visits = new Set([...history.values()].flat());
  let candidate: { order: number; kg: number; reps: number; rpe?: number; source: string } | undefined;
  for (const prior of visits) {
    const source = fromCatalogue(catalogue, prior.move);
    if (!source) continue;
    // Catalogue aliases can reveal exact training history even if a saved plan omitted the ID.
    if (source.id === entry.id) return;
    if (unsafeDumbbell || !basis || !family || !freeWeights.has(equipment) || equipmentOf(source) !== equipment ||
      families.get(source.id) !== family || catalogueTrainingPattern(source)?.id !== pattern ||
      (candidate && prior.order >= candidate.order)) continue;
    const line = prior.rows.findLast((value) => value.done && !value.seconds && value.weight > 0 &&
      (value.right?.weight ?? value.weight) > 0 && repsDone(value) >= Math.max(prior.move.reps, 5) &&
      basisFor(prior.move, source, value) === basis);
    if (!line) continue;
    candidate = {
      order: prior.order, kg: toKg(Math.min(line.weight, line.right?.weight ?? line.weight), prior.move.unit),
      reps: repsDone(line), rpe: line.rpe, source: parsePlanMove(prior.move.name).name,
    };
  }

  if (candidate && basis) {
    // A first-use trial stays below the proven work-set load, with further discounts for higher reps or effort.
    const reps = Math.min(24, Math.max(move.reps, move.repsMax ?? 0, rows[pending].reps, rows[pending].right?.reps ?? 0));
    const repFactor = Math.min(1, (30 + candidate.reps) / (30 + reps));
    const effortFactor = (candidate.rpe ?? 0) >= 8.5 ? 0.9 : 1;
    const step = Number.isFinite(weightStep) && weightStep > 0 ? weightStep : 2.5;
    const estimate = candidate.kg / toKg(1, move.unit) * 0.75 * repFactor * effortFactor;
    const weight = Math.min(2000, Math.floor(estimate / step) * step);
    if (weight > 0) return { ...slot, kind: "related", weight, ...(split ? { rightWeight: weight } : {}), basis, source: candidate.source };
  } else if (basis === "per-hand" && equipment === "dumbbell" && !unsafeDumbbell) {
    const weight = move.unit === "kg" ? 2 : 5;
    return { ...slot, kind: "minimum", weight, ...(split ? { rightWeight: weight } : {}), basis };
  }
  return { ...slot, kind: "minimum" };
}
