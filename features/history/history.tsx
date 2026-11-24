"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { offsetDate, shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";

export { LogDetail } from "./log-detail";

export type HistorySubject = "all" | "self" | "partner";

const subjects: { id: HistorySubject; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "self", label: "我的记录" },
  { id: "partner", label: "搭子记录" },
];

function latestLogDate(logs: TrainingEntry[], today: string, month?: string) {
  return logs.reduce((latest, { data: { date } }) =>
    date <= today && date > latest && (!month || date.startsWith(month)) ? date : latest, "");
}

function moveMonth(first: string, step: number) {
  const date = new Date(first + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + step);
  return date.toISOString().slice(0, 10);
}

export function History({ today, logs, self, partner, show, subject = "all", onSubject }: {
  today: string; logs: TrainingEntry[]; self: string; partner: string | undefined; show: (entry: TrainingEntry) => void;
  subject?: HistorySubject; onSubject?: (subject: HistorySubject) => void;
}) {
  const logsFor = (scope: HistorySubject) => logs.filter((log) =>
    log.kind === "log" && (log.owner === self ? scope !== "partner" : Boolean(partner) && scope !== "self"));
  const visibleLogs = logsFor(subject);
  const [active, setActive] = useState(() =>
    subject === "partner" ? latestLogDate(visibleLogs, today) || today : today);
  const [showDay, setShowDay] = useState(false);
  const month = active.slice(0, 7);
  const first = month + "-01";
  const leading = weekdayIndex(first);
  const start = offsetDate(first, -leading);
  const daysInMonth = Number(offsetDate(moveMonth(first, 1), -1).slice(-2));
  const shownDays = Math.ceil((leading + daysInMonth) / 7) * 7;

  const byDate = new Map<string, TrainingEntry[]>();
  for (const log of visibleLogs) {
    const entries = byDate.get(log.data.date);
    if (entries) entries.push(log);
    else byDate.set(log.data.date, [log]);
  }
  const activeLogs = byDate.get(active) ?? [];

  function selectSubject(next: HistorySubject) {
    if (next === subject) return;
    onSubject?.(next);
    const matches = logsFor(next);
    if (matches.some((log) => log.data.date === active)) return;
    setActive(latestLogDate(matches, today) || active);
  }

  function changeMonth(step: number) {
    setShowDay(false);
    const next = moveMonth(first, step);
    const nextMonth = next.slice(0, 7);
    setActive(today.startsWith(nextMonth) ? today : latestLogDate(visibleLogs, today, nextMonth) || next);
  }

  return <div className="history-calendar">
    <section className="card history-month-card" aria-label="训练月历">
      <div className="history-month-bar">
        <h2><time dateTime={month}><span>{Number(month.slice(0, 4))} 年</span> <strong>{Number(month.slice(5))} 月</strong></time></h2>
        <div className="steppers">
          <button className="icon-button" type="button" aria-label="上个月" onClick={() => changeMonth(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button className="icon-button" type="button" aria-label="下个月" onClick={() => changeMonth(1)}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      </div>
      {partner && onSubject && <div className="segmented history-subjects" role="group" aria-label="训练记录归属">
        {subjects.map(({ id, label }) => <button key={id} type="button" aria-pressed={subject === id}
          onClick={() => selectSubject(id)}>{label}</button>)}
      </div>}
      <div className="history-week-grid">
        {weekdays.map((day) => <span className="history-weekday" key={day}>{day}</span>)}
        {Array.from({ length: shownDays }, (_, index) => {
          const date = offsetDate(start, index);
          const entries = byDate.get(date) ?? [];
          const mine = entries.filter((log) => log.owner === self).length;
          const theirs = entries.length - mine;
          const label = [date, entries.length + " 次打卡", mine > 0 && "我 " + mine + " 次",
            theirs > 0 && partner + " " + theirs + " 次"].filter(Boolean).join("，");
          const selected = showDay && active === date;
          return <div className="history-cell" key={date} data-outside={!date.startsWith(month) || undefined}
            data-selected={selected || undefined}>
            <button type="button" className="history-date" aria-label={label}
              aria-current={date === today ? "date" : undefined} aria-pressed={selected} onClick={() => {
                setActive(date);
                setShowDay(!selected);
              }}>
              <span>{Number(date.slice(8))}</span>
            </button>
            {entries.map((log) => {
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
    {showDay && <section className="card history-day-list" aria-labelledby="history-day-heading">
      <div className="history-day-bar">
        <CalendarDays size={20} aria-hidden="true" />
        <h2 id="history-day-heading" aria-live="polite">{shortDate(active)}的打卡</h2>
        {activeLogs.length > 0 && <span>{activeLogs.length} 次</span>}
      </div>
      {!activeLogs.length && <p className="history-no-records">{subject === "partner" ? "搭子这一天还没有训练记录。" : "这一天还没有训练记录。"}</p>}
      {activeLogs.map((log) => {
        const mine = log.owner === self;
        return <button className="history-day-record" type="button" data-person={mine ? "self" : "partner"}
          key={log.owner + log.id} onClick={() => show(log)}>
          <span className="history-record-icon"><Dumbbell size={19} aria-hidden="true" /></span>
          <span className="history-record-label">
            <strong>{log.data.plan.title}</strong>
            <small><span className="history-owner">{mine ? "我" : partner}</span>
              <span>{log.data.plan.category} · {log.data.minutes} 分钟</span></small>
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>;
      })}
    </section>}
  </div>;
}
