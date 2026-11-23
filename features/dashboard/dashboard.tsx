"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardList, Cloud, Dumbbell, House, Plus, Sparkles, Users } from "lucide-react";
import { History, LogDetail } from "@/features/history/history";
import { ImportView } from "@/features/import/import-view";
import { PartnerSpace } from "@/features/partner/partner-view";
import { PlanEditor, Plans } from "@/features/plans/plan-view";
import { planBlank, type Plan, type PlannedWorkout } from "@/features/plans/model";
import { Stats } from "@/features/stats/stats";
import { Workout } from "@/features/training/workout";
import { useTraining } from "@/features/training/use-training";
import type { WhoopStatus } from "@/features/heart/whoop";
import { AppleHealthConnection } from "@/features/heart/apple/connection";
import { shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import { isTraining, type Person, type PlanEntry, type TrainingEntry } from "@/shared/state";
import { avatar } from "@/shared/ui";
import { Today } from "./today";
import { useCloud } from "./use-cloud";

const navigation = [
  { id: "today", title: "今日训练", mobile: "今日", icon: House },
  { id: "plans", title: "训练计划", mobile: "计划", icon: ClipboardList },
  { id: "history", title: "打卡历史", mobile: "打卡", icon: CalendarDays },
  { id: "stats", title: "训练统计", mobile: "统计", icon: BarChart3 },
  { id: "import", title: "导入计划", mobile: "导入", icon: Sparkles },
] as const;
type View = typeof navigation[number]["id"];
type Overlay = { kind: "pair" } | { kind: "editor"; item: PlannedWorkout; editing: boolean } | { kind: "log"; log: TrainingEntry; whoop?: WhoopStatus };

export function Dashboard({ viewer, initialDate, heartReturn }: {
  viewer: Person; initialDate: string; heartReturn?: { id: string; result: WhoopStatus };
}) {
  const { today, state, status, refresh, saveInView } = useCloud(viewer, initialDate);
  const [selection, setSelection] = useState<string | null>(null);
  const [view, setView] = useState<View>(heartReturn ? "history" : "today");
  const [returnToLog, setReturnToLog] = useState(heartReturn);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState("");
  const notify = useCallback((message: string) => setToast(message), []);
  const training = useTraining(viewer.id, state.entries, refresh, saveInView, notify);

  useEffect(() => {
    if (!returnToLog || status !== "云端已连接") return;
    const log = state.entries.find((entry): entry is TrainingEntry =>
      entry.kind === "log" && entry.id === returnToLog.id && entry.owner === viewer.id);
    if (log) setOverlay({ kind: "log", log, whoop: returnToLog.result });
    setReturnToLog(undefined);
    window.history.replaceState(window.history.state, "", "/");
  }, [returnToLog, state.entries, status, viewer.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const { me, room, entries } = state;
  const plans = entries.filter((entry): entry is PlanEntry => entry.kind === "plan");
  const logs = entries.filter(isTraining).filter((entry) => entry.kind === "log");
  const selected = selection ?? today;
  const pageTitle = navigation.find((item) => item.id === view)?.title;
  const go = (next: View) => { setView(next); window.scrollTo({ top: 0 }); };
  const managed = () => setOverlay({ kind: "pair" });
  const showLog = (log: TrainingEntry) => setOverlay({ kind: "log", log });
  const close = () => setOverlay(null);
  const create = (plan: Plan) => setOverlay({ kind: "editor", item: { id: crypto.randomUUID(), data: plan }, editing: false });
  const edit = (item: PlannedWorkout) => setOverlay({ kind: "editor", item, editing: true });

  return <div className="app">
    <aside className="sidebar">
      <button className="brand" onClick={() => go("today")}><span className="brand-mark"><Dumbbell size={23} strokeWidth={2.5} /></span><span>训练搭子<small>SPOTTER CLUB</small></span></button>
      <nav aria-label="主导航" className="desktop-nav">
        {navigation.map(({ id, icon: Icon, title }) => <button className={id === view ? "active" : ""} aria-current={id === view ? "page" : undefined} key={id} onClick={() => go(id)}><Icon size={19} /><span>{title}</span>{id === view && <i />}</button>)}
      </nav>
      <button className="sidebar-pair" onClick={managed}><span className="tile lilac"><Users size={19} /></span><span><strong>搭子空间</strong><small>{room?.partner ? "查看搭子" : "邀请训练搭子"}</small></span><ChevronRight size={16} /></button>
      <div className="sidebar-footer"><span className="avatar lime">{avatar(me.name)}</span><div><strong>{me.name}</strong><small>个人账号</small></div></div>
    </aside>
    <div className="stage">
      <header className="topbar">
        <div className="crumb"><span className="mini-mark"><Dumbbell size={18} /></span><span>训练搭子</span><span className="crumb-slash">/</span><strong>{pageTitle}</strong></div>
        <div className="top-actions"><span className="cloud-status"><Cloud size={17} />{status}</span><button className="top-profile" onClick={managed} aria-label="账号与搭子空间"><span className="avatar lime">{avatar(me.name)}</span><ChevronDown size={15} /></button></div>
      </header>
      <main className="content">
        <div className="page-heading">
          <div>{view === "today" && <p className="date-line"><CalendarDays size={16} /> {shortDate(today)} · 星期{weekdays[weekdayIndex(today)]}</p>}
            <h1>{view === "today" ? "今天练什么？" : pageTitle}</h1>
            {view === "today" && <p>安排今天的训练，看看搭子练得怎么样。</p>}
            {view === "import" && <p>把聊天里的训练安排或视频链接变成可打卡的计划。</p>}
          </div>
          {(view === "today" || view === "plans") && <button className="button primary page-action" onClick={() => create(planBlank(view === "today" ? selected : today))}><Plus size={19} /> 新建计划</button>}
        </div>
        {view === "today" && <Today state={state} plans={plans} today={today} selected={selected} select={setSelection} drafts={training.drafts}
          begin={training.begin} resume={training.resume} edit={edit} add={() => create(planBlank(selected))} showLog={showLog} manage={managed}
          openPlans={() => go("plans")} openStats={() => go("stats")} openImport={() => go("import")} refresh={refresh} />}
        {view === "plans" && <Plans plans={plans} owner={me.id} today={today} begin={training.begin} edit={edit} create={create} openImport={() => go("import")} />}
        {view === "history" && <History today={today} self={me.id} partner={room?.partner?.name} logs={logs} show={showLog} />}
        {view === "stats" && <Stats today={today} self={me.id} partner={room?.partner ?? null} logs={logs} />}
        <div hidden={view !== "import"}><ImportView today={today} saved={() => { void refresh(); notify("计划已保存到云端"); go("plans"); }} notify={notify} /></div>
      </main>
    </div>
    <nav aria-label="底部导航" className="mobile-nav">{navigation.map(({ id, icon: Icon, mobile }) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon size={21} /><span>{mobile}</span></button>)}</nav>
    {overlay?.kind === "editor" && <PlanEditor item={overlay.item} editing={overlay.editing} close={close} saved={(plan) => {
      void refresh(); setSelection(plan.date); close(); notify("计划已保存到云端");
    }} />}
    {overlay?.kind === "pair" && <PartnerSpace me={me} room={room} close={close} refresh={refresh} notify={notify}>
      <AppleHealthConnection />
    </PartnerSpace>}
    {overlay?.kind === "log" && <LogDetail key={overlay.log.id} log={overlay.log} close={close}
      own={overlay.log.owner === me.id} whoop={overlay.whoop} />}
    {training.active && <Workout data={training.active.data} update={training.update} close={training.close}
      finish={async () => { const log = await training.finish(); if (log) showLog(log); }}
      pending={training.busy} error={training.error} sync={training.sync} />}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
  </div>;
}
