import AVFoundation
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
    @Namespace private var previewViewport
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
                            if let results {
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
        return HStack(spacing: 3) {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 5) {
                    catalogueChip("置顶", symbol: "star", selected: filters.scope == .pinned) {
                        toggleScope(.pinned)
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
            .accessibilityLabel("器械快捷筛选")
            filterMenu
        }
        .frame(height: 42)
    }

    private var filterMenu: some View {
        Menu {
            Button {
                toggleScope(.frequent)
            } label: {
                Label(filters.scope == .frequent ? "显示全部动作" : "常用动作", systemImage: "clock.arrow.circlepath")
            }
            if !selectedGear.isEmpty {
                Toggle("只显示我的器械", isOn: $filters.usesGear)
            }
            Button {
                searchFocused = false
                sheet = .filters
            } label: {
                Label("高级筛选", systemImage: "slider.horizontal.3")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(SpotterPalette.ink)
                .frame(width: 32, height: 32)
                .background(SpotterPalette.card, in: Circle())
                .padding(.vertical, 5)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("动作库更多选项")
    }

    private func toggleScope(_ scope: NativeCatalogScope) {
        searchFocused = false
        filters.scope = filters.scope == scope ? .all : scope
        filters.area = ""
        filters.equipment = ""
    }

    private func resultPane(_ result: NativeCatalogResults, index: NativeCatalogIndex) -> some View {
        ScrollViewReader { scroll in
            HStack(alignment: .top, spacing: 5) {
                GeometryReader { bounds in
                    let viewport = NativeCataloguePreviewViewport(coordinateSpace: previewViewport, size: bounds.size)
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            Color.clear.frame(height: 0).id("spotter.catalogue.start")
                            if let name = newSearchName(in: index) {
                                Button { searchFocused = false; sheet = .create(name) } label: {
                                    Label("创建「\(name)」", systemImage: "plus")
                                        .lineLimit(2)
                                }
                                .buttonStyle(SpotterNativeButtonStyle(primary: false))
                            }
                            ForEach(result.sections) { section in
                                catalogueSection(section, index: index, viewport: viewport).id(section.id)
                            }
                            if result.count == 0 {
                                Text(filters.scope == .pinned ? "暂无符合条件的置顶动作。" :
                                     filters.scope == .frequent ? "暂无符合条件的常用动作。" : "当前搜索和筛选条件下没有动作。")
                                    .font(.footnote)
                                    .foregroundStyle(SpotterPalette.muted)
                                    .padding(8)
                            }
                        }
                        .padding(.bottom, 6)
                    }
                    .coordinateSpace(name: previewViewport)
                    .scrollDismissesKeyboard(.interactively)
                    .accessibilityLabel("动作列表")
                }
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

    private func catalogueSection(
        _ section: NativeCatalogSection, index: NativeCatalogIndex, viewport: NativeCataloguePreviewViewport
    ) -> some View {
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
                    entryRow(entry, index: index, viewport: viewport, vertical: cards, source: "section:" + section.id + ":" + entry.id)
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

    @ViewBuilder
    private func entryRow(
        _ entry: NativeCatalogEntry, index: NativeCatalogIndex, viewport: NativeCataloguePreviewViewport, vertical: Bool, source: String
    ) -> some View {
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
                    NativeCatalogueCardPreview(index: index, entry: entry, ratio: 5.0 / 3.0,
                                               permitsPlayback: sheet == nil, viewport: viewport, store: store)
                    entryText(entry, title: title, pinned: isPinned, index: index)
                        .padding(.horizontal, 2)
                        .padding(.bottom, 3)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            } else {
                HStack(spacing: 5) {
                    NativeCatalogueCardPreview(index: index, entry: entry, ratio: 1,
                                               permitsPlayback: sheet == nil, viewport: viewport, store: store)
                        .frame(width: 36)
                    entryText(entry, title: title, pinned: isPinned, index: index)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityIdentifier("catalogue-entry-" + entry.id)
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
        let equipment = index.equipmentLabel(for: entry)
        return equipment.isEmpty ? part : part + " · " + equipment
    }
    return [index.label(entry.target), index.equipmentLabel(for: entry)].filter { !$0.isEmpty }.joined(separator: " · ")
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

private struct NativeCataloguePreviewViewport: Sendable {
    let coordinateSpace: Namespace.ID
    let size: CGSize

    func showsPreview(_ frame: CGRect) -> Bool {
        let visible = CGRect(origin: .zero, size: size).intersection(frame)
        return !frame.isEmpty && !visible.isEmpty && visible.height >= frame.height * 0.45
    }
}

@MainActor
private struct NativeCatalogueCardPreview: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    let index: NativeCatalogIndex
    let entry: NativeCatalogEntry
    let ratio: CGFloat
    let permitsPlayback: Bool
    var viewport: NativeCataloguePreviewViewport? = nil
    let store: NativeWorkoutStore
    @State private var appeared = false
    @State private var visibleInViewport = false
    @State private var loaded: LoadedPreview?

    private enum Media: Sendable {
        case video(URL)
        case gif(NativeExerciseGIFFrames)
        case drawing(NativeCatalogDrawing)
    }

    private struct Request: Equatable {
        let entryID: String
        let owner: String?
    }

    private struct LoadedPreview {
        let request: Request
        let media: Media
    }

    private var request: Request? {
        guard appeared, viewport == nil || visibleInViewport, permitsPlayback, scenePhase == .active,
              !reduceMotion, !systemReduceMotion else { return nil }
        return Request(entryID: entry.id, owner: entry.isPersonal ? store.owner : nil)
    }

    var body: some View {
        let requested = request
        NativeCatalogueCover(index: index, entry: entry, ratio: ratio)
            .overlay {
                if let requested, let loaded, loaded.request == requested {
                    preview(loaded.media)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .allowsHitTesting(false)
                }
            }
            .accessibilityHidden(true)
            .onAppear { appeared = true }
            .onDisappear { appeared = false }
            .onGeometryChange(for: Bool.self) { [viewport] geometry in
                guard let viewport else { return true }
                return viewport.showsPreview(geometry.frame(in: .named(viewport.coordinateSpace)))
            } action: { isVisible in
                visibleInViewport = isVisible
            }
            .task(id: requested) {
                loaded = nil
                guard let requested else { return }
                // Let quick scrolls bypass media loading until the preview is settled in view.
                do { try await Task.sleep(for: .milliseconds(110)) }
                catch { return }
                let media = await loadMedia(for: requested)
                if let media, !Task.isCancelled { loaded = LoadedPreview(request: requested, media: media) }
            }
    }

    @ViewBuilder
    private func preview(_ media: Media) -> some View {
        switch media {
        case .video(let url):
            NativeExerciseVideoPlayer(url: url, playing: true, fills: true)
        case .gif(let frames):
            SpotterPalette.color(0x314839).overlay {
                NativeExerciseGIFPlayer(frames: frames, playing: true)
            }
        case .drawing(let drawing):
            SpotterPalette.color(0x314839).overlay {
                NativeCatalogueDrawingPlayer(drawing: drawing, playing: true)
            }
        }
    }

    private func loadMedia(for request: Request) async -> Media? {
        let personalBytes: Data?
        if let owner = request.owner {
            var query = URLComponents()
            query.queryItems = [URLQueryItem(name: "name", value: entry.name)]
            guard let encoded = query.percentEncodedQuery,
                  let data = try? await store.api.request("/api/exercises/demo?" + encoded, method: "GET", json: nil, for: owner),
                  !Task.isCancelled else { return nil }
            personalBytes = data
        } else {
            personalBytes = nil
        }

        let worker = Task.detached(priority: .utility) { [index, entry] () -> Media? in
            if let personalBytes {
                return NativeExerciseGIFFrames.decode(personalBytes, thumbnailSize: 224).map(Media.gif)
            }
            if let url = index.bundledVideoURL(for: entry) { return .video(url) }
            if let bytes = index.animationData(for: entry), let frames = NativeExerciseGIFFrames.decode(bytes) { return .gif(frames) }
            return index.drawing(for: entry).map(Media.drawing)
        }
        return await withTaskCancellationHandler {
            await worker.value
        } onCancel: {
            worker.cancel()
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

@MainActor
struct NativeCatalogueExerciseDetail: View {
    @ObservedObject var store: NativeWorkoutStore
    let index: NativeCatalogIndex
    let entry: NativeCatalogEntry
    let add: (NativeCatalogEntry) -> Void

    var body: some View {
        NavigationStack {
            NativeCatalogueExercisePage(store: store, index: index, entry: entry, move: catalogueMove(entry),
                                        showsClose: true, add: add)
                .id(store.owner)
        }
    }
}

private enum NativeExerciseDetailTab: String, CaseIterable {
    case guide, history, statistics, variants

    var title: String {
        switch self {
        case .guide: return "要点"
        case .history: return "历史"
        case .statistics: return "统计"
        case .variants: return "变式"
        }
    }

    var icon: String {
        switch self {
        case .guide: return "list.bullet.clipboard"
        case .history: return "clock"
        case .statistics: return "chart.bar"
        case .variants: return "square.stack"
        }
    }
}

private func catalogueMove(_ entry: NativeCatalogEntry) -> NativeJSON {
    .object(["name": .string(entry.name), "sourceName": .string(entry.en),
             "catalogueId": .string(entry.isPersonal ? "" : entry.id)])
}

@MainActor
private struct NativeCatalogueExercisePage: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.dynamicTypeSize) private var textSize
    @Namespace private var previewCoordinateSpace
    @Namespace private var detailTabSelection
    let index: NativeCatalogIndex?
    let entry: NativeCatalogEntry?
    let move: NativeJSON
    let showsClose: Bool
    let add: ((NativeCatalogEntry) -> Void)?
    @State private var tab: NativeExerciseDetailTab
    @State private var content: NativeCatalogDetailText?
    @State private var pinError: String?
    @State private var savingPin = false

    init(store: NativeWorkoutStore, index: NativeCatalogIndex?, entry: NativeCatalogEntry?, move: NativeJSON,
         initialTab: NativeExerciseDetailTab = .guide, showsClose: Bool = false,
         add: ((NativeCatalogEntry) -> Void)? = nil) {
        self.store = store
        self.index = index
        self.entry = entry
        self.move = move
        self.showsClose = showsClose
        self.add = add
        _tab = State(initialValue: initialTab)
    }

    private var name: String {
        entry?.name ?? NativeExerciseLabel(move, preservingNameQualifiers: true).name
    }

    private var exerciseProfiles: [NativeJSON] {
        store.libraryRows.filter { $0["kind"].string == "exercise" }.map { $0["item"] }
    }

    private var profile: NativeJSON? {
        let key = exerciseIdentityKey(name)
        return exerciseProfiles.first { exerciseIdentityKey($0["name"].string) == key }
    }

    private func exerciseIdentityKey(_ name: String) -> String {
        name.precomposedStringWithCompatibilityMapping.lowercased()
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(spacing: 0) {
                        Color.clear.frame(height: 0).accessibilityHidden(true).id("exercise-detail-top")
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if tab == .guide { demonstration }
                            header
                            switch tab {
                            case .guide: guidance
                            case .variants:
                                variants(viewport: .init(coordinateSpace: previewCoordinateSpace, size: geometry.size))
                            case .history, .statistics: EmptyView()
                            }
                            if tab == .history || tab == .statistics {
                                NativeExerciseLogDetail(store: store, index: index, move: move, entry: entry, tab: tab)
                            }
                        }
                        .padding(14)
                    }
                }
                .coordinateSpace(name: previewCoordinateSpace)
                .onChange(of: tab) { _ in scroll.scrollTo("exercise-detail-top", anchor: .top) }
            }
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("动作详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if showsClose {
                ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
            }
        }
        .task(id: entry?.id) {
            content = nil
            guard let index, let entry, !entry.isPersonal else { return }
            let result = await Task.detached(priority: .utility) { try? index.details(for: entry) }.value
            if !Task.isCancelled { content = result }
        }
    }

    @ViewBuilder
    private var demonstration: some View {
        if let index, let entry, !entry.isPersonal {
            NativeCatalogueExerciseDemo(index: index, entry: entry).id(entry.id)
        } else if !name.isEmpty {
            NativePersonalExerciseDemo(store: store, name: name)
                .id(store.owner + "\n" + name)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(name).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("catalogue-detail-name")
            if let index, let entry {
                let subtitle = [entry.en, catalogueMetadata(for: entry, index: index), index.label(entry.type)]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(SpotterPalette.muted) }
            }
            tabs
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .spotterCard()
    }

    private var tabs: some View {
        let layout = textSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 3)) : AnyLayout(HStackLayout(spacing: 3))
        return layout {
            ForEach(NativeExerciseDetailTab.allCases, id: \.self) { section in
                let selected = tab == section
                Button { tab = section } label: {
                    HStack(spacing: 5) {
                        Image(systemName: section.icon).accessibilityHidden(true)
                        Text(section.title).fixedSize(horizontal: true, vertical: false)
                    }
                    .font(.caption.weight(selected ? .bold : .semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(selected ? accent.tint : SpotterPalette.muted)
                    .background {
                        if selected {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(SpotterPalette.card)
                                .matchedGeometryEffect(id: "selected", in: detailTabSelection)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityIdentifier("catalogue-detail-section-" + section.rawValue)
            }
        }
        .padding(3)
        .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 13))
        .animation(motion, value: tab)
    }

    @ViewBuilder private var guidance: some View {
        if !name.isEmpty {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { guideActions }
                VStack(alignment: .leading, spacing: 8) { guideActions }
            }
        }
        if let pinError { Text(pinError).font(.footnote).foregroundStyle(.red) }
        if let index, let entry, !entry.muscles.isEmpty {
            let sorted = entry.muscles.keys.sorted {
                let left = entry.muscles[$0, default: 0], right = entry.muscles[$1, default: 0]
                return left == right ? $0 < $1 : left > right
            }
            let primary = sorted.filter { entry.muscles[$0, default: 0] >= 75 }
            let secondary = sorted.filter { (1..<75).contains(entry.muscles[$0, default: 0]) }
            VStack(alignment: .leading, spacing: 6) {
                Text("参与肌群").font(.headline)
                if !primary.isEmpty { LabeledContent("主要", value: primary.map(index.muscleLabel).joined(separator: "、")) }
                if !secondary.isEmpty { LabeledContent("辅助", value: secondary.map(index.muscleLabel).joined(separator: "、")) }
            }
            .font(.subheadline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).spotterCard()
        }
        if let index, let entry, let video = index.videoURL(for: entry) {
            Link(destination: video) { Label("打开动作示范", systemImage: "play.circle") }
                .buttonStyle(.spotterControl)
        }
        if let note = profile?["note"].string, !note.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("个人备注").font(.headline)
                Text(note).font(.subheadline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).spotterCard()
        }
        let guide = profile?["guide"]
        let authored = guide?["description"].string ?? ""
        let description = authored.isEmpty ? content?.description ?? "" : authored
        let manualSteps = guide?["steps"].array.map(\.string) ?? []
        let steps = manualSteps.isEmpty ? content?.steps ?? [] : manualSteps
        if !description.isEmpty || !steps.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("动作要点").font(.headline)
                if !description.isEmpty { Text(description).font(.subheadline) }
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    Text("\(index + 1). \(step)").font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).spotterCard()
        } else {
            empty("暂无动作说明", icon: "list.bullet.clipboard")
        }
    }

    @ViewBuilder private var guideActions: some View {
        if let entry, let add {
            Button { add(entry) } label: { Label("加入训练计划", systemImage: "plus") }
                .buttonStyle(.spotterPrimaryControl)
        }
        let pinned = profile?["pinned"].bool == true
        Button { Task { await togglePin() } } label: {
            Label(pinned ? "取消置顶" : "置顶", systemImage: pinned ? "star.fill" : "star")
        }
        .buttonStyle(.spotterControl)
        .disabled(savingPin)
    }

    @ViewBuilder
    private func variants(viewport: NativeCataloguePreviewViewport) -> some View {
        if let index, let entry {
            let result = relatedEntries(for: entry, index: index)
            if result.isEmpty {
                empty("暂无动作变式", icon: "square.stack")
            } else {
                let columns = Array(repeating: GridItem(.flexible(), spacing: 9), count: textSize.isAccessibilitySize ? 1 : 2)
                LazyVGrid(columns: columns, alignment: .leading, spacing: 9) {
                    ForEach(result) { variant in
                        NavigationLink {
                            NativeCatalogueExercisePage(store: store, index: index, entry: variant,
                                                        move: catalogueMove(variant), add: add)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                NativeCatalogueCardPreview(index: index, entry: variant, ratio: 5.0 / 3.0,
                                                           permitsPlayback: true, viewport: viewport, store: store)
                                    .accessibilityHidden(true)
                                HStack(alignment: .firstTextBaseline, spacing: 4) {
                                    Text(variant.name).font(.subheadline.weight(.semibold))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Image(systemName: "chevron.right").font(.caption2.weight(.semibold))
                                        .foregroundStyle(SpotterPalette.muted)
                                }
                                let metadata = catalogueMetadata(for: variant, index: index)
                                if !metadata.isEmpty {
                                    Text(metadata).font(.caption).foregroundStyle(SpotterPalette.muted)
                                }
                            }
                            .multilineTextAlignment(.leading)
                            .foregroundStyle(SpotterPalette.ink)
                            .padding(8)
                            .spotterCard()
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityIdentifier("catalogue-variant-" + variant.id)
                        .accessibilityHint("打开该变式的动作详情")
                    }
                }
            }
        } else {
            empty("暂无动作变式", icon: "square.stack")
        }
    }

    private func relatedEntries(for entry: NativeCatalogEntry, index: NativeCatalogIndex) -> [NativeCatalogEntry] {
        let personalBase = profile?["versionOf"].string ?? ""
        let baseName = personalBase.isEmpty ? entry.name : personalBase
        let base = entry.isPersonal ? index.entry(exactName: baseName) : entry
        let standard = base.map { index.family(for: $0)?.variants ?? [$0] } ?? []
        let baseKeys = Set(([baseName] + standard.flatMap { [$0.name, $0.en] }).map(exerciseIdentityKey))
        let personal = exerciseProfiles.compactMap { profile -> NativeCatalogEntry? in
            let name = profile["name"].string
            let parent = profile["versionOf"].string
            let isLinked = !parent.isEmpty && baseKeys.contains(exerciseIdentityKey(parent))
            let isPersonalBase = base == nil && exerciseIdentityKey(name) == exerciseIdentityKey(baseName)
            guard !name.isEmpty, isLinked || isPersonalBase else { return nil }
            return index.makePersonal(name: name, classification: profile["classification"])
        }
        var seen: Set<String> = [entry.id]
        let linked = (standard + personal).filter { seen.insert($0.id).inserted }
        guard let base, linked.count < 4 else { return linked }
        return linked + index.relatedExercises(for: base, excluding: seen).prefix(6 - linked.count)
    }

    private func empty(_ message: String, icon: String) -> some View {
        Label(message, systemImage: icon)
            .font(.subheadline)
            .foregroundStyle(SpotterPalette.muted)
            .frame(maxWidth: .infinity)
            .padding(18)
            .spotterCard()
    }

    private func togglePin() async {
        guard !savingPin else { return }
        savingPin = true
        var next = profile ?? .object(["name": .string(name), "pinned": .bool(false), "note": .string(""), "videos": .array([])])
        next["pinned"] = .bool(!next["pinned"].bool)
        pinError = await store.saveExerciseProfile(next)
        savingPin = false
    }
}

