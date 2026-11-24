import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const sharedClient = new URL("shared/client.ts", root);
const owner = "synthetic-coach-protein-owner";
const runtime = globalThis.__spotterCoachProteinTest = { env: {}, owner };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: "data:text/javascript,export const env=globalThis.__spotterCoachProteinTest.env", shortCircuit: true };
  }
  if (specifier === "@/server/account") {
    return { url: "data:text/javascript,export async function requireAccount(){return {id:globalThis.__spotterCoachProteinTest.owner}}", shortCircuit: true };
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

const { POST } = await import("../app/api/coach-protein/route.ts");
const { saveCoachProtein } = await import("../features/nutrition/coach-protein-save.ts");
const { defaultWorkoutProteinProduct } = await import("../features/training/protein.ts");
const { proteinMeal } = await import("../features/training/protein-nutrition.ts");
const origin = "https://coach.test";

function submission() {
  return { owner, addToWarehouse: true,
    product: { id: crypto.randomUUID(), name: "合成草莓蛋白粉", scoopGrams: 30, cupMl: 600,
      powder: { calories: 380, protein: 80, carbs: 10, fat: 2 },
      mixer: { name: "2%牛奶", per100ml: { calories: 50, protein: 3, carbs: 5, fat: 2 } } },
    records: ["2026-11-23", "2026-11-24"].map((date) => ({ id: crypto.randomUUID(), date, meal: "加餐" })),
  };
}

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => { delete runtime.env.DB; runtime.owner = owner; db.close(); });
  db.exec("CREATE TABLE personal_library (owner TEXT, kind TEXT, id TEXT, day TEXT, payload TEXT, updated TEXT, PRIMARY KEY(owner,kind,id))");
  let beforeWrite;
  runtime.env.DB = { prepare(sql) {
    const statement = db.prepare(sql);
    return { bind(...args) { return {
      async all() { return { results: statement.all(...args) }; },
      async run() {
        if (beforeWrite) {
          const update = beforeWrite;
          beforeWrite = undefined;
          update(db);
        }
        return { meta: { changes: Number(statement.run(...args).changes) } };
      },
    }; } };
  } };
  let dropResponse = false;
  const fetch = t.mock.method(globalThis, "fetch", async (path, init) => {
    assert.equal(path, "/api/coach-protein");
    const response = await POST(new Request(origin + path, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: init.body,
    }));
    if (dropResponse) {
      dropResponse = false;
      throw new TypeError("response interrupted");
    }
    return response;
  });
  return { db, fetch, dropNextResponse: () => { dropResponse = true; },
    onWrite: (callback) => { beforeWrite = callback; },
    rows: (account = owner) => db.prepare("SELECT kind,id,day,payload,updated FROM personal_library WHERE owner=? ORDER BY kind,day").all(account),
  };
}

test("adds the product and two separate dated meals once, even after a lost response", async (t) => {
  const { db, rows, dropNextResponse } = fixture(t);
  const input = submission();
  dropNextResponse();
  await assert.rejects(saveCoachProtein(input), /response interrupted/);
  const saved = rows();
  assert.equal(saved.length, 4);
  assert.deepEqual(saved.filter(({ kind }) => kind === "nutrition").map(({ day }) => day), ["2026-11-23", "2026-11-24"]);
  const entry = JSON.parse(saved[0].payload).entry;
  assert.deepEqual(entry, { type: "meal", meal: "加餐", name: input.product.name, grams: 630, calories: 414, protein: 42, carbs: 33, fat: 12.6 });
  assert.deepEqual(JSON.parse(saved.find(({ kind }) => kind === "protein-preference").payload),
    { kind: "protein-preference", enabled: true, defaultProductId: input.product.id });
  assert.deepEqual(await saveCoachProtein(input), { warehouse: "existing", recorded: 2, defaultProductId: input.product.id });
  assert.deepEqual(rows(), saved);
  db.prepare("DELETE FROM personal_library WHERE owner=? AND kind='protein-warehouse'").run(owner);
  await assert.rejects(saveCoachProtein(input), { status: 409 });
  assert.deepEqual(rows(), saved.filter(({ kind }) => kind !== "protein-warehouse"));
});

