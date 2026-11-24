import { z } from "zod";
import { tempoFromCue } from "@/features/exercises/tempo";
import { moveBlank, planBlank, planSchema, videoUrl, type Move, type Plan } from "@/features/plans/model";
import { planAiPrompt } from "./ai-instructions";

export const importPrompt = (today: string) => planAiPrompt(today, "organize");
const plainInput = (input: string) => input.trim().replace(/^\uFEFF/, "").replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
export type PlanImportFormat = "program" | "backup" | "plans";
function decodedFormat(value: unknown): PlanImportFormat {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "plans";
  const object = value as Record<string, unknown>;
  if (object.format === "spotter-backup") return "backup";
  if (object.format === "spotter-program") return "program";
  const program = object.program && typeof object.program === "object" ? object.program as Record<string, unknown> : object;
  return Array.isArray(program.sessions) && typeof program.startDate === "string" && typeof program.weeks === "number" ? "program" : "plans";
}
export function detectImportFormat(input: string): PlanImportFormat {
  try { return decodedFormat(JSON.parse(plainInput(input))); } catch { return "plans"; }
}

export function parseImport(input: string, today: string): Plan[] {
  const raw = plainInput(input);
  if (!raw) throw new Error("请先粘贴训练内容或视频链接。");
  if (/^[\[{]/.test(raw)) {
    let decoded: unknown;
    try { decoded = JSON.parse(raw); }
    catch { throw new Error("JSON 格式有误。请检查完整内容，或到「用自己的 AI」复制统一提示词后重新整理。"); }
    const format = decodedFormat(decoded);
    if (format === "program") throw new Error("这是完整训练周期，请转到「训练周期 → 导入周期」预览；这里不会截取其中的训练。");
    if (format === "backup") throw new Error("这是训练搭子备份，请转到「数据导出与导入 → 恢复备份」，不要作为新计划重复导入。");
    const items = Array.isArray(decoded) ? decoded : [decoded];
    if (items.length > 20) throw new Error("普通计划每批最多 20 堂，当前有 " + items.length + " 堂。完整多周安排请使用「训练周期」，内容尚未导入且不会截断。");
    const checked = z.array(planSchema).min(1).max(20).safeParse(items);
    if (!checked.success) throw new Error("计划 JSON 的日期、动作或数值不符合格式。可到「用自己的 AI」复制统一提示词重新整理，再预览核对。");
    return checked.data;
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
      ...(match[4] && match[5] !== "秒" ? { repsMax: Number(match[4]) } : {}),
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
  if (plans.length > 20) throw new Error("普通计划每批最多 20 堂。请分批核对，或使用训练周期；内容尚未导入且不会截断。");
  const validated = z.array(planSchema).min(1).max(20).safeParse(plans);
  if (!validated.success) throw new Error("未能整理这段内容。可以粘贴视频链接、使用「动作名 3×10」格式，或导入 AI 生成的 JSON。");
  return validated.data;
}
