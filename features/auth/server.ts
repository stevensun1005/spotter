import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { z } from "zod";
import { database, transaction } from "@/server/db";
import { HttpError } from "@/server/http";
import { inviteFormat, joinPair } from "@/features/partner/server";
import type { Person } from "@/shared/state";

const derive = promisify(scrypt);
const cookieName = "spotter_session";
const sessionSeconds = 30 * 24 * 60 * 60;
const attemptWindow = 10 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
const password = z.string().min(12).max(128);

export const loginInput = z.object({ username, password });
export const registrationInput = loginInput.extend({
  name: z.string().trim().min(1).max(32),
  invite: z.string().trim().toLowerCase().regex(inviteFormat),
});

type Account = Person & { password_hash: string };
const invalidLogin = () => new HttpError(401, "用户名或密码不正确。");

async function hashPassword(value: string, salt = randomBytes(16).toString("hex")) {
  const key = await derive(value, salt, 64) as Buffer;
  return salt + ":" + key.toString("hex");
}

function reserveAttempt(scope: string, limit: number) {
  const db = database();
  const now = Date.now();
  transaction(db, () => {
    db.prepare("DELETE FROM auth_attempts WHERE attempted < ?").run(now - attemptWindow);
    const count = db.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ?").get(scope)?.count;
    if (Number(count) >= limit) throw new HttpError(429, "尝试次数过多，请稍后再试。");
    db.prepare("INSERT INTO auth_attempts (scope, attempted) VALUES (?, ?)").run(scope, now);
  });
}

export async function login(data: z.infer<typeof loginInput>) {
  reserveAttempt("login", 100);
  const scope = "login:" + data.username;
  reserveAttempt(scope, 8);
  const row = database().prepare("SELECT id, name, password_hash FROM accounts WHERE username = ?")
    .get(data.username) as Account | undefined;
  const salt = row?.password_hash.split(":")[0] ?? "00000000000000000000000000000000";
  const computed = await hashPassword(data.password, salt);
  const expected = row?.password_hash ?? salt + ":" + "0".repeat(128);
  const valid = timingSafeEqual(Buffer.from(digest(computed), "hex"), Buffer.from(digest(expected), "hex"));
  if (!row || !valid) throw invalidLogin();
  database().prepare("DELETE FROM auth_attempts WHERE scope = ?").run(scope);
  return row.id;
}

export async function register(data: z.infer<typeof registrationInput>) {
  reserveAttempt("register", 12);
  const passwordHash = await hashPassword(data.password);
  const db = database();
  return transaction(db, () => {
    const first = !db.prepare("SELECT 1 FROM accounts LIMIT 1").get();
    const setup = process.env.SPOTTER_SETUP_CODE?.trim().toLowerCase();
    if (first && (!setup || !inviteFormat.test(setup) ||
        !timingSafeEqual(Buffer.from(digest(setup), "hex"), Buffer.from(digest(data.invite), "hex")))) {
      throw new HttpError(403, "开通码无效。");
    }
    if (db.prepare("SELECT 1 FROM accounts WHERE username = ?").get(data.username)) {
      throw new HttpError(409, "这个用户名已被使用。");
    }
    const person = { id: randomUUID(), name: data.name };
    db.prepare("INSERT INTO accounts (id, username, name, password_hash) VALUES (?, ?, ?, ?)")
      .run(person.id, data.username, person.name, passwordHash);
    if (!first) joinPair(person, data.invite);
    return person.id;
  });
}

export async function currentAccount(): Promise<Person | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const account = database().prepare(
    "SELECT a.id, a.name FROM auth_sessions s JOIN accounts a ON a.id = s.account_id " +
    "WHERE s.token_hash = ? AND s.expires > ?"
  ).get(digest(token), Date.now()) as Person | undefined;
  return account ? { id: account.id, name: account.name } : null;
}

export async function requireAccount() {
  const user = await currentAccount();
  if (!user) throw new HttpError(401, "请登录后再操作。");
  return user;
}

export async function startAuthSession(id: string, secure: boolean) {
  const token = randomBytes(32).toString("hex");
  const db = database();
  const now = Date.now();
  const jar = await cookies();
  const previous = jar.get(cookieName)?.value;
  transaction(db, () => {
    db.prepare("DELETE FROM auth_sessions WHERE expires <= ?").run(now);
    if (previous) db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(digest(previous));
    db.prepare("INSERT INTO auth_sessions (token_hash, account_id, expires) VALUES (?, ?, ?)")
      .run(digest(token), id, now + sessionSeconds * 1000);
  });
  jar.set(cookieName, token, { path: "/", httpOnly: true, secure, sameSite: "lax", maxAge: sessionSeconds });
}

export async function endAuthSession(secure: boolean) {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) database().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(digest(token));
  jar.set(cookieName, "", { path: "/", httpOnly: true, secure, sameSite: "lax", maxAge: 0 });
}
