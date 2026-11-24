import { z } from "zod";
import type { Session } from "@/features/training/model";

export const sources = {
  apple: "Apple 健康",
  fit: "FIT（Garmin 等）",
  tcx: "TCX",
  whoop: "WHOOP",
  csv: "CSV",
} as const;
const names = ["apple", "fit", "tcx", "whoop", "csv"] as const;
export type HeartSource = typeof names[number];
const bpm = z.number().int().min(1).max(300);
const timestamp = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
export const sampleSchema = z.object({ at: timestamp, bpm });
export type HeartSample = z.infer<typeof sampleSchema>;
export const heartSchema = z.object({
  source: z.enum(names),
  from: timestamp,
  to: timestamp,
  average: bpm.optional(),
  minimum: bpm.optional(),
  maximum: bpm.optional(),
  sourceName: z.string().trim().min(1).max(160).optional(),
  sourceBundleId: z.string().trim().min(1).max(200).optional(),
  samples: z.array(sampleSchema).max(720),
}).superRefine((value, ctx) => {
  if (value.to < value.from || value.to - value.from > 86_400_000 ||
      (!value.samples.length && value.average === undefined && value.maximum === undefined) ||
      (value.average !== undefined && value.maximum !== undefined && value.average > value.maximum) ||
      (value.minimum !== undefined && value.average !== undefined && value.minimum > value.average) ||
      (value.minimum !== undefined && value.maximum !== undefined && value.minimum > value.maximum) ||
      value.samples.some((sample, i) => sample.at < value.from || sample.at > value.to ||
        (i > 0 && sample.at <= value.samples[i - 1].at))) {
    ctx.addIssue({ code: "custom", message: "心率数据范围无效。" });
  }
});
export type HeartData = z.infer<typeof heartSchema>;
export type TimeWindow = { from: number; to: number };

export function workoutWindow(session: Session): TimeWindow {
  const estimatedEnd = session.started + Math.max(session.minutes, 1) * 60_000;
  return { from: session.started, to: session.ended && session.ended > session.started ? session.ended : estimatedEnd };
}

export function acceptsHeart(window: TimeWindow, heart: HeartData) {
  if (heart.samples.length) return heart.from >= window.from && heart.to <= window.to;
  const overlap = Math.min(window.to, heart.to) - Math.max(window.from, heart.from);
  return overlap > 0 && overlap >= (heart.to - heart.from) * 0.5;
}

export function sampleCollection(window: TimeWindow) {
  const readings = new Map<number, number>();
  function add(at: number, rate: number) {
    const rounded = Math.round(rate);
    if (!Number.isSafeInteger(at) || at < window.from || at > window.to || !Number.isInteger(rounded) || rounded < 1 || rounded > 300) return;
    readings.set(at, rounded);
  }
  function collect(source: HeartSource): HeartData | null {
    const sorted = [...readings].sort(([a], [b]) => a - b);
    if (!sorted.length) return null;
    const toPoint = ([at, bpm]: [number, number]) => ({ at, bpm });
    let sum = 0;
    let maximum = 0;
    let maxIndex = 0;
    sorted.forEach(([, rate], index) => {
      sum += rate;
      if (rate > maximum) { maximum = rate; maxIndex = index; }
    });
    const indices = new Set<number>([maxIndex]);
    const size = Math.min(719, sorted.length);
    for (let i = 0; i < size; i++) indices.add(Math.round(i * (sorted.length - 1) / Math.max(1, size - 1)));
    const samples = [...indices].sort((a, b) => a - b).map((i) => toPoint(sorted[i]));
    return { source, from: sorted[0][0], to: sorted.at(-1)![0], average: Math.round(sum / sorted.length), maximum, samples };
  }
  return { add, collect };
}

export function matchingSummary(window: TimeWindow, records: HeartData[]) {
  const accepted = records.filter((record) => heartSchema.safeParse(record).success && acceptsHeart(window, record));
  return accepted.sort((a, b) => {
    const difference = (item: HeartData) => Math.abs(item.from - window.from) + Math.abs(item.to - window.to);
    return difference(a) - difference(b);
  })[0] ?? null;
}

export function sourceSummary(source: HeartSource, from: number, to: number, average: unknown, maximum: unknown): HeartData {
  const rate = (value: unknown) => {
    const n = typeof value === "number" || (typeof value === "string" && value.trim()) ? Math.round(Number(value)) : undefined;
    return bpm.safeParse(n).success ? n : undefined;
  };
  return { from, to, average: rate(average), maximum: rate(maximum), source, samples: [] };
}
