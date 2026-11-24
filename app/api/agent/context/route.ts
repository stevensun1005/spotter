import { json } from "@/server/http";
import { contextInput } from "@/features/agent-access/model";
import { planningContext } from "@/features/agent-access/context";
import { requireScope, verifyProfile } from "@/features/agent-access/store";
import { agentApi, agentDatabase, requestPrincipal } from "@/features/agent-access/http";

export const dynamic = "force-dynamic";
export const GET = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  requireScope(principal, "read:context");
  const params = new URL(request.url).searchParams;
  const input = contextInput.parse({ profileRef: params.get("profileRef"), query: params.get("query") ?? "", offset: Number(params.get("offset") ?? 0), limit: Number(params.get("limit") ?? 50) });
  await verifyProfile(principal.owner, input.profileRef);
  return json(await planningContext(agentDatabase(), principal.owner, input));
});
