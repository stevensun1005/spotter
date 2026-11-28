import AVFoundation
import CryptoKit
import PhotosUI
import SwiftUI
import UIKit
import Vision

// MARK: - Built-in food catalog

/// A household portion from the shared food catalog, e.g. "1 个（中）" = 50 g.
struct NativeFoodPortion: Codable, Hashable, Identifiable, Sendable {
    let name: String
    let grams: Double

    var id: String { name + "/" + nutritionInput(grams) }
    var label: String { name + " · " + nutritionNumber(grams) + " g" }
    var isPackagedUnit: Bool { name == "个" || name == "份" }

    func amountLabel(_ count: Double) -> String {
        isPackagedUnit ? "\(nutritionInput(count)) \(name)" : "\(nutritionInput(count)) × \(name)"
    }
}

/// `cloudflare/shared/food-catalog.json`, bundled into the app and imported by the web nutrition tools.
struct NativeFoodCatalog: Decodable {
    struct Subgroup: Decodable, Hashable, Identifiable {
        let id: String
        let name: String
    }

    struct Category: Decodable, Hashable, Identifiable {
        let id: String
        let name: String
        let emoji: String
        let title: String
        let summary: String
        let groups: [Subgroup]
    }

    struct Source: Decodable {
        let title: String
        let url: String?
    }

    struct Item: Decodable {
        let id: String
        let name: String
        let en: String?
        let aliases: [String]?
        let emoji: String?
        let category: String
        let group: String
        let per100g: NativeNutritionFood.Facts
        let portions: [NativeFoodPortion]?
        let brand: String?
        let src: String?
        let ref: String?
    }

    let categories: [Category]
    let sources: [String: Source]
    let foods: [Item]

    static let shared: NativeFoodCatalog? = {
        guard let url = Bundle.main.url(forResource: "food-catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url, options: .mappedIfSafe) else { return nil }
        return try? JSONDecoder().decode(NativeFoodCatalog.self, from: data)
    }()

    var nutritionFoods: [NativeNutritionFood] {
        foods.map { item in
            var food = NativeNutritionFood(id: item.id, name: item.name,
                                           aliases: (item.en.map { [$0] } ?? []) + (item.aliases ?? []), facts: item.per100g)
            food.emoji = item.emoji
            food.category = item.category
            food.group = item.group
            food.portions = (item.portions ?? []).filter { $0.grams > 0 && $0.grams <= 3_000 }
            food.brand = item.brand.flatMap { $0.isEmpty ? nil : $0 }
            food.detail = [item.brand, item.en].compactMap { $0 }.filter { !$0.isEmpty }.first
            if let key = item.src, let source = sources[key] {
                if let ref = item.ref, let host = URL(string: ref)?.host, ref.hasPrefix("https://") {
                    food.source = source.title + " · " + (host.hasPrefix("www.") ? String(host.dropFirst(4)) : host)
                } else {
                    food.source = source.title + (item.ref.map { " · " + $0 } ?? "")
                }
            }
            return food
        }
    }
}

extension NativeNutritionFood {
    static func searchKey(_ text: String) -> String {
        text.folding(options: [.widthInsensitive, .diacriticInsensitive, .caseInsensitive], locale: .current)
            .filter { $0.isLetter || $0.isNumber }
    }

    /// Lower is better: exact name, exact alias, name start, a word inside the name, any alias from the start of
    /// one of its words, then every typed word somewhere, then a longer phrase that contains the name. `nil` means
    /// no match. Whole-alias and later-word matches share a tier, so "steak" finds striploin steak before
    /// "steak sauce". The web's `searchFoods` ranks the first five tiers the same way. The last two help when
    /// someone types several foods or a sentence, such as "鸡胸 米饭" or "我吃了米饭".
    func searchRank(_ query: NativeFoodSearchQuery, keys preparedKeys: [NativeFoodSearchKey]? = nil) -> Int? {
        let needle = query.needle
        guard !needle.isEmpty else { return 0 }
        let keys = preparedKeys ?? NativeFoodSearchIndex.keys(for: self)
        guard let name = keys.first else { return nil }
        let aliases = keys.dropFirst()
        if name.key == needle { return 0 }
        if aliases.contains(where: { $0.key == needle }) { return 1 }
        if name.key.hasPrefix(needle) { return 2 }
        if name.fromAWord(needle) { return 3 }
        if aliases.contains(where: { $0.fromAWord(needle) }) { return 4 }
        if query.tokens.count > 1, query.tokens.allSatisfy({ token in keys.contains { $0.fromAWord(token) } }) { return 5 }
        if keys.contains(where: { $0.key.count >= 2 && query.runs.contains($0.key) }) { return 6 }
        return nil
    }
}

/// A searchable label. Labels match from the start of a word, so "tea" does not find "sirloin steak" and "pie"
/// does not find "Rice Krispies", while "big mac" still finds "McDonald's Big Mac" and "饭" finds "米饭".
struct NativeFoodSearchKey {
    let key: String
    /// The label joined from each word onward: "big mac" gives "bigmac" and "mac", and "米饭" gives "米饭" and "饭".
    let fromWords: [String]

    init(_ label: String) {
        let words = Self.words(label)
        key = words.joined()
        fromWords = words.indices.map { words[$0...].joined() }
    }

    /// True when the needle starts at the beginning of one of the label's words.
    func fromAWord(_ needle: String) -> Bool {
        fromWords.contains { $0.hasPrefix(needle) }
    }

    /// The label's words after folding width, case and accents. Latin words stay whole, and each Chinese,
    /// Japanese or Korean character is a word of its own. Joined, they equal `NativeNutritionFood.searchKey`.
    static func words(_ label: String) -> [String] {
        var words: [String] = []
        var run = ""
        for character in label.folding(options: [.widthInsensitive, .diacriticInsensitive, .caseInsensitive], locale: .current) {
            guard character.isLetter || character.isNumber else {
                if !run.isEmpty { words.append(run); run = "" }
                continue
            }
            if character.unicodeScalars.contains(where: isEastAsian) {
                if !run.isEmpty { words.append(run); run = "" }
                words.append(String(character))
            } else {
                run.append(character)
            }
        }
        if !run.isEmpty { words.append(run) }
        return words
    }

    private static func isEastAsian(_ scalar: Unicode.Scalar) -> Bool {
        scalar.properties.isIdeographic || (0x3040...0x30FF).contains(scalar.value)
            || (0x1100...0x11FF).contains(scalar.value) || (0xAC00...0xD7AF).contains(scalar.value)
    }
}

/// What someone typed in the food search, folded the same way as food labels.
struct NativeFoodSearchQuery {
    let needle: String
    /// The query split at spaces and commas.
    let tokens: [String]
    /// Every run of up to 12 whole words in the query, joined: "egg plant" gives "egg", "plant" and "eggplant",
    /// so a food named "egg" matches it while "eggplant" alone does not.
    let runs: Set<String>

    init(_ text: String) {
        needle = NativeNutritionFood.searchKey(text)
        tokens = text.split(whereSeparator: { $0.isWhitespace || $0 == "," || $0 == "，" })
            .map { NativeNutritionFood.searchKey(String($0)) }.filter { !$0.isEmpty }
        let words = Array(NativeFoodSearchKey.words(text).prefix(80))
        var runs = Set<String>()
        for start in words.indices {
            var run = ""
            for word in words[start...].prefix(12) {
                run += word
                runs.insert(run)
            }
        }
        self.runs = runs
    }
}

private enum NativeFoodSearchIndex {
    private struct IndexedFood {
        let food: NativeNutritionFood
        let keys: [NativeFoodSearchKey]

        init(_ food: NativeNutritionFood) {
            self.food = food
            self.keys = NativeFoodSearchIndex.keys(for: food)
        }
    }

    private static let catalog = NativeNutritionFood.builtIn.map(IndexedFood.init)
    private static let catalogByID = Dictionary(
        catalog.map { ($0.food.id, $0) }, uniquingKeysWith: { first, _ in first }
    )

    static func keys(for food: NativeNutritionFood) -> [NativeFoodSearchKey] {
        ([food.name] + food.aliases).map(NativeFoodSearchKey.init).filter { !$0.key.isEmpty }
    }

    static func matching(_ foods: [NativeNutritionFood], text: String, includeCatalog: Bool) -> [NativeNutritionFood] {
        let query = NativeFoodSearchQuery(text)
        guard !query.needle.isEmpty else { return includeCatalog ? foods + NativeNutritionFood.builtIn : foods }

        let indexed = foods.map { food in
            if !food.isPersonal, let existing = catalogByID[food.id] { return existing }
            return IndexedFood(food)
        }
        let candidates = includeCatalog ? indexed + catalog : indexed
        // Each rank has a bucket for everyday foods and one for branded foods. Append in source order.
        var matches = Array(repeating: [NativeNutritionFood](), count: 14)
        for (index, candidate) in candidates.enumerated() {
            if index.isMultiple(of: 32), Task.isCancelled { return [] }
            guard let rank = candidate.food.searchRank(query, keys: candidate.keys) else { continue }
            let bucket = rank * 2 + (candidate.food.brand == nil ? 0 : 1)
            matches[bucket].append(candidate.food)
        }
        return Array(matches.joined().prefix(80))
    }
}

private let nativeFoodQueryPatterns: [(NSRegularExpression, name: Int, grams: Int)] = {
    // Keep g/grams out of Latin words and prevent a trailing amount from beginning inside another number.
    let amount = "(\\d+(?:\\.\\d+)?)\\s*(?:公克|克|(?:grams?|g)(?!\\p{Script=Latin}))"
    let patterns = [("^(.+?)\\s*(?<![\\d.])" + amount + "$", 1, 2), ("^" + amount + "\\s*(.+)$", 2, 1)]
    return patterns.compactMap { pattern, name, grams in
        (try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])).map { ($0, name, grams) }
    }
}()

/// Splits "鸡胸肉 150g" or "150 克 米饭" into the food name and an optional gram amount.
private func nativeFoodQuery(_ input: String) -> (name: String, grams: Double?) {
    let value = input.precomposedStringWithCompatibilityMapping.trimmingCharacters(in: .whitespacesAndNewlines)
    let range = NSRange(value.startIndex..., in: value)
    for (regex, nameGroup, gramsGroup) in nativeFoodQueryPatterns {
        guard let match = regex.firstMatch(in: value, range: range),
              let nameRange = Range(match.range(at: nameGroup), in: value),
              let gramsRange = Range(match.range(at: gramsGroup), in: value),
              let grams = Double(value[gramsRange]), (0.1...3_000).contains(grams) else { continue }
        return (String(value[nameRange]).trimmingCharacters(in: .whitespaces), grams)
    }
    return (value, nil)
}

// MARK: - Per-device food preferences

/// Starred foods and remembered barcodes. Kept on this iPhone per account, like 常用餐.
@MainActor
struct NativeFoodLocalStore {
    let api: NativeAPI
    let owner: String

    private var scope: String {
        SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
    }
    private var favoritesKey: String { "spotter.native.food.favorites." + scope }
    private var barcodesKey: String { "spotter.native.food.barcodes." + scope }

    var favorites: [String] { UserDefaults.standard.stringArray(forKey: favoritesKey) ?? [] }

    func setFavorite(_ id: String, _ favorite: Bool) -> [String] {
        var ids = favorites.filter { $0 != id }
        if favorite { ids.insert(id, at: 0) }
        ids = Array(ids.prefix(300))
        UserDefaults.standard.set(ids, forKey: favoritesKey)
        return ids
    }

