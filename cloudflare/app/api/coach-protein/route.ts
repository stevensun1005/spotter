import { coachProteinRequest, savedProteinRequest } from "@/features/nutrition/coach-protein-save";
import { commitCoachProtein } from "@/features/nutrition/coach-protein-server";
import { recordSavedProtein } from "@/features/nutrition/saved-protein-server";
import { z } from "zod";
import { requireAccount } from "@/server/account";
import { api, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const input = await readJson(request, z.union([coachProteinRequest, savedProteinRequest]), 8_000);
  return json("action" in input ? await recordSavedProtein(id, input) : await commitCoachProtein(id, input));
});
