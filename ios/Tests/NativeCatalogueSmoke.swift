import CoreGraphics
import Foundation

@main
struct NativeCatalogueSmoke {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let index = try NativeCatalogIndex(
            indexURL: root.appendingPathComponent("cloudflare/public/open-gym/index.json"),
            assetsURL: root.appendingPathComponent("ios/SpotterHealth/NativeCatalogueAssets")
        )
        let standard = index.results()
        precondition(standard.count == 5327)
        let barbell = standard.sections.first { $0.id == "barbell" }!
        precondition(barbell.rows.count == 447)
        precondition(barbell.rows.prefix(4).map(\.id) == ["1506", "4721", "11093", "5659"])
        precondition(standard.featured.count == 3)
        for row in barbell.rows.prefix(6) {
            precondition(index.coverData(for: row)?.prefix(2) == Data([0xff, 0xd8]), "JPEG artwork missing for " + row.id)
        }
        let personal = (1...61).map { index.makePersonal(name: "我的自订动作\($0)") }
        precondition(index.results(personal: personal).count == standard.count + personal.count)
        precondition(index.results(area: "custom:unclassified", personal: personal).count == 61)
        precondition(index.results(scope: .frequent, frequent: ["我的自订动作1"], personal: personal).count == 1)
        precondition(index.results(scope: .pinned, favorites: ["我的自订动作1"], personal: personal).sections.first?.id == "pinned")
        let cable = index.results(query: "绳索下压")
        precondition(cable.sections.flatMap(\.rows).count == 1)
        precondition(index.family(for: cable.sections[0].rows[0])?.id == "cable-triceps")
        let guide = try index.details(for: barbell.rows[0])
        precondition(guide?.steps.isEmpty == false)
        try verifyDemos(index, root: root)
        verifyPlannedExerciseIdentity(index)
        try verifyGymEquipment(index)
        for activity in NativeWorkoutSession.CardioActivity.planPresets {
            let id = activity.planMove?["catalogueId"].string ?? ""
            precondition(index.entry(withID: id)?.type == "cardio", "Cardio preset must resolve to an actual bundled item: " + id)
        }
        print("native catalogue smoke: grouping, media, exact planned exercise identity and personal isolation")
    }

    private static func verifyDemos(_ index: NativeCatalogIndex, root: URL) throws {
        for id in ["0047", "4455", "0288", "1047", "2291", "3893", "3666", "5965"] {
            let entry = index.entry(withID: id)!
            precondition(index.animationData(for: entry) == nil)
            guard let url = index.bundledVideoURL(for: entry) else {
                preconditionFailure("Bundled 3D video missing for " + id)
            }
            precondition(url.path.hasSuffix("/video/spotter-3d/" + id + ".mp4"))
            let bytes = try Data(contentsOf: url, options: .mappedIfSafe)
            precondition(bytes.count > 16 && bytes[4..<8] == Data("ftyp".utf8))
        }
        let videoDirectory = root.appendingPathComponent("ios/SpotterHealth/NativeCatalogueAssets/video")
        precondition(try! FileManager.default.contentsOfDirectory(atPath: videoDirectory.path) == ["spotter-3d"])
        let dumbbellBench = index.entry(withID: "0289")!
        let relatedBench = index.relatedExercises(for: dumbbellBench, excluding: ["0025"])
        precondition(!relatedBench.isEmpty && relatedBench.count <= 6)
        precondition(relatedBench.allSatisfy { $0.target == dumbbellBench.target && $0.id != dumbbellBench.id && $0.id != "0025" })
        let registry = root.appendingPathComponent("cloudflare/features/exercises/spotter-demo-assets.json")
        let spotterDemos = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: registry))
        precondition(spotterDemos["0198"] == "/open-gym/spotter-3d/0198.mp4")
        let webAssets = root.appendingPathComponent("cloudflare/public")
        var offlineBytes = 0
        var webBytes = 0
        for (id, path) in spotterDemos {
            let entry = index.entry(withID: id)!
            precondition(entry.hasCover && index.coverData(for: entry)?.prefix(2) == Data([0xff, 0xd8]))
            precondition(index.drawing(for: entry) == nil && index.animationData(for: entry) == nil)
            guard let offline = index.bundledVideoURL(for: entry) else {
                preconditionFailure("Missing offline video for " + id)
            }
            precondition(offline.path.hasSuffix("/video/spotter-3d/" + id + ".mp4"))
            precondition(index.videoURL(for: entry)?.path == path)
            let original = webAssets.appendingPathComponent(String(path.dropFirst()))
            guard let offlineSize = try offline.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  let webSize = try original.resourceValues(forKeys: [.fileSizeKey]).fileSize else {
                preconditionFailure("Could not measure the offline and web videos for " + id)
            }
            offlineBytes += offlineSize
            webBytes += webSize
        }
        precondition(offlineBytes < webBytes, "The offline catalogue must be smaller than the web masters.")
        precondition(index.entry(exactName: "A1 跪姿绳索三头下压")?.id == "0176")
        precondition(index.knows("barbell bench press"))
        precondition(index.entry(exactName: "A2 跪姿绳索三头下压（反握）") == nil)
        precondition(index.entry(exactName: "上斜俯卧哑铃展臂")?.id == "0326")
        let publishedIDs = ["0426", "0436", "2290"] + (12100...12157).filter { ![12127, 12128, 12142].contains($0) }.map(String.init)
        for id in publishedIDs {
            let entry = index.entry(withID: id)!
            let move = NativeJSON.object(["name": .string(entry.name)])
            precondition(index.plannedExercise(move, library: [])?.id == entry.id)
            precondition(!entry.equipment.isEmpty && !entry.target.isEmpty && !entry.muscles.isEmpty)
            precondition(try! index.details(for: entry)?.steps.isEmpty == false)
            precondition(index.bundledVideoURL(for: entry)?.isFileURL == true)
        }

        let personal = index.makePersonal(name: "私人的测试动作")
        precondition(index.drawing(for: personal) == nil && index.animationData(for: personal) == nil && index.bundledVideoURL(for: personal) == nil)
    }

    private static func verifyPlannedExerciseIdentity(_ index: NativeCatalogIndex) {
        let prefixed: NativeJSON = .object(["name": .string("A1 杠铃卧推 · 慢速放下")])
        let standard = index.plannedExercise(prefixed, library: [])!
        precondition(standard.id == "0025" && index.bundledVideoURL(for: standard)?.isFileURL == true)

        let oldID: NativeJSON = .object(["name": .string("杠铃交替二头弯举"), "catalogueId": .string("0023")])
        precondition(index.plannedExercise(oldID, library: [])?.id == "0285")
        let missingID: NativeJSON = .object(["name": .string("杠铃卧推"), "catalogueId": .string("999999")])
        precondition(index.plannedExercise(missingID, library: [])?.id == "0025")

        let custom: NativeJSON = .object(["name": .string("A2 跪姿绳索三头下压（反握）"),
                                          "sourceName": .string("跪姿绳索三头下压")])
        let variant = index.plannedExercise(custom, library: [])!
        precondition(variant.isPersonal && variant.name == "跪姿绳索三头下压（反握）")
        precondition(index.bundledVideoURL(for: variant) == nil)

        let conflict: NativeJSON = .object(["name": .string("杠铃卧推"), "catalogueId": .string("0285")])
        precondition(index.plannedExercise(conflict, library: [])?.isPersonal == true)
        let sourceConflict: NativeJSON = .object(["name": .string("私人测试动作"), "catalogueId": .string("0285"),
                                                  "sourceName": .string("杠铃卧推")])
        precondition(index.plannedExercise(sourceConflict, library: [])?.isPersonal == true)
        let privateVariant: NativeJSON = .object(["kind": .string("exercise"), "item": .object([
            "name": .string("杠铃卧推"), "versionOf": .string("私人测试动作"),
        ])])
        precondition(index.plannedExercise(prefixed, library: [privateVariant])?.isPersonal == true)
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
