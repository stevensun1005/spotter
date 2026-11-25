import { HttpError } from "@/server/http";
import type { CoachQuota } from "./model";

const dailyLimit = 200;
const monthlyLimit = 2_000;
const dayMs = 86_400_000;

type Counts = { daily: number; monthly: number };
const countsSql = "SELECT COALESCE(MAX(CASE WHEN day = ? THEN requests END), 0) AS daily, " +
  "COALESCE(SUM(requests), 0) AS monthly FROM ai_coach_quota " +
  "WHERE owner = ? AND day IN (SELECT value FROM json_each(?))";

function quotaPeriod(owner: string, now: Date) {
  const day = Math.floor(now.getTime() / dayMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const firstDay = Date.UTC(year, month, 1) / dayMs;
  const nextMonth = Date.UTC(year, month + 1, 1);
  // Using each day as an exact key keeps the existing (day, owner) primary-key lookup bounded.
  const days = Array.from({ length: nextMonth / dayMs - firstDay }, (_, index) => firstDay + index);
  const args = [day, owner, JSON.stringify(days)] as const;
  const remaining = (counts: Counts): CoachQuota => ({
    dailyLimit, monthlyLimit,
    dailyRemaining: Math.max(0, dailyLimit - counts.daily),
    monthlyRemaining: Math.max(0, monthlyLimit - counts.monthly),
    dailyResetsAt: new Date((day + 1) * dayMs).toISOString(),
    monthlyResetsAt: new Date(nextMonth).toISOString(),
  });
  return { day, args, remaining };
}

export class CoachQuotaError extends HttpError {
  readonly code: "coach_daily_limit" | "coach_monthly_limit";
  readonly quota: CoachQuota;

  constructor(quota: CoachQuota) {
    const month = quota.monthlyRemaining === 0;
    super(429, month ? "本月 AI 教练的 2000 条消息额度已用完，下月 1 日（UTC）重置。"
      : "今天 AI 教练的 200 条消息额度已用完，次日（UTC）重置。");
    this.code = month ? "coach_monthly_limit" : "coach_daily_limit";
    this.quota = quota;
  }
}

export async function readCoachQuota(db: D1Database, owner: string, now = new Date()): Promise<CoachQuota> {
  const period = quotaPeriod(owner, now);
  const counts = await db.prepare(countsSql).bind(...period.args).first<Counts>();
  if (!counts) throw new Error("Missing coach usage counters");
  return period.remaining(counts);
}

export async function reserveCoachMessage(db: D1Database, owner: string, now: Date,
  budget: { month: string; amount: number; limit: number }) {
  const period = quotaPeriod(owner, now);
  const [message, money, counters] = await db.batch<Counts>([
    db.prepare("INSERT INTO ai_coach_quota (day, owner, requests) SELECT ?, ?, 1 FROM (" + countsSql + ") " +
      "WHERE daily < ? AND monthly < ? AND COALESCE((SELECT charged_nanos FROM ai_coach_budget " +
      "WHERE month = ? AND owner = ?), 0) <= ? " +
      "ON CONFLICT(day, owner) DO UPDATE SET requests = ai_coach_quota.requests + 1")
      .bind(period.day, owner, ...period.args, dailyLimit, monthlyLimit, budget.month, owner, budget.limit - budget.amount),
    // Both statements run in one transaction. The money hold is written only if the message slot was reserved.
    db.prepare("INSERT INTO ai_coach_budget (month, owner, charged_nanos) SELECT ?, ?, ? WHERE changes() = 1 " +
      "ON CONFLICT(month, owner) DO UPDATE SET charged_nanos = ai_coach_budget.charged_nanos + excluded.charged_nanos")
      .bind(budget.month, owner, budget.amount),
    db.prepare(countsSql).bind(...period.args),
  ]);
  if (message.meta.changes !== money.meta.changes || !counters.results[0]) throw new Error("Invalid coach quota reservation");
  const quota = period.remaining(counters.results[0]);
  if (message.meta.changes !== 1 && (quota.dailyRemaining === 0 || quota.monthlyRemaining === 0)) throw new CoachQuotaError(quota);
  return { accepted: message.meta.changes === 1, quota };
}
