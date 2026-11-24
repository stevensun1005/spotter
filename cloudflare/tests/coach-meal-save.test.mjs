import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const sharedClient = new URL("shared/client.ts", root);
const runtime = globalThis.__spotterCoachMealTest = { env: {}, owner: "coach-meal-owner" };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: "data:text/javascript,export const env=globalThis.__spotterCoachMealTest.env", shortCircuit: true };
  }
  if (specifier === "@/server/account") {
    return { url: "data:text/javascript,export async function requireAccount(){return {id:globalThis.__spotterCoachMealTest.owner}}", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url === sharedClient.href) {
    const source = stripTypeScriptTypes(readFileSync(sharedClient, "utf8"), { mode: "transform" });
    return { format: "module", source, shortCircuit: true };
  }
  return next(url, context);
} });
const { POST } = await import("../app/api/library/route.ts");
const { saveCoachMeal } = await import("../features/nutrition/coach-meal-save.ts");

const origin = "https://coach-meal.test";
const source = { owner: runtime.owner, id: crypto.randomUUID(), date: "2026-11-24", meal: "加餐",
  draft: { name: "牛奶加乳清蛋白粉", grams: 288, calories: 270, protein: 30, carbs: 16, fat: 9 } };

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => { delete runtime.env.DB; runtime.owner = source.owner; db.close(); });
  db.exec("CREATE TABLE personal_library (owner TEXT, kind TEXT, id TEXT, day TEXT, payload TEXT, updated TEXT, PRIMARY KEY(owner,kind,id))");
  runtime.env.DB = {
    prepare(sql) {
      const statement = db.prepare(sql);
      return { bind(...args) {
        return {
          async first() { return statement.get(...args) ?? null; },
          async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
        };
      } };
    },
  };
  const row = (owner = source.owner) => db.prepare("SELECT payload,updated FROM personal_library WHERE owner=? AND id=?").get(owner, source.id);
  const request = (body) => POST(new Request(origin + "/api/library", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body,
  }));
  let dropResponse = false;
  const fetch = t.mock.method(globalThis, "fetch", async (path, init) => {
    assert.equal(path, "/api/library");
    const response = await request(init.body);
    if (dropResponse) {
      dropResponse = false;
      throw new TypeError("response interrupted");
    }
    return response;
  });
  return { row, request, fetch, dropNextResponse: () => { dropResponse = true; } };
}

test("coach creates one estimated meal after network retry and cannot overwrite later edits", async (t) => {
  const { row, request, dropNextResponse } = fixture(t);
  dropNextResponse();
  await assert.rejects(saveCoachMeal(source), /response interrupted/);
  const first = row();
  assert.ok(first.payload);
  const entry = await saveCoachMeal(source);
  assert.deepEqual(row(), first);
  assert.deepEqual(entry, { ...source.draft, type: "meal", meal: source.meal, name: "牛奶加乳清蛋白粉（估算）" });

  const record = JSON.parse(first.payload);
  const edited = { ...record, entry: { ...record.entry, name: "已核对的牛奶和蛋白粉" } };
  assert.equal((await request(JSON.stringify({ action: "save", data: edited }))).status, 200);
  await assert.rejects(saveCoachMeal(source), { status: 409 });
  assert.deepEqual(JSON.parse(row().payload), edited);
});

test("coach refuses invalid portions and an account switch before inserting a meal", async (t) => {
  const { row, fetch } = fixture(t);
  for (const draft of [
    { ...source.draft, grams: undefined }, { ...source.draft, grams: 10 },
    { ...source.draft, calories: Infinity }, { ...source.draft, fat: -3 },
  ]) await assert.rejects(saveCoachMeal({ ...source, draft }), /请核对/);
  assert.equal(fetch.mock.callCount(), 0);
  runtime.owner = "different-owner";
  await assert.rejects(saveCoachMeal(source), { status: 403 });
  assert.equal(row(), undefined);
  assert.equal(row(runtime.owner), undefined);
});
