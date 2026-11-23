"use client";

import { BarChart3, Check } from "lucide-react";
import { offsetDate, weekdayIndex, weekdays } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";

export function ActivityCard({ today, self, logs, open }: {
  today: string; self: string; logs: TrainingEntry[]; open: () => void;
}) {
  const recent = logs.filter((log) => log.owner === self && log.data.date >= offsetDate(today, -6) && log.data.date <= today);
  return <section className="card padded activity-card">
    <div className="section-head"><h2>近 7 天</h2><button className="icon-button stat-link" aria-label="打开训练统计" onClick={open}><BarChart3 size={19} /></button></div>
    <div className="quick-stats"><div><strong>{recent.length}<small> 次</small></strong><span>训练打卡</span></div><div><strong>{recent.reduce((sum, entry) => sum + entry.data.minutes, 0)}<small> 分钟</small></strong><span>训练时长</span></div></div>
    <div className="mini-week">{Array.from({ length: 7 }, (_, i) => {
      const date = offsetDate(today, i - 6);
      const active = recent.some((log) => log.data.date === date);
      return <div key={date}><span className={active ? "on" : ""}>{active ? <Check size={13} /> : <i />}</span><small>{weekdays[weekdayIndex(date)]}</small></div>;
    })}</div>
  </section>;
}
