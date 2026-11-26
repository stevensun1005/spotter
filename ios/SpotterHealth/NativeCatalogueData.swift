import Foundation

struct NativeGymPreferences: Codable, Equatable {
    struct Equipment: Identifiable {
        let id: String
        let label: String

        init(_ id: String, _ label: String) {
            self.id = id
            self.label = label
        }
    }

    struct Gym: Identifiable, Codable, Equatable {
        let id: String
        let name: String
        var gear: Set<String>
    }

    static let storageKey = "spotter.native.catalogue.gymProfiles"
    static let equipment: [Equipment] = [
        .init("body weight", "自重"), .init("dumbbell", "哑铃"),
        .init("barbell", "杠铃"), .init("rack", "深蹲架"),
        .init("bench", "训练凳"), .init("incline bench", "上斜凳"),
        .init("decline bench", "下斜凳"), .init("cable", "绳索"),
        .init("band", "弹力带"), .init("kettlebell", "壶铃"),
        .init("high bar", "单杠"), .init("smith machine", "史密斯机"),
        .init("leverage machine", "固定力量器械"), .init("sled machine", "雪橇／滑轨"),
        .init("rope attachment", "绳把"), .init("straight bar attachment", "绳索直杆"),
        .init("v-bar attachment", "V 形把手"), .init("curl bar attachment", "绳索曲杆"),
        .init("single handle", "单手把手"), .init("ankle cuff", "踝带"),
        .init("arm blaster", "手臂支撑板"), .init("safety pins", "安全销"),
        .init("lifting chain", "负重链条"), .init("press board", "卧推木板"),
        .init("weight plate", "杠铃片"), .init("suspended weight", "悬挂负重"),
    ]
    private static let allGear = Set(equipment.map(\.id))

    private(set) var active: String
    private(set) var profiles: [Gym]

    var gym: Gym { profiles.first { $0.id == active } ?? profiles[0] }
    var allSelected: Bool { Self.allGear.isSubset(of: gym.gear) }

    var catalogueGear: Set<String> {
        let selected = gym.gear
        guard !selected.isEmpty else { return [] }
        var gear = selected
        if selected.contains("band") { gear.insert("resistance band") }
        if selected.contains("barbell") { gear.insert("olympic barbell") }
        return gear
    }

    static func read(_ data: Data, legacy: String) -> Self {
        if let state = try? JSONDecoder().decode(Self.self, from: data), !state.profiles.isEmpty { return state }
        let aliases = ["resistance band": "band", "olympic barbell": "barbell", "pull-up bar": "high bar"]
        let prior = Set(legacy.split(separator: "\n").map { key in
            let value = String(key)
            return aliases[value] ?? value
        }).intersection(allGear)
        return Self(active: "goodlife", profiles: [Gym(id: "goodlife", name: "GoodLife", gear: prior)])
    }

    func canAdd(_ name: String) -> Bool {
        let label = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return (1...40).contains(label.count) && profiles.count < 12 &&
            !profiles.contains { $0.name.caseInsensitiveCompare(label) == .orderedSame }
    }

    @discardableResult
    mutating func add(_ name: String) -> Bool {
        guard canAdd(name) else { return false }
        let profile = Gym(id: UUID().uuidString, name: name.trimmingCharacters(in: .whitespacesAndNewlines), gear: [])
        profiles.append(profile)
        active = profile.id
        return true
    }

    mutating func select(_ id: String) {
        guard profiles.contains(where: { $0.id == id }) else { return }
        active = id
    }

    mutating func toggle(_ key: String) {
        guard Self.allGear.contains(key), let index = profiles.firstIndex(where: { $0.id == gym.id }) else { return }
        if !profiles[index].gear.insert(key).inserted { profiles[index].gear.remove(key) }
    }

    mutating func toggleAll() {
        guard let index = profiles.firstIndex(where: { $0.id == gym.id }) else { return }
        if allSelected { profiles[index].gear.removeAll() }
        else { profiles[index].gear.formUnion(Self.allGear) }
    }
}

