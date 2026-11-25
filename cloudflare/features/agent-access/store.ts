import { HttpError } from "@/server/http";
import { agentRecordId } from "@/features/agent/write-model";
import { agentProfileRef } from "@/features/agent/profile";
import { blocked, openSchedule, scheduleSchema } from "@/features/plans/schedule";
import { planSchema, type Plan } from "@/features/plans/model";
import type { AgentConnection, AgentDraft, AgentPrincipal, AgentScope, CommitResult } from "./model";

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
export const digest = async (text: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
export function requireScope(principal: AgentPrincipal, scope: AgentScope) {
  if (!principal.scopes.includes(scope)) throw new HttpError(403, "此 Agent 连接未获准执行这项操作，请在训练搭子的 Agent 连接设置检查权限范围。");
}
export async function verifyProfile(owner: string, expected: string) {
  if (expected !== await agentProfileRef(owner)) throw new HttpError(403, "账号标识与当前连接不一致，操作未执行。");
}

type ConnectionRow = { id: string; owner: string; name: string; scopes: string; created_at: string; expires_at: string; last_used_at: string | null; revoked_at: string | null };
const connection = (row: ConnectionRow): AgentConnection => ({ id: row.id, name: row.name, scopes: JSON.parse(row.scopes), createdAt: row.created_at, expiresAt: row.expires_at, lastUsedAt: row.last_used_at, revokedAt: row.revoked_at });
export async function listConnections(db: D1Database, owner: string) {
  const { results } = await db.prepare("SELECT id, owner, name, scopes, created_at, expires_at, last_used_at, revoked_at FROM agent_connections WHERE owner = ? ORDER BY created_at DESC LIMIT 100").bind(owner).all<ConnectionRow>();
  return results.map(connection);
}
export async function createConnection(db: D1Database, owner: string, input: { name: string; scopes: AgentScope[]; expiresInDays: number }, at = Date.now()) {
  const count = await db.prepare("SELECT COUNT(*) AS count FROM agent_connections WHERE owner = ? AND revoked_at IS NULL AND expires_at > ?").bind(owner, new Date(at).toISOString()).first<{ count: number }>();
  if ((count?.count ?? 0) >= 20) throw new HttpError(409, "最多保留 20 个有效 Agent 连接，请先撤销不用的连接。");
  const token = "spotter_agent_" + hex(crypto.getRandomValues(new Uint8Array(32)));
  const row = { id: crypto.randomUUID(), owner, name: input.name, scopes: JSON.stringify(input.scopes), created_at: new Date(at).toISOString(), expires_at: new Date(at + input.expiresInDays * 86_400_000).toISOString(), last_used_at: null, revoked_at: null };
  const issued = await db.prepare("INSERT INTO agent_connections (id, owner, name, token_hash, scopes, created_at, expires_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM agent_connections WHERE owner = ? AND revoked_at IS NULL AND expires_at > ?) < 20").bind(row.id, owner, row.name, await digest(token), row.scopes, row.created_at, row.expires_at, owner, row.created_at).run();
  if (!issued.meta.changes) throw new HttpError(409, "最多保留 20 个有效 Agent 连接，请先撤销不用的连接。");
  return { connection: connection(row), token };
}
export async function revokeConnection(db: D1Database, owner: string, id: string) {
  const result = await db.prepare("UPDATE agent_connections SET revoked_at = COALESCE(revoked_at, ?) WHERE owner = ? AND id = ?").bind(new Date().toISOString(), owner, id).run();
  if (!result.meta.changes) throw new HttpError(404, "找不到你的这项连接。");
  return { revoked: true };
}
export async function authenticateAgent(db: D1Database, request: Request, at = Date.now()): Promise<AgentPrincipal> {
  const raw = request.headers.get("authorization")?.match(/^Bearer (spotter_agent_[a-f0-9]{64})$/)?.[1];
  if (!raw) throw new HttpError(401, "需要有效的 Agent Bearer 令牌。");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "不接受来自其他网页来源的 Agent 请求。");
  const now = new Date(at).toISOString();
  const row = await db.prepare("SELECT id, owner, scopes FROM agent_connections WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?").bind(await digest(raw), now).first<{ id: string; owner: string; scopes: string }>();
  if (!row) throw new HttpError(401, "Agent 连接无效、已过期或已撤销。");
  const window = Math.floor(at / 60_000);
  const rate = await db.prepare("INSERT INTO agent_rate_windows (connection_id, window, requests) VALUES (?, ?, 1) ON CONFLICT(connection_id, window) DO UPDATE SET requests = requests + 1 RETURNING requests").bind(row.id, window).first<{ requests: number }>();
  if (!rate || rate.requests > 60) throw new HttpError(429, "请求过于频繁，请一分钟后再试。");
  await db.batch([
    db.prepare("UPDATE agent_connections SET last_used_at = ? WHERE id = ?").bind(now, row.id),
    db.prepare("DELETE FROM agent_rate_windows WHERE connection_id = ? AND window < ?").bind(row.id, window - 1),
  ]);
  return { owner: row.owner, scopes: JSON.parse(row.scopes), tokenId: row.id };
}

