import Foundation

// Daily calorie and macro targets from body data, activity and goal, and maintenance energy measured from records.
// This file mirrors cloudflare/features/nutrition/goal-estimate.ts and energy-calibration.ts.
// Keep the shared manual inputs and rounding the same on both sides. ios/Tests/NativeNutritionGoalSmoke.swift
// and cloudflare/tests/nutrition-goal-estimate.test.mjs check both against cloudflare/tests/nutrition-goal-cases.json.

enum NativeNutritionGoal: String, CaseIterable, Sendable {
    case maintain, recompose, gain, lose

    var title: String {
        switch self {
        case .maintain: return "维持体重"
        case .recompose: return "减脂增肌（维持体重）"
        case .gain: return "增肌增重"
        case .lose: return "减脂"
        }
    }
}

enum NativeNutritionActivity: String, CaseIterable, Sendable {
    case sedentary, light, moderate, high

    var title: String {
        switch self {
        case .sedentary: return "久坐（日均不到 5000 步）"
        case .light: return "少量走动（5000–7500 步）"
        case .moderate: return "经常走动（7500–12500 步）"
        case .high: return "体力劳动（12500 步以上）"
        }
    }
}

enum NativeNutritionActivitySource: String, Codable, CaseIterable, Sendable {
    case manual, appleHealth, calendar, automatic

    var title: String {
        switch self {
        case .manual: return "手动输入"
        case .appleHealth: return "Apple 健康"
        case .calendar: return "训练日历"
        case .automatic: return "自动动态估算"
        }
    }
}

struct NativeNutritionHealthActivity: Sendable {
    static let lookbackDays = 28
    static let maximumDailySteps = 200_000

    let stepsByDay: [String: Double]
    let workoutDays: [String]
}

struct NativeNutritionActivityEvidence: Equatable, Sendable {
    static let minimumDays = 14

    let activity: NativeNutritionActivity
    let averageSteps: Int
    let observedDays: Int
    let trainingDays: Int

    static func health(_ data: NativeNutritionHealthActivity, today: String) -> Self? {
        guard let end = NativeEnergyCalibration.dayNumber(today) else { return nil }
        let window = (end - NativeNutritionHealthActivity.lookbackDays)..<end
        let steps = data.stepsByDay.compactMap { day, value -> Double? in
            guard let number = NativeEnergyCalibration.dayNumber(day), window.contains(number),
                  (0...Double(NativeNutritionHealthActivity.maximumDailySteps)).contains(value) else { return nil }
            return value
        }
        guard steps.count >= minimumDays else { return nil }
        let average = Int((steps.reduce(0, +) / Double(steps.count)).rounded())
        let activity: NativeNutritionActivity
        switch average {
        case ..<5_000: activity = .sedentary
        case ..<7_500: activity = .light
        case ..<12_500: activity = .moderate
        default: activity = .high
        }
        let workoutDays = Set(data.workoutDays.compactMap(NativeEnergyCalibration.dayNumber)).intersection(window)
        let trainingDays = Int((Double(workoutDays.count) * 7 / Double(window.count)).rounded())
        return Self(activity: activity, averageSteps: average, observedDays: steps.count, trainingDays: trainingDays)
    }
}

struct NativeNutritionCalendarActivity: Equatable, Sendable {
    static let horizonDays = 7

    let trainingDays: Int
    let sessionCount: Int
    let trainingMinutes: Int

    static func upcoming(_ sessions: [(id: String, day: String, minutes: Int)], today: String) -> Self? {
        guard let start = NativeEnergyCalibration.dayNumber(today) else { return nil }
        let window = start..<(start + horizonDays)
        var ids = Set<String>()
        var days = Set<Int>()
        var minutes = 0
        for session in sessions {
            guard !session.id.isEmpty, let day = NativeEnergyCalibration.dayNumber(session.day),
                  window.contains(day), ids.insert(session.id).inserted else { continue }
            days.insert(day)
            let duration = (1...720).contains(session.minutes) ? session.minutes : 60
            minutes = min(168 * 60, minutes + duration)
        }
        return Self(trainingDays: days.count, sessionCount: ids.count, trainingMinutes: minutes)
    }
}

enum NativeNutritionPace: String, CaseIterable, Sendable {
    case slow, standard, fast

    var title: String {
        switch self {
        case .slow: return "慢"
        case .standard: return "标准"
        case .fast: return "快"
        }
    }
}

