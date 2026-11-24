import assert from "node:assert/strict";
import { test } from "node:test";
import { makeWorkoutTabClocks, pauseClock, resumeClock, workoutElapsed } from "../features/training/clock.ts";

const started = 1795478400000;
const workout = { started, clock: { elapsed: 0, runningSince: started }, rest: { until: 60_000 } };

function tab(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: storage } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
  return values;
}

test("a background gap counts toward the live workout and rest deadline", (t) => {
  tab(t);
  const clocks = makeWorkoutTabClocks("account");
  clocks.remember("workout", workout);
  const hiddenAt = started + 25_000;
  const returnedAt = hiddenAt + 50_000;
  const checkpoint = pauseClock(workout, hiddenAt);
  assert.equal(workoutElapsed(checkpoint, returnedAt), 25_000);
  const live = clocks.restore("workout", checkpoint);
  assert.equal(workoutElapsed(live, returnedAt), 75_000);
  assert.ok(workoutElapsed(live, returnedAt) >= live.rest.until);
});

test("the same tab restores a running clock on reload while a fresh tab uses the saved time", (t) => {
  const values = tab(t);
  const clocks = makeWorkoutTabClocks("account");
  const initial = resumeClock(pauseClock(workout, started + 5_000), started + 10_000);
  const checkpoint = pauseClock(initial, started + 15_000);
  const reopenedAt = started + 100_000;
  clocks.remember("workout", initial);
  assert.deepEqual([...values.values()].map((value) => JSON.parse(value)), [{ started, clock: initial.clock }]);
  assert.equal(workoutElapsed(makeWorkoutTabClocks("account").restore("workout", checkpoint), reopenedAt), 95_000);
  values.clear();
  const fresh = makeWorkoutTabClocks("account");
  assert.strictEqual(fresh.restore("workout", checkpoint), checkpoint);
  assert.equal(workoutElapsed(fresh.restore("workout", initial), reopenedAt), 5_000);
});

test("minimized workouts stay separate and explicit pause or finish clears their own marker", (t) => {
  tab(t);
  const clocks = makeWorkoutTabClocks("account");
  const another = { ...workout, started: started + 15_000, clock: { elapsed: 0, runningSince: started + 15_000 } };
  clocks.remember("one", workout);
  clocks.remember("two", another);
  const now = started + 45_000;
  assert.equal(workoutElapsed(clocks.restore("one", pauseClock(workout, started + 10_000)), now), 45_000);
  assert.equal(workoutElapsed(clocks.restore("two", pauseClock(another, started + 20_000)), now), 30_000);
  assert.equal(makeWorkoutTabClocks("other-account").has("one"), false);
  const stopped = pauseClock(workout, now);
  clocks.remember("one", stopped);
  assert.equal(clocks.has("one"), false);
  assert.strictEqual(clocks.restore("one", stopped), stopped);
  assert.equal(makeWorkoutTabClocks("account").has("one"), false);
  assert.equal(clocks.has("two"), true);
  clocks.forget("two");
  assert.equal(makeWorkoutTabClocks("account").has("two"), false);
});

test("invalid and mismatched saved markers cannot start a draft", (t) => {
  const values = tab(t);
  const clocks = makeWorkoutTabClocks("account");
  clocks.remember("workout", workout);
  const [key] = values.keys();
  values.set(key, JSON.stringify({ started, clock: { elapsed: -1, runningSince: started } }));
  assert.equal(makeWorkoutTabClocks("account").has("workout"), false);
  values.set(key, "{");
  assert.equal(makeWorkoutTabClocks("account").has("workout"), false);
  values.set(key, JSON.stringify({ started: started + 1, clock: workout.clock }));
  const newDocument = makeWorkoutTabClocks("account");
  assert.equal(workoutElapsed(newDocument.restore("workout", workout), started + 90_000), 0);
  assert.equal(newDocument.has("workout"), false);
});

test("unavailable session storage keeps a running marker only in the current instance", (t) => {
  const clocks = makeWorkoutTabClocks("account");
  assert.equal(clocks.has("workout"), false);
  tab(t);
  Object.defineProperty(window, "sessionStorage", { get() { throw new Error("storage disabled"); } });
  clocks.remember("workout", workout);
  assert.equal(workoutElapsed(clocks.restore("workout", pauseClock(workout, started)), started + 60_000), 60_000);
  assert.equal(makeWorkoutTabClocks("account").has("workout"), false);
  clocks.forget("workout");
  assert.equal(clocks.has("workout"), false);
});