struct NativeCatalogEntry: Identifiable, Sendable {
    let id: String
    let name: String
    let en: String
    let part: String
    let equipment: String
    let type: String
    let target: String
    let muscles: [String: Int]
    let isPersonal: Bool
    let hasCover: Bool
    let hold: Bool
    let distance: Bool

    fileprivate let normalizedName: String
    fileprivate let normalizedEnglish: String

    var raw: NativeJSON {
        var fields: [String: NativeJSON] = ["name": .string(name), "en": .string(en),
                                             "hold": .bool(hold), "distance": .bool(distance)]
        if !isPersonal { fields["id"] = .string(id) }
        return .object(fields)
    }

    fileprivate init(id: String, name: String, en: String, part: String, equipment: String, type: String,
                     target: String, muscles: [String: Int], isPersonal: Bool, hasCover: Bool,
                     hold: Bool = false, distance: Bool = false) {
        self.id = id
        self.name = name
        self.en = en
        self.part = part
        self.equipment = equipment
        self.type = type
        self.target = target
        self.muscles = muscles
        self.isPersonal = isPersonal
        self.hasCover = hasCover
        self.hold = hold
        self.distance = distance
        normalizedName = catalogSearchKey(name)
        normalizedEnglish = catalogSearchKey(en)
    }
}

struct NativeCatalogArea: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let children: [NativeCatalogArea]?
}

struct NativeCatalogGroup: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let muscles: [String]
}

struct NativeCatalogFamily: Identifiable, Sendable {
    let id: String
    let title: String
    let note: String?
    let variants: [NativeCatalogEntry]
}

struct NativeCatalogVariant: Decodable, Sendable {
    let id: String
    let label: String
    let tip: String
}

struct NativeCatalogSection: Identifiable, Sendable {
    let id: String
    let title: String
    let jumpLabel: String
    var rows: [NativeCatalogEntry]
}

struct NativeCatalogResults: Sendable {
    let sections: [NativeCatalogSection]
    let featured: [NativeCatalogEntry]
    let count: Int
    let typeOptions: [String]
    let equipmentOptions: [String]
    let activeType: String
    let activeEquipment: String
}

struct NativeCatalogDetailText: Decodable, Sendable {
    let description: String
    let steps: [String]
    let language: String?
}

struct NativeCatalogDrawing: Sendable {
    struct Mark: Sendable {
        let color: UInt32
        let width: Double
        let points: [CGPoint]

        init?(_ values: [Double]) {
            guard values.count >= 4, values.count.isMultiple(of: 2),
                  let color = UInt32(exactly: values[0]), color <= 0xffffff,
                  values[1].isFinite, values[1] != 0,
                  values[1] < 0 ? values.count == 4 : values.count >= 6 else { return nil }
            self.color = color
            width = values[1]
            points = stride(from: 2, to: values.count, by: 2).map { CGPoint(x: values[$0], y: values[$0 + 1]) }
        }
    }

    let frameDuration: TimeInterval
    let frames: [[Mark]]
    let isReference: Bool

    private struct FrameData: Decodable {
        let ms: Double
        let frames: [[[Double]]]
    }

    init?(compressed: Data, isReference: Bool) {
        guard let expanded = try? (compressed as NSData).decompressed(using: .zlib),
              let data = try? JSONDecoder().decode(FrameData.self, from: expanded as Data),
              (30...10_000).contains(data.ms), (2...90).contains(data.frames.count) else { return nil }
        let frames = data.frames.map { $0.compactMap(Mark.init) }
        guard zip(frames, data.frames).allSatisfy({ !$0.0.isEmpty && $0.0.count == $0.1.count }) else { return nil }
        self.frames = frames
        self.frameDuration = data.ms / 1000
        self.isReference = isReference
    }
}

enum NativeCatalogScope: Equatable, Sendable {
    case all, pinned, frequent
}

struct NativeCatalogIndex: Sendable {
    private struct RawIndex: Decodable {
        struct Row: Decodable {
            let id, name, en, part, equipment, type, target: String
            let muscles: [String: Int]
            let hold, distance: Bool?
        }
        let rows: [Row]
    }

