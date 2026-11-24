import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const runtime = globalThis.__spotterOAuthTest = { env: {} };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return {
    url: "data:text/javascript,export const env = globalThis.__spotterOAuthTest.env", shortCircuit: true,
  };
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const auth = await import("../features/auth/oauth-routes.ts");
const { readSession, startAccountSession } = await import("../features/auth/server.ts");
const origin = "https://oauth.synthetic.invalid";
const sessionPrefix = "__Host-spotter_session=";
const googleId = "synthetic.apps.googleusercontent.com";
const appleId = "app.synthetic.web";
const providerKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const clientKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const urlHash = (value) => createHash("sha256").update(value).digest("base64url");
const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const seconds = () => Math.floor(Date.now() / 1000);

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of ["0011_spotter_access", "0013_spotter_oauth"]) {
    sqlite.exec(readFileSync(new URL(`drizzle/${name}.sql`, root), "utf8"));
  }
  for (const account of ["one", "two"]) {
    sqlite.prepare("INSERT INTO spotter_access_accounts (id,email,display_name,access_hash) VALUES (?,?,?,?)")
      .run(account, account + "@example.invalid", "Synthetic account", randomBytes(32).toString("hex"));
  }
  Object.assign(runtime.env, {
    DB: {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        return { bind(...args) { return {
          async first() { return statement.get(...args) ?? null; },
          async all() { return { results: statement.all(...args) }; },
          async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
        }; } };
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          for (const statement of statements) await statement.run();
          sqlite.exec("COMMIT");
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
    SPOTTER_OAUTH_ORIGIN: origin,
    GOOGLE_OAUTH_CLIENT_ID: googleId, GOOGLE_OAUTH_CLIENT_SECRET: "synthetic-google-secret",
    APPLE_OAUTH_CLIENT_ID: appleId, APPLE_OAUTH_TEAM_ID: "ABCDE12345", APPLE_OAUTH_KEY_ID: "XYZAB12345",
    APPLE_OAUTH_PRIVATE_KEY: clientKey.privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  t.after(() => {
    for (const key of Object.keys(runtime.env)) delete runtime.env[key];
    sqlite.close();
  });
  return sqlite;
}

function post(path, body, cookie, requestOrigin = origin) {
  const headers = new Headers({ "Content-Type": "application/json", Origin: requestOrigin });
  if (cookie) headers.set("Cookie", cookie);
  return new Request(origin + path, { method: "POST", headers, body: JSON.stringify(body) });
}

async function begin(input, cookie) {
  const response = await auth.oauthStart(post("/api/auth/oauth/start", input, cookie));
  assert.equal(response.status, 200);
  const { authorizationUrl } = await response.json();
  return {
    url: new URL(authorizationUrl),
    browserProof: response.headers.getSetCookie()[0]?.split(";")[0],
  };
}

function mockProvider(t, provider, authorize, claims = {}, forgeSignature = false) {
  const apple = provider === "apple";
  const clientId = apple ? appleId : googleId;
  const issuer = apple ? "https://appleid.apple.com" : "https://accounts.google.com";
  const tokenUrl = apple ? issuer + "/auth/token" : "https://oauth2.googleapis.com/token";
  const keyUrl = apple ? issuer + "/auth/keys" : "https://www.googleapis.com/oauth2/v3/certs";
  const snapshot = {
    iss: issuer, aud: clientId, sub: "new-synthetic-subject", email: "new@example.invalid",
    email_verified: true, name: "Synthetic OAuth", exp: seconds() + 600, iat: seconds(),
    nonce: authorize.searchParams.get("nonce"), ...claims,
  };
  const header = encode({ kid: "synthetic-key", alg: "RS256" });
  const parts = header + "." + encode(snapshot);
  const signature = (forgeSignature ? randomBytes(256) : sign("RSA-SHA256", Buffer.from(parts), providerKey.privateKey)).toString("base64url");
  return t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(init.redirect, "manual");
    if (url === tokenUrl) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("grant_type"), "authorization_code");
      assert.equal(form.get("client_id"), clientId);
      assert.equal(form.get("redirect_uri"), `${origin}/api/auth/oauth/${provider}/callback`);
      assert.equal(form.get("code"), "synthetic-code");
      if (apple) {
        assert.equal(authorize.searchParams.get("response_mode"), "form_post");
        const [header, claims, signature] = form.get("client_secret").split(".");
        assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "ES256", kid: "XYZAB12345" });
        const client = JSON.parse(Buffer.from(claims, "base64url"));
        assert.equal(client.iss, "ABCDE12345");
        assert.equal(client.aud, "https://appleid.apple.com");
        assert.equal(client.sub, appleId);
        assert.ok(client.exp > client.iat);
        assert.ok(verify("sha256", Buffer.from(`${header}.${claims}`), { key: clientKey.publicKey, dsaEncoding: "ieee-p1363" },
          Buffer.from(signature, "base64url")));
      } else {
        assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
        assert.equal(urlHash(form.get("code_verifier")), authorize.searchParams.get("code_challenge"));
      }
      return Response.json({ id_token: parts + "." + signature });
    }
    assert.equal(url, keyUrl);
    return Response.json({ keys: [{ ...providerKey.publicKey.export({ format: "jwk" }), kid: "synthetic-key", alg: "RS256", use: "sig" }] });
  });
}

