import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env={};", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const store = await import("../features/agent-access/store.ts");
const model = await import("../features/agent-access/model.ts");
const { agentProfileRef } = await import("../features/agent/profile.ts");
const { planningContext } = await import("../features/agent-access/context.ts");
const { callPlanningTool, toolsFor } = await import("../features/agent-access/tools.ts");

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of readdirSync(new URL("drizzle/", root)).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
  return { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { return { meta: { changes: statement.run(...values).changes } }; } };
  }, async batch(statements) {
    sqlite.exec("BEGIN IMMEDIATE");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
}
const owner = "synthetic-agent-owner";
const other = "synthetic-second-owner";
const plan = { title: "Synthetic strength", date: "2026-11-25", category: "力量训练", minutes: 35, video: "", shared: false,
  exercises: [{ name: "哑铃卧推", sets: 3, reps: 8, weight: 15, unit: "kg", seconds: 0, tempo: "2-0-1-0" }] };
const tokenRequest = (token, origin) => new Request("https://synthetic.invalid/api/agent/context", { headers: { Authorization: "Bearer " + token, ...(origin && { Origin: origin }) } });

test("personal Agent tokens are hashed, scoped, expiring, revocable and account-bound", async (t) => {
  const db = fixture(t);
  const issued = await store.createConnection(db, owner, { name: "Synthetic Claude", scopes: ["read:context", "plans:draft"], expiresInDays: 1 });
  const row = db.sqlite.prepare("SELECT * FROM agent_connections WHERE id = ?").get(issued.connection.id);
  assert.notEqual(row.token_hash, issued.token);
  assert.equal(JSON.stringify(await store.listConnections(db, owner)).includes(issued.token), false);
  assert.deepEqual(await store.listConnections(db, other), []);
  const principal = await store.authenticateAgent(db, tokenRequest(issued.token));
  assert.equal(principal.owner, owner);
  assert.throws(() => store.requireScope(principal, "plans:write"), { status: 403 });
  assert.doesNotThrow(() => store.requireScope(principal, "plans:draft"));
  await assert.rejects(store.authenticateAgent(db, tokenRequest(issued.token, "https://foreign.invalid")), { status: 403 });
  await assert.rejects(store.authenticateAgent(db, tokenRequest(issued.token + "0")), { status: 401 });
  await assert.rejects(store.authenticateAgent(db, tokenRequest(issued.token), Date.parse(issued.connection.expiresAt)), { status: 401 });
  await assert.rejects(store.revokeConnection(db, other, issued.connection.id), { status: 404 });
  await store.revokeConnection(db, owner, issued.connection.id);
  await assert.rejects(store.authenticateAgent(db, tokenRequest(issued.token)), { status: 401 });
});

test("Agent schemas require account reference, explicit confirmation and bounded drafts", async () => {
  const profileRef = await agentProfileRef(owner);
  const request = { profileRef, requestId: crypto.randomUUID(), plans: [plan] };
  assert.ok(model.stagePlansInput.safeParse(request).success);
  assert.equal(model.stagePlansInput.safeParse({ ...request, owner: other }).success, false);
  assert.equal(model.stagePlansInput.safeParse({ ...request, plans: Array(21).fill(plan) }).success, false);
  assert.equal(model.stagePlansInput.safeParse({ ...request, plans: [{ ...plan, date: "2026-02-30" }] }).success, false);
  assert.equal(model.commitDraftInput.safeParse({ profileRef, draftId: request.requestId, revision: "a".repeat(64), confirmed: false }).success, false);
  assert.equal(model.commitDraftInput.safeParse({ profileRef, draftId: request.requestId, confirmed: true }).success, false);
  await assert.rejects(store.verifyProfile(owner, await agentProfileRef(other)), { status: 403 });
});

test("plan drafting is a private preview; editing is revision-checked and commits retry without duplicates", async (t) => {
  const db = fixture(t);
  const input = { requestId: crypto.randomUUID(), title: "Synthetic 4-week block", plans: [plan] };
  const first = await store.stageDraft(db, owner, input);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 0);
  assert.equal((await store.stageDraft(db, owner, input)).revision, first.revision);
  await assert.rejects(store.stageDraft(db, owner, { ...input, plans: [{ ...plan, minutes: 40 }] }), { status: 409 });
  await assert.rejects(store.readDraft(db, other, first.id), { status: 404 });
  const preview = await store.previewDraft(db, owner, first.id);
  assert.equal(preview.willAdd, 1);
  assert.equal(preview.blocked, 0);
  const edited = await store.reviseDraft(db, owner, { draftId: first.id, revision: first.revision, plans: [{ ...plan, minutes: 40 }] });
  await assert.rejects(store.commitDraft(db, owner, first.id, first.revision), { status: 409 });
  const committed = await store.commitDraft(db, owner, first.id, edited.revision);
  assert.equal(committed.added, 1);
  assert.equal(committed.skipped, 0);
  assert.deepEqual(await store.commitDraft(db, owner, first.id, edited.revision), committed);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 1);
  assert.equal(JSON.parse(db.sqlite.prepare("SELECT payload FROM entries").get().payload).shared, false);
  await assert.rejects(store.reviseDraft(db, owner, { draftId: first.id, revision: edited.revision, plans: [plan] }), { status: 409 });
  const retry = await store.stageDraft(db, owner, { ...input, requestId: crypto.randomUUID(), plans: [{ ...plan, minutes: 40 }] });
  assert.equal((await store.commitDraft(db, owner, retry.id, retry.revision)).added, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 1);
});

