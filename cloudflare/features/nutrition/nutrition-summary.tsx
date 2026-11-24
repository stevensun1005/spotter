"use client";

import type { CSSProperties, ReactNode } from "react";
import { Apple, ChefHat, CookingPot, CupSoda, Scale, Utensils, ArrowUpRight } from "lucide-react";
import { displayNumber } from "@/shared/ui";
import { emptyNutrition, type LibraryItem, type NutritionValues } from "@/features/library/model";
import { nutritionShortcuts, type NutritionShortcut } from "./nutrition-preferences";
export { nutritionShortcuts, type NutritionShortcut } from "./nutrition-preferences";

const nutrients = [
  { id: "protein", label: "蛋白质", unit: "g", color: "#bd632f" },
  { id: "carbs", label: "碳水", unit: "g", color: "#7764c3" },
  { id: "fat", label: "脂肪", unit: "g", color: "#bd5061" },
  { id: "water", label: "饮水", unit: "ml", color: "#14868a" },
] as const;

const icons = { 早餐: ChefHat, 午餐: Utensils, 晚餐: CookingPot, 加餐: Apple, 饮水: CupSoda, 体重: Scale };

export function nutritionTotals(rows: readonly LibraryItem[], date?: string) {
  const totals = { ...emptyNutrition };
  for (const row of rows) {
    if (row.kind !== "nutrition" || (date && row.date !== date)) continue;
    const { entry } = row;
    if (entry.type === "water") totals.water += entry.ml;
    if (entry.type === "meal") {
      totals.calories += entry.calories;
      totals.protein += entry.protein;
      totals.carbs += entry.carbs;
      totals.fat += entry.fat;
    }
  }
  return totals;
}

export function NutritionRings({ totals, targets }: { totals: NutritionValues; targets: NutritionValues }) {
  return <div className="nutrition-dials">{nutrients.map(({ id, label, unit, color }) => {
    const percent = targets[id] ? Math.round(totals[id] * 100 / targets[id]) : undefined;
    return <div key={id} className="nutrition-dial" style={{ "--dial-color": color, "--dial-progress": `${Math.min(percent ?? 0, 100)}%` } as CSSProperties}>
      <div className="nutrition-dial-ring"><div><strong>{displayNumber(totals[id])}</strong><small>{targets[id] ? `/ ${displayNumber(targets[id])}` : unit}</small></div></div>
      <span>{label} <small>{unit}</small></span>{percent !== undefined && <small>{percent}%</small>}
    </div>;
  })}</div>;
}

export function NutritionSummary({ totals, targets, caloriesTarget, topActions, onOpen }: {
  totals: NutritionValues; targets: NutritionValues; caloriesTarget?: number; topActions?: ReactNode; onOpen?: () => void;
}) {
  const goal = caloriesTarget ?? targets.calories;
  const numbers = <><strong>{displayNumber(totals.calories)}</strong><span>{goal > 0 ? ` / ${displayNumber(goal)} 千卡` : " 千卡"}</span></>;
  return <div className="nutrition-overview">
    <div className="nutrition-overview-head">
      {onOpen ? <button className="nutrition-energy-button" type="button" onClick={onOpen} aria-label="打开饮食详情">
        <span className="nutrition-energy">{numbers}</span><ArrowUpRight size={16} aria-hidden="true" />
      </button> : <div className="nutrition-energy">{numbers}</div>}
      {topActions && <div className="nutrition-overview-actions">{topActions}</div>}
    </div>
    <NutritionRings totals={totals} targets={targets} />
  </div>;
}

export function NutritionShortcuts({ onSelect, actions = nutritionShortcuts, disabled }: {
  onSelect: (action: NutritionShortcut) => void; actions?: readonly NutritionShortcut[]; disabled?: boolean;
}) {
  return <div className="nutrition-shortcuts" aria-label="快速记录">{actions.map((action) => {
    const Icon = icons[action];
    return <button type="button" key={action} onClick={() => onSelect(action)} disabled={disabled}>
      <Icon size={19} aria-hidden="true" /><span>{action === "体重" ? "记体重" : action}</span>
    </button>;
  })}</div>;
}
