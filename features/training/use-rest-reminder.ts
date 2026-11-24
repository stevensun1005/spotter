"use client";

import { useEffect, useRef, useState } from "react";
import { crossedRestDeadline, restReminderMode, type RestReminderMode } from "./rest-reminder";

const reminderKey = "spotter:workout-rest-reminder";
const usesSound = (mode: RestReminderMode) => mode === "sound" || mode === "both";

export function useRestReminder(until: number | undefined, elapsed: number, running: boolean) {
  const [mode, setMode] = useState<RestReminderMode>("visual");
  const previous = useRef<{ until: number | undefined; elapsed: number }>(undefined);
  const audio = useRef<AudioContext>(undefined);

  useEffect(() => {
    try { setMode(restReminderMode(localStorage.getItem(reminderKey))); }
    catch { /* The setting still works for the current workout. */ }
    return () => {
      if (audio.current) void audio.current.close().catch(() => undefined);
      audio.current = undefined;
    };
  }, []);

  function prepareSound(selection = mode) {
    if (!usesSound(selection) || typeof AudioContext === "undefined") return;
    try {
      audio.current ??= new AudioContext();
      if (audio.current.state === "suspended") void audio.current.resume().catch(() => undefined);
    } catch { /* Visual reminders are available even if audio is blocked. */ }
  }

  function saveMode(selection: RestReminderMode) {
    prepareSound(selection);
    setMode(selection);
    try { localStorage.setItem(reminderKey, selection); }
    catch { /* The setting still works for the current workout. */ }
  }

  useEffect(() => {
    const current = { until, elapsed };
    const finished = crossedRestDeadline(previous.current, current);
    previous.current = current;
    if (!finished || !running || document.visibilityState !== "visible") return;
    if (mode === "vibration" || mode === "both") navigator.vibrate?.([150, 50, 150]);
    const context = audio.current;
    if (!usesSound(mode) || context?.state !== "running") return;
    const tone = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    tone.frequency.value = 660;
    gain.gain.setValueAtTime(0.10, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
    tone.connect(gain).connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.28);
  }, [until, elapsed, running, mode]);

  return { mode, saveMode, prepareSound };
}