test("committing a draft preserves changed/completed records and respects rest days", async (t) => {
  const db = fixture(t);
  const first = await store.stageDraft(db, owner, { requestId: crypto.randomUUID(), plans: [plan] });
  const preview = await store.previewDraft(db, owner, first.id);
  db.sqlite.prepare("INSERT INTO entries (owner,id,kind,payload,updated) VALUES (?,?,'log','{}','synthetic')").run(owner, preview.preview[0].id);
  await assert.rejects(store.commitDraft(db, owner, first.id, first.revision), { status: 409 });
  assert.equal(db.sqlite.prepare("SELECT kind FROM entries").get().kind, "log");
  const rest = await store.stageDraft(db, other, { requestId: crypto.randomUUID(), plans: [plan] });
  const { scheduleSchema } = await import("../features/plans/schedule.ts");
  const settings = scheduleSchema.parse({ weekdays: [], dates: [plan.date] });
  db.sqlite.prepare("INSERT INTO personal_library (owner,kind,id,payload,updated) VALUES (?,'schedule','schedule',?,'synthetic')").run(other, JSON.stringify({ values: settings }));
  await assert.rejects(store.commitDraft(db, other, rest.id, rest.revision), { status: 409 });
});

test("planning context pages personal/catalogue data and excludes health and other accounts", async (t) => {
  const db = fixture(t);
  const insert = db.sqlite.prepare("INSERT INTO personal_library (owner,kind,id,payload,updated) VALUES (?,?,?,?, 'synthetic')");
  insert.run(owner, "exercise", "own", JSON.stringify({ kind: "exercise", item: { name: "Synthetic press", note: "own cue", pinned: true, videos: [] } }));
  insert.run(other, "exercise", "private", JSON.stringify({ kind: "exercise", item: { name: "Other private cue", note: "must not leak" } }));
  insert.run(owner, "nutrition", "weight", JSON.stringify({ kind: "nutrition", entry: { type: "weight", kg: 88 } }));
  const value = await planningContext(db, owner, { query: "", offset: 0, limit: 1 });
  assert.equal(value.personalExercises[0].name, "Synthetic press");
  assert.equal(value.catalogue.items.length, 1);
  assert.equal(value.catalogue.nextOffset, 1);
  assert.equal(JSON.stringify(value).includes("must not leak"), false);
  assert.equal(JSON.stringify(value).includes('"kg":88'), false);
  const principal = { owner, scopes: ["read:context"] };
  assert.deepEqual(toolsFor(principal).map((tool) => tool.name), ["read_spotter_planning_context"]);
  await assert.rejects(callPlanningTool(db, principal, "stage_spotter_plans", { profileRef: await agentProfileRef(owner), requestId: crypto.randomUUID(), plans: [plan] }), { status: 403 });
});

