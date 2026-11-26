import { z } from "zod";
import { profileRefSchema } from "@/features/agent/profile";
import { libraryItem, type LibraryItem } from "@/features/library/model";
import { removeTemplateRevision, updateTemplateRevision } from "@/features/library/server";
import { planMoveSchema, planSchema } from "@/features/plans/model";
import { nextRevision, planRevisionSchema } from "@/features/plans/schedule";
import { withoutTemplateLink } from "@/features/plans/template-link";
import { HttpError } from "@/server/http";
import { loadAgentExerciseLibrary } from "./exercise-library";
import type { AgentPrincipal } from "./model";
import { requireScope, verifyProfile } from "./store";
import { agentPlanJsonSchema } from "./tools";

const templateChange = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("update"), title: z.string().trim().min(1).max(100).optional(), exercises: z.array(planMoveSchema).max(30).optional() }).strict(),
  z.object({ kind: z.literal("delete") }).strict(),
]).refine((change) => change.kind === "delete" || change.title !== undefined || change.exercises !== undefined);

export const templateChangePreviewInput = z.object({
  profileRef: profileRefSchema, templateId: z.string().uuid(), revision: planRevisionSchema, change: templateChange,
}).strict();

export const templateChangeCommitInput = z.object({
  profileRef: profileRefSchema, previewToken: z.string().uuid(), confirmed: z.literal(true),
}).strict();

export const templateChangeInput = z.discriminatedUnion("action", [
  templateChangePreviewInput.extend({ action: z.literal("preview") }),
  templateChangeCommitInput.extend({ action: z.literal("commit") }),
]);

const profile = { type: "string", pattern: "^spotter_[a-f0-9]{32}$" } as const;
const uuid = { type: "string", format: "uuid" } as const;
const previewSchema = {
  type: "object", additionalProperties: false, required: ["profileRef", "templateId", "revision", "change"], properties: {
    profileRef: profile, templateId: uuid, revision: { type: "string", minLength: 1, maxLength: 64 },
    change: { oneOf: [
      { type: "object", additionalProperties: false, required: ["kind"], anyOf: [{ required: ["title"] }, { required: ["exercises"] }], properties: {
        kind: { type: "string", const: "update" }, title: { type: "string", minLength: 1, maxLength: 100 },
        exercises: { ...agentPlanJsonSchema.properties.exercises, minItems: 0, description: "Complete replacement list in the desired order" },
      } },
      { type: "object", additionalProperties: false, required: ["kind"], properties: { kind: { type: "string", const: "delete" } } },
    ] },
  },
} as const;
const commitSchema = {
  type: "object", additionalProperties: false, required: ["profileRef", "previewToken", "confirmed"], properties: {
    profileRef: profile, previewToken: uuid, confirmed: { type: "boolean", const: true },
  },
} as const;

export const templateChangeRequestSchema = { oneOf: [
  { ...previewSchema, required: ["action", ...previewSchema.required], properties: { action: { type: "string", const: "preview" }, ...previewSchema.properties } },
  { ...commitSchema, required: ["action", ...commitSchema.required], properties: { action: { type: "string", const: "commit" }, ...commitSchema.properties } },
] } as const;

export const templateChangePreviewTool = {
  name: "preview_spotter_template_change",
  title: "预览私有训练模板变更",
  description: "从 read_spotter_records 的 templates 类别取得模板 ID 和 revision。预览改名、替换完整动作列表或删除模板。替换动作前须用 read_spotter_planning_context 查找完全相同的已有动作并复用。向用户展示修改前后及关联计划影响，等待明确确认。",
  inputSchema: previewSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
} as const;
export const templateChangeCommitTool = {
  name: "commit_spotter_template_change",
  title: "应用已确认的训练模板变更",
  description: "仅在用户明确确认此预览后，提交相同 previewToken 和 confirmed:true。改变模板动作时，跟随模板动作的计划会使用新版；删除会保留已排训练并解除关联。重试沿用相同令牌，不能覆盖后来的改动。",
  inputSchema: commitSchema,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
} as const;

type Template = Extract<LibraryItem, { kind: "template" }>;
type Receipt = { templateId: string; revision: string | null; status: "updated" | "deleted" };
type ChangeRow = { template_id: string; template_revision: string; next_payload: string | null; expires_at: string; result: string | null; template_payload: string | null };
const expired = () => new HttpError(409, "模板已变更或预览已过期，请刷新后重新预览确认。");

async function authorizedConnection(principal: AgentPrincipal, profileRef: string) {
  requireScope(principal, "templates:manage");
  await verifyProfile(principal.owner, profileRef);
  if (!principal.tokenId) throw new HttpError(401, "需要有效的 Agent Bearer 令牌。");
  return principal.tokenId;
}

function savedTemplate(payload: string, id: string): Template {
  const item = libraryItem.parse(JSON.parse(payload));
  if (item.kind !== "template" || item.id !== id) throw new HttpError(409, "模板内容已变更，请刷新后重试。");
  return item;
}

