import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readFriendsRequest, writeFriendsRequest } from "@/features/friends/http";
import { api, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

async function account() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请登录后查看好友。");
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return { db: env.DB, user: { id: user.userId, name: user.fullName?.trim().slice(0, 80) || "训练好友" } };
}

export const GET = api(async (request) => {
  const { db, user } = await account();
  return readFriendsRequest(request, db, user);
});

export const POST = api(async (request) => {
  const { db, user } = await account();
  return writeFriendsRequest(request, db, user);
});
