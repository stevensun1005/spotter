import { requireAccount } from "@/server/account";
import { heartMutation, readHeart, removeHeart, saveHeart, workoutId } from "@/features/heart/server";
import { whoopEnabled } from "@/features/heart/whoop";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id: owner } = await requireAccount();
  const id = workoutId.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) throw new HttpError(400, "训练编号无效。");
  return json({ data: await readHeart(owner, id.data), whoop: whoopEnabled() });
});

export const POST = api(async (request) => {
  const { id: owner } = await requireAccount();
  const item = await readJson(request, heartMutation, 48_000);
  if (item.action === "save") {
    if (item.expectedOwner && item.expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请重新打开训练。");
    await saveHeart(owner, item.id, item.data);
  } else await removeHeart(owner, item.id);
  return json({ ok: true });
});
