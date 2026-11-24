"use client";

import { useState, type FormEvent } from "react";
import {
  Apple, ArrowLeft, BarChart3, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CupSoda, Flame,
  Mic, Pencil, Plus, Scale, Settings2, Share2, Trash2, Utensils, WandSparkles,
} from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { dateSchema, offsetDate, shortDate } from "@/shared/dates";
import { useLibrary } from "@/features/library/use-library";
import { type LibraryItem, type MealEntry } from "@/features/library/model";
import type { TrainingEntry } from "@/shared/state";
import { useNutritionCache } from "./nutrition-cache";
import { MealEditor } from "./meal-editor";
import type { Food } from "./foods";
import { nutritionShortcuts, useNutritionPreferences, type NutritionShortcut } from "./nutrition-preferences";
import { targetForDate } from "./nutrition-planning";
import { NutritionSettings } from "./nutrition-settings";
import { NutritionShortcuts, NutritionSummary, nutritionTotals } from "./nutrition-summary";
import { NutritionStats } from "./nutrition-stats";
import { NutritionTools, type NutritionTool } from "./nutrition-tools";
import { NutritionVoice } from "./nutrition-voice";

type RecordOptions = { initial?: MealEntry; food?: Food; grams?: number; query?: string };
type RecordSheet = { kind: "record"; shortcut: NutritionShortcut; id: string } & RecordOptions;
type Sheet = RecordSheet | { kind: "settings"; page: "menu" | "goals" } | { kind: "tool"; tool: NutritionTool }
  | { kind: "stats" } | { kind: "voice" };
const isMeal = (shortcut: NutritionShortcut): shortcut is MealEntry["meal"] => shortcut !== "饮水" && shortcut !== "体重";
const minDate = "1900-01-01";
const maxDate = "2100-12-31";

function mealForNow(): MealEntry["meal"] {
  const hour = new Date().getHours();
  return hour < 10 ? "早餐" : hour < 14 ? "午餐" : hour < 17 ? "加餐" : "晚餐";
}

function MeasureEditor({ shortcut, save, close }: {
  shortcut: "饮水" | "体重"; save: (value: number) => Promise<void>; close: () => void;
}) {
  const water = shortcut === "饮水";
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await save(Number(amount)); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  return <Dialog title={water ? "记录饮水" : "记体重"} onClose={() => { if (!busy) close(); }}>
    <form onSubmit={submit}>
      <div className="dialog-body form-fields">
        {water && <div className="nutrition-links">{[150, 250, 500, 750].map((ml) => <button key={ml} type="button"
          className="button outline small" onClick={() => setAmount(String(ml))} disabled={busy}>{ml} ml</button>)}</div>}
        <label>{water ? "饮水（ml）" : "体重（kg）"}<input type="number" inputMode="decimal" value={amount}
          min={water ? 1 : 10} max={water ? 20000 : 700} step={water ? "any" : ".01"} required disabled={busy}
          onChange={(event) => setAmount(event.target.value)} /></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer"><button className="button primary" disabled={busy || !amount}>{busy ? "保存中…" : "保存记录"}</button></div>
    </form>
  </Dialog>;
}

