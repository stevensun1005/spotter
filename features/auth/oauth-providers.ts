import { z } from "zod";

export const oauthProviders = ["apple", "google"] as const;
export type OAuthProvider = typeof oauthProviders[number];
type OAuthSettings = Pick<Cloudflare.Env, "SPOTTER_OAUTH_ORIGIN" | "GOOGLE_OAUTH_CLIENT_ID" | "GOOGLE_OAUTH_CLIENT_SECRET" |
  "APPLE_OAUTH_CLIENT_ID" | "APPLE_OAUTH_TEAM_ID" | "APPLE_OAUTH_KEY_ID" | "APPLE_OAUTH_PRIVATE_KEY">;

type CommonConfig = { clientId: string; origin: string };
export type OAuthConfig = CommonConfig & (
  { provider: "google"; clientSecret: string } |
  { provider: "apple"; teamId: string; keyId: string; privateKey: string }
);
export type ProviderIdentity = { subject: string; email?: string; displayName?: string; appleCredential?: string };

const googleIssuer = "https://accounts.google.com";
const appleIssuer = "https://appleid.apple.com";
const encoder = new TextEncoder();
export const opaqueToken = /^[A-Za-z0-9_-]{43}$/;

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error("Invalid OAuth token encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

export function randomOAuthToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function oauthDigest(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

const clientIdPattern = /^[A-Za-z0-9._-]{1,255}$/;

export function providerConfig(env: OAuthSettings, origin: string, provider: OAuthProvider): OAuthConfig | undefined {
  if (!origin.startsWith("https://") || env.SPOTTER_OAUTH_ORIGIN?.trim() !== origin) return;
  if (provider === "google") {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (clientId && clientIdPattern.test(clientId) && clientSecret) return { provider, origin, clientId, clientSecret };
  } else {
    const clientId = env.APPLE_OAUTH_CLIENT_ID?.trim();
    const teamId = env.APPLE_OAUTH_TEAM_ID?.trim();
    const keyId = env.APPLE_OAUTH_KEY_ID?.trim();
    const privateKey = env.APPLE_OAUTH_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
    if (clientId && clientIdPattern.test(clientId) && /^[A-Z0-9]{10}$/.test(teamId ?? "") && teamId &&
        /^[A-Z0-9]{10}$/.test(keyId ?? "") && keyId && privateKey?.startsWith("-----BEGIN PRIVATE KEY-----") &&
        privateKey.endsWith("-----END PRIVATE KEY-----")) return { provider, origin, clientId, teamId, keyId, privateKey };
  }
}

function callbackUrl(config: OAuthConfig) {
  return `${config.origin}/api/auth/oauth/${config.provider}/callback`;
}

export async function authorizationUrl(config: OAuthConfig, state: string, nonce: string, pkce?: string) {
  const url = new URL(config.provider === "google" ? `${googleIssuer}/o/oauth2/v2/auth` : `${appleIssuer}/auth/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: callbackUrl(config), response_type: "code", state, nonce,
    scope: config.provider === "google" ? "openid email profile" : "email",
  }).toString();
  if (config.provider === "google") {
    if (!pkce) throw new Error("Missing Google PKCE verifier");
    url.searchParams.set("code_challenge", await oauthDigest(pkce));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
  } else {
    url.searchParams.set("response_mode", "form_post");
  }
  return url.href;
}

const seconds = () => Math.floor(Date.now() / 1000);
const encodedJson = (value: object) => base64Url(encoder.encode(JSON.stringify(value)));

async function appleClientSecret(config: Extract<OAuthConfig, { provider: "apple" }>) {
  const body = config.privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const pkcs8 = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = seconds();
  const parts = [
    encodedJson({ alg: "ES256", kid: config.keyId }),
    encodedJson({ iss: config.teamId, iat: now, exp: now + 300, aud: appleIssuer, sub: config.clientId }),
  ].join(".");
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(parts));
  return parts + "." + base64Url(new Uint8Array(signature));
}

type AppleCredentialType = "refresh_token" | "access_token";
const appleCredentialData = (clientId: string, subject: string, type: AppleCredentialType) =>
  encoder.encode(JSON.stringify(["spotter-apple-credential/v1", clientId, subject, type]));

async function appleCredentialKey(secret: string) {
  const bytes = decodeBase64Url(secret.trim());
  if (bytes.byteLength !== 32) throw new Error("Invalid Apple credential key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function protectAppleCredential(secret: string, clientId: string, subject: string,
  type: AppleCredentialType, token: string) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({
      name: "AES-GCM", iv, additionalData: appleCredentialData(clientId, subject, type),
    }, await appleCredentialKey(secret), encoder.encode(token));
    const prefix = type === "refresh_token" ? "r" : "a";
    return `v1.${prefix}.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
  } catch {
    // A missing or unusable storage key must not prevent sign-in or linking.
    return undefined;
  }
}

export async function revokeAppleAuthorization(config: OAuthConfig | undefined, secret: string | undefined,
  subject: string, credential: string | null) {
  if (config?.provider !== "apple" || !secret || !credential) return false;
  try {
    const [version, hint, encodedIv, encrypted, extra] = credential.split(".");
    if (version !== "v1" || (hint !== "r" && hint !== "a") || !encodedIv || !encrypted || extra !== undefined) return false;
    const type: AppleCredentialType = hint === "r" ? "refresh_token" : "access_token";
    const iv = decodeBase64Url(encodedIv);
    if (iv.byteLength !== 12) return false;
    const payload = await crypto.subtle.decrypt({
      name: "AES-GCM", iv, additionalData: appleCredentialData(config.clientId, subject, type),
    }, await appleCredentialKey(secret), decodeBase64Url(encrypted));
    const body = new URLSearchParams({ client_id: config.clientId, client_secret: await appleClientSecret(config),
      token: new TextDecoder().decode(payload), token_type_hint: type });
    const response = await fetch(`${appleIssuer}/auth/revoke`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
      redirect: "manual", signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    // The user can revoke in Apple Settings if Apple cannot be reached or the token cannot be read.
    return false;
  }
}

const jwtHeader = z.object({ alg: z.literal("RS256"), kid: z.string().min(1).max(100) });
const jwtClaims = z.object({
  iss: z.string(), aud: z.union([z.string(), z.tuple([z.string()])]), azp: z.string().optional(),
  sub: z.string().regex(/^[\x21-\x7e]{1,255}$/),
  exp: z.number().int().safe(), iat: z.number().int().safe(), nonce: z.string(),
  email: z.string().trim().max(254).optional(), email_verified: z.union([z.boolean(), z.string()]).optional(),
  name: z.string().max(300).optional(),
});
const publicKeys = z.object({ keys: z.array(z.object({
  kid: z.string(), kty: z.string(), n: z.string().optional(), e: z.string().optional(),
  alg: z.string().optional(), use: z.string().optional(),
})).max(32) });

async function providerJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("OAuth provider request failed");
  return response.json() as Promise<unknown>;
}

async function verifyProviderToken(config: OAuthConfig, token: string, nonce: string): Promise<ProviderIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid OAuth token");
  const [head, payload, signed] = parts;
  const parse = (part: string): unknown => JSON.parse(new TextDecoder().decode(decodeBase64Url(part)));
  const header = jwtHeader.parse(parse(head));
  const keysUrl = config.provider === "apple" ? `${appleIssuer}/auth/keys` : "https://www.googleapis.com/oauth2/v3/certs";
  const { keys } = publicKeys.parse(await providerJson(keysUrl));
  const publicKey = keys.find(({ kid, kty, alg, use }) => kid === header.kid && kty === "RSA" &&
    (alg === undefined || alg === "RS256") && (use === undefined || use === "sig"));
  if (!publicKey?.n || !publicKey.e) throw new Error("OAuth signing key unavailable");
  const algorithm = "RSASSA-PKCS1-v1_5";
  const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: publicKey.n, e: publicKey.e, alg: "RS256" },
    { name: algorithm, hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify(algorithm, key, decodeBase64Url(signed), encoder.encode(head + "." + payload))) {
    throw new Error("OAuth token signature mismatch");
  }
  const claims = jwtClaims.parse(parse(payload));
  const now = seconds();
  const issuerMatches = config.provider === "apple" ? claims.iss === appleIssuer
    : claims.iss === googleIssuer || claims.iss === "accounts.google.com";
  const audience = typeof claims.aud === "string" ? claims.aud : claims.aud[0];
  if (!issuerMatches || audience !== config.clientId || (claims.azp !== undefined && claims.azp !== config.clientId) ||
      claims.exp <= now || claims.iat > now + 60 || claims.nonce !== nonce) {
    throw new Error("OAuth token claim mismatch");
  }
  const verifiedEmail = claims.email_verified === true || claims.email_verified === "true";
  const email = verifiedEmail ? z.string().email().safeParse(claims.email?.toLowerCase()) : undefined;
  const displayName = claims.name?.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 80);
  return { subject: claims.sub, email: email?.success ? email.data : undefined, displayName: displayName || undefined };
}

