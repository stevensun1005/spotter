import type { TrainingEntry } from "@/shared/state";
import { setVolumeKg, toKg } from "@/features/training/volume";
import type { Move } from "@/features/plans/model";
import type { SetLine } from "@/features/training/model";
import { canonicalCatalogueId, parsePlanMove } from "./move-name";

export type MaxFormula = "epley" | "brzycki";

export function estimatedMax(weight: number, reps: number, formula: MaxFormula = "epley") {
  if (weight <= 0 || reps < 1 || reps > 10) return null;
  if (reps === 1) return weight;
  return formula === "brzycki" ? weight * 36 / (37 - reps) : weight * (1 + reps / 30);
}

function setMetrics(line: SetLine, move: Move, formula: MaxFormula) {
  const left = toKg(line.weight, move.unit);
  const right = toKg(line.right?.weight ?? 0, move.unit);
  return {
    volume: setVolumeKg(line, move),
    weight: Math.max(left, right),
    max: Math.max(estimatedMax(left, line.reps, formula) ?? 0, estimatedMax(right, line.right?.reps ?? 0, formula) ?? 0) || null,
  };
}

export function exerciseHistory(name: string, logs: TrainingEntry[], owner: string, catalogueId?: string, formula: MaxFormula = "epley") {
  const canonicalName = parsePlanMove(name).name;
  const canonicalId = catalogueId && canonicalCatalogueId(catalogueId);
  return logs.filter((log) => log.kind === "log" && log.owner === owner).flatMap((log) =>
    log.data.plan.exercises.flatMap((move, index) => {
      const matches = canonicalId && move.catalogueId
        ? canonicalId === canonicalCatalogueId(move.catalogueId)
        : [move.name, move.sourceName].some((candidate) => candidate && parsePlanMove(candidate).name === canonicalName);
      if (!matches) return [];
      const sets = (log.data.rows[index] ?? []).filter((line) => line.done).map((line) => ({ line, ...setMetrics(line, move, formula) }));
      return sets.length ? [{
        id: log.id + ":" + index, title: log.data.plan.title, date: log.data.date, started: log.data.started,
        unit: move.unit, sets, volume: sets.reduce((sum, item) => sum + item.volume, 0),
        weight: Math.max(...sets.map((item) => item.weight)), max: Math.max(...sets.map((item) => item.max ?? 0)),
      }] : [];
    })
  ).sort((a, b) => b.date.localeCompare(a.date) || b.started - a.started);
}
export type ExerciseSession = ReturnType<typeof exerciseHistory>[number];
