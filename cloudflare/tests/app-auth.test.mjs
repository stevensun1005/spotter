import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtime = globalThis.__spotterAppAuthTest = { env: {}, cookie: undefined, headers: new Headers() };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__spotterAppAuthTest.env", shortCircuit: true };
  if (specifier === "next/headers") return {
    url: "data:text/javascript,export async function cookies(){const token=globalThis.__spotterAppAuthTest.cookie;return{get(name){return name==='__Host-spotter_session'&&token?{value:token}:undefined}}}export async function headers(){return globalThis.__spotterAppAuthTest.headers}",
    shortCircuit: true,
  };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const source = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(source)) return next(source.href, context);
  }
  return next(specifier, context);
} });

const { POST: signIn } = await import("../app/api/auth/sign-in/route.ts");
const { POST: signOut } = await import("../app/api/auth/sign-out/route.ts");
const { GET: state } = await import("../app/api/state/route.ts");
const { appSessionRecoveryPath, safeReturnPath, signInPath } = await import("../features/auth/paths.ts");
const origin = "https://auth.synthetic.invalid";
const hash = (value) => createHash("sha256").update(value).digest("hex");

function post(path, body, currentOrigin = origin) {
  return new Request(origin + path, {
    method: "POST", headers: { Origin: currentOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("private preview identities come from valid, revocable D1 sessions, never request headers", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => { sqlite.close(); delete runtime.env.DB; runtime.cookie = undefined; });
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(readFileSync(new URL("drizzle/0011_spotter_access.sql", root), "utf8"));
  const sample = ["one", "two"].map((id) => ({ id, email: id + "@example.invalid", accessCode: randomBytes(24).toString("base64url") }));
  const insert = sqlite.prepare("INSERT INTO spotter_access_accounts (id, email, display_name, access_hash) VALUES (?, ?, ?, ?)");
  for (const user of sample) insert.run(user.id, user.email, "Synthetic Account", hash(user.accessCode));
  runtime.env.DB = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return { bind(...args) {
        return { async first() { return stmt.get(...args) ?? null; }, async run() { return stmt.run(...args); } };
      } };
    },
    async batch(writes) {
      sqlite.exec("BEGIN");
      try {
        const values = [];
        for (const write of writes) values.push(await write.run());
        sqlite.exec("COMMIT");
        return values;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };

  runtime.headers = new Headers({ "oai-authenticated-user-id": sample[1].id, "oai-authenticated-user-email": sample[1].email });
  assert.equal((await state()).status, 401);
  assert.equal((await signIn(post("/api/auth/sign-in", sample[0], "https://cross-origin.invalid"))).status, 403);
  assert.equal((await signIn(post("/api/auth/sign-in", { ...sample[0], accessCode: sample[1].accessCode }))).status, 401);
  const response = await signIn(post("/api/auth/sign-in", { ...sample[0], email: sample[0].email.toUpperCase() }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  const token = cookie.match(/^__Host-spotter_session=([a-f0-9]{64});/)[1];
  assert.match(cookie, /Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(await response.json(), { ok: true });
  const saved = sqlite.prepare("SELECT token_hash FROM spotter_access_sessions WHERE account_id = 'one'").get();
  assert.equal(saved.token_hash, hash(token));

  runtime.cookie = token;
  assert.deepEqual(await (await state()).json(), { me: { id: sample[0].id } });
  const rotated = await signIn(post("/api/auth/sign-in", sample[1]));
  const newToken = rotated.headers.get("set-cookie").match(/^__Host-spotter_session=([a-f0-9]{64});/)[1];
  assert.notEqual(newToken, token);
  assert.equal((await state()).status, 401);
  runtime.cookie = newToken;
  assert.deepEqual(await (await state()).json(), { me: { id: sample[1].id } });
  assert.equal((await signOut(post("/api/auth/sign-out", {}, "https://cross-origin.invalid"))).status, 403);
  assert.equal((await state()).status, 200);
  const out = await signOut(post("/api/auth/sign-out", {}));
  assert.equal(out.status, 303);
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(out.headers.get("location"), "/");
  assert.equal((await state()).status, 401);

  const next = await signIn(post("/api/auth/sign-in", sample[1]));
  runtime.cookie = next.headers.get("set-cookie").match(/^__Host-spotter_session=([a-f0-9]{64});/)[1];
  assert.equal((await state()).status, 200);
  sqlite.exec("UPDATE spotter_access_sessions SET expires_at = 0");
  assert.equal((await state()).status, 401);
});

test("sign-in return paths retain shared links without permitting other origins", () => {
  assert.equal(safeReturnPath("/#friend-invite=example"), "/#friend-invite=example");
  for (const unsafe of ["https://elsewhere.invalid/", "//elsewhere.invalid/", "/\\elsewhere.invalid/",
    "/%2felsewhere.invalid", "/.//elsewhere.invalid", "/api/workout", "/sign-in?return_to=/", ["/"]]) {
    assert.equal(safeReturnPath(unsafe), "/");
  }
});

test("iPhone session recovery preserves the workout for reauthentication and reloads after switching accounts", () => {
  const workout = "/training/492533f6-5abc-4e45-9a68-66e492bd25ad";
  assert.equal(appSessionRecoveryPath(true, "expired", workout), signInPath(workout));
  assert.equal(appSessionRecoveryPath(true, "expired", "//external.invalid/"), signInPath());
  assert.equal(appSessionRecoveryPath(true, "account-changed", workout), "/");
  assert.equal(appSessionRecoveryPath(false, "expired", workout), undefined);
  assert.equal(appSessionRecoveryPath(false, "account-changed", workout), undefined);
});