const providerToken = z.string().min(1).max(8192).optional().catch(undefined);
const tokenReply = z.object({ id_token: z.string().min(10).max(16_000),
  refresh_token: providerToken, access_token: providerToken });

export async function exchangeAuthorizationCode(config: OAuthConfig, code: string, nonce: string, pkce?: string,
  appleTokenKey?: string): Promise<ProviderIdentity> {
  const secret = config.provider === "apple" ? await appleClientSecret(config) : config.clientSecret;
  const params = new URLSearchParams({
    grant_type: "authorization_code", code, client_id: config.clientId, client_secret: secret, redirect_uri: callbackUrl(config),
  });
  if (config.provider === "google") {
    if (!pkce) throw new Error("Missing Google PKCE verifier");
    params.set("code_verifier", pkce);
  }
  const endpoint = config.provider === "apple" ? `${appleIssuer}/auth/token` : "https://oauth2.googleapis.com/token";
  const { id_token, refresh_token, access_token } = tokenReply.parse(await providerJson(endpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: params,
  }));
  const identity = await verifyProviderToken(config, id_token, nonce);
  const token = refresh_token ?? access_token;
  if (config.provider === "apple" && appleTokenKey && token) {
    identity.appleCredential = await protectAppleCredential(appleTokenKey, config.clientId, identity.subject,
      refresh_token ? "refresh_token" : "access_token", token);
  }
  return identity;
}
