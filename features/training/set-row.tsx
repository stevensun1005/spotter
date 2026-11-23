"use client";

import { Check } from "lucide-react";
import type { Move, SetLine } from "@/app/workout";
import { fieldValue, type NumberField } from "./set-editor";

export const fieldLabels: Record<NumberField, string> = {
  weight: "重量", reps: "次数", seconds: "秒数", rightWeight: "右侧重量", rightReps: "右侧次数", rpe: "RPE",
};
export const kindLabels = { warmup: "热身", drop: "递减" };

export function SetRow({ move, line, index, selected, edit, toggle }: {
  move: Move; line: SetLine; index: number; selected?: NumberField;
  edit: (field: NumberField) => void; toggle: () => void;
}) {
  const rowLabel = move.name + " 第 " + (index + 1) + " 组";
  const timed = move.seconds > 0;
  const field = (key: NumberField, label: string, accessible: string = fieldLabels[key]) =>
    <button type="button" className="set-number" aria-label={rowLabel + accessible}
      aria-expanded={selected === key} aria-haspopup="true" onClick={() => edit(key)}>
      <span>{label}</span><strong>{fieldValue(line, key) ?? "—"}</strong>
    </button>;

  return <div className={"set-row" + (line.done ? " done" : "")} data-set-row>
    <span className="set-index"><strong>{index + 1}</strong>{line.kind && <small>{kindLabels[line.kind]}</small>}</span>
    <div className="set-fields">
      <div className="set-field-line">
        {field("weight", line.right ? "左 " + move.unit : move.unit, line.right ? "左侧重量" : "重量")}
        {field(timed ? "seconds" : "reps", timed ? "秒" : line.right ? "左 次" : "次", timed ? "秒数" : line.right ? "左侧次数" : "次数")}
      </div>
      {line.right && <div className="set-field-line">{field("rightWeight", "右 " + move.unit)}{field("rightReps", "右 次")}</div>}
      {line.rpe !== undefined && <button type="button" className="set-rpe" aria-label={rowLabel + "RPE"} onClick={() => edit("rpe")}>RPE {line.rpe}</button>}
    </div>
    <button className="check-button" type="button" aria-pressed={line.done} aria-label={rowLabel + "完成"} onClick={toggle}><Check size={20} /></button>
  </div>;
}
