"use client";

import { useState, type ReactNode } from "react";
import { Bookmark, CalendarPlus, ClipboardList, Plus } from "lucide-react";
import type { Plan } from "./model";
import type { LibraryRow } from "@/features/library/model";

const tabs = ["我的计划", "个人模板", "动作库"] as const;

export function PlanSections({ children, templates, date, schedule, edit, newTemplate, initial, exerciseLibrary }: {
  children: ReactNode; exerciseLibrary: ReactNode; templates: Extract<LibraryRow, { kind: "template" }>[]; date: string; schedule: (plan: Plan) => void;
  edit: (row: Extract<LibraryRow, { kind: "template" }>) => void; newTemplate: () => void; initial?: typeof tabs[number];
}) {
  const [tab, setTab] = useState<typeof tabs[number]>(initial ?? tabs[0]);
  return <div className="feature-stack training-sections">
    <div className="segmented training-tabs" role="group" aria-label="训练分类">{tabs.map((name) => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === "我的计划" && children}
    {tab === "动作库" && exerciseLibrary}
    {tab === "个人模板" && <>
      <div><button className="button primary" onClick={newTemplate}><Plus size={17} /> 新建模板</button></div>
      {!templates.length && <section className="card empty-state"><span className="tile mint"><Bookmark /></span><h3>还没有个人模板</h3><p className="empty-copy">也可以从现有计划或已完成的打卡另存为模板。</p></section>}
      {templates.length > 0 && <div className="template-grid">{templates.map((row) => <article className="card padded template-card" key={row.id}>
        <span className="tile mint"><ClipboardList size={18} /></span><h3>{row.plan.title}</h3>
        <p className="muted">{row.plan.category} · {row.plan.exercises.length} 个动作{row.plan.minutes ? " · " + row.plan.minutes + " 分钟" : ""}</p>
        <p className="template-moves">{row.plan.exercises.slice(0, 4).map((item) => item.name).join("、") || "视频跟练"}</p>
        <div>
          <button className="button outline small" onClick={() => edit(row)}>编辑</button>
          <button className="button primary small" onClick={() => schedule({ ...row.plan, date, shared: false })}><CalendarPlus size={16} /> 安排训练</button>
        </div>
      </article>)}</div>}
    </>}
  </div>;
}
