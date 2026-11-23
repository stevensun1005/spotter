"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { parsePlanMove } from "@/features/exercises/move-name";
import { appendSet, changeSet } from "@/features/training/set-editor";
import { sessionSchema, sessionTotals, type Session, type SetLine } from "@/features/training/model";

export function EditLog({ original, today, cancel, save }: {
  original: Session; today: string; cancel: () => void; save: (next: Session) => Promise<void>;
}) {
  const [data, setData] = useState(original);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const editSet = (move: number, row: number, values: Partial<SetLine>) =>
    setData((session) => changeSet(session, move, row, (line) => ({ ...line, ...values })));
  function removeSet(move: number, row: number) {
    setData((session) => {
      if (session.rows[move].length === 1) return changeSet(session, move, row, (line) => ({ ...line, done: false }));
      return {
        ...session,
        rows: session.rows.map((group, index) => index === move ? group.filter((_, n) => n !== row) : group),
        plan: { ...session.plan, exercises: session.plan.exercises.map((item, index) => index === move ? { ...item, sets: item.sets - 1 } : item) },
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const valid = sessionSchema.safeParse(data);
    if (!valid.success || !data.finishedVideo && sessionTotals(data).sets === 0) {
      setError("请检查日期、重量和次数，并至少保留一组完成记录。");
      return;
    }
    setPending(true);
    try { await save(valid.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "记录更新失败。"); }
    finally { setPending(false); }
  }

  return <form className="dialog-body form-fields" onSubmit={submit}>
    <fieldset disabled={pending} className="form-fields">
      <div className="field-grid">
        <label>打卡日期<input type="date" max={today} required value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} /></label>
        <label>时长（分钟）<input type="number" min={0} max={720} required value={data.minutes} onChange={(e) => setData({ ...data, minutes: Number(e.target.value) })} /></label>
      </div>
      <label>训练心得<textarea rows={3} maxLength={1500} value={data.note} onChange={(e) => setData({ ...data, note: e.target.value })} /></label>
      {data.plan.exercises.map((item, move) => <details className="edit-log-move" key={move} open={data.plan.exercises.length === 1 || undefined}>
        <summary><strong>{parsePlanMove(item.name).name}</strong><span className="muted">{data.rows[move].filter((line) => line.done).length} 组完成</span></summary>
        {data.rows[move].map((line, row) => {
          const label = "第 " + (row + 1) + " 组";
          return <fieldset className="edit-log-row" key={row} aria-label={label}>
            <div className="section-head"><label className="toggle-label"><input type="checkbox" checked={line.done} onChange={(e) => editSet(move, row, { done: e.target.checked })} />{label}完成</label>
              <button className="icon-button" type="button" aria-label={"移除" + label} onClick={() => removeSet(move, row)}><Trash2 size={17} /></button>
            </div>
            <div className="field-grid">
              <label>{line.right ? "左侧" : ""}重量（{item.unit}）<input type="number" min={0} max={2000} step="any" inputMode="decimal" value={line.weight} onChange={(e) => editSet(move, row, { weight: Number(e.target.value) })} /></label>
              {item.seconds || line.seconds ? <label>秒数<input type="number" min={0} max={18000} inputMode="numeric" value={line.seconds} onChange={(e) => editSet(move, row, { seconds: Number(e.target.value) })} /></label> :
                <label>{line.right ? "左侧" : ""}次数<input type="number" min={0} max={999} inputMode="numeric" value={line.reps} onChange={(e) => editSet(move, row, { reps: Number(e.target.value) })} /></label>}
            </div>
            {line.right && <div className="field-grid">
              <label>右侧重量（{item.unit}）<input type="number" min={0} max={2000} step="any" inputMode="decimal" value={line.right.weight} onChange={(e) => editSet(move, row, { right: { ...line.right!, weight: Number(e.target.value) } })} /></label>
              <label>右侧次数<input type="number" min={0} max={999} inputMode="numeric" value={line.right.reps} onChange={(e) => editSet(move, row, { right: { ...line.right!, reps: Number(e.target.value) } })} /></label>
            </div>}
          </fieldset>;
        })}
        <button className="button outline small" disabled={item.sets >= 30} type="button" onClick={() =>
          setData((session) => changeSet(appendSet(session, move, item.sets - 1), move, item.sets, (line) => ({ ...line, done: true })))
        }><Plus size={16} /> 加一组</button>
      </details>)}
    </fieldset>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="exercise-toolbar">
      <button className="button outline" disabled={pending} type="button" onClick={cancel}>取消</button>
      <button className="button primary" disabled={pending} type="submit">{pending ? "正在保存" : "保存修改"}</button>
    </div>
  </form>;
}
