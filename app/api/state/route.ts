import { requireAccount } from "@/features/auth/server";
import { getPair } from "@/features/partner/server";
import { listEntries } from "@/server/entries";
import { api, json } from "@/server/http";
import type { State } from "@/shared/state";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const me = await requireAccount();
  const room = getPair(me.id);
  return json({ me, room, entries: listEntries(me.id, room?.partner?.id ?? null) } satisfies State);
});
