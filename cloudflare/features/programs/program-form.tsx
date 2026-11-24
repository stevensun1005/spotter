"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { weekdayIndex, weekdays } from "@/shared/dates";
import { PlanFields } from "@/features/plans/plan-fields";
import { planBlank, type Plan } from "@/features/plans/model";
import { buildProgram } from "./builder";
import type { CoachingRules, Program } from "./model";

export type ProgramTemplate = { id: string; plan: Plan };
type Slot = { day: number; templateId: string; plan: Plan };

export function programError(reason: unknown) {
  if (reason && typeof reason === "object" && "issues" in reason) return "请检查周期名称、日期、周次、阶段范围及每节训练的动作或视频。";
  return reason instanceof Error ? reason.message : "操作未完成，请稍后重试。";
}

const snapshot = (plan: Plan): Plan => ({ ...structuredClone(plan), templateId: undefined, shared: false });

export function CreateProgram({ today, templates, close, save }: {
  today: string; templates: readonly ProgramTemplate[]; close: () => void; save: (program: Program) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [weeks, setWeeks] = useState(4);
  const [slots, setSlots] = useState<Slot[]>(() => [1, 3, 5].map((day) => ({ day, templateId: "", plan: planBlank(today) })));
  const [phases, setPhases] = useState<Program["phases"]>(() => [{ id: crypto.randomUUID(), name: "训练阶段", fromWeek: 1, toWeek: 4, color: "mint" }]);
  const [weightPerWeek, setWeightPerWeek] = useState("0");
  const [repsPerWeek, setRepsPerWeek] = useState("0");
  const [deloadWeeks, setDeloadWeeks] = useState("");
  const [deloadPercent, setDeloadPercent] = useState(80);
  const [editDay, setEditDay] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dayLabel = (day: number) => "第 " + day + " 天 · 周" + weekdays[(weekdayIndex(startDate || today) + day - 1) % 7];

  function toggleDay(day: number) {
    setSlots((current) => current.some((item) => item.day === day)
      ? current.filter((item) => item.day !== day)
      : [...current, { day, templateId: "", plan: planBlank(startDate || today) }].sort((a, b) => a.day - b.day));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const selectedDeloadWeeks = deloadWeeks.trim() ? deloadWeeks.split(/[,，、\s]+/).filter(Boolean).map(Number) : [];
      if (selectedDeloadWeeks.some((week) => !Number.isInteger(week) || week < 1 || week > weeks)) throw new Error("减量周请填写周期内的周次，用逗号分隔。");
      const program = buildProgram({ title, startDate, weeks, phases, days: slots.map(({ day, plan }) => ({ day, plan: snapshot(plan) })),
        progression: { weightPerWeek: Number(weightPerWeek), repsPerWeek: Number(repsPerWeek), deloadWeeks: selectedDeloadWeeks, deloadPercent } });
      await save(program);
    } catch (reason) { setError(programError(reason)); }
    finally { setBusy(false); }
  }

  const edited = slots.find((slot) => slot.day === editDay);
  if (edited) return <Dialog title={dayLabel(edited.day) + "的基础训练"} onClose={() => setEditDay(null)} className="program-edit-dialog">
    <div className="dialog-body"><PlanFields template value={edited.plan} change={(plan) => setSlots((current) => current.map((slot) => slot.day === edited.day ? { ...slot, plan, templateId: "" } : slot))} /></div>
    <div className="dialog-footer"><button className="button primary" type="button" onClick={() => setEditDay(null)}><Check size={17} /> 完成编辑</button></div>
  </Dialog>;

  return <Dialog title="新建训练周期" onClose={close} className="program-create-dialog">
    <form className="program-form" onSubmit={(event) => void submit(event)}>
      <fieldset className="feature-fields dialog-body program-form" disabled={busy} style={{ border: 0, margin: 0 }}>
        <section className="program-form-section form-fields">
          <h3>周期安排</h3>
          <label>周期名称<input autoFocus required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：4 周基础力量" /></label>
          <div className="field-grid">
            <label>第一周开始日期<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>周数<input type="number" inputMode="numeric" required min={1} max={52} value={weeks || ""} onChange={(event) => {
              const next = Number(event.target.value); setWeeks(next);
              setPhases((current) => current.length === 1 ? [{ ...current[0], toWeek: next }] : current);
            }} /></label>
          </div>
          <p className="muted">先创建私人草稿，核对每周内容和日期后再排入日历。</p>
        </section>

        <section className="program-form-section form-fields">
          <h3>每周训练</h3>
          <p className="muted">选择相对开始日期的训练日，再使用个人模板或编写基础训练。</p>
          <div className="program-days" role="group" aria-label="每周训练日">{Array.from({ length: 7 }, (_, index) => index + 1).map((day) =>
            <button key={day} type="button" aria-pressed={slots.some((slot) => slot.day === day)} aria-label={dayLabel(day)} onClick={() => toggleDay(day)}>周{weekdays[(weekdayIndex(startDate || today) + day - 1) % 7]}</button>)}</div>
          {!slots.length && <p className="inline-error">至少选择一个训练日。</p>}
          <div className="program-slots">{slots.map((slot, index) => <div className="program-slot" key={slot.day}>
            <div className="program-slot-line">
              <label>{dayLabel(slot.day)}<select value={slot.templateId} onChange={(event) => {
                const selected = templates.find((item) => item.id === event.target.value);
                setSlots((current) => current.map((item) => item.day === slot.day ? { ...item, templateId: selected?.id ?? "", plan: selected ? snapshot(selected.plan) : planBlank(startDate || today) } : item));
              }}><option value="">自定义训练</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.plan.title}</option>)}</select></label>
              <button className="button outline small" type="button" onClick={() => setEditDay(slot.day)}>编辑训练</button>
            </div>
            <div className="program-card-meta"><span>{slot.plan.title || "尚未填写训练内容"}</span><span>{slot.plan.exercises.filter((move) => move.name).length} 个动作</span></div>
            {index > 0 && <button className="text-button" type="button" onClick={() => setSlots((current) => current.map((item, i) => i === index ? { ...item, templateId: "", plan: snapshot(current[index - 1].plan) } : item))}><Copy size={14} /> 复制上一节内容</button>}
          </div>)}</div>
          <p className="muted">使用模板当前内容的副本。逐周编辑不会修改个人模板。</p>
        </section>

        <section className="program-form-section form-fields">
          <div className="section-head"><h3>训练阶段</h3><button className="button subtle small" type="button" disabled={phases.length >= 12} onClick={() => setPhases((current) => [...current, { id: crypto.randomUUID(), name: "新阶段", fromWeek: Math.min(weeks, (current.at(-1)?.toWeek ?? 0) + 1), toWeek: weeks, color: "lilac" }])}><Plus size={15} /> 添加阶段</button></div>
          {phases.map((phase, index) => <div className="program-phase-row" key={phase.id}>
            <label>阶段名称<input required maxLength={80} value={phase.name} onChange={(event) => setPhases((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label>
            <label>起始周<input required type="number" min={1} max={weeks} value={phase.fromWeek || ""} onChange={(event) => setPhases((current) => current.map((item, i) => i === index ? { ...item, fromWeek: Number(event.target.value) } : item))} /></label>
            <label>结束周<input required type="number" min={phase.fromWeek || 1} max={weeks} value={phase.toWeek || ""} onChange={(event) => setPhases((current) => current.map((item, i) => i === index ? { ...item, toWeek: Number(event.target.value) } : item))} /></label>
            <button className="icon-button" type="button" aria-label={"删除阶段 " + phase.name} onClick={() => setPhases((current) => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
          </div>)}
        </section>

        <details className="program-form-section form-fields"><summary>进阶与减量（可选）</summary>
          <p className="muted">仅按你填写的规则计算。未知重量保持 0，不推算 1RM。</p>
          <div className="program-progress-controls">
            <label>每周增加重量（动作原单位）<input required type="number" min={-100} max={100} step="any" value={weightPerWeek} onChange={(event) => setWeightPerWeek(event.target.value)} /></label>
            <label>每周增加次数<input required type="number" min={-50} max={50} step={1} value={repsPerWeek} onChange={(event) => setRepsPerWeek(event.target.value)} /></label>
            <label>减量周<input value={deloadWeeks} onChange={(event) => setDeloadWeeks(event.target.value)} placeholder="例如：4，8" /></label>
            <label>减量周保留重量（%）<input type="number" min={0} max={100} step={1} value={deloadPercent} onChange={(event) => setDeloadPercent(Number(event.target.value))} /></label>
          </div>
          <p className="muted">{weeks || 0} 周 × 每周 {slots.length} 节，共 {(weeks || 0) * slots.length} 节草稿。生成后每节仍可调整。</p>
          <p className="muted">进阶改变重量时，该节改用计算后的固定重量，原百分比负荷目标不再沿用。</p>
        </details>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </fieldset>
      <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy || !slots.length}><Check size={17} />{busy ? "正在保存" : "创建周期草稿"}</button></div>
    </form>
  </Dialog>;
}

export function CoachingRulesForm({ value, close, save }: { value: CoachingRules; close: () => void; save: (rules: CoachingRules) => Promise<void> }) {
  const [rules, setRules] = useState(value);
  const [avoid, setAvoid] = useState(value.avoid.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Dialog title="我的编排偏好" onClose={close} className="program-edit-dialog">
    <form onSubmit={(event) => {
      event.preventDefault(); setBusy(true); setError("");
      void save({ ...rules, avoid: avoid.split(/\n/).map((item) => item.trim()).filter(Boolean) }).catch((reason) => setError(programError(reason))).finally(() => setBusy(false));
    }}>
      <fieldset className="dialog-body program-rules-form feature-fields" disabled={busy} style={{ border: 0, margin: 0 }}>
        <p className="muted">这些偏好仅你可见。授权的 AI Agent 可读取它们，按你的习惯起草计划。</p>
        <label>训练原则<textarea rows={4} maxLength={4000} value={rules.principles} onChange={(event) => setRules({ ...rules, principles: event.target.value })} placeholder="例如：优先使用现有动作库；同一循环尽量在同一器械站完成。" /></label>
        <label>进阶习惯<textarea rows={3} maxLength={2000} value={rules.progression} onChange={(event) => setRules({ ...rules, progression: event.target.value })} placeholder="写下何时加重、增加次数或安排减量周。" /></label>
        <label>可用器械<textarea rows={3} maxLength={1000} value={rules.equipment} onChange={(event) => setRules({ ...rules, equipment: event.target.value })} placeholder="例如：GoodLife、哑铃、可调凳、绳索。" /></label>
        <label>需要避开的动作（每行一个，最多 50 个）<textarea rows={4} value={avoid} onChange={(event) => setAvoid(event.target.value)} /></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </fieldset>
      <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy}><Check size={17} />{busy ? "正在保存" : "保存偏好"}</button></div>
    </form>
  </Dialog>;
}
