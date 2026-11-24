import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";
import { backupLimit, backupSchema, dateBounds, scopeSchema } from "@/features/data/model";
import { exportBackup, importBackup } from "@/features/data/server";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const account = await requireAccount();
  const query = new URL(request.url).searchParams;
  const scope = scopeSchema.safeParse(query.get("scope") ?? "all");
  const dates = dateBounds.safeParse({ from: query.get("from") ?? undefined, to: query.get("to") ?? undefined });
  if (!scope.success || !dates.success) throw new HttpError(400, "数据类别或日期范围无效。");
  const file = await exportBackup(account.id, scope.data, dates.data);
  const body = JSON.stringify(file);
  return new Response(body, { headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "attachment; filename=spotter-" + scope.data + "-" + new Date().toISOString().slice(0, 10) + ".json",
  } });
});

export const POST = api(async (request) => {
  const account = await requireAccount();
  const file = await readJson(request, backupSchema, backupLimit);
  return json(await importBackup(account.id, file));
});
