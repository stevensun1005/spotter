"use client";

import { useEffect, useState } from "react";
export { fromCatalogue, searchable } from "./catalogue-identity";

export type CatalogEntry = {
  id: string; name: string; en: string; part: string; equipment: string; type: string;
  muscles: Record<string, number>; target: string; hold?: boolean; distance?: boolean;
  needs?: string[]; machine?: string; animation?: boolean;
};
export type ExerciseChoice = {
  name: string; catalogueId?: string; sourceName?: string; cue?: string;
  tempo?: string; seconds?: number; reps?: number; trainingCategory?: string;
};
export type CatalogDetail = { description: string; steps: string[]; language?: "zh" };

export type Catalog = { rows: CatalogEntry[]; variants: Record<string, string> };
let index: Promise<Catalog> | undefined;
const shards = new Map<number, Promise<Record<string, CatalogDetail>>>();

export async function catalogAsset<T>(file: string): Promise<T> {
  const response = await fetch("/open-gym/" + file);
  if (!response.ok) throw new Error("无法读取动作库，请重试。");
  return response.json() as Promise<T>;
}

function catalogue() {
  index ??= catalogAsset<Catalog>("index.json").catch((error) => { index = undefined; throw error; });
  return index;
}

export function useCatalogue() {
  const [data, setData] = useState<Catalog>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    catalogue().then((value) => { if (active) setData(value); }, () => { if (active) setError("无法读取动作库，请重试。"); });
    return () => { active = false; };
  }, [retry]);
  return { data, error, reload: () => setRetry((value) => value + 1) };
}

export function useCatalogDetail(id: string | undefined) {
  const [entry, setEntry] = useState<{ id: string; data?: CatalogDetail; error?: boolean }>();
  useEffect(() => {
    if (!id || !/^\d{4,6}$/.test(id)) return;
    let active = true;
    const shard = Math.floor(Number(id) / 100);
    const promise = shards.get(shard) ?? catalogAsset<Record<string, CatalogDetail>>("details/" + shard + ".json")
      .catch((error) => { shards.delete(shard); throw error; });
    shards.set(shard, promise);
    promise.then((data) => { if (active) setEntry({ id, data: data[id] }); }, () => { if (active) setEntry({ id, error: true }); });
    return () => { active = false; };
  }, [id]);
  return entry?.id === id ? entry : undefined;
}
