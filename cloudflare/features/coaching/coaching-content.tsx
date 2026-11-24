"use client";

import { CalendarDays, CirclePlay, Dumbbell, Lock } from "lucide-react";
import type { Plan } from "@/features/plans/model";
import { prescriptionText } from "@/features/plans/prescription";
import type { Program } from "@/features/programs/model";
import { displayNumber, VideoLink } from "@/shared/ui";
import type { CoachingActual } from "./model";

export function CoachPlanContent({ plan }: { plan: Plan }) {
  return <div className="coach-plan-content">
    <div className="coach-meta"><span><CalendarDays size={15} />{plan.date}</span><span>{plan.category}</span>{plan.minutes > 0 && <span>{plan.minutes} 分钟</span>}<span><Lock size={14} />私人计划副本</span></div>
    {plan.durationNote && <p className="muted">{plan.durationNote}</p>}
    {plan.defaultRestSeconds !== undefined && <p className="muted">默认休息 {plan.defaultRestSeconds} 秒</p>}
    {plan.video && <VideoLink url={plan.video} />}
    <ol className="coach-move-list">{plan.exercises.map((move, index) => <li key={index}>
      <strong>{move.name}</strong>
      <span>{move.sets} 组 × {move.seconds > 0 ? move.seconds + " 秒" : move.repsMax ? move.reps + "–" + move.repsMax + " 次" : move.reps + " 次"}{move.weight > 0 ? " · " + move.weight + " " + move.unit : " · 重量未指定"}</span>
      <small>{[move.block && "组别 " + move.block, move.station && "器械站 " + move.station, move.restSeconds !== undefined && "组间／轮间休息 " + move.restSeconds + " 秒", move.tempo && "节奏 " + move.tempo].filter(Boolean).join(" · ")}</small>
      {prescriptionText(move) && <small>{prescriptionText(move)}</small>}
      {move.cue && <p>{move.cue}</p>}
    </li>)}</ol>
  </div>;
}

export function CoachProgramContent({ program }: { program: Program }) {
  const weeks = [...new Set(program.sessions.map((item) => item.week))].sort((a, b) => a - b);
  return <div className="coach-program-content">
    <div className="coach-meta"><span><CalendarDays size={16} />{program.startDate} 开始</span><span>{program.weeks} 周</span><span><Dumbbell size={15} />{program.sessions.length} 节训练</span>{program.sessions.some((item) => item.plan.video) && <span><CirclePlay size={15} />包含视频</span>}</div>
    {program.phases.length > 0 && <div className="coach-phases">{program.phases.map((phase) => <span key={phase.id}>{phase.name} · 第 {phase.fromWeek}–{phase.toWeek} 周</span>)}</div>}
    <div className="coach-week-list">{weeks.map((week, index) => <details key={week} open={index === 0}>
      <summary>第 {week} 周<span>{program.sessions.filter((item) => item.week === week).length} 节训练</span></summary>
      <div className="coach-week-sessions">{program.sessions.filter((item) => item.week === week).sort((a, b) => a.day - b.day).map((session) => <details className="coach-session-outline" key={session.id}>
        <summary><span><strong>{session.plan.title}</strong><small>{session.plan.date} · 第 {session.day} 天</small></span><span>{session.plan.exercises.length ? session.plan.exercises.length + " 个动作" : "视频跟练"}</span></summary>
        <CoachPlanContent plan={session.plan} />
      </details>)}</div>
    </details>)}</div>
  </div>;
}

export function CoachActualContent({ value }: { value: CoachingActual }) {
  return <div className="coach-actual">
    <p className="muted">已分享的实际记录{value.minutes > 0 ? " · " + value.minutes + " 分钟" : ""}</p>
    {value.exercises.map((move, index) => <div key={index}><strong>{move.name}</strong><ul>{move.sets.map((set, number) => <li key={number}>
      <span>{set.kind === "warmup" ? "热身" : set.kind === "drop" ? "递减" : "第 " + (number + 1) + " 组"}</span>
      <span>{set.seconds > 0 ? (set.weight > 0 ? displayNumber(set.weight) + " " + move.unit + " · " : "") + set.seconds + " 秒" : set.right ? "左 " + displayNumber(set.weight) + " " + move.unit + " × " + set.reps + " ／右 " + displayNumber(set.right.weight) + " " + move.unit + " × " + set.right.reps : displayNumber(set.weight) + " " + move.unit + " × " + set.reps}{set.rpe !== undefined ? " · RPE " + set.rpe : ""}</span>
    </li>)}</ul></div>)}
  </div>;
}
