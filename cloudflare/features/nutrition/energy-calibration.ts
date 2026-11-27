export type IntakeDay = { date: string; calories: number };
export type WeightReading = { date: string; kg: number };
export type CalibrationConfidence = "low" | "medium" | "high";
/**
 * Counts of what the calibration could use: complete food days, days with a weigh-in, the days between the first and last
 * of those, the days at the start of a new or resumed food log that were left out, and the days logged far under the usual
 * amount.
 */
export type EnergyCalibration = { loggedDays: number; weighIns: number; spanDays: number; skippedDays: number; lowDays: number } & ({
  ready: false;
  /**
   * Why there is no result: too few records, too many days logged far under the usual amount to tell light days from
   * unfinished logs, or a result that cannot be right.
   */
  reason: "records" | "lowDays" | "implausible";
} | {
  ready: true;
  /** Mean intake between the first and the last weigh-in: the complete days, with the low days counted half-way. */
  averageIntake: number;
  /** Slope of the weight trend, negative for loss. */
  weeklyChangeKg: number;
  /** Intake minus the energy of the weight change, before blending with the formula. */
  measuredCalories: number;
  /** Standard error of the measured value, in kilocalories a day. */
  measuredError: number;
  /** Maintenance energy to plan with: the measured value weighted against the formula by the error of both. */
  calories: number;
  confidence: CalibrationConfidence;
  /** The edge of the allowed range the blended value was moved to. At the low edge food is probably missing from the log. */
  limit: "inside" | "low" | "high";
  /** Eating changed clearly during the records, so part of the weight change may be water and the error is wider. */
  intakeShift: boolean;
});

/** Constants of the calibration. The iPhone port in NativeNutritionGoalModel.swift must carry the same numbers. */
export const calibrationRules = {
  /** Days before the reference day that are read. */
  windowDays: 28,
  /** Days with a weigh-in that are needed, and the days between the first and the last of them. */
  minWeighIns: 8,
  minSpanDays: 14,
  /** Complete food days needed between the first and the last weigh-in, and their share of those days. */
  minLoggedDays: 10,
  minLoggedShare: 0.6,
  /** A logged day under this share of the median day, or under the fixed minimum, counts as incomplete. */
  incompleteShare: 0.5,
  minDayCalories: 600,
  /** A logged day over this multiple of the median day is treated as a typing error. */
  maxDayMultiple: 4,
  /**
   * A day under the incomplete limit is either an unfinished log or a real light day, and the log cannot say which. Such days
   * count half-way between the two readings, with the other half as error. Above this share of the logged days there is no result.
   */
  maxLowDayShare: 0.25,
  /**
   * `gapDays` or more days in a row with nothing logged split the food log into stretches, and only one stretch is fitted.
   * A stretch that begins more than `graceDays` into the days that were read is a new start: starting to log usually comes
   * with a change of diet, and body water takes about a week to settle after one, so its first `settleDays` are not fitted.
   */
  logStart: { graceDays: 2, settleDays: 7, gapDays: 5 },
  /** A weigh-in further from the median than both of these is treated as a typing error or someone else on the scale. */
  weightOutlier: { kg: 3, share: 0.04 },
  energyPerKg: 7700,
  /** How far the energy of a kilogram of weight change can be from that figure, as a share of it. */
  energySpread: { loss: 0.2, gain: 0.35 },
  /** Day-to-day scatter assumed for body weight when the readings happen to line up better than that. */
  minWeightNoiseKg: 0.3,
  /** Water shifts last several days, so the trend is less certain than independent readings would suggest. */
  slopeErrorFactor: 1.5,
  /**
   * A change of diet: average intake before and after some day differs by at least this many kilocalories, this clearly
   * (t statistic), with at least this many complete days on each side.
   */
  intakeShift: { calories: 250, t: 3.5, minDays: 4 },
  /** Body water that moves with a change of diet, in kilograms, and how far a step in weight can tilt a fitted line (1.5 × step ÷ span). */
  waterShiftKg: 1,
  stepSlopeFactor: 1.5,
  /** Spread of a formula estimate around a person's real maintenance energy, as a share of the estimate. */
  formulaSpread: 0.15,
  /** The planning value stays within this share of the formula estimate and above this multiple of resting energy. */
  maxShift: 0.25,
  minRestingMultiple: 1.2,
  /** Largest error of the measured value, in kilocalories a day, for each confidence level. */
  confidence: { high: 150, medium: 250 },
} as const;

/**
 * Days of food records before the reference day that the calibration needs: the window, and enough before it to tell a log
 * that had already begun from one that starts inside the window.
 */
export const calibrationFoodDays = calibrationRules.windowDays + calibrationRules.logStart.settleDays + calibrationRules.logStart.graceDays;

