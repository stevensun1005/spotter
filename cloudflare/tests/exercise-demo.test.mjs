import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const routeEnv = globalThis.__spotterDemoEnv = {};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__spotterDemoEnv;", shortCircuit: true };
  if (specifier === "@/app/chatgpt-auth") return { url: "data:text/javascript,export async function getChatGPTUser(){return globalThis.__spotterDemoUser}", shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { POST: writeDemo } = await import("../app/api/agent/exercise-demos/route.ts");
const { POST: readDemoSkill } = await import("../app/api/agent/exercise-demo-skill/route.ts");
const { POST: mcp } = await import("../app/api/agent/mcp/route.ts");
const { GET: exerciseMedia } = await import("../app/api/exercises/demo/route.ts");
const { createConnection } = await import("../features/agent-access/store.ts");
const { agentProfileRef } = await import("../features/agent/profile.ts");
const { agentApiSchema } = await import("../features/agent-access/schema.ts");

// Two genuine animated, looping 2×2 GIFs with different colors in each frame.
const redAndBlue = Buffer.from("R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQABgAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBDAABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7", "base64");
const yellowAndGreen = Buffer.from("R0lGODlhAgACAIEAAP//AAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQABgAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBDAABACwAAAAAAgACAIEAgAAAAAAAAAAAAAAIBgABCAQQEAA7", "base64");
const name = "Fixture Row";
const origin = "https://demo.example.invalid";
const toolName = "manage_spotter_exercise_demo";
const skillToolName = "get_spotter_exercise_demo_skill";
const skillPath = "/api/agent/exercise-demo-skill";

function database(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => { sqlite.close(); delete routeEnv.DB; delete globalThis.__spotterDemoUser; });
  for (const migration of readdirSync(new URL("drizzle/", root)).filter((file) => file.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL("drizzle/" + migration, root), "utf8"));
  }
  const insert = sqlite.prepare("INSERT INTO spotter_access_accounts(id,email,display_name,access_hash) VALUES (?,?,?,?)");
  for (const owner of ["one", "two"]) insert.run(owner, owner + "@example.invalid", owner, "0".repeat(64));
  return routeEnv.DB = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...values) { return {
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { meta: { changes: statement.run(...values).changes } }; },
    }; } };
  }, async batch(statements) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  } };
}

function post(path, body, token) {
  return new Request(origin + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json",
    ...(token && { Authorization: "Bearer " + token }) }, body: JSON.stringify(body) });
}
const issue = (db, owner, scopes = ["read:context", "exercise-demos:write"]) => createConnection(db, owner, { scopes, name: "Synthetic GIF agent", expiresInDays: 1 });
const save = (profileRef, bytes, move = name) => ({ action: "save", profileRef, name: move, confirmed: true, gifBase64: bytes.toString("base64") });
const write = (body, token) => writeDemo(post("/api/agent/exercise-demos", body, token));
const skill = (body, token) => readDemoSkill(post(skillPath, body, token));
async function rpc(method, token, params) {
  const response = await mcp(post("/api/agent/mcp", { jsonrpc: "2.0", id: 1, method, params }, token));
  return (await response.json()).result;
}
function read(owner, move = name, token) {
  globalThis.__spotterDemoUser = owner ? { userId: owner } : null;
  const url = new URL("/api/exercises/demo", origin);
  url.searchParams.set("name", move);
  url.searchParams.set("owner", "one");
  return exerciseMedia(new Request(url, { headers: token ? { Authorization: "Bearer " + token } : {} }));
}

