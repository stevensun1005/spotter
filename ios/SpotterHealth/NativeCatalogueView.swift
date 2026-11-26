import Charts
import ImageIO
import SwiftUI
import UIKit

private struct NativeCatalogueFilters: Equatable, Sendable {
    var query = ""
    var area = ""
    var type = ""
    var equipment = ""
    var muscles: Set<String> = []
    var usesMuscles = false
    var anyMuscle = false
    var usesGear = true
    var scope: NativeCatalogScope = .all
}

private struct NativeCatalogueFilterRequest: Equatable, Sendable {
    let filters: NativeCatalogueFilters
    let gear: Set<String>
    let profiles: [NativeJSON]
    let names: [String]
}

private enum NativeCatalogueSheet: Identifiable {
    case details(NativeCatalogEntry, source: String?)
    case variants(NativeCatalogFamily, NativeCatalogEntry)
    case create(String)
    case filters

    var id: String {
        switch self {
        case .details(let entry, _): return "details:" + entry.id
        case .variants(let family, _): return "family:" + family.id
        case .create: return "create"
        case .filters: return "filters"
        }
    }
}

@MainActor
struct NativeCatalogueBrowser: View {
    @Environment(\.spotterAccent) private var accent
    @ObservedObject var store: NativeWorkoutStore
    let addToPlan: (NativeCatalogEntry) -> Void

    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Namespace private var detailZoom
    @AppStorage("spotter.native.catalogue.cards") private var cards = true
    @AppStorage(NativeGymPreferences.storageKey) private var gymPreferences = Data()
    @AppStorage(NativePreferenceKey.equipment) private var legacyEquipment = ""
    @AppStorage(NativePreferenceKey.exerciseLanguage) private var language = "zh"
    @State private var index: NativeCatalogIndex?
    @State private var results: NativeCatalogResults?
    @State private var filters = NativeCatalogueFilters()
    @State private var loadAttempt = 0
    @State private var loadFailed = false
    @State private var resultsVersion = 0
    @State private var sectionLimits: [String: Int] = [:]
    @State private var sheet: NativeCatalogueSheet?
    @State private var pendingMove: NativeCatalogEntry?
    @FocusState private var searchFocused: Bool
    @AccessibilityFocusState private var focusedSection: String?

    private var profiles: [NativeJSON] {
        store.libraryRows.filter { $0["kind"].string == "exercise" }.map { $0["item"] }
    }

    private var names: [String] {
        let plans = store.plans.filter { $0.owner == store.owner }
        return plans.flatMap { $0.data["exercises"].array.map { $0["name"].string } }
            + store.logs.flatMap { $0.data["plan"]["exercises"].array.map { $0["name"].string } }
    }

    private var request: NativeCatalogueFilterRequest {
        NativeCatalogueFilterRequest(filters: filters, gear: selectedGear, profiles: profiles, names: names)
    }

    private var selectedGear: Set<String> {
        NativeGymPreferences.read(gymPreferences, legacy: legacyEquipment).catalogueGear
    }

    private var allowsMotion: Bool { !reduceMotion && !systemReduceMotion }
    private var filterMotion: Animation? {
        allowsMotion ? .spring(response: 0.26, dampingFraction: 0.86) : nil
    }