type DraftRow = { id: string; title: string; payload: string; created_at: string; expires_at: string; status: "draft" | "committed"; result: string | null; content_hash: string };
const draft = (row: DraftRow): AgentDraft => ({ id: row.id, title: row.title, plans: JSON.parse(row.payload), createdAt: row.created_at, expiresAt: row.expires_at, status: row.status, result: row.result ? JSON.parse(row.result) : null, revision: row.content_hash });
export async function listDrafts(db: D1Database, owner: string) {
  const { results } = await db.prepare("SELECT * FROM agent_plan_drafts WHERE owner = ? ORDER BY created_at DESC LIMIT 100").bind(owner).all<DraftRow>();
  return results.map(draft);
}
export async function readDraft(db: D1Database, owner: string, id: string) {
  const row = await db.prepare("SELECT * FROM agent_plan_drafts WHERE owner = ? AND id = ?").bind(owner, id).first<DraftRow>();
  if (!row) throw new HttpError(404, "找不到你的这份计划草稿。");
  return draft(row);
}
export async function stageDraft(db: D1Database, owner: string, input: { requestId: string; title?: string; plans: Plan[] }) {
  // Keep a reviewed draft stable even if the source template is edited later.
  const plans = input.plans.map(({ templateId: _templateId, ...plan }) => planSchema.parse({ ...plan, shared: false }));
  if (new Set(plans.map((plan) => JSON.stringify(plan))).size !== plans.length) throw new HttpError(400, "同一草稿不能包含重复计划，请保留一份后重试。");
  const payload = JSON.stringify(plans);
  const title = input.title ?? plans[0].title;
  const contentHash = await digest(JSON.stringify([title, plans]));
  const now = Date.now();
  await db.prepare("INSERT INTO agent_plan_drafts (owner, id, title, payload, content_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner, id) DO NOTHING").bind(owner, input.requestId, title, payload, contentHash, new Date(now).toISOString(), new Date(now + 30 * 86_400_000).toISOString()).run();
  const row = await db.prepare("SELECT * FROM agent_plan_drafts WHERE owner = ? AND id = ?").bind(owner, input.requestId).first<DraftRow>();
  if (!row || row.content_hash !== contentHash) throw new HttpError(409, "这次 requestId 已用于另一份内容，请为修改后的草稿生成新 requestId。");
  return draft(row);
}

export async function reviseDraft(db: D1Database, owner: string, input: { draftId: string; revision: string; title?: string; plans: Plan[] }) {
  const plans = input.plans.map(({ templateId: _templateId, ...plan }) => planSchema.parse({ ...plan, shared: false }));
  if (new Set(plans.map((plan) => JSON.stringify(plan))).size !== plans.length) throw new HttpError(400, "同一草稿不能包含重复计划，请保留一份后重试。");
  const previous = await readDraft(db, owner, input.draftId);
  const title = input.title ?? previous.title;
  const contentHash = await digest(JSON.stringify([title, plans]));
  const changed = await db.prepare("UPDATE agent_plan_drafts SET title = ?, payload = ?, content_hash = ? WHERE owner = ? AND id = ? AND status = 'draft' AND content_hash = ? AND expires_at > ?").bind(title, JSON.stringify(plans), contentHash, owner, input.draftId, input.revision, new Date().toISOString()).run();
  if (!changed.meta.changes) throw new HttpError(409, "草稿已保存、过期或在另一处修改，请刷新后重试。");
  return previewDraft(db, owner, input.draftId);
}

export async function previewDraft(db: D1Database, owner: string, id: string) {
  const saved = await readDraft(db, owner, id);
  const scheduleRow = await db.prepare("SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'").bind(owner).first<{ payload: string }>();
  const schedule = scheduleRow ? scheduleSchema.parse(JSON.parse(scheduleRow.payload).values) : openSchedule;
  const ids = await Promise.all(saved.plans.map((plan) => agentRecordId("plan", plan)));
  const items = await Promise.all(saved.plans.map(async (plan, index) => {
    const existing = await db.prepare("SELECT kind, payload FROM entries WHERE owner = ? AND id = ?").bind(owner, ids[index]).first<{ kind: string; payload: string }>();
    const duplicate = await db.prepare("SELECT 1 AS found FROM entries WHERE owner = ? AND kind = 'plan' AND payload = ? LIMIT 1").bind(owner, JSON.stringify(plan)).first<{ found: number }>();
    const conflict = blocked(schedule, plan.date) ? "rest-day" : existing && (existing.kind !== "plan" || existing.payload !== JSON.stringify(plan)) ? "protected-record" : null;
    return { id: ids[index], title: plan.title, date: plan.date, status: conflict ? "blocked" : existing || duplicate ? "existing" : "new", conflict };
  }));
  return { ...saved, preview: items, blocked: items.filter((item) => item.status === "blocked").length, willAdd: items.filter((item) => item.status === "new").length };
}

