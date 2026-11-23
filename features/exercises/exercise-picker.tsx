"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { moveBlank, type Move } from "@/features/plans/model";
import { type ExerciseProfile } from "@/features/library/model";
import { OpenGymCatalogue } from "./open-gym-catalogue";
import { fromCatalogue, useCatalogue, type CatalogEntry, type ExerciseChoice } from "./open-gym";
import { label } from "./labels";

export function defaultCatalogMove(choice: ExerciseChoice, item?: CatalogEntry, prior?: Move) {
  const timed = item?.hold || item?.type === "isometric" || item?.type === "cardio";
  return {
    ...moveBlank(), ...(prior ? { sets: prior.sets, restSeconds: prior.restSeconds, unit: prior.unit } : {}),
    ...choice,
    reps: timed ? 0 : item?.distance ? 1 : prior?.reps || 10,
    seconds: timed ? prior?.seconds || 30 : 0,
  };
}

export function ExercisePicker({ onUse, close, prior, profiles, names, allowBlank = true }: {
  onUse: (move: Move) => void;
  close: () => void;
  prior?: Move;
  profiles?: ExerciseProfile[];
  names?: string[];
  allowBlank?: boolean;
}) {
  const catalogue = useCatalogue();
  const [config, setConfig] = useState<{ move: Move; item?: CatalogEntry }>();
  const previous = prior ? fromCatalogue(catalogue.data, prior) : undefined;
  const sameMuscle = previous ? Object.entries(previous.muscles).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const use = (choice: ExerciseChoice, item?: CatalogEntry) => {
    if (!choice.name && !allowBlank) { setConfig({ move: defaultCatalogMove(choice, item, prior), item }); return; }
    onUse(defaultCatalogMove(choice, item, prior));
  };
  function confirm(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (config) onUse({ ...config.move, name: config.move.name.trim() });
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
        {config.item ? <><h3>{config.move.name}</h3><p className="muted">{label(config.item.equipment)} · {label(config.item.type)}{config.item.distance ? " · 原动作按距离完成" : ""}</p></> :
          <label>动作名称<input required maxLength={100} value={config.move.name} onChange={(event) => setConfig({ ...config, move: { ...config.move, name: event.target.value } })} /></label>}
        <div className="field-grid">{fields.map(({ label, key, low, high }) => <label key={key}>{label}
          <input type="number" min={low} max={high} required={key === "sets"} value={config.move[key] ?? ""}
            onChange={(event) => setConfig({ ...config, move: { ...config.move, [key]: Number(event.target.value) } })} /></label>)}</div>
        <button className="button primary" disabled={!config.move.name.trim()}><Plus size={17} /> {prior ? "使用这个动作" : "加入动作"}</button>
      </form> : <>
        {prior && <p className="muted">替换「{prior.name}」</p>}
        {(!prior || catalogue.data || catalogue.error) && <OpenGymCatalogue picker choose={(choice, item) => setConfig({ move: defaultCatalogMove(choice, item, prior), item })}
          quick={use} names={names} profiles={profiles} sameMuscle={sameMuscle} />}
      </>}
    </div>
  </Dialog>, document.body);
}
