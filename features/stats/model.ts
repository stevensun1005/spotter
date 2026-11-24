import { offsetDate, weekdayIndex } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { estimatedMax, type MaxFormula } from "@/features/exercises/history";
import { parsePlanMove } from "@/features/exercises/move-name";
import type { CatalogEntry } from "@/features/exercises/open-gym";
import { expandAnatomyWeights } from "@/features/exercises/labels";
import { exerciseMuscles, researchedGuide } from "@/features/exercises/guidance";
import type { Session } from "@/features/training/model";
import { isWarmupMove } from "@/features/training/sequence";
import { setVolumeKg, toKg } from "@/features/training/volume";

export type Period = "week" | "month" | "quarter" | "year" | "recent" | "custom";
export type Range = { from: string; to: string };
export type Metric = keyof typeof metrics;
export type TrainingMode = "all" | "weighted" | "bodyweight";

export const metrics = {
  volume: { label: "训练容量", unit: "kg" },
  sessions: { label: "训练次数", unit: "次" },
  minutes: { label: "训练时长", unit: "分钟" },
  sets: { label: "完成组数", unit: "组" },
} as const;
const dayMs = 86_400_000;
export const rangeDays = (range: Range) => Math.round((Date.parse(range.to) - Date.parse(range.from)) / dayMs) + 1;
const stamp = (year: number, month: number, day = 1) => {
  const value = new Date(Date.UTC(2000, 0, 1));
  value.setUTCFullYear(year, month, day);
  return value.toISOString().slice(0, 10);
};

