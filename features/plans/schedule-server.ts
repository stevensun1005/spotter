import type { Plan } from "./model";
import { HttpError } from "@/server/http";
import { offsetDate } from "@/shared/dates";
import { blocked, moveSchedule, nextOpenDate, nextRevision, openSchedule, scheduleSchema,
  type MoveChoice, type MovePreview } from "./schedule";

type ScheduleRow = { payload: string; updated: string };
export const scheduleUnchanged = "(SELECT updated FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule') IS ?";

export async function readPlanSchedule(db: D1Database, owner: string) {
  const row = await db.prepare("SELECT payload, updated FROM personal_library WHERE owner = ? AND kind = 'schedule' AND id = 'schedule'")
    .bind(owner).first<ScheduleRow>();
  return { settings: row ? scheduleSchema.parse(JSON.parse(row.payload).values) : openSchedule, revision: row?.updated ?? null };
}

export async function checkPlanDates(db: D1Database, owner: string, plans: { id: string; data: Plan }[]) {
  const schedule = await readPlanSchedule(db, owner);
  for (const { id, data } of plans) {
    if (!blocked(schedule.settings, data.date)) continue;
    const old = await db.prepare("SELECT json_extract(payload, '$.date') AS date FROM entries WHERE owner = ? AND id = ? AND kind = 'plan'").bind(owner, id).first<string>("date");
    if (old !== data.date) throw new HttpError(409, data.date + " 已设置为不安排训练。");
  }
  return schedule.revision;
}

type PlanDate = { id: string; date: string; title: string; updated: string; programId: string | null };
const changed = () => new HttpError(409, "计划、训练记录或休息日已变更，请重新核对。");
const started = () => new HttpError(409, "已开始或已完成的训练保留原日期。");

async function plannedMoves(db: D1Database, owner: string, choice: MoveChoice) {
  const [schedule, planRows, activity] = await Promise.all([
    readPlanSchedule(db, owner),
    db.prepare("SELECT id, updated, json_extract(payload, '$.date') AS date, json_extract(payload, '$.title') AS title, " +
      "json_extract(payload, '$.programId') AS programId FROM entries WHERE owner = ? AND kind = 'plan' ORDER BY id")
      .bind(owner).all<PlanDate>(),
    db.prepare("SELECT id, json_extract(payload, '$.planId') AS planId FROM entries WHERE owner = ? AND kind IN ('draft', 'log')")
      .bind(owner).all<{ id: string; planId: string | null }>(),
  ]);
  const all = planRows.results;
  const source = all.find((plan) => plan.id === choice.id);
  if (!source || source.date !== choice.from || source.updated !== choice.revision) throw changed();
  const protectedIds = new Set(activity.results.flatMap(({ id, planId }) => planId ? [id, planId] : [id]));
  if (protectedIds.has(source.id)) throw started();
  if (choice.shift && !source.programId) throw new HttpError(400, "没有训练周期关联的计划只能单独移动。");
  const movable = all.filter((plan) => !protectedIds.has(plan.id) && (plan.id === source.id ||
    (choice.shift && plan.programId === source.programId && plan.date >= source.date)));
  const movableIds = new Set(movable.map(({ id }) => id));
  const occupied = new Set(all.filter((plan) => !movableIds.has(plan.id)).map((plan) => plan.date));
  const earliest = offsetDate(source.date, 1);
  const target = choice.nextAvailable
    ? nextOpenDate(choice.date > earliest ? choice.date : earliest, schedule.settings, occupied)
    : choice.date;
  if (!target) throw new HttpError(409, "未来一年没有找到可用日期，请调整计划设置。");
  if (target === source.date || (choice.shift && target < earliest))
    throw new HttpError(400, choice.shift ? "顺延日期要晚于原定日期。" : "请选择不同的训练日期。");
  if (blocked(schedule.settings, target)) throw new HttpError(409, target + " 已设置为不安排训练。");
  if (choice.shift && occupied.has(target)) throw new HttpError(409, "目标日期已安排其他训练，请另选日期。");
  const moved = choice.shift ? moveSchedule(source, target, movable, [...occupied], schedule.settings) : [{ id: source.id, date: target }];
  if (!moved?.length) throw new HttpError(409, "部分训练找不到可用日期，请另选顺延日期。");
  const byId = new Map(movable.map((plan) => [plan.id, plan]));
  const changes = moved.map(({ id, date }) => {
    const original = byId.get(id)!;
    return { id, title: original.title, from: original.date, date };
  });
  const snapshot = JSON.stringify(all.map(({ id, date, programId, updated }) => ({ id, date, programId, updated })));
  const fingerprint = JSON.stringify([owner, choice.id, choice.from, choice.date, choice.shift, Boolean(choice.nextAvailable),
    schedule.revision, snapshot, changes]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const token = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { preview: { token, changes } satisfies MovePreview, snapshot, scheduleRevision: schedule.revision,
    revisions: movable.map(({ updated }) => updated) };
}

export async function previewMove(db: D1Database, owner: string, choice: MoveChoice) {
  return (await plannedMoves(db, owner, choice)).preview;
}

export async function reschedule(db: D1Database, owner: string, choice: MoveChoice, token: string, now: string) {
  const result = await plannedMoves(db, owner, choice);
  if (result.preview.token !== token) throw changed();
  const { changes } = result.preview;
  const updated = await db.prepare(
    "WITH changes AS MATERIALIZED (SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.date') AS day FROM json_each(?)), " +
    "snapshot AS MATERIALIZED (SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.date') AS day, " +
    "json_extract(value,'$.programId') AS programId, json_extract(value,'$.updated') AS stamp FROM json_each(?)), " +
    "valid AS MATERIALIZED (SELECT 1 WHERE " + scheduleUnchanged +
    " AND (SELECT COUNT(*) FROM entries WHERE owner = ? AND kind = 'plan') = (SELECT COUNT(*) FROM snapshot)" +
    " AND NOT EXISTS (SELECT 1 FROM snapshot s WHERE NOT EXISTS (SELECT 1 FROM entries e WHERE e.owner = ? AND e.kind = 'plan'" +
    " AND e.id = s.id AND e.updated = s.stamp AND json_extract(e.payload,'$.date') IS s.day AND json_extract(e.payload,'$.programId') IS s.programId))" +
    " AND NOT EXISTS (SELECT 1 FROM entries a JOIN changes c ON a.id = c.id OR json_extract(a.payload,'$.planId') = c.id WHERE a.owner = ? AND a.kind IN ('draft','log')))" +
    " UPDATE entries SET payload = json_set(payload,'$.date',(SELECT day FROM changes WHERE changes.id = entries.id)), updated = ?" +
    " WHERE owner = ? AND kind = 'plan' AND id IN (SELECT id FROM changes) AND EXISTS (SELECT 1 FROM valid)"
  ).bind(JSON.stringify(changes), result.snapshot, owner, result.scheduleRevision, owner, owner, owner,
    nextRevision(now, result.revisions), owner).run();
  if (updated.meta.changes !== changes.length) throw changed();
  return { moved: changes.length, date: changes.find((change) => change.id === choice.id)!.date };
}