struct NativeNutritionGoalInput: Sendable {
    var age: Int
    var male: Bool
    var heightCm: Double
    var weightKg: Double
    /// Everyday movement, counted apart from training.
    var activity: NativeNutritionActivity
    /// Training days in a week.
    var trainingDays: Int = 0
    var goal: NativeNutritionGoal
    var pace: NativeNutritionPace = .standard
    var bodyFatPercent: Double? = nil
    var measuredMaintenance: Double? = nil
    /// Scheduled minutes replace the one-hour-per-training-day assumption when a calendar is available.
    var plannedTrainingMinutes: Double? = nil
    var averageNonWorkoutSteps: Int? = nil
    /// Actual recent training for body-fat formula selection, independent of a future schedule.
    var restingTrainingDays: Int? = nil
}

struct NativeNutritionGoalEstimate: Equatable, Sendable {
    enum Note: String, Sendable {
        case recordsTooLow, paceLimited, nearUnderweight, calorieFloor, belowFloor, proteinLimited, lowCarbs, largeDeficit
    }

    var restingCalories: Double
    var usesLeanMass: Bool
    var maintenanceCalories: Double
    var usesRecords: Bool
    /// Daily change from maintenance, negative for a deficit.
    var adjustmentCalories: Double
    /// Expected body weight change per week at this intake, negative for loss.
    var weeklyChangeKg: Double
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var notes: [Note]
}

struct NativeNutritionGoalReading: Sendable {
    let day: String
    let updated: String
    let value: Double
}

enum NativeNutritionGoalRules {
    static let bodyFatRange = 3.0...60.0
    static let bodyFatMaxAgeDays = 90
    static let measuredMaintenanceRange = 800.0...8000.0
    /// One training day replaces this many hours of an average day with work at this intensity (MET).
    static let trainingMet = 3.5
    static let trainingHours = 1.0
    /// With a body-fat reading, resting energy moves from Mifflin–St Jeor toward the fat-free-mass equation as training days rise
    /// and reaches it at this many days a week. The athletes that equation was checked on trained 5.0 ± 1.8 times a week.
    static let leanMassTrainingDays = 5.0
    /// The fat-free-mass result stays between the Mifflin–St Jeor value and this multiple of it.
    static let leanMassCeiling = 1.25
    static let energyPerKg = 7700.0
    static let maxWeeklyLossShare = 0.01
    /// No loss is planned at or under this BMI, and above it the deficit may not reach the weight at this BMI within this many weeks.
    static let minLossBmi = 18.5
    static let lowWeightWeeks = 8.0
    static let maxWeeklyGainShare = 0.005
    /// Largest daily deficit and surplus in kilocalories, whatever the body weight.
    static let maxDailyDeficit = 1000.0
    static let maxDailySurplus = 500.0
    /// For people who train, a daily deficit above this is flagged: lean mass stops growing around it.
    static let muscleGainDeficit = 500.0
    static let proteinMinShare = 0.1
    static let proteinMaxShare = 0.35
    static let fatShare = 0.25
    static let fatMinPerKg = 0.5
    static let fatMaxShare = 0.35
    /// Above this BMI, protein and the fat floor use the weight at this BMI plus this share of the weight above it.
    static let referenceBmi = 25.0
    static let excessWeightShare = 0.25
    /// With a body-fat reading, the reference weight is at least the weight this person would have at this body-fat share.
    static let referenceBodyFat = 0.2
    static let lowCarbGrams = 130.0
    static let roundCalories = 25.0

    /// The newest usable body-fat reading on or before the reference day.
    static func latestBodyFat(_ readings: [NativeNutritionGoalReading], through day: String) -> NativeNutritionGoalReading? {
        guard let through = NativeEnergyCalibration.dayNumber(day) else { return nil }
        return readings.lazy.filter { reading in
            guard bodyFatRange.contains(reading.value),
                  let measured = NativeEnergyCalibration.dayNumber(reading.day) else { return false }
            return measured <= through && through - measured <= bodyFatMaxAgeDays
        }.max { ($0.day, $0.updated) < ($1.day, $1.updated) }
    }

    /// Physical activity level of everyday life without training, applied to resting energy.
    static func activityFactor(_ activity: NativeNutritionActivity) -> Double {
        switch activity {
        case .sedentary: return 1.5
        case .light: return 1.6
        case .moderate: return 1.7
        case .high: return 1.9
        }
    }