    func food(forBarcode code: String) -> String? {
        (UserDefaults.standard.dictionary(forKey: barcodesKey) as? [String: String])?[code]
    }

    /// `known` lists every personal food id that still exists, so mappings to deleted foods are dropped first.
    /// Pass `nil` while the account's foods have not loaded, and only the 500-code limit applies.
    func remember(barcode code: String, food id: String, known: Set<String>?) {
        var codes = (UserDefaults.standard.dictionary(forKey: barcodesKey) as? [String: String]) ?? [:]
        codes[code] = id
        if codes.count > 500, let known { codes = codes.filter { $0.key == code || known.contains($0.value) } }
        while codes.count > 500, let stale = codes.keys.first(where: { $0 != code }) { codes[stale] = nil }
        UserDefaults.standard.set(codes, forKey: barcodesKey)
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: favoritesKey)
        UserDefaults.standard.removeObject(forKey: barcodesKey)
    }
}

// MARK: - Selected foods

struct NativeMealLoggerItem: Identifiable, Equatable {
    typealias Facts = NativeNutritionFood.Facts

    var id = UUID().uuidString.lowercased()
    var name: String
    var emoji: String?
    var foodId: String?
    var proteinProductId: String?
    /// Catalog or personal foods scale from per-100 g values.
    var per100g: Facts?
    var grams: Double?
    var portion: NativeFoodPortion?
    /// Templates and hand-entered items keep fixed values for one serving.
    var serving: Facts?
    var servingGrams: Double?
    var servings: Double = 1

    init(food: NativeNutritionFood, grams: Double, portion: NativeFoodPortion? = nil) {
        name = food.name
        emoji = food.emoji
        foodId = food.id
        per100g = food.facts
        self.grams = grams
        self.portion = portion
    }

    init(name: String, emoji: String? = nil, serving: Facts, grams: Double?, foodId: String? = nil, proteinProductId: String? = nil) {
        self.name = name
        self.emoji = emoji
        self.serving = serving
        servingGrams = grams
        self.foodId = foodId
        self.proteinProductId = proteinProductId
    }

    var totalGrams: Double? {
        if per100g != nil { return grams }
        return servingGrams.map { $0 * servings }
    }

    var selectedQuantity: Double {
        if per100g == nil { return servings }
        guard let grams, let portion, portion.grams > 0 else { return 1 }
        return grams / portion.grams
    }

    var facts: Facts {
        if let per100g, let grams { return per100g.scaled(grams) }
        guard let serving else { return Facts(calories: 0, protein: 0, carbs: 0, fat: 0) }
        return Facts(calories: serving.calories * servings, protein: serving.protein * servings,
                     carbs: serving.carbs * servings, fat: serving.fat * servings)
    }

    var amountText: String {
        if per100g != nil, let grams {
            if let portion {
                return portion.amountLabel(selectedQuantity) + " · " + nutritionNumber(grams) + " g"
            }
            return nutritionNumber(grams) + " g"
        }
        let base = "\(nutritionInput(selectedQuantity)) 份"
        return totalGrams.map { base + " · " + nutritionNumber($0) + " g" } ?? base
    }

    /// Steps by a whole portion, 10 g, or half a serving.
    mutating func step(_ direction: Double) {
        if per100g != nil {
            let unit = portion?.grams ?? 10
            let next = ((grams ?? 0) + direction * unit)
            let minimum = portion.map { $0.isPackagedUnit ? $0.grams : $0.grams / 2 } ?? 1
            grams = min(3_000, max(minimum, (next * 100).rounded() / 100))
        } else {
            servings = min(20, max(0.5, servings + direction * 0.5))
        }
    }

    func entry(meal: NutritionShortcut) -> [String: Any]? {
        func rounded(_ value: Double) -> Double { (value * 100).rounded() / 100 }
        let values = facts
        let name = self.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let macros = [values.protein, values.carbs, values.fat].map(rounded)
        guard meal.isMeal, (1...100).contains(name.utf16.count), (0...30_000).contains(rounded(values.calories)),
              macros.allSatisfy({ (0...20_000).contains($0) }) else { return nil }
        var entry: [String: Any] = ["type": "meal", "meal": meal.rawValue, "name": name, "calories": rounded(values.calories),
                                    "protein": macros[0], "carbs": macros[1], "fat": macros[2]]
        if let grams = totalGrams {
            guard (0.1...3_000).contains(rounded(grams)) else { return nil }
            entry["grams"] = rounded(grams)
        }
        if let foodId, (1...80).contains(foodId.utf16.count) { entry["foodId"] = foodId }
        return entry
    }

    func record(meal: NutritionShortcut, day: String) -> [String: Any]? {
        guard let entry = entry(meal: meal) else { return nil }
        var record: [String: Any] = ["kind": "nutrition", "id": id, "date": day, "entry": entry]
        if let proteinProductId { record["proteinProductId"] = proteinProductId }
        return record
    }
}

extension NativeFavoriteMeal.Food {
    init(item: NativeMealLoggerItem) {
        let values = item.facts
        id = item.id
        name = item.name
        calories = (values.calories * 100).rounded() / 100
        protein = (values.protein * 100).rounded() / 100
        carbs = (values.carbs * 100).rounded() / 100
        fat = (values.fat * 100).rounded() / 100
        grams = item.totalGrams.map { ($0 * 100).rounded() / 100 }
        foodId = item.foodId
        proteinProductId = item.proteinProductId
    }
}

private let nativeMacroColors = (carbs: SpotterPalette.color(0x7764c3), protein: SpotterPalette.color(0xbd632f),
                                 fat: SpotterPalette.color(0xbd5061))

private struct NativeMacroLine: View {
    let facts: NativeNutritionFood.Facts
    var font: Font = .caption

    var body: some View {
        HStack(spacing: 5) {
            Text("碳 " + nutritionNumber(facts.carbs)).foregroundStyle(nativeMacroColors.carbs)
            Text("·").foregroundStyle(SpotterPalette.muted)
            Text("蛋 " + nutritionNumber(facts.protein)).foregroundStyle(nativeMacroColors.protein)
            Text("·").foregroundStyle(SpotterPalette.muted)
            Text("脂 " + nutritionNumber(facts.fat)).foregroundStyle(nativeMacroColors.fat)
        }
        .font(font.weight(.medium))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("碳水 \(nutritionNumber(facts.carbs)) 克，蛋白质 \(nutritionNumber(facts.protein)) 克，脂肪 \(nutritionNumber(facts.fat)) 克")
    }
}

private struct NativeFoodEmoji: View {
    let emoji: String?
    var size: CGFloat = 52

    var body: some View {
        Text(emoji?.isEmpty == false ? emoji! : "🍽️")
            .font(.system(size: size * 0.52))
            .frame(width: size, height: size)
            .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .accessibilityHidden(true)
    }
}

// MARK: - Meal logger

@MainActor
struct NativeMealLogger: View {
    fileprivate enum Tab: String, CaseIterable, Identifiable, Sendable {
        case search = "搜索", custom = "自定义", favorites = "收藏", templates = "固定模版"
        var id: Self { self }
    }

    private struct SearchRequest: Equatable, Sendable {
        let tab: Tab
        let text: String
        let foods: [NativeNutritionFood]
    }

    private struct SearchResult {
        let request: SearchRequest
        let foods: [NativeNutritionFood]
    }

    private struct Submission {
        let id = UUID().uuidString.lowercased()
        let meal: NutritionShortcut
        let records: [[String: Any]]
        let name: String
        var usesLegacy = false
    }

    private struct SavedBatch: Decodable {
        let rows: [NativeQuickMealReceipt.Row]
    }

    fileprivate enum Sheet: Identifiable {
        case portion(NativeNutritionFood, Double?)
        case basket
        case custom(NativeCustomFoodDraft)
        case manual

        var id: String {
            switch self {
            case .portion(let food, _): return "portion/" + food.id
            case .basket: return "basket"
            case .custom(let draft): return "custom/" + draft.id
            case .manual: return "manual"
            }
        }
    }

    fileprivate enum Cover: String, Identifiable {
        case scanner, camera
        var id: String { rawValue }
    }

