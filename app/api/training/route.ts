import { requireAccount } from "@/features/auth/server";
import { recordTraining, trainingMutation } from "@/features/training/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const user = await requireAccount();
  recordTraining(user.id, await readJson(request, trainingMutation));
  return json({ ok: true });
});
