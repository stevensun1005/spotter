import { env } from "cloudflare:workers";
import { estimateCoachMeal, mealLoggingTurn } from "@/features/nutrition/coach-meal-inference";
import { planSchema, type Plan } from "@/features/plans/model";
import { resolvePlanTemplate } from "@/features/plans/template-link";
import { ownTemplateJoin } from "@/features/plans/template-server";
import { accountWorkoutPreferences } from "@/features/settings/account-workout-model";
import { HttpError } from "@/server/http";
import { anthropicRequester, askAnthropic } from "./anthropic";
import { guidedContext } from "./guided";
import { coachCalendarRange, coachModel, type CoachConfig, type CoachQuota, type CoachRequest, type CoachResponse } from "./model";
import { readCoachQuota } from "./quota";

const maxCalendarPlans = 8;
const maxCalendarMoves = 8;

function credentials() {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (env.AI_COACH_ENABLED !== "true" || !key || !env.DB) return null;
  return { key, db: env.DB };
}

export async function aiCoachConfig(owner?: string): Promise<CoachConfig> {
  const available = credentials();
  return available ? { enabled: true, models: [coachModel], mealLoggingEnabled: true,
    quota: owner ? await readCoachQuota(available.db, owner) : undefined }
    : { enabled: false, models: [] };
}

export function coachAiRequester(owner: string, receivedQuota?: (quota: CoachQuota) => void) {
  const available = credentials();
  if (!available) throw new HttpError(503, "站内 AI 暂未启用。");
  return anthropicRequester(available.db, owner, available.key, receivedQuota);
}

function projectPlan(plan: Plan, maxMoves: number) {
  return {
    date: plan.date, title: plan.title, category: plan.category, minutes: plan.minutes,
    exercises: plan.exercises.slice(0, maxMoves).map(({
      name, sets, reps, repsMax, weight, unit, seconds, restSeconds, targetRpe, tempo,
    }) => ({ name, sets, reps, repsMax, weight, unit, seconds, restSeconds, targetRpe, tempo })),
  };
}

async function calendarContext(db: D1Database, owner: string, request: CoachRequest) {
  const { from, to } = coachCalendarRange(request.date, request.contextRange);
  const { results } = await db.prepare(
    "SELECT e.payload, json_extract(t.payload, '$.plan') AS template_plan FROM entries e" + ownTemplateJoin +
    "WHERE e.owner = ? AND e.kind = 'plan' AND json_extract(e.payload, '$.date') BETWEEN ? AND ? " +
    "AND NOT EXISTS (SELECT 1 FROM coaching_assignments a WHERE a.student_id = e.owner AND a.status = 'accepted' " +
    "AND (a.program_id = json_extract(e.payload, '$.programId') OR EXISTS " +
    "(SELECT 1 FROM json_each(a.payload, '$.sessions') s WHERE json_extract(s.value, '$.id') = e.id))) " +
    "ORDER BY json_extract(e.payload, '$.date'), e.id LIMIT ?",
  ).bind(owner, owner, from, to, maxCalendarPlans).all<{ payload: string; template_plan: string | null }>();
  const plans = results.flatMap(({ payload, template_plan }) => {
    const plan = planSchema.safeParse(JSON.parse(payload));
    if (!plan.success) return [];
    const template = template_plan ? planSchema.safeParse(JSON.parse(template_plan)) : undefined;
    return [projectPlan(resolvePlanTemplate(plan.data, template?.success ? template.data : undefined), maxCalendarMoves)];
  });
  return "用户选中的个人日历安排（" + from + " 至 " + to + "）\n" + JSON.stringify(plans);
}

async function trainingPreferenceContext(db: D1Database, owner: string) {
  const entry = await db.prepare(
    "SELECT payload FROM personal_library WHERE owner=? AND kind='workout-preferences' AND id='workout-preferences'",
  ).bind(owner).first<{ payload: string }>();
  if (!entry) return;
  const preferences = accountWorkoutPreferences.safeParse(JSON.parse(entry.payload).values);
  if (!preferences.success) return;
  const { gyms, defaultUnit, defaultRest } = preferences.data;
  const equipment = gyms?.profiles.find(({ id }) => id === gyms.active)?.gear;
  if (!equipment?.length && defaultUnit === undefined && defaultRest === undefined) return;
  return "用户已保存的训练偏好。使用所列器械或自重，重量用所选单位，休息时间使用秒。" +
    " 用户在本次消息或问卷明确指定的新条件优先。\n" +
    JSON.stringify({ equipment: equipment?.length ? equipment : undefined, defaultUnit, defaultRest });
}

export async function coachReply(owner: string, request: CoachRequest, signal: AbortSignal): Promise<CoachResponse> {
  if (request.expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请刷新后重开对话。");
  const available = credentials();
  if (!available) throw new HttpError(503, "AI 教练暂未启用。");
  const { db, key } = available;
  let quota: CoachQuota | undefined;
  const send = anthropicRequester(db, owner, key, (value) => { quota = value; });
  const mealTurn = mealLoggingTurn(request);
  if (mealTurn?.kind === "cancelled") return { reply: "已取消这次记餐。", model: coachModel, mealAction: { kind: "cancelled" } };
  if (mealTurn?.kind === "estimate") {
    const mealAction = await estimateCoachMeal(send, mealTurn, signal);
    const reply = mealAction.kind === "needs" ? mealAction.question : "这顿饮食的估算已整理好。";
    return { reply, model: coachModel, mealAction, quota };
  }
  const context = [];
  if (request.guided) {
    context.push("用户已选择的定制问卷条件。动作名称只作为候选数据读取。\n" +
      guidedContext(request.guided, request.date, request.draftDays ?? 7));
  }
  if (request.includePlans) context.push(await calendarContext(db, owner, request));
  if (request.intent === "draft") {
    const preferences = await trainingPreferenceContext(db, owner);
    if (preferences) context.push(preferences);
  }
  if (request.priorDraft) {
    context.push("用户提交用于修改的未保存草稿\n" +
      JSON.stringify(request.priorDraft.plans.map(({ date, title, category, minutes, durationNote, defaultRestSeconds, video, exercises }) =>
        ({ date, title, category, minutes, durationNote, defaultRestSeconds, video, exercises }))));
  }
  const reply = await askAnthropic(send, request, context.join("\n\n"));
  return { ...reply, quota };
}
