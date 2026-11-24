import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { friendDateQuery, friendMutation } from "@/features/friends/model";
import { socialMutationSchema } from "@/features/friends/social-model";
import { changeSocial, searchPeople, socialState } from "@/features/friends/social-server";
import { dateSchema } from "@/shared/dates";
import { changeFriends, friendCurrentDay, friendDay, friendFeed, listFriends } from "@/features/friends/server";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";
const mutation = z.union([friendMutation, socialMutationSchema]);

function visibleDay(query: URLSearchParams) {
  const today = query.get("today");
  if (today === null) return undefined;
  const valid = dateSchema.safeParse(today);
  if (!valid.success) throw new HttpError(400, "请选择有效日期。");
  return valid.data;
}

async function account() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请登录后查看好友。");
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return { db: env.DB, user: { id: user.userId, name: user.fullName?.trim().slice(0, 80) || "训练好友" } };
}

export const GET = api(async (request) => {
  const { db, user } = await account();
  const query = new URL(request.url).searchParams;
  const today = friendCurrentDay(request);
  if (query.get("section") === "social") return json(await socialState(db, user.id));
  const search = query.get("search");
  if (search !== null) return json({ results: await searchPeople(db, user.id, search) });
  if (query.get("feed") === "1") return json(await friendFeed(db, user.id, today));
  if (!query.has("friend") && !query.has("date")) return json(await listFriends(db, user.id, visibleDay(query), today));
  const match = friendDateQuery.safeParse({ friend: query.get("friend"), date: query.get("date") });
  if (!match.success) throw new HttpError(400, "请选择好友和有效日期。");
  return json(await friendDay(db, user.id, match.data.friend, match.data.date, today));
});

export const POST = api(async (request) => {
  const { db, user } = await account();
  const body = await readJson(request, mutation, 2048);
  if (body.action === "social-preferences" || body.action === "request" || body.action === "respond") {
    await changeSocial(db, user, body);
    return json(await socialState(db, user.id));
  }
  const day = visibleDay(new URL(request.url).searchParams);
  await changeFriends(db, user, body);
  return json(await listFriends(db, user.id, day, friendCurrentDay(request)));
});
