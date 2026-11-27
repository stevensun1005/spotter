"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { offsetDate, weekdays } from "@/shared/dates";
import type { TrainingEntry } from "@/shared/state";
import { emptyNutrition, mealTypes, type LibraryItem, type LibraryRow, type MealEntry, type NutritionValues } from "@/features/library/model";
import { coreFoods, type Food } from "./foods";
import { macroRatios, splitCalories, targetForDate } from "./nutrition-planning";
import { carbCycleSchema, carbDays, cutStagesSchema, type NutritionPlanningItem } from "./nutrition-planning-schema";
import { mealFit, recipes, type Recipe } from "./nutrition-recipes";
import { saveMealRecords } from "./nutrition-records";

const toolNames = { carbCycle: "碳循环设置", cut: "减脂规划", calories: "按热量规划",
  recipes: "智能食谱", recommendations: "食物推荐", exercise: "计入运动消耗" };
export type NutritionTool = keyof typeof toolNames;

type Props = {
  tool: NutritionTool; date: string; owner?: string; rows: readonly LibraryRow[]; totals: NutritionValues; logs?: readonly TrainingEntry[];
  save: (item: LibraryItem) => Promise<void>; reload?: () => void;
  openFood: (food: Food, meal: MealEntry["meal"], grams?: number) => void; close: () => void;
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
        : props.tool === "recipes" || props.tool === "recommendations" ? <MealIdeas {...props} busy={busy} work={work} />
        : <PlanTargets {...props} busy={busy} accept={accept} />}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  </Dialog>;
}

function PlanningForm({ children, busy, enabled, onSubmit, clear }: {
  children: ReactNode; busy: boolean; enabled: boolean; onSubmit: () => void; clear?: () => void;
}) {
  return <form className="form-fields" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <fieldset className="form-fields" disabled={busy}>
      {children}
      <div className="exercise-toolbar">
        {clear && <button className="button outline" type="button" onClick={clear}>停用规划</button>}
        <button className="button primary" type="submit" disabled={!enabled}>保存规划</button>
      </div>
    </fieldset>
  </form>;
}