export async function previewAgentTemplateChange(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof templateChangePreviewInput>) {
  const connectionId = await authorizedConnection(principal, input.profileRef);
  const { templateId, revision, change } = input;
  const { owner } = principal;
  const current = await db.prepare("SELECT payload, updated FROM personal_library WHERE owner=? AND kind='template' AND id=?")
    .bind(owner, templateId).first<{ payload: string; updated: string }>();
  if (!current) throw new HttpError(404, "找不到你的这份训练模板。");
  if (current.updated !== revision) throw expired();

  const before = savedTemplate(current.payload, templateId).plan;
  let after: typeof before | null = null;
  if (change.kind === "update") {
    let exercises = change.exercises ?? before.exercises;
    if (change.exercises?.length) {
      requireScope(principal, "read:context");
      exercises = (await loadAgentExerciseLibrary(db, owner)).moves(exercises);
    }
    after = withoutTemplateLink(planSchema.parse({ ...before, title: change.title ?? before.title, exercises }));
  }
  if (after && JSON.stringify(after) === JSON.stringify(before)) throw new HttpError(400, "预览内容与当前模板相同。");
  const affected = await db.prepare(
    "SELECT COUNT(*) AS linkedPlans, COALESCE(SUM(CASE WHEN json_extract(payload, '$.ownExercises') = 1 THEN 0 ELSE 1 END), 0) AS followsTemplateExercises " +
    "FROM entries WHERE owner=? AND kind='plan' AND json_extract(payload, '$.templateId')=?"
  ).bind(owner, templateId).first<{ linkedPlans: number; followsTemplateExercises: number }>();
  const previewToken = crypto.randomUUID();
  const time = Date.now();
  const now = new Date(time).toISOString();
  const expiresAt = new Date(time + 15 * 60_000).toISOString();
  const nextPayload = after === null ? null : JSON.stringify({ kind: "template", id: templateId, plan: after } satisfies Template);
  const [, staged] = await db.batch([
    db.prepare("DELETE FROM agent_template_changes WHERE connection_id=? AND expires_at<=?").bind(connectionId, now),
    db.prepare("INSERT INTO agent_template_changes (id, owner, connection_id, template_id, template_revision, next_payload, expires_at) " +
      "SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM personal_library WHERE owner=? AND kind='template' AND id=? AND updated=?)")
      .bind(previewToken, owner, connectionId, templateId, revision, nextPayload, expiresAt, owner, templateId, revision),
  ]);
  if (!staged?.meta.changes) throw expired();
  const linkedPlanEffect = after === null ? "detach-and-keep"
    : JSON.stringify(after.exercises) !== JSON.stringify(before.exercises) ? "follow-template-unless-customized" : "none";
  return { templateId, revision, change: change.kind, before, after, previewToken, expiresAt,
    linkedPlans: affected?.linkedPlans ?? 0, followsTemplateExercises: affected?.followsTemplateExercises ?? 0, linkedPlanEffect };
}

export async function commitAgentTemplateChange(db: D1Database, principal: AgentPrincipal, input: z.infer<typeof templateChangeCommitInput>): Promise<Receipt> {
  const connectionId = await authorizedConnection(principal, input.profileRef);
  const { owner } = principal;
  const { previewToken } = input;
  const query = () => db.prepare(
    "SELECT change.template_id, change.template_revision, change.next_payload, change.expires_at, change.result, source.payload AS template_payload " +
    "FROM agent_template_changes change LEFT JOIN personal_library source ON source.owner=change.owner AND source.kind='template' " +
    "AND source.id=change.template_id AND source.updated=change.template_revision WHERE change.id=? AND change.owner=? AND change.connection_id=?"
  )
    .bind(previewToken, owner, connectionId);
  const saved = await query().first<ChangeRow>();
  if (!saved) throw new HttpError(404, "找不到这次模板预览。");
  const time = Date.now();
  const now = new Date(time).toISOString();
  if (saved.expires_at <= now) throw expired();
  if (saved.result) return JSON.parse(saved.result) as Receipt;
  if (saved.template_payload === null) throw expired();

  const id = saved.template_id;
  const revision = saved.template_revision;
  const updated = nextRevision(now, [revision]);
  const item = saved.next_payload === null ? null : savedTemplate(saved.next_payload, id);
  if (item?.plan.exercises.length &&
      JSON.stringify(item.plan.exercises) !== JSON.stringify(savedTemplate(saved.template_payload, id).plan.exercises)) {
    requireScope(principal, "read:context");
    const currentExercises = (await loadAgentExerciseLibrary(db, owner)).moves(item.plan.exercises);
    if (JSON.stringify(currentExercises) !== JSON.stringify(item.plan.exercises)) {
      throw new HttpError(409, "动作库里的匹配已变更，请重新预览模板并确认。");
    }
  }
  const receipt: Receipt = { templateId: id, revision: item ? updated : null, status: item ? "updated" : "deleted" };
  const key = crypto.randomUUID();
  const guard = {
    condition: "EXISTS (SELECT 1 FROM agent_template_changes WHERE id=? AND owner=? AND connection_id=? AND commit_key=?)",
    values: [previewToken, owner, connectionId, key],
  };
  const writes = item ? [updateTemplateRevision(db, owner, item, revision, updated, guard)]
    : removeTemplateRevision(db, owner, id, revision, updated, guard);

  // Claim the receipt only while the exact template revision and connection are still valid.
  // The uniquely guarded mutations and the receipt succeed or roll back in one D1 transaction.
  const [claimed] = await db.batch([
    db.prepare("UPDATE agent_template_changes SET result=?, commit_key=?, expires_at=?, next_payload=NULL " +
      "WHERE id=? AND owner=? AND connection_id=? AND result IS NULL AND expires_at>? " +
      "AND EXISTS (SELECT 1 FROM personal_library WHERE owner=? AND kind='template' AND id=? AND updated=?) " +
      "AND EXISTS (SELECT 1 FROM agent_connections WHERE id=? AND owner=? AND revoked_at IS NULL AND expires_at>?)")
      .bind(JSON.stringify(receipt), key, new Date(time + 24 * 60 * 60_000).toISOString(), previewToken, owner, connectionId, now,
        owner, id, revision, connectionId, owner, now),
    ...writes,
  ]);
  if (claimed?.meta.changes) return receipt;
  const latest = await query().first<ChangeRow>();
  if (latest?.result && latest.expires_at > now) return JSON.parse(latest.result) as Receipt;
  throw expired();
}
