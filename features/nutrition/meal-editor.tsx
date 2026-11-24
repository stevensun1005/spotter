"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Camera, Plus, Search } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import type { MealEntry, PersonalFood } from "@/features/library/model";
import { foods, maxFoodGrams, scaleNutrition, searchFoods, type Food } from "./foods";
import { FoodPhoto } from "./food-photo";
import { commonMealFoods, splitFoodQuery, type RecentMealFood } from "./recent-foods";

const nutrients = [
  { key: "calories", label: "热量", unit: "千卡" },
  { key: "protein", label: "蛋白质", unit: "g" },
  { key: "carbs", label: "碳水", unit: "g" },
  { key: "fat", label: "脂肪", unit: "g" },
] as const;
type Mode = "lookup" | "manual" | "personal" | "photo";
type Values = Food["per100g"];

export function MealEditor({ meal, initial, personal, recent, close, onLog, onSaveFood, reloadFoods }: {
  meal: MealEntry["meal"];
  initial?: MealEntry;
  personal: PersonalFood[];
  recent: RecentMealFood[];
  close: () => void;
  onLog: (entry: MealEntry) => Promise<void>;
  onSaveFood: (food: PersonalFood) => Promise<void>;
  reloadFoods: () => void;
}) {
  const myFoods: Food[] = personal.map(({ id, name, per100g }) => ({ id, name, per100g, aliases: [] }));
  const choices = [...myFoods, ...foods];
  const [selected, setSelected] = useState<Food | undefined>(() => choices.find((food) => food.id === initial?.foodId));
  const [mode, setMode] = useState<Mode>(() => initial && !selected ? "manual" : "lookup");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.grams ? String(initial.grams) : "");
  const [values, setValues] = useState<Partial<Values>>(() =>
    initial ? { calories: initial.calories, protein: initial.protein, carbs: initial.carbs, fat: initial.fat } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const grams = Number(amount);
  const validGrams = Number.isFinite(grams) && grams >= 0.1 && grams <= maxFoodGrams;
  const computed = selected && validGrams ? scaleNutrition(selected.per100g, grams) : undefined;
  const { name: foodQuery, grams: queryGrams } = splitFoodQuery(query);
  const searching = Boolean(query.trim());
  const common = commonMealFoods(choices, recent, meal);
  const portions = new Map(common.map(({ food, grams }) => [food.id, grams]));
  const displayed = searching ? searchFoods(foodQuery, choices).slice(0, 12).map((food) => ({ food, grams: portions.get(food.id) }))
    : showAll ? common : common.slice(0, 12);
  const choosing = mode === "lookup" && !selected;

  function setManual(next: "manual" | "personal") {
    setMode(next);
    setName(foodQuery.slice(0, 100));
    setValues({});
    setAmount(queryGrams ?? "");
    setError("");
  }

  function choose(food: Food, lastGrams?: number) {
    setSelected(food);
    setAmount(queryGrams ?? (lastGrams === undefined ? "" : String(lastGrams)));
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || choosing || mode === "photo") return;
    const nutrition = { calories: values.calories ?? 0, protein: values.protein ?? 0, carbs: values.carbs ?? 0, fat: values.fat ?? 0 };
    if (mode === "lookup" && (!selected || !computed)) return setError("请输入有效的食物克数。");
    if (mode !== "lookup" && !name.trim()) return setError("请输入食物名称。");
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
        await onLog({ type: "meal", meal, name, ...(validGrams ? { grams } : {}), ...nutrition });
      }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  const weightInput = (required: boolean) => <label>吃了多少（g）<input type="number" inputMode="decimal" required={required}
    min="0.1" step="any" max={maxFoodGrams} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={required ? "例如 40" : "选填"} /></label>;

  return <Dialog title={mode === "photo" ? "拍照加常用食物" : (initial ? "编辑" : "添加") + meal} className="food-dialog" onClose={() => { if (!busy) close(); }}>
    <form onSubmit={save}>
      <div className="dialog-body feature-stack">
        {mode === "photo" ? <FoodPhoto onBack={() => setMode("lookup")} onReload={() => {
          reloadFoods();
          setMode("lookup");
          setQuery("");
          setShowAll(true);
        }} onApply={(draft) => {
          setName(draft.name);
          setValues(draft.per100g);
          setError("");
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
            <button className="button outline" type="button" onClick={() => setMode("photo")}><Camera size={16} /> 拍照加常用食物</button>
            <button className="button outline" type="button" onClick={() => setManual("personal")}><Plus size={16} /> 新增自定义食物</button>
            <button className="text-button" type="button" onClick={() => setManual("manual")}>手动记录</button>
          </div>
        </> : <fieldset className="form-fields" disabled={busy}>
          <button type="button" className="text-button food-back" onClick={() => { setSelected(undefined); setMode("lookup"); setError(""); }}><ArrowLeft size={17} /> 返回食物库</button>
          {mode === "lookup" && selected ? <>
            <div className="food-selected"><div><h3>{selected.name}</h3><small>{displayNumber(selected.per100g.calories)} 千卡／100 g</small></div>
              {selected.source ? <a className="text-button" href={selected.source} target="_blank" rel="noopener noreferrer">USDA 数据来源</a> : <small>我的食物</small>}</div>
            {weightInput(true)}
            <div className="food-preview" aria-label="本份营养" aria-live="polite">
              {nutrients.map(({ key, label, unit }) => <div key={key}><span>{label}</span>
                <strong>{computed ? displayNumber(computed[key]) : "—"} <small>{unit}</small></strong>
              </div>)}
            </div>
          </> : <>
            <label>食物名称<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "personal" ? "例如 原味燕麦片（品牌）" : undefined} /></label>
            {mode === "manual" && weightInput(false)}
            <h3>{mode === "personal" ? "每 100 g 营养" : "本份营养"}</h3>
            <div className="field-grid">{nutrients.map(({ key, label, unit }) =>
              <label key={key}>{label}（{unit}）<input type="number" inputMode="decimal" step="any" min={0}
                max={mode === "personal" ? key === "calories" ? 1000 : 100 : 20000} required={mode === "personal"}
                value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value === "" ? undefined : Number(event.target.value) })}
                placeholder={mode === "manual" ? "0" : undefined} /></label>)}</div>
          </>}
        </fieldset>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      {!choosing && mode !== "photo" && <div className="dialog-footer">
        <button className="button primary" disabled={busy || (mode === "lookup" && !computed)}>
          {busy ? "保存中…" : mode === "personal" ? "保存到食物库" : initial ? "保存修改" : "添加到" + meal}
        </button>
      </div>}
    </form>
  </Dialog>;
}
