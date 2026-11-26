import { env } from "cloudflare:workers";
import { resolveAgentPlanExercises } from "@/features/agent-access/exercise-library";
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
    const { plans: requested } = agentPlanWrite.parse(args);
    const db = env.DB;
    if (!db) throw new HttpError(503, "云端数据库暂不可用。");
    const plans = await resolveAgentPlanExercises(db, owner, requested);
    const candidates = await Promise.all(plans.map(async (data, index) => {
      const id = await agentRecordId("plan", data);
      const previousId = data === requested[index] ? id : await agentRecordId("plan", requested[index]);
      return { id, previousId, data };
    }));
    const previousIds = candidates.filter(({ id, previousId }) => id !== previousId).map(({ previousId }) => previousId);
    const legacyIds = new Map<string, string>();
    if (previousIds.length) {
      // A retry of a plan saved before exercise resolution still belongs to its original record.
      const { results } = await db.prepare("SELECT id FROM entries WHERE owner = ? AND id IN (SELECT value FROM json_each(?))")
        .bind(owner, JSON.stringify(previousIds)).all<{ id: string }>();
      const existing = new Set(results.map(({ id }) => id));
      for (const { id, previousId } of candidates) {
        if (existing.has(previousId)) legacyIds.set(id, previousId);
      }
    }
    const items = candidates.map(({ id, data }) => ({ id: legacyIds.get(id) ?? id, data }));
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