test("Agent GIFs are scope- and account-bound, sanitized, idempotent, and private to each browser account", async (t) => {
  const db = database(t);
  const { token } = await issue(db, "one");
  const { token: removeOnly } = await issue(db, "one", ["exercise-demos:write"]);
  const { token: appendOnly } = await issue(db, "one", ["templates:write"]);
  const { token: other } = await issue(db, "two");
  const one = await agentProfileRef("one"), two = await agentProfileRef("two");
  const caption = Buffer.from("synthetic comment to remove");
  const comment = Buffer.concat([Buffer.from([0x21, 0xfe, caption.length]), caption, Buffer.from([0])]);
  const application = Buffer.concat([Buffer.from([0x21, 0xff, 11]), Buffer.from("PRIVATEAPP1"), Buffer.from([2, 42, 43, 0])]);
  const annotated = Buffer.concat([redAndBlue.subarray(0, 25), comment, application, redAndBlue.subarray(25)]);
  const input = save(one, annotated, "A1 Fixture Row");

  assert.ok(agentApiSchema(origin).paths["/api/agent/exercise-demos"].post);
  assert.ok((await rpc("tools/list", token)).tools.some(({ name }) => name === toolName));
  assert.ok(!(await rpc("tools/list", appendOnly)).tools.some(({ name }) => name === toolName));
  assert.equal((await rpc("tools/call", appendOnly, { name: toolName, arguments: input })).isError, true);
  assert.equal((await write(input)).status, 401);
  assert.equal((await write(input, appendOnly)).status, 403);
  assert.equal((await write(input, removeOnly)).status, 403);
  assert.equal((await write(input, other)).status, 403);
  assert.equal((await write({ ...input, confirmed: false }, token)).status, 400);
  assert.equal((await write(save(one, redAndBlue, "A1 Dumbbell Bench Press"), token)).status, 400);

  const created = await write(input, token);
  assert.equal(created.status, 200);
  const receipt = { action: "save", name, width: 2, height: 2, frames: 2 };
  assert.deepEqual(await created.json(), receipt);
  const library = () => db.sqlite.prepare("SELECT id, payload, updated FROM personal_library WHERE owner='one' AND kind='exercise'").all();
  const originalLibrary = library();
  assert.equal(originalLibrary.length, 1);
  assert.equal(originalLibrary[0].id, name);
  assert.deepEqual(JSON.parse(originalLibrary[0].payload), { kind: "exercise", item: { name, pinned: false, note: "", videos: [] } });
  assert.equal((await read(null, name, token)).status, 401);
  assert.equal((await read("two")).status, 404);
  const own = await read("one", "fixture  row");
  assert.equal(own.status, 200);
  assert.equal(own.headers.get("content-type"), "image/gif");
  assert.equal(own.headers.get("cache-control"), "private, no-store");
  assert.equal(own.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), redAndBlue, "strip metadata while retaining both frames, loop and delays");

  db.sqlite.exec("CREATE TABLE synthetic_demo_updates (marker INTEGER); " +
    "CREATE TRIGGER count_demo_updates AFTER UPDATE ON exercise_demonstrations " +
    "BEGIN INSERT INTO synthetic_demo_updates VALUES (1); END;");
  const repeated = await rpc("tools/call", token, { name: toolName, arguments: save(one, redAndBlue) });
  assert.equal(repeated.isError, false);
  assert.deepEqual(JSON.parse(repeated.content[0].text), receipt);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM synthetic_demo_updates").get().n, 0);
  assert.deepEqual(library(), originalLibrary);

  assert.equal((await write(save(two, yellowAndGreen), other)).status, 200);
  assert.deepEqual(Buffer.from(await (await read("two")).arrayBuffer()), yellowAndGreen);
  assert.deepEqual(Buffer.from(await (await read("one")).arrayBuffer()), redAndBlue);
  const customized = { kind: "exercise", item: { name, pinned: true, note: "Synthetic pinned note", videos: [] } };
  db.sqlite.prepare("UPDATE personal_library SET payload=?, updated=? WHERE owner='one' AND id=?")
    .run(JSON.stringify(customized), "2026-11-25T18:00:00.000Z", name);
  const customizedLibrary = library();
  assert.equal((await write(save(one, yellowAndGreen, "fixture row"), token)).status, 200);
  assert.deepEqual(library(), customizedLibrary, "replacing a demo preserves exercise notes and pins");
  assert.deepEqual(Buffer.from(await (await read("one")).arrayBuffer()), yellowAndGreen);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM synthetic_demo_updates").get().n, 1);

  const remove = { action: "remove", profileRef: one, name, confirmed: true };
  assert.equal((await write(remove, other)).status, 403);
  const deleted = await rpc("tools/call", removeOnly, { name: toolName, arguments: remove });
  assert.equal(deleted.isError, false);
  assert.deepEqual(JSON.parse(deleted.content[0].text), { action: "remove", name });
  assert.deepEqual(await (await write(remove, token)).json(), { action: "remove", name });
  assert.equal((await read("one")).status, 404);
  assert.deepEqual(library(), customizedLibrary, "removing a demo leaves the user's exercise intact");
  assert.deepEqual(Buffer.from(await (await read("two")).arrayBuffer()), yellowAndGreen);
  db.sqlite.prepare("DELETE FROM spotter_access_accounts WHERE id=?").run("two");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM exercise_demonstrations").get().n, 0);
});

test("a new exercise variant keeps its distinguishing name when attaching a GIF", async (t) => {
  const db = database(t);
  const { token } = await issue(db, "one");
  const profileRef = await agentProfileRef("one");
  const variant = "哑铃卧推（窄握）";
  const response = await write(save(profileRef, redAndBlue, "A1 " + variant), token);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, variant);
  assert.equal((await read("one", variant)).status, 200);
  assert.equal((await read("one", "哑铃卧推")).status, 404);
  assert.equal(db.sqlite.prepare("SELECT id FROM personal_library WHERE kind='exercise'").get().id, variant);
});

