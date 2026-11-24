import { z } from "zod";
import { HttpError, json, readJsonBody } from "@/server/http";
import { agentApi, agentDatabase, requestPrincipal } from "@/features/agent-access/http";
import { agentIdentity, callPlanningTool, isPlanningTool, toolsFor } from "@/features/agent-access/tools";
import { callRecordTool, isRecordTool, recordToolsFor } from "@/features/agent-access/records";

export const dynamic = "force-dynamic";
const rpcSchema = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.record(z.unknown()).optional(), _meta: z.record(z.unknown()).optional() });
const toolResult = (value: unknown, isError = false) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], isError });
export const POST = agentApi(async (request) => {
  const principal = await requestPrincipal(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "需要 application/json。");
  const parsed = rpcSchema.safeParse(await readJsonBody(request, z.unknown(), 1_500_000));
  if (!parsed.success) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, 400);
  const rpc = parsed.data;
  if (rpc.id === undefined && rpc.method.startsWith("notifications/")) return new Response(null, { status: 202 });
  if (rpc.id === undefined) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Requests require an id" } }, 400);
  const envelope = { jsonrpc: "2.0", id: rpc.id };
  const serverInfo = { name: "spotter-agent", version: "1.0.0" };
  if (rpc.method === "server/discover") return json({ ...envelope, result: { serverInfo, supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"], capabilities: { tools: {} } } });
  if (rpc.method === "initialize") {
    const requested = rpc.params?.protocolVersion;
    return json({ ...envelope, result: { protocolVersion: ["2025-11-25", "2025-06-18", "2025-03-26"].includes(String(requested)) ? requested : "2025-11-25", capabilities: { tools: {} }, serverInfo } });
  }
  if (rpc.method === "ping") return json({ ...envelope, result: {} });
  if (rpc.method === "tools/list") return json({ ...envelope, result: { tools: [{ name: "get_spotter_agent_profile", description: "Read the account reference and granted scopes for this connection.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false } }, ...toolsFor(principal), ...recordToolsFor(principal)] } });
  if (rpc.method === "tools/call") {
    try {
      const name = rpc.params?.name;
      if (name === "get_spotter_agent_profile") return json({ ...envelope, result: toolResult(await agentIdentity(principal)) });
      if (isRecordTool(name)) return json({ ...envelope, result: toolResult(await callRecordTool(principal, name, rpc.params?.arguments)) });
      if (!isPlanningTool(name)) return json({ ...envelope, error: { code: -32602, message: "Unknown tool" } });
      return json({ ...envelope, result: toolResult(await callPlanningTool(agentDatabase(), principal, name, rpc.params?.arguments)) });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : error instanceof z.ZodError ? "请检查账号标识、记录结构、版本和确认字段。" : "操作未完成，请稍后重试。";
      return json({ ...envelope, result: toolResult(message, true) });
    }
  }
  return json({ ...envelope, error: { code: -32601, message: "Method not found" } });
});
export const GET = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
