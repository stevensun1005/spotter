import { z } from "zod";
import { agentPlanWrite } from "@/features/agent/write-model";
import { profileRefSchema } from "@/features/agent/profile";
import type { Plan } from "@/features/plans/model";

export const recordWriteScopes = {
  training: "training:write", nutrition: "nutrition:write", body: "body:write", templates: "templates:write",
} as const;
export const agentScopes = ["read:context", "plans:draft", "plans:write", ...Object.values(recordWriteScopes)] as const;
export type AgentScope = typeof agentScopes[number];
export const connectionCreate = z.object({
  action: z.literal("create"), name: z.string().trim().min(1).max(60),
  scopes: z.array(z.enum(agentScopes)).min(1).max(agentScopes.length).refine((v) => new Set(v).size === v.length),
  expiresInDays: z.number().int().min(1).max(90).default(30),
}).strict();
export const connectionMutation = z.union([connectionCreate, z.object({ action: z.literal("revoke"), id: z.string().uuid() }).strict()]);
export const stagePlansInput = agentPlanWrite.omit({ confirmed: true }).extend({
  requestId: z.string().uuid(), title: z.string().trim().min(1).max(100).optional(),
}).strict();
const revision = z.string().regex(/^[a-f0-9]{64}$/);
export const reviseDraftInput = agentPlanWrite.omit({ confirmed: true }).extend({ action: z.literal("revise"), draftId: z.string().uuid(), revision, title: z.string().trim().min(1).max(100).optional() }).strict();
export const commitDraftInput = z.object({ profileRef: profileRefSchema, draftId: z.string().uuid(), revision, confirmed: z.literal(true) }).strict();
export const contextInput = z.object({
  profileRef: profileRefSchema, query: z.string().trim().max(100).default(""),
  offset: z.number().int().min(0).max(50000).default(0), limit: z.number().int().min(1).max(100).default(50),
}).strict();
export type AgentPrincipal = { owner: string; scopes: readonly AgentScope[]; tokenId?: string };
export type AgentConnection = {
  id: string; name: string; scopes: AgentScope[]; createdAt: string; expiresAt: string;
  lastUsedAt: string | null; revokedAt: string | null;
};
export type CommitResult = { added: number; skipped: number; from: string; to: string; planIds: string[] };
export type AgentDraft = {
  id: string; title: string; plans: Plan[]; createdAt: string; expiresAt: string;
  status: "draft" | "committed"; result: CommitResult | null; revision: string;
};
