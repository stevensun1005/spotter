import assert from "node:assert/strict";
import { test } from "node:test";
import { planCompletions } from "../features/plans/completion.ts";

const data = {
  plan: { title: "上肢力量", templateId: "shared-template" },
  date: "2026-11-26",
  started: 1000,
  ended: 2000,
};

test("completion follows the owner and scheduled plan ID, even on a different date", () => {
  const completed = { id: "log-1", owner: "me", kind: "log", data: { ...data, planId: "scheduled-a" } };
  const scheduled = { id: "scheduled-a", owner: "me", data: { ...data.plan, date: "2026-11-24" } };
  const pending = { ...scheduled, id: "scheduled-b", data: { ...data.plan, date: data.date } };
  const otherOwner = { ...completed, id: "log-2", owner: "partner", data: { ...data, planId: pending.id } };
  const completions = planCompletions([completed, otherOwner]);

  assert.equal(completions.get(scheduled.owner).get(scheduled.id), completed);
  assert.equal(completions.get(pending.owner).get(pending.id), undefined);
  assert.equal(completions.get("partner").get("scheduled-a"), undefined);
  assert.equal(completions.get("partner").get(pending.id), otherOwner);
});

test("drafts and free workouts cannot complete plans, and the latest check-in wins", () => {
  const dataForPlan = { ...data, planId: "scheduled-a" };
  const older = { id: "log-1", owner: "me", kind: "log", data: dataForPlan };
  const newer = { id: "log-2", owner: "me", kind: "log", data: { ...dataForPlan, ended: 3000 } };
  const draft = { ...newer, kind: "draft", data: { ...dataForPlan, planId: "scheduled-b" } };
  const free = { ...newer, id: "free", data: { ...dataForPlan, planId: "" } };
  const completions = planCompletions([newer, older, draft, free]);

  assert.deepEqual([...completions.get("me")], [["scheduled-a", newer]]);
});
