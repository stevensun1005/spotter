import { z } from "zod";
import { cleanPlan, planSchema, type Plan } from "@/features/plans/model";
import { dateSchema, offsetDate, weekdayIndex } from "@/shared/dates";

export const coachModels = ["haiku", "sonnet"] as const;
export const maxDraftPlans = 12;
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

export const coachRequestSchema = z.object({
  expectedOwner: z.string().min(1).max(300),
  messages: z.array(messageSchema).min(1).max(maxCoachMessages).refine((messages) =>
    messages.length % 2 === 1 &&
    messages.every(({ role }, index) => role === (index % 2 === 0 ? "user" : "assistant")) &&
    messages.reduce((length, { content }) => length + content.length, 0) <= maxCoachConversationLength),
  intent: z.enum(["chat", "draft"]),
  model: z.enum(coachModels),
  date: dateSchema.refine((date) => date >= "2000-01-01" && date <= "2099-12-31"),
  includePlans: z.boolean(),
  contextRange: z.enum(["day", "week"]).optional(),
  draftDays: z.number().int().min(1).max(28).optional(),
  priorDraft: priorDraftSchema.optional(),
}).strict().refine(({ intent, model, priorDraft }) => intent === "draft" || (model === "haiku" && !priorDraft));

export type CoachModel = typeof coachModels[number];
export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachConfig = { enabled: boolean; models: CoachModel[] };
export type CoachResponse = { reply: string; draft?: { plans: Plan[] }; model: CoachModel };

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

export function normalizeCoachDraft(value: unknown, request: CoachRequest): CoachResponse | null {
  const draft = draftResultSchema.safeParse(value);
  if (!draft.success) return null;
  const to = coachDraftEnd(request);
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
  return { reply: draft.data.reply, draft: { plans }, model: request.model };
}
