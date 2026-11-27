import { z } from "zod";
import { dayNumber } from "@/features/nutrition/energy-calibration";
import type { NutritionValues } from "@/features/library/model";

export const nutritionGoal = z.enum(["maintain", "recompose", "gain", "lose"]);
export const nutritionActivity = z.enum(["sedentary", "light", "moderate", "high"]);
export const nutritionPace = z.enum(["slow", "standard", "fast"]);
/** Body-fat readings outside this range are treated as measurement errors and ignored. */
export const bodyFatRange = { min: 3, max: 60 } as const;
export const measuredMaintenanceRange = { min: 800, max: 8000 } as const;
/** Training days in a week, counted apart from everyday activity. */
export const nutritionTrainingDays = z.number().int().min(0).max(7);
export const nutritionGoalInput = z.object({
  age: z.number().int().min(18).max(120),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(10).max(700),
  activity: nutritionActivity,
  trainingDays: nutritionTrainingDays.optional(),
  goal: nutritionGoal,
  pace: nutritionPace.optional(),
  bodyFatPercent: z.number().min(bodyFatRange.min).max(bodyFatRange.max).optional(),
  measuredMaintenance: z.number().min(measuredMaintenanceRange.min).max(measuredMaintenanceRange.max).optional(),
});

export type NutritionGoal = z.infer<typeof nutritionGoal>;
export type NutritionActivity = z.infer<typeof nutritionActivity>;
export type NutritionPace = z.infer<typeof nutritionPace>;
export type NutritionGoalInput = z.infer<typeof nutritionGoalInput>;
export type NutritionGoalNote = "recordsTooLow" | "paceLimited" | "nearUnderweight" | "calorieFloor" | "belowFloor"
  | "proteinLimited" | "lowCarbs" | "largeDeficit";
export type NutritionGoalEstimate = {
  restingCalories: number;
  restingMethod: "mifflin" | "leanMass";
  maintenanceCalories: number;
  maintenanceSource: "activity" | "records";
  /** Daily change from maintenance, negative for a deficit. */
  adjustmentCalories: number;
  /** Expected body weight change per week at this intake, negative for loss. */
  weeklyChangeKg: number;
  values: NutritionValues;
  notes: NutritionGoalNote[];
};

/** Constants of the estimate. The iPhone port in NativeNutritionGoalModel.swift must carry the same numbers. */
export const goalEstimateRules = {
  /** Physical activity level of everyday life without training, applied to resting energy. */
  activityFactors: { sedentary: 1.5, light: 1.6, moderate: 1.7, high: 1.9 },
  /** One training day replaces this many hours of an average day with work at this intensity (MET). */
  training: { met: 3.5, hours: 1 },
  /**
   * With a body-fat reading, resting energy moves from Mifflin–St Jeor toward the fat-free-mass equation as training days rise
   * and reaches it at this many days a week. The athletes that equation was checked on trained 5.0 ± 1.8 times a week.
   */
  leanMassTrainingDays: 5,
  /** The fat-free-mass result stays between the Mifflin–St Jeor value and this multiple of it. */
  leanMassCeiling: 1.25,
  /** Share of maintenance energy removed or added each day, by goal and pace. */
  paceShares: {
    lose: { slow: 0.1, standard: 0.2, fast: 0.25 },
    gain: { slow: 0.05, standard: 0.1, fast: 0.15 },
  },
  /** Loss is held to this share of body weight per week. */
  maxWeeklyLossShare: 0.01,
  /** No loss is planned at or under this BMI, and above it the deficit may not reach the weight at this BMI within this many weeks. */
  minLossBmi: 18.5,
  lowWeightWeeks: 8,
  /** Gain is held to this share of body weight per week. */
  maxWeeklyGainShare: 0.005,
  /** Largest daily deficit and surplus in kilocalories, whatever the body weight. */
  maxDailyDeficit: 1000,
  maxDailySurplus: 500,
  /** For people who train, a daily deficit above this is flagged: lean mass stops growing around it (Murphy & Koehler 2021). */
  muscleGainDeficit: 500,
  /** Energy of one kilogram of body weight change, for short planning horizons. */
  energyPerKg: 7700,
  /** A deficit never takes the daily intake under this. Maintenance measured from records under it is not used. */
  calorieFloor: { male: 1500, female: 1200 },
  /** Protein in grams per kilogram of reference weight. */
  proteinPerKg: { maintain: 1.6, recompose: 2, gain: 1.8, lose: 2.2 },
  /** Protein is kept within these shares of energy. */
  proteinShare: { min: 0.1, max: 0.35 },
  /** Fat share of energy, its floor per kilogram of reference weight, and its ceiling share. */
  fat: { share: 0.25, minPerKg: 0.5, maxShare: 0.35 },
  /** Above this BMI, protein and the fat floor use the weight at this BMI plus this share of the weight above it. */
  referenceBmi: 25,
  excessWeightShare: 0.25,
  /** With a body-fat reading, the reference weight is at least the weight this person would have at this body-fat share. */
  referenceBodyFat: 0.2,
  lowCarbGrams: 130,
  roundCalories: 25,
} as const;