    private struct Metadata: Decodable, Sendable {
        struct Family: Decodable, Sendable {
            let id, title, primary: String
            let note: String?
            let variants: [NativeCatalogVariant]
            let aliases: [String]
        }
        struct Section: Decodable, Sendable {
            let id, title, jumpLabel: String
            let equipment: [String]
        }
        struct Classification: Decodable, Sendable {
            let area, equipment, type: String
        }
        let areas: [NativeCatalogArea]
        let types: [String]
        let groups: [NativeCatalogGroup]
        let labels: [String: String]
        let muscleLabels: [String: String]
        let sections: [Section]
        let families: [Family]
        let trainingPatterns: [String: String]?
        let preferredFamilies: [String: String]
        let corrections: [String: String]
        let exactAliases: [String: String]?
        let classifications: [String: Classification]
        let covers: [String: [Int]]
        let videos: [String: String]
        let animations: [String: [Int]]?
        let drawings: [String: [Int]]?
        let referenceDrawings: [String]?
        let details: [String: [Int]]
    }

    private let metadata: Metadata
    private let rows: [NativeCatalogEntry]
    private let rowsByID: [String: NativeCatalogEntry]
    private let rowsByExactName: [String: NativeCatalogEntry]
    private let familiesByRow: [String: Metadata.Family]
    private let variantsByRow: [String: NativeCatalogVariant]
    private let rowsByTrainingPattern: [String: [NativeCatalogEntry]]
    private let knownNames: Set<String>
    private let sectionsByEquipment: [String: String]
    private let searchContextByID: [String: String]
    private let assetsURL: URL
    private let covers: Data
    private let details: Data

    let equipmentOptions: [String]
    var areas: [NativeCatalogArea] { metadata.areas }
    var types: [String] { metadata.types }
    var groups: [NativeCatalogGroup] { metadata.groups }

    static let bundled = Task.detached(priority: .userInitiated) { try load() }

    static func load() throws -> Self {
        guard let index = Bundle.main.url(forResource: "index", withExtension: "json"),
              let metadata = Bundle.main.url(forResource: "metadata", withExtension: "json", subdirectory: "NativeCatalogueAssets") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Self(indexURL: index, assetsURL: metadata.deletingLastPathComponent())
    }

    init(indexURL: URL, assetsURL: URL) throws {
        let decoder = JSONDecoder()
        let metadata = try decoder.decode(Metadata.self, from: Data(contentsOf: assetsURL.appendingPathComponent("metadata.json")))
        let base = try decoder.decode(RawIndex.self, from: Data(contentsOf: indexURL))
        let rows = base.rows.map { row in
            NativeCatalogEntry(id: row.id, name: row.name, en: row.en, part: row.part, equipment: row.equipment,
                               type: row.type, target: row.target, muscles: row.muscles, isPersonal: false,
                               hasCover: metadata.covers[row.id] != nil, hold: row.hold ?? false, distance: row.distance ?? false)
        }
        self.metadata = metadata
        self.assetsURL = assetsURL
        self.rows = rows
        rowsByID = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let namedRows = rows.flatMap { row in
            Set([Self.identityKey(row.name), Self.identityKey(row.en)]).map { (key: $0, row: row) }
        }
        rowsByExactName = Dictionary(grouping: namedRows.filter { !$0.key.isEmpty }, by: { $0.key })
            .compactMapValues { $0.count == 1 ? $0[0].row : nil }
        familiesByRow = Dictionary(metadata.families.flatMap { family in family.variants.map { ($0.id, family) } },
                                   uniquingKeysWith: { first, _ in first })
        variantsByRow = Dictionary(metadata.families.flatMap(\.variants).map { ($0.id, $0) },
                                   uniquingKeysWith: { first, _ in first })
        let patterns = metadata.trainingPatterns ?? [:]
        let grouped = Dictionary(grouping: rows.filter { patterns[$0.id] != nil }, by: { patterns[$0.id] ?? "" })
        rowsByTrainingPattern = grouped.mapValues { entries in
            entries.filter { entry in
                entry.en.range(of: #"\b(?:pov|(?:side|back|front|rear|left|right) view|form checks?|technique checks?)\b"#,
                               options: [.regularExpression, .caseInsensitive]) == nil
            }
        }
        knownNames = Set(rows.flatMap { [$0.normalizedName, $0.normalizedEnglish] } + metadata.families.flatMap(\.aliases))
        sectionsByEquipment = Dictionary(metadata.sections.flatMap { section in section.equipment.map { ($0, section.id) } },
                                         uniquingKeysWith: { first, _ in first })
        searchContextByID = Dictionary(rows.map { row in
            let terms = [row.part, row.equipment, row.target].map { metadata.labels[$0] ?? $0 }.joined(separator: " ")
            return (row.id, catalogSearchKey(terms))
        }, uniquingKeysWith: { first, _ in first })
        equipmentOptions = Self.equipmentChoices(in: rows)
        covers = try Data(contentsOf: assetsURL.appendingPathComponent("covers.bin"), options: .mappedIfSafe)
        details = try Data(contentsOf: assetsURL.appendingPathComponent("details.bin"), options: .mappedIfSafe)
    }

