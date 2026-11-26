import Foundation
import ImageIO

@main
struct NativeCatalogueSmoke {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let index = try NativeCatalogIndex(
            indexURL: root.appendingPathComponent("cloudflare/public/open-gym/index.json"),
            assetsURL: root.appendingPathComponent("ios/SpotterHealth/NativeCatalogueAssets")
        )
        let standard = index.results()
        precondition(standard.count == 5272)
        let barbell = standard.sections.first { $0.id == "barbell" }!
        precondition(barbell.rows.count == 447)
        precondition(barbell.rows.prefix(4).map(\.id) == ["1506", "4721", "11093", "5659"])
        precondition(standard.featured.count == 3)
        for row in barbell.rows.prefix(6) {
            precondition(index.coverData(for: row)?.prefix(2) == Data([0xff, 0xd8]), "JPEG artwork missing for " + row.id)
        }
        let personal = (1...61).map { index.makePersonal(name: "我的自订动作\($0)") }
        precondition(index.results(personal: personal).count == 5333)
        precondition(index.results(area: "custom:unclassified", personal: personal).count == 61)
        precondition(index.results(scope: .frequent, frequent: ["我的自订动作1"], personal: personal).count == 1)
        precondition(index.results(scope: .pinned, favorites: ["我的自订动作1"], personal: personal).sections.first?.id == "pinned")
        let cable = index.results(query: "绳索下压")
        precondition(cable.sections.flatMap(\.rows).count == 1)
        precondition(index.family(for: cable.sections[0].rows[0])?.id == "cable-triceps")
        let guide = try index.details(for: barbell.rows[0])
        precondition(guide?.steps.isEmpty == false)
        verifyDemos(index)
        try verifyGymEquipment(index)
        for activity in NativeWorkoutSession.CardioActivity.planPresets {
            let id = activity.planMove?["catalogueId"].string ?? ""
            precondition(index.entry(withID: id)?.type == "cardio", "Cardio preset must resolve to an actual bundled item: " + id)
        }
        print("native catalogue smoke: grouping, covers, vector motion, Flow/pose GIFs, bundled video and personal isolation")
    }

    private static func verifyDemos(_ index: NativeCatalogIndex) {
        let drawn = index.entry(withID: "5965")!
        let drawing = index.drawing(for: drawn)!
        precondition(drawing.frames.count > 2 && drawing.frameDuration > 0)
        let initial = drawing.frames[0].flatMap(\.points)
        precondition(drawing.frames.dropFirst().contains { $0.flatMap(\.points) != initial })
        for id in ["0001", "4455"] {
            let entry = index.entry(withID: id)!
            let gif = index.animationData(for: entry)!
            let source = CGImageSourceCreateWithData(gif as CFData, nil)!
            precondition(CGImageSourceGetCount(source) > 1 && CGImageSourceCreateImageAtIndex(source, 1, nil) != nil)
        }
        let video = index.entry(withID: "0047")!
        precondition(index.bundledVideoURL(for: video)?.isFileURL == true)
        let personal = index.makePersonal(name: "私人的测试动作")
        precondition(index.drawing(for: personal) == nil && index.animationData(for: personal) == nil && index.bundledVideoURL(for: personal) == nil)
    }

    private static func verifyGymEquipment(_ index: NativeCatalogIndex) throws {
        var preferences = NativeGymPreferences.read(Data(), legacy: "barbell\nresistance band")
        precondition(preferences.gym.name == "GoodLife")
        precondition(preferences.gym.gear == ["barbell", "band"])
        precondition(preferences.catalogueGear == ["barbell", "olympic barbell", "band", "resistance band"])
        let restricted = index.results(gear: preferences.catalogueGear).sections.flatMap(\.rows)
        precondition(restricted.contains { $0.equipment == "body weight" })
        precondition(restricted.contains { $0.equipment == "barbell" })
        precondition(!restricted.contains { $0.equipment == "dumbbell" })
        precondition(preferences.add("  家庭  "))
        precondition(preferences.gym.name == "家庭" && preferences.catalogueGear.isEmpty)
        precondition(!preferences.add(" goodlife "))
        preferences.toggleAll()
        precondition(preferences.allSelected)
        precondition(preferences.gym.gear.count == NativeGymPreferences.equipment.count)
        precondition(preferences.gym.gear.contains("v-bar attachment"))
        let stored = try JSONEncoder().encode(preferences)
        var restored = NativeGymPreferences.read(stored, legacy: "")
        precondition(restored.gym.name == "家庭" && restored.allSelected)
        restored.toggleAll()
        precondition(restored.catalogueGear.isEmpty)
        restored.select("goodlife")
        precondition(restored.gym.gear == ["barbell", "band"])
    }
}