    var body: some View {
        VStack(spacing: 8) {
            searchBar
            if let index {
                GeometryReader { geometry in
                    HStack(alignment: .top, spacing: 7) {
                        areaRail(index)
                            .frame(width: min(91, max(62, geometry.size.width * 0.19)))
                        VStack(alignment: .leading, spacing: 7) {
                            equipmentBar(index)
                            scopeBar
                            if let results {
                                resultSummary(results)
                                resultPane(results, index: index)
                            } else {
                                ProgressView("正在加载动作…")
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                }
                .task(id: request) { await refresh(index: index, request: request) }
            } else if loadFailed {
                VStack(spacing: 10) {
                    Text("无法读取动作库，请重试。").foregroundStyle(SpotterPalette.muted)
                    Button("重试") { loadAttempt += 1 }
                        .buttonStyle(SpotterNativeButtonStyle(primary: false))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ProgressView("正在读取动作库…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: loadAttempt) {
            loadFailed = false
            do {
                let data = try await Task.detached(priority: .userInitiated) { try NativeCatalogIndex.load() }.value
                if !Task.isCancelled { index = data }
            } catch {
                if !Task.isCancelled { loadFailed = true }
            }
        }
        .sheet(item: $sheet, onDismiss: presentPlanIfNeeded) { route in
            if let index {
                sheetContent(route, index: index).presentationDragIndicator(.visible)
            }
        }
    }

    private var searchBar: some View {
        SpotterGlassGroup(spacing: 4) {
            HStack(spacing: 7) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(SpotterPalette.muted)
                        .accessibilityHidden(true)
                    TextField("搜索动作名称", text: $filters.query)
                        .font(.system(size: 15))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($searchFocused)
                        .submitLabel(.search)
                        .accessibilityLabel("搜索动作")
                        .onSubmit { searchFocused = false }
                    if !filters.query.isEmpty {
                        Button { filters.query = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(SpotterPalette.muted)
                                .frame(width: 28, height: 38)
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityLabel("清除搜索")
                        .transition(.opacity)
                    }
                }
                .padding(.leading, 11)
                .padding(.trailing, 6)
                .animation(filterMotion, value: filters.query.isEmpty)
                .frame(height: 43)
                .spotterGlass(cornerRadius: 24, tint: SpotterPalette.card.opacity(0.75), interactive: false)
                catalogueIconButton(cards ? "list.bullet" : "square.grid.2x2",
                                    label: cards ? "切到列表" : "切到卡片",
                                    size: 43, glass: true) { cards.toggle() }
                catalogueIconButton("plus", label: "新建自定义动作", size: 43, tint: accent.fill, glass: true) {
                    searchFocused = false
                    sheet = .create("")
                }
                .disabled(index == nil)
            }
        }
    }

    private func areaRail(_ index: NativeCatalogIndex) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 3) {
                ForEach(index.areas) { item in
                    let children = item.children ?? []
                    let expanded = !children.isEmpty && (filters.area == item.id || children.contains { $0.id == filters.area })
                    areaButton(item, hasChildren: !children.isEmpty, expanded: expanded)
                    if expanded {
                        ForEach(children) { child in
                            areaButton(child, hasChildren: false, expanded: false, isChild: true)
                                .transition(.opacity)
                        }
                    }
                }
            }
            .padding(4)
            .animation(filterMotion, value: filters.area)
        }
        .background(SpotterPalette.adaptive(0xe9eee5, 0x26332a), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityLabel("部位筛选")
    }

    private func areaButton(_ area: NativeCatalogArea, hasChildren: Bool, expanded: Bool, isChild: Bool = false) -> some View {
        let selected = filters.area == area.id
        return Button {
            searchFocused = false
            filters.area = area.id
        } label: {
            HStack(spacing: 2) {
                Text(area.title)
                    .font(.system(size: isChild ? 11 : 13, weight: selected || expanded ? .semibold : .regular))
                    .lineLimit(isChild ? 2 : 1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                if hasChildren {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 8, weight: .medium))
                        .accessibilityHidden(true)
                }
            }
            .padding(.leading, isChild ? 9 : 7)
            .padding(.trailing, 4)
            .frame(minHeight: isChild ? 33 : 38)
            .foregroundStyle(selected || expanded ? SpotterPalette.ink : SpotterPalette.muted)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isChild ? SpotterPalette.wash : SpotterPalette.card)
                        .overlay(alignment: .leading) {
                            Capsule().fill(SpotterPalette.accent).frame(width: 3).padding(.vertical, 4)
                        }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private func equipmentBar(_ index: NativeCatalogIndex) -> some View {
        let all = results?.equipmentOptions ?? index.equipmentOptions
        let featured = ["barbell", "dumbbell", "kettlebell", "cable"]
        let ordered = featured.filter(all.contains) + all.filter { !featured.contains($0) }
        return ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 5) {
                catalogueChip("置顶", symbol: "star", selected: filters.scope == .pinned) {
                    filters.scope = filters.scope == .pinned ? .all : .pinned
                    filters.area = ""
                    filters.equipment = ""
                }
                ForEach(ordered, id: \.self) { gear in
                    catalogueChip(index.label(gear), selected: filters.equipment == gear) {
                        filters.equipment = filters.equipment == gear ? "" : gear
                    }
                }
            }
            .padding(.vertical, 2)
            .animation(filterMotion, value: filters.equipment)
            .animation(filterMotion, value: filters.scope)
        }
        .frame(height: 48)
        .accessibilityLabel("器械快捷筛选")
    }

    private var scopeBar: some View {
        HStack(spacing: 8) {
            scopeButton("精选动作", selected: filters.scope != .frequent) { filters.scope = .all }
            scopeButton("常用动作", selected: filters.scope == .frequent) {
                filters.scope = filters.scope == .frequent ? .all : .frequent
                filters.area = ""
                filters.equipment = ""
            }
            Spacer(minLength: 0)
            catalogueIconButton("slider.horizontal.3", label: "筛选", size: 44) {
                searchFocused = false
                sheet = .filters
            }
        }
        .animation(filterMotion, value: filters.scope)
    }

    private func scopeButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            searchFocused = false
            action()
        } label: {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
        .buttonStyle(SpotterChoiceStyle(selected: selected, horizontalPadding: 6))
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private func resultSummary(_ result: NativeCatalogResults) -> some View {
        HStack(spacing: 3) {
            Text("\(result.count.formatted(.number.grouping(.never))) 个结果")
                .font(.system(size: 14))
                .foregroundStyle(SpotterPalette.muted)
                .accessibilityAddTraits(.updatesFrequently)
            if !selectedGear.isEmpty {
                Spacer(minLength: 0)
                Button {
                    filters.usesGear.toggle()
                } label: {
                    Text(filters.usesGear ? "显示所有器械" : "只显示我的器械")
                        .font(.system(size: 11)).underline()
                }
                .buttonStyle(.spotterPress)
                .foregroundStyle(SpotterPalette.accent)
            }
        }
        .padding(.vertical, 2)
    }

    private func resultPane(_ result: NativeCatalogResults, index: NativeCatalogIndex) -> some View {
        ScrollViewReader { scroll in
            HStack(alignment: .top, spacing: 5) {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        Color.clear.frame(height: 0).id("spotter.catalogue.start")
                        if !result.featured.isEmpty { featuredEntries(result.featured, index: index) }
                        if let name = newSearchName(in: index) {
                            Button { searchFocused = false; sheet = .create(name) } label: {
                                Label("创建「\(name)」", systemImage: "plus")
                                    .lineLimit(2)
                            }
                            .buttonStyle(SpotterNativeButtonStyle(primary: false))
                        }
                        ForEach(result.sections) { section in
                            catalogueSection(section, index: index).id(section.id)
                        }
                        if result.count == 0 {
                            Text(filters.scope == .pinned ? "暂无符合条件的置顶动作。" :
                                 filters.scope == .frequent ? "暂无符合条件的常用动作。" : "当前搜索和筛选条件下没有动作。")
                                .font(.footnote)
                                .foregroundStyle(SpotterPalette.muted)
                                .padding(8)
                        }
                        catalogueAttribution
                    }
                    .padding(.bottom, 6)
                }
                .scrollDismissesKeyboard(.interactively)
                .accessibilityLabel("动作列表")
                if result.sections.count > 1 {
                    jumpRail(result.sections) { section in
                        searchFocused = false
                        withAnimation(allowsMotion ? .easeInOut(duration: 0.24) : nil) {
                            scroll.scrollTo(section.id, anchor: .top)
                        }
                        focusedSection = section.id
                    }
                }
            }
            .onChange(of: resultsVersion) { _ in scroll.scrollTo("spotter.catalogue.start", anchor: .top) }
        }
    }

    @ViewBuilder
    private var catalogueAttribution: some View {
        if let notice = URL(string: AppConfiguration.defaultOrigin + "/open-gym/NOTICE.txt"),
           let source = URL(string: AppConfiguration.defaultOrigin + "/open-gym/catalogue-source.zip") {
            VStack(alignment: .leading, spacing: 6) {
                Link("动作库授权和来源", destination: notice)
                Link("下载目录源文件", destination: source)
            }
            .font(.caption2)
            .foregroundStyle(SpotterPalette.accent)
            .padding(.vertical, 6)
        }
    }

    private func jumpRail(_ sections: [NativeCatalogSection], jump: @escaping (NativeCatalogSection) -> Void) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 1) {
                ForEach(sections) { section in
                    Button { jump(section) } label: {
                        Text(section.jumpLabel)
                            .font(.system(size: 11, weight: .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .frame(width: 27, height: 31)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .foregroundStyle(SpotterPalette.accent)
                    .accessibilityLabel("跳到 " + section.title)
                }
            }
            .padding(.vertical, 4)
        }
        .background(SpotterPalette.adaptive(0xf7faf5, 0x242e27), in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        .frame(width: 29)
        .accessibilityLabel("器械分区导航")
    }

    private func catalogueSection(_ section: NativeCatalogSection, index: NativeCatalogIndex) -> some View {
        let batch = filters.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 8 : 40
        let limit = sectionLimits[section.id] ?? batch
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Text(section.title)
                    .font(.system(size: 16, weight: .bold))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($focusedSection, equals: section.id)
                Spacer(minLength: 0)
                Text("\(section.rows.count.formatted(.number.grouping(.never))) 个")
                    .font(.system(size: 12))
                    .foregroundStyle(SpotterPalette.muted)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6, alignment: .top), count: cards ? 2 : 1), spacing: 6) {
                ForEach(section.rows.prefix(limit)) { entry in
                    entryRow(entry, index: index, vertical: cards, source: "section:" + section.id + ":" + entry.id)
                }
            }
            if section.rows.count > limit {
                Button("显示更多") { sectionLimits[section.id] = limit + batch }
                    .font(.system(size: 12, weight: .semibold))
                    .buttonStyle(SpotterNativeButtonStyle(primary: false))
                    .accessibilityLabel("显示更多 " + section.title)
            }
        }
    }

    private func featuredEntries(_ entries: [NativeCatalogEntry], index: NativeCatalogIndex) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 5) {
                ForEach(entries) { entry in
                    entryRow(entry, index: index, vertical: false, source: "featured:" + entry.id)
                        .frame(width: 177)
                }
            }
            .padding(1)
        }
        .accessibilityLabel("精选推荐")
    }

    @ViewBuilder
    private func entryRow(_ entry: NativeCatalogEntry, index: NativeCatalogIndex, vertical: Bool, source: String) -> some View {
        let chinese = index.family(for: entry)?.title ?? entry.name
        let title = if entry.en.isEmpty || entry.en == chinese || language == "zh" {
            chinese
        } else if language == "en" {
            entry.en
        } else {
            chinese + " · " + entry.en
        }
        let key = index.nameKey(entry.name)
        let isPinned = profiles.contains { $0["pinned"].bool && index.nameKey($0["name"].string) == key }
        let row = Button {
            let zoomSource = searchFocused ? nil : source
            searchFocused = false
            sheet = .details(entry, source: zoomSource)
        } label: {
            if vertical {
                VStack(alignment: .leading, spacing: 4) {
                    NativeCatalogueCover(index: index, entry: entry, ratio: 5.0 / 3.0)
                    entryText(entry, title: title, pinned: isPinned, index: index)
                        .padding(.horizontal, 2)
                        .padding(.bottom, 3)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            } else {
                HStack(spacing: 5) {
                    NativeCatalogueCover(index: index, entry: entry, ratio: 1)
                        .frame(width: 36)
                    entryText(entry, title: title, pinned: isPinned, index: index)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.spotterPress)

        let card = Group {
            if vertical {
                row.overlay(alignment: .topTrailing) {
                    quickAdd(entry, title: title, index: index)
                        .padding(3)
                }
            } else {
                HStack(spacing: 3) {
                    row
                    quickAdd(entry, title: title, index: index)
                }
            }
        }
        .padding(4)
        .spotterCard(radius: 11)
        if #available(iOS 18.0, *), allowsMotion {
            card.matchedTransitionSource(id: source, in: detailZoom)
        } else {
            card
        }
    }

    private func entryText(_ entry: NativeCatalogEntry, title: String, pinned: Bool, index: NativeCatalogIndex) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                if pinned { Image(systemName: "star.fill").font(.system(size: 9)).foregroundStyle(SpotterPalette.accent) }
                Text(title).font(.system(size: 13, weight: .bold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Text(catalogueMetadata(for: entry, index: index))
                .font(.system(size: 10.5))
                .foregroundStyle(SpotterPalette.muted)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func quickAdd(_ entry: NativeCatalogEntry, title: String, index: NativeCatalogIndex) -> some View {
        catalogueIconButton("plus", label: "添加 " + title, size: 33) {
            searchFocused = false
            if let family = index.family(for: entry), family.variants.count > 1 {
                sheet = .variants(family, entry)
            } else {
                addToPlan(entry)
            }
        }
    }

    @ViewBuilder
    private func sheetContent(_ route: NativeCatalogueSheet, index: NativeCatalogIndex) -> some View {
        switch route {
        case .details(let entry, let source):
            let details = NativeCatalogueExerciseDetail(store: store, index: index, entry: entry, add: queueForPlan)
            if #available(iOS 18.0, *), allowsMotion, let source {
                details.navigationTransition(.zoom(sourceID: source, in: detailZoom))
            } else {
                details
            }
        case .variants(let family, let initial):
            NativeCatalogueVariantChooser(index: index, family: family, initial: initial,
                                          choices: allowedVariants(family, initial: initial, index: index), add: queueForPlan)
        case .create(let name):
            NativeCatalogueCustomEditor(store: store, index: index, name: name, knownNames: request.names,
                                        saved: dismissCreated)
        case .filters:
            NativeCatalogueFiltersSheet(index: index, filters: $filters, savedGyms: $gymPreferences, legacyGear: legacyEquipment)
        }
    }

    private func allowedVariants(_ family: NativeCatalogFamily, initial: NativeCatalogEntry, index: NativeCatalogIndex) -> [NativeCatalogEntry] {
        let gear = filters.usesGear ? selectedGear : []
        return family.variants.filter { variant in
            if variant.id == initial.id { return true }
            if let type = results?.activeType, !type.isEmpty, type != variant.type { return false }
            if let equipment = results?.activeEquipment, !equipment.isEmpty, equipment != variant.equipment { return false }
            if !gear.isEmpty, variant.equipment != "body weight", !gear.contains(variant.equipment) { return false }
            return index.matchesArea(variant, filters.area)
        }
    }

    private func newSearchName(in index: NativeCatalogIndex) -> String? {
        let name = index.exerciseName(filters.query).trimmingCharacters(in: .whitespacesAndNewlines)
        let key = index.nameKey(name)
        guard !key.isEmpty, name.count <= 100, !index.knows(name),
              !request.names.contains(where: { index.nameKey($0) == key }),
              !profiles.contains(where: { index.nameKey($0["name"].string) == key }) else { return nil }
        return name
    }

    private func queueForPlan(_ entry: NativeCatalogEntry) {
        pendingMove = entry
        sheet = nil
    }

    private func presentPlanIfNeeded() {
        if let next = pendingMove {
            pendingMove = nil
            addToPlan(next)
        }
    }

    private func dismissCreated() {
        filters.query = ""
        filters.type = ""
        filters.equipment = ""
        filters.usesMuscles = false
        filters.scope = .all
        filters.area = "custom"
        sheet = nil
    }

    private func refresh(index: NativeCatalogIndex, request: NativeCatalogueFilterRequest) async {
        if results != nil {
            try? await Task.sleep(nanoseconds: 110_000_000)
        }
        guard !Task.isCancelled else { return }

        let result = await Task.detached(priority: .userInitiated) {
            let normalizedNames = request.names.map(index.exerciseName)
            var personal: [NativeCatalogEntry] = []
            var seen: Set<String> = []
            for profile in request.profiles {
                let name = index.exerciseName(profile["name"].string)
                let key = index.nameKey(name)
                if !key.isEmpty, !index.knows(name), seen.insert(key).inserted {
                    let muscles = profile["guide"]["muscles"].object.mapValues { Int($0.number) }
                    personal.append(index.makePersonal(name: name, classification: profile["classification"], muscles: muscles))
                }
            }
            for name in normalizedNames {
                let key = index.nameKey(name)
                if !key.isEmpty, !index.knows(name), seen.insert(key).inserted {
                    personal.append(index.makePersonal(name: name))
                }
            }
            let favorites = Set(request.profiles.filter { $0["pinned"].bool }.map { index.exerciseName($0["name"].string) })
            let options = request.filters
            return index.results(query: options.query, area: options.area, type: options.type,
                                 equipment: options.equipment, terms: options.usesMuscles ? options.muscles : [],
                                 any: options.anyMuscle, gear: options.usesGear ? request.gear : [], scope: options.scope,
                                 favorites: favorites, frequent: Set(normalizedNames), personal: personal,
                                 byMuscle: options.usesMuscles)
        }.value

        guard !Task.isCancelled else { return }
        results = result
        sectionLimits = [:]
        resultsVersion += 1
    }
}

private func catalogueMetadata(for entry: NativeCatalogEntry, index: NativeCatalogIndex) -> String {
    if entry.isPersonal {
        let area = entry.target.isEmpty ? entry.part : entry.part + ":" + entry.target
        let part = index.areas.flatMap { [$0] + ($0.children ?? []) }.first { $0.id == area && !$0.id.isEmpty }?.title ?? "待分类"
        let equipment = index.label(entry.equipment)
        return equipment.isEmpty ? part : part + " · " + equipment
    }
    return [entry.target, entry.equipment].filter { !$0.isEmpty }.map(index.label).joined(separator: " · ")
}

private func catalogueIconButton(
    _ symbol: String,
    label: String,
    size: CGFloat,
    radius: CGFloat? = nil,
    tint: Color? = nil,
    glass: Bool = false,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        let shape = RoundedRectangle(cornerRadius: radius ?? size / 2)
        let icon = Image(systemName: symbol)
            .font(.system(size: size >= 40 ? 17 : 15, weight: .semibold))
            .foregroundStyle(tint == nil ? SpotterPalette.ink : SpotterPalette.deep)
            .frame(width: size, height: size)
            .contentShape(shape)
        if glass {
            icon.spotterGlass(in: shape, tint: tint)
        } else {
            icon.background(tint ?? SpotterPalette.card, in: shape)
                .overlay { shape.strokeBorder(SpotterPalette.line).allowsHitTesting(false) }
        }
    }
    .buttonStyle(.spotterPress)
    .accessibilityLabel(label)
}

private func catalogueChip(_ title: String, symbol: String? = nil, selected: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol).font(.system(size: 11)) }
            Text(title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
    }
    .buttonStyle(SpotterChoiceStyle(selected: selected, horizontalPadding: 8))
    .accessibilityAddTraits(selected ? [.isSelected] : [])
}

