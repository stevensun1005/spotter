import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
globalThis.__spotterAgentEnv = {};
globalThis.__spotterAgentUser = null;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__spotterAgentEnv;", shortCircuit: true };
  if (specifier === "@/app/chatgpt-auth") return { url: "data:text/javascript,export async function getChatGPTUser(){return globalThis.__spotterAgentUser}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) { const file = new URL(specifier + ".ts", context.parentURL); if (existsSync(file)) return next(file.href, context); }
  return next(specifier, context);
} });
const official = await import("../app/mcp/route.ts");
const external = await import("../app/api/agent/mcp/route.ts");
const connections = await import("../app/api/agent/connections/route.ts");
const drafts = await import("../app/api/agent/drafts/route.ts");
const commit = await import("../app/api/agent/commit/route.ts");
const profile = await import("../app/api/agent/profile/route.ts");
const records = await import("../app/api/agent/records/route.ts");
const { createConnection } = await import("../features/agent-access/store.ts");
const { agentProfileRef } = await import("../features/agent/profile.ts");
const { agentApiSchema } = await import("../features/agent-access/schema.ts");

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  const db = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return statement.get(...values) ?? null; }, async all() { return { results: statement.all(...values) }; }, async run() { return { meta: { changes: statement.run(...values).changes } }; } };
  }, async batch(statements) { sqlite.exec("BEGIN IMMEDIATE"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } };
  for (const file of readdirSync(new URL("drizzle/", root)).filter((file) => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL("drizzle/" + file, root), "utf8"));
  globalThis.__spotterAgentEnv.DB = db;
  globalThis.__spotterAgentUser = { userId: "synthetic-browser-owner", email: "synthetic@example.invalid" };
  t.after(() => { sqlite.close(); globalThis.__spotterAgentEnv.DB = undefined; globalThis.__spotterAgentUser = null; });
  return db;
}
const origin = "https://synthetic.invalid";
function request(path, body, token, suppliedOrigin = origin) {
  return new Request(origin + path, { method: body ? "POST" : "GET", headers: { ...(body && { Origin: suppliedOrigin, "Content-Type": "application/json" }), ...(token && { Authorization: "Bearer " + token }) }, ...(body && { body: JSON.stringify(body) }) });
}
const plan = { title: "Synthetic plan", date: "2026-11-26", category: "力量训练", minutes: 30, shared: false, video: "", exercises: [{ name: "哑铃卧推", sets: 3, reps: 8, weight: 15, unit: "kg", seconds: 0 }] };
const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, ...(params && { params }) });
const value = async (response) => (await response.json()).result;

test("the existing Sites MCP keeps old tools and runs the new draft/program workflow under platform identity", async (t) => {
  const db = fixture(t);
  const profileRef = await agentProfileRef(globalThis.__spotterAgentUser.userId);
  const listed = await value(await official.POST(request("/mcp", rpc("tools/list"))));
  const names = listed.tools.map((tool) => tool.name);
  for (const name of ["get_spotter_agent_profile", "add_spotter_plans", "add_spotter_foods", "read_spotter_records", "stage_spotter_plans", "commit_spotter_draft", "stage_spotter_program"]) assert.ok(names.includes(name));
  const initialized = await value(await official.POST(request("/mcp", rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "synthetic", version: "1" } }))));
  assert.equal(initialized.protocolVersion, "2025-11-25");
  const invoke = async (name, args) => value(await official.POST(request("/mcp", rpc("tools/call", { name, arguments: args }))));
  const wrong = await invoke("stage_spotter_plans", { profileRef: await agentProfileRef("other"), requestId: crypto.randomUUID(), plans: [plan] });
  assert.equal(wrong.isError, true);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM agent_plan_drafts").get().n, 0);
  const staged = await invoke("stage_spotter_plans", { profileRef, requestId: crypto.randomUUID(), plans: [plan] });
  assert.equal(staged.isError, false);
  const draft = JSON.parse(staged.content[0].text);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 0);
  const saved = await invoke("commit_spotter_draft", { profileRef, draftId: draft.id, revision: draft.revision, confirmed: true });
  assert.equal(JSON.parse(saved.content[0].text).added, 1);
  const noId = { jsonrpc: "2.0", method: "tools/call", params: { name: "stage_spotter_plans", arguments: { profileRef, requestId: crypto.randomUUID(), plans: [plan] } } };
  assert.equal((await official.POST(request("/mcp", noId))).status, 400);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM agent_plan_drafts").get().n, 1);
  const program = { id: crypto.randomUUID(), title: "Synthetic cycle", startDate: "2026-11-27", weeks: 1, phases: [], sessions: [{ id: crypto.randomUUID(), week: 1, day: 1, plan: { ...plan, date: "2026-11-27" } }] };
  const stagedProgram = JSON.parse((await invoke("stage_spotter_program", { profileRef, program, revision: null })).content[0].text);
  const preview = JSON.parse((await invoke("preview_spotter_program", { profileRef, programId: program.id, revision: stagedProgram.revision })).content[0].text);
  assert.equal(preview.counts.new, 1);
  const committed = await invoke("commit_spotter_program", { profileRef, programId: program.id, revision: stagedProgram.revision, previewToken: preview.token, confirmed: true });
  assert.equal(JSON.parse(committed.content[0].text).added, 1);
});

