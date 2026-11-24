"use client";

import { useState } from "react";
import { Bookmark, Check, Pencil, Share2 } from "lucide-react";
import { Dialog, displayNumber, VideoLink } from "@/shared/ui";
import { shortDate } from "@/shared/dates";
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
  const canShare = own && share;
  return <Dialog title={log.data.plan.title} className="log-detail-dialog" onClose={close}>
    <div className="dialog-body log-detail-body">
      <header className="log-overview">
        <p className="muted">{shortDate(log.data.date)} · {log.data.plan.category}</p>
        <div className="totals">
          <div><strong>{log.data.minutes}</strong><span>分钟</span></div>
          <div><strong>{sets}</strong><span>完成组数</span></div>
          <div><strong>{displayNumber(volume)}</strong><span>容量 kg</span></div>
        </div>
      </header>
      {own && trackProtein && onEdit && <ProteinCheck checked={log.data.proteinShake === true}
        save={(proteinShake) => onEdit({ ...log.data, proteinShake })} />}
      {log.data.note && <p className="note">{log.data.note}</p>}
      {log.data.plan.video && <VideoLink url={log.data.plan.video} />}
      {own && <HeartPanel id={log.id} session={log.data} whoopResult={whoop} />}
      {log.data.plan.exercises.length > 0 && <section className="log-exercises" aria-label="训练动作">
        <h3>训练动作</h3>
        {log.data.plan.exercises.map((item, i) => <div className="log-move" key={i}><strong>{parsePlanMove(item.name).name}</strong>
          {log.data.rows[i].map((line, j) => line.done && <div key={j}>
            <span>第 {j + 1} 组{line.kind ? " · " + kindLabels[line.kind] : ""}</span>
            <span>{line.seconds ? line.seconds + " 秒" + (line.weight ? " · " + line.weight + " " + item.unit : "") :
              line.right ? "左 " + line.weight + " " + item.unit + " × " + line.reps + " · 右 " + line.right.weight + " " + item.unit + " × " + line.right.reps :
              line.weight + " " + item.unit + " × " + line.reps + " 次"}{line.rpe === undefined ? "" : " · RPE " + line.rpe}</span>
            <Check size={16} />
          </div>)}
        </div>)}
      </section>}
    </div>
    {(onTemplate || onEdit || canShare) && <div className="dialog-footer log-detail-actions">
      {onEdit && <button className="button primary small" type="button" onClick={() => setEditing(true)}><Pencil size={16} /> 编辑记录</button>}
      {onTemplate && <button className="button outline small" type="button" onClick={onTemplate}><Bookmark size={16} /> 另存为模板</button>}
      {canShare && <button className="button outline small" type="button" onClick={() => setSharing(true)}><Share2 size={16} /> 分享训练</button>}
    </div>}
  </Dialog>;
}
