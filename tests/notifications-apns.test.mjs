import assert from "node:assert/strict";
import { test } from "node:test";
import { pushAvailable, sendPush } from "../features/notifications/apns.ts";

const notification = { id: "synthetic-notification", kind: "buddy-reminder", actorName: "Private test nickname" };
const deviceToken = "ab".repeat(32);

async function configured() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const bytes = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const pem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(bytes).toString("base64") + "\n-----END PRIVATE KEY-----";
  return {
    env: { SPOTTER_APNS_TEAM_ID: "TESTTEAM01", SPOTTER_APNS_KEY_ID: "TESTKEY001", SPOTTER_APNS_PRIVATE_KEY: pem },
    publicKey: keys.publicKey,
    pem,
  };
}

test("APNs signs an ES256 provider JWT, caches it, and sends only a generic alert for Spotter", async (t) => {
  const { env, publicKey } = await configured();
  const sent = [];
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async (url, init) => {
    sent.push({ url, init });
    return new Response();
  });

  assert.equal(pushAvailable(env), true);
  assert.deepEqual(await Promise.all([
    sendPush(env, deviceToken, "production", notification),
    sendPush(env, deviceToken, "production", notification),
  ]), ["sent", "sent"]);
  const { url, init } = sent[0];
  assert.equal(url, "https://api.push.apple.com/3/device/" + deviceToken);
  assert.equal(init.redirect, "error");
  assert.equal(init.method, "POST");
  assert(init.signal instanceof AbortSignal);
  assert.equal(init.headers["apns-topic"], "app.spotter.health");
  assert.equal(init.headers["apns-push-type"], "alert");
  assert.equal(init.headers["apns-collapse-id"], notification.id);
  assert.equal(init.headers["apns-expiration"], String(now / 1000 + 7200));
  assert.deepEqual(JSON.parse(init.body), {
    aps: { alert: { title: "训练搭子", body: "你的搭子提醒你去训练。" }, sound: "default", "thread-id": "buddy-reminder" },
    notificationId: notification.id,
    kind: notification.kind,
  });
  const bearer = init.headers.authorization;
  assert.equal(sent[1].init.headers.authorization, bearer);
  const [header, claims, signature] = bearer.replace(/^bearer /, "").split(".");
  const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  assert.deepEqual(decode(header), { alg: "ES256", kid: env.SPOTTER_APNS_KEY_ID });
  assert.deepEqual(decode(claims), { iss: env.SPOTTER_APNS_TEAM_ID, iat: now / 1000 });
  assert.equal(Buffer.from(signature, "base64url").length, 64);
  assert(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey,
    Buffer.from(signature, "base64url"), Buffer.from(header + "." + claims)));
  now += 50 * 60 * 1000;
  assert.equal(await sendPush(env, deviceToken, "production", notification), "sent");
  assert.notEqual(sent[2].init.headers.authorization, bearer);
});

test("APNs separates sandbox credentials and never contacts an unconfigured provider", async (t) => {
  const { env, pem } = await configured();
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    sent.push({ url, init });
    return new Response();
  });
  assert.equal(pushAvailable({}), false);
  assert.equal(pushAvailable(env, "development"), false);
  assert.equal(await sendPush(env, deviceToken, "development", notification), "disabled");
  assert.equal(await sendPush({}, deviceToken, "production", notification), "disabled");
  assert.equal(await sendPush({ ...env, SPOTTER_APNS_PRIVATE_KEY: "not a key" }, deviceToken, "production", notification), "disabled");
  assert.equal(await sendPush({ ...env, SPOTTER_APNS_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----" }, deviceToken, "production", notification), "disabled");
  assert.equal(await sendPush(env, "../other/path", "production", notification), "invalid");
  assert.equal(sent.length, 0);

  const sandbox = { ...env, SPOTTER_APNS_SANDBOX_KEY_ID: "SANDBOX001", SPOTTER_APNS_SANDBOX_PRIVATE_KEY: pem.replaceAll("\n", "\\n") };
  assert.equal(pushAvailable(sandbox, "development"), true);
  assert.equal(await sendPush(sandbox, deviceToken, "development", { ...notification, kind: "friend-workout" }), "sent");
  assert.equal(sent[0].url, "https://api.sandbox.push.apple.com/3/device/" + deviceToken);
  const jwtHeader = sent[0].init.headers.authorization.replace(/^bearer /, "").split(".")[0];
  assert.equal(JSON.parse(Buffer.from(jwtHeader, "base64url").toString()).kid, sandbox.SPOTTER_APNS_SANDBOX_KEY_ID);
  assert.equal(JSON.parse(sent[0].init.body).aps.alert.body, "一位好友完成了训练。");
});

test("APNs invalidates rejected device tokens while letting the inbox survive other provider errors", async (t) => {
  const { env } = await configured();
  const cases = [
    { status: 400, reason: "BadDeviceToken", expected: "invalid" },
    { status: 400, reason: "DeviceTokenNotForTopic", expected: "invalid" },
    { status: 410, reason: "Unregistered", expected: "invalid" },
    { status: 403, reason: "InvalidProviderToken", expected: "retry" },
    { status: 429, reason: "TooManyRequests", expected: "retry" },
    { status: 503, reason: "ServiceUnavailable", expected: "retry" },
  ];
  t.mock.method(globalThis, "fetch", async () => {
    const result = cases.shift();
    if (!result) throw new DOMException("Synthetic aborted provider request", "TimeoutError");
    return Response.json({ reason: result.reason }, { status: result.status });
  });
  for (const { expected } of [...cases]) {
    assert.equal(await sendPush(env, deviceToken, "production", notification), expected);
  }
  assert.equal(await sendPush(env, deviceToken, "production", notification), "retry");
});
