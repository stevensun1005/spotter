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
        print("native catalogue smoke: 5,272 grouped entries, correct 447 barbell sequence, 61 personal entries, exact covers")
    }
}
