"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { asDate } from "@/shared/dates";
import { ClientError, errorText, send } from "@/shared/client";
import { isTraining, type Entry } from "@/shared/state";
import type { PlannedWorkout } from "@/features/plans/model";
import { startSession, type Session } from "./model";

type OpenWorkout = { id: string; data: Session };

export function useTraining(owner: string, allEntries: Entry[], refresh: () => Promise<void>, saveInView: (entry: Entry) => void, notify: (text: string) => void) {
  const key = "spotter-drafts:" + owner;
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, Session>>({});
  const pendingRef = useRef<Record<string, Session>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const [active, setActive] = useState<OpenWorkout | null>(null);
  const [cached, setCached] = useState(false);
  const [sync, setSync] = useState("正在保存");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setPending = useCallback((next: Record<string, Session>) => {
    pendingRef.current = next;
    setPendingDrafts(next);
    try { localStorage.setItem(key, JSON.stringify(next)); return true; }
    catch { return false; }
  }, [key]);

  const flushDraft = useCallback((id: string, data: Session) => {
    queue.current = queue.current.then(async () => {
      if (pendingRef.current[id] !== data) return;
      setSync("正在保存");
      try {
        await send("/api/training", { action: "draft", id, data });
        saveInView({ id, owner, data, kind: "draft", updated: new Date().toISOString() });
        if (pendingRef.current[id] === data) {
          const next = { ...pendingRef.current };
          delete next[id];
          setPending(next);
          setSync("云端已保存");
        }
        void refresh();
      } catch (reason) {
        if (reason instanceof ClientError && reason.status === 409) {
          const next = { ...pendingRef.current };
          delete next[id];
          setPending(next);
          setSync("已在其他设备打卡");
          void refresh();
        } else setSync("草稿待同步");
      }
    });
  }, [owner, setPending, refresh, saveInView]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "{}");
      if (cached && typeof cached === "object" && !Array.isArray(cached)) setPending(cached);
    } catch { /* Recovery can continue from the server when device storage is unavailable. */ }
    setCached(true);
    const retry = () => {
      for (const [id, data] of Object.entries(pendingRef.current)) flushDraft(id, data);
    };
    retry();
    const timer = setInterval(() => { if (document.visibilityState === "visible") retry(); }, 15000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(timer);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      window.removeEventListener("online", retry);
    };
  }, [key, flushDraft, setPending]);

  const sessions = allEntries.filter(isTraining);
  const drafts = [
    ...Object.entries(pendingDrafts).map(([id, data]) => ({ id, data, pending: true })),
    ...sessions.filter((row) => row.owner === owner && row.kind === "draft" && !pendingDrafts[row.id]).map(({ id, data }) => ({ id, data, pending: false })),
  ].filter(({ id }) => !sessions.some((row) => row.owner === owner && row.id === id && row.kind === "log"));

  function updateDraft(id: string, data: Session) {
    const cached = setPending({ ...pendingRef.current, [id]: data });
    setSync(cached ? "草稿待同步" : "保存中，请保持页面打开");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushDraft(id, data), 420);
  }

  function resume(item: OpenWorkout) {
    setActive(item);
    setError("");
    setSync(pendingRef.current[item.id] ? "草稿待同步" : "云端已保存");
  }

  function begin(item: PlannedWorkout) {
    const date = asDate();
    const existing = drafts.find(({ data }) => data.planId === item.id && data.date === date);
    if (existing) { resume(existing); return existing.id; }
    const id = crypto.randomUUID();
    const data = startSession(item.data, item.id, date);
    setError("");
    setActive({ id, data });
    updateDraft(id, data);
    return id;
  }

  function close() {
    if (busy) return;
    if (active && pendingRef.current[active.id]) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flushDraft(active.id, pendingRef.current[active.id]);
    }
    setActive(null);
    setError("");
  }

  function update(data: Session) {
    if (!active) return;
    setActive({ ...active, data });
    updateDraft(active.id, data);
  }

  async function finish() {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await queue.current;
      const { id, data } = active;
      const minutes = data.minutes || Math.min(720, Math.max(1, Math.round((Date.now() - data.started) / 60000)));
      const ended = Math.max(data.started, Date.now());
      const finalized = { ...data, minutes, ended: ended - data.started <= 86_400_000 ? ended : undefined };
      await send("/api/training", { action: "log", id, data: finalized });
      const next = { ...pendingRef.current };
      delete next[id];
      setPending(next);
      const logged = { id, owner, kind: "log", data: finalized, updated: new Date().toISOString() } as const;
      saveInView(logged);
      void refresh();
      notify("训练已打卡并保存到云端");
      setActive(null);
      return logged;
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return { active, cached, drafts, begin, resume, close, update, finish, busy, error, sync };
}