function callback(provider, authorize, params = { code: "synthetic-code" }) {
  const body = new URLSearchParams({ ...params, state: authorize.searchParams.get("state") });
  const endpoint = `${origin}/api/auth/oauth/${provider}/callback`;
  return auth.oauthCallback(provider)(provider === "apple" ? new Request(endpoint, { method: "POST", body })
    : new Request(endpoint + "?" + body));
}

function completeWeb(location, cookie) {
  return auth.oauthWebComplete(new Request(origin + location, { headers: cookie ? { Cookie: cookie } : {} }));
}

test("OAuth options require complete provider configuration and an exact deployment origin", async (t) => {
  fixture(t);
  assert.deepEqual(await (await auth.oauthStatus(new Request(origin + "/api/auth/oauth"))).json(), {
    signedIn: false, providers: { apple: { enabled: true, linked: false }, google: { enabled: true, linked: false } },
  });
  delete runtime.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const result = await auth.oauthStatus(new Request(origin + "/api/auth/oauth"));
  assert.equal((await result.json()).providers.google.enabled, false);
  const wrongSite = await auth.oauthStatus(new Request("https://another.synthetic.invalid/api/auth/oauth"));
  assert.equal((await wrongSite.json()).providers.apple.enabled, false);
  assert.equal((await auth.oauthStart(post("/api/auth/oauth/start", { provider: "apple", mode: "login" },
    undefined, "https://elsewhere.invalid"))).status, 403);
  const session = sessionPrefix + await startAccountSession(runtime.env.DB, "one");
  assert.equal((await auth.oauthStart(post("/api/auth/oauth/start", { provider: "apple", mode: "link", expectedOwner: "two" }, session))).status, 403);
  assert.equal((await auth.oauthStart(post("/api/auth/oauth/start", { provider: "apple", mode: "link" }, session))).status, 400);
});

test("a first Google sign-in is bound to its browser, issues the existing session cookie, and resists replay", async (t) => {
  const db = fixture(t);
  const { url, browserProof } = await begin({ mode: "login", provider: "google" });
  assert.equal(url.origin, "https://accounts.google.com");
  assert.match(browserProof, /^__Host-spotter_oauth_/);
  const providerFetch = mockProvider(t, "google", url);
  const location = (await callback("google", url)).headers.get("Location");
  assert.match(location, /^\/api\/auth\/oauth\/web\/complete\?code=/);
  assert.equal((await completeWeb(location)).headers.get("Location"), "/sign-in?auth=oauth-expired");
  const complete = await completeWeb(location, browserProof);
  assert.equal(complete.headers.get("Location"), "/?auth=signed-in");
  const cookie = complete.headers.getSetCookie().find((value) => value.startsWith(sessionPrefix));
  assert.match(cookie, /Path=\/; HttpOnly; Secure; SameSite=Lax/);
  const token = cookie.split(";")[0].slice(sessionPrefix.length);
  const account = await readSession(runtime.env.DB, token);
  assert.equal(account.email, "new@example.invalid");
  assert.equal(db.prepare("SELECT account_id FROM spotter_oauth_identities WHERE provider='google'").get().account_id, account.userId);
  assert.equal((await completeWeb(location, browserProof)).headers.get("Location"), "/sign-in?auth=oauth-expired");
  assert.equal((await callback("google", url)).headers.get("Location"), "/sign-in?auth=oauth-expired");
  assert.equal(providerFetch.mock.callCount(), 2);
});

