"use client";

import { useState, type FormEvent } from "react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useLibrary } from "@/features/library/use-library";
import { displayNumber } from "@/shared/ui";
import { measurements, type BodyMetric } from "./measurements";

export function BodyView({ enabled, today }: { enabled: boolean; today: string }) {
  const body = useLibrary(enabled, undefined, true);
  const [metric, setMetric] = useState<BodyMetric>("weight");
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const details = measurements[metric];
  const rows = body.rows.flatMap((row) => {
    if (row.kind !== "nutrition") return [];
    if (row.entry.type === "weight" && metric === "weight") return [{ date: row.date, id: row.id, value: row.entry.kg, updated: row.updated }];
    if (row.entry.type === "measurement" && row.entry.metric === metric) return [{ date: row.date, id: row.id, value: row.entry.value, updated: row.updated }];
    return [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.updated.localeCompare(b.updated));
  const latest = rows.at(-1);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setStatus("");
    try {
      await body.save({ kind: "nutrition", id: id || crypto.randomUUID(), date, entry: metric === "weight"
        ? { type: "weight", kg: Number(value) } : { type: "measurement", metric, value: Number(value) } });
      setValue(""); setId(""); setStatus("已保存到云端");
    } catch (error) { setStatus(error instanceof Error ? error.message : "无法保存，请重试。"); }
    finally { setBusy(false); }
  }
  return <div className="feature-stack">
    <section className="card padded feature-stack">
      <div className="section-head"><h2>记录身体测量</h2></div>
      <form className="form-fields" onSubmit={save}>
        <label>测量项目<select value={metric} onChange={(e) => { setMetric(e.target.value as BodyMetric); setValue(""); setId(""); setStatus(""); }}>
          {(Object.entries(measurements)).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
        </select></label>
        <div className="field-grid">
          <label>测量日期<input type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} /></label>
          <label>{details.name}（{details.unit}）<input type="number" inputMode="decimal" step="0.1" min={details.min} max={details.max} value={value} onChange={(e) => setValue(e.target.value)} required /></label>
        </div>
        <div className="exercise-toolbar">
          {id && <button type="button" className="button outline" onClick={() => { setId(""); setValue(""); }}>取消编辑</button>}
          <button className="button primary" disabled={!enabled || busy}>{id ? "更新记录" : "保存测量"}</button>
        </div>
      </form>
      {status && <p role="status">{status}</p>}
      {!enabled && <p className="muted">登录后可以查看和记录身体数据。</p>}
    </section>
    <section className="card padded feature-stack">
      <div className="section-head"><h2>{details.name}趋势</h2>{latest && <strong>{displayNumber(latest.value)} {details.unit}</strong>}</div>
      {body.error && <button className="button outline" onClick={() => void body.load()}>{body.error}</button>}
      {!rows.length && <p className="stats-empty">{body.loading ? "正在读取…" : "暂无测量记录。"}</p>}
      {rows.length > 0 && <>
        <div className="stats-chart" role="img" aria-label={details.name + "变化曲线"}><ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 15, right: 13, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} minTickGap={24} /><YAxis domain={["auto", "auto"]} />
            <Tooltip formatter={(value) => [value + " " + details.unit, details.name]} />
            <Line dataKey="value" stroke="#2c6b4a" strokeWidth={2.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer></div>
        {[...rows].reverse().slice(0, 30).map((row) => <div key={row.id} className="list-line">
          <div><strong>{displayNumber(row.value)} {details.unit}</strong><small>{row.date}</small></div>
          <button className="button outline small" disabled={busy} onClick={() => { setId(row.id); setDate(row.date); setValue(String(row.value)); setStatus("正在编辑 " + row.date + " 的记录"); }}>编辑</button>
        </div>)}
      </>}
    </section>
  </div>;
}
