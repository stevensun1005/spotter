"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { muscleNames } from "./labels";
import type { ExerciseGuide } from "./guidance";

const blank: ExerciseGuide = { description: "", steps: [], muscles: {} };

export function GuideEditor({ value, busy, save }: {
  value?: ExerciseGuide; busy: boolean; save: (guide: ExerciseGuide) => void;
}) {
  const [draft, setDraft] = useState(value ?? blank);
  const [steps, setSteps] = useState(draft.steps.join("\n"));
  const [muscle, setMuscle] = useState("");
  const [role, setRole] = useState(100);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = steps.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 12 || lines.some((line) => line.length > 400)) {
      setError("最多填写 12 个步骤，每步最多 400 字。");
      return;
    }
    setError("");
    save({ ...draft, description: draft.description.trim(), steps: lines });
  }
  return <details className="card padded custom-guide">
    <summary>{value ? "修改我的动作指南" : "填写动作指南"}</summary>
    <form className="form-fields" onSubmit={submit}>
      <label>动作简介<textarea rows={2} maxLength={400} value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label>动作步骤（每行一步）<textarea rows={4} maxLength={4800} value={steps} onChange={(e) => setSteps(e.target.value)} /></label>
      <div className="field-grid">
        <label>训练部位<select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">选择部位</option>{Object.entries(muscleNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>参与方式<select value={role} onChange={(e) => setRole(Number(e.target.value))}><option value={100}>主要</option><option value={40}>辅助</option></select></label>
      </div>
      <button className="button subtle" type="button" disabled={!muscle || busy} onClick={() => {
        setDraft({ ...draft, muscles: { ...draft.muscles, [muscle]: role } }); setMuscle("");
      }}><Plus size={16} /> 添加或更新部位</button>
      {Object.entries(draft.muscles).map(([key, weight]) => <div className="list-line" key={key}>
        <span>{muscleNames[key]} · {weight >= 75 ? "主要" : "辅助"}</span>
        <button type="button" className="icon-button" aria-label={"移除" + muscleNames[key]} disabled={busy} onClick={() =>
          setDraft({ ...draft, muscles: Object.fromEntries(Object.entries(draft.muscles).filter(([name]) => name !== key)) })}><Trash2 size={16} /></button>
      </div>)}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button type="submit" className="button primary" disabled={busy}>保存动作指南</button>
    </form>
  </details>;
}