export function periodRange(period: Period, today: string, steps: number, days: number, custom: Range): Range {
  if (period === "custom") return custom;
  if (period === "recent") return { from: offsetDate(today, 1 - days + steps * days), to: offsetDate(today, steps * days) };
  if (period === "week") {
    const from = offsetDate(today, -weekdayIndex(today) + steps * 7);
    return { from, to: offsetDate(from, 6) };
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const width = period === "year" ? 12 : period === "quarter" ? 3 : 1;
  const start = Math.floor(month / width) * width + steps * width;
  return { from: stamp(year, start), to: stamp(year, start + width, 0) };
}

export function previousRange(period: Period, range: Range, today: string, steps: number, days: number): Range {
  if (period !== "custom") return periodRange(period, today, steps - 1, days, range);
  return { from: offsetDate(range.from, -rangeDays(range)), to: offsetDate(range.from, -1) };
}

export function periodLabel(period: Period, range: Range) {
  const year = Number(range.from.slice(0, 4));
  const month = Number(range.from.slice(5, 7));
  if (period === "year") return year + " 年";
  if (period === "quarter") return year + " 年第 " + Math.ceil(month / 3) + " 季度";
  if (period === "month") return year + " 年 " + month + " 月";
  return range.from.slice(5) + " 至 " + range.to.slice(5);
}

const blank = () => ({ sessions: 0, sets: 0, minutes: 0, volume: 0 });
const cleanName = (text: string) => parsePlanMove(text).name.normalize("NFKC").toLowerCase();
type Best = { value: number; weight: number; reps: number; date: string };
export type ExerciseResult = { name: string; catalogueId?: string; weight?: Best; max?: Best; sets: number };
type MuscleCounts = { regions: Record<string, number>; buckets: Record<string, number> };
type MuscleWork = { loaded: number; unloaded: number; direct: boolean };
export const muscleGroups = [
  { id: "chest", name: "胸部", muscles: ["chest", "upper-chest", "lower-chest", "serratus"] },
  { id: "back", name: "背部", muscles: ["lats", "upper-back", "lower-back", "rhomboids", "trapezius", "upper-trapezius", "lower-trapezius"] },
  { id: "legs", name: "臀腿", muscles: ["gluteal", "quadriceps", "inner-quad", "outer-quad", "hamstring", "adductors", "hip-flexors", "abductors"] },
  { id: "shoulders", name: "肩部", muscles: ["front-delts", "side-delts", "rear-delts", "rotator-cuff"] },
  { id: "arms", name: "手臂", muscles: ["biceps", "triceps", "forearm"] },
  { id: "core", name: "核心", muscles: ["abs", "upper-abs", "lower-abs", "obliques"] },
  { id: "calves", name: "小腿", muscles: ["calves", "tibialis"] },
] as const;

const muscleBucket = new Map<string, string>(muscleGroups.flatMap((group) => group.muscles.map((name) => [name, group.id])));
const pick = (previous: Best | undefined, candidate: Best) =>
  !previous || candidate.value > previous.value || candidate.value === previous.value && candidate.date > previous.date ? candidate : previous;

export function summarize(records: TrainingEntry[], catalogue: CatalogEntry[], mode: TrainingMode, formula?: MaxFormula) {
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const byName = new Map<string, CatalogEntry | null>();
  catalogue.forEach((item) => {
    for (const name of new Set([cleanName(item.name), cleanName(item.en)])) byName.set(name, byName.has(name) ? null : item);
  });
  const total = blank();
  const daily = new Map<string, ReturnType<typeof blank>>();
  const exercises = new Map<string, ExerciseResult>();
  const unlabelled = new Set<string>();
  const primary: MuscleCounts = { regions: {}, buckets: {} };
  const secondary: MuscleCounts = { regions: {}, buckets: {} };
  const muscleWork = new Map<string, MuscleWork>();
  const addMuscles = (counts: MuscleCounts, keys: string[], count: number) => {
    keys.forEach((key) => { counts.regions[key] = (counts.regions[key] ?? 0) + count; });
    const buckets = new Set(keys.map((muscle) => muscleBucket.get(muscle)).filter(Boolean) as string[]);
    buckets.forEach((key) => { counts.buckets[key] = (counts.buckets[key] ?? 0) + count; });
  };
  for (const record of records) {
    if (record.kind !== "log") continue;
    const { data } = record;
    const score = blank();
    data.plan.exercises.forEach((move, index) => {
      const name = parsePlanMove(move.name).name;
      const catalog = (move.catalogueId ? byId.get(move.catalogueId) : undefined) ?? byName.get(cleanName(name));
      const id = catalog?.id ?? move.catalogueId ?? cleanName(name);
      const weighted = (line: Session["rows"][number][number]) => line.weight > 0 || (line.right?.weight ?? 0) > 0;
      const rows = (data.rows[index] ?? []).filter((line) => line.done && (mode === "all" ||
        (mode === "weighted" ? weighted(line) : !weighted(line) && (catalog
          ? catalog.equipment === "body weight" && ["strength", "calisthenics", "isometric", "plyometrics"].includes(catalog.type)
          : data.plan.category === "力量训练" && line.reps > 0))));
      if (!rows.length) return;
      score.sets += rows.length;
      for (const line of rows) score.volume += setVolumeKg(line, move);
      const work = isWarmupMove(move) ? [] : rows.filter((line) => line.kind !== "warmup");
      if (!work.length) return;
      const referenceName = move.sourceName && researchedGuide(move.sourceName) ? move.sourceName : name;
      const weights = exerciseMuscles(referenceName, catalog ?? undefined);
      const tags = Object.entries(weights).filter(([key, value]) => value > 0 && key !== "cardiovascular system");
      if (tags.length) {
        addMuscles(primary, tags.filter(([, value]) => value >= 75).map(([key]) => key), work.length);
        addMuscles(secondary, tags.filter(([, value]) => value < 75).map(([key]) => key), work.length);
        let loaded = 0;
        let unloaded = 0;
        for (const line of work) {
          const load = setVolumeKg(line, move);
          loaded += load;
          if (!load && (line.reps || line.seconds || line.right?.reps)) unloaded++;
        }
        if (loaded || unloaded) {
          for (const [muscle, weight] of Object.entries(expandAnatomyWeights(weights))) {
            if (weight <= 0 || muscle === "cardiovascular system") continue;
            const current = muscleWork.get(muscle) ?? { loaded: 0, unloaded: 0, direct: false };
            current.loaded += loaded * weight / 100;
            current.unloaded += unloaded * weight / 100;
            current.direct ||= weight >= 75;
            muscleWork.set(muscle, current);
          }
        }
      } else if (!Object.keys(weights).length && !researchedGuide(referenceName)) {
        unlabelled.add(id);
      }
      const performance = exercises.get(id) ?? { name: catalog?.name ?? name, catalogueId: catalog?.id ?? move.catalogueId, sets: 0 };
      performance.sets += work.length;
      work.forEach((line) => {
        for (const side of [line, line.right]) {
          if (!side || side.weight <= 0 || side.reps <= 0) continue;
          const weight = toKg(side.weight, move.unit);
          const result = { weight, reps: side.reps, date: data.date };
          performance.weight = pick(performance.weight, { ...result, value: weight });
          const max = estimatedMax(weight, side.reps, formula);
          if (max !== null) performance.max = pick(performance.max, { ...result, value: max });
        }
      });
      exercises.set(id, performance);
    });
    if (!score.sets && mode !== "all") continue;
    score.sessions = 1;
    score.minutes = data.minutes;
    const day = daily.get(data.date) ?? blank();
    for (const key of Object.keys(metrics) as Metric[]) {
      total[key] += score[key];
      day[key] += score[key];
    }
    daily.set(data.date, day);
  }
  return { total, daily, exercises, primary, secondary, muscleWork, unlabelled: unlabelled.size };
}
export type StatsSummary = ReturnType<typeof summarize>;

export function cumulative(summary: StatsSummary, range: Range, metric: Metric, points: number) {
  const events = [...summary.daily.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lastDay = rangeDays(range) - 1;
  let index = 0;
  let value = 0;
  return Array.from({ length: points }, (_, i) => {
    const date = offsetDate(range.from, Math.floor(lastDay * i / (points - 1)));
    while (events[index] && events[index][0] <= date) value += events[index++][1][metric];
    return value;
  });
}
