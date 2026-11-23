import { requireAccount } from "@/features/auth/server";
import { cheer, createPair, partnerMutation } from "@/features/partner/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const user = await requireAccount();
  const data = await readJson(request, partnerMutation, 1024);
  if (data.action === "create") createPair(user);
  else cheer(user, data.date);
  return json({ ok: true });
});
