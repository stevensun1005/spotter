import { z } from "zod";
import { requireAccount } from "@/features/auth/server";
import { requireHeartWorkout, workoutId } from "@/features/heart/server";
import { whoopAuthorization } from "@/features/heart/whoop";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const { id: owner } = await requireAccount();
  const { id } = await readJson(request, z.object({ id: workoutId }), 1024);
  requireHeartWorkout(owner, id);
  return json({ url: await whoopAuthorization(request, owner, id) });
});
