import { z } from "zod";
import { cleanPlan, planSchema, type Move, type Plan } from "@/features/plans/model";
import { phaseOf } from "@/features/plans/move-phase";
import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";
import { guidedDateRanges, guidedMessage, guidedMoveNameKey, guidedSchema, guidedWeeks, maxGuidedSessions,
  type GuidedDraft, type GuidedMove } from "./guided";
import type { MealLoggingAction } from "@/features/nutrition/coach-meal-inference";

export const coachModel = "haiku" as const;
export const maxDraftPlans = maxGuidedSessions;
export const maxDraftMoves = 12;
export const maxCoachMessages = 9;
export const maxCoachMessageLength = 4_000;
export const maxCoachConversationLength = 9_000;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(maxCoachMessageLength),
}).strict();

const priorDraftSchema = z.object({
  plans: z.array(planSchema).min(1).max(maxDraftPlans)
    .refine((plans) => plans.every((plan) => plan.exercises.length <= maxDraftMoves)),
}).strict();

const coachDateSchema = dateSchema.refine((date) => date >= "2000-01-01" && date <= "2099-12-31");

export const coachRequestSchema = z.object({
  expectedOwner: z.string().min(1).max(300),
  messages: z.array(messageSchema).min(1).max(maxCoachMessages).refine((messages) =>
    messages.length % 2 === 1 &&
    messages.every(({ role }, index) => role === (index % 2 === 0 ? "user" : "assistant")) &&
    messages.reduce((length, { content }) => length + content.length, 0) <= maxCoachConversationLength),
  intent: z.enum(["chat", "draft"]),
  // Older draft clients can still send the previous selector.
  model: z.enum([coachModel, "sonnet"]),
  date: coachDateSchema,
  includePlans: z.boolean(),
  contextRange: z.enum(["day", "week"]).optional(),
  mealLogging: z.object({ pending: z.boolean().optional(), historyStart: z.number().int().min(0).optional(),
    date: coachDateSchema.optional() }).strict().optional(),
  draftDays: z.number().int().min(1).max(28).optional(),
  priorDraft: priorDraftSchema.optional(),
  guided: guidedSchema.optional(),
}).strict().refine(({ intent, model, priorDraft, guided, draftDays = 7, messages, includePlans, mealLogging }) => {
  if (mealLogging && (intent !== "chat" || (mealLogging.historyStart ?? 0) >= messages.length)) return false;
  if (!guided) return intent === "draft" || (model === coachModel && !priorDraft);
  return intent === "draft" && !includePlans && !priorDraft && messages.length === 1 && messages[0].content === guidedMessage &&
    guidedWeeks.some((weeks) => draftDays === weeks * 7 && guided.daysPerWeek * weeks <= maxGuidedSessions);
});

export type CoachModel = typeof coachModel;
export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachQuota = {
  dailyLimit: number;
  monthlyLimit: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyResetsAt: string;
  monthlyResetsAt: string;
};
export type CoachConfig = { enabled: boolean; models: CoachModel[]; quota?: CoachQuota; mealLoggingEnabled?: boolean };
export type CoachResponse = { reply: string; draft?: { plans: Plan[] }; mealAction?: MealLoggingAction; model: CoachModel; quota?: CoachQuota };

export function coachCalendarRange(date: string, range: CoachRequest["contextRange"]) {
  if (range === "day") return { from: date, to: date };
  const from = offsetDate(date, -weekdayIndex(date));
  return { from, to: offsetDate(from, 6) };
}

export function coachDraftEnd({ date, draftDays = 7 }: CoachRequest) {
  return offsetDate(date, draftDays - 1);
}

const planFields = planSchema.innerType().shape;
const draftedPlan = planSchema.innerType().pick({
  title: true, date: true, category: true, minutes: true, durationNote: true, defaultRestSeconds: true, video: true, exercises: true,
}).extend({ video: planFields.video.default(""), exercises: planFields.exercises.max(maxDraftMoves) }).strict();