    let api: NativeAPI
    let owner: String
    let date: String
    let payload: NutritionPayload
    let onSaved: (NativeQuickMealReceipt?) -> Void
    private let suggestedMeal: NutritionShortcut
    private let recents: [NativeRecentServing]
    private let savedPersonal: [NativeNutritionFood]

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterGuide) private var guide
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    @State private var tab = Tab.search
    @State private var query = ""
    @State private var searchResults: [Tab: SearchResult] = [:]
    @State private var category: String
    @State private var group: String?
    @State private var basket: [NativeMealLoggerItem] = []
    /// Personal foods saved in this sheet, shown before the payload's copy catches up.
    @State private var addedPersonal: [NativeNutritionFood] = []
    @State private var favorites: [String] = []
    @State private var templates: [NativeFavoriteMeal] = []
    @State private var sheet: Sheet?
    @State private var cover: Cover?
    @State private var queuedCover: Cover?
    @State private var carryDraft: NativeCustomFoodDraft?
    @State private var scannedCode: String?
    @State private var capturedPhoto: Data?
    @State private var showLibrary = false
    @State private var libraryChoice: PhotosPickerItem?
    @State private var working: String?
    @State private var notice: (id: UUID, text: String)?
    @State private var busy = false
    @State private var error: String?
    @State private var choosingMeal = false
    @State private var savingTemplate = false
    @State private var pendingSubmission: Submission?
    @State private var templateName = ""
    @FocusState private var searchFocused: Bool

    private static let catalog = NativeFoodCatalog.shared
    private static let mealOptions = NutritionShortcut.allCases.filter(\.isMeal)
    private static let foods = NativeNutritionFood.builtIn
    private static let foodsByCategory = Dictionary(grouping: foods) { $0.category ?? "" }
    private static let foodsByGroup = foodsByCategory.mapValues { foods in
        Dictionary(grouping: foods) { $0.group ?? "" }
    }

    init(api: NativeAPI, owner: String, date: String, payload: NutritionPayload,
         onSaved: @escaping (NativeQuickMealReceipt?) -> Void) {
        self.api = api
        self.owner = owner
        self.date = date
        self.payload = payload
        self.onSaved = onSaved
        let suggestedMeal = NutritionShortcut.suggestedMeal
        self.suggestedMeal = suggestedMeal
        self.recents = payload.recentServings(for: suggestedMeal)
        let portionsByFood = payload.savedFoodPortions
        self.savedPersonal = payload.rows.compactMap { row in
            guard row.kind == "food", let id = row.id, let name = row.name, let facts = row.per100g else { return nil }
            var food = NativeNutritionFood(id: id, name: name, facts: facts)
            food.isPersonal = true
            food.emoji = "⭐️"
            food.portions = portionsByFood[id] ?? []
            return food
        }
        _category = State(initialValue: Self.catalog?.categories.first?.id ?? "")
    }

    /// A refreshed payload still supplies saved foods, while entries from this sheet take precedence.
    private var personal: [NativeNutritionFood] {
        guard !addedPersonal.isEmpty else { return savedPersonal }
        let added = Set(addedPersonal.map(\.id))
        return addedPersonal + savedPersonal.filter { !added.contains($0.id) }
    }

    private var favoriteFoods: [NativeNutritionFood] {
        let personalByID = Dictionary(personal.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return favorites.compactMap { personalByID[$0] ?? NativeNutritionFood.builtInByID[$0] }
    }

    private var store: NativeFoodLocalStore { .init(api: api, owner: owner) }
    private var templateStore: NativeFavoriteMealStore { .init(api: api, owner: owner) }
    private var guiding: Bool { guide?.step.presentation == .mealEditor }
    private var selectedQuantity: Double { basket.reduce(0) { $0 + $1.selectedQuantity } }
    private var totals: NativeNutritionFood.Facts {
        basket.reduce(.init(calories: 0, protein: 0, carbs: 0, fat: 0)) { $0.adding($1.facts) }
    }

    var body: some View {
        let search = nativeFoodQuery(query)
        let request = foodSearch(for: search.name)
        NavigationStack {
            VStack(spacing: 0) {
                header
                VStack(spacing: 0) {
                    searchField.padding(.horizontal, 14).padding(.top, 10)
                    SpotterSegments("食物来源", options: Tab.allCases, value: $tab, usesUIKitControl: true, title: \.rawValue)
                        .padding(.horizontal, 14).padding(.top, 6)
                    Divider().overlay(SpotterPalette.line)
                    content(search, request: request).frame(maxHeight: .infinity)
                }
                .disabled(pendingSubmission != nil)
                bottomBar
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .foregroundStyle(SpotterPalette.ink)
            .tint(accent.tint)
            .toolbar(.hidden, for: .navigationBar)
            .overlay { if let working { workingOverlay(working) } }
            .overlay(alignment: .bottom) { noticeView }
            .nativeGuideLayer(.mealEditor) { dismiss() }
        }
        .interactiveDismissDisabled(busy || !basket.isEmpty)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task {
            favorites = store.favorites
            templates = (try? templateStore.load()) ?? []
        }
        .task(id: request) {
            if let request { await updateSearch(request) }
        }
        .sheet(item: $sheet, onDismiss: openQueuedCover) { item in sheetView(item) }
        .fullScreenCover(item: $cover, onDismiss: handleCoverResult) { item in coverView(item) }
        .photosPicker(isPresented: $showLibrary, selection: $libraryChoice, matching: .images)
        .onChange(of: libraryChoice) { choice in
            guard let choice else { return }
            libraryChoice = nil
            Task {
                guard let data = try? await choice.loadTransferable(type: Data.self) else {
                    show("这张照片无法读取，请换一张。")
                    return
                }
                await recognizeLabel(data)
            }
        }
        .alert("存为固定模版", isPresented: $savingTemplate) {
            TextField("模版名称", text: $templateName)
            Button("取消", role: .cancel) {}
            Button("保存") { saveTemplate() }
        } message: {
            Text("把已选的 \(nutritionInput(selectedQuantity)) 份存为固定模版，以后可以一键加入。")
        }
    }

    // MARK: Header

    private var header: some View {
        ViewThatFits(in: .horizontal) {
            if !textSize.isAccessibilitySize { headerRow(compact: false) }
            headerRow(compact: true)
        }
        .padding(.horizontal, 12).padding(.top, 6)
    }

    private func headerRow(compact: Bool) -> some View {
        HStack(spacing: 8) {
            ZStack(alignment: .leading) {
                quickEntryLabel(compact: compact).hidden().accessibilityHidden(true)
                Button { dismiss() } label: {
                    Image(systemName: "arrow.left").font(.system(size: 17, weight: .semibold))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel(basket.isEmpty ? "返回" : "放弃已选食物并返回")
                .disabled(busy)
            }
            VStack(spacing: 2) {
                Text("记录饮食").font(.headline).accessibilityAddTraits(.isHeader)
                if date != spotterDay() {
                    Text("记到 \(nutritionRecordDateLabel(date))").font(.caption2).foregroundStyle(SpotterPalette.muted)
                }
            }
            .lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity)
            Menu {
                Button { cover = .scanner } label: { Label("扫食物条码", systemImage: "barcode.viewfinder") }
                Button { cover = .camera } label: { Label("拍营养元素", systemImage: "camera") }
                Button { showLibrary = true } label: { Label("从相册识别营养表", systemImage: "photo") }
            } label: {
                quickEntryLabel(compact: compact)
            }
            .disabled(busy || working != nil || pendingSubmission != nil)
            .accessibilityLabel("快速录入：扫条码或识别营养表")
        }
    }

    private func quickEntryLabel(compact: Bool) -> some View {
        Group {
            if compact { Image(systemName: "bolt.fill") }
            else { Label("快速录入", systemImage: "bolt.fill") }
        }
        .font(.footnote.weight(.semibold))
        .foregroundStyle(accent.tint)
        .padding(.horizontal, 10)
        .frame(minWidth: 36, minHeight: 36)
        .background(accent.selection, in: Capsule())
        .frame(minWidth: 44, minHeight: 44)
        .fixedSize(horizontal: true, vertical: false)
        .contentShape(Rectangle())
    }

    private var searchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass").foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            TextField("输入食物名称", text: $query)
                .focused($searchFocused)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .accessibilityLabel("搜索食物")
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(SpotterPalette.muted)
                        .frame(width: 32, height: 44).contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityLabel("清空搜索")
            }
            Button { searchFocused = false; cover = .scanner } label: {
                Image(systemName: "barcode.viewfinder").font(.system(size: 19, weight: .medium))
                    .foregroundStyle(accent.tint)
                    .frame(width: 40, height: 44).contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("扫食物条码")
            .disabled(busy || working != nil)
        }
        .padding(.leading, 12)
        .frame(minHeight: 46)
        .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        .nativeGuideTarget(.mealFields)
    }

    // MARK: Content

    private func foodSearch(for text: String) -> SearchRequest? {
        guard !text.isEmpty else { return nil }
        switch tab {
        case .search, .custom: return SearchRequest(tab: tab, text: text, foods: personal)
        case .favorites: return SearchRequest(tab: tab, text: text, foods: favoriteFoods)
        case .templates: return nil
        }
    }

    private func updateSearch(_ request: SearchRequest) async {
        guard searchResults[request.tab]?.request != request else { return }
        let search = Task.detached(priority: .userInitiated) {
            NativeFoodSearchIndex.matching(request.foods, text: request.text, includeCatalog: request.tab == .search)
        }
        let foods = await withTaskCancellationHandler {
            await search.value
        } onCancel: {
            search.cancel()
        }
        guard !Task.isCancelled else { return }
        searchResults[request.tab] = SearchResult(request: request, foods: foods)
    }

    @ViewBuilder private func content(_ search: (name: String, grams: Double?), request: SearchRequest?) -> some View {
        let result = searchResults[tab]
        if let request, result?.request != request {
            ProgressView("正在搜索食物…").frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            switch tab {
            case .search:
                if let result, request != nil { results(search, found: result.foods) }
                else { browser }
            case .custom:
                customTab(search.name, foods: request == nil ? personal : result?.foods ?? [])
            case .favorites:
                favoritesTab(search.name, foods: request == nil ? favoriteFoods : result?.foods ?? [])
            case .templates:
                templatesTab(search.name)
            }
        }
    }

    private func results(_ search: (name: String, grams: Double?), found: [NativeNutritionFood]) -> some View {
        return ScrollView {
            LazyVStack(spacing: 10) {
                if found.isEmpty {
                    emptyState("没有找到「\(search.name)」", detail: "试试更短的名称或英文名，也可以自己添加。") {
                        Button { sheet = .custom(NativeCustomFoodDraft(name: search.name)) } label: {
                            Label("新建自定义食物", systemImage: "plus")
                        }.buttonStyle(.spotterPrimaryControl)
                        Button { cover = .camera } label: { Label("拍营养标签", systemImage: "camera") }
                            .buttonStyle(.spotterControl)
                    }
                } else {
                    ForEach(found) { food in card(food, grams: search.grams) }
                    Text("找不到想要的？到「自定义」新建，或用右上角「快速录入」扫码识别。")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
                }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder private var browser: some View {
        if let catalog = Self.catalog, !catalog.categories.isEmpty {
            let current = catalog.categories.first { $0.id == category } ?? catalog.categories[0]
            HStack(spacing: 0) {
                rail(catalog.categories, selected: current.id)
                categoryList(current)
            }
        } else {
            ScrollView {
                LazyVStack(spacing: 10) { ForEach(Self.foods) { card($0) } }.padding(14)
            }
        }
    }

    private func rail(_ categories: [NativeFoodCatalog.Category], selected: String) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 2) {
                ForEach(categories) { item in
                    let active = item.id == selected
                    Button {
                        category = item.id
                        group = nil
                    } label: {
                        VStack(spacing: 4) {
                            Text(item.emoji).font(.system(size: 21)).accessibilityHidden(true)
                            Text(item.name).font(.caption.weight(active ? .bold : .medium))
                                .foregroundStyle(active ? SpotterPalette.ink : SpotterPalette.muted)
                                .multilineTextAlignment(.center)
                                .lineLimit(2).minimumScaleFactor(0.8)
                        }
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .background(active ? SpotterPalette.card : Color.clear)
                        .overlay(alignment: .leading) {
                            if active { Capsule().fill(accent.tint).frame(width: 3, height: 22) }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            .padding(.vertical, 6)
        }
        .frame(width: textSize.isAccessibilitySize ? 96 : 76)
        .background(SpotterPalette.wash.opacity(0.55))
    }

    private func categoryList(_ current: NativeFoodCatalog.Category) -> some View {
        let shown = group.map { Self.foodsByGroup[current.id]?[$0] ?? [] } ?? (Self.foodsByCategory[current.id] ?? [])
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if current.id == Self.catalog?.categories.first?.id, group == nil, !recents.isEmpty {
                    recentStrip(recents)
                }
                groupChips(current)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(current.title + (group.flatMap { id in current.groups.first { $0.id == id }?.name }.map { " · " + $0 } ?? ""))
                            .font(.headline)
                        Text("\(shown.count)").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    }
                    Text(current.summary).font(.caption).foregroundStyle(SpotterPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
                ForEach(shown) { card($0) }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
        }
        .id(current.id + "/" + (group ?? ""))
        .scrollDismissesKeyboard(.interactively)
    }

    private func groupChips(_ current: NativeFoodCatalog.Category) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                chip("全部", selected: group == nil) { group = nil }
                ForEach(current.groups) { item in
                    chip(item.name, selected: group == item.id) { group = item.id }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.footnote.weight(selected ? .bold : .medium))
                .foregroundStyle(selected ? SpotterPalette.deep : SpotterPalette.ink)
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(selected ? accent.fill : SpotterPalette.card, in: Capsule())
                .overlay { Capsule().strokeBorder(selected ? Color.clear : SpotterPalette.line).allowsHitTesting(false) }
                .frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func recentStrip(_ recents: [NativeRecentServing]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("最近记过 · 按上次份量").font(.subheadline.weight(.semibold))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(recents) { serving in
                        Button { add(serving.food, grams: serving.grams) } label: {
                            HStack(spacing: 5) {
                                Text(serving.food.emoji ?? "🍽️").accessibilityHidden(true)
                                Text(serving.food.name).lineLimit(1)
                                Text(nutritionNumber(serving.grams) + " g").foregroundStyle(SpotterPalette.muted)
                                Image(systemName: "plus.circle.fill").foregroundStyle(accent.tint)
                            }
                            .font(.footnote.weight(.medium))
                            .padding(.horizontal, 10).frame(minHeight: 38)
                            .background(SpotterPalette.card, in: Capsule())
                            .overlay { Capsule().strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
                            .frame(minHeight: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityLabel("加入 \(serving.food.name) \(nutritionNumber(serving.grams)) 克")
                    }
                }
            }
        }
    }

    private func customTab(_ text: String, foods: [NativeNutritionFood]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Button { sheet = .custom(NativeCustomFoodDraft(name: text)) } label: {
                        Label("新建自定义食物", systemImage: "plus").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.spotterPrimaryControl)
                    Button { sheet = .manual } label: {
                        Label("直接填写本餐", systemImage: "square.and.pencil").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.spotterControl)
                }
                Text("自定义食物按每 100 g 保存到「我的食物」，网页和 iPhone 都能搜到。只记这一次的菜可以直接填写本餐数值。")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if foods.isEmpty {
                    emptyState(text.isEmpty ? "还没有自定义食物" : "「我的食物」里没有「\(text)」",
                               detail: "扫码或拍营养标签后保存，下次直接搜索。") { EmptyView() }
                } else {
                    Text("我的食物 · \(foods.count)").font(.subheadline.weight(.semibold)).padding(.top, 4)
                    ForEach(foods) { card($0) }
                }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func favoritesTab(_ text: String, foods: [NativeNutritionFood]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if foods.isEmpty {
                    emptyState(text.isEmpty ? "还没有收藏" : "收藏里没有「\(text)」",
                               detail: "点开任意食物，在右上角点星标即可收藏。收藏保存在这台 iPhone。") { EmptyView() }
                } else {
                    ForEach(foods) { card($0) }
                }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func templatesTab(_ text: String) -> some View {
        let needle = NativeNutritionFood.searchKey(text)
        let shown = needle.isEmpty ? templates : templates.filter { preset in
            ([preset.name] + preset.foods.map(\.name)).contains { NativeNutritionFood.searchKey($0).contains(needle) }
        }
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if !basket.isEmpty {
                    Button { templateName = ""; savingTemplate = true } label: {
                        Label("把已选的 \(nutritionInput(selectedQuantity)) 份存为模版", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.spotterControl)
                    .disabled(guiding)
                }
                if shown.isEmpty {
                    emptyState(templates.isEmpty ? "还没有固定模版" : "没有匹配的模版",
                               detail: "选好食物后打开食物篮，再点「存为固定模版」。") { EmptyView() }
                } else {
                    ForEach(shown) { preset in templateCard(preset) }
                }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func templateCard(_ preset: NativeFavoriteMeal) -> some View {
        let facts = preset.foods.reduce(NativeNutritionFood.Facts(calories: 0, protein: 0, carbs: 0, fat: 0)) {
            $0.adding(.init(calories: $1.calories, protein: $1.protein, carbs: $1.carbs, fat: $1.fat))
        }
        return HStack(spacing: 12) {
            NativeFoodEmoji(emoji: "🍱")
            VStack(alignment: .leading, spacing: 3) {
                Text(preset.name).font(.subheadline.weight(.bold)).lineLimit(1)
                Text(preset.foods.map(\.name).joined(separator: "、")).font(.caption).foregroundStyle(SpotterPalette.muted).lineLimit(1)
                HStack(spacing: 6) {
                    Text(nutritionNumber(facts.calories) + " 千卡").font(.caption.weight(.semibold)).monospacedDigit()
                    NativeMacroLine(facts: facts)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            addButton("加入 \(preset.name)") {
                let grams = preset.foods.compactMap(\.grams)
                var item = NativeMealLoggerItem(name: preset.name, emoji: "🍱", serving: facts,
                                                grams: grams.count == preset.foods.count ? grams.reduce(0, +) : nil,
                                                foodId: preset.foods.count == 1 ? preset.foods[0].foodId : nil,
                                                proteinProductId: preset.foods.count == 1 ? preset.foods[0].proteinProductId : nil)
                item.servings = 1
                append(item, message: "已加入模版「\(preset.name)」")
            }
        }
        .padding(12)
        .spotterCard(radius: 16)
    }

    private func card(_ food: NativeNutritionFood, grams: Double? = nil) -> some View {
        let count = basket.lazy.filter { $0.foodId == food.id }.reduce(0) { $0 + $1.selectedQuantity }
        return HStack(spacing: 12) {
            Button { sheet = .portion(food, grams) } label: {
                HStack(spacing: 12) {
                    NativeFoodEmoji(emoji: food.emoji)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            Text(food.name).font(.subheadline.weight(.bold)).lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                            if food.isPersonal {
                                Text("我的").font(.caption2.weight(.semibold)).foregroundStyle(accent.tint)
                                    .padding(.horizontal, 5).padding(.vertical, 1)
                                    .background(accent.selection, in: Capsule())
                            }
                        }
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(nutritionNumber(food.facts.calories)).font(.subheadline.weight(.bold)).monospacedDigit()
                            Text("千卡/100g").font(.caption).foregroundStyle(SpotterPalette.muted)
                        }
                        NativeMacroLine(facts: food.facts)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("\(food.name)，每 100 克 \(nutritionNumber(food.facts.calories)) 千卡")
            .accessibilityHint("选择份量")
            addButton("加入 \(food.name)", count: count) {
                let portion = grams == nil ? food.portions.first : nil
                add(food, grams: grams ?? portion?.grams ?? 100, portion: portion)
            }
        }
        .padding(12)
        .spotterCard(radius: 16)
    }

    private func addButton(_ label: String, count: Double = 0, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "plus").font(.system(size: 15, weight: .bold))
                .foregroundStyle(accent.tint)
                .frame(width: 36, height: 36)
                .background(accent.selection, in: Circle())
                .overlay(alignment: .topTrailing) {
                    if count > 0 {
                        Text(nutritionInput(count)).font(.caption2.weight(.bold)).monospacedDigit()
                            .fixedSize()
                            .foregroundStyle(SpotterPalette.deep)
                            .padding(.horizontal, 3)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(accent.fill, in: Capsule())
                            .offset(x: 5, y: -5)
                    }
                }
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
        .accessibilityValue(count > 0 ? "已选 \(nutritionInput(count)) 份" : "")
        .disabled(busy)
    }

    private func emptyState<Actions: View>(_ title: String, detail: String, @ViewBuilder actions: () -> Actions) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "fork.knife").font(.title2).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            Text(title).font(.subheadline.weight(.semibold)).multilineTextAlignment(.center)
            Text(detail).font(.footnote).foregroundStyle(SpotterPalette.muted).multilineTextAlignment(.center)
            HStack(spacing: 8) { actions() }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 30).padding(.horizontal, 8)
    }

    // MARK: Bottom bar

    private var bottomBar: some View {
        let count = nutritionInput(selectedQuantity)
        return VStack(spacing: 6) {
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity)
            }
            HStack(spacing: 10) {
                Button { sheet = .basket } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "basket").font(.system(size: 21, weight: .medium))
                            .overlay(alignment: .topTrailing) {
                                if !basket.isEmpty {
                                    Text(count).font(.caption2.weight(.bold)).monospacedDigit()
                                        .fixedSize()
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 3)
                                        .frame(minWidth: 17, minHeight: 17)
                                        .background(Color.red, in: Capsule())
                                        .offset(x: 8, y: -7)
                                }
                            }
                        if !basket.isEmpty {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(nutritionNumber(totals.calories) + " 千卡").font(.subheadline.weight(.bold)).monospacedDigit()
                                NativeMacroLine(facts: totals, font: .caption2)
                            }
                            .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, 6)
                    .frame(minWidth: 52, minHeight: 50, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .disabled(basket.isEmpty || pendingSubmission != nil)
                .accessibilityLabel(basket.isEmpty ? "还没有选择食物" : "已选 \(count) 份，共 \(nutritionNumber(totals.calories)) 千卡")
                .accessibilityHint("查看和调整已选食物")
                Button {
                    searchFocused = false
                    if let pendingSubmission { Task { await submit(pendingSubmission) } }
                    else { choosingMeal = true }
                } label: {
                    ZStack {
                        if busy { ProgressView().tint(SpotterPalette.deep) }
                        else if pendingSubmission != nil { Text("重试保存").fontWeight(.bold) }
                        else { Text(basket.isEmpty ? "完成" : "完成（\(count)）").fontWeight(.bold) }
                    }
                    .foregroundStyle(SpotterPalette.deep)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(accent.fill.opacity(basket.isEmpty ? 0.5 : 1), in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(.spotterPress)
                .disabled(basket.isEmpty || busy || guiding || date > spotterDay())
                .accessibilityLabel(busy ? "正在保存" : (pendingSubmission == nil ? "完成" : "重试保存"))
                .accessibilityValue(basket.isEmpty ? "" : "已选 \(count) 份")
                .accessibilityHint(pendingSubmission == nil ? "选择要记入的餐次" : "按原餐次和份量重试")
                .confirmationDialog("记到哪一餐？", isPresented: $choosingMeal, titleVisibility: .visible) {
                    ForEach(Self.mealOptions) { target in
                        let title = date == spotterDay() && target == .suggestedMeal ? "\(target.rawValue)（推荐）" : target.rawValue
                        Button(title) { Task { await save(meal: target) } }
                    }
                    Button("取消", role: .cancel) {}
                } message: {
                    Text("记入\(nutritionRecordDateLabel(date)) · \(count) 份 · \(nutritionNumber(totals.calories)) 千卡")
                }
            }
        }
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 6)
        .background(SpotterPalette.card.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(SpotterPalette.line) }
        .animation(motion, value: selectedQuantity)
        .animation(motion, value: error != nil)
    }

    @ViewBuilder private var noticeView: some View {
        if let notice {
            Text(notice.text)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(SpotterPalette.deep)
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(accent.fill, in: Capsule())
                .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
                .padding(.bottom, 86).padding(.horizontal, 20)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
                .id(notice.id)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    private func workingOverlay(_ text: String) -> some View {
        ZStack {
            Color.black.opacity(0.18).ignoresSafeArea()
            VStack(spacing: 10) {
                ProgressView()
                Text(text).font(.subheadline.weight(.semibold))
            }
            .padding(22)
            .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 16))
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Sheets and covers

    @ViewBuilder private func sheetView(_ item: Sheet) -> some View {
        switch item {
        case .portion(let food, let grams):
            NativeFoodPortionSheet(food: food, grams: grams, favorite: favorites.contains(food.id),
                                   toggleFavorite: { toggleFavorite(food) }) { portionItem in
                append(portionItem, message: "已加入「\(food.name)」· \(portionItem.amountText)")
            }
        case .basket:
            NativeMealBasketSheet(items: $basket, saveTemplate: guiding ? nil : {
                sheet = nil
                templateName = ""
                savingTemplate = true
            })
        case .custom(let draft):
            NativeCustomFoodEditor(api: api, owner: owner, draft: draft, existing: personal.filter { $0.id != draft.id }.map(\.name), locked: guiding,
                                   takePhoto: { current in
                                       carryDraft = current
                                       queuedCover = .camera
                                       sheet = nil
                                   }) { food, grams, portion in
                addedPersonal.removeAll { $0.id == food.id }
                addedPersonal.insert(food, at: 0)
                if let code = draft.barcode {
                    // An empty payload has not loaded yet, so it cannot say which saved foods still exist.
                    store.remember(barcode: code, food: food.id, known: payload.rows.isEmpty ? nil : Set(personal.map(\.id)))
                }
                if let grams { add(food, grams: grams, portion: portion) } else { show("已存入「我的食物」") }
            }
        case .manual:
            NativeManualMealItemEditor { append($0, message: "已加入「\($0.name)」") }
        }
    }

    @ViewBuilder private func coverView(_ item: Cover) -> some View {
        switch item {
        case .scanner:
            NativeBarcodeScannerView { code in
                scannedCode = code
                cover = nil
            } cancel: { cover = nil }
        case .camera:
            NativeLabelCameraView { data in
                capturedPhoto = data
                cover = nil
            }
        }
    }

    private func openQueuedCover() {
        guard let next = queuedCover else { return }
        queuedCover = nil
        cover = next
    }

    private func handleCoverResult() {
        if let code = scannedCode {
            scannedCode = nil
            Task { await lookup(code) }
        } else if let photo = capturedPhoto {
            capturedPhoto = nil
            Task { await recognizeLabel(photo) }
        } else if let draft = carryDraft {
            // The label camera was opened from the custom-food editor and closed without a photo.
            carryDraft = nil
            sheet = .custom(draft)
        }
    }

    // MARK: Actions

    private func add(_ food: NativeNutritionFood, grams: Double, portion: NativeFoodPortion? = nil) {
        guard grams > 0, grams <= 3_000 else { return }
        let item = NativeMealLoggerItem(food: food, grams: grams, portion: portion)
        append(item, message: "已加入「\(food.name)」· \(item.amountText)")
    }

    private func append(_ item: NativeMealLoggerItem, message: String) {
        error = nil
        if let index = basket.firstIndex(where: {
            $0.foodId != nil && $0.foodId == item.foodId && $0.portion == item.portion && $0.per100g != nil && item.per100g != nil
        }),
           let grams = item.grams, (basket[index].grams ?? 0) + grams <= 3_000 {
            basket[index].grams = (basket[index].grams ?? 0) + grams
        } else {
            basket.append(item)
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        show(message)
    }

    private func show(_ text: String) {
        let id = UUID()
        withAnimation(motion) { notice = (id, text) }
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            if notice?.id == id { withAnimation(motion) { notice = nil } }
        }
    }

    private func toggleFavorite(_ food: NativeNutritionFood) {
        favorites = store.setFavorite(food.id, !favorites.contains(food.id))
    }

    private func saveTemplate() {
        let name = templateName.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = basket.prefix(2).map(\.name).joined(separator: " + ") + (basket.count > 2 ? " 等 \(basket.count) 项" : "")
        let title = String((name.isEmpty ? fallback : name).prefix(60))
        let preset = NativeFavoriteMeal(name: title, meal: suggestedMeal.rawValue, foods: basket.map(NativeFavoriteMeal.Food.init(item:)))
        guard preset.record(id: preset.id.uuidString, day: date, meal: suggestedMeal, servings: 1) != nil else {
            error = "这份组合的总重量或营养数值超出记餐范围，请减少已选食物。"
            return
        }
        do {
            templates = try templateStore.edit { $0.insert(preset, at: 0) }
            show("已存为模版「\(title)」")
        } catch { self.error = "暂时无法保存模版。" }
    }

    private func save(meal: NutritionShortcut) async {
        guard !busy, !basket.isEmpty, !guiding, pendingSubmission == nil else { return }
        let records = basket.compactMap { $0.record(meal: meal, day: date) }
        guard records.count == basket.count else {
            error = "有食物的份量或营养数值超出可记录范围，请在已选列表里调整。"
            return
        }
        await submit(Submission(meal: meal, records: records, name: basket.first?.name ?? "餐食"))
    }

    private func submit(_ submission: Submission) async {
        guard !busy else { return }
        guard date <= spotterDay() else { error = "未来日期不能记录饮食。"; return }
        pendingSubmission = submission
        busy = true
        error = nil
        defer { busy = false }
        do {
            let receipt = try await saveSubmission(submission)
            pendingSubmission = nil
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            onSaved(receipt)
            basket = []
            dismiss()
        } catch let apiError as NativeAPIError where apiError.statusCode == 409 {
            self.error = apiError.localizedDescription
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        } catch let apiError as NativeAPIError where [400, 403, 404, 413].contains(apiError.statusCode ?? 0) {
            pendingSubmission = nil
            self.error = apiError.statusCode == 404 ? "批量记餐服务暂不可用，请稍后重试。" : apiError.localizedDescription
        } catch {
            self.error = "\(error.localizedDescription) 点「重试保存」会使用原餐次和份量。"
        }
    }

    private func saveSubmission(_ submission: Submission) async throws -> NativeQuickMealReceipt {
        if !submission.usesLegacy {
            do {
                let response = try await api.spotterSend("/api/nutrition/batch", body: [
                    "action": "save", "expectedOwner": owner, "batchId": submission.id, "rows": submission.records
                ])
                let rows = try JSONDecoder().decode(SavedBatch.self, from: response).rows
                let expectedIDs = Set(submission.records.compactMap { $0["id"] as? String })
                guard rows.count == submission.records.count, Set(rows.map(\.id)) == expectedIDs,
                      rows.allSatisfy({ !$0.updated.isEmpty }) else { throw NativeAPIError.invalidResponse }
                return NativeQuickMealReceipt(batchId: submission.id, rows: rows, meal: submission.meal, day: date)
            } catch let apiError as NativeAPIError where apiError.statusCode == 404 && submission.records.count == 1 {
                // A worker without the batch route can still create one record safely.
                var legacy = submission
                legacy.usesLegacy = true
                pendingSubmission = legacy
            }
        }
        guard let record = submission.records.first, let id = record["id"] as? String else { throw NativeAPIError.invalidRequest }
        let response = try await api.spotterSend("/api/library", body: [
            "action": "save", "expectedOwner": owner, "revision": NSNull(), "data": record
        ])
        let updated = try JSONDecoder().decode(NativeJSON.self, from: response)["updated"].string
        guard !updated.isEmpty else { throw NativeAPIError.invalidResponse }
        return NativeQuickMealReceipt(id: id, updated: updated, name: submission.name, day: date, meal: submission.meal)
    }

    // MARK: Quick entry

    private func lookup(_ raw: String) async {
        let code = raw.filter(\.isNumber)
        guard (8...14).contains(code.count) else {
            show("条码无法识别，请重新扫描。")
            return
        }
        if let id = store.food(forBarcode: code), var food = personal.first(where: { $0.id == id }) {
            if food.portions.isEmpty {
                working = "正在查询条码份量…"
                if let portion = (try? await NativeOpenFoodFacts.product(code))?.portion {
                    food.portions = [portion]
                }
                working = nil
            }
            sheet = .portion(food, nil)
            return
        }
        working = "正在查询条码…"
        var draft = carryDraft ?? NativeCustomFoodDraft()
        carryDraft = nil
        draft.barcode = code
        do {
            let product = try await NativeOpenFoodFacts.product(code)
            if let product {
                if draft.name.isEmpty { draft.name = product.name }
                if let facts = product.per100g {
                    draft.fill(per100g: facts)
                    draft.note = "已从 Open Food Facts 读取条码 \(code) 的每 100 g 营养数据，请对照包装核对后保存。"
                } else {
                    draft.note = "查到了商品名称，但缺少营养数据。可以点「拍营养标签」自动填写。"
                }
                if let portion = product.portion {
                    draft.barcodeUnit = portion.name
                    draft.barcodeUnitGrams = nutritionInput(portion.grams)
                }
            } else {
                draft.note = "没有查到条码 \(code)。拍营养标签或手动填写后保存，下次扫码直接使用。"
            }
        } catch {
            draft.note = "暂时无法联网查询条码 \(code)。可以拍营养标签或手动填写后保存，下次扫码直接使用。"
        }
        working = nil
        sheet = .custom(draft)
    }

    private func recognizeLabel(_ raw: Data) async {
        working = "正在识别营养表…"
        let carried = carryDraft
        var draft = carried ?? NativeCustomFoodDraft()
        carryDraft = nil
        defer { working = nil }
        guard let jpeg = await Task.detached(priority: .userInitiated, operation: { coachImage(raw) }).value else {
            show("这张照片无法读取，请换一张。")
            if let carried { sheet = .custom(carried) }
            return
        }
        struct Answer: Decodable {
            struct Draft: Decodable {
                let name: String
                let per100g: NativeNutritionFood.Facts
            }
            let draft: Draft?
            let needs: [String]?
        }
        do {
            let data = try await api.spotterSend("/api/food-photo", body: [
                "expectedOwner": owner, "mode": "label",
                "image": ["mediaType": "image/jpeg", "base64": jpeg.base64EncodedString()]
            ])
            let answer = try JSONDecoder().decode(Answer.self, from: data)
            if let label = answer.draft {
                if draft.name.isEmpty || draft.barcode == nil { draft.name = label.name }
                draft.fill(per100g: label.per100g)
                draft.note = "已按营养表换算为每 100 g。请逐项核对后保存。"
            } else {
                let reading = await NativeLabelReader.read(jpeg)
                let based = draft.merge(reading)
                draft.note = "还需要补拍或确认：" + (answer.needs ?? ["品名和营养表"]).joined(separator: "、") + "。已先填入手机识别出的数值。"
                    + (based ? "" : "没有读到每份克数，请填写「每份重量」。")
            }
        } catch {
            let reading = await NativeLabelReader.read(jpeg)
            let based = draft.merge(reading)
            draft.note = reading.isEmpty
                ? "暂时无法识别这张营养表，请重新拍摄或手动填写。"
                : based ? "站内识别暂不可用，已填入手机识别出的数值。请逐项核对，尤其是每份克数。"
                : "站内识别暂不可用，已按每份填入手机识别出的数值。没有读到每份克数，请填写「每份重量」后保存。"
        }
        sheet = .custom(draft)
    }
}

private extension NativeAPI {
    func importMealLibraryRows(_ rows: [[String: Any]], owner: String) async throws -> Int {
        var query = URLComponents()
        query.path = "/api/data"
        query.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
        guard let path = query.string else { throw NativeAPIError.invalidRequest }
        let body: [String: Any] = ["format": "spotter-backup", "version": 1, "training": [], "heart": [], "library": rows]
        let data = try await request(path, method: "POST", json: JSONSerialization.data(withJSONObject: body), for: owner)
        let result = try JSONDecoder().decode(NativeJSON.self, from: data)
        let skipped = Int(result["skipped"].number)
        guard Int(result["added"].number) + skipped == rows.count else { throw NativeAPIError.invalidResponse }
        return skipped
    }
}

// MARK: - Portion sheet

@MainActor
private struct NativeFoodPortionSheet: View {
    let food: NativeNutritionFood
    let toggleFavorite: () -> Void
    let confirm: (NativeMealLoggerItem) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var favorite: Bool
    @State private var portion: NativeFoodPortion?
    @State private var amount: String

    init(food: NativeNutritionFood, grams: Double?, favorite: Bool, toggleFavorite: @escaping () -> Void,
         confirm: @escaping (NativeMealLoggerItem) -> Void) {
        self.food = food
        self.toggleFavorite = toggleFavorite
        self.confirm = confirm
        _favorite = State(initialValue: favorite)
        let first = grams == nil ? food.portions.first : nil
        _portion = State(initialValue: first)
        _amount = State(initialValue: first != nil ? "1" : nutritionInput(grams ?? 100))
    }

    private var grams: Double? {
        guard let value = nutritionValue(amount), value > 0 else { return nil }
        let total = portion.map { $0.grams * value } ?? value
        return (0.1...3_000).contains(total) ? total : nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top, spacing: 12) {
                        NativeFoodEmoji(emoji: food.emoji, size: 60)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(food.name).font(.title3.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                            if let detail = food.detail { Text(detail).font(.footnote).foregroundStyle(SpotterPalette.muted) }
                            if let source = food.source {
                                Text("数据来源：" + source).font(.caption).foregroundStyle(SpotterPalette.muted)
                            } else if food.isPersonal {
                                Text("我的食物").font(.caption).foregroundStyle(SpotterPalette.muted)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    facts("每 100 g", food.facts)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("份量").font(.subheadline.weight(.semibold))
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                unitChip("克", selected: portion == nil) {
                                    if let grams { amount = nutritionInput((grams * 10).rounded() / 10) }
                                    portion = nil
                                }
                                ForEach(food.portions) { option in
                                    unitChip(option.label, selected: portion == option) {
                                        if portion == nil { amount = "1" }
                                        portion = option
                                    }
                                }
                            }
                        }
                        HStack(spacing: 8) {
                            stepButton("减少", icon: "minus") { change(-1) }
                            TextField(amountTitle, text: $amount)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.center)
                                .font(.title3.weight(.semibold)).monospacedDigit()
                                .frame(minHeight: 44)
                                .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12))
                                .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
                                .accessibilityLabel(amountTitle)
                            stepButton("增加", icon: "plus") { change(1) }
                            Text(portion?.name ?? "g").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                                .lineLimit(1).frame(minWidth: 26)
                        }
                    }
                    if let grams {
                        facts("本次 · \(nutritionNumber(grams)) g", food.facts.scaled(grams)).transition(.opacity)
                    } else {
                        Text("请输入 0.1–3000 克之间的份量。").font(.footnote).foregroundStyle(.red)
                    }
                    Button {
                        guard let grams else { return }
                        confirm(NativeMealLoggerItem(food: food, grams: grams, portion: portion))
                        dismiss()
                    } label: {
                        Text("加入已选").fontWeight(.bold)
                            .foregroundStyle(SpotterPalette.deep)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(accent.fill, in: Capsule())
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.spotterPress)
                    .disabled(grams == nil)
                }
                .padding(18)
                .animation(motion, value: grams == nil)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { NutritionDismissButton { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        favorite.toggle()
                        toggleFavorite()
                    } label: {
                        Image(systemName: favorite ? "star.fill" : "star")
                            .foregroundStyle(favorite ? Color.orange : SpotterPalette.muted)
                            .frame(width: 44, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityLabel(favorite ? "取消收藏" : "收藏")
                }
            }
        }
        .tint(accent.tint)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func change(_ direction: Double) {
        let current = nutritionValue(amount) ?? 0
        let step: Double = portion == nil ? 10 : portion?.isPackagedUnit == true ? 1 : 0.5
        let next = max(step == 0.5 ? 0.5 : 1, ((current + direction * step) * 10).rounded() / 10)
        amount = nutritionInput(next)
    }

    private func facts(_ title: String, _ values: NativeNutritionFood.Facts) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.semibold))
            HStack(spacing: 6) {
                metric("热量", nutritionNumber(values.calories), "千卡", SpotterPalette.ink)
                metric("碳水", nutritionNumber(values.carbs), "g", nativeMacroColors.carbs)
                metric("蛋白质", nutritionNumber(values.protein), "g", nativeMacroColors.protein)
                metric("脂肪", nutritionNumber(values.fat), "g", nativeMacroColors.fat)
            }
        }
    }

    private func metric(_ title: String, _ value: String, _ unit: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline).monospacedDigit().foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.7)
            Text(title + " " + unit).font(.caption2).foregroundStyle(SpotterPalette.muted).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 54)
        .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    private func unitChip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(motion) { action() }
        } label: {
            Text(title).font(.footnote.weight(selected ? .bold : .medium))
                .foregroundStyle(selected ? SpotterPalette.deep : SpotterPalette.ink)
                .padding(.horizontal, 12).frame(minHeight: 36)
                .background(selected ? accent.fill : SpotterPalette.card, in: Capsule())
                .overlay { Capsule().strokeBorder(selected ? Color.clear : SpotterPalette.line).allowsHitTesting(false) }
                .frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func stepButton(_ label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .bold))
                .frame(width: 38, height: 38)
                .background(accent.selection, in: Circle())
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
    }

    private var amountTitle: String {
        if portion?.name == "个" { return "个数" }
        return portion == nil ? "克数" : "份数"
    }
}