private struct NativeCatalogueCover: View {
    let index: NativeCatalogIndex
    let entry: NativeCatalogEntry
    let ratio: CGFloat
    @State private var cover: UIImage?

    var body: some View {
        GeometryReader { geometry in
            if let cover {
                Image(uiImage: cover).resizable().scaledToFit()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .background(SpotterPalette.color(0x314839))
            } else {
                SpotterPalette.color(entry.hasCover ? 0x314839 : 0xe9f0e3)
                    .overlay {
                        if !entry.hasCover {
                            Text(String(entry.name.prefix(2)))
                                .font(.system(size: ratio == 1 ? 12 : 18, weight: .bold))
                                .foregroundStyle(SpotterPalette.color(0x273e9c))
                        }
                    }
            }
        }
        .aspectRatio(ratio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityHidden(true)
        .task(id: entry.id) {
            cover = nil
            guard entry.hasCover else { return }
            let bytes = await Task.detached(priority: .utility) { index.coverData(for: entry) }.value
            if !Task.isCancelled, let bytes { cover = UIImage(data: bytes) }
        }
    }
}

private struct NativeCatalogueFiltersSheet: View {
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccountPreferences) private var accountPreferences
    let index: NativeCatalogIndex
    @Binding var filters: NativeCatalogueFilters
    @Binding var savedGyms: Data
    let legacyGear: String

