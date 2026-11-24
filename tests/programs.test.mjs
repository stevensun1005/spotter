import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env={}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const path = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(path)) return next(path.href, context);
  }
  return next(specifier, context);
} });
const { buildProgram, copyProgramWeek } = await import("../features/programs/builder.ts");
const { programSchema } = await import("../features/programs/model.ts");
const server = await import("../features/programs/server.ts");

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first(column) { const row = sqlite.prepare(sql).get(...args); return row ? column ? row[column] : row : null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
      };
    },
    async batch(statements) {
      if (this.beforeBatch) { const callback = this.beforeBatch; this.beforeBatch = null; callback(); }
      sqlite.exec("BEGIN IMMEDIATE");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { sqlite, db };
}
const template = (name = "合成力量") => ({
  title: name, date: "2026-11-24", category: "力量训练", minutes: 30, shared: false, video: "",
  exercises: [{ name: "哑铃卧推", sets: 3, reps: 8, weight: 10, unit: "kg", seconds: 0, tempo: "2-0-1-0", restSeconds: 90 }],
});
const create = (overrides = {}) => buildProgram({ title: "合成 4 周周期", startDate: "2026-11-23", weeks: 4,
  days: [1, 3, 5].map((day) => ({ day, plan: template() })), ...overrides });
const rejectStatus = (status) => (error) => error?.status === status;

