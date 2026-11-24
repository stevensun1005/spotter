import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { endSession, sessionCookie, sessionCookieName } from "@/features/auth/server";
import { json, publicOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== publicOrigin(request)) return json({ error: "请求来源无效。" }, 403);
  if (!env.DB) return json({ error: "暂时无法退出账号。" }, 503);
  try {
    await endSession(env.DB, (await cookies()).get(sessionCookieName)?.value);
    return new Response(null, { status: 303, headers: {
      "Location": "/", "Set-Cookie": sessionCookie(), "Cache-Control": "private, no-store",
    } });
  } catch {
    console.error("Spotter sign-out failed");
    return json({ error: "暂时无法退出账号。" }, 503);
  }
}
