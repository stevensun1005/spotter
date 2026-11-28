import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtime = globalThis.__spotterNutritionBatchTest = { env: {}, owner: "meal-owner" };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: "data:text/javascript,export const env=globalThis.__spotterNutritionBatchTest.env", shortCircuit: true };
  }
  if (specifier === "@/server/account") {
    return { url: "data:text/javascript,export async function requireAccount(){return {id:globalThis.__spotterNutritionBatchTest.owner}}", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { POST } = await import("../app/api/nutrition/batch/route.ts");
const origin = "https://meal-batch.test";

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE personal_library (owner TEXT, kind TEXT, id TEXT, day TEXT, payload TEXT, updated TEXT, PRIMARY KEY(owner,kind,id))");
  runtime.env.DB = {
    prepare(sql) {
      return { bind(...parameters) {
        return () => {
          const operation = sqlite.prepare(sql);
          return sql.startsWith("SELECT") ? { results: operation.all(...parameters) } : { meta: operation.run(...parameters) };
        };
      } };
    },
    async batch(operations) {
      sqlite.exec("BEGIN");
      try {
        const results = operations.map((execute) => execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  t.after(() => { delete runtime.env.DB; runtime.owner = "meal-owner"; sqlite.close(); });
  const meal = (name) => ({ kind: "nutrition", id: crypto.randomUUID(), date: "2026-11-27",
    entry: { type: "meal", meal: "早餐", name, calories: 72, carbs: 0.4, protein: 6, fat: 5 } });
  const save = { action: "save", rows: [meal("鸡蛋"), meal("牛奶")], expectedOwner: runtime.owner, batchId: crypto.randomUUID() };
  const request = (body) => POST(new Request(origin + "/api/nutrition/batch", { method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const stored = (owner = save.expectedOwner) => sqlite.prepare("SELECT id,updated,payload FROM personal_library WHERE owner=? ORDER BY id").all(owner);
  return { sqlite, stored, request, save, meal };
}

test("meal batch returns the original receipt on retry and undoes only the saved foods", async (t) => {
  const { sqlite, stored, request, save, meal } = fixture(t);
  const unrelated = meal("米饭");
  sqlite.prepare("INSERT INTO personal_library VALUES (?, 'nutrition', ?, ?, ?, ?)")
    .run(save.expectedOwner, unrelated.id, unrelated.date, JSON.stringify(unrelated), "before");
  const first = await request(save);
  assert.equal(first.status, 200);
  const receipt = await first.json();
  assert.deepEqual(receipt.rows.map(({ id }) => id), save.rows.map(({ id }) => id));
  assert.equal(stored().length, 3);
  const repeated = await request(save);
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), receipt);
  const undo = { ...save, action: "undo", rows: receipt.rows };
  assert.equal((await request(undo)).status, 200);
  assert.equal((await request(undo)).status, 200);
  assert.deepEqual(stored().map(({ id }) => id), [unrelated.id]);
});

test("a changed record blocks the entire undo and does not issue a newer receipt", async (t) => {
  const { sqlite, stored, request, save } = fixture(t);
  const saved = await request(save);
  assert.equal(saved.status, 200);
  const { rows } = await saved.json();
  sqlite.prepare("UPDATE personal_library SET updated=? WHERE id=?").run("edited", rows[0].id);
  assert.equal((await request(save)).status, 409);
  assert.equal((await request({ ...save, action: "undo", rows })).status, 409);
  assert.equal(stored().length, 2);
  assert.equal(stored().find(({ id }) => id === rows[0].id).updated, "edited");
  sqlite.prepare("DELETE FROM personal_library WHERE id=?").run(rows[0].id);
  assert.equal((await request(save)).status, 409);
  assert.equal(stored().length, 1);
});

test("meal batches reject duplicates, conflicting IDs, mixed dates and wrong accounts atomically", async (t) => {
  const { sqlite, stored, request, save } = fixture(t);
  assert.equal((await request({ ...save, rows: [save.rows[0], save.rows[0]] })).status, 400);
  assert.equal((await request({ ...save, rows: [save.rows[0], { ...save.rows[1], date: "2026-11-28" }] })).status, 400);
  assert.equal((await request({ ...save, expectedOwner: "someone-else" })).status, 403);
  assert.equal(stored().length, 0);
  const first = save.rows[0];
  sqlite.prepare("INSERT INTO personal_library VALUES (?, 'nutrition', ?, ?, ?, ?)")
    .run(save.expectedOwner, first.id, first.date, JSON.stringify(first), "before");
  assert.equal((await request(save)).status, 409);
  assert.deepEqual(stored().map(({ id }) => id), [first.id]);
  runtime.owner = "different-owner";
  assert.equal((await request({ ...save, expectedOwner: runtime.owner })).status, 200);
  assert.equal(stored().length, 1);
  assert.equal(stored(runtime.owner).length, 2);
});
