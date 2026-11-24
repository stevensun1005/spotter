import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
const { env } = await import("cloudflare:workers");
const { previewMove, reschedule } = await import("../features/plans/schedule-server.ts");
const { deletePlan, writePlans } = await import("../features/plans/plan-server.ts");
const { removeLibrary, saveLibrary } = await import("../features/library/server.ts");

const owner = "synthetic-account";
const stamp = "2026-11-24T12:00:00.000Z";
const id = () => crypto.randomUUID();
const date = (day) => "2026-11-" + day;
const conflict = (error) => error?.status === 409;
function plan(title, value, extra = {}) {
  return { title, date: value, category: "力量训练", minutes: 20, shared: false, video: "",
    exercises: [{ name: "平板支撑", sets: 3, reps: 0, weight: 0, unit: "kg", seconds: 30 }], ...extra };
}

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE entries (owner TEXT,id TEXT,kind TEXT,payload TEXT,updated TEXT,PRIMARY KEY(owner,id));
    CREATE TABLE personal_library (owner TEXT,kind TEXT,id TEXT,day TEXT,payload TEXT,updated TEXT,PRIMARY KEY(owner,kind,id));
  `);
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first(column) { const row = sqlite.prepare(sql).get(...args); return row ? column ? row[column] : row : null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() {
          db.beforeRun?.(sql);
          const statement = sqlite.prepare(sql);
          if (sql.startsWith("SELECT ")) return { results: statement.all(...args), meta: { changes: 0 } };
          return { results: [], meta: { changes: Number(statement.run(...args).changes) } };
        },
      };
    },
    async batch(statements) {
      const results = [];
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  env.DB = db;
  function entry(entryId, kind, payload, user = owner, revision = stamp) {
    sqlite.prepare("INSERT INTO entries VALUES (?,?,?,?,?)").run(user, entryId, kind, JSON.stringify(payload), revision);
  }
  function read(entryId, user = owner) {
    const row = sqlite.prepare("SELECT * FROM entries WHERE owner=? AND id=?").get(user, entryId);
    return row && { ...row, data: JSON.parse(row.payload) };
  }
  return { db, entry, read };
}

test("a cycle shift moves only its unstarted sessions and preserves independent, early-completed and partner plans", async (t) => {
  const { db, entry, read } = fixture(t);
  const [programId, otherProgram, first, second, ownNext, other, independent, early] = Array.from({ length: 8 }, id);
  entry(first, "plan", plan("W01 D1 循环 A", date(24), { programId }));
  entry(second, "plan", plan("W01 D2 循环 A", date(25), { programId }));
  entry(ownNext, "plan", plan("下一节", date(26), { programId }));
  entry(other, "plan", plan("W01 D1 循环 B", date(27), { programId: otherProgram }));
  entry(independent, "plan", plan("W01 D3 未分组", date(29)));
  entry(early, "plan", plan("W01 D4 已完成", date(30), { programId }));
  entry(first, "plan", plan("合成其他账号", date(24), { programId }), "other-account");
  entry(id(), "draft", { planId: second, date: date(23) });
  entry(id(), "log", { planId: early, date: date(22) });
  const choice = { id: first, from: date(24), date: date(26), shift: true, revision: stamp };
  const preview = await previewMove(db, owner, choice);
  assert.deepEqual(preview.changes.map(({ id, from, date }) => [id, from, date]), [
    [first, date(24), date(26)], [ownNext, date(26), date(28)],
  ]);
  assert.equal(read(first).data.date, date(24));
  await assert.rejects(reschedule(db, owner, { ...choice, date: date(28) }, preview.token, stamp), conflict);
  await assert.rejects(previewMove(db, owner, { ...choice, id: second, from: date(25) }), conflict);
  await assert.rejects(previewMove(db, owner, { ...choice, id: early, from: date(30), shift: false }), conflict);
  assert.deepEqual(await reschedule(db, owner, choice, preview.token, stamp), { moved: 2, date: date(26) });
  assert.equal(read(first).updated, "2026-11-24T12:00:00.001Z");
  assert.equal(read(ownNext).data.date, date(28));
  assert.equal(read(second).data.date, date(25));
  assert.equal(read(other).data.date, date(27));
  assert.equal(read(independent).data.date, date(29));
  assert.equal(read(early).data.date, date(30));
  assert.equal(read(first, "other-account").data.date, date(24));
});

test("overdue standalone suggestions skip unavailable days without committing or grouping", async (t) => {
  const { db, entry, read } = fixture(t);
  const a = id(), b = id();
  entry(a, "plan", plan("W01 D1 旧计划", date(24)));
  entry(b, "plan", plan("W01 D2 另一个计划", date(26)));
  await saveLibrary(owner, { kind: "schedule", values: { dates: [date(25)], weekdays: [] } }, null);
  const choice = { id: a, from: date(24), date: date(25), shift: false, revision: stamp, nextAvailable: true };
  await assert.rejects(previewMove(db, owner, { ...choice, shift: true }), (error) => error?.status === 400);
  const preview = await previewMove(db, owner, choice);
  assert.deepEqual(preview.changes.map(({ id, date }) => [id, date]), [[a, date(27)]]);
  assert.equal(read(a).data.date, date(24));
  await reschedule(db, owner, choice, preview.token, stamp);
  assert.equal(read(a).data.date, date(27));
  assert.equal(read(b).data.date, date(26));
});

test("schedule or training changes invalidate a reviewed move and its final SQL write", async (t) => {
  const { db, entry, read } = fixture(t);
  const [first, next, programId] = Array.from({ length: 3 }, id);
  entry(first, "plan", plan("循环首节", date(24), { programId }));
  entry(next, "plan", plan("循环次节", date(26), { programId }));
  const choice = { id: first, from: date(24), date: date(25), shift: true, revision: stamp };
  const initial = await previewMove(db, owner, choice);
  await saveLibrary(owner, { kind: "schedule", values: { dates: [date(27)], weekdays: [] } }, null);
  await assert.rejects(reschedule(db, owner, choice, initial.token, stamp), conflict);
  const refreshed = await previewMove(db, owner, choice);
  db.beforeRun = (sql) => {
    if (!sql.startsWith("WITH changes")) return;
    entry(id(), "draft", { planId: next, date: date(24) });
    db.beforeRun = undefined;
  };
  await assert.rejects(reschedule(db, owner, choice, refreshed.token, stamp), conflict);
  assert.equal(read(first).data.date, date(24));
  assert.equal(read(next).data.date, date(26));
});

test("ordinary stale plan writes and deletions preserve the latest data and reject an entire mixed batch", async (t) => {
  const { db, entry, read } = fixture(t);
  const existing = id(), added = id();
  const original = plan("午间训练", date(24));
  await writePlans(db, owner, [{ id: existing, data: original }], stamp, {});
  const fresh = { ...original, date: date(25) };
  await writePlans(db, owner, [{ id: existing, data: fresh, revision: stamp }], stamp, {});
  const actual = read(existing);
  assert.notEqual(actual.updated, stamp);
  await assert.rejects(writePlans(db, owner, [{ id: existing, data: original }], stamp, {}), conflict);
  await assert.rejects(writePlans(db, owner, [
    { id: existing, data: original, revision: stamp },
    { id: added, data: plan("合成加练", date(27)) },
  ], stamp, {}), conflict);
  assert.equal(read(added), undefined);
  await assert.rejects(deletePlan(db, owner, existing, stamp, stamp), conflict);
  entry(id(), "log", { planId: existing, date: date(23) });
  await assert.rejects(writePlans(db, owner, [{ id: existing, data: original, revision: actual.updated }], stamp, {}), conflict);
  assert.deepEqual(read(existing).data, fresh);
  await deletePlan(db, owner, existing, actual.updated, stamp);
  assert.equal(read(existing).kind, "deleted-plan");
});

test("scheduled import deduplicates, and revision import retains date, share and cycle linkage", async (t) => {
  const { db, entry, read } = fixture(t);
  const first = id(), programId = id(), programSessionId = id();
  const original = plan("原训练", date(24), { shared: true, programId, programSessionId, week: 1, day: 2 });
  entry(first, "plan", original);
  const imported = plan("新训练", date(26));
  assert.deepEqual(await writePlans(db, owner, [
    { id: id(), data: imported }, { id: id(), data: imported },
  ], stamp, { skipExisting: true }), { added: 1, skipped: 1 });
  const update = plan("原训练", date(25), { minutes: 40, programId: id(), week: 2 });
  assert.deepEqual(await writePlans(db, owner, [{ id: first, data: update, revision: stamp }], stamp, { reviseExisting: true }), { revised: 1 });
  assert.deepEqual(read(first).data, { ...original, minutes: 40 });
  await assert.rejects(writePlans(db, owner, [{ id: first, data: update, revision: stamp }], stamp, { reviseExisting: true }), conflict);
});

test("template and schedule edits check revisions and stale template deletion does not freeze linked plans", async (t) => {
  const { entry, read } = fixture(t);
  const templateId = id(), linked = id();
  const original = { kind: "template", id: templateId, plan: plan("模板", date(24)) };
  const before = await saveLibrary(owner, original, null);
  const after = await saveLibrary(owner, { ...original, plan: { ...original.plan, minutes: 40 } }, before);
  assert.notEqual(after, before);
  entry(linked, "plan", plan("从模板安排", date(25), { templateId }));
  await assert.rejects(saveLibrary(owner, original, before), conflict);
  await assert.rejects(removeLibrary(owner, "template", templateId, before), conflict);
  assert.equal(read(linked).data.templateId, templateId);
  await removeLibrary(owner, "template", templateId, after);
  assert.equal(read(linked).data.templateId, undefined);
  assert.equal(read(linked).data.minutes, 40);
  const settings = { kind: "schedule", values: { dates: [date(25)], weekdays: [] } };
  const first = await saveLibrary(owner, settings, null);
  await assert.rejects(saveLibrary(owner, settings, null), conflict);
  await saveLibrary(owner, { ...settings, values: { dates: [date(26)], weekdays: [] } }, first);
  await assert.rejects(saveLibrary(owner, settings, first), conflict);
});
