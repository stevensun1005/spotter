"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { offsetDate, weekdayIndex, weekdays } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { emptyNutrition, type LibraryItem, type LibraryRow } from "@/features/library/model";
import { carbGramsFromTarget, carbTargetShares, macroRatios, plannedTargetForDate, splitCalories } from "./nutrition-planning";
import { carbCycleSchema, carbDays, cutStagesSchema, type CarbCycle, type CarbDay, type NutritionPlanningItem } from "./nutrition-planning-schema";

const toolNames = { carbCycle: "碳循环设置", cut: "减脂规划", calories: "按热量规划", exercise: "计入运动消耗" };
export type NutritionTool = keyof typeof toolNames;

type Props = {
  tool: NutritionTool; date: string; owner?: string; rows: readonly LibraryRow[]; logs?: readonly TrainingEntry[];
  save: (item: LibraryItem) => Promise<void>; openGoals: () => void; close: () => void;
};
type Work = (job: () => Promise<void>) => void;
const macroLabels = { protein: "蛋白质", carbs: "碳水", fat: "脂肪" } as const;
const macroFields = ["protein", "carbs", "fat"] as const;

export function NutritionTools(props: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const work: Work = (job) => {
    if (busy) return;
    setError(""); setBusy(true);
    void job().then(props.close, (reason) => { setError(errorText(reason)); setBusy(false); });
  };
  const accept = (item: LibraryItem) => work(() => props.save(item));
  return <Dialog title={toolNames[props.tool]} onClose={() => { if (!busy) props.close(); }} className="nutrition-tool">
    <div className="dialog-body feature-stack">
      {props.tool === "exercise" ? <ExerciseEnergy {...props} busy={busy} accept={accept} />
        : props.tool === "carbCycle" ? <CarbCycleSettings {...props} busy={busy} accept={accept} />
        : <PlanTargets {...props} busy={busy} accept={accept} />}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  </Dialog>;
}

function PlanningForm({ children, busy, enabled, onSubmit, clear, saveLabel = "保存规划", clearLabel = "停用规划" }: {
  children: ReactNode; busy: boolean; enabled: boolean; onSubmit: () => void; clear?: () => void; saveLabel?: string; clearLabel?: string;
}) {
  return <form className="form-fields" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <fieldset className="form-fields" disabled={busy}>
      {children}
      <div className="exercise-toolbar">
        {clear && <button className="button outline" type="button" onClick={clear}>{clearLabel}</button>}
        <button className="button primary" type="submit" disabled={!enabled}>{saveLabel}</button>
      </div>
    </fieldset>
  </form>;
}

