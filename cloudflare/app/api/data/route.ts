import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";
import { backupLimit, backupSchema, dateBounds, scopeSchema } from "@/features/data/model";
import { bodyCsv, trainingCsv } from "@/features/data/csv";
import { exportBackup, importBackup } from "@/features/data/server";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const account = await requireAccount();
  const query = new URL(request.url).searchParams;
  const scope = scopeSchema.safeParse(query.get("scope") ?? "all");
  const dates = dateBounds.safeParse({ from: query.get("from") ?? undefined, to: query.get("to") ?? undefined });
  if (!scope.success || !dates.success) throw new HttpError(400, "数据类别或日期范围无效。");
  const format = query.get("format") ?? "json";
  if (format !== "json" && format !== "csv") throw new HttpError(400, "导出格式无效。");
  if (format === "csv" && scope.data !== "training" && scope.data !== "body") throw new HttpError(400, "CSV 支持训练和身体数据。");
  const file = await exportBackup(account.id, scope.data, dates.data, format === "json");
  const body = format === "json" ? JSON.stringify(file) : scope.data === "training" ? trainingCsv(file.training) : bodyCsv(file.library);
  return new Response(body, { headers: {
    "Content-Type": (format === "json" ? "application/json" : "text/csv") + "; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "attachment; filename=spotter-" + scope.data + "-" + new Date().toISOString().slice(0, 10) + "." + format,
  } });
});

export const POST = api(async (request) => {
  const account = await requireAccount();
  const expectedOwner = new URL(request.url).searchParams.get("expectedOwner");
  if (expectedOwner !== null && expectedOwner !== account.id) throw new HttpError(409, "登录账号已切换，请重新打开数据设置。");
  const file = await readJson(request, backupSchema, backupLimit);
  return json(await importBackup(account.id, file));
});
