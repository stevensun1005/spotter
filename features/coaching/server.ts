import { HttpError } from "@/server/http";
import { accountName } from "@/features/auth/display-name";
import { offsetDate } from "@/shared/dates";
import { planSchema, type Plan } from "@/features/plans/model";
import { resolvePlanTemplate, withoutTemplateLink } from "@/features/plans/template-link";
import { programSchema, type Program, type ProgramCommitResult } from "@/features/programs/model";
import { commitProgramImport, previewProgramImport, readProgram } from "@/features/programs/server";
import { sessionSchema } from "@/features/training/model";
import type { CoachingActor, CoachingActual, CoachingAssignment, CoachingAssignmentDetail, CoachingHome,
  CoachingLink, CoachingMutation, CoachingProgress, CoachingSession, CoachingSource, CoachingSourceDetail } from "./model";

type LinkRow = { id: string; coach_id: string; coach_name: string; student_id: string; student_name: string;
  share_details: number; created_at: string; ended_at: string | null };
type AssignmentRow = {
  id: string; link_id: string; coach_id: string; student_id: string; request_hash: string; kind: "plan" | "program";
  payload: string; revision: string; program_id: string; note: string; status: CoachingAssignment["status"];
  created_at: string; accepted_at: string | null; result: string | null; feedback: string | null; feedback_at: string | null;
  coach_name: string; student_name: string; share_details: number; link_ended_at: string | null;
};
type InviteRow = { coach_id: string; coach_name: string; code_hash: string; expires_at: string; claimed_by: string | null };
type AssignmentMetadata = Pick<AssignmentRow, "id" | "link_id" | "coach_id" | "student_id" | "coach_name" | "student_name" | "kind" | "note" | "status" | "created_at" | "accepted_at" | "program_id"> & {
  title: string; start_date: string; weeks: number; session_count: number;
};
const noAccess = () => new HttpError(403, "这项操作需要有效的教练与学员关系及相应身份。");
const stale = () => new HttpError(409, "邀请、下发计划或关系已变化，请刷新后重新核对。");
const relationshipNames = accountName("l.coach_id", "l.coach_name") + " AS coach_name, " +
  accountName("l.student_id", "l.student_name") + " AS student_name";
const linkColumns = "l.id, l.coach_id, l.student_id, l.share_details, l.created_at, l.ended_at, " + relationshipNames;
const joinedAssignments = "SELECT a.*, " + relationshipNames + ", l.share_details, l.ended_at AS link_ended_at FROM coaching_assignments a JOIN coaching_links l ON l.id = a.link_id ";
const ownAssignment = (row: AssignmentRow, owner: string) => row.student_id === owner;
const programOf = (row: AssignmentRow) => programSchema.parse(JSON.parse(row.payload));
async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function link(row: LinkRow): CoachingLink {
  return { id: row.id, coachId: row.coach_id, coachName: row.coach_name, studentId: row.student_id, studentName: row.student_name,
    shareDetails: row.share_details === 1, createdAt: row.created_at, endedAt: row.ended_at };
}
async function requireLink(db: D1Database, owner: string, id: string, role?: "coach" | "student") {
  const row = await db.prepare("SELECT * FROM coaching_links WHERE id = ? AND (coach_id = ? OR student_id = ?)").bind(id, owner, owner).first<LinkRow>();
  if (!row || row.ended_at || role === "coach" && row.coach_id !== owner || role === "student" && row.student_id !== owner) throw noAccess();
  return row;
}
async function assignmentRow(db: D1Database, owner: string, id: string) {
  const row = await db.prepare(joinedAssignments + "WHERE a.id = ? AND (a.coach_id = ? OR a.student_id = ?)").bind(id, owner, owner).first<AssignmentRow>();
  if (!row) throw new HttpError(404, "找不到你的这份教练计划。");
  return row;
}
function requireAssignment(row: AssignmentRow, owner: string, role: "coach" | "student") {
  if (row.link_ended_at || (role === "coach" ? row.coach_id : row.student_id) !== owner) throw noAccess();
}

