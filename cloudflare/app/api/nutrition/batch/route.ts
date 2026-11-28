import { env } from "cloudflare:workers";
import { mealBatchMutation, saveMealBatch, undoMealBatch } from "@/features/nutrition/meal-batch";
import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const mutation = await readJson(request, mealBatchMutation, 48_000);
  if (mutation.expectedOwner !== id) throw new HttpError(403, "登录账号已切换，请重新打开记录后再操作。");
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  if (mutation.action === "save") {
    return json({ rows: await saveMealBatch(env.DB, id, mutation.batchId, mutation.rows) });
  }
  await undoMealBatch(env.DB, id, mutation.batchId, mutation.rows);
  return json({ ok: true });
});
