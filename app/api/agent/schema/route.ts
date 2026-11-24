import { json } from "@/server/http";
import { agentApiSchema } from "@/features/agent-access/schema";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => json(agentApiSchema(new URL(request.url).origin));
