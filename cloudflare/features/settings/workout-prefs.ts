"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { restReminderMode, type RestReminderMode } from "@/features/training/rest-reminder";

const key = "spotter:workout-preferences:v1";
const changed = "spotter:workout-preferences-changed";
const legacyAlertKey = "spotter:workout-rest-reminder";
const seconds = z.number().int().min(0).max(600);

const schema = z.object({
  defaultRest: seconds.catch(30),
  warmupRest: seconds.nullable().catch(null),
  transitionRest: seconds.nullable().catch(null),
  layout: z.enum(["cards", "list", "focus"]).catch("cards"),
  animations: z.enum(["hidden", "small", "full"]).catch("hidden"),
  autoAdvance: z.boolean().catch(true),
  collapseCompleted: z.boolean().catch(false),
  keepAwake: z.boolean().catch(false),
  showNext: z.boolean().catch(true),
  showEffort: z.boolean().catch(true),
  effortScale: z.enum(["rpe", "rir"]).catch("rpe"),
  showTempo: z.boolean().catch(true),
  newSets: z.number().int().min(1).max(30).catch(3),
  newReps: z.number().int().min(1).max(999).catch(10),
  defaultUnit: z.enum(["kg", "lb"]).catch("kg"),
  weightStep: z.union([z.literal(0.25), z.literal(0.5), z.literal(1), z.literal(2.5), z.literal(5), z.literal(10)]).catch(2.5),
  alertSound: z.enum(["off", "chime", "low", "short"]).catch("off"),
  alertVibrate: z.boolean().catch(false),
  alertFlash: z.boolean().catch(false),
  alertVoice: z.boolean().catch(false),
  alertVoiceCountdown: z.boolean().catch(false),
  voiceRate: z.number().min(0.5).max(2).catch(1),
  voicePitch: z.number().min(0.5).max(2).catch(1),
});

export type WorkoutPreferences = z.infer<typeof schema>;

export function reminderFlags(mode: RestReminderMode): Pick<WorkoutPreferences, "alertSound" | "alertVibrate"> {
  return { alertSound: mode === "sound" || mode === "both" ? "chime" : "off", alertVibrate: mode === "vibration" || mode === "both" };
}

export function parseWorkoutPreferences(value: unknown, legacy?: unknown): WorkoutPreferences {
  return schema.parse({ ...reminderFlags(restReminderMode(legacy)), ...(value && typeof value === "object" ? value : {}) });
}

let sessionPrefs: WorkoutPreferences | undefined;

function readWorkoutPreferences() {
  if (sessionPrefs) return sessionPrefs;
  try {
    const raw = localStorage.getItem(key);
    return parseWorkoutPreferences(raw ? JSON.parse(raw) : undefined, localStorage.getItem(legacyAlertKey));
  } catch {
    return parseWorkoutPreferences(undefined);
  }
}

export function saveWorkoutPreferences(update: Partial<WorkoutPreferences>) {
  const values = parseWorkoutPreferences({ ...readWorkoutPreferences(), ...update });
  try {
    localStorage.setItem(key, JSON.stringify(values));
    sessionPrefs = undefined;
  } catch { sessionPrefs = values; }
  window.dispatchEvent(new CustomEvent(changed, { detail: values }));
}

export function useWorkoutPreferences() {
  const [values, setValues] = useState(() => parseWorkoutPreferences(undefined));
  useEffect(() => {
    setValues(readWorkoutPreferences());
    const onUpdate = (event: Event) => setValues((event as CustomEvent<WorkoutPreferences>).detail);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === key || event.key === legacyAlertKey) setValues(readWorkoutPreferences());
    };
    window.addEventListener(changed, onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(changed, onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return values;
}
