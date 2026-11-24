import { canonicalCatalogueId, parsePlanMove } from "@/features/exercises/move-name";
import type { Move } from "@/features/plans/model";
import type { TrainingEntry } from "@/shared/state";
import type { SetLine } from "./model";
import { isWarmupMove } from "./sequence";
import { isPerSideLoad, toKg } from "./volume";

type Load = { weight: number; rightWeight?: number };
export type LoadSuggestion = Load & { reason: "history" | "current" | "increase" | "backoff" };
type HistoryRow = { move: Move; rows: SetLine[]; order: number };
export type LoadHistory = ReadonlyMap<string, readonly HistoryRow[]>;

function catalogueKey(move: Move) {
  return move.catalogueId ? "id:" + canonicalCatalogueId(move.catalogueId) : undefined;
}

function nameKey(move: Move) {
  return "name:" + parsePlanMove(move.name).name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildLoadHistory(logs: readonly TrainingEntry[], owner: string): LoadHistory {
  const history = new Map<string, HistoryRow[]>();
  const ordered = logs.filter((entry) => entry.owner === owner && entry.kind === "log" && entry.data.plan.category === "力量训练")
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.data.started - a.data.started || b.updated.localeCompare(a.updated));
  let order = 0;
  for (const { data } of ordered) {
    data.plan.exercises.forEach((move, index) => {
      if (move.seconds || move.reps < 2 || isWarmupMove(move)) return;
      // Keep the working-set positions, including missed rows, so round N can match round N.
      const rows = (data.rows[index] ?? []).filter((line) => !line.kind);
      if (!rows.some((line) => line.done)) return;
      const row = { move, rows, order: order++ };
      for (const key of [catalogueKey(move), nameKey(move)]) {
        if (!key) continue;
        const entries = history.get(key);
        if (entries) entries.push(row);
        else history.set(key, [row]);
      }
    });
  }
  return history;
}

function matchingHistory(move: Move, history: LoadHistory) {
  const id = catalogueKey(move);
  const named = history.get(nameKey(move)) ?? [];
  const conflictingIds = new Set(named.flatMap((item) => catalogueKey(item.move) ?? []));
  const legacy = named.filter((item) => !item.move.catalogueId);
  if (!id) return conflictingIds.size > 1 ? legacy : named;
  const byId = history.get(id) ?? [];
  return [...conflictingIds].some((other) => other !== id) ? byId : [...byId, ...legacy].sort((a, b) => a.order - b.order);
}

const roundWeight = (weight: number) => Math.round(weight * 100) / 100;
const effectiveRight = ({ weight, rightWeight }: Load) => rightWeight ?? weight;
const repsDone = (line: SetLine) => Math.min(line.reps, line.right?.reps ?? line.reps);
const workable = (line: SetLine, minimum: number) =>
  line.done && line.weight > 0 && (line.right?.weight ?? line.weight) > 0 && repsDone(line) >= Math.max(2, minimum);

function recordedLoad(line: SetLine, from: Move["unit"], to = from): Load {
  const convert = (weight: number) => from === to ? weight : roundWeight(toKg(weight, from) / toKg(1, to));
  return { weight: convert(line.weight), ...(line.right && { rightWeight: convert(line.right.weight) }) };
}

function validLoad(load: Load) {
  return Math.min(load.weight, effectiveRight(load)) > 0 && Math.max(load.weight, effectiveRight(load)) <= 2000;
}

function atLeastLoad(a: Load, b: Load) {
  return a.weight >= b.weight && effectiveRight(a) >= effectiveRight(b);
}

function heavierLoad(a: Load, b: Load) {
  return atLeastLoad(a, b) && (a.weight > b.weight || effectiveRight(a) > effectiveRight(b));
}

function maintainedLoad(a: Load, b: Load) {
  return a.weight === b.weight && effectiveRight(a) === effectiveRight(b);
}

function historyProfile(move: Move, history: LoadHistory) {
  for (const previous of matchingHistory(move, history)) {
    const sameLoadBasis = isPerSideLoad(previous.move) === isPerSideLoad(move);
    const loads = previous.rows.map((line) => {
      if (!workable(line, Math.max(move.reps, previous.move.reps))) return null;
      if (!line.right && !sameLoadBasis) return null;
      const value = recordedLoad(line, previous.move.unit, move.unit);
      return validLoad(value) ? value : null;
    });
    const solid = loads.filter((load): load is Load => Boolean(load));
    const latest = solid.at(-1);
    if (!latest) continue;
    // A successful heavier finish becomes the next baseline. Preserve descending set profiles
    // when the lifter recorded back-off sets, and use the latest proven load for extra sets.
    const raised = solid.some((load) => heavierLoad(latest, load)) && solid.every((load) => atLeastLoad(latest, load));
    return { loads, latest, raised };
  }
}

function tryIncrease(load: Load, weightStep: number): Load | null {
  const smallest = Math.min(load.weight, effectiveRight(load));
  if (!(weightStep > 0) || weightStep > smallest * 0.1) return null;
  const next = {
    weight: roundWeight(load.weight + weightStep),
    ...(load.rightWeight !== undefined && { rightWeight: roundWeight(load.rightWeight + weightStep) }),
  };
  return validLoad(next) && heavierLoad(next, load) ? next : null;
}

