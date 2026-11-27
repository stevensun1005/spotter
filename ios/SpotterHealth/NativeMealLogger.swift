import AVFoundation
import CryptoKit
import PhotosUI
import SwiftUI
import UIKit
import Vision

// MARK: - Built-in food catalog

/// A household portion from the shared food catalog, e.g. "1 个（中）" = 50 g.
struct NativeFoodPortion: Codable, Hashable, Identifiable {
    let name: String
    let grams: Double

    var id: String { name + "/" + nutritionInput(grams) }
    var label: String { name + " · " + nutritionNumber(grams) + " g" }
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
                if let ref = item.ref, ref.hasPrefix("https://"), let host = URL(string: ref)?.host {
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
    @MainActor func searchRank(_ query: NativeFoodSearchQuery) -> Int? {
        let needle = query.needle
        guard !needle.isEmpty else { return 0 }
        let keys = NativeFoodSearchIndex.keys(for: self)
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

@MainActor
private enum NativeFoodSearchIndex {
    private static var cache: [String: [NativeFoodSearchKey]] = [:]

    static func keys(for food: NativeNutritionFood) -> [NativeFoodSearchKey] {
        let cacheKey = food.id + "\n" + food.name
        if let keys = cache[cacheKey] { return keys }
        let keys = ([food.name] + food.aliases).map(NativeFoodSearchKey.init).filter { !$0.key.isEmpty }
        cache[cacheKey] = keys
        return keys
    }
}

/// The two patterns `nativeFoodQuery` tries, compiled once instead of on every logger update.
private let nativeFoodQueryPatterns: [(NSRegularExpression, Int, Int)] = {
    // "g" and "grams" must not run into a Latin word, so "150 grams", "100 granola" and "100 gâteau" are not
    // read as food "s", "ranola" or "âteau". Chinese may follow directly, as in "150g鸡胸肉".
    let amount = "(\\d+(?:\\.\\d+)?)\\s*(?:公克|克|(?:grams?|g)(?!\\p{Script=Latin}))"
    // The lookbehind keeps the amount from starting inside a number, so "150g" is not read as food "1" with 50 g,
    // while names that end in a digit, such as "V8 200g", still split correctly.
    let patterns: [(String, Int, Int)] = [("^(.+?)\\s*(?<![\\d.])" + amount + "$", 1, 2), ("^" + amount + "\\s*(.+)$", 2, 1)]
    var compiled: [(NSRegularExpression, Int, Int)] = []
    for (pattern, nameGroup, gramsGroup) in patterns {
        if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
            compiled.append((regex, nameGroup, gramsGroup))
        }
    }
    return compiled
}()

/// Splits "鸡胸肉 150g" or "150 克 米饭" into the food name and an optional gram amount.
private func nativeFoodQuery(_ input: String) -> (name: String, grams: Double?) {
    let value = input.precomposedStringWithCompatibilityMapping.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else { return (value, nil) }
    for (regex, nameGroup, gramsGroup) in nativeFoodQueryPatterns {
        guard let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
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

    var facts: Facts {
        if let per100g, let grams { return per100g.scaled(grams) }
        guard let serving else { return Facts(calories: 0, protein: 0, carbs: 0, fat: 0) }
        return Facts(calories: serving.calories * servings, protein: serving.protein * servings,
                     carbs: serving.carbs * servings, fat: serving.fat * servings)
    }

    var amountText: String {
        if per100g != nil, let grams {
            if let portion {
                let count = grams / portion.grams
                return "\(nutritionNumber(count)) × \(portion.name) · \(nutritionNumber(grams)) g"
            }
            return nutritionNumber(grams) + " g"
        }
        let base = servings == 1 ? "1 份" : "\(nutritionNumber(servings)) 份"
        return totalGrams.map { base + " · " + nutritionNumber($0) + " g" } ?? base
    }

    /// Steps by a whole portion, 10 g, or half a serving.
    mutating func step(_ direction: Double) {
        if per100g != nil {
            let unit = portion?.grams ?? 10
            let next = ((grams ?? 0) + direction * unit)
            grams = min(3_000, max(portion == nil ? 1 : portion!.grams / 2, (next * 100).rounded() / 100))
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
private final class NativeMealSelection: ObservableObject {
    @Published var meal: NutritionShortcut

    init(_ meal: NutritionShortcut) {
        self.meal = meal
    }
}

@MainActor
private struct NativeMealSelectionView<Content: View>: View {
    @ObservedObject var selection: NativeMealSelection
    @ViewBuilder var content: (Binding<NutritionShortcut>) -> Content

    var body: some View { content($selection.meal) }
}

@MainActor
struct NativeMealLogger: View {
    fileprivate enum Tab: String, CaseIterable, Identifiable {
        case search = "搜索", custom = "自定义", favorites = "收藏", templates = "固定模版"
        var id: Self { self }
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
    private let recentsByMeal: [NutritionShortcut: [NativeRecentServing]]

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterGuide) private var guide
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    // Observe meal changes only in the controls and recent strip that display them.
    @State private var mealSelection: NativeMealSelection
    @State private var tab = Tab.search
    @State private var query = ""
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
    @State private var savingTemplate = false
    /// Payloads sent by attempts whose reply never confirmed the save, by record id.
    @State private var unconfirmed: [String: Set<Data>] = [:]
    @State private var templateName = ""
    @FocusState private var searchFocused: Bool
    @Namespace private var tabLine

    private static let catalog = NativeFoodCatalog.shared
    private static let foods = NativeNutritionFood.builtIn
    private static let foodsByCategory = Dictionary(grouping: foods) { $0.category ?? "" }

    init(api: NativeAPI, owner: String, date: String, meal: NutritionShortcut, payload: NutritionPayload,
         onSaved: @escaping (NativeQuickMealReceipt?) -> Void) {
        self.api = api
        self.owner = owner
        self.date = date
        self.payload = payload
        self.onSaved = onSaved
        self.recentsByMeal = payload.recentServingsByMeal()
        _mealSelection = State(initialValue: NativeMealSelection(meal.isMeal ? meal : .snack))
        _category = State(initialValue: Self.catalog?.categories.first?.id ?? "")
    }

    /// Read from the live payload so foods that load after the sheet opens still appear.
    private var personal: [NativeNutritionFood] {
        let added = Set(addedPersonal.map(\.id))
        return addedPersonal + payload.rows.compactMap { row in
            guard row.kind == "food", let id = row.id, !added.contains(id), let name = row.name, let facts = row.per100g else { return nil }
            var food = NativeNutritionFood(id: id, name: name, facts: facts)
            food.isPersonal = true
            food.emoji = "⭐️"
            return food
        }
    }

    private var store: NativeFoodLocalStore { .init(api: api, owner: owner) }
    private var templateStore: NativeFavoriteMealStore { .init(api: api, owner: owner) }
    private var guiding: Bool { guide?.step.presentation == .mealEditor }
    private var meal: NutritionShortcut { mealSelection.meal }
    private var allFoods: [NativeNutritionFood] { personal + Self.foods }
    private var totals: NativeNutritionFood.Facts {
        basket.reduce(.init(calories: 0, protein: 0, carbs: 0, fat: 0)) { $0.adding($1.facts) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                mealChoice.padding(.horizontal, 14).padding(.top, 6)
                searchField.padding(.horizontal, 14).padding(.top, 10)
                tabs.padding(.top, 6)
                Divider().overlay(SpotterPalette.line)
                content.frame(maxHeight: .infinity)
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
            Text("把已选的 \(basket.count) 项存为「\(meal.rawValue)」模版，以后在「固定模版」一键加入。")
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 8) {
            Button { dismiss() } label: {
                Image(systemName: "arrow.left").font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel(basket.isEmpty ? "返回" : "放弃已选食物并返回")
            .disabled(busy)
            Spacer(minLength: 0)
            NativeMealSelectionView(selection: mealSelection) { meal in
                Text("记录" + meal.wrappedValue.rawValue).font(.headline).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
            }
            Spacer(minLength: 0)
            Menu {
                Button { cover = .scanner } label: { Label("扫食物条码", systemImage: "barcode.viewfinder") }
                Button { cover = .camera } label: { Label("拍营养元素", systemImage: "camera") }
                Button { showLibrary = true } label: { Label("从相册识别营养表", systemImage: "photo") }
            } label: {
                Label("快速录入", systemImage: "bolt.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(accent.tint)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 36)
                    .background(accent.selection, in: Capsule())
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .disabled(busy || working != nil)
            .accessibilityLabel("快速录入：扫条码或识别营养表")
        }
        .padding(.leading, 6).padding(.trailing, 12).padding(.top, 6)
    }

    private var mealChoice: some View {
        NativeMealSelectionView(selection: mealSelection) { meal in
            SpotterGlassSegments(options: NutritionShortcut.allCases.filter(\.isMeal), value: meal, glass: false, compact: true,
                                 guideTarget: { $0 == .breakfast ? .mealChoice : nil }) { $0.rawValue }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("记入餐次")
        }
        .disabled(busy)
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

    private var tabs: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases) { option in
                let selected = option == tab
                Button {
                    withAnimation(motion) { tab = option }
                } label: {
                    VStack(spacing: 5) {
                        Text(option.rawValue)
                            .font(.subheadline.weight(selected ? .bold : .medium))
                            .foregroundStyle(selected ? SpotterPalette.ink : SpotterPalette.muted)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        ZStack {
                            Capsule().fill(Color.clear).frame(width: 22, height: 3)
                            if selected {
                                Capsule().fill(accent.tint).frame(width: 22, height: 3)
                                    .matchedGeometryEffect(id: "tab", in: tabLine)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: Content

    @ViewBuilder private var content: some View {
        let search = nativeFoodQuery(query)
        switch tab {
        case .search:
            if search.name.isEmpty { browser } else { results(search) }
        case .custom: customTab(search.name)
        case .favorites: favoritesTab(search.name)
        case .templates: templatesTab(search.name)
        }
    }

    /// Within a rank, everyday and personal foods come before chain and brand items, then list order applies,
    /// so "apple pie" means apple pie before a chain's.
    private func matches(_ foods: [NativeNutritionFood], _ text: String, limit: Int = 80) -> [NativeNutritionFood] {
        let query = NativeFoodSearchQuery(text)
        guard !query.needle.isEmpty else { return foods }
        let ranked = foods.enumerated().compactMap { index, food -> (order: (Int, Int, Int), food: NativeNutritionFood)? in
            guard let rank = food.searchRank(query) else { return nil }
            return ((rank, food.brand == nil ? 0 : 1, index), food)
        }
        return Array(ranked.sorted { $0.order < $1.order }.prefix(limit).map { $0.food })
    }

    private func results(_ search: (name: String, grams: Double?)) -> some View {
        let found = matches(allFoods, search.name)
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
                        withAnimation(motion) {
                            category = item.id
                            group = nil
                        }
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
        let inCategory = Self.foodsByCategory[current.id] ?? []
        let shown = group.map { selected in inCategory.filter { $0.group == selected } } ?? inCategory
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if current.id == Self.catalog?.categories.first?.id && group == nil {
                    NativeMealSelectionView(selection: mealSelection) { meal in
                        if let recents = recentsByMeal[meal.wrappedValue], !recents.isEmpty {
                            recentStrip(recents)
                        }
                    }
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
        Button {
            withAnimation(motion) { action() }
        } label: {
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

    private func customTab(_ text: String) -> some View {
        let mine = matches(personal, text)
        return ScrollView {
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
                if mine.isEmpty {
                    emptyState(text.isEmpty ? "还没有自定义食物" : "「我的食物」里没有「\(text)」",
                               detail: "扫码或拍营养标签后保存，下次直接搜索。") { EmptyView() }
                } else {
                    Text("我的食物 · \(mine.count)").font(.subheadline.weight(.semibold)).padding(.top, 4)
                    ForEach(mine) { card($0) }
                }
            }
            .padding(14)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func favoritesTab(_ text: String) -> some View {
        // Personal foods win over catalog foods with the same id, as before, without indexing all 972 on every render.
        let personalByID = Dictionary(personal.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let starred = matches(favorites.compactMap { personalByID[$0] ?? NativeNutritionFood.builtInByID[$0] }, text)
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if starred.isEmpty {
                    emptyState(text.isEmpty ? "还没有收藏" : "收藏里没有「\(text)」",
                               detail: "点开任意食物，在右上角点星标即可收藏。收藏保存在这台 iPhone。") { EmptyView() }
                } else {
                    ForEach(starred) { card($0) }
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
                        Label("把已选的 \(basket.count) 项存为模版", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.spotterControl)
                    .disabled(guiding)
                }
                if shown.isEmpty {
                    emptyState(templates.isEmpty ? "还没有固定模版" : "没有匹配的模版",
                               detail: "先选好一餐常吃的食物，再点上方「存为模版」。和「常用餐」是同一份清单。") { EmptyView() }
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
        let count = basket.filter { $0.foodId == food.id }.count
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

    private func addButton(_ label: String, count: Int = 0, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "plus").font(.system(size: 15, weight: .bold))
                .foregroundStyle(accent.tint)
                .frame(width: 36, height: 36)
                .background(accent.selection, in: Circle())
                .overlay(alignment: .topTrailing) {
                    if count > 0 {
                        Text("\(count)").font(.caption2.weight(.bold)).monospacedDigit()
                            .foregroundStyle(SpotterPalette.deep)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(accent.fill, in: Circle())
                            .offset(x: 5, y: -5)
                    }
                }
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(label)
        .accessibilityValue(count > 0 ? "已选 \(count) 份" : "")
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
        VStack(spacing: 6) {
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
                                    Text("\(basket.count)").font(.caption2.weight(.bold)).monospacedDigit()
                                        .foregroundStyle(.white)
                                        .frame(minWidth: 17, minHeight: 17)
                                        .background(Color.red, in: Circle())
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
                .disabled(basket.isEmpty)
                .accessibilityLabel(basket.isEmpty ? "还没有选择食物" : "已选 \(basket.count) 项，共 \(nutritionNumber(totals.calories)) 千卡")
                .accessibilityHint("查看和调整已选食物")
                NativeMealSelectionView(selection: mealSelection) { meal in
                    Button { Task { await save() } } label: {
                        ZStack {
                            if busy { ProgressView().tint(SpotterPalette.deep) }
                            else { Text(basket.isEmpty ? "完成" : "完成（\(basket.count)）").fontWeight(.bold) }
                        }
                        .foregroundStyle(SpotterPalette.deep)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(accent.fill.opacity(basket.isEmpty ? 0.5 : 1), in: Capsule())
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.spotterPress)
                    .disabled(basket.isEmpty || busy || guiding)
                    .accessibilityLabel(busy ? "正在保存" : "完成，记入\(meal.wrappedValue.rawValue)")
                }
            }
        }
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 6)
        .background(SpotterPalette.card.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(SpotterPalette.line) }
        .animation(motion, value: basket.count)
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
            NativeMealBasketSheet(items: $basket, meal: meal, saveTemplate: guiding ? nil : {
                sheet = nil
                templateName = ""
                savingTemplate = true
            })
        case .custom(let draft):
            NativeCustomFoodEditor(api: api, owner: owner, draft: draft, existing: personal.map(\.name), locked: guiding,
                                   takePhoto: { current in
                                       carryDraft = current
                                       queuedCover = .camera
                                       sheet = nil
                                   }) { food, grams in
                addedPersonal.removeAll { $0.id == food.id }
                addedPersonal.insert(food, at: 0)
                if let code = draft.barcode {
                    // An empty payload has not loaded yet, so it cannot say which saved foods still exist.
                    store.remember(barcode: code, food: food.id, known: payload.rows.isEmpty ? nil : Set(personal.map(\.id)))
                }
                if let grams { add(food, grams: grams) } else { show("已存入「我的食物」") }
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
        append(NativeMealLoggerItem(food: food, grams: grams, portion: portion),
               message: "已加入「\(food.name)」· " + (portion.map { "1 × " + $0.name } ?? nutritionNumber(grams) + " g"))
    }

    private func append(_ item: NativeMealLoggerItem, message: String) {
        error = nil
        if let index = basket.firstIndex(where: { $0.foodId != nil && $0.foodId == item.foodId && $0.per100g != nil && item.per100g != nil }),
           let grams = item.grams, (basket[index].grams ?? 0) + grams <= 3_000 {
            basket[index].grams = (basket[index].grams ?? 0) + grams
            if basket[index].portion != item.portion { basket[index].portion = nil }
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
        let preset = NativeFavoriteMeal(name: title, meal: meal.rawValue, foods: basket.map(NativeFavoriteMeal.Food.init(item:)))
        guard preset.record(id: preset.id.uuidString, day: date, meal: meal, servings: 1) != nil else {
            error = "这份组合的总重量或营养数值超出记餐范围，请减少已选食物。"
            return
        }
        do {
            templates = try templateStore.edit { $0.insert(preset, at: 0) }
            show("已存为模版「\(title)」")
        } catch { self.error = "暂时无法保存模版。" }
    }

    private func save() async {
        guard !busy, !basket.isEmpty, !guiding else { return }
        let records = basket.compactMap { $0.record(meal: meal, day: date) }
        guard records.count == basket.count else {
            error = "有食物的份量或营养数值超出可记录范围，请在已选列表里调整。"
            return
        }
        busy = true
        error = nil
        defer { busy = false }
        let sent = records.map { record in
            (record["id"] as? String ?? "", (try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])) ?? Data())
        }
        for (id, payload) in sent { unconfirmed[id, default: []].insert(payload) }
        do {
            // An earlier attempt may have been stored although its reply was lost. Remove the records from it that
            // were taken out of the list or changed since, so this attempt replaces them instead of being skipped.
            let current = Dictionary(sent, uniquingKeysWith: { first, _ in first })
            for (id, payloads) in unconfirmed where current[id] == nil || payloads.count > 1 {
                try await api.spotterSend("/api/library", body: ["action": "remove", "kind": "nutrition", "id": id, "expectedOwner": owner])
                unconfirmed[id] = current[id].map { Set([$0]) }
            }
            var receipt: NativeQuickMealReceipt?
            if records.count == 1, let item = basket.first {
                let response = try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner,
                                                                              "revision": NSNull(), "data": records[0]])
                let updated = try JSONDecoder().decode(NativeJSON.self, from: response)["updated"].string
                if !updated.isEmpty { receipt = NativeQuickMealReceipt(id: item.id, updated: updated, name: item.name, day: date) }
            } else {
                var query = URLComponents()
                query.path = "/api/data"
                query.queryItems = [URLQueryItem(name: "expectedOwner", value: owner)]
                guard let path = query.string else { throw NativeAPIError.invalidRequest }
                let body: [String: Any] = ["format": "spotter-backup", "version": 1, "training": [], "heart": [], "library": records]
                let data = try await api.request(path, method: "POST", json: JSONSerialization.data(withJSONObject: body), for: owner)
                let result = try JSONDecoder().decode(NativeJSON.self, from: data)
                guard Int(result["added"].number) + Int(result["skipped"].number) == records.count else {
                    throw NativeAPIError.invalidResponse
                }
            }
            unconfirmed = [:]
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            onSaved(receipt)
            basket = []
            dismiss()
        } catch {
            self.error = "\(error.localizedDescription) 再点「完成」会继续保存这一次的食物，不会重复记录。"
        }
    }

    // MARK: Quick entry

    private func lookup(_ raw: String) async {
        let code = raw.filter(\.isNumber)
        guard (8...14).contains(code.count) else {
            show("条码无法识别，请重新扫描。")
            return
        }
        if let id = store.food(forBarcode: code), let food = personal.first(where: { $0.id == id }) {
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
                if let serving = product.servingGrams { draft.consumed = nutritionInput(serving) }
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
                            TextField(portion == nil ? "克数" : "份数", text: $amount)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.center)
                                .font(.title3.weight(.semibold)).monospacedDigit()
                                .frame(minHeight: 44)
                                .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12))
                                .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
                                .accessibilityLabel(portion == nil ? "克数" : "份数")
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
        let step: Double = portion == nil ? 10 : 0.5
        let next = max(portion == nil ? 1 : 0.5, ((current + direction * step) * 10).rounded() / 10)
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
}

// MARK: - Basket sheet

@MainActor
private struct NativeMealBasketSheet: View {
    @Binding var items: [NativeMealLoggerItem]
    let meal: NutritionShortcut
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
                            Text("千卡 · \(items.count) 项").font(.subheadline).foregroundStyle(SpotterPalette.muted)
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
                    Text("点「完成」后按\(meal.rawValue)逐项记入饮食记录。").font(.caption).foregroundStyle(SpotterPalette.muted)
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
    var note: String?

    init(name: String = "") { self.name = String(name.prefix(100)) }

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
    let saved: (NativeNutritionFood, Double?) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var draft: NativeCustomFoodDraft
    @State private var busy = false
    @State private var error: String?

    init(api: NativeAPI, owner: String, draft: NativeCustomFoodDraft, existing: [String], locked: Bool,
         takePhoto: @escaping (NativeCustomFoodDraft) -> Void, saved: @escaping (NativeNutritionFood, Double?) -> Void) {
        self.api = api
        self.owner = owner
        self.existing = existing
        self.locked = locked
        self.takePhoto = takePhoto
        self.saved = saved
        var initial = draft
        if initial.consumed.isEmpty { initial.consumed = initial.basis == .serving ? initial.servingGrams : "" }
        _draft = State(initialValue: initial)
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
        let typed = draft.consumed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !typed.isEmpty, let grams = nutritionValue(typed), (0.1...3_000).contains(grams) else { return nil }
        return grams
    }

    private var name: String { draft.name.trimmingCharacters(in: .whitespacesAndNewlines) }

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
                Section {
                    SpotterGlassSegments(options: [NativeCustomFoodDraft.Basis.per100g, .serving], value: $draft.basis, glass: false) {
                        $0 == .per100g ? "每 100 g" : "每份"
                    }
                    .accessibilityElement(children: .contain).accessibilityLabel("营养数值的基准")
                    if draft.basis == .serving {
                        numberField("每份重量（g）", $draft.servingGrams)
                    }
                    numberField("蛋白质（g）", $draft.protein)
                    numberField("碳水（g）", $draft.carbs)
                    numberField("脂肪（g）", $draft.fat)
                    numberField("热量（千卡，留空自动估算）", $draft.calories)
                } header: {
                    Text("营养数值")
                } footer: {
                    if let facts = per100g {
                        Text("每 100 g：\(facts.description)")
                    } else {
                        Text("填写蛋白质、碳水和脂肪。按每份填写时需要每份克数，App 会换算成每 100 g 保存。")
                    }
                }
                Section {
                    numberField("这次吃了多少克（选填）", $draft.consumed)
                } footer: {
                    Text("填写后保存时会同时加入这一餐。")
                }
                if let error { Section { Text(error).font(.footnote).foregroundStyle(.red) } }
                Section {
                    Button { Task { await save(add: true) } } label: {
                        Text(busy ? "保存中…" : (consumedGrams == nil ? "保存到我的食物" : "保存并加入这一餐")).fontWeight(.semibold)
                    }
                    .disabled(busy || locked || per100g == nil || !(1...100).contains(name.utf16.count))
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle("自定义食物")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { NutritionDismissButton(label: "取消") { dismiss() }.disabled(busy) } }
            .animation(motion, value: draft.basis)
        }
        .tint(accent.tint)
        .interactiveDismissDisabled(busy)
        .presentationDetents([.large])
    }

    private func numberField(_ title: String, _ value: Binding<String>) -> some View {
        TextField(title, text: value).keyboardType(.decimalPad).accessibilityLabel(title)
    }

    private func save(add: Bool) async {
        guard !busy, let facts = per100g, (1...100).contains(name.utf16.count) else { return }
        if existing.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
            error = "「我的食物」里已有这个名称。可以加上品牌或口味来区分。"
            return
        }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner,
                "data": ["kind": "food", "id": draft.id, "name": name, "per100g": facts.payload]
            ])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            var food = NativeNutritionFood(id: draft.id, name: name, facts: facts)
            food.isPersonal = true
            food.emoji = "⭐️"
            saved(food, add ? consumedGrams : nil)
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
        let servingGrams: Double?
    }

    static func product(_ code: String) async throws -> Product? {
        var components = URLComponents(string: "https://world.openfoodfacts.org/api/v2/product/\(code).json")
        components?.queryItems = [URLQueryItem(name: "fields",
                                               value: "product_name,product_name_zh,product_name_en,product_name_fr,brands,nutriments,serving_quantity")]
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
        let serving = number(product["serving_quantity"]).flatMap { (0.1...3_000).contains($0) ? $0 : nil }
        guard !name.isEmpty || facts != nil else { return nil }
        return Product(name: String(name.prefix(100)), per100g: facts, servingGrams: serving)
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
