import { env } from "cloudflare:workers";
import { HttpError } from "@/server/http";
import { planSchema, type Plan } from "@/features/plans/model";
import { blocked, openSchedule, scheduleSchema } from "@/features/plans/schedule";
import { coachingRulesSchema, emptyCoachingRules, programSchema, programStatuses,
  type CoachingRules, type CoachingRulesRecord, type Program, type ProgramCommitResult, type ProgramPreview,
  type ProgramPreviewItem, type ProgramRecord, type ProgramSession, type ProgramStatus } from "./model";

function database(provided?: D1Database) {
  const db = provided ?? env.DB;
  if (!db) throw new HttpError(503, "云端数据库暂不可用。");
  return db;
}
type StoredProgram = { payload: string; revision: string; updated_at: string; scheduled_at: string | null };
type StoredEntry = { id: string; kind: string; payload: string; updated: string };
type StoredLink = { session_id: string; payload: string };
const changed = () => new HttpError(409, "周期或相关计划已在另一处更新，请刷新、重新预览后再保存。");
function record(row: StoredProgram): ProgramRecord {
  return { ...programSchema.parse(JSON.parse(row.payload)), revision: row.revision, updatedAt: row.updated_at, scheduledAt: row.scheduled_at };
}

export async function readPrograms(owner: string, provided?: D1Database): Promise<ProgramRecord[]> {
  const { results } = await database(provided).prepare("SELECT payload, revision, updated_at, scheduled_at FROM training_programs WHERE owner = ? ORDER BY updated_at DESC LIMIT 100").bind(owner).all<StoredProgram>();
  return results.map(record);
}
export async function readProgram(owner: string, id: string, provided?: D1Database): Promise<ProgramRecord> {
  const row = await database(provided).prepare("SELECT payload, revision, updated_at, scheduled_at FROM training_programs WHERE owner = ? AND id = ?").bind(owner, id).first<StoredProgram>();
  if (!row) throw new HttpError(404, "找不到你的训练周期。");
  return record(row);
}
export async function readRules(owner: string, provided?: D1Database): Promise<CoachingRulesRecord> {
  const row = await database(provided).prepare("SELECT payload, revision FROM program_rules WHERE owner = ?").bind(owner).first<{ payload: string; revision: string }>();
  return row ? { rules: coachingRulesSchema.parse(JSON.parse(row.payload)), revision: row.revision } : { rules: { ...emptyCoachingRules, avoid: [] }, revision: null };
}
export async function saveRules(owner: string, value: CoachingRules, expected: string | null, provided?: D1Database) {
  const rules = coachingRulesSchema.parse(value);
  const revision = crypto.randomUUID();
  const result = await database(provided).prepare(
    "INSERT INTO program_rules (owner, payload, revision, updated_at) SELECT ?, ?, ?, ? " +
    "WHERE ? IS NULL OR EXISTS (SELECT 1 FROM program_rules WHERE owner = ? AND revision = ?) " +
    "ON CONFLICT(owner) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at WHERE program_rules.revision = ?"
  ).bind(owner, JSON.stringify(rules), revision, new Date().toISOString(), expected, owner, expected, expected).run();
  if (!result.meta.changes) throw changed();
  return { rules, revision };
}
export async function saveProgram(owner: string, value: Program, expected: string | null, provided?: D1Database) {
  const program = programSchema.parse(value);
  const revision = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await database(provided).prepare(
    "INSERT INTO training_programs (owner, id, payload, revision, updated_at) SELECT ?, ?, ?, ?, ? " +
    "WHERE ? IS NULL OR EXISTS (SELECT 1 FROM training_programs WHERE owner = ? AND id = ? AND revision = ?) " +
    "ON CONFLICT(owner, id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at WHERE training_programs.revision = ?"
  ).bind(owner, program.id, JSON.stringify(program), revision, now, expected, owner, program.id, expected, expected).run();
  if (!result.meta.changes) throw changed();
  return readProgram(owner, program.id, provided);
}
export async function removeProgram(owner: string, id: string, expected: string, provided?: D1Database) {
  const result = await database(provided).prepare("DELETE FROM training_programs WHERE owner = ? AND id = ? AND revision = ?").bind(owner, id, expected).run();
  if (!result.meta.changes) throw changed();
  // The container and private links are removed. Calendar plans and training history are deliberately retained.
  return { removed: true as const };
}

