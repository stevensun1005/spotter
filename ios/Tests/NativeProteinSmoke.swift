import Foundation

@main
struct NativeProteinSmoke {
    static func main() throws {
        func expect(_ value: @autoclosure () -> Bool, _ description: String) { precondition(value(), description) }
        let id = "3da1818f-9fc3-4bb3-8df2-e2eafae83b5d"
        let original: NativeJSON = .object(["id": .string(id), "name": .string("Synthetic powder"), "scoopGrams": .number(30), "cupMl": .number(250), "futureMetadata": .string("keep")])
        var editor = NativeProteinRecipeEditor(product: original)
        editor.powder = ["calories": "120", "protein": "24", "carbs": "3", "fat": "2"]
        editor.perServing = true; editor.servingGrams = "30"; editor.usesMixer = true; editor.mixerName = "Synthetic milk"
        editor.liquid = ["calories": "60", "protein": "3", "carbs": "5", "fat": "3"]
        editor.estimated = true
        let recipe = try editor.product()
        expect(recipe["id"].string == id, "Editing keeps the existing recipe ID")
        expect(recipe["futureMetadata"].string == "keep", "Unknown product metadata remains intact")
        expect(recipe["powder"]["calories"].number == 400 && recipe["powder"]["protein"].number == 80, "Per-serving label converts to per-100g")
        expect(recipe["scoopGrams"].number == 30 && recipe["cupMl"].number == 250, "Each recipe owns its powder and liquid amounts")
        expect(recipe["mixer"]["per100ml"]["calories"].number == 60 && recipe["powderEstimated"].bool, "Liquid nutrition and estimate flags survive")
        let roundTrip = try JSONDecoder().decode(NativeJSON.self, from: JSONEncoder().encode(recipe))
        expect(roundTrip == recipe, "Recipe payload survives byte-level JSON round trip")
        editor.servingGrams = ""
        do { _ = try editor.product(); preconditionFailure("No guessing the label serving grams") }
        catch NativeProteinRecipeProblem.fields { }
        editor.servingGrams = "30"; editor.powder["protein"] = "200"
        do { _ = try editor.product(); preconditionFailure("Reject impossible per-100g macros") }
        catch NativeProteinRecipeProblem.fields { }
        if CommandLine.arguments.contains("--contract-fixture") { print(String(decoding: try JSONEncoder().encode(recipe), as: UTF8.self)) }
        else { print("PASS native protein recipe: serving conversion, IDs, amounts, milk, estimates, unknown fields, JSON and bounds") }
    }
}
