import { env } from "cloudflare:workers";
import { emptyBackup } from "@/features/data/model";
import { importBackup } from "@/features/data/server";
import { checkPlanDates } from "@/features/plans/schedule-server";
import { HttpError } from "@/server/http";
import { agentFoodWrite, agentPlanWrite, agentRecordId, type AgentWriteTool } from "./write-model";

export { agentWriteTools, isAgentWriteTool } from "./write-model";

// The MCP entry point binds owner to the authenticated account and checks profileRef.
export async function writeAgentData(owner: string, tool: AgentWriteTool, args: unknown) {
  const backup = emptyBackup();
  if (tool === "add_spotter_plans") {
    const { plans } = agentPlanWrite.parse(args);
    const db = env.DB;
    if (!db) throw new HttpError(503, "云端数据库暂不可用。");
    const items = await Promise.all(plans.map(async (data) => ({ id: await agentRecordId("plan", data), data })));
    await checkPlanDates(db, owner, items);
    backup.training = items.map((item) => ({ ...item, kind: "plan" }));
    const dates = plans.map(({ date }) => date).sort();
    return { ...await importBackup(owner, backup), from: dates[0], to: dates[dates.length - 1] };
  }

  const { foods } = agentFoodWrite.parse(args);
  backup.library = await Promise.all(foods.map(async (food) => ({
    ...food, kind: "food" as const, id: await agentRecordId("food", food),
  })));
  return importBackup(owner, backup);
}