export async function commitDraft(db: D1Database, owner: string, id: string, revision: string): Promise<CommitResult> {
  const saved = await readDraft(db, owner, id);
  if (saved.revision !== revision) throw new HttpError(409, "草稿内容已变化，请重新预览后确认。");
  if (saved.status === "committed" && saved.result) return saved.result;
  if (saved.expiresAt <= new Date().toISOString()) throw new HttpError(409, "计划草稿已过期，请重新起草并预览。");
  const preview = await previewDraft(db, owner, id);
  if (preview.blocked) throw new HttpError(409, "草稿包含休息日或已变更记录，未写入日历。请调整后重新起草。");
  const plans = saved.plans;
  const ids = preview.preview.map((item) => item.id);
  const incoming = JSON.stringify(plans.map((plan, index) => ({ id: ids[index], payload: JSON.stringify(plan) })));
  const now = new Date().toISOString();
  const scheduleSnapshot = await db.prepare("SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'").bind(owner).first<{ payload: string }>();
  const currentSchedule = scheduleSnapshot ? scheduleSchema.parse(JSON.parse(scheduleSnapshot.payload).values) : openSchedule;
  if (plans.some((plan) => blocked(currentSchedule, plan.date))) throw new HttpError(409, "训练日期的休息设置已变化，请重新预览。");
  // The same guard is evaluated inside every statement in one D1 transaction. A race
  // cannot overwrite a changed plan or convert a completed/in-progress record.
  const eligible = "EXISTS (SELECT 1 FROM agent_plan_drafts d WHERE d.owner = ? AND d.id = ? AND d.status = 'draft' AND d.expires_at > ? AND d.content_hash = ?) AND NOT EXISTS (SELECT 1 FROM json_each(?) i JOIN entries e ON e.owner = ? AND e.id = json_extract(i.value, '$.id') WHERE e.kind != 'plan' OR e.payload != json_extract(i.value, '$.payload')) AND COALESCE((SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'), '') = ?";
  const guard = () => [owner, id, now, revision, incoming, owner, owner, scheduleSnapshot?.payload ?? ""];
  const operations: D1PreparedStatement[] = [];
  for (const [index, plan] of plans.entries()) {
    const payload = JSON.stringify(plan);
    operations.push(db.prepare("INSERT INTO agent_draft_items (owner, draft_id, plan_id, was_added) SELECT ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM entries WHERE owner = ? AND (id = ? OR (kind = 'plan' AND payload = ?))) THEN 0 ELSE 1 END WHERE " + eligible + " ON CONFLICT(owner, draft_id, plan_id) DO NOTHING").bind(owner, id, ids[index], owner, ids[index], payload, ...guard()));
    operations.push(db.prepare("INSERT INTO entries (owner, id, kind, payload, updated) SELECT ?, ?, 'plan', ?, ? WHERE " + eligible + " AND EXISTS (SELECT 1 FROM agent_draft_items WHERE owner = ? AND draft_id = ? AND plan_id = ? AND was_added = 1) ON CONFLICT(owner, id) DO NOTHING").bind(owner, ids[index], payload, now, ...guard(), owner, id, ids[index]));
  }
  const dates = plans.map((plan) => plan.date).sort();
  operations.push(db.prepare("UPDATE agent_plan_drafts SET status = 'committed', result = json_object('added', COALESCE((SELECT SUM(was_added) FROM agent_draft_items WHERE owner = ? AND draft_id = ?), 0), 'skipped', ? - COALESCE((SELECT SUM(was_added) FROM agent_draft_items WHERE owner = ? AND draft_id = ?), 0), 'from', ?, 'to', ?, 'planIds', json(?)) WHERE owner = ? AND id = ? AND " + eligible).bind(owner, id, plans.length, owner, id, dates[0], dates[dates.length - 1], JSON.stringify(ids), owner, id, ...guard()));
  await db.batch(operations);
  const committed = await readDraft(db, owner, id);
  if (!committed.result || committed.status !== "committed") throw new HttpError(409, "计划在另一处已有变更，未覆盖记录。请重新预览。");
  return committed.result;
}
