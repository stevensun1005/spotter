export type WorkoutReminder = { enabled: boolean; time: string };
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export const defaultWorkoutReminder: WorkoutReminder = { enabled: false, time: "18:00" };
export const isReminderTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export const reminderKey = (owner: string) => "spotter:workout-reminder:" + owner;

export function readWorkoutReminder(storage: StorageAccess, owner: string): WorkoutReminder {
  try {
    const value = JSON.parse(storage.getItem(reminderKey(owner)) ?? "null") as Partial<WorkoutReminder> | null;
    if (value && typeof value.enabled === "boolean" && isReminderTime(value.time)) return { enabled: value.enabled, time: value.time };
  } catch { /* Invalid or inaccessible browser preferences use the default. */ }
  return defaultWorkoutReminder;
}

export function claimWorkoutReminder(storage: StorageAccess, owner: string, date: string, time: string) {
  const preference = readWorkoutReminder(storage, owner);
  if (!preference.enabled || time < preference.time) return false;
  const delivered = "spotter:workout-reminder-delivered:" + owner;
  if (storage.getItem(delivered) === date) return false;
  storage.setItem(delivered, date);
  return true;
}
