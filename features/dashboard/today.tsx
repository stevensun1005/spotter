"use client";

import { ChevronLeft, ChevronRight, Clock3, Dumbbell, Play, Sparkles } from "lucide-react";
import { examples, type PlannedWorkout } from "@/features/plans/model";
import { PlanLine } from "@/features/plans/plan-view";
import { PartnerActivity } from "@/features/partner/partner-view";
import { sessionTotals, type Session } from "@/features/training/model";
import { offsetDate, shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import { isTraining, type PlanEntry, type State, type TrainingEntry } from "@/shared/state";
import { VideoLink } from "@/shared/ui";
import { ActivityCard } from "@/features/stats/activity-card";

export function Today({ state, plans, today, selected, select, drafts, begin, resume, edit, add, showLog, manage, openPlans, openStats, openImport, refresh }: {
  state: State; plans: PlanEntry[]; today: string; selected: string; select: (date: string) => void;
  drafts: { id: string; data: Session; pending: boolean }[];
  begin: (item: PlannedWorkout) => void; resume: (item: { id: string; data: Session }) => void;
  edit: (item: PlannedWorkout) => void; add: () => void; showLog: (log: TrainingEntry) => void;
  manage: () => void; openPlans: () => void; openStats: () => void; openImport: () => void;
  refresh: () => Promise<void>;
}) {
  const { me, entries } = state;
  const logs = entries.filter(isTraining).filter((entry) => entry.kind === "log");
  const myToday = logs.some((log) => log.owner === me.id && log.data.date === today);
  const dayPlans = plans.filter((item) => item.data.date === selected);
  const dayDrafts = selected === today ? drafts : drafts.filter(({ data }) => data.date === selected);
  const sample = selected === today && !dayDrafts.length && !myToday ? { id: "example", data: examples(today) } : null;
  const featured = dayPlans[0] ?? sample;
  const weekStart = offsetDate(selected, -weekdayIndex(selected));

  return <div className="today-grid">
    <div className="main-column">
      <section className="card week-card" aria-label="本周训练日期">
        <div className="section-head"><h2>训练日程</h2><div className="steppers"><button className="icon-button" onClick={() => select(offsetDate(selected, -7))} aria-label="上一周"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => select(offsetDate(selected, 7))} aria-label="下一周"><ChevronRight size={18} /></button></div></div>
        <div className="week-days">
          {weekdays.map((day, i) => {
            const date = offsetDate(weekStart, i);
            const marked = plans.some((item) => item.data.date === date) || logs.some((log) => log.data.date === date);
            return <button key={day} aria-pressed={selected === date} aria-label={date} onClick={() => select(date)}><span>周{day}</span><strong>{Number(date.slice(8))}</strong><span className="week-dot">{marked && <i />}</span></button>;
          })}
        </div>
      </section>
      <div className="section-head section-break"><h2>{selected === today ? "今日训练" : shortDate(selected) + "的训练"}</h2><button className="text-button" onClick={openPlans}>全部计划 <ChevronRight size={15} /></button></div>
      {dayDrafts.length > 0 && <section className="card plan-list">{dayDrafts.map((item) => <div className="plan-line" key={item.id}>
        <span className="tile mint"><Clock3 size={19} /></span><div><strong>{item.data.plan.title}</strong><small>{sessionTotals(item.data).sets} 组完成 · {item.pending ? "待同步" : "训练草稿"}</small></div>
        <button className="button outline small" onClick={() => resume(item)}>继续</button>
      </div>)}</section>}
      {featured && <>
        <section className="hero"><div className="hero-content">
          <span className="hero-tag"><span />{featured.id === "example" ? "示例计划" : featured.data.category}</span>
          <h2>{featured.data.title}</h2>
          <div className="hero-meta">{featured.data.minutes > 0 && <span><Clock3 size={16} /> {featured.data.minutes} 分钟</span>}{featured.data.exercises.length > 0 && <span><Dumbbell size={16} /> {featured.data.exercises.length} 个动作</span>}{featured.data.video && <span><Play size={16} /> 跟练视频</span>}</div>
          <button className="button hero-button" onClick={() => begin(featured)}><Play size={17} fill="currentColor" /> {featured.id === "example" ? "试练示例" : "开始训练"}</button>
        </div></section>
        {dayPlans.length > 1 && <section className="card plan-list">{dayPlans.slice(1).map((item, i) => <PlanLine key={item.owner + item.id} item={item} editable={item.owner === me.id} edit={edit} begin={begin} alternate={i % 2 === 1} />)}</section>}
        {featured.data.exercises.length > 0 && <section className="card padded movement-card">
          <div className="section-head"><h2>动作清单</h2><span className="count-label">{featured.data.exercises.length} 个动作</span></div>
          {featured.data.exercises.map((move, i) => <div className="list-line move-line" key={i}>
            <span className={"tile " + (i % 3 === 1 ? "lilac" : i % 3 === 2 ? "sand" : "mint")}><Dumbbell size={19} /></span>
            <span><strong>{move.name}</strong><small>{move.seconds ? "计时动作" : move.weight ? move.weight + " " + move.unit : "自重／待填重量"}</small></span>
            <span className="move-reps">{move.sets} 组 × {move.seconds ? move.seconds + " 秒" : move.reps + " 次"}</span>
          </div>)}
        </section>}
        {featured.data.video && <section className="card padded"><VideoLink url={featured.data.video} /></section>}
      </>}
      {!featured && !dayDrafts.length && <section className="card empty-state"><span className="tile mint"><Dumbbell /></span><h3>{myToday && selected === today ? "今天已完成打卡" : "这天还没有安排"}</h3><button className="button outline small" onClick={add}>添加训练</button></section>}
    </div>
    <aside className="right-column">
      <PartnerActivity state={state} today={today} manage={manage} showLog={showLog} refresh={refresh} />
      <ActivityCard today={today} self={me.id} logs={logs} open={openStats} />
      <button className="import-callout" onClick={openImport}><span className="tile lilac"><Sparkles size={20} /></span><span><strong>导入训练计划</strong><small>训练文本、AI 计划或跟练视频</small></span><ChevronRight size={18} /></button>
    </aside>
  </div>;
}
