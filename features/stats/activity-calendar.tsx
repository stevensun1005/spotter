"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { offsetDate } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { displayNumber } from "@/shared/ui";
import { activityLevel, activityLevels, buildActivityCalendar, type DailyActivity } from "./activity-model";

const moveDay = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as const;

function describeActivity({ sessions, sets, volume, minutes }: DailyActivity) {
  if (!sessions) return "当天无训练记录";
  const quantities = [volume > 0 && displayNumber(volume) + " kg", sets > 0 && sets + " 组", minutes > 0 && minutes + " 分钟"].filter(Boolean);
  return quantities.length ? quantities.join(" · ") : "已打卡，训练量未记录";
}

export function ActivityCalendar({ logs, owner, end }: { logs: TrainingEntry[]; owner: string; end: string }) {
  const { from, to, total, blankDays, weeks, months, dates } = useMemo(() => buildActivityCalendar(logs, owner, end), [logs, owner, end]);
  const [day, setDay] = useState<string>();
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const view = scroll.current;
    if (view) view.scrollLeft = view.scrollWidth - view.clientWidth;
  }, [end]);
  const selected = day ? dates.find(({ date }) => date === day) : undefined;
  const active = selected?.date ?? to;
  const cell = (date: string) => scroll.current?.querySelector<HTMLButtonElement>('[data-date="' + date + '"]');
  function onDayKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offset = moveDay[event.key as keyof typeof moveDay];
    if (!offset) return;
    event.preventDefault();
    const next = offsetDate(date, offset);
    if (next < from || next > to) return;
    setDay(next);
    cell(next)?.focus();
  }
  return <section className="card padded stats-panel stats-activity-panel">
    <div className="stats-section-heading"><h2>训练活跃日历</h2><strong className="stats-activity-total">过去一年 {displayNumber(total)} 次打卡</strong></div>
    <div className="stats-activity-card">
      <div className="stats-activity-layout">
        <div className="stats-activity-days" aria-hidden="true"><span>一</span><span>三</span><span>五</span></div>
        <div ref={scroll} className="stats-activity-scroll">
          <div className="stats-activity-matrix" style={{ "--activity-weeks": weeks } as CSSProperties}>
            <div className="stats-activity-months" aria-hidden="true">{months.map(({ position, id, label }) =>
              <span key={id} style={{ gridColumnStart: position + 1 }}>{label}</span>)}</div>
            <div className="stats-activity" role="group" aria-label="过去一年每天的训练量">
              {Array.from({ length: blankDays }, (_, index) => <span key={index} aria-hidden="true" />)}
              {dates.map((activity) => {
                const { date } = activity;
                const label = date + " · " + describeActivity(activity);
                return <button key={date} type="button" data-date={date} data-level={activityLevel(activity)}
                  aria-label={label} title={label} aria-pressed={active === date} tabIndex={active === date ? 0 : -1}
                  onClick={() => setDay(date)} onKeyDown={(event) => onDayKey(event, date)} />;
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="stats-activity-footer">
        <span>{from} — {to}</span>
        <div className="stats-activity-legend" aria-label="训练量从少到多，优先使用负重容量，其次是完成组数、记录时长"
          title="按负重容量着色。无负重时看完成组数，无组数时看记录时长。">
          <span>训练量少</span>{activityLevels.map((level) => <i key={level} data-level={level} aria-hidden="true" />)}<span>多</span>
        </div>
      </div>
      <p className="stats-activity-selection" aria-live="polite">{selected && selected.date + " · " + describeActivity(selected)}</p>
    </div>
  </section>;
}
