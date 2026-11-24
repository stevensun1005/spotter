export const restReminderOptions = [
  ["visual", "仅画面提示"], ["sound", "画面＋声音"], ["vibration", "画面＋震动"], ["both", "画面＋声音与震动"],
] as const;
export type RestReminderMode = typeof restReminderOptions[number][0];

export function restReminderMode(value: unknown): RestReminderMode {
  return restReminderOptions.find(([mode]) => mode === value)?.[0] ?? "visual";
}

type RestSnapshot = { until: number | undefined; elapsed: number };

export function crossedRestDeadline(before: RestSnapshot | undefined, after: RestSnapshot) {
  return before?.until !== undefined && before.until === after.until &&
    before.elapsed < before.until && after.elapsed >= before.until;
}
