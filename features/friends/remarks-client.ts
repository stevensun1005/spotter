"use client";

import { useEffect, useRef, useState } from "react";
import { send } from "@/shared/client";

const endpoint = "/api/social/remarks";
const noRemarks: Readonly<Record<string, string>> = Object.create(null);
export const remarkLengthLimit = 40;

export type ContactRemarks = {
  values: Readonly<Record<string, string>>;
  ready: boolean;
  error?: string;
  retry: () => void;
  save: (id: string, remark: string) => Promise<void>;
};

type Snapshot = { owner: string; values: ContactRemarks["values"]; error?: string };

export function useContactRemarks(owner?: string): ContactRemarks {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [attempt, setAttempt] = useState(0);
  const edits = useRef(new Map<string, number>());
  useEffect(() => {
    if (!owner) return;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const stamp = edits.current.get(owner);
      try {
        const response = await fetch(endpoint + "?" + new URLSearchParams({ expectedOwner: owner }), {
          cache: "no-store", signal: current.signal,
        });
        if (!response.ok) throw new Error("备注暂时无法读取。");
        const { remarks } = await response.json() as { remarks: Record<string, string> };
        if (!current.signal.aborted && stamp === edits.current.get(owner)) setSnapshot({ owner, values: remarks });
      } catch {
        if (current.signal.aborted || stamp !== edits.current.get(owner)) return;
        setSnapshot({ owner, values: noRemarks, error: "备注暂时无法读取。" });
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller?.abort();
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [owner, attempt]);

  const current = owner && snapshot?.owner === owner ? snapshot : undefined;
  return {
    values: current?.values ?? noRemarks,
    error: current?.error,
    ready: Boolean(current && !current.error),
    retry: () => setAttempt((value) => value + 1),
    async save(id, remark) {
      if (!owner) return;
      const response = await send(endpoint, { id, remark, expectedOwner: owner }, "PATCH");
      const saved = await response.json() as { id: string; remark: string | null };
      if (saved.id !== id) throw new Error("备注保存未确认，请重试。");
      edits.current.set(owner, (edits.current.get(owner) ?? 0) + 1);
      setSnapshot((value) => {
        if (value?.owner !== owner) return value;
        const values = { ...value.values };
        if (saved.remark === null) delete values[id];
        else values[id] = saved.remark;
        return { owner, values };
      });
    },
  };
}
