import { coachProteinRequest } from "@/features/nutrition/coach-protein-save";
import { commitCoachProtein } from "@/features/nutrition/coach-protein-server";
import { requireAccount } from "@/server/account";
import { api, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const input = await readJson(request, coachProteinRequest, 8_000);
  return json(await commitCoachProtein(id, input));
});
