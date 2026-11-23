"use client";

import { useState } from "react";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { Plus, Trash2 } from "lucide-react";
import { defaultRest } from "@/features/training/sequence";
import { categories, type Move, type Plan } from "./model";

export function PlanFields({ value, change, template = false }: { value: Plan; change: (plan: Plan) => void; template?: boolean }) {
  const [picker, setPicker] = useState(false);
  const edit = (key: keyof Plan, next: Plan[keyof Plan]) => change({ ...value, [key]: next });
  const editMove = (index: number, next: Partial<Move>) => edit("exercises", value.exercises.map((item, i) => i === index ? { ...item, ...next } : item));
  return <div className="form-fields">
    <label>训练名称<input required maxLength={100} value={value.title} onChange={(e) => edit("title", e.target.value)} placeholder="例如：上肢力量训练" /></label>
    <div className="field-grid">
      {!template && <label>安排日期<input required type="date" value={value.date} onChange={(e) => edit("date", e.target.value)} /></label>}
      <label>类型<select value={value.category} onChange={(e) => edit("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="field-grid">
      <label>预计时长（分钟）<input type="number" min={0} max={720} value={value.minutes || ""} onChange={(e) => edit("minutes", Number(e.target.value))} placeholder="选填" /></label>
      {!template && <label className="toggle-label"><input type="checkbox" checked={value.shared} onChange={(e) => edit("shared", e.target.checked)} /> 与搭子共享计划</label>}
    </div>
    {value.durationNote !== undefined && <label>预计时长说明<textarea rows={2} maxLength={380} value={value.durationNote} onChange={(event) => edit("durationNote", event.target.value)} /></label>}
    <label>跟练链接<input type="url" value={value.video} onChange={(e) => edit("video", e.target.value.trim())} placeholder="YouTube 或 B站链接（选填）" /></label>
    <label>默认休息（秒）<input type="number" min={0} max={600} value={value.defaultRestSeconds ?? ""} placeholder={String(defaultRest(value))} onChange={(e) => edit("defaultRestSeconds", e.target.value === "" ? undefined : Number(e.target.value))} /></label>
    <p className="muted">相邻动作填写相同组别和器械站时，会按轮循环。换动作使用默认休息，组间或轮间时长可单独指定。</p>
    <div className="field-title"><strong>训练动作</strong><button type="button" className="button subtle small" disabled={value.exercises.length >= 30} onClick={() => setPicker(true)}><Plus size={16} /> 添加动作</button></div>
    {value.exercises.map((item, index) => <div className="move-editor" key={index}>
      <div className="move-editor-top">
        <label>动作 {index + 1}<input maxLength={100} placeholder="如：哑铃卧推" value={item.name} onChange={(e) => editMove(index, { name: e.target.value, catalogueId: undefined, sourceName: undefined })} /></label>
        <button type="button" className="icon-button" aria-label={"移除动作 " + (index + 1)} onClick={() => edit("exercises", value.exercises.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
      </div>
      <div className="field-grid">
        <label>组别<input maxLength={4} pattern="[A-Z](?:-[2-9]|-[12][0-9]|-30)?" placeholder="如 A 或 A-2；留空为独立动作" value={item.block ?? ""} onChange={(e) => editMove(index, { block: e.target.value.toUpperCase() || undefined })} /></label>
        <label>器械站<input maxLength={60} placeholder="如 哑铃＋可调凳" value={item.station ?? ""} onChange={(e) => editMove(index, { station: e.target.value || undefined })} /></label>
      </div>
      <label>动作备注<input maxLength={220} value={item.cue ?? ""} onChange={(e) => editMove(index, { cue: e.target.value || undefined })} /></label>
      <div className="move-grid">
        <label>组数<input aria-label={"动作 " + (index + 1) + " 组数"} type="number" min={1} max={30} value={item.sets || ""} onChange={(e) => editMove(index, { sets: Number(e.target.value) })} /></label>
        <label>次数<input aria-label={"动作 " + (index + 1) + " 次数"} type="number" min={0} max={999} value={item.reps} onChange={(e) => editMove(index, { reps: Number(e.target.value), repsMax: item.repsMax && item.repsMax >= Number(e.target.value) && Number(e.target.value) > 0 ? item.repsMax : undefined })} /></label>
        <label>重量<input aria-label={"动作 " + (index + 1) + " 重量"} type="number" min={0} max={2000} step="any" value={item.weight} onChange={(e) => editMove(index, { weight: Number(e.target.value) })} /></label>
        <label>单位<select value={item.unit} onChange={(e) => editMove(index, { unit: e.target.value as Move["unit"] })}><option>kg</option><option>lb</option></select></label>
        <label>秒数<input aria-label={"动作 " + (index + 1) + " 秒数"} type="number" min={0} max={18000} value={item.seconds} onChange={(e) => editMove(index, { seconds: Number(e.target.value) })} /></label>
      </div>
      <div className="field-grid">
        <label>次数上限（可选）<input type="number" min={Math.max(1, item.reps)} max={999} value={item.repsMax ?? ""} disabled={!item.reps} onChange={(event) => editMove(index, { repsMax: Number(event.target.value) || undefined })} /></label>
        <label>组间／轮间休息（秒）<input type="number" min={0} max={600} value={item.restSeconds ?? ""} onChange={(event) => editMove(index, { restSeconds: event.target.value ? Number(event.target.value) : undefined })} /></label>
      </div>
    </div>)}
    {picker && <ExercisePicker names={value.exercises.map((item) => item.name)} close={() => setPicker(false)} onUse={(move) => {
      edit("exercises", [...value.exercises, move]); setPicker(false);
    }} />}
  </div>;
}
