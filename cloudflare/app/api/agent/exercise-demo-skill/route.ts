import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { exerciseDemoSkillInput, getAgentExerciseDemoSkill } from "@/features/agent-access/exercise-demos";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, exerciseDemoSkillInput, principal, 4_000);
  return json(await getAgentExerciseDemoSkill(agentDatabase(), principal, input));
});
