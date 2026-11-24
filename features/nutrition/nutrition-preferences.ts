"use client";

import { useEffect, useState } from "react";
import { mealTypes, nutritionValues, type MealEntry, type NutritionValues } from "@/features/library/model";

export const nutritionShortcuts = [...mealTypes, "饮水", "体重"] as const;
export type NutritionShortcut = typeof nutritionShortcuts[number];

type TargetTemplate = { id: string; name: string; values: NutritionValues };
export type NutritionPreferences = {
  collapsed: boolean;
  homeShortcuts: NutritionShortcut[];
  mealOrder: MealEntry["meal"][];
  showExerciseCard: boolean;
  showToolbar: boolean;
  foodSearch: "recommended" | "all";
  cacheEnabled: boolean;
  templates: TargetTemplate[];
};

const eventName = "spotter:nutrition-preferences-change";
const defaults = (collapsed: boolean): NutritionPreferences => ({
  collapsed,
  homeShortcuts: [...nutritionShortcuts],
  mealOrder: [...mealTypes],
  showExerciseCard: true,
  showToolbar: true,
  foodSearch: "recommended",
  cacheEnabled: false,
  templates: [],
});

function readPreferences(key: string, initiallyCollapsed: boolean, fallback = defaults(initiallyCollapsed)): NutritionPreferences {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<NutritionPreferences> | null;
    if (!value) return fallback;
    const shortcuts = Array.isArray(value.homeShortcuts)
      ? [...new Set(value.homeShortcuts)].filter((shortcut) => nutritionShortcuts.includes(shortcut)) : fallback.homeShortcuts;
    const order = Array.isArray(value.mealOrder) ? value.mealOrder : fallback.mealOrder;
    const uniqueOrder = [...new Set(order)].filter((meal) => mealTypes.includes(meal));
    const templates = Array.isArray(value.templates) ? value.templates.flatMap((item) => {
      if (!item || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim()) return [];
      const valid = nutritionValues.safeParse(item.values);
      return valid.success ? [{ id: item.id, name: item.name.slice(0, 36), values: valid.data }] : [];
    }) : [];
    return {
      collapsed: typeof value.collapsed === "boolean" ? value.collapsed : initiallyCollapsed,
      homeShortcuts: shortcuts,
      mealOrder: [...uniqueOrder, ...mealTypes.filter((meal) => !uniqueOrder.includes(meal))],
      showExerciseCard: value.showExerciseCard !== false,
      showToolbar: value.showToolbar !== false,
      foodSearch: value.foodSearch === "all" ? "all" : "recommended",
      cacheEnabled: value.cacheEnabled === true,
      templates,
    };
  } catch { return fallback; }
}

export function useNutritionPreferences(owner: string, initiallyCollapsed = false) {
  const key = `spotter:nutrition-preferences:${owner || "guest"}`;
  const [snapshot, setSnapshot] = useState<{ key: string; preferences: NutritionPreferences }>();
  const preferences = snapshot?.key === key ? snapshot.preferences : defaults(initiallyCollapsed);

  useEffect(() => {
    const refresh = () => setSnapshot({ key, preferences: readPreferences(key, initiallyCollapsed) });
    refresh();
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) refresh(); };
    const local = (event: Event) => {
      const next = (event as CustomEvent<typeof snapshot>).detail;
      if (next?.key === key) setSnapshot(next);
    };
    window.addEventListener("storage", storage);
    window.addEventListener(eventName, local);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener(eventName, local);
    };
  }, [key, initiallyCollapsed]);

  function update(patch: Partial<NutritionPreferences>) {
    const next = { key, preferences: { ...readPreferences(key, initiallyCollapsed, preferences), ...patch } };
    try { localStorage.setItem(key, JSON.stringify(next.preferences)); } catch { /* Remain usable in this tab. */ }
    setSnapshot(next);
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }

  return { preferences, update };
}
