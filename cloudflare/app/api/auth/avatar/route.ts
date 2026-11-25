import { env } from "cloudflare:workers";
import { accountAvatarUpdate, readAccountAvatar, saveAccountAvatar } from "@/features/auth/account-avatar";
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
  return json(await readAccountAvatar(db, id));
});

export const PATCH = api(async (request) => {
  const { db, id } = await account();
  const input = await readJson(request, accountAvatarUpdate, 82_000);
  return json(await saveAccountAvatar(db, id, input));
});