function CarbCycleSettings({ rows, date, busy, accept, openGoals }: Props & { busy: boolean; accept: (item: LibraryItem) => void }) {
  const plan: NutritionPlanningItem = rows.find((row) => row.kind === "nutrition-plan") ?? { kind: "nutrition-plan" };
  const saved = plan.carbCycle;
  const base = plannedTargetForDate(rows, date, null);
  const linked = carbGramsFromTarget(base.carbs);
  const [followsTarget, setFollowsTarget] = useState(!saved || saved.basis === "target");
  const [days, setDays] = useState<CarbDay[]>(() => saved?.days ?? Array<CarbDay>(7).fill("中碳"));
  const [fixed, setFixed] = useState(() => {
    const values = !saved || saved.basis === "target" ? linked : saved.grams;
    return { 低碳: String(values.低碳), 中碳: String(values.中碳), 高碳: String(values.高碳) };
  });
  const grams = (kind: CarbDay) => fixed[kind].trim() ? Number(fixed[kind]) : NaN;
  const draft: CarbCycle = { days, basis: followsTarget ? "target" : undefined,
    grams: followsTarget ? linked : { 低碳: grams("低碳"), 中碳: grams("中碳"), 高碳: grams("高碳") } };
  const parsed = carbCycleSchema.safeParse(draft);
  const monday = offsetDate(date, -weekdayIndex(date));

  return <PlanningForm busy={busy} enabled={parsed.success} saveLabel="保存碳循环" clearLabel="停用碳循环"
    onSubmit={() => { if (parsed.success) accept({ ...plan, carbCycle: parsed.data }); }}
    clear={saved ? () => accept({ ...plan, carbCycle: undefined }) : undefined}>
    <section className="card nutrition-cycle-base" aria-label="当日营养目标">
      <Target size={20} aria-hidden="true" />
      <div><strong>当日营养目标</strong><small>{base.calories > 0
        ? `${displayNumber(base.calories)} 千卡 · 碳水 ${displayNumber(base.carbs)} g`
        : "设置热量目标后，碳循环会应用到饮食记录。"}</small></div>
      <button className="button outline small" type="button" aria-label="编辑营养目标" onClick={openGoals}>编辑</button>
    </section>
    <fieldset className="nutrition-cycle-modes">
      <legend className="field-title">目标基准</legend>
      <label><input type="radio" name="nutrition-cycle-mode" checked={followsTarget}
        onChange={() => setFollowsTarget(true)} /> 跟随营养目标</label>
      <label><input type="radio" name="nutrition-cycle-mode" checked={!followsTarget}
        onChange={() => setFollowsTarget(false)} /> 固定克数</label>
    </fieldset>
    <p className="muted">{followsTarget ? "营养目标或减脂阶段变化时，各档碳水会自动重新计算。" : "调整营养目标后，各档碳水仍按这里填写的克数计算。"}</p>
    <section className="feature-stack" aria-labelledby="nutrition-cycle-level-heading">
      <h3 id="nutrition-cycle-level-heading">碳水档位</h3>
      <div className="nutrition-cycle-levels">{carbDays.map((kind) => <div key={kind} className="nutrition-cycle-level" data-tier={kind}>
        {followsTarget ? <div><span>{kind} · {Math.round(carbTargetShares[kind] * 100)}%</span>
          <strong>{base.calories > 0 ? `${displayNumber(linked[kind])} g` : "—"}</strong></div>
          : <label>{kind}（g）<input type="number" min={0} max={1500} step="any" required value={fixed[kind]}
            onChange={(event) => setFixed({ ...fixed, [kind]: event.target.value })} /></label>}
      </div>)}</div>
      <p className="muted">{!followsTarget && !parsed.success ? "请输入 0–1500 克，低碳 ≤ 中碳 ≤ 高碳。"
        : "碳水每增减 1 克，热量相应增减 4 千卡。蛋白质和脂肪沿用当日目标。"}</p>
    </section>
    <section className="feature-stack" aria-labelledby="nutrition-cycle-week-heading">
      <h3 id="nutrition-cycle-week-heading">每周安排与预览</h3>
      <div className="nutrition-cycle-week">{weekdays.map((name, index) => {
        const preview = parsed.success ? plannedTargetForDate(rows, offsetDate(monday, index), parsed.data) : undefined;
        const kind = days[index];
        const summary = preview && preview.calories > 0
          ? `碳水 ${displayNumber(preview.carbs)} g · ${displayNumber(preview.calories)} 千卡`
          : !followsTarget && parsed.success ? `碳水 ${displayNumber(parsed.data.grams[kind])} g` : undefined;
        return <label className="nutrition-cycle-day" key={name} data-tier={kind}>
          <span>周{name}{summary && <small>{summary}</small>}</span>
          <select aria-label={`周${name}碳水档位`} value={kind} onChange={(event) => {
            const next = event.target.value as CarbDay;
            setDays(days.map((value, position) => position === index ? next : value));
          }}>{carbDays.map((value) => <option key={value}>{value}</option>)}</select>
        </label>;
      })}</div>
      <p className="muted">按周重复。预览为所选日期所在的一周，不含单独计入的运动消耗。</p>
    </section>
  </PlanningForm>;
}

