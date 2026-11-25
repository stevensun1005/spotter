import { accountAvatarUpdate, readAccountAvatar, saveAccountAvatar } from "@/features/auth/account-avatar";
import { readCookie, readSession, sessionCookieName } from "@/features/auth/server";
import { readFriendsRequest, writeFriendsRequest } from "@/features/friends/http";
import { api, HttpError, json, readJson } from "@/server/http";

export default {
  fetch(request: Request, { DB }: { DB: D1Database }) {
    return api(async (request) => {
      const path = new URL(request.url).pathname;
      if (path !== "/api/auth/avatar" && path !== "/api/friends") {
        throw new HttpError(404, "找不到该功能。");
      }

      const token = readCookie(request, sessionCookieName);
      const profile = token && await readSession(DB, token);
      if (!profile) throw new HttpError(401, "请先登录训练搭子。");

      if (path === "/api/auth/avatar") {
        if (request.method === "GET") return json(await readAccountAvatar(DB, profile.userId));
        if (request.method === "PATCH") {
          const update = await readJson(request, accountAvatarUpdate, 82_000);
          return json(await saveAccountAvatar(DB, profile.userId, update));
        }
      } else {
        const user = { id: profile.userId, name: profile.fullName?.trim().slice(0, 80) || "训练好友" };
        if (request.method === "GET") return readFriendsRequest(request, DB, user, true);
        if (request.method === "POST") return writeFriendsRequest(request, DB, user, true);
      }
      throw new HttpError(405, "该请求方式暂不支持。");
    })(request);
  },
};
