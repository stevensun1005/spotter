"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Dumbbell, ListFilter } from "lucide-react";
import { offsetDate, shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { Dialog } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { moveHistoryId, orderedOwnLogs } from "./day-order";

export { LogDetail } from "./log-detail";

type HistorySubject = "all" | "self" | "partner";

const subjects: { id: HistorySubject; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "self", label: "我的记录" },
  { id: "partner", label: "搭子记录" },
];

function moveMonth(first: string, step: number) {
  const date = new Date(first + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + step);
  return date.toISOString().slice(0, 10);
}

export function History({ today, logs, self, partner, show, orderByDay, saveOrder }: {
  today: string; logs: TrainingEntry[]; self: string; partner: string | undefined; show: (entry: TrainingEntry) => void;
  orderByDay?: ReadonlyMap<string, readonly string[]>; saveOrder?: (date: string, ids: string[]) => Promise<void>;
}) {
  const [scope, setScope] = useState<HistorySubject>("all");
  const [first, setFirst] = useState(() => today.slice(0, 7) + "-01");
  const [active, setActive] = useState<string>();
  const [editing, setEditing] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subject = partner ? scope : "self";
  const month = first.slice(0, 7);
  const leading = weekdayIndex(first);
  const start = offsetDate(first, -leading);
  const daysInMonth = Number(offsetDate(moveMonth(first, 1), -1).slice(-2));
  const shownDays = Math.ceil((leading + daysInMonth) / 7) * 7;

  const byDate = new Map<string, TrainingEntry[]>();
  for (const log of logs) {
    if (log.kind !== "log" || (log.owner === self ? subject === "partner" : subject === "self")) continue;
    const entries = byDate.get(log.data.date);
    if (entries) entries.push(log);
    else byDate.set(log.data.date, [log]);
  }
  if (orderByDay) for (const [date, entries] of byDate) {
    const order = orderByDay.get(date);
    if (order) byDate.set(date, orderedOwnLogs(entries, self, order));
  }
  const activeLogs = active ? byDate.get(active) ?? [] : [];
  const ownLogs = activeLogs.filter((log) => log.owner === self);
  const shownLogs = editing ? orderedOwnLogs(activeLogs, self, editing) : activeLogs;

  function closeDay() {
    if (!busy) { setActive(undefined); setEditing(undefined); setError(""); }
  }

  async function applyOrder() {
    if (!saveOrder || !active || !editing || busy) return;
    setBusy(true); setError("");
    try { await saveOrder(active, editing); setEditing(undefined); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <div className="history-calendar">
    <section className="card history-month-card" aria-label="训练月历">
      <div className="history-month-bar">
        <h2><time dateTime={month}><span>{Number(month.slice(0, 4))} 年</span> <strong>{Number(month.slice(5))} 月</strong></time></h2>
        <div className="steppers">
          {partner && <label className="icon-button history-filter" data-filtered={scope !== "all" || undefined}>
            <ListFilter size={18} aria-hidden="true" />
            <select aria-label="记录筛选" value={scope} onChange={(event) => setScope(event.target.value as HistorySubject)}>
              {subjects.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>}
          <button className="icon-button" type="button" aria-label="上个月" onClick={() => setFirst(moveMonth(first, -1))}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button className="icon-button" type="button" aria-label="下个月" onClick={() => setFirst(moveMonth(first, 1))}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="history-week-grid">
        {weekdays.map((day) => <span className="history-weekday" key={day}>{day}</span>)}
        {Array.from({ length: shownDays }, (_, index) => {
          const date = offsetDate(start, index);
          const entries = byDate.get(date) ?? [];
          const mine = entries.filter((log) => log.owner === self).length;
          const theirs = entries.length - mine;
          const label = [date, entries.length + " 次打卡", mine > 0 && "我 " + mine + " 次",
            theirs > 0 && partner + " " + theirs + " 次"].filter(Boolean).join("，");
          const previews = mine && theirs
            ? [entries.find((log) => log.owner === self), entries.find((log) => log.owner !== self)].filter((log) => log !== undefined)
            : entries.slice(0, 2);
          const extra = entries.length - previews.length;
          return <div className="history-cell" key={date} data-outside={!date.startsWith(month) || undefined}>
            <button type="button" className="history-date" aria-label={label} aria-haspopup="dialog"
              aria-current={date === today ? "date" : undefined} onClick={() => setActive(date)}>
              <span>{Number(date.slice(8))}</span>
              {extra > 0 && <small aria-hidden="true">+{extra}</small>}
            </button>
            {previews.map((log) => {
              const mine = log.owner === self;
              const title = log.data.plan.title;
              return <button type="button" className="history-calendar-record" key={log.owner + ":" + log.id}
                data-person={mine ? "self" : "partner"} aria-label={[title, mine ? "我" : partner, date].join("，")}
                title={title} onClick={() => show(log)}><span>{title}</span></button>;
            })}
          </div>;
        })}
      </div>
      <div className="history-key">
        {subject !== "partner" && <span data-person="self"><i aria-hidden="true" />我</span>}
        {partner && subject !== "self" && <span data-person="partner"><i aria-hidden="true" />{partner}</span>}
      </div>
    </section>
    {active && <Dialog title={shortDate(active) + "的打卡"} onClose={closeDay}>
      <div className="dialog-body history-day-list">
        {saveOrder && ownLogs.length > 1 && <div className="exercise-toolbar">
          {editing ? <>
            <button type="button" className="button primary small" disabled={busy} onClick={() => void applyOrder()}>{busy ? "保存中…" : "保存排序"}</button>
            <button type="button" className="button subtle small" disabled={busy} onClick={() => { setEditing(undefined); setError(""); }}>取消排序</button>
          </> : <button type="button" className="button outline small" onClick={() => setEditing(ownLogs.map((log) => log.id))}>排序我的训练</button>}
        </div>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {!activeLogs.length && <p className="history-no-records">{subject === "partner" ? "搭子这一天还没有训练记录。" : "这一天还没有训练记录。"}</p>}
        {shownLogs.map((log) => {
          const mine = log.owner === self;
          const position = mine ? editing?.indexOf(log.id) ?? -1 : -1;
          const label = log.data.plan.title;
          return <div className="history-day-sort-row" key={log.owner + ":" + log.id}>
            <button className="history-day-record" type="button" data-person={mine ? "self" : "partner"}
            disabled={Boolean(editing)} onClick={() => { closeDay(); show(log); }}>
            <span className="history-record-icon"><Dumbbell size={19} aria-hidden="true" /></span>
            <span className="history-record-label">
              <strong>{log.data.plan.title}</strong>
              <small><span className="history-owner">{mine ? "我" : partner}</span>
                <span>{log.data.plan.category} · {log.data.minutes} 分钟</span></small>
            </span>
            <ChevronRight size={19} aria-hidden="true" />
            </button>
            {editing && position >= 0 && <div className="history-day-sort-controls">
              <button type="button" className="icon-button" aria-label={"上移 " + label} disabled={busy || position === 0}
                onClick={() => setEditing(moveHistoryId(editing, log.id, -1))}><ArrowUp size={17} /></button>
              <button type="button" className="icon-button" aria-label={"下移 " + label} disabled={busy || position === editing.length - 1}
                onClick={() => setEditing(moveHistoryId(editing, log.id, 1))}><ArrowDown size={17} /></button>
            </div>}
          </div>;
        })}
      </div>
    </Dialog>}
  </div>;
}