// MARK: - Basket sheet

@MainActor
private struct NativeMealBasketSheet: View {
    @Binding var items: [NativeMealLoggerItem]
    let saveTemplate: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion

    private var totals: NativeNutritionFood.Facts {
        items.reduce(.init(calories: 0, protein: 0, carbs: 0, fat: 0)) { $0.adding($1.facts) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(nutritionNumber(totals.calories)).font(.title2.weight(.bold)).monospacedDigit()
                            let quantity = items.reduce(0) { $0 + $1.selectedQuantity }
                            Text("千卡 · \(nutritionInput(quantity)) 份").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                        }
                        NativeMacroLine(facts: totals, font: .subheadline)
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard(radius: 16)
                    if items.isEmpty {
                        Text("已选食物会显示在这里。").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                            .frame(maxWidth: .infinity, minHeight: 100)
                    }
                    ForEach(items) { item in
                        HStack(spacing: 10) {
                            NativeFoodEmoji(emoji: item.emoji, size: 42)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.name).font(.subheadline.weight(.bold)).lineLimit(2)
                                Text(item.amountText).font(.caption).foregroundStyle(SpotterPalette.muted).monospacedDigit()
                                Text(nutritionNumber(item.facts.calories) + " 千卡").font(.caption.weight(.semibold)).monospacedDigit()
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            HStack(spacing: 0) {
                                small("减少 \(item.name)", "minus") { step(item.id, -1) }
                                small("增加 \(item.name)", "plus") { step(item.id, 1) }
                                small("移除 \(item.name)", "trash") {
                                    let id = item.id
                                    withAnimation(motion) { items.removeAll { $0.id == id } }
                                }
                            }
                        }
                        .padding(10).spotterCard(radius: 14)
                    }
                    if let saveTemplate, !items.isEmpty {
                        Button(action: saveTemplate) {
                            Label("存为固定模版", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.spotterControl)
                    }
                    Text("点「完成」后选一个餐次，已选食物会一起记入。")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                .padding(16)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("已选食物")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { NutritionDismissButton { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    Button("清空", role: .destructive) { withAnimation(motion) { items = [] } }
                        .disabled(items.isEmpty)
                }
            }
        }
        .tint(accent.tint)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func step(_ id: String, _ direction: Double) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(motion) { items[index].step(direction) }
    }

    private func small(_ label: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 13, weight: .semibold))
                .foregroundStyle(icon == "trash" ? Color.red : SpotterPalette.ink)
                .frame(width: 30, height: 30)
                .background(SpotterPalette.wash, in: Circle())
                .frame(width: 40, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
    }
}

