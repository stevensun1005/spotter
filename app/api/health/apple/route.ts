import { requireAccount } from "@/features/auth/server";
import { appleConnection, appleControl, disconnectApple, issueAppleCode } from "@/features/heart/apple/server";
import { api, json, readJson } from "@/server/http";

export const GET = api(async () => {
  const { id } = await requireAccount();
  return json({ connected: appleConnection(id) });
});

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  const { action } = await readJson(request, appleControl, 1024);
  if (action === "pair") return json(issueAppleCode(id));
  disconnectApple(id);
  return json({ connected: false });
});
