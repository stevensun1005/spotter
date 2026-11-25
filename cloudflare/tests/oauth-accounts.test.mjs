import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const { POST: deleteAccount } = await import("../app/api/auth/delete-account/route.ts");
const { POST: appleAppStart } = await import("../app/api/auth/oauth/apple/app/start/route.ts");
const { POST: appleAppComplete } = await import("../app/api/auth/oauth/apple/app/complete/route.ts");
const { readSession, startAccountSession } = await import("../features/auth/server.ts");
const origin = "https://oauth.synthetic.invalid";
const sessionPrefix = "__Host-spotter_session=";
const googleId = "synthetic.apps.googleusercontent.com";
const appleId = "app.synthetic.web";
const appleAppId = "app.spotter.health";
const providerKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const clientKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const urlHash = (value) => createHash("sha256").update(value).digest("base64url");
const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const seconds = () => Math.floor(Date.now() / 1000);

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync(new URL("drizzle/", root)).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(`drizzle/${name}`, root), "utf8"));
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
          async run() {
            if (sql.startsWith("SELECT")) return { results: statement.all(...args), meta: { changes: 0 } };
            return { meta: { changes: Number(statement.run(...args).changes) } };
          },
        }; } };
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          sqlite.exec("COMMIT");
          return results;
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

function mockProvider(t, provider, authorize, claims = {}, forgeSignature = false, tokens = {}, nativeApple = false) {
  const apple = provider === "apple";
  const clientId = nativeApple ? appleAppId : apple ? appleId : googleId;
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
      assert.equal(form.get("redirect_uri"), nativeApple ? null : `${origin}/api/auth/oauth/${provider}/callback`);
      assert.equal(form.get("code"), "synthetic-code");
      if (apple) {
        if (!nativeApple) assert.equal(authorize.searchParams.get("response_mode"), "form_post");
        const [header, claims, signature] = form.get("client_secret").split(".");
        assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "ES256", kid: "XYZAB12345" });
        const client = JSON.parse(Buffer.from(claims, "base64url"));
        assert.equal(client.iss, "ABCDE12345");
        assert.equal(client.aud, "https://appleid.apple.com");
        assert.equal(client.sub, clientId);
        assert.ok(client.exp > client.iat);
        assert.ok(verify("sha256", Buffer.from(`${header}.${claims}`), { key: clientKey.publicKey, dsaEncoding: "ieee-p1363" },
          Buffer.from(signature, "base64url")));
      } else {
        assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
        assert.equal(urlHash(form.get("code_verifier")), authorize.searchParams.get("code_challenge"));
      }
      return Response.json({ ...tokens, id_token: parts + "." + signature });
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
    signedIn: false, nativeAppleEnabled: false, providers: { apple: { enabled: true, linked: false }, google: { enabled: true, linked: false } },
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

const appleAppStartPath = "/api/auth/oauth/apple/app/start";
const appleAppCompletePath = "/api/auth/oauth/apple/app/complete";

async function startAppleApp(input = { mode: "login" }, cookie) {
  const verifier = randomBytes(32).toString("base64url");
  const response = await appleAppStart(post(appleAppStartPath, { ...input, challenge: urlHash(verifier) }, cookie));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 0);
  const { state, nonce } = await response.json();
  const authorize = { searchParams: new URLSearchParams({ state, nonce }) };
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
  return { authorize, body: { state, code: "synthetic-code", verifier } };
}

