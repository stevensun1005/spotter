import { HttpError } from "@/server/http";
import { sessionSchema, sessionTotals } from "@/features/training/model";
import type { LearnerOverview, LearnerPeriod, LessonEntry, LessonMutation } from "./progress-model";

const inaccessible = () => new HttpError(404, "找不到有效的学员关系。");

export async function learnerOverview(db: D1Database, coach: string, period: LearnerPeriod): Promise<LearnerOverview> {
  const { learner, from, to } = period;
  const [completed, ledger] = await Promise.all([
    db.prepare(`
      WITH active AS (
        SELECT id, student_id, share_details FROM coaching_links
        WHERE id = ? AND coach_id = ? AND ended_at IS NULL
      ), assigned AS (
        SELECT DISTINCT json_extract(s.value, '$.id') AS plan_id,
          COALESCE(json_extract(p.payload, '$.date'), json_extract(s.value, '$.plan.date')) AS day
        FROM active l JOIN coaching_assignments a ON a.link_id = l.id
        JOIN json_each(a.payload, '$.sessions') s
        LEFT JOIN entries p ON p.owner = l.student_id AND p.kind = 'plan' AND p.id = json_extract(s.value, '$.id')
        WHERE a.status = 'accepted'
      ), completed AS (
        SELECT DISTINCT e.id,
          CASE WHEN l.share_details = 1 THEN json_extract(e.payload, '$.date') ELSE a.day END AS day,
          CASE WHEN l.share_details = 1 THEN e.payload ELSE NULL END AS payload
        FROM active l JOIN entries e ON e.owner = l.student_id AND e.kind = 'log'
        JOIN assigned a ON a.plan_id = json_extract(e.payload, '$.planId')
      )
      SELECT l.share_details, c.id, c.day, c.payload FROM active l
      LEFT JOIN completed c ON c.day BETWEEN ? AND ?
    `).bind(learner, coach, from, to).all<{ share_details: number; id: string | null; day: string | null; payload: string | null }>(),
    db.prepare(`
      WITH active AS (
        SELECT id FROM coaching_links WHERE id = ? AND coach_id = ? AND ended_at IS NULL
      ), recent AS (
        SELECT lesson.*, EXISTS(SELECT 1 FROM coaching_lessons r
          WHERE r.link_id = lesson.link_id AND r.reverses = lesson.id) AS reversed
        FROM active l JOIN coaching_lessons lesson ON lesson.link_id = l.id
        ORDER BY lesson.created_at DESC, lesson.id DESC LIMIT 80
      )
      SELECT recent.id, recent.delta, recent.note, recent.reverses, recent.created_at AS createdAt, recent.reversed,
        (SELECT COALESCE(SUM(delta), 0) FROM active l JOIN coaching_lessons lesson ON lesson.link_id = l.id) AS balance
      FROM active LEFT JOIN recent ON recent.link_id = active.id
      ORDER BY recent.created_at DESC, recent.id DESC
    `).bind(learner, coach).all<Omit<LessonEntry, "reversed"> & { reversed: number; balance: number }>(),
  ]);
  if (!completed.results.length || !ledger.results.length) throw inaccessible();
  const shareDetails = completed.results[0].share_details === 1;
  const records = completed.results.filter(({ id }) => id !== null);
  let minutes = 0, sets = 0, volumeKg = 0;
  for (const record of records) {
    if (!record.payload) continue;
    const session = sessionSchema.safeParse(JSON.parse(record.payload));
    if (!session.success) continue;
    const totals = sessionTotals(session.data);
    minutes += session.data.minutes;
    sets += totals.sets;
    volumeKg += totals.volume;
  }
  return {
    from, to, shareDetails,
    summary: {
      sessions: records.length, days: new Set(records.map(({ day }) => day)).size,
      minutes: shareDetails ? minutes : null, sets: shareDetails ? sets : null, volumeKg: shareDetails ? Math.round(volumeKg * 10) / 10 : null,
    },
    balance: ledger.results[0].balance,
    lessons: ledger.results.filter(({ id }) => id !== null).map(({ id, delta, note, reverses, createdAt, reversed }) =>
      ({ id, delta, note, reverses, createdAt, reversed: reversed === 1 })),
  };
}

export async function recordLesson(db: D1Database, coach: string, input: LessonMutation) {
  const { requestId, linkId, note } = input;
  const reverses = input.change === "reverse" ? input.lessonId : null;
  const delta = input.change === "reverse" ? null : input.change === "credit" ? input.quantity : -input.quantity;
  const saved = await db.prepare(`
    WITH active AS (
      SELECT id FROM coaching_links WHERE id = ? AND coach_id = ? AND ended_at IS NULL
    ), change AS (
      SELECT COALESCE(?, -original.delta) AS delta FROM active l
      LEFT JOIN coaching_lessons original ON original.link_id = l.id AND original.id = ? AND original.reverses IS NULL
    )
    INSERT INTO coaching_lessons (id, link_id, delta, note, reverses, created_at)
    SELECT ?, l.id, c.delta, ?, ?, ? FROM active l CROSS JOIN change c
    WHERE c.delta IS NOT NULL
      AND (SELECT COALESCE(SUM(delta), 0) FROM coaching_lessons WHERE link_id = l.id) + c.delta >= 0
    ON CONFLICT DO NOTHING
  `).bind(linkId, coach, delta, reverses, requestId, note, reverses, new Date().toISOString()).run();
  if (saved.meta.changes) return { ok: true as const };

  const existing = await db.prepare(`
    SELECT e.id, e.delta, e.note, e.reverses FROM coaching_links l
    LEFT JOIN coaching_lessons e ON e.link_id = l.id AND e.id = ?
    WHERE l.id = ? AND l.coach_id = ? AND l.ended_at IS NULL
  `).bind(requestId, linkId, coach).first<{ id: string | null; delta: number | null; note: string | null; reverses: string | null }>();
  if (!existing) throw inaccessible();
  if (existing.id === requestId && existing.note === note && existing.reverses === reverses && (delta === null || existing.delta === delta)) return { ok: true as const };
  if (existing.id) throw new HttpError(409, "这笔课时请求内容已变更，请刷新后重试。");
  throw new HttpError(409, input.change === "reverse"
    ? "这笔记录已冲销、无法冲销，或冲销后的课时余额不足。"
    : "剩余课时不足或记录已变更，请刷新后再试。");
}
