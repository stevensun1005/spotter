import { env } from "cloudflare:workers";
import { z } from "zod";
import { HttpError, json, publicOrigin, readJson } from "@/server/http";
import { readCookie, readSession, sessionCookie, sessionCookieName, sessionTokenHash, startAccountSession } from "./server";
import { authorizationUrl, exchangeAuthorizationCode, nativeAppleProviderConfig, oauthProviders, opaqueToken, providerConfig,
  type OAuthProvider } from "./oauth-providers";
import { beginOAuthFlow, consumeAppleAppFlow, consumeOAuthFlow, consumeOAuthGrant, inspectOAuthGrant, linkedProviders, linkOAuthAccount,
  loginOAuthAccount, proofCookie, proofCookieName, storeOAuthGrant, type OAuthIdentity } from "./oauth-store";

const challenge = z.string().regex(opaqueToken).optional();
const expectedOwner = z.string().trim().min(1).max(250);
const startInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), provider: z.enum(oauthProviders), challenge }).strict(),
  z.object({ mode: z.literal("link"), provider: z.enum(oauthProviders), challenge, expectedOwner }).strict(),
]);
const completeInput = z.object({ code: z.string().regex(opaqueToken), verifier: z.string().regex(opaqueToken) }).strict();
const appleAppStartInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), challenge: challenge.unwrap() }).strict(),
  z.object({ mode: z.literal("link"), challenge: challenge.unwrap(), expectedOwner }).strict(),
]);
const appleAppCompleteInput = z.object({
  state: z.string().regex(opaqueToken),
  code: z.string().regex(/^[\x21-\x7e]{1,4096}$/),
  verifier: z.string().regex(opaqueToken),
}).strict();
type Failure = "oauth-cancelled" | "oauth-expired" | "oauth-error" | "use-access-code" |
  "link-cancelled" | "link-expired" | "link-error" | "link-conflict" | "link-already-bound";
type Outcome = { status: "linked" | "signed-in"; token?: string; stateHash?: string } |
  { status: Failure; stateHash?: string };
const errorMessages: Record<Failure, string> = {
  "oauth-cancelled": "已取消登录。",
  "oauth-expired": "登录已过期，请重新操作。",
  "oauth-error": "登录未完成，请重试。",
  "use-access-code": "这个邮箱已有训练搭子账号。请先用已有方式登录，再在设置中绑定。",
  "link-cancelled": "已取消绑定。",
  "link-expired": "当前登录已变更或绑定已过期，请重新操作。",
  "link-error": "绑定未完成，请重试。",
  "link-conflict": "这个第三方账号已绑定到另一个训练搭子账号。",
  "link-already-bound": "当前账号已绑定此登录方式。",
};

function protectedApi(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Spotter OAuth request failed");
      return json({ error: "账号服务暂时不可用，请稍后重试。" }, 503);
    }
  };
}

function siteRedirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ "Location": location, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function webResult(outcome: Outcome) {
  const inAccount = outcome.status === "signed-in" || outcome.status === "linked" || outcome.status.startsWith("link-");
  const cookies: string[] = [];
  if ("token" in outcome && outcome.token) cookies.push(sessionCookie(outcome.token));
  if (outcome.stateHash) cookies.push(proofCookie(outcome.stateHash));
  return siteRedirect(`${inAccount ? "/" : "/sign-in"}?auth=${outcome.status}`, cookies);
}

function nativeResult(parameter: "code" | "error", value: string) {
  return siteRedirect("spotter-auth://oauth/complete?" + new URLSearchParams({ [parameter]: value }).toString());
}

export const oauthStatus = protectedApi(async (request) => {
  const origin = publicOrigin(request);
  const db = env.DB;
  const token = readCookie(request, sessionCookieName);
  const account = db && token ? await readSession(db, token) : null;
  const linked = db && account ? await linkedProviders(db, account.userId) : new Set<OAuthProvider>();
  const options = (provider: OAuthProvider) => ({ enabled: Boolean(db && providerConfig(env, origin, provider)), linked: linked.has(provider) });
  return json({ signedIn: Boolean(account), nativeAppleEnabled: Boolean(db && nativeAppleProviderConfig(env, origin)),
    providers: { apple: options("apple"), google: options("google") } });
});

