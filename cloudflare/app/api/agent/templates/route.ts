import { json } from "@/server/http";
import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { commitAgentTemplateChange, previewAgentTemplateChange, templateChangeInput } from "@/features/agent-access/template-change";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, templateChangeInput, principal);
  const db = agentDatabase();
  return json(input.action === "preview" ? await previewAgentTemplateChange(db, principal, input)
    : await commitAgentTemplateChange(db, principal, input));
});
