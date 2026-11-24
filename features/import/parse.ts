import { z } from "zod";
import { tempoFromCue } from "@/features/exercises/tempo";
import { moveBlank, planBlank, planSchema, videoUrl, type Move, type Plan } from "@/features/plans/model";

export const importPrompt = (today: string) => [
  "把我附上的健身计划、训练笔记、YouTube 或 B站链接整理成训练搭子可导入的 JSON。",
  "只返回 JSON 数组，每次训练一个对象，按顺序列出。明确写出每项日期（YYYY-MM-DD）；未指定开始日就从 " + today + " 开始。",
  '对象示例：[{"title":"上肢力量","date":"' + today + '","category":"力量训练","minutes":45,"shared":false,"video":"","exercises":[{"name":"哑铃卧推","sets":3,"reps":10,"weight":0,"unit":"kg","seconds":0,"tempo":"2-0-1-0"}]}]',
  "category 只能是力量训练、有氧训练、拉伸恢复、跟练视频、其他。重量未知填 0，单位只能是 kg 或 lb，计时动作使用 seconds；不要猜测视频里没有依据的动作或时长。只有链接时，保留 video 原链接，把 exercises 留空；若一堂课有多个视频，每个视频拆成一项。shared 默认 false。",
  "tempo 可选，原文注明节奏时保留。四拍用字符串，例如 2-0-1-0。无明确节奏可省略，网站会按动作给出建议。",
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
      tempo: tempoFromCue(match[6]),
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
