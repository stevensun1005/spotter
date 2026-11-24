import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";
import { dateSchema } from "@/shared/dates";
import { libraryMutation } from "@/features/library/model";
import { readLibrary, readRecentMealFoods, removeLibrary, saveLibrary } from "@/features/library/server";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id } = await requireAccount();
  const day = new URL(request.url).searchParams.get("date");
  if (day !== null && !dateSchema.safeParse(day).success) throw new HttpError(400, "日期无效。");
  const body = new URL(request.url).searchParams.get("section") === "body";
  const [rows, recentMeals] = await Promise.all([
    readLibrary(id, day ?? undefined, body), day && !body ? readRecentMealFoods(id, day) : undefined,
  ]);
  return json({ rows, ...(recentMeals ? { recentMeals } : {}) });
});

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const item = await readJson(request, libraryMutation, 48000);
  if (item.action === "save") return json({ ok: true, updated: await saveLibrary(id, item.data, item.revision) });
  await removeLibrary(id, item.kind, item.id, item.revision);
  return json({ ok: true });
});
