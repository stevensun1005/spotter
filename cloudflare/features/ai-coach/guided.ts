import { z } from "zod";
import { canonicalCatalogueId, parsePlanMove } from "@/features/exercises/move-name";
import { offsetDate } from "@/shared/dates";

export const guidedLimits = [
  { value: "jumping", label: "跑跳与冲击" },
  { value: "overhead", label: "过头推举" },
  { value: "deep-knee", label: "深屈膝动作" },
  { value: "heavy-hip-hinge", label: "重负荷髋铰链" },
] as const;

export const guidedScenes = [
  { value: "gym", label: "健身房" },
  { value: "home", label: "家中基础器械" },
  { value: "bodyweight", label: "自重" },
  { value: "bands", label: "弹力带" },
] as const;

export const guidedGoals = [
  { value: "strength", label: "提升力量" },
  { value: "hypertrophy", label: "增肌" },
  { value: "fat-loss", label: "减脂期保持训练" },
  { value: "conditioning", label: "提升体能" },
  { value: "general", label: "保持运动习惯" },
] as const;

export const guidedFocus = [
  { value: "chest", label: "胸部" },
  { value: "back", label: "背部" },
  { value: "shoulders", label: "肩部" },
  { value: "arms", label: "手臂" },
  { value: "legs", label: "腿部" },
  { value: "glutes", label: "臀部" },
  { value: "core", label: "核心" },
] as const;

export const guidedWeeks = [1, 2, 4] as const;
export const maxGuidedSessions = 12;
export const guidedMaxPoolSize = 24;
export const guidedMessage = "请根据我选择的条件起草训练计划。";

function optionSchema<Value extends string>(choices: readonly [{ value: Value }, ...{ value: Value }[]]) {
  const [first, ...rest] = choices;
  return z.enum([first.value, ...rest.map(({ value }) => value)]);
}

const guidedMoveSchema = z.object({
  name: z.string().trim().min(1).max(100).regex(/^[^\r\n]+$/)
    .transform((name) => parsePlanMove(name).name.trim())
    .refine((name) => name.length > 0 && !/^[A-Z](?:\d+|\s+热身组\s*·)$/.test(name)),
  catalogueId: z.string().regex(/^\d{4,6}$/).transform(canonicalCatalogueId).optional(),
}).strict();

export type GuidedMove = z.infer<typeof guidedMoveSchema>;

export function guidedMoveNameKey(name: string) {
  return parsePlanMove(name).name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function guidedMoveKey({ catalogueId, name }: GuidedMove) {
  return catalogueId ? "catalogue:" + canonicalCatalogueId(catalogueId) : "name:" + guidedMoveNameKey(name);
}

const uniqueOptions = <Value>(items: Value[]) => new Set(items).size === items.length;
const uniqueMoves = (moves: GuidedMove[]) => uniqueOptions(moves.map(guidedMoveKey));

export const guidedSchema = z.object({
  limits: z.array(optionSchema(guidedLimits)).max(guidedLimits.length).refine(uniqueOptions),
  scene: optionSchema(guidedScenes),
  goal: optionSchema(guidedGoals),
  focus: z.array(optionSchema(guidedFocus)).max(guidedFocus.length).refine(uniqueOptions),
  daysPerWeek: z.number().int().min(1).max(7),
  minutes: z.number().int().min(15).max(120),
  work: z.array(guidedMoveSchema).min(1).max(guidedMaxPoolSize).refine(uniqueMoves),
  warmup: z.array(guidedMoveSchema).max(guidedMaxPoolSize).refine(uniqueMoves),
}).strict();

export type GuidedDraft = z.infer<typeof guidedSchema>;

export function guidedDateRanges(date: string, draftDays: number) {
  return Array.from({ length: draftDays / 7 }, (_, week) => ({
    from: offsetDate(date, week * 7),
    to: offsetDate(date, week * 7 + 6),
  }));
}

export function guidedContext(input: GuidedDraft, date: string, draftDays: number) {
  const label = (choices: readonly { value: string; label: string }[], value: string) =>
    choices.find((choice) => choice.value === value)?.label ?? value;
  return JSON.stringify({
    训练目标: label(guidedGoals, input.goal),
    训练场景: label(guidedScenes, input.scene),
    暂避动作: input.limits.map((value) => label(guidedLimits, value)),
    重点部位: input.focus.map((value) => label(guidedFocus, value)),
    每周训练次数: input.daysPerWeek,
    每次训练时间上限分钟: input.minutes,
    训练周: guidedDateRanges(date, draftDays),
    正式动作候选: input.work,
    热身动作候选: input.warmup,
  });
}
