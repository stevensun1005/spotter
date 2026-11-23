"use client";

import { useEffect, useRef, useState } from "react";
import { Check, HeartPulse, Upload } from "lucide-react";
import { errorText, send } from "@/shared/client";
import type { Session } from "@/features/training/model";
import { sources, workoutWindow, type HeartData } from "./model";
import type { WhoopStatus } from "./whoop";
import { AppleShortcut } from "./apple-shortcut";

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

const time = (at: number) => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);

function HeartSummary({ data }: { data: HeartData }) {
  return <div className="heart-summary">
    <div className="heart-summary-meta"><strong>{sources[data.source]}</strong><span>{time(data.from)} – {time(data.to)}</span></div>
    <div className="heart-values">
      {data.average !== undefined && <div><span>平均心率</span><strong>{data.average} <small>bpm</small></strong></div>}
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
  }, [id]);

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
      {whoop && <button type="button" className="button outline small" disabled={busy || loading} onClick={() => void connect()}>{current ? "用 WHOOP 同步并替换" : "用 WHOOP 同步本次心率"}</button>}
      {current && (confirmRemove ?
        <><button type="button" className="button outline small" disabled={busy} onClick={() => void remove()}>确认移除</button><button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirmRemove(false)}>取消</button></> :
        <button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirmRemove(true)}>移除心率</button>)}
    </div>}
    {busy && <p role="status" className="muted">正在处理心率…</p>}
    {!preview && !loading && !busy && <AppleShortcut window={workoutWindow(session)} receive={(value) => {
      setPreview(value); setError(""); setResult(""); setConfirmRemove(false);
    }} fail={(message) => { setError(message); setResult(""); }} />}
    {!preview && <details className="heart-help">
      <summary>支持的设备与文件</summary>
      <ul>
        <li>Apple Watch：可通过 iPhone 快捷指令读取心率，或在「健康」里导出 ZIP／export.xml。</li>
        <li>Garmin：在 Garmin Connect 打开这一项活动，导出 FIT 原始文件或 TCX。</li>
        <li>WHOOP：选择导出包里的 workouts.csv，也可直接选择 ZIP。配置授权后可在这里同步单次训练的平均及最高心率。</li>
        <li>其他设备：支持含时间和 BPM 的 FIT、TCX 或 CSV。</li>
      </ul>
      <p>网页在手机上读取文件，只上传你确认保存的心率。搭子看不到这些数据。</p>
    </details>}
  </section>;
}
