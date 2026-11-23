import type { TrainingEntry } from "@/shared/state";
import type { SetLine } from "@/features/training/model";
import { parsePlanMove } from "./move-name";

const toKg = (weight: number, unit: "kg" | "lb") => unit === "lb" ? weight * 0.45359237 : weight;
export function estimatedMax(weight: number, reps: number) {
  if (weight <= 0 || reps < 1 || reps > 10) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function setMetrics(line: SetLine, unit: "kg" | "lb") {
  const left = toKg(line.weight, unit);
  const right = toKg(line.right?.weight ?? 0, unit);
  return {
    volume: left * line.reps + right * (line.right?.reps ?? 0),
    weight: Math.max(left, right),
    max: Math.max(estimatedMax(left, line.reps) ?? 0, estimatedMax(right, line.right?.reps ?? 0) ?? 0) || null,
  };
}

export function exerciseHistory(name: string, logs: TrainingEntry[], owner: string, catalogueId?: string) {
  return logs.filter((log) => log.kind === "log" && log.owner === owner).flatMap((log) =>
    log.data.plan.exercises.flatMap((move, index) => {
      if (catalogueId && move.catalogueId ? catalogueId !== move.catalogueId : ![parsePlanMove(move.name).name, move.sourceName].includes(parsePlanMove(name).name)) return [];
      const sets = (log.data.rows[index] ?? []).filter((line) => line.done).map((line) => ({ line, ...setMetrics(line, move.unit) }));
      return sets.length ? [{
        id: log.id + ":" + index, title: log.data.plan.title, date: log.data.date, started: log.data.started,
        unit: move.unit, sets, volume: sets.reduce((sum, item) => sum + item.volume, 0),
        weight: Math.max(...sets.map((item) => item.weight)), max: Math.max(...sets.map((item) => item.max ?? 0)),
      }] : [];
    })
  ).sort((a, b) => b.date.localeCompare(a.date) || b.started - a.started);
}
export type ExerciseSession = ReturnType<typeof exerciseHistory>[number];