    private var preferences: NativeGymPreferences { .read(savedGyms, legacy: legacyGear) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Toggle("按肌肉筛选", isOn: $filters.usesMuscles)
                    if filters.usesMuscles {
                        muscleFilters
                            .transition(.opacity)
                    }
                    filterChips("动作类型", options: [""] + index.types, selection: filters.type, blank: "全部类型") { filters.type = $0 }
                    filterChips("器械", options: [""] + index.equipmentOptions, selection: filters.equipment, blank: "全部器械") { filters.equipment = $0 }
                    SpotterDisclosure("我的器械 · \(preferences.gym.name)") {
                        Toggle("只显示我的器械", isOn: $filters.usesGear).padding(.vertical, 8)
                        NativeGymEquipmentGrid(preferences: preferences, toggle: { key in updateGear { $0.toggle(key) } },
                                               toggleAll: { updateGear { $0.toggleAll() } })
                    }
                    Button("清除筛选") {
                        filters.area = ""
                        filters.type = ""
                        filters.equipment = ""
                        filters.scope = .all
                        filters.muscles = []
                        filters.usesMuscles = false
                        filters.anyMuscle = false
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: false))
                }
                .padding(16)
                .animation(motion, value: filters.usesMuscles)
            }
            .background(SpotterPalette.background)
            .navigationTitle("筛选")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }
    }

    private func updateGear(_ change: (inout NativeGymPreferences) -> Void) {
        var next = preferences
        change(&next)
        if let data = try? JSONEncoder().encode(next) {
            savedGyms = data
            accountPreferences?.save(gyms: next)
        }
    }

    private var muscleFilters: some View {
        VStack(alignment: .leading, spacing: 8) {
            SpotterGlassSegments(options: [false, true], value: $filters.anyMuscle, glass: false) {
                $0 ? "任意命中" : "同时命中"
            }
            .accessibilityLabel("肌肉匹配")
            chipGrid(index.groups.map(\.id)) { id in
                let title = index.groups.first { $0.id == id }?.title ?? id
                let term = "group:" + id
                catalogueChip(title, selected: filters.muscles.contains(term)) { toggleMuscle(term) }
            }
            ForEach(index.groups, id: \.id) { group in
                Text(group.title).font(.subheadline.weight(.semibold))
                chipGrid(group.muscles) { muscle in
                    catalogueChip(index.muscleLabel(muscle), selected: filters.muscles.contains(muscle)) { toggleMuscle(muscle) }
                }
            }
            if !filters.muscles.isEmpty { Button("清除肌肉") { filters.muscles.removeAll() }.font(.footnote) }
        }
    }

    private func toggleMuscle(_ term: String) {
        if !filters.muscles.insert(term).inserted { filters.muscles.remove(term) }
    }

    private func filterChips(
        _ title: String, options: [String], selection: String, blank: String, choose: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.headline)
            chipGrid(options) { option in
                catalogueChip(option.isEmpty ? blank : index.label(option), selected: selection == option) { choose(option) }
            }
        }
    }

    private func chipGrid<T: View>(_ options: [String], @ViewBuilder item: @escaping (String) -> T) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 86), spacing: 5)], spacing: 6) {
            ForEach(options, id: \.self) { item($0) }
        }
    }
}