test("AuthenticationServices exchanges the iPhone code without a web redirect and logs into the existing Apple identity", async (t) => {
  const db = fixture(t);
  const verifier = randomBytes(32).toString("base64url");
  const startBody = { mode: "login", challenge: urlHash(verifier) };
  assert.equal((await appleAppStart(post(appleAppStartPath, startBody))).status, 503);
  runtime.env.APPLE_OAUTH_NATIVE_CLIENT_ID = "wrong.bundle";
  assert.equal((await appleAppStart(post(appleAppStartPath, startBody))).status, 503);
  runtime.env.APPLE_OAUTH_NATIVE_CLIENT_ID = appleAppId;
  runtime.env.SPOTTER_APPLE_TOKEN_KEY = randomBytes(32).toString("base64url");
  assert.equal((await (await auth.oauthStatus(new Request(origin + "/api/auth/oauth"))).json()).nativeAppleEnabled, true);
  assert.equal((await appleAppStart(post(appleAppStartPath, startBody, undefined, "https://other.invalid"))).status, 403);
  assert.equal((await appleAppStart(post(appleAppStartPath, { ...startBody, expectedOwner: "one" }))).status, 400);
  db.prepare("INSERT INTO spotter_oauth_identities (provider,subject,account_id) VALUES ('apple','same-user','one')").run();
  const { authorize, body } = await startAppleApp();
  // A state from the Apple app is unrecognizable to both browser callback completion paths.
  assert.equal((await callback("apple", authorize)).headers.get("Location"), "/sign-in?auth=oauth-expired");
  const browser = await begin({ mode: "login", provider: "apple", challenge: startBody.challenge });
  assert.equal((await appleAppComplete(post(appleAppCompletePath, { ...body,
    state: browser.url.searchParams.get("state"), verifier }))).status, 400);
  const mock = mockProvider(t, "apple", authorize, { sub: "same-user" }, false,
    { refresh_token: "synthetic-native-refresh" }, true);
  assert.equal((await appleAppComplete(post(appleAppCompletePath, { ...body, verifier }))).status, 400);
  assert.equal((await appleAppComplete(post(appleAppCompletePath, body, undefined, "https://other.invalid"))).status, 403);
  const other = sessionPrefix + await startAccountSession(runtime.env.DB, "two");
  assert.equal((await appleAppComplete(post(appleAppCompletePath, body, other))).status, 400);
  assert.equal(mock.mock.callCount(), 0);
  const result = await appleAppComplete(post(appleAppCompletePath, body));
  assert.deepEqual(await result.json(), { status: "signed-in" });
  const token = result.headers.get("Set-Cookie").match(/^__Host-spotter_session=([a-f0-9]{64});/)[1];
  assert.equal((await readSession(runtime.env.DB, token)).userId, "one");
  assert.equal((await appleAppComplete(post(appleAppCompletePath, body))).status, 400);
  assert.equal(mock.mock.callCount(), 2);
  const saved = db.prepare("SELECT apple_credential, apple_app_credential FROM spotter_oauth_identities").get();
  assert.equal(saved.apple_credential, null);
  assert.match(saved.apple_app_credential, /^v1\.r\./);
  assert.doesNotMatch(saved.apple_app_credential, /synthetic-native/);
});

test("iPhone Apple linking preserves the original login and verifies the exact session, nonce and Bundle ID", async (t) => {
  const db = fixture(t);
  runtime.env.APPLE_OAUTH_NATIVE_CLIENT_ID = appleAppId;
  const token = await startAccountSession(runtime.env.DB, "one");
  const cookie = sessionPrefix + token;
  const sameOwnerDifferentSession = sessionPrefix + await startAccountSession(runtime.env.DB, "one");
  const other = sessionPrefix + await startAccountSession(runtime.env.DB, "two");
  const link = { mode: "link", expectedOwner: "one" };
  db.prepare("INSERT INTO spotter_oauth_identities (provider,subject,account_id) VALUES ('google','google-current','one')").run();
  const denied = await appleAppStart(post(appleAppStartPath, { ...link, challenge: urlHash(randomBytes(32).toString("base64url")) }, other));
  assert.equal(denied.status, 403);
  t.mock.method(console, "error", () => {});
  for (const claims of [{ aud: appleId }, { nonce: "wrong-nonce" }]) {
    const failed = await startAppleApp(link, cookie);
    const mocked = mockProvider(t, "apple", failed.authorize, claims, false, {}, true);
    const result = await appleAppComplete(post(appleAppCompletePath, failed.body, cookie));
    assert.equal(result.status, 400);
    assert.equal((await result.json()).code, "link-error");
    assert.equal((await appleAppComplete(post(appleAppCompletePath, failed.body, cookie))).status, 400);
    assert.equal(mocked.mock.callCount(), 2);
    mocked.mock.restore();
  }
  const native = await startAppleApp(link, cookie);
  const mock = mockProvider(t, "apple", native.authorize, { sub: "apple-current", email: "two@example.invalid" }, false, {}, true);
  for (const wrongCookie of [undefined, sameOwnerDifferentSession, other]) {
    assert.equal((await appleAppComplete(post(appleAppCompletePath, native.body, wrongCookie))).status, 400);
  }
  assert.equal(mock.mock.callCount(), 0);
  const result = await appleAppComplete(post(appleAppCompletePath, native.body, cookie));
  assert.deepEqual(await result.json(), { status: "linked" });
  assert.equal(result.headers.getSetCookie().length, 0);
  assert.equal((await readSession(runtime.env.DB, token)).userId, "one");
  assert.deepEqual(db.prepare("SELECT provider,account_id FROM spotter_oauth_identities ORDER BY provider").all()
    .map(({ provider, account_id }) => [provider, account_id]), [["apple", "one"], ["google", "one"]]);
});