    /// Interpolate the same activity factors used in the manual bands when an observed average is available.
    static func activityFactor(averageSteps: Int) -> Double {
        let stops: [(steps: Int, activity: NativeNutritionActivity)] = [
            (2500, .sedentary), (6250, .light), (10_000, .moderate), (15_000, .high)
        ]
        let steps = max(stops[0].steps, averageSteps)
        for (lower, upper) in zip(stops, stops.dropFirst()) where steps <= upper.steps {
            let from = activityFactor(lower.activity)
            let to = activityFactor(upper.activity)
            return from + (to - from) * Double(steps - lower.steps) / Double(upper.steps - lower.steps)
        }
        return activityFactor(.high)
    }

    /// Share of maintenance energy removed (lose) or added (gain) each day. Other goals have no pace.
    static func paceShare(_ goal: NativeNutritionGoal, _ pace: NativeNutritionPace) -> Double? {
        switch (goal, pace) {
        case (.lose, .slow): return 0.1
        case (.lose, .standard): return 0.2
        case (.lose, .fast): return 0.25
        case (.gain, .slow): return 0.05
        case (.gain, .standard): return 0.1
        case (.gain, .fast): return 0.15
        default: return nil
        }
    }

    /// A deficit never takes the daily intake under this. Maintenance measured from records under it is not used.
    static func calorieFloor(male: Bool) -> Double { male ? 1500 : 1200 }

    static func proteinPerKg(_ goal: NativeNutritionGoal) -> Double {
        switch goal {
        case .maintain: return 1.6
        case .recompose: return 2
        case .gain: return 1.8
        case .lose: return 2.2
        }
    }
}

extension NativeNutritionGoalInput {
    /// Age on a given day: the saved age plus the whole years passed since it was recorded.
    static func age(_ saved: Int, recordedOn: String, on day: String) -> Int {
        // Only two calendar days can be compared. With anything else the saved age stays as it is.
        guard NativeEnergyCalibration.dayNumber(recordedOn) != nil, NativeEnergyCalibration.dayNumber(day) != nil, recordedOn < day,
              let from = Int(recordedOn.prefix(4)), let to = Int(day.prefix(4)) else { return saved }
        return saved + to - from - (day.dropFirst(5) < recordedOn.dropFirst(5) ? 1 : 0)
    }

    /// Training days per week over the four weeks up to `today`, from the days of completed workouts.
    static func weeklyTrainingDays(_ days: [String], today: String) -> Int {
        guard let last = NativeEnergyCalibration.dayNumber(today) else { return 0 }
        var trained = Set<Int>()
        for day in days {
            guard let number = NativeEnergyCalibration.dayNumber(day), number > last - 28, number <= last else { continue }
            trained.insert(number)
        }
        return min(7, Int((Double(trained.count) / 4).rounded()))
    }

    /// Whether every value is inside the range the estimate accepts.
    var isInRange: Bool {
        typealias Rules = NativeNutritionGoalRules
        guard (18...120).contains(age), heightCm.isFinite, (100...250).contains(heightCm),
              weightKg.isFinite, (10...700).contains(weightKg), (0...7).contains(trainingDays) else { return false }
        if let bodyFatPercent, !(bodyFatPercent.isFinite && Rules.bodyFatRange.contains(bodyFatPercent)) { return false }
        if let restingTrainingDays, !(0...7).contains(restingTrainingDays) { return false }
        if let plannedTrainingMinutes, !(0...Double(168 * 60)).contains(plannedTrainingMinutes) { return false }
        if let averageNonWorkoutSteps, !(0...NativeNutritionHealthActivity.maximumDailySteps).contains(averageNonWorkoutSteps) { return false }
        if let measuredMaintenance,
           !(measuredMaintenance.isFinite && Rules.measuredMaintenanceRange.contains(measuredMaintenance)) { return false }
        return true
    }

