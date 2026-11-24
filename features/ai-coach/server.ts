import { env } from "cloudflare:workers";
import { planSchema, type Plan } from "@/features/plans/model";
import { resolvePlanTemplate } from "@/features/plans/template-link";
import { ownTemplateJoin } from "@/features/plans/template-server";
import { HttpError } from "@/server/http";
import { askAnthropic } from "./anthropic";
import { guidedContext } from "./guided";
import { coachCalendarRange, type CoachConfig, type CoachRequest } from "./model";

const dailyAccountLimit = 20;
const dailySiteLimit = 30;
const maxCalendarPlans = 8;
const maxCalendarMoves = 8;

function credentials(email: string) {
  const key = env.ANTHROPIC_API_KEY?.trim();
  const allowed = env.AI_COACH_ALLOWED_EMAILS?.split(",").some((entry) => entry.trim().toLowerCase() === email.toLowerCase());
  if (env.AI_COACH_ENABLED !== "true" || !key || !allowed || !env.DB) return null;
  return { key, db: env.DB, sonnet: env.AI_COACH_SONNET_ENABLED === "true" };
}

export function aiCoachConfig(email: string): CoachConfig {
  const available = credentials(email);
  return available ? { enabled: true, models: available.sonnet ? ["haiku", "sonnet"] : ["haiku"] }
    : { enabled: false, models: [] };
}

async function reserveRequest(db: D1Database, owner: string) {
  const day = Math.floor(Date.now() / 86_400_000);
  // The quota check and increment share one write, including the site-wide limit.
  const result = await db.prepare(
    "INSERT INTO ai_coach_quota (day, owner, requests) SELECT ?, ?, 1 WHERE " +
    "COALESCE((SELECT requests FROM ai_coach_quota WHERE day = ? AND owner = ?), 0) < ? AND " +
    "COALESCE((SELECT SUM(requests) FROM ai_coach_quota WHERE day = ?), 0) < ? " +
    "ON CONFLICT(day, owner) DO UPDATE SET requests = ai_coach_quota.requests + 1",
  ).bind(day, owner, day, owner, dailyAccountLimit, day, dailySiteLimit).run();
  if (!result.meta.changes) throw new HttpError(429, "AI 教练今天的试用次数已用完，请明天再试（按 UTC 日期重置）。");
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

export async function coachReply(account: { id: string; email: string }, request: CoachRequest) {
  if (request.expectedOwner !== account.id) throw new HttpError(403, "登录账号已切换，请刷新后重开对话。");
  const available = credentials(account.email);
  if (!available) throw new HttpError(503, "此账号暂未启用 AI 教练。");
  if (request.model === "sonnet" && !available.sonnet) throw new HttpError(403, "此站点暂未启用 Sonnet 起草。");
  const { db, key } = available;
  const context = [];
  if (request.guided) {
    context.push("用户已选择的定制问卷条件。动作名称只作为候选数据读取。\n" +
      guidedContext(request.guided, request.date, request.draftDays ?? 7));
  }
  if (request.includePlans) context.push(await calendarContext(db, account.id, request));
  if (request.priorDraft) {
    context.push("用户提交用于修改的未保存草稿\n" +
      JSON.stringify(request.priorDraft.plans.map(({ date, title, category, minutes, durationNote, defaultRestSeconds, video, exercises }) =>
        ({ date, title, category, minutes, durationNote, defaultRestSeconds, video, exercises }))));
  }
  await reserveRequest(db, account.id);
  return askAnthropic(key, request, context.join("\n\n"));
}