export function estimateNutritionGoal(input: NutritionGoalInput, water = 0): NutritionGoalEstimate | undefined {
  const parsed = nutritionGoalInput.safeParse(input);
  if (!parsed.success || !Number.isFinite(water) || water < 0 || water > 20000) return;
  const { age, sex, heightCm, weightKg, activity, goal, bodyFatPercent, measuredMaintenance } = parsed.data;
  const pace = parsed.data.pace ?? "standard";
  const trainingDays = parsed.data.trainingDays ?? 0;
  const rules = goalEstimateRules;
  const meters = heightCm / 100;
  const squareMeters = meters * meters;
  // Kilograms above the weight at the lowest BMI a loss is planned for.
  const spareKg = weightKg - rules.minLossBmi * squareMeters;
  if (goal === "lose" && spareKg <= 0) return;

  // Resting energy: Mifflin–St Jeor. With a body-fat reading it moves toward Cunningham (1980) on fat-free mass as
  // training days rise, because Mifflin–St Jeor underestimates lean trained adults. It never lowers the estimate.
  const mifflin = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  if (mifflin <= 0) return;
  const uplift = bodyFatPercent === undefined ? 0
    : Math.max(0, Math.min(500 + 22 * weightKg * (1 - bodyFatPercent / 100), mifflin * rules.leanMassCeiling) - mifflin);
  const resting = mifflin + Math.min(1, trainingDays / rules.leanMassTrainingDays) * uplift;
  // Everyday activity sets the base level. Training hours replace average hours at the training intensity.
  const base = rules.activityFactors[activity];
  const level = base + (rules.training.met - base) * trainingDays * rules.training.hours / 168;
  const notes: NutritionGoalNote[] = [];
  // Records that put maintenance under the lowest intake and under the formula more likely miss food than show a real
  // value, so the formula, the higher of the two, is used.
  const sexFloor = rules.calorieFloor[sex];
  const formula = resting * level;
  const usesRecords = measuredMaintenance !== undefined && measuredMaintenance >= Math.min(sexFloor, formula);
  if (measuredMaintenance !== undefined && !usesRecords) notes.push("recordsTooLow");
  const maintenance = usesRecords ? measuredMaintenance : formula;
  const step = rules.roundCalories;

  let change = 0;
  let paceNote: NutritionGoalNote | undefined;
  // The lowest target that keeps the low-weight limit, so that rounding never makes the loss faster than that.
  let gentlest = 0;
  if (goal === "lose") {
    const wanted = maintenance * rules.paceShares.lose[pace];
    const usual = Math.min(weightKg * rules.maxWeeklyLossShare * rules.energyPerKg / 7, rules.maxDailyDeficit);
    const spare = spareKg / rules.lowWeightWeeks * rules.energyPerKg / 7;
    const limit = Math.min(usual, spare);
    if (wanted > limit) paceNote = spare < usual ? "nearUnderweight" : "paceLimited";
    change = -Math.min(wanted, limit);
    gentlest = Math.ceil((maintenance - spare) / step) * step;
  } else if (goal === "gain") {
    const wanted = maintenance * rules.paceShares.gain[pace];
    const limit = Math.min(weightKg * rules.maxWeeklyGainShare * rules.energyPerKg / 7, rules.maxDailySurplus);
    if (wanted > limit) paceNote = "paceLimited";
    change = Math.min(wanted, limit);
  }
  const maintained = Math.round(maintenance / step) * step;
  let calories = Math.max(Math.round((maintenance + change) / step) * step, Math.min(maintained, gentlest));
  // A deficit never takes intake under the floor. When maintenance itself is lower, no deficit is applied and the note says so.
  const lowest = Math.min(sexFloor, maintained);
  const raised = calories < lowest;
  if (raised) calories = lowest;
  // Raised all the way to maintenance there is no pace left to explain.
  if (paceNote && !(raised && lowest === maintained)) notes.push(paceNote);
  if (raised && lowest === sexFloor) notes.push("calorieFloor");
  if (calories < sexFloor) notes.push("belowFloor");
  if (calories < 800 || calories > 20000) return;

  // Protein and the fat floor scale with body weight. Above BMI 25 they use an adjusted weight, because the extra weight is mostly fat.
  // A body-fat reading can raise it again, up to the real weight: a muscular person above BMI 25 is not carrying that fat.
  const thresholdKg = rules.referenceBmi * squareMeters;
  const adjustedKg = thresholdKg + rules.excessWeightShare * (weightKg - thresholdKg);
  const leanKg = bodyFatPercent === undefined ? 0 : weightKg * (1 - bodyFatPercent / 100) / (1 - rules.referenceBodyFat);
  const referenceKg = weightKg <= thresholdKg ? weightKg : Math.min(weightKg, Math.max(adjustedKg, leanKg));
  const proteinWanted = Math.round(referenceKg * rules.proteinPerKg[goal]);
  const proteinMax = Math.floor(calories * rules.proteinShare.max / 4);
  const protein = Math.max(Math.ceil(calories * rules.proteinShare.min / 4), Math.min(proteinWanted, proteinMax));
  if (proteinWanted > proteinMax) notes.push("proteinLimited");
  const fat = Math.min(Math.floor(calories * rules.fat.maxShare / 9),
    Math.max(Math.round(calories * rules.fat.share / 9), Math.round(referenceKg * rules.fat.minPerKg)));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  if (carbs < rules.lowCarbGrams) notes.push("lowCarbs");

  // A difference smaller than the rounding step is rounding, not a deficit or a surplus.
  const difference = calories - Math.round(maintenance);
  const adjustment = Math.abs(difference) < step ? 0 : difference;
  if (trainingDays > 0 && -adjustment > rules.muscleGainDeficit) notes.push("largeDeficit");
  return {
    restingCalories: Math.round(resting),
    restingMethod: resting > mifflin ? "leanMass" : "mifflin",
    maintenanceCalories: Math.round(maintenance),
    maintenanceSource: usesRecords ? "records" : "activity",
    adjustmentCalories: adjustment,
    weeklyChangeKg: (Math.sign(adjustment) * Math.round(Math.abs(adjustment) * 7 / rules.energyPerKg * 100) / 100) || 0,
    values: { calories, protein, carbs, fat, water },
    notes,
  };
}

/** Training days per week over the four weeks up to `today`, from the dates of completed workouts. */
export function weeklyTrainingDays(dates: readonly string[], today: string) {
  const last = dayNumber(today);
  if (!Number.isInteger(last)) return 0;
  // Text that is not a calendar day has no day number and is left out.
  const days = new Set(dates.map(dayNumber).filter((day) => day > last - 28 && day <= last));
  return Math.min(7, Math.round(days.size / 4));
}