// MARK: - Custom food editor

struct NativeCustomFoodDraft {
    enum Basis: Hashable { case per100g, serving }

    var id = UUID().uuidString.lowercased()
    var name = ""
    var basis = Basis.per100g
    var servingGrams = ""
    var calories = ""
    var protein = ""
    var carbs = ""
    var fat = ""
    var consumed = ""
    var barcode: String?
    var barcodeUnitGrams = ""
    var barcodeUnit = "个"
    var barcodeCount = 1
    var note: String?

    init(name: String = "") { self.name = String(name.prefix(100)) }

    var barcodePortion: NativeFoodPortion? {
        guard barcode != nil, let grams = nutritionValue(barcodeUnitGrams), (0.1...3_000).contains(grams) else { return nil }
        return NativeFoodPortion(name: barcodeUnit, grams: grams)
    }

    mutating func fill(per100g facts: NativeNutritionFood.Facts) {
        basis = .per100g
        calories = nutritionInput((facts.calories * 10).rounded() / 10)
        protein = nutritionInput((facts.protein * 10).rounded() / 10)
        carbs = nutritionInput((facts.carbs * 10).rounded() / 10)
        fat = nutritionInput((facts.fat * 10).rounded() / 10)
    }

    /// Returns false when the label had values but neither "per 100 g" nor a serving weight is known.
    /// Canadian labels list values per serving, so the editor then waits for the serving weight.
    /// A serving weight read from an earlier photo or typed in stays when this photo shows none.
    @discardableResult
    mutating func merge(_ reading: NativeLabelReader.Reading) -> Bool {
        guard !reading.isEmpty else { return true }
        func usable(_ grams: Double?) -> Double? { grams.flatMap { (0.1...3_000).contains($0) ? $0 : nil } }
        let previous = usable(nutritionValue(servingGrams))
        let read = usable(reading.servingGrams)
        let target: Basis = reading.per100g ? .per100g : .serving
        if target != basis {
            // Values already filled in use the other basis. Convert them with the serving weight they were
            // entered with (to per 100 g) or the one this photo shows (to per serving), or clear them when it
            // is unknown, so per-100 g and per-serving numbers never mix.
            let grams = target == .per100g ? previous : (read ?? previous)
            func convert(_ text: inout String) {
                guard let value = nutritionValue(text) else { return }
                guard let grams else { text = ""; return }
                let converted = target == .serving ? value * grams / 100 : value * 100 / grams
                text = nutritionInput((converted * 10).rounded() / 10)
            }
            convert(&calories)
            convert(&protein)
            convert(&carbs)
            convert(&fat)
            basis = target
        }
        // A weight in brackets on a per-100 g photo may be the package weight, so only per-serving photos set it.
        if let read, target == .serving { servingGrams = nutritionInput(read) }
        if target == .serving, consumed.isEmpty, let read { consumed = nutritionInput(read) }
        if barcode != nil, barcodeUnitGrams.isEmpty, target == .serving, let read {
            barcodeUnit = "份"
            barcodeUnitGrams = nutritionInput(read)
        }
        if let value = reading.calories { calories = nutritionInput(value) }
        if let value = reading.protein { protein = nutritionInput(value) }
        if let value = reading.carbs { carbs = nutritionInput(value) }
        if let value = reading.fat { fat = nutritionInput(value) }
        return reading.per100g || nutritionValue(servingGrams) != nil
    }
}

