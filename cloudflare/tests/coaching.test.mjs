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
const server = await import("../features/coaching/server.ts");
const { learnerOverview, recordLesson } = await import("../features/coaching/progress-server.ts");
const { buildProgram } = await import("../features/programs/builder.ts");
const { saveProgram } = await import("../features/programs/server.ts");
const { startSession } = await import("../features/training/model.ts");
const coach = { id: "synthetic-coach", name: "合成教练" };
const learner = { id: "synthetic-learner", name: "合成学员" };
const other = { id: "synthetic-other", name: "合成第三人" };
const plan = (title = "合成力量") => ({ title, date: "2026-11-24", category: "力量训练", minutes: 30, shared: false, video: "",
  exercises: [{ name: "哑铃卧推", sets: 3, reps: 8, weight: 20, unit: "kg", seconds: 0, targetRpe: 7.5 }] });
const denied = (status) => (error) => error?.status === status;
function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  const db = {
    queries: 0,
    prepare(sql) {
      this.queries++;
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first(column) { db.beforeRead?.(sql); const row = sqlite.prepare(sql).get(...args); return row ? column ? row[column] : row : null; },
        async all() { db.beforeRead?.(sql); return { results: sqlite.prepare(sql).all(...args) }; },
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
  const mutate = (actor, input) => server.changeCoaching(db, actor, input);
  const link = async (student = learner) => {
    const { invite } = await mutate(coach, { action: "invite" });
    return (await mutate(student, { action: "join", code: invite.code, confirmed: true, shareDetails: false })).link;
  };
  const entry = (owner, id, kind, value, updated = new Date().toISOString()) => sqlite.prepare("INSERT INTO entries VALUES (?,?,?,?,?)").run(owner, id, kind, JSON.stringify(value), updated);
  const send = async (relationship, sourceKind = "plan", sourceId = crypto.randomUUID(), overrides = {}) => {
    if (sourceKind === "plan") entry(coach.id, sourceId, "plan", plan());
    const source = await server.coachingSource(db, coach.id, sourceKind, sourceId);
    const input = { action: "send", linkId: relationship.id, requestId: crypto.randomUUID(), source: { kind: sourceKind, id: sourceId, expectedHash: source.source.expectedHash }, startDate: "2026-12-01", note: "合成教学说明", ...overrides };
    const sent = await mutate(coach, input);
    return { input, assignment: sent.assignment, detail: await server.coachingDetail(db, learner.id, sent.assignment.id) };
  };
  const accept = async (id) => {
    const preview = await mutate(learner, { action: "preview", assignmentId: id });
    const input = { action: "accept", assignmentId: id, revision: preview.preview.revision, previewToken: preview.preview.token, confirmed: true };
    return { input, ...(await mutate(learner, input)) };
  };
  return { sqlite, db, mutate, link, entry, send, accept };
}

test("coaching invitations are hashed, one-use, expiring and create a new directed consent boundary on reconnect", async (t) => {
  const { sqlite, db, mutate, link } = fixture(t);
  const first = await mutate(coach, { action: "invite" });
  const stored = sqlite.prepare("SELECT * FROM coaching_invites").get();
  assert.notEqual(stored.code_hash, first.invite.code);
  assert.ok(!JSON.stringify(stored).includes(first.invite.code));
  await assert.rejects(mutate(coach, { action: "inspectInvite", code: first.invite.code }), denied(400));
  sqlite.prepare("UPDATE coaching_invites SET expires_at='2000-01-01T00:00:00.000Z'").run();
  await assert.rejects(mutate(learner, { action: "inspectInvite", code: first.invite.code }), denied(409));
  const second = await mutate(coach, { action: "invite" });
  await assert.rejects(mutate(learner, { action: "join", code: first.invite.code, confirmed: true, shareDetails: false }), denied(409));
  const joined = await mutate(learner, { action: "join", code: second.invite.code, confirmed: true, shareDetails: false });
  assert.equal(joined.link.coachId, coach.id);
  assert.equal(joined.link.studentId, learner.id);
  assert.equal(joined.link.shareDetails, false);
  await assert.rejects(mutate(other, { action: "join", code: second.invite.code, confirmed: true, shareDetails: false }), denied(409));
  await assert.rejects(mutate(coach, { action: "sharing", linkId: joined.link.id, shareDetails: true }), denied(403));
  await mutate(learner, { action: "disconnect", linkId: joined.link.id });
  assert.deepEqual(await mutate(learner, { action: "disconnect", linkId: joined.link.id }), { ok: true });
  const reconnected = await link();
  assert.notEqual(reconnected.id, joined.link.id);
  assert.equal((await server.coachingHome(db, learner)).links.length, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM friend_links").get().n, 0, "coaching does not create friendship sharing");
});

test("sending preserves an immutable reviewed snapshot, locks source changes and retries without duplicating learner data", async (t) => {
  const { sqlite, db, mutate, link, entry } = fixture(t);
  const relationship = await link();
  const templateId = crypto.randomUUID();
  sqlite.prepare("INSERT INTO personal_library VALUES (?, 'template', ?, NULL, ?, 'original')").run(coach.id, templateId, JSON.stringify({ kind: "template", id: templateId, plan: { ...plan(), shared: true } }));
  const reviewed = await server.coachingSource(db, coach.id, "template", templateId);
  const input = { action: "send", linkId: relationship.id, requestId: crypto.randomUUID(), source: { kind: "template", id: templateId, expectedHash: reviewed.source.expectedHash }, startDate: "2026-12-01", note: "合成说明" };
  sqlite.prepare("UPDATE personal_library SET payload=json_set(payload,'$.plan.exercises[0].weight',25) WHERE owner=? AND id=?").run(coach.id, templateId);
  await assert.rejects(mutate(coach, input), denied(409));
  input.source.expectedHash = (await server.coachingSource(db, coach.id, "template", templateId)).source.expectedHash;
  const sent = await mutate(coach, input);
  sqlite.prepare("UPDATE personal_library SET payload=json_set(payload,'$.plan.exercises[0].weight',30) WHERE owner=? AND id=?").run(coach.id, templateId);
  assert.equal((await mutate(coach, input)).assignment.id, sent.assignment.id, "same request retries the saved snapshot even after source edits");
  const detail = await server.coachingDetail(db, learner.id, sent.assignment.id);
  assert.equal(detail.program.sessions[0].plan.exercises[0].weight, 25);
  assert.equal(detail.program.sessions[0].plan.shared, false);
  assert.notEqual(detail.program.sessions[0].id, templateId);
  const preview = await mutate(learner, { action: "preview", assignmentId: sent.assignment.id });
  assert.equal(preview.preview.counts.new, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM training_programs WHERE owner=?").get(learner.id).n, 0, "preview creates no learner program");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=?").get(learner.id).n, 0, "send and preview do not schedule calendar plans");
  await assert.rejects(mutate(learner, { ...input, requestId: crypto.randomUUID() }), denied(403));
  const stolenId = crypto.randomUUID(); entry(other.id, stolenId, "plan", plan());
  await assert.rejects(mutate(coach, { ...input, requestId: crypto.randomUUID(), source: { kind: "plan", id: stolenId, expectedHash: "a".repeat(64) } }), denied(404));
});

test("learners explicitly accept whole multiweek copies with stable receipts and preserve calendar protections", async (t) => {
  const { sqlite, db, mutate, link, send, entry } = fixture(t);
  const relationship = await link();
  const source = buildProgram({ title: "合成多周教学", startDate: "2026-11-24", weeks: 6, days: [1, 3, 5, 7].map((day) => ({ day, plan: plan() })) });
  await saveProgram(coach.id, source, null, db);
  const { assignment, detail } = await send(relationship, "program", source.id);
  assert.equal(detail.program.sessions.length, 24);
  assert.ok(detail.program.sessions.every((session) => !source.sessions.some((original) => original.id === session.id)));
  const [custom, active, completed, removed, rest] = detail.program.sessions;
  entry(learner.id, custom.id, "plan", { ...custom.plan, title: "学员自己的改动" });
  entry(learner.id, crypto.randomUUID(), "draft", { planId: active.id });
  entry(learner.id, crypto.randomUUID(), "log", { planId: completed.id });
  entry(learner.id, removed.id, "deleted-plan", {});
  sqlite.prepare("INSERT INTO personal_library VALUES (?, 'schedule', 'schedule', NULL, ?, 'rest')").run(learner.id, JSON.stringify({ kind: "schedule", values: { weekdays: [], dates: [rest.plan.date] } }));
  const preview = await mutate(learner, { action: "preview", assignmentId: assignment.id });
  assert.equal(preview.preview.counts.custom, 1); assert.equal(preview.preview.counts.protected, 2); assert.equal(preview.preview.counts.deleted, 1); assert.equal(preview.preview.counts.blocked, 1);
  const input = { action: "accept", assignmentId: assignment.id, revision: preview.preview.revision, previewToken: preview.preview.token, confirmed: true };
  await assert.rejects(mutate(coach, input), denied(403));
  await assert.rejects(mutate(other, input), denied(404));
  const result = await mutate(learner, input);
  assert.equal(result.result.added, 19); assert.equal(result.result.skipped, 5);
  assert.equal((await mutate(learner, input)).result.replayed, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='plan'").get(learner.id).n, 20);
  assert.equal(JSON.parse(sqlite.prepare("SELECT payload FROM entries WHERE owner=? AND id=?").get(learner.id, custom.id).payload).title, "学员自己的改动");
  assert.equal((await server.coachingDetail(db, coach.id, assignment.id)).result.skipped, 5);
});

test("disconnect and new workout races fail the atomic import without partial learner writes", async (t) => {
  const { sqlite, db, mutate, link, send } = fixture(t);
  const relationship = await link();
  const first = await send(relationship);
  const firstPreview = await mutate(learner, { action: "preview", assignmentId: first.assignment.id });
  db.beforeBatch = () => sqlite.prepare("INSERT INTO entries VALUES (?,?,'draft',?,'new-active')").run(learner.id, crypto.randomUUID(), JSON.stringify({ planId: first.detail.program.sessions[0].id }));
  await assert.rejects(mutate(learner, { action: "accept", assignmentId: first.assignment.id, revision: firstPreview.preview.revision, previewToken: firstPreview.preview.token, confirmed: true }), denied(409));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM training_programs WHERE owner=?").get(learner.id).n, 0);
  const second = await send(relationship);
  const secondPreview = await mutate(learner, { action: "preview", assignmentId: second.assignment.id });
  db.beforeBatch = () => {
    sqlite.prepare("UPDATE coaching_links SET ended_at='disconnected' WHERE id=?").run(relationship.id);
    sqlite.prepare("UPDATE coaching_assignments SET status='cancelled' WHERE link_id=? AND status='pending'").run(relationship.id);
  };
  await assert.rejects(mutate(learner, { action: "accept", assignmentId: second.assignment.id, revision: secondPreview.preview.revision, previewToken: secondPreview.preview.token, confirmed: true }), denied(409));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='plan'").get(learner.id).n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM program_commits WHERE owner=?").get(learner.id).n, 0);
  const reconnect = await link(); assert.notEqual(reconnect.id, relationship.id);
  await assert.rejects(server.coachingDetail(db, coach.id, second.assignment.id), denied(403));
  await assert.rejects(mutate(learner, { action: "preview", assignmentId: second.assignment.id }), denied(403));
});