async function oauthSession(db: D1Database, request: Request) {
  const token = readCookie(request, sessionCookieName);
  const account = token ? await readSession(db, token) : null;
  const hash = account && await sessionTokenHash(token);
  return { token, session: account && hash ? { owner: account.userId, hash } : undefined };
}

async function startSessionFor(db: D1Database, request: Request, provider: OAuthProvider,
  input: { mode: "login" } | { mode: "link"; expectedOwner: string }) {
  const { session } = await oauthSession(db, request);
  if (input.mode === "link" && (!session || input.expectedOwner !== session.owner)) {
    throw new HttpError(403, "当前登录已变更，请刷新设置后再绑定。");
  }
  if (input.mode === "link" && session && (await linkedProviders(db, session.owner)).has(provider)) {
    throw new HttpError(409, errorMessages["link-already-bound"]);
  }
  if (input.mode === "login" && session) throw new HttpError(409, "请先退出当前账号。");
  return session;
}

export const oauthStart = protectedApi(async (request) => {
  const input = await readJson(request, startInput, 2048);
  const db = env.DB;
  const provider = providerConfig(env, publicOrigin(request), input.provider);
  if (!db || !provider) throw new HttpError(503, "当前登录方式暂未配置。");
  const session = await startSessionFor(db, request, input.provider, input);
  const flow = await beginOAuthFlow(db, input.provider, session, input.challenge);
  const url = await authorizationUrl(provider, flow.state, flow.nonce, flow.pkce);
  const response = json({ authorizationUrl: url });
  response.headers.set("Referrer-Policy", "no-referrer");
  if (flow.browserProof) response.headers.set("Set-Cookie", proofCookie(flow.stateHash, flow.browserProof));
  return response;
});

export const oauthAppleAppStart = protectedApi(async (request) => {
  const input = await readJson(request, appleAppStartInput, 2048);
  const db = env.DB;
  if (!db || !nativeAppleProviderConfig(env, publicOrigin(request))) throw new HttpError(503, "iPhone 的 Apple 登录尚未配置。");
  const session = await startSessionFor(db, request, "apple", input);
  const { state, nonce } = await beginOAuthFlow(db, "apple", session, input.challenge, "apple-app");
  return json({ state, nonce });
});

async function callbackParams(request: Request, provider: OAuthProvider) {
  if (provider === "google") return new URL(request.url).searchParams;
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded" ||
      Number(request.headers.get("content-length")) > 16_384) throw new HttpError(400, "OAuth 回调格式无效。");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let form = "";
  let size = 0;
  if (reader) {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16_384) throw new HttpError(413, "OAuth 回调超过长度限制。");
      form += decoder.decode(chunk.value, { stream: true });
    }
    form += decoder.decode();
  }
  return new URLSearchParams(form);
}

export function oauthCallback(provider: OAuthProvider) {
  return async (request: Request) => {
    const db = env.DB;
    const config = providerConfig(env, publicOrigin(request), provider);
    if (!db || !config) return webResult({ status: "oauth-error" });
    let flow: Awaited<ReturnType<typeof consumeOAuthFlow>> = null;
    try {
      const params = await callbackParams(request, provider);
      const state = params.get("state");
      if (!state || !opaqueToken.test(state) || params.getAll("state").length !== 1) return webResult({ status: "oauth-expired" });
      flow = await consumeOAuthFlow(db, provider, state);
      if (!flow) return webResult({ status: "oauth-expired" });
      const failure = (status: Failure) => flow?.native ? nativeResult("error", status) : webResult({ status, stateHash: flow?.state_hash });
      const providerError = params.get("error");
      if (providerError === "access_denied" || providerError === "user_cancelled_authorize" || providerError === "user_cancelled") {
        return failure(flow.account_id ? "link-cancelled" : "oauth-cancelled");
      }
      const code = params.get("code");
      if (providerError || !code || code.length > 4096 || params.getAll("code").length !== 1) return failure(flow.account_id ? "link-error" : "oauth-error");
      const identity = await exchangeAuthorizationCode(config, code, flow.nonce, flow.pkce ?? undefined, env.SPOTTER_APPLE_TOKEN_KEY);
      const completionCode = await storeOAuthGrant(db, flow, identity);
      return flow.native ? nativeResult("code", completionCode)
        : siteRedirect("/api/auth/oauth/web/complete?" + new URLSearchParams({ code: completionCode }).toString());
    } catch {
      // Never log provider responses, temporary codes or private token material.
      console.error("Spotter OAuth callback failed");
      const status = flow?.account_id ? "link-error" : "oauth-error";
      return flow?.native ? nativeResult("error", status) : webResult({ status, stateHash: flow?.state_hash });
    }
  };
}

