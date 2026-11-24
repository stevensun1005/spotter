import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { readSession, sessionCookieName } from "@/features/auth/server";

export async function getChatGPTUser() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  return env.DB && token ? readSession(env.DB, token) : null;
}
