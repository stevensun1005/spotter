import { z } from "zod";
import { agentProfileRef, profileRefSchema } from "@/features/agent/profile";
import { agentWriteTools } from "@/features/agent/write-model";
import { programSchema } from "@/features/programs/model";
import { commitProgram, previewProgram, readProgram, saveProgram } from "@/features/programs/server";
import { contextInput, stagePlansInput, commitDraftInput, type AgentPrincipal } from "./model";
import { planningContext } from "./context";
import { commitDraft, previewDraft, requireScope, resolvePlanningExercises, stageDraft, verifyProfile, verifyReviewedPlanExercises } from "./store";

const profile = { type: "string", pattern: "^spotter_[a-f0-9]{32}$" };
const uuid = { type: "string", format: "uuid" };
const revision = { type: "string", pattern: "^[a-f0-9]{64}$" };
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const writes = { ...readOnly, readOnlyHint: false };
const originalPlan = agentWriteTools[0].inputSchema.properties.plans.items;
export const agentPlanJsonSchema = { ...originalPlan, properties: { ...originalPlan.properties,
  week: { type: "integer", minimum: 1, maximum: 104 }, day: { type: "integer", minimum: 1, maximum: 7 },
} };
export const programJsonSchema = {
  type: "object", additionalProperties: false, required: ["id", "title", "startDate", "weeks", "phases", "sessions"], properties: {
    id: uuid, title: { type: "string", minLength: 1, maxLength: 100 }, startDate: { type: "string", format: "date", description: "day 1 of week 1; each session date must equal this date plus (week-1)*7+day-1." },
    weeks: { type: "integer", minimum: 1, maximum: 52 },
    phases: { type: "array", maxItems: 52, items: { type: "object", additionalProperties: false, required: ["id", "name", "fromWeek", "toWeek", "color"], properties: { id: uuid, name: { type: "string", minLength: 1, maxLength: 80 }, fromWeek: { type: "integer", minimum: 1, maximum: 52 }, toWeek: { type: "integer", minimum: 1, maximum: 52 }, color: { type: "string", enum: ["mint", "lime", "lilac", "amber"] } } } },
    sessions: { type: "array", minItems: 1, maxItems: 364, items: { type: "object", additionalProperties: false, required: ["id", "week", "day", "plan"], properties: { id: uuid, week: { type: "integer", minimum: 1, maximum: 52 }, day: { type: "integer", minimum: 1, maximum: 7 }, phaseId: uuid, plan: agentPlanJsonSchema } } },
  },
};
const stageSchema = { type: "object", additionalProperties: false, required: ["profileRef", "requestId", "plans"], properties: {
  profileRef: profile, requestId: uuid, title: { type: "string", minLength: 1, maxLength: 100 }, plans: { type: "array", minItems: 1, maxItems: 20, items: agentPlanJsonSchema },
} };
export const planningTools = [
  { name: "read_spotter_planning_context", title: "读取个人编排上下文", description: "按用户授权读取个人动作、模板、编排规则和内置动作搜索；不含心率、身体、饮食、好友或搭子数据。按nextOffset翻页。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef"], properties: { profileRef: profile, query: { type: "string", maxLength: 100 }, offset: { type: "integer", minimum: 0, maximum: 50000 }, limit: { type: "integer", minimum: 1, maximum: 100 } } }, annotations: readOnly },
  { name: "stage_spotter_plans", title: "起草训练计划", description: "将1–20次私人训练保存为可编辑草稿，返回日期/冲突预览，暂不加入日历。含动作时需read:context，先查动作库，完全相同的动作复用。重试沿用requestId；用户在网页可编辑。", inputSchema: stageSchema, annotations: writes },
  { name: "preview_spotter_draft", title: "预览计划草稿", description: "读取本账号的草稿、revision与冲突预览，不修改日历。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "draftId"], properties: { profileRef: profile, draftId: uuid } }, annotations: readOnly },
  { name: "commit_spotter_draft", title: "保存已确认的计划草稿", description: "仅在用户授权这份revision的草稿后填写confirmed:true，将计划追加到日历。含动作时需read:context，动作匹配有变化时须重新起草。重复请求不重复写入，已有训练/打卡不会覆盖。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "draftId", "revision", "confirmed"], properties: { profileRef: profile, draftId: uuid, revision, confirmed: { const: true, type: "boolean" } } }, annotations: writes },
  { name: "stage_spotter_program", title: "起草多周训练周期", description: "保存完整多周训练周期的草稿，最多52周364次，暂不加入日历。含动作时需read:context，先查动作库，完全相同的动作复用。保留同一program.id进行修订，revision为上次返回的值或首次null。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "program", "revision"], properties: { profileRef: profile, program: programJsonSchema, revision: { type: ["string", "null"] } } }, annotations: writes },
  { name: "preview_spotter_program", title: "预览训练周期变更", description: "显示新增、可更新、自定义、已开始/完成和冲突项，并返回本次previewToken。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "programId", "revision"], properties: { profileRef: profile, programId: uuid, revision: { type: "string" } } }, annotations: readOnly },
  { name: "commit_spotter_program", title: "保存已确认的训练周期", description: "仅在用户确认周期预览后保存，提供准确revision和previewToken。含动作时需read:context，动作匹配有变化时须重新起草。保留已自定义、进行中和完成训练。", inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "programId", "revision", "previewToken", "confirmed"], properties: { profileRef: profile, programId: uuid, revision: { type: "string" }, previewToken: { type: "string" }, confirmed: { const: true, type: "boolean" } } }, annotations: writes },
] as const;
export type PlanningToolName = typeof planningTools[number]["name"];
export function isPlanningTool(name: unknown): name is PlanningToolName { return planningTools.some((tool) => tool.name === name); }
const programInput = z.object({ profileRef: profileRefSchema, program: programSchema, revision: z.string().uuid().nullable() }).strict();
const programPreview = z.object({ profileRef: profileRefSchema, programId: z.string().uuid(), revision: z.string().uuid() }).strict();
const programCommit = programPreview.extend({ previewToken: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict();
const previewInput = z.object({ profileRef: profileRefSchema, draftId: z.string().uuid() }).strict();

export async function callPlanningTool(db: D1Database, principal: AgentPrincipal, name: PlanningToolName, args: unknown) {
  const { profileRef } = z.object({ profileRef: profileRefSchema }).parse(args);
  await verifyProfile(principal.owner, profileRef);
  if (name === "read_spotter_planning_context") {
    requireScope(principal, "read:context");
    return planningContext(db, principal.owner, contextInput.parse(args));
  }
  if (name === "stage_spotter_plans") {
    requireScope(principal, "plans:draft");
    const input = stagePlansInput.parse(args);
    const saved = await stageDraft(db, principal.owner, input, principal);
    return previewDraft(db, principal.owner, saved.id);
  }
  if (name === "preview_spotter_draft") {
    if (!principal.scopes.includes("plans:draft")) requireScope(principal, "plans:write");
    const input = previewInput.parse(args);
    return previewDraft(db, principal.owner, input.draftId);
  }
  if (name === "commit_spotter_draft") {
    requireScope(principal, "plans:write");
    const input = commitDraftInput.parse(args);
    return commitDraft(db, principal.owner, input.draftId, input.revision, principal);
  }
  if (name === "stage_spotter_program") {
    requireScope(principal, "plans:draft");
    const input = programInput.parse(args);
    const plans = await resolvePlanningExercises(db, principal.owner, input.program.sessions.map(({ plan }) => plan), principal);
    const sessions = input.program.sessions.map((session, index) => ({ ...session, plan: plans[index] }));
    return saveProgram(principal.owner, { ...input.program, sessions }, input.revision, db);
  }
  if (name === "preview_spotter_program") {
    if (!principal.scopes.includes("plans:draft")) requireScope(principal, "plans:write");
    const input = programPreview.parse(args);
    await readProgram(principal.owner, input.programId, db);
    return previewProgram(principal.owner, input.programId, input.revision, db);
  }
  requireScope(principal, "plans:write");
  const input = programCommit.parse(args);
  return commitProgram(principal.owner, input.programId, input.revision, input.previewToken, true, db,
    ({ sessions }) => verifyReviewedPlanExercises(db, principal.owner, sessions.map(({ plan }) => plan), principal));
}

export function toolsFor(principal: AgentPrincipal) {
  return planningTools.filter((tool) => tool.name === "read_spotter_planning_context" ? principal.scopes.includes("read:context") : tool.name.startsWith("stage_") ? principal.scopes.includes("plans:draft") : tool.name.startsWith("commit_") ? principal.scopes.includes("plans:write") : principal.scopes.includes("plans:draft") || principal.scopes.includes("plans:write"));
}
export async function agentIdentity(principal: AgentPrincipal) { return { profileRef: await agentProfileRef(principal.owner), scopes: principal.scopes }; }
