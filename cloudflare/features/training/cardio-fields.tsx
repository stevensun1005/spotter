"use client";

import type { ChangeEvent } from "react";
import {
  formatCardioDuration, inclineReadings, maxCardioDistanceKm, maxCardioMinutes, maxCardioSeconds, maxCardioSpeedKmh, type Cardio,
} from "./cardio";

function readNumber(event: ChangeEvent<HTMLInputElement>, change: (value?: number) => void) {
  const input = event.currentTarget;
  if (!input.value) change(undefined);
  else if (input.validity.valid && Number.isFinite(input.valueAsNumber)) change(input.valueAsNumber);
}

export function CardioFields({ value, change, liveSeconds }: {
  value: Cardio; change: (value: Cardio) => void; liveSeconds?: number;
}) {
  const duration = value.durationSeconds;
  const minutes = duration === undefined ? undefined : Math.floor(duration / 60);
  const seconds = duration === undefined ? undefined : duration % 60;
  const kind = value.incline?.kind ?? "percent";
  const setDuration = (nextMinutes: number, nextSeconds: number) => {
    const combined = nextMinutes * 60 + nextSeconds;
    if (combined <= maxCardioSeconds) change({ ...value, durationSeconds: combined || undefined });
  };

  return <section className="form-fields" aria-label="爬坡走数据">
    <fieldset className="form-fields">
      <legend>实际时长</legend>
      {liveSeconds !== undefined && <p className="muted">留空使用计时 · {formatCardioDuration(liveSeconds)}</p>}
      <div className="field-grid">
        <label>分钟<input type="number" inputMode="numeric" min={0} max={maxCardioMinutes}
          value={minutes ?? ""} onChange={(event) => readNumber(event, (number) => setDuration(number ?? 0, seconds ?? 0))} /></label>
        <label>秒<input type="number" inputMode="numeric" min={0} max={minutes === maxCardioMinutes ? 0 : 59}
          value={seconds ?? ""} onChange={(event) => readNumber(event, (number) => setDuration(minutes ?? 0, number ?? 0))} /></label>
      </div>
    </fieldset>
    <div className="field-grid">
      <label>坡度读数<select value={kind} onChange={(event) => change({ ...value,
        incline: { kind: event.target.value === "level" ? "level" : "percent" } })}>
        <option value="percent">百分比（%）</option>
        <option value="level">跑步机档位</option>
      </select></label>
      <label>{kind === "percent" ? "坡度（%）" : "坡度档位"}<input type="number" inputMode="decimal"
        {...inclineReadings[kind]} placeholder="可选" value={value.incline?.value ?? ""}
        onChange={(event) => readNumber(event, (number) => change({ ...value, incline: { kind, value: number } }))} /></label>
    </div>
    <div className="field-grid">
      <label>距离（km）<input type="number" inputMode="decimal" min={0} max={maxCardioDistanceKm} step="any" placeholder="可选"
        value={value.distanceKm ?? ""} onChange={(event) => readNumber(event, (distanceKm) => change({ ...value, distanceKm }))} /></label>
      <label>速度（km/h）<input type="number" inputMode="decimal" min={0} max={maxCardioSpeedKmh} step="any" placeholder="可选"
        value={value.speedKmh ?? ""} onChange={(event) => readNumber(event, (speedKmh) => change({ ...value, speedKmh }))} /></label>
    </div>
  </section>;
}