private struct NativeCatalogueVariantChooser: View {
    @Environment(\.dismiss) private var dismiss
    let index: NativeCatalogIndex
    let family: NativeCatalogFamily
    let initial: NativeCatalogEntry
    let choices: [NativeCatalogEntry]
    let add: (NativeCatalogEntry) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 9) {
                    if let note = family.note, !note.isEmpty {
                        Text(note).font(.footnote).foregroundStyle(SpotterPalette.muted).padding(.bottom, 4)
                    }
                    ForEach(choices) { entry in
                        Button { add(entry) } label: {
                            HStack(spacing: 10) {
                                NativeCatalogueCover(index: index, entry: entry, ratio: 1).frame(width: 46)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(entry.name).font(.system(size: 14, weight: .semibold))
                                    Text(catalogueMetadata(for: entry, index: index))
                                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: entry.id == initial.id ? "plus.circle.fill" : "plus.circle")
                                    .foregroundStyle(SpotterPalette.accent)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8).spotterCard(radius: 12)
                        }.buttonStyle(.spotterPress)
                    }
                }
                .padding(14)
            }
            .background(SpotterPalette.background)
            .navigationTitle(family.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
        }
    }
}

private struct NativeCatalogueCustomEditor: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    let index: NativeCatalogIndex
    @State var name: String
    let knownNames: [String]
    let saved: () -> Void
    @State private var area = ""
    @State private var equipment = ""
    @State private var type = ""
    @State private var saving = false
    @State private var error: String?

    private var normalizedName: String { index.exerciseName(name).trimmingCharacters(in: .whitespacesAndNewlines) }
    private var validName: Bool {
        normalizedName.count <= 100 && !index.nameKey(normalizedName).isEmpty
    }

    private var duplicate: Bool {
        let key = index.nameKey(normalizedName)
        guard !key.isEmpty else { return false }
        if index.knows(normalizedName) || knownNames.contains(where: { index.nameKey($0) == key }) { return true }
        return store.libraryRows.contains { $0["kind"].string == "exercise" && index.nameKey($0["item"]["name"].string) == key }
    }

    private var areaOptions: [(id: String, title: String)] {
        let areas = index.areas.filter { !$0.id.isEmpty && $0.id != "custom" && !$0.id.hasPrefix("muscle:") }
        return areas.flatMap { item in
            [(item.id, item.title)] + (item.children ?? []).map { ($0.id, item.title + " · " + $0.title) }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("动作名称", text: $name)
                    SpotterMenuPicker("部位", selection: $area, options: [("", "待分类")] + areaOptions.map { ($0.id, $0.title) })
                    SpotterMenuPicker("器械", selection: $equipment,
                                      options: [("", "未指定")] + index.equipmentOptions.map { ($0, index.label($0)) })
                    SpotterMenuPicker("动作类型", selection: $type,
                                      options: [("", "未指定")] + index.types.map { ($0, index.label($0)) })
                }
                if duplicate { Text("已存在同名动作。").foregroundStyle(.red) }
                if let error { Text(error).foregroundStyle(.red) }
                Button {
                    Task { await save() }
                } label: {
                    Label("保存动作", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
                .disabled(!validName || duplicate || saving)
            }
            .navigationTitle("新建自定义动作")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(saving) } }
        }
        .interactiveDismissDisabled(saving)
    }

    private func save() async {
        guard validName, !duplicate, !saving else { return }
        let profile: NativeJSON = .object([
            "name": .string(normalizedName), "pinned": .bool(false), "note": .string(""), "videos": .array([]),
            "classification": .object(["area": .string(area), "equipment": .string(equipment), "type": .string(type)]),
        ])
        saving = true
        error = await store.saveExerciseProfile(profile)
        saving = false
        if error == nil { saved() }
    }
}

