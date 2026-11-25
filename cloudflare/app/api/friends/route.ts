import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { friendDateQuery, friendFeedCheerInput, friendMutation } from "@/features/friends/model";
import { peopleSearchMode, socialMutationSchema } from "@/features/friends/social-model";
import { changeSocial, searchPeople, socialState } from "@/features/friends/social-server";
import { dateSchema } from "@/shared/dates";
import { changeFriendFeedCheer, changeFriends, friendCurrentDay, friendDay, friendFeed, listFriends } from "@/features/friends/server";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";
const mutation = z.union([friendMutation, socialMutationSchema, friendFeedCheerInput]);

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
  if (query.get("section") === "social") return json(await socialState(db, user.id, query.get("includeBuddy") === "1"));
  const search = query.get("search");
  if (search !== null) {
    const mode = peopleSearchMode.optional().safeParse(query.get("mode") ?? undefined);
    if (!mode.success) throw new HttpError(400, "请选择好友或搭子搜索。");
    return json({ results: await searchPeople(db, user.id, search, mode.data) });
  }
  const feedVersion = query.get("feed");
  if (feedVersion === "1" || feedVersion === "2") {
    return json(await friendFeed(db, user.id, today, feedVersion === "2" ? user.name : null));
  }
  if (!query.has("friend") && !query.has("date")) return json(await listFriends(db, user.id, visibleDay(query), today));
  const match = friendDateQuery.safeParse({ friend: query.get("friend"), date: query.get("date") });
  if (!match.success) throw new HttpError(400, "请选择好友和有效日期。");
  return json(await friendDay(db, user.id, match.data.friend, match.data.date, today));
});

export const POST = api(async (request) => {
  const { db, user } = await account();
  const body = await readJson(request, mutation, 2048);
  const query = new URL(request.url).searchParams;
  if (body.action === "feed-cheer") {
    if (body.expectedOwner !== user.id) throw new HttpError(403, "当前登录账号已切换，请重新打开朋友圈。");
    const today = friendCurrentDay(request);
    await changeFriendFeedCheer(db, user.id, body.friend, body.date, body.active, today);
    return json(await friendFeed(db, user.id, today, user.name));
  }
  if (body.action === "social-preferences" || body.action === "request" || body.action === "respond") {
    await changeSocial(db, user, body);
    return json(await socialState(db, user.id, query.get("includeBuddy") === "1"));
  }
  const day = visibleDay(query);
  await changeFriends(db, user, body);
  return json(await listFriends(db, user.id, day, friendCurrentDay(request)));
});