private struct NativeCatalogueExerciseDemo: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    let index: NativeCatalogIndex
    let entry: NativeCatalogEntry
    @State private var media: Media?
    @State private var preferredPlayback: Bool?
    @State private var visible = false

    private enum Media: Sendable {
        case video(URL)
        case gif(NativeExerciseGIFFrames)
        case drawing(NativeCatalogDrawing)

        var isReference: Bool {
            if case .drawing(let drawing) = self { return drawing.isReference }
            return false
        }

        /// Spotter 3D demos are 16:9; matching the frame keeps the backdrop from showing as bars above and below.
        var stageRatio: CGFloat {
            if case .video = self { return Self.videoRatio }
            return 5.0 / 3.0
        }

        static let videoRatio: CGFloat = 16.0 / 9.0
    }

    private var reducedMotion: Bool { reduceMotion || systemReduceMotion }
    private var wantsPlayback: Bool { preferredPlayback ?? !reducedMotion }
    private var canPlay: Bool { visible && scenePhase == .active }
    private var playing: Bool { wantsPlayback && canPlay }

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            if let media {
                stage(media)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .aspectRatio(media.stageRatio, contentMode: .fit)
                    .background(SpotterPalette.color(0x314839))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .accessibilityLabel("\(entry.name)动作示意")
                    .accessibilityAddTraits(.isImage)
                HStack {
                    if media.isReference {
                        Text("参考练法").font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 6)
                    Button { preferredPlayback = !playing } label: {
                        Label(playing ? "暂停" : "播放", systemImage: playing ? "pause.fill" : "play.fill")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.spotterControl)
                    .disabled(!canPlay)
                    .accessibilityLabel(playing ? "暂停动作示意" : "播放动作示意")
                    .accessibilityIdentifier("catalogue-demo-playback")
                }
            } else {
                NativeCatalogueCover(index: index, entry: entry, ratio: 5.0 / 3.0)
            }
        }
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .onChange(of: reducedMotion) { enabled in if enabled { preferredPlayback = false } }
        .task {
            let resolved = await Task.detached(priority: .userInitiated) { () -> Media? in
                if let url = index.bundledVideoURL(for: entry) { return .video(url) }
                if let bytes = index.animationData(for: entry), let gif = NativeExerciseGIFFrames.decode(bytes) { return .gif(gif) }
                if let drawing = index.drawing(for: entry) { return .drawing(drawing) }
                return nil
            }.value
            if !Task.isCancelled { media = resolved }
        }
    }

    @ViewBuilder private func stage(_ media: Media) -> some View {
        switch media {
        case .video(let url):
            ZStack {
                NativeCatalogueCover(index: index, entry: entry, ratio: Media.videoRatio)
                NativeExerciseVideoPlayer(url: url, playing: playing, fills: true)
            }
        case .gif(let frames):
            NativeExerciseGIFPlayer(frames: frames, playing: playing)
        case .drawing(let drawing):
            NativeCatalogueDrawingPlayer(drawing: drawing, playing: playing)
        }
    }
}

