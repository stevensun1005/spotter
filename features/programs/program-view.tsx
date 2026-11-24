"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ClipboardList, Copy, Download, Dumbbell, Pencil, Plus, RefreshCw, Settings2, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { offsetDate, shortDate } from "@/shared/dates";
import { cleanPlan, type Plan } from "@/features/plans/model";
import { PlanFields } from "@/features/plans/plan-fields";
import { copyProgramWeek } from "./builder";
import { programSchema, type CoachingRules, type Program, type ProgramPreview, type ProgramRecord } from "./model";
import { CoachingRulesForm, CreateProgram, programError, type ProgramTemplate } from "./program-form";
import { ProgramPreviewDialog } from "./program-preview";

const emptyRules: CoachingRules = { principles: "", progression: "", equipment: "", avoid: [] };
type Modal = "create" | "import" | "rules" | "copy" | "adjust" | "remove" | "leave" | null;
type ProgramsResponse = { programs: ProgramRecord[]; rules: { rules: CoachingRules; revision: string | null } };

async function request<T>(body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/programs", {
    method: body ? "POST" : "GET", cache: "no-store", signal: signal ?? AbortSignal.timeout(20_000),
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "训练周期暂时无法读取或保存，请稍后重试。";
    throw new Error(message);
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("无法读取周期结果，请确认已登录后重试。");
  return result as T;
}

function valueOf(record: ProgramRecord): Program {
  return { id: record.id, title: record.title, startDate: record.startDate, weeks: record.weeks, phases: record.phases, sessions: record.sessions };
}

