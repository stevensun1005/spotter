import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typescript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typescript)) return next(typescript.href, context);
  }
  return next(specifier, context);
} });
const { weightDialogue } = await import("../features/ai-coach/weight-dialogue.ts");

test("confirmed weight logging is deterministic and converts stated units", () => {
  assert.equal(weightDialogue("记体重").kind, "ask");
  assert.deepEqual(weightDialogue("80.5", weightDialogue("记体重")), { kind: "record", kg: 80.5 });
  assert.deepEqual(weightDialogue("８０．５ｋｇ", true), { kind: "record", kg: 80.5 });
  assert.deepEqual(weightDialogue("80.5 kg", true), { kind: "record", kg: 80.5 });
  assert.deepEqual(weightDialogue("180磅", true), { kind: "record", kg: 81.65 });
  assert.deepEqual(weightDialogue("150斤", true), { kind: "record", kg: 75 });
  assert.deepEqual(weightDialogue("帮我把今天的体重记录为 80.5 公斤"), { kind: "record", kg: 80.5, dayOffset: 0 });
  assert.deepEqual(weightDialogue("Please log my weight of 180 pounds"), { kind: "record", kg: 81.65 });
});

test("prior date context survives a follow-up and unsupported dates are clarified", () => {
  const { date, dayOffset } = weightDialogue("记录昨天的体重");
  assert.equal(dayOffset, -1);
  assert.deepEqual(weightDialogue("80.5kg", weightDialogue("记录昨天的体重")), { kind: "record", kg: 80.5, dayOffset: -1 });
  assert.deepEqual(weightDialogue("80.5kg", { ...(date ? { date } : {}), dayOffset }), { kind: "record", kg: 80.5, dayOffset: -1 });
  assert.deepEqual(weightDialogue("记一下 2026-11-23 体重 80.5kg"), { kind: "record", kg: 80.5, date: "2026-11-23" });
  assert.equal(weightDialogue("记一下上周体重80.5kg").dateRequired, true);
  assert.equal(weightDialogue("80.5kg", { dateRequired: true }).dateRequired, true);
  assert.equal(weightDialogue("记体重 2026-02-30 80.5kg").dateRequired, true);
  assert.deepEqual(weightDialogue("2026-11-23 80.5kg", { dateRequired: true }), { kind: "record", kg: 80.5, date: "2026-11-23" });
});

test("ambiguous, unrelated and cancelled replies do not log weight", () => {
  for (const ambiguous of ["80", "80.5g", "80台斤", "80-82kg", "大约80kg", "80kg或81kg", "-80kg", "900kg"]) {
    assert.equal(weightDialogue(ambiguous, true).kind, "ask", ambiguous);
  }
  assert.deepEqual(weightDialogue("我的体重记录是80.5kg"), { kind: "pass", clearPending: false });
  assert.deepEqual(weightDialogue("我体重是80.5kg"), { kind: "pass", clearPending: false });
  assert.deepEqual(weightDialogue("帮我生成明天的训练计划", true), { kind: "pass", clearPending: true });
  assert.deepEqual(weightDialogue("我想减到目标体重 75kg", true), { kind: "pass", clearPending: true });
  assert.deepEqual(weightDialogue("卧推80kg", true), { kind: "pass", clearPending: true });
  assert.deepEqual(weightDialogue("如何记录体重"), { kind: "pass", clearPending: false });
  assert.equal(weightDialogue("算了", true).kind, "cancel");
  assert.equal(weightDialogue("不要记录体重 80kg").kind, "cancel");
  assert.equal(weightDialogue("帮我记女朋友的体重60kg").kind, "cancel");
  assert.equal(weightDialogue("record Alice's weight 170 lb").kind, "cancel");
  assert.equal(weightDialogue("帮小王记体重 75 kg").kind, "cancel");
  assert.deepEqual(weightDialogue("record today's weight 170 lb"), { kind: "record", kg: 77.11, dayOffset: 0 });
});
