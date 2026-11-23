import { requireAccount } from "@/features/auth/server";
import { heartMutation, readHeart, removeHeart, saveHeart, workoutId } from "@/features/heart/server";
import { whoopEnabled } from "@/features/heart/whoop";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id: owner } = await requireAccount();
  const id = workoutId.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) throw new HttpError(400, "训练编号无效。");
  return json({ data: readHeart(owner, id.data), whoop: whoopEnabled() });
});

export const POST = api(async (request) => {
  const { id: owner } = await requireAccount();
  const item = await readJson(request, heartMutation, 48_000);
  if (item.action === "save") saveHeart(owner, item.id, item.data);
  else removeHeart(owner, item.id);
  return json({ ok: true });
});
