"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { send } from "@/shared/client";
import { libraryItem, type LibraryItem, type LibraryRow } from "./model";
import type { RecentMealFood } from "@/features/nutrition/recent-foods";

function matches(a: LibraryItem, b: LibraryItem) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "exercise" && b.kind === "exercise") return a.item.name === b.item.name;
  if (a.kind === "targets" || a.kind === "nutrition-plan" || a.kind === "schedule" || a.kind === "stats-pins" || a.kind === "protein-preference" || a.kind === "body-profile") return true;
  return "id" in a && "id" in b && a.id === b.id;
}

export function useLibrary(enabled: boolean, date?: string, body = false) {
  const url = "/api/library" + (body ? "?section=body" : date ? "?date=" + encodeURIComponent(date) : "");
  const [state, setState] = useState<{ url: string; rows: LibraryRow[]; recentMeals?: RecentMealFood[]; error: string }>();
  const revision = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const generation = ++revision.current;
    if (!enabled) return;
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const { rows, recentMeals } = await response.json() as { rows: LibraryRow[]; recentMeals?: RecentMealFood[] };
      if (!signal?.aborted && generation === revision.current) setState({ url, rows, recentMeals, error: "" });
    } catch {
      if (!signal?.aborted && generation === revision.current) {
        setState((prev) => ({ url, rows: prev?.url === url ? prev.rows : [],
          recentMeals: prev?.url === url ? prev.recentMeals : undefined, error: "云端记录读取失败，请重试。" }));
      }
    }
  }, [enabled, url]);

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);

  async function save(item: LibraryItem, expected?: string | null) {
    if (!enabled) throw new Error("登录后可以保存记录。");
    const valid = libraryItem.safeParse(item);
    if (!valid.success) throw new Error("请检查字段长度、数值或视频链接。");
    const response = await send("/api/library", { action: "save", data: valid.data, revision: expected });
    const { updated } = await response.json() as { updated: string };
    revision.current++;
    setState((prev) => ({ url, error: "", recentMeals: prev?.url === url ? prev.recentMeals : undefined, rows: [
      { ...valid.data, updated: updated ?? new Date().toISOString() },
      ...(prev?.url === url ? prev.rows : []).filter((row) => !matches(row, valid.data)),
    ] }));
    void load();
  }

  async function remove(kind: "template" | "nutrition", id: string, expected?: string) {
    await send("/api/library", { action: "remove", kind, id, revision: expected });
    revision.current++;
    setState((prev) => prev && { ...prev, rows: prev.rows.filter((row) => row.kind !== kind || row.id !== id) });
    if (kind === "nutrition" && date) void load();
  }

  return { rows: state?.url === url ? state.rows : [], recentMeals: state?.url === url ? state.recentMeals ?? [] : [], error: state?.url === url ? state.error : "",
    loading: enabled && state?.url !== url, load, save, remove };
}
