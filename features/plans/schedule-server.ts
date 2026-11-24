import type { Plan } from "./model";
import { HttpError } from "@/server/http";
import { readSchedule } from "@/features/library/server";
import { blocked, moveSchedule } from "./schedule";

export async function checkPlanDates(db: D1Database, owner: string, plans: { id: string; data: Plan }[]) {
  const settings = await readSchedule(owner);
  for (const { id, data } of plans) {
    if (!blocked(settings, data.date)) continue;
    const old = await db.prepare("SELECT json_extract(payload, '$.date') AS date FROM entries WHERE owner = ? AND id = ? AND kind = 'plan'").bind(owner, id).first<string>("date");
    if (old !== data.date) throw new HttpError(409, data.date + " 已设置为不安排训练。");
  }
}

type PlanDate = { id: string; date: string; title: string; updated: string };
export async function reschedule(db: D1Database, owner: string, id: string, from: string, to: string, shift: boolean, now: string) {
  const settings = await readSchedule(owner);
  if (blocked(settings, to)) throw new HttpError(409, to + " 已设置为不安排训练。");
  const { results } = await db.prepare(
    "SELECT id, updated, json_extract(payload, '$.date') AS date, json_extract(payload, '$.title') AS title FROM entries WHERE owner = ? AND kind = 'plan'"
  ).bind(owner).all<PlanDate>();
  const source = results.find((plan) => plan.id === id);
  if (!source || source.date !== from) throw new HttpError(409, "这项计划的日期已有变动，请刷新后重试。");

  const series = /^W\d{2} D\d\b/.test(source.title);
  const following = results.filter((plan) => plan.date >= from && (!series || /^W\d{2} D\d\b/.test(plan.title)));
  const activity = await db.prepare(
    "SELECT DISTINCT json_extract(payload, '$.planId') AS id FROM entries WHERE owner = ? AND kind = 'log' AND json_extract(payload, '$.date') >= ?"
  ).bind(owner, from).all<{ id: string }>();
  const completed = new Set(activity.results.map((row) => row.id));
  if (completed.has(id)) throw new HttpError(409, "这项计划已完成。可以复制成一项新的训练。");
  const movable = following.filter((plan) => !completed.has(plan.id));
  const ids = new Set(movable.map((plan) => plan.id));
  const occupied = results.filter((plan) => !ids.has(plan.id)).map((plan) => plan.date);
  if (shift && occupied.includes(to)) throw new HttpError(409, "目标日期已安排其他训练，请另选日期。");
  const changes = shift ? moveSchedule(source, to, movable, occupied, settings) : [{ id, date: to }];
  if (!changes?.length) throw new HttpError(400, "顺延日期需在原定日期之后，并避开休息日。");
  const revisions = new Map(results.map((item) => [item.id, item.updated]));
  const payload = JSON.stringify(changes.map((item) => ({ ...item, updated: revisions.get(item.id) })));

  // Freeze the eligible IDs before the update so one conflict prevents every change.
  const updated = await db.prepare(
    "WITH changes AS MATERIALIZED (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.date') AS day, json_extract(value, '$.updated') AS stamp FROM json_each(?)), " +
    "eligible AS MATERIALIZED (SELECT c.id, c.day FROM changes c JOIN entries e ON e.id = c.id AND e.updated = c.stamp WHERE e.owner = ? AND e.kind = 'plan') " +
    "UPDATE entries SET payload = json_set(payload, '$.date', (SELECT day FROM eligible WHERE eligible.id = entries.id)), updated = ? " +
    "WHERE owner = ? AND kind = 'plan' AND id IN (SELECT id FROM eligible) AND (SELECT COUNT(*) FROM eligible) = (SELECT COUNT(*) FROM changes)"
  ).bind(payload, owner, now, owner).run();
  if (updated.meta.changes !== changes.length) throw new HttpError(409, "计划在另一处已有更新，请刷新后重试。");
  return { moved: changes.length };
}