struct NativeCatalogueExerciseDetail: View {
    @Environment(\.spotterAccent) private var accent
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    let index: NativeCatalogIndex
    @State var entry: NativeCatalogEntry
    let add: (NativeCatalogEntry) -> Void
    @State private var content: NativeCatalogDetailText?
    @State private var pinError: String?
    @State private var savingPin = false

    private var profile: NativeJSON? {
        let key = index.nameKey(entry.name)
        return store.libraryRows.first { $0["kind"].string == "exercise" && index.nameKey($0["item"]["name"].string) == key }?["item"]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if entry.isPersonal {
                        NativePersonalExerciseDemo(store: store, name: entry.name) {
                            NativeCatalogueCover(index: index, entry: entry, ratio: 5.0 / 3.0)
                        }
                    } else {
                        NativeCatalogueCover(index: index, entry: entry, ratio: 5.0 / 3.0)
                    }
                    Text(entry.name).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                    let subtitle = [entry.en, catalogueMetadata(for: entry, index: index), index.label(entry.type)]
                        .filter { !$0.isEmpty }.joined(separator: " · ")
                    if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(SpotterPalette.muted) }
                    HStack {
                        addButton
                        Button { Task { await togglePin() } } label: {
                            Label(profile?["pinned"].bool == true ? "取消置顶" : "置顶", systemImage: profile?["pinned"].bool == true ? "star.fill" : "star")
                        }
                        .buttonStyle(SpotterNativeButtonStyle(primary: false))
                        .disabled(savingPin)
                    }
                    if let pinError { Text(pinError).font(.footnote).foregroundStyle(.red) }
                    if let video = index.videoURL(for: entry) {
                        Link(destination: video) { Label("打开动作示范", systemImage: "play.circle") }
                            .buttonStyle(SpotterNativeButtonStyle(primary: false))
                    }
                    if let family = index.family(for: entry), family.variants.count > 1 {
                        SpotterMenuPicker("动作变式", selection: Binding(get: { entry.id }, set: { id in
                            if let selection = family.variants.first(where: { $0.id == id }) { entry = selection }
                        }), options: family.variants.map { ($0.id, $0.name) })
                    }
                    NavigationLink {
                        NativeExerciseProgressView(store: store, move: .object([
                            "name": .string(entry.name),
                            "sourceName": .string(entry.en),
                            "catalogueId": .string(entry.isPersonal ? "" : entry.id),
                        ]))
                    } label: {
                        Label("查看动作进步", systemImage: "chart.line.uptrend.xyaxis")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: false))
                    guidance
                }
                .padding(16)
            }
            .background(SpotterPalette.background)
            .navigationTitle("动作详情")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .task(id: entry.id) {
                content = nil
                let selected = entry
                let result = await Task.detached(priority: .utility) { try? index.details(for: selected) }.value
                if !Task.isCancelled { content = result }
            }
        }
    }

    @ViewBuilder
    private var addButton: some View {
        let button = Button { add(entry) } label: { Label("加入训练计划", systemImage: "plus") }
        if #available(iOS 26.0, *) {
            button.buttonStyle(.glass(.regular.tint(accent.fill).interactive(!reduceMotion && !systemReduceMotion)))
                .foregroundStyle(SpotterPalette.deep)
        } else {
            button.buttonStyle(SpotterNativeButtonStyle(primary: true))
        }
    }

    @ViewBuilder private var guidance: some View {
        let guide = profile?["guide"]
        let authored = guide?["description"].string ?? ""
        let description = authored.isEmpty ? content?.description ?? "" : authored
        let manualSteps = guide?["steps"].array.map(\.string) ?? []
        let steps = manualSteps.isEmpty ? content?.steps ?? [] : manualSteps
        if !description.isEmpty || !steps.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("动作说明").font(.headline)
                if !description.isEmpty { Text(description).font(.subheadline) }
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    Text("\(index + 1). \(step)").font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).spotterCard()
        }
    }

    private func togglePin() async {
        guard !savingPin else { return }
        savingPin = true
        var next = profile ?? .object(["name": .string(entry.name), "pinned": .bool(false), "note": .string(""), "videos": .array([])])
        next["pinned"] = .bool(!next["pinned"].bool)
        pinError = await store.saveExerciseProfile(next)
        savingPin = false
    }
}

