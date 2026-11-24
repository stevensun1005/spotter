export function workoutDraftsKey(owner: string) {
  return `spotter-drafts:${owner}`;
}

export function workoutClocksKey(owner: string) {
  return `spotter-workout-clocks:${owner}`;
}

export function clearDeletedAccountBrowserData(owner: string, browser: Pick<Window, "localStorage" | "sessionStorage">) {
  if (!owner) return;
  try {
    const local = browser.localStorage;
    const accountKeys = [workoutDraftsKey(owner), `spotter:nutrition-cache:${owner}`,
      `spotter:workout-reminder:${owner}`, `spotter:workout-reminder-delivered:${owner}`,
      `spotter:anthropic-sharing:v1:${owner}`];
    for (const key of accountKeys) local.removeItem(key);
    clearKeysWithPrefix(local, `spotter-checkin:${encodeURIComponent(owner)}:`);
  } catch { /* Browser storage may be unavailable. */ }
  try {
    clearKeysWithPrefix(browser.sessionStorage, `${workoutClocksKey(owner)}:clock:`);
  } catch { /* Tab storage may be unavailable. */ }
}

function clearKeysWithPrefix(storage: Storage, prefix: string) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) storage.removeItem(key);
  }
}