test("feedback is intentional and consent revocation strips recorded sets even during a detail read", async (t) => {
  const { sqlite, db, mutate, link, send, accept, entry } = fixture(t);
  const relationship = await link();
  const { assignment, detail } = await send(relationship);
  await accept(assignment.id);
  const session = startSession(detail.program.sessions[0].plan, detail.program.sessions[0].id, "2026-12-01");
  session.note = "PRIVATE_SESSION_MARKER"; session.proteinShake = true; session.minutes = 20;
  session.rows[0][0].done = true; session.rows[0][0].rpe = 8;
  entry(learner.id, crypto.randomUUID(), "log", session);
  const unrelated = { ...session, planId: crypto.randomUUID(), note: "UNRELATED_MARKER" };
  entry(learner.id, crypto.randomUUID(), "log", unrelated);
  let shown = await server.coachingDetail(db, coach.id, assignment.id);
  assert.equal(shown.assignment.progress.completed, 1); assert.equal(shown.sessions[0].actual, null);
  await mutate(learner, { action: "sharing", linkId: relationship.id, shareDetails: true });
  await mutate(learner, { action: "feedback", assignmentId: assignment.id, note: "主动发给教练的合成反馈" });
  shown = await server.coachingDetail(db, coach.id, assignment.id);
  assert.equal(shown.sessions[0].actual.exercises[0].sets[0].rpe, 8);
  assert.equal(shown.feedback.note, "主动发给教练的合成反馈");
  for (const forbidden of ["PRIVATE_SESSION_MARKER", "UNRELATED_MARKER", "proteinShake", "workout_heart", "nutrition"]) assert.ok(!JSON.stringify(shown).includes(forbidden));
  db.beforeRead = (sql) => { if (sql.startsWith("SELECT a.feedback,a.feedback_at")) { db.beforeRead = null; sqlite.prepare("UPDATE coaching_links SET share_details=0 WHERE id=?").run(relationship.id); } };
  assert.equal((await server.coachingDetail(db, coach.id, assignment.id)).sessions[0].actual, null);
  db.beforeRead = (sql) => { if (sql.startsWith("SELECT a.feedback,a.feedback_at")) { db.beforeRead = null; sqlite.prepare("UPDATE coaching_links SET ended_at='ended' WHERE id=?").run(relationship.id); } };
  await assert.rejects(server.coachingDetail(db, coach.id, assignment.id), denied(403));
  assert.equal((await server.coachingDetail(db, learner.id, assignment.id)).sessions[0].actual.minutes, 20, "learners retain their own records");
});