    /// Returns nil when the inputs are outside the adult range or the goal does not fit the body data.
    func estimate() -> NativeNutritionGoalEstimate? {
        typealias Rules = NativeNutritionGoalRules
        guard isInRange else { return nil }
        let meters = heightCm / 100
        let squareMeters = meters * meters
        // Kilograms above the weight at the lowest BMI a loss is planned for.
        let spareKg = weightKg - Rules.minLossBmi * squareMeters
        if goal == .lose && spareKg <= 0 { return nil }

        // Resting energy: Mifflin–St Jeor. With a body-fat reading it moves toward Cunningham (1980) on fat-free mass as
        // training days rise, because Mifflin–St Jeor underestimates lean trained adults. It never lowers the estimate.
        let mifflin = 10 * weightKg + 6.25 * heightCm - 5 * Double(age) + (male ? 5 : -161)
        guard mifflin > 0 else { return nil }
        var uplift = 0.0
        if let bodyFatPercent {
            uplift = max(0, min(500 + 22 * weightKg * (1 - bodyFatPercent / 100), mifflin * Rules.leanMassCeiling) - mifflin)
        }
        let resting = mifflin + min(1, Double(restingTrainingDays ?? trainingDays) / Rules.leanMassTrainingDays) * uplift
        // Everyday activity sets the base level. Training hours replace average hours at the training intensity.
        let base = averageNonWorkoutSteps.map(Rules.activityFactor(averageSteps:)) ?? Rules.activityFactor(activity)
        let trainingHours = plannedTrainingMinutes.map { $0 / 60 } ?? Double(trainingDays) * Rules.trainingHours
        let level = base + (Rules.trainingMet - base) * trainingHours / 168
        var notes: [NativeNutritionGoalEstimate.Note] = []
        // Records that put maintenance under the lowest intake and under the formula more likely miss food than show a real
        // value, so the formula, the higher of the two, is used.
        let sexFloor = Rules.calorieFloor(male: male)
        let formula = resting * level
        var maintenance = formula
        var usesRecords = false
        if let measuredMaintenance {
            if measuredMaintenance >= min(sexFloor, formula) {
                maintenance = measuredMaintenance
                usesRecords = true
            } else {
                notes.append(.recordsTooLow)
            }
        }

        let step = Rules.roundCalories
        var change = 0.0
        var paceNote: NativeNutritionGoalEstimate.Note?
        // The lowest target that keeps the low-weight limit, so that rounding never makes the loss faster than that.
        var gentlest = 0.0
        if goal == .lose, let share = Rules.paceShare(goal, pace) {
            let wanted = maintenance * share
            let usual = min(weightKg * Rules.maxWeeklyLossShare * Rules.energyPerKg / 7, Rules.maxDailyDeficit)
            let spare = spareKg / Rules.lowWeightWeeks * Rules.energyPerKg / 7
            let limit = min(usual, spare)
            if wanted > limit { paceNote = spare < usual ? .nearUnderweight : .paceLimited }
            change = -min(wanted, limit)
            gentlest = ((maintenance - spare) / step).rounded(.up) * step
        } else if goal == .gain, let share = Rules.paceShare(goal, pace) {
            let wanted = maintenance * share
            let limit = min(weightKg * Rules.maxWeeklyGainShare * Rules.energyPerKg / 7, Rules.maxDailySurplus)
            if wanted > limit { paceNote = .paceLimited }
            change = min(wanted, limit)
        }
        let maintained = (maintenance / step).rounded() * step
        var calories = max(((maintenance + change) / step).rounded() * step, min(maintained, gentlest))
        // A deficit never takes intake under the floor. When maintenance itself is lower, no deficit is applied and the note says so.
        let lowest = min(sexFloor, maintained)
        let raised = calories < lowest
        if raised { calories = lowest }
        // Raised all the way to maintenance there is no pace left to explain.
        if let paceNote, !(raised && lowest == maintained) { notes.append(paceNote) }
        if raised && lowest == sexFloor { notes.append(.calorieFloor) }
        if calories < sexFloor { notes.append(.belowFloor) }
        guard calories >= 800, calories <= 20000 else { return nil }

        // Protein and the fat floor scale with body weight. Above BMI 25 they use an adjusted weight, because the extra weight is mostly fat.
        // A body-fat reading can raise it again, up to the real weight: a muscular person above BMI 25 is not carrying that fat.
        let thresholdKg = Rules.referenceBmi * squareMeters
        let adjustedKg = thresholdKg + Rules.excessWeightShare * (weightKg - thresholdKg)
        var leanKg = 0.0
        if let bodyFatPercent { leanKg = weightKg * (1 - bodyFatPercent / 100) / (1 - Rules.referenceBodyFat) }
        let referenceKg = weightKg <= thresholdKg ? weightKg : min(weightKg, max(adjustedKg, leanKg))
        let proteinWanted = (referenceKg * Rules.proteinPerKg(goal)).rounded()
        let proteinMax = (calories * Rules.proteinMaxShare / 4).rounded(.down)
        let protein = max((calories * Rules.proteinMinShare / 4).rounded(.up), min(proteinWanted, proteinMax))
        if proteinWanted > proteinMax { notes.append(.proteinLimited) }
        let fat = min((calories * Rules.fatMaxShare / 9).rounded(.down),
                      max((calories * Rules.fatShare / 9).rounded(), (referenceKg * Rules.fatMinPerKg).rounded()))
        let carbs = max(0, ((calories - protein * 4 - fat * 9) / 4).rounded())
        if carbs < Rules.lowCarbGrams { notes.append(.lowCarbs) }

        // A difference smaller than the rounding step is rounding, not a deficit or a surplus.
        let difference = calories - maintenance.rounded()
        let adjustment = abs(difference) < step ? 0 : difference
        if trainingDays > 0 && -adjustment > Rules.muscleGainDeficit { notes.append(.largeDeficit) }
        let weekly = (abs(adjustment) * 7 / Rules.energyPerKg * 100).rounded() / 100
        return NativeNutritionGoalEstimate(
            restingCalories: resting.rounded(), usesLeanMass: resting > mifflin,
            maintenanceCalories: maintenance.rounded(), usesRecords: usesRecords,
            adjustmentCalories: adjustment, weeklyChangeKg: adjustment < 0 ? -weekly : weekly,
            calories: calories, protein: protein, carbs: carbs, fat: fat, notes: notes)
    }
}

