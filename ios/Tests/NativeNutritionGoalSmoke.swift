import Foundation

// Runs the cases the web tests use (cloudflare/tests/nutrition-goal-estimate.test.mjs) against the iPhone port,
// so both sides return the same numbers for the same inputs.
@main
struct NativeNutritionGoalSmoke {
    static func main() throws {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        func number(_ value: Any?) -> Double? { (value as? NSNumber)?.doubleValue }
        func text(_ value: Any?) -> String { value as? String ?? "" }

        let data = try Data(contentsOf: URL(fileURLWithPath: "cloudflare/tests/nutrition-goal-cases.json"))
        guard let cases = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            preconditionFailure("The cases file is a JSON object")
        }
        func list(_ key: String) -> [[String: Any]] { cases[key] as? [[String: Any]] ?? [] }

        func goalInput(_ raw: [String: Any]) -> NativeNutritionGoalInput? {
            guard let age = number(raw["age"]), let heightCm = number(raw["heightCm"]), let weightKg = number(raw["weightKg"]),
                  let activity = NativeNutritionActivity(rawValue: text(raw["activity"])),
                  let goal = NativeNutritionGoal(rawValue: text(raw["goal"])) else { return nil }
            return NativeNutritionGoalInput(
                age: Int(age), male: text(raw["sex"]) == "male", heightCm: heightCm, weightKg: weightKg, activity: activity,
                trainingDays: Int(number(raw["trainingDays"]) ?? 0), goal: goal,
                pace: NativeNutritionPace(rawValue: text(raw["pace"])) ?? .standard,
                bodyFatPercent: number(raw["bodyFatPercent"]), measuredMaintenance: number(raw["measuredMaintenance"]))
        }

        let estimates = list("estimates")
        expect(estimates.count >= 20, "Estimate cases are present")
        for item in estimates {
            let name = text(item["name"])
            let actual = goalInput(item["input"] as? [String: Any] ?? [:])?.estimate()
            guard let expected = item["expected"] as? [String: Any] else {
                expect(actual == nil, "\(name): no estimate is expected")
                continue
            }
            guard let actual else { preconditionFailure("\(name): an estimate is expected") }
            let values = expected["values"] as? [String: Any] ?? [:]
            let method = actual.usesLeanMass ? "leanMass" : "mifflin"
            let source = actual.usesRecords ? "records" : "activity"
            let notes = actual.notes.map(\.rawValue)
            expect(actual.restingCalories == number(expected["restingCalories"]), "\(name): resting energy")
            expect(method == text(expected["restingMethod"]), "\(name): resting method")
            expect(actual.maintenanceCalories == number(expected["maintenanceCalories"]), "\(name): maintenance")
            expect(source == text(expected["maintenanceSource"]), "\(name): maintenance source")
            expect(actual.adjustmentCalories == number(expected["adjustmentCalories"]), "\(name): adjustment")
            expect(actual.weeklyChangeKg == number(expected["weeklyChangeKg"]), "\(name): weekly change")
            expect(actual.calories == number(values["calories"]), "\(name): calories")
            expect(actual.protein == number(values["protein"]), "\(name): protein")
            expect(actual.carbs == number(values["carbs"]), "\(name): carbohydrate")
            expect(actual.fat == number(values["fat"]), "\(name): fat")
            expect(notes == (expected["notes"] as? [String] ?? []), "\(name): notes")
        }

