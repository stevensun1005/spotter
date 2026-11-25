export type PushEnvironment = "production" | "development";
export type PushResult = "sent" | "invalid" | "retry" | "disabled";

type PushNotification = {
  id: string;
  kind: "buddy-reminder" | "friend-workout";
  actorName?: string;
};

type Credentials = { teamId: string; keyId: string; privateKey: string };
type CachedToken = Credentials & { until: number; jwt: Promise<string> };

const topic = "app.spotter.health";
const hosts = {
  production: "https://api.push.apple.com",
  development: "https://api.sandbox.push.apple.com",
} as const;
const alerts = {
  "buddy-reminder": { body: "你的搭子提醒你去训练。", lifetimeSeconds: 2 * 60 * 60 },
  "friend-workout": { body: "一位好友完成了训练。", lifetimeSeconds: 8 * 60 * 60 },
} as const;
const identifier = /^[A-Z0-9]{10}$/;
const privateKeyPEM = /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z\d+/=\s]+)-----END PRIVATE KEY-----$/;
const deviceToken = /^(?:[0-9a-f]{2}){16,256}$/i;
const notificationId = /^[A-Za-z0-9_-]{1,64}$/;
const encoder = new TextEncoder();
const tokenCache = new Map<PushEnvironment, CachedToken>();

function credentials(env: Cloudflare.Env, environment: PushEnvironment): Credentials | undefined {
  const teamId = env.SPOTTER_APNS_TEAM_ID?.trim();
  const development = environment === "development";
  const keyId = (development ? env.SPOTTER_APNS_SANDBOX_KEY_ID : env.SPOTTER_APNS_KEY_ID)?.trim();
  const pem = (development ? env.SPOTTER_APNS_SANDBOX_PRIVATE_KEY : env.SPOTTER_APNS_PRIVATE_KEY)
    ?.trim().replace(/\\n/g, "\n");
  if (!teamId || !identifier.test(teamId) || !keyId || !identifier.test(keyId) || !pem || pem.length > 4_096) return;
  const privateKey = privateKeyPEM.exec(pem)?.[1].replace(/\s/g, "");
  if (privateKey) return { teamId, keyId, privateKey };
}

export function pushAvailable(env: Cloudflare.Env, environment: PushEnvironment = "production") {
  return credentials(env, environment) !== undefined;
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signToken(config: Credentials, issuedAt: number) {
  const decoded = Uint8Array.from(atob(config.privateKey), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", decoded, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "ES256", kid: config.keyId })));
  const claims = base64Url(encoder.encode(JSON.stringify({ iss: config.teamId, iat: issuedAt })));
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function providerToken(config: Credentials, environment: PushEnvironment, now: number): Promise<string> {
  const cached = tokenCache.get(environment);
  if (cached && cached.until > now && cached.teamId === config.teamId &&
      cached.keyId === config.keyId && cached.privateKey === config.privateKey) return cached.jwt;

  // APNs accepts tokens for one hour and discourages updates more than every 20 minutes.
  const next = { ...config, until: now + 50 * 60, jwt: signToken(config, now) };
  tokenCache.set(environment, next);
  return next.jwt;
}

export async function sendPush(env: Cloudflare.Env, token: string, environment: PushEnvironment,
  notification: PushNotification): Promise<PushResult> {
  const config = credentials(env, environment);
  if (!config) return "disabled";
  if (!deviceToken.test(token)) return "invalid";
  if (!notificationId.test(notification.id)) return "disabled";

  const now = Math.floor(Date.now() / 1000);
  let jwt: string;
  try { jwt = await providerToken(config, environment, now); }
  catch { return "disabled"; }

  const alert = alerts[notification.kind];
  try {
    const response = await fetch(`${hosts[environment]}/3/device/${token.toLowerCase()}`, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(now + alert.lifetimeSeconds),
        "apns-collapse-id": notification.id,
        "content-type": "application/json",
      },
      // The authenticated inbox shows details. Lock screen alerts carry no nickname or workout data.
      body: JSON.stringify({
        aps: { alert: { title: "训练搭子", body: alert.body }, sound: "default", "thread-id": notification.kind },
        notificationId: notification.id,
        kind: notification.kind,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 200) return "sent";
    if (response.status === 400) {
      const problem = await response.json().catch(() => null) as { reason?: string } | null;
      if (problem?.reason === "BadDeviceToken" || problem?.reason === "DeviceTokenNotForTopic") return "invalid";
    } else {
      await response.body?.cancel().catch(() => undefined);
    }
    return response.status === 410 ? "invalid" : "retry";
  } catch {
    // The server's inbox record survives timeouts and provider errors.
    return "retry";
  }
}