/// Maintenance energy estimated from what was eaten and how body weight moved.
struct NativeEnergyCalibration: Equatable, Sendable {
    enum Confidence: String, Sendable {
        case low, medium, high

        var title: String {
            switch self {
            case .low: return "低"
            case .medium: return "中"
            case .high: return "高"
            }
        }
    }

    /// Why there is no result: too few records, too many days logged far under the usual amount to tell light days from
    /// unfinished logs, or a result that cannot be right.
    enum Missing: String, Sendable {
        case records, lowDays, implausible
    }

    /// The edge of the allowed range the blended value was moved to. At the low edge food is probably missing from the log.
    enum Limit: String, Sendable {
        case inside, low, high
    }

    struct Measurement: Equatable, Sendable {
        /// Mean intake between the first and the last weigh-in: the complete days, with the low days counted half-way.
        var averageIntake: Double
        /// Slope of the weight trend, negative for loss.
        var weeklyChangeKg: Double
        /// Intake minus the energy of the weight change, before blending with the formula.
        var measuredCalories: Double
        /// Standard error of the measured value, in kilocalories a day.
        var measuredError: Double
        /// Maintenance energy to plan with: the measured value weighted against the formula by the error of both.
        var calories: Double
        var confidence: Confidence
        var limit: Limit
        /// Eating changed clearly during the records, so part of the weight change may be water and the error is wider.
        var intakeShift: Bool
    }

    /// Complete food days in day order, and what was logged on the days that fell under the incomplete limit.
    private struct FoodDays {
        var complete: [(day: Int, calories: Double)]
        var low: [Double]
    }

    /// A run of logged days with no break of `logStartGapDays` or more.
    private struct Stretch {
        var from: Int
        var to: Int
    }

