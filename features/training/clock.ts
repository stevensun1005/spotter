import type { Session } from "./model";

export const maxWorkoutMs = 86_400_000;

export function workoutElapsed(session: Session, now = Date.now()) {
  const clock = session.clock;
  if (!clock) return 0;
  const since = clock.runningSince;
  return Math.min(maxWorkoutMs, clock.elapsed + (since === null ? 0 : Math.max(0, now - since)));
}

export function pauseClock(session: Session, now = Date.now()): Session {
  if (session.clock?.runningSince == null) return session;
  return { ...session, clock: { elapsed: workoutElapsed(session, now), runningSince: null } };
}

export function resumeClock(session: Session, now = Date.now()): Session {
  if (session.clock?.runningSince != null) return session;
  return { ...session, clock: { elapsed: workoutElapsed(session), runningSince: now } };
}
