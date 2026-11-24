import { requireAccount } from "@/server/account";
import { agentProfileRef } from "@/features/agent/profile";
import { json, readJson } from "@/server/http";
import { connectionMutation } from "@/features/agent-access/model";
import { createConnection, listConnections, revokeConnection } from "@/features/agent-access/store";
import { agentApi, agentDatabase } from "@/features/agent-access/http";

export const dynamic = "force-dynamic";
export const GET = agentApi(async () => {
  const { id } = await requireAccount();
  return json({ connections: await listConnections(agentDatabase(), id), profileRef: await agentProfileRef(id) });
});
export const POST = agentApi(async (request) => {
  const { id } = await requireAccount();
  const input = await readJson(request, connectionMutation, 2000);
  return json(input.action === "create" ? await createConnection(agentDatabase(), id, input as Parameters<typeof createConnection>[2]) : await revokeConnection(agentDatabase(), id, input.id));
});
