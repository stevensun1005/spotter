"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, Plus, Search, WandSparkles } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import type { FoodPortions, MealEntry, PersonalFood } from "@/features/library/model";
import { useLibrary } from "@/features/library/use-library";
import { foods, maxFoodGrams, scaleNutrition, searchFoods, type Food } from "./foods";
import { FoodPhoto } from "./food-photo";
import { commonMealFoods, splitFoodQuery, type RecentMealFood } from "./recent-foods";
import { PortionEditor } from "./portion-editor";
import { portionGrams, portionKey } from "./portions";

const nutrients = [
  { key: "calories", label: "热量", unit: "千卡" },
  { key: "protein", label: "蛋白质", unit: "g" },
  { key: "carbs", label: "碳水", unit: "g" },
  { key: "fat", label: "脂肪", unit: "g" },
] as const;
type Mode = "lookup" | "manual" | "personal" | "photo" | "meal-photo";
type Values = Food["per100g"];

export function MealEditor({ owner, meal, initial, initialFood, initialGrams, initialQuery = "", coachDate, preferAll = false,
  personal, recent, savedPortions, close, onLog, onSaveFood, onSavePortions, onMealPhoto }: {
  owner: string;
  meal: MealEntry["meal"];
  initial?: MealEntry;
  initialFood?: Food;
  initialGrams?: number;
  initialQuery?: string;
  coachDate?: string;
  preferAll?: boolean;
  personal: PersonalFood[];
  recent: RecentMealFood[];
  savedPortions: FoodPortions[];
  close: () => void;
  onLog: (entry: MealEntry) => Promise<void>;
  onSaveFood: (food: PersonalFood) => Promise<void>;
  onSavePortions: (item: FoodPortions) => Promise<void>;
  onMealPhoto?: () => void;
}) {
  const myFoods: Food[] = personal.map(({ id, name, per100g }) => ({ id, name, per100g, aliases: [] }));
  const choices = [...myFoods, ...foods];
  const [selected, setSelected] = useState<Food | undefined>(() => initialFood ?? choices.find((food) => food.id === initial?.foodId));
  const [mode, setMode] = useState<Mode>(() => coachDate ? "meal-photo" : initial && !selected ? "manual" : "lookup");
  const [query, setQuery] = useState(initialQuery);
  const [showAll, setShowAll] = useState(preferAll);
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(() => String(initialGrams ?? initial?.grams ?? ""));
  const [unit, setUnit] = useState("");
  const [values, setValues] = useState<Partial<Values>>(() =>
    initial ? { calories: initial.calories, protein: initial.protein, carbs: initial.carbs, fat: initial.fat } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewingPhoto, setReviewingPhoto] = useState(false);
  const coachHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { coachHeading.current?.focus({ preventScroll: true }); }, []);

  const available = savedPortions.find(({ id }) => id === selected?.id)?.portions ?? [];
  const portion = available.find(({ name }) => portionKey(name) === unit);
  const grams = portionGrams(amount, mode === "lookup" ? portion : undefined);
  const computed = selected && grams !== undefined ? scaleNutrition(selected.per100g, grams) : undefined;
  const { name: foodQuery, grams: queryGrams } = splitFoodQuery(query);
  const searching = Boolean(query.trim());
  const common = commonMealFoods(choices, recent, meal);
  const portions = new Map(common.map(({ food, grams }) => [food.id, grams]));
  const displayed = searching ? searchFoods(foodQuery, choices).slice(0, 12).map((food) => ({ food, grams: portions.get(food.id) }))
    : showAll ? common : common.slice(0, 12);
  const choosing = mode === "lookup" && !selected;
  const photo = mode === "photo" || mode === "meal-photo";

  function setManual(next: "manual" | "personal") {
    setMode(next);
    setReviewingPhoto(false);
    setName(foodQuery.slice(0, 100));
    setValues({});
    setAmount(queryGrams ?? "");
    setError("");
  }

  function choose(food: Food, lastGrams?: number) {
    setSelected(food);
    setReviewingPhoto(false);
    setUnit("");
    setAmount(queryGrams ?? (lastGrams === undefined ? "" : String(lastGrams)));
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || choosing || photo) return;
    const nutrition = { calories: values.calories ?? 0, protein: values.protein ?? 0, carbs: values.carbs ?? 0, fat: values.fat ?? 0 };
    if (mode === "lookup" && (!selected || !computed)) return setError("请输入有效的食物克数。");
    if (mode !== "lookup" && !name.trim()) return setError("请输入食物名称。");
    if (reviewingPhoto && (nutrients.some(({ key }) => values[key] === undefined) || (mode === "manual" && grams === undefined))) {
      return setError("请核对并填写完整的份量和营养数值。");
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "personal") {
        if (myFoods.some((food) => food.name.trim().toLowerCase() === name.trim().toLowerCase())) {
          setError("我的食物库里已有这个名称。可以加上品牌或口味来区分。");
          return;
        }
        const food = { kind: "food", id: crypto.randomUUID(), name: name.trim(), per100g: nutrition } as const;
        await onSaveFood(food);
        choose({ ...food, aliases: [] });
        setMode("lookup");
        return;
      }
      if (mode === "lookup" && selected && computed) {
        await onLog({ type: "meal", meal, name: selected.name, foodId: selected.id, grams, ...computed });
      } else {
        await onLog({ type: "meal", meal, name, ...(grams !== undefined ? { grams } : {}), ...nutrition });
      }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  const weightInput = (required: boolean) => <label>吃了多少（g）<input type="number" inputMode="decimal" required={required}
    min="0.1" step="any" max={maxFoodGrams} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={required ? "例如 40" : "选填"} /></label>;

  const form = <form onSubmit={save}>
      <div className="dialog-body feature-stack">
        {photo ? <FoodPhoto owner={owner} onBack={coachDate ? undefined : () => setMode("lookup")}
          onManual={() => setManual(mode === "meal-photo" ? "manual" : "personal")} onMeal={mode === "meal-photo" ? (draft) => {
          setName(draft.name.slice(0, 96) + "（估算）");
          setAmount(String(draft.grams ?? ""));
          setValues({ calories: draft.calories, protein: draft.protein, carbs: draft.carbs, fat: draft.fat });
          setError("");
          setReviewingPhoto(true);
          setMode("manual");
        } : undefined} onApply={(draft) => {
          setName(draft.name);
          setValues(draft.per100g);
          setError("");
          setReviewingPhoto(true);
          setMode("personal");
        }} /> : choosing ? <>
          <label className="food-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="搜索食物"
            placeholder="例如 燕麦 60g" value={query} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (searching && displayed[0]) choose(displayed[0].food, displayed[0].grams);
            }} /></label>
          <div className="food-list-heading">
            <h3>{searching ? "搜索结果" : showAll ? "食物库" : "常用食物"}</h3>
            {!searching && <button className="text-button" type="button" onClick={() => setShowAll(!showAll)}>{showAll ? "收起" : "查看全部"}</button>}
          </div>
          {displayed.length ? <div className="food-option-grid">{displayed.map(({ food, grams: lastGrams }) =>
            <button key={food.id} className="food-option" type="button" onClick={() => choose(food, lastGrams)}>
              <strong>{food.name}</strong><small>{displayNumber(food.per100g.calories)} 千卡／100 g{lastGrams === undefined ? "" : " · 上次 " + displayNumber(lastGrams) + " g"}</small>
            </button>)}</div> : <p className="empty-copy">未找到这个食物。可以按包装营养标签新增。</p>}
          <div className="food-alternatives">
            {onMealPhoto && <button className="button outline" type="button" onClick={onMealPhoto}><WandSparkles size={16} aria-hidden="true" /> 拍照识别餐食</button>}
            <button className="button outline" type="button" onClick={() => setMode("photo")}><Camera size={16} /> 拍照加常用食物</button>
            <button className="button outline" type="button" onClick={() => setManual("personal")}><Plus size={16} /> 新增自定义食物</button>
            <button className="text-button" type="button" onClick={() => setManual("manual")}>手动记录</button>
          </div>
        </> : <fieldset className="form-fields" disabled={busy}>
          <button type="button" className="text-button food-back"
            onClick={() => { setSelected(undefined); setReviewingPhoto(false); setMode(coachDate ? "meal-photo" : "lookup"); setError(""); }}>
            <ArrowLeft size={17} />{coachDate ? "返回拍照" : "返回食物库"}</button>
          {mode === "lookup" && selected ? <>
            <div className="food-selected"><div><h3>{selected.name}</h3><small>{displayNumber(selected.per100g.calories)} 千卡／100 g</small></div>
              {selected.source ? <a className="text-button" href={selected.source} target="_blank" rel="noopener noreferrer">USDA 数据来源</a> : <small>我的食物</small>}</div>
            {available.length > 0 && <label>份量单位<select value={portion ? unit : ""} onChange={(event) => {
              const key = event.target.value;
              const next = available.find(({ name }) => portionKey(name) === key);
              setUnit(key);
              setAmount(grams === undefined ? (next ? "1" : "") : String(Math.round(grams / (next?.grams ?? 1) * 1_000) / 1_000));
            }}><option value="">克</option>{available.map((item) => <option key={portionKey(item.name)} value={portionKey(item.name)}>
              {item.name}（每份 {displayNumber(item.grams)} g）
            </option>)}</select></label>}
            {portion ? <><label>吃了多少（{portion.name}）<input type="number" inputMode="decimal" required
              min={0.1 / portion.grams} max={maxFoodGrams / portion.grams} step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <p className="muted" role="status">{grams === undefined ? "份量超出可记录范围" : "折合 " + displayNumber(grams) + " g"}</p></> : weightInput(true)}
            <PortionEditor key={selected.id} portions={available} save={async (next) => {
              await onSavePortions({ kind: "food-portions", id: selected.id, portions: next });
              if (portion && !next.some(({ name }) => portionKey(name) === unit)) {
                setUnit(""); setAmount(grams === undefined ? "" : String(grams));
              }
            }} />
            <div className="food-preview" aria-label="本份营养" aria-live="polite">
              {nutrients.map(({ key, label, unit }) => <div key={key}><span>{label}</span>
                <strong>{computed ? displayNumber(computed[key]) : "—"} <small>{unit}</small></strong>
              </div>)}
            </div>
          </> : <>
            {reviewingPhoto && <p className="muted" role="status">{mode === "personal" ? "AI 已填入。请按包装核对每 100 克的营养数值。" : "AI 已填入估算。请核对食物、份量和营养后保存。"}</p>}
            <label>食物名称<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "personal" ? "例如 原味燕麦片（品牌）" : undefined} /></label>
            {mode === "manual" && weightInput(reviewingPhoto)}
            <h3>{mode === "personal" ? "每 100 g 营养" : "本份营养"}</h3>
            <div className="field-grid">{nutrients.map(({ key, label, unit }) =>
              <label key={key}>{label}（{unit}）<input type="number" inputMode="decimal" step="any" min={0}
                max={mode === "personal" ? key === "calories" ? 1000 : 100 : key === "calories" ? maxFoodGrams * 10 : 20000}
                required={mode === "personal" || reviewingPhoto}
                value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value === "" ? undefined : Number(event.target.value) })}
                placeholder={mode === "manual" ? "0" : undefined} /></label>)}</div>
          </>}
        </fieldset>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      {!choosing && !photo && <div className="dialog-footer">
        <button className="button primary" disabled={busy || (mode === "lookup" && !computed)}>
          {busy ? "保存中…" : mode === "personal" ? "保存到食物库" : initial ? "保存修改" : "添加到" + meal}
        </button>
      </div>}
    </form>;
  if (coachDate) {
    return <section className="card coach-meal-photo" aria-labelledby="coach-meal-title">
      <div className="dialog-heading"><h2 id="coach-meal-title" ref={coachHeading} tabIndex={-1}>拍照识别餐食</h2><span className="muted">{coachDate} · {meal}</span></div>
      {form}
    </section>;
  }
  return <Dialog title={photo ? "拍照加常用食物" : (initial ? "编辑" : "添加") + meal}
    className="food-dialog" onClose={() => { if (!busy) close(); }}>{form}</Dialog>;
}

export type CoachMealRequest = { owner: string; id: string; date: string; meal: MealEntry["meal"] };

export function CoachMealPhoto({ request: { owner, id, date, meal }, close }: { request: CoachMealRequest; close: () => void }) {
  const store = useLibrary(true, date);
  const save = (item: PersonalFood | FoodPortions) => store.save(item, undefined, owner);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  return <MealEditor owner={owner} meal={meal} coachDate={date} close={close}
    personal={store.rows.filter((item) => item.kind === "food")} recent={store.recentMeals}
    savedPortions={store.rows.filter((item) => item.kind === "food-portions")} onSaveFood={save} onSavePortions={save}
    onLog={async (entry) => {
      await store.save({ kind: "nutrition", date, id, entry }, undefined, owner);
      if (active.current) close();
    }} />;
}
