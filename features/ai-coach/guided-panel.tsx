"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Dumbbell, House, PersonStanding, Plus, Sparkles, Trash2, Waves } from "lucide-react";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { useCatalogue, type CatalogEntry } from "@/features/exercises/open-gym";
import { dateSchema } from "@/shared/dates";
import {
  guidedFocus, guidedGoals, guidedLimits, guidedMaxPoolSize, guidedMoveKey, guidedMoveNameKey, guidedScenes, guidedSchema, guidedWeeks, maxGuidedSessions,
  type GuidedDraft, type GuidedMove,
} from "./guided";

type Phase = "work" | "warmup";
type Pools = Record<Phase, GuidedMove[]>;
type Scene = GuidedDraft["scene"];
type Model = "haiku" | "sonnet";
type Choice = { value: string; label: string };
export type GuidedCoachSelection = { date: string; draftDays: number; guided: GuidedDraft };

const steps = [
  { label: "限制", title: "有哪些动作想先避开？" },
  { label: "场景", title: "这次在哪里练？" },
  { label: "预设", title: "从一组动作开始" },
  { label: "动作", title: "调整候选动作" },
  { label: "设置", title: "设置训练目标与节奏" },
] as const;
const sceneDetail = {
  gym: { detail: "器械、自由重量和训练凳", icon: Dumbbell },
  home: { detail: "哑铃和一块可活动的空间", icon: House },
  bodyweight: { detail: "无需训练器械", icon: PersonStanding },
  bands: { detail: "以弹力带和徒手动作为主", icon: Waves },
} as const;
const warmupIds = ["4420", "3905", "3411", "1368"];
type Preset = { id: string; title: string; work: readonly string[]; warmup: readonly string[] };
const presets: Record<Scene, readonly Preset[]> = {
  gym: [
    { id: "machines", title: "器械全身", work: ["0576", "1350", "0739", "0198", "0585", "0463"], warmup: ["0798", ...warmupIds] },
    { id: "weights", title: "自由重量基础", work: ["0025", "3593", "0085", "0293", "0294", "0463"], warmup: warmupIds },
  ],
  home: [
    { id: "dumbbell", title: "哑铃全身", work: ["3668", "0293", "1760", "1459", "3972", "0463"], warmup: warmupIds },
    { id: "dumbbell-core", title: "哑铃与核心", work: ["3319", "6146", "1760", "0294", "6435", "0276"], warmup: warmupIds },
  ],
  bodyweight: [
    { id: "bodyweight-basics", title: "徒手基础", work: ["3948", "3211", "6435", "3018", "0463", "1241"], warmup: warmupIds },
    { id: "bodyweight-core", title: "低冲击与核心", work: ["3948", "3561", "0714", "0276", "1241", "3588"], warmup: warmupIds },
  ],
  bands: [
    { id: "band-full-body", title: "弹力带全身", work: ["1004", "3896", "0915", "2154", "0894", "0463"], warmup: [...warmupIds, "2151"] },
    { id: "band-core", title: "弹力带上身与核心", work: ["0930", "0915", "4063", "3511", "3776", "0276"], warmup: [...warmupIds, "1503"] },
  ],
};
const excludedPresetIds: Record<GuidedDraft["limits"][number], readonly string[]> = {
  jumping: [],
  overhead: ["3972"],
  "deep-knee": ["0739", "0585", "3593", "1760", "3948", "1004"],
  "heavy-hip-hinge": ["0085", "1459"],
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function excludedIds(limits: GuidedDraft["limits"]) {
  return new Set(limits.flatMap((limit) => excludedPresetIds[limit]));
}

function matchesPoolMove(left: GuidedMove, right: GuidedMove) {
  return left.catalogueId && right.catalogueId
    ? guidedMoveKey(left) === guidedMoveKey(right)
    : guidedMoveNameKey(left.name) === guidedMoveNameKey(right.name);
}

function choicesFrom(ids: readonly string[], catalog: Map<string, CatalogEntry>, excludes: Set<string>) {
  return ids.flatMap((id) => {
    const item = excludes.has(id) ? undefined : catalog.get(id);
    return item ? [{ name: item.name, catalogueId: item.id }] : [];
  });
}

function MultiChoices<T extends Choice>({ label: title, choices, values, change }: {
  label: string; choices: readonly T[]; values: T["value"][]; change: (values: T["value"][]) => void;
}) {
  return <fieldset className="guided-choice-set">
    <legend className="sr-only">{title}</legend>
    <div className="guided-choices">{choices.map(({ value, label }) => <label className="guided-chip" key={value}>
      <input type="checkbox" checked={values.includes(value)} onChange={() => change(toggle(values, value))} />
      <span>{label}</span>
    </label>)}</div>
  </fieldset>;
}

function PresetStep({ scene, limits, selected, choose }: {
  scene: Scene; limits: GuidedDraft["limits"]; selected?: string; choose: (id: string, pools: Pools) => void;
}) {
  const id = useId();
  const { data, error, reload } = useCatalogue();
  const catalog = useMemo(() => new Map(data?.rows.map((item) => [item.id, item])), [data]);
  const excludes = excludedIds(limits);
  return <fieldset className="guided-choice-set">
    <legend className="sr-only">选择动作预设</legend>
    {error && <p className="muted" role="status">{error} <button className="text-button" type="button" onClick={reload}>重试</button></p>}
    {!error && !data && <p className="muted" role="status">正在读取动作库…</p>}
    <div className="guided-card-options">
      {data && presets[scene].map(({ id: key, title, work, warmup }) => {
        const pools = { work: choicesFrom(work, catalog, excludes), warmup: choicesFrom(warmup, catalog, excludes) };
        if (!pools.work.length) return null;
        return <div className="guided-preset" key={key}>
          <label className="guided-option">
            <input name={id} type="radio" checked={selected === key} onChange={() => choose(key, pools)} />
            <span><strong>{title}</strong><small>{pools.work.length} 个正式动作 · {pools.warmup.length} 个热身动作</small></span>
          </label>
          <details>
            <summary>查看{title}的动作</summary>
            <dl><div><dt>正式</dt><dd>{pools.work.map(({ name }) => name).join("、")}</dd></div>
              {!!pools.warmup.length && <div><dt>热身</dt><dd>{pools.warmup.map(({ name }) => name).join("、")}</dd></div>}
            </dl>
          </details>
        </div>;
      })}
      <label className="guided-option">
        <input name={id} type="radio" checked={selected === "own"} onChange={() => choose("own", { work: [], warmup: [] })} />
        <span><strong>自选动作</strong><small>从 Spotter 动作库加入你想用的动作</small></span>
      </label>
    </div>
  </fieldset>;
}

function PoolEditor({ value, phase, setPhase, disabled, remove, add }: {
  value: Pools; phase: Phase; setPhase: (phase: Phase) => void; disabled: boolean;
  remove: (phase: Phase, move: GuidedMove) => void; add: (phase: Phase) => void;
}) {
  const limits = value[phase].length >= guidedMaxPoolSize;
  return <div className="guided-pool">
    <div className="guided-pool-top">
      <div className="segmented" role="group" aria-label="候选动作类别">
        <button type="button" aria-pressed={phase === "work"} onClick={() => setPhase("work")}>正式动作 ({value.work.length})</button>
        <button type="button" aria-pressed={phase === "warmup"} onClick={() => setPhase("warmup")}>热身动作 ({value.warmup.length})</button>
      </div>
      <button className="button outline small" type="button" disabled={disabled || limits} onClick={() => add(phase)}><Plus size={16} aria-hidden="true" />加动作</button>
    </div>
    {limits && <p className="muted">每类最多选 {guidedMaxPoolSize} 个候选动作。</p>}
    {value[phase].length === 0 ? <p className="muted">{phase === "work" ? "至少加入一个正式动作。" : "热身动作可以留空。"}</p> :
      <ul className="guided-pool-list">{value[phase].map((item) => <li key={guidedMoveKey(item)}>
        <span>{item.name}</span>
        <button type="button" className="icon-button" aria-label={"移除 " + item.name} disabled={disabled} onClick={() => remove(phase, item)}><Trash2 size={17} aria-hidden="true" /></button>
      </li>)}</ul>}
  </div>;
}

export function GuidedCoachPanel({ selectedDate, busy, enabled, sonnet, error, status, onGenerate }: {
  selectedDate: string; busy: boolean; enabled: boolean; sonnet?: boolean; error?: string; status?: string;
  onGenerate: (selection: GuidedCoachSelection, model: Model) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [limits, setLimits] = useState<GuidedDraft["limits"]>([]);
  const [scene, setScene] = useState<Scene>();
  const [preset, setPreset] = useState<string>();
  const [pool, setPool] = useState<Pools>({ work: [], warmup: [] });
  const [phase, setPhase] = useState<Phase>("work");
  const [picker, setPicker] = useState<Phase>();
  const [poolNote, setPoolNote] = useState("");
  const [goal, setGoal] = useState<GuidedDraft["goal"]>("general");
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [weeks, setWeeks] = useState<number>(1);
  const [focus, setFocus] = useState<GuidedDraft["focus"]>([]);
  const [start, setStart] = useState<string>();
  const [model, setModel] = useState<Model>("haiku");
  const headline = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);
  const id = useId();
  const selected = steps[step];
  const final = step === steps.length - 1;
  const date = start ?? selectedDate;
  const sessionCount = days * weeks;
  const tooMany = sessionCount > maxGuidedSessions;
  const validDate = date >= "2000-01-01" && date <= "2099-12-31" && dateSchema.safeParse(date).success;
  const validMinutes = Number.isInteger(minutes) && minutes >= 15 && minutes <= 120;
  const canAdvance = step === 0 || (step === 1 && scene) || (step === 2 && preset) || (step === 3 && pool.work.length > 0);
  const canGenerate = enabled && Boolean(scene) && pool.work.length > 0 && !tooMany && validDate && validMinutes;

  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    headline.current?.focus();
  }, [step]);

  function chooseLimits(next: GuidedDraft["limits"]) {
    setLimits(next);
    const excluded = excludedIds(next);
    const allowed = (item: GuidedMove) => !item.catalogueId || !excluded.has(item.catalogueId);
    setPool((current) => ({ work: current.work.filter(allowed), warmup: current.warmup.filter(allowed) }));
  }

  function chooseScene(next: Scene) {
    setScene(next);
    setPreset(undefined);
    setPool({ work: [], warmup: [] });
    setPoolNote("");
  }

  function choosePreset(next: string, values: Pools) {
    setPreset(next);
    setPool(values);
    setPhase("work");
    setPoolNote("");
  }

  function chooseMove(move: GuidedMove) {
    if (!picker) return;
    setPicker(undefined);
    const item = { name: move.name.trim(), catalogueId: move.catalogueId };
    if (!item.name) return;
    if (item.catalogueId && excludedIds(limits).has(item.catalogueId)) {
      setPoolNote("这个动作与本次选择的限制冲突。");
      return;
    }
    if (pool[picker].some((row) => matchesPoolMove(row, item))) {
      setPoolNote("这个动作已经在候选列表中。");
      return;
    }
    setPool((value) => ({ ...value, [picker]: [...value[picker], item] }));
    setPoolNote("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!final) {
      if (canAdvance) setStep(step + 1);
      return;
    }
    if (!canGenerate || !scene) return;
    const result = guidedSchema.safeParse({ limits, scene, goal, focus, daysPerWeek: days, minutes, ...pool });
    if (result.success) void onGenerate({ date, draftDays: weeks * 7, guided: result.data }, sonnet ? model : "haiku");
  }

  return <section className="card padded feature-stack guided-coach" aria-label="问答定制计划">
    <ol className="guided-progress" aria-label="定制进度">
      {steps.map(({ label }, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={step > index || undefined}>
        {label}
      </li>)}
    </ol>
    <h2 id={id + "-heading"} tabIndex={-1} ref={headline}>{selected.title}</h2>
    <form className="feature-stack" onSubmit={submit} aria-labelledby={id + "-heading"} aria-busy={busy}>
      {step === 0 && <>
        <p className="muted">可多选。无需提供伤病详情，没有要避开的动作就直接继续。</p>
        <MultiChoices label="想避开的动作" choices={guidedLimits} values={limits} change={chooseLimits} />
        {preset && <p className="muted">调整限制时会移除已知冲突的候选动作，可在动作步骤重新调整。</p>}
      </>}
      {step === 1 && <fieldset className="guided-choice-set">
        <legend className="sr-only">训练场景</legend>
        <div className="guided-card-options">{guidedScenes.map(({ value, label }) => {
          const { detail, icon: Icon } = sceneDetail[value];
          return <label className="guided-option" key={value}>
            <input type="radio" name={id + "-scene"} checked={scene === value} onChange={() => chooseScene(value)} />
            <span><strong><Icon size={18} aria-hidden="true" />{label}</strong><small>{detail}</small></span>
          </label>;
        })}</div>
      </fieldset>}
      {step === 2 && scene && <>
        <p className="muted">预设来自 Spotter 动作库，下一步可增删。</p>
        <PresetStep scene={scene} limits={limits} selected={preset} choose={choosePreset} />
      </>}
      {step === 3 && <>
        <p className="muted">AI 只从你保留的动作中编排。请确认它们符合本次器械和动作限制。</p>
        <PoolEditor value={pool} phase={phase} setPhase={setPhase} disabled={busy} remove={(kind, item) => {
          setPool((previous) => ({ ...previous, [kind]: previous[kind].filter((current) => current !== item) }));
          setPoolNote("");
        }} add={(kind) => { setPicker(kind); setPoolNote(""); }} />
        {poolNote && <p className="muted" role="status">{poolNote}</p>}
      </>}
      {final && <>
        <fieldset className="form-fields guided-choice-set" disabled={busy}>
          <legend className="sr-only">训练计划设置</legend>
          <div className="guided-settings">
            <label>训练目标<select value={goal} onChange={(event) => {
              const option = guidedGoals.find(({ value }) => value === event.target.value);
              if (option) setGoal(option.value);
            }}>{guidedGoals.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>每周训练天数<select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{day} 天</option>)}</select></label>
            <label>单次时长（分钟）<input type="number" required min={15} max={120} step={1} value={minutes || ""} inputMode="numeric" onChange={(event) => setMinutes(Number(event.target.value))} /></label>
            <label>计划周期<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>
              {guidedWeeks.map((week) => <option key={week} value={week}>{week} 周</option>)}</select></label>
            <label>开始日期<input type="date" required min="2000-01-01" max="2099-12-31" value={date} onChange={(event) => setStart(event.target.value)} /></label>
            {sonnet && <label>模型<select value={model} onChange={(event) => setModel(event.target.value === "sonnet" ? "sonnet" : "haiku")}>
              <option value="haiku">Haiku 5.5</option><option value="sonnet">Sonnet 5.5</option></select></label>}
          </div>
          <div className="feature-stack">
            <h3>重点部位 <small className="muted">选填</small></h3>
            <MultiChoices label="重点部位" choices={guidedFocus} values={focus} change={setFocus} />
          </div>
        </fieldset>
        <p className={tooMany ? "inline-error" : "muted"} role="status">
          {tooMany ? "一次最多生成 " + maxGuidedSessions + " 堂训练，请缩短周期或减少每周训练天数。" : "将起草 " + sessionCount + " 堂训练。"}
        </p>
        <p className="muted guided-privacy">点击生成后会把本次所选答案和候选动作发给 Anthropic。训练草稿需核对后保存。</p>
        {!enabled && <p className="muted" role="status">{status || "AI 教练启用后可以生成草稿。"}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </>}
      <div className="guided-actions">
        {step > 0 && <button className="button outline" type="button" disabled={busy} onClick={() => setStep(step - 1)}><ArrowLeft size={17} aria-hidden="true" />上一步</button>}
        <button className="button primary" type="submit" disabled={busy || (final ? !canGenerate : !canAdvance)}>
          {final ? <><Sparkles size={17} aria-hidden="true" />{busy ? "正在生成…" : "生成计划草稿"}</> : <>下一步 <ArrowRight size={17} aria-hidden="true" /></>}
        </button>
      </div>
    </form>
    {picker && <ExercisePicker title={picker === "work" ? "选择正式动作" : "选择热身动作"} identityOnly allowBlank={false} names={pool[picker].map(({ name }) => name)}
      close={() => setPicker(undefined)} onUse={chooseMove} />}
  </section>;
}