/** Days since 1970-01-01 for a `yyyy-MM-dd` day, or NaN when the text is not one. Same arithmetic as the iPhone port. */
export function dayNumber(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return NaN;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return NaN;
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}
const square = (value: number) => value * value;
const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);
const median = (sorted: readonly number[]) =>
  sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : 0;
/** Rounds half away from zero, as Swift does, and never returns negative zero. */
const rounded = (value: number, scale = 1) => (Math.sign(value) * Math.round(Math.abs(value) * scale) / scale) || 0;

/**
 * Estimates maintenance energy from what was eaten and how body weight moved between the first and the last weigh-in:
 * maintenance = average intake − weight slope × energy per kilogram.
 * The result is weighted against the formula estimate by the statistical error of both.
 */
export function calibrateMaintenance({ through, intake, weights, formulaCalories, restingCalories }: {
  through: string; intake: readonly IntakeDay[]; weights: readonly WeightReading[]; formulaCalories: number; restingCalories: number;
}): EnergyCalibration {
  const rules = calibrationRules;
  const last = dayNumber(through);
  if (!Number.isInteger(last)) return { ready: false, reason: "records", loggedDays: 0, weighIns: 0, spanDays: 0, skippedDays: 0, lowDays: 0 };
  const first = last - rules.windowDays;
  const earliest = last - calibrationFoodDays;

  // One reading a day: the average of that day's weigh-ins.
  const readings = new Map<number, { sum: number; count: number }>();
  for (const { date, kg } of weights) {
    const day = dayNumber(date);
    if (!Number.isInteger(day) || !(day >= first && day <= last) || !Number.isFinite(kg) || kg <= 0) continue;
    const entry = readings.get(day) ?? { sum: 0, count: 0 };
    readings.set(day, { sum: entry.sum + kg, count: entry.count + 1 });
  }
  const daily = [...readings].map(([day, { sum, count }]) => ({ day, kg: sum / count })).sort((a, b) => a.day - b.day);
  const usualKg = median(daily.map(({ kg }) => kg).sort((a, b) => a - b));
  const accepted = daily.filter(({ kg }) => Math.abs(kg - usualKg) <= Math.max(rules.weightOutlier.kg, usualKg * rules.weightOutlier.share));

  // What was logged on each day before the reference day, in day order.
  const eaten = new Map<number, number>();
  for (const { date, calories } of intake) {
    const day = dayNumber(date);
    if (!Number.isInteger(day) || !(day >= earliest && day < last) || !Number.isFinite(calories) || calories <= 0) continue;
    eaten.set(day, (eaten.get(day) ?? 0) + calories);
  }
  const foodDays = [...eaten].map(([day, calories]) => ({ day, calories })).sort((a, b) => a.day - b.day);
  // Food days from one weigh-in day up to another. A morning weigh-in reflects what was eaten up to the day before, so the
  // last day itself is left out.
  const foodBetween = (start: number, end: number) => {
    const days = foodDays.filter(({ day }) => day >= start && day < end);
    const usual = median(days.map(({ calories }) => calories).sort((a, b) => a - b));
    const lowest = Math.max(rules.minDayCalories, usual * rules.incompleteShare);
    return {
      complete: days.filter(({ calories }) => calories >= lowest && calories <= usual * rules.maxDayMultiple),
      low: days.filter(({ calories }) => calories < lowest).map(({ calories }) => calories),
    };
  };
  // Stretches of the food log. Weight that moved while nothing was logged says nothing about the logged intake, and one
  // logged day on the far side of a break must not pull the break into the fit.
  const stretches: { from: number; to: number }[] = [];
  for (const { day } of foodDays) {
    const current = stretches[stretches.length - 1];
    if (current && day - current.to <= rules.logStart.gapDays) current.to = day;
    else stretches.push({ from: day, to: day });
  }

  const fit = (stretch?: { from: number; to: number }): EnergyCalibration => {
    // The trend only uses weigh-ins from the stretch, up to the morning after its last day.
    let from = first;
    let to = last;
    let skippedDays = 0;
    if (stretch) {
      const settled = stretch.from > earliest + rules.logStart.graceDays ? stretch.from + rules.logStart.settleDays : first;
      if (settled > first) skippedDays = rules.logStart.settleDays;
      from = Math.max(first, settled);
      to = stretch.to + 1;
    }
    const points = accepted.filter(({ day }) => day >= from && day <= to);
    const start = points.length ? points[0].day : last;
    const end = points.length ? points[points.length - 1].day : last;
    const food = foodBetween(start, end);
    const spanDays = end - start;
    // In day order for the change of diet, in rising order for the sums.
    const series = food.complete.map(({ calories }) => calories);
    const complete = [...series].sort((a, b) => a - b);
    const lowDays = food.low.length;

    const counts = { loggedDays: complete.length, weighIns: points.length, spanDays, skippedDays, lowDays };
    if (points.length < rules.minWeighIns || spanDays < rules.minSpanDays || complete.length < rules.minLoggedDays
      || complete.length < spanDays * rules.minLoggedShare
      || !Number.isFinite(formulaCalories) || formulaCalories <= 0 || !Number.isFinite(restingCalories) || restingCalories <= 0) {
      return { ready: false, reason: "records", ...counts };
    }
    if (lowDays > (complete.length + lowDays) * rules.maxLowDayShare) return { ready: false, reason: "lowDays", ...counts };

    // Least-squares line through the weigh-ins.
    const n = points.length;
    const meanDay = total(points.map(({ day }) => day)) / n;
    const meanKg = total(points.map(({ kg }) => kg)) / n;
    const spread = total(points.map(({ day }) => square(day - meanDay)));
    const slope = total(points.map(({ day, kg }) => (day - meanDay) * (kg - meanKg))) / spread;
    const residual = total(points.map(({ day, kg }) => square(kg - meanKg - slope * (day - meanDay))));
    const noise = Math.max(rules.minWeightNoiseKg, Math.sqrt(residual / (n - 2)));
    const slopeError = rules.slopeErrorFactor * noise / Math.sqrt(spread);

    const days = complete.length;
    const completeIntake = total(complete) / days;
    // Unlogged days are the only sampling error in the mean, so it shrinks as the days between weigh-ins fill up.
    const intakeVariance = total(complete.map((calories) => square(calories - completeIntake))) / (days - 1) / days * (1 - days / spanDays);
    // If the low days are unfinished logs the mean of the complete days stands. If they are real light days the mean of all
    // logged days does. The value used lies half-way and the other half is error.
    const lowShift = lowDays ? lowDays / (days + lowDays) * (completeIntake - total(food.low) / lowDays) / 2 : 0;
    const averageIntake = completeIntake - lowShift;
    const measured = averageIntake - slope * rules.energyPerKg;

    // A change of diet inside the records moves body water, and a straight line reads that step as trend.
    let intakeShift = false;
    for (let split = rules.intakeShift.minDays; split <= days - rules.intakeShift.minDays && !intakeShift; split++) {
      const before = series.slice(0, split);
      const after = series.slice(split);
      const meanBefore = total(before) / before.length;
      const meanAfter = total(after) / after.length;
      const scatter = total(before.map((calories) => square(calories - meanBefore))) + total(after.map((calories) => square(calories - meanAfter)));
      const gap = Math.abs(meanBefore - meanAfter);
      const t = gap / Math.sqrt(scatter / (days - 2) * (1 / before.length + 1 / after.length));
      intakeShift = gap >= rules.intakeShift.calories && t > rules.intakeShift.t;
    }
    const waterEnergy = intakeShift ? rules.waterShiftKg * rules.stepSlopeFactor / spanDays * rules.energyPerKg : 0;

    const energySpread = slope < 0 ? rules.energySpread.loss : rules.energySpread.gain;
    const measuredVariance = square(slopeError * rules.energyPerKg) + intakeVariance + square(energySpread * rules.energyPerKg * slope)
      + square(waterEnergy) + square(lowShift);
    const measuredError = Math.sqrt(measuredVariance);
    // Precision weighting: the measured value counts for more as its error shrinks below the formula's.
    const formulaVariance = square(formulaCalories * rules.formulaSpread);
    const trust = formulaVariance / (formulaVariance + measuredVariance);
    const blended = formulaCalories + trust * (measured - formulaCalories);
    const lowest = Math.max(formulaCalories * (1 - rules.maxShift), restingCalories * rules.minRestingMultiple);
    const calories = Math.min(formulaCalories * (1 + rules.maxShift), Math.max(lowest, blended));
    // Eating nothing while holding weight is not a measurement. Neither is a value that is not a number.
    if (!(measured > 0) || !Number.isFinite(measuredError) || !Number.isFinite(calories)) return { ready: false, reason: "implausible", ...counts };

    return {
      ready: true, ...counts,
      averageIntake: rounded(averageIntake),
      weeklyChangeKg: rounded(slope * 7, 100),
      measuredCalories: rounded(measured),
      measuredError: rounded(measuredError),
      calories: rounded(calories),
      confidence: measuredError <= rules.confidence.high ? "high" : measuredError <= rules.confidence.medium ? "medium" : "low",
      limit: calories === blended ? "inside" : blended < calories ? "low" : "high",
      intakeShift,
    };
  };

  if (!stretches.length) return fit();
  const newest = fit(stretches[stretches.length - 1]);
  // An earlier stretch is used when the newest one gives no result. Without any result the newest one's counts are shown.
  for (let index = stretches.length - 2; index >= 0 && !newest.ready; index--) {
    const earlier = fit(stretches[index]);
    if (earlier.ready) return earlier;
  }
  return newest;
}
