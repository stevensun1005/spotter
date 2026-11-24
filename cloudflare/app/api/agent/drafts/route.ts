import { z } from "zod";
import { HttpError, json } from "@/server/http";
import { reviseDraftInput, stagePlansInput } from "@/features/agent-access/model";
import { listDrafts, previewDraft, requireScope, reviseDraft, stageDraft, verifyProfile } from "@/features/agent-access/store";
import { agentApi, agentBody, agentDatabase, requestPrincipal } from "@/features/agent-access/http";

export const dynamic = "force-dynamic";
export const GET = agentApi(async (request) => {
  const principal = await requestPrincipal(request, true);
  if (principal.tokenId && !principal.scopes.some((scope) => scope === "plans:draft" || scope === "plans:write")) throw new HttpError(403, "此连接没有计划草稿权限。");
  const id = new URL(request.url).searchParams.get("id");
  return json(id ? await previewDraft(agentDatabase(), principal.owner, z.string().uuid().parse(id)) : { drafts: await listDrafts(agentDatabase(), principal.owner) });
});
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request, true);
  requireScope(principal, "plans:draft");
  const input = z.union([stagePlansInput, reviseDraftInput]).parse(await agentBody(request, z.union([stagePlansInput, reviseDraftInput]), principal));
  await verifyProfile(principal.owner, input.profileRef);
  if ("action" in input) {
    if (principal.tokenId) throw new HttpError(403, "请在网页编辑已有草稿；Agent 可用新 requestId 提交修改后的草稿。");
    return json(await reviseDraft(agentDatabase(), principal.owner, input));
  }
  const saved = await stageDraft(agentDatabase(), principal.owner, input);
  return json(await previewDraft(agentDatabase(), principal.owner, saved.id));
});
