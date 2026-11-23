"use client";

import { useState, type ReactNode } from "react";
import { Bookmark, CalendarPlus, ClipboardList, Plus } from "lucide-react";
import { examples, moveBlank, planBlank, type Plan } from "./model";
import type { LibraryRow } from "@/features/library/model";

const tabs = ["我的计划", "个人模板", "示例计划", "动作库"] as const;
function builtIn(date: string) {
  return [
    examples(date),
    { ...planBlank(date), title: "全身基础力量", minutes: 30, exercises: [
      { ...moveBlank(), name: "高脚杯深蹲" }, { ...moveBlank(), name: "坐姿划船" },
      { ...moveBlank(), name: "罗马尼亚硬拉" }, { ...moveBlank(), name: "平板支撑", reps: 0, seconds: 30 },
    ] },
  ];
}

export function PlanSections({ children, templates, date, schedule, edit, newTemplate, initial, exerciseLibrary }: {
  children: ReactNode; exerciseLibrary: ReactNode; templates: Extract<LibraryRow, { kind: "template" }>[]; date: string; schedule: (plan: Plan) => void;
  edit: (row: Extract<LibraryRow, { kind: "template" }>) => void; newTemplate: () => void; initial?: typeof tabs[number];
}) {
  const [tab, setTab] = useState<typeof tabs[number]>(initial ?? tabs[0]);
  const list = tab === "示例计划" ? builtIn(date).map((plan) => ({ id: plan.title, plan })) : templates;
  return <div className="feature-stack training-sections">
    <div className="segmented training-tabs" role="group" aria-label="训练分类">{tabs.map((name) => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === "动作库" ? exerciseLibrary : tab === "我的计划" ? children : <>
      {tab === "个人模板" && <div><button className="button primary" onClick={newTemplate}><Plus size={17} /> 新建模板</button></div>}
      {!list.length && <section className="card empty-state"><span className="tile mint"><Bookmark /></span><h3>还没有个人模板</h3><p className="empty-copy">也可以从现有计划或已完成的打卡另存为模板。</p></section>}
      <div className="template-grid">{list.map((row) => <article className="card padded template-card" key={row.id}>
        <span className="tile mint"><ClipboardList size={18} /></span><h3>{row.plan.title}</h3>
        <p className="muted">{row.plan.category} · {row.plan.exercises.length} 个动作{row.plan.minutes ? " · " + row.plan.minutes + " 分钟" : ""}</p>
        <p className="template-moves">{row.plan.exercises.slice(0, 4).map((item) => item.name).join("、") || "视频跟练"}</p>
        <div>
          {tab === "个人模板" && <button className="button outline small" onClick={() => { const saved = templates.find((item) => item.id === row.id); if (saved) edit(saved); }}>编辑</button>}
          <button className="button primary small" onClick={() => schedule({ ...row.plan, date, shared: false })}><CalendarPlus size={16} /> 安排训练</button>
        </div>
      </article>)}</div>
    </>}
  </div>;
}
