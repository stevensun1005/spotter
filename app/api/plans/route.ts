import { requireAccount } from "@/features/auth/server";
import { plansMutation, savePlans } from "@/features/plans/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const user = await requireAccount();
  const { items } = await readJson(request, plansMutation);
  savePlans(user.id, items);
  return json({ ok: true });
});