@MainActor
private struct NativeCustomFoodEditor: View {
    let api: NativeAPI
    let owner: String
    let existing: [String]
    let locked: Bool
    let takePhoto: (NativeCustomFoodDraft) -> Void
    let saved: (NativeNutritionFood, Double?, NativeFoodPortion?) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var draft: NativeCustomFoodDraft
    @State private var editsBarcodeUnit: Bool
    @State private var showsNutritionValues: Bool
    @State private var busy = false
    @State private var error: String?

    init(api: NativeAPI, owner: String, draft: NativeCustomFoodDraft, existing: [String], locked: Bool,
         takePhoto: @escaping (NativeCustomFoodDraft) -> Void, saved: @escaping (NativeNutritionFood, Double?, NativeFoodPortion?) -> Void) {
        self.api = api
        self.owner = owner
        self.existing = existing
        self.locked = locked
        self.takePhoto = takePhoto
        self.saved = saved
        var initial = draft
        if initial.consumed.isEmpty { initial.consumed = initial.basis == .serving ? initial.servingGrams : "" }
        _draft = State(initialValue: initial)
        _editsBarcodeUnit = State(initialValue: draft.barcodePortion == nil)
        _showsNutritionValues = State(initialValue: [draft.protein, draft.carbs, draft.fat].contains(where: \.isEmpty))
    }

    private var per100g: NativeNutritionFood.Facts? {
        guard let p = nutritionValue(draft.protein), let c = nutritionValue(draft.carbs), let f = nutritionValue(draft.fat),
              [p, c, f].allSatisfy({ $0 >= 0 }) else { return nil }
        let typed = draft.calories.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let kcal = typed.isEmpty ? nutritionCalories(protein: p, carbs: c, fat: f) : nutritionValue(typed), kcal >= 0 else { return nil }
        var factor = 1.0
        if draft.basis == .serving {
            guard let grams = nutritionValue(draft.servingGrams), (0.1...3_000).contains(grams) else { return nil }
            factor = 100 / grams
        }
        func rounded(_ value: Double) -> Double { (value * factor * 100).rounded() / 100 }
        let facts = NativeNutritionFood.Facts(calories: rounded(kcal), protein: rounded(p), carbs: rounded(c), fat: rounded(f))
        guard facts.calories <= 1_000, facts.protein <= 100, facts.carbs <= 100, facts.fat <= 100,
              facts.protein + facts.carbs + facts.fat <= 103 else { return nil }
        return facts
    }