function desiredPlan(program: Program, session: ProgramSession): Plan {
  const { templateId: _template, ...snapshot } = session.plan;
  return planSchema.parse({ ...snapshot, shared: false, programId: program.id, programSessionId: session.id,
    phaseId: session.phaseId, week: session.week, day: session.day });
}
const related = "e.owner = ? AND (e.id IN (SELECT value FROM json_each(?)) OR (e.kind IN ('draft','log') AND json_extract(e.payload, '$.planId') IN (SELECT value FROM json_each(?))))";
async function state(owner: string, program: ProgramRecord, provided: D1Database) {
  const ids = JSON.stringify(program.sessions.map(({ id }) => id));
  const [entries, links, scheduleRow] = await Promise.all([
    provided.prepare("SELECT e.id, e.kind, e.payload, e.updated FROM entries e WHERE " + related + " ORDER BY e.id").bind(owner, ids, ids).all<StoredEntry>(),
    provided.prepare("SELECT session_id, payload FROM program_plan_links WHERE owner = ? AND program_id = ? AND session_id IN (SELECT value FROM json_each(?)) ORDER BY session_id").bind(owner, program.id, ids).all<StoredLink>(),
    provided.prepare("SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'").bind(owner).first<{ payload: string }>(),
  ]);
  return { entries: entries.results, links: links.results, schedulePayload: scheduleRow?.payload ?? null,
    schedule: scheduleRow ? scheduleSchema.parse(JSON.parse(scheduleRow.payload).values) : openSchedule, ids };
}
type ProgramState = Awaited<ReturnType<typeof state>>;
function previewItems(program: ProgramRecord, current: ProgramState): ProgramPreviewItem[] {
  const entries = new Map(current.entries.map((entry) => [entry.id, entry]));
  const links = new Map(current.links.map((link) => [link.session_id, link.payload]));
  const active = new Set(current.entries.filter(({ kind }) => kind === "draft" || kind === "log").map(({ payload }) => JSON.parse(payload).planId));
  return [...program.sessions].sort((a, b) => a.week - b.week || a.day - b.day).map((session) => {
    const existing = entries.get(session.id);
    let status: ProgramStatus;
    let reason: string;
    if (active.has(session.id) || existing?.kind === "draft" || existing?.kind === "log") {
      status = "protected"; reason = "已有进行中或已完成训练，保持原记录。";
    } else if (existing && existing.kind !== "plan") {
      status = "deleted"; reason = "此编号已删除或用于其他记录，不自动恢复。";
    } else if (blocked(current.schedule, session.plan.date)) {
      status = "blocked"; reason = "该日期已设为不安排训练。";
    } else if (!existing) {
      status = "new"; reason = "将新增到日历。";
    } else {
      const parsed = planSchema.safeParse(JSON.parse(existing.payload));
      const canonical = parsed.success ? JSON.stringify(parsed.data) : null;
      if (!links.has(session.id) || canonical !== links.get(session.id)) {
        status = "custom"; reason = "日历计划已独立编辑，保留自定义内容。";
      } else if (canonical === JSON.stringify(desiredPlan(program, session))) {
        status = "unchanged"; reason = "内容相同，不重复保存。";
      } else {
        status = "update"; reason = "更新尚未开始且未独立修改的计划。";
      }
    }
    return { id: session.id, title: session.plan.title, date: session.plan.date, week: session.week, day: session.day, status, reason };
  });
}
function entrySnapshot(current: ProgramState) {
  return current.entries.map(({ id, kind, updated, payload }) => ({ id, kind, updated, payload: kind === "plan" ? payload : null }));
}
async function previewRecordWithState(owner: string, program: ProgramRecord, db: D1Database) {
  const { id, revision } = program;
  const current = await state(owner, program, db);
  const items = previewItems(program, current);
  const serialized = JSON.stringify([program.id, revision, entrySnapshot(current), current.links, current.schedulePayload]);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized)));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const counts = Object.fromEntries(programStatuses.map((status) => [status, items.filter((item) => item.status === status).length])) as ProgramPreview["counts"];
  return { program, current, preview: { programId: id, revision, token, items, counts } satisfies ProgramPreview };
}
async function previewWithState(owner: string, id: string, revision: string, db: D1Database) {
  const program = await readProgram(owner, id, db);
  if (program.revision !== revision) throw changed();
  return previewRecordWithState(owner, program, db);
}
export async function previewProgram(owner: string, id: string, revision: string, provided?: D1Database): Promise<ProgramPreview> {
  return (await previewWithState(owner, id, revision, database(provided))).preview;
}

