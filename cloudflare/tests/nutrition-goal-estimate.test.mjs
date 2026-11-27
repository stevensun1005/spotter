import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith("@/") ? new URL(specifier.slice(2) + ".ts", root).href : specifier, context);
} });
const { estimateNutritionGoal, goalEstimateRules, weeklyTrainingDays } = await import("../features/nutrition/goal-estimate.ts");
const { calibrateMaintenance, calibrationFoodDays, calibrationRules, dayNumber } = await import("../features/nutrition/energy-calibration.ts");
const { ageOn, readBodyFat, readBodyInputs } = await import("../features/body/profile.ts");

// The same cases run against the iPhone port in ios/Tests/NativeNutritionGoalSmoke.swift.
// After an intended rule change, rewrite the expected values with
// UPDATE_NUTRITION_GOAL_CASES=1 node --test tests/nutrition-goal-estimate.test.mjs and port the change to Swift.
const casesFile = new URL("nutrition-goal-cases.json", import.meta.url);
const cases = JSON.parse(readFileSync(casesFile, "utf8"));
const results = {
  estimates: (item) => estimateNutritionGoal(item.input) ?? null,
  calibrations: (item) => calibrateMaintenance(item),
  trainingDays: (item) => weeklyTrainingDays(item.dates, item.today),
  ages: (item) => ageOn({ age: item.age, ageAsOf: item.ageAsOf || undefined }, item.day),
  dates: (item) => Number.isNaN(dayNumber(item.date)) ? null : dayNumber(item.date),
};
if (process.env.UPDATE_NUTRITION_GOAL_CASES) {
  for (const [group, run] of Object.entries(results)) for (const item of cases[group]) item.expected = run(item);
  const groups = Object.entries(cases).map(([group, items]) =>
    ` ${JSON.stringify(group)}: [\n${items.map((item) => "  " + JSON.stringify(item)).join(",\n")}\n ]`);
  writeFileSync(casesFile, `{\n${groups.join(",\n")}\n}\n`);
}

const profile = { age: 35, sex: "female", heightCm: 168, weightKg: 66, activity: "moderate", goal: "maintain" };
const man = { age: 30, sex: "male", heightCm: 180, weightKg: 80, activity: "light", trainingDays: 4, goal: "maintain" };

test("shared cases match the recorded results", () => {
  for (const [group, run] of Object.entries(results)) {
    assert.ok(cases[group].length > 0);
    for (const item of cases[group]) assert.deepEqual(run(item), item.expected, `${group}: ${item.name}`);
  }
});

test("maintenance follows Mifflin–St Jeor, everyday activity and training days, and keeps the water goal", () => {
  // 10 × 66 + 6.25 × 168 − 5 × 35 − 161 = 1374, and 1374 × 1.7 = 2335.8. Protein 66 × 1.6, fat a quarter of the energy.
  assert.deepEqual(estimateNutritionGoal(profile, 1550), {
    restingCalories: 1374, restingMethod: "mifflin", maintenanceCalories: 2336, maintenanceSource: "activity",
    adjustmentCalories: 0, weeklyChangeKg: 0,
    values: { calories: 2325, protein: 106, carbs: 329, fat: 65, water: 1550 }, notes: [],
  });
  // 10 × 80 + 6.25 × 180 − 5 × 30 + 5 = 1780. Four training hours lift 1.6 by (3.5 − 1.6) × 4 ÷ 168.
  const trained = estimateNutritionGoal(man);
  assert.equal(trained.restingCalories, 1780);
  assert.equal(trained.maintenanceCalories, Math.round(1780 * (1.6 + 1.9 * 4 / 168)));
  assert.equal(trained.maintenanceCalories, 2929);
  assert.ok(estimateNutritionGoal({ ...profile, age: 45 }).values.calories < 2325);
  assert.ok(estimateNutritionGoal({ ...profile, sex: "male" }).values.calories > 2325);
  assert.ok(estimateNutritionGoal({ ...profile, heightCm: 180, weightKg: 74 }).values.calories > 2325);
  assert.ok(estimateNutritionGoal({ ...profile, activity: "light" }).values.calories < 2325);
  assert.ok(estimateNutritionGoal({ ...profile, activity: "high" }).values.calories > 2325);
  let previous = 0;
  for (let trainingDays = 0; trainingDays <= 7; trainingDays++) {
    const { maintenanceCalories } = estimateNutritionGoal({ ...profile, trainingDays });
    assert.ok(maintenanceCalories > previous);
    previous = maintenanceCalories;
  }
});

