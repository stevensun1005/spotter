"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarCheck, Check, ChevronDown, Dumbbell, Plus, Sparkles, Trash2 } from "lucide-react";
import { catalogueCover, catalogueDemo } from "@/features/exercises/catalogue-demo";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import { label as catalogueLabel } from "@/features/exercises/labels";
import { useCatalogue, type CatalogEntry } from "@/features/exercises/open-gym";
import { dateSchema } from "@/shared/dates";
import {
  guidedFocus, guidedGoals, guidedLimits, guidedMaxPoolSize, guidedMoveKey, guidedMoveNameKey, guidedScenes, guidedSchema, guidedWeeks, maxGuidedSessions,
  type GuidedDraft, type GuidedMove,
} from "./guided";

type Phase = "work" | "warmup";
type Pools = Record<Phase, GuidedMove[]>;
type Scene = GuidedDraft["scene"];
type Choice = { value: string; label: string };
type Art = "impact" | "overhead" | "knee" | "hinge" | Scene | "guided";
export type GuidedCoachSelection = { date: string; draftDays: number; guided: GuidedDraft };

const steps = [
  { label: "限制", title: "有哪些动作想先避开？", question: "有哪些动作想先避开？", detail: "可多选。只需选择本次想避开的动作。", art: "knee" },
  { label: "场景", title: "这次在哪里练？", question: "这次在哪里练？", detail: "选择你能使用的器械和训练空间。", art: "gym" },
  { label: "预设", title: "从一组动作开始", question: "你想从哪组动作开始？", detail: "选一组 Spotter 动作，下一步可以自由增删。", art: "guided" },
  { label: "动作", title: "调整候选动作", question: "这次要保留哪些候选动作？", detail: "为正式训练和热身分别选动作。", art: "bodyweight" },
  { label: "设置", title: "设置训练目标与节奏", question: "你想达成什么目标，每周能练几天？", detail: "告诉教练你想练什么，以及每周能练多久。", art: "home" },
] as const;
const sceneDetail = {
  gym: "有器械、自由重量和训练凳",
  home: "哑铃和一块可活动的空间",
  bodyweight: "用自身体重训练",
  bands: "以弹力带和徒手动作为主",
} satisfies Record<Scene, string>;
const limitDetail = {
  jumping: { detail: "跑步、跳箱和类似的落地冲击", art: "impact" },
  overhead: { detail: "将重量推举到头部上方", art: "overhead" },
  "deep-knee": { detail: "需要明显弯曲膝盖的动作", art: "knee" },
  "heavy-hip-hinge": { detail: "大重量硬拉等髋铰链动作", art: "hinge" },
} satisfies Record<GuidedDraft["limits"][number], { detail: string; art: Art }>;
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

function GuidedArt({ art }: { art: Art }) {
  return <span className="guided-art" data-art={art} aria-hidden="true" />;
}

