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

type RunningClock = { started: number; clock: { elapsed: number; runningSince: number } };

function readRunningClock(raw: string | null): RunningClock | undefined {
  if (!raw) return;
  try {
    const value = JSON.parse(raw) as RunningClock | null;
    if (value && Number.isSafeInteger(value.started) && value.started > 0 && value.clock &&
        Number.isSafeInteger(value.clock.elapsed) && value.clock.elapsed >= 0 && value.clock.elapsed <= maxWorkoutMs &&
        Number.isSafeInteger(value.clock.runningSince) && value.clock.runningSince > 0) {
      return { started: value.started, clock: { elapsed: value.clock.elapsed, runningSince: value.clock.runningSince } };
    }
  } catch { /* A malformed marker is treated as a closed session. */ }
}

export function makeWorkoutTabClocks(key: string) {
  const memory = new Map<string, RunningClock | undefined>();
  const storageKey = (id: string) => key + ":clock:" + id;

  function read(id: string) {
    if (memory.has(id)) return memory.get(id);
    try {
      if (typeof window !== "undefined") return readRunningClock(window.sessionStorage.getItem(storageKey(id)));
    } catch { /* Storage can be unavailable in private or embedded browsers. */ }
  }

  function write(id: string, marker: RunningClock | undefined) {
    memory.set(id, marker);
    try {
      if (typeof window === "undefined") return;
      if (marker) window.sessionStorage.setItem(storageKey(id), JSON.stringify(marker));
      else {
        window.sessionStorage.removeItem(storageKey(id));
        memory.delete(id);
      }
    } catch { /* The in-memory marker is sufficient while this document is open. */ }
  }

  return {
    remember(id: string, data: Session) {
      const { started, clock } = data;
      write(id, clock?.runningSince == null ? undefined : { started, clock: { elapsed: clock.elapsed, runningSince: clock.runningSince } });
    },
    restore(id: string, data: Session): Session {
      const marker = read(id);
      if (marker?.started === data.started) {
        const current = data.clock;
        if (current?.elapsed === marker.clock.elapsed && current.runningSince === marker.clock.runningSince) return data;
        return { ...data, clock: { ...marker.clock } };
      }
      if (marker) write(id, undefined);
      const since = data.clock?.runningSince;
      // A draft from a closed tab or an older version keeps its saved time.
      return since == null ? data : pauseClock(data, since);
    },
    forget(id: string) { write(id, undefined); },
    has(id: string) { return read(id) !== undefined; },
  };
}