function PlanTargets({ tool, date, rows, busy, accept }: Props & { busy: boolean; accept: (item: LibraryItem) => void }) {
  const savedTarget = rows.find((row) => row.kind === "targets");
  const base = savedTarget?.values ?? emptyNutrition;
  const plan: NutritionPlanningItem = rows.find((row) => row.kind === "nutrition-plan") ?? { kind: "nutrition-plan" };
  const [calories, setCalories] = useState(base.calories ? String(base.calories) : "");
  const [ratios, setRatios] = useState(() => macroRatios(base));
  const [cycle, setCycle] = useState(() => plan.carbCycle ?? {
    days: Array.from({ length: 7 }, (): typeof carbDays[number] => "中碳"),
    grams: { 低碳: Math.round(base.carbs * 0.8), 中碳: Math.round(base.carbs), 高碳: Math.round(base.carbs * 1.2) },
  });
  const [stages, setStages] = useState(() => plan.cut ?? [{ date, calories: base.calories }]);
  const ratioTotal = ratios.protein + ratios.carbs + ratios.fat;
  function updateStage(index: number, update: Partial<typeof stages[number]>) {
    setStages(stages.map((stage, position) => position === index ? { ...stage, ...update } : stage));
  }

  if (tool === "carbCycle") return <PlanningForm busy={busy} enabled={carbCycleSchema.safeParse(cycle).success}
    onSubmit={() => accept({ ...plan, carbCycle: cycle })}
    clear={plan.carbCycle ? () => accept({ ...plan, carbCycle: undefined }) : undefined}>
    <p className="muted">按星期指定高、中、低碳日。碳水变化会计入当天热量目标。</p>
    {!base.calories && !plan.cut?.length && <p className="muted">设置基础热量目标后，指定日期会应用碳循环。</p>}
    <div className="field-grid">{carbDays.map((kind) => <label key={kind}>{kind}（g）
      <input type="number" required min={0} max={1500} step="any" value={cycle.grams[kind]}
        onChange={(event) => setCycle({ ...cycle, grams: { ...cycle.grams, [kind]: Number(event.target.value) } })} />
    </label>)}</div>
    <div className="field-grid">{weekdays.map((name, index) => <label key={name}>周{name}
      <select value={cycle.days[index]} onChange={(event) => {
        const short = event.target.value as typeof carbDays[number];
        setCycle({ ...cycle, days: cycle.days.map((kind, position) => position === index ? short : kind) });
      }}>{carbDays.map((kind) => <option key={kind}>{kind}</option>)}</select>
    </label>)}</div>
  </PlanningForm>;

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

function MealIdeas({ tool, date, rows, totals, owner, logs, busy, work, reload, openFood }: Props & { busy: boolean; work: Work }) {
  const [meal, setMeal] = useState<MealEntry["meal"]>("午餐");
  const attempts = useRef(new Map<string, string[]>());
  const targets = targetForDate(rows, date, logs?.filter((record) => record.owner === owner));
  const remaining = { calories: Math.max(0, targets.calories - totals.calories), protein: Math.max(0, targets.protein - totals.protein),
    carbs: Math.max(0, targets.carbs - totals.carbs), fat: Math.max(0, targets.fat - totals.fat) };
  const personal: Food[] = rows.flatMap((row) => row.kind === "food" ? [{ ...row, aliases: [] }] : []);
  const options = [...personal, ...coreFoods].sort((a, b) => mealFit(b.per100g, remaining) - mealFit(a.per100g, remaining)).slice(0, 8);
  const ideas = [...recipes].sort((a, b) => mealFit(b.totals, remaining) - mealFit(a.totals, remaining));
  const amounts = (values: Food["per100g"]) => [displayNumber(values.calories) + " 千卡",
    ...macroFields.map((key) => macroLabels[key] + " " + displayNumber(values[key]) + " g")].join(" · ");

  function addRecipe(recipe: Recipe) {
    const key = meal + recipe.title;
    const ids = attempts.current.get(key) ?? recipe.ingredients.map(() => crypto.randomUUID());
    attempts.current.set(key, ids);
    work(async () => {
      await saveMealRecords(recipe.ingredients.map(({ food, grams, amounts }, index) => ({
        kind: "nutrition", id: ids[index], date, entry: { type: "meal", meal, name: food.name, foodId: food.id, grams, ...amounts },
      })));
      reload?.();
    });
  }

  return <div className="form-fields">
    <label>记入餐次<select value={meal} disabled={busy}
      onChange={(event) => setMeal(event.target.value as MealEntry["meal"])}>
      {mealTypes.map((meal) => <option key={meal}>{meal}</option>)}
    </select></label>
    {targets.calories > 0 && <p className="muted">按当天营养余额排序，剩余 {displayNumber(remaining.calories)} 千卡。</p>}
    {tool === "recipes" ? ideas.map((recipe) => <article className="card padded feature-stack" key={recipe.title}>
      <div><h3>{recipe.title}</h3><small className="muted">{amounts(recipe.totals)}</small></div>
      <p>{recipe.ingredients.map(({ food, grams }) => `${food.name} ${grams} g`).join(" · ")}</p><p className="muted">{recipe.method}</p>
      <button className="button outline small" type="button" disabled={busy || !owner} onClick={() => addRecipe(recipe)}>记入{meal}</button>
    </article>) : options.map((food) => <article className="card padded feature-stack" key={food.id}>
      <h3>{food.name}</h3><small className="muted">每 100 g · {amounts(food.per100g)}</small>
      <button className="button outline small" type="button" disabled={!owner} onClick={() => openFood(food, meal)}>添加到{meal}</button>
    </article>)}
  </div>;
}
