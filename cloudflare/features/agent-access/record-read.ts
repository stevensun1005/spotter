import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { dateSchema, asDate, offsetDate } from "@/shared/dates";
import { HttpError } from "@/server/http";
import { libraryItem } from "@/features/library/model";
import { planSchema } from "@/features/plans/model";
import { sessionSchema } from "@/features/training/model";
import { recordReadScopes, type AgentPrincipal } from "./model";
import { requireScope, verifyProfile } from "./store";

const categories = ["training", "nutrition", "templates"] as const;
type Category = typeof categories[number];

export const recordReadInput = z.object({
  profileRef: profileRefSchema,
  scope: z.enum(categories),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  offset: z.number().int().min(0).max(50_000).default(0),
  limit: z.number().int().min(1).max(50).default(20),
}).strict().refine(({ from, to }) => {
  if (!from && !to) return true;
  return Boolean(from && to && from <= to && Date.parse(to) - Date.parse(from) <= 365 * 86_400_000);
}, "请选择最多 366 天的有效日期范围。");

export const recordReadProperties = {
  profileRef: { type: "string", pattern: "^spotter_[a-f0-9]{32}$" },
  scope: { type: "string", enum: categories },
  from: { type: "string", format: "date", description: "Start date inclusive. Supply both dates, or omit both for the latest 30 days." },
  to: { type: "string", format: "date", description: "End date inclusive, up to 366 days per range." },
  offset: { type: "integer", minimum: 0, maximum: 50_000, default: 0 },
  limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
} as const;

const tool = {
  name: "read_spotter_records",
  title: "读取我的记录",
  description: "读取当前账号授权的训练、饮食或个人模板。每次一类，按 nextOffset 翻页。训练包含计划和完成记录，饮食包含餐食和饮水。",
  inputSchema: { type: "object", additionalProperties: false, required: ["profileRef", "scope"], properties: recordReadProperties },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} as const;
export const recordReadToolName = tool.name;

export function recordReaderTools(principal: AgentPrincipal) {
  const scopes = categories.filter((scope) => principal.scopes.includes(recordReadScopes[scope]));
  return scopes.length ? [{ ...tool, inputSchema: { ...tool.inputSchema, properties: {
    ...tool.inputSchema.properties, scope: { type: "string", enum: scopes },
  } } }] : [];
}

type Row = { id: string; kind: string; payload: string };

function project(row: Row, scope: Category) {
  const payload = JSON.parse(row.payload);
  if (scope === "training") {
    if (row.kind === "plan") {
      const plan = planSchema.safeParse(payload);
      return plan.success ? { id: row.id, kind: row.kind, data: plan.data } : null;
    }
    const workout = sessionSchema.safeParse(payload);
    if (!workout.success) return null;
    const { proteinProduct: _recipe, proteinShake: _drink, ...data } = workout.data;
    return { id: row.id, kind: row.kind, data };
  }
  const record = libraryItem.safeParse(payload);
  if (!record.success) return null;
  if (scope === "templates" && record.data.kind === "template") return record.data;
  if (record.data.kind !== "nutrition") return null;
  const { kind, id, date, entry } = record.data;
  if (entry.type !== "meal" && entry.type !== "water") return null;
  return { kind, id, date, entry };
}

export async function readAgentRecords(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof recordReadInput>) {
  const { scope, profileRef, offset, limit } = input;
  requireScope(principal, recordReadScopes[scope]);
  await verifyProfile(principal.owner, profileRef);
  const to = input.to ?? asDate(Date.now(), "UTC");
  const from = input.from ?? offsetDate(to, -29);

  const owner = principal.owner;
  const read = scope === "training"
    ? db.prepare("SELECT id, kind, payload FROM entries WHERE owner = ? AND kind IN ('plan', 'log') " +
      "AND json_extract(payload, '$.date') BETWEEN ? AND ? ORDER BY json_extract(payload, '$.date') DESC, id LIMIT ? OFFSET ?")
      .bind(owner, from, to, limit + 1, offset)
    : scope === "templates"
      ? db.prepare("SELECT id, kind, payload FROM personal_library WHERE owner = ? AND kind = 'template' ORDER BY updated DESC, id LIMIT ? OFFSET ?")
        .bind(owner, limit + 1, offset)
      : db.prepare("SELECT id, kind, payload FROM personal_library WHERE owner = ? AND kind = 'nutrition' " +
        "AND day BETWEEN ? AND ? AND json_extract(payload, '$.entry.type') IN (?, ?) ORDER BY day DESC, id LIMIT ? OFFSET ?")
        .bind(owner, from, to, "meal", "water", limit + 1, offset);
  const { results } = await read.all<Row>();
  return { profileRef, scope, ...(scope === "templates" ? {} : { from, to }),
    records: results.slice(0, limit).flatMap((row) => {
      const data = project(row, scope);
      return data ? [data] : [];
    }),
    nextOffset: results.length > limit && offset + limit <= 50_000 ? offset + limit : null,
  };
}
