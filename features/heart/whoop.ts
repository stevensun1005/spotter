import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { HttpError, publicOrigin } from "@/server/http";
import { matchingSummary, sourceSummary, type TimeWindow } from "./model";

const WHOOP = "https://api.prod.whoop.com";
const callbackPath = "/api/health/whoop/callback";
const stateCookie = "spotter_whoop_flow";
const ttl = 10 * 60;
export const whoopStatuses = ["synced", "empty", "cancelled", "error"] as const;
export type WhoopStatus = typeof whoopStatuses[number];

function credentials() {
  const id = process.env.WHOOP_CLIENT_ID;
  const secret = process.env.WHOOP_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(503, "此站点尚未配置 WHOOP 授权。");
  return { id, secret };
}

export function whoopEnabled() {
  return Boolean(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
}

const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
const equal = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const cookieOptions = (origin: string) => ({ path: callbackPath, httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax" as const });

export async function whoopAuthorization(request: Request, owner: string, workout: string) {
  const { id, secret } = credentials();
  const origin = publicOrigin(request);
  const state = randomBytes(6).toString("base64url");
  const flow = [state, owner, workout, Date.now() + ttl * 1000].join(".");
  (await cookies()).set(stateCookie, flow + "." + sign(flow, secret), { ...cookieOptions(origin), maxAge: ttl });
  const url = new URL("/oauth/oauth2/auth", WHOOP);
  url.search = new URLSearchParams({
    response_type: "code", client_id: id, redirect_uri: origin + callbackPath,
    scope: "read:workout", state,
  }).toString();
  return url.href;
}

export async function whoopCallbackFlow(request: Request, owner: string) {
  const { secret } = credentials();
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const [state, account, workout, expires, signature, extra] = (jar.get(stateCookie)?.value ?? "").split(".");
  if (!signature || extra || account !== owner || Number(expires) <= Date.now() ||
      !/^[A-Za-z0-9_-]{8}$/.test(state) || !/^[a-f0-9]{64}$/.test(signature) ||
      !equal(state, params.get("state") ?? "") || !equal(signature, sign([state, account, workout, expires].join("."), secret))) {
    return null;
  }
  jar.set(stateCookie, "", { ...cookieOptions(publicOrigin(request)), maxAge: 0 });
  const code = params.get("code");
  return { workout, code: !params.has("error") && code && code.length <= 4096 ? code : null };
}

const tokenSchema = z.object({ access_token: z.string().min(1).max(8192) });
const collectionSchema = z.object({
  records: z.array(z.object({
    start: z.string(), end: z.string(),
    score: z.object({ average_heart_rate: z.number().nullish(), max_heart_rate: z.number().nullish() }).nullish(),
  })).max(25),
  next_token: z.string().max(4096).nullish(),
});

export async function readWhoopWorkout(request: Request, code: string, window: TimeWindow) {
  const { id, secret } = credentials();
  const token = await fetch(WHOOP + "/oauth/oauth2/token", {
    method: "POST", body: new URLSearchParams({
      code, grant_type: "authorization_code", client_id: id, client_secret: secret,
      redirect_uri: publicOrigin(request) + callbackPath,
    }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!token.ok) throw new Error("WHOOP authorization failed");
  const { access_token } = tokenSchema.parse(await token.json());
  const url = new URL("/developer/v2/activity/workout", WHOOP);
  url.search = new URLSearchParams({
    limit: "25", start: new Date(window.from - 900_000).toISOString(), end: new Date(window.to + 900_000).toISOString(),
  }).toString();
  const records = [];
  // The search covers one workout window; cap pagination for outsized accounts.
  for (let page = 0; page < 3; page++) {
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + access_token }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("WHOOP workout request failed");
    const collection = collectionSchema.parse(await response.json());
    records.push(...collection.records.map(({ start, end, score }) =>
      sourceSummary("whoop", Date.parse(start), Date.parse(end), score?.average_heart_rate, score?.max_heart_rate)));
    if (!collection.next_token) break;
    url.searchParams.set("nextToken", collection.next_token);
  }
  return matchingSummary(window, records);
}