test("resting energy moves toward the fat-free-mass equation as people with a body-fat reading train more", () => {
  const lean = { ...man, weightKg: 82, heightCm: 178, age: 28, bodyFatPercent: 12 };
  const resting = (trainingDays) => {
    const { restingCalories, restingMethod } = estimateNutritionGoal({ ...lean, trainingDays });
    return [restingCalories, restingMethod];
  };
  // Mifflin gives 1797.5 and 500 + 22 × 82 × 0.88 = 2087.52. Each training day up to five closes a fifth of the gap.
  assert.deepEqual(resting(0), [1798, "mifflin"]);
  assert.deepEqual(resting(2), [Math.round(1797.5 + 0.4 * 290.02), "leanMass"]);
  assert.deepEqual(resting(4), [2030, "leanMass"]);
  assert.deepEqual(resting(5), [2088, "leanMass"]);
  assert.deepEqual(resting(7), [2088, "leanMass"]);
  assert.equal(estimateNutritionGoal({ ...lean, trainingDays: 5, bodyFatPercent: undefined }).restingMethod, "mifflin");
  // A reading that would put the result above 1.25 × Mifflin is held there, and one below Mifflin is not used.
  const heavy = estimateNutritionGoal({ ...man, trainingDays: 5, age: 60, heightCm: 175, weightKg: 95, bodyFatPercent: 10 });
  assert.equal(heavy.restingCalories, Math.round(1748.75 * 1.25));
  assert.equal(estimateNutritionGoal({ ...man, sex: "female", weightKg: 90, heightCm: 165, age: 40, bodyFatPercent: 50 }).restingMethod, "mifflin");
});

test("loss and gain follow the chosen pace inside the weekly and daily limits", () => {
  const maintenance = estimateNutritionGoal(man).maintenanceCalories;
  for (const [goal, shares] of Object.entries(goalEstimateRules.paceShares)) {
    for (const [pace, share] of Object.entries(shares)) {
      const estimate = estimateNutritionGoal({ ...man, goal, pace });
      const wanted = maintenance * (goal === "lose" ? 1 - share : 1 + share);
      assert.ok(Math.abs(estimate.values.calories - wanted) <= 13, `${goal} ${pace}`);
      assert.equal(estimate.adjustmentCalories, estimate.values.calories - maintenance);
      assert.equal(estimate.weeklyChangeKg, Math.round(estimate.adjustmentCalories * 7 / 7700 * 100) / 100);
      // The man trains, so a deficit above 500 kcal carries the note that muscle gain stalls there.
      assert.deepEqual(estimate.notes, -estimate.adjustmentCalories > goalEstimateRules.muscleGainDeficit ? ["largeDeficit"] : []);
    }
  }
  assert.deepEqual(estimateNutritionGoal({ ...man, goal: "lose", pace: "slow" }).notes, []);
  assert.deepEqual(estimateNutritionGoal({ ...man, goal: "lose", pace: "fast" }).notes, ["largeDeficit"]);
  assert.deepEqual(estimateNutritionGoal({ ...man, goal: "lose", pace: "fast", trainingDays: 0 }).notes, []);
  assert.equal(estimateNutritionGoal({ ...man, goal: "lose" }).values.calories, estimateNutritionGoal({ ...man, goal: "lose", pace: "standard" }).values.calories);
  // 52 kg × 0.5% × 7700 ÷ 7 = 286 kcal a day at most.
  const light = estimateNutritionGoal({ age: 24, sex: "female", heightCm: 160, weightKg: 52, activity: "high", trainingDays: 5, goal: "gain", pace: "fast" });
  assert.deepEqual(light.notes, ["paceLimited"]);
  assert.ok(Math.abs(light.adjustmentCalories - 286) <= 13);
  // 1% of 150 kg a week would be 1650 kcal a day. The daily cap of 1000 comes first.
  const heavy = estimateNutritionGoal({ age: 35, sex: "male", heightCm: 185, weightKg: 150, activity: "high", trainingDays: 2, goal: "lose", pace: "fast" });
  assert.ok(heavy.notes.includes("paceLimited"));
  assert.ok(Math.abs(heavy.adjustmentCalories + 1000) <= 13);
});

