import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { changeAgentExerciseDemo, exerciseDemoInput } from "@/features/agent-access/exercise-demos";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, exerciseDemoInput, principal, 1_060_000);
  return json(await changeAgentExerciseDemo(agentDatabase(), principal, input));
});
