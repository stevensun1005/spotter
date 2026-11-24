import { z } from "zod";
import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";

export const scheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(6),
  dates: z.array(dateSchema).max(180),
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const openSchedule: Schedule = { weekdays: [], dates: [] };
export const planRevisionSchema = z.string().min(1).max(64);

export const moveChoiceSchema = z.object({
  id: z.string().uuid(),
  from: dateSchema,
  revision: planRevisionSchema,
  date: dateSchema,
  shift: z.boolean(),
  nextAvailable: z.boolean().optional(),
});
export type MoveChoice = z.infer<typeof moveChoiceSchema>;
export type MovePreview = {
  token: string;
  changes: { id: string; title: string; from: string; date: string }[];
};

export function nextRevision(base: string, previous: (string | null | undefined)[]) {
  const previousTime = Math.max(0, ...previous.map((stamp) => stamp && Date.parse(stamp) || 0));
  return Date.parse(base) <= previousTime ? new Date(previousTime + 1).toISOString() : base;
}

export function blocked(schedule: Schedule, day: string) {
  return schedule.dates.includes(day) || schedule.weekdays.includes(weekdayIndex(day));
}

type Dated = { id: string; date: string; title: string };
export function nextOpenDate(start: string, schedule: Schedule, occupied: ReadonlySet<string>) {
  let candidate = start;
  for (let days = 0; days <= 365; days++) {
    if (!blocked(schedule, candidate) && !occupied.has(candidate)) return candidate;
    candidate = offsetDate(candidate, 1);
  }
  return null;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
export function moveSchedule(source: Dated, target: string, following: Dated[], occupied: string[], schedule: Schedule) {
  if (target < source.date || blocked(schedule, target)) return null;
  const used = new Set(occupied);
  const shifts: { id: string; date: string }[] = [];
  let lastSource = "";
  let lastDay = target;
  for (const plan of [...following].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))) {
    if (plan.date !== lastSource) {
      const candidate = nextOpenDate(lastSource ? offsetDate(lastDay, daysBetween(plan.date, lastSource)) : target, schedule, used);
      if (!candidate) return null;
      lastSource = plan.date;
      lastDay = candidate;
      used.add(candidate);
    }
    shifts.push({ id: plan.id, date: lastDay });
  }
  return shifts;
}