export function NutritionView({ enabled, today, owner = "", records = [], initialDate = today, initialShortcut, onBack, onBody, onDevices, onSaved, onMealPhoto }: {
  enabled: boolean; today: string; owner?: string; records?: TrainingEntry[]; initialDate?: string; initialShortcut?: NutritionShortcut;
  onBack: () => void; onBody: () => void; onDevices?: () => void; onSaved?: () => void;
  onMealPhoto: (date: string, meal: MealEntry["meal"]) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [sheet, setSheet] = useState<Sheet | undefined>(() => initialShortcut ? { kind: "record", shortcut: initialShortcut, id: crypto.randomUUID() } : undefined);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [chooseDate, setChooseDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const store = useLibrary(enabled, date);
  const { preferences } = useNutritionPreferences(owner);
  const { rows: displayedRows, cached } = useNutritionCache(owner, date, enabled && preferences.cacheEnabled, store);
  const targetRecord = store.rows.find((row) => row.kind === "targets");
  const targets = targetForDate(displayedRows, date, records);
  const personal = store.rows.filter((row) => row.kind === "food");
  const portions = store.rows.filter((row) => row.kind === "food-portions");
  const rows = displayedRows.flatMap((row) => row.kind === "nutrition" && row.date === date && row.entry.type !== "measurement"
    ? [{ id: row.id, entry: row.entry }] : []);
  const totals = nutritionTotals(displayedRows, date);
  const shortcuts = [...preferences.mealOrder, ...nutritionShortcuts.filter((shortcut) => !isMeal(shortcut))];

  const close = () => setSheet(undefined);
  const open = (shortcut: NutritionShortcut, options: RecordOptions = {}, id = crypto.randomUUID()) =>
    setSheet({ ...options, kind: "record", shortcut, id });
  const openSettings = (page: "menu" | "goals") => setSheet({ kind: "settings", page });
  const openTool = (tool: NutritionTool) => setSheet({ kind: "tool", tool });
  const refresh = async () => { await store.load(); onSaved?.(); };
  async function persist(item: LibraryItem, revision?: string | null) {
    await store.save(item, revision, owner);
    onSaved?.();
  }
  function changeDate(next: string) {
    if (!dateSchema.safeParse(next).success || next < minDate || next > maxDate) return;
    setDate(next); setChooseDate(false); setConfirm(""); setError(""); close();
  }
  async function remove(id: string) {
    setBusy(true); setError("");
    try { await store.remove("nutrition", id); setConfirm(""); onSaved?.(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function share() {
    setError("");
    const title = date + " · 饮食记录";
    const breakdown = preferences.mealOrder.flatMap((meal) => {
      const items = rows.filter(({ entry }) => entry.type === "meal" && entry.meal === meal);
      return items.length ? [meal + " · " + items.map(({ entry }) => entry.type === "meal" ? entry.name : "").join("、")] : [];
    });
    const text = [
      title,
      "热量 " + displayNumber(totals.calories) + " 千卡",
      "蛋白质 " + displayNumber(totals.protein) + " g · 碳水 " + displayNumber(totals.carbs) + " g · 脂肪 " + displayNumber(totals.fat) + " g",
      "饮水 " + displayNumber(totals.water) + " ml",
      ...breakdown,
    ].join("\n");
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, text }); return; }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
    }
    const href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href; link.download = date + "-饮食记录.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }
  function renderRecord({ id, entry }: typeof rows[number]) {
    const name = entry.type === "meal" ? entry.name : entry.type === "water" ? "饮水" : "体重";
    const Icon = entry.type === "meal" ? Apple : entry.type === "water" ? CupSoda : Scale;
    const detail = entry.type === "meal" ? [
      entry.grams === undefined ? "" : displayNumber(entry.grams) + " g",
      displayNumber(entry.calories) + " 千卡", "蛋白质 " + displayNumber(entry.protein) + " g",
      "碳水 " + displayNumber(entry.carbs) + " g", "脂肪 " + displayNumber(entry.fat) + " g",
    ].filter(Boolean).join(" · ") : entry.type === "water" ? displayNumber(entry.ml) + " ml" : displayNumber(entry.kg) + " kg";
    return <div className="list-line nutrition-row" key={id}>
      <span className="tile mint"><Icon size={18} aria-hidden="true" /></span>
      <div><strong>{name}</strong><small>{detail}</small></div>
      {!cached && <div className="nutrition-row-actions">{confirm === id ? <>
        <button className="button outline small" type="button" disabled={busy} onClick={() => void remove(id)}>确认删除</button>
        <button className="button subtle small" type="button" disabled={busy} onClick={() => setConfirm("")}>取消</button>
      </> : <>
        {entry.type === "meal" && <button className="icon-button" aria-label={"编辑 " + name} disabled={busy} type="button"
          onClick={() => open(entry.meal, { initial: entry }, id)}><Pencil size={16} aria-hidden="true" /></button>}
        <button className="icon-button" aria-label={"删除 " + name} disabled={busy} type="button" onClick={() => setConfirm(id)}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </>}</div>}
    </div>;
  }

  return <div className="feature-stack nutrition-detail">
    <header className="nutrition-detail-header" aria-label="饮食记录">
      <button className="icon-button" type="button" onClick={onBack} aria-label="返回首页"><ArrowLeft size={20} aria-hidden="true" /></button>
      <div className="nutrition-date-nav">
        <button className="icon-button" type="button" disabled={date <= minDate} onClick={() => changeDate(offsetDate(date, -1))} aria-label="上一天">
          <ChevronLeft size={19} aria-hidden="true" /></button>
        {chooseDate ? <input type="date" aria-label="饮食日期" min={minDate} max={maxDate} value={date}
          onChange={(event) => changeDate(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setChooseDate(false); }} /> :
          <button className="button outline nutrition-current-date" type="button" onClick={() => setChooseDate(true)} aria-label="选择饮食日期">
            {date === today ? "今天" : shortDate(date)}</button>}
        <button className="icon-button" type="button" disabled={date >= maxDate} onClick={() => changeDate(offsetDate(date, 1))} aria-label="下一天">
          <ChevronRight size={19} aria-hidden="true" /></button>
        {date !== today && !chooseDate && <button className="text-button" type="button" onClick={() => changeDate(today)}>回今天</button>}
      </div>
      <button className="icon-button" type="button" onClick={() => openSettings("menu")} aria-label="饮食设置">
        <Settings2 size={20} aria-hidden="true" /></button>
    </header>
    <section className="card nutrition-detail-summary" aria-label="每日饮食概览">
      <NutritionSummary totals={totals} targets={targets} topActions={<>
        <button className="button subtle small" type="button" disabled={!enabled || store.loading || Boolean(store.error)} onClick={() => openSettings("goals")}>营养目标</button>
        <button className="button outline small" type="button" onClick={() => void share()} disabled={store.loading || !rows.length}>
          <Share2 size={16} aria-hidden="true" />分享
        </button>
      </>} />
    </section>
    <div className="nutrition-links" aria-label="饮食规划">
      <button className="button outline small" type="button" disabled={!enabled} onClick={() => openTool("carbCycle")}>碳循环设置</button>
      <button className="button outline small" type="button" disabled={!enabled} onClick={() => openTool("recipes")}>智能食谱</button>
      <button className="button outline small" type="button" disabled={!enabled} onClick={() => openTool("recommendations")}>食物推荐</button>
    </div>
    {!enabled && <p className="muted">登录后可以保存饮食记录。</p>}
    {store.loading && <p className="muted" role="status">正在读取记录…</p>}
    {store.error && <button className="button outline small" type="button" onClick={() => void store.load()}>{store.error}</button>}
    {cached && <p className="muted">正在查看本地缓存。</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {rows.length ? <section className="card padded feature-stack" aria-label="当天记录">
      {preferences.mealOrder.map((meal) => {
        const entries = rows.filter(({ entry }) => entry.type === "meal" && entry.meal === meal);
        if (!entries.length) return null;
        return <section className="nutrition-meal-log" key={meal}>
          <div className="section-head"><h3>{meal}</h3><button className="text-button" type="button" disabled={!enabled || busy}
            onClick={() => open(meal)}><Plus size={16} aria-hidden="true" /> 加食物</button></div>
          {entries.map(renderRecord)}
        </section>;
      })}
      {rows.filter(({ entry }) => entry.type !== "meal").map(renderRecord)}
    </section> : !store.loading && <div className="nutrition-blank">
      <Utensils size={35} aria-hidden="true" /><p>这一天还没有记录</p>
    </div>}
    {preferences.showExerciseCard && <section className="card nutrition-exercise-card">
      <span className="tile mint"><Flame size={20} aria-hidden="true" /></span>
      <div><h3>计入运动消耗</h3><p className="muted">选中的运动消耗会加到当天目标</p></div>
      <button className="button outline small" type="button" disabled={!enabled} onClick={() => openTool("exercise")}>选择训练</button>
    </section>}
    <div className="nutrition-bottom">
      {preferences.showToolbar && <div className="nutrition-toolstrip" aria-label="快捷工具栏">
        {toolsExpanded && <>
          <button type="button" disabled={!enabled} onClick={() => setSheet({ kind: "stats" })}><BarChart3 size={17} aria-hidden="true" />统计</button>
          <button type="button" disabled={!enabled} onClick={() => onMealPhoto(date, mealForNow())}><WandSparkles size={17} aria-hidden="true" />AI 识别</button>
          <button type="button" disabled={!enabled} onClick={() => setSheet({ kind: "voice" })}><Mic size={17} aria-hidden="true" />语音</button>
        </>}
        <button className="icon-button" type="button" onClick={() => setToolsExpanded(!toolsExpanded)} aria-expanded={toolsExpanded}
          aria-label={toolsExpanded ? "收起快捷工具栏" : "展开快捷工具栏"}>
          {toolsExpanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
        </button>
      </div>}
      <NutritionShortcuts actions={shortcuts} disabled={!enabled || busy} onSelect={open} />
    </div>
    {sheet?.kind === "record" && (isMeal(sheet.shortcut) ? <MealEditor key={sheet.id} owner={owner} meal={sheet.shortcut}
      initial={sheet.initial} initialFood={sheet.food} initialGrams={sheet.grams} initialQuery={sheet.query}
      onMealPhoto={sheet.initial ? undefined : () => { if (isMeal(sheet.shortcut)) onMealPhoto(date, sheet.shortcut); }}
      preferAll={preferences.foodSearch === "all"} personal={personal} recent={store.recentMeals} savedPortions={portions}
      close={close} onSaveFood={persist} onSavePortions={persist} onLog={async (entry) => {
        await persist({ kind: "nutrition", date, id: sheet.id, entry }); close();
      }} /> : <MeasureEditor key={sheet.id} shortcut={sheet.shortcut} close={close} save={async (value) => {
        await persist({ kind: "nutrition", date, id: sheet.id, entry: sheet.shortcut === "饮水" ? { type: "water", ml: value } : { type: "weight", kg: value } });
        close();
      }} />)}
    {sheet?.kind === "settings" && <NutritionSettings owner={owner} enabled={enabled} today={today} date={date}
      initialPage={sheet.page} targets={targetRecord} readyToEditTargets={!store.loading && !store.error}
      onSaveTargets={persist} onReload={refresh} onClose={close} onBody={onBody}
      onWeight={() => open("体重")} onDevices={onDevices}
      onPlanning={openTool} />}
    {sheet?.kind === "tool" && <NutritionTools tool={sheet.tool} date={date} owner={owner} rows={store.rows} totals={totals} logs={records}
      save={persist} close={close} reload={() => void refresh()} openFood={(food, meal, grams) => open(meal, { food, grams })} />}
    {sheet?.kind === "stats" && <NutritionStats date={date} close={close} />}
    {sheet?.kind === "voice" && <NutritionVoice close={close} initialMeal={mealForNow()} openSearch={(meal, query) => open(meal, { query })} />}
  </div>;
}
