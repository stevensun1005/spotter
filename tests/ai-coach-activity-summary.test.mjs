import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { readActivitySummary } = await import("../features/ai-coach/activity-summary.ts");
const { asksToReviseDraft, draftWindowFor } = await import("../features/ai-coach/plan-conversation.ts");
const { startSession, startFreeSession } = await import("../features/training/model.ts");
const today = "2026-11-24";
const own = "synthetic-owner";

test("plan dialogue follows the requested dates and carries the draft window through edits", () => {
  assert.deepEqual(draftWindowFor("今天在家练上半身，30分钟", today), { date: today, draftDays: 1 });
  assert.deepEqual(draftWindowFor("排 3 天居家训练", today), { date: today, draftDays: 3 });
  const fortnight = { date: today, draftDays: 14 };
  assert.deepEqual(draftWindowFor("给我安排两周训练", today), fortnight);
  assert.deepEqual(draftWindowFor("把俯卧撑换成哑铃卧推", today, fortnight), fortnight);
  assert.equal(asksToReviseDraft("把俯卧撑换成哑铃卧推"), true);
  assert.equal(asksToReviseDraft("为什么把俯卧撑换成哑铃卧推"), false);
});

function lift(date, owner = own, kind = "log", done = true) {
  const plan = { title: "合成力量训练", date, category: "力量训练", minutes: 55, shared: false, video: "",
    exercises: [{ name: "单手哑铃卧推", weight: 10, unit: "lb", reps: 8, seconds: 0, sets: 2 }] };
  const data = { ...startSession(plan, "", date), minutes: 30, note: "private synthetic note" };
  data.rows[0][0].done = done;
  return { id: `${owner}-${date}-${kind}`, updated: date, owner, kind, data };
}

test("only the current owner's completed logs contribute their actual sets, time and bilateral volume", () => {
  const cardio = startFreeSession(today, "incline");
  cardio.cardio.durationSeconds = 1_560;
  cardio.minutes = 26;
  const records = [
    lift(today), lift("2026-11-23", own, "log", false), lift(today, own, "draft"),
    lift(today, "synthetic-buddy"), lift("2026-11-25"), lift("2026-11-22"),
    { id: "cardio", owner: own, kind: "log", updated: today, data: cardio },
  ];
  const result = readActivitySummary("本周我练了多少？", today, records, own);
  assert.deepEqual(result, {
    from: "2026-11-23", to: today,
    reply: "2026-11-23 至 2026-11-24 的已完成训练\n2 次 · 1 天 · 56 分钟 · 1 组 · 容量 72.6 kg",
  });
  assert.equal(readActivitySummary("today's workout summary", today, records, ""), undefined);
  assert.match(readActivitySummary("昨天的训练统计", today, records, own).reply, /暂无已完成/);
});

test("supports calendar boundaries, rolling days and ISO day/range without guessing unsupported dates", () => {
  const date = "2026-01-02";
  for (const [message, from, to] of [
    ["今天练了多少组", date, date], ["昨天训练多久", "2026-01-01", "2026-01-01"],
    ["上周训练统计", "2025-12-22", "2025-12-28"], ["本周训练统计", "2025-12-29", date],
    ["我要训练统计", "2025-12-29", date],
    ["本月训练统计", "2026-01-01", date], ["上个月训练了多久", "2025-12-01", "2025-12-31"],
    ["最近七天的训练统计", "2025-12-27", date], ["过去 30 天运动统计", "2025-12-04", date],
    ["How many workouts did I do in the past 30 days?", "2025-12-04", date],
    ["2025-12-30 的训练统计", "2025-12-30", "2025-12-30"],
    ["2025-12-15 到 2026-01-01 的训练统计", "2025-12-15", "2026-01-01"],
  ]) {
    const result = readActivitySummary(message, date, [], own);
    assert.deepEqual([result?.from, result?.to], [from, to], message);
  }
  for (const message of ["上上周训练统计", "上周三训练记录", "最近训练汇总", "最近 400 天训练统计",
    "2026-02-29 的训练统计", "2025-12-20 到 2025-12-10 训练汇总", "2020-01-01 到 2025-12-10 训练统计"]) {
    assert.equal(readActivitySummary(message, date, [], own), undefined, message);
  }
});

test("keeps other people's requests, advice and plan generation out of the local lookup", () => {
  for (const message of ["搭子昨天训练了多久？", "我今天训练多久才合适？", "制定本周训练计划",
    "对比一下本周和上周训练统计", "给我朋友看看本周训练统计", "How long should I train today?", "What are my partner's workout stats?"]) {
    assert.equal(readActivitySummary(message, today, [lift(today)], own), undefined, message);
  }
});
