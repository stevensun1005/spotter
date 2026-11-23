import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { friendDateQuery, friendMutation } from "@/features/friends/model";
import { changeFriends, friendDay, listFriends } from "@/features/friends/server";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

async function account() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请登录后查看好友。");
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return { db: env.DB, user: { id: user.userId, name: user.fullName?.trim().slice(0, 80) || "训练好友" } };
}

export const GET = api(async (request) => {
  const { db, user } = await account();
  const query = new URL(request.url).searchParams;
  if (!query.has("friend") && !query.has("date")) return json(await listFriends(db, user.id));
  const match = friendDateQuery.safeParse({ friend: query.get("friend"), date: query.get("date") });
  if (!match.success) throw new HttpError(400, "请选择好友和有效日期。");
  return json(await friendDay(db, user.id, match.data.friend, match.data.date));
});

export const POST = api(async (request) => {
  const { db, user } = await account();
  await changeFriends(db, user, await readJson(request, friendMutation, 2048));
  return json(await listFriends(db, user.id));
});
