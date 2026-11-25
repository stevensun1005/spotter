import { requireAccount } from "@/server/account";
import { api, json } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const me = await requireAccount();
  return json({ me });
});
