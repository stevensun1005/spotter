"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, ChevronRight, Plus, X } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { offsetDate, weekdays } from "@/shared/dates";
import type { PlannedWorkout } from "./model";
import { blocked, type MoveChoice, type MovePreview, type Schedule } from "./schedule";

export function ScheduleSettings({ settings, restDay, close, save }: {
  settings: Schedule; restDay?: string; close: () => void; save: (settings: Schedule) => Promise<void>;
}) {
  const [value, setValue] = useState(() => restDay && !blocked(settings, restDay) && settings.dates.length < 180
    ? { ...settings, dates: [...settings.dates, restDay].sort() } : settings);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await save(value); close(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  return <Dialog title={restDay ? "安排休息" : "个人计划设置"} onClose={() => { if (!busy) close(); }}>
    <form onSubmit={submit} className="dialog-body feature-stack">
      <h3>每周不安排训练的日子</h3>
      <div className="weekday-settings">{weekdays.map((label, index) => <button type="button" key={label} className="button outline small" aria-pressed={value.weekdays.includes(index)}
        onClick={() => setValue({ ...value, weekdays: value.weekdays.includes(index) ? value.weekdays.filter((item) => item !== index) : [...value.weekdays, index] })}
        disabled={busy || (value.weekdays.length >= 6 && !value.weekdays.includes(index))}>周{label}</button>)}</div>
      <h3>临时有事的日期</h3>
      <div className="feature-form-line"><input type="date" aria-label="临时休息日期" value={day} onChange={(event) => setDay(event.target.value)} />
        <button className="button outline" type="button" disabled={busy || !day || value.dates.includes(day) || value.dates.length >= 180}
          onClick={() => { setValue({ ...value, dates: [...value.dates, day].sort() }); setDay(""); }}><Plus size={16} /> 加入</button></div>
      {value.dates.map((date) => <div className="list-line" key={date}><span>{date}</span><button className="icon-button" type="button" aria-label={"移除 " + date} disabled={busy}
        onClick={() => setValue({ ...value, dates: value.dates.filter((item) => item !== date) })}><X size={16} /></button></div>)}
      <p className="muted">新排和顺延会避开这些日子。已排好的训练可从当天单独调整。</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>保存计划设置</button>
    </form>
  </Dialog>;
}

type MoveOptions = Pick<MoveChoice, "date" | "shift" | "nextAvailable">;
export function MovePlan({ item, settings, today, close, inspect, save }: {
  item: PlannedWorkout; settings: Schedule; today: string; close: () => void;
  inspect: (choice: MoveOptions) => Promise<MovePreview>;
  save: (choice: MoveOptions, token: string) => Promise<void>;
}) {
  const [date, setDate] = useState(() => offsetDate(item.data.date, 1));
  const [shift, setShift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ choice: MoveOptions; result: MovePreview }>();
  const unsuitable = date && blocked(settings, date);
  async function preview(choice: MoveOptions) {
    setBusy(true); setError("");
    try { setReview({ choice, result: await inspect(choice) }); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!review) return;
    setBusy(true); setError("");
    try { await save(review.choice, review.result.token); close(); }
    catch (reason) {
      setError(errorText(reason));
      if ((reason as { status?: number })?.status === 409) setReview(undefined);
    }
    finally { setBusy(false); }
  }
  return <Dialog title="移动训练" onClose={() => { if (!busy) close(); }}>
    <form onSubmit={(event) => { event.preventDefault(); if (review) void confirm(); else void preview({ date, shift }); }} className="dialog-body form-fields">
      <p className="list-line"><CalendarDays size={17} /> <strong>{item.data.title}</strong><span>{item.data.date}</span></p>
      {review ? <>
        <h3>核对日期变更</h3>
        <ul className="feature-stack">{review.result.changes.map((change) => <li key={change.id}>
          <strong>{change.title}</strong><div className="muted">{change.from} → {change.date}</div>
        </li>)}</ul>
        <button className="button outline" type="button" disabled={busy} onClick={() => { setReview(undefined); setError(""); }}>修改日期或范围</button>
      </> : <>
        <label>新日期<input required type="date" value={date} min={shift ? offsetDate(item.data.date, 1) : undefined}
          disabled={busy} onChange={(event) => { setDate(event.target.value); setError(""); }} /></label>
        {item.data.programId && <label className="toggle-label"><input type="checkbox" checked={shift} disabled={busy}
          onChange={(event) => { setShift(event.target.checked); setError(""); }} /> 同时顺延本周期后续训练</label>}
        {shift && <p className="muted">保留原间隔，跳过休息日和已占用的日期。已开始及已打卡的训练保留原日期。</p>}
        {unsuitable && <p className="inline-error" role="alert">这天设为不安排训练。请选择另一日。</p>}
        {item.data.date < today && <button className="button outline" type="button" disabled={busy}
          onClick={() => void preview({ date: today, shift, nextAvailable: true })}>找下一个可训练日</button>}
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy || (!review && (!date || date === item.data.date || Boolean(unsuitable)))}>
        {review ? "确认移动 " + review.result.changes.length + " 节" : "预览日期变更"} <ChevronRight size={17} />
      </button>
    </form>
  </Dialog>;
}
