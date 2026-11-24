"use client";

import { useState } from "react";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { fromCatalogue, useCatalogue } from "@/features/exercises/open-gym";
import { exerciseTempo, tempoMaxLength, tempoNotationHint } from "@/features/exercises/tempo";
import { Plus, Trash2 } from "lucide-react";
import { defaultRest } from "@/features/training/sequence";
import { categories, prescribedWeight, type Move, type Plan } from "./model";
import { resolvePlanTemplate } from "./template-link";
import { addPlanMove, phaseOf, setMovePhase, type MovePhase } from "./move-phase";

export function PlanFields({ value, change, template = false, templates, allowSharing = true }: {
  value: Plan; change: (plan: Plan) => void; template?: boolean; templates?: readonly { id: string; plan: Plan }[]; allowSharing?: boolean;
}) {
  const [picker, setPicker] = useState<MovePhase | number>();
  const { data: catalogue } = useCatalogue();
  const linked = !template && Boolean(value.templateId);
  const ownExercises = linked && value.ownExercises === true;
  const selected = templates?.find((item) => item.id === value.templateId);
  const resolved = linked ? resolvePlanTemplate(value, selected?.plan) : value;
  const edit = (key: keyof Plan, next: Plan[keyof Plan]) => change({ ...value, [key]: next });
  const editMove = (index: number, next: Partial<Move>) => edit("exercises", value.exercises.map((item, i) => {
    if (i !== index) return item;
    const changed = { ...item, ...next };
    if (changed.loadPercent && changed.loadPercent.percent > 0 && changed.loadPercent.reference > 0) {
      changed.weight = prescribedWeight(changed.loadPercent, changed.unit);
    }
    return changed;
  }));
  const share = !template && allowSharing && <label className="toggle-label"><input type="checkbox" checked={value.shared}
    onChange={(event) => edit("shared", event.target.checked)} /> 与搭子共享计划</label>;

  function selectTemplate(id: string) {
    if (!id) {
      change({ ...resolved, templateId: undefined, ownExercises: undefined });
      return;
    }
    const match = templates?.find((item) => item.id === id);
    if (!match) return;
    change(resolvePlanTemplate({ ...value, templateId: id, ownExercises: undefined, title: value.title.trim() ? value.title : match.plan.title }, match.plan));
  }

  function usePickedMove(move: Move) {
    if (typeof picker === "number") {
      editMove(picker, { name: move.name, catalogueId: move.catalogueId, sourceName: undefined });
    } else if (picker) {
      edit("exercises", addPlanMove(value.exercises, move, picker));
    }
    setPicker(undefined);
  }

  return <div className="form-fields">
    {!template && templates && <label>训练模板<select value={value.templateId ?? ""} onChange={(event) => selectTemplate(event.target.value)}>
      <option value="">独立计划</option>
      {linked && !selected && <option value={value.templateId}>原模板不可用</option>}
      {templates.map((item) => <option key={item.id} value={item.id}>{item.plan.title}</option>)}
    </select></label>}
    <label>训练名称<input required maxLength={100} value={value.title} onChange={(e) => edit("title", e.target.value)} placeholder="例如：上肢力量训练" /></label>
    <div className="field-grid">
      {!template && <label>安排日期<input required type="date" value={value.date} onChange={(e) => edit("date", e.target.value)} /></label>}
      {linked ? share : <label>类型<select value={value.category} onChange={(e) => edit("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>}
    </div>
    {!template && (linked || value.week !== undefined || value.day !== undefined) && <div className="field-grid">
      <label>周次（可选）<input type="number" min={1} max={104} inputMode="numeric" value={value.week ?? ""}
        onChange={(event) => edit("week", event.target.value ? Number(event.target.value) : undefined)} /></label>
      <label>练次（可选）<input type="number" min={1} max={7} inputMode="numeric" value={value.day ?? ""}
        onChange={(event) => edit("day", event.target.value ? Number(event.target.value) : undefined)} /></label>
    </div>}
    {linked && <>
      <p className="muted">{templates && !selected ? "原模板不可用，显示已保存的动作。" : ownExercises ? "动作修改只适用于本次训练。" : "动作和组数来自个人模板。"}</p>
      {(!ownExercises || selected) && <button className="button outline small" type="button" onClick={() => change(ownExercises
        ? resolvePlanTemplate({ ...value, ownExercises: undefined }, selected?.plan)
        : { ...resolved, ownExercises: true })}>{ownExercises ? "恢复模板动作" : "自定义本次动作"}</button>}
      {!ownExercises && <details className="move-editor">
        <summary>{[resolved.category, resolved.exercises.length ? resolved.exercises.length + " 个动作" : "视频跟练",
          resolved.minutes > 0 && resolved.minutes + " 分钟"].filter(Boolean).join(" · ")}</summary>
        {resolved.exercises.length > 0 && <ul className="sequence-moves">{resolved.exercises.map((item, index) => <li key={index}>
          <span>{item.name} · {item.sets} 组 · {exerciseTempo(item, fromCatalogue(catalogue, item), resolved.category).text}</span>
        </li>)}</ul>}
        {resolved.durationNote && <p className="muted">{resolved.durationNote}</p>}
      </details>}
    </>}
    {!linked && <>
      <div className="field-grid">
        <label>预计时长（分钟）<input type="number" min={0} max={720} value={value.minutes || ""} onChange={(e) => edit("minutes", Number(e.target.value))} placeholder="选填" /></label>
        {share}
      </div>
      {value.durationNote !== undefined && <label>预计时长说明<textarea rows={2} maxLength={380} value={value.durationNote} onChange={(event) => edit("durationNote", event.target.value)} /></label>}
      <label>跟练链接<input type="url" value={value.video} onChange={(e) => edit("video", e.target.value.trim())} placeholder="YouTube 或 B站链接（选填）" /></label>
      <label>默认休息（秒）<input type="number" min={0} max={600} value={value.defaultRestSeconds ?? ""} placeholder={String(defaultRest(value))} onChange={(e) => edit("defaultRestSeconds", e.target.value === "" ? undefined : Number(e.target.value))} /></label>
    </>}
    {(!linked || ownExercises) && <>
      <p className="muted">相邻动作填写相同组别和器械站时，会按轮循环。换动作使用默认休息，组间或轮间时长可单独指定。</p>
      {([["warmup", "热身动作"], ["work", "正式动作"]] as const).map(([phase, title]) => <section key={phase} className="feature-stack" aria-label={title}>
        <div className="field-title"><strong>{title}</strong><button type="button" className="button subtle small"
          disabled={value.exercises.length >= 30} onClick={() => setPicker(phase)}><Plus size={16} />{phase === "warmup" ? "添加热身" : "添加动作"}</button></div>
      {value.exercises.map((item, index) => phaseOf(item) === phase && <div className="move-editor" key={index}>
        <div className="move-editor-top">
          <label>动作 {index + 1}<input maxLength={100} placeholder="如：哑铃卧推" value={item.name} onChange={(e) => editMove(index, { name: e.target.value, catalogueId: undefined, sourceName: undefined })} /></label>
          <button type="button" className="icon-button" aria-label={"移除动作 " + (index + 1)} onClick={() => edit("exercises", value.exercises.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
        </div>
        <div className="field-grid">
          <label>组别<input maxLength={4} pattern="[A-Z](?:-[2-9]|-[12][0-9]|-30)?" placeholder="如 A 或 A-2；留空为独立动作" value={item.block ?? ""} onChange={(e) => editMove(index, { block: e.target.value.toUpperCase() || undefined })} /></label>
          <label>器械站<input maxLength={60} placeholder="如 哑铃＋可调凳" value={item.station ?? ""} onChange={(e) => editMove(index, { station: e.target.value || undefined })} /></label>
        </div>
        <div className="field-title">
          <button className="text-button" type="button" onClick={() => editMove(index, setMovePhase(item, phase === "warmup" ? "work" : "warmup"))}>
            {phase === "warmup" ? "转为正式动作" : "设为热身"}
          </button>
          {ownExercises && <button className="text-button" type="button" aria-label={"替换动作 " + (index + 1)} onClick={() => setPicker(index)}>从动作库替换</button>}
        </div>
        <div className="field-grid">
          <label>动作备注<input aria-label={"动作 " + (index + 1) + " 备注"} maxLength={220} value={item.cue ?? ""} onChange={(e) => editMove(index, { cue: e.target.value || undefined })} /></label>
          <label>节奏<input aria-label={"动作 " + (index + 1) + " 节奏"} maxLength={tempoMaxLength} title={tempoNotationHint} value={item.tempo ?? ""}
            placeholder={exerciseTempo(item, fromCatalogue(catalogue, item), value.category).text}
            onChange={(event) => editMove(index, { tempo: event.target.value || undefined })} /></label>
        </div>
        <div className="move-grid">
          <label>组数<input aria-label={"动作 " + (index + 1) + " 组数"} type="number" min={1} max={30} value={item.sets || ""} onChange={(e) => editMove(index, { sets: Number(e.target.value) })} /></label>
          <label>次数<input aria-label={"动作 " + (index + 1) + " 次数"} type="number" min={0} max={999} value={item.reps} onChange={(e) => editMove(index, { reps: Number(e.target.value), repsMax: item.repsMax && item.repsMax >= Number(e.target.value) && Number(e.target.value) > 0 ? item.repsMax : undefined })} /></label>
          <label>重量<input aria-label={"动作 " + (index + 1) + " 重量"} type="number" min={0} max={2000} step="any" value={item.weight} disabled={Boolean(item.loadPercent)} onChange={(e) => editMove(index, { weight: Number(e.target.value) })} /></label>
          <label>单位<select value={item.unit} onChange={(e) => editMove(index, { unit: e.target.value as Move["unit"] })}><option>kg</option><option>lb</option></select></label>
          <label>秒数<input aria-label={"动作 " + (index + 1) + " 秒数"} type="number" min={0} max={18000} value={item.seconds} onChange={(e) => editMove(index, { seconds: Number(e.target.value) })} /></label>
        </div>
        <div className="field-grid">
          <label>次数上限（可选）<input type="number" min={Math.max(1, item.reps)} max={999} value={item.repsMax ?? ""} disabled={!item.reps} onChange={(event) => editMove(index, { repsMax: Number(event.target.value) || undefined })} /></label>
          <label>组间／轮间休息（秒）<input type="number" min={0} max={600} value={item.restSeconds ?? ""} onChange={(event) => editMove(index, { restSeconds: event.target.value ? Number(event.target.value) : undefined })} /></label>
        </div>
        <details className="prescription-fields"><summary>负荷方式与目标 RPE</summary><div className="form-fields">
          <div className="field-grid"><label>负荷方式<select value={item.loadPercent ? "percent" : "absolute"} onChange={(event) => editMove(index, { loadPercent: event.target.value === "percent" ? { percent: 0, reference: 0, unit: item.unit } : undefined })}><option value="absolute">直接填写重量</option><option value="percent">手填 1RM 的百分比</option></select></label>
            <label>目标 RPE（可选）<input type="number" min={1} max={10} step={0.5} value={item.targetRpe ?? ""} placeholder="训练时另记实际 RPE" onChange={(event) => editMove(index, { targetRpe: event.target.value ? Number(event.target.value) : undefined })} /></label></div>
          {item.loadPercent && <><div className="field-grid"><label>1RM 百分比 %<input type="number" min={1} max={150} step="any" required value={item.loadPercent.percent || ""} onChange={(event) => editMove(index, { loadPercent: { ...item.loadPercent!, percent: Number(event.target.value) } })} /></label><label>已确认的 1RM 参考重量<input type="number" min={0.01} max={2000} step="any" required value={item.loadPercent.reference || ""} onChange={(event) => editMove(index, { loadPercent: { ...item.loadPercent!, reference: Number(event.target.value) } })} /></label></div>
            <div className="field-grid"><label>参考重量单位<select value={item.loadPercent.unit} onChange={(event) => editMove(index, { loadPercent: { ...item.loadPercent!, unit: event.target.value as "kg" | "lb" } })}><option value="kg">kg</option><option value="lb">lb</option></select></label><p className="muted">处方重量 {item.weight} {item.unit}</p></div><p className="muted">填入你确认的参考值，不自动采用历史估算 1RM。按原单位的周进阶或减量会改为直接重量。</p></>}
        </div></details>
      </div>)}
      </section>)}
      {picker !== undefined && <ExercisePicker names={value.exercises.map((item) => item.name)}
        identityOnly={typeof picker === "number"} close={() => setPicker(undefined)} onUse={usePickedMove} />}
    </>}
  </div>;
}