export function ProgramView({ enabled, active = true, today, templates, saved }: {
  enabled: boolean; active?: boolean; today: string; templates: readonly ProgramTemplate[]; saved: () => void;
}) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [rules, setRules] = useState<CoachingRules>(emptyRules);
  const [rulesRevision, setRulesRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [work, setWork] = useState<ProgramRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [week, setWeek] = useState(1);
  const [editSession, setEditSession] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProgramPreview | null>(null);
  const previouslyActive = useRef(active);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setLoading(true); setError("");
    try {
      const data = await request<ProgramsResponse>(undefined, signal);
      if (signal?.aborted) return;
      if (!Array.isArray(data.programs) || !data.rules || !Array.isArray(data.rules.rules?.avoid)) throw new Error("无法读取周期结果，请确认已登录后重试。");
      setPrograms(data.programs); setRules(data.rules.rules); setRulesRevision(data.rules.revision);
    } catch (reason) { if (!signal?.aborted) setError(programError(reason)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [enabled]);

  useEffect(() => {
    const abort = new AbortController();
    if (enabled) void load(abort.signal);
    else { setPrograms([]); setWork(null); setRules(emptyRules); setModal(null); setPreview(null); }
    return () => abort.abort();
  }, [enabled, load]);

  useEffect(() => {
    const entered = active && !previouslyActive.current;
    previouslyActive.current = active;
    if (entered && enabled && !dirty) void load();
  }, [active, dirty, enabled, load]);

  useEffect(() => {
    if (!dirty) return;
    const beforeLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeLeave);
    return () => window.removeEventListener("beforeunload", beforeLeave);
  }, [dirty]);

  function keep(record: ProgramRecord) {
    setPrograms((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setWork(record); setDirty(false);
  }

  async function store(program: Program, revision: string | null) {
    const result = await request<{ program: ProgramRecord }>({ action: "save", program, revision });
    if (!result.program || typeof result.program.revision !== "string") throw new Error("周期保存结果无效，请刷新核对后重试。");
    keep(result.program);
    return result.program;
  }

  async function act(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (reason) { setError(programError(reason)); }
    finally { setBusy(false); }
  }

  function change(program: Program) {
    setWork((current) => current && { ...current, ...program });
    setDirty(true); setPreview(null); setNotice("");
  }

  async function refreshPreview() {
    if (!work) return;
    const record = dirty ? await store(valueOf(work), work.revision) : work;
    const next = await request<ProgramPreview>({ action: "preview", id: record.id, revision: record.revision });
    setPreview(next);
  }

  async function commitPreview() {
    if (!work || !preview) return;
    const result = await request<{ added: number; updated: number; skipped: number; from: string; to: string }>({
      action: "commit", id: work.id, revision: work.revision, previewToken: preview.token, confirmed: true,
    });
    setPreview(null);
    setNotice("日历已更新：新增 " + result.added + " 节，更新 " + result.updated + " 节，保留或跳过 " + result.skipped + " 节。");
    setPrograms((current) => current.map((item) => item.id === work.id ? { ...item, scheduledAt: new Date().toISOString() } : item));
    setWork((current) => current && { ...current, scheduledAt: new Date().toISOString() });
    saved();
  }

  function leave() {
    if (dirty) { setModal("leave"); return; }
    setWork(null); setNotice(""); setError("");
  }

  function exportProgram() {
    if (!work) return;
    const value = { format: "spotter-program", version: 1, program: valueOf(work), rules };
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "spotter-program-" + work.id + ".json";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("已导出当前周期及编排偏好。文件只包含你的私人周期数据。");
  }

  if (!enabled) return <section className="card program-empty"><span className="tile mint"><CalendarDays /></span><h2>训练周期</h2><p>登录后可将每周训练编排为私人周期，再排入你的训练日历。</p></section>;

  const currentSessions = work?.sessions.filter((item) => item.week === week).sort((a, b) => a.day - b.day) ?? [];
  const phase = work?.phases.find((item) => week >= item.fromWeek && week <= item.toWeek);
  const edited = work?.sessions.find((item) => item.id === editSession);

  return <div className="program-workspace">
    {work ? <>
      <section className="card program-editor-heading">
        <div><button className="text-button" type="button" disabled={busy} onClick={leave}><ChevronLeft size={16} />全部周期</button><h2>{work.title}</h2><p className="muted">{work.startDate} 开始 · {work.weeks} 周 · {work.sessions.length} 节训练</p></div>
        <div className="program-toolbar"><button className="button outline small" type="button" disabled={busy || !dirty} onClick={() => void act(async () => { await store(valueOf(work), work.revision); setNotice("周期草稿已保存，尚未写入日历。"); })}><Check size={16} />保存草稿</button>
          <button className="button primary small" type="button" disabled={busy} onClick={() => void act(refreshPreview)}><CalendarPlus size={17} />{dirty ? "保存并预览排期" : "预览排入日历"}</button></div>
      </section>
      {dirty && <p className="program-unsaved">当前有未保存修改，离开页面前请保存草稿。保存草稿不会改变已排入日历的训练。</p>}
      <div className="program-week-tabs" role="group" aria-label="周期周次">{Array.from({ length: work.weeks }, (_, index) => index + 1).map((number) =>
        <button key={number} aria-pressed={week === number} type="button" onClick={() => setWeek(number)}>第 {number} 周</button>)}</div>
      <section className="program-week">
        <div className="program-week-heading"><div><h3>第 {week} 周{phase ? " · " + phase.name : ""}</h3><p>{shortDate(offsetDate(work.startDate, (week - 1) * 7))}至{shortDate(offsetDate(work.startDate, week * 7 - 1))}</p></div>
          <div className="program-toolbar"><button className="button outline small" type="button" disabled={busy || work.weeks < 2} onClick={() => setModal("copy")}><Copy size={16} />复制这一周</button>
            <button className="button outline small" type="button" disabled={busy} onClick={() => setModal("adjust")}><SlidersHorizontal size={16} />批量调整</button></div></div>
        <div className="program-session-list">{currentSessions.map((item) => <article className="card program-session-card" key={item.id}>
          <div className="program-session-top"><div><h4>{item.plan.title}</h4><p>{item.plan.date} · 第 {item.day} 天 · {item.plan.category}</p></div><button className="button outline small" type="button" disabled={busy} onClick={() => setEditSession(item.id)}><Pencil size={15} />编辑这一节</button></div>
          <div className="program-moves">{item.plan.exercises.map((move, index) => <span key={index}>{move.name} · {move.sets} 组 × {move.seconds ? move.seconds + " 秒" : move.repsMax ? move.reps + "–" + move.repsMax + " 次" : move.reps + " 次"}{move.weight > 0 ? " · " + move.weight + " " + move.unit : ""}</span>)}</div>
          <div className="program-session-meta"><span><Dumbbell size={14} />{item.plan.exercises.length} 个动作</span>{item.plan.minutes > 0 && <span>{item.plan.minutes} 分钟</span>}{item.plan.video && <span>包含跟练视频</span>}<span>仅自己可见</span></div>
        </article>)}</div>
        {!currentSessions.length && <div className="card program-empty"><p>这一周没有训练草稿。可从其他周复制安排。</p></div>}
      </section>
      <div className="program-toolbar"><button className="button outline small" type="button" disabled={busy} onClick={exportProgram}><Download size={15} />导出周期</button><button className="text-button" type="button" disabled={busy} onClick={() => setModal("remove")}><Trash2 size={15} />移除此周期草稿</button></div>
    </> : <>
      <div className="program-heading"><div><h2>我的训练周期</h2><p className="muted">用已有模板和动作库编排多周训练，先核对再排入日历。</p></div><div className="program-toolbar">
        <button className="button outline small" type="button" disabled={busy || loading} onClick={() => setModal("rules")}><Settings2 size={17} />编排偏好</button>
        <button className="button outline small" type="button" disabled={busy || loading} onClick={() => setModal("import")}><Upload size={17} />导入周期</button>
        <button className="button primary small" type="button" disabled={busy || loading} onClick={() => setModal("create")}><Plus size={17} />新建周期</button>
      </div></div>
      <section className="card program-intro"><div><h3>把一周训练，安排成完整周期</h3><p>选择每周训练日、复用个人模板，再逐周调整。你自己的 AI Agent 也可使用授权接口起草计划，网页负责预览、编辑和保存。</p></div><span className="program-intro-mark" aria-hidden="true"><CalendarDays size={29} /></span></section>
      <div className="section-head"><p className="muted">{programs.length} 个私人周期</p><button className="button subtle small" type="button" disabled={busy || loading} onClick={() => void load()}><RefreshCw size={15} />刷新</button></div>
      {loading && <p className="muted" role="status">正在读取训练周期…</p>}
      {!loading && !programs.length && !error && <section className="card program-empty"><span className="tile mint"><ClipboardList size={25} /></span><h3>还没有训练周期</h3><p>可以先做 4 周、每周 3 节的草稿，再按自己的安排调整。</p><button className="button primary" type="button" onClick={() => setModal("create")}><Plus size={17} />创建第一个周期</button></section>}
      <div className="program-list">{programs.map((item) => <article className="card program-card" key={item.id}>
        <div className="program-card-top"><div><h3>{item.title}</h3><p className="muted">{item.startDate} 开始</p></div><span className="program-state" data-state={item.scheduledAt ? "published" : "draft"}>{item.scheduledAt ? "已排入日历" : "周期草稿"}</span></div>
        <div className="program-card-meta"><span><CalendarDays size={16} />{item.weeks} 周</span><span>{item.sessions.length} 节训练</span><span>仅自己可见</span></div>
        <div className="program-phases">{item.phases.map((item) => <span key={item.id}>{item.name} · 第 {item.fromWeek}–{item.toWeek} 周</span>)}</div>
        <div><button className="button outline small" type="button" onClick={() => { setWork(structuredClone(item)); setWeek(1); setDirty(false); setError(""); setNotice(""); }}><Pencil size={16} />打开周期</button></div>
      </article>)}</div>
    </>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p className="program-notice" role="status">{notice}</p>}

    {modal === "create" && <CreateProgram today={today} templates={templates} close={() => setModal(null)} save={async (program) => { await store(program, null); setModal(null); setWeek(1); }} />}
    {modal === "import" && <ImportProgramForm close={() => setModal(null)} save={async (program) => { await store(program, null); setModal(null); setWeek(1); }} />}
    {modal === "rules" && <CoachingRulesForm value={rules} close={() => setModal(null)} save={async (next) => {
      const data = await request<{ rules: CoachingRules; revision: string }>({ action: "rules", rules: next, revision: rulesRevision });
      setRules(data.rules); setRulesRevision(data.revision); setModal(null); setNotice("编排偏好已保存，授权的 AI Agent 可以读取。");
    }} />}
    {edited && work && <SessionEditor value={edited.plan} close={() => setEditSession(null)} save={(plan) => {
      change({ ...valueOf(work), sessions: work.sessions.map((item) => item.id === edited.id ? { ...item, plan } : item) }); setEditSession(null);
    }} />}
    {modal === "copy" && work && <CopyWeekForm program={valueOf(work)} week={week} close={() => setModal(null)} apply={(program) => { change(program); setModal(null); }} />}
    {modal === "adjust" && work && <AdjustProgramForm program={valueOf(work)} week={week} close={() => setModal(null)} apply={(program) => { change(program); setModal(null); }} />}
    {modal === "remove" && work && <Dialog title="移除训练周期" onClose={() => setModal(null)}><div className="dialog-body feature-stack"><p>移除「{work.title}」的周期草稿？已排入日历的计划和历史打卡仍会保留。</p>{error && <p className="inline-error" role="alert">{error}</p>}</div><div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={() => setModal(null)}>取消</button><button className="button primary" type="button" disabled={busy} onClick={() => void act(async () => {
      await request({ action: "remove", id: work.id, revision: work.revision }); setPrograms((current) => current.filter((item) => item.id !== work.id)); setWork(null); setModal(null); setDirty(false); setNotice("周期草稿已移除，日历计划和历史保留。");
    })}>确认移除</button></div></Dialog>}
    {modal === "leave" && <Dialog title="保留当前修改？" onClose={() => setModal(null)}><div className="dialog-body"><p>当前周期有未保存的修改。返回后只保留上一次保存的草稿。</p></div><div className="dialog-footer"><button className="button outline" type="button" onClick={() => setModal(null)}>继续编辑</button><button className="button primary" type="button" onClick={() => { setModal(null); setWork(null); setDirty(false); }}>放弃修改并返回</button></div></Dialog>}
    {preview && <ProgramPreviewDialog value={preview} close={() => setPreview(null)} refresh={refreshPreview} commit={commitPreview} />}
  </div>;
}

function SessionEditor({ value, close, save }: { value: Plan; close: () => void; save: (plan: Plan) => void }) {
  const [plan, setPlan] = useState(() => ({ ...structuredClone(value), templateId: undefined, shared: false }));
  const [error, setError] = useState("");
  return <Dialog title={value.date + " · 编辑训练"} onClose={close} className="program-edit-dialog">
    <form onSubmit={(event) => { event.preventDefault(); const checked = cleanPlan({ ...plan, date: value.date, shared: false }); if (!checked.success) { setError("请填写有效训练名称、动作或视频，并核对数值。"); return; } save(checked.data); }}>
      <div className="dialog-body"><p className="program-notice" style={{ marginBottom: 14 }}>这里只修改周期草稿。日期由所在周次和训练日确定，保存并确认排期后才更新日历。</p><PlanFields template value={plan} change={(next) => setPlan({ ...next, templateId: undefined, shared: false })} />{error && <p className="inline-error" role="alert">{error}</p>}</div>
      <div className="dialog-footer"><button className="button outline" type="button" onClick={close}>取消</button><button className="button primary"><Check size={17} />完成编辑</button></div>
    </form>
  </Dialog>;
}

function CopyWeekForm({ program, week, close, apply }: { program: Program; week: number; close: () => void; apply: (program: Program) => void }) {
  const [targets, setTargets] = useState<number[]>(() => week < program.weeks ? [week + 1] : [1]);
  const [error, setError] = useState("");
  return <Dialog title={"复制第 " + week + " 周"} onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); try { if (!targets.length) throw new Error("请选择至少一个目标周。"); apply(copyProgramWeek(program, week, targets)); } catch (reason) { setError(programError(reason)); } }}>
      <div className="dialog-body feature-stack"><p>选择要替换内容的周期草稿周次。每节训练日期按目标周调整，日历中的已开始和已完成训练仍受保护。</p>
        <div className="program-week-tabs" role="group" aria-label="复制目标周">{Array.from({ length: program.weeks }, (_, index) => index + 1).filter((number) => number !== week).map((number) => <button key={number} type="button" aria-pressed={targets.includes(number)} onClick={() => setTargets((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number])}>第 {number} 周</button>)}</div>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div><div className="dialog-footer"><button className="button outline" type="button" onClick={close}>取消</button><button className="button primary" disabled={!targets.length}><Copy size={16} />确认复制</button></div>
    </form>
  </Dialog>;
}

