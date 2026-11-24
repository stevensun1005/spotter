import { hasCompletedWorkout, sessionTotals } from "@/features/training/model";
import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";

const trainingTopic = /训练|锻炼|健身|运动|举铁|打卡|练(?:了|过|几|多久|多少)|\b(?:workouts?|training|exercise|lifting|check.in)\b/iu;
const statistics = /统计|汇总|记录|总结|回顾|练(?:了|过|几|多久|多少)|(?:几|多少)\s*(?:次|组|天)|多久|时长|容量|总组数|\b(?:stats|statistics|summary|totals?|logged|how (?:many|much|long))\b/iu;
const otherIntent = /搭子|朋友|家人|别人|他人|她的|他的|对比|比较|怎么办|怎么练|计划|应该|建议|适合|合适|推荐|导出|下(?:周|个月)|明天|\b(?:friends?|partner|family|someone|their|his|her|compare|versus|should|recommend|plan|export|tomorrow|next (?:week|month))\b/iu;
const formatDate = (from: string, to: string, english: boolean) =>
  from === to ? from : `${from}${english ? " to " : " 至 "}${to}`;

function activityRange(message: string, today: string) {
  const dates = message.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const [fromDate, toDate = fromDate] = dates;
  if (fromDate && toDate) {
    const from = fromDate;
    const to = toDate;
    if (dates.length > 2 || !dateSchema.safeParse(from).success || !dateSchema.safeParse(to).success ||
      from > to || Date.parse(to) - Date.parse(from) >= 366 * 86_400_000) return;
    return { from, to };
  }

  if (/上上(?:周|星期|个?月)|(?:本|这|上)(?:周|星期)[一二三四五六日天]|\b(?:last|this) week(?: on)? (?:mon|tues|wednes|thurs|fri|satur|sun)day\b/iu.test(message)) return;
  const lastWeek = /上(?:周|星期)|\blast week\b/iu.test(message);
  const thisWeek = /(?:本|这)(?:周|星期)|\bthis week\b/iu.test(message);
  const lastMonth = /上个?月|\blast month\b/iu.test(message);
  const thisMonth = /(?:本|这个)月|\bthis month\b/iu.test(message);
  const yesterday = /昨天|昨日|\byesterday\b/iu.test(message);
  const recent = message.match(/(?:最近|过去|近)\s*(\d{1,3}|七|三十)\s*天|\b(?:last|past)\s+(\d{1,3})\s+days\b/iu);
  if ([lastWeek, thisWeek, lastMonth, thisMonth, yesterday, Boolean(recent), /今天|今日|\btoday\b/iu.test(message)].filter(Boolean).length > 1) return;
  if (lastWeek || thisWeek) {
    const from = offsetDate(today, -weekdayIndex(today) - (lastWeek ? 7 : 0));
    return { from, to: lastWeek ? offsetDate(from, 6) : today };
  }
  if (lastMonth || thisMonth) {
    const start = today.slice(0, 7) + "-01";
    const to = lastMonth ? offsetDate(start, -1) : today;
    return { from: to.slice(0, 7) + "-01", to };
  }
  if (recent) {
    const days = recent[1] === "三十" ? 30 : recent[1] === "七" ? 7 : Number(recent[1] ?? recent[2]);
    if (days < 1 || days > 366) return;
    return { from: offsetDate(today, 1 - days), to: today };
  }
  if (yesterday) {
    const day = offsetDate(today, -1);
    return { from: day, to: day };
  }
  // Keep unsupported date phrases out of the local lookup.
  if (/(?:\d{1,2}|[一二三四五六七八九十]+)(?:月|号|日)|(?:前天|去年|今年|过去|最近)|\b(?:year|weeks|months|days ago)\b/iu.test(message)) return;
  return { from: /今天|今日|\btoday\b/iu.test(message) ? today : offsetDate(today, -weekdayIndex(today)), to: today };
}

export type ActivitySummary = {
  reply: string;
  from: string;
  to: string;
  english: boolean;
  totals: { sessions: number; days: number; minutes: number; sets: number; volume: number };
};

export function readActivitySummary(message: string, contextDate: string, records: readonly TrainingEntry[], owner: string): ActivitySummary | undefined {
  const question = message.normalize("NFKC");
  if (!owner || !trainingTopic.test(question) || !statistics.test(question) || otherIntent.test(question) ||
    !dateSchema.safeParse(contextDate).success) return;
  const range = activityRange(question, contextDate);
  if (!range) return;

  const { from, to } = range;
  const days = new Set<string>();
  let sessions = 0;
  let minutes = 0;
  let sets = 0;
  let volume = 0;
  for (const { kind, owner: recordOwner, data } of records) {
    if (kind !== "log" || recordOwner !== owner || data.date < from || data.date > to ||
      data.date > contextDate || !hasCompletedWorkout(data)) continue;
    const totals = sessionTotals(data);
    days.add(data.date);
    sessions++;
    minutes += data.minutes;
    sets += totals.sets;
    volume += totals.volume;
  }

  const english = !/\p{Script=Han}/u.test(question);
  const period = formatDate(from, to, english);
  const load = new Intl.NumberFormat(english ? "en-CA" : "zh-CN", { maximumFractionDigits: 1 }).format(volume);
  const reply = english
    ? sessions ? `Completed training · ${period}\n${sessions} ${sessions === 1 ? "session" : "sessions"} across ${days.size} ${days.size === 1 ? "day" : "days"} · ${minutes} min · ${sets} ${sets === 1 ? "set" : "sets"} · ${load} kg volume`
      : `No completed workouts recorded for ${period}.`
    : sessions ? `${period} 的已完成训练\n${sessions} 次 · ${days.size} 天 · ${minutes} 分钟 · ${sets} 组 · 容量 ${load} kg`
      : `${period} 暂无已完成的训练记录。`;
  return { ...range, reply, english, totals: { sessions, days: days.size, minutes, sets, volume } };
}
