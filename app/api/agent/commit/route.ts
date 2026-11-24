import { json } from "@/server/http";
import { commitDraftInput } from "@/features/agent-access/model";
import { commitDraft, requireScope, verifyProfile } from "@/features/agent-access/store";
import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request, true);
  requireScope(principal, "plans:write");
  const input = await agentBody(request, commitDraftInput, principal, 2000);
  await verifyProfile(principal.owner, input.profileRef);
  return json(await commitDraft(agentDatabase(), principal.owner, input.draftId, input.revision));
});