test("Agent draft staging resolves exact moves for the connected account without changing the prescription", async (t) => {
  const db = fixture(t);
  const profileRef = await agentProfileRef(owner);
  const writer = { owner, scopes: ["plans:draft", "plans:write"], tokenId: "synthetic-connection" };
  const principal = { ...writer, scopes: [...writer.scopes, "read:context"] };
  const insert = db.sqlite.prepare("INSERT INTO personal_library (owner,kind,id,payload,updated) VALUES (?,'exercise',?,?,'synthetic')");
  for (const [account, name] of [[owner, "Synthetic Split Twist"], [other, "Synthetic Split Twist Elevated"]]) {
    insert.run(account, name, JSON.stringify({ kind: "exercise", item: { name } }));
  }
  const move = { ...plan.exercises[0], name: "synthetic  split twist" };
  const variant = { ...move, name: "synthetic split twist elevated" };
  const stock = { ...move, name: "哑铃卧推" };
  const stockVariant = { ...move, name: "上斜哑铃卧推" };
  const input = { profileRef, requestId: crypto.randomUUID(), plans: [{ ...plan, exercises: [move, variant, stock, stockVariant] }] };
  await assert.rejects(callPlanningTool(db, writer, "stage_spotter_plans", input), { status: 403 });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM agent_plan_drafts").get().n, 0);
  const draft = await callPlanningTool(db, principal, "stage_spotter_plans", input);
  assert.deepEqual(draft.plans[0].exercises, [{ ...move, name: "Synthetic Split Twist" }, variant,
    { ...stock, catalogueId: "0289" }, { ...stockVariant, catalogueId: "0314" }]);
  assert.equal((await callPlanningTool(db, principal, "stage_spotter_plans", input)).revision, draft.revision);
  const commit = { profileRef, draftId: draft.id, revision: draft.revision, confirmed: true };
  await assert.rejects(callPlanningTool(db, writer, "commit_spotter_draft", commit), { status: 403 });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 0);
  assert.equal((await callPlanningTool(db, principal, "commit_spotter_draft", commit)).added, 1);
  assert.deepEqual(JSON.parse(db.sqlite.prepare("SELECT payload FROM entries").get().payload).exercises, draft.plans[0].exercises);
  const video = await callPlanningTool(db, writer, "stage_spotter_plans", { ...input, requestId: crypto.randomUUID(),
    plans: [{ ...plan, category: "跟练视频", video: "https://youtu.be/spotter-fixture", exercises: [] }] });
  assert.equal((await callPlanningTool(db, writer, "commit_spotter_draft", { ...commit, draftId: video.id, revision: video.revision })).added, 1);
});

test("Agent draft and program commits keep their reviewed actions stable when the library changes", async (t) => {
  const db = fixture(t);
  const profileRef = await agentProfileRef(owner);
  const writer = { owner, scopes: ["plans:draft", "plans:write"], tokenId: "synthetic-connection" };
  const principal = { ...writer, scopes: [...writer.scopes, "read:context"] };
  const move = { ...plan.exercises[0], name: "synthetic bridge with turn" };
  const training = { ...plan, exercises: [move] };
  const input = { profileRef, requestId: crypto.randomUUID(), plans: [training] };
  const draft = await callPlanningTool(db, principal, "stage_spotter_plans", input);
  const stage = { profileRef, revision: null, program: {
    id: crypto.randomUUID(), title: "Synthetic block", startDate: "2026-11-26", weeks: 1, phases: [],
    sessions: [{ id: crypto.randomUUID(), week: 1, day: 1, plan: { ...training, date: "2026-11-26" } }],
  } };
  await assert.rejects(callPlanningTool(db, writer, "stage_spotter_program", stage), { status: 403 });
  const program = await callPlanningTool(db, principal, "stage_spotter_program", stage);
  const programTarget = { profileRef, programId: program.id, revision: program.revision };
  const preview = await callPlanningTool(db, principal, "preview_spotter_program", programTarget);
  const programCommit = { ...programTarget, previewToken: preview.token, confirmed: true };
  await assert.rejects(callPlanningTool(db, writer, "commit_spotter_program", programCommit), { status: 403 });
  const name = "Synthetic Bridge with Turn";
  db.sqlite.prepare("INSERT INTO personal_library (owner,kind,id,payload,updated) VALUES (?,'exercise',?,?,'synthetic')")
    .run(owner, name, JSON.stringify({ kind: "exercise", item: { name } }));
  await assert.rejects(callPlanningTool(db, principal, "commit_spotter_draft", { profileRef, draftId: draft.id, revision: draft.revision, confirmed: true }), { status: 409 });
  await assert.rejects(callPlanningTool(db, principal, "commit_spotter_program", programCommit), { status: 409 });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 0);
  const revised = await callPlanningTool(db, principal, "stage_spotter_program", { ...stage, revision: program.revision });
  assert.deepEqual(revised.sessions[0].plan.exercises, [{ ...move, name }]);
  const revisedTarget = { ...programTarget, revision: revised.revision };
  const revisedPreview = await callPlanningTool(db, principal, "preview_spotter_program", revisedTarget);
  const revisedCommit = { ...revisedTarget, previewToken: revisedPreview.token, confirmed: true };
  assert.equal((await callPlanningTool(db, principal, "commit_spotter_program", revisedCommit)).added, 1);
  assert.equal((await callPlanningTool(db, principal, "commit_spotter_program", revisedCommit)).replayed, true);
});

test("token rate windows cap requests and recover in a later minute", async (t) => {
  const db = fixture(t);
  const issued = await store.createConnection(db, owner, { name: "Synthetic", scopes: ["read:context"], expiresInDays: 1 });
  const at = Date.now();
  for (let index = 0; index < 60; index++) await store.authenticateAgent(db, tokenRequest(issued.token), at);
  await assert.rejects(store.authenticateAgent(db, tokenRequest(issued.token), at), { status: 429 });
  assert.equal((await store.authenticateAgent(db, tokenRequest(issued.token), at + 60_000)).owner, owner);
});
