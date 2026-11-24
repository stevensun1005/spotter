"use client";

import { useEffect, useRef, useState } from "react";
import { Check, HeartPulse, RefreshCw, Upload } from "lucide-react";
import { errorText, send } from "@/shared/client";
import type { Session } from "@/features/training/model";
import { sources, workoutWindow, type HeartData } from "./model";
import type { WhoopStatus } from "./whoop";

const providerMessage: Record<WhoopStatus, string> = {
  synced: "已保存 WHOOP 训练心率。",
  empty: "WHOOP 没有返回时间匹配且含心率的训练。资料刚同步时，可稍后重试。",
  cancelled: "已取消 WHOOP 授权。",
  error: "WHOOP 同步未完成，请重试或导入 CSV。",
};

function HeartChart({ data }: { data: HeartData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const graph = canvas.current;
    if (!graph || !data.samples.length) return;
    const context = graph.getContext("2d");
    if (!context) return;
    const draw = () => {
      const width = graph.clientWidth;
      const height = graph.clientHeight;
      if (!width || !height) return;
      const scale = window.devicePixelRatio || 1;
      graph.width = Math.round(width * scale);
      graph.height = Math.round(height * scale);
      context.scale(scale, scale);
      const values = data.samples.map((sample) => sample.bpm);
      const floor = Math.max(0, Math.min(...values) - 5);
      const ceiling = Math.max(...values) + 5;
      const px = (at: number) => 10 + ((at - data.from) / Math.max(1, data.to - data.from)) * (width - 20);
      const py = (bpm: number) => height - 9 - ((bpm - floor) / (ceiling - floor)) * (height - 18);
      context.strokeStyle = "#d4e5d6";
      context.lineWidth = 1;
      for (const fraction of [.25, .5, .75]) {
        context.beginPath();
        context.moveTo(8, height * fraction);
        context.lineTo(width - 8, height * fraction);
        context.stroke();
      }
      if (data.average !== undefined) {
        context.setLineDash([3, 3]);
        context.beginPath();
        context.strokeStyle = "#768f73";
        context.moveTo(8, py(data.average));
        context.lineTo(width - 8, py(data.average));
        context.stroke();
        context.setLineDash([]);
      }
      context.beginPath();
      context.strokeStyle = "#386c4a";
      context.fillStyle = "#386c4a";
      context.lineJoin = "round";
      context.lineWidth = 2;
      data.samples.forEach(({ at, bpm }, i) => {
        if (i === 0) context.moveTo(px(at), py(bpm));
        else context.lineTo(px(at), py(bpm));
      });
      context.stroke();
      if (data.samples.length === 1) {
        const point = data.samples[0];
        context.beginPath();
        context.arc(px(point.at), py(point.bpm), 3, 0, Math.PI * 2);
        context.fill();
      }
    };
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(graph);
    return () => resize.disconnect();
  }, [data]);
  return <canvas className="heart-chart" ref={canvas} role="img" aria-label={"心率曲线，" + data.samples.length + " 个已存采样点"} />;
}

const time = (at: number) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);

function HeartSummary({ data }: { data: HeartData }) {
  const minimum = data.minimum ?? (data.samples.length ? Math.min(...data.samples.map((sample) => sample.bpm)) : undefined);
  return <div className="heart-summary">
    <div className="heart-summary-meta"><strong>{data.sourceName || sources[data.source]}</strong><span>{time(data.from)} – {time(data.to)}</span></div>
    {data.sourceName && <span className="muted">{sources[data.source]}{data.sourceBundleId ? " · " + data.sourceBundleId : ""}</span>}
    <div className="heart-values">
      {data.average !== undefined && <div><span>平均心率</span><strong>{data.average} <small>bpm</small></strong></div>}
      {minimum !== undefined && <div><span>{data.minimum === undefined ? "最低已存采样" : "最低心率"}</span><strong>{minimum} <small>bpm</small></strong></div>}
      {data.maximum !== undefined && <div><span>最高心率</span><strong>{data.maximum} <small>bpm</small></strong></div>}
    </div>
    {data.samples.length > 0 && <HeartChart data={data} />}
  </div>;
}