test("the read-only demo skill resolves exact catalogue media and routes personal previews without sharing GIFs", async (t) => {
  const db = database(t);
  const { token } = await issue(db, "one");
  const { token: reader } = await issue(db, "one", ["read:context"]);
  const { token: writer } = await issue(db, "one", ["exercise-demos:write"]);
  const { token: other } = await issue(db, "two");
  const profileRef = await agentProfileRef("one");
  const catalogue = { profileRef, name: "Cable Pulldown", catalogueId: "0198" };
  const custom = { profileRef, name: "Cable Pulldown（Fixture Variant）" };

  assert.ok(agentApiSchema(origin).paths[skillPath].post);
  assert.equal((await rpc("tools/list", reader)).tools.find(({ name }) => name === skillToolName).annotations.readOnlyHint, true);
  assert.ok(!(await rpc("tools/list", writer)).tools.some(({ name }) => name === skillToolName));
  assert.equal((await rpc("tools/call", writer, { name: skillToolName, arguments: catalogue })).isError, true);
  assert.equal((await skill(catalogue)).status, 401);
  assert.equal((await skill(catalogue, writer)).status, 403);
  assert.equal((await skill(catalogue, other)).status, 403);
  assert.equal((await skill({ ...catalogue, name: custom.name }, reader)).status, 409);
  assert.equal((await skill({ ...catalogue, name: "1 2 stick drill" }, reader)).status, 409);
  assert.equal((await skill({ ...catalogue, catalogueId: "999999" }, reader)).status, 400);

  const receipt = await rpc("tools/call", reader, { name: skillToolName, arguments: catalogue });
  assert.equal(receipt.isError, false);
  const approved = JSON.parse(receipt.content[0].text);
  assert.equal(approved.action, "reuse_catalogue");
  assert.deepEqual(approved.exercise, { name: "绳索下拉", catalogueId: "0198", source: "catalogue" });
  assert.equal(approved.mediaUrl, "/open-gym/spotter-3d/0198.mp4");
  assert.equal(approved.upload, undefined);
  assert.deepEqual(await (await skill(catalogue, reader)).json(), approved);

  const render = await (await skill(custom, reader)).json();
  assert.equal(render.action, "render_personal");
  assert.equal(render.exercise.name, custom.name);
  assert.equal(render.skill.downloadUrl, "/spotter-demo-skill/spotter-exercise-demo.zip");
  assert.equal(render.skill.instructionsPath, "spotter-exercise-demo/SKILL.md");
  assert.deepEqual(render.upload, { tool: toolName, path: "/api/agent/exercise-demos", action: "save",
    scope: "exercise-demos:write", authorized: false, requireConfirmation: true, inputEncoding: "base64",
    maxBytes: 768 * 1024, maxDimensionPixels: 480, minFrames: 2, maxFrames: 90, maxFramePixels: 9_000_000 });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM exercise_demonstrations").get().n, 0);
  assert.equal((await (await skill(custom, token)).json()).upload.authorized, true);
  assert.equal((await write(save(profileRef, redAndBlue, custom.name), token)).status, 200);

  const saved = await (await skill(custom, reader)).json();
  assert.equal(saved.action, "reuse_personal");
  assert.equal(saved.exercise.name, custom.name);
  assert.equal(JSON.stringify(saved).includes(redAndBlue.toString("base64")), false);
  const otherProfileRef = await agentProfileRef("two");
  assert.equal((await (await skill({ ...custom, profileRef: otherProfileRef }, other)).json()).action, "render_personal");

  db.sqlite.prepare("INSERT INTO personal_library(owner,kind,id,payload,updated) VALUES (?, 'exercise', ?, ?, ?)")
    .run("one", "绳索下拉", JSON.stringify({ item: { name: "绳索下拉", pinned: true } }), "2026-11-26T00:00:00.000Z");
  assert.equal((await write(save(profileRef, redAndBlue, "绳索下拉"), token)).status, 400);
  assert.equal((await (await skill(catalogue, reader)).json()).mediaUrl, approved.mediaUrl);
});

test("non-GIFs, static GIFs and malformed animated GIFs do not create exercises", async (t) => {
  const db = database(t);
  const { token } = await issue(db, "one");
  const profileRef = await agentProfileRef("one");
  const staticGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  const tooWide = Buffer.from(redAndBlue);
  tooWide.writeUInt16LE(481, 6);
  for (const invalid of [Buffer.from("not a GIF"), staticGif, redAndBlue.subarray(0, -1), tooWide]) {
    assert.equal((await write(save(profileRef, invalid), token)).status, 400);
  }
  const input = save(profileRef, redAndBlue);
  assert.equal((await write({ ...input, gifBase64: "data:image/gif;base64," + input.gifBase64 }, token)).status, 400);
  assert.equal((await write({ ...input, gifUrl: "https://example.invalid/demo.gif" }, token)).status, 400);
  assert.equal((await read("one")).status, 404);
  for (const table of ["personal_library", "exercise_demonstrations"]) {
    assert.equal(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
});