test("generic Agent REST works without a browser identity when its token is scoped and profile-checked", async (t) => {
  const db = fixture(t);
  const created = await connections.POST(request("/api/agent/connections", { action: "create", name: "Synthetic HTTP agent", scopes: ["read:context", "plans:draft", "plans:write"], expiresInDays: 7 }));
  assert.equal(created.status, 200);
  const { token, connection } = await created.json();
  const owner = globalThis.__spotterAgentUser.userId;
  const metadata = await (await connections.GET(request("/api/agent/connections"))).json();
  assert.equal(JSON.stringify(metadata).includes(token), false);
  globalThis.__spotterAgentUser = null;
  const identity = await (await profile.GET(request("/api/agent/profile", null, token))).json();
  assert.equal(identity.profileRef, await agentProfileRef(owner));
  const stage = await drafts.POST(request("/api/agent/drafts", { profileRef: identity.profileRef, requestId: crypto.randomUUID(), plans: [plan] }, token));
  assert.equal(stage.status, 200);
  const draft = await stage.json();
  const committed = await commit.POST(request("/api/agent/commit", { profileRef: identity.profileRef, draftId: draft.id, revision: draft.revision, confirmed: true }, token));
  assert.equal(committed.status, 200);
  assert.equal((await committed.json()).added, 1);
  const readOnly = await createConnection(db, owner, { name: "Read-only", scopes: ["read:context"], expiresInDays: 7 });
  assert.equal((await drafts.GET(request("/api/agent/drafts", null, readOnly.token))).status, 403);
  assert.equal((await commit.POST(request("/api/agent/commit", { profileRef: identity.profileRef, draftId: draft.id, revision: draft.revision, confirmed: true }, readOnly.token))).status, 403);
  assert.equal((await connections.GET(request("/api/agent/connections", null, token))).status, 401, "tokens cannot mint or list connections without a website session");
  globalThis.__spotterAgentUser = { userId: owner, email: "synthetic@example.invalid" };
  assert.equal((await connections.POST(request("/api/agent/connections", { action: "revoke", id: connection.id }))).status, 200);
  globalThis.__spotterAgentUser = null;
  assert.equal((await profile.GET(request("/api/agent/profile", null, token))).status, 401);
});

test("external MCP scope-filtered discovery cannot be bypassed by naming a forbidden write tool", async (t) => {
  const db = fixture(t);
  const owner = globalThis.__spotterAgentUser.userId;
  const { token } = await createConnection(db, owner, { name: "Synthetic reader", scopes: ["read:context"], expiresInDays: 1 });
  globalThis.__spotterAgentUser = null;
  const tools = await value(await external.POST(request("/api/agent/mcp", rpc("tools/list"), token)));
  assert.deepEqual(tools.tools.map((tool) => tool.name), ["get_spotter_agent_profile", "read_spotter_planning_context"]);
  const denied = await value(await external.POST(request("/api/agent/mcp", rpc("tools/call", { name: "stage_spotter_plans", arguments: { profileRef: await agentProfileRef(owner), requestId: crypto.randomUUID(), plans: [plan] } }), token)));
  assert.equal(denied.isError, true);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM agent_plan_drafts").get().n, 0);
  assert.equal((await external.POST(request("/api/agent/mcp", rpc("tools/list")))).status, 401);
  assert.equal((await external.GET()).status, 405);
  const schema = agentApiSchema(origin);
  assert.ok(schema.paths["/api/agent/profile"].get);
  assert.ok(schema.components.schemas.Program.properties.sessions);
});

