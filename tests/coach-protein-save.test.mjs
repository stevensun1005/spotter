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
const { saveCoachProtein, saveExistingProtein } = await import("../features/nutrition/coach-protein-save.ts");
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
      async first() { return statement.get(...args) ?? null; },
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

test("a saved recipe records once, recognizes the existing workout cup, and allows an explicit second cup", async (t) => {
  const { rows, db, dropNextResponse } = fixture(t);
  const input = submission();
  await saveCoachProtein({ ...input, records: [] });
  const workout = proteinMeal(input.product, "2026-11-23", crypto.randomUUID());
  db.prepare("INSERT INTO personal_library VALUES (?,?,?,?,?,?)")
    .run(owner, "nutrition", workout.id, workout.date, JSON.stringify({ ...workout, sourceWorkoutId: workout.id }), "2026-11-23T20:00:00.000Z");

  const command = { action: "record-saved", expectedOwner: owner, recordId: crypto.randomUUID(),
    localDate: "2026-11-24", text: "昨天和今天我喝了蛋白粉，各一杯" };
  dropNextResponse();
  await assert.rejects(saveExistingProtein(command), /response interrupted/);
  const receipt = await saveExistingProtein(command);
  assert.equal(receipt.status, "complete");
  assert.deepEqual(receipt.records.map(({ date, alreadyRecorded, linkedWorkout }) => [date, alreadyRecorded, linkedWorkout]),
    [["2026-11-23", true, workout.id], ["2026-11-24", false, undefined]]);
  assert.equal(receipt.records[1].entry.protein, 42);
  assert.equal(rows().filter(({ kind }) => kind === "nutrition").length, 2);
  const repeated = await saveExistingProtein({ ...command, recordId: crypto.randomUUID(), text: "我喝了蛋白粉" });
  assert.equal(repeated.records[0].alreadyRecorded, true);
  const second = await saveExistingProtein({ ...command, recordId: crypto.randomUUID(), text: "我又喝了一杯蛋白粉", anotherCup: true });
  assert.equal(second.records[0].alreadyRecorded, false);
  assert.equal(rows().filter(({ kind }) => kind === "nutrition").length, 3);
});

test("saved drinks read the current account and ask which recipe when several are present", async (t) => {
  const { rows } = fixture(t);
  const input = submission();
  await saveCoachProtein({ ...input, records: [] });
  const other = { ...input.product, id: crypto.randomUUID(), name: "另一款合成乳清" };
  await saveCoachProtein({ ...input, product: other, records: [], setTrainingDefault: false });
  const command = { action: "record-saved", expectedOwner: owner, recordId: crypto.randomUUID(),
    localDate: "2026-11-24", text: "我喝了蛋白粉" };
  assert.equal((await saveExistingProtein(command)).products.length, 2);
  assert.equal(rows().filter(({ kind }) => kind === "nutrition").length, 0);
  const receipt = await saveExistingProtein({ ...command, text: "我喝了另一款合成乳清，加 300 mL 水和 40 g 粉" });
  assert.equal(receipt.productId, other.id);
  assert.equal(receipt.records[0].entry.grams, 340);
  assert.equal(receipt.records[0].entry.protein, 32);
  runtime.owner = "another-account";
  await assert.rejects(saveExistingProtein(command), { status: 403 });
  assert.equal(rows(runtime.owner).length, 0);
});

test("manual nutrition entry and coach entry arriving together only save one copy", async (t) => {
  const { rows } = fixture(t);
  const input = submission();
  await saveCoachProtein({ ...input, records: [] });
  const shared = { action: "record-saved", expectedOwner: owner, localDate: "2026-11-24", text: "我喝了蛋白粉" };
  const replies = await Promise.all([
    saveExistingProtein({ ...shared, recordId: crypto.randomUUID(), productId: input.product.id }),
    saveExistingProtein({ ...shared, recordId: crypto.randomUUID() }),
  ]);
  assert.equal(replies.filter(({ records }) => records[0].alreadyRecorded).length, 1);
  assert.equal(replies[0].records[0].id, replies[1].records[0].id);
  assert.equal(rows().filter(({ kind }) => kind === "nutrition").length, 1);
});
