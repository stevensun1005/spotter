import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  return next(specifier, context);
} });
const { anthropicUsageCost, reserveAiBudget, settleAiBudget } = await import("../features/ai-coach/budget.ts");

const november = new Date("2026-11-30T18:59:59-05:00");
const december = new Date("2026-11-30T19:00:00-05:00");
const outputLimit = 500;
const maxHold = 1_001_250_000;

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const drizzle = new URL("drizzle/", root);
  for (const file of readdirSync(drizzle).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, drizzle), "utf8"));
  }
  let failAfterUpdate = false;
  const db = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...args) {
      return { async run() {
        const result = statement.run(...args);
        if (failAfterUpdate && /^UPDATE/i.test(sql)) throw new Error("synthetic lost database response");
        return { meta: { changes: Number(result.changes) } };
      } };
    } };
  } };
  const spent = (owner, month = "2026-11") => sqlite.prepare(
    "SELECT charged_nanos FROM ai_coach_budget WHERE owner = ? AND month = ?",
  ).get(owner, month)?.charged_nanos;
  return { db, spent, sqlite, simulateLostUpdateResponse() { failAfterUpdate = true; } };
}

test("monthly reservations enforce the cap with concurrent requests and isolate accounts and UTC months", async (t) => {
  const { db, spent, sqlite } = fixture(t);
  const calls = Array.from({ length: 12 }, () => reserveAiBudget(db, "athlete", outputLimit, november));
  const holds = await Promise.allSettled(calls);
  assert.equal(holds.filter(({ status }) => status === "fulfilled").length, 9);
  for (const { status, reason } of holds) {
    if (status === "rejected") assert.equal(reason.status, 429);
  }
  assert.equal(spent("athlete"), 9 * maxHold);
  await reserveAiBudget(db, "coach", outputLimit, november);
  assert.equal(spent("coach"), maxHold);
  await reserveAiBudget(db, "athlete", outputLimit, december);
  assert.equal(spent("athlete", "2026-12"), maxHold);
  sqlite.prepare("INSERT INTO ai_coach_budget (month, owner, charged_nanos) VALUES (?, ?, ?)")
    .run("2026-11", "boundary", 10_000_000_000 - maxHold);
  await reserveAiBudget(db, "boundary", outputLimit, november);
  assert.equal(spent("boundary"), 10_000_000_000);
  await assert.rejects(reserveAiBudget(db, "boundary", outputLimit, november), { status: 429 });
});

test("settlement refunds only known usage once and keeps unresolved holds", async (t) => {
  const { db, spent, simulateLostUpdateResponse } = fixture(t);
  const hold = await reserveAiBudget(db, "athlete", outputLimit, november);
  await settleAiBudget(db, "coach", hold, 0);
  await settleAiBudget(db, "athlete", hold, maxHold + 1);
  await settleAiBudget(db, "athlete", hold, -1);
  assert.equal(spent("athlete"), maxHold);
  await Promise.all([settleAiBudget(db, "athlete", hold, 30_000), settleAiBudget(db, "athlete", hold, 0)]);
  assert.equal(spent("athlete"), 30_000);
  await reserveAiBudget(db, "athlete", outputLimit, december);
  assert.equal(spent("athlete", "2026-12"), maxHold);
  const second = await reserveAiBudget(db, "athlete", outputLimit, november);
  simulateLostUpdateResponse();
  await assert.rejects(settleAiBudget(db, "athlete", second, 40_000));
  await settleAiBudget(db, "athlete", second, 40_000);
  assert.equal(spent("athlete"), 70_000);
});

test("Haiku token pricing counts cache reads and writes at the right tier", () => {
  assert.equal(anthropicUsageCost({ input_tokens: 100, output_tokens: 10 }), 15_000);
  const usages = {
    input_tokens: 99_700, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 200,
    cache_creation: { ephemeral_5m_input_tokens: 120, ephemeral_1h_input_tokens: 80 },
    inference_geo: "global", service_tier: "standard", speed: "standard",
    server_tool_use: { web_search_requests: 0, web_fetch_requests: null },
  };
  const base = 10_012_000;
  assert.equal(anthropicUsageCost(usages), base);
  assert.equal(anthropicUsageCost({ ...usages, cache_read_input_tokens: 101 }), (base + 10) * 5);
  assert.equal(anthropicUsageCost({ ...usages, cache_creation: null }), null);
  assert.equal(anthropicUsageCost({ ...usages, service_tier: "priority" }), null);
  assert.equal(anthropicUsageCost({ ...usages, inference_geo: "us" }), null);
  assert.equal(anthropicUsageCost({ ...usages, server_tool_use: { web_search_requests: 1 } }), null);
  assert.equal(anthropicUsageCost({ ...usages, input_tokens: 1_000_000 }), null);
  assert.equal(anthropicUsageCost({ ...usages, output_tokens: -1 }), null);
  assert.equal(anthropicUsageCost({ ...usages, input_tokens: "99_700" }), null);
  assert.equal(anthropicUsageCost(null), null);
});
