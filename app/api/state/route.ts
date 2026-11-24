import { requireAccount } from "@/server/account";
import { api, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { id } = await requireAccount();
  return json({ me: { id } });
});
