"use client";

import { useState, type FormEvent } from "react";
import { Apple, CupSoda, Plus, Scale, Trash2 } from "lucide-react";
import { displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { useLibrary } from "@/features/library/use-library";
import { emptyNutrition, mealTypes, type NutritionEntry, type NutritionValues } from "@/features/library/model";

const metrics = [
  { id: "calories", label: "热量", unit: "千卡", color: "#79523b" }, { id: "protein", label: "蛋白质", unit: "g", color: "#a45932" },
  { id: "carbs", label: "碳水", unit: "g", color: "#665fa2" }, { id: "fat", label: "脂肪", unit: "g", color: "#a14458" },
  { id: "water", label: "饮水", unit: "ml", color: "#267579" },
] as const;
type Editor = typeof mealTypes[number] | "饮水" | "体重" | "每日目标";

export function NutritionView({ enabled, today }: { enabled: boolean; today: string }) {
  const [date, setDate] = useState(today);
  const [editor, setEditor] = useState<Editor>();
  const [name, setName] = useState("");
  const [values, setValues] = useState<NutritionValues>(emptyNutrition);
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saveId, setSaveId] = useState("");
  const store = useLibrary(enabled, date);
  const targets = store.rows.find((row) => row.kind === "targets")?.values ?? emptyNutrition;
  const rows = store.rows.filter((row) => row.kind === "nutrition");
  const totals = rows.reduce<NutritionValues>((sum, { entry }) => {
    if (entry.type === "water") sum.water += entry.ml;
    if (entry.type === "meal") {
      sum.calories += entry.calories; sum.protein += entry.protein; sum.carbs += entry.carbs; sum.fat += entry.fat;
    }
    return sum;
  }, { ...emptyNutrition });

  function open(next: Editor) {
    setEditor(next); setName(""); setWeight(""); setError(""); setConfirm(""); setSaveId(crypto.randomUUID());
    setValues(next === "每日目标" ? targets : emptyNutrition);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true); setError("");
    try {
      if (editor === "每日目标") await store.save({ kind: "targets", values });
      else {
        const { water, ...mealValues } = values;
        const entry: NutritionEntry = editor === "饮水" ? { type: "water", ml: water } : editor === "体重" ?
          { type: "weight", kg: Number(weight) } : { type: "meal", name, meal: editor, ...mealValues };
        await store.save({ kind: "nutrition", date, id: saveId, entry });
      }
      setEditor(undefined);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError("");
    try { await store.remove("nutrition", id); setConfirm(""); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <div className="feature-stack">
    <section className="card padded feature-stack nutrition-summary">
      <div className="section-head"><h2>每日概览</h2><input type="date" aria-label="饮食日期" required disabled={busy} value={date} onChange={(event) => {
        if (event.target.value) { setDate(event.target.value); setEditor(undefined); setConfirm(""); setError(""); }
      }} /></div>
      <div className="nutrition-calories"><strong>{displayNumber(totals.calories)}</strong><span> {targets.calories ? "/ " + displayNumber(targets.calories) + " " : ""}千卡</span>
        <button className="button outline small" type="button" onClick={() => open("每日目标")} disabled={!enabled || busy || store.loading}>设置目标</button></div>
      <div className="nutrition-metrics">{metrics.slice(1).map(({ id, label, unit, color }) => {
        const percent = targets[id] ? Math.round(totals[id] / targets[id] * 100) : null;
        return <div key={id}><div className="nutrition-ring" style={{ "--percent": Math.min(100, percent ?? 0) + "%", "--ring": color } as React.CSSProperties}>
          <div><strong>{displayNumber(totals[id])}</strong><small>{percent === null ? unit : percent + "%"}</small></div>
        </div><span>{label} · {unit}</span></div>;
      })}</div>
      <div className="nutrition-actions">
        {mealTypes.map((meal) => <button className="button subtle small" key={meal} disabled={!enabled || busy} onClick={() => open(meal)}><Apple size={16} /> {meal}</button>)}
        <button className="button subtle small" disabled={!enabled || busy} onClick={() => open("饮水")}><CupSoda size={16} /> 饮水</button>
        <button className="button subtle small" disabled={!enabled || busy} onClick={() => open("体重")}><Scale size={16} /> 记体重</button>
      </div>
      {!enabled && <p className="muted">登录后可把饮食记录保存到云端。</p>}
      {store.loading && <p className="muted" role="status">正在读取记录…</p>}
      {store.error && <button className="button outline small" onClick={() => void store.load()}>{store.error}</button>}
    </section>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {editor && <section className="card padded feature-stack">
      <h2>{editor === "每日目标" ? "每日目标" : "记录" + editor}</h2>
      <form className="form-fields" onSubmit={save}>
        <fieldset className="form-fields" disabled={busy}>
          {editor !== "每日目标" && editor !== "饮水" && editor !== "体重" && <label>食物名称<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>}
          {editor === "体重" ? <label>体重（kg）<input required type="number" step="0.1" min={10} max={700} value={weight} onChange={(event) => setWeight(event.target.value)} /></label> :
            <div className="field-grid">{metrics.filter(({ id }) => editor === "每日目标" || (editor === "饮水" ? id === "water" : id !== "water"))
              .map(({ id, label, unit }) => <label key={id}>{label}（{unit}）<input required={editor === "饮水"} type="number" step="any" min={editor === "饮水" ? 1 : 0} max={20000}
                placeholder={editor === "每日目标" ? "不设目标" : "0"} value={values[id] || ""} onChange={(event) => setValues({ ...values, [id]: Number(event.target.value) })} /></label>)}</div>}
        </fieldset>
        <div className="exercise-toolbar"><button className="button outline" type="button" disabled={busy} onClick={() => setEditor(undefined)}>取消</button>
          <button className="button primary" disabled={busy}><Plus size={17} /> 保存{editor === "每日目标" ? "目标" : "记录"}</button></div>
      </form>
    </section>}
    <section className="card padded feature-stack"><h2>当天记录</h2>
      {!store.loading && !rows.length && <p className="empty-copy">这一天还没有饮食、饮水或体重记录。</p>}
      {rows.map(({ id, entry }) => <div className="list-line nutrition-row" key={id}>
        <span className="tile mint">{entry.type === "meal" ? <Apple size={18} /> : entry.type === "water" ? <CupSoda size={18} /> : <Scale size={18} />}</span>
        <div><strong>{entry.type === "meal" ? entry.meal + " · " + entry.name : entry.type === "water" ? "饮水" : "体重"}</strong>
          <small>{entry.type === "meal" ? displayNumber(entry.calories) + " 千卡 · 蛋白质 " + entry.protein + " g · 碳水 " + entry.carbs + " g · 脂肪 " + entry.fat + " g" :
            entry.type === "water" ? displayNumber(entry.ml) + " ml" : displayNumber(entry.kg) + " kg"}</small></div>
        {confirm === id ? <div><button className="button outline small" type="button" disabled={busy} onClick={() => void remove(id)}>确认删除</button><button className="button subtle small" type="button" disabled={busy} onClick={() => setConfirm("")}>取消</button></div> :
          <button className="icon-button" aria-label="删除记录" disabled={busy} type="button" onClick={() => setConfirm(id)}><Trash2 size={16} /></button>}
      </div>)}
    </section>
  </div>;
}
