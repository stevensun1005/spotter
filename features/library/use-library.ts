"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { send } from "@/shared/client";
import { libraryItem, type LibraryItem, type LibraryRow } from "./model";

function matches(a: LibraryItem, b: LibraryItem) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "exercise" && b.kind === "exercise") return a.item.name === b.item.name;
  if (a.kind === "targets" || a.kind === "schedule") return true;
  return "id" in a && "id" in b && a.id === b.id;
}

export function useLibrary(enabled: boolean, date?: string) {
  const url = "/api/library" + (date ? "?date=" + encodeURIComponent(date) : "");
  const [state, setState] = useState<{ url: string; rows: LibraryRow[]; error: string }>();
  const revision = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const generation = ++revision.current;
    if (!enabled) return;
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const { rows } = await response.json() as { rows: LibraryRow[] };
      if (!signal?.aborted && generation === revision.current) setState({ url, rows, error: "" });
    } catch {
      if (!signal?.aborted && generation === revision.current) {
        setState((prev) => ({ url, rows: prev?.url === url ? prev.rows : [], error: "云端记录读取失败，请重试。" }));
      }
    }
  }, [enabled, url]);

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);

  async function save(item: LibraryItem) {
    if (!enabled) throw new Error("登录后可以保存记录。");
    const valid = libraryItem.safeParse(item);
    if (!valid.success) throw new Error("请检查字段长度、数值或视频链接。");
    await send("/api/library", { action: "save", data: valid.data });
    revision.current++;
    setState((prev) => ({ url, error: "", rows: [
      { ...valid.data, updated: new Date().toISOString() },
      ...(prev?.url === url ? prev.rows : []).filter((row) => !matches(row, valid.data)),
    ] }));
    void load();
  }

  async function remove(kind: "template" | "nutrition", id: string) {
    await send("/api/library", { action: "remove", kind, id });
    revision.current++;
    setState((prev) => prev && { ...prev, rows: prev.rows.filter((row) => row.kind !== kind || row.id !== id) });
  }

  return { rows: state?.url === url ? state.rows : [], error: state?.url === url ? state.error : "",
    loading: enabled && state?.url !== url, load, save, remove };
}
