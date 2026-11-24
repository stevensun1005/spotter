"use client";

import { useMemo, useState } from "react";
import { Bookmark, Check, Pencil, Share2 } from "lucide-react";
import { Dialog, displayNumber, VideoLink } from "@/shared/ui";
import { shortDate } from "@/shared/dates";
import { prescriptionText } from "@/features/plans/prescription";
import { sessionTotals, type Session } from "@/features/training/model";
import { formatCardioDuration } from "@/features/training/cardio";
import { parsePlanMove } from "@/features/exercises/move-name";
import { fromCatalogue, useCatalogue } from "@/features/exercises/open-gym";
import { Anatomy, type AnatomyVariant } from "@/features/exercises/anatomy";
import { exerciseTempo, tempoNotationHint } from "@/features/exercises/tempo";
import { summarize } from "@/features/stats/model";
import { EditLog } from "./edit-log";
import { ShareCard } from "@/features/share/share-card";
import { HeartPanel } from "@/features/heart/heart-panel";
import type { WhoopStatus } from "@/features/heart/whoop";
import { kindLabels } from "@/features/training/set-row";
import { ProteinCheck } from "@/features/training/protein-check";
import type { TrainingEntry } from "@/shared/state";

export function LogDetail({ log, close, own, whoop, onTemplate, onEdit, today, share, trackProtein, pendingSync, sex }: {
  log: TrainingEntry; close: () => void; own: boolean; whoop?: WhoopStatus; onTemplate?: () => void;
  today?: string; onEdit?: (next: Session) => Promise<void>; trackProtein?: boolean; pendingSync?: boolean;
  share?: { name: string; owner: string; logs: TrainingEntry[] };
  sex?: AnatomyVariant | null;
}) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { data: catalogue } = useCatalogue();
  const { volume, sets } = sessionTotals(log.data);
  const muscles = useMemo(() => summarize([log], catalogue?.rows ?? [], "all").primary.regions, [catalogue, log]);
  if (sharing && own && share) return <ShareCard log={log} {...share} sex={sex ?? undefined} close={() => setSharing(false)} />;
  if (editing && onEdit && today) return <Dialog title="编辑训练记录" onClose={() => setEditing(false)}>
    <EditLog original={log.data} today={today} cancel={() => setEditing(false)} save={async (next) => {
      await onEdit(next);
      setEditing(false);
    }} />
  </Dialog>;
  const canShare = own && share;
  const cardio = log.data.cardio;
  const canTemplate = !cardio && onTemplate;
  return <Dialog title={log.data.plan.title} className="log-detail-dialog" onClose={close}>
    <div className="dialog-body log-detail-body">
      <header className="log-overview">
        <p className="muted">{shortDate(log.data.date)} · {log.data.plan.category}</p>
        {cardio ? <div className="totals">
          <div><strong>{cardio.durationSeconds === undefined ? "—" : formatCardioDuration(cardio.durationSeconds)}</strong><span>实际时长</span></div>
          {cardio.incline?.value !== undefined && <div><strong>{cardio.incline.value}</strong><span>{cardio.incline.kind === "percent" ? "坡度 %" : "跑步机档位"}</span></div>}
          {cardio.distanceKm !== undefined && <div><strong>{cardio.distanceKm}</strong><span>距离 km</span></div>}
          {cardio.speedKmh !== undefined && <div><strong>{cardio.speedKmh}</strong><span>速度 km/h</span></div>}
        </div> : <div className="totals">
          <div><strong>{log.data.minutes}</strong><span>分钟</span></div>
          <div><strong>{sets}</strong><span>完成组数</span></div>
          <div><strong>{displayNumber(volume)}</strong><span>容量 kg</span></div>
        </div>}
      </header>
      {own && trackProtein && onEdit && <ProteinCheck checked={log.data.proteinShake === true}
        save={(proteinShake) => onEdit({ ...log.data, proteinShake })} />}
      {log.data.note && <p className="note">{log.data.note}</p>}
      {log.data.plan.video && <VideoLink url={log.data.plan.video} />}
      {pendingSync && <p className="muted" role="status">已在本机打卡，联网后自动同步</p>}
      {own && !pendingSync && <HeartPanel id={log.id} session={log.data} whoopResult={whoop} />}
      {Object.keys(muscles).length > 0 && <details className="card padded">
        <summary>肌群分布</summary><Anatomy weights={muscles} showIntensity sex={sex} />
      </details>}
      {log.data.plan.exercises.length > 0 && <section className="log-exercises" aria-label="训练动作">
        <h3>训练动作</h3>
        {log.data.plan.exercises.map((item, i) => {
          const { name, cue } = parsePlanMove(item.name);
          const choice = { ...item, name, cue: item.cue ?? cue };
          const tempo = exerciseTempo(choice, fromCatalogue(catalogue, choice), log.data.plan.category);
          return <div className="log-move" key={i}><strong>{name}</strong>
            {prescriptionText(item) && <p className="muted"><small>计划处方：{prescriptionText(item)}</small></p>}
            <p className="muted" title={tempo.numeric ? tempoNotationHint : undefined}><small>{tempo.label} {tempo.text}</small></p>
            {log.data.rows[i].map((line, j) => line.done && <div key={j}>
              <span>第 {j + 1} 组{line.kind ? " · " + kindLabels[line.kind] : ""}</span>
              <span>{line.seconds ? line.seconds + " 秒" + (line.weight ? " · " + line.weight + " " + item.unit : "") :
                line.right ? "左 " + line.weight + " " + item.unit + " × " + line.reps + " · 右 " + line.right.weight + " " + item.unit + " × " + line.right.reps :
                line.weight + " " + item.unit + " × " + line.reps + " 次"}{line.rpe === undefined ? "" : " · RPE " + line.rpe}</span>
              <Check size={16} />
            </div>)}
          </div>;
        })}
      </section>}
    </div>
    {(canTemplate || onEdit || canShare) && <div className="dialog-footer log-detail-actions">
      {onEdit && <button className="button primary small" type="button" onClick={() => setEditing(true)}><Pencil size={16} /> 编辑记录</button>}
      {canTemplate && <button className="button outline small" type="button" onClick={canTemplate}><Bookmark size={16} /> 另存为模板</button>}
      {canShare && <button className="button outline small" type="button" onClick={() => setSharing(true)}><Share2 size={16} /> 分享训练</button>}
    </div>}
  </Dialog>;
}
