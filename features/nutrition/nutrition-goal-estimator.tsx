"use client";

import { readBodyInputs } from "@/features/body/profile";
import { useLibrary } from "@/features/library/use-library";
import type { NutritionValues } from "@/features/library/model";
import { displayNumber } from "@/shared/ui";
import { estimateNutritionGoal, nutritionGoalInput, type NutritionActivity, type NutritionGoal } from "./goal-estimate";

export const nutritionGoalLabels: Record<NutritionGoal, string> = {
  maintain: "维持体重",
  recompose: "减脂增肌（维持体重）",
  gain: "增肌增重",
  lose: "减脂",
};

const activityLabels: Record<NutritionActivity, string> = {
  sedentary: "久坐，很少运动",
  light: "轻度，每周运动 1–2 天",
  moderate: "中度，每周运动 3–5 天",
  high: "较高，每周运动 6–7 天或日常活动量大",
};

export type NutritionGoalDraft = {
  goal: NutritionGoal | "";
  activity: NutritionActivity | "";
  minKg: string;
  maxKg: string;
};

const nutrients = [
  { id: "calories", name: "热量", unit: "千卡" },
  { id: "protein", name: "蛋白质", unit: "g" },
  { id: "carbs", name: "碳水", unit: "g" },
  { id: "fat", name: "脂肪", unit: "g" },
] as const;

export function NutritionGoalEstimator({ enabled, today, draft, onChange, water, onApply, onBody }: {
  enabled: boolean;
  today: string;
  draft: NutritionGoalDraft;
  onChange: (next: NutritionGoalDraft) => void;
  water: number;
  onApply: (values: NutritionValues) => void;
  onBody: () => void;
}) {
  const body = useLibrary(enabled, undefined, true);
  const { profile, weightKg } = readBodyInputs(body.rows, today);
  const complete = Boolean(profile?.heightCm && profile.age && profile.sex && weightKg);
  const input = complete && draft.goal && draft.activity && nutritionGoalInput.safeParse({
    heightCm: profile?.heightCm, age: profile?.age, sex: profile?.sex, weightKg,
    goal: draft.goal, activity: draft.activity,
  });
  const estimate = input && input.success ? estimateNutritionGoal(input.data) : undefined;

  return <section className="nutrition-goal-estimator feature-stack" aria-label="按身体档案估算目标">
    <h3>按身体档案估算</h3>
    {body.loading ? <p className="muted" role="status">正在读取身体档案…</p> : body.error
      ? <button type="button" className="button outline small" onClick={() => void body.load()}>重试读取身体档案</button>
      : complete ? <p className="muted">{profile?.heightCm} cm · {weightKg} kg · {profile?.age} 岁</p>
      : <div className="exercise-toolbar"><p className="muted">填写身高、年龄和性别，并记录体重后即可估算。</p>
        <button type="button" className="button outline small" onClick={onBody}>打开身体数据</button></div>}
    <div className="field-grid">
      <label>目标方向<select value={draft.goal} required={Boolean(draft.activity)} onChange={(event) => onChange({ ...draft, goal: event.target.value as NutritionGoalDraft["goal"] })}>
        <option value="">选择目标</option>
        {Object.entries(nutritionGoalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>日常活动量<select value={draft.activity} required={Boolean(draft.goal)} onChange={(event) => onChange({ ...draft, activity: event.target.value as NutritionGoalDraft["activity"] })}>
        <option value="">选择活动量</option>
        {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {draft.goal === "recompose" && <div className="field-grid">
      <label>体重下限（kg，可选）<input type="number" inputMode="decimal" step="any" min={10} max={draft.maxKg || 700}
        value={draft.minKg} required={Boolean(draft.maxKg)} onChange={(event) => onChange({ ...draft, minKg: event.target.value })} /></label>
      <label>体重上限（kg，可选）<input type="number" inputMode="decimal" step="any" min={draft.minKg || 10} max={700}
        value={draft.maxKg} required={Boolean(draft.minKg)} onChange={(event) => onChange({ ...draft, maxKg: event.target.value })} /></label>
    </div>}
    {input && !estimate && <p className="muted" role="status">{input.success ? "当前档案不适合此目标，请选择其他目标。" : "当前资料超出成人估算范围，请核对身体档案。"}</p>}
    {estimate && <>
      <div className="food-preview" role="group" aria-label="每天的估算饮食目标">{nutrients.map(({ id, name, unit }) => <div key={id}>
        <span>{name}</span><strong>{displayNumber(estimate.values[id])}</strong><small>{unit}</small>
      </div>)}</div>
      <div className="exercise-toolbar">
        <span>估算维持热量 {displayNumber(estimate.maintenanceCalories)} 千卡／天</span>
        <button type="button" className="button outline small" onClick={() => onApply({ ...estimate.values, water })}>填入目标</button>
      </div>
    </>}
  </section>;
}
