"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight, ChevronDown, Flame, Scale } from "lucide-react";
import { ageOn, readBodyFat, readBodyInputs } from "@/features/body/profile";
import type { useLibrary } from "@/features/library/use-library";
import type { LibraryItem, NutritionValues } from "@/features/library/model";
import { offsetDate } from "@/shared/dates";
import { displayNumber } from "@/shared/ui";
import { calibrateMaintenance, calibrationFoodDays, calibrationRules, type EnergyCalibration, type IntakeDay, type WeightReading } from "./energy-calibration";
import { estimateNutritionGoal, goalEstimateRules, nutritionGoalInput, type NutritionActivity, type NutritionGoal,
  type NutritionGoalEstimate, type NutritionGoalNote, type NutritionPace } from "./goal-estimate";

export const nutritionGoalLabels: Record<NutritionGoal, string> = {
  maintain: "维持体重",
  recompose: "减脂增肌（维持体重）",
  gain: "增肌增重",
  lose: "减脂",
};

const activityLabels: Record<NutritionActivity, string> = {
  sedentary: "久坐（日均不到 5000 步）",
  light: "少量走动（5000–7500 步）",
  moderate: "经常走动（7500–12500 步）",
  high: "体力劳动（12500 步以上）",
};
const paceNames: Record<NutritionPace, string> = { slow: "慢", standard: "标准", fast: "快" };
const confidenceNames = { low: "低", medium: "中", high: "高" } as const;
const share = (value: number) => Math.round(value * 100) + "%";
const kilograms = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
const floors = `男性 ${goalEstimateRules.calorieFloor.male}、女性 ${goalEstimateRules.calorieFloor.female} 千卡`;
const noteLabels: Record<NutritionGoalNote, string> = {
  recordsTooLow: "按记录推算的维持热量低于最低摄入量，多半是饮食没记全，这次按公式估算。",
  paceLimited: `已放慢进度：减重每周不超过体重的 ${share(goalEstimateRules.maxWeeklyLossShare)}、每天最多少吃 ${goalEstimateRules.maxDailyDeficit} 千卡；增重每周不超过 ${
    goalEstimateRules.maxWeeklyGainShare * 100}%、每天最多多吃 ${goalEstimateRules.maxDailySurplus} 千卡。`,
  nearUnderweight: `体重接近偏瘦线（BMI ${goalEstimateRules.minLossBmi}），已放慢进度：按这个速度 ${goalEstimateRules.lowWeightWeeks} 周内不会低于偏瘦线。`,
  calorieFloor: `已上调到最低摄入量（${floors}），缺口比所选进度小。`,
  belowFloor: `这个热量低于一般的最低摄入量（${floors}），因为估算的维持热量本身就低。长期吃这么少不容易吃够营养，建议先问医生或营养师。`,
  proteinLimited: `蛋白质已限制在总热量的 ${share(goalEstimateRules.proteinShare.max)} 以内。`,
  lowCarbs: `碳水低于 ${goalEstimateRules.lowCarbGrams} g，训练状态可能受影响。`,
  largeDeficit: `每天少吃超过 ${goalEstimateRules.muscleGainDeficit} 千卡时，力量训练很难再长肌肉。`,
};
/** A note as shown under the estimate. Advice to slow down is only given when a slower pace exists and would change the target. */
function noteText(note: NutritionGoalNote, estimate: NutritionGoalEstimate, draft: NutritionGoalDraft) {
  const canSlow = estimate.adjustmentCalories < 0 && draft.pace !== "slow";
  switch (note) {
    case "nearUnderweight":
      return estimate.adjustmentCalories < 0 ? noteLabels[note] : `体重已接近偏瘦线（BMI ${goalEstimateRules.minLossBmi}），这次没有设缺口。`;
    case "belowFloor":
      return draft.goal === "lose" ? noteLabels[note].replace("本身就低。", "本身就低，所以没有设缺口。") : noteLabels[note];
    case "lowCarbs":
      return noteLabels[note] + (canSlow && !estimate.notes.includes("calorieFloor") ? "可以放慢进度。" : "");
    case "largeDeficit":
      return noteLabels[note] + (canSlow ? "想边减脂边增肌，可以选慢一些的进度。" : "");
    default:
      return noteLabels[note];
  }
}
/** Week counts up to this are shown as a soonest date. Longer ones only as a lower bound, because maintenance falls with weight. */
const projectionWeeks = 12;