test("close to BMI 18.5 a loss is slowed so that weight is not reached within eight weeks", () => {
  // 170 cm: 53.465 kg at BMI 18.5. At 54 kg there is 0.535 kg to spare: 0.535 ÷ 8 × 7700 ÷ 7 = 74 kcal a day at most.
  const slim = { age: 25, sex: "female", heightCm: 170, weightKg: 54, activity: "light", goal: "lose" };
  const held = estimateNutritionGoal(slim);
  assert.deepEqual(held.notes, ["nearUnderweight"]);
  assert.ok(held.adjustmentCalories >= -75 - 13 && held.adjustmentCalories <= 0);
  // The limit grows with the distance, so there is no jump: every extra kilogram allows about 138 kcal more.
  let previous = 0;
  for (const weightKg of [53.6, 54, 55, 56, 57]) {
    const { maintenanceCalories, values } = estimateNutritionGoal({ ...slim, weightKg, pace: "fast" });
    const deficit = maintenanceCalories - values.calories;
    assert.ok(deficit >= previous && deficit - previous < 175, `${weightKg} kg`);
    // The target is rounded toward maintenance, so the 25 kcal step never makes the loss faster than the limit.
    assert.ok(deficit <= (weightKg - 18.5 * 1.7 * 1.7) / 8 * 7700 / 7 + 0.5, `${weightKg} kg`);
    previous = deficit;
  }
  // 0.535 kg to spare allows 73.6 kcal: 2309 − 73.6 = 2235.4 is rounded up to 2250, not down to 2225.
  assert.equal(estimateNutritionGoal({ ...slim, activity: "moderate", trainingDays: 5 }).values.calories, 2250);
  // A limit under the rounding step leaves no deficit. The note stays, so the person can see why.
  const edge = estimateNutritionGoal({ age: 20, sex: "male", heightCm: 180, weightKg: 60, activity: "light", trainingDays: 4, goal: "lose", pace: "fast" });
  assert.deepEqual([edge.adjustmentCalories, edge.notes], [0, ["nearUnderweight"]]);
  assert.equal(estimateNutritionGoal({ ...slim, weightKg: 53.4 }), undefined);
  assert.deepEqual(estimateNutritionGoal({ ...slim, weightKg: 62 }).notes, []);
  assert.equal(goalEstimateRules.lowWeightWeeks, 8);
});

test("the calorie floor, protein limit and low-carbohydrate note protect small intakes", () => {
  const small = estimateNutritionGoal({ age: 45, sex: "female", heightCm: 150, weightKg: 48, activity: "sedentary", goal: "lose", pace: "fast" });
  assert.equal(small.values.calories, goalEstimateRules.calorieFloor.female);
  assert.ok(small.notes.includes("calorieFloor") && !small.notes.includes("belowFloor"));
  // Records that put maintenance under the floor are not used: 1031.5 × 1.5 = 1547 from the formula, less a fifth.
  const low = estimateNutritionGoal({ age: 45, sex: "female", heightCm: 150, weightKg: 48, activity: "sedentary", goal: "lose", measuredMaintenance: 1110 });
  assert.deepEqual([low.values.calories, low.maintenanceCalories, low.maintenanceSource, low.notes[0]], [1250, 1547, "activity", "recordsTooLow"]);
  assert.equal(estimateNutritionGoal({ age: 45, sex: "female", heightCm: 150, weightKg: 48, activity: "sedentary", goal: "lose", measuredMaintenance: 1200 }).maintenanceSource, "records");
  // Maintenance itself under the floor: 745 × 1.5 = 1118. No deficit, the small difference is not shown as one, and the note says the number is low.
  const tiny = estimateNutritionGoal({ age: 80, sex: "female", heightCm: 145, weightKg: 40, activity: "sedentary", goal: "lose" });
  assert.deepEqual([tiny.values.calories, tiny.adjustmentCalories, tiny.weeklyChangeKg], [1125, 0, 0]);
  // The loss would also have been held near BMI 18.5, but with no deficit left there is no pace to explain.
  assert.deepEqual(tiny.notes, ["belowFloor", "lowCarbs"]);
  // Records under the floor are still used when they are above the formula: 699 × 1.5 = 1049 here.
  const frailer = { age: 85, sex: "female", heightCm: 145, weightKg: 38, activity: "sedentary", goal: "maintain" };
  assert.deepEqual([estimateNutritionGoal({ ...frailer, measuredMaintenance: 1100 }).maintenanceSource, estimateNutritionGoal({ ...frailer, measuredMaintenance: 1100 }).notes],
    ["records", ["belowFloor"]]);
  assert.deepEqual(estimateNutritionGoal({ ...frailer, measuredMaintenance: 1000 }).notes, ["recordsTooLow", "belowFloor"]);
  assert.ok(estimateNutritionGoal({ age: 80, sex: "female", heightCm: 145, weightKg: 40, activity: "sedentary", goal: "maintain" }).notes.includes("belowFloor"));
  const older = estimateNutritionGoal({ age: 70, sex: "female", heightCm: 155, weightKg: 65, activity: "sedentary", goal: "lose", pace: "fast" });
  assert.deepEqual(older.notes, ["proteinLimited", "lowCarbs"]);
  assert.equal(older.values.protein, Math.floor(older.values.calories * 0.35 / 4));
});

