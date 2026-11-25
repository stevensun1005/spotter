import { json } from "@/server/http";
import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { importAgentRecords, recordImportInput } from "@/features/agent-access/records";
import { readAgentRecords, recordReadInput } from "@/features/agent-access/record-read";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, recordImportInput, principal, 1_500_000);
  return json(await importAgentRecords(principal, input));
});

export const GET = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const query = new URL(request.url).searchParams;
  const input = recordReadInput.parse({
    profileRef: query.get("profileRef"), scope: query.get("scope"),
    from: query.get("from") ?? undefined, to: query.get("to") ?? undefined,
    limit: Number(query.get("limit") ?? 20), offset: Number(query.get("offset") ?? 0),
  });
  return json(await readAgentRecords(agentDatabase(), principal, input));
});
