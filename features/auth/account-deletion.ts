import { env } from "cloudflare:workers";
import { z } from "zod";
import { HttpError, json, publicOrigin, readJson } from "@/server/http";
import { providerConfig, revokeAppleAuthorization } from "./oauth-providers";
import { readCookie, readSession, sessionCookie, sessionCookieName, sessionTokenHash } from "./server";

const input = z.object({ expectedOwner: z.string().min(1).max(250), confirm: z.literal(true) }).strict();
const authorized = "EXISTS (SELECT 1 FROM spotter_access_sessions WHERE account_id=? AND token_hash=? AND expires_at>?)";
const coachingLinks = "SELECT id FROM coaching_links WHERE coach_id=? OR student_id=?";

type AppleIdentity = { subject: string; apple_credential: string | null };

async function deleteAccount(db: D1Database, owner: string, sessionHash: string) {
  const session = [owner, sessionHash, Math.floor(Date.now() / 1000)];
  const scoped = (sql: string, ...args: string[]) => db.prepare(sql + " AND " + authorized).bind(...args, ...session);
  const owned = ["personal_library", "agent_connections", "agent_plan_drafts", "training_programs", "program_rules",
    "friend_profiles", "friend_invites", "ai_coach_quota", "ai_coach_budget"];
  const writes = [
    scoped("SELECT subject, apple_credential FROM spotter_oauth_identities WHERE account_id=? AND provider='apple'", owner),
    ...owned.map((table) => scoped(`DELETE FROM ${table} WHERE owner=?`, owner)),
    scoped("DELETE FROM entries WHERE (owner=? OR CASE WHEN kind='cheer' AND json_valid(payload) " +
      "THEN json_extract(payload,'$.recipient') END=?)", owner, owner),
    scoped("DELETE FROM friend_links WHERE (first_id=? OR second_id=?)", owner, owner),
    scoped("DELETE FROM friend_requests WHERE (first_id=? OR second_id=?)", owner, owner),
    scoped("DELETE FROM members WHERE (user=? OR room IN (SELECT id FROM rooms WHERE owner=?))", owner, owner),
    scoped("DELETE FROM rooms WHERE owner=?", owner),
    scoped("DELETE FROM coaching_invites WHERE (coach_id=? OR claimed_by=?)", owner, owner),
    scoped(`DELETE FROM coaching_lessons WHERE link_id IN (${coachingLinks})`, owner, owner),
    scoped(`DELETE FROM coaching_assignments WHERE (coach_id=? OR student_id=? OR link_id IN (${coachingLinks}))`,
      owner, owner, owner, owner),
    scoped("DELETE FROM coaching_links WHERE (coach_id=? OR student_id=?)", owner, owner),
    scoped("DELETE FROM spotter_oauth_grants WHERE EXISTS (SELECT 1 FROM spotter_oauth_identities AS identity " +
      "WHERE identity.account_id=? AND identity.provider=spotter_oauth_grants.provider AND identity.subject=spotter_oauth_grants.subject)", owner),
    // Foreign keys also delete every app/web session, linked identity and account-bound pending OAuth flow or grant.
    scoped("DELETE FROM spotter_access_accounts WHERE id=?", owner),
  ];
  const [apple, ...results] = await db.batch<AppleIdentity>(writes);
  if (!results.at(-1)?.meta.changes) throw new HttpError(401, "登录已失效，请重新登录后再删除账号。");
  return apple.results[0];
}

export async function deleteSpotterAccount(request: Request) {
  try {
    const { expectedOwner } = await readJson(request, input, 1024);
    const db = env.DB;
    if (!db) throw new HttpError(503, "账号服务暂时不可用，请稍后重试。");
    const token = readCookie(request, sessionCookieName);
    const sessionHash = await sessionTokenHash(token);
    const account = token && sessionHash ? await readSession(db, token) : null;
    if (!account || !sessionHash) throw new HttpError(401, "请先登录后再删除账号。");
    if (account.userId !== expectedOwner) throw new HttpError(403, "当前登录账号已切换，请重新打开设置。");

    const apple = await deleteAccount(db, account.userId, sessionHash);
    const appleRevocation = !apple ? "not-required" :
      await revokeAppleAuthorization(providerConfig(env, publicOrigin(request), "apple"), env.SPOTTER_APPLE_TOKEN_KEY,
        apple.subject, apple.apple_credential) ? "revoked" : "manual";
    const response = json({ deleted: true, appleRevocation });
    response.headers.set("Set-Cookie", sessionCookie());
    return response;
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("Spotter account deletion request failed");
    return json({ error: "暂时无法删除账号，请稍后重试。" }, 503);
  }
}