private struct NativeCatalogueDrawingPlayer: View {
    let drawing: NativeCatalogDrawing
    let playing: Bool

    var body: some View {
        NativeExerciseFramePlayer(frameCount: drawing.frames.count, playing: playing, duration: { _ in drawing.frameDuration }) { frame in
            Canvas { context, size in
                let scale = min(size.width / 320, size.height / 180)
                var canvas = context
                canvas.translateBy(x: (size.width - 320 * scale) / 2, y: (size.height - 180 * scale) / 2)
                canvas.scaleBy(x: scale, y: scale)
                for mark in drawing.frames[frame] {
                    let ink = SpotterPalette.color(mark.color)
                    if mark.width < 0 {
                        let center = mark.points[0]
                        let radius = CGFloat(-mark.width)
                        canvas.fill(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius,
                                                           width: radius * 2, height: radius * 2)), with: .color(ink))
                    } else {
                        let path = Path { path in path.addLines(mark.points) }
                        canvas.stroke(path, with: .color(ink), style: StrokeStyle(lineWidth: CGFloat(mark.width), lineCap: .round, lineJoin: .round))
                    }
                }
            }
        }
    }
}

private struct NativeExerciseFramePlayer<Content: View>: View {
    let frameCount: Int
    let playing: Bool
    let duration: (Int) -> TimeInterval
    @ViewBuilder let content: (Int) -> Content
    @State private var frame = 0

