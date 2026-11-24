import { z } from "zod";
import { backupSchema, libraryScope, scopeNames, scopeSchema } from "@/features/data/model";
import { importBackup } from "@/features/data/server";
import { profileRefSchema } from "@/features/agent/profile";
import { agentFoodWrite, agentWriteTools } from "@/features/agent/write-model";
import { writeAgentData } from "@/features/agent/writes";
import { HttpError } from "@/server/http";
import { recordWriteScopes, type AgentPrincipal } from "./model";
import { requireScope, verifyProfile } from "./store";

const maxRecords = 20;
const recordScope = scopeSchema.exclude(["all"]);
type RecordScope = z.infer<typeof recordScope>;
const recordScopes = recordScope.options;

export const recordImportInput = z.object({
  profileRef: profileRefSchema,
  scope: recordScope,
  confirmed: z.literal(true),
  backup: backupSchema,
}).strict();

export const recordImportTool = {
  name: "import_spotter_records",
  title: "追加个人记录",
  description: "一次追加 1–20 条同类别的个人记录。训练类收已完成的打卡与个人动作设置；新计划走草稿及确认。饮食类收餐食、饮水、常用食物及目标设置，身体类收测量和身体档案，模板类收训练模板。沿用原 UUID 重试，已有记录跳过。",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["profileRef", "scope", "confirmed", "backup"],
    properties: {
      profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
      scope: { type: "string", enum: recordScopes },
      confirmed: { type: "boolean", const: true, description: "已经获得用户对本批记录的写入授权时填写 true。" },
      backup: {
        type: "object", additionalProperties: false, required: ["format", "version", "training", "library", "heart"],
        properties: {
          format: { const: "spotter-backup" }, version: { const: 1 },
          training: { type: "array", maxItems: maxRecords, items: { type: "object" } },
          library: { type: "array", maxItems: maxRecords, items: { type: "object" } },
          heart: { type: "array", maxItems: 0 },
        },
      },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} as const;

const foodTool = agentWriteTools[1];
export function recordToolsFor(principal: AgentPrincipal) {
  const scopes = recordScopes.filter((scope) => principal.scopes.includes(recordWriteScopes[scope]));
  if (!scopes.length) return [];
  const tool = { ...recordImportTool, inputSchema: { ...recordImportTool.inputSchema, properties: {
    ...recordImportTool.inputSchema.properties, scope: { type: "string", enum: scopes },
  } } };
  return scopes.includes("nutrition") ? [tool, foodTool] : [tool];
}

export async function importAgentRecords(principal: AgentPrincipal, input: z.infer<typeof recordImportInput>) {
  const { scope, backup } = input;
  requireScope(principal, recordWriteScopes[scope]);
  await verifyProfile(principal.owner, input.profileRef);
  if (backup.heart.length) throw new HttpError(400, "心率记录请通过账号本人的站内入口导入。");
  if (backup.training.some(({ kind }) => kind !== "log")) throw new HttpError(400, "新计划请用计划草稿工具，训练记录只接收已完成的打卡。");
  if ((scope !== "training" && backup.training.length) || backup.library.some((item) => libraryScope(item) !== scope)) {
    throw new HttpError(400, "本批记录必须属于同一类别，请按授权范围拆开提交。");
  }
  const count = backup.training.length + backup.library.length;
  if (count < 1 || count > maxRecords) throw new HttpError(400, "每次可追加 1–20 条记录。");
  return { scope: scopeNames[scope], ...await importBackup(principal.owner, backup) };
}

export function isRecordTool(name: unknown): name is typeof recordImportTool.name | typeof foodTool.name {
  return name === recordImportTool.name || name === foodTool.name;
}

export async function callRecordTool(principal: AgentPrincipal, name: typeof recordImportTool.name | typeof foodTool.name, args: unknown) {
  if (name === recordImportTool.name) return importAgentRecords(principal, recordImportInput.parse(args));
  requireScope(principal, "nutrition:write");
  const input = agentFoodWrite.parse(args);
  await verifyProfile(principal.owner, input.profileRef);
  return writeAgentData(principal.owner, name, input);
}