    /// Days before the reference day that are read.
    static let windowDays = 28
    /// Days with a weigh-in that are needed, and the days between the first and the last of them.
    static let minWeighIns = 8
    static let minSpanDays = 14
    /// Complete food days needed between the first and the last weigh-in, and their share of those days.
    static let minLoggedDays = 10
    static let minLoggedShare = 0.6
    /// A logged day under this share of the median day, or under the fixed minimum, counts as incomplete.
    static let incompleteShare = 0.5
    static let minDayCalories = 600.0
    /// A logged day over this multiple of the median day is treated as a typing error.
    static let maxDayMultiple = 4.0
    /// A day under the incomplete limit is either an unfinished log or a real light day, and the log cannot say which. Such days
    /// count half-way between the two readings, with the other half as error. Above this share of the logged days there is no result.
    static let maxLowDayShare = 0.25
    /// `logStartGapDays` or more days in a row with nothing logged split the food log into stretches, and only one stretch is
    /// fitted. A stretch that begins more than `logStartGraceDays` into the days that were read is a new start: starting to log
    /// usually comes with a change of diet, and body water takes about a week to settle after one, so its first
    /// `logStartSettleDays` are not fitted.
    static let logStartGraceDays = 2
    static let logStartSettleDays = 7
    static let logStartGapDays = 5
    /// Days of food records before the reference day that the calibration needs: the window, and enough before it to tell a
    /// log that had already begun from one that starts inside the window.
    static let foodDays = windowDays + logStartSettleDays + logStartGraceDays
    /// A weigh-in further from the median than both of these is treated as a typing error or someone else on the scale.
    static let weightOutlierKg = 3.0
    static let weightOutlierShare = 0.04
    static let energyPerKg = 7700.0
    /// How far the energy of a kilogram of weight change can be from that figure, as a share of it.
    static let energySpreadLoss = 0.2
    static let energySpreadGain = 0.35
    /// Day-to-day scatter assumed for body weight when the readings happen to line up better than that.
    static let minWeightNoiseKg = 0.3
    /// Water shifts last several days, so the trend is less certain than independent readings would suggest.
    static let slopeErrorFactor = 1.5
    /// A change of diet: average intake before and after some day differs by at least this many kilocalories, this clearly
    /// (t statistic), with at least this many complete days on each side.
    static let shiftCalories = 250.0
    static let shiftT = 3.5
    static let shiftMinDays = 4
    /// Body water that moves with a change of diet, in kilograms, and how far a step in weight can tilt a fitted line (1.5 × step ÷ span).
    static let waterShiftKg = 1.0
    static let stepSlopeFactor = 1.5
    /// Spread of a formula estimate around a person's real maintenance energy, as a share of the estimate.
    static let formulaSpread = 0.15
    /// The planning value stays within this share of the formula estimate and above this multiple of resting energy.
    static let maxShift = 0.25
    static let minRestingMultiple = 1.2
    /// Largest error of the measured value, in kilocalories a day, for each confidence level.
    static let highConfidenceError = 150.0
    static let mediumConfidenceError = 250.0

    var loggedDays: Int
    var weighIns: Int
    var spanDays: Int
    /// Days at the start of a new or resumed food log that were left out.
    var skippedDays: Int
    /// Days between the first and the last weigh-in that were logged far under the usual amount.
    var lowDays: Int
    /// nil until there are enough records.
    var result: Measurement?
    /// Why there is no result. nil when there is one.
    var missing: Missing?

    /// Days since 1970-01-01 for a `yyyy-MM-dd` day, or nil when the text is not a calendar day.
    static func dayNumber(_ day: String) -> Int? {
        let parts = day.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              parts.allSatisfy({ $0.utf8.allSatisfy { $0 >= 48 && $0 <= 57 } }),
              let year = Int(parts[0]), let month = Int(parts[1]), let date = Int(parts[2]),
              (1...12).contains(month), (1...31).contains(date) else { return nil }
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yearOfEra = y - era * 400
        let dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + date - 1
        let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
        return era * 146_097 + dayOfEra - 719_468
    }

    private static func median(_ sorted: [Double]) -> Double {
        sorted.isEmpty ? 0 : (sorted[(sorted.count - 1) / 2] + sorted[sorted.count / 2]) / 2
    }

    /// Food days from one weigh-in day up to another. A morning weigh-in reflects what was eaten up to the day before,
    /// so the last day itself is left out.
    private static func foodBetween(_ start: Int, _ end: Int, logged: [(day: Int, calories: Double)]) -> FoodDays {
        let days = logged.filter { $0.day >= start && $0.day < end }
        let usual = median(days.map { $0.calories }.sorted())
        let lowest = max(minDayCalories, usual * incompleteShare)
        return FoodDays(complete: days.filter { $0.calories >= lowest && $0.calories <= usual * maxDayMultiple },
                        low: days.filter { $0.calories < lowest }.map { $0.calories })
    }