// Only matching assigned plan IDs are selected. The SQL projection prevents a
// coach without the learner's opt-in from receiving full session payloads.
async function sessions(db: D1Database, owner: string, row: AssignmentRow): Promise<CoachingSession[]> {
  const program = programOf(row);
  const ids = JSON.stringify(program.sessions.map((item) => item.id));
  const { results } = await db.prepare(
    "SELECT e.id, e.kind, json_extract(e.payload, '$.planId') AS plan_id, " +
    "CASE WHEN ? = a.student_id OR l.share_details = 1 THEN e.payload ELSE NULL END AS payload " +
    "FROM entries e JOIN coaching_assignments a ON a.id = ? AND e.owner = a.student_id " +
    "JOIN coaching_links l ON l.id = a.link_id WHERE (a.student_id = ? OR (a.coach_id = ? AND l.ended_at IS NULL)) " +
    "AND a.status = 'accepted' AND e.kind IN ('draft','log') AND json_extract(e.payload, '$.planId') IN (SELECT value FROM json_each(?)) ORDER BY e.updated DESC, e.id DESC"
  ).bind(owner, row.id, owner, owner, ids).all<{ id: string; kind: string; plan_id: string; payload: string | null }>();
  const stored = await db.prepare(
    "SELECT e.id, e.kind FROM entries e JOIN coaching_assignments a ON a.id = ? AND e.owner = a.student_id " +
    "JOIN coaching_links l ON l.id = a.link_id WHERE (a.student_id = ? OR (a.coach_id = ? AND l.ended_at IS NULL)) " +
    "AND a.status = 'accepted' AND e.id IN (SELECT value FROM json_each(?))"
  ).bind(row.id, owner, owner, ids).all<{ id: string; kind: string }>();
  const removed = new Set(stored.results.filter((item) => item.kind !== "plan").map((item) => item.id));
  return program.sessions.map((item) => {
    const complete = results.find((value) => value.plan_id === item.id && value.kind === "log");
    const active = results.some((value) => value.plan_id === item.id && value.kind === "draft");
    let actual: CoachingActual | null = null;
    if (complete?.payload) {
      const parsed = sessionSchema.safeParse(JSON.parse(complete.payload));
      if (parsed.success) {
        actual = { minutes: parsed.data.minutes, exercises: parsed.data.plan.exercises.map((move, index) => ({
          name: move.name, unit: move.unit,
          sets: parsed.data.rows[index].filter((line) => line.done).map(({ weight, reps, seconds, right, kind, rpe }) => ({ weight, reps, seconds, ...(right ? { right } : {}), ...(kind ? { kind } : {}), ...(rpe ? { rpe } : {}) })),
        })) };
      }
    }
    return { id: item.id, title: item.plan.title, date: item.plan.date,
      status: complete ? "completed" : active ? "inProgress" : removed.has(item.id) ? "removed" : "pending", actual };
  });
}
async function summary(db: D1Database, owner: string, row: AssignmentRow, knownProgress?: CoachingProgress | null): Promise<CoachingAssignment> {
  const program = programOf(row);
  let progress: CoachingProgress | null = knownProgress ?? null;
  if (knownProgress === undefined && row.status === "accepted" && (ownAssignment(row, owner) || !row.link_ended_at)) {
    const items = await sessions(db, owner, row);
    progress = { total: items.length, completed: items.filter((item) => item.status === "completed").length, inProgress: items.filter((item) => item.status === "inProgress").length };
  }
  return summaryMetadata(owner, { ...row, title: program.title, start_date: program.startDate, weeks: program.weeks, session_count: program.sessions.length }, progress);
}
function summaryMetadata(owner: string, row: AssignmentMetadata, progress: CoachingProgress | null): CoachingAssignment {
  return { id: row.id, linkId: row.link_id, viewerRole: row.student_id === owner ? "student" : "coach", title: row.title, note: row.note,
    coachName: row.coach_name, studentName: row.student_name, kind: row.kind, startDate: row.start_date, weeks: row.weeks,
    sessionCount: row.session_count, status: row.status, createdAt: row.created_at, acceptedAt: row.accepted_at, programId: row.program_id, progress };
}

