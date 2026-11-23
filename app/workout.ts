import { z } from "zod";

export const categories = ["力量训练", "有氧训练", "拉伸恢复", "跟练视频", "其他"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().date();
const move = z.object({
  name: text(100),
  sets: z.number().int().min(1).max(30),
  reps: z.number().int().min(0).max(999),
  weight: z.number().min(0).max(2000),
  unit: z.enum(["kg", "lb"]),
  seconds: z.number().int().min(0).max(18000),
});
export const videoUrl = z.string().max(1200).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      /^(?:(?:www\.|m\.)?(?:youtube\.com|bilibili\.com)|youtu\.be|b23\.tv)$/.test(url.hostname);
  } catch {
    return false;
  }
});
export const planSchema = z.object({
  title: text(100),
  date,
  category: z.enum(categories),
  minutes: z.number().int().min(0).max(720),
  shared: z.boolean(),
  video: videoUrl,
  exercises: z.array(move).max(30),
}).refine((value) => value.exercises.length > 0 || value.video.length > 0, "请至少添加一个动作或视频。");

const sets = z.object({
  reps: z.number().int().min(0).max(999),
  weight: z.number().min(0).max(2000),
  seconds: z.number().int().min(0).max(18000),
  done: z.boolean(),
});
export const sessionSchema = z.object({
  plan: planSchema,
  planId: z.string().max(60),
  date,
  started: z.number().int().positive(),
  minutes: z.number().int().min(0).max(720),
  note: z.string().max(1500),
  finishedVideo: z.boolean(),
  rows: z.array(z.array(sets).min(1).max(30)).max(30),
}).refine((value) =>
  value.rows.length === value.plan.exercises.length &&
    value.rows.every((row, i) => row.length === value.plan.exercises[i].sets));

export type Move = z.infer<typeof move>;
export type Plan = z.infer<typeof planSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SetLine = z.infer<typeof sets>;
export type Entry =
  | { id: string; owner: string; updated: string; kind: "plan"; data: Plan }
  | { id: string; owner: string; updated: string; kind: "draft" | "log"; data: Session }
  | { id: string; owner: string; updated: string; kind: "cheer"; data: { date: string } };
export type State = {
  me: { id: string; name: string };
  room: null | { invite: string | null; partner: { id: string; name: string } | null };
  entries: Entry[];
};

export const moveBlank = (): Move => ({ name: "", sets: 3, reps: 10, weight: 0, unit: "kg", seconds: 0 });
export const planBlank = (date: string): Plan => ({
  title: "", date, category: "力量训练", minutes: 0, shared: false, video: "", exercises: [moveBlank()],
});
export const examples = (date: string): Plan => ({
  ...planBlank(date),
  title: "上肢力量训练",
  minutes: 45,
  exercises: [
    { ...moveBlank(), name: "哑铃卧推", weight: 12, reps: 10 },
    { ...moveBlank(), name: "坐姿划船", weight: 25, reps: 12 },
    { ...moveBlank(), name: "哑铃肩推", weight: 8, reps: 10 },
    { ...moveBlank(), name: "哑铃弯举", weight: 6, reps: 12 },
  ],
});