    /// maintenance = average intake − weight slope × energy per kilogram, between the first and the last weigh-in,
    /// weighted against the formula by the error of both.
    static func measure(through: String, intake: [(day: String, calories: Double)], weights: [(day: String, kg: Double)],
                        formulaCalories: Double, restingCalories: Double) -> NativeEnergyCalibration {
        guard let last = dayNumber(through) else {
            return NativeEnergyCalibration(loggedDays: 0, weighIns: 0, spanDays: 0, skippedDays: 0, lowDays: 0, result: nil, missing: .records)
        }
        let first = last - windowDays
        let earliest = last - foodDays

        // One reading a day: the average of that day's weigh-ins.
        var readings: [Int: (sum: Double, count: Double)] = [:]
        for item in weights {
            guard let day = dayNumber(item.day), day >= first, day <= last, item.kg.isFinite, item.kg > 0 else { continue }
            let entry = readings[day] ?? (sum: 0, count: 0)
            readings[day] = (sum: entry.sum + item.kg, count: entry.count + 1)
        }
        let daily = readings.map { (day: $0.key, kg: $0.value.sum / $0.value.count) }.sorted { $0.day < $1.day }
        let usualKg = median(daily.map { $0.kg }.sorted())
        let accepted = daily.filter { abs($0.kg - usualKg) <= max(weightOutlierKg, usualKg * weightOutlierShare) }

        // What was logged on each day before the reference day, in day order.
        var eaten: [Int: Double] = [:]
        for item in intake {
            guard let day = dayNumber(item.day), day >= earliest, day < last, item.calories.isFinite, item.calories > 0 else { continue }
            eaten[day, default: 0] += item.calories
        }
        let logged = eaten.map { (day: $0.key, calories: $0.value) }.sorted { $0.day < $1.day }
        // Stretches of the food log. Weight that moved while nothing was logged says nothing about the logged intake, and one
        // logged day on the far side of a break must not pull the break into the fit.
        var stretches: [Stretch] = []
        for item in logged {
            if let current = stretches.last, item.day - current.to <= logStartGapDays {
                stretches[stretches.count - 1].to = item.day
            } else {
                stretches.append(Stretch(from: item.day, to: item.day))
            }
        }
        func fitted(_ stretch: Stretch?) -> NativeEnergyCalibration {
            fit(stretch, first: first, last: last, earliest: earliest, accepted: accepted, logged: logged,
                formulaCalories: formulaCalories, restingCalories: restingCalories)
        }

        guard let latest = stretches.last else { return fitted(nil) }
        let newest = fitted(latest)
        // An earlier stretch is used when the newest one gives no result. Without any result the newest one's counts are shown.
        if newest.result != nil { return newest }
        for stretch in stretches.dropLast().reversed() {
            let earlier = fitted(stretch)
            if earlier.result != nil { return earlier }
        }
        return newest
    }