function singleProgram(id: string, value: Plan): Program {
  const plan = planSchema.parse({ ...withoutTemplateLink(value), shared: false, week: 1, day: 1, programId: id, programSessionId: id });
  return programSchema.parse({ id, title: plan.title, startDate: plan.date, weeks: 1, phases: [], sessions: [{ id, week: 1, day: 1, plan }] });
}
export async function coachingSource(db: D1Database, owner: string, kind: CoachingSource["kind"], id: string): Promise<CoachingSourceDetail> {
  let program: Program;
  if (kind === "program") {
    const value = await readProgram(owner, id, db);
    program = programSchema.parse({ id: value.id, title: value.title, startDate: value.startDate, weeks: value.weeks, phases: value.phases, sessions: value.sessions });
  } else {
    const row = kind === "plan"
      ? await db.prepare("SELECT payload FROM entries WHERE owner = ? AND id = ? AND kind = 'plan'").bind(owner, id).first<{ payload: string }>()
      : await db.prepare("SELECT payload FROM personal_library WHERE owner = ? AND id = ? AND kind = 'template'").bind(owner, id).first<{ payload: string }>();
    if (!row) throw new HttpError(404, "找不到你的这份训练计划或模板。");
    let value = planSchema.parse(kind === "plan" ? JSON.parse(row.payload) : JSON.parse(row.payload).plan);
    if (kind === "plan" && value.templateId) {
      const template = await db.prepare("SELECT payload FROM personal_library WHERE owner = ? AND id = ? AND kind = 'template'").bind(owner, value.templateId).first<{ payload: string }>();
      value = resolvePlanTemplate(value, template ? planSchema.parse(JSON.parse(template.payload).plan) : undefined);
    }
    program = singleProgram(id, value);
  }
  return { source: { id, kind, title: program.title, startDate: program.startDate, weeks: program.weeks, sessionCount: program.sessions.length, expectedHash: await digest(JSON.stringify(program)) }, program };
}
async function sourceList(db: D1Database, owner: string): Promise<CoachingSource[]> {
  const [plans, templates, programs] = await Promise.all([
    db.prepare("SELECT id, json_extract(payload,'$.title') AS title, json_extract(payload,'$.date') AS startDate, 1 AS weeks, 1 AS sessionCount FROM entries WHERE owner = ? AND kind = 'plan' ORDER BY updated DESC LIMIT 100").bind(owner).all<Omit<CoachingSource,"kind">>(),
    db.prepare("SELECT id, json_extract(payload,'$.plan.title') AS title, json_extract(payload,'$.plan.date') AS startDate, 1 AS weeks, 1 AS sessionCount FROM personal_library WHERE owner = ? AND kind = 'template' ORDER BY updated DESC LIMIT 100").bind(owner).all<Omit<CoachingSource,"kind">>(),
    db.prepare("SELECT id, json_extract(payload,'$.title') AS title, json_extract(payload,'$.startDate') AS startDate, json_extract(payload,'$.weeks') AS weeks, json_array_length(payload,'$.sessions') AS sessionCount FROM training_programs WHERE owner = ? ORDER BY updated_at DESC LIMIT 100").bind(owner).all<Omit<CoachingSource,"kind">>(),
  ]);
  return [...plans.results.map((row) => ({ ...row, kind: "plan" as const })), ...templates.results.map((row) => ({ ...row, kind: "template" as const })), ...programs.results.map((row) => ({ ...row, kind: "program" as const }))];
}
export async function coachingHome(db: D1Database, actor: CoachingActor): Promise<CoachingHome> {
  const [links, assignments, sources] = await Promise.all([
    db.prepare("SELECT " + linkColumns + " FROM coaching_links l WHERE (l.coach_id = ? OR l.student_id = ?) AND l.ended_at IS NULL ORDER BY l.created_at DESC LIMIT 200").bind(actor.id, actor.id).all<LinkRow>(),
    db.prepare("SELECT a.id,a.link_id,a.coach_id,a.student_id,a.kind,a.note,a.status,a.created_at,a.accepted_at,a.program_id," + relationshipNames + "," +
      "json_extract(a.payload,'$.title') AS title,json_extract(a.payload,'$.startDate') AS start_date,json_extract(a.payload,'$.weeks') AS weeks,json_array_length(a.payload,'$.sessions') AS session_count " +
      "FROM coaching_assignments a JOIN coaching_links l ON l.id=a.link_id WHERE a.coach_id=? OR a.student_id=? ORDER BY a.created_at DESC LIMIT 100")
      .bind(actor.id, actor.id).all<AssignmentMetadata>(),
    sourceList(db, actor.id),
  ]);
  const progress = await db.prepare(
    "WITH session_state AS (SELECT a.id AS assignment_id, json_extract(s.value,'$.id') AS session_id, " +
    "MAX(CASE WHEN e.kind='log' THEN 1 ELSE 0 END) AS completed, MAX(CASE WHEN e.kind='draft' THEN 1 ELSE 0 END) AS started " +
    "FROM coaching_assignments a JOIN coaching_links l ON l.id=a.link_id JOIN json_each(a.payload,'$.sessions') s " +
    "LEFT JOIN entries e ON e.owner=a.student_id AND e.kind IN ('log','draft') AND json_extract(e.payload,'$.planId')=json_extract(s.value,'$.id') " +
    "WHERE a.id IN (SELECT value FROM json_each(?)) AND a.status='accepted' AND (a.student_id=? OR (a.coach_id=? AND l.ended_at IS NULL)) GROUP BY a.id,session_id) " +
    "SELECT assignment_id, COUNT(*) AS total, SUM(completed) AS completed, SUM(CASE WHEN completed=0 AND started=1 THEN 1 ELSE 0 END) AS inProgress FROM session_state GROUP BY assignment_id"
  ).bind(JSON.stringify(assignments.results.map((row) => row.id)), actor.id, actor.id).all<{ assignment_id: string } & CoachingProgress>();
  const counts = new Map(progress.results.map(({ assignment_id, ...value }) => [assignment_id, value]));
  return { viewerId: actor.id, links: links.results.map(link), assignments: assignments.results.map((item) => summaryMetadata(actor.id, item, counts.get(item.id) ?? null)), sources };
}
export async function coachingDetail(db: D1Database, owner: string, id: string): Promise<CoachingAssignmentDetail> {
  const row = await assignmentRow(db, owner, id);
  if (row.coach_id === owner && row.link_ended_at) throw noAccess();
  const items = await sessions(db, owner, row);
  // Recheck the mutable consent boundary in the final read as well. A revoked
  // sharing flag strips an already-selected projection before returning it.
  const consent = await db.prepare("SELECT a.feedback,a.feedback_at,l.share_details,l.ended_at FROM coaching_assignments a JOIN coaching_links l ON l.id=a.link_id WHERE a.id=? AND (a.student_id=? OR (a.coach_id=? AND l.ended_at IS NULL))")
    .bind(id, owner, owner).first<{ feedback: string | null; feedback_at: string | null; share_details: number; ended_at: string | null }>();
  if (!consent) throw noAccess();
  if (row.coach_id === owner && consent.share_details !== 1) items.forEach((item) => { item.actual = null; });
  const progress = row.status === "accepted" ? { total: items.length, completed: items.filter((item) => item.status === "completed").length, inProgress: items.filter((item) => item.status === "inProgress").length } : null;
  return { assignment: await summary(db, owner, row, progress), program: programOf(row), sessions: items,
    feedback: consent.feedback && consent.feedback_at ? { note: consent.feedback, updatedAt: consent.feedback_at } : null,
    detailsShared: consent.share_details === 1, relationshipActive: !consent.ended_at, result: row.result ? JSON.parse(row.result) : null };
}