    private var consumedGrams: Double? {
        if let portion = draft.barcodePortion {
            let grams = Double(draft.barcodeCount) * portion.grams
            return (0.1...3_000).contains(grams) ? grams : nil
        }
        let typed = draft.consumed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typed.isEmpty, let grams = nutritionValue(typed), (0.1...3_000).contains(grams) else { return nil }
        return grams
    }

    private var name: String { draft.name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var quantityOutOfRange: Bool {
        draft.barcodePortion != nil && draft.barcodeCount > 0 && consumedGrams == nil
    }

    var body: some View {
        NavigationStack {
            Form {
                if let note = draft.note {
                    Section { Label(note, systemImage: "info.circle").font(.footnote) }
                }
                Section {
                    TextField("食物名称，可加品牌和口味", text: $draft.name).accessibilityLabel("食物名称")
                    if let code = draft.barcode {
                        LabeledContent("条码", value: code).font(.footnote)
                    }
                    Button { takePhoto(draft) } label: { Label("拍营养标签自动填写", systemImage: "camera") }
                        .disabled(busy)
                }
                if draft.barcode != nil { barcodeQuantity }
                Section {
                    if draft.barcode != nil {
                        DisclosureGroup("核对营养数值", isExpanded: $showsNutritionValues) { nutritionFields }
                    } else {
                        nutritionFields
                    }
                } header: {
                    if draft.barcode == nil { Text("营养数值") }
                } footer: {
                    if let facts = per100g {
                        Text("每 100 g：\(facts.description)")
                    } else {
                        Text("填写蛋白质、碳水和脂肪。按每份填写时需要每份克数，App 会换算成每 100 g 保存。")
                    }
                }
                if draft.barcodePortion == nil {
                    Section {
                        numberField("这次吃了多少克（选填）", $draft.consumed)
                    } footer: {
                        Text("填写后保存时会同时加入这一餐。")
                    }
                }
                if let error { Section { Text(error).font(.footnote).foregroundStyle(.red) } }
                Section {
                    Button { Task { await save() } } label: {
                        Text(busy ? "保存中…" : (consumedGrams == nil ? "保存到我的食物" : "保存并加入这一餐")).fontWeight(.semibold)
                    }
                    .disabled(busy || locked || per100g == nil || quantityOutOfRange || !(1...100).contains(name.utf16.count))
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle(draft.barcode == nil ? "自定义食物" : "扫码食物")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton(label: "取消") { dismiss() }.disabled(busy) } }
            .animation(motion, value: draft.basis)
        }
        .tint(accent.tint)
        .interactiveDismissDisabled(busy)
        .presentationDetents([.large])
    }

    private var barcodeQuantity: some View {
        Section("这次吃了多少") {
            if let portion = draft.barcodePortion {
                Stepper(value: $draft.barcodeCount, in: 0...30_000) {
                    LabeledContent("数量", value: portion.amountLabel(Double(draft.barcodeCount)))
                }
                .accessibilityIdentifier("nutrition-barcode-quantity")
                if let grams = consumedGrams, let facts = per100g {
                    Text("本次 \(nutritionNumber(grams)) g · \(facts.scaled(grams).description)")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        .accessibilityIdentifier("nutrition-barcode-totals")
                } else if quantityOutOfRange {
                    Text("本次食用总重量不能超过 3000 g。").font(.footnote).foregroundStyle(.red)
                }
            }
            DisclosureGroup(draft.barcodePortion.map { "每\($0.name) \(nutritionNumber($0.grams)) g" } ?? "设置每个或每份的重量",
                            isExpanded: $editsBarcodeUnit) {
                Picker("计量单位", selection: $draft.barcodeUnit) {
                    Text("个").tag("个")
                    Text("份").tag("份")
                }
                numberField("每\(draft.barcodeUnit)重量（g）", $draft.barcodeUnitGrams)
            }
        }
    }

    @ViewBuilder private var nutritionFields: some View {
        SpotterSegments("营养数值单位", options: [NativeCustomFoodDraft.Basis.per100g, .serving], value: $draft.basis) {
            $0 == .per100g ? "每 100 g" : "每份"
        }
        .accessibilityElement(children: .contain).accessibilityLabel("营养数值的基准")
        if draft.basis == .serving { numberField("每份重量（g）", $draft.servingGrams) }
        numberField("蛋白质（g）", $draft.protein)
        numberField("碳水（g）", $draft.carbs)
        numberField("脂肪（g）", $draft.fat)
        numberField("热量（千卡，留空自动估算）", $draft.calories)
    }

    private func numberField(_ title: String, _ value: Binding<String>) -> some View {
        TextField(title, text: value).keyboardType(.decimalPad).accessibilityLabel(title)
    }

    private func save() async {
        guard !busy, !locked, !quantityOutOfRange, let facts = per100g, (1...100).contains(name.utf16.count) else { return }
        if existing.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
            error = "「我的食物」里已有这个名称。可以加上品牌或口味来区分。"
            return
        }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let record: [String: Any] = ["kind": "food", "id": draft.id, "name": name, "per100g": facts.payload]
            let portion = draft.barcodePortion
            if draft.barcode != nil {
                let portions = portion.map { [$0] } ?? []
                let servings: [String: Any] = ["kind": "food-portions", "id": draft.id,
                                              "portions": portions.map { ["name": $0.name, "grams": $0.grams] }]
                if try await api.importMealLibraryRows([record, servings], owner: owner) > 0 {
                    // A previous request may have committed before its response was lost. Reconcile edits made since it.
                    let data = try await api.request("/api/library?date=\(spotterDay())", method: "GET", json: nil, for: owner)
                    let existing = try JSONDecoder().decode(NutritionPayload.self, from: data)
                    let savedFood = existing.rows.first { $0.kind == "food" && $0.id == draft.id }
                    if savedFood?.name != name || savedFood?.per100g != facts {
                        try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": record])
                    }
                    if existing.savedFoodPortions[draft.id, default: []] != portions {
                        try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": servings])
                    }
                }
            } else {
                try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner, "data": record])
            }
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            var food = NativeNutritionFood(id: draft.id, name: name, facts: facts)
            food.isPersonal = true
            food.emoji = "⭐️"
            if let portion { food.portions = [portion] }
            saved(food, consumedGrams, portion)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Hand-entered item

@MainActor
private struct NativeManualMealItemEditor: View {
    let add: (NativeMealLoggerItem) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var name = ""
    @State private var grams = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""

    private var item: NativeMealLoggerItem? {
        let title = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...100).contains(title.utf16.count), let p = nutritionValue(protein), let c = nutritionValue(carbs),
              let f = nutritionValue(fat), [p, c, f].allSatisfy({ (0...20_000).contains($0) }) else { return nil }
        let typed = calories.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let kcal = typed.isEmpty ? nutritionCalories(protein: p, carbs: c, fat: f) : nutritionValue(typed),
              (0...30_000).contains(kcal) else { return nil }
        var weight: Double?
        if !grams.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            guard let value = nutritionValue(grams), (0.1...3_000).contains(value) else { return nil }
            weight = value
        }
        return NativeMealLoggerItem(name: title, emoji: "🍽️", serving: .init(calories: kcal, protein: p, carbs: c, fat: f), grams: weight)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("食物名称", text: $name)
                    TextField("重量（g，选填）", text: $grams).keyboardType(.decimalPad)
                }
                Section {
                    TextField("蛋白质（g）", text: $protein).keyboardType(.decimalPad)
                    TextField("碳水（g）", text: $carbs).keyboardType(.decimalPad)
                    TextField("脂肪（g）", text: $fat).keyboardType(.decimalPad)
                    TextField(estimate.map { "热量（估算 \(nutritionNumber($0)) 千卡）" } ?? "热量（千卡，留空自动估算）", text: $calories)
                        .keyboardType(.decimalPad)
                        .accessibilityLabel("热量（千卡）")
                } header: { Text("这一份的营养") } footer: {
                    Text("留空热量时按 4 × 蛋白质 + 4 × 碳水 + 9 × 脂肪估算。只记这一次，不存入「我的食物」。")
                }
                Section {
                    Button("加入已选") {
                        guard let item else { return }
                        add(item)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(item == nil)
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("直接填写本餐")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton(label: "取消") { dismiss() } } }
        }
        .tint(accent.tint)
        .presentationDetents([.large])
    }

    private var estimate: Double? {
        guard let p = nutritionValue(protein), let c = nutritionValue(carbs), let f = nutritionValue(fat) else { return nil }
        return nutritionCalories(protein: p, carbs: c, fat: f)
    }
}

// MARK: - Barcode lookup

/// Looks up packaged foods by barcode in Open Food Facts. Only the barcode number leaves the device.
enum NativeOpenFoodFacts {
    struct Product {
        let name: String
        let per100g: NativeNutritionFood.Facts?
        let portion: NativeFoodPortion?
    }

