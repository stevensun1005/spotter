"use client";

import { useEffect, type ReactNode } from "react";
import { Delete, Keyboard } from "lucide-react";

type Action = { text: ReactNode; name: string; press: () => void; disabled?: boolean; active?: boolean; hidden?: boolean };
const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "Backspace"];

export function WorkoutKeypad({ label, value, decimal, invalid, press, close, left, right, weightStep }: {
  label: string; value: string; decimal: boolean; invalid: boolean;
  press: (key: string) => void; close: () => void; left: Action[]; right: Action[];
  weightStep?: { amount: number; adjust: (direction: -1 | 1) => void };
}) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (keys.includes(event.key)) {
        event.preventDefault();
        press(event.key);
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [press]);

  const action = ({ text, name, press, disabled, active, hidden }: Action) => hidden
    ? <span aria-hidden="true" />
    : <button type="button" className="pad-action" aria-label={name} aria-pressed={active} disabled={disabled} onClick={press}>{text}</button>;

  return <section className="workout-keypad" aria-label="训练数字键盘">
    <div className="keypad-heading">
      <div><span>{label}</span><strong aria-live="polite" aria-invalid={invalid}>{value || "—"}</strong></div>
      {weightStep && <div className="keypad-weight-step">
        <button type="button" className="button subtle small" aria-label={"减少重量 " + weightStep.amount} onClick={() => weightStep.adjust(-1)}>−{weightStep.amount}</button>
        <button type="button" className="button subtle small" aria-label={"增加重量 " + weightStep.amount} onClick={() => weightStep.adjust(1)}>+{weightStep.amount}</button>
      </div>}
      <button type="button" className="button subtle keypad-close" aria-label="收起键盘" onClick={close}><Keyboard size={17} /> 完成</button>
    </div>
    <div className="keypad-grid">
      {left.map((item, i) => <div className="keypad-row" key={i}>
        {action(item)}
        {keys.slice(i * 3, i * 3 + 3).map((key) => <button type="button" className="pad-digit" key={key}
          disabled={key === "." && !decimal} aria-label={key === "Backspace" ? "退格" : key === "." ? "小数点" : key}
          onClick={() => press(key)}>{key === "Backspace" ? <Delete size={23} /> : key}</button>)}
        {action(right[i])}
      </div>)}
    </div>
  </section>;
}