test("program builder keeps explicit dates, private snapshots, and user-defined progression", () => {
  const source = template();
  source.templateId = crypto.randomUUID();
  source.shared = true;
  source.exercises.push({ ...source.exercises[0], name: "未知负荷", weight: 0 });
  const program = create({ days: [{ day: 1, plan: source }], progression: { weightPerWeek: 2.5, repsPerWeek: 1, deloadWeeks: [4], deloadPercent: 50 } });
  assert.deepEqual(program.sessions.map(({ plan }) => plan.date), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
  assert.deepEqual(program.sessions.map(({ plan }) => plan.exercises[0].weight), [10, 12.5, 15, 8.75]);
  assert.deepEqual(program.sessions.map(({ plan }) => plan.exercises[0].reps), [8, 9, 10, 11]);
  assert.ok(program.sessions.every(({ plan }) => !plan.shared && !plan.templateId && plan.exercises[1].weight === 0));
  assert.equal(source.exercises[0].weight, 10);
  assert.throws(() => create({ days: [{ day: 1, plan: source }, { day: 1, plan: source }] }));
});

test("week copies preserve target session identity and percentage prescriptions stay consistent", () => {
  const base = template();
  base.exercises[0] = { ...base.exercises[0], loadPercent: { percent: 50, reference: 100, unit: "lb" }, targetRpe: 8.5 };
  const progressed = create({ days: [{ day: 1, plan: base }], progression: { weightPerWeek: 2 } });
  assert.equal(progressed.sessions[0].plan.exercises[0].weight, 22.68);
  assert.equal(progressed.sessions[1].plan.exercises[0].loadPercent, undefined);
  assert.equal(progressed.sessions[1].plan.exercises[0].weight, 24.68);
  const copied = copyProgramWeek(progressed, 1, [2, 3]);
  assert.equal(copied.sessions.find(({ week }) => week === 2).id, progressed.sessions.find(({ week }) => week === 2).id);
  assert.equal(copied.sessions.find(({ week }) => week === 2).plan.date, "2026-11-30");
  assert.equal(copied.sessions.find(({ week }) => week === 2).plan.exercises[0].loadPercent.percent, 50);
  assert.equal(programSchema.safeParse({ ...progressed, sessions: [...progressed.sessions, progressed.sessions[0]] }).success, false);
  assert.equal(programSchema.safeParse({ ...progressed, sessions: [{ ...progressed.sessions[0], plan: { ...progressed.sessions[0].plan, date: "2026-11-24" } }] }).success, false);
});

test("multiweek commit supports more than twenty sessions, isolates accounts, and replays safely", async (t) => {
  const { sqlite, db } = fixture(t);
  const owner = "synthetic-owner";
  const program = create({ weeks: 12 });
  assert.equal(program.sessions.length, 36);
  const saved = await server.saveProgram(owner, program, null, db);
  await assert.rejects(server.readProgram("other-account", program.id, db), rejectStatus(404));
  const preview = await server.previewProgram(owner, program.id, saved.revision, db);
  assert.equal(preview.counts.new, 36);
  const result = await server.commitProgram(owner, program.id, saved.revision, preview.token, true, db);
  assert.equal(result.added, 36);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=?").get(owner).n, 36);
  const repeated = await server.commitProgram(owner, program.id, saved.revision, preview.token, true, db);
  assert.equal(repeated.replayed, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=?").get(owner).n, 36);
  assert.deepEqual(await server.readPrograms("other-account", db), []);
  const next = await server.previewProgram(owner, program.id, saved.revision, db);
  assert.equal(next.counts.unchanged, 36);
});

test("preview protects active, completed, deleted and manually edited calendar plans", async (t) => {
  const { sqlite, db } = fixture(t);
  const owner = "synthetic-owner";
  const program = create();
  const saved = await server.saveProgram(owner, program, null, db);
  const first = await server.previewProgram(owner, program.id, saved.revision, db);
  await server.commitProgram(owner, program.id, saved.revision, first.token, true, db);
  const [custom, started, completed, deleted] = program.sessions;
  sqlite.prepare("UPDATE entries SET payload=json_set(payload,'$.title','手工修改'),updated='custom' WHERE owner=? AND id=?").run(owner, custom.id);
  for (const [kind, planId] of [["draft", started.id], ["log", completed.id]]) {
    sqlite.prepare("INSERT INTO entries VALUES (?, ?, ?, ?, ?)").run(owner, crypto.randomUUID(), kind, JSON.stringify({ planId }), kind);
  }
  sqlite.prepare("UPDATE entries SET kind='deleted-plan',payload='{}',updated='deleted' WHERE owner=? AND id=?").run(owner, deleted.id);
  const changed = { ...program, sessions: program.sessions.map((session) => ({ ...session, plan: { ...session.plan, minutes: 40 } })) };
  const edited = await server.saveProgram(owner, changed, saved.revision, db);
  const preview = await server.previewProgram(owner, program.id, edited.revision, db);
  assert.equal(preview.counts.custom, 1);
  assert.equal(preview.counts.protected, 2);
  assert.equal(preview.counts.deleted, 1);
  assert.equal(preview.counts.update, 8);
  const result = await server.commitProgram(owner, program.id, edited.revision, preview.token, true, db);
  assert.equal(result.updated, 8);
  assert.equal(result.skipped, 4);
  assert.equal(JSON.parse(sqlite.prepare("SELECT payload FROM entries WHERE owner=? AND id=?").get(owner, custom.id).payload).title, "手工修改");
  await server.removeProgram(owner, program.id, edited.revision, db);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=?").get(owner).n, 14);
});

test("revision, rest-day and between-preview commit races cannot partially overwrite plans", async (t) => {
  const { sqlite, db } = fixture(t);
  const owner = "synthetic-owner";
  const program = create();
  const saved = await server.saveProgram(owner, program, null, db);
  await assert.rejects(server.saveProgram(owner, program, null, db), rejectStatus(409));
  const preview = await server.previewProgram(owner, program.id, saved.revision, db);
  const settings = { kind: "schedule", values: { weekdays: [], dates: [program.startDate] } };
  sqlite.prepare("INSERT INTO personal_library VALUES (?, 'schedule', 'schedule', NULL, ?, ?)").run(owner, JSON.stringify(settings), "rest");
  await assert.rejects(server.commitProgram(owner, program.id, saved.revision, preview.token, true, db), rejectStatus(409));
  const next = await server.previewProgram(owner, program.id, saved.revision, db);
  assert.equal(next.counts.blocked, 1);
  db.beforeBatch = () => sqlite.prepare("INSERT INTO entries VALUES (?, ?, 'draft', ?, ?)").run(owner, crypto.randomUUID(), JSON.stringify({ planId: program.sessions[1].id }), "new-draft");
  await assert.rejects(server.commitProgram(owner, program.id, saved.revision, next.token, true, db), rejectStatus(409));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE kind='plan'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM program_plan_links").get().n, 0);
});

test("coaching rules are private and protected by their own revision", async (t) => {
  const { db } = fixture(t);
  const first = await server.readRules("owner", db);
  assert.equal(first.revision, null);
  const value = { principles: "使用已有动作", progression: "只按确认的数字递增", equipment: "同一器械站", avoid: ["合成禁用动作"] };
  const saved = await server.saveRules("owner", value, null, db);
  await assert.rejects(server.saveRules("owner", value, null, db), rejectStatus(409));
  assert.deepEqual((await server.readRules("other-owner", db)).rules.avoid, []);
  const next = await server.saveRules("owner", { ...value, principles: "调整规则" }, saved.revision, db);
  assert.notEqual(next.revision, saved.revision);
});