async function complete(request: Request, code: string, nativeVerifier?: string): Promise<Outcome> {
  const db = env.DB;
  const origin = publicOrigin(request);
  if (!db || !origin.startsWith("https://") || env.SPOTTER_OAUTH_ORIGIN?.trim() !== origin) return { status: "oauth-error" };
  const native = nativeVerifier !== undefined;
  const pending = await inspectOAuthGrant(db, code, native);
  if (!pending) return { status: "oauth-expired" };
  const stateHash = native ? undefined : pending.state_hash;
  const expired = pending.account_id ? "link-expired" : "oauth-expired";
  const verifier = nativeVerifier ?? readCookie(request, proofCookieName(pending.state_hash));
  if (!verifier || !opaqueToken.test(verifier)) return { status: expired, stateHash };
  const { token, session } = await oauthSession(db, request);
  if (pending.account_id ? session?.owner !== pending.account_id || session.hash !== pending.session_hash : Boolean(session)) {
    return { status: expired, stateHash };
  }
  const grant = await consumeOAuthGrant(db, pending.codeHash, verifier, native);
  if (!grant) return { status: expired, stateHash };
  return { ...await completeAccount(db, grant, token, session), stateHash };
}

async function completeAccount(db: D1Database, identity: OAuthIdentity, token?: string,
  session?: { owner: string; hash: string }, surface?: "apple-app"): Promise<Outcome> {
  if (session) return { status: await linkOAuthAccount(db, identity, session.owner, session.hash, surface) };
  const login = await loginOAuthAccount(db, identity, surface);
  if (login.error) return { status: login.error };
  return { status: "signed-in", token: await startAccountSession(db, login.accountId, token) };
}

export async function oauthWebComplete(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code || !opaqueToken.test(code)) return webResult({ status: "oauth-expired" });
  try { return webResult(await complete(request, code)); }
  catch {
    console.error("Spotter OAuth web completion failed");
    return webResult({ status: "oauth-error" });
  }
}

function appCompletionResult(result: Outcome) {
  if (result.status !== "signed-in" && result.status !== "linked") {
    return json({ error: errorMessages[result.status], code: result.status }, result.status === "link-conflict" ? 409 : 400);
  }
  const response = json({ status: result.status });
  if (result.token) response.headers.set("Set-Cookie", sessionCookie(result.token));
  return response;
}

export const oauthNativeComplete = protectedApi(async (request) => {
  const { code, verifier } = await readJson(request, completeInput, 1024);
  return appCompletionResult(await complete(request, code, verifier));
});

export const oauthAppleAppComplete = protectedApi(async (request) => {
  const { state, code, verifier } = await readJson(request, appleAppCompleteInput, 8192);
  const db = env.DB;
  const config = nativeAppleProviderConfig(env, publicOrigin(request));
  if (!db || !config) throw new HttpError(503, "iPhone 的 Apple 登录尚未配置。");
  const { token, session } = await oauthSession(db, request);
  const flow = await consumeAppleAppFlow(db, state, verifier, session);
  if (!flow) return appCompletionResult({ status: session ? "link-expired" : "oauth-expired" });
  try {
    const identity = await exchangeAuthorizationCode(config, code, flow.nonce, undefined, env.SPOTTER_APPLE_TOKEN_KEY);
    return appCompletionResult(await completeAccount(db, { provider: "apple", subject: identity.subject,
      email: identity.email ?? null, display_name: identity.displayName ?? null, apple_credential: identity.appleCredential ?? null },
    token, session, "apple-app"));
  } catch {
    console.error("Spotter native Apple sign-in failed");
    return appCompletionResult({ status: flow.account_id ? "link-error" : "oauth-error" });
  }
});