const deletionPath = "/api/auth/delete-account";
const confirmation = { expectedOwner: "one", confirm: true };

function seedAccountData(db) {
  for (const owner of ["one", "two"]) {
    db.prepare("INSERT INTO entries (owner,id,kind,payload,updated) VALUES (?,'workout','log','{}','now')").run(owner);
    db.prepare("INSERT INTO workout_heart (owner,workout_id,payload) VALUES (?,'workout','{}')").run(owner);
    db.prepare("INSERT INTO personal_library (owner,kind,id,payload,updated) VALUES (?,'body','weight','{}','now')").run(owner);
    db.prepare("INSERT INTO training_programs (owner,id,payload,revision,updated_at) VALUES (?,'program','{}','rev','now')").run(owner);
    db.prepare("INSERT INTO program_plan_links (owner,program_id,session_id,payload) VALUES (?,'program','session','{}')").run(owner);
    db.prepare("INSERT INTO program_commits (owner,program_id,revision,preview_token,payload) VALUES (?,'program','rev','preview','{}')").run(owner);
    db.prepare("INSERT INTO program_rules (owner,payload,revision,updated_at) VALUES (?,'{}','rev','now')").run(owner);
    db.prepare("INSERT INTO agent_connections (id,owner,name,token_hash,scopes,created_at,expires_at) " +
      "VALUES (?,?,'agent',?,'[]','now','later')").run(owner, owner, urlHash(owner));
    db.prepare("INSERT INTO agent_rate_windows (connection_id,window,requests) VALUES (?,0,1)").run(owner);
    db.prepare("INSERT INTO agent_plan_drafts (owner,id,title,payload,content_hash,created_at,expires_at) " +
      "VALUES (?,'draft','title','{}','hash','now','later')").run(owner);
    db.prepare("INSERT INTO agent_draft_items (owner,draft_id,plan_id,was_added) VALUES (?,'draft','plan',1)").run(owner);
    db.prepare("INSERT INTO ai_coach_quota (day,owner,requests) VALUES (1,?,3)").run(owner);
    db.prepare("INSERT INTO ai_coach_budget (month,owner,charged_nanos) VALUES ('2026-11',?,5)").run(owner);
    db.prepare("INSERT INTO friend_invites (owner,name,code,expires_at) VALUES (?,?,?,'later')").run(owner, owner, owner);
    db.prepare("INSERT INTO friend_profiles (owner,name,search_name) VALUES (?,?,?)").run(owner, owner, owner);
  }
  db.exec(`
    INSERT INTO rooms (id,invite,owner) VALUES ('shared','shared','one'),('unrelated','other-invite','two');
    INSERT INTO members (user,room,name) VALUES ('one','shared','First'),('two','shared','Second');
    INSERT INTO entries VALUES ('two','cheer','cheer','{"recipient":"one"}','now');
    INSERT INTO friend_links (first_id,second_id,first_name,second_name) VALUES ('one','two','First','Second');
    INSERT INTO friend_feed_cheers (recipient,day,sender) VALUES ('one','2026-11-23','two'),('two','2026-11-23','one'),('two','2026-11-23','unrelated');
    INSERT INTO friend_requests (id,first_id,second_id,sender,receiver,sender_name,receiver_name,created_at)
      VALUES ('request','one','two','one','two','First','Second','now');
    INSERT INTO coaching_invites (coach_id,coach_name,code_hash,expires_at,claimed_by)
      VALUES ('two','Second','claim','later','one'),('one','First','invite','later',NULL);
    INSERT INTO coaching_links (id,coach_id,coach_name,student_id,student_name,created_at)
      VALUES ('coaching','one','First','two','Second','now');
    INSERT INTO coaching_assignments (id,link_id,coach_id,student_id,request_hash,kind,payload,revision,program_id,created_at)
      VALUES ('assignment','coaching','one','two','hash','plan','{}','rev','imported','now');
    INSERT INTO coaching_lessons (id,link_id,delta,note,created_at) VALUES ('lesson','coaching',1,'private note','now');
  `);
}