function PlanTargets({ tool, date, rows, busy, accept }: Props & { busy: boolean; accept: (item: LibraryItem) => void }) {
  const savedTarget = rows.find((row) => row.kind === "targets");
  const base = savedTarget?.values ?? emptyNutrition;
  const plan: NutritionPlanningItem = rows.find((row) => row.kind === "nutrition-plan") ?? { kind: "nutrition-plan" };
  const [calories, setCalories] = useState(base.calories ? String(base.calories) : "");
  const [ratios, setRatios] = useState(() => macroRatios(base));
  const [stages, setStages] = useState(() => plan.cut ?? [{ date, calories: base.calories }]);
  const ratioTotal = ratios.protein + ratios.carbs + ratios.fat;
  function updateStage(index: number, update: Partial<typeof stages[number]>) {
    setStages(stages.map((stage, position) => position === index ? { ...stage, ...update } : stage));
  }

  if (tool === "cut") return <PlanningForm busy={busy} enabled={stages.length > 0 && cutStagesSchema.safeParse(stages).success}
    onSubmit={() => accept({ ...plan, cut: stages })} clear={plan.cut?.length ? () => accept({ ...plan, cut: undefined }) : undefined}>
    <p className="muted">设置各阶段的起始日和每日热量。系统沿用当前的宏量营养比例。</p>
    {stages.map((stage, index) => <div className="nutrition-stage-editor" key={index}>
      <label>第 {index + 1} 阶段起始日<input type="date" required value={stage.date}
        onChange={(event) => updateStage(index, { date: event.target.value })} /></label>
      <label>每日热量（千卡）<input type="number" required min={1200} max={20000} value={stage.calories || ""}
        onChange={(event) => updateStage(index, { calories: Number(event.target.value) })} /></label>
      {stages.length > 1 && <button className="icon-button" type="button" aria-label={`移除第 ${index + 1} 阶段`}
        onClick={() => setStages(stages.filter((_, position) => position !== index))}><Trash2 size={16} /></button>}
    </div>)}
    {stages.length < 8 && <button className="button outline" type="button" onClick={() => {
      const last = stages.at(-1);
      setStages([...stages, { date: offsetDate(last?.date || date, 14), calories: last?.calories || base.calories }]);
    }}><Plus size={16} /> 添加阶段</button>}
  </PlanningForm>;

  const next = splitCalories(Number(calories), ratios, base.water);
  return <PlanningForm busy={busy} enabled={ratioTotal === 100 && Number(calories) >= 1200 && Number(calories) <= 20000}
    onSubmit={() => accept({ ...savedTarget, kind: "targets", values: next })}>
    <label>每日热量（千卡）<input type="number" required min={1200} max={20000} value={calories}
      onChange={(event) => setCalories(event.target.value)} /></label>
    <div className="field-grid">{macroFields.map((nutrient) => <label key={nutrient}>{macroLabels[nutrient]}（%）
      <input type="number" required min={0} max={100} value={ratios[nutrient]}
        onChange={(event) => setRatios({ ...ratios, [nutrient]: Number(event.target.value) })} />
    </label>)}</div>
    <p className="muted">{ratioTotal === 100 ? macroFields.map((nutrient) => macroLabels[nutrient] + " " + next[nutrient] + " g").join(" · ")
      : "营养比例合计需要为 100%。"}</p>
  </PlanningForm>;
}

function ExerciseEnergy({ date, owner, rows, logs, busy, accept }: Props & { busy: boolean; accept: (item: LibraryItem) => void }) {
  const workouts = logs?.filter((log) => log.kind === "log" && log.owner === owner && log.data.date === date) ?? [];
  const saved = rows.find((row) => row.kind === "nutrition-energy" && row.id === date);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(
    saved?.kind === "nutrition-energy" ? saved.workouts.map(({ id, calories }) => [id, String(calories)]) : []));
  const chosen = workouts.flatMap((workout) => Object.hasOwn(selected, workout.id) ? [{ id: workout.id, calories: Number(selected[workout.id]) }] : []);
  function save(event: FormEvent) {
    event.preventDefault();
    accept({ kind: "nutrition-energy", id: date, workouts: chosen });
  }
  if (!workouts.length) return <p className="muted">当天没有已完成的训练可选择。</p>;
  return <form className="form-fields" onSubmit={save}>
    <p className="muted">勾选训练并填入设备或记录上的消耗。保存后会加到当天的热量目标。</p>
    {workouts.map((workout) => <div className="nutrition-energy-row" key={workout.id}>
      <label><input type="checkbox" checked={Object.hasOwn(selected, workout.id)} disabled={busy} onChange={(event) => {
        const next = { ...selected };
        if (event.target.checked) next[workout.id] = "";
        else delete next[workout.id];
        setSelected(next);
      }} /> {workout.data.plan.title}{workout.data.minutes > 0 && <small> · {workout.data.minutes} 分钟</small>}</label>
      {Object.hasOwn(selected, workout.id) && <label>消耗（千卡）
        <input type="number" required min={1} max={5000} step="any" value={selected[workout.id]} disabled={busy}
          onChange={(event) => setSelected({ ...selected, [workout.id]: event.target.value })} />
      </label>}
    </div>)}
    <button className="button primary" type="submit" disabled={busy}>保存运动消耗</button>
  </form>;
}
