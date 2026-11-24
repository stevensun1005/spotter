import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireAccount } from "@/server/account";
import { HttpError, json, readJson, readJsonBody } from "@/server/http";
import { agentScopes, type AgentPrincipal } from "./model";
import { authenticateAgent } from "./store";

export function agentDatabase() {
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return env.DB;
}
export function agentApi(handler: (request: Request) => Promise<Response> | Response) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof z.ZodError) return json({ error: "请检查账号标识、权限、日期、计划内容或确认字段。" }, 400);
      // Do not log request bodies, credentials, or database errors containing personal data.
      return json({ error: "Agent 操作暂时未完成，请稍后重试。" }, 500);
    }
  };
}
export async function requestPrincipal(request: Request, allowBrowser = false): Promise<AgentPrincipal> {
  if (request.headers.has("authorization")) return authenticateAgent(agentDatabase(), request);
  if (!allowBrowser) throw new HttpError(401, "需要有效的 Agent Bearer 令牌。");
  const { id } = await requireAccount();
  return { owner: id, scopes: agentScopes };
}
export async function agentBody<T>(request: Request, schema: z.ZodType<T>, principal: AgentPrincipal, limit = 500_000) {
  if (!principal.tokenId) return readJson(request, schema, limit);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "需要 application/json。");
  return readJsonBody(request, schema, limit);
}
