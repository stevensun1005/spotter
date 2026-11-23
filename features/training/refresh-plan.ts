import type { Plan } from "@/features/plans/model";
import type { Session, SetLine } from "./model";

function untouched(line: SetLine, previous: Plan["exercises"][number]) {
  return !line.done && !line.kind && !line.right && line.rpe === undefined &&
    line.reps === previous.reps && line.weight === previous.weight && line.seconds === previous.seconds;
}

export function refreshDraftPlan(session: Session, latest: Plan | undefined): Session {
  if (!latest || session.plan.exercises.length !== latest.exercises.length ||
    session.plan.exercises.some((move, index) => move.name !== latest.exercises[index].name || move.unit !== latest.exercises[index].unit)) return session;
  if (session.plan.minutes === latest.minutes && session.plan.durationNote === latest.durationNote &&
    session.plan.exercises.every((move, index) => JSON.stringify(move) === JSON.stringify(latest.exercises[index]))) return session;
  const exercises = latest.exercises.map((move, index) => {
    const original = session.plan.exercises[index];
    const lines = session.rows[index];
    const lastEdited = lines.findLastIndex((line) => !untouched(line, original));
    return { ...move, sets: Math.max(move.sets, lastEdited + 1) };
  });
  const rows = exercises.map((move, index) => Array.from({ length: move.sets }, (_, set) => {
    const line = session.rows[index][set];
    if (line && !untouched(line, session.plan.exercises[index])) return line;
    return { reps: move.reps, weight: move.weight, seconds: move.seconds, done: false };
  }));
  return { ...session, rows, plan: { ...session.plan, exercises, minutes: latest.minutes, durationNote: latest.durationNote } };
}