test("coaching home bounds D1 query count and returns metadata instead of whole source or session payloads", async (t) => {
  const { sqlite, db, link, send, accept, entry } = fixture(t);
  const relationship = await link();
  const { assignment } = await send(relationship); await accept(assignment.id);
  for (let index = 0; index < 100; index++) entry(coach.id, crypto.randomUUID(), "plan", plan("合成候选 " + index));
  const saved = sqlite.prepare("SELECT * FROM coaching_assignments WHERE id=?").get(assignment.id);
  for (let index = 0; index < 99; index++) sqlite.prepare("INSERT INTO coaching_assignments(id,link_id,coach_id,student_id,request_hash,kind,payload,revision,program_id,note,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'accepted',?)")
    .run(crypto.randomUUID(), saved.link_id, coach.id, learner.id, saved.request_hash, saved.kind, saved.payload, saved.revision, crypto.randomUUID(), "", new Date().toISOString());
  db.queries = 0;
  const home = await server.coachingHome(db, coach);
  assert.equal(home.assignments.length, 100); assert.equal(home.sources.length, 100);
  assert.ok(db.queries <= 7, "home query count must not grow per assignment or source");
  assert.ok(home.sources.every((source) => !source.expectedHash));
  assert.ok(!JSON.stringify(home).includes('"exercises"'));
  assert.ok(!JSON.stringify(home).includes('"payload"'));
});