test("Apple web and Google native can link to the same original account while retaining its session", async (t) => {
  const db = fixture(t);
  const token = await startAccountSession(runtime.env.DB, "one");
  const cookie = sessionPrefix + token;
  const other = sessionPrefix + await startAccountSession(runtime.env.DB, "two");
  const apple = await begin({ mode: "link", provider: "apple", expectedOwner: "one" }, cookie);
  const mock = mockProvider(t, "apple", apple.url, { sub: "apple-unique-subject", email: "relay@example.invalid" });
  const appleLocation = (await callback("apple", apple.url)).headers.get("Location");
  assert.equal((await completeWeb(appleLocation, other + "; " + apple.browserProof)).headers.get("Location"), "/?auth=link-expired");
  const attached = await completeWeb(appleLocation, cookie + "; " + apple.browserProof);
  assert.equal(attached.headers.get("Location"), "/?auth=linked");
  assert.equal(attached.headers.getSetCookie().some((value) => value.startsWith(sessionPrefix)), false);
  mock.mock.restore();

  const verifier = randomBytes(32).toString("base64url");
  const nativeStart = await begin({ mode: "link", provider: "google", expectedOwner: "one", challenge: urlHash(verifier) }, cookie);
  assert.equal(nativeStart.browserProof, undefined);
  mockProvider(t, "google", nativeStart.url, { sub: "google-unique-subject", email: "different@example.invalid" });
  const link = new URL((await callback("google", nativeStart.url)).headers.get("Location"));
  assert.equal(link.protocol, "spotter-auth:");
  assert.equal(link.host, "oauth");
  const code = link.searchParams.get("code");
  const complete = (secret, session = cookie) => auth.oauthNativeComplete(post("/api/auth/oauth/native/complete", { code, verifier: secret }, session));
  assert.equal((await complete(randomBytes(32).toString("base64url"))).status, 400);
  assert.equal((await complete(verifier, other)).status, 400);
  assert.deepEqual(await (await complete(verifier)).json(), { status: "linked" });
  assert.equal((await complete(verifier)).status, 400);
  assert.equal((await readSession(runtime.env.DB, token)).userId, "one");
  assert.deepEqual(db.prepare("SELECT provider,account_id FROM spotter_oauth_identities ORDER BY provider").all()
    .map((x) => [x.provider, x.account_id]), [["apple", "one"], ["google", "one"]]);
  assert.equal(db.prepare("SELECT count(*) AS total FROM spotter_access_accounts").get().total, 2);
});

test("verified matching email never claims an existing account without a signed-in link", async (t) => {
  const db = fixture(t);
  const { url, browserProof } = await begin({ mode: "login", provider: "google" });
  mockProvider(t, "google", url, { email: "one@example.invalid" });
  const location = (await callback("google", url)).headers.get("Location");
  const result = await completeWeb(location, browserProof);
  assert.equal(result.headers.get("Location"), "/sign-in?auth=use-access-code");
  assert.equal(result.headers.getSetCookie().some((value) => value.startsWith(sessionPrefix)), false);
  assert.equal(db.prepare("SELECT count(*) AS total FROM spotter_oauth_identities").get().total, 0);
  assert.equal(db.prepare("SELECT count(*) AS total FROM spotter_access_accounts").get().total, 2);
});

test("a third-party identity already linked to a different owner stays with that owner", async (t) => {
  const db = fixture(t);
  db.prepare("INSERT INTO spotter_oauth_identities (provider,subject,account_id) VALUES ('google','foreign-subject','two')").run();
  const cookie = sessionPrefix + await startAccountSession(runtime.env.DB, "one");
  const { url, browserProof } = await begin({ mode: "link", provider: "google", expectedOwner: "one" }, cookie);
  mockProvider(t, "google", url, { sub: "foreign-subject", email: "one@example.invalid" });
  const redirect = (await callback("google", url)).headers.get("Location");
  assert.equal((await completeWeb(redirect, cookie + "; " + browserProof)).headers.get("Location"), "/?auth=link-conflict");
  assert.equal(db.prepare("SELECT account_id FROM spotter_oauth_identities").get().account_id, "two");
});

test("invalid provider issuer, audience, expiry, nonce and signature cannot issue a login grant", async (t) => {
  const db = fixture(t);
  t.mock.method(console, "error", () => {});
  for (const [claims, forged] of [[{ iss: "https://elsewhere.invalid" }], [{ aud: "another-client" }],
    [{ exp: seconds() - 1 }], [{ nonce: "unrelated-nonce" }], [{}, true]]) {
    const { url } = await begin({ mode: "login", provider: "google" });
    const mock = mockProvider(t, "google", url, claims, forged);
    assert.equal((await callback("google", url)).headers.get("Location"), "/sign-in?auth=oauth-error");
    mock.mock.restore();
  }
  assert.equal(db.prepare("SELECT count(*) AS total FROM spotter_oauth_grants").get().total, 0);
  assert.equal(db.prepare("SELECT count(*) AS total FROM spotter_oauth_identities").get().total, 0);
});