export function asDate(value: number | Date = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function offsetDate(date: string, offset: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function startSession(plan: Plan, planId: string): Session {
  return {
    plan, planId, date: asDate(), started: Date.now(), minutes: 0, note: "",
    finishedVideo: false,
    rows: plan.exercises.map((item) => Array.from({ length: item.sets }, () => ({
      weight: item.weight, reps: item.reps, seconds: item.seconds, done: false,
    }))),
  };
}

export function sessionTotals(session: Session) {
  let sets = 0;
  let volume = 0;
  session.rows.forEach((row, i) => row.forEach((line) => {
    if (!line.done) return;
    sets++;
    volume += line.reps * line.weight * (session.plan.exercises[i].unit === "lb" ? 0.45359237 : 1);
  }));
  return { sets, volume };
}

export const importPrompt = (today: string) => [
  "把我附上的健身计划、训练笔记、YouTube 或 B站链接整理成训练搭子可导入的 JSON。",
  "只返回 JSON 数组，每次训练一个对象，按顺序列出。明确写出每项日期（YYYY-MM-DD）；未指定开始日就从 " + today + " 开始。",
  '对象示例：[{"title":"上肢力量","date":"' + today + '","category":"力量训练","minutes":45,"shared":false,"video":"","exercises":[{"name":"哑铃卧推","sets":3,"reps":10,"weight":0,"unit":"kg","seconds":0}]}]',
  "category 只能是力量训练、有氧训练、拉伸恢复、跟练视频、其他。重量未知填 0，单位只能是 kg 或 lb，计时动作使用 seconds；不要猜测视频里没有依据的动作或时长。只有链接时，保留 video 原链接，把 exercises 留空；若一堂课有多个视频，每个视频拆成一项。shared 默认 false。",
  "训练原文：",
].join("\n");

export function parseImport(input: string, today: string): Plan[] {
  const raw = input.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  if (!raw) throw new Error("请先粘贴训练内容或视频链接。");
  if (/^[\[{]/.test(raw)) {
    try {
      const decoded = JSON.parse(raw);
      const plans = z.array(planSchema).min(1).max(20).parse(Array.isArray(decoded) ? decoded : [decoded]);
      return plans;
    } catch {
      throw new Error("JSON 格式有误。可复制导入提示词，重新生成与示例一致的内容。");
    }
  }
  const links = [...new Set((raw.match(/https:\/\/[^\s<>"，。；）]+/g) ?? []).map((link) => link.replace(/[\])!?，。；,;]+$/, "")).filter((link) => videoUrl.safeParse(link).success))];
  const lines = raw.split("\n").map((line) => line.trim().replace(/^[\s#*>•-]+|^\d+[.)、]\s*/g, "")).filter(Boolean);
  const exercises: Move[] = [];
  for (const line of lines) {
    const clean = line.replace(/\*\*/g, "").replace(/^\||\|$/g, "").trim();
    const match = clean.match(/^(.+?)\s*(?:[：:|]\s*|\s+)(\d{1,2})\s*(?:组\s*(?:[×xX*]|每组)?\s*|[×xX*]\s*)(\d{1,3})(?:\s*[-–~～至]\s*(\d{1,3}))?\s*(秒|次)?(.*)$/);
    if (!match) continue;
    const weight = match[6].match(/(\d+(?:\.\d+)?)\s*(kg|lbs?|公斤|磅)/i);
    exercises.push({
      ...moveBlank(), name: match[1].replace(/[|：:\s]+$/, ""), sets: Number(match[2]),
      reps: match[5] === "秒" ? 0 : Number(match[3]),
      seconds: match[5] === "秒" ? Number(match[3]) : 0,
      weight: weight ? Number(weight[1]) : 0,
      unit: weight && /^(lb|磅)/i.test(weight[2]) ? "lb" : "kg",
    });
  }
  const heading = lines.find((line) => !line.includes("https://") && !line.includes("|") && !exercises.some((item) => line.includes(item.name)));
  const title = heading?.slice(0, 100);
  const minutes = Math.min(720, Number(raw.match(/(\d{1,3})\s*(?:分钟|min\b)/i)?.[1] ?? 0));
  const plans: Plan[] = [];
  if (exercises.length) {
    plans.push({ ...planBlank(today), title: title || "导入的力量训练", minutes, exercises, video: links.shift() ?? "" });
  }
  for (const link of links) {
    const platform = /bilibili\.com|b23\.tv/.test(new URL(link).hostname) ? "B站" : "YouTube";
    plans.push({ ...planBlank(today), title: title || platform + " 跟练", category: "跟练视频", video: link, minutes, exercises: [] });
  }
  const validated = z.array(planSchema).min(1).max(20).safeParse(plans);
  if (!validated.success) throw new Error("未能整理这段内容。可以粘贴视频链接、使用「动作名 3×10」格式，或导入 AI 生成的 JSON。");
  return validated.data;
}