test("macros add up, and protein above BMI 25 uses adjusted weight", () => {
  for (const goal of ["maintain", "recompose", "gain", "lose"]) {
    const { calories, protein, carbs, fat } = estimateNutritionGoal({ ...man, goal }).values;
    assert.ok(Math.abs(protein * 4 + carbs * 4 + fat * 9 - calories) <= 2);
    assert.equal(protein, Math.round(80 * goalEstimateRules.proteinPerKg[goal]));
    assert.equal(fat, Math.round(calories * 0.25 / 9));
  }
  // 175 cm: 76.5625 kg at BMI 25, plus a quarter of the 33.4375 kg above it = 84.92 kg.
  const heavy = { age: 40, sex: "male", heightCm: 175, weightKg: 110, activity: "sedentary", goal: "lose" };
  assert.equal(estimateNutritionGoal(heavy).values.protein, Math.round(84.921875 * 2.2));
  // A body-fat reading lifts it to the weight at 20% body fat: 110 × 0.65 ÷ 0.8 = 89.375 kg. A high reading changes nothing.
  assert.equal(estimateNutritionGoal({ ...heavy, bodyFatPercent: 35 }).values.protein, Math.round(89.375 * 2.2));
  assert.equal(estimateNutritionGoal({ ...heavy, bodyFatPercent: 45 }).values.protein, Math.round(84.921875 * 2.2));
  // A muscular man above BMI 25: 95 × 0.88 ÷ 0.8 is more than he weighs, so his real weight counts.
  const muscular = estimateNutritionGoal({ age: 30, sex: "male", heightCm: 180, weightKg: 95, activity: "light", goal: "lose", bodyFatPercent: 12 });
  assert.equal(muscular.values.protein, Math.round(95 * 2.2));
});

test("incomplete data, minors, invalid values, and low-weight loss produce no estimate", () => {
  assert.equal(estimateNutritionGoal({ ...profile, heightCm: undefined }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, age: 17 }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, weightKg: Infinity }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, trainingDays: 2.5 }), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, measuredMaintenance: 500 }), undefined);
  assert.equal(estimateNutritionGoal(profile, -1), undefined);
  assert.equal(estimateNutritionGoal({ ...profile, weightKg: 49, goal: "lose" }), undefined);
  // 404 kcal at rest × 1.5 is under the 800 kcal the estimate will show.
  assert.equal(estimateNutritionGoal({ ...profile, age: 62, heightCm: 100, weightKg: 25, activity: "sedentary" }), undefined);
  // The equation gives −36 kcal at rest here. A body-fat reading does not rescue it.
  const frail = { ...profile, age: 120, heightCm: 100, weightKg: 10, activity: "high", trainingDays: 7, goal: "gain" };
  assert.equal(estimateNutritionGoal(frail), undefined);
  assert.equal(estimateNutritionGoal({ ...frail, bodyFatPercent: 3 }), undefined);
});

