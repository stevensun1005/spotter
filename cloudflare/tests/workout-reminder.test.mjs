import assert from "node:assert/strict";
import { test } from "node:test";
import { claimWorkoutReminder, isReminderTime, readWorkoutReminder, reminderKey } from "../features/settings/reminder-model.ts";

test("daily workout reminders respect time, deduplicate by account and date, and recover from invalid settings", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const date = "2026-11-24";
  const owner = "synthetic";
  const other = "synthetic-other";
  assert.equal(claimWorkoutReminder(storage, owner, date, "19:00"), false);
  storage.setItem(reminderKey(owner), JSON.stringify({ enabled: true, time: "24:00" }));
  assert.equal(isReminderTime("24:00"), false);
  assert.equal(readWorkoutReminder(storage, owner).enabled, false);
  storage.setItem(reminderKey(owner), JSON.stringify({ enabled: true, time: "18:45" }));
  assert.equal(claimWorkoutReminder(storage, owner, date, "18:44"), false);
  assert.equal(claimWorkoutReminder(storage, owner, date, "18:45"), true);
  assert.equal(claimWorkoutReminder(storage, owner, date, "19:00"), false);
  assert.equal(claimWorkoutReminder(storage, other, date, "19:00"), false);
  storage.setItem(reminderKey(other), JSON.stringify({ enabled: true, time: "18:45" }));
  assert.equal(claimWorkoutReminder(storage, other, date, "19:00"), true);
  assert.equal(claimWorkoutReminder(storage, owner, "2026-11-25", "19:00"), true);
});
