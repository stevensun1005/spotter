"use client";

import { useState } from "react";
import { Check, ClipboardList, Dumbbell, Play, Sparkles } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { shortDate } from "@/shared/dates";
import { errorText } from "@/shared/client";
import type { PlanEntry } from "@/shared/state";
import { examples, type Plan, type PlannedWorkout } from "./model";
import { PlanFields } from "./plan-fields";
import { savePlanBatch } from "./client";

export function PlanLine({ item, editable, edit, begin, alternate }: {
  item: PlanEntry; editable: boolean; edit: (item: PlannedWorkout) => void; begin: (item: PlannedWorkout) => void; alternate?: boolean;
}) {
  return <div className="plan-line">
    <span className={"tile " + (alternate ? "lilac" : "mint")}>{item.data.video ? <Play size={20} /> : <Dumbbell size={20} />}</span>
    <div><strong>{item.data.title}</strong><small>{shortDate(item.data.date)} · {item.data.category}{item.data.minutes ? " · " + item.data.minutes + " 分钟" : ""}{item.data.shared ? " · 共享" : ""}</small></div>
    <div className="plan-actions">{editable && <button className="button subtle small" onClick={() => edit(item)}>编辑</button>}<button className="button outline small" onClick={() => begin(item)}>开始</button></div>
  </div>;
}

export function Plans({ plans, owner, today, begin, edit, create, openImport }: {
  plans: PlanEntry[]; owner: string; today: string; begin: (item: PlannedWorkout) => void;
  edit: (item: PlannedWorkout) => void; create: (plan: Plan) => void; openImport: () => void;
}) {
  return <section className="card padded">
    <div className="section-head"><h2>全部计划</h2><button className="button subtle small" onClick={openImport}><Sparkles size={17} /> 导入计划</button></div>
    {plans.length ? [...plans].sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((item, i) => <PlanLine key={item.owner + item.id} item={item} editable={item.owner === owner} edit={edit} begin={begin} alternate={i % 2 === 1} />) :
      <div className="empty-state"><span className="tile mint"><ClipboardList size={22} /></span><h3>还没有训练计划</h3><button className="button outline small" onClick={() => create(examples(today))}>使用示例计划</button></div>}
  </section>;
}

export function PlanEditor({ item, editing, close, saved }: {
  item: PlannedWorkout; editing: boolean; close: () => void; saved: (plan: Plan) => void;
}) {
  const [data, setData] = useState(item.data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Dialog title={editing ? "编辑计划" : "新建计划"} onClose={() => { if (!busy) close(); }}>
    <form onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try { await savePlanBatch([{ id: item.id, data }]); saved(data); }
      catch (reason) { setError(errorText(reason)); setBusy(false); }
    }}>
      <div className="dialog-body"><fieldset className="feature-fields" disabled={busy}><PlanFields value={data} change={setData} /></fieldset>{error && <p className="inline-error" role="alert">{error}</p>}</div>
      <div className="dialog-footer"><button type="button" className="button outline" onClick={close} disabled={busy}>取消</button><button className="button primary" disabled={busy}><Check size={18} /> 保存计划</button></div>
    </form>
  </Dialog>;
}