function AdjustProgramForm({ program, week, close, apply }: { program: Program; week: number; close: () => void; apply: (program: Program) => void }) {
  const [from, setFrom] = useState(week);
  const [to, setTo] = useState(week);
  const [mode, setMode] = useState<"delta" | "percent">("delta");
  const [weight, setWeight] = useState("0");
  const [reps, setReps] = useState("0");
  const [error, setError] = useState("");
  return <Dialog title="批量调整周期草稿" onClose={close}>
    <form onSubmit={(event) => {
      event.preventDefault(); setError("");
      try {
        if (from > to || from < 1 || to > program.weeks) throw new Error("请核对所选周次范围。");
        const weightValue = Number(weight);
        const repsValue = Number(reps);
        if (!weight.trim() || !reps.trim() || !Number.isFinite(weightValue) || !Number.isInteger(repsValue)) throw new Error("请填写有效数值。");
        const changed = { ...program, sessions: program.sessions.map((item) => item.week < from || item.week > to ? item : {
          ...item, plan: { ...item.plan, exercises: item.plan.exercises.map((move) => {
            const nextWeight = move.weight > 0 ? Math.round((mode === "delta" ? move.weight + weightValue : move.weight * weightValue / 100) * 100) / 100 : 0;
            const nextReps = move.seconds > 0 ? move.reps : move.reps > 0 ? move.reps + repsValue : 0;
            const nextMax = move.seconds > 0 ? move.repsMax : move.repsMax === undefined || nextReps === 0 ? undefined : move.repsMax + repsValue;
            if (nextWeight < 0 || nextWeight > 2000 || nextReps < 0 || nextReps > 999 || nextMax !== undefined && (nextMax < nextReps || nextMax > 999)) throw new Error("调整后部分动作超出有效范围，请缩小改动数值。");
            return { ...move, ...(nextWeight !== move.weight ? { loadPercent: undefined } : {}), weight: nextWeight, reps: nextReps, repsMax: nextMax };
          }) },
        }) };
        apply(changed);
      } catch (reason) { setError(programError(reason)); }
    }}>
      <div className="dialog-body form-fields"><p className="muted">只调整选定周次的周期草稿。未知重量保持 0；计时动作不增加次数。</p>
        <div className="field-grid"><label>开始周<input type="number" min={1} max={program.weeks} value={from || ""} onChange={(event) => setFrom(Number(event.target.value))} /></label><label>结束周<input type="number" min={from || 1} max={program.weeks} value={to || ""} onChange={(event) => setTo(Number(event.target.value))} /></label></div>
        <label>重量调整方式<select value={mode} onChange={(event) => { const next = event.target.value as "delta" | "percent"; setMode(next); setWeight(next === "percent" ? "80" : "0"); }}><option value="delta">增加或减少固定重量</option><option value="percent">保留原重量的比例</option></select></label>
        <div className="field-grid"><label>{mode === "delta" ? "重量变化（动作原单位）" : "保留比例（%）"}<input required type="number" step="any" min={mode === "percent" ? 0 : -2000} max={mode === "percent" ? 200 : 2000} value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
          <label>次数变化<input required type="number" min={-999} max={999} value={reps} onChange={(event) => setReps(event.target.value)} /></label></div>
        <p className="muted">比例以已填写的训练重量计算，与 1RM 无关。结果仍可逐节编辑。</p>
        <p className="muted">改变重量后，以新重量为准，原百分比负荷目标会移除。</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div><div className="dialog-footer"><button className="button outline" type="button" onClick={close}>取消</button><button className="button primary"><Check size={17} />应用到草稿</button></div>
    </form>
  </Dialog>;
}