    /// The calibration of one stretch of the food log, or of the whole window when nothing was logged.
    private static func fit(_ stretch: Stretch?, first: Int, last: Int, earliest: Int, accepted: [(day: Int, kg: Double)],
                            logged: [(day: Int, calories: Double)], formulaCalories: Double, restingCalories: Double) -> NativeEnergyCalibration {
        // The trend only uses weigh-ins from the stretch, up to the morning after its last day.
        var from = first
        var to = last
        var skippedDays = 0
        if let stretch {
            let settled = stretch.from > earliest + logStartGraceDays ? stretch.from + logStartSettleDays : first
            if settled > first { skippedDays = logStartSettleDays }
            from = max(first, settled)
            to = stretch.to + 1
        }
        let points = accepted.filter { $0.day >= from && $0.day <= to }
        let start = points.first?.day ?? last
        let end = points.last?.day ?? last
        let food = foodBetween(start, end, logged: logged)
        let spanDays = end - start
        // In day order for the change of diet, in rising order for the sums.
        let series = food.complete.map { $0.calories }
        let complete = series.sorted()
        let lowDays = Double(food.low.count)

        var calibration = NativeEnergyCalibration(loggedDays: complete.count, weighIns: points.count, spanDays: spanDays,
                                                  skippedDays: skippedDays, lowDays: food.low.count, result: nil, missing: .records)
        guard points.count >= minWeighIns, spanDays >= minSpanDays, complete.count >= minLoggedDays,
              Double(complete.count) >= Double(spanDays) * minLoggedShare,
              formulaCalories.isFinite, formulaCalories > 0, restingCalories.isFinite, restingCalories > 0 else { return calibration }
        if lowDays > (Double(complete.count) + lowDays) * maxLowDayShare {
            calibration.missing = .lowDays
            return calibration
        }

        // Least-squares line through the weigh-ins.
        let n = Double(points.count)
        let meanDay = points.reduce(0.0) { $0 + Double($1.day) } / n
        let meanKg = points.reduce(0.0) { $0 + $1.kg } / n
        let spread = points.reduce(0.0) { sum, point in
            let offset = Double(point.day) - meanDay
            return sum + offset * offset
        }
        let slope = points.reduce(0.0) { $0 + (Double($1.day) - meanDay) * ($1.kg - meanKg) } / spread
        let residual = points.reduce(0.0) { sum, point in
            let miss = point.kg - meanKg - slope * (Double(point.day) - meanDay)
            return sum + miss * miss
        }
        let noise = max(minWeightNoiseKg, (residual / (n - 2)).squareRoot())
        let slopeError = slopeErrorFactor * noise / spread.squareRoot()

        let days = Double(complete.count)
        let completeIntake = complete.reduce(0.0, +) / days
        let scatter = complete.reduce(0.0) { sum, calories in
            let miss = calories - completeIntake
            return sum + miss * miss
        }
        // Unlogged days are the only sampling error in the mean, so it shrinks as the days between weigh-ins fill up.
        let intakeVariance = scatter / (days - 1) / days * (1 - days / Double(spanDays))
        // If the low days are unfinished logs the mean of the complete days stands. If they are real light days the mean of all
        // logged days does. The value used lies half-way and the other half is error.
        let lowShift = lowDays > 0 ? lowDays / (days + lowDays) * (completeIntake - food.low.reduce(0.0, +) / lowDays) / 2 : 0
        let averageIntake = completeIntake - lowShift
        let measured = averageIntake - slope * energyPerKg

        // A change of diet inside the records moves body water, and a straight line reads that step as trend.
        var intakeShift = false
        var split = shiftMinDays
        while split <= series.count - shiftMinDays && !intakeShift {
            let before = series[..<split]
            let after = series[split...]
            let meanBefore = before.reduce(0.0, +) / Double(before.count)
            let meanAfter = after.reduce(0.0, +) / Double(after.count)
            let scatterBefore = before.reduce(0.0) { sum, calories in
                let miss = calories - meanBefore
                return sum + miss * miss
            }
            let scatterAfter = after.reduce(0.0) { sum, calories in
                let miss = calories - meanAfter
                return sum + miss * miss
            }
            let gap = abs(meanBefore - meanAfter)
            let t = gap / ((scatterBefore + scatterAfter) / (days - 2) * (1 / Double(before.count) + 1 / Double(after.count))).squareRoot()
            intakeShift = gap >= shiftCalories && t > shiftT
            split += 1
        }
        let waterEnergy = intakeShift ? waterShiftKg * stepSlopeFactor / Double(spanDays) * energyPerKg : 0

        let energySpread = slope < 0 ? energySpreadLoss : energySpreadGain
        let slopeEnergy = slopeError * energyPerKg
        let densityEnergy = energySpread * energyPerKg * slope
        let measuredVariance = slopeEnergy * slopeEnergy + intakeVariance + densityEnergy * densityEnergy + waterEnergy * waterEnergy
            + lowShift * lowShift
        let measuredError = measuredVariance.squareRoot()
        // Precision weighting: the measured value counts for more as its error shrinks below the formula's.
        let formulaError = formulaCalories * formulaSpread
        let formulaVariance = formulaError * formulaError
        let trust = formulaVariance / (formulaVariance + measuredVariance)
        let blended = formulaCalories + trust * (measured - formulaCalories)
        let lowest = max(formulaCalories * (1 - maxShift), restingCalories * minRestingMultiple)
        let calories = min(formulaCalories * (1 + maxShift), max(lowest, blended))
        // Eating nothing while holding weight is not a measurement. Neither is a value that is not a number: `max` and `min`
        // drop one instead of passing it on, so the blended value is checked by itself.
        guard measured > 0, measuredError.isFinite, !blended.isNaN, calories.isFinite else {
            calibration.missing = .implausible
            return calibration
        }
        let weekly = (abs(slope * 7) * 100).rounded() / 100

        calibration.missing = nil
        calibration.result = Measurement(
            averageIntake: averageIntake.rounded(), weeklyChangeKg: weekly == 0 ? 0 : (slope < 0 ? -weekly : weekly),
            measuredCalories: measured.rounded(), measuredError: measuredError.rounded(), calories: calories.rounded(),
            confidence: measuredError <= highConfidenceError ? .high : measuredError <= mediumConfidenceError ? .medium : .low,
            limit: calories == blended ? .inside : (blended < calories ? .low : .high), intakeShift: intakeShift)
        return calibration
    }
}