export type NutritionGoalDraft = {
  goal: NutritionGoal | "";
  activity: NutritionActivity | "";
  /** Empty until the person picks a number, picks an activity level or fills in an estimate. Until then recent workouts are counted. */
  trainingDays?: number;
  pace: NutritionPace;
  minKg: string;
  maxKg: string;
  /** The saved activity level comes from the earlier estimator, where it also covered exercise, so it has to be picked again. */
  reviewActivity?: boolean;
};

const nutrients = [
  { id: "carbs", name: "碳水" },
  { id: "protein", name: "蛋白质" },
  { id: "fat", name: "脂肪" },
] as const;

/** What the records say about maintenance energy, or what is still missing before they can be used. */
function recordsText(calibration: EnergyCalibration) {
  const rules = calibrationRules;
  const weeks = rules.windowDays / 7;
  const skipped = calibration.skippedDays
    ? `饮食记录刚开始，或中断 ${rules.logStart.gapDays} 天以上后重新开始时，前 ${calibration.skippedDays} 天不计入，那几天的体重变化里水分多。` : "";
  if (!calibration.ready) {
    if (calibration.reason === "lowDays") {
      return `近 ${weeks} 周的饮食记录里，记得特别少的日子超过 ${share(rules.maxLowDayShare)}，分不清是没记全还是确实吃得少，暂不按记录校准。`;
    }
    if (calibration.reason === "implausible") return `按近 ${weeks} 周的记录推算不出合理的维持热量，多半是饮食没记全，暂不按记录校准。`;
    return `近 ${weeks} 周在有饮食记录的日子里称重满 ${rules.minWeighIns} 天（首尾相隔至少 ${rules.minSpanDays} 天），其间完整记录至少 ${
      rules.minLoggedDays} 天饮食且不少于这些天数的 ${share(rules.minLoggedShare)}，就可以按实际记录校准。现在可用的称重有 ${
      calibration.weighIns} 天，首尾相隔 ${calibration.spanDays} 天，其间完整记录 ${calibration.loggedDays} 天。${skipped}`;
  }
  return `称重 ${calibration.weighIns} 天，每周 ${calibration.weeklyChangeKg > 0 ? "+" : ""}${kilograms(calibration.weeklyChangeKg)} kg；其间完整饮食记录 ${
    calibration.loggedDays} 天，日均 ${displayNumber(calibration.averageIntake)} 千卡；推算维持约 ${displayNumber(calibration.measuredCalories)} 千卡（±${
    displayNumber(calibration.measuredError)}，未计漏记），可信度${confidenceNames[calibration.confidence]}。${
    calibration.lowDays ? `有 ${calibration.lowDays} 天记得特别少，分不清是没记全还是确实吃得少，按一半计入，误差已加大。` : ""}${
    calibration.intakeShift ? "记录期间饮食量有明显变化，体重变化里可能有水分，误差已加大。" : ""}${
    calibration.limit === "low" ? "推算值比公式低很多，可能有漏记的饮食，采用值已限制在合理范围内。" : ""}${
    calibration.limit === "high" ? "推算值比公式高很多，可能是日常活动选低了，或体重变化里有水分，采用值已限制在合理范围内。" : ""}${
    calibration.confidence === "low" ? "可信度低，默认不采用。" : ""}${skipped}`;
}