    func entry(withID id: String) -> NativeCatalogEntry? { rowsByID[id] }

    func entry(exactName name: String, catalogueID: String = "") -> NativeCatalogEntry? {
        let key = exactNameKey(name)
        let named = metadata.exactAliases?[key].flatMap(entry(withID:)) ?? rowsByExactName[key]
        if catalogueID.isEmpty { return named }
        guard named == nil || named?.id == catalogueID else { return nil }
        return entry(withID: catalogueID)
    }

    func isPersonalVariant(named name: String, library: [NativeJSON]) -> Bool {
        let key = exactNameKey(name)
        return library.contains { row in
            row["kind"].string == "exercise" && !row["item"]["versionOf"].string.isEmpty
                && exactNameKey(row["item"]["name"].string) == key
        }
    }

    private func exactNameKey(_ name: String) -> String {
        Self.identityKey(exerciseName(name, preservingQualifiers: true))
    }

    func label(_ value: String) -> String { metadata.labels[value] ?? value }
    func muscleLabel(_ value: String) -> String { metadata.muscleLabels[value] ?? label(value) }

    func knows(_ name: String) -> Bool { knownNames.contains(nameKey(name)) }

    func nameKey(_ name: String) -> String { catalogSearchKey(exerciseName(name)) }

    func exerciseName(_ raw: String) -> String { exerciseName(raw, preservingQualifiers: false) }

