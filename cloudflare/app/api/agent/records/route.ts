import { json } from "@/server/http";
import { agentApi, agentBody, requestPrincipal } from "@/features/agent-access/http";
import { importAgentRecords, recordImportInput } from "@/features/agent-access/records";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, recordImportInput, principal, 1_500_000);
  return json(await importAgentRecords(principal, input));
});
