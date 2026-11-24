"use client";

import { useEffect, useState } from "react";
import { libraryItem, type LibraryRow } from "@/features/library/model";

const maxCachedDays = 14;
const clearEvent = "spotter:nutrition-cache-cleared";
const cacheKey = (owner: string) => `spotter:nutrition-cache:${owner}`;
type CacheDay = { date: string; rows: LibraryRow[] };

const cacheable = (row: LibraryRow) => row.kind === "targets" || row.kind === "nutrition-plan" ||
  (row.kind === "nutrition" && (row.entry.type === "meal" || row.entry.type === "water"));

function readCache(owner: string): CacheDay[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "[]") as CacheDay[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.date === "string" && Array.isArray(item.rows)) : [];
  } catch { return []; }
}

export function clearNutritionCache(owner: string) {
  try { localStorage.removeItem(cacheKey(owner)); } catch { /* Browser storage unavailable. */ }
  window.dispatchEvent(new CustomEvent(clearEvent, { detail: owner }));
}

export function useNutritionCache(owner: string, date: string, enabled: boolean, state: { rows: LibraryRow[]; loading: boolean; error: string }) {
  const { rows, loading, error } = state;
  const [snapshot, setSnapshot] = useState<{ owner: string; date: string; rows?: LibraryRow[] }>();
  useEffect(() => {
    if (!owner || !enabled || !error) return;
    const refresh = () => {
      const item = readCache(owner).find((day) => day.date === date);
      const cached = item?.rows.filter((row) => row && typeof row.updated === "string" && libraryItem.safeParse(row).success && cacheable(row));
      setSnapshot({ owner, date, rows: cached });
    };
    const clear = (event: Event) => { if ((event as CustomEvent<string>).detail === owner) refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === cacheKey(owner) || event.key === null) refresh(); };
    refresh();
    window.addEventListener(clearEvent, clear);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(clearEvent, clear);
      window.removeEventListener("storage", storage);
    };
  }, [owner, date, enabled, error]);

  useEffect(() => {
    if (!owner || !enabled || loading || error) return;
    const item = { date, rows: rows.filter(cacheable).map((row) => row.kind === "targets"
      ? { kind: row.kind, values: row.values, updated: row.updated } : row) };
    const days = [item, ...readCache(owner).filter((day) => day.date !== date)].slice(0, maxCachedDays);
    try { localStorage.setItem(cacheKey(owner), JSON.stringify(days)); } catch { /* Live data still works. */ }
  }, [owner, date, enabled, rows, loading, error]);

  const fallback = enabled && error && snapshot?.owner === owner && snapshot.date === date ? snapshot.rows : undefined;
  return { rows: fallback ?? rows, cached: fallback !== undefined };
}