/** When the target weight would be reached at the estimated weekly change. Nothing when the estimate is moving away from it. */
function arrivalText(estimate: NutritionGoalEstimate, weightKg: number | undefined, targetWeightKg: number | undefined, minLossKg: number) {
  if (weightKg === undefined || targetWeightKg === undefined || !estimate.weeklyChangeKg) return "";
  const weeks = Math.ceil((targetWeightKg - weightKg) / estimate.weeklyChangeKg);
  if (!(weeks > 0 && weeks < 1000)) return "";
  if (estimate.weeklyChangeKg < 0 && targetWeightKg <= minLossKg) {
    return `。目标体重 ${kilograms(targetWeightKg)} kg 低于偏瘦线（BMI ${goalEstimateRules.minLossBmi}），不估算到达时间`;
  }
  return weeks <= projectionWeeks ? `，最快约 ${weeks} 周到 ${kilograms(targetWeightKg)} kg，实际通常会慢一些`
    : `，到 ${kilograms(targetWeightKg)} kg 至少要 ${weeks} 周，体重变化后请重新计算`;
}

/** How the daily target follows from resting energy, maintenance and the goal. */
function estimateText(estimate: NutritionGoalEstimate, arrival: string, includesTraining: boolean) {
  const resting = `基础代谢约 ${displayNumber(estimate.restingCalories)} 千卡（${estimate.restingMethod === "leanMass" ? "按体脂率和训练量" : "按身高、体重、年龄"}），`;
  const maintenance = `维持约 ${displayNumber(estimate.maintenanceCalories)} 千卡（${estimate.maintenanceSource === "records" ? "按记录校准" : "按活动量"}）。`;
  const change = estimate.adjustmentCalories
    ? `每天${estimate.adjustmentCalories > 0 ? "多吃" : "少吃"} ${displayNumber(Math.abs(estimate.adjustmentCalories))} 千卡，预计每周约${
      estimate.weeklyChangeKg > 0 ? "增" : "减"} ${kilograms(Math.abs(estimate.weeklyChangeKg))} kg${arrival}。`
    : "按维持热量吃。";
  // Training is already inside maintenance, so adding the same workout to the day's target would count it twice.
  return resting + maintenance + change + (includesTraining ? "维持热量已包含训练消耗，同一次训练不用再通过「计入运动消耗」加到当天目标。" : "");
}

