"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ClipboardList, Sparkles, Upload } from "lucide-react";
import { PlanFields } from "@/features/plans/plan-fields";
import type { PlannedWorkout } from "@/features/plans/model";
import { errorText } from "@/shared/client";
import { detectImportFormat, parseImport } from "./parse";

export function ImportView({ today, save, saved, canRevise, helpAI, onPrograms, onData, focusRequest = 0 }: {
  today: string; save: (plans: PlannedWorkout[], revise: boolean) => Promise<void>; saved: () => void; notify?: (text: string) => void; canRevise: boolean;
  helpAI?: () => void; onPrograms?: () => void; onData?: () => void; focusRequest?: number;
}) {
  const [source, setSource] = useState("");
  const [imported, setImported] = useState<PlannedWorkout[]>([]);
  const [index, setIndex] = useState(0);
  const [parseError, setParseError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revise, setRevise] = useState(false);
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const format = detectImportFormat(source);
  useEffect(() => { if (focusRequest > 0) input.current?.focus(); }, [focusRequest]);
  useEffect(() => {
    if (!source.trim() && !imported.length) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [source, imported.length]);

  function changeSource(value: string) {
    setSource(value); setImported([]); setIndex(0); setParseError(""); setSaveError(""); setRevise(false);
  }
  async function readFile(file: File) {
    setImported([]); setIndex(0); setParseError(""); setSaveError(""); setRevise(false);
    if (file.size > 450000) { setParseError("文件太大，请分批导入；完整周期请使用训练周期入口。"); return; }
    setReading(true);
    try { changeSource((await file.text()).replace(/^\uFEFF/, "")); }
    catch { setParseError("无法读取该文件。"); }
    finally { setReading(false); }
  }
  const preview = (event: FormEvent) => {
    event.preventDefault(); setParseError(""); setSaveError(""); setImported([]);
    try { setImported(parseImport(source, today).map((data) => ({ id: crypto.randomUUID(), data }))); setIndex(0); }
    catch (reason) { setParseError(errorText(reason, "导入失败，请检查内容。")); }
  };
  return <div className="plan-import-stack feature-stack">
    <section className="card padded feature-stack">
      <div className="section-head"><h2>粘贴并预览计划</h2><span className="tile lilac"><ClipboardList size={18} /></span></div>
      <p className="muted">已有训练文本、视频链接，或 AI 返回的计划 JSON，都在这里预览和编辑后保存。</p>
      <form className="form-fields import-form" onSubmit={preview}>
        <label>训练文本、计划 JSON 或视频链接<textarea ref={input} rows={9} maxLength={450000} disabled={busy || reading} value={source} onChange={(event) => changeSource(event.target.value)} placeholder={"例如：上肢训练\n哑铃卧推 3×10，12 kg\n坐姿划船 3×12，25 kg\n\n也可以粘贴 AI 返回的 JSON、B站或 YouTube 链接"} /></label>
        <label className="import-file"><Upload size={17} /> 选择计划 JSON 文件<input type="file" accept=".json,application/json" aria-label="选择计划 JSON 文件" disabled={busy || reading} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file) void readFile(file);
        }} /></label>
        {format !== "plans" && <div className="plan-format-hint" role="status"><p>{format === "program" ? "这份内容是完整训练周期，请在周期入口导入，保留全部周次与训练。" : "这份内容是个人备份，请到数据页面预览并恢复。"}</p><button className="button outline small" type="button" onClick={format === "program" ? onPrograms : onData}>{format === "program" ? "打开训练周期" : "打开备份恢复"}</button></div>}
        {parseError && <p className="inline-error" role="alert">{parseError}</p>}
        <button className="button primary" type="submit" disabled={!source.trim() || busy || reading || format !== "plans"}><ClipboardList size={18} />{reading ? "正在读取文件…" : "预览导入"}</button>
      </form>
      {helpAI && <div className="plan-import-help"><p className="muted">还需要从目标起草，或让 AI 整理复杂内容？</p><button className="button subtle small" type="button" onClick={helpAI}><Sparkles size={16} />用自己的 AI</button></div>}
    </section>
    {imported.length > 0 && <section className="card padded import-preview"><div className="section-head"><h2>校验并保存</h2><span className="count-label">{imported.length} 个计划</span></div>
      {imported.length > 1 && <div className="import-tabs">{imported.map(({ id, data }, i) => <button className="button small outline" type="button" aria-pressed={index === i} key={id} disabled={busy} onClick={() => setIndex(i)}>{data.title || "训练 " + (i + 1)}</button>)}</div>}
      <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setSaveError("");
        try { await save(imported, revise); setImported([]); setSource(""); setRevise(false); setIndex(0); saved(); }
        catch (reason) { setSaveError(errorText(reason)); }
        finally { setBusy(false); }
      }}>
        <fieldset className="feature-fields" disabled={busy}><PlanFields value={imported[index].data} change={(data) => setImported(imported.map((row, i) => i === index ? { ...row, data } : row))} /></fieldset>
        {canRevise && <label className="toggle-label"><input type="checkbox" checked={revise} disabled={busy} onChange={(event) => setRevise(event.target.checked)} /> 按相同名称更新我的现有计划，保留日期和分享设置</label>}
        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        <button className="button primary" disabled={busy}><Check size={18} />{busy ? "正在保存…" : (revise ? "更新 " : "保存 ") + imported.length + " 个计划"}</button>
      </form>
    </section>}
  </div>;
}
