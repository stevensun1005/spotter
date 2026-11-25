import { env } from "cloudflare:workers";
import { readWorkoutHealthSummary, saveWorkoutHealthSummary, workoutHealthId, workoutHealthUpload } from "@/features/heart/workout-summary";
import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

async function account() {
  const { id: owner } = await requireAccount();
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return { db: env.DB, owner };
}

export const GET = api(async (request) => {
  const { db, owner } = await account();
  const id = workoutHealthId.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) throw new HttpError(400, "训练编号无效。");
  return json(await readWorkoutHealthSummary(db, owner, id.data));
});

export const POST = api(async (request) => {
  const { db, owner } = await account();
  const input = await readJson(request, workoutHealthUpload, 2_500);
  return json(await saveWorkoutHealthSummary(db, owner, input));
});
