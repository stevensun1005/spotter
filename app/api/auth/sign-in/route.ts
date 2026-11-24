import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { sessionCookie, sessionCookieName, signInInput, startSession } from "@/features/auth/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const input = await readJson(request, signInInput, 1_024);
  if (!env.DB) return json({ error: "登录暂时不可用。" }, 503);
  try {
    const previous = (await cookies()).get(sessionCookieName)?.value;
    const token = await startSession(env.DB, input, previous);
    if (!token) return json({ error: "邮箱或访问码不正确。" }, 401);
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch {
    console.error("Spotter sign-in failed");
    return json({ error: "登录暂时不可用。" }, 503);
  }
});
