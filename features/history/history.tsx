"use client";

import { useState } from "react";
import { Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, Pencil, Share2 } from "lucide-react";
import { Dialog, displayNumber, VideoLink } from "@/shared/ui";
import { offsetDate, shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import { sessionTotals, type Session } from "@/features/training/model";
import { parsePlanMove } from "@/features/exercises/move-name";
import { EditLog } from "./edit-log";
import { ShareCard } from "@/features/share/share-card";
import { HeartPanel } from "@/features/heart/heart-panel";
import type { WhoopStatus } from "@/features/heart/whoop";
import { kindLabels } from "@/features/training/set-row";
import { ProteinCheck } from "@/features/training/protein-check";
import type { TrainingEntry } from "@/shared/state";

export function LogDetail({ log, close, own, whoop, onTemplate, onEdit, today, share, trackProtein }: {
  log: TrainingEntry; close: () => void; own: boolean; whoop?: WhoopStatus; onTemplate?: () => void;
  today?: string; onEdit?: (next: Session) => Promise<void>; trackProtein?: boolean;
  share?: { name: string; owner: string; logs: TrainingEntry[] };
}) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { volume, sets } = sessionTotals(log.data);
  if (sharing && own && share) return <ShareCard log={log} {...share} close={() => setSharing(false)} />;
  if (editing && onEdit && today) return <Dialog title="编辑训练记录" onClose={() => setEditing(false)}>
    <EditLog original={log.data} today={today} cancel={() => setEditing(false)} save={async (next) => {
      await onEdit(next);
      setEditing(false);
    }} />
  </Dialog>;
  return <Dialog title={log.data.plan.title} onClose={close}><div className="dialog-body form-fields">
    <p className="muted">{shortDate(log.data.date)} · {log.data.plan.category}</p>
    <div className="totals"><div><strong>{log.data.minutes}</strong><span>分钟</span></div><div><strong>{sets}</strong><span>完成组数</span></div><div><strong>{displayNumber(volume)}</strong><span>容量 kg</span></div></div>
    {own && trackProtein && onEdit && <ProteinCheck checked={log.data.proteinShake === true}
      save={(proteinShake) => onEdit({ ...log.data, proteinShake })} />}
    {log.data.note && <p className="note">{log.data.note}</p>}
    {log.data.plan.video && <VideoLink url={log.data.plan.video} />}
    {(onTemplate || onEdit || own && share) && <div className="exercise-toolbar">
      {own && share && <button className="button outline small" type="button" onClick={() => setSharing(true)}><Share2 size={16} /> 分享训练</button>}
      {onTemplate && <button className="button outline small" type="button" onClick={onTemplate}><Bookmark size={16} /> 另存为模板</button>}
      {onEdit && <button className="button outline small" type="button" onClick={() => setEditing(true)}><Pencil size={16} /> 编辑记录</button>}
    </div>}
    {own && <HeartPanel id={log.id} session={log.data} whoopResult={whoop} />}
    {log.data.plan.exercises.map((item, i) => <div className="log-move" key={i}><strong>{parsePlanMove(item.name).name}</strong>
      {log.data.rows[i].map((line, j) => line.done && <div key={j}>
        <span>第 {j + 1} 组{line.kind ? " · " + kindLabels[line.kind] : ""}</span>
        <span>{line.seconds ? line.seconds + " 秒" + (line.weight ? " · " + line.weight + " " + item.unit : "") :
          line.right ? "左 " + line.weight + " " + item.unit + " × " + line.reps + " · 右 " + line.right.weight + " " + item.unit + " × " + line.right.reps :
          line.weight + " " + item.unit + " × " + line.reps + " 次"}{line.rpe === undefined ? "" : " · RPE " + line.rpe}</span>
        <Check size={16} />
      </div>)}
    </div>)}
  </div></Dialog>;
}

export function History({ today, logs, self, partner, show }: {
  today: string; logs: TrainingEntry[]; self: string; partner: string | undefined; show: (entry: TrainingEntry) => void;
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