test("account deletion revokes the encrypted Apple token and clears the account without affecting another user's records", async (t) => {
  const db = fixture(t);
  seedAccountData(db);
  const access = await startAccountSession(runtime.env.DB, "one");
  const secondDevice = await startAccountSession(runtime.env.DB, "one");
  const other = await startAccountSession(runtime.env.DB, "two");
  const cookie = sessionPrefix + access;
  runtime.env.SPOTTER_APPLE_TOKEN_KEY = randomBytes(32).toString("base64url");
  const refreshToken = "synthetic-apple-refresh";
  const appleSubject = "synthetic-apple-subject";
  const start = await begin({ provider: "apple", mode: "link", expectedOwner: "one" }, cookie);
  const provider = mockProvider(t, "apple", start.url, { sub: appleSubject }, false,
    { refresh_token: refreshToken, access_token: "synthetic-apple-access" });
  const location = (await callback("apple", start.url)).headers.get("Location");
  const grant = db.prepare("SELECT apple_credential FROM spotter_oauth_grants").get().apple_credential;
  assert.match(grant, /^v1\.r\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(grant, /synthetic-apple/);
  assert.equal((await completeWeb(location, cookie + "; " + start.browserProof)).headers.get("Location"), "/?auth=linked");
  assert.equal(db.prepare("SELECT apple_credential FROM spotter_oauth_identities WHERE provider='apple'").get().apple_credential, grant);
  provider.mock.restore();

  const login = await begin({ provider: "apple", mode: "login" });
  const loginProvider = mockProvider(t, "apple", login.url, { sub: appleSubject }, false,
    { access_token: "synthetic-new-access-only" });
  const loginCallback = (await callback("apple", login.url)).headers.get("Location");
  assert.equal((await completeWeb(loginCallback, login.browserProof)).headers.get("Location"), "/?auth=signed-in");
  assert.equal(db.prepare("SELECT apple_credential FROM spotter_oauth_identities WHERE provider='apple'").get().apple_credential, grant);
  loginProvider.mock.restore();

  runtime.env.APPLE_OAUTH_NATIVE_CLIENT_ID = appleAppId;
  const appRefreshToken = "synthetic-app-refresh";
  const native = await startAppleApp();
  const nativeProvider = mockProvider(t, "apple", native.authorize, { sub: appleSubject }, false,
    { refresh_token: appRefreshToken }, true);
  assert.deepEqual(await (await appleAppComplete(post(appleAppCompletePath, native.body))).json(), { status: "signed-in" });
  nativeProvider.mock.restore();
  assert.equal(db.prepare("SELECT apple_credential FROM spotter_oauth_identities WHERE provider='apple'").get().apple_credential, grant);

  db.prepare("INSERT INTO spotter_oauth_identities (provider,subject,account_id) VALUES ('google','g1','one'),('google','g2','two')").run();
  await begin({ provider: "apple", mode: "link", expectedOwner: "two" }, sessionPrefix + other);
  const pending = await begin({ provider: "apple", mode: "login" });
  const pendingProvider = mockProvider(t, "apple", pending.url, { sub: appleSubject });
  await callback("apple", pending.url);
  pendingProvider.mock.restore();
  assert.equal(db.prepare("SELECT count(*) AS count FROM spotter_oauth_grants").get().count, 1);

  const expectedTokens = new Map([[appleId, refreshToken], [appleAppId, appRefreshToken]]);
  const result = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://appleid.apple.com/auth/revoke");
    assert.equal(options.redirect, "manual");
    const clientId = options.body.get("client_id");
    assert.equal(options.body.get("token"), expectedTokens.get(clientId));
    assert.equal(expectedTokens.delete(clientId), true);
    assert.equal(options.body.get("token_type_hint"), "refresh_token");
    assert.equal(db.prepare("SELECT count(*) AS count FROM spotter_access_accounts WHERE id='one'").get().count, 0);
    return new Response(null, { status: 200 });
  });
  assert.equal((await deleteAccount(post(deletionPath, confirmation, sessionPrefix + other))).status, 403);
  assert.equal((await deleteAccount(post(deletionPath, confirmation, cookie, "https://outside.invalid"))).status, 403);
  assert.equal((await deleteAccount(post(deletionPath, { expectedOwner: "one" }, cookie))).status, 400);
  assert.equal((await deleteAccount(post(deletionPath, confirmation, cookie + "; " + cookie))).status, 401);
  assert.equal(result.mock.callCount(), 0);
  const deleted = await deleteAccount(post(deletionPath, confirmation, cookie));
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true, appleRevocation: "revoked" });
  assert.match(deleted.headers.get("Set-Cookie"), /Max-Age=0; Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await deleteAccount(post(deletionPath, confirmation, cookie))).status, 401);
  assert.equal(result.mock.callCount(), 2);
  assert.equal(expectedTokens.size, 0);
  assert.equal(await readSession(runtime.env.DB, access), null);
  assert.equal(await readSession(runtime.env.DB, secondDevice), null);
  assert.equal((await readSession(runtime.env.DB, other)).userId, "two");

  const owned = ["entries", "workout_heart", "personal_library", "agent_connections", "agent_plan_drafts",
    "agent_draft_items", "training_programs", "program_rules", "program_plan_links", "program_commits",
    "friend_profiles", "friend_invites", "ai_coach_quota", "ai_coach_budget"];
  for (const table of owned) assert.deepEqual(db.prepare(`SELECT owner FROM ${table}`).all().map((row) => row.owner), ["two"], table);
  const removes = ["friend_links", "friend_requests", "members", "coaching_invites", "coaching_assignments",
    "coaching_links", "coaching_lessons", "spotter_oauth_grants"];
  for (const table of removes) assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, 0, table);
  assert.deepEqual(db.prepare("SELECT sender FROM friend_feed_cheers").all().map(({ sender }) => sender), ["unrelated"]);
  assert.equal(db.prepare("SELECT id FROM rooms").get().id, "unrelated");
  assert.equal(db.prepare("SELECT account_id FROM spotter_oauth_identities").get().account_id, "two");
  assert.equal(db.prepare("SELECT account_id FROM spotter_oauth_flows").get().account_id, "two");
  assert.equal(db.prepare("SELECT connection_id FROM agent_rate_windows").get().connection_id, "two");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("account deletion keeps data and authorization on a failed transaction, then supports manual Apple revocation", async (t) => {
  const db = fixture(t);
  seedAccountData(db);
  const token = await startAccountSession(runtime.env.DB, "one");
  const cookie = sessionPrefix + token;
  db.exec("INSERT INTO spotter_oauth_identities (provider,subject,account_id) VALUES ('apple','legacy-apple','one')");
  db.exec("CREATE TRIGGER simulated_failure BEFORE DELETE ON rooms BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  const failures = t.mock.method(console, "error", () => {});
  const outgoing = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected revocation"); });
  assert.equal((await deleteAccount(post(deletionPath, confirmation, cookie))).status, 503);
  assert.equal((await readSession(runtime.env.DB, token)).userId, "one");
  assert.equal(db.prepare("SELECT count(*) AS count FROM workout_heart").get().count, 2);
  assert.equal(db.prepare("SELECT count(*) AS count FROM personal_library").get().count, 2);
  assert.equal(db.prepare("SELECT account_id FROM spotter_oauth_identities").get().account_id, "one");
  assert.equal(failures.mock.calls[0].arguments.length, 1);
  db.exec("DROP TRIGGER simulated_failure");
  const deleted = await deleteAccount(post(deletionPath, confirmation, cookie));
  assert.deepEqual(await deleted.json(), { deleted: true, appleRevocation: "manual" });
  assert.equal(await readSession(runtime.env.DB, token), null);
  assert.equal(outgoing.mock.callCount(), 0);

  const other = sessionPrefix + await startAccountSession(runtime.env.DB, "two");
  const noApple = await deleteAccount(post(deletionPath, { expectedOwner: "two", confirm: true }, other));
  assert.deepEqual(await noApple.json(), { deleted: true, appleRevocation: "not-required" });
  assert.equal(outgoing.mock.callCount(), 0);
});

test("deletion rechecks the specific session as part of the same data transaction", async (t) => {
  const db = fixture(t);
  seedAccountData(db);
  const token = await startAccountSession(runtime.env.DB, "one");
  const survivingSession = await startAccountSession(runtime.env.DB, "one");
  const batch = runtime.env.DB.batch;
  runtime.env.DB.batch = (statements) => {
    db.prepare("DELETE FROM spotter_access_sessions WHERE token_hash=?")
      .run(createHash("sha256").update(token).digest("hex"));
    return batch(statements);
  };
  assert.equal((await deleteAccount(post(deletionPath, confirmation, sessionPrefix + token))).status, 401);
  assert.equal((await readSession(runtime.env.DB, survivingSession)).userId, "one");
  assert.equal(db.prepare("SELECT count(*) AS count FROM entries WHERE owner='one'").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM friend_links").get().count, 1);
});
