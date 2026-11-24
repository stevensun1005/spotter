"use client";

import { useEffect, useRef, useState } from "react";
import { displayNumber } from "@/shared/ui";
import type { ExerciseSession } from "./history";

const charts = [
  { label: "总容量", unit: "kg", color: "#9e5331", value: (row: ExerciseSession) => row.volume },
  { label: "完成组数", unit: "组", color: "#7466aa", value: (row: ExerciseSession) => row.sets.length },
  { label: "最大重量", unit: "kg", color: "#42694c", value: (row: ExerciseSession) => row.weight },
  { label: "估算 1RM", unit: "kg", color: "#2a658a", value: (row: ExerciseSession) => row.max },
];

function Plot({ rows, metric }: { rows: ExerciseSession[]; metric: typeof charts[number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const values = rows.map(metric.value);
  const floor = Math.min(...values);
  const ceiling = Math.max(...values);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { clientWidth: width, clientHeight: height } = canvas;
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale; canvas.height = height * scale;
      ctx.scale(scale, scale);
      const xs = values.map((_, index) => values.length === 1 ? width / 2 : 9 + index * (width - 18) / (values.length - 1));
      const ys = values.map((value) => ceiling === floor ? height / 2 : height - 11 - (value - floor) * (height - 22) / (ceiling - floor));
      ctx.strokeStyle = "#e2e9dd";
      ctx.setLineDash([4, 4]);
      for (const y of [12, height / 2, height - 12]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = metric.color;
      ctx.beginPath();
      xs.forEach((x, index) => { if (index === 0) ctx.moveTo(x, ys[index]); else ctx.lineTo(x, ys[index]); });
      ctx.stroke();
      for (const [index, x] of xs.entries()) { ctx.fillStyle = metric.color; ctx.beginPath(); ctx.arc(x, ys[index], 3, 0, Math.PI * 2); ctx.fill(); }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [values, floor, ceiling, metric.color]);
  return <section className="exercise-plot">
    <div><strong>{metric.label}</strong><span>{displayNumber(values.at(-1) ?? 0)} {metric.unit} · 最近一次</span></div>
    <canvas ref={ref} role="img" aria-label={metric.label + "趋势，从 " + rows[0].date + " 至 " + rows.at(-1)?.date} />
    <div><span>{rows[0].date}</span><span>{rows.at(-1)?.date}</span></div>
  </section>;
}

export function ExerciseProgress({ history }: { history: ExerciseSession[] }) {
  const years = [...new Set(history.map((item) => item.date.slice(0, 4)))];
  const [year, setYear] = useState("all");
  const filtered = year === "all" ? history : history.filter((item) => item.date.startsWith(year));
  const rows = [...filtered].reverse();
  if (!rows.length) return <p className="empty-copy">完成这个动作的打卡后，就能在这里查看变化。</p>;
  return <div className="feature-stack">
    <label className="exercise-period">时间范围<select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">全部</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="exercise-records">{charts.filter((item) => item.unit === "kg").map((metric) => <div key={metric.label}><small>{metric.label}纪录</small><strong>{displayNumber(Math.max(...rows.map(metric.value)))} <small>kg</small></strong></div>)}</div>
    {charts.map((metric) => <Plot key={metric.label} rows={rows} metric={metric} />)}
    <p className="muted">1RM 由 1–10 次的负重组估算，分侧动作按单侧较高值计算。</p>
  </div>;
}