function ImportProgramForm({ close, save }: { close: () => void; save: (program: Program) => Promise<void> }) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<Program | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function check() {
    setError(""); setChecked(null);
    try {
      if (text.length > 1_300_000) throw new Error("周期文件过大，请拆分后再导入。");
      const file = JSON.parse(text);
      if (file?.format && (file.format !== "spotter-program" || file.version !== 1)) throw new Error("请选择 spotter-program v1 周期文件。");
      const program = programSchema.parse(file?.program ?? file);
      setChecked(program);
    } catch (reason) { setError(reason instanceof SyntaxError ? "无法读取 JSON，请检查内容是否完整。" : programError(reason)); }
  }
  return <Dialog title="导入周期草稿" onClose={close} className="program-edit-dialog">
    <div className="dialog-body feature-stack">
      <p className="muted">导入已导出的周期，或粘贴你的 AI Agent 生成的周期 JSON。会保存为新的私人草稿，核对排期后才写入日历。</p>
      <label className="form-fields">选择 JSON 文件<input type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.target.files?.[0]; setError(""); setChecked(null);
        if (!file) return;
        if (file.size > 1_300_000) { setError("周期文件过大，请拆分后再导入。"); return; }
        void file.text().then(setText).catch(() => setError("无法读取文件，请重试。"));
      }} /></label>
      <label className="form-fields">周期 JSON<textarea rows={8} value={text} onChange={(event) => { setText(event.target.value); setChecked(null); setError(""); }} placeholder="粘贴 spotter-program JSON 或完整 program 对象" /></label>
      <button className="button outline" type="button" disabled={!text.trim() || busy} onClick={check}>检查内容</button>
      {checked && <div className="program-notice"><strong>{checked.title}</strong><p>{checked.startDate} 开始 · {checked.weeks} 周 · {checked.sessions.length} 节训练。文件中的编排偏好保留在原文件，不覆盖你当前的偏好。</p></div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
    <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={close}>取消</button><button className="button primary" type="button" disabled={!checked || busy} onClick={() => {
      if (!checked) return;
      setBusy(true); setError("");
      const id = crypto.randomUUID();
      const phaseIds = new Map(checked.phases.map((phase) => [phase.id, crypto.randomUUID()]));
      const imported: Program = { ...checked, id, phases: checked.phases.map((phase) => ({ ...phase, id: phaseIds.get(phase.id)! })),
        sessions: checked.sessions.map((item) => { const sessionId = crypto.randomUUID(); const phaseId = item.phaseId ? phaseIds.get(item.phaseId) : undefined; return { ...item, id: sessionId, phaseId, plan: { ...item.plan, programId: id, programSessionId: sessionId, phaseId, shared: false } }; }) };
      void save(imported).catch((reason) => setError(programError(reason))).finally(() => setBusy(false));
    }}><Upload size={16} />{busy ? "正在保存" : "保存为新周期草稿"}</button></div>
  </Dialog>;
}
