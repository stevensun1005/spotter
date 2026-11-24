"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AnatomyVariant } from "@/features/body/profile";
import { loadAnatomyGeometry, type AnatomyGeometry } from "./anatomy-geometry";
import { muscleNames, regionMuscle } from "./labels";
import { muscleBlues, neutralMuscle } from "./muscle-colors";

export type { AnatomyVariant } from "@/features/body/profile";
export const AnatomySubject = createContext<AnatomyVariant | undefined>(undefined);

const layer = ["head", "hair", "feet", "hands", "knees", "ankles", "neck", "gluteal", "quadriceps", "chest", "abs", "trapezius", "upper-back", "deltoids"];
const order = (key: string) => layer.includes(key) ? layer.indexOf(key) : layer.length;

export function Anatomy({ weights, onPick, showIntensity = false, sex }: {
  weights: Record<string, number>; onPick?: (slug: string) => void; showIntensity?: boolean; sex?: AnatomyVariant | null;
}) {
  const highest = Math.max(1, ...Object.values(weights));
  const ownSex = useContext(AnatomySubject);
  const subjectSex = sex === undefined ? ownSex : sex;
  const [selection, setSelection] = useState<AnatomyVariant>("male");
  const figure = subjectSex ?? selection;
  const [data, setData] = useState<AnatomyGeometry>();
  const [error, setError] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    let active = true;
    loadAnatomyGeometry().then((value) => { if (active) setData(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <div className="detailed-anatomy" data-anatomy-variant={figure}>
    {subjectSex == null && <div className="segmented anatomy-switch" role="group" aria-label="肌群图体型">
      <button type="button" aria-pressed={figure === "male"} onClick={() => setSelection("male")}>男性图</button>
      <button type="button" aria-pressed={figure === "female"} onClick={() => setSelection("female")}>女性图</button>
    </div>}
    {error && <p className="muted">肌肉图暂时无法读取。</p>}
    {!data && !error && <p role="status" className="muted">正在读取肌肉图…</p>}
    {data && <div className="anatomy-views">{(["front", "back"] as const).map((side) => {
      const view = data[`${figure}-${side}`];
      const title = side === "front" ? "正面" : "背面";
      return <figure key={side}><svg viewBox={view.viewBox} aria-label={(figure === "female" ? "女性" : "男性") + title + "肌肉解剖图"}>
        {Object.entries(view.regions).sort(([a], [b]) => order(a) - order(b)).map(([region, paths]) => {
          const slug = regionMuscle(region);
          const name = muscleNames[region] ?? muscleNames[slug];
          const weight = weights[region] ?? weights[slug] ?? 0;
          const description = name && showIntensity ? name + " · " + weight + " 组" : name;
          const fill = showIntensity && weight > 0
            ? muscleBlues[Math.ceil(weight / highest * muscleBlues.length) - 1]
            : weight >= 75 ? muscleBlues[4] : weight > 0 ? muscleBlues[2] : name ? neutralMuscle : "#f3f6fc";
          const select = () => { if (description) setNote(description); if (name) onPick?.(slug); };
          return <g key={region} className={name ? "anatomy-region" : ""} aria-label={description}
            role={name ? "button" : undefined} tabIndex={name ? 0 : undefined}
            onClick={name ? select : undefined} onKeyDown={(event) => {
              if (name && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); select(); }
            }} fill={fill}>
            {name && <title>{description}{!showIntensity && weight ? weight >= 75 ? " · 主要" : " · 辅助" : ""}</title>}
            {paths.map((path, i) => <path key={i} d={path} stroke="#f7f9fe" strokeWidth={2.3} />)}
          </g>;
        })}
      </svg><figcaption>{title}</figcaption></figure>;
    })}</div>}
    <p className="anatomy-region-name" role="status">{note || (onPick ? "点选图上的肌肉筛选动作" : "点图上任一区域可以查看名称")}</p>
  </div>;
}

export function MuscleBreakdown({ weights, sex, emptyLabel = "这个动作尚未标注训练部位。" }: {
  weights: Record<string, number>; sex?: AnatomyVariant | null; emptyLabel?: string;
}) {
  const active = Object.entries(weights).filter(([, value]) => value > 0).sort(([, a], [, b]) => b - a);
  return <section className="card padded feature-stack">
    <h3>训练部位</h3>
    <Anatomy weights={weights} sex={sex} />
    {active.length ? <div className="anatomy-legend">{[true, false].map((primary) => {
      const list = active.filter(([, value]) => (value >= 75) === primary);
      return list.length ? <div key={String(primary)}><i style={{ background: primary ? muscleBlues[4] : muscleBlues[2] }} /><strong>{primary ? "主要部位" : "辅助部位"}</strong>
        <span>{list.map(([key]) => muscleNames[key] ?? key).join("、")}</span></div> : null;
    })}</div> : <p className="muted">{emptyLabel}</p>}
  </section>;
}
