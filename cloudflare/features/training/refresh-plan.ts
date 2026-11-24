import { parsePlanMove } from "@/features/exercises/move-name";
import type { Move, Plan } from "@/features/plans/model";
import type { Session, SetLine } from "./model";

function untouched(line: SetLine, previous: Move) {
  return !line.done && !line.kind && !line.right && line.rpe === undefined &&
    line.reps === previous.reps && line.weight === previous.weight && line.seconds === previous.seconds;
}

function sameMove(previous: Move, current: Move) {
  const before = parsePlanMove(previous.name);
  const after = parsePlanMove(current.name);
  const beforeSlot = previous.sourceSlot ?? before.sourceSlot;
  const afterSlot = current.sourceSlot ?? after.sourceSlot;
  if (previous.unit !== current.unit || beforeSlot !== afterSlot) return false;
  if (previous.catalogueId && current.catalogueId) return previous.catalogueId === current.catalogueId;
  return before.name === (current.sourceName ?? after.name) || before.name === after.name;
}

export function refreshDraftPlan(session: Session, latest: Plan | undefined): Session {
  const previous = session.plan;
  if (!latest || previous.exercises.length !== latest.exercises.length) return session;
  if (previous.minutes === latest.minutes && previous.durationNote === latest.durationNote &&
    previous.defaultRestSeconds === latest.defaultRestSeconds &&
    JSON.stringify(previous.exercises) === JSON.stringify(latest.exercises)) return session;
  const indexes = latest.exercises.map((move, index) => {
    if (!move.sourceSlot && sameMove(previous.exercises[index], move)) return index;
    const matches = previous.exercises.flatMap((item, i) => sameMove(item, move) ? [i] : []);
    return matches.length === 1 ? matches[0] : -1;
  });
  if (indexes.includes(-1) || new Set(indexes).size !== indexes.length) return session;
  const exercises = latest.exercises.map((move, index) => {
    const source = indexes[index];
    const lastEdited = session.rows[source].findLastIndex((line) => !untouched(line, previous.exercises[source]));
    return { ...move, sets: Math.max(move.sets, lastEdited + 1) };
  });
  const rows = exercises.map((move, index) => Array.from({ length: move.sets }, (_, set) => {
    const source = indexes[index];
    const line = session.rows[source][set];
    if (line && !untouched(line, previous.exercises[source])) return line;
    return { reps: move.reps, weight: move.weight, seconds: move.seconds, done: false };
  }));
  return {
    ...session, rows,
    plan: { ...previous, exercises, minutes: latest.minutes, durationNote: latest.durationNote, defaultRestSeconds: latest.defaultRestSeconds },
  };
}
