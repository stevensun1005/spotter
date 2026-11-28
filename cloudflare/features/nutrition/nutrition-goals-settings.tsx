"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Calculator, Check, Flame, Pencil, Plus, Repeat2, Scale, Trash2, TrendingDown } from "lucide-react";
import { readBodyInputs } from "@/features/body/profile";
import { useLibrary } from "@/features/library/use-library";
import { emptyNutrition, nutritionValues, type LibraryItem, type LibraryRow, type NutritionValues } from "@/features/library/model";
import { SettingsLink, SettingsRows } from "@/features/settings/settings-hub";
import { errorText } from "@/shared/client";
import { displayNumber } from "@/shared/ui";
import { NutritionGoalEstimator, type NutritionGoalDraft } from "./nutrition-goal-estimator";
import { splitCalories } from "./nutrition-planning";
import { useNutritionPreferences } from "./nutrition-preferences";

export type NutritionPlanner = "carbCycle" | "cut" | "calories";
export type TargetsRow = Extract<LibraryRow, { kind: "targets" }>;
export type SaveTargets = (item: Extract<LibraryItem, { kind: "targets" }>, revision?: string | null) => Promise<void>;

const macroFields = [
  { id: "protein", label: "蛋白质", unit: "g", tint: "#bb723d" },
  { id: "carbs", label: "碳水", unit: "g", tint: "#797bba" },
  { id: "fat", label: "脂肪", unit: "g", tint: "#b55a6f" },
  { id: "water", label: "饮水", unit: "ml", tint: "#378c86" },
] as const;
const standardTemplates = [
  { name: "均衡比例", macros: [25, 50, 25] },
  { name: "高碳比例", macros: [20, 55, 25] },
  { name: "高蛋白比例", macros: [30, 40, 30] },
] as const;

function TargetTemplates({ owner, values, onApply }: { owner: string; values: NutritionValues; onApply: (values: NutritionValues) => void }) {
  const { preferences, update } = useNutritionPreferences(owner);
  const [custom, setCustom] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  function add(event: FormEvent) {
    event.preventDefault();
    const parsed = nutritionValues.safeParse(values);
    if (!name.trim() || !parsed.success || !Object.values(parsed.data).some((value) => value > 0)) return;
    update({ templates: [...preferences.templates, { id: crypto.randomUUID(), name: name.trim(), values: parsed.data }] });
    setAdding(false);
    setName("");
  }
  return <section className="feature-stack nutrition-settings-templates">
    <div className="section-head"><h3>目标模板</h3>
      <button type="button" className="text-button" onClick={() => { setCustom(true); setAdding(!adding); }}><Plus size={17} aria-hidden="true" /> 新建</button>
    </div>
    <div className="segmented" role="group" aria-label="目标模板类型">
      <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>自定义</button>
      <button type="button" aria-pressed={!custom} onClick={() => setCustom(false)}>内置比例</button>
    </div>
    {custom && adding && <form className="form-fields" onSubmit={add}>
      <label>模板名称<input value={name} maxLength={36} required onChange={(event) => setName(event.target.value)} /></label>
      <button className="button outline" disabled={!name.trim() || !Object.values(values).some((value) => value > 0)}>保存当前目标为模板</button>
    </form>}
    {custom ? preferences.templates.length ? <div className="settings-rows">{preferences.templates.map((item) => <div className="settings-control" key={item.id}>
      <button type="button" className="nutrition-template-name" onClick={() => onApply(item.values)}>
        <strong>{item.name}</strong><small className="muted">填入 {displayNumber(item.values.calories)} 千卡目标</small>
      </button>
      <button type="button" className="icon-button" aria-label={`移除 ${item.name}`} onClick={() => update({ templates: preferences.templates.filter(({ id }) => id !== item.id) })}>
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </div>)}</div> : <p className="muted">在此设备保存常用营养目标。</p>
      : <div className="settings-rows">{standardTemplates.map(({ name: title, macros }) => <button type="button" className="settings-control" key={title}
        disabled={!values.calories} onClick={() => {
          const [protein, carbs, fat] = macros;
          onApply(splitCalories(values.calories, { protein, carbs, fat }, values.water));
        }}><strong>{title}</strong><small>蛋白质 {macros[0]}% · 碳水 {macros[1]}% · 脂肪 {macros[2]}%</small></button>)}
      {!values.calories && <p className="muted nutrition-settings-caption">先填每日热量，再套用比例。</p>}</div>}
  </section>;
}

