import { database, transaction } from "@/server/db";
import { workoutWindow } from "@/features/heart/model";
import type { Session } from "@/features/training/model";
import type { ActivityRecord, BodyMassRecord, HealthBatch, HealthOverview, HealthSyncResult, HealthWorkout } from "./model";

export function lastHealthSync(owner: string): HealthSyncResult | null {
  const row = database().prepare("SELECT payload FROM health_sync_status WHERE owner = ?").get(owner) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) : null;
}

export function recordHealthSync(owner: string, result: HealthSyncResult) {
  database().prepare("INSERT INTO health_sync_status (owner, payload) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET payload = excluded.payload")
    .run(owner, JSON.stringify(result));
}

function matchedWorkout(owner: string, from: number, to: number): string | null {
  const rows = database().prepare("SELECT id, payload FROM entries WHERE owner = ? AND kind = 'log' AND json_extract(payload, '$.started') < ? AND json_extract(payload, '$.started') >= ?")
    .all(owner, to, from - 7 * 86_400_000) as { id: string; payload: string }[];
  const candidates = rows.filter(({ payload }) => {
    const window = workoutWindow(JSON.parse(payload) as Session);
    const overlap = Math.min(to, window.to) - Math.max(from, window.from);
    return overlap > 0 && overlap / Math.max(to - from, window.to - window.from) >= 0.5;
  });
  // Ambiguous overlapping check-ins require the user to resolve their training times.
  return candidates.length === 1 ? candidates[0].id : null;
}

export function saveHealthBatch(owner: string, batch: HealthBatch) {
  const db = database();
  return transaction(db, () => {
    let saved = 0;
    let skipped = 0;
    for (const sample of batch.bodyMass) {
      const { value, unit, ...rest } = sample;
      const record: BodyMassRecord = { ...rest, kg: Number((value * (unit === "lb" ? 0.45359237 : 1)).toFixed(6)) };
      const change = db.prepare("INSERT INTO health_body_mass (owner, sample_id, at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner, sample_id) DO UPDATE SET at = excluded.at, payload = excluded.payload WHERE health_body_mass.payload != excluded.payload")
        .run(owner, sample.id, sample.at, JSON.stringify(record));
      change.changes ? saved++ : skipped++;
    }
    for (const sample of batch.workouts) {
      // HealthKit workouts enrich an existing check-in; they never create a shared log.
      const record: HealthWorkout = { ...sample, matchedWorkoutId: matchedWorkout(owner, sample.from, sample.to) };
      const change = db.prepare("INSERT INTO health_workout (owner, sample_id, started, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner, sample_id) DO UPDATE SET started = excluded.started, payload = excluded.payload WHERE health_workout.payload != excluded.payload")
        .run(owner, sample.id, sample.from, JSON.stringify(record));
      change.changes ? saved++ : skipped++;
    }
    for (const sample of batch.activity) {
      const previous = db.prepare("SELECT payload FROM health_activity WHERE owner = ? AND date = ?").get(owner, sample.date) as { payload: string } | undefined;
      const old: Partial<ActivityRecord> = previous ? JSON.parse(previous.payload) : {};
      // One HealthKit merged total per local day. Re-reading replaces totals, never adds them.
      // Preserve an unselected metric only when it describes exactly the same interval.
      const compatible = old.from === sample.from && old.to === sample.to && old.timeZone === batch.timeZone;
      const record: ActivityRecord = { ...(compatible ? old : {}), ...sample, timeZone: batch.timeZone };
      for (const [type, metric] of [["steps", "steps"], ["activeEnergy", "activeEnergyKcal"], ["exerciseTime", "exerciseMinutes"]] as const) {
        if (batch.selected.includes(type) && sample[metric] === undefined) delete record[metric];
      }
      const change = db.prepare("INSERT INTO health_activity (owner, date, payload) VALUES (?, ?, ?) ON CONFLICT(owner, date) DO UPDATE SET payload = excluded.payload WHERE health_activity.payload != excluded.payload")
        .run(owner, sample.date, JSON.stringify(record));
      change.changes ? saved++ : skipped++;
    }
    const empty = !batch.bodyMass.length && !batch.workouts.length && !batch.activity.length;
    const received = batch.selected.filter((type) => {
      if (type === "bodyMass") return batch.bodyMass.length > 0;
      if (type === "workouts") return batch.workouts.length > 0;
      if (type === "activeEnergy" && batch.workouts.some((record) => record.activeEnergyKcal !== undefined)) return true;
      const metric = type === "steps" ? "steps" : type === "activeEnergy" ? "activeEnergyKcal" : "exerciseMinutes";
      return batch.activity.some((record) => record[metric] !== undefined);
    });
    const result: HealthSyncResult = { at: Date.now(), result: empty ? "empty" : "synced", saved, skipped, empty, selected: batch.selected, received, emptyTypes: batch.selected.filter((type) => !received.includes(type)), from: batch.from, to: batch.to };
    recordHealthSync(owner, result);
    return result;
  });
}

export function healthOverview(owner: string): HealthOverview {
  const read = <T>(table: string, order: string, limit = 30) => (database().prepare(`SELECT payload FROM ${table} WHERE owner = ? ORDER BY ${order} DESC LIMIT ?`).all(owner, limit) as { payload: string }[]).map((row) => JSON.parse(row.payload) as T);
  const workouts: HealthWorkout[] = [];
  for (const record of read<HealthWorkout>("health_workout", "started", 300)) {
    const item = { ...record, matchedWorkoutId: matchedWorkout(owner, record.from, record.to) };
    // Two apps may write the same system workout with different HealthKit UUIDs.
    // Merge only convincing cross-source copies of one uniquely matched check-in.
    const duplicate = workouts.find((prior) => {
      const overlap = Math.min(item.to, prior.to) - Math.max(item.from, prior.from);
      return item.matchedWorkoutId !== null && item.matchedWorkoutId === prior.matchedWorkoutId &&
        item.activity === prior.activity && !(prior.sourceIds ?? [prior.sourceId]).includes(item.sourceId) &&
        Math.abs(item.from - prior.from) <= 60_000 && Math.abs(item.to - prior.to) <= 60_000 &&
        overlap / Math.max(item.to - item.from, prior.to - prior.from) >= 0.9;
    });
    if (duplicate) {
      duplicate.sourceNames = [...new Set([...(duplicate.sourceNames ?? [duplicate.sourceName]), item.sourceName])];
      duplicate.sourceIds = [...new Set([...(duplicate.sourceIds ?? [duplicate.sourceId]), item.sourceId])];
      duplicate.sourceName = duplicate.sourceNames.join(" · ");
    } else workouts.push(item);
  }
  return {
    bodyMass: read<BodyMassRecord>("health_body_mass", "at"),
    activity: read<ActivityRecord>("health_activity", "date"),
    workouts: workouts.slice(0, 30),
  };
}
