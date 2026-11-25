import { z } from "zod";
import { HttpError } from "@/server/http";
import type { CoachQuota } from "./model";
import { reserveCoachMessage } from "./quota";

const monthlyLimit = 10_000_000_000; // US dollars in integer nanodollars.
const maxInputTokens = 1_000_000;
const maxHaikuOutputTokens = 128_000;
const longContextThreshold = 100_000;
const longContextMultiplier = 5;
// Haiku 5.5 standard global rates, in nanodollars per token.
const inputRate = 100;
const outputRate = 500;
const cacheWrite5mRate = 125;
const cacheWrite1hRate = 200;
const cacheReadRate = 10;

type AiBudgetReservation = Readonly<{ month: string; amount: number; quota?: CoachQuota }>;
const pending = new WeakMap<AiBudgetReservation, { db: D1Database; owner: string }>();

export async function reserveAiBudget(db: D1Database, owner: string, maxOutputTokens: number, now = new Date(), countMessage = false) {
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > maxHaikuOutputTokens) {
    throw new Error("Invalid Haiku output token limit");
  }
  const month = now.toISOString().slice(0, 7);
  // Count Tokens is an estimate. Hold the published worst case until usage is known.
  const amount = (maxInputTokens * cacheWrite1hRate + maxOutputTokens * outputRate) * longContextMultiplier;
  let accepted: boolean;
  let quota: CoachQuota | undefined;
  if (countMessage) {
    const result = await reserveCoachMessage(db, owner, now, { month, amount, limit: monthlyLimit });
    accepted = result.accepted;
    quota = result.quota;
  } else {
    const result = await db.prepare(
      "INSERT INTO ai_coach_budget (month, owner, charged_nanos) VALUES (?, ?, ?) " +
      "ON CONFLICT(month, owner) DO UPDATE SET charged_nanos = ai_coach_budget.charged_nanos + excluded.charged_nanos " +
      "WHERE ai_coach_budget.charged_nanos <= ? - excluded.charged_nanos",
    ).bind(month, owner, amount, monthlyLimit).run();
    accepted = result.meta.changes === 1;
  }
  if (!accepted) throw new HttpError(429, "本月 AI 额度不足，下月 1 日（UTC）重置。");
  const reservation = Object.freeze({ month, amount, quota });
  pending.set(reservation, { db, owner });
  return reservation;
}

export async function settleAiBudget(db: D1Database, owner: string, reservation: AiBudgetReservation, actualNanos: number) {
  const holder = pending.get(reservation);
  if (holder?.db !== db || holder.owner !== owner) return;
  if (!Number.isSafeInteger(actualNanos) || actualNanos < 0 || actualNanos > reservation.amount) return;
  // Consume the hold before writing. An uncertain write must never trigger a second refund.
  pending.delete(reservation);
  await db.prepare(
    "UPDATE ai_coach_budget SET charged_nanos = charged_nanos - ? WHERE month = ? AND owner = ? AND charged_nanos >= ?",
  ).bind(reservation.amount - actualNanos, reservation.month, owner, reservation.amount).run();
}

const inputTokenCount = z.number().int().min(0).max(maxInputTokens);
const usageSchema = z.object({
  input_tokens: inputTokenCount,
  output_tokens: z.number().int().min(0).max(maxHaikuOutputTokens),
  cache_creation_input_tokens: inputTokenCount.nullish(),
  cache_read_input_tokens: inputTokenCount.nullish(),
  cache_creation: z.object({
    ephemeral_5m_input_tokens: inputTokenCount,
    ephemeral_1h_input_tokens: inputTokenCount,
  }).nullish(),
  inference_geo: z.literal("global").nullish(),
  service_tier: z.literal("standard").nullish(),
  speed: z.literal("standard").nullish(),
  server_tool_use: z.record(z.literal(0).nullable()).nullish(),
});

export function anthropicUsageCost(usage: unknown): number | null {
  const parsed = usageSchema.safeParse(usage);
  if (!parsed.success) return null;
  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cache_creation } = parsed.data;
  const cacheWrites = cache_creation_input_tokens ?? 0;
  const cacheReads = cache_read_input_tokens ?? 0;
  const cacheWrites5m = cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const cacheWrites1h = cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const totalInput = input_tokens + cacheWrites + cacheReads;
  if (totalInput > maxInputTokens || cacheWrites5m + cacheWrites1h !== cacheWrites) return null;
  const standard = input_tokens * inputRate + output_tokens * outputRate + cacheReads * cacheReadRate +
    cacheWrites5m * cacheWrite5mRate + cacheWrites1h * cacheWrite1hRate;
  return totalInput > longContextThreshold ? standard * longContextMultiplier : standard;
}
