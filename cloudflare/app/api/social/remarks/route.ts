import { env } from "cloudflare:workers";
import { readSocialRemarks, saveSocialRemark, socialRemarkInput } from "@/features/friends/remarks";
import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

async function account() {
  if (!env.DB) throw new HttpError(503, "好友服务暂时不可用。");
  const { id } = await requireAccount();
  return { db: env.DB, owner: id };
}

function verifyOwner(owner: string, expectedOwner: string | null | undefined) {
  if (expectedOwner != null && expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请刷新后再试。");
}

export const GET = api(async (request) => {
  const { db, owner } = await account();
  verifyOwner(owner, new URL(request.url).searchParams.get("expectedOwner"));
  return json(await readSocialRemarks(db, owner));
});

export const PATCH = api(async (request) => {
  const { db, owner } = await account();
  const { id, remark, expectedOwner } = await readJson(request, socialRemarkInput, 4000);
  verifyOwner(owner, expectedOwner);
  return json(await saveSocialRemark(db, owner, id, remark));
});