// The immutable received snapshot can be previewed without writing a learner's
// program or calendar. Importing it later uses the same preview and history guards.
export async function previewProgramImport(owner: string, value: Program, revision: string, provided?: D1Database): Promise<ProgramPreview> {
  const db = database(provided);
  const program = programSchema.parse(value);
  const existing = await db.prepare("SELECT 1 AS found FROM training_programs WHERE owner = ? AND id = ?").bind(owner, program.id).first();
  if (existing) throw changed();
  return (await previewRecordWithState(owner, { ...program, revision, updatedAt: "", scheduledAt: null }, db)).preview;
}

export type ProgramImportBoundary = {
  sql: string; values: (string | number | null)[];
  committed: (nonce: string, result: ProgramCommitResult, now: string) => D1PreparedStatement[];
};

export async function commitProgramImport(owner: string, value: Program, revision: string, previewToken: string, confirmed: true,
  provided: D1Database, boundary: ProgramImportBoundary): Promise<ProgramCommitResult> {
  return commitProgramState(owner, value.id, revision, previewToken, confirmed, provided, { program: programSchema.parse(value), boundary });
}

export async function commitProgram(owner: string, id: string, revision: string, previewToken: string, confirmed: true, provided?: D1Database,
  verifyReviewed?: (program: ProgramRecord) => Promise<void>): Promise<ProgramCommitResult> {
  return commitProgramState(owner, id, revision, previewToken, confirmed, database(provided), undefined, verifyReviewed);
}

