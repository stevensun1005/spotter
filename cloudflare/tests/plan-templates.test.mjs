import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const typeScript = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(typeScript)) return next(typeScript.href, context);
  }
  return next(specifier, context);
} });

const { planSchema } = await import("../features/plans/model.ts");
const { resolvePlanTemplate, withoutTemplateLink } = await import("../features/plans/template-link.ts");
const { freezeTemplatePlans, ownTemplateJoin } = await import("../features/plans/template-server.ts");

const templateId = "1a13ac90-12af-46eb-92d1-b8170eca7c5d";
const block = {
  title: "胸、背、三头", date: "2026-11-27", category: "力量训练", minutes: 45,
  shared: false, video: "",
  exercises: [{ name: "哑铃卧推", sets: 3, reps: 10, unit: "kg", weight: 15, seconds: 0 }],
};
const booked = {
  ...block, title: "W03 D1 · 上半身", date: "2027-01-08", shared: true,
  templateId, week: 3, day: 1, durationNote: "原计划 45 分钟", defaultRestSeconds: 45,
};
const currentTemplate = {
  ...block, title: "修改后的模板标题", minutes: 53,
  exercises: [{ ...block.exercises[0], sets: 4 }],
};

test("a linked plan follows its current template body while retaining its individual schedule", () => {
  assert.equal(planSchema.safeParse(block).success, true);
  assert.equal(planSchema.safeParse({ ...booked, templateId: "invalid" }).success, false);
  assert.equal(planSchema.safeParse({ ...booked, week: 0 }).success, false);
  assert.equal(planSchema.safeParse({ ...booked, day: 8 }).success, false);
  assert.deepEqual(planSchema.parse(booked), booked);
  assert.strictEqual(resolvePlanTemplate(booked), booked);
  assert.strictEqual(resolvePlanTemplate(block, currentTemplate), block);
  assert.deepEqual(resolvePlanTemplate(booked, currentTemplate), {
    ...currentTemplate, title: booked.title, date: booked.date, shared: true, templateId, week: 3, day: 1,
  });
  const custom = planSchema.parse({ ...booked, ownExercises: true });
  const customResolved = resolvePlanTemplate(custom, currentTemplate);
  assert.equal(customResolved.minutes, currentTemplate.minutes);
  assert.strictEqual(customResolved.exercises, custom.exercises);
  assert.equal(withoutTemplateLink(customResolved).ownExercises, undefined);
  assert.deepEqual(withoutTemplateLink(booked), {
    ...block, title: booked.title, date: booked.date, shared: true,
    durationNote: "原计划 45 分钟", defaultRestSeconds: 45,
  });
});

test("workout queries isolate owner templates and deletion freezes only the owner's linked plan bodies", (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const migration of ["0000_bored_cardiac.sql", "0002_sharp_paper_doll.sql"]) {
    sqlite.exec(readFileSync(new URL("drizzle/" + migration, root), "utf8"));
  }
  const savedTemplate = sqlite.prepare("INSERT INTO personal_library (owner, kind, id, payload, updated) VALUES (?, 'template', ?, ?, 'before')");
  savedTemplate.run("owner", templateId, JSON.stringify({ kind: "template", id: templateId, plan: currentTemplate }));
  savedTemplate.run("partner", templateId, JSON.stringify({ kind: "template", id: templateId, plan: { ...currentTemplate, minutes: 99 } }));

  const insert = sqlite.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, ?, ?, 'before')");
  insert.run("owner", "plan-id", "plan", JSON.stringify(booked));
  insert.run("owner", "log-id", "log", JSON.stringify({ plan: booked }));
  insert.run("partner", "partner-plan", "plan", JSON.stringify(booked));

  const read = sqlite.prepare("SELECT e.id, json_extract(t.payload, '$.plan.minutes') AS minutes FROM entries e" + ownTemplateJoin + "ORDER BY e.id");
  assert.deepEqual(read.all("owner").map((row) => [row.id, row.minutes]), [
    ["log-id", null], ["partner-plan", null], ["plan-id", 53],
  ]);
  assert.deepEqual(read.all("partner").map((row) => [row.id, row.minutes]), [
    ["log-id", null], ["partner-plan", 99], ["plan-id", null],
  ]);

  const db = { prepare(sql) {
    return { bind(...values) { return { run: () => sqlite.prepare(sql).run(...values) }; } };
  } };
  assert.equal(freezeTemplatePlans(db, "owner", templateId, "after").run().changes, 1);
  const stored = sqlite.prepare("SELECT payload, updated FROM entries WHERE owner = ? AND id = ?");
  const plan = stored.get("owner", "plan-id");
  assert.equal(plan.updated, "after");
  const frozen = JSON.parse(plan.payload);
  assert.equal(frozen.templateId, undefined);
  const { templateId: previousLink, ...materialized } = resolvePlanTemplate(booked, currentTemplate);
  assert.deepEqual(frozen, materialized);
  assert.deepEqual(planSchema.parse(frozen), frozen);
  assert.deepEqual(JSON.parse(stored.get("owner", "log-id").payload), { plan: booked });
  assert.deepEqual(JSON.parse(stored.get("partner", "partner-plan").payload), booked);

  const custom = { ...booked, ownExercises: true };
  insert.run("owner", "custom-plan", "plan", JSON.stringify(custom));
  assert.equal(freezeTemplatePlans(db, "owner", templateId, "later").run().changes, 1);
  const customFrozen = JSON.parse(stored.get("owner", "custom-plan").payload);
  assert.deepEqual(customFrozen.exercises, booked.exercises);
  assert.equal(customFrozen.minutes, currentTemplate.minutes);
  assert.equal(customFrozen.ownExercises, undefined);
  assert.equal(customFrozen.templateId, undefined);
});
