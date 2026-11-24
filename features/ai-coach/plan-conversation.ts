import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";
import type { Plan } from "@/features/plans/model";

export type DraftWindow = { date: string; draftDays: number };

export function asksToReviseDraft(message: string) {
  const text = message.normalize("NFKC").trim().toLowerCase();
  if (/^(?:先不|暂时不|不|别|不用|为什么|怎么|如何|怎样|what|why|how)/u.test(text)) return false;
  return /^(?:请|能不能|可以|麻烦|帮我|给我|我想|我希望|想|把|将|这(?:次|个|份|套)(?:训练|计划|动作)?[，, ]?)*\s*(?:把.+?(?:换(?:成|为)|改(?:成|为|到)|替换|去掉|删掉|移到)|(?:换成|改成|改一下|改到|调整|替换|取消|去掉|删掉|去除|加上|新增|增加|减掉|减少|缩短|延长|移到|挪到|简单一点|轻松一点|短一点|再(?:少|多|轻|短|长)一点)|change\b|swap\b|replace\b|remove\b|add\b|adjust\b|make it\b|move\b)/u.test(text);
}

export function draftWindowFor(message: string, today: string, previous?: DraftWindow, priorPlans?: readonly Plan[]): DraftWindow {
  const text = message.normalize("NFKC").toLowerCase();
  const isoDates = (text.match(/(?<!\d)20\d{2}-\d{2}-\d{2}(?!\d)/g) ?? [])
    .filter((date) => dateSchema.safeParse(date).success).sort();
  const relativeDay = /(?:后天|day after tomorrow)/u.test(text) ? 2
    : /(?:明天|tomorrow)/u.test(text) ? 1
    : /(?:今天|今日|今晚|today|tonight)/u.test(text) ? 0 : undefined;
  const nextWeek = /(?:下周|下星期|next week)/u.test(text);
  const mentionedDate = isoDates[0] ?? (relativeDay === undefined
    ? nextWeek ? offsetDate(today, 7 - weekdayIndex(today)) : undefined
    : offsetDate(today, relativeDay));
  const weeks = text.match(/([1-4])\s*(?:周|个星期|weeks?)|([一二两三四])\s*(?:周|个星期)/u);
  const weekCount = weeks?.[1] ? Number(weeks[1]) : ({ 一: 1, 二: 2, 两: 2, 三: 3, 四: 4 } as Record<string, number>)[weeks?.[2] ?? ""] ?? 0;
  const days = text.match(/(?<![\d-])(\d{1,2})\s*(?:天|days?\b)/u)?.[1];
  const span = weekCount ? weekCount * 7 : days ? Math.max(1, Math.min(28, Number(days))) : undefined;
  const date = mentionedDate ?? previous?.date ?? today;
  const singleSession = relativeDay !== undefined || isoDates.length === 1 || /(?:一堂|一次|一节|one session|one workout)/u.test(text);
  const draftDays = span ?? (singleSession ? 1 : nextWeek ? 7 : previous?.draftDays ?? 7);
  const canCarryOldDates = mentionedDate && priorPlans?.length && !/(?:全部|所有|整份|整套|entire|all sessions)/u.test(text);
  const candidates = [date, offsetDate(date, draftDays - 1), ...isoDates, ...(canCarryOldDates ? priorPlans.map((plan) => plan.date) : [])].sort();
  const start = candidates[0];
  const end = candidates[candidates.length - 1];
  if (end > offsetDate(start, 27)) return { date, draftDays };
  const difference = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  return { date: start, draftDays: difference + 1 };
}
