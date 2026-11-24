import { z } from "zod";
import { json } from "@/server/http";
import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { callPlanningTool } from "@/features/agent-access/tools";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, z.object({ action: z.enum(["stage", "preview", "commit"]) }).passthrough(), principal, 1_500_000);
  const { action, ...args } = input;
  return json(await callPlanningTool(agentDatabase(), principal,
    action === "stage" ? "stage_spotter_program" : action === "preview" ? "preview_spotter_program" : "commit_spotter_program", args));
});
