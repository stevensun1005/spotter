import { z } from "zod";
import { requireAccount } from "@/server/account";
import { HttpError, json, readJsonBody } from "@/server/http";
import { backupSchema, dateBounds, scopeBackup, scopeNames, scopeSchema } from "@/features/data/model";
import { exportBackup, importBackup } from "@/features/data/server";
import { agentProfileRef, profileRefSchema } from "@/features/agent/profile";
import { agentWriteTools, isAgentWriteTool, writeAgentData } from "@/features/agent/writes";

export const dynamic = "force-dynamic";

const sections = ["training", "nutrition", "body", "templates"] as const;
const tools = [
  {
    name: "get_spotter_agent_profile",
    title: "核对训练搭子账号",
    description: "返回当前已连接训练搭子账号的说明编号。应与用户导出的个人 AI 写入说明一致，随后才能按用户要求读取或写入。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  ...agentWriteTools,
  {
    name: "read_spotter_records",
    title: "读取训练搭子记录",
    description: "读取当前登录账号的训练、饮食、身体或模板。可按起止日期筛选。每次最多返回 200 条。按用户指定的类别读取。",
    inputSchema: {
      type: "object", required: ["scope"], additionalProperties: false,
      properties: { scope: { type: "string", enum: sections }, from: { type: "string", format: "date" },
        to: { type: "string", format: "date" }, profileRef: { type: "string" }, offset: { type: "integer", minimum: 0 } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "import_spotter_records",
    title: "导入训练搭子记录",
    description: "向当前账号追加训练搭子备份中的个人记录，已有 ID 不覆盖。写入之前展示预览并取得用户同意。",
    inputSchema: {
      type: "object", required: ["scope", "confirmed", "backup"], additionalProperties: false,
      properties: { scope: { type: "string", enum: sections }, confirmed: { type: "boolean" }, profileRef: { type: "string" },
        backup: { type: "object", required: ["format", "version", "training", "library", "heart"],
          properties: { format: { const: "spotter-backup" }, version: { const: 1 },
            training: { type: "array", items: { type: "object" } }, library: { type: "array", items: { type: "object" } },
            heart: { type: "array", items: { type: "object" } } } } },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(),
  params: z.object({ name: z.string().optional(), arguments: z.unknown().optional() }).passthrough().optional(),
});
const perScope = scopeSchema.exclude(["all"]);
const readArgs = z.object({
  scope: perScope, from: z.string().optional(), to: z.string().optional(), profileRef: profileRefSchema.optional(), offset: z.number().int().min(0).max(50000).default(0),
}).strict();
const importArgs = z.object({ scope: perScope, confirmed: z.literal(true), backup: backupSchema, profileRef: profileRefSchema.optional() }).strict();
const directProfile = z.object({ profileRef: profileRefSchema });

function textResult(value: unknown, isError = false) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], isError };
}

async function verifyProfile(owner: string, expected?: string) {
  if (expected && expected !== await agentProfileRef(owner)) {
    throw new HttpError(403, "当前连接账号和个人说明不一致。请先切换到说明所属的训练搭子账号。");
  }
}

async function call(name: string | undefined, args: unknown) {
  const account = await requireAccount();
  if (name === "get_spotter_agent_profile") return textResult({ profileRef: await agentProfileRef(account.id) });
  if (isAgentWriteTool(name)) {
    await verifyProfile(account.id, directProfile.parse(args).profileRef);
    return textResult(await writeAgentData(account.id, name, args));
  }
  if (name === "read_spotter_records") {
    const query = readArgs.parse(args);
    await verifyProfile(account.id, query.profileRef);
    const bounds = dateBounds.parse(query);
    const file = await exportBackup(account.id, query.scope, bounds, false);
    const stream = [
      ...file.training.sort((a, b) => a.data.date.localeCompare(b.data.date) || a.id.localeCompare(b.id)).map((item) => ({ type: "training", item }) as const),
      ...file.library.map((item) => ({ type: "library", item }) as const),
    ];
    const selected = stream.slice(query.offset, query.offset + 200);
    file.training = selected.flatMap((row) => row.type === "training" ? [row.item] : []);
    file.library = selected.flatMap((row) => row.type === "library" ? [row.item] : []);
    return textResult({ backup: file, nextOffset: query.offset + 200 < stream.length ? query.offset + 200 : null });
  }
  if (name === "import_spotter_records") {
    const data = importArgs.parse(args);
    await verifyProfile(account.id, data.profileRef);
    const { training, library } = scopeBackup(data.backup, data.scope);
    const result = await importBackup(account.id, { ...data.backup, training, library, heart: [] });
    return textResult({ scope: scopeNames[data.scope], ...result });
  }
  return textResult("未找到这个工具。", true);
}

export async function POST(request: Request) {
  let rpc: z.infer<typeof requestSchema>;
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "需要 JSON 格式。");
    rpc = await readJsonBody(request, requestSchema, 500_000);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, 400);
  }
  const envelope = { jsonrpc: "2.0", id: rpc.id ?? null };
  const discover = { supportedVersions: ["2026-07-28"], capabilities: { tools: {} }, serverInfo: { name: "spotter", version: "1.0.0" } };
  if (rpc.method === "server/discover") return json({ ...envelope, result: discover });
  if (rpc.method === "tools/list") return json({ ...envelope, result: { tools } });
  if (rpc.method === "tools/call") {
    try { return json({ ...envelope, result: await call(rpc.params?.name, rpc.params?.arguments) }); }
    catch (error) {
      const message = error instanceof z.ZodError ? "请检查账号说明编号、记录内容、日期或确认字段。" :
        error instanceof HttpError ? error.message : "读取或写入失败，请重试。";
      return json({ ...envelope, result: textResult(message, true) });
    }
  }
  return json({ ...envelope, error: { code: -32601, message: "Method not found" } });
}
