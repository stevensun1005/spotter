import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtime = globalThis.__spotterWorkoutPreferencesTest = { env: {}, owner: null };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") {
      return { url: "data:text/javascript,export const env=globalThis.__spotterWorkoutPreferencesTest.env", shortCircuit: true };
    }
    if (specifier === "@/server/account") {
      const http = new URL("server/http.ts", root).href;
      const stub = `import { HttpError } from ${JSON.stringify(http)};
        export async function requireAccount() {
          const id = globalThis.__spotterWorkoutPreferencesTest.owner;
          if (!id) throw new HttpError(401, "Please sign in.");
          return { id };
        }`;
      return { url: "data:text/javascript," + encodeURIComponent(stub), shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return next(new URL(specifier.slice(2) + (specifier.endsWith(".json") ? "" : ".ts"), root).href, context);
    }
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const file = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(file)) return next(file.href, context);
    }
    return next(specifier, context);
  },
});

const workout = await import("../app/api/workout-preferences/route.ts");
const data = await import("../app/api/data/route.ts");
const origin = "https://workout-preferences.test";
const account = "synthetic-preferences-owner";
const second = "synthetic-preferences-second";
const gyms = { active: "home", profiles: [{ id: "home", name: "Home", gear: ["dumbbell", "bench"] }] };
const staleGyms = { active: "gym", profiles: [{ id: "gym", name: "Old gym", gear: ["barbell"] }] };

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const migrations = new URL("drizzle/", root);
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
  }
  runtime.env.DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) {
        const execute = () => statement.columns().length
          ? { results: statement.all(...args), meta: { changes: 0 } }
          : { results: [], meta: { changes: Number(statement.run(...args).changes) } };
        return { first: async () => statement.get(...args) ?? null, all: async () => execute(), execute };
      } };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  runtime.owner = account;
  t.after(() => { sqlite.close(); delete runtime.env.DB; runtime.owner = null; });
}

function post(preferences, { initialize, expectedOwner = account } = {}) {
  return workout.POST(new Request(origin + "/api/workout-preferences", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ expectedOwner, preferences, initialize }),
  }));
}

async function result(response, status = 200) {
  const received = await response;
  const value = await received.json();
  assert.equal(received.status, status, value.error);
  assert.match(received.headers.get("cache-control"), /private, no-store/);
  return value;
}

test("initialization fills only missing workout settings and independent patches compose", async (t) => {
  fixture(t);
  const request = new Request(origin + "/api/workout-preferences");
  assert.deepEqual(await result(workout.GET(request)), { owner: account, preferences: {} });
  await result(post({ gyms, defaultUnit: "lb" }));
  const initialized = await result(post({ gyms: staleGyms, defaultUnit: "kg", defaultRest: 45 }, { initialize: true }));
  assert.deepEqual(initialized.preferences, { gyms, defaultUnit: "lb", defaultRest: 45 });
  await Promise.all([
    result(post({ defaultUnit: "kg" })),
    result(post({ defaultRest: 0 })),
  ]);
  assert.deepEqual(await result(workout.GET(request)), { owner: account, preferences: { gyms, defaultUnit: "kg", defaultRest: 0 } });
  await result(post({ gyms: { ...gyms, active: "unknown" } }), 400);
  await result(post({ defaultRest: 90 }, { expectedOwner: second }), 403);
  assert.deepEqual((await result(workout.GET(request))).preferences, { gyms, defaultUnit: "kg", defaultRest: 0 });
  runtime.owner = second;
  assert.deepEqual(await result(workout.GET(request)), { owner: second, preferences: {} });
  await result(post({ defaultRest: 90 }), 403);
  runtime.owner = null;
  await result(workout.GET(request), 401);
});

test("workout settings are included in the private training backup and remain on the restoring account", async (t) => {
  fixture(t);
  const preferences = { gyms, defaultUnit: "lb", defaultRest: 75 };
  await result(post(preferences));
  const training = await result(data.GET(new Request(origin + "/api/data?scope=training&from=2026-11-01&to=2026-11-30")));
  assert.deepEqual(training.library, [{ kind: "workout-preferences", values: preferences }]);
  assert.deepEqual((await result(data.GET(new Request(origin + "/api/data?scope=all")))).library, training.library);
  assert.deepEqual((await result(data.GET(new Request(origin + "/api/data?scope=nutrition")))).library, []);
  runtime.owner = second;
  assert.deepEqual((await result(data.GET(new Request(origin + "/api/data?scope=training")))).library, []);
  const restore = () => data.POST(new Request(origin + "/api/data?expectedOwner=" + second, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(training),
  }));
  assert.deepEqual(await result(restore()), { added: 1, skipped: 0 });
  await result(post({ defaultRest: 120 }, { expectedOwner: second }));
  assert.deepEqual(await result(restore()), { added: 0, skipped: 1 });
  assert.deepEqual((await result(workout.GET(new Request(origin + "/api/workout-preferences")))).preferences,
    { ...preferences, defaultRest: 120 });
  runtime.owner = account;
  assert.deepEqual((await result(workout.GET(new Request(origin + "/api/workout-preferences")))).preferences, preferences);
});