export function NutritionGoalsSettings({ owner, enabled, readyToEdit, today, targets, trainingDays, onSaveTargets, onBody, onWeight = onBody, onPlanning }: {
  owner: string; enabled: boolean; readyToEdit: boolean; today: string; targets?: TargetsRow;
  /** Training days per week seen in recent workouts, used until the person has their own number. */
  trainingDays?: number;
  onSaveTargets: SaveTargets; onBody: () => void; onWeight?: () => void; onPlanning?: (tool: NutritionPlanner) => void;
}) {
  const body = useLibrary(enabled, undefined, true);
  const { weightKg } = readBodyInputs(body.rows, today);
  const [values, setValues] = useState<NutritionValues>(targets?.values ?? emptyNutrition);
  const [targetWeight, setTargetWeight] = useState(() => targets?.targetWeightKg === undefined ? "" : String(targets.targetWeightKg));
  const [draft, setDraft] = useState<NutritionGoalDraft>(() => {
    const saved = targets?.preference;
    // A preference without training days was saved by the earlier estimator, whose activity levels also covered exercise.
    const reviewActivity = Boolean(saved && saved.trainingDays === undefined);
    return {
      goal: saved?.goal ?? "", activity: reviewActivity ? "" : saved?.activity ?? "",
      trainingDays: saved?.trainingDays, pace: saved?.pace ?? "standard",
      minKg: saved?.weightRange?.minKg?.toString() ?? "", maxKg: saved?.weightRange?.maxKg?.toString() ?? "", reviewActivity,
    };
  });
  const [manual, setManual] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const dailyTargetsHeading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; warning?: boolean }>();
  const macroSizes = [values.protein * 4, values.carbs * 4, values.fat * 9];
  const totalMacro = macroSizes.reduce((sum, amount) => sum + amount, 0);

  useEffect(() => {
    if (manual) dailyTargetsHeading.current?.focus();
  }, [manual]);

  async function save(next: NutritionValues, estimated?: NutritionGoalDraft) {
    if (busy || !enabled || !readyToEdit || form.current?.reportValidity() === false) return;
    let preference = targets?.preference;
    if (estimated?.goal && estimated.activity) {
      const { goal, activity, pace, minKg, maxKg, trainingDays } = estimated;
      const weightRange = goal === "recompose" && minKg && maxKg ? { minKg: Number(minKg), maxKg: Number(maxKg) } : undefined;
      preference = { goal, activity, trainingDays, pace: goal === "lose" || goal === "gain" ? pace : undefined, weightRange };
    }
    setBusy(true); setFeedback(undefined);
    try {
      await onSaveTargets({ kind: "targets", values: next, targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
        preference }, targets?.updated ?? null);
      setValues(next);
      if (estimated) setDraft(estimated);
      setFeedback({ message: "已保存营养目标。" });
    } catch (reason) {
      setFeedback({ message: errorText(reason), warning: true });
    } finally { setBusy(false); }
  }

  return <div className="feature-stack">
    <form ref={form} className="feature-stack" onSubmit={(event) => { event.preventDefault(); if (manual) void save(values); }}>
      <fieldset className="feature-stack nutrition-settings-fieldset" disabled={busy || !readyToEdit}>
        <section className="nutrition-target-weight">
          <div><span className="muted">当前体重</span><button type="button" className="text-button" onClick={onWeight} aria-label="记录当前体重">
            <strong>{body.loading ? "…" : weightKg === undefined ? "—" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(weightKg)}</strong>
            <span>kg</span><Pencil size={15} aria-hidden="true" />
          </button></div>
          <ArrowRight size={18} aria-hidden="true" />
          <label className="form-fields"><span className="muted">目标体重（kg）</span><input type="number" inputMode="decimal" step="any" min={10} max={700}
            placeholder="未设定" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} /></label>
        </section>
        {!manual ? <NutritionGoalEstimator body={body} enabled={enabled} today={today} draft={draft} loggedTrainingDays={trainingDays} onChange={setDraft}
          water={targets?.values.water ?? 0} targetWeightKg={targetWeight ? Number(targetWeight) : undefined}
          onSave={save} saving={busy} onBody={onBody}
          onManual={() => { setManual(true); setFeedback(undefined); }} />
        : <section className="feature-stack nutrition-daily-targets">
          <div className="section-head"><h3 ref={dailyTargetsHeading} tabIndex={-1}>手动填写</h3>
            <button type="button" className="text-button" onClick={() => { setManual(false); setFeedback(undefined); }}>
              <Calculator size={17} aria-hidden="true" /> 按身体数据计算
            </button>
          </div>
          <div className="form-fields">
            <label>每日热量（千卡）<input type="number" inputMode="decimal" min={0} max={20000} step="any" placeholder="未设定"
              value={values.calories || ""} onChange={(event) => setValues({ ...values, calories: Number(event.target.value) })} /></label>
            {totalMacro > 0 && <div className="nutrition-target-bar" aria-label="三大营养素热量比例" role="img">{macroSizes.map((size, index) =>
              <i key={macroFields[index].id} style={{ width: `${size / totalMacro * 100}%`, background: macroFields[index].tint }} />)}</div>}
            <div className="field-grid">{macroFields.map(({ id, label, unit, tint }) => <label key={id}>
              <span className="nutrition-target-field-label"><i style={{ background: tint }} />{label}（{unit}）</span>
              <input type="number" inputMode="decimal" min={0} max={20000} step="any" placeholder="未设定" value={values[id] || ""}
                onChange={(event) => setValues({ ...values, [id]: Number(event.target.value) })} />
            </label>)}</div>
          </div>
        </section>}
      </fieldset>
      {manual && <button className="button primary nutrition-goal-save" disabled={!enabled || !readyToEdit || busy}><Check size={17} aria-hidden="true" />{busy ? "保存中…" : "保存"}</button>}
      {feedback && <p className={feedback.warning ? "inline-error" : "muted"} role={feedback.warning ? "alert" : "status"}>{feedback.message}</p>}
      {!enabled && <p className="muted"><Scale size={16} aria-hidden="true" /> 登录后可保存个人目标。</p>}
      {enabled && !readyToEdit && <p className="muted" role="status">请读取云端目标后再编辑。</p>}
    </form>
    {onPlanning && <SettingsRows title="营养规划">
      <SettingsLink label="碳循环规划" detail="按星期安排高、中、低碳目标" icon={Repeat2} onClick={() => onPlanning("carbCycle")} />
      <SettingsLink label="减脂规划" detail="安排阶段与每日目标" icon={TrendingDown} onClick={() => onPlanning("cut")} />
      <SettingsLink label="用热量来规划" detail="按热量拆分三大营养素" icon={Flame} onClick={() => onPlanning("calories")} />
    </SettingsRows>}
    {manual && readyToEdit && <TargetTemplates owner={owner} values={values} onApply={setValues} />}
  </div>;
}
