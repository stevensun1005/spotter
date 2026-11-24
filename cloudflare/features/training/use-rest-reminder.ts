"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkoutPreferences } from "@/features/settings/workout-prefs";
import { crossedRestDeadline } from "./rest-reminder";

type Sound = WorkoutPreferences["alertSound"];
const tones = { chime: [660, 0.28], low: [440, 0.35], short: [880, 0.14] } as const;

export function useRestSignals(settings: WorkoutPreferences) {
  const audio = useRef<AudioContext>(undefined);
  const flashTimeout = useRef<number>(undefined);
  const [flash, setFlash] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(flashTimeout.current);
    if (audio.current) void audio.current.close().catch(() => undefined);
    audio.current = undefined;
  }, []);

  async function prepareSound(selection: Sound = settings.alertSound) {
    if (selection === "off" || typeof AudioContext === "undefined") return;
    try {
      audio.current ??= new AudioContext();
      if (audio.current.state === "suspended") await audio.current.resume();
    } catch { /* Visual reminders are available even if audio is blocked. */ }
  }

  function say(message: string) {
    if (typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "zh-CN";
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;
    window.speechSynthesis.speak(utterance);
  }

  function notify() {
    if (settings.alertVibrate) navigator.vibrate?.([150, 50, 150]);
    if (settings.alertFlash) {
      setFlash(true);
      window.clearTimeout(flashTimeout.current);
      flashTimeout.current = window.setTimeout(() => setFlash(false), 430);
    }
    if (settings.alertVoice) say("休息结束");
    const context = audio.current;
    if (settings.alertSound === "off" || context?.state !== "running") return;
    const [frequency, duration] = tones[settings.alertSound];
    const tone = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.10, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    tone.connect(gain).connect(context.destination);
    tone.start(start);
    tone.stop(start + duration);
  }

  return { flash, notify, prepareSound, say };
}

export function useRestReminder(until: number | undefined, elapsed: number, running: boolean, settings: WorkoutPreferences) {
  const previous = useRef<{ until: number | undefined; elapsed: number }>(undefined);
  const signals = useRestSignals(settings);
  const callbacks = useRef(signals);

  useEffect(() => { callbacks.current = signals; });
  useEffect(() => {
    const before = previous.current;
    const current = { until, elapsed };
    previous.current = current;
    if (!running || document.visibilityState !== "visible") return;
    if (crossedRestDeadline(before, current)) {
      callbacks.current.notify();
    } else if (settings.alertVoiceCountdown && until !== undefined && crossedRestDeadline(
      before?.until === undefined ? undefined : { ...before, until: before.until - 10_000 },
      { until: until - 10_000, elapsed },
    )) {
      callbacks.current.say("休息还剩十秒");
    }
  }, [until, elapsed, running, settings.alertVoiceCountdown]);

  return signals;
}