function ExerciseThumbnail({ row }: { row?: CatalogEntry }) {
  const cover = row && catalogueCover(catalogueDemo(row));
  return <span className="guided-thumbnail" aria-hidden="true">
    <Dumbbell size={17} />
    {cover && <img src={cover} loading="lazy" alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
  </span>;
}

function MovePreview({ moves, catalog, title }: { moves: GuidedMove[]; catalog: Map<string, CatalogEntry>; title: string }) {
  if (!moves.length) return null;
  return <div className="guided-preview-group">
    <h4>{title}</h4>
    <ul>{moves.map((move) => <li key={guidedMoveKey(move)}>
      <ExerciseThumbnail row={catalog.get(move.catalogueId ?? "")} />
      <span>{move.name}</span>
    </li>)}</ul>
  </div>;
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
    <div className="guided-card-options guided-presets">
      {data && presets[scene].map(({ id: key, title, work, warmup }) => {
        const pools = { work: choicesFrom(work, catalog, excludes), warmup: choicesFrom(warmup, catalog, excludes) };
        if (!pools.work.length) return null;
        return <div className="guided-preset" key={key}>
          <label className="guided-option">
            <ExerciseThumbnail row={catalog.get(pools.work[0].catalogueId)} />
            <span className="guided-option-copy"><strong>{title}</strong><small>{pools.work.length} 个正式动作 · {pools.warmup.length} 个热身动作</small></span>
            <input name={id} type="radio" checked={selected === key} onChange={() => choose(key, pools)} />
          </label>
          <details>
            <summary aria-label={`查看${title}的动作`}>查看动作 <ChevronDown size={16} aria-hidden="true" /></summary>
            <MovePreview moves={pools.work} catalog={catalog} title="正式动作" />
            <MovePreview moves={pools.warmup} catalog={catalog} title="热身动作" />
          </details>
        </div>;
      })}
      <label className="guided-option">
        <GuidedArt art="guided" />
        <span className="guided-option-copy"><strong>自选动作</strong><small>从 Spotter 动作库加入你想用的动作</small></span>
        <input name={id} type="radio" checked={selected === "own"} onChange={() => choose("own", { work: [], warmup: [] })} />
      </label>
    </div>
  </fieldset>;
}

function PoolEditor({ value, phase, setPhase, disabled, remove, add }: {
  value: Pools; phase: Phase; setPhase: (phase: Phase) => void; disabled: boolean;
  remove: (phase: Phase, move: GuidedMove) => void; add: (phase: Phase) => void;
}) {
  const limits = value[phase].length >= guidedMaxPoolSize;
  const { data } = useCatalogue();
  const catalog = useMemo(() => new Map(data?.rows.map((row) => [row.id, row])), [data]);
  return <div className="guided-pool">
    <div className="guided-pool-top">
      <div className="segmented" role="group" aria-label="候选动作类别">
        <button type="button" aria-pressed={phase === "work"} onClick={() => setPhase("work")}>正式动作 ({value.work.length})</button>
        <button type="button" aria-pressed={phase === "warmup"} onClick={() => setPhase("warmup")}>热身动作 ({value.warmup.length})</button>
      </div>
    </div>
    <button className="button outline guided-add-move" type="button" disabled={disabled || limits} onClick={() => add(phase)}><Plus size={17} aria-hidden="true" />从动作库添加</button>
    {limits && <p className="muted">每类最多选 {guidedMaxPoolSize} 个候选动作。</p>}
    {value[phase].length === 0 ? <p className="muted">{phase === "work" ? "至少加入一个正式动作。" : "热身动作可以留空。"}</p> :
      <ul className="guided-pool-list">{value[phase].map((item) => {
        const row = catalog.get(item.catalogueId ?? "");
        return <li key={guidedMoveKey(item)}>
          <ExerciseThumbnail row={row} />
          <span className="guided-option-copy"><strong>{item.name}</strong>{row && <small>{catalogueLabel(row.target)} · {catalogueLabel(row.equipment)}</small>}</span>
          <button type="button" className="icon-button" aria-label={"移除 " + item.name} disabled={disabled} onClick={() => remove(phase, item)}><Trash2 size={17} aria-hidden="true" /></button>
        </li>;
      })}</ul>}
  </div>;
}

export function GuidedCoachPanel({ selectedDate, busy, enabled, error, status, onGenerate, presentation = "standalone" }: {
  selectedDate: string; busy: boolean; enabled: boolean; error?: string; status?: string;
  onGenerate: (selection: GuidedCoachSelection) => void | Promise<void>;
  presentation?: "standalone" | "conversation";
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
  const headline = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);
  const id = useId();
  const selected = steps[step];
  const conversation = presentation === "conversation";
  const final = step === steps.length - 1;
  const date = start ?? selectedDate;
  const sessionCount = days * weeks;
  const tooMany = sessionCount > maxGuidedSessions;
  const validDate = date >= "2000-01-01" && date <= "2099-12-31" && dateSchema.safeParse(date).success;
  const validMinutes = Number.isInteger(minutes) && minutes >= 15 && minutes <= 120;
  const canAdvance = step === 0 || (step === 1 && scene) || (step === 2 && preset) || (step === 3 && pool.work.length > 0);
  const canGenerate = enabled && Boolean(scene) && pool.work.length > 0 && !tooMany && validDate && validMinutes;
  const answers = conversation ? [
    guidedLimits.filter(({ value }) => limits.includes(value)).map(({ label }) => label).join("、") || "暂无限制",
    guidedScenes.find(({ value }) => value === scene)?.label,
    preset === "own" ? "自选动作" : scene && presets[scene].find(({ id }) => id === preset)?.title,
    `${pool.work.length} 个正式动作 · ${pool.warmup.length} 个热身动作`,
  ] : [];

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
    if (result.success) void onGenerate({ date, draftDays: weeks * 7, guided: result.data });
  }

  return <section className={conversation ? "guided-coach guided-coach-conversation" : "card guided-coach"} aria-label="问答定制计划">
    {conversation && step > 0 && <ol className="guided-question-history" aria-label="已回答的问题">
      {steps.slice(0, step).map(({ question }, index) => <li key={question}>
        <p className="guided-past-question"><span className="sr-only">AI 教练 </span>{question}</p>
        <p className="guided-past-answer"><span className="sr-only">你的回答 </span>{answers[index]}</p>
      </li>)}
    </ol>}
    <header className="guided-intro">
      {conversation && <span className="guided-coach-mark" aria-hidden="true"><Sparkles size={16} /></span>}
      <div className="guided-intro-copy">
        <p className="guided-step-count" aria-hidden="true">{step + 1} / {steps.length} · {selected.label}</p>
        <h2 id={id + "-heading"} tabIndex={-1} ref={headline}>
          {conversation && <span className="sr-only">AI 教练 </span>}{conversation ? selected.question : selected.title}
        </h2>
        {(!conversation || !final) && <p>{selected.detail}</p>}
      </div>
      <GuidedArt art={selected.art} />
    </header>
    <ol className="guided-progress" aria-label="定制进度">
      {steps.map(({ label }, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={step > index || undefined}>
        <span className="guided-progress-marker" aria-hidden="true">{step > index ? <Check size={12} /> : index + 1}</span>{label}
      </li>)}
    </ol>
    <form className="guided-form" onSubmit={submit} aria-labelledby={id + "-heading"} aria-busy={busy}>
      <div className="guided-step-content">
      {step === 0 && <>
        <fieldset className="guided-choice-set">
          <legend className="sr-only">想避开的动作</legend>
          <div className="guided-card-options">{guidedLimits.map(({ value, label }) => {
            const { art, detail } = limitDetail[value];
            return <label className="guided-option" key={value}>
              <GuidedArt art={art} />
              <span className="guided-option-copy"><strong>{label}</strong><small>{detail}</small></span>
              <input type="checkbox" checked={limits.includes(value)} onChange={() => chooseLimits(toggle(limits, value))} />
            </label>;
          })}</div>
        </fieldset>
        <button className="button subtle guided-skip" type="button" onClick={() => { chooseLimits([]); setStep(1); }}>暂无限制，跳过</button>
        {preset && <p className="muted">调整限制时会移除已知冲突的候选动作，可在动作步骤重新调整。</p>}
      </>}
      {step === 1 && <fieldset className="guided-choice-set">
        <legend className="sr-only">训练场景</legend>
        <div className="guided-card-options">{guidedScenes.map(({ value, label }) =>
          <label className="guided-option" key={value}>
            <GuidedArt art={value} />
            <span className="guided-option-copy"><strong>{label}</strong><small>{sceneDetail[value]}</small></span>
            <input type="radio" name={id + "-scene"} checked={scene === value} onChange={() => chooseScene(value)} />
          </label>)}</div>
      </fieldset>}
      {step === 2 && scene && <PresetStep scene={scene} limits={limits} selected={preset} choose={choosePreset} />}
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
          <fieldset className="guided-choice-set guided-settings-group">
            <legend>训练目标</legend>
            <div className="guided-goals">{guidedGoals.map(({ value, label }) => <label key={value} className="guided-answer">
              <input name={id + "-goal"} type="radio" className="sr-only" checked={goal === value} onChange={() => setGoal(value)} />
              <span>{label}</span>
            </label>)}</div>
          </fieldset>
          <fieldset className="guided-choice-set guided-settings-group">
            <legend>每周训练天数</legend>
            <div className="guided-frequency">{[1, 2, 3, 4, 5, 6, 7].map((daysPerWeek) => <label key={daysPerWeek} className="guided-answer">
              <input name={id + "-days"} type="radio" className="sr-only" checked={days === daysPerWeek} onChange={() => setDays(daysPerWeek)} />
              <span>{daysPerWeek}<span className="sr-only"> 天</span></span>
            </label>)}</div>
          </fieldset>
          <div className="guided-settings guided-settings-box">
            <label>单次时长（分钟）<input type="number" required min={15} max={120} step={1} value={minutes || ""} inputMode="numeric" onChange={(event) => setMinutes(Number(event.target.value))} /></label>
            <label>计划周期<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>
              {guidedWeeks.map((week) => <option key={week} value={week}>{week} 周</option>)}</select></label>
            <label>开始日期<input type="date" required min="2000-01-01" max="2099-12-31" value={date} onChange={(event) => setStart(event.target.value)} /></label>
          </div>
          <div className="feature-stack guided-settings-group">
            <h3>重点部位 <small className="muted">选填</small></h3>
            <MultiChoices label="重点部位" choices={guidedFocus} values={focus} change={setFocus} />
          </div>
        </fieldset>
        <p className={tooMany ? "inline-error" : "guided-summary"} role="status">
          {tooMany ? "一次最多生成 " + maxGuidedSessions + " 堂训练，请缩短周期或减少每周训练天数。" : <>
            <CalendarCheck size={20} aria-hidden="true" /><span>将起草 <strong>{sessionCount} 堂训练</strong> · 共 {weeks} 周</span>
          </>}
        </p>
        {!enabled && <p className="muted" role="status">{status || "AI 教练启用后可以生成草稿。"}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </>}
      </div>
      <div className="guided-actions">
        {step > 0 && <button className="button outline" type="button" disabled={busy} onClick={() => setStep(step - 1)}>上一步</button>}
        <button className="button primary" type="submit" disabled={busy || (final ? !canGenerate : !canAdvance)}>
          {final ? <><Sparkles size={17} aria-hidden="true" />{busy ? "正在生成…" : "生成计划草稿"}</> : "下一步"}
        </button>
      </div>
    </form>
    {picker && <ExercisePicker title={picker === "work" ? "选择正式动作" : "选择热身动作"} identityOnly allowBlank={false} names={pool[picker].map(({ name }) => name)}
      close={() => setPicker(undefined)} onUse={chooseMove} />}
  </section>;
}
