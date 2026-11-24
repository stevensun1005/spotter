"use client";

import { useEffect } from "react";

export function useWorkoutWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return;
    let released = false;
    let requesting = false;
    let lock: WakeLockSentinel | undefined;
    async function acquire() {
      if (released || requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        const current = await navigator.wakeLock.request("screen");
        if (released) await current.release();
        else lock = current;
      } catch { /* A browser or low-power mode can deny the lock. */ }
      finally { requesting = false; }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", acquire);
      if (lock) void lock.release().catch(() => undefined);
    };
  }, [enabled]);
}
