import type { CatalogEntry } from "@/features/exercises/open-gym";
import { parsePlanMove } from "@/features/exercises/move-name";
import { heartSchema, type HeartData } from "@/features/heart/model";
import { summarize } from "@/features/stats/model";
import { isWarmupMove, trainingBlocks } from "@/features/training/sequence";
import { isPerSideLoad } from "@/features/training/volume";
import type { SetLine } from "@/features/training/model";
import type { TrainingEntry } from "@/shared/state";

type ShareScope = {
  log: TrainingEntry;
  logs: readonly TrainingEntry[];
  owner: string;
  merge: boolean;
};

export function shareEntries({ log, logs, owner, merge }: ShareScope) {
  if (log.kind !== "log" || log.owner !== owner) return [];
  if (!merge) return [log];

  const day = new Map<string, TrainingEntry>();
  for (const entry of logs) {
    if (entry.kind === "log" && entry.owner === owner && entry.data.date === log.data.date) day.set(entry.id, entry);
  }
  day.set(log.id, log);
  return [...day.values()].sort((a, b) => a.data.started - b.data.started || a.id.localeCompare(b.id));
}

const weight = (value: number, unit: "kg" | "lb") => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value) + " " + unit;

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

function setText(line: SetLine, unit: "kg" | "lb", warmup: boolean, perSide: boolean) {
  const label = line.kind === "warmup" && !warmup ? "W · " : line.kind === "drop" ? "递减 · " : "";
  if (line.seconds > 0) return label + clock(line.seconds) + (line.weight > 0 ? " · " + weight(line.weight, unit) : "");
  if (line.right) {
    return label + "左 " + weight(line.weight, unit) + " × " + line.reps +
      " · 右 " + weight(line.right.weight, unit) + " × " + line.right.reps;
  }
  return label + (line.weight > 0 ? weight(line.weight, unit) + " × " : "") + line.reps + (perSide && line.weight > 0 ? " 次／侧" : " 次");
}

export function shareSummary(input: ShareScope & { catalogue?: CatalogEntry[] }) {
  const entries = shareEntries(input);
  if (!entries.length) return null;
  const { total, primary, secondary } = summarize(entries, input.catalogue ?? [], "all");
  const workouts = entries.map(({ id, data }) => {
    const slots = new Map<number, string>();
    for (const block of trainingBlocks(data.plan.exercises)) {
      if (block.label) block.moves.forEach((i, slot) => slots.set(i, block.slots[slot]));
    }
    const moves = data.plan.exercises.flatMap((move, i) => {
      const parsed = parsePlanMove(move.name);
      const warmup = isWarmupMove(move);
      const perSide = isPerSideLoad(move);
      const sets = (data.rows[i] ?? []).filter((line) => line.done).map((line) => setText(line, move.unit, warmup, perSide));
      const slot = warmup ? "W" : slots.get(i) ?? move.sourceSlot ?? parsed.sourceSlot;
      return sets.length ? [{ name: parsed.name, slot, sets }] : [];
    });
    return { id, title: data.plan.title, moves };
  });
  const muscles = Object.fromEntries([
    ...Object.keys(secondary.regions).map((key) => [key, 40] as const),
    ...Object.keys(primary.regions).map((key) => [key, 100] as const),
  ]);

  return {
    date: input.log.data.date,
    title: entries.length > 1 ? "当天训练" : input.log.data.plan.title,
    minutes: total.minutes,
    sets: total.sets,
    volume: total.volume,
    workouts,
    muscles,
    primary: primary.regions,
    secondary: secondary.regions,
  };
}

export type ShareSummary = NonNullable<ReturnType<typeof shareSummary>>;

export function shareHeart(input: ShareScope, byId: Readonly<Record<string, HeartData | null | undefined>>) {
  const visible = shareEntries(input).flatMap((entry) => {
    const parsed = heartSchema.safeParse(byId[entry.id]);
    return parsed.success ? [{ id: entry.id, title: entry.data.plan.title, ...parsed.data }] : [];
  });
  return visible.map(({ id, title, samples, average, maximum, from, to }) => ({
    id, title, average, maximum, duration: to - from,
    minimum: samples.length ? Math.min(...samples.map((sample) => sample.bpm)) : undefined,
    points: samples.map(({ at, bpm }) => ({ time: at - from, bpm })),
  }));
}

export type ShareHeart = ReturnType<typeof shareHeart>[number];

