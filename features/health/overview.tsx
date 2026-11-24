"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Scale } from "lucide-react";
import { asDate, shortDate } from "@/shared/dates";
import type { HealthOverview } from "./model";

const number = (value: number | undefined, digits = 0) => value === undefined ? "—" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value);
const atTime = (at: number, timeZone?: string) => new Intl.DateTimeFormat("zh-CN", { timeZone, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);

export function PrivateHealthOverview({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<HealthOverview | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  useEffect(() => {
    const abort = new AbortController();
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      try {
        const response = await fetch("/api/health/apple", { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const value: { health: HealthOverview } = await response.json();
        if (!abort.signal.aborted && request === sequence) { setData(value.health); setError(""); }
      } catch {
        if (!abort.signal.aborted && request === sequence) setError("暂时无法读取个人健康数据，请刷新重试。");
      }
    };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visible);
    return () => { abort.abort(); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", visible); };
  }, [revision]);
  const within = (date: string) => date >= start && date <= end;
  const body = data?.bodyMass.filter((record) => within(asDate(record.at))) ?? [];
  const activity = data?.activity.filter((record) => within(record.date)) ?? [];
  const workouts = data?.workouts.filter((record) => within(asDate(record.from))) ?? [];
  return <section className="card padded private-health" aria-label="个人健康记录">
    <div className="section-head"><h2>我的健康记录</h2><button type="button" className="button subtle small" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} />刷新</button></div>
    <p className="muted">仅本人可见。显示各类最近 30 条中，{shortDate(start)}至{shortDate(end)}的记录。请在账号面板配对 iPhone，并在配套应用中选定类型和范围。</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!data && !error && <p className="muted" role="status">正在读取个人健康记录…</p>}
    {data && <>
      <div className="health-section-heading"><h3><Scale size={18} />身体记录</h3><label>体重单位 <select aria-label="体重显示单位" value={unit} onChange={(event) => setUnit(event.target.value as "kg" | "lb")}><option value="kg">kg</option><option value="lb">lb</option></select></label></div>
      {body.length ? <ul className="health-record-list">{body.map((record) => <li key={record.id}><div><strong>{number(record.kg / (unit === "lb" ? .45359237 : 1), 2)} {unit}</strong><span>{atTime(record.at)}</span></div><small>{record.sourceName}</small></li>)}</ul> : <p className="muted">此范围尚无已同步体重。体重读取权限需要单独授权。</p>}
      <div className="health-section-heading"><h3><Activity size={18} />活动概览</h3></div>
      {activity.length ? <div className="health-table-wrap"><table className="health-table"><caption className="muted">所选范围内 Apple 健康合并的日汇总，边界日期可能不足一天。重复同步会更新，不会累加。</caption><thead><tr><th scope="col">日期 / 来源</th><th scope="col">步数</th><th scope="col">活跃能量 kcal</th><th scope="col">运动分钟</th></tr></thead><tbody>{activity.map((record) => <tr key={record.date}><th scope="row">{shortDate(record.date)}<small>{record.sourceName}<br />{record.timeZone}<br />{atTime(record.from, record.timeZone)} – {atTime(record.to, record.timeZone)}</small></th><td>{number(record.steps)}</td><td>{number(record.activeEnergyKcal, 1)}</td><td>{number(record.exerciseMinutes, 1)}</td></tr>)}</tbody></table></div> : <p className="muted">此范围尚无已同步活动数据。步数、活跃能量和运动时长分别授权；“—”表示未同步此项。</p>}
      <h3>系统运动</h3>
      {workouts.length ? <ul className="health-record-list">{workouts.map((record) => <li key={record.id}><div><strong>{record.activity}</strong><span>{number(record.durationSeconds / 60, 1)} 分钟{record.activeEnergyKcal === undefined ? "" : " · " + number(record.activeEnergyKcal, 1) + " kcal"}</span></div><small>{atTime(record.from)} – {atTime(record.to)} · {record.sourceName}</small>{record.matchedWorkoutId ? <a href={"/training/" + record.matchedWorkoutId}>查看对应打卡</a> : <small>尚未唯一匹配已有打卡，未创建新打卡。请核对训练起止时间。</small>}</li>)}</ul> : <p className="muted">此范围尚无已同步系统运动。同步只关联已有训练，不会自动新增打卡。</p>}
    </>}
  </section>;
}