    var body: some View {
        content(frame)
            .task(id: playing) {
                guard playing else { return }
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(duration(frame))) }
                    catch { return }
                    guard !Task.isCancelled else { return }
                    frame = (frame + 1) % frameCount
                }
            }
    }
}

private struct NativeExerciseVideoPlayer: UIViewRepresentable {
    let url: URL
    let playing: Bool
    var fills = false

    final class Surface: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        var playing = false

        override func didMoveToWindow() {
            super.didMoveToWindow()
            updatePlayback()
        }

        func updatePlayback() {
            guard let player = playerLayer.player else { return }
            if playing && window != nil {
                if player.rate == 0 { player.playImmediately(atRate: 0.75) }
            } else {
                player.pause()
            }
        }
    }

    final class Coordinator {
        let player: AVQueuePlayer
        private let looper: AVPlayerLooper

        init(url: URL) {
            let player = AVQueuePlayer()
            player.isMuted = true
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
            self.player = player
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    func makeUIView(context: Context) -> Surface {
        let view = Surface()
        view.playerLayer.player = context.coordinator.player
        view.playerLayer.videoGravity = fills ? .resizeAspectFill : .resizeAspect
        return view
    }

    func updateUIView(_ view: Surface, context: Context) {
        view.playing = playing
        view.updatePlayback()
    }

    static func dismantleUIView(_ view: Surface, coordinator: Coordinator) {
        coordinator.player.pause()
        view.playerLayer.player = nil
    }
}

private struct NativeExerciseGIFFrames: Sendable {
    let id = UUID()
    let images: [CGImage]
    let durations: [Double]

    nonisolated static func decode(_ data: Data, thumbnailSize: Int? = nil) -> Self? {
        guard data.count <= 768 * 1024,
              let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        guard (2...90).contains(count) else { return nil }
        var images: [CGImage] = []
        var durations: [Double] = []
        var pixels = 0
        for index in 0..<count {
            guard !Task.isCancelled else { return nil }
            let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
            guard let width = properties?[kCGImagePropertyPixelWidth] as? Int,
                  let height = properties?[kCGImagePropertyPixelHeight] as? Int,
                  (1...480).contains(width), (1...480).contains(height) else { return nil }
            pixels += width * height
            guard pixels <= 9_000_000 else { return nil }
            let image: CGImage?
            if let thumbnailSize {
                image = CGImageSourceCreateThumbnailAtIndex(source, index, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceThumbnailMaxPixelSize: thumbnailSize,
                    kCGImageSourceShouldCacheImmediately: true,
                ] as CFDictionary)
            } else {
                image = CGImageSourceCreateImageAtIndex(source, index,
                    [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
            }
            guard let image, image.width <= 480, image.height <= 480 else { return nil }
            let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
            let delay = (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
                ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double) ?? 0.1
            images.append(image)
            durations.append(max(0.05, min(delay, 10)))
        }
        return Self(images: images, durations: durations)
    }
}

private struct NativeExerciseGIFPlayer: View {
    let frames: NativeExerciseGIFFrames
    let playing: Bool

    var body: some View {
        NativeExerciseFramePlayer(frameCount: frames.images.count, playing: playing, duration: { frames.durations[$0] }) { frame in
            Image(decorative: frames.images[frame], scale: 1)
                .resizable()
                .scaledToFit()
        }
        .id(frames.id)
    }
}

private struct NativePersonalExerciseDemo: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    let store: NativeWorkoutStore
    let name: String
    @State private var state = LoadState.loading
    @State private var retry = 0

    private enum LoadState {
        case loading, missing, failed
        case loaded(NativeExerciseGIFFrames)
    }

    var body: some View {
        Group {
            switch state {
            case .loaded(let frames):
                VStack(alignment: .leading, spacing: 8) {
                    Text("个人演示动图").font(.headline)
                    NativeExerciseGIFPlayer(frames: frames, playing: !reduceMotion && !systemReduceMotion && scenePhase == .active)
                        .frame(height: 205)
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel("\(name)演示动图")
                }
                .padding(14).spotterCard()
            case .loading:
                ProgressView("正在读取动作演示…")
                    .accessibilityIdentifier("personal-exercise-demo-loading")
            case .missing:
                Label("此动作暂时没有演示动图", systemImage: "play.rectangle")
                    .accessibilityIdentifier("personal-exercise-demo-missing")
            case .failed:
                HStack {
                    Label("暂时无法载入动作演示", systemImage: "exclamationmark.circle")
                    Spacer()
                    Button("重试") { retry += 1 }.buttonStyle(.spotterControl)
                }
                .accessibilityIdentifier("personal-exercise-demo-failed")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .font(.subheadline)
        .foregroundStyle(SpotterPalette.muted)
        .task(id: retry) {
            state = .loading
            var query = URLComponents()
            query.queryItems = [URLQueryItem(name: "name", value: name)]
            let owner = store.owner
            guard let encoded = query.percentEncodedQuery else { state = .failed; return }
            do {
                let data = try await store.api.request("/api/exercises/demo?" + encoded, method: "GET", json: nil, for: owner)
                guard !Task.isCancelled, store.owner == owner else { return }
                let decoded = await Task.detached(priority: .utility) { NativeExerciseGIFFrames.decode(data) }.value
                guard !Task.isCancelled, store.owner == owner else { return }
                state = decoded.map(LoadState.loaded) ?? .failed
            } catch {
                guard !Task.isCancelled, store.owner == owner else { return }
                state = (error as? NativeAPIError)?.statusCode == 404 ? .missing : .failed
            }
        }
    }
}

@MainActor
struct NativeExerciseProgressView: View {
    @ObservedObject var store: NativeWorkoutStore
    let move: NativeJSON
    var showsClose = false
    var startsWithStats = false
    @State private var catalogue: NativeCatalogIndex?
    @State private var loadedCatalogue = false

    private var entry: NativeCatalogEntry? {
        catalogue?.plannedExercise(move, library: store.libraryRows)
    }

    var body: some View {
        Group {
            if loadedCatalogue {
                NativeCatalogueExercisePage(store: store, index: catalogue, entry: entry, move: move,
                                            initialTab: startsWithStats ? .statistics : .guide, showsClose: showsClose)
                    .id(store.owner)
            } else {
                ProgressView("正在读取动作…").frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(SpotterPalette.background)
            }
        }
        .task {
            let index = try? await NativeCatalogIndex.bundled.value
            if !Task.isCancelled {
                catalogue = index
                loadedCatalogue = true
            }
        }
    }
}

@MainActor
private struct NativeExerciseLogDetail: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.spotterAccent) private var accent
    @AppStorage(NativePreferenceKey.oneRepMax) private var oneRepMax = "epley"
    let index: NativeCatalogIndex?
    let move: NativeJSON
    let entry: NativeCatalogEntry?
    let tab: NativeExerciseDetailTab
    @State private var records: [NativeExerciseHistory.Record] = []
    @State private var indexed = false
    @State private var olderAnchor: String?
    @State private var loadingMore = false
    @State private var loadFailed = false
    @State private var selectedLoad: Double?

    private enum Metric: String, CaseIterable {
        case volume = "训练容量"
        case sets = "完成组数"
        case weight = "最大重量"
        case estimatedMax = "1RM 估算"
        case reps = "同重次数"
        case seconds = "最长时长"

        func unit(weight: String) -> String {
            switch self {
            case .sets: return "组"
            case .reps: return "次"
            case .seconds: return "秒"
            case .volume, .weight, .estimatedMax: return weight
            }
        }
    }

    private struct Point: Identifiable {
        var id: Date { date }
        let date: Date
        let value: Double
    }

    private struct HistoryRequest: Equatable {
        let owner: String
        let logs: [NativeWorkoutEntry]
        let identity: NativeExerciseHistory.Identity
        let privateNames: Set<String>
    }

    private var request: HistoryRequest {
        let privateNames = Set(store.libraryRows.lazy.filter {
            $0["kind"].string == "exercise" && !$0["item"]["versionOf"].string.isEmpty
        }.compactMap { NativeExerciseHistory.Identity($0["item"], personalOnly: true).names.first })
        let identity = entry.map { NativeExerciseHistory.Identity(catalogueMove($0), personalOnly: $0.isPersonal) }
            ?? NativeExerciseHistory.Identity(move)
        return HistoryRequest(owner: store.owner, logs: store.logs, identity: identity, privateNames: privateNames)
    }

    private var unit: String {
        if move["unit"].string.isEmpty { return records.first?.unit ?? "kg" }
        return NativeExerciseHistory.unit(of: move)
    }

    private var loads: [Double] {
        Set(records.flatMap { $0.resultRows.compactMap($0.repsLoadKg) }).sorted(by: >)
    }

    private var referenceLoad: Double? {
        if let selectedLoad, loads.contains(selectedLoad) { return selectedLoad }
        if let weight = records.compactMap(\.greatestWeightKg).first, loads.contains(weight) { return weight }
        return loads.first
    }

    private var baseline: String {
        olderAnchor ?? store.recentHistoryStart ?? spotterDay(Calendar.current.date(byAdding: .day, value: -62, to: .now) ?? .now)
    }

    var body: some View {
        let current = request
        LazyVStack(alignment: .leading, spacing: 10) {
            if records.isEmpty {
                Label(!indexed || loadingMore ? "正在读取训练记录" : "暂无这个动作的已完成组次",
                      systemImage: tab.icon)
                    .font(.subheadline)
                    .foregroundStyle(SpotterPalette.muted)
                    .frame(maxWidth: .infinity)
                    .padding(18)
                    .spotterCard()
            } else if tab == .history {
                history
            } else {
                statistics
            }
            earlierButton
        }
        .task(id: current) {
            let catalogue = index
            let matching = await Task.detached(priority: .userInitiated) {
                NativeExerciseHistory(logs: current.logs, owner: current.owner) { candidate in
                    let given = NativeExerciseHistory.Identity(candidate)
                    guard given.catalogueID.isEmpty else { return given }
                    let privateIdentity = NativeExerciseHistory.Identity(candidate, personalOnly: true)
                    if !privateIdentity.names.isDisjoint(with: current.privateNames) { return privateIdentity }
                    guard let catalogue else { return given }
                    if let linked = catalogue.entry(exactName: candidate["name"].string) {
                        return NativeExerciseHistory.Identity(candidate, catalogueID: linked.id)
                    }
                    return privateIdentity
                }.matching(current.identity)
            }.value
            if !Task.isCancelled {
                records = matching
                indexed = true
            }
        }
        .task(id: store.recentHistoryStart) {
            guard olderAnchor == nil, let start = store.recentHistoryStart else { return }
            await readOlder(before: start)
        }
    }

    private var history: some View {
        let sessions = Dictionary(grouping: records, by: \.workoutID)
        return ForEach(records.filter { sessions[$0.workoutID]?.first?.id == $0.id }) { first in
            let session = sessions[first.workoutID] ?? [first]
            sessionCard(first, records: session)
        }
    }

    private func sessionCard(_ first: NativeExerciseHistory.Record, records: [NativeExerciseHistory.Record]) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            VStack(alignment: .leading, spacing: 4) {
                Text(first.title).font(.subheadline.weight(.bold))
                let time = first.started > 0 ? Date(timeIntervalSince1970: first.started / 1_000)
                    .formatted(date: .omitted, time: .shortened) : ""
                Text([first.day, time].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            let volume = records.reduce(0) { $0 + $1.volumeKg }
            Text("容量 \(loadLabel(volume)) · \(records.reduce(0) { $0 + $1.completedRows.count }) 组")
                .font(.caption.weight(.semibold))
                .foregroundStyle(SpotterPalette.muted)
            Divider()
            ForEach(records) { record in
                ForEach(Array(record.rows.enumerated()), id: \.offset) { index, row in
                    if row["done"].bool { setLine(index, row: row, in: record) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12).spotterCard()
    }

    private func setLine(_ index: Int, row: NativeJSON, in record: NativeExerciseHistory.Record) -> some View {
        let kind = row["kind"].string
        let label = (record.warmup || kind == "warmup") ? "热身" : kind == "drop" ? "递减" : "第 \(index + 1) 组"
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label).font(.caption).foregroundStyle(SpotterPalette.muted).fixedSize()
            Text(NativeExerciseHistory.amount(row, unit: record.unit)).font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let estimate = record.estimatedMaxKg(row, formula: oneRepMax) {
                Text("1RM \(loadLabel(estimate))")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
                    .accessibilityLabel("1RM 估算 \(loadLabel(estimate))")
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var statistics: some View {
        let days = Dictionary(grouping: records, by: \.day)
        let availableLoads = loads
        let reference = referenceLoad
        return ForEach(Metric.allCases, id: \.self) { metric in
            let points = points(for: metric, days: days, reference: reference)
            if !points.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    let maximum = points.map(\.value).max() ?? 0
                    HStack(alignment: .firstTextBaseline) {
                        Text(metric.rawValue).font(.subheadline.weight(.bold))
                        Spacer(minLength: 4)
                        Text("最高 \(quantity(maximum)) \(metric.unit(weight: unit))")
                            .font(.caption.weight(.semibold)).monospacedDigit()
                            .foregroundStyle(SpotterPalette.muted)
                    }
                    if metric == .reps, let reference, availableLoads.count > 1 {
                        SpotterMenuPicker("重量", selection: Binding(get: { reference }, set: { selectedLoad = $0 }),
                                          options: availableLoads.map { ($0, $0 == 0 ? "自重" : loadLabel($0)) })
                    }
                    chart(points, metric: metric)
                }
                .padding(12)
                .spotterCard()
                .accessibilityIdentifier("catalogue-detail-statistic-" + String(describing: metric))
            }
        }
    }

    private func points(for metric: Metric, days: [String: [NativeExerciseHistory.Record]], reference: Double?) -> [Point] {
        days.keys.sorted().compactMap { day in
            guard let group = days[day], let date = nativePlanDate(day) else { return nil }
            let value: Double?
            switch metric {
            case .volume:
                value = inUnit(group.reduce(0) { $0 + $1.volumeKg })
            case .sets:
                value = Double(group.reduce(0) { $0 + $1.completedRows.count })
            case .weight:
                value = group.compactMap(\.greatestWeightKg).filter { $0 > 0 }.max().map(inUnit)
            case .estimatedMax:
                value = group.flatMap { record in record.resultRows.compactMap { record.estimatedMaxKg($0, formula: oneRepMax) } }
                    .max().map(inUnit)
            case .reps:
                value = reference.flatMap { weight in group.compactMap { $0.bestReps(at: weight) }.max() }
            case .seconds:
                value = group.compactMap(\.longestSeconds).max()
            }
            return value.map { Point(date: date, value: $0) }
        }
    }

    private func chart(_ points: [Point], metric: Metric) -> some View {
        let labelCount = min(4, points.count)
        let labels = (0..<labelCount).map { position in
            points[position * (points.count - 1) / max(1, labelCount - 1)].date
        }
        let start = points.first?.date ?? .now
        let end = points.last?.date ?? start
        let margin = max(6 * 3_600, end.timeIntervalSince(start) * 0.12)
        let spansYears = !Calendar.current.isDate(start, equalTo: end, toGranularity: .year)
        let integerStep = max(1, ceil((points.map(\.value).max() ?? 0) / 3))
        let integerAxis = (0...3).map { Double($0) * integerStep }

        return Chart(points) { point in
            LineMark(x: .value("日期", point.date), y: .value(metric.rawValue, point.value))
                .foregroundStyle(accent.tint)
            PointMark(x: .value("日期", point.date), y: .value(metric.rawValue, point.value))
                .foregroundStyle(accent.tint)
                .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
                .accessibilityValue("\(quantity(point.value)) \(metric.unit(weight: unit))")
        }
        .chartXScale(domain: start.addingTimeInterval(-margin)...end.addingTimeInterval(margin))
        .chartXAxis {
            AxisMarks(values: labels) { mark in
                AxisGridLine()
                if let date = mark.as(Date.self) {
                    AxisValueLabel(centered: false, anchor: .top, collisionResolution: .disabled) {
                        Text(String(spotterDay(date).suffix(spansYears ? 8 : 5))).fixedSize()
                    }
                }
            }
        }
        .chartYAxis {
            if metric == .sets || metric == .reps {
                AxisMarks(values: integerAxis) { mark in
                    AxisGridLine()
                    if let number = mark.as(Double.self) {
                        AxisValueLabel { Text(quantity(number)) }
                    }
                }
            } else {
                AxisMarks(values: .automatic(desiredCount: 4))
            }
        }
        .frame(height: 112)
    }

    private var earlierButton: some View {
        VStack(alignment: .leading, spacing: 5) {
            if loadFailed { Text("暂时无法读取更早的训练。").font(.caption).foregroundStyle(SpotterPalette.muted) }
            Button { Task { await readOlder(before: baseline) } } label: {
                Label(loadingMore ? "正在读取" : loadFailed ? "重试读取" : "加载更早的训练",
                      systemImage: "clock.arrow.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterControl)
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

    private func inUnit(_ kg: Double) -> Double { NativeExerciseHistory.convert(kg, from: "kg", to: unit) }

    private func quantity(_ amount: Double) -> String {
        amount.formatted(.number.precision(.fractionLength(0...1)))
    }

    private func loadLabel(_ kg: Double) -> String { quantity(inUnit(kg)) + " " + unit }
}
