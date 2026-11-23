"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Settings2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Anatomy } from "@/features/exercises/anatomy";
import { type ExerciseChoice, useCatalogue } from "@/features/exercises/open-gym";
import type { TrainingEntry } from "@/shared/state";
import { displayNumber } from "@/shared/ui";
import { offsetDate } from "@/shared/dates";
import {
  cumulative, metrics, muscleGroups, periodLabel, periodRange, previousRange, rangeDays, summarize,
  type Metric, type Period, type Range, type StatsSummary, type TrainingMode,
} from "./model";

const periods = [
  ["week", "周"], ["month", "月"], ["quarter", "季"], ["year", "年"], ["recent", "最近"], ["custom", "自定义"],
] as const;
const modes = [["all", "全部"], ["weighted", "力量负重"], ["bodyweight", "自重训练"]] as const;
const metricIcons = { volume: BarChart3, sessions: CalendarDays, minutes: Clock3, sets: Check };
const defaultPins = ["0025", "0043", "0032", "0314"];

function MetricSelect({ value, set, label }: { value: Metric; set: (value: Metric) => void; label: string }) {
  return <select aria-label={label} value={value} onChange={(event) => set(event.target.value as Metric)}>
    {Object.entries(metrics).map(([key, metric]) => <option key={key} value={key}>{metric.label}</option>)}
  </select>;
}