test("external nutrition MCP appends confirmed records for the token owner and skips retries", async (t) => {
  const db = fixture(t);
  const owner = globalThis.__spotterAgentUser.userId;
  const created = await connections.POST(request("/api/agent/connections", { action: "create", name: "Nutrition only", scopes: ["nutrition:write"], expiresInDays: 7 }));
  assert.equal(created.status, 200);
  const { token } = await created.json();
  const reader = await createConnection(db, owner, { name: "Read only", scopes: ["read:context"], expiresInDays: 1 });
  globalThis.__spotterAgentUser = null;
  const profileRef = (await (await profile.GET(request("/api/agent/profile", null, token))).json()).profileRef;
  const methods = await value(await external.POST(request("/api/agent/mcp", rpc("tools/list"), token)));
  assert.deepEqual(methods.tools.map(({ name }) => name), ["get_spotter_agent_profile", "import_spotter_records", "add_spotter_foods"]);
  assert.deepEqual(methods.tools[1].inputSchema.properties.scope.enum, ["nutrition"]);
  const meal = { kind: "nutrition", id: crypto.randomUUID(), date: plan.date, entry: { type: "meal", meal: "午餐", name: "白米饭", grams: 100, calories: 130, protein: 2.7, carbs: 28, fat: 0.3 } };
  const targets = { kind: "targets", values: { calories: 2000, protein: 130, carbs: 240, fat: 58, water: 2100 } };
  const backup = { format: "spotter-backup", version: 1, training: [], library: [meal, targets], heart: [] };
  const args = { profileRef, scope: "nutrition", confirmed: true, backup };
  const invoke = async (name, arguments_, bearer = token) => value(await external.POST(request("/api/agent/mcp", rpc("tools/call", { name, arguments: arguments_ }), bearer)));
  const put = (input, bearer) => invoke("import_spotter_records", input, bearer);
  assert.equal((await put(args, reader.token)).isError, true);
  assert.equal((await put({ ...args, profileRef: await agentProfileRef("another-owner") })).isError, true);
  assert.equal((await put({ ...args, confirmed: false })).isError, true);
  const weight = { ...meal, id: crypto.randomUUID(), entry: { type: "weight", kg: 76 } };
  assert.equal((await put({ ...args, backup: { ...backup, library: [meal, weight] } })).isError, true);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM personal_library").get().n, 0);
  const outcome = async (result) => JSON.parse((await result).content[0].text);
  assert.deepEqual(await outcome(put(args)), { scope: "饮食", added: 2, skipped: 0 });
  assert.deepEqual(await outcome(put(args)), { scope: "饮食", added: 0, skipped: 2 });
  const changedMeal = { ...meal, entry: { ...meal.entry, grams: 200 } };
  assert.deepEqual(await outcome(put({ ...args, backup: { ...backup, library: [changedMeal] } })), { scope: "饮食", added: 0, skipped: 1 });
  const foodArgs = { profileRef, confirmed: true, foods: [{ name: "常用燕麦", per100g: { calories: 380, protein: 13, carbs: 65, fat: 8 } }] };
  assert.deepEqual(await outcome(invoke("add_spotter_foods", foodArgs)), { added: 1, skipped: 0 });
  assert.deepEqual(await outcome(invoke("add_spotter_foods", foodArgs)), { added: 0, skipped: 1 });
  assert.deepEqual(db.sqlite.prepare("SELECT DISTINCT owner FROM personal_library").all().map((row) => row.owner), [owner]);
  const storedMeal = db.sqlite.prepare("SELECT payload FROM personal_library WHERE id = ?").get(meal.id);
  assert.equal(JSON.parse(storedMeal.payload).entry.grams, 100);
});

test("external record REST uses the same grants and keeps plans on the existing staged route", async (t) => {
  const db = fixture(t);
  const owner = globalThis.__spotterAgentUser.userId;
  const { token } = await createConnection(db, owner, { name: "Body and training", scopes: ["body:write", "training:write", "templates:write"], expiresInDays: 1 });
  const profileRef = await agentProfileRef(owner);
  const date = plan.date;
  const weight = { kind: "nutrition", id: crypto.randomUUID(), date, entry: { type: "weight", kg: 76 } };
  const backup = { format: "spotter-backup", version: 1, training: [], library: [weight], heart: [] };
  const body = { profileRef, scope: "body", confirmed: true, backup };
  const append = (input, bearer) => records.POST(request("/api/agent/records", input, bearer));
  assert.equal((await append(body)).status, 401);
  globalThis.__spotterAgentUser = null;
  assert.equal((await append({ ...body, scope: "nutrition" }, token)).status, 403);
  const saved = await append(body, token);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { scope: "身体", added: 1, skipped: 0 });
  const template = { kind: "template", id: crypto.randomUUID(), plan };
  const savedTemplate = await append({ ...body, scope: "templates", backup: { ...backup, library: [template] } }, token);
  assert.equal((await savedTemplate.json()).added, 1);
  const directPlan = { kind: "plan", id: crypto.randomUUID(), data: plan };
  assert.equal((await append({ ...body, scope: "training", backup: { ...backup, library: [], training: [directPlan] } }, token)).status, 400);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM entries").get().n, 0);
  const started = Date.parse(date + "T13:00:00Z");
  const log = { kind: "log", id: crypto.randomUUID(), data: {
    plan, planId: "", date, started, ended: started + 1_800_000, minutes: 30, note: "", finishedVideo: false,
    rows: [Array.from({ length: 3 }, () => ({ reps: 8, weight: 15, seconds: 0, done: true }))],
  } };
  const savedLog = await append({ ...body, scope: "training", backup: { ...backup, library: [], training: [log] } }, token);
  assert.deepEqual(await savedLog.json(), { scope: "训练", added: 1, skipped: 0 });
  assert.equal(db.sqlite.prepare("SELECT kind FROM entries WHERE owner = ? AND id = ?").get(owner, log.id).kind, "log");
  assert.ok(agentApiSchema(origin).paths["/api/agent/records"].post);
});