/** Daily calorie totals of the days before `today` that the calibration reads. */
function useRecentIntake(enabled: boolean, today: string) {
  const [state, setState] = useState<{ today: string; days: IntakeDay[] }>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ scope: "nutrition", from: offsetDate(today, -calibrationFoodDays), to: offsetDate(today, -1) });
    void fetch(`/api/data?${query}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { library } = await response.json() as { library: LibraryItem[] };
      const totals = new Map<string, number>();
      for (const row of library) {
        if (row.kind === "nutrition" && row.entry.type === "meal") totals.set(row.date, (totals.get(row.date) ?? 0) + row.entry.calories);
      }
      if (!controller.signal.aborted) setState({ today, days: [...totals].map(([date, calories]) => ({ date, calories })) });
    }).catch(() => {
      // Calibration is optional. The formula estimate works without these records.
    });
    return () => controller.abort();
  }, [enabled, today]);
  return state?.today === today ? state.days : undefined;
}

export function NutritionGoalEstimator({ body, enabled, today, draft, loggedTrainingDays = 0, onChange, water, targetWeightKg, onApply, onBody }: {
  body: Pick<ReturnType<typeof useLibrary>, "rows" | "loading" | "error" | "load">;
  enabled: boolean;
  today: string;
  draft: NutritionGoalDraft;
  /** Training days per week seen in recent workouts, used until the person has their own number. */
  loggedTrainingDays?: number;
  onChange: (next: NutritionGoalDraft) => void;
  water: number;
  targetWeightKg?: number;
  onApply: (values: NutritionValues) => void;
  onBody: () => void;
}) {
  const intake = useRecentIntake(enabled, today);
  const activityHelp = useId();
  // The person's own choice. Before they make one, records are used unless their error is large.
  const [recordsChoice, setRecordsChoice] = useState<boolean>();
  const trainingDays = draft.trainingDays ?? loggedTrainingDays;
  const { profile, weightKg } = readBodyInputs(body.rows, today);
  const age = ageOn(profile, today);
  const bodyFat = readBodyFat(body.rows, today);
  const complete = Boolean(profile?.heightCm && age && profile.sex && weightKg);
  const input = complete && draft.goal && draft.activity && nutritionGoalInput.safeParse({
    heightCm: profile?.heightCm, age, sex: profile?.sex, weightKg, goal: draft.goal, activity: draft.activity,
    trainingDays, pace: draft.pace,
    bodyFatPercent: bodyFat?.percent,
  });
  const formula = input && input.success ? estimateNutritionGoal(input.data) : undefined;
  const weights: WeightReading[] = body.rows.flatMap((row) =>
    row.kind === "nutrition" && row.entry.type === "weight" ? [{ date: row.date, kg: row.entry.kg }] : []);
  const calibration = formula && intake
    ? calibrateMaintenance({ through: today, intake, weights, formulaCalories: formula.maintenanceCalories, restingCalories: formula.restingCalories })
    : undefined;
  const useRecords = recordsChoice ?? (calibration?.ready ? calibration.confidence !== "low" : false);
  const estimate = input && input.success && calibration?.ready && useRecords
    ? estimateNutritionGoal({ ...input.data, measuredMaintenance: calibration.calories }) ?? formula : formula;
  const paces = draft.goal === "lose" || draft.goal === "gain" ? goalEstimateRules.paceShares[draft.goal] : undefined;
  const minLossKg = goalEstimateRules.minLossBmi * ((profile?.heightCm ?? 0) / 100) ** 2;

  return <section className="nutrition-goal-estimator feature-stack" aria-label="按身体数据计算">
    <div className="nutrition-estimate-card">
      <div className="nutrition-estimate-card-header">
        <h4><Scale size={16} aria-hidden="true" /> 身体档案</h4>
        {complete && !body.error && <button type="button" className="text-button" onClick={onBody}>查看档案 <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      {body.loading ? <p className="nutrition-estimate-caption" role="status">正在读取身体数据…</p> : body.error
        ? <div className="nutrition-estimate-card-header"><p className="nutrition-estimate-caption" role="status">身体数据读取失败。</p>
          <button type="button" className="button outline small" onClick={() => void body.load()}>重试</button></div>
        : complete ? <dl className="nutrition-estimate-profile">
          <div><dt>身高</dt><dd>{profile?.heightCm} <small>cm</small></dd></div>
          <div><dt>体重</dt><dd>{weightKg === undefined ? "—" : kilograms(weightKg)} <small>kg</small></dd></div>
          <div><dt>年龄</dt><dd>{age} <small>岁</small></dd></div>
          {bodyFat && <div><dt>体脂</dt><dd>{displayNumber(bodyFat.percent)}<small>%</small></dd></div>}
        </dl> : <>
          <p className="nutrition-estimate-caption">填写身高、年龄和性别，并记录体重后即可估算。</p>
          <button type="button" className="button outline small" onClick={onBody}>补充身体档案 <ArrowRight size={14} aria-hidden="true" /></button>
        </>}
    </div>
    <div className="nutrition-estimate-card">
      <h4>目标与活动</h4>
      <div className="nutrition-estimate-fields form-fields">
        <label>目标方向<select value={draft.goal} required={Boolean(draft.activity)} onChange={(event) => onChange({ ...draft, goal: event.target.value as NutritionGoalDraft["goal"] })}>
          <option value="">选择目标</option>
          {Object.entries(nutritionGoalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {/* Saved activity from the earlier estimator can stay empty while the legacy preference is unchanged. */}
        <label>日常活动<select value={draft.activity} required={Boolean(draft.goal) && !draft.reviewActivity} aria-describedby={activityHelp} onChange={(event) =>
          onChange({ ...draft, activity: event.target.value as NutritionGoalDraft["activity"], trainingDays, reviewActivity: false })}>
          <option value="">选择活动量</option>
          {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>每周训练<select value={trainingDays} onChange={(event) => onChange({ ...draft, trainingDays: Number(event.target.value) })}>
          {Array.from({ length: 8 }, (_, days) => <option key={days} value={days}>{days ? `${days} 天` : "不训练"}</option>)}
        </select></label>
        {paces && <label>进度<select value={draft.pace} onChange={(event) => onChange({ ...draft, pace: event.target.value as NutritionPace })}>
          {Object.entries(paces).map(([value, amount]) => <option key={value} value={value}>
            {paceNames[value as NutritionPace]} · 每天{draft.goal === "lose" ? "少吃" : "多吃"}约 {share(amount)}</option>)}
        </select></label>}
      </div>
      <p id={activityHelp} className="nutrition-estimate-caption" role={draft.reviewActivity ? "status" : undefined}>
        {draft.reviewActivity && !draft.activity ? "日常活动现在只计算平时走动，请重新选择。训练消耗按每周训练天数估算。" : "日常活动只算平时走动，训练按每周天数另计。"}
      </p>
      {draft.goal === "recompose" && <div className="nutrition-estimate-fields form-fields">
        <label>体重下限（kg，可选）<input type="number" inputMode="decimal" step="any" min={10} max={draft.maxKg || 700}
          value={draft.minKg} required={Boolean(draft.maxKg)} onChange={(event) => onChange({ ...draft, minKg: event.target.value })} /></label>
        <label>体重上限（kg，可选）<input type="number" inputMode="decimal" step="any" min={draft.minKg || 10} max={700}
          value={draft.maxKg} required={Boolean(draft.minKg)} onChange={(event) => onChange({ ...draft, maxKg: event.target.value })} /></label>
      </div>}
      {input && !estimate && <p className="nutrition-estimate-caption" role="status">{input.success ? "当前档案不适合此目标，请选择其他目标。" : "当前资料超出成人估算范围，请核对身体档案。"}</p>}
    </div>
    {calibration && <div className="nutrition-estimate-card nutrition-estimate-calibration">
      {calibration.ready && <label className="nutrition-goal-records">
        <input type="checkbox" checked={useRecords} onChange={(event) => setRecordsChoice(event.target.checked)} />
        <span>按近 {calibrationRules.windowDays / 7} 周记录校准<small className="nutrition-estimate-caption">可信度{confidenceNames[calibration.confidence]} · {displayNumber(calibration.measuredCalories)} 千卡／日</small></span>
      </label>}
      <details>
        <summary>{calibration.ready ? "查看校准依据" : "记录校准条件"}<ChevronDown size={15} aria-hidden="true" /></summary>
        <p className="nutrition-estimate-caption">{recordsText(calibration)}</p>
      </details>
    </div>}
    {estimate && <div className="nutrition-estimate-card nutrition-estimate-result" role="group" aria-label="估算预览">
      <div className="nutrition-estimate-energy">
        <div><span>建议每日热量</span><p><strong>{displayNumber(estimate.values.calories)}</strong> 千卡</p></div>
        <Flame size={24} aria-hidden="true" />
      </div>
      <dl className="nutrition-estimate-macros">{nutrients.map(({ id, name }) => <div key={id} data-nutrient={id}>
        <dt>{name}</dt><dd>{displayNumber(estimate.values[id])} <small>g</small></dd>
      </div>)}</dl>
      <details>
        <summary>查看计算依据<ChevronDown size={15} aria-hidden="true" /></summary>
        <p className="nutrition-estimate-caption">{estimateText(estimate, arrivalText(estimate, weightKg, targetWeightKg, minLossKg),
          trainingDays > 0 || estimate.maintenanceSource === "records")}</p>
      </details>
      {estimate.notes.length > 0 && <ul className="nutrition-estimate-notes">{estimate.notes.map((note) =>
        <li key={note}>{noteText(note, estimate, draft)}</li>)}</ul>}
      <p className="nutrition-estimate-caption">估算适用于健康成年人。孕期、哺乳期或有疾病时请遵医嘱。</p>
      <button type="button" className="button primary nutrition-estimate-apply" onClick={() => {
        onChange({ ...draft, trainingDays });
        onApply({ ...estimate.values, water });
      }}>填入目标 <ArrowRight size={16} aria-hidden="true" /></button>
    </div>}
  </section>;
}
