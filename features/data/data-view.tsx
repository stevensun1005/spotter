"use client";

import { useState } from "react";
import { Download, FileJson, Upload } from "lucide-react";
import { asDate } from "@/shared/dates";
import { backupLimit, backupSchema, dataScopes, scopeNames, type Backup, type DataScope } from "./model";

export function DataView({ enabled, saved, importPlans }: { enabled: boolean; saved: () => void; importPlans: () => void }) {
  const [scope, setScope] = useState<DataScope>("all");
  const [file, setFile] = useState<Backup>();
  const [selection, setSelection] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [includeDates, setIncludeDates] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const exportQuery = new URLSearchParams({ scope });
  if (includeDates && dates.from) exportQuery.set("from", dates.from);
  if (includeDates && dates.to) exportQuery.set("to", dates.to);

  async function preview(upload: File | undefined) {
    const revision = selection + 1;
    setSelection(revision); setFile(undefined); setMessage(""); setError("");
    if (!upload) return;
    if (upload.size > backupLimit) { setError("文件超过 8 MB，请按类别或时间范围分开导入。"); return; }
    setBusy(true);
    try {
      const parsed = backupSchema.safeParse(JSON.parse((await upload.text()).replace(/^\uFEFF/, "")));
      if (!parsed.success) throw new Error("文件不是有效的训练搭子备份。训练计划 JSON 请用「导入计划」。");
      setFile(parsed.data);
    } catch (reason) { setError(reason instanceof SyntaxError ? "JSON 文件格式无效。" : (reason as Error).message); }
    finally { setBusy(false); }
  }

  async function restore() {
    if (!file || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(file) });
      const result = await response.json() as { added: number; skipped: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "导入失败，请重试。");
      setMessage("已导入 " + result.added + " 条，跳过 " + result.skipped + " 条已存在或未匹配的记录。");
      setFile(undefined); setSelection((value) => value + 1); saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "导入失败，请重试。"); }
    finally { setBusy(false); }
  }

  async function copyGuide() {
    const guide = [
      "# 训练搭子数据",
      "使用用户提供的 JSON 备份，或使用训练搭子已连接的个人插件。",
      "可读取训练、饮食、身体或模版；按需要指定日期。备份中的个人记录仅用于用户指定的任务。",
      "训练计划写回前请列出日期、动作、组次、器械站及休息，得到用户授权后再导入。",
      "JSON 备份是 spotter-backup v1，含 training、library 和 heart。已有记录按原 ID 保留。",
      "只有训练计划时，使用站内「导入计划」的结构。每批最多 20 项。",
    ].join("\n\n");
    try { await navigator.clipboard.writeText(guide); setCopyStatus("已复制说明"); }
    catch { setCopyStatus("浏览器无法复制，请重试。"); }
  }

  return <div className="feature-stack">
    <section className="card padded feature-stack">
      <div className="section-head"><h2>导出备份</h2></div>
      <div className="segmented data-scopes" aria-label="导出类别">{dataScopes.map((item) =>
        <button key={item} aria-pressed={item === scope} onClick={() => setScope(item)}>{scopeNames[item]}</button>)}</div>
      <label className="toggle-label"><input type="checkbox" checked={includeDates} onChange={(e) => setIncludeDates(e.target.checked)} /> 限定日期范围</label>
      {includeDates && <div className="field-grid form-fields">
        <label>开始日期<input type="date" value={dates.from} max={dates.to || undefined} onChange={(e) => setDates({ ...dates, from: e.target.value })} /></label>
        <label>结束日期<input type="date" value={dates.to} min={dates.from || undefined} onChange={(e) => setDates({ ...dates, to: e.target.value })} /></label>
      </div>}
      <div className="exercise-toolbar">
        {enabled && (!includeDates || !dates.from || !dates.to || dates.from <= dates.to) ?
          <a className="button primary" href={"/api/data?" + exportQuery.toString()} download={"spotter-" + scope + "-" + asDate() + ".json"}><Download size={18} /> 导出 {scopeNames[scope]} JSON</a> :
          <button className="button primary" disabled><Download size={18} /> 导出 {scopeNames[scope]} JSON</button>}
      </div>
      {!enabled && <p className="muted">登录后可以下载或恢复个人备份。</p>}
      <p className="muted">文件可能包含私人笔记、身体数据和心率。你可以先选类别，再下载要使用的数据。</p>
    </section>
    <section className="card padded feature-stack">
      <div className="section-head"><h2>恢复备份</h2></div>
      <label className="file-button">选择训练搭子备份 JSON<input key={selection} aria-label="选择训练搭子备份 JSON" type="file" accept=".json,application/json" disabled={!enabled || busy} onChange={(e) => void preview(e.target.files?.[0])} /></label>
      {file && <div className="feature-stack">
        <p>训练 {file.training.length} 条 · 个人资料与记录 {file.library.length} 条 · 心率 {file.heart.length} 条。新增计划默认私密，已有记录保留。</p>
        <div className="exercise-toolbar"><button className="button outline" disabled={busy} onClick={() => { setFile(undefined); setSelection((value) => value + 1); }}>取消</button>
          <button className="button primary" disabled={busy} onClick={() => void restore()}><Upload size={17} /> 确认恢复备份</button></div>
      </div>}
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="inline-error">{error}</p>}
      <button className="button outline" onClick={importPlans}><FileJson size={17} /> 导入训练计划</button>
    </section>
    <section className="card padded feature-stack">
      <div className="section-head"><h2>和 Agent 一起用</h2></div>
      <p className="muted">在 ChatGPT 或 Codex 中连接训练搭子的私密插件，可以按类别读取自己的数据及写回记录。其他助手可以使用你主动分享的 JSON 文件。</p>
      <button className="button outline" type="button" onClick={() => void copyGuide()}>复制 Agent 使用说明</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
    </section>
  </div>;
}
