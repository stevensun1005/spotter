"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { foodPortion } from "@/features/library/model";
import { errorText } from "@/shared/client";
import { displayNumber } from "@/shared/ui";
import { maxFoodGrams } from "./foods";
import { portionKey, saveFoodPortion, type Portion } from "./portions";

export function PortionEditor({ portions, save }: { portions: Portion[]; save: (portions: Portion[]) => Promise<void> }) {
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function apply(next: Portion[], clear = false) {
    setBusy(true); setError("");
    try {
      await save(next);
      if (clear) { setName(""); setGrams(""); }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  function savePortion() {
    if (busy) return;
    const value = foodPortion.safeParse({ name, grams: Number(grams) });
    if (!value.success) { setError("填写份量名称和每份实际克数。"); return; }
    const next = saveFoodPortion(portions, value.data);
    if (next.length > 8) { setError("每种食物可以保存 8 个常用份量。"); return; }
    void apply(next, true);
  }

  return <details className="move-editor">
    <summary>设置常用份量</summary>
    <div className="form-fields" onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); savePortion(); }
    }}>
      {portions.map((portion) => <div key={portionKey(portion.name)} className="list-line">
        <button type="button" className="text-button" disabled={busy} onClick={() => { setName(portion.name); setGrams(String(portion.grams)); }}>
          1 {portion.name} · {displayNumber(portion.grams)} g
        </button>
        <button type="button" className="icon-button" aria-label={"移除" + portion.name} disabled={busy}
          onClick={() => void apply(portions.filter((item) => item !== portion))}><Trash2 size={16} /></button>
      </div>)}
      <div className="field-grid">
        <label>份量名称<input value={name} maxLength={20} placeholder="杯、勺或份" onChange={(event) => setName(event.target.value)} /></label>
        <label>每份克数<input type="number" inputMode="decimal" value={grams} min={0.1} max={maxFoodGrams} step="any"
          onChange={(event) => setGrams(event.target.value)} /></label>
      </div>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <button className="button outline small" type="button" disabled={busy} onClick={savePortion}>保存常用份量</button>
    </div>
  </details>;
}