test("a future retry preserves user edits and does not recreate a partially deleted batch", async (t) => {
  const { rows, db } = fixture(t);
  const input = submission();
  await saveCoachProtein(input);
  db.prepare("DELETE FROM personal_library WHERE owner=? AND id=?").run(owner, input.records[0].id);
  const before = rows();
  await assert.rejects(saveCoachProtein(input), { status: 409 });
  assert.deepEqual(rows(), before);

  const keep = before.find(({ kind }) => kind === "protein-warehouse");
  const sameNamed = { ...input, product: { ...input.product, id: crypto.randomUUID(), scoopGrams: 50 }, records: [] };
  assert.deepEqual(await saveCoachProtein(sameNamed), { warehouse: "existing", recorded: 0, defaultProductId: input.product.id });
  assert.deepEqual(rows().find(({ kind }) => kind === keep.kind), keep);
});

test("a concurrent warehouse change aborts every write in the batch and preserves the newer product", async (t) => {
  const { rows, onWrite } = fixture(t);
  const input = submission();
  const concurrent = submission().product;
  concurrent.name = "另一款蛋白粉";
  onWrite((db) => db.prepare("INSERT INTO personal_library VALUES (?,?,?,?,?,?)").run(
    owner, "protein-warehouse", "protein-warehouse", null,
    JSON.stringify({ kind: "protein-warehouse", products: [concurrent] }), "2026-11-24T15:00:00.000Z",
  ));
  await assert.rejects(saveCoachProtein(input), { status: 409 });
  assert.equal(rows().length, 1);
  assert.deepEqual(JSON.parse(rows()[0].payload).products, [concurrent]);
  assert.deepEqual(await saveCoachProtein(input), { warehouse: "added", recorded: 2, defaultProductId: input.product.id });
  assert.deepEqual(JSON.parse(rows().find(({ kind }) => kind === "protein-warehouse").payload).products, [concurrent, input.product]);
});

test("warehouse-only can save an incomplete label, while meals need verified or estimated nutrition", async (t) => {
  const { rows, fetch } = fixture(t);
  const input = submission();
  delete input.product.powder;
  runtime.owner = "different-owner";
  await assert.rejects(saveCoachProtein(input), { status: 403 });
  assert.equal(rows(runtime.owner).length, 0);
  assert.equal(rows().length, 0);
  runtime.owner = owner;
  await assert.rejects(saveCoachProtein(input), { status: 400 });
  assert.equal(rows().length, 0);
  const invalid = { ...input, records: [input.records[0], { ...input.records[1], date: input.records[0].date }] };
  await assert.rejects(saveCoachProtein(invalid), /请核对/);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(await saveCoachProtein({ ...input, records: [] }), { warehouse: "added", recorded: 0 });
  const draft = { name: "合成蛋白奶", grams: 630, calories: 410, protein: 42, carbs: 34, fat: 12 };
  assert.deepEqual(await saveCoachProtein({ ...input, addToWarehouse: false, records: [{ ...input.records[0], draft }] }),
    { warehouse: null, recorded: 1 });
  assert.equal(JSON.parse(rows().find(({ kind }) => kind === "nutrition").payload).entry.name, "合成蛋白奶（估算）");
});

test("adding the shake to the warehouse alone sets a complete estimated recipe as training default without duplicating meals", async (t) => {
  const { rows } = fixture(t);
  const input = submission();
  const draft = { name: input.product.name, grams: 630, calories: 410, protein: 42, carbs: 34, fat: 12 };
  await saveCoachProtein({ ...input, addToWarehouse: false, records: input.records.map((item) => ({ ...item, draft })) });
  const before = rows();
  assert.equal(before.length, 2);
  const product = { ...input.product, powderEstimated: true, scoopEstimated: true };
  assert.deepEqual(await saveCoachProtein({ ...input, product, records: [] }), { warehouse: "added", recorded: 0, defaultProductId: product.id });
  const after = rows();
  assert.deepEqual(after.filter(({ kind }) => kind === "nutrition"), before);
  const { products } = JSON.parse(after.find(({ kind }) => kind === "protein-warehouse").payload);
  const preference = JSON.parse(after.find(({ kind }) => kind === "protein-preference").payload);
  assert.deepEqual(products, [product]);
  assert.deepEqual(preference, { kind: "protein-preference", enabled: true, defaultProductId: product.id });
  const chosen = defaultWorkoutProteinProduct(products, preference.defaultProductId);
  const workoutFood = proteinMeal(chosen, "2026-11-25", "next-workout");
  assert.equal(workoutFood.entry.grams, 630);
  assert.equal(workoutFood.entry.calories, 414);
  assert.match(workoutFood.entry.name, /估算/);
});
