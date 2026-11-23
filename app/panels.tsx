"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, CalendarDays, Check, ChevronLeft, ChevronRight, CirclePlay, Clock3, Dumbbell, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { categories, moveBlank, offsetDate, planSchema, sessionTotals, type Entry, type Move, type Plan, type Session } from "./workout";

export const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
export const weekdayIndex = (date: string) => (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
export const shortDate = (date: string) => Number(date.slice(5, 7)) + "月" + Number(date.slice(8)) + "日";
export const displayNumber = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
export type Log = Extract<Entry, { data: Session }>;
export const draftsOrLogs = (entry: Entry): entry is Log => entry.kind === "draft" || entry.kind === "log";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);
  return <dialog ref={dialog} className="dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button></div>
    {children}
  </dialog>;
}

export function PlanFields({ value, change }: { value: Plan; change: (plan: Plan) => void }) {
  const edit = (key: keyof Plan, next: Plan[keyof Plan]) => change({ ...value, [key]: next });
  const editMove = (index: number, next: Partial<Move>) => edit("exercises", value.exercises.map((item, i) => i === index ? { ...item, ...next } : item));
  return <div className="form-fields">
    <label>训练名称<input required maxLength={100} value={value.title} onChange={(e) => edit("title", e.target.value)} placeholder="例如：上肢力量训练" /></label>
    <div className="field-grid">
      <label>安排日期<input required type="date" value={value.date} onChange={(e) => edit("date", e.target.value)} /></label>
      <label>类型<select value={value.category} onChange={(e) => edit("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="field-grid">
      <label>预计时长（分钟）<input type="number" min={0} max={720} value={value.minutes || ""} onChange={(e) => edit("minutes", Number(e.target.value))} placeholder="选填" /></label>
      <label className="toggle-label"><input type="checkbox" checked={value.shared} onChange={(e) => edit("shared", e.target.checked)} /> 与搭子共享计划</label>
    </div>
    <label>跟练链接<input type="url" value={value.video} onChange={(e) => edit("video", e.target.value.trim())} placeholder="YouTube 或 B站链接（选填）" /></label>
    <div className="field-title"><strong>训练动作</strong><button type="button" className="button subtle small" disabled={value.exercises.length >= 30} onClick={() => edit("exercises", [...value.exercises, moveBlank()])}><Plus size={16} /> 添加动作</button></div>
    {value.exercises.map((item, index) => <div className="move-editor" key={index}>
      <div className="move-editor-top">
        <label>动作 {index + 1}<input maxLength={100} placeholder="如：哑铃卧推" value={item.name} onChange={(e) => editMove(index, { name: e.target.value })} /></label>
        <button type="button" className="icon-button" aria-label={"移除动作 " + (index + 1)} onClick={() => edit("exercises", value.exercises.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
      </div>
      <div className="move-grid">
        <label>组数<input aria-label={"动作 " + (index + 1) + " 组数"} type="number" min={1} max={30} value={item.sets || ""} onChange={(e) => editMove(index, { sets: Number(e.target.value) })} /></label>
        <label>次数<input aria-label={"动作 " + (index + 1) + " 次数"} type="number" min={0} max={999} value={item.reps} onChange={(e) => editMove(index, { reps: Number(e.target.value) })} /></label>
        <label>重量<input aria-label={"动作 " + (index + 1) + " 重量"} type="number" min={0} max={2000} step="any" value={item.weight} onChange={(e) => editMove(index, { weight: Number(e.target.value) })} /></label>
        <label>单位<select value={item.unit} onChange={(e) => editMove(index, { unit: e.target.value as Move["unit"] })}><option>kg</option><option>lb</option></select></label>
        <label>秒数<input aria-label={"动作 " + (index + 1) + " 秒数"} type="number" min={0} max={18000} value={item.seconds} onChange={(e) => editMove(index, { seconds: Number(e.target.value) })} /></label>
      </div>
    </div>)}
  </div>;
}

export function cleanPlan(value: Plan) {
  return planSchema.safeParse({ ...value, exercises: value.exercises.filter((item) => item.name.trim()) });
}

export function VideoLink({ url }: { url: string }) {
  return <a className="button outline" href={url} target="_blank" rel="noopener noreferrer"><CirclePlay size={18} /> 打开跟练视频 <ExternalLink size={14} /></a>;
}

export function LogDetail({ log, close }: { log: Log; close: () => void }) {
  const { volume, sets } = sessionTotals(log.data);
  return <Dialog title={log.data.plan.title} onClose={close}><div className="dialog-body form-fields">
    <p className="muted">{shortDate(log.data.date)} · {log.data.plan.category}</p>
    <div className="totals"><div><strong>{log.data.minutes}</strong><span>分钟</span></div><div><strong>{sets}</strong><span>完成组数</span></div><div><strong>{displayNumber(volume)}</strong><span>容量 kg</span></div></div>
    {log.data.note && <p className="note">{log.data.note}</p>}
    {log.data.plan.video && <VideoLink url={log.data.plan.video} />}
    {log.data.plan.exercises.map((item, i) => <div className="log-move" key={i}><strong>{item.name}</strong>{log.data.rows[i].map((line, j) => line.done && <div key={j}><span>第 {j + 1} 组{line.kind === "warmup" ? " · 热身" : line.kind === "drop" ? " · 递减" : ""}</span><span>{line.seconds ? line.seconds + " 秒" : line.weight + " " + item.unit + " × " + line.reps + " 次"}{line.right && <> · 右 {line.right.weight} {item.unit} × {line.right.reps} 次</>}{line.rpe && <> · RPE {line.rpe}</>}</span><Check size={16} /></div>)}</div>)}
  </div></Dialog>;
}

export function History({ today, logs, self, partner, show }: {
  today: string; logs: Log[]; self: string; partner: string | undefined; show: (entry: Log) => void;
}) {
  const [active, setActive] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = month + "-01";
  const start = offsetDate(first, -weekdayIndex(first));
  const monthChange = (step: number) => {
    const value = new Date(first + "T12:00:00Z");
    value.setUTCMonth(value.getUTCMonth() + step);
    const next = value.toISOString().slice(0, 10);
    setMonth(next.slice(0, 7)); setActive(next);
  };
  return <div className="history-grid">
    <section className="card padded">
      <div className="section-head"><h2>{month.slice(0, 4)}年 {Number(month.slice(5))}月</h2><div className="steppers"><button className="icon-button" aria-label="上个月" onClick={() => monthChange(-1)}><ChevronLeft /></button><button className="icon-button" aria-label="下个月" onClick={() => monthChange(1)}><ChevronRight /></button></div></div>
      <div className="calendar">
        {weekdays.map((day) => <span className="calendar-label" key={day}>{day}</span>)}
        {Array.from({ length: Math.ceil((weekdayIndex(first) + new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()) / 7) * 7 }, (_, index) => {
          const date = offsetDate(start, index);
          const entries = logs.filter((log) => log.data.date === date);
          return <button key={date} aria-label={date + "，" + entries.length + " 次打卡"} aria-pressed={active === date} className={date.startsWith(month) ? "" : "other-month"} onClick={() => setActive(date)}><span>{Number(date.slice(8))}</span><span className="dot-row">{entries.some((log) => log.owner === self) && <i />}{entries.some((log) => log.owner !== self) && <i className="purple" />}</span></button>;
        })}
      </div>
      <div className="legend"><span><i /> 我</span>{partner && <span><i className="purple" /> {partner}</span>}</div>
    </section>
    <section className="card padded"><div className="section-head"><h2>{shortDate(active)}的打卡</h2><CalendarDays size={20} /></div>
      {!logs.some((log) => log.data.date === active) && <p className="empty-copy">这一天还没有训练记录。</p>}
      {logs.filter((log) => log.data.date === active).map((log) => <button className="list-line history-line" key={log.owner + log.id} onClick={() => show(log)}><span className={"tile " + (log.owner === self ? "mint" : "lilac")}><Dumbbell size={18} /></span><span><strong>{log.data.plan.title}</strong><small>{log.owner === self ? "我" : partner} · {log.data.minutes} 分钟</small></span><ChevronRight size={18} /></button>)}
    </section>
  </div>;
}

export function Stats({ today, logs, self, partner }: {
  today: string; logs: Log[]; self: string; partner: { id: string; name: string } | null;
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
  </div>;
}
