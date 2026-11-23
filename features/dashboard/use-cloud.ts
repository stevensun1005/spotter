"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { asDate } from "@/shared/dates";
import type { Entry, Person, State } from "@/shared/state";

export function useCloud(viewer: Person, initialDate: string) {
  const [today, setToday] = useState(initialDate);
  const [state, setState] = useState<State>({ me: viewer, entries: [], room: null });
  const [status, setStatus] = useState("正在连接");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++generation.current;
    try {
      const response = await fetch("/api/state", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        if (id === generation.current && response.status === 401) setStatus("登录已失效");
        else throw new Error();
        return;
      }
      const next: State = await response.json();
      if (id === generation.current) { setState(next); setStatus("云端已连接"); }
    } catch {
      if (id === generation.current) setStatus("云端连接异常");
    }
  }, []);

  const saveInView = useCallback((entry: Entry) => {
    generation.current++;
    setState((value) => {
      const sameEntry = (row: Entry) => row.id === entry.id && row.owner === entry.owner;
      if (entry.kind === "draft" && value.entries.some((row) => sameEntry(row) && row.kind === "log")) return value;
      return { ...value, entries: [entry, ...value.entries.filter((row) => !sameEntry(row))] };
    });
  }, []);

  useEffect(() => {
    const update = () => { setToday(asDate()); void refresh(); };
    update();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 15000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
  }, [refresh]);

  return { today, state, status, refresh, saveInView };
}