async function commitProgramState(owner: string, id: string, revision: string, previewToken: string, confirmed: true, db: D1Database,
  received?: { program: Program; boundary: ProgramImportBoundary }, verifyReviewed?: (program: ProgramRecord) => Promise<void>): Promise<ProgramCommitResult> {
  if (confirmed !== true) throw new HttpError(400, "请先预览并确认本次日历变更。");
  const prior = await db.prepare("SELECT payload FROM program_commits WHERE owner = ? AND program_id = ? AND revision = ? AND preview_token = ?").bind(owner, id, revision, previewToken).first<{ payload: string }>();
  if (prior) return { ...JSON.parse(prior.payload), replayed: true };
  const { program, current, preview } = received
    ? await previewRecordWithState(owner, { ...received.program, revision, updatedAt: "", scheduledAt: null }, db)
    : await previewWithState(owner, id, revision, db);
  if (preview.token !== previewToken) throw changed();
  await verifyReviewed?.(program);
  const allowed = new Set(preview.items.filter(({ status }) => status === "new" || status === "update").map(({ id }) => id));
  const items = program.sessions.filter(({ id }) => allowed.has(id)).map((session) => ({ id: session.id, payload: JSON.stringify(desiredPlan(program, session)) }));
  const now = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const snapshots = JSON.stringify(entrySnapshot(current));
  const links = JSON.stringify(current.links);
  const snapshotCondition =
    "AND (SELECT COUNT(*) FROM entries e WHERE " + related + ") = json_array_length(?) " +
    "AND NOT EXISTS (SELECT 1 FROM json_each(?) s LEFT JOIN entries e ON e.owner = ? AND e.id = json_extract(s.value, '$.id') " +
    "WHERE e.id IS NULL OR e.kind != json_extract(s.value, '$.kind') OR e.updated != json_extract(s.value, '$.updated') OR (e.kind = 'plan' AND e.payload != json_extract(s.value, '$.payload'))) " +
    "AND (SELECT COUNT(*) FROM program_plan_links WHERE owner = ? AND program_id = ? AND session_id IN (SELECT value FROM json_each(?))) = json_array_length(?) " +
    "AND NOT EXISTS (SELECT 1 FROM json_each(?) s LEFT JOIN program_plan_links l ON l.owner = ? AND l.program_id = ? AND l.session_id = json_extract(s.value, '$.session_id') WHERE l.session_id IS NULL OR l.payload != json_extract(s.value, '$.payload')) " +
    "AND ((SELECT payload FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule') IS ?)";
  const snapshotValues = [owner, current.ids, current.ids, snapshots, snapshots, owner,
    owner, id, current.ids, links, links, owner, id, owner, current.schedulePayload];
  const lease = received
    ? db.prepare("INSERT INTO training_programs (owner,id,payload,revision,updated_at,last_commit) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM training_programs WHERE owner = ? AND id = ?) " + snapshotCondition + " AND (" + received.boundary.sql + ")")
      .bind(owner, id, JSON.stringify(received.program), revision, now, nonce, owner, id, ...snapshotValues, ...received.boundary.values)
    : db.prepare("UPDATE training_programs SET last_commit = ? WHERE owner = ? AND id = ? AND revision = ? " + snapshotCondition)
      .bind(nonce, owner, id, revision, ...snapshotValues);
  const gate = "EXISTS (SELECT 1 FROM training_programs WHERE owner = ? AND id = ? AND last_commit = ?)";
  const payload = JSON.stringify(items);
  const dates = program.sessions.map(({ plan }) => plan.date).sort();
  const result: ProgramCommitResult = { added: preview.counts.new, updated: preview.counts.update,
    skipped: program.sessions.length - items.length, from: dates[0], to: dates[dates.length - 1] };
  // D1 batch is transactional. A single guarded lease makes every following write a no-op if
  // any previewed plan, active session, schedule, link, or program changed before the batch.
  const results = await db.batch([
    lease,
    db.prepare("INSERT INTO entries (owner, id, kind, payload, updated) SELECT ?, json_extract(i.value, '$.id'), 'plan', json_extract(i.value, '$.payload'), ? FROM json_each(?) i WHERE " + gate +
      " ON CONFLICT(owner, id) DO UPDATE SET payload = excluded.payload, updated = excluded.updated WHERE entries.kind = 'plan'")
      .bind(owner, now, payload, owner, id, nonce),
    db.prepare("INSERT INTO program_plan_links (owner, program_id, session_id, payload) SELECT ?, ?, json_extract(i.value, '$.id'), json_extract(i.value, '$.payload') FROM json_each(?) i WHERE " + gate +
      " ON CONFLICT(owner, program_id, session_id) DO UPDATE SET payload = excluded.payload")
      .bind(owner, id, payload, owner, id, nonce),
    db.prepare("UPDATE training_programs SET scheduled_at = CASE WHEN ? > 0 THEN ? ELSE scheduled_at END WHERE owner = ? AND id = ? AND last_commit = ?")
      .bind(items.length, now, owner, id, nonce),
    db.prepare("INSERT OR IGNORE INTO program_commits (owner, program_id, revision, preview_token, payload) SELECT ?, ?, ?, ?, ? WHERE " + gate)
      .bind(owner, id, revision, previewToken, JSON.stringify(result), owner, id, nonce),
    ...(received?.boundary.committed(nonce, result, now) ?? []),
  ]);
  if (!results[0].meta.changes) {
    const replay = await db.prepare("SELECT payload FROM program_commits WHERE owner = ? AND program_id = ? AND revision = ? AND preview_token = ?").bind(owner, id, revision, previewToken).first<{ payload: string }>();
    if (replay) return { ...JSON.parse(replay.payload), replayed: true };
    throw changed();
  }
  return result;
}