    private func exerciseName(_ raw: String, preservingQualifiers: Bool) -> String {
        let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let slot = name.range(of: #"^(?:[A-Z]\d+\s+|[A-Z]\s+热身组\s*·\s*|E\s+(?![A-Za-z]))"#, options: .regularExpression) else {
            return canonicalName(name)
        }
        let remainder = String(name[slot.upperBound...])
        let suffix = preservingQualifiers ? #"(?:\s*·\s*.+)?$"# : #"(?:（[^（）]+）)?(?:\s*·\s*.+)?$"#
        let value = remainder.replacingOccurrences(of: suffix, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return canonicalName(value.isEmpty ? name : value)
    }

    func makePersonal(name raw: String, classification: NativeJSON? = nil, muscles: [String: Int] = [:]) -> NativeCatalogEntry {
        let name = exerciseName(raw)
        let key = catalogSearchKey(name)
        let guide = metadata.classifications[key.replacingOccurrences(of: " ", with: "")]
        let area = nonempty(classification?["area"].string) ?? guide?.area ?? ""
        let parts = area.split(separator: ":", maxSplits: 1)
        return NativeCatalogEntry(id: "custom:" + key, name: name, en: "", part: parts.first.map(String.init) ?? "",
                                  equipment: nonempty(classification?["equipment"].string) ?? guide?.equipment ?? "",
                                  type: nonempty(classification?["type"].string) ?? guide?.type ?? "",
                                  target: parts.count > 1 ? String(parts[1]) : "", muscles: muscles,
                                  isPersonal: true, hasCover: false)
    }

    func family(for entry: NativeCatalogEntry) -> NativeCatalogFamily? {
        guard let record = familiesByRow[entry.id] else { return nil }
        return NativeCatalogFamily(id: record.id, title: record.title, note: record.note,
                                   variants: record.variants.compactMap { rowsByID[$0.id] })
    }

    func variant(for entry: NativeCatalogEntry) -> NativeCatalogVariant? { variantsByRow[entry.id] }

    func relatedExercises(for entry: NativeCatalogEntry, excluding ids: Set<String>) -> [NativeCatalogEntry] {
        guard let pattern = metadata.trainingPatterns?[entry.id], let candidates = rowsByTrainingPattern[pattern] else { return [] }
        let existing = ids.union([entry.id])
        let representedFamilies = Set(existing.compactMap { familiesByRow[$0]?.id })
        let ranked = candidates.filter { candidate in
            guard candidate.target == entry.target, !existing.contains(candidate.id) else { return false }
            if let family = familiesByRow[candidate.id] {
                return family.primary == candidate.id && !representedFamilies.contains(family.id)
            }
            return true
        }.sorted { lhs, rhs in
            func rank(_ candidate: NativeCatalogEntry) -> (Int, Int, Int, String) {
                let video = metadata.videos[candidate.id] ?? ""
                return (candidate.equipment == entry.equipment ? 0 : 1,
                        video.hasPrefix("/open-gym/spotter-3d/") ? 0 : 1, candidate.en.count, candidate.id)
            }
            return rank(lhs) < rank(rhs)
        }
        var usedNames = Set(existing.compactMap { rowsByID[$0]?.normalizedName })
        return Array(ranked.filter { usedNames.insert($0.normalizedName).inserted }.prefix(6))
    }

    func coverData(for entry: NativeCatalogEntry) -> Data? { asset(in: covers, range: metadata.covers[entry.id]) }

    func animationData(for entry: NativeCatalogEntry) -> Data? {
        mediaData(in: "motion", at: metadata.animations?[entry.id])
    }

    func drawing(for entry: NativeCatalogEntry) -> NativeCatalogDrawing? {
        guard let data = mediaData(in: "drawing", at: metadata.drawings?[entry.id]) else { return nil }
        return NativeCatalogDrawing(compressed: data, isReference: metadata.referenceDrawings?.contains(entry.id) == true)
    }

    func bundledVideoURL(for entry: NativeCatalogEntry) -> URL? {
        guard let path = metadata.videos[entry.id] else { return nil }
        let oldPrefix = "/open-gym/demo-video/"
        let prefix = "/open-gym/"
        let relativePath: Substring
        if path.hasPrefix(oldPrefix) {
            relativePath = path.dropFirst(oldPrefix.count)
        } else if path == prefix + "spotter-3d/" + entry.id + ".mp4" {
            relativePath = path.dropFirst(prefix.count)
        } else {
            return nil
        }
        let components = relativePath.split(separator: "/", omittingEmptySubsequences: false)
        guard components.count > 0, components.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else { return nil }
        let video = components.reduce(assetsURL.appendingPathComponent("video", isDirectory: true)) { url, component in
            url.appendingPathComponent(String(component))
        }
        return FileManager.default.isReadableFile(atPath: video.path) ? video : nil
    }

    func videoURL(for entry: NativeCatalogEntry) -> URL? {
        guard let path = metadata.videos[entry.id] else { return nil }
        return URL(string: AppConfiguration.defaultOrigin + path)
    }

    func details(for entry: NativeCatalogEntry) throws -> NativeCatalogDetailText? {
        guard let number = Int(entry.id),
              let bytes = asset(in: details, range: metadata.details[String(number / 100)]) else { return nil }
        return try JSONDecoder().decode([String: NativeCatalogDetailText].self, from: bytes)[entry.id]
    }

    func results(query: String = "", area: String = "", type: String = "", equipment: String = "",
                 terms: Set<String> = [], any: Bool = false, gear: Set<String> = [], scope: NativeCatalogScope = .all,
                 favorites: Set<String> = [], frequent: Set<String> = [], personal: [NativeCatalogEntry] = [],
                 byMuscle: Bool = false) -> NativeCatalogResults {
        let phrase = catalogSearchKey(canonicalName(query))
        let words = phrase.split(separator: " ").map(String.init)
        let preferredFamily = metadata.preferredFamilies[phrase]
        let preferredMuscles = terms.map { term in metadata.groups.first { "group:" + $0.id == term }?.muscles ?? [term] }
        let favoriteNames = Set(favorites.map { catalogSearchKey(exerciseName($0)) })
        let frequentNames = Set(frequent.map { catalogSearchKey(exerciseName($0)) })
        let customRows = personal.filter { $0.isPersonal && !knownNames.contains($0.normalizedName) }
            .reduce(into: [NativeCatalogEntry]()) { result, entry in
                if !result.contains(where: { $0.id == entry.id }) { result.append(entry) }
            }
        let modifiersPattern = #"杠铃|哑铃|壶铃|绳索|弹力带|自重|史密斯|器械|上斜|下斜|平板|跪姿|坐姿|站姿|单臂|单腿|负重|助力|后踢"#
        let modifiers = substrings(in: phrase, matching: modifiersPattern)
        let bench = benchSearch(phrase)
        var scores: [String: Int] = [:]
        let matching = (rows + customRows).filter { row in
            guard matchesArea(row, area), gear.isEmpty || row.equipment == "body weight" || gear.contains(row.equipment) else { return false }
            if scope == .pinned && !favoriteNames.contains(row.normalizedName) { return false }
            if scope == .frequent && !frequentNames.contains(row.normalizedName) { return false }
            if !preferredMuscles.isEmpty {
                let hit = preferredMuscles.map { group in group.contains { (row.muscles[$0] ?? 0) > 0 || (row.target == "shins" && $0 == "tibialis") } }
                if any ? !hit.contains(true) : hit.contains(false) { return false }
            }
            guard !words.isEmpty else { return true }
            let family = familiesByRow[row.id]
            if let preferredFamily, family?.id != preferredFamily { return false }
            let terms = searchContextByID[row.id] ?? catalogSearchKey([row.part, row.equipment, row.target].map(label).joined(separator: " "))
            let ownText = [row.normalizedName, row.normalizedEnglish, terms].joined(separator: " ")
            let aliases = family?.aliases ?? []
            let related = ownText + " " + aliases.joined(separator: " ")
            let familyMatch = modifiers.allSatisfy { ownText.contains($0) } && words.allSatisfy { related.contains($0) }
            let benchMatch = bench.map { matchesBench(row, angle: $0.angle, gear: $0.gear) } ?? false
            guard words.allSatisfy({ ownText.contains($0) }) || familyMatch || benchMatch else { return false }
            let exact = row.normalizedName == phrase || row.normalizedEnglish == phrase
            let starts = row.normalizedName.hasPrefix(phrase) || row.normalizedEnglish.hasPrefix(phrase)
            scores[row.id] = exact ? 4 : (benchMatch || (familyMatch && aliases.contains(phrase)) ? 3 : (starts ? 2 : 1))
            return true
        }

        let validTypes = Set(matching.map(\.type))
        let typeOptions = types.filter { validTypes.contains($0) }
        let activeType = typeOptions.contains(type) ? type : ""
        let typed = activeType.isEmpty ? matching : matching.filter { $0.type == activeType }
        let allowedEquipment = Self.equipmentChoices(in: typed)
        let activeEquipment = allowedEquipment.contains(equipment) ? equipment : ""
        let filtered = activeEquipment.isEmpty ? typed : typed.filter { $0.equipment == activeEquipment }
        let included = Set(filtered.map(\.id))
        let sortRows = filtered.filter { !$0.isPersonal }.sorted { left, right in
            let leftScore = scores[left.id] ?? 0
            let rightScore = scores[right.id] ?? 0
            if leftScore != rightScore { return leftScore > rightScore }
            let leftPinned = favoriteNames.contains(left.normalizedName)
            let rightPinned = favoriteNames.contains(right.normalizedName)
            if leftPinned != rightPinned { return leftPinned }
            let leftUsed = frequentNames.contains(left.normalizedName)
            let rightUsed = frequentNames.contains(right.normalizedName)
            if !words.isEmpty && leftUsed != rightUsed { return leftUsed }
            return left.hasCover && !right.hasCover
        }
        var seenFamilies = Set<String>()
        let collapsed = sortRows.compactMap { row -> NativeCatalogEntry? in
            guard let family = familiesByRow[row.id] else { return row }
            guard seenFamilies.insert(family.id).inserted else { return nil }
            let keepVariant = scores[row.id] == 4 || favoriteNames.contains(row.normalizedName)
            if !keepVariant, included.contains(family.primary), let primary = rowsByID[family.primary],
               !row.hasCover || primary.hasCover { return primary }
            return row
        }
        let custom = filtered.filter(\.isPersonal)
        let sections = words.isEmpty
            ? groupedSections(builtIn: collapsed, personal: custom, favoriteNames: favoriteNames)
            : [NativeCatalogSection(id: "search", title: "搜索结果", jumpLabel: "", rows: custom + collapsed)]
                .filter { !$0.rows.isEmpty }
        let featured = words.isEmpty && scope == .all && !area.hasPrefix("custom") && terms.isEmpty && !byMuscle
            && activeType.isEmpty && activeEquipment.isEmpty ? featuredRows(from: collapsed) : []
        return NativeCatalogResults(sections: sections, featured: featured, count: collapsed.count + custom.count,
                                    typeOptions: typeOptions, equipmentOptions: allowedEquipment,
                                    activeType: activeType, activeEquipment: activeEquipment)
    }

    private func canonicalName(_ raw: String) -> String {
        metadata.corrections[Self.identityKey(raw)] ?? raw
    }

    private static func identityKey(_ raw: String) -> String {
        raw.precomposedStringWithCompatibilityMapping.lowercased()
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    func matchesArea(_ row: NativeCatalogEntry, _ area: String) -> Bool {
        if area.isEmpty { return true }
        if area == "custom" { return row.isPersonal }
        if area == "custom:unclassified" { return row.isPersonal && row.part.isEmpty }
        if area.hasPrefix("muscle:") { return row.target == String(area.dropFirst("muscle:".count)) }
        let parts = area.split(separator: ":", maxSplits: 1)
        guard let part = parts.first, row.part == part else { return false }
        if parts.count == 1 || row.target == parts[1] { return true }
        if area == "back:thoracic" { return row.en.range(of: #"\bthoracic\b"#, options: .regularExpression) != nil }
        if area == "shoulders:rotator cuff" {
            return row.en.range(of: #"\b((external|internal) rotation|rotator cuff)\b"#, options: .regularExpression) != nil
        }
        return false
    }

    private static func equipmentChoices(in rows: [NativeCatalogEntry]) -> [String] {
        let groups = Dictionary(grouping: rows.filter { !$0.equipment.isEmpty }, by: \.equipment)
        return groups.keys.sorted { left, right in
            let a = groups[left]?.count ?? 0
            let b = groups[right]?.count ?? 0
            return a == b ? left < right : a > b
        }
    }

    private func groupedSections(builtIn: [NativeCatalogEntry], personal: [NativeCatalogEntry],
                                 favoriteNames: Set<String>) -> [NativeCatalogSection] {
        let pinned = NativeCatalogSection(id: "pinned", title: "置顶", jumpLabel: "置", rows: [])
        let custom = NativeCatalogSection(id: "custom", title: "自定义动作", jumpLabel: "自订", rows: [])
        var sections = [pinned] + metadata.sections.map { section in
            NativeCatalogSection(id: section.id, title: section.title, jumpLabel: section.jumpLabel, rows: [])
        } + [custom]
        if !sections.contains(where: { $0.id == "other" }) {
            sections.insert(NativeCatalogSection(id: "other", title: "其他器材", jumpLabel: "其他", rows: []), at: sections.count - 1)
        }
        let order = Dictionary(sections.enumerated().map { ($0.element.id, $0.offset) }, uniquingKeysWith: { first, _ in first })
        for row in personal + builtIn {
            let id = favoriteNames.contains(row.normalizedName) ? "pinned"
                : (row.isPersonal ? "custom" : sectionsByEquipment[row.equipment] ?? "other")
            if let position = order[id] { sections[position].rows.append(row) }
        }
        return sections.filter { !$0.rows.isEmpty }
    }

    private func featuredRows(from rows: [NativeCatalogEntry]) -> [NativeCatalogEntry] {
        let curated = ["0576", "0289", "0025"].compactMap { id in
            rows.first { (familiesByRow[$0.id]?.id ?? $0.id) == (familiesByRow[id]?.id ?? id) }
        }
        var seen = Set<String>()
        return Array((curated + Array(rows.filter(\.hasCover).prefix(3))).filter { seen.insert($0.id).inserted }.prefix(3))
    }

    private func benchSearch(_ phrase: String) -> (angle: String, gear: String)? {
        guard let regex = try? NSRegularExpression(pattern: #"^([^ ]*?)(平板|上斜|下斜)([^ ]*)卧推$"#),
              let match = regex.firstMatch(in: phrase, range: NSRange(phrase.startIndex..., in: phrase)),
              let left = Range(match.range(at: 1), in: phrase), let angle = Range(match.range(at: 2), in: phrase),
              let right = Range(match.range(at: 3), in: phrase) else { return nil }
        return (String(phrase[angle]), String(phrase[left]) + String(phrase[right]))
    }

    private func matchesBench(_ entry: NativeCatalogEntry, angle: String, gear: String) -> Bool {
        let name = entry.normalizedEnglish
        guard gear.isEmpty || gear == label(entry.equipment), name.range(of: #"\bbench press\b"#, options: .regularExpression) != nil,
              name.range(of: #"\b(?:floor|bridge|side lying|stability ball|exercise ball|form check|catch)\b"#, options: .regularExpression) == nil
        else { return false }
        let incline = name.range(of: #"\bincline(?:d)?\b"#, options: .regularExpression) != nil
        let decline = name.range(of: #"\bdecline(?:d)?\b"#, options: .regularExpression) != nil
        return angle == (incline ? "上斜" : (decline ? "下斜" : "平板"))
    }

    private func substrings(in value: String, matching pattern: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        return regex.matches(in: value, range: NSRange(value.startIndex..., in: value)).compactMap {
            Range($0.range, in: value).map { String(value[$0]) }
        }
    }

    private func asset(in data: Data, range: [Int]?) -> Data? {
        guard let range, range.count == 2, range[0] >= 0, range[0] <= data.count,
              range[1] > 0, range[1] <= data.count - range[0] else { return nil }
        return data.subdata(in: range[0]..<(range[0] + range[1]))
    }

    private func mediaData(in prefix: String, at location: [Int]?) -> Data? {
        guard let location, location.count == 3, location[0] >= 0,
              let data = try? Data(contentsOf: assetsURL.appendingPathComponent("\(prefix)-\(location[0]).bin"), options: .mappedIfSafe)
        else { return nil }
        return asset(in: data, range: [location[1], location[2]])
    }

    private func nonempty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}

private func catalogSearchKey(_ value: String) -> String {
    value.lowercased().precomposedStringWithCompatibilityMapping
        .replacingOccurrences(of: #"[^\p{L}\p{N}]+"#, with: " ", options: .regularExpression)
        .replacingOccurrences(of: #"\s*\bv\s*(\d+)\b"#, with: " v$1", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}