test("learner overview counts assigned check-ins only and honors current sharing and dates", async (t) => {
  const { db, mutate, link, send, accept, entry } = fixture(t);
  const relationship = await link();
  const { assignment, detail } = await send(relationship);
  await accept(assignment.id);
  const assigned = detail.program.sessions[0];
  const checkedIn = startSession(assigned.plan, assigned.id, "2026-12-08");
  checkedIn.minutes = 30;
  checkedIn.note = "PRIVATE_PROGRESS_MARKER";
  checkedIn.rows[0][0] = { ...checkedIn.rows[0][0], done: true, right: { weight: 10, reps: 7 } };
  entry(learner.id, crypto.randomUUID(), "log", checkedIn);
  entry(learner.id, crypto.randomUUID(), "draft", checkedIn);
  entry(other.id, crypto.randomUUID(), "log", checkedIn);
  entry(learner.id, crypto.randomUUID(), "log", { ...checkedIn, planId: crypto.randomUUID() });
  const firstWeek = { learner: relationship.id, from: "2026-11-30", to: "2026-12-06" };
  assert.deepEqual((await learnerOverview(db, coach.id, firstWeek)).summary, { sessions: 1, days: 1, minutes: null, sets: null, volumeKg: null });
  await mutate(learner, { action: "sharing", linkId: relationship.id, shareDetails: true });
  assert.equal((await learnerOverview(db, coach.id, firstWeek)).summary.sessions, 0);
  const actual = await learnerOverview(db, coach.id, { ...firstWeek, from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(actual.summary, { sessions: 1, days: 1, minutes: 30, sets: 1, volumeKg: 230 });
  assert.equal(actual.balance, 0);
  assert.deepEqual(actual.lessons, []);
  assert.ok(!JSON.stringify(actual).includes("PRIVATE_PROGRESS_MARKER"));
  await assert.rejects(learnerOverview(db, learner.id, firstWeek), denied(404));
  await mutate(learner, { action: "disconnect", linkId: relationship.id });
  await assert.rejects(learnerOverview(db, coach.id, firstWeek), denied(404));
});

test("lesson ledger debits once, protects balances and reversals, and isolates relationships", async (t) => {
  const { db, link } = fixture(t);
  const relationship = await link();
  const another = await link(other);
  const write = (values, actor = coach.id) => recordLesson(db, actor, {
    action: "lesson", linkId: relationship.id, requestId: crypto.randomUUID(), note: "", ...values,
  });
  const read = () => learnerOverview(db, coach.id, { learner: relationship.id, from: "2026-12-01", to: "2026-12-31" });
  const credit = { change: "credit", quantity: 3, requestId: crypto.randomUUID(), note: "合成课时" };
  await assert.rejects(write(credit, learner.id), denied(404));
  await write(credit);
  await write(credit);
  await assert.rejects(write({ ...credit, quantity: 4 }), denied(409));
  const debit = { change: "debit", quantity: 2, requestId: crypto.randomUUID() };
  await Promise.all([write(debit), write(debit)]);
  assert.equal((await read()).balance, 1);
  await assert.rejects(write({ change: "debit", quantity: 2 }), denied(409));
  await assert.rejects(write({ change: "reverse", lessonId: credit.requestId }), denied(409));
  await assert.rejects(write({ linkId: another.id, change: "reverse", lessonId: debit.requestId }), denied(409));
  const reversal = { change: "reverse", lessonId: debit.requestId, requestId: crypto.randomUUID() };
  await write(reversal);
  await write(reversal);
  await assert.rejects(write({ change: "reverse", lessonId: debit.requestId }), denied(409));
  await assert.rejects(write({ change: "reverse", lessonId: reversal.requestId }), denied(409));
  const final = await read();
  assert.equal(final.balance, 3);
  assert.equal(final.lessons.length, 3);
  assert.equal(final.lessons.find(({ id }) => id === debit.requestId).reversed, true);
  assert.equal(final.lessons.find(({ id }) => id === reversal.requestId).reverses, debit.requestId);
});
