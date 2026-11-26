import { env } from "cloudflare:workers";
import { avatarLookupIds, readVisibleAvatars } from "@/features/auth/visible-avatars";
import { requireAccount } from "@/server/account";
import { api, HttpError, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id } = await requireAccount();
  if (!env.DB) throw new HttpError(503, "账号服务暂时不可用。");
  const ids = avatarLookupIds.safeParse(new URL(request.url).searchParams.getAll("ids"));
  if (!ids.success) throw new HttpError(400, "每次可读取 1 到 32 个头像。");
  return json(await readVisibleAvatars(env.DB, id, ids.data));
});
