"use client";

import { useState, type FormEvent } from "react";
import { Check, ClipboardList, Copy, Sparkles, Upload } from "lucide-react";
import { PlanFields } from "@/features/plans/plan-fields";
import type { PlannedWorkout } from "@/features/plans/model";
import { errorText } from "@/shared/client";
import { importPrompt, parseImport } from "./parse";

export function ImportView({ today, save, saved, notify, canRevise }: {
  today: string; save: (plans: PlannedWorkout[], revise: boolean) => Promise<void>; saved: () => void; notify: (text: string) => void; canRevise: boolean;
}) {
  const [source, setSource] = useState("");
  const [imported, setImported] = useState<PlannedWorkout[]>([]);
  const [index, setIndex] = useState(0);
  const [parseError, setParseError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [revise, setRevise] = useState(false);
  const [reading, setReading] = useState(false);

  async function readFile(file: File) {
    setImported([]); setParseError("");
    if (file.size > 450000) { setParseError("文件太大，请分批导入。"); return; }
    setReading(true);
    try { setSource((await file.text()).replace(/^\uFEFF/, "")); }
    catch { setParseError("无法读取该文件。"); }
    finally { setReading(false); }
  }
  const preview = (event: FormEvent) => {
    event.preventDefault();
    setParseError("");
    setSaveError("");
    setImported([]);
    try {
      setImported(parseImport(source, today).map((data) => ({ id: crypto.randomUUID(), data })));
      setIndex(0);
    } catch (reason) { setParseError(errorText(reason, "导入失败，请检查内容。")); }
  };
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(importPrompt(today)); notify("已复制导入提示词"); }
    catch { setShowPrompt(true); }
  }
  return <div className="import-grid">
    <section className="card padded"><div className="section-head"><h2>粘贴训练内容</h2><span className="tile lilac"><Sparkles size={18} /></span></div>
      <form className="form-fields import-form" onSubmit={preview}>
        <label>计划文本、JSON 或视频链接<textarea rows={9} maxLength={450000} value={source} onChange={(e) => setSource(e.target.value)} placeholder={"例如：上肢训练\n哑铃卧推 3×10，12 kg\n坐姿划船 3×12，25 kg\n\n也可以粘贴 B站或 YouTube 链接"} /></label>
        <label className="import-file"><Upload size={17} /> 选择计划 JSON 文件<input type="file" accept=".json,application/json" aria-label="选择计划 JSON 文件" disabled={busy || reading} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file) void readFile(file);
        }} /></label>
        {parseError && <p className="inline-error" role="alert">{parseError}</p>}
        <button className="button primary" type="submit" disabled={!source.trim() || busy || reading}><ClipboardList size={18} /> 预览导入</button>
      </form>
    </section>
    <section className="card padded ai-instructions"><div className="section-head"><h2>用 AI 整理计划</h2></div>
      <ol><li>复制提示词，和训练笔记、计划或视频链接一起发给你常用的 AI。</li><li>把返回的 JSON 粘贴回来。预览时可以修改动作、日期和分享设置。</li></ol>
      <button className="button outline" onClick={() => void copyPrompt()}><Copy size={17} /> 复制导入提示词</button>
      {showPrompt && <textarea className="prompt-text" aria-label="导入提示词" readOnly rows={7} value={importPrompt(today)} onFocus={(event) => event.target.select()} />}
    </section>
    {imported.length > 0 && <section className="card padded import-preview"><div className="section-head"><h2>导入预览</h2><span className="count-label">{imported.length} 个计划</span></div>
      {imported.length > 1 && <div className="import-tabs">{imported.map(({ id, data }, i) => <button className="button small outline" aria-pressed={index === i} key={id} onClick={() => setIndex(i)}>{data.title || "训练 " + (i + 1)}</button>)}</div>}
      <form onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setSaveError("");
        try {
          await save(imported, revise);
          setImported([]);
          setSource("");
          setBusy(false);
          saved();
        }
        catch (reason) { setSaveError(errorText(reason)); setBusy(false); }
      }}>
        <fieldset className="feature-fields" disabled={busy}><PlanFields value={imported[index].data} change={(data) => setImported(imported.map((row, i) => i === index ? { ...row, data } : row))} /></fieldset>
        {canRevise && <label className="toggle-label"><input type="checkbox" checked={revise} disabled={busy} onChange={(event) => setRevise(event.target.checked)} /> 按相同名称更新我的现有计划，保留日期和分享设置</label>}
        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        <button className="button primary" disabled={busy}><Check size={18} /> {revise ? "更新 " : "保存 "}{imported.length} 个计划</button>
      </form>
    </section>}
  </div>;
}
