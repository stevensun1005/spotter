"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  hasWorkoutCheckinKey, isCheckinQueued, queueCheckin, readCheckins, replayCheckin,
  type CheckinReceipt, type CheckinUpload, type QueuedCheckin,
} from "./checkin-outbox";

export function useCheckinOutbox(
  owner: string | undefined, send: (body: CheckinUpload) => Promise<CheckinReceipt>,
  receive: (record: QueuedCheckin) => void, refresh: () => Promise<void>,
) {
  const [pending, setPending] = useState<QueuedCheckin[]>([]);
  const inFlight = useRef(new Set<string>());

  const load = useCallback(() => {
    let next: QueuedCheckin[] = [];
    if (owner) {
      try { next = readCheckins(localStorage, owner); } catch { /* Browser storage may be disabled. */ }
    }
    setPending(next);
    return next;
  }, [owner]);

  const flush = useCallback(async () => {
    if (!owner) return;
    for (const item of load()) {
      if (!navigator.onLine) break;
      const flightKey = owner + ":" + item.id;
      if (inFlight.current.has(flightKey)) continue;
      inFlight.current.add(flightKey);
      try {
        const received = await replayCheckin(localStorage, owner, item.id, send);
        if (received) receive(received);
      } catch { /* Keep the local check-in available for the next successful sync. */ }
      finally { inFlight.current.delete(flightKey); }
    }
    load();
  }, [load, owner, receive, send]);

  const enqueue = useCallback((id: string, receipt: CheckinReceipt) => {
    if (!owner) throw new Error("请登录后保存。");
    let item: QueuedCheckin;
    try { item = queueCheckin(localStorage, owner, id, receipt); }
    catch { throw new Error("本机无法保存打卡。训练草稿仍可继续，请检查浏览器存储空间。"); }
    load();
    void flush();
    return item;
  }, [flush, load, owner]);

  const has = useCallback((id: string) => {
    if (!owner) return false;
    try { return isCheckinQueued(localStorage, owner, id); }
    catch { return false; }
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    const wake = () => { void flush(); };
    const onStorage = (event: StorageEvent) => {
      if (!hasWorkoutCheckinKey(owner, event.key)) return;
      if (event.newValue === null && navigator.onLine) void refresh().then(wake);
      else wake();
    };
    wake();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") wake(); }, 15_000);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("storage", onStorage);
    };
  }, [flush, owner, refresh]);

  return { pending: pending.filter((entry) => entry.owner === owner), enqueue, has };
}
