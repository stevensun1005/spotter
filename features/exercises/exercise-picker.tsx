"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { Dialog } from "@/shared/ui";
import type { Move } from "@/features/plans/model";
import { type ExerciseProfile } from "@/features/library/model";
import { blockTitle } from "@/features/training/sequence";
import { catalogueCover, catalogueDemo } from "./catalogue-demo";
import { parsePlanMove } from "./move-name";
import { OpenGymCatalogue } from "./open-gym-catalogue";
import { useCatalogue, type CatalogEntry, type ExerciseChoice } from "./open-gym";
import { label } from "./labels";
import { exerciseTempo, tempoMaxLength, tempoNotationHint } from "./tempo";
import { barbellReplacementGear, cableReplacementGear, commonReplacementGear, defaultCatalogMove, recommendReplacements, replacementEquipment, replacementGearLabel, replacementPlan,
  replacementReference, sameReplacementStation, type ReplacementContext, type ReplacementOptions } from "./replacements";

export { defaultCatalogMove } from "./replacements";

const defaultOptions: ReplacementOptions = { sameStationOnly: true, available: [], avoidKneeling: false, avoidJumping: false };

export function ExercisePicker({ onUse, close, prior, profiles, names, allowBlank = true, replacementContext }: {
  onUse: (move: Move) => void;
  close: () => void;
  prior?: Move;
  profiles?: ExerciseProfile[];
  names?: string[];
  allowBlank?: boolean;
  replacementContext?: ReplacementContext;
}) {
  const catalogue = useCatalogue();
  const [config, setConfig] = useState<{ move: Move; item?: CatalogEntry; station?: "same" | "changed" | "unknown" }>();
  const [mode, setMode] = useState<"suggested" | "catalogue">("suggested");
  const [options, setOptions] = useState(defaultOptions);
  const suggestions = useMemo(() => prior && catalogue.data && mode === "suggested"
    ? recommendReplacements(catalogue.data, prior, options, names) : [], [catalogue.data, mode, names, options, prior]);
  const previous = replacementReference(catalogue.data, prior);
  const selectableGear = previous?.equipment === "cable" ? [...commonReplacementGear, ...cableReplacementGear] :
    previous?.equipment === "barbell" ? [...commonReplacementGear, ...barbellReplacementGear] : commonReplacementGear;
  const preview = replacementContext && config ? replacementPlan(replacementContext, config.move) : undefined;

  function configure(choice: ExerciseChoice, item?: CatalogEntry) {
    const move = defaultCatalogMove(choice, item, prior);
    const station = !prior ? undefined : !item ? "unknown" : sameReplacementStation(previous, item, prior.station) ? "same" : "changed";
    if (station === "changed" && prior && (prior.station || prior.block) && item) {
      const gear = replacementEquipment(item).map(replacementGearLabel);
      if (item.machine && item.machine !== "none") gear.push(item.name);
      move.station = (gear.join(" · ") || "自重").slice(0, 60);
    }
    setConfig({ move, item, station });
  }
  const use = (choice: ExerciseChoice, item?: CatalogEntry) => {
    if (prior || (!choice.name && !allowBlank)) { configure(choice, item); return; }
    onUse(defaultCatalogMove(choice, item, prior));
  };
  function confirm(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (config) {
      const { reps, repsMax } = config.move;
      onUse({ ...config.move, name: config.move.name.trim(), tempo: config.move.tempo?.trim() || undefined,
        repsMax: reps > 0 && repsMax && repsMax >= reps ? repsMax : undefined });
    }
  }
  const fields = [
    { label: "组数", key: "sets", low: 1, high: 30 },
    { label: "次数", key: "reps", low: 0, high: 999 },
    { label: "秒数", key: "seconds", low: 0, high: 18000 },
    { label: "组间休息（秒）", key: "restSeconds", low: 0, high: 600 },
  ] as const;
  return createPortal(<Dialog title={prior ? "替换动作" : "选择动作"} className="catalogue-picker-dialog" onClose={close}>
    <div className="dialog-body">
      {config ? <form onSubmit={confirm} className="form-fields picker-config">
        <button type="button" className="button subtle small" onClick={() => setConfig(undefined)}><ChevronLeft size={17} /> 返回选动作</button>
        {config.item ? <><h3>{config.move.name}</h3><p className="muted">{replacementEquipment(config.item).map(replacementGearLabel).join("、") || label(config.item.equipment)} · {label(config.item.type)}{config.item.distance ? " · 原动作按距离完成" : ""}</p></> :
          <label>动作名称<input required maxLength={100} value={config.move.name} onChange={(event) => setConfig({ ...config, move: { ...config.move, name: event.target.value } })} /></label>}
        {prior && <p className="muted">{config.station === "same" ? "可沿用原站器械。" : config.station === "changed" ? "这项动作可能需要换站，请确认器械。" : "这项动作的器械未核对。"}新动作的重量从零开始记录。</p>}
        <div className="field-grid">{fields.map(({ label, key, low, high }) => <label key={key}>{label}
          <input type="number" min={low} max={high} required={key === "sets"} value={config.move[key] ?? ""}
            onChange={(event) => setConfig({ ...config, move: { ...config.move, [key]: key === "restSeconds" && !event.target.value
              ? undefined : Number(event.target.value) } })} /></label>)}</div>
        <label>节奏<input maxLength={tempoMaxLength} title={tempoNotationHint} value={config.move.tempo ?? ""}
          placeholder={exerciseTempo(config.move, config.item).text}
          onChange={(event) => setConfig({ ...config, move: { ...config.move, tempo: event.target.value || undefined } })} /></label>
        {preview && <section className="card padded replacement-preview" aria-label="替换后动作顺序">
          <h4>{blockTitle(preview.block)}{preview.block.station ? " · " + preview.block.station : ""}</h4>
          <ol>
            {preview.block.moves.map((index, at) => {
              const move = preview.plan.exercises[index];
              const reps = move.repsMax && move.repsMax > move.reps ? move.reps + "–" + move.repsMax : move.reps;
              return <li key={index}><span>{preview.block.slots[at]} · {parsePlanMove(move.name).name || "自定义动作"}</span>
                <small>{move.sets} 组 × {move.seconds ? move.seconds + " 秒" : reps + " 次"}</small></li>;
            })}
          </ol>
          {preview.rest && <p className="muted">新动作第 1 组后 · {preview.rest.kind} {preview.rest.seconds} 秒</p>}
        </section>}
        <button className="button primary" disabled={!config.move.name.trim()}><Plus size={17} /> {prior ? "使用这个动作" : "加入动作"}</button>
      </form> : <>
        {prior && <section className="replacement-chooser">
          <p className="muted">替换「{parsePlanMove(prior.name).name}」{prior.station ? " · " + prior.station : ""}</p>
          <div className="segmented" role="group" aria-label="动作替换范围">
            <button type="button" aria-pressed={mode === "suggested"} onClick={() => setMode("suggested")}>GoodLife 建议</button>
            <button type="button" aria-pressed={mode === "catalogue"} onClick={() => setMode("catalogue")}>全部动作</button>
          </div>
          {mode === "suggested" && <>
            <details className="replacement-options">
              <summary>器械和动作限制</summary>
              <div className="form-fields">
                <label className="toggle-label"><input type="checkbox" checked={options.sameStationOnly} onChange={(event) => setOptions({ ...options, sameStationOnly: event.target.checked })} /> 只看原站器械</label>
                <label className="toggle-label"><input type="checkbox" checked={options.avoidKneeling} onChange={(event) => setOptions({ ...options, avoidKneeling: event.target.checked })} /> 避开跪姿</label>
                <label className="toggle-label"><input type="checkbox" checked={options.avoidJumping} onChange={(event) => setOptions({ ...options, avoidJumping: event.target.checked })} /> 避开跳跃</label>
                <div className="catalogue-chip-row wraps" role="group" aria-label="本次可用器械">
                  {selectableGear.map(([key, name]) => <button key={key} type="button" className="catalogue-chip" aria-pressed={options.available.includes(key)}
                    onClick={() => setOptions({ ...options, available: options.available.includes(key) ? options.available.filter((item) => item !== key) : [...options.available, key] })}>{name}</button>)}
                </div>
                {options.available.length > 0 && <button type="button" className="button subtle small" onClick={() => setOptions({ ...options, available: [] })}>清除已选器械</button>}
              </div>
            </details>
            {catalogue.error ? <p className="muted">{catalogue.error} <button type="button" className="text-button" onClick={catalogue.reload}>重试</button></p> :
              !catalogue.data ? <p className="muted">正在读取动作库…</p> :
              suggestions.length ? <div className="replacement-list">{suggestions.map(({ row, gear, pattern, muscles, sameStation, specialist }) => {
                const cover = catalogueCover(catalogueDemo(row));
                return <button type="button" className="card replacement-option" key={row.id} onClick={() => configure({ name: row.name, catalogueId: row.id }, row)}>
                  {cover && <span className="catalogue-thumb"><img src={cover} alt="" /></span>}
                  <span><strong>{row.name}</strong><small>{specialist ? "专项变式 · " : ""}{pattern} · {muscles.join("、")}</small>
                    <small>{sameStation ? "原站器械" : "需要换站"} · {gear.map(replacementGearLabel).join("、") || "自重"}</small></span>
                </button>;
              })}</div> : <p className="muted">当前条件下没有找到动作模式和主练部位都匹配的替代项。可以调整限制，或打开全部动作。</p>}
          </>}
        </section>}
        {(!prior || mode === "catalogue") && <OpenGymCatalogue picker choose={configure} quick={use} names={names} profiles={profiles} />}
      </>}
    </div>
  </Dialog>, document.body);
}
