import { offsetDate, weekdayIndex } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { sessionTotals } from "@/features/training/model";

const activityDays = 365;
export const activityLevels = [0, 1, 2, 3, 4] as const;
export const activityLevel = (count: number) => Math.min(count, activityLevels[activityLevels.length - 1]);

export function buildActivityCalendar(logs: TrainingEntry[], owner: string, to: string) {
  const from = offsetDate(to, 1 - activityDays);
  const daily = new Map<string, { sessions: number; sets: number }>();
  let total = 0;
  for (const log of logs) {
    if (log.kind !== "log" || log.owner !== owner) continue;
    const { date } = log.data;
    if (date < from || date > to) continue;
    const counts = daily.get(date) ?? { sessions: 0, sets: 0 };
    counts.sessions++;
    counts.sets += sessionTotals(log.data).sets;
    daily.set(date, counts);
    total++;
  }
  const blankDays = (weekdayIndex(from) + 1) % 7;
  const weeks = Math.ceil((activityDays + blankDays) / 7);
  const months: { position: number; id: string; label: string }[] = [];
  const dates = Array.from({ length: activityDays }, (_, index) => {
    const date = offsetDate(from, index);
    if (index === 0 || date.endsWith("-01")) {
      const position = Math.min(weeks - 2, Math.floor((index + blankDays) / 7));
      if (months.length === 1 && months[0].position + 1 >= position) months.pop();
      months.push({ position, id: date.slice(0, 7), label: Number(date.slice(5, 7)) + "月" });
    }
    return { date, ...(daily.get(date) ?? { sessions: 0, sets: 0 }) };
  });
  return { from, to, total, blankDays, weeks, months, dates, daily };
}