export function HeartPanel({ id, session, whoopResult }: { id: string; session: Session; whoopResult?: WhoopStatus }) {
  const [current, setCurrent] = useState<HeartData | null>(null);
  const [preview, setPreview] = useState<HeartData | null>(null);
  const [whoop, setWhoop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(whoopResult ? providerMessage[whoopResult] : "");
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      try {
        const response = await fetch("/api/health?id=" + encodeURIComponent(id), { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const value: { data: HeartData | null; whoop: boolean } = await response.json();
        if (!abort.signal.aborted && request === sequence) { setCurrent(value.data); setWhoop(value.whoop); }
      } catch {
        if (!abort.signal.aborted && request === sequence) setError("无法读取心率。重新打开本次记录可重试。");
      } finally { if (!abort.signal.aborted && request === sequence) setLoading(false); }
    };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    document.addEventListener("visibilitychange", visible);
    return () => { abort.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [id, revision]);

  async function importFile(file: File) {
    setBusy(true); setError(""); setResult(""); setConfirmRemove(false); setPreview(null);
    try {
      const { importHeartFile } = await import("./file-import");
      setPreview(await importHeartFile(file, workoutWindow(session)));
    } catch (reason) { setError(errorText(reason, "无法读取心率文件，请检查格式。")); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!preview) return;
    setBusy(true); setError(""); setResult("");
    try {
      await send("/api/health", { action: "save", id, data: preview });
      setCurrent(preview); setPreview(null); setResult("心率已保存到你的账号。");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/health/whoop", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(12000),
      });
      const value: { error?: string; url?: string } = await response.json();
      if (!response.ok || !value.url) throw new Error(value.error || "无法打开 WHOOP 授权。");
      window.location.assign(value.url);
    } catch (reason) { setError(errorText(reason)); setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError(""); setResult("");
    try {
      await send("/api/health", { action: "remove", id });
      setCurrent(null); setConfirmRemove(false); setResult("已移除这次训练的心率。");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <section className="heart-panel" aria-label="训练心率">
    <h3><HeartPulse size={19} /> 训练心率</h3>
    <p className="muted">打卡时间：{time(workoutWindow(session).from)} – {time(workoutWindow(session).to)}。仅匹配本次训练，按当前时区显示。</p>
    {loading && <p className="muted">正在读取心率…</p>}
    {preview ? <><p className="muted">导入预览 · 仅你可见</p><HeartSummary data={preview} /></> :
      current ? <HeartSummary data={current} /> : null}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {result && <p className="muted" role="status">{result}</p>}
    {preview ? <div className="heart-actions">
      <button type="button" className="button primary small" disabled={busy} onClick={() => void save()}><Check size={16} />{current ? "替换已保存心率" : "保存心率"}</button>
      <button type="button" className="button outline small" disabled={busy} onClick={() => setPreview(null)}>取消预览</button>
    </div> : <div className="heart-actions">
      <input ref={fileInput} type="file" accept=".zip,.xml,.fit,.tcx,.csv" aria-label="选择心率文件" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void importFile(file);
      }} />
      <button type="button" className="button outline small" disabled={busy || loading} onClick={() => fileInput.current?.click()}><Upload size={15} />{current ? "导入另一份文件" : "导入心率文件"}</button>
      <button type="button" className="button subtle small" disabled={busy || loading} onClick={() => { setError(""); setLoading(true); setRevision((value) => value + 1); }}><RefreshCw size={15} />刷新已同步数据</button>
      {whoop && <button type="button" className="button outline small" disabled={busy || loading} onClick={() => void connect()}>{current ? "用 WHOOP 同步并替换" : "用 WHOOP 同步本次心率"}</button>}
      {current && (confirmRemove ?
        <><button type="button" className="button outline small" disabled={busy} onClick={() => void remove()}>确认移除</button><button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirmRemove(false)}>取消</button></> :
        <button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirmRemove(true)}>移除心率</button>)}
    </div>}
    {busy && <p role="status" className="muted">正在处理心率…</p>}
    {!preview && <details className="heart-help">
      <summary>同步方式、设备与可用数据</summary>
      <ul>
        <li><strong>原生同步：</strong>在账号里配对 iPhone 应用，读取 Apple 健康已收到的历史心率。手动补同步请在应用选定范围并点击同步，再刷新这里。Apple Watch 实时心率尚未接入。</li>
        <li><strong>厂商在线同步：</strong>WHOOP {whoop ? "已配置，可授权读取本次训练的平均和最高心率；厂商摘要不提供曲线或最低心率。" : "尚未配置测试凭据与回调，可使用文件导入。"}Garmin 直连尚未接入。</li>
        <li><strong>文件导入：</strong>Garmin Connect 导出单次 FIT / TCX；Apple 健康导出 ZIP / export.xml；WHOOP 导出 workouts.csv / ZIP。含逐点心率的文件可显示曲线、平均、最低和最高值。重复保存替换本条心率，不新增打卡。</li>
        <li>其他设备先将数据写入 Apple 健康，或导入带时间和 BPM 的 FIT、TCX、CSV。以实际导出的字段为准，CSV 时间须含时区或有 timezone 列。</li>
      </ul>
      <p>网页在手机上读取文件，只上传你确认保存的心率。搭子看不到这些数据。</p>
    </details>}
  </section>;
}