function failedAt(line: SetLine, attempt: Load, candidate: Load, baseline: Load, minimum: number) {
  return repsDone(line) < minimum && (
    (attempt.weight > baseline.weight && candidate.weight >= attempt.weight) ||
    (effectiveRight(attempt) > effectiveRight(baseline) && effectiveRight(candidate) >= effectiveRight(attempt))
  );
}

function recentlyFailed(move: Move, history: LoadHistory, candidate: Load, baseline: Load) {
  for (const prior of matchingHistory(move, history)) {
    const sameLoadBasis = isPerSideLoad(prior.move) === isPerSideLoad(move);
    const attempts = prior.rows.filter((line) => line.done && (sameLoadBasis || line.right));
    if (!attempts.length) continue;
    if (attempts.some((line) => failedAt(line, recordedLoad(line, prior.move.unit, move.unit), candidate, baseline, prior.move.reps))) return true;
    // A newer completed workout at the working load clears the previous failed attempt.
    if (attempts.some((line) => workable(line, Math.max(move.reps, prior.move.reps)) &&
      atLeastLoad(recordedLoad(line, prior.move.unit, move.unit), baseline))) return false;
  }
  return false;
}

/** Weight hints for untouched work sets. The caller decides whether to seed or offer each hint. */
export function recommendLoads(move: Move, rows: readonly SetLine[], history: LoadHistory, weightStep = 2.5): (LoadSuggestion | null)[] {
  const output: (LoadSuggestion | null)[] = rows.map(() => null);
  if (move.seconds || move.reps < 2 || move.loadPercent || move.fixedLoad || isWarmupMove(move)) return output;
  const work = rows.flatMap((line, index) => line.kind ? [] : [{ line, index }]);
  const nextRound = work.findIndex(({ line }) => !line.done);
  if (nextRound < 0) return output;

  if (work.every(({ line }) => !line.done)) {
    const profile = historyProfile(move, history);
    if (profile) work.forEach(({ index }, round) => {
      const load = profile.raised ? profile.latest : profile.loads[round] ?? profile.latest;
      output[index] = { ...load, reason: "history" };
    });
    return output;
  }

  const next = work[nextRound];
  const previous = work.slice(0, nextRound).map(({ line }) => line);
  const last = previous.at(-1);
  if (!last) return output;
  const lastLoad = recordedLoad(last, move.unit);
  const scheduled = recordedLoad(next.line, move.unit);

  // A short overload is an attempt, not a new working weight. Never raise either side to back off.
  if (!workable(last, move.reps)) {
    const previousGood = previous.slice(0, -1).findLast((line) => workable(line, move.reps));
    const fallback = previousGood ? recordedLoad(previousGood, move.unit) :
      historyProfile(move, history)?.latest ?? { weight: move.weight };
    if (validLoad(fallback) && failedAt(last, lastLoad, lastLoad, fallback, move.reps)) {
      const split = lastLoad.rightWeight !== undefined || fallback.rightWeight !== undefined;
      const reduced = {
        weight: Math.min(fallback.weight, lastLoad.weight),
        ...(split && { rightWeight: Math.min(effectiveRight(fallback), effectiveRight(lastLoad)) }),
      };
      if (validLoad(reduced)) output[next.index] = { ...reduced, reason: "backoff" };
    }
    return output;
  }

  const leading = previous.slice(-3);
  const maxReps = move.repsMax ?? move.reps;
  const effortCap = Math.min(move.targetRpe ?? 8, 8);
  // Without effort data, all three sets must reach the top of the actual prescription.
  // A shorter set can qualify only if the lifter logged at least three reps in reserve.
  const ready = leading.length === 3 && leading.every((line) => workable(line, move.reps) &&
    maintainedLoad(recordedLoad(line, move.unit), lastLoad) && (line.rpe ?? effortCap) <= effortCap &&
    (repsDone(line) >= maxReps || (line.rpe !== undefined && line.rpe <= 7)));
  const increase = ready ? tryIncrease(lastLoad, weightStep) : null;
  if (increase && atLeastLoad(increase, scheduled) &&
    !previous.some((line) => failedAt(line, recordedLoad(line, move.unit), increase, lastLoad, move.reps)) &&
    !recentlyFailed(move, history, increase, lastLoad)) {
    output[next.index] = { ...increase, reason: "increase" };
  } else if (heavierLoad(lastLoad, scheduled)) {
    output[next.index] = { ...lastLoad, reason: "current" };
  }
  return output;
}

export function applyLoadSuggestion(line: SetLine, suggestion: LoadSuggestion): SetLine {
  if (line.done || line.kind) return line;
  const right = suggestion.rightWeight !== undefined || line.right;
  return {
    ...line,
    weight: suggestion.weight,
    ...(right && { right: { weight: effectiveRight(suggestion), reps: line.right?.reps ?? line.reps } }),
  };
}