async function inspectInvite(db: D1Database, owner: string, code: string) {
  const row = await db.prepare("SELECT i.coach_id, i.code_hash, i.expires_at, i.claimed_by, " + accountName("i.coach_id", "i.coach_name") +
    " AS coach_name FROM coaching_invites i WHERE i.code_hash = ? AND i.claimed_by IS NULL AND i.expires_at > ?")
    .bind(await digest(code), new Date().toISOString()).first<InviteRow>();
  if (!row) throw new HttpError(409, "教练邀请码已失效、已使用或已过期。");
  if (row.coach_id === owner) throw new HttpError(400, "不能使用自己的教练邀请码。");
  return row;
}
function learnerCopy(source: Program, startDate: string): Program {
  const id = crypto.randomUUID();
  const phases = new Map(source.phases.map((phase) => [phase.id, crypto.randomUUID()]));
  return programSchema.parse({ ...source, id, startDate,
    phases: source.phases.map((phase) => ({ ...phase, id: phases.get(phase.id) })),
    sessions: source.sessions.map((session) => {
      const sessionId = crypto.randomUUID();
      const phaseId = session.phaseId ? phases.get(session.phaseId) : undefined;
      return { ...session, id: sessionId, phaseId, plan: { ...withoutTemplateLink(session.plan), shared: false,
        date: offsetDate(startDate, (session.week - 1) * 7 + session.day - 1), week: session.week, day: session.day, programId: id, programSessionId: sessionId, phaseId } };
    }),
  });
}
export async function changeCoaching(db: D1Database, actor: CoachingActor, input: CoachingMutation): Promise<unknown> {
  const now = new Date().toISOString();
  if (input.action === "invite") {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await db.prepare("INSERT INTO coaching_invites (coach_id,coach_name,code_hash,expires_at) VALUES (?,?,?,?) ON CONFLICT(coach_id) DO UPDATE SET coach_name=excluded.coach_name,code_hash=excluded.code_hash,expires_at=excluded.expires_at,claimed_by=NULL,claimed_at=NULL,claim_nonce=NULL")
      .bind(actor.id, actor.name, await digest(code), expiresAt).run();
    return { invite: { code, expiresAt } };
  }
  if (input.action === "revokeInvite") { await db.prepare("DELETE FROM coaching_invites WHERE coach_id = ?").bind(actor.id).run(); return { ok: true }; }
  if (input.action === "inspectInvite") { const row = await inspectInvite(db, actor.id, input.code); return { coachName: row.coach_name, expiresAt: row.expires_at }; }
  if (input.action === "join") {
    const invite = await inspectInvite(db, actor.id, input.code);
    const id = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const results = await db.batch([
      db.prepare("UPDATE coaching_invites SET claimed_by=?,claimed_at=?,claim_nonce=? WHERE code_hash=? AND claimed_by IS NULL AND expires_at>? AND coach_id != ? AND NOT EXISTS (SELECT 1 FROM coaching_links WHERE coach_id=? AND student_id=? AND ended_at IS NULL)")
        .bind(actor.id, now, nonce, invite.code_hash, now, actor.id, invite.coach_id, actor.id),
      db.prepare("INSERT INTO coaching_links (id,coach_id,coach_name,student_id,student_name,share_details,created_at) SELECT ?,coach_id,coach_name,?,?,?,? FROM coaching_invites WHERE code_hash=? AND claim_nonce=?")
        .bind(id, actor.id, actor.name, Number(input.shareDetails), now, invite.code_hash, nonce),
    ]);
    if (!results[0].meta.changes || !results[1].meta.changes) throw stale();
    const row = await db.prepare("SELECT " + linkColumns + " FROM coaching_links l WHERE l.id=?").bind(id).first<LinkRow>();
    return { link: link(row!) };
  }
  if (input.action === "sharing") {
    await requireLink(db, actor.id, input.linkId, "student");
    const result = await db.prepare("UPDATE coaching_links SET share_details=? WHERE id=? AND student_id=? AND ended_at IS NULL").bind(Number(input.shareDetails), input.linkId, actor.id).run();
    if (!result.meta.changes) throw noAccess();
    return { ok: true };
  }
  if (input.action === "disconnect") {
    const existing = await db.prepare("SELECT ended_at FROM coaching_links WHERE id=? AND (coach_id=? OR student_id=?)").bind(input.linkId, actor.id, actor.id).first<{ ended_at: string | null }>();
    if (!existing) throw noAccess();
    if (existing.ended_at) return { ok: true };
    await db.batch([
      db.prepare("UPDATE coaching_links SET ended_at=? WHERE id=? AND (coach_id=? OR student_id=?) AND ended_at IS NULL").bind(now, input.linkId, actor.id, actor.id),
      db.prepare("UPDATE coaching_assignments SET status='cancelled' WHERE link_id=? AND status='pending' AND EXISTS(SELECT 1 FROM coaching_links WHERE id=? AND ended_at=? AND (coach_id=? OR student_id=?))").bind(input.linkId, input.linkId, now, actor.id, actor.id),
    ]);
    return { ok: true };
  }
  if (input.action === "send") {
    const requestHash = await digest(JSON.stringify(input));
    const prior = await db.prepare(joinedAssignments + "WHERE a.id=?").bind(input.requestId).first<AssignmentRow>();
    if (prior) {
      if (prior.coach_id !== actor.id || prior.request_hash !== requestHash) throw stale();
      return { assignment: await summary(db, actor.id, prior) };
    }
    const relationship = await requireLink(db, actor.id, input.linkId, "coach");
    const source = await coachingSource(db, actor.id, input.source.kind, input.source.id);
    if (source.source.expectedHash !== input.source.expectedHash) throw new HttpError(409, "原计划已修改，请重新选择并预览后发送。");
    const program = learnerCopy(source.program, input.startDate);
    const revision = crypto.randomUUID();
    const result = await db.prepare("INSERT INTO coaching_assignments (id,link_id,coach_id,student_id,request_hash,kind,payload,revision,program_id,note,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM coaching_links WHERE id=? AND coach_id=? AND student_id=? AND ended_at IS NULL) ON CONFLICT(id) DO NOTHING")
      .bind(input.requestId, input.linkId, actor.id, relationship.student_id, requestHash, input.source.kind === "program" ? "program" : "plan", JSON.stringify(program), revision, program.id, input.note, now, input.linkId, actor.id, relationship.student_id).run();
    const saved = await assignmentRow(db, actor.id, input.requestId).catch(() => null);
    if (!saved || saved.request_hash !== requestHash || !result.meta.changes && saved.coach_id !== actor.id) throw stale();
    return { assignment: await summary(db, actor.id, saved) };
  }
  const row = await assignmentRow(db, actor.id, input.assignmentId);
  if (input.action === "cancel" || input.action === "decline") {
    requireAssignment(row, actor.id, input.action === "cancel" ? "coach" : "student");
    const status = input.action === "cancel" ? "cancelled" : "declined";
    if (row.status === status) return { ok: true };
    const changed = await db.prepare("UPDATE coaching_assignments SET status=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM coaching_links WHERE id=coaching_assignments.link_id AND ended_at IS NULL)").bind(status, row.id).run();
    if (!changed.meta.changes) throw stale();
    return { ok: true };
  }
  requireAssignment(row, actor.id, "student");
  if (input.action === "feedback") {
    const changed = await db.prepare("UPDATE coaching_assignments SET feedback=?,feedback_at=? WHERE id=? AND student_id=? AND status='accepted' AND EXISTS(SELECT 1 FROM coaching_links WHERE id=coaching_assignments.link_id AND ended_at IS NULL)")
      .bind(input.note || null, input.note ? now : null, row.id, actor.id).run();
    if (!changed.meta.changes) throw stale();
    return { ok: true };
  }
  if (input.action === "preview") {
    if (row.status !== "pending") throw stale();
    const preview = await previewProgramImport(actor.id, programOf(row), row.revision, db);
    return { assignment: await summary(db, actor.id, row), preview };
  }
  if (row.status === "accepted" && row.result) {
    if (input.revision !== row.revision) throw stale();
    const receipt = await db.prepare("SELECT payload FROM program_commits WHERE owner=? AND program_id=? AND revision=? AND preview_token=?").bind(actor.id, row.program_id, row.revision, input.previewToken).first<{ payload: string }>();
    if (!receipt) throw stale();
    return { assignment: await summary(db, actor.id, row), result: { ...JSON.parse(receipt.payload), replayed: true } };
  }
  if (row.status !== "pending" || input.revision !== row.revision) throw stale();
  const result = await commitProgramImport(actor.id, programOf(row), row.revision, input.previewToken, input.confirmed, db, {
    sql: "EXISTS(SELECT 1 FROM coaching_assignments a JOIN coaching_links l ON l.id=a.link_id WHERE a.id=? AND a.student_id=? AND a.status='pending' AND a.revision=? AND l.ended_at IS NULL)",
    values: [row.id, actor.id, row.revision],
    committed: (nonce, receipt: ProgramCommitResult, acceptedAt) => [db.prepare("UPDATE coaching_assignments SET status='accepted',accepted_at=?,result=? WHERE id=? AND student_id=? AND status='pending' AND EXISTS(SELECT 1 FROM training_programs WHERE owner=? AND id=? AND last_commit=?)")
      .bind(acceptedAt, JSON.stringify(receipt), row.id, actor.id, actor.id, row.program_id, nonce)],
  });
  const accepted = await assignmentRow(db, actor.id, row.id);
  if (accepted.status !== "accepted") throw stale();
  return { assignment: await summary(db, actor.id, accepted), result };
}
