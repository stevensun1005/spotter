import { HttpError } from "@/server/http";
import type { PlannedWorkout } from "./model";
import { checkPlanDates, scheduleUnchanged } from "./schedule-server";
import { nextRevision } from "./schedule";

type PlanWrite = PlannedWorkout & { revision?: string | null };
const stale = () => new HttpError(409, "计划或休息日已在另一处变更，请关闭此窗口，刷新后重新编辑。");
const programFields = "'$.programId','$.programSessionId','$.phaseId'";
const programValues = "'programId',json_extract(e.payload,'$.programId'),'programSessionId',json_extract(e.payload,'$.programSessionId')," +
  "'phaseId',json_extract(e.payload,'$.phaseId')";
const planPayload = "CASE WHEN e.id IS NULL THEN i.payload ELSE json_patch(json_remove(i.payload," + programFields +
  "),json_object(" + programValues + ")) END";
const revisedPayload = "json_patch(json_remove(json_set(i.payload,'$.date',json_extract(e.payload,'$.date')," +
  "'$.shared',json(CASE json_extract(e.payload,'$.shared') WHEN 1 THEN 'true' ELSE 'false' END))," +
  programFields + ",'$.week','$.day'),json_object(" + programValues +
  ",'week',json_extract(e.payload,'$.week'),'day',json_extract(e.payload,'$.day')))";

export async function writePlans(db: D1Database, owner: string, items: PlanWrite[], now: string,
  { skipExisting, reviseExisting }: { skipExisting?: boolean; reviseExisting?: boolean }) {
  if (new Set(items.map(({ id }) => id)).size !== items.length) throw new HttpError(400, "同一计划在此批次出现了多次。");
  if (skipExisting && !reviseExisting) {
    const scheduleRevision = await checkPlanDates(db, owner, items);
    const results = await db.batch([
      ...items.map(({ id, data }) => {
        const payload = JSON.stringify(data);
        return db.prepare(
          "INSERT INTO entries (owner,id,kind,payload,updated) SELECT ?,?,'plan',?,? WHERE " + scheduleUnchanged +
          " AND NOT EXISTS (SELECT 1 FROM entries WHERE owner=? AND kind='plan' AND payload=?) ON CONFLICT(owner,id) DO NOTHING"
        ).bind(owner, id, payload, now, owner, scheduleRevision, owner, payload);
      }),
      db.prepare("SELECT " + scheduleUnchanged + " AS unchanged").bind(owner, scheduleRevision),
    ]);
    if (!(results.at(-1)?.results[0] as { unchanged?: number } | undefined)?.unchanged) throw stale();
    const added = results.slice(0, -1).reduce((count, result) => count + result.meta.changes, 0);
    return { added, skipped: items.length - added };
  }

  const scheduleRevision = reviseExisting ? null : await checkPlanDates(db, owner, items);
  const matches = "e.kind='plan' AND e.updated=i.stamp";
  const sameDateOrNotStarted = "(e.id IS NULL OR json_extract(i.payload,'$.date')=json_extract(e.payload,'$.date') OR NOT EXISTS " +
    "(SELECT 1 FROM entries a WHERE a.owner=e.owner AND a.kind IN ('draft','log') AND (a.id=e.id OR json_extract(a.payload,'$.planId')=e.id)))";
  const eligible = reviseExisting
    ? matches + " AND json_extract(i.payload,'$.title')=json_extract(e.payload,'$.title')"
    : "((i.stamp IS NULL AND e.id IS NULL) OR (" + matches + ")) AND " + sameDateOrNotStarted;
  const gate = " AND (SELECT COUNT(*) FROM eligible)=(SELECT COUNT(*) FROM incoming)" +
    (reviseExisting ? "" : " AND " + scheduleUnchanged);
  const result = await db.prepare(
    "WITH incoming AS MATERIALIZED (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.data') AS payload," +
    " json_extract(value,'$.revision') AS stamp FROM json_each(?))," +
    " eligible AS MATERIALIZED (SELECT i.id," + (reviseExisting ? revisedPayload : planPayload) +
    " AS payload FROM incoming i LEFT JOIN entries e ON e.owner=? AND e.id=i.id WHERE " + eligible + ")" +
    " INSERT INTO entries(owner,id,kind,payload,updated) SELECT ?,id,'plan',payload,? FROM eligible WHERE 1" + gate +
    " ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated"
  ).bind(JSON.stringify(items), owner, owner, nextRevision(now, items.map(({ revision }) => revision)),
    ...(reviseExisting ? [] : [owner, scheduleRevision])).run();
  if (result.meta.changes !== items.length) throw stale();
  return reviseExisting ? { revised: result.meta.changes } : { ok: true };
}

export async function deletePlan(db: D1Database, owner: string, id: string, revision: string | undefined, now: string) {
  if (!revision) throw stale();
  const result = await db.prepare("UPDATE entries SET kind='deleted-plan',payload='{}',updated=? WHERE owner=? AND id=? AND kind='plan' AND updated=?")
    .bind(nextRevision(now, [revision]), owner, id, revision).run();
  if (!result.meta.changes) throw stale();
}