        let calibrations = list("calibrations")
        expect(calibrations.count >= 10, "Calibration cases are present")
        for item in calibrations {
            let name = text(item["name"])
            var intake: [(day: String, calories: Double)] = []
            for entry in (item["intake"] as? [[String: Any]] ?? []) {
                intake.append((day: text(entry["date"]), calories: number(entry["calories"]) ?? 0))
            }
            var weights: [(day: String, kg: Double)] = []
            for entry in (item["weights"] as? [[String: Any]] ?? []) {
                weights.append((day: text(entry["date"]), kg: number(entry["kg"]) ?? 0))
            }
            let actual = NativeEnergyCalibration.measure(
                through: text(item["through"]), intake: intake, weights: weights,
                formulaCalories: number(item["formulaCalories"]) ?? 0, restingCalories: number(item["restingCalories"]) ?? 0)
            let expected = item["expected"] as? [String: Any] ?? [:]
            let ready = expected["ready"] as? Bool ?? false
            expect(Double(actual.loggedDays) == number(expected["loggedDays"]), "\(name): logged days")
            expect(Double(actual.weighIns) == number(expected["weighIns"]), "\(name): weigh-ins")
            expect(Double(actual.spanDays) == number(expected["spanDays"]), "\(name): span")
            expect(Double(actual.skippedDays) == number(expected["skippedDays"]), "\(name): days left out at the start of a food log")
            expect(Double(actual.lowDays) == number(expected["lowDays"]), "\(name): days logged far under the usual amount")
            expect((actual.result != nil) == ready, "\(name): readiness")
            expect((actual.missing?.rawValue ?? "") == text(expected["reason"]), "\(name): reason for no result")
            guard let result = actual.result else { continue }
            expect(result.averageIntake == number(expected["averageIntake"]), "\(name): average intake")
            expect(result.weeklyChangeKg == number(expected["weeklyChangeKg"]), "\(name): weekly change")
            expect(result.measuredCalories == number(expected["measuredCalories"]), "\(name): measured maintenance")
            expect(result.measuredError == number(expected["measuredError"]), "\(name): error of the measured value")
            expect(result.limit.rawValue == text(expected["limit"]), "\(name): limit")
            expect(result.intakeShift == (expected["intakeShift"] as? Bool ?? false), "\(name): change of diet")
            // A flat trend is zero, not negative zero, so the text never shows a minus sign for it.
            expect(result.weeklyChangeKg != 0 || result.weeklyChangeKg.sign == .plus, "\(name): sign of a flat trend")
            expect(result.calories == number(expected["calories"]), "\(name): planning maintenance")
            expect(result.confidence.rawValue == text(expected["confidence"]), "\(name): confidence")
        }

        let training = list("trainingDays")
        expect(!training.isEmpty, "Training-day cases are present")
        for item in training {
            let actual = NativeNutritionGoalInput.weeklyTrainingDays(item["dates"] as? [String] ?? [], today: text(item["today"]))
            expect(Double(actual) == number(item["expected"]), "\(text(item["name"])): weekly training days")
        }

        let ages = list("ages")
        expect(!ages.isEmpty, "Age cases are present")
        for item in ages {
            let actual = NativeNutritionGoalInput.age(Int(number(item["age"]) ?? 0), recordedOn: text(item["ageAsOf"]), on: text(item["day"]))
            expect(Double(actual) == number(item["expected"]), "\(text(item["name"])): age")
        }

        expect(NativeEnergyCalibration.dayNumber("1970-01-01") == 0 && NativeEnergyCalibration.dayNumber("2026-11-27") == 20784,
               "Day numbers count from 1970-01-01")
        expect(NativeEnergyCalibration.dayNumber("2026-13-01") == nil && NativeEnergyCalibration.dayNumber("20261127") == nil
               && NativeEnergyCalibration.dayNumber("+026-11-27") == nil && NativeEnergyCalibration.dayNumber("2026-11-+7") == nil,
               "Text that is not a calendar day has no day number")
        let dates = list("dates")
        expect(!dates.isEmpty, "Date cases are present")
        for item in dates {
            let actual = NativeEnergyCalibration.dayNumber(text(item["date"])).map { Double($0) }
            expect(actual == number(item["expected"]), "\(text(item["date"])): day number")
        }

        let bodyFat = list("bodyFat")
        expect(!bodyFat.isEmpty, "Body-fat selection cases are present")
        for item in bodyFat {
            let readings = (item["readings"] as? [[String: Any]] ?? []).compactMap { row -> NativeNutritionGoalReading? in
                guard let value = number(row["percent"]) else { return nil }
                let day = text(row["date"])
                return NativeNutritionGoalReading(day: day, updated: row["updated"] as? String ?? day + "T08:00:00Z", value: value)
            }
            let latest = NativeNutritionGoalRules.latestBodyFat(readings, through: text(item["through"]))
            let expected = item["expected"] as? [String: Any]
            expect(latest?.day == expected?["date"] as? String, "\(text(item["name"])): body-fat day")
            expect(latest?.value == number(expected?["percent"]), "\(text(item["name"])): body-fat percentage")
        }
        print("PASS native nutrition goal: \(estimates.count) estimates, \(calibrations.count) calibrations, training days, ages and body-fat selection match the web cases")
    }
}