const draftResultSchema = z.object({
  reply: z.string().trim().min(1).max(maxCoachMessageLength),
  plans: z.array(draftedPlan).min(1).max(maxDraftPlans),
}).strict();

function matchesSelectedMove(move: Move, pool: GuidedMove[]) {
  const name = guidedMoveNameKey(move.name);
  return pool.filter((candidate) => guidedMoveNameKey(candidate.name) === name &&
    (!move.catalogueId || move.catalogueId === candidate.catalogueId));
}

function normalizeGuidedPlan(item: z.infer<typeof draftedPlan>, guided: GuidedDraft) {
  if (item.video || item.minutes < 1 || item.minutes > guided.minutes) return null;
  const work: Move[] = [];
  const warmup: Move[] = [];
  for (const move of item.exercises) {
    if (move.loadPercent) return null;
    const workMatches = phaseOf(move) === "work" ? matchesSelectedMove(move, guided.work) : [];
    const isWarmup = workMatches.length === 0;
    const matches = isWarmup ? matchesSelectedMove(move, guided.warmup) : workMatches;
    // If variants share a name, the provider must preserve the selected catalogue ID.
    if (matches.length !== 1) return null;
    const { name, catalogueId } = matches[0];
    const selected = { ...move, name, catalogueId, weight: 0, fixedLoad: undefined };
    if (isWarmup) warmup.push({ ...selected, sourceSlot: "W-warmup" });
    else work.push(selected);
  }
  if (!work.length || item.exercises.reduce((seconds, move) => seconds + move.sets * move.seconds, 0) > item.minutes * 60) return null;
  return cleanPlan({ ...item, exercises: [...warmup, ...work], shared: false });
}

export function normalizeCoachDraft(value: unknown, request: CoachRequest): CoachResponse | null {
  const draft = draftResultSchema.safeParse(value);
  if (!draft.success) return null;
  const to = coachDraftEnd(request);
  const guided = request.guided;
  if (guided) {
    const { plans } = draft.data;
    const ranges = guidedDateRanges(request.date, request.draftDays ?? 7);
    const countsMatch = ranges.every(({ from, to }) =>
      plans.filter(({ date }) => date >= from && date <= to).length === guided.daysPerWeek);
    if (!countsMatch || new Set(plans.map(({ date }) => date)).size !== plans.length) return null;
    const normalized: Plan[] = [];
    for (const item of plans) {
      if (item.date < request.date || item.date > to) return null;
      const plan = normalizeGuidedPlan(item, guided);
      if (!plan?.success) return null;
      normalized.push(plan.data);
    }
    normalized.sort((left, right) => left.date.localeCompare(right.date));
    return { reply: draft.data.reply, draft: { plans: normalized }, model: coachModel };
  }
  const priorPlans = request.priorDraft?.plans ?? [];
  const priorMoves = priorPlans.flatMap(({ exercises }) => exercises);
  const messageLinks = request.messages.filter(({ role }) => role === "user")
    .flatMap(({ content }) => content.match(/https:\/\/[^\s<>"')\]\x60，。；]+/g) ?? []);
  const suppliedVideos = new Set([...priorPlans.map(({ video }) => video), ...messageLinks]);
  const plans: Plan[] = [];
  for (const item of draft.data.plans) {
    if (item.date < request.date || item.date > to) return null;
    if (item.video && !suppliedVideos.has(item.video)) return null;
    for (const { name, catalogueId, loadPercent } of item.exercises) {
      if (catalogueId && !priorMoves.some((move) => move.name === name && move.catalogueId === catalogueId)) return null;
      if (loadPercent && !priorMoves.some((move) => move.name === name &&
        move.loadPercent?.reference === loadPercent.reference && move.loadPercent.unit === loadPercent.unit)) return null;
    }
    const plan = cleanPlan({ ...item, shared: false });
    if (!plan.success) return null;
    plans.push(plan.data);
  }
  return { reply: draft.data.reply, draft: { plans }, model: coachModel };
}
