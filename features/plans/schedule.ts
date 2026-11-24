import { z } from "zod";
import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";

export const scheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(6),
  dates: z.array(dateSchema).max(180),
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const openSchedule: Schedule = { weekdays: [], dates: [] };

export function blocked(schedule: Schedule, day: string) {
  return schedule.dates.includes(day) || schedule.weekdays.includes(weekdayIndex(day));
}

type Dated = { id: string; date: string; title: string };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
export function moveSchedule(source: Dated, target: string, following: Dated[], occupied: string[], schedule: Schedule) {
  if (target < source.date || blocked(schedule, target)) return null;
  const used = new Set(occupied);
  const shifts: { id: string; date: string }[] = [];
  let lastSource = "";
  let lastDay = target;
  for (const plan of [...following].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))) {
    if (plan.date !== lastSource) {
      let candidate = lastSource ? offsetDate(lastDay, daysBetween(plan.date, lastSource)) : target;
      let days = 0;
      while (blocked(schedule, candidate) || used.has(candidate)) {
        if (++days > 365) return null;
        candidate = offsetDate(candidate, 1);
      }
      lastSource = plan.date;
      lastDay = candidate;
      used.add(candidate);
    }
    shifts.push({ id: plan.id, date: lastDay });
  }
  return shifts;
}
