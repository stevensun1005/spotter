import { json } from "@/server/http";
import { agentApi, requestPrincipal } from "@/features/agent-access/http";
import { agentIdentity } from "@/features/agent-access/tools";

export const dynamic = "force-dynamic";
export const GET = agentApi(async (request) => json(await agentIdentity(await requestPrincipal(request))));
