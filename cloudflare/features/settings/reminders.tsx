"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { asDate } from "@/shared/dates";
import { claimWorkoutReminder, defaultWorkoutReminder, isReminderTime, readWorkoutReminder, reminderKey, type WorkoutReminder } from "./reminder-model";

const settingsChanged = "spotter:workout-reminder-changed";
const workoutReminderText = "到训练时间了，今天还有计划未完成。";

export function ReminderSettings({ owner }: { owner: string }) {
  const [preference, setPreference] = useState(defaultWorkoutReminder);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const read = () => {
      try { setPreference(readWorkoutReminder(window.localStorage, owner)); }
      catch { setPreference(defaultWorkoutReminder); }
    };
    const sync = (event: StorageEvent) => { if (event.key === null || event.key === reminderKey(owner)) read(); };
    read();
    setPreview(false);
    setError(false);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [owner]);

  function save(next: WorkoutReminder) {
    try {
      localStorage.setItem(reminderKey(owner), JSON.stringify(next));
      setPreference(next);
      setError(false);
      window.dispatchEvent(new Event(settingsChanged));
    } catch { setError(true); }
  }

  return <section className="card padded feature-stack" aria-label="每日训练提醒">
    <label className="toggle-label"><input type="checkbox" checked={preference.enabled}
      onChange={(event) => save({ ...preference, enabled: event.target.checked })} />每日训练提醒</label>
    <div className="form-fields"><label>提醒时间
      <input type="time" step={60} value={preference.time} disabled={!preference.enabled}
        onChange={(event) => { if (isReminderTime(event.target.value)) save({ ...preference, time: event.target.value }); }} />
    </label></div>
    <p className="muted">当天还有待完成计划时，到了设定时间会在当前网页提醒一次。时间按本机时区计算，设置保存在这台设备。</p>
    <div><button type="button" className="button outline small" onClick={() => setPreview((current) => !current)} aria-expanded={preview}><BellRing size={17} aria-hidden="true" /> {preview ? "收起提醒预览" : "试试提醒"}</button></div>
    {preview && <p role="status">{workoutReminderText}</p>}
    {error && <p className="inline-error" role="alert">这台设备无法保存提醒设置。</p>}
  </section>;
}

export function useWorkoutReminder({ owner, today, scheduled, notify }: {
  owner: string; today: string; scheduled: boolean; notify: (message: string) => void;
}) {
  useEffect(() => {
    if (!owner || !scheduled) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date();
      if (asDate(now) !== today) return;
      const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      try {
        if (claimWorkoutReminder(window.localStorage, owner, today, time)) notify(workoutReminderText);
      } catch { /* Unavailable browser storage prevents reliable once-per-day delivery. */ }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    const sync = (event: StorageEvent) => { if (event.key === reminderKey(owner)) check(); };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", check);
    window.addEventListener(settingsChanged, check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", check);
      window.removeEventListener(settingsChanged, check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [owner, today, scheduled, notify]);
}
