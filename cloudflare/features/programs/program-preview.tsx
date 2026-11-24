"use client";

import { useState } from "react";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { Dialog } from "@/shared/ui";
import type { ProgramPreview } from "./model";
import { programError } from "./program-form";

const statusNames: Record<ProgramPreview["items"][number]["status"], string> = {
  new: "新增计划", update: "可更新", unchanged: "无需变更", custom: "保留自定义",
  protected: "保护已有训练", blocked: "本次跳过", deleted: "保留删除状态",
};

export function ProgramPreviewDialog({ value, close, refresh, commit }: {
  value: ProgramPreview; close: () => void; refresh: () => Promise<void>;
  commit: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const count = value.counts;
  const writable = count.new + count.update;
  const protectedCount = count.custom + count.protected;
  const skippedCount = count.unchanged + count.blocked + count.deleted;
  const rows = expanded ? value.items : value.items.slice(0, 12);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); }
    catch (reason) { setError(programError(reason)); }
    finally { setBusy(false); }
  }

  return <Dialog title="核对周期排期" onClose={close} className="program-preview-dialog">
    <div className="dialog-body feature-stack">
      <p className="muted">共 {value.items.length} 节训练。只写入新增及可更新的计划；已开始、已完成和自行改过的训练保持原样。</p>
      <div className="program-preview-counts">
        <div><strong>{count.new}</strong><span>新增</span></div>
        <div><strong>{count.update}</strong><span>更新</span></div>
        <div><strong>{protectedCount}</strong><span>保留原内容</span></div>
        <div><strong>{skippedCount}</strong><span>无需写入 / 跳过</span></div>
      </div>
      <div className="program-preview-list">{rows.map((item) => <div className="program-preview-row" key={item.id}>
        <div><strong>{item.title}</strong><small>{item.date} · 第 {item.week} 周，第 {item.day} 天</small><small>{item.reason}</small></div>
        <span className="program-state">{statusNames[item.status]}</span>
      </div>)}</div>
      {!expanded && value.items.length > rows.length && <button className="button subtle small" type="button" onClick={() => setExpanded(true)}>查看全部 {value.items.length} 节训练</button>}
      <p className="program-notice">预览后若计划在另一处被修改，需要重新核对。重复确认同一份周期不会新增重复计划。</p>
      <p className="muted">移除周期草稿里的训练不会自动删除日历计划；需要删除日历训练时，请到原计划入口处理。</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
    <div className="dialog-footer">
      <button className="button outline" type="button" disabled={busy} onClick={() => void act(refresh)}><RefreshCw size={16} />重新核对</button>
      <button className="button primary" type="button" disabled={busy || writable === 0} onClick={() => void act(commit)}><CalendarCheck size={17} />{busy ? "正在处理" : writable ? "确认写入 " + writable + " 节" : "无需写入"}</button>
    </div>
  </Dialog>;
}
