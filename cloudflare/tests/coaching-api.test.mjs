import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
globalThis.__spotterCoachingEnv = {};
globalThis.__spotterCoachingUser = null;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__spotterCoachingEnv;", shortCircuit: true };
  if (specifier === "@/app/chatgpt-auth") return { url: "data:text/javascript,export async function getChatGPTUser(){return globalThis.__spotterCoachingUser}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const route = await import("../app/api/coaching/route.ts");
const { startSession } = await import("../features/training/model.ts");
const origin = "https://coaching.synthetic.invalid";
const coach = { userId: "synthetic-coach", fullName: "合成教练", email: "coach@example.invalid" };
const student = { userId: "synthetic-student", fullName: "合成学员", email: "student@example.invalid" };
const outsider = { userId: "synthetic-outsider", fullName: "合成好友", email: "friend@example.invalid" };
const plan = { title: "合成教练力量训练", date: "2026-12-01", category: "力量训练", minutes: 30,
  shared: true, video: "", exercises: [{ name: "哑铃卧推", sets: 2, reps: 8, weight: 15, unit: "kg", seconds: 0 }] };

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("drizzle/", root)).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
  const db = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let values = [];
    return { bind(...args) { values = args; return this; }, async first(column) { const row = statement.get(...values); return row ? column ? row[column] : row : null; },
      async all() { return { results: statement.all(...values) }; }, async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; } };
  }, async batch(statements) {
    sqlite.exec("BEGIN IMMEDIATE");
    try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  globalThis.__spotterCoachingEnv.DB = db;
  t.after(() => { sqlite.close(); globalThis.__spotterCoachingEnv.DB = undefined; globalThis.__spotterCoachingUser = null; });
  return db;
}
function request(body, query = "", suppliedOrigin = origin) {
  return new Request(origin + "/api/coaching" + query, { method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", ...(suppliedOrigin === null ? {} : { Origin: suppliedOrigin }) } : {},
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function post(user, body, suppliedOrigin = origin) {
  globalThis.__spotterCoachingUser = user;
  return route.POST(request(body, "", suppliedOrigin));
}
async function get(user, id) {
  globalThis.__spotterCoachingUser = user;
  return route.GET(request(undefined, id ? "?assignment=" + id : ""));
}
async function success(response) {
  const payload = await response.json();
  assert.equal(response.status, 200, payload.error ?? "expected a successful coaching request");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return payload;
}
async function denied(response) {
  assert.ok([403, 404, 409].includes(response.status), "operation should reject a role or relationship without returning private data");
  const body = await response.json();
  assert.ok(typeof body.error === "string");
  return body;
}
function saveEntry(db, owner, id, kind, payload) {
  db.sqlite.prepare("INSERT INTO entries(owner,id,kind,payload,updated) VALUES(?,?,?,?,?)").run(owner, id, kind, JSON.stringify(payload), new Date().toISOString());
}
async function connected(db) {
  const created = await success(await post(coach, { action: "invite" }));
  assert.match(created.invite.code, /^[a-f0-9]{64}$/);
  const inspected = await success(await post(student, { action: "inspectInvite", code: created.invite.code }));
  assert.equal(inspected.coachName, coach.fullName);
  const joined = await success(await post(student, { action: "join", code: created.invite.code, confirmed: true, shareDetails: false }));
  const id = crypto.randomUUID();
  saveEntry(db, coach.userId, id, "plan", plan);
  globalThis.__spotterCoachingUser = coach;
  const source = await success(await route.GET(request(undefined, "?sourceKind=plan&sourceId=" + id)));
  assert.match(source.source.expectedHash, /^[a-f0-9]{64}$/);
  return { link: joined.link, sourceId: id, expectedHash: source.source.expectedHash, code: created.invite.code };
}
async function sent(db, connection) {
  return (await success(await post(coach, { action: "send", linkId: connection.link.id, requestId: crypto.randomUUID(),
    source: { kind: "plan", id: connection.sourceId, expectedHash: connection.expectedHash }, startDate: "2026-12-03", note: "合成教练说明" }))).assignment;
}
async function acceptancePreview(assignment) {
  return success(await post(student, { action: "preview", assignmentId: assignment.id }));
}
function acceptBody(assignment, preview) {
  return { action: "accept", assignmentId: assignment.id, revision: preview.preview.revision, previewToken: preview.preview.token, confirmed: true };
}

test("coaching production route requires a browser account and same-origin writes", async (t) => {
  fixture(t);
  assert.equal((await get(null)).status, 401);
  assert.equal((await post(null, { action: "invite" })).status, 401);
  assert.equal((await post(coach, { action: "invite" }, "https://untrusted.invalid")).status, 403);
  assert.equal((await post(coach, { action: "invite" }, null)).status, 403);
  const forged = { action: "invite", owner: student.userId };
  assert.equal((await post(coach, forged)).status, 400, "the caller cannot nominate a different owner");
});

test("coaching route preserves direction, invitation consent and assigned-plan account isolation", async (t) => {
  const db = fixture(t);
  const connection = await connected(db);
  await denied(await post(outsider, { action: "join", code: connection.code, confirmed: true, shareDetails: false }));
  const assignment = await sent(db, connection);
  const source = { kind: "plan", id: connection.sourceId, expectedHash: connection.expectedHash };
  globalThis.__spotterCoachingUser = student;
  await denied(await route.GET(request(undefined, "?sourceKind=plan&sourceId=" + connection.sourceId)));
  await denied(await post(student, { action: "send", linkId: connection.link.id, requestId: crypto.randomUUID(), source, startDate: "2026-12-03", note: "" }));
  await denied(await post(coach, { action: "sharing", linkId: connection.link.id, shareDetails: true }));
  const preview = await acceptancePreview(assignment);
  assert.equal(preview.preview.counts.new, 1);
  await denied(await post(coach, acceptBody(assignment, preview)));
  await denied(await get(outsider, assignment.id));
  const accepted = await success(await post(student, acceptBody(assignment, preview)));
  assert.equal(accepted.result.added, 1);
  const repeat = await success(await post(student, acceptBody(assignment, preview)));
  assert.equal(repeat.result.added, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='plan'").get(student.userId).n, 1);
  const detail = await success(await get(student, assignment.id));
  assert.equal(detail.program.sessions[0].plan.date, "2026-12-03");
  assert.equal(detail.program.sessions[0].plan.shared, false, "coach assignment cannot inherit the coach's buddy sharing flag");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='plan'").get(coach.userId).n, 1);
});

test("a linked plan's source preview becomes stale when its template changes", async (t) => {
  const db = fixture(t);
  const connection = await connected(db);
  const templateId = crypto.randomUUID();
  const template = { kind: "template", id: templateId, plan: { ...plan, shared: false } };
  db.sqlite.prepare("INSERT INTO personal_library(owner,kind,id,payload,updated) VALUES(?,?,?,?,?)")
    .run(coach.userId, "template", templateId, JSON.stringify(template), new Date().toISOString());
  const storedPlan = JSON.stringify({ ...plan, templateId });
  db.sqlite.prepare("UPDATE entries SET payload=? WHERE owner=? AND id=?").run(storedPlan, coach.userId, connection.sourceId);
  globalThis.__spotterCoachingUser = coach;
  const inspected = await success(await route.GET(request(undefined, "?sourceKind=plan&sourceId=" + connection.sourceId)));
  template.plan.exercises[0] = { ...template.plan.exercises[0], name: "哑铃深蹲", weight: 20 };
  db.sqlite.prepare("UPDATE personal_library SET payload=? WHERE owner=? AND kind='template' AND id=?")
    .run(JSON.stringify(template), coach.userId, templateId);
  assert.equal(db.sqlite.prepare("SELECT payload FROM entries WHERE owner=? AND id=?").get(coach.userId, connection.sourceId).payload, storedPlan, "only the linked template changed");
  const response = await post(coach, { action: "send", linkId: connection.link.id, requestId: crypto.randomUUID(),
    source: { kind: "plan", id: connection.sourceId, expectedHash: inspected.source.expectedHash }, startDate: "2026-12-03", note: "" });
  assert.equal(response.status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM coaching_assignments").get().n, 0);
  globalThis.__spotterCoachingUser = coach;
  const current = await success(await route.GET(request(undefined, "?sourceKind=plan&sourceId=" + connection.sourceId)));
  assert.notEqual(current.source.expectedHash, inspected.source.expectedHash);
});

test("coaching feedback projects consented assigned training only and disconnect stops future access", async (t) => {
  const db = fixture(t);
  const connection = await connected(db);
  const assignment = await sent(db, connection);
  const preview = await acceptancePreview(assignment);
  await success(await post(student, acceptBody(assignment, preview)));
  const detail = await success(await get(student, assignment.id));
  const session = detail.program.sessions[0];
  const completed = startSession(session.plan, session.id, session.plan.date);
  completed.note = "PRIVATE_SESSION_NOTE_MARKER";
  completed.proteinShake = true;
  completed.minutes = 25;
  completed.ended = completed.started + 1_500_000;
  for (const row of completed.rows) for (const set of row) { set.done = true; set.weight = 17.5; set.rpe = 8; }
  const logId = crypto.randomUUID();
  saveEntry(db, student.userId, logId, "log", completed);
  saveEntry(db, student.userId, crypto.randomUUID(), "log", { ...completed, planId: crypto.randomUUID(), note: "PRIVATE_UNRELATED_WORKOUT" });
  db.sqlite.prepare("INSERT INTO workout_heart(owner,workout_id,payload) VALUES(?,?,?)").run(student.userId, logId, JSON.stringify({ marker: "PRIVATE_HEART_MARKER" }));
  db.sqlite.prepare("INSERT INTO personal_library(owner,kind,id,payload,updated) VALUES(?,?,?,?,?)").run(student.userId, "nutrition", crypto.randomUUID(), JSON.stringify({ marker: "PRIVATE_BODY_FOOD_MARKER" }), new Date().toISOString());
  const [first, second] = [outsider.userId, student.userId].sort();
  db.sqlite.prepare("INSERT INTO friend_links(first_id,second_id,first_name,second_name,linked,first_training,second_training) VALUES(?,?,?,?,1,1,1)").run(first, second, "Synthetic friend", "Synthetic student");
  await denied(await get(outsider, assignment.id));
  const hidden = await success(await get(coach, assignment.id));
  assert.equal(hidden.detailsShared, false);
  assert.equal(hidden.sessions.length, 1);
  assert.equal(hidden.sessions[0].status, "completed");
  assert.equal(hidden.sessions[0].actual, null);
  assert.equal(hidden.assignment.progress.completed, 1);
  await success(await post(student, { action: "sharing", linkId: connection.link.id, shareDetails: true }));
  const shared = await success(await get(coach, assignment.id));
  assert.equal(shared.detailsShared, true);
  assert.equal(shared.sessions[0].actual.exercises[0].sets[0].weight, 17.5);
  assert.equal(shared.sessions[0].actual.exercises[0].sets[0].rpe, 8);
  for (const response of [hidden, shared]) {
    const serialized = JSON.stringify(response);
    for (const marker of ["PRIVATE_SESSION_NOTE_MARKER", "PRIVATE_UNRELATED_WORKOUT", "PRIVATE_HEART_MARKER", "PRIVATE_BODY_FOOD_MARKER", "proteinShake"]) assert.equal(serialized.includes(marker), false, marker + " must remain private");
  }
  const pending = await sent(db, connection);
  const pendingPreview = await acceptancePreview(pending);
  await success(await post(student, { action: "disconnect", linkId: connection.link.id }));
  await denied(await get(coach, assignment.id));
  const disconnectedHome = await success(await get(coach));
  assert.equal(disconnectedHome.assignments.find((item) => item.id === assignment.id)?.progress ?? null, null, "the roster must stop exposing progress after disconnect too");
  await denied(await post(student, acceptBody(pending, pendingPreview)));
  await denied(await post(coach, { action: "send", linkId: connection.link.id, requestId: crypto.randomUUID(), source: { kind: "plan", id: connection.sourceId, expectedHash: connection.expectedHash }, startDate: "2026-12-10", note: "" }));
  const freshInvite = await success(await post(coach, { action: "invite" }));
  const reconnected = await success(await post(student, { action: "join", code: freshInvite.invite.code, confirmed: true, shareDetails: false }));
  assert.notEqual(reconnected.link.id, connection.link.id);
  await denied(await get(coach, assignment.id));
  await denied(await post(student, acceptBody(pending, pendingPreview)));
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='plan'").get(student.userId).n, 1, "disconnect retains the student's accepted calendar plan");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries WHERE owner=? AND kind='log'").get(student.userId).n, 2, "disconnect retains completed history");
});
