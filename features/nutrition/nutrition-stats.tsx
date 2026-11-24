"use client";

import { useEffect, useState } from "react";
import { Dialog, displayNumber } from "@/shared/ui";
import { offsetDate } from "@/shared/dates";
import type { LibraryItem } from "@/features/library/model";
import { nutritionTotals } from "./nutrition-summary";

const metrics = {
  calories: ["热量", "千卡"], protein: ["蛋白质", "g"], carbs: ["碳水", "g"], fat: ["脂肪", "g"], water: ["饮水", "ml"],
} as const;

export function NutritionStats({ date, close }: { date: string; close: () => void }) {
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<keyof typeof metrics>("calories");
  const [result, setResult] = useState<{ library?: LibraryItem[]; days: number; error?: string }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ scope: "nutrition", from: offsetDate(date, 1 - days), to: date });
    void fetch(`/api/data?${query}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { library } = await response.json() as { library: LibraryItem[] };
      if (!controller.signal.aborted) setResult({ library, days });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ days, error: "饮食统计读取失败，请重试。" });
    });
    return () => controller.abort();
  }, [date, days, retry]);
  const library = result?.days === days ? result.library : undefined;
  const readings = library ? Array.from({ length: days }, (_, index) => {
    const day = offsetDate(date, index + 1 - days);
    return { day, value: nutritionTotals(library, day)[metric] };
  }) : undefined;
  const [label, unit] = metrics[metric];
  const max = Math.max(1, ...(readings?.map(({ value }) => value) ?? []));
  const average = (readings?.reduce((sum, { value }) => sum + value, 0) ?? 0) / days;

  return <Dialog title="饮食统计" className="food-dialog" onClose={close}><div className="dialog-body form-fields">
    <div className="field-grid">
      <label>日期范围<select value={days} onChange={(event) => setDays(Number(event.target.value))}>
        <option value={7}>最近 7 天</option><option value={30}>最近 30 天</option>
      </select></label>
      <label>营养指标<select value={metric} onChange={(event) => setMetric(event.target.value as keyof typeof metrics)}>
        {Object.entries(metrics).map(([key, [name]]) => <option key={key} value={key}>{name}</option>)}
      </select></label>
    </div>
    {readings ? <>
      <p className="nutrition-average">日均{label} <strong>{displayNumber(average)} {unit}</strong></p>
      <div className="nutrition-trend">{readings.map(({ day, value }) => <div key={day}>
        <span>{day.slice(5)}</span><span className="nutrition-trend-track" aria-hidden="true"><i style={{ width: `${value * 100 / max}%` }} /></span>
        <strong>{displayNumber(value)}</strong>
      </div>)}</div>
    </> : result?.days === days && result.error ? <button className="button outline" type="button" onClick={() => { setResult(undefined); setRetry(retry + 1); }}>{result.error}</button>
      : <p className="muted" role="status">正在读取饮食统计…</p>}
  </div></Dialog>;
}
