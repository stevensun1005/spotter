import { json } from "@/server/http";
import { agentApi, agentBody, requestPrincipal } from "@/features/agent-access/http";
import { addAgentMeals, mealWriteInput } from "@/features/agent-access/meal-write";

export const dynamic = "force-dynamic";

export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  const input = await agentBody(request, mealWriteInput, principal, 20_000);
  return json(await addAgentMeals(principal, input));
});