    static func product(_ code: String) async throws -> Product? {
        var components = URLComponents(string: "https://world.openfoodfacts.org/api/v2/product/\(code).json")
        components?.queryItems = [URLQueryItem(name: "fields",
                                               value: "product_name,product_name_zh,product_name_en,product_name_fr,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit")]
        guard let url = components?.url else { return nil }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
        request.setValue("Spotter-iOS/1.0 (nutrition logging)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 404 { return nil }
        guard (200..<300).contains(status),
              let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw NativeAPIError.invalidResponse }
        guard number(root["status"]) == 1, let product = root["product"] as? [String: Any] else { return nil }
        let title = ["product_name_zh", "product_name", "product_name_en", "product_name_fr"].lazy
            .compactMap { (product[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty } ?? ""
        let brand = (product["brands"] as? String)?.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        let name = brand.isEmpty || title.localizedCaseInsensitiveContains(brand) ? title : brand + " " + title
        let nutriments = product["nutriments"] as? [String: Any] ?? [:]
        let kcal = number(nutriments["energy-kcal_100g"]) ?? number(nutriments["energy-kj_100g"]).map { $0 / 4.184 }
            ?? number(nutriments["energy_100g"]).map { $0 / 4.184 }
        var facts: NativeNutritionFood.Facts?
        if let protein = number(nutriments["proteins_100g"]), let carbs = number(nutriments["carbohydrates_100g"]),
           let fat = number(nutriments["fat_100g"]) {
            let energy = kcal ?? nutritionCalories(protein: protein, carbs: carbs, fat: fat)
            let candidate = NativeNutritionFood.Facts(calories: energy, protein: protein, carbs: carbs, fat: fat)
            if [energy, protein, carbs, fat].allSatisfy({ $0 >= 0 }), energy <= 1_000, protein + carbs + fat <= 103 {
                facts = candidate
            }
        }
        let portion = portion(servingSize: product["serving_size"] as? String,
                              quantity: number(product["serving_quantity"]),
                              unit: product["serving_quantity_unit"] as? String)
        guard !name.isEmpty || facts != nil else { return nil }
        return Product(name: String(name.prefix(100)), per100g: facts, portion: portion)
    }

    /// OFF's normalized quantity can be grams or millilitres. Only a serving with a known mass
    /// can scale the nutrition values. A count applies only to the stated serving, never the package.
    static func portion(servingSize: String?, quantity: Double?, unit: String?) -> NativeFoodPortion? {
        let label = (servingSize ?? "").folding(options: [.widthInsensitive, .diacriticInsensitive, .caseInsensitive],
                                                locale: Locale(identifier: "en_US_POSIX"))
        let normalizedUnit = unit?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let labelRange = NSRange(label.startIndex..., in: label)
        let ambiguous = #"\bnet\s*(?:wt|weight|contents?)\b|\b(?:poids|contenu)\s+net\b|净重|淨重|净含量|淨含量|\d\s*[x×]\s*\d"#
        guard normalizedUnit != "ml", label.range(of: ambiguous, options: .regularExpression) == nil else { return nil }

        let masses = servingMass.matches(in: label, range: labelRange)
        guard masses.count <= 1 else { return nil }
        let match = masses.first
        let statedGrams = match.flatMap { capture(label, in: $0, at: 1) }.flatMap(number)
        let volume = #"\d\s*(?:m\s*l|millilit(?:er|re)s?|毫升)(?![a-z])"#
        let normalizedGrams = normalizedUnit == "g" && label.range(of: volume, options: .regularExpression) == nil ? quantity : nil
        guard let grams = statedGrams ?? normalizedGrams, (0.1...3_000).contains(grams) else { return nil }

        var countLabel = label
        if let match, let range = Range(match.range, in: countLabel) { countLabel.removeSubrange(range) }
        countLabel = countLabel
            .replacingOccurrences(of: #"^\s*(?:serving(?: size)?|taille de la portion|portion(?: de)?|per|pour|份量|每份)\s*[:：]?\s*"#,
                                  with: "", options: .regularExpression)
        let perItemMarker = #"\b(?:each|per (?:piece|unit|item)|chacun(?:e)?|par (?:unite|piece))\b|每[个個枚片块塊颗顆]"#
        let weightPerItem = countLabel.range(of: perItemMarker, options: .regularExpression) != nil
        countLabel = countLabel
            .replacingOccurrences(of: perItemMarker, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "():：[]-–,/")))
        let countMatch = servingCount.firstMatch(in: countLabel, range: NSRange(countLabel.startIndex..., in: countLabel))
        guard let count = countMatch.flatMap({ capture(countLabel, in: $0, at: 1) }).flatMap(number) else {
            return weightPerItem ? nil : NativeFoodPortion(name: "份", grams: grams)
        }
        guard count.isFinite && count > 0 else { return nil }
        let perItem = weightPerItem ? grams : grams / count
        return (0.1...3_000).contains(perItem) ? NativeFoodPortion(name: "个", grams: perItem) : nil
    }

    private static let servingMass = try! NSRegularExpression(
        pattern: #"(?:^|(?<=[\s(\[])|(?<=每[个個枚片块塊颗顆]))(\d+(?:[.,]\d+)?)\s*(?:g(?:rams?)?(?![a-z])|grammes?(?![a-z])|公克|克)"#)
    private static let servingCount = try! NSRegularExpression(
        pattern: #"^(\d+)\s*(?:[个個枚片块塊颗顆只隻条條](?:[\p{L}\s]{0,32})|(?:[\p{L}'’-]+\s+){0,4}(?:pieces?|pcs?|units?|items?|ct|tarts?|tartelettes?|pastr(?:y|ies)|cookies?|biscuits?|crackers?|bars?|barres?|slices?|tranches?|morceaux?|muffins?|rolls?|patt(?:y|ies)|galettes?|nuggets?|dumplings?))$"#)

    private static func capture(_ text: String, in match: NSTextCheckingResult, at index: Int) -> String? {
        Range(match.range(at: index), in: text).map { String(text[$0]) }
    }

    private static func number(_ value: Any?) -> Double? {
        if let value = value as? NSNumber { return value.doubleValue.isFinite ? value.doubleValue : nil }
        if let value = value as? String { return Double(value.replacingOccurrences(of: ",", with: ".")) }
        return nil
    }
}

// MARK: - Nutrition label reading on the device

/// Fallback reader for Canadian bilingual and Chinese nutrition labels when the in-app AI is unavailable.
enum NativeLabelReader {
    struct Reading {
        var calories: Double?
        var protein: Double?
        var carbs: Double?
        var fat: Double?
        var servingGrams: Double?
        var per100g = false

        var isEmpty: Bool { calories == nil && protein == nil && carbs == nil && fat == nil }
    }

    static func read(_ jpeg: Data) async -> Reading {
        let text = await Task.detached(priority: .userInitiated) { () -> String in
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US", "fr-FR", "zh-Hans"]
            request.usesLanguageCorrection = true
            try? VNImageRequestHandler(data: jpeg, options: [:]).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        }.value
        return parse(text)
    }

    static func parse(_ text: String) -> Reading {
        func match(_ pattern: String) -> Double? {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                  let result = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let range = Range(result.range(at: 1), in: text) else { return nil }
            return Double(text[range].replacingOccurrences(of: ",", with: "."))
        }
        let number = "(\\d+(?:[.,]\\d+)?)"
        var reading = Reading()
        reading.per100g = match("(?:per|pour|每)\\s*(100)\\s*(?:g|克)") != nil
        reading.servingGrams = match("[(（]\\s*" + number + "\\s*(?:g|克)\\s*[)）]")
            ?? match("(?:serving size|portion|每份|份量)[^\\d\\n]{0,24}" + number + "\\s*(?:g|克)")
        reading.calories = match("calories[^\\d\\n]{0,8}" + number) ?? match(number + "\\s*(?:kcal|千卡|大卡)")
            ?? match(number + "\\s*(?:kj|千焦)").map { ($0 / 4.184 * 10).rounded() / 10 }
        reading.fat = match("(?:total\\s+fat|fat|lipides|脂肪)[^\\d\\n]{0,18}" + number + "\\s*(?:g|克)")
        reading.carbs = match("(?:carbohydrates?|glucides|碳水化合物)[^\\d\\n]{0,18}" + number + "\\s*(?:g|克)")
        reading.protein = match("(?:protein|protéines|proteines|蛋白质)[^\\d\\n]{0,18}" + number + "\\s*(?:g|克)")
        return reading
    }
}

// MARK: - Cameras

@MainActor
private struct NativeLabelCameraView: View {
    let complete: (Data?) -> Void
    @State private var allowed: Bool?

    var body: some View {
        Group {
            if allowed == true, UIImagePickerController.isSourceTypeAvailable(.camera) {
                NativeFoodCamera { complete($0) }.ignoresSafeArea()
            } else if allowed == nil {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(SpotterPalette.background.ignoresSafeArea())
            } else {
                NativeCameraUnavailable(message: UIImagePickerController.isSourceTypeAvailable(.camera)
                                            ? "允许相机权限后即可拍营养标签。也可以在「快速录入」里从相册选择。"
                                            : "这台设备暂时无法拍照。可以在「快速录入」里从相册选择。",
                                        close: { complete(nil) })
            }
        }
        .task { allowed = await nativeCameraAllowed() }
    }
}

@MainActor
private struct NativeBarcodeScannerView: View {
    let found: (String) -> Void
    let cancel: () -> Void
    @Environment(\.spotterAccent) private var accent
    @State private var allowed: Bool?
    @State private var typing = false
    @State private var typed = ""

    var body: some View {
        ZStack {
            if allowed == true {
                NativeBarcodeCamera(found: found).ignoresSafeArea()
                VStack(spacing: 0) {
                    HStack {
                        Button(action: cancel) {
                            Image(systemName: "xmark").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                                .frame(width: 40, height: 40).background(.black.opacity(0.45), in: Circle())
                                .frame(width: 44, height: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityLabel("关闭扫码")
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    Spacer()
                    RoundedRectangle(cornerRadius: 18).strokeBorder(accent.fill, lineWidth: 3)
                        .frame(width: 270, height: 150)
                        .accessibilityHidden(true)
                    Text("把包装上的条码放进框内").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .padding(.top, 14)
                    Spacer()
                    Button { typing = true } label: {
                        Label("手动输入条码", systemImage: "keyboard").font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: 44)
                            .background(.black.opacity(0.45), in: Capsule())
                    }
                    .buttonStyle(.spotterPress)
                    .padding(.bottom, 24)
                }
                .padding(.top, 8)
            } else if allowed == nil {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(SpotterPalette.background.ignoresSafeArea())
            } else {
                NativeCameraUnavailable(message: "允许相机权限后即可扫描食品条码。也可以手动输入条码。", manualEntry: { typing = true }, close: cancel)
            }
        }
        .background(Color.black.ignoresSafeArea())
        .task { allowed = await nativeCameraAllowed() }
        .alert("输入条码", isPresented: $typing) {
            TextField("8–14 位数字", text: $typed).keyboardType(.numberPad)
            Button("取消", role: .cancel) {}
            Button("查询") {
                let code = typed.filter(\.isNumber)
                if (8...14).contains(code.count) { found(code) }
            }
        } message: { Text("条码印在包装背面，通常在数字下方。") }
    }
}

@MainActor
private func nativeCameraAllowed() async -> Bool {
    guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return false }
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return true
    case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
    default: return false
    }
}

@MainActor
private struct NativeCameraUnavailable: View {
    let message: String
    var manualEntry: (() -> Void)? = nil
    let close: () -> Void
    @Environment(\.openURL) private var openURL

    init(message: String, manualEntry: (() -> Void)? = nil, close: @escaping () -> Void) {
        self.message = message
        self.manualEntry = manualEntry
        self.close = close
    }

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "camera").font(.largeTitle).foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
            Text(message).font(.subheadline).multilineTextAlignment(.center).foregroundStyle(SpotterPalette.ink)
            if let manualEntry {
                Button(action: manualEntry) { Label("手动输入条码", systemImage: "keyboard") }.buttonStyle(.spotterPrimaryControl)
            }
            if AVCaptureDevice.authorizationStatus(for: .video) == .denied {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                } label: { Label("打开相机设置", systemImage: "gear") }
                .buttonStyle(.spotterControl)
            }
            Button("关闭", action: close).buttonStyle(.spotterControl)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SpotterPalette.background.ignoresSafeArea())
    }
}

private struct NativeBarcodeCamera: UIViewControllerRepresentable {
    let found: (String) -> Void

    func makeUIViewController(context: Context) -> NativeBarcodeCameraController {
        let controller = NativeBarcodeCameraController()
        controller.found = found
        return controller
    }

    func updateUIViewController(_ controller: NativeBarcodeCameraController, context: Context) {
        controller.found = found
    }
}

final class NativeBarcodeCameraController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var found: ((String) -> Void)?
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "spotter.barcode.session")
    private var preview: AVCaptureVideoPreviewLayer?
    private var delivered = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { return }
        session.beginConfiguration()
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            let wanted: [AVMetadataObject.ObjectType] = [.ean13, .ean8, .upce, .code128, .itf14]
            output.metadataObjectTypes = wanted.filter { output.availableMetadataObjectTypes.contains($0) }
        }
        session.commitConfiguration()
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let session = self.session
        queue.async { if !session.isRunning { session.startRunning() } }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = self.session
        queue.async { if session.isRunning { session.stopRunning() } }
    }

    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject],
                                    from connection: AVCaptureConnection) {
        guard let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first?
                .filter(\.isNumber), (8...14).contains(code.count) else { return }
        DispatchQueue.main.async { [weak self] in self?.deliver(code) }
    }

    private func deliver(_ code: String) {
        guard !delivered else { return }
        delivered = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        let session = self.session
        queue.async { session.stopRunning() }
        found?(code)
    }
}
