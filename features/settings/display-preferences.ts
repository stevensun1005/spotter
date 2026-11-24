"use client";

import { useEffect, useState } from "react";
import type { MaxFormula } from "@/features/exercises/history";

const storageKey = "spotter:display";
export const displayDefaults = {
  theme: "light" as "system" | "light" | "dark",
  accent: "lime" as "lime" | "mint" | "blue" | "violet",
  text: "normal" as "compact" | "normal" | "large",
  exerciseNames: "zh" as "zh" | "both" | "en",
  firstWeekday: "monday" as "monday" | "sunday",
  weeklyGoal: 0,
  maxFormula: "epley" as MaxFormula,
  motion: true, weeklyCheckins: true, planShortcuts: true,
  nutrition: true, social: true,
};
export type DisplayPreferences = typeof displayDefaults;

function readDisplayPreferences(raw: string | null): DisplayPreferences {
  try {
    const value = JSON.parse(raw ?? "{}") as Partial<DisplayPreferences> | null;
    if (!value) return displayDefaults;
    return {
      theme: value.theme === "dark" || value.theme === "system" ? value.theme : "light",
      accent: value.accent === "mint" || value.accent === "blue" || value.accent === "violet" ? value.accent : "lime",
      text: value.text === "compact" || value.text === "large" ? value.text : "normal",
      exerciseNames: value.exerciseNames === "en" || value.exerciseNames === "both" ? value.exerciseNames : "zh",
      firstWeekday: value.firstWeekday === "sunday" ? "sunday" : "monday",
      weeklyGoal: typeof value.weeklyGoal === "number" && Number.isInteger(value.weeklyGoal) && value.weeklyGoal >= 0 && value.weeklyGoal <= 14 ? value.weeklyGoal : 0,
      maxFormula: value.maxFormula === "brzycki" ? "brzycki" : "epley",
      motion: value.motion !== false, weeklyCheckins: value.weeklyCheckins !== false,
      planShortcuts: value.planShortcuts !== false, nutrition: value.nutrition !== false, social: value.social !== false,
    };
  } catch { return displayDefaults; }
}

export function useDisplayPreferences() {
  const [display, setDisplay] = useState(displayDefaults);
  useEffect(() => {
    try { setDisplay(readDisplayPreferences(localStorage.getItem(storageKey))); } catch { /* Use defaults. */ }
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setDisplay(readDisplayPreferences(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => { root.dataset.spotterTheme = display.theme === "system" ? (system.matches ? "dark" : "light") : display.theme; };
    applyTheme();
    system.addEventListener("change", applyTheme);
    root.dataset.spotterAccent = display.accent;
    root.dataset.spotterText = display.text;
    root.dataset.spotterMotion = String(display.motion);
    root.dataset.spotterExerciseNames = display.exerciseNames;
    return () => system.removeEventListener("change", applyTheme);
  }, [display]);
  function changeDisplay<K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) {
    const next = { ...display, [key]: value };
    setDisplay(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Remains active in this tab. */ }
  }
  return { display, changeDisplay };
}

export type ChangeDisplay = ReturnType<typeof useDisplayPreferences>["changeDisplay"];