test("weekly training days come from the last four weeks of completed workouts", () => {
  assert.equal(weeklyTrainingDays(["2026-11-27", "2026-11-27", "2026-11-24", "2026-10-31", "2026-10-30", "2026-11-28"], "2026-11-27"), 1);
  assert.equal(weeklyTrainingDays(Array.from({ length: 28 }, (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`), "2026-11-28"), 7);
  assert.equal(weeklyTrainingDays([], "2026-11-27"), 0);
});

const through = "2026-11-27";
const dayBefore = (offset) => { const date = new Date(through + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() - offset); return date.toISOString().slice(0, 10); };
// Food logged on the nine days before the 28-day window, so that the log is an old one and not a new start.
const earlier = (calories) => Array.from({ length: 9 }, (_, index) => ({ date: dayBefore(29 + index), calories }));
const none = { skippedDays: 0, lowDays: 0 };

test("records give maintenance as intake minus the energy of the weight change", () => {
  // Exactly 2200 kcal a day while the scale falls 0.05 kg a day: 2200 + 0.05 × 7700 = 2585.
  const intake = [...earlier(2200), ...Array.from({ length: 28 }, (_, index) => ({ date: dayBefore(index + 1), calories: 2200 }))];
  const weights = Array.from({ length: 15 }, (_, index) => ({ date: dayBefore(index * 2), kg: 80 + index * 0.1 }));
  const result = calibrateMaintenance({ through, intake, weights, formulaCalories: 2585, restingCalories: 1700 });
  // Error: trend 1.5 × 0.3 kg ÷ √1120 × 7700 = 103.5, energy per kilogram 20% of 385 = 77, no unlogged days. √(103.5² + 77²) = 129.
  assert.deepEqual(result, { ready: true, loggedDays: 28, weighIns: 15, spanDays: 28, ...none,
    averageIntake: 2200, weeklyChangeKg: -0.35, measuredCalories: 2585, measuredError: 129, calories: 2585, confidence: "high",
    limit: "inside", intakeShift: false });
  // Away from the formula, the planning value sits between the two and nearer the better-measured one.
  const blended = calibrateMaintenance({ through, intake, weights, formulaCalories: 3000, restingCalories: 1700 });
  assert.ok(blended.ready && blended.limit === "inside" && blended.measuredCalories === 2585 && blended.calories > 2585 && blended.calories < 2700);
  // It never moves more than a quarter from the formula, and never under 1.2 × resting energy.
  const far = calibrateMaintenance({ through, intake, weights, formulaCalories: 1600, restingCalories: 1100 });
  assert.deepEqual([far.ready && far.calories, far.ready && far.limit], [2000, "high"]);
  const low = calibrateMaintenance({ through, intake: intake.map((item) => ({ ...item, calories: 1300 })), weights: weights.map((item) => ({ ...item, kg: 80 })),
    formulaCalories: 2400, restingCalories: 1700 });
  assert.deepEqual([low.ready && low.measuredCalories, low.ready && low.calories, low.ready && low.limit], [1300, 2040, "low"]);
  // A flat trend is zero, never negative zero.
  assert.ok(low.ready && Object.is(low.weeklyChangeKg, 0));
  // A gain is less certain per kilogram than a loss, and scattered weigh-ins lower the confidence.
  const gaining = calibrateMaintenance({ through, intake, weights: weights.map((item, index) => ({ ...item, kg: 80 - index * 0.1 })),
    formulaCalories: 1815, restingCalories: 1300 });
  assert.ok(gaining.ready && gaining.measuredCalories === 1815 && gaining.measuredError > 129);
  const noisy = calibrateMaintenance({ through, intake, weights: weights.map((item, index) => ({ ...item, kg: item.kg + (index % 2 ? 1.5 : -1.5) })),
    formulaCalories: 2585, restingCalories: 1700 });
  assert.equal(noisy.ready && noisy.confidence, "low");
});

test("calibration waits for enough weigh-ins and complete days between them", () => {
  const recent = Array.from({ length: 28 }, (_, index) => ({ date: dayBefore(index + 1), calories: 2200 }));
  const intake = [...earlier(2200), ...recent];
  const weights = Array.from({ length: 15 }, (_, index) => ({ date: dayBefore(index * 2), kg: 80 + index * 0.1 }));
  const call = (changes) => calibrateMaintenance({ through, intake, weights, formulaCalories: 2600, restingCalories: 1700, ...changes });
  assert.equal(call({}).ready, true);
  assert.deepEqual(call({ weights: weights.slice(0, calibrationRules.minWeighIns - 1) }), { ready: false, reason: "records", loggedDays: 12, weighIns: 7, spanDays: 12, ...none });
  // Eight weigh-ins 14 days apart are the least that is read: the 14 days of meals between them count.
  assert.deepEqual([call({ weights: weights.slice(0, 8) }).ready, call({ weights: weights.slice(0, 8) }).loggedDays], [true, 14]);
  // Every second day logged is under 60% of the days between the weigh-ins.
  assert.deepEqual(call({ intake: [...earlier(2200), ...recent.filter((_, index) => index % 2 === 0)] }),
    { ready: false, reason: "records", loggedDays: 14, weighIns: 15, spanDays: 28, ...none });
  assert.equal(call({ intake: [...earlier(2200), ...recent.filter((_, index) => index % 3 !== 2)] }).ready, true);
  assert.equal(call({ formulaCalories: 0 }).ready, false);
  assert.equal(call({ restingCalories: Number.NaN }).ready, false);
  assert.deepEqual(call({ through: "today" }), { ready: false, reason: "records", loggedDays: 0, weighIns: 0, spanDays: 0, ...none });
  // Today's meals are not read, and two weigh-ins on one day are one reading.
  assert.equal(call({ intake: [...intake, { date: through, calories: 9000 }] }).loggedDays, 28);
  assert.equal(call({ weights: [...weights, { date: through, kg: 80.4 }] }).weighIns, 15);
  // A reading far from the rest is a typing error and is left out.
  const typo = call({ weights: [...weights.slice(1), { date: through, kg: 180 }] });
  assert.deepEqual([typo.weighIns, typo.spanDays, typo.ready && typo.measuredCalories], [14, 26, 2585]);
});

test("only one unbroken stretch of the food log is fitted, without the first week of a new start", () => {
  const recent = Array.from({ length: 28 }, (_, index) => ({ date: dayBefore(index + 1), calories: 2200 }));
  const weights = Array.from({ length: 15 }, (_, index) => ({ date: dayBefore(index * 2), kg: 80 + index * 0.1 }));
  const call = (intake) => calibrateMaintenance({ through, intake, weights, formulaCalories: 2600, restingCalories: 1700 });
  const counts = (result) => [result.ready, result.loggedDays, result.weighIns, result.spanDays, result.skippedDays];
  // The food of the 37 days before today is read: the 28-day window and nine days before it.
  assert.equal(calibrationFoodDays, 37);
  // A log that already ran before the window counts in full. One that begins inside the days that were read is a new start:
  // its first week is not fitted, and neither are the weigh-ins before it.
  assert.deepEqual(counts(call([...earlier(2200), ...recent])), [true, 28, 15, 28, 0]);
  assert.deepEqual(counts(call(recent)), [true, 20, 11, 20, 7]);
  assert.deepEqual(counts(call(recent.slice(0, 24))), [true, 16, 9, 16, 7]);
  // One that began 16 days back has nine days left after that week, which is not enough yet.
  assert.deepEqual(counts(call(recent.slice(0, 16))), [false, 8, 5, 8, 7]);
  // 35 days back is within two days of the first day read, so the log may be older. 34 days back is a new start whose first week ends inside the window.
  const since = (days) => Array.from({ length: days }, (_, index) => ({ date: dayBefore(index + 1), calories: 2200 }));
  assert.deepEqual([call(since(35)).skippedDays, call(since(35)).spanDays], [0, 28]);
  assert.deepEqual([call(since(34)).skippedDays, call(since(34)).spanDays], [7, 26]);
  // Food logged before the days that are read changes nothing.
  assert.deepEqual(call([...since(34), { date: dayBefore(38), calories: 2200 }]), call(since(34)));

  // Four unlogged days in a row are a gap inside one stretch. Five split the log: here the days after the break are too few,
  // so the stretch before it is used, up to the weigh-in on the morning after its last day.
  const old = [...earlier(2200), ...recent];
  const without = (from, to) => old.filter(({ date }) => date < dayBefore(from) || date > dayBefore(to));
  assert.deepEqual(counts(call(without(12, 9))), [true, 24, 15, 28, 0]);
  assert.deepEqual(counts(call(without(13, 9))), [true, 14, 8, 14, 0]);
  // One logged day after the break does not bring the unlogged days back into the fit.
  assert.deepEqual(call([...without(13, 2)]), call(without(13, 1)));
  // After a break the new stretch is a new start too: 21 logged days after it leave 14 to fit.
  assert.deepEqual(counts(call(without(28, 22))), [true, 14, 8, 14, 7]);
  // With no stretch that gives a result, the counts are those of the newest one.
  assert.deepEqual(counts(call(without(20, 11))), [false, 2, 2, 2, 7]);

  // Weight that came back after logging stopped does not hide the loss that was logged: 2000 kcal a day and 65 g lost a day is 2500.
  const diet = [...earlier(2000), ...Array.from({ length: 18 }, (_, index) => ({ date: dayBefore(index + 11), calories: 2000 }))];
  const scale = Array.from({ length: 29 }, (_, index) => {
    const offset = 28 - index;
    return { date: dayBefore(offset), kg: offset >= 10 ? 80 - index * 500 / 7700 : 80 - 18 * 500 / 7700 + Math.min(1.2, (10 - offset) * 0.24) };
  });
  const stopped = calibrateMaintenance({ through, intake: diet, weights: scale, formulaCalories: 2500, restingCalories: 1560 });
  assert.deepEqual([stopped.ready, stopped.loggedDays, stopped.spanDays, stopped.ready && stopped.measuredCalories], [true, 18, 18, 2500]);
});

test("days logged far under the usual amount count half-way, and too many of them give no value", () => {
  const steady = [...earlier(2500), ...Array.from({ length: 28 }, (_, index) => ({ date: dayBefore(index + 1), calories: 2500 + (index % 2 ? 40 : -40) }))];
  const flat = Array.from({ length: 29 }, (_, index) => ({ date: dayBefore(index), kg: 80 }));
  const call = (changes) => calibrateMaintenance({ through, intake: steady, weights: flat, formulaCalories: 2500, restingCalories: 1560, ...changes });
  const light = (days) => steady.map((item, index) => days.includes(index - 9) ? { ...item, calories: 700 } : item);
  const calm = call({});
  assert.ok(calm.ready && calm.lowDays === 0 && calm.measuredCalories === 2500);
  // Four days at 700 kcal among 28: unfinished logs would leave the mean at 2500, real light days would make it 2243.
  // The value used lies half-way, 4 ÷ 28 × (2500 − 700) ÷ 2 = 129 lower, and those 129 are added to the error.
  const four = call({ intake: light([2, 9, 16, 23]) });
  assert.deepEqual([four.ready, four.lowDays, four.loggedDays], [true, 4, 24]);
  assert.ok(four.ready && calm.ready && Math.abs(four.averageIntake - (2500 - 129)) <= 4);
  assert.ok(four.ready && calm.ready && Math.abs(Math.sqrt(four.measuredError ** 2 - calm.measuredError ** 2) - 129) < 15);
  // A quarter of the logged days is still allowed. Above it light days cannot be told from unfinished logs at all.
  assert.deepEqual([call({ intake: light([0, 4, 8, 12, 16, 20, 24]) }).ready, calibrationRules.maxLowDayShare], [true, 0.25]);
  assert.deepEqual(call({ intake: light([0, 4, 8, 12, 16, 20, 24, 26]) }), { ready: false, reason: "lowDays", loggedDays: 20, weighIns: 29, spanDays: 28, skippedDays: 0, lowDays: 8 });
  // Low days are still days with a log: five of them in a row are not a break.
  assert.deepEqual([call({ intake: light([10, 11, 12, 13, 14]) }).spanDays, call({ intake: light([10, 11, 12, 13, 14]) }).skippedDays], [28, 0]);
});

test("a change of diet inside the records widens the error, and impossible results give no value", () => {
  const steady = [...earlier(2500), ...Array.from({ length: 28 }, (_, index) => ({ date: dayBefore(index + 1), calories: 2500 + (index % 2 ? 40 : -40) }))];
  const flat = Array.from({ length: 29 }, (_, index) => ({ date: dayBefore(index), kg: 80 }));
  const call = (changes) => calibrateMaintenance({ through, intake: steady, weights: flat, formulaCalories: 2500, restingCalories: 1560, ...changes });
  const calm = call({});
  assert.deepEqual([calm.ready && calm.intakeShift, calm.ready && calm.confidence], [false, "high"]);
  // 2500 kcal for two weeks, then 2000: part of what the scale shows afterwards is water. 1 kg × 1.5 ÷ 28 × 7700 = 412.5 is added to the error.
  const shifted = call({ intake: steady.map((item, index) => index >= 9 && index < 23 ? { ...item, calories: item.calories - 500 } : item) });
  assert.deepEqual([shifted.ready && shifted.intakeShift, shifted.ready && shifted.confidence], [true, "low"]);
  assert.ok(shifted.ready && calm.ready && Math.abs(Math.sqrt(shifted.measuredError ** 2 - calm.measuredError ** 2) - 412.5) < 15);
  // 700 kcal a day while gaining 0.1 kg a day would mean a negative maintenance.
  const rising = call({ intake: steady.map((item) => ({ ...item, calories: 700 })), weights: flat.map((item, index) => ({ ...item, kg: 82.8 - index * 0.1 })) });
  assert.deepEqual(rising, { ready: false, reason: "implausible", loggedDays: 28, weighIns: 29, spanDays: 28, ...none });
});

test("day numbers follow the calendar and reject anything that is not four, two and two digits", () => {
  assert.equal(dayNumber("1970-01-01"), 0);
  assert.equal(dayNumber("2026-11-27"), 20784);
  assert.equal(dayNumber("2024-03-01") - dayNumber("2024-02-28"), 2);
  assert.equal(dayNumber("2026-03-01") - dayNumber("2026-02-28"), 1);
  for (const text of ["2026-13-01", "2026-1-01", "20261127", "+026-11-27", "2026-11-27T08:00:00", "", "today"]) assert.ok(Number.isNaN(dayNumber(text)), text);
  for (let offset = -800; offset <= 800; offset += 37) {
    const date = new Date(Date.UTC(2026, 10, 27 + offset)).toISOString().slice(0, 10);
    assert.equal(dayNumber(date), Date.parse(date + "T00:00:00Z") / 86_400_000, date);
  }
});

test("body fat and age are read as of the day asked for", () => {
  const row = (id, date, entry, updated = date + "T08:00:00.000Z") => ({ kind: "nutrition", id, date, entry, updated, owner: "a", mine: true });
  const rows = [
    row("1", "2026-11-01", { type: "measurement", metric: "fat", value: 18 }),
    row("2", "2026-11-20", { type: "measurement", metric: "fat", value: 16.5 }),
    row("3", "2026-11-20", { type: "measurement", metric: "fat", value: 16 }, "2026-11-20T09:00:00.000Z"),
    row("4", "2026-11-25", { type: "measurement", metric: "waist", value: 80 }),
    row("5", "2026-11-29", { type: "measurement", metric: "fat", value: 12 }),
    row("6", "2026-11-26", { type: "weight", kg: 79.5 }),
  ];
  assert.deepEqual(readBodyFat(rows, through), { percent: 16, date: "2026-11-20" });
  assert.deepEqual(readBodyFat(rows, "2026-11-10"), { percent: 18, date: "2026-11-01" });
  assert.equal(readBodyFat(rows, "2027-03-01"), undefined);
  assert.equal(readBodyFat([], through), undefined);
  assert.equal(readBodyInputs(rows, through).weightKg, 79.5);
  assert.equal(ageOn({ age: 30, ageAsOf: "2024-12-01" }, through), 31);
  assert.equal(ageOn({ age: 30, ageAsOf: "2024-11-27" }, through), 32);
  assert.equal(ageOn({ age: 30 }, through), 30);
  assert.equal(ageOn(undefined, through), undefined);
});