private struct NativePersonalExerciseDemo<Fallback: View>: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    let store: NativeWorkoutStore
    let name: String
    @ViewBuilder var fallback: () -> Fallback
    @State private var frames: Frames?

    private struct Frames: Sendable {
        let images: [CGImage]
        let durations: [Double]

        nonisolated static func decode(_ data: Data) -> Self? {
            guard data.count <= 768 * 1024,
                  let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let count = CGImageSourceGetCount(source)
            guard (2...90).contains(count) else { return nil }
            var images: [CGImage] = []
            var durations: [Double] = []
            var pixels = 0
            for index in 0..<count {
                guard let image = CGImageSourceCreateImageAtIndex(source, index,
                    [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
                      image.width <= 480, image.height <= 480 else { return nil }
                pixels += image.width * image.height
                guard pixels <= 9_000_000 else { return nil }
                let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
                let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
                let delay = (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
                    ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double) ?? 0.1
                images.append(image)
                durations.append(max(0.05, min(delay, 10)))
            }
            return Self(images: images, durations: durations)
        }
    }

    private struct Playback: UIViewRepresentable {
        let frames: Frames
        let playing: Bool

        func makeUIView(context: Context) -> UIImageView {
            let view = UIImageView()
            view.contentMode = .scaleAspectFit
            view.setContentHuggingPriority(.defaultLow, for: .horizontal)
            view.setContentHuggingPriority(.defaultLow, for: .vertical)
            return view
        }

        func updateUIView(_ view: UIImageView, context: Context) {
            let time = frames.durations.reduce(0, +)
            let poster = frames.images[0]
            view.image = UIImage(cgImage: poster)
            view.layer.removeAnimation(forKey: "exercise-demo")
            guard playing else { return }
            var elapsed = 0.0
            let keyTimes = frames.durations.map { duration in
                defer { elapsed += duration }
                return NSNumber(value: elapsed / time)
            }
            let animation = CAKeyframeAnimation(keyPath: "contents")
            animation.values = frames.images + [poster]
            animation.keyTimes = keyTimes + [1]
            animation.calculationMode = .discrete
            animation.duration = time
            animation.repeatCount = .infinity
            view.layer.add(animation, forKey: "exercise-demo")
        }
    }

    var body: some View {
        Group {
            if let frames {
                VStack(alignment: .leading, spacing: 8) {
                    Text("个人演示动图").font(.headline)
                    Playback(frames: frames, playing: !reduceMotion && !systemReduceMotion)
                        .frame(height: 205)
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel("\(name)演示动图")
                }
                .padding(14).spotterCard()
            } else {
                fallback()
            }
        }
        .task(id: name) {
            frames = nil
            var query = URLComponents()
            query.queryItems = [URLQueryItem(name: "name", value: name)]
            guard !name.isEmpty, let encoded = query.percentEncodedQuery,
                  let data = try? await store.api.request("/api/exercises/demo?" + encoded, method: "GET", json: nil, for: store.owner),
                  !Task.isCancelled else { return }
            let decoded = await Task.detached(priority: .utility) { Frames.decode(data) }.value
            if !Task.isCancelled { frames = decoded }
        }
    }
}

@MainActor
struct NativeExerciseProgressView: View {
    @ObservedObject var store: NativeWorkoutStore
    let move: NativeJSON
    var showsClose = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var records: [NativeExerciseHistory.Record] = []
    @State private var metric: Metric = .weight
    @State private var selectedLoad: Double?
    @State private var olderAnchor: String?
    @State private var loadingMore = false
    @State private var loadFailed = false

    private enum Metric: String, CaseIterable {
        case weight, reps, seconds

        var title: String {
            switch self {
            case .weight: return "最高重量"
            case .reps: return "同重次数"
            case .seconds: return "最长时长"
            }
        }
    }

    private struct Point: Identifiable {
        let id: String
        let date: Date
        let value: Double
    }

    private var name: String { NativeExerciseLabel(move).name }
    private var bestLoad: Double? { records.compactMap(\.greatestWeightKg).max().flatMap { $0 > 0 ? $0 : nil } }
    private var bestDuration: Double? { records.compactMap(\.longestSeconds).max() }
    private var loads: [Double] {
        Set(records.flatMap { record in
            record.resultRows.compactMap(record.repsLoadKg)
        }).sorted(by: >)
    }
    private var referenceLoad: Double? {
        if let selectedLoad, loads.contains(selectedLoad) { return selectedLoad }
        let latest = records.first { $0.greatestWeightKg != nil }
        if let weight = latest?.greatestWeightKg, loads.contains(weight) { return weight }
        return loads.first
    }
    private var metrics: [Metric] {
        Metric.allCases.filter {
            switch $0 {
            case .weight: return bestLoad != nil
            case .reps: return !loads.isEmpty
            case .seconds: return bestDuration != nil
            }
        }
    }
    private var shownMetric: Metric { metrics.contains(metric) ? metric : metrics.first ?? .reps }
    private var unit: String {
        if move["unit"].string.isEmpty { return records.first?.unit ?? "kg" }
        return NativeExerciseHistory.unit(of: move)
    }
    private var baseline: String {
        if let olderAnchor { return olderAnchor }
        if let start = store.recentHistoryStart { return start }
        return spotterDay(Calendar.current.date(byAdding: .day, value: -62, to: .now) ?? .now)
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                heading
                if move["catalogueId"].string.isEmpty {
                    NativePersonalExerciseDemo(store: store, name: name) { EmptyView() }
                }
                if records.isEmpty { empty }
                if !metrics.isEmpty {
                    recordsCard
                    trendCard
                }
                if !records.isEmpty {
                    Text("历史组次").font(.headline).accessibilityAddTraits(.isHeader)
                    ForEach(records) { record in sessionCard(record) }
                }
                earlierButton
            }
            .padding(14)
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("动作进步")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsClose { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
        .task(id: store.logs) {
            let logs = store.logs
            let owner = store.owner
            let identity = NativeExerciseHistory.Identity(move)
            let matched = await Task.detached(priority: .userInitiated) {
                NativeExerciseHistory(logs: logs, owner: owner).matching(identity)
            }.value
            if !Task.isCancelled { records = matched }
        }
        .task(id: store.recentHistoryStart) {
            guard olderAnchor == nil, let start = store.recentHistoryStart else { return }
            await readOlder(before: start)
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(name).font(.title2.bold()).accessibilityAddTraits(.isHeader)
            let count = Set(records.map(\.workoutID)).count
            if count > 0 {
                Text("已读取 \(count) 次训练").font(.subheadline).foregroundStyle(SpotterPalette.muted)
            }
        }
    }

    private var empty: some View {
        VStack(spacing: 9) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.title2.weight(.semibold)).foregroundStyle(accent.tint)
            Text(loadingMore ? "正在读取训练记录" : "暂无这个动作的已完成组次")
                .font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .spotterCard()
    }

    private var recordsCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("个人纪录").font(.headline)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 8) { recordTiles }
                VStack(alignment: .leading, spacing: 8) { recordTiles }
            }
        }
        .padding(12)
        .spotterCard()
    }

    @ViewBuilder private var recordTiles: some View {
        if let bestLoad { recordTile("最高重量", value: loadLabel(bestLoad)) }
        if let referenceLoad, let reps = records.compactMap({ $0.bestReps(at: referenceLoad) }).max() {
            let title = referenceLoad > 0 ? "\(loadLabel(referenceLoad)) 最多次数" : "自重最多次数"
            recordTile(title, value: "\(reps.formatted()) 次")
        }
        if let bestDuration { recordTile("最长时长", value: "\(bestDuration.formatted()) 秒") }
    }

    private func recordTile(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(SpotterPalette.muted)
            Text(value).font(.system(.title3, design: .rounded, weight: .bold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("训练趋势").font(.headline)
            if metrics.count > 1 {
                SpotterMenuPicker("指标", selection: Binding(get: { shownMetric }, set: { metric = $0 }),
                                   options: metrics.map { ($0, $0.title) })
            }
            if shownMetric == .reps, let referenceLoad, loads.count > 1 {
                SpotterMenuPicker("重量", selection: Binding(get: { referenceLoad }, set: { selectedLoad = $0 }),
                                   options: loads.map { ($0, $0 == 0 ? "自重" : loadLabel($0)) })
            }
            trend(shownMetric)
        }
        .padding(12)
        .spotterCard()
    }

    private func trend(_ metric: Metric) -> some View {
        let points = records.reversed().compactMap { record -> Point? in
            guard let date = nativePlanDate(record.day) else { return nil }
            let value: Double?
            switch metric {
            case .weight: value = record.greatestWeightKg.map { NativeExerciseHistory.convert($0, from: "kg", to: unit) }
            case .reps: value = referenceLoad.flatMap(record.bestReps(at:))
            case .seconds: value = record.longestSeconds
            }
            return value.map { Point(id: record.id, date: date, value: $0) }
        }
        let daily = Dictionary(grouping: points, by: \.date).values.compactMap { $0.max(by: { $0.value < $1.value }) }
            .sorted { $0.date < $1.date }
        return Chart(daily) { point in
            LineMark(x: .value("日期", point.date), y: .value(metric.title, point.value))
                .foregroundStyle(accent.tint)
            PointMark(x: .value("日期", point.date), y: .value(metric.title, point.value))
                .foregroundStyle(accent.tint)
                .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
                .accessibilityValue("\(point.value.formatted()) \(metric == .weight ? unit : metric == .seconds ? "秒" : "次")")
        }
        .chartYAxisLabel(metric == .weight ? unit : metric == .seconds ? "秒" : "次")
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                AxisGridLine()
                AxisValueLabel(format: .dateTime.month(.defaultDigits).day(.defaultDigits))
            }
        }
        .frame(height: 165)
    }

    private func sessionCard(_ record: NativeExerciseHistory.Record) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
                Text(record.title).font(.subheadline.weight(.bold))
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(record.day)
                    if record.started > 0 {
                        let time = Date(timeIntervalSince1970: record.started / 1_000)
                        Text(time.formatted(date: .omitted, time: .shortened))
                    }
                }
                .font(.caption)
                .foregroundStyle(SpotterPalette.muted)
                .fixedSize()
            }
            ForEach(Array(record.rows.enumerated()), id: \.offset) { index, row in
                if row["done"].bool {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        let label = row["kind"].string == "warmup" ? "热身" : row["kind"].string == "drop" ? "递减" : "第 \(index + 1) 组"
                        Text(label).font(.caption).foregroundStyle(SpotterPalette.muted).fixedSize()
                        Text(NativeExerciseHistory.amount(row, unit: record.unit))
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(12)
        .spotterCard()
    }

    private var earlierButton: some View {
        VStack(alignment: .leading, spacing: 5) {
            if loadFailed { Text("暂时无法读取更早的训练。").font(.caption).foregroundStyle(SpotterPalette.muted) }
            Button { Task { await readOlder(before: baseline) } } label: {
                Label(loadingMore ? "正在读取" : loadFailed ? "重试读取" : "加载更早的训练", systemImage: "clock.arrow.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SpotterNativeButtonStyle(primary: false))
            .disabled(loadingMore)
        }
    }

    private func readOlder(before anchor: String) async {
        guard !loadingMore else { return }
        loadingMore = true
        loadFailed = false
        defer { loadingMore = false }
        let from = await store.loadEarlierHistory(before: anchor)
        guard !Task.isCancelled else { return }
        if let from { olderAnchor = from } else { loadFailed = true }
    }

    private func loadLabel(_ kg: Double) -> String {
        let amount = NativeExerciseHistory.convert(kg, from: "kg", to: unit)
        return amount.formatted(.number.precision(.fractionLength(0...1))) + " " + unit
    }
}
