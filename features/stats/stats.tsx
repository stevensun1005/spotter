"use client";

import { useState } from "react";
import { Activity, CalendarDays, Check, Clock3, Dumbbell } from "lucide-react";
import { displayNumber } from "@/shared/ui";
import { offsetDate, shortDate } from "@/shared/dates";
import { sessionTotals } from "@/features/training/model";
import type { TrainingEntry } from "@/shared/state";
import { PrivateHealthOverview } from "@/features/health/overview";

export function Stats({ today, logs, self, partner }: {
  today: string; logs: TrainingEntry[]; self: string; partner: { id: string; name: string } | null;
}) {
  const [period, setPeriod] = useState(7);
  const [person, setPerson] = useState(self);
  const start = offsetDate(today, 1 - period);
  const records = logs.filter((log) => log.owner === person && log.data.date >= start && log.data.date <= today);
  const counts = Array.from({ length: period }, (_, index) => records.filter((log) => log.data.date === offsetDate(start, index)).length);
  const max = Math.max(...counts, 1);
  const total = records.reduce((acc, log) => {
    const values = sessionTotals(log.data);
    return { minutes: acc.minutes + log.data.minutes, sets: acc.sets + values.sets, volume: acc.volume + values.volume };
  }, { minutes: 0, sets: 0, volume: 0 });
  return <div className="stats-page">
    <div className="stat-controls"><div className="segmented"><button aria-pressed={period === 7} onClick={() => setPeriod(7)}>近 7 天</button><button aria-pressed={period === 30} onClick={() => setPeriod(30)}>近 30 天</button></div>{partner && <div className="segmented"><button aria-pressed={person === self} onClick={() => setPerson(self)}>我</button><button aria-pressed={person === partner.id} onClick={() => setPerson(partner.id)}>{partner.name}</button></div>}</div>
    <div className="stats-tiles">
      {[[records.length, "训练次数", CalendarDays], [total.minutes, "训练分钟", Clock3], [total.sets, "完成组数", Check], [total.volume, "训练容量 kg", Dumbbell]].map(([number, name, Icon]) => {
        const MetricIcon = Icon as typeof Activity;
        return <div className="card metric" key={String(name)}><span className="tile mint"><MetricIcon size={18} /></span><strong>{displayNumber(number as number)}</strong><span>{String(name)}</span></div>;
      })}
    </div>
    <section className="card padded"><div className="section-head"><h2>训练次数</h2><span className="muted">{shortDate(start)}至{shortDate(today)}</span></div>
      <div className={"bars" + (period === 30 ? " dense" : "")}>{counts.map((count, i) => <div key={i} title={shortDate(offsetDate(start, i)) + " · " + count + " 次"}><div className="bar-track"><span style={{ height: count ? count / max * 100 + "%" : "4px" }} data-empty={count === 0} /></div>{(period === 7 || i === 0 || i === 29) && <small>{Number(offsetDate(start, i).slice(8))}</small>}</div>)}</div>
    </section>
    {person === self && <PrivateHealthOverview start={start} end={today} />}
  </div>;
}
