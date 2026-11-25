import { env } from "cloudflare:workers";
import { updateNicknameInput, updateProfileInput } from "@/features/auth/profile";
import { readAccountProfile, saveAccountNickname, saveAccountUsername } from "@/features/auth/profile-server";
import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

async function account() {
  if (!env.DB) throw new HttpError(503, "账号服务暂时不可用。");
  const { id } = await requireAccount();
  return { db: env.DB, id };
}

export const GET = api(async () => {
  const { db, id } = await account();
  return json({ profile: await readAccountProfile(db, id) });
});

export const POST = api(async (request) => {
  const { db, id } = await account();
  const { username, tag, expectedOwner } = await readJson(request, updateProfileInput, 2048);
  if (id !== expectedOwner) throw new HttpError(403, "当前登录账号已切换，请重新打开设置。");
  return json({ profile: await saveAccountUsername(db, id, username, tag) });
});

export const PATCH = api(async (request) => {
  const { db, id } = await account();
  const { name, expectedOwner } = await readJson(request, updateNicknameInput, 2048);
  if (id !== expectedOwner) throw new HttpError(403, "当前登录账号已切换，请重新打开设置。");
  return json({ profile: await saveAccountNickname(db, id, name) });
});
