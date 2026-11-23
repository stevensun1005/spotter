import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";
import { dateSchema } from "@/shared/dates";
import { libraryMutation } from "@/features/library/model";
import { readLibrary, removeLibrary, saveLibrary } from "@/features/library/server";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id } = await requireAccount();
  const day = new URL(request.url).searchParams.get("date");
  if (day !== null && !dateSchema.safeParse(day).success) throw new HttpError(400, "日期无效。");
  return json({ rows: await readLibrary(id, day ?? undefined) });
});

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const item = await readJson(request, libraryMutation, 48000);
  if (item.action === "save") await saveLibrary(id, item.data);
  else await removeLibrary(id, item.kind, item.id);
  return json({ ok: true });
});
