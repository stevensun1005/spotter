import { z } from "zod";

export const sessionCookieName = "__Host-spotter_session";
const sessionSeconds = 7 * 24 * 60 * 60;
const hex256 = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
export const signInInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  accessCode: z.string().trim().regex(/^[A-Za-z0-9_-]{32,128}$/),
});

type Account = { id: string; email: string; display_name: string };

const nowSeconds = () => Math.floor(Date.now() / 1000);
const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const hash = async (value: string) => toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));

export async function sessionTokenHash(token?: string) {
  return token && hex256.test(token) ? hash(token) : undefined;
}

export async function readSession(db: D1Database, token: string) {
  if (!hex256.test(token)) return null;
  const account = await db.prepare(
    "SELECT a.id, a.email, a.display_name FROM spotter_access_sessions s JOIN spotter_access_accounts a " +
    "ON s.account_id = a.id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(await hash(token), nowSeconds()).first<Account>();
  return account && {
    userId: account.id,
    email: account.email,
    displayName: account.display_name,
    fullName: account.display_name,
  };
}

export async function startSession(db: D1Database, data: z.infer<typeof signInInput>, previous?: string) {
  const account = await db.prepare("SELECT id FROM spotter_access_accounts WHERE email = ? AND access_hash = ?")
    .bind(data.email, await hash(data.accessCode)).first<{ id: string }>();
  if (!account) return null;
  return startAccountSession(db, account.id, previous);
}

export async function startAccountSession(db: D1Database, accountId: string, previous?: string) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = nowSeconds();
  const writes = [db.prepare("DELETE FROM spotter_access_sessions WHERE expires_at <= ?").bind(now)];
  const oldHash = await sessionTokenHash(previous);
  if (oldHash) writes.push(db.prepare("DELETE FROM spotter_access_sessions WHERE token_hash = ?").bind(oldHash));
  writes.push(db.prepare("INSERT INTO spotter_access_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await hash(token), accountId, now + sessionSeconds));
  await db.batch(writes);
  return token;
}

export async function endSession(db: D1Database, token?: string) {
  if (token && hex256.test(token)) {
    await db.prepare("DELETE FROM spotter_access_sessions WHERE token_hash = ?").bind(await hash(token)).run();
  }
}

export function sessionCookie(token = "") {
  return `${sessionCookieName}=${token}; Max-Age=${token ? sessionSeconds : 0}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
