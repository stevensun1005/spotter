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
