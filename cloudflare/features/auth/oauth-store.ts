import { oauthDigest, randomOAuthToken, type OAuthProvider, type ProviderIdentity } from "./oauth-providers";

type Proof = {
  state_hash: string; provider: OAuthProvider; account_id: string | null; session_hash: string | null;
  native: 0 | 1 | 2; proof: string;
};
type OAuthFlow = Proof & { nonce: string; pkce: string | null };
export type OAuthIdentity = {
  provider: OAuthProvider; subject: string; email: string | null; display_name: string | null; apple_credential: string | null;
};
type OAuthGrant = Proof & OAuthIdentity;
type LinkSession = { owner: string; hash: string };
const appleAppFlow = 2;

const flowSeconds = 10 * 60;
const grantSeconds = 90;
const seconds = () => Math.floor(Date.now() / 1000);

export const proofCookieName = (stateHash: string) => "__Host-spotter_oauth_" + stateHash.slice(0, 24);
export const proofCookie = (stateHash: string, proof = "") =>
  `${proofCookieName(stateHash)}=${proof}; Max-Age=${proof ? flowSeconds + grantSeconds : 0}; Path=/; Secure; HttpOnly; SameSite=Lax`;

export async function beginOAuthFlow(db: D1Database, provider: OAuthProvider, session?: LinkSession, challenge?: string,
  surface?: "apple-app") {
  const state = randomOAuthToken();
  const stateHash = await oauthDigest(state);
  const nonce = randomOAuthToken();
  const pkce = provider === "google" ? randomOAuthToken() : undefined;
  const browserProof = challenge ? undefined : randomOAuthToken();
  const proof = challenge ?? await oauthDigest(browserProof!);
  const flowKind = surface === "apple-app" ? appleAppFlow : challenge ? 1 : 0;
  const now = seconds();
  await db.batch([
    db.prepare("DELETE FROM spotter_oauth_flows WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM spotter_oauth_grants WHERE expires_at <= ?").bind(now),
    db.prepare("INSERT INTO spotter_oauth_flows (state_hash,provider,account_id,session_hash,native,proof,nonce,pkce,expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(stateHash, provider, session?.owner ?? null, session?.hash ?? null, flowKind, proof, nonce, pkce ?? null, now + flowSeconds),
  ]);
  return { state, stateHash, nonce, pkce, browserProof };
}

export async function consumeOAuthFlow(db: D1Database, provider: OAuthProvider, state: string) {
  return db.prepare(
    "DELETE FROM spotter_oauth_flows WHERE state_hash=? AND provider=? AND native IN (0,1) AND expires_at>? " +
      "RETURNING state_hash,provider,account_id,session_hash,native,proof,nonce,pkce",
  ).bind(await oauthDigest(state), provider, seconds()).first<OAuthFlow>();
}

export async function consumeAppleAppFlow(db: D1Database, state: string, verifier: string, session?: LinkSession) {
  const [stateHash, proof] = await Promise.all([oauthDigest(state), oauthDigest(verifier)]);
  const now = seconds();
  return db.prepare(
    "DELETE FROM spotter_oauth_flows WHERE state_hash=? AND provider='apple' AND native=? AND proof=? AND expires_at>? " +
      "AND account_id IS ? AND session_hash IS ? AND (account_id IS NULL OR EXISTS (SELECT 1 FROM spotter_access_sessions " +
      "WHERE account_id=spotter_oauth_flows.account_id AND token_hash=spotter_oauth_flows.session_hash AND expires_at>?)) " +
      "RETURNING nonce,account_id",
  ).bind(stateHash, appleAppFlow, proof, now, session?.owner ?? null, session?.hash ?? null, now)
    .first<Pick<OAuthFlow, "nonce" | "account_id">>();
}

export async function storeOAuthGrant(db: D1Database, flow: OAuthFlow, identity: ProviderIdentity) {
  const code = randomOAuthToken();
  await db.prepare("INSERT INTO spotter_oauth_grants " +
    "(code_hash,state_hash,provider,account_id,session_hash,native,proof,subject,email,display_name,apple_credential,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(await oauthDigest(code), flow.state_hash, flow.provider, flow.account_id, flow.session_hash, flow.native, flow.proof,
      identity.subject, flow.account_id ? null : identity.email ?? null, flow.account_id ? null : identity.displayName ?? null,
      flow.provider === "apple" ? identity.appleCredential ?? null : null, seconds() + grantSeconds).run();
  return code;
}

export async function inspectOAuthGrant(db: D1Database, code: string, native: boolean) {
  const codeHash = await oauthDigest(code);
  const grant = await db.prepare(
    "SELECT state_hash, account_id, session_hash FROM spotter_oauth_grants WHERE code_hash=? AND native=? AND expires_at>?",
  ).bind(codeHash, native ? 1 : 0, seconds()).first<Pick<Proof, "state_hash" | "account_id" | "session_hash">>();
  return grant && { ...grant, codeHash };
}

export async function consumeOAuthGrant(db: D1Database, codeHash: string, verifier: string, native: boolean) {
  return db.prepare(
    "DELETE FROM spotter_oauth_grants WHERE code_hash=? AND proof=? AND native=? AND expires_at>? " +
      "RETURNING state_hash,provider,account_id,session_hash,native,proof,subject,email,display_name,apple_credential",
  ).bind(codeHash, await oauthDigest(verifier), native ? 1 : 0, seconds()).first<OAuthGrant>();
}

export async function linkedProviders(db: D1Database, accountId: string) {
  const { results } = await db.prepare("SELECT provider FROM spotter_oauth_identities WHERE account_id = ?").bind(accountId).all<{ provider: OAuthProvider }>();
  return new Set(results.map(({ provider }) => provider));
}

async function identityOwner(db: D1Database, provider: OAuthProvider, subject: string) {
  const row = await db.prepare("SELECT account_id FROM spotter_oauth_identities WHERE provider=? AND subject=?")
    .bind(provider, subject).first<{ account_id: string }>();
  return row?.account_id;
}

export async function linkOAuthAccount(db: D1Database, grant: OAuthIdentity, owner: string, sessionHash: string,
  surface?: "apple-app") {
  const credential = surface === "apple-app" ? "apple_app_credential" : "apple_credential";
  const ownsSession = "account_id=? AND token_hash=? AND expires_at>?";
  const result = await db.prepare(
    `INSERT INTO spotter_oauth_identities (provider,subject,account_id,${credential}) ` +
      `SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM spotter_access_sessions WHERE ${ownsSession}) ` +
      "ON CONFLICT DO NOTHING",
  ).bind(grant.provider, grant.subject, owner, grant.apple_credential, owner, sessionHash, seconds()).run();
  if (result.meta.changes) return "linked";
  if (!await db.prepare(`SELECT 1 FROM spotter_access_sessions WHERE ${ownsSession}`).bind(owner, sessionHash, seconds()).first()) {
    return "link-expired";
  }
  const existing = await identityOwner(db, grant.provider, grant.subject);
  if (existing === owner) return "linked";
  if (existing) return "link-conflict";
  return (await linkedProviders(db, owner)).has(grant.provider) ? "link-already-bound" : "link-expired";
}

export async function loginOAuthAccount(db: D1Database, grant: OAuthIdentity, surface?: "apple-app") {
  const credential = surface === "apple-app" ? "apple_app_credential" : "apple_credential";
  const linked = await identityOwner(db, grant.provider, grant.subject);
  if (linked) {
    if (grant.provider === "apple" && grant.apple_credential) {
      await db.prepare(`UPDATE spotter_oauth_identities SET ${credential}=? WHERE provider='apple' AND subject=? AND account_id=? ` +
        `AND (${credential} IS NULL OR ${credential} NOT LIKE 'v1.r.%' OR ? LIKE 'v1.r.%')`)
        .bind(grant.apple_credential, grant.subject, linked, grant.apple_credential).run();
    }
    return { accountId: linked };
  }
  if (!grant.email) return { error: "oauth-error" } as const;
  const accountId = crypto.randomUUID();
  // Provider-only users have a random, unusable access-code hash.
  const unusedHash = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db.batch([
    db.prepare(
      "INSERT INTO spotter_access_accounts (id,email,display_name,access_hash) " +
        "SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM spotter_oauth_identities WHERE provider=? AND subject=?) " +
        "ON CONFLICT(email) DO NOTHING",
    ).bind(accountId, grant.email, grant.display_name ?? "Spotter 用户", unusedHash, grant.provider, grant.subject),
    db.prepare(
      `INSERT INTO spotter_oauth_identities (provider,subject,account_id,${credential}) SELECT ?,?,?,? WHERE EXISTS ` +
        "(SELECT 1 FROM spotter_access_accounts WHERE id=?)",
    ).bind(grant.provider, grant.subject, accountId, grant.apple_credential, accountId),
  ]);
  const account = await identityOwner(db, grant.provider, grant.subject);
  // The email may already belong to an account. The user must sign into it and link explicitly.
  return account ? { accountId: account } : { error: "use-access-code" } as const;
}