function Trend({ selected, set, current, comparison, range, compare }: {
  selected: Metric; set: (value: Metric) => void; current: StatsSummary; comparison?: StatsSummary; range: Range; compare: Range;
}) {
  const points = Math.max(2, Math.min(120, Math.max(rangeDays(range), rangeDays(compare))));
  const here = cumulative(current, range, selected, points);
  const other = comparison && cumulative(comparison, compare, selected, points);
  const rows = here.map((value, i) => ({ value, previous: other?.[i],
    day: offsetDate(range.from, Math.floor((rangeDays(range) - 1) * i / (points - 1))).slice(5) }));
  const unit = metrics[selected].unit;
  return <section className="card padded stats-panel">
    <div className="stats-section-heading"><h2>累计趋势</h2><MetricSelect value={selected} set={set} label="趋势指标" /></div>
    <div className="stats-trend-values">
      <div><span>● 本期累计</span><strong>{displayNumber(current.total[selected])} <small>{unit}</small></strong></div>
      {comparison && <div><span>● 对比期累计</span><strong>{displayNumber(comparison.total[selected])} <small>{unit}</small></strong></div>}
    </div>
    {current.total.sessions || comparison?.total.sessions ? <div className="stats-chart" role="img" aria-label={metrics[selected].label + "累计趋势"}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{ top: 10, left: 0, right: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#dce7d8" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={28} tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} width={38} tick={{ fontSize: 11 }} tickFormatter={(n: number) => new Intl.NumberFormat("zh-CN", { notation: "compact" }).format(n)} />
        <Tooltip labelFormatter={(day) => "本期 " + day} formatter={(value, name) => [displayNumber(Number(value)) + " " + unit, name === "value" ? "本期" : "对比期同进度"]} />
        {other && <Area type="stepAfter" dataKey="previous" stroke="#879978" fill="#e6ebdf" strokeDasharray="5 4" isAnimationActive={false} />}
        <Area type="stepAfter" dataKey="value" stroke="#2c6b4a" fill="#dbefdf" strokeWidth={2.5} isAnimationActive={false} />
      </AreaChart></ResponsiveContainer>
    </div> : <p className="stats-empty">这个周期打卡后，这里会显示累计曲线。</p>}
  </section>;
}

function MusclePanel({ current, loading, error }: { current: StatsSummary; loading: boolean; error: string }) {
  const [layer, setLayer] = useState<"primary" | "secondary">("primary");
  const muscles = current[layer];
  const max = Math.max(1, ...Object.values(muscles.buckets));
  return <section className="card padded stats-panel">
    <div className="stats-section-heading"><h2>肌群训练分布</h2></div>
    <p className="muted stats-description">按完成的正式组计数，不含热身。每组可能训练多个肌群。</p>
    <div className="segmented stats-segment">
      <button type="button" aria-pressed={layer === "primary"} onClick={() => setLayer("primary")}>主要训练</button>
      <button type="button" aria-pressed={layer === "secondary"} onClick={() => setLayer("secondary")}>辅助参与</button>
    </div>
    {(loading || error) ? <p className="stats-empty">{error || "正在读取肌群标注…"}</p> : <>
      <Anatomy key={layer} weights={muscles.regions} showIntensity />
      <div className="stats-heat-legend"><span>未训练</span><i /><span>少</span>{[1, 2, 3, 4, 5].map((n) => <i key={n} style={{ background: "var(--heat-" + n + ")" }} />)}<span>多</span></div>
      <div className="stats-muscles">{muscleGroups.map(({ id, name }) => {
        const count = muscles.buckets[id] ?? 0;
        return <div className="stats-muscle" key={id}><strong>{name}</strong><span>{count} 组</span><progress value={count} max={max} aria-label={name + "相对训练量"} /></div>;
      })}</div>
      {current.unlabelled > 0 && <p className="muted">{current.unlabelled} 个动作暂无肌群标注。</p>}
    </>}
  </section>;
}

function Performance({ current, comparison, onExercise, pinned = defaultPins, savePins }: {
  current: StatsSummary; comparison?: StatsSummary; onExercise: (choice: ExerciseChoice) => void;
  pinned?: string[]; savePins?: (ids: string[]) => Promise<void>;
}) {
  const canPin = Boolean(savePins);
  const [view, setView] = useState<"max" | "weight">("max");
  const [sorting, setSorting] = useState<"pinned" | "weight" | "sets">("pinned");
  const [editing, setEditing] = useState(false);
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const togglePin = async (id: string) => {
    if (!savePins || saving) return;
    const next = pinned.includes(id) ? pinned.filter((item) => item !== id) : [...pinned, id];
    setSaving(true); setWarning("");
    try { await savePins(next); }
    catch { setWarning("无法保存关注，请重试。"); }
    finally { setSaving(false); }
  };
  const available = [...current.exercises].filter(([, item]) => item.weight);
  const sorted = available.sort(([aId, a], [bId, b]) => sorting === "sets" ? b.sets - a.sets
    : sorting === "pinned" && pinned.includes(aId) !== pinned.includes(bId) ? Number(pinned.includes(bId)) - Number(pinned.includes(aId))
    : (b[view]?.value ?? 0) - (a[view]?.value ?? 0));
  const visible = editing ? sorted : sorted.slice(0, 8);
  return <section className="card padded stats-panel">
    <div className="stats-section-heading"><h2>动作表现</h2>{canPin && <button className="button subtle small" aria-expanded={editing} onClick={() => setEditing(!editing)}><Settings2 size={16} />{editing ? "完成排序" : "关注与排序"}</button>}</div>
    <div className="segmented stats-segment">
      <button type="button" aria-pressed={view === "max"} onClick={() => setView("max")}>1RM 估算</button>
      <button type="button" aria-pressed={view === "weight"} onClick={() => setView("weight")}>最大重量</button>
    </div>
    {editing && <label className="stats-compare-select">排序<select value={sorting} onChange={(event) => setSorting(event.target.value as typeof sorting)}>
      <option value="pinned">关注优先</option><option value="weight">成绩从高到低</option><option value="sets">完成组数</option>
    </select></label>}
    {visible.length ? <div className="stats-performance">{visible.map(([id, item]) => {
      const best = item[view];
      const compared = comparison?.exercises.get(id)?.[view];
      return <div className="stats-lift" key={id}>
        <button className="stats-lift-link" onClick={() => onExercise(item)}><Dumbbell size={16} /><strong>{item.name}</strong><ChevronRight size={16} /></button>
        <strong className="stats-lift-value">{best ? displayNumber(best.value) : "—"} <small>kg</small></strong>
        <span>{best ? displayNumber(best.weight) + " kg × " + best.reps + " 次 · " + best.date.slice(5) : "需要 1–10 次负重组"}</span>
        {comparison && <span>{compared ? "对比期 " + displayNumber(compared.value) + " kg" : "对比期暂无记录"}</span>}
        {editing && canPin && <button type="button" className="button outline small" aria-pressed={pinned.includes(id)} disabled={saving || !pinned.includes(id) && pinned.length >= 80} onClick={() => void togglePin(id)}>{pinned.includes(id) ? "取消关注" : "关注此动作"}</button>}
      </div>;
    })}</div> : <p className="stats-empty">此周期没有可计算的负重纪录。</p>}
    {warning && <p className="inline-error" role="alert">{warning}</p>}
    <p className="muted stats-description">重量统一换算为 kg。分侧记录按较重一侧统计个人纪录。</p>
  </section>;
}

export function Stats({ today, logs, self, partner, onExercise, pinned, savePins }: {
  today: string; logs: TrainingEntry[]; self: string; partner: { id: string; name: string } | null;
  onExercise: (choice: ExerciseChoice) => void; pinned?: string[]; savePins?: (ids: string[]) => Promise<void>;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [stepping, setStepping] = useState(0);
  const [recent, setRecent] = useState(30);
  const [custom, setCustom] = useState<Range>({ from: offsetDate(today, -29), to: today });
  const [mode, setMode] = useState<TrainingMode>("all");
  const [person, setPerson] = useState(self);
  const [comparison, setComparison] = useState<"previous" | "year" | "none">("previous");
  const [metric, setMetric] = useState<Metric>("volume");
  const [trend, setTrend] = useState<Metric>("volume");
  const { data, error } = useCatalogue();
  const range = periodRange(period, today, stepping, recent, custom);
  const customValid = range.from <= range.to && rangeDays(range) <= 3660 && range.from >= "1900-01-01";
  const compare = comparison === "year"
    ? { from: lastYear(range.from), to: lastYear(range.to) }
    : previousRange(period, customValid ? range : { from: today, to: today }, today, stepping, recent);
  const { current, former } = useMemo(() => {
    const owned = logs.filter((log) => log.kind === "log" && log.owner === person);
    const slice = (span: Range) => owned.filter((log) => log.data.date >= span.from && log.data.date <= span.to);
    return { current: summarize(customValid ? slice(range) : [], data?.rows ?? [], mode),
      former: comparison === "none" || !customValid ? undefined : summarize(slice(compare), data?.rows ?? [], mode) };
  }, [logs, person, range.from, range.to, compare.from, compare.to, data, mode, comparison, customValid]);
  const focus = metric === "volume" ? current.total.volume / (customValid ? rangeDays(range) : 1) : current.total[metric];
  const formerFocus = former && (metric === "volume" ? former.total.volume / rangeDays(compare) : former.total[metric]);
  const max = Math.max(1, focus, formerFocus ?? 0);
  const scoreUnit = metrics[metric].unit + (metric === "volume" ? "/天" : "");
  const shiftCustom = (n: number) => setCustom({ from: offsetDate(custom.from, n * rangeDays(custom)), to: offsetDate(custom.to, n * rangeDays(custom)) });
  const navigate = (n: number) => period === "custom" ? shiftCustom(n) : setStepping(stepping + n);
  return <div className="stats-page stats-dashboard">
    <div className="stats-top card padded">
      <div className="stats-section-heading"><h1>训练统计</h1>{partner && <div className="segmented">
        <button aria-pressed={person === self} onClick={() => setPerson(self)}>我</button>
        <button aria-pressed={person === partner.id} onClick={() => setPerson(partner.id)}>{partner.name}</button>
      </div>}</div>
      <div className="segmented stats-segment">{modes.map(([value, title]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{title}</button>)}</div>
      <div className="stats-periods" aria-label="统计周期">{periods.map(([value, title]) => <button key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setStepping(0); }}>{title}</button>)}</div>
      {period === "recent" && <label className="stats-compare-select">最近天数<select value={recent} onChange={(event) => { setRecent(Number(event.target.value)); setStepping(0); }}>
        {[7, 30, 90, 365].map((days) => <option key={days} value={days}>{days} 天</option>)}
      </select></label>}
      {period === "custom" && <div className="stats-dates">
        <label>开始日期<input type="date" min="1900-01-01" max={today} value={custom.from} onChange={(e) => { if (e.target.value) setCustom({ ...custom, from: e.target.value }); }} /></label>
        <label>结束日期<input type="date" min={custom.from} max={today} value={custom.to} onChange={(e) => { if (e.target.value) setCustom({ ...custom, to: e.target.value }); }} /></label>
      </div>}
      <div className="period-stepper">
        <button className="icon-button" aria-label="上一周期" disabled={!customValid || range.from < "1901-01-01"} onClick={() => navigate(-1)}><ChevronLeft size={21} /></button>
        <div><strong>{periodLabel(period, range)}</strong><span>{range.from} — {range.to}</span></div>
        <button className="icon-button" aria-label="下一周期" disabled={!customValid || (period === "custom" ? offsetDate(range.to, rangeDays(range)) > today : stepping >= 0)} onClick={() => navigate(1)}><ChevronRight size={21} /></button>
      </div>
    </div>
    {!customValid ? <p className="card padded" role="alert">请选择有效日期，范围最长 10 年。</p> : <>
      <section className="card padded stats-panel stats-summary">
        <div className="stats-section-heading"><h2>周期对比</h2><MetricSelect value={metric} set={setMetric} label="对比指标" /></div>
        <label className="stats-compare-select">比较范围<select value={comparison} onChange={(e) => setComparison(e.target.value as typeof comparison)}>
          <option value="previous">上一周期</option><option value="year">上年同期</option><option value="none">关闭对比</option>
        </select></label>
        {([{ label: "本期", span: range, value: focus, active: current.total.sessions }, ...(former ? [{ label: "对比期", span: compare, value: formerFocus!, active: former.total.sessions }] : [])]).map((item) =>
          <div className="stats-comparison" key={item.label}><div><span>{item.label}</span><strong>{item.active ? displayNumber(item.value) : "—"} <small>{scoreUnit}</small></strong></div>
            <progress value={item.value} max={max} aria-label={item.label + " " + metrics[metric].label} /><span>{item.span.from} — {item.span.to}{!item.active && " · 暂无记录"}</span></div>)}
      </section>
      <div className="stats-tiles stats-summary-tiles">{(Object.keys(metrics) as Metric[]).map((id) => {
        const item = metrics[id]; const Icon = metricIcons[id]; const value = current.total[id];
        const old = former?.total[id]; const diff = value - (old ?? 0);
        return <div className="card metric stats-metric" key={id}><div><span>{item.label}{id === "sessions" && " / 天数"}</span><Icon size={18} /></div>
          <strong>{displayNumber(value)} <small>{item.unit}{id === "sessions" && " · " + current.daily.size + " 天"}</small></strong>
          {former && <span>{former.total.sessions ? "较对比期 " + (diff > 0 ? "+" : "") + displayNumber(diff) + " " + item.unit : "对比期暂无记录"}</span>}
        </div>;
      })}</div>
      <Trend selected={trend} set={setTrend} current={current} comparison={former} range={range} compare={compare} />
      <MusclePanel current={current} loading={!data && !error} error={error} />
      <Performance key={person} current={current} comparison={former} onExercise={onExercise} pinned={person === self ? pinned : undefined} savePins={person === self ? savePins : undefined} />
      {mode !== "all" && <p className="muted stats-description">分类筛选按已完成的组识别。同一堂混合训练会出现在两种分类里，时长按整堂课记录。</p>}
    </>}
  </div>;
}

function lastYear(date: string) {
  const year = Number(date.slice(0, 4)) - 1;
  const monthDay = date.slice(4);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year + (monthDay === "-02-29" && !leap ? "-02-28" : monthDay);
}
