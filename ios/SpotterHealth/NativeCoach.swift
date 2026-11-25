import CryptoKit
import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

private struct NativeMealDraft: Codable, Equatable {
    var name: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var grams: Double?

    func values(meal: String) -> [String: Any] {
        var fields: [String: Any] = [
            "type": "meal", "meal": meal, "name": name, "calories": calories,
            "protein": protein, "carbs": carbs, "fat": fat
        ]
        if let grams { fields["grams"] = grams }
        return fields
    }
}

extension Notification.Name {
    static let spotterNativeNutritionUpdated = Self("spotter.native.nutrition.updated")
}

enum NativeCoachConsent {
    static func isAllowed(owner: String) -> Bool {
        !owner.isEmpty && UserDefaults.standard.bool(forKey: key(owner))
    }

    static func allow(owner: String) {
        guard !owner.isEmpty else { return }
        UserDefaults.standard.set(true, forKey: key(owner))
    }

    static func revoke(owner: String) {
        guard !owner.isEmpty else { return }
        UserDefaults.standard.removeObject(forKey: key(owner))
    }

    static func key(_ owner: String) -> String { "spotter.native.coach.consent." + owner }
}

struct NativeCoachSharingChoice: View {
    @Binding var allowed: Bool
    let origin: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle("允许 AI 教练处理我发送的内容", isOn: $allowed)
                .font(.subheadline.weight(.semibold))
            Text("你选择发送的对话、照片和训练计划会交由外部 AI 服务处理。可随时在设置中撤销。")
                .font(.footnote).foregroundStyle(.secondary)
            if let policy = URL(string: origin + "/privacy#external-ai") {
                Link("查看数据处理说明", destination: policy).font(.footnote).buttonStyle(.spotterPress)
            }
        }
    }
}

struct NativeCoachSharingSettings: View {
    @AppStorage private var allowed: Bool
    let origin: String

    init(owner: String, origin: String) {
        _allowed = AppStorage(wrappedValue: false, NativeCoachConsent.key(owner))
        self.origin = origin
    }

    var body: some View { NativeCoachSharingChoice(allowed: $allowed, origin: origin) }
}

private enum CoachColors {
    static let canvas = SpotterPalette.color(0x0b111b)
    static let panel = SpotterPalette.color(0x1a2535).opacity(0.82)
    static let dark = SpotterPalette.color(0x141b28)
    static let text = SpotterPalette.color(0xf2f5fa)
    static let muted = SpotterPalette.color(0xb8c2d2)
    static let border = SpotterPalette.color(0x9faed0).opacity(0.23)
    static let choice = SpotterPalette.color(0x252e42)
    static let indigo = SpotterPalette.color(0x344369)
    static let ocean = SpotterPalette.color(0x173b49)
    static let pearl = SpotterPalette.color(0xe9edf5)
    static let glow = Color(red: 0.18, green: 0.30, blue: 0.22)
    static let error = Color(red: 1, green: 0.72, blue: 0.70)
}

private extension View {
    func coachPanel(_ fill: Color = CoachColors.panel, radius: CGFloat = 16) -> some View {
        background(fill, in: RoundedRectangle(cornerRadius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(CoachColors.border, lineWidth: 1).allowsHitTesting(false))
    }

    func guidePanel(accent: SpotterAccent? = nil) -> some View {
        background(accent?.selection ?? SpotterPalette.card, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16)
                .strokeBorder(accent?.tint ?? SpotterPalette.line, lineWidth: 1))
    }
}

@MainActor
struct NativeCoachView: View {
    private struct Quota: Decodable {
        let dailyLimit: Int
        let monthlyLimit: Int
        let dailyRemaining: Int
        let monthlyRemaining: Int
        let dailyResetsAt: String?
        let monthlyResetsAt: String?

        var limitMessage: String? {
            if monthlyRemaining <= 0 { return "本月 AI 教练的 \(monthlyLimit.formatted()) 条消息额度已用完，下月 1 日（UTC）重置。" }
            if dailyRemaining <= 0 { return "今天 AI 教练的 \(dailyLimit.formatted()) 条消息额度已用完，次日（UTC）重置。" }
            return nil
        }

        var blockedUntil: Date? {
            guard limitMessage != nil, let stamp = monthlyRemaining <= 0 ? monthlyResetsAt : dailyResetsAt else { return nil }
            return try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(stamp)
        }
    }

    private struct QuotaResponse: Decodable { let quota: Quota? }

    private struct Line: Codable, Equatable {
        let role: String
        let content: String
        var receipt: MealReceipt? = nil
        var proteinReceipt: ProteinOperationReceipt? = nil
    }
    private struct MealReceipt: Codable, Equatable, Identifiable {
        let id: String
        let date: String
        var draft: NativeMealDraft
        var meal: String
        var updated: String
        var recipeID: String? = nil
        var estimate: String? = nil
    }
    private struct ProteinOperationReceipt: Codable, Equatable {
        enum Area: String, Codable { case warehouse, trainingDefault, diary }
        enum Result: String, Codable {
            case saved, skipped, failed, unconfirmed, undone

            var label: String {
                switch self {
                case .saved: return "已保存"
                case .skipped: return "已跳过"
                case .failed: return "未完成"
                case .unconfirmed: return "待核对"
                case .undone: return "已撤销"
                }
            }
            var symbol: String {
                switch self {
                case .saved: return "checkmark.circle.fill"
                case .skipped: return "minus.circle"
                case .failed, .unconfirmed: return "exclamationmark.circle"
                case .undone: return "arrow.uturn.backward.circle"
                }
            }
        }
        struct Step: Codable, Equatable, Identifiable {
            let area: Area
            var result: Result
            var detail: String
            var date: String? = nil
            var meal: MealReceipt? = nil

            var id: String { area.rawValue + (date ?? "") }
            var title: String {
                switch area {
                case .warehouse: return "蛋白粉仓库"
                case .trainingDefault: return "训练后默认配方"
                case .diary: return date.map { "\($0) · 饮食日记" } ?? "饮食日记"
                }
            }
        }
        let id: String
        var steps: [Step]
    }
    private enum ReceiptDestination: Identifiable {
        case warehouse, diary(String)

        var id: String {
            switch self {
            case .warehouse: return "warehouse"
            case .diary(let day): return day
            }
        }
    }
    private struct PlanDraft: Codable, Equatable, Identifiable {
        let id: String
        let raw: NativeJSON

        init?(data: [String: Any]) {
            guard let bytes = try? JSONSerialization.data(withJSONObject: data),
                  let raw = try? JSONDecoder().decode(NativeJSON.self, from: bytes) else { return nil }
            id = UUID().uuidString.lowercased()
            self.raw = raw
        }

        var data: [String: Any] {
            guard let bytes = try? JSONEncoder().encode(raw),
                  let data = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { return [:] }
            return data
        }
        var title: String { raw["title"].string }
        var date: String { raw["date"].string }
    }
    private struct SavedDrink: Codable, Equatable {
        var id = UUID().uuidString.lowercased()
        var text: String
        var day: String
        var productID: String? = nil
        var anotherCup = false
    }
    private struct KnownProtein: Codable, Equatable, Identifiable {
        let id: String
        let name: String
    }
    private struct SavedDrinkReply: Decodable {
        struct Record: Decodable {
            let id: String
            let date: String
            let entry: NativeMealDraft
            let updated: String
            let alreadyRecorded: Bool
            let linkedWorkout: String?
        }
        let status: String
        let message: String?
        let products: [KnownProtein]?
        let productId: String?
        let powderGrams: Double?
        let liquidMl: Double?
        let liquidName: String?
        let records: [Record]?
    }
    private struct Snapshot: Codable {
        var lines: [Line]
        var plans: [PlanDraft]
        var pendingDrink: SavedDrink?
        var duplicateDrink: SavedDrink?
        var choices: [KnownProtein]
        var lastDrink: SavedDrink?
        var mealDraft: NativeMealDraft?
        var mealID: String?
        var mealDate: String?
        var meal: String?
        var mealEstimate: String? = nil
    }
    private struct ProteinPhotoReading: Decodable {
        struct Label: Decodable {
            let name: String?
            let scoopGrams: Double?
            let per100g: [String: Double]?
        }
        let product: Label?
        let needs: [String]?
        let quota: Quota?
    }
    private struct RecognizedMeal: Decodable {
        var draft: NativeMealDraft?
        var needs: [String]?
        var error: String?
        var quota: Quota?
        var estimate: String?
    }
    private enum RequestKind {
        case chat
        case plan
        case photo
        case guided
    }
    private enum Mode { case coach, own }
    private struct Activity: Decodable { let entries: [NativeWorkoutEntry] }
    private struct ConversationLayout: Equatable {
        let lineCount: Int
        let trailingReceipt: ProteinOperationReceipt?
        let busy: Bool
        let error: String?
        let hasDraft: Bool
    }

    let api: NativeAPI
    let owner: String
    var compact = true
    var onExpand: (() -> Void)? = nil
    var onStartWorkout: (() -> Void)? = nil
    let nutritionDate: String?
    let initialTrainingGoal: String?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.colorScheme) private var surroundingColorScheme
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.spotterInteractionMotion) private var controlMotion
    @ScaledMetric(relativeTo: .body) private var composerHeight: CGFloat = 54
    @FocusState private var editingMessage: Bool
    @AppStorage private var sharingAllowed: Bool
    @State private var lines: [Line] = []
    @State private var text = ""
    @State private var error: String?
    @State private var busy = false
    @State private var quota: Quota?
    @State private var planDrafts: [PlanDraft] = []
    @State private var mealDraft: NativeMealDraft?
    @State private var mealID = UUID().uuidString.lowercased()
    @State private var mealDate = ""
    @State private var mealEstimate: String?
    @State private var picture: Data?
    @State private var photoMealHistory: [[String: String]] = []
    @State private var photoNeedsReply = false
    @State private var photoChoice: PhotosPickerItem?
    @State private var showPhotoPicker = false
    @State private var camera = false
    @State private var showGuide = false
    @State private var planMode = false
    @State private var meal = "加餐"
    @State private var mode: Mode = .coach
    @State private var showOptions = false
    @State private var includePlans = false
    @State private var contextDate = Date.now
    @State private var contextRange = "week"
    @State private var guidedDraft: CoachGuidedSelection?
    @State private var sendGuidedAfterClosing = false
    @State private var weightPrompt = false
    @State private var pendingWeight: (id: String, date: String, kg: Double)?
    @State private var ownPromptVisible = false
    @State private var ownPromptMode = "起草新计划"
    @State private var ownNotice: String?
    @State private var showOwnImport = false
    @State private var copiedReply: Int?
    @State private var startedWelcomeGuide = false
    @State private var restoredConversation = false
    @State private var pendingDrink: SavedDrink?
    @State private var duplicateDrink: SavedDrink?
    @State private var drinkOptions: [KnownProtein] = []
    @State private var lastDrink: SavedDrink?
    @State private var proteinEditor: NativeProteinRecipeEditor?
    @State private var proteinPhotoID = UUID().uuidString.lowercased()
    @State private var proteinPhotoLogsDrink = false
    @State private var proteinPhotoNotes = ""
    @State private var pendingProteinPhotoPrompt: String?
    @State private var editingReceipt: MealReceipt?
    @State private var receiptDestination: ReceiptDestination?

    init(api: NativeAPI, owner: String, compact: Bool = true, onExpand: (() -> Void)? = nil,
         onStartWorkout: (() -> Void)? = nil, initialMeal: String? = nil, nutritionDate: String? = nil,
         initialTrainingGoal: String? = nil) {
        self.api = api
        self.owner = owner
        self.compact = compact
        self.onExpand = onExpand
        self.onStartWorkout = onStartWorkout
        self.nutritionDate = nutritionDate
        self.initialTrainingGoal = initialTrainingGoal
        _sharingAllowed = AppStorage(wrappedValue: false, NativeCoachConsent.key(owner))
        _meal = State(initialValue: initialMeal ?? "加餐")
    }

    private var cleanText: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var reducesMotion: Bool { reduceMotion || systemReduceMotion }
    private var panelTransition: AnyTransition { reducesMotion ? .identity : .opacity.combined(with: .offset(y: 6)) }
    private var showsOptions: Bool { showOptions && picture == nil && !weightPrompt }
    private var showsSuggestions: Bool {
        !showsOptions && picture == nil && !weightPrompt && mealDraft == nil && pendingDrink == nil && !editingMessage && cleanText.isEmpty
    }
    private var showsContextChip: Bool { includePlans && !showsOptions && !weightPrompt && picture == nil }
    private var hasReachedLimit: Bool { quota?.limitMessage != nil }
    private var canUseCamera: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }
    private let mealOptions = ["早餐", "午餐", "晚餐", "加餐"].map { ($0, $0) }

    var body: some View {
        VStack(spacing: 0) {
            header
            ZStack(alignment: .top) {
                if mode == .coach { conversation.transition(.opacity) }
                else { ownAI.transition(.opacity) }
            }
            .animation(reducesMotion ? nil : .easeInOut(duration: 0.2), value: mode)
        }
        .foregroundStyle(CoachColors.text)
        .tint(accent.fill)
        .background(atmosphere)
        .toolbar(.hidden, for: .navigationBar)
        .environment(\.colorScheme, .dark)
        .task(id: owner) {
            restoreConversation()
            await refreshQuota(ifUnknown: true)
            if initialTrainingGoal != nil, !startedWelcomeGuide, !Task.isCancelled {
                startedWelcomeGuide = true
                openGuide()
            }
        }
        .onChange(of: lines) { _ in persistConversation() }
        .onChange(of: planDrafts) { _ in persistConversation() }
        .onDisappear { persistConversation() }
        .task(id: quota?.blockedUntil) {
            guard let reset = quota?.blockedUntil else { return }
            do {
                try await Task.sleep(for: .seconds(max(0, reset.timeIntervalSinceNow) + 1))
                await refreshQuota()
            } catch { }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoChoice, matching: .images)
        .onChange(of: sharingAllowed) { allowed in
            if allowed && error == Self.sharingDisabledMessage { error = nil }
        }
        .onChange(of: photoChoice) { choice in
            guard let choice else { return }
            Task {
                do {
                    guard let input = try await choice.loadTransferable(type: Data.self), let jpeg = coachImage(input) else {
                        error = "这张照片无法读取，请选择其他照片。"
                        return
                    }
                    attachMealPhoto(jpeg)
                } catch { self.error = "相册暂时无法读取这张照片。" }
            }
        }
        .fullScreenCover(isPresented: $camera) {
            NativeFoodCamera { data in
                camera = false
                if let data {
                    if let jpeg = coachImage(data) { attachMealPhoto(jpeg) }
                    else { error = "无法读取这张照片。" }
                }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGuide, onDismiss: {
            if sendGuidedAfterClosing { sendGuidedAfterClosing = false; submit(.guided) }
        }) {
            NativePlanQuestions(initialGoal: initialTrainingGoal) { draft in
                guidedDraft = draft
                sendGuidedAfterClosing = true
                showGuide = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showOwnImport) {
            NavigationStack {
                NativePlanImportView(api: api, owner: owner, didImport: {})
            }.tint(accent.tint).presentationDragIndicator(.visible)
        }
        .sheet(item: $proteinEditor) { editor in
            NavigationStack {
                NativeProteinEditor(initial: editor, confirmTitle: proteinPhotoLogsDrink ? "保存配方并核对记餐" : "核对无误，保存到仓库") { product, makeDefault in
                    await saveProteinRecipe(product, makeDefault: makeDefault)
                }
            }.environment(\.colorScheme, surroundingColorScheme).presentationDragIndicator(.visible)
        }
        .sheet(item: $editingReceipt) { receipt in
            receiptEditor(receipt)
        }
        .sheet(item: $receiptDestination) { destination in
            Group {
                switch destination {
                case .warehouse:
                    NavigationStack {
                        NativeProteinView(api: api, owner: owner)
                            .toolbar {
                                ToolbarItem(placement: .cancellationAction) { Button("关闭") { receiptDestination = nil } }
                            }
                    }
                case .diary(let day):
                    if let date = nativePlanDate(day) { NativeNutritionDetail(api: api, owner: owner, initialDate: date) }
                }
            }
            .environment(\.colorScheme, surroundingColorScheme)
            .presentationDragIndicator(.visible)
        }
    }

    private var atmosphere: some View {
        ZStack {
            LinearGradient(colors: [CoachColors.canvas, SpotterPalette.color(0x0a131b), SpotterPalette.color(0x080d14)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [CoachColors.indigo.opacity(0.83), .clear], center: .topLeading,
                           startRadius: 5, endRadius: 365)
            RadialGradient(colors: [CoachColors.ocean.opacity(0.67), .clear], center: UnitPoint(x: 0.95, y: 0.31),
                           startRadius: 0, endRadius: 260)
        }.ignoresSafeArea().accessibilityHidden(true)
    }

    private var header: some View {
        HStack(spacing: 5) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(accent.fill).frame(width: 34, height: 34)
                    .background(accent.fill.opacity(0.13), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(accent.fill.opacity(0.34)).allowsHitTesting(false))
                    .accessibilityHidden(true)
                Text(mode == .coach ? "Spotter 教练" : "用自己的 AI")
                    .font(.headline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
                    .accessibilityAddTraits(.isHeader)
            }
            Spacer(minLength: 0)
            if compact, let onExpand { headerButton("arrow.up.left.and.arrow.down.right", label: "展开 AI 教练", action: onExpand) }
            headerMenu
            headerButton("xmark", label: "关闭 AI 教练") { dismiss() }
        }
        .spotterGlassCluster()
        .padding(.horizontal, 17).padding(.top, 8).padding(.bottom, 3)
    }

    @ViewBuilder
    private func headerButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        let button = Button(action: action) {
            Image(systemName: icon).font(.system(size: 14, weight: .semibold))
        }
        .foregroundStyle(CoachColors.text)
        .accessibilityLabel(label)
        if #available(iOS 26.0, *) {
            button.buttonStyle(.glass(.clear.interactive(!reducesMotion)))
                .buttonBorderShape(.circle)
                .controlSize(.regular)
        } else {
            button.buttonStyle(.spotterPress)
                .frame(width: 44, height: 44)
                .contentShape(Circle())
                .spotterGlass(in: Circle(), tint: CoachColors.choice, interactive: false)
        }
    }

    private var headerMenu: some View {
        SpotterMenu {
            if mode == .coach {
                if !lines.isEmpty || mealDraft != nil || picture != nil {
                    Button("新对话", systemImage: "plus.message", action: resetConversation).disabled(busy)
                }
                Button(showOptions ? "收起对话选项" : "对话选项", systemImage: "slider.horizontal.3") {
                    editingMessage = false
                    showOptions.toggle()
                }.disabled(busy || picture != nil || weightPrompt)
                if let onStartWorkout { Button("开始训练", systemImage: "dumbbell", action: onStartWorkout).disabled(busy) }
                Button("用自己的 AI", systemImage: "square.and.arrow.up") { switchMode(.own) }.disabled(busy)
            } else {
                Button("返回教练对话", systemImage: "bubble") { switchMode(.coach) }
            }
        } label: {
            Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(CoachColors.text)
                .frame(width: 20, height: 44)
        }.accessibilityLabel("教练菜单")
    }

    private func switchMode(_ next: Mode) {
        editingMessage = false
        mode = next
    }

    private var conversation: some View {
        let layout = ConversationLayout(lineCount: lines.count, trailingReceipt: lines.last?.proteinReceipt,
                                        busy: busy, error: error, hasDraft: mealDraft != nil || !planDrafts.isEmpty)
        return VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        if lines.isEmpty && mealDraft == nil { welcome.transition(panelTransition) }
                        if !sharingAllowed {
                            NativeCoachSharingChoice(allowed: $sharingAllowed, origin: api.origin)
                                .padding(12).coachPanel().transition(panelTransition)
                        }
                        ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                            message(line, index: index).transition(panelTransition)
                        }
                        if !planDrafts.isEmpty { planPreview.transition(panelTransition) }
                        if let draft = mealDraft { mealPreview(draft).transition(panelTransition) }
                        if pendingDrink != nil || duplicateDrink != nil { drinkFollowup.transition(panelTransition) }
                        if let error { message(Line(role: "error", content: error)).transition(panelTransition) }
                        if busy {
                            ProgressView("教练正在回复").font(.footnote).tint(accent.fill)
                                .padding(.vertical, 6).transition(.opacity)
                        }
                        Color.clear.frame(height: 1).id("latest")
                    }
                    .padding(.horizontal, 20).padding(.top, compact ? 14 : 24).padding(.bottom, 14)
                }
                .scrollDismissesKeyboard(.interactively)
                .task(id: layout) {
                    // Wait for the latest reply layout before scrolling, including when steps update in place.
                    do {
                        try await Task.sleep(for: .milliseconds(100))
                        proxy.scrollTo("latest", anchor: .bottom)
                    } catch {}
                }
            }
            composer
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("今天想怎么练？")
                .font(compact ? .title2.weight(.semibold) : .largeTitle.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
            Text("问一个训练问题，看看本周练了什么，或一起排个计划。")
                .font(.body).lineSpacing(4).foregroundStyle(CoachColors.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func resetConversation() {
        lines = []; planDrafts = []; mealDraft = nil; mealEstimate = nil; error = nil; text = ""
        clearMealPhoto(); planMode = false; weightPrompt = false; pendingWeight = nil; guidedDraft = nil
        includePlans = false; showOptions = false; copiedReply = nil; editingMessage = false
        pendingDrink = nil; duplicateDrink = nil; drinkOptions = []; lastDrink = nil
        pendingProteinPhotoPrompt = nil
        Self.removeSavedConversation(api: api, owner: owner)
    }

    private static func conversationURL(api: NativeAPI, owner: String) -> URL? {
        guard !owner.isEmpty else { return nil }
        let digest = SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/Coach", isDirectory: true).appendingPathComponent(digest + ".json")
    }

    static func removeSavedConversation(api: NativeAPI, owner: String) {
        guard let file = conversationURL(api: api, owner: owner) else { return }
        try? FileManager.default.removeItem(at: file)
    }

    private func restoreConversation() {
        guard !restoredConversation else { return }
        restoredConversation = true
        guard let url = Self.conversationURL(api: api, owner: owner), let data = try? Data(contentsOf: url),
              let stored = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        lines = stored.lines; planDrafts = stored.plans
        pendingDrink = stored.pendingDrink; duplicateDrink = stored.duplicateDrink
        drinkOptions = stored.choices; lastDrink = stored.lastDrink
        if let draft = stored.mealDraft, let id = stored.mealID, let day = stored.mealDate {
            mealDraft = draft; mealID = id; mealDate = day; meal = stored.meal ?? meal; mealEstimate = stored.mealEstimate
        }
    }

    private func persistConversation() {
        guard restoredConversation, let url = Self.conversationURL(api: api, owner: owner) else { return }
        if lines.isEmpty && planDrafts.isEmpty && pendingDrink == nil && mealDraft == nil {
            Self.removeSavedConversation(api: api, owner: owner)
            return
        }
        let stored = Snapshot(lines: Array(lines.suffix(80)), plans: planDrafts, pendingDrink: pendingDrink,
                              duplicateDrink: duplicateDrink, choices: drinkOptions, lastDrink: lastDrink, mealDraft: mealDraft,
                              mealID: mealDraft == nil ? nil : mealID, mealDate: mealDraft == nil ? nil : mealDate,
                              meal: mealDraft == nil ? nil : meal, mealEstimate: mealEstimate)
        do {
            var folder = url.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                                    attributes: [.protectionKey: FileProtectionType.complete])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try folder.setResourceValues(values)
            try JSONEncoder().encode(stored).write(to: url, options: [.atomic, .completeFileProtection])
        } catch { }
    }

    @ViewBuilder
    private func message(_ line: Line, index: Int? = nil) -> some View {
        if let receipt = line.proteinReceipt {
            proteinReceiptCard(receipt)
        } else if let receipt = line.receipt {
            savedMealCard(receipt, summary: line.content)
        } else if line.role == "user" || line.role == "local-user" {
            HStack {
                Spacer(minLength: 48)
                Text(line.content).font(.body).lineSpacing(3).textSelection(.enabled)
                    .padding(.vertical, 9).padding(.horizontal, 13).coachPanel(CoachColors.choice, radius: 17)
            }
            .accessibilityLabel("你：\(line.content)")
        } else if line.role == "error" || line.role == "status" || line.role == "meal" {
            let mark = line.role == "error" ? ("exclamationmark.circle", "暂未完成", CoachColors.error)
                : line.role == "status" ? ("checkmark", "已保存", accent.fill) : ("camera", "拍照记饮食", Color.orange)
            VStack(alignment: .leading, spacing: 9) {
                messageTitle(mark.0, mark.1, mark.2)
                Text(line.content).font(.subheadline).lineSpacing(4).textSelection(.enabled)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(13).coachPanel(radius: 17)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text(line.content).font(.body).lineSpacing(6).textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                if let index, line.role == "assistant" {
                    Button {
                        UIPasteboard.general.string = line.content
                        copiedReply = index
                    } label: {
                        Image(systemName: copiedReply == index ? "checkmark" : "document.on.document")
                            .font(.subheadline.weight(.medium)).foregroundStyle(copiedReply == index ? accent.fill : CoachColors.muted)
                            .contentTransition(.opacity)
                            .frame(width: 44, height: 44, alignment: .leading).contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress).accessibilityLabel(copiedReply == index ? "已复制回复" : "复制回复")
                    .animation(controlMotion, value: copiedReply == index)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func savedMealCard(_ receipt: MealReceipt, summary: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            messageTitle("checkmark", "已记入\(receipt.meal)")
            Text(receipt.draft.name).font(.subheadline.weight(.semibold)).textSelection(.enabled)
            Text([receipt.date, receipt.draft.grams.map { coachAmount($0) + " g" },
                  coachAmount(receipt.draft.calories) + " 千卡", "蛋白质 " + coachAmount(receipt.draft.protein) + " g"]
                .compactMap { $0 }.joined(separator: " · "))
                .font(.footnote).foregroundStyle(CoachColors.muted)
            if !summary.isEmpty { Text(summary).font(.footnote).foregroundStyle(CoachColors.muted) }
            if let estimate = receipt.estimate {
                Label("估算 · \(estimate)", systemImage: "ruler")
                    .font(.footnote).foregroundStyle(CoachColors.muted)
                    .accessibilityLabel("估算依据：\(estimate)")
            }
            HStack(spacing: 16) {
                Button("日记", systemImage: "calendar") { receiptDestination = .diary(receipt.date) }
                Button("编辑", systemImage: "pencil") { editingReceipt = receipt }
                Button("撤销", systemImage: "arrow.uturn.backward") { Task { await undoMeal(receipt) } }
            }
            .buttonStyle(.spotterPress).font(.footnote.weight(.semibold)).disabled(busy)
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(13).coachPanel()
    }

    private func proteinReceiptCard(_ receipt: ProteinOperationReceipt) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            messageTitle("list.bullet.rectangle", "操作结果")
            ForEach(receipt.steps) { step in
                Divider().overlay(CoachColors.border)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(step.title).font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Label(step.result.label, systemImage: step.result.symbol)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(step.result == .saved ? accent.fill : CoachColors.muted)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    Text(step.detail).font(.footnote).foregroundStyle(CoachColors.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    proteinReceiptActions(step)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(13).coachPanel()
    }

    @ViewBuilder private func proteinReceiptActions(_ step: ProteinOperationReceipt.Step) -> some View {
        HStack(spacing: 12) {
            if step.area == .warehouse || step.area == .trainingDefault {
                Button("查看仓库", systemImage: "shippingbox") { receiptDestination = .warehouse }
            } else if let date = step.date {
                Button("打开日记", systemImage: "calendar") { receiptDestination = .diary(date) }
            }
            if let meal = step.meal {
                Button { editingReceipt = meal } label: { Image(systemName: "pencil").frame(minWidth: 44, minHeight: 44) }
                    .accessibilityLabel("编辑 \(meal.date) 的饮食记录")
                Button { Task { await undoMeal(meal) } } label: { Image(systemName: "arrow.uturn.backward").frame(minWidth: 44, minHeight: 44) }
                    .accessibilityLabel("撤销 \(meal.date) 的饮食记录")
            }
        }
        .font(.footnote.weight(.semibold))
        .buttonStyle(.spotterPress)
        .disabled(busy)
    }

    private var drinkFollowup: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let pendingDrink {
                if !drinkOptions.isEmpty {
                    Text("喝的是哪一款？").font(.subheadline.weight(.semibold))
                    ForEach(drinkOptions) { option in
                        Button(option.name) { Task { await recordDrink(selectDrink(option, for: pendingDrink)) } }
                            .buttonStyle(.spotterPress).frame(minHeight: 38)
                    }
                } else if error != nil {
                    coachPrimary("重试记录") { Task { await recordDrink(pendingDrink) } }
                }
                Button("取消这次记录") { clearDrink() }.font(.footnote).buttonStyle(.spotterPress)
            }
            if let duplicateDrink {
                coachPrimary("刚喝了另一杯，继续记") {
                    var next = duplicateDrink
                    next.id = UUID().uuidString.lowercased()
                    next.anotherCup = true
                    Task { await recordDrink(next) }
                }
            }
        }
        .disabled(busy || hasReachedLimit)
        .frame(maxWidth: .infinity, alignment: .leading).padding(13).coachPanel()
    }

    private func coachAmount(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)))
    }

    private func messageTitle(_ icon: String, _ title: String, _ tint: Color? = nil) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon).frame(width: 28, height: 28)
                .background((tint ?? accent.fill).opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            Text(title).font(.footnote.weight(.bold))
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 9) {
            if showsOptions {
                VStack {
                    Toggle("附上个人训练安排", isOn: $includePlans)
                    if includePlans {
                        VStack {
                            DatePicker("计划日期", selection: $contextDate, displayedComponents: .date)
                            SpotterMenuPicker("安排范围", selection: $contextRange, options: [("day", "所选日期"), ("week", "所在周")])
                        }
                        .transition(panelTransition)
                    }
                    Button("问答定制训练计划") { openGuide() }
                        .buttonStyle(.spotterPress).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .disabled(hasReachedLimit)
                }
                .font(.footnote).padding(11).coachPanel()
                .animation(controlMotion, value: includePlans)
                .transition(panelTransition)
            }
            if showsSuggestions {
                suggestedReplies.transition(panelTransition)
            }
            if let picture, let image = UIImage(data: picture) {
                HStack(spacing: 9) {
                    Image(uiImage: image).resizable().scaledToFill().frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                        .accessibilityLabel(photoMealHistory.isEmpty ? "待发送的餐食照片" : "本轮对话的餐食照片")
                    SpotterMenuPicker("记入餐次", selection: $meal, options: mealOptions) {
                        HStack(spacing: 5) {
                            Text(meal).lineLimit(1)
                            Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                        }
                        .frame(minHeight: 44)
                    }
                    Spacer()
                    Button { clearMealPhoto() } label: {
                        Image(systemName: "xmark").fontWeight(.semibold).frame(width: 38, height: 38)
                            .spotterGlass(cornerRadius: 19, interactive: !reducesMotion)
                            .frame(width: 44, height: 44).contentShape(Rectangle())
                    }.buttonStyle(.spotterPress).disabled(busy).accessibilityLabel("移除照片")
                }
                .spotterGlassCluster()
                .font(.footnote).padding(8).coachPanel().transition(panelTransition)
            } else if planMode || weightPrompt {
                HStack {
                    Text(weightPrompt ? "记录体重" : "正在调整训练草稿")
                    Spacer()
                    Button("取消") { planMode = false; weightPrompt = false }
                        .buttonStyle(.spotterPress).disabled(busy)
                }.font(.footnote).foregroundStyle(CoachColors.muted).padding(.horizontal, 4)
                    .transition(panelTransition)
            }
            if showsContextChip {
                Button {
                    showOptions = true
                    editingMessage = false
                } label: {
                    Label("已附上训练安排", systemImage: "paperclip").font(.caption.weight(.medium))
                        .padding(.horizontal, 5).frame(minHeight: 28)
                }
                .buttonStyle(.spotterPress).disabled(busy).transition(panelTransition)
            }
            HStack(alignment: .bottom, spacing: 9) {
                attachmentMenu
                inputBar
            }
            if let message = quota?.limitMessage {
                HStack(spacing: 8) {
                    Text(message).font(.caption2).foregroundStyle(CoachColors.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button("刷新额度") { Task { await refreshQuota() } }
                        .font(.caption2.weight(.semibold)).buttonStyle(.spotterPress)
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 16).padding(.top, 5).padding(.bottom, 8)
        .animation(controlMotion, value: showsOptions)
        .animation(controlMotion, value: showsContextChip)
        .animation(controlMotion, value: picture != nil)
        .animation(controlMotion, value: planMode || weightPrompt)
        .animation(controlMotion, value: hasReachedLimit)
    }

    private var attachmentMenu: some View {
        SpotterMenu {
            Button("拍照", systemImage: "camera") {
                editingMessage = false
                camera = true
            }.disabled(!canUseCamera)
            Button("相册", systemImage: "photo.on.rectangle") {
                editingMessage = false
                showPhotoPicker = true
            }
        } label: {
            Image(systemName: "plus").font(.title3.weight(.medium)).foregroundStyle(CoachColors.text)
                .frame(width: 26, height: 48)
        }.accessibilityLabel("添加餐食照片").accessibilityIdentifier("coach-attachments").disabled(busy || hasReachedLimit)
    }

    private var inputBar: some View {
        let shape = RoundedRectangle(cornerRadius: 17, style: .continuous)
        return HStack(alignment: .center, spacing: 5) {
            composerField
            Button { sendComposer() } label: {
                if picture != nil && photoMealHistory.isEmpty {
                    Text(looksLikeProteinPhoto(cleanText) || pendingProteinPhotoPrompt != nil ? "识别蛋白粉" : "识别并记餐")
                        .font(.footnote.weight(.bold)).padding(.horizontal, 11).frame(minHeight: 36)
                        .foregroundStyle(CoachColors.dark).background(accent.fill, in: Capsule())
                        .transition(.opacity)
                } else {
                    Image(systemName: "arrow.up").font(.body.weight(.semibold)).frame(width: 40, height: 38)
                        .foregroundStyle(canSendInput ? CoachColors.dark : CoachColors.muted.opacity(0.7))
                        .background(canSendInput ? accent.fill : .white.opacity(0.06), in: RoundedRectangle(cornerRadius: 13))
                        .accessibilityLabel("发送消息")
                        .transition(.opacity)
                }
            }.buttonStyle(.spotterPress).accessibilityIdentifier("coach-send")
                .disabled(busy || hasReachedLimit || !canSendInput)
        }
        .padding(4).frame(minHeight: 48)
        .background(LinearGradient(colors: [CoachColors.indigo.opacity(0.54), CoachColors.dark, CoachColors.ocean.opacity(0.67)],
                                   startPoint: .leading, endPoint: .trailing), in: shape)
        .overlay(shape.strokeBorder(LinearGradient(colors: [CoachColors.pearl.opacity(editingMessage ? 0.53 : 0.30),
                                                           accent.fill.opacity(editingMessage ? 0.40 : 0.12), CoachColors.border],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing)).allowsHitTesting(false))
        .animation(controlMotion, value: editingMessage)
    }

    private var canSendInput: Bool {
        !cleanText.isEmpty || (picture != nil && !photoNeedsReply)
    }

    private var composerField: some View {
        TextEditor(text: $text)
            .font(.body).scrollContentBackground(.hidden)
            .focused($editingMessage).disabled(busy)
            .frame(height: composerHeight)
            .accessibilityLabel(composerHint).accessibilityIdentifier("coach-composer")
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text(composerHint).font(.body).foregroundStyle(CoachColors.muted)
                        .lineLimit(1).padding(.top, 8).padding(.leading, 5)
                        .accessibilityHidden(true).allowsHitTesting(false)
                }
            }
            .padding(.leading, 7)
    }

    private var suggestedReplies: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if !planDrafts.isEmpty {
                    suggestion("调整这份计划", icon: "slider.horizontal.3") {
                        planMode = true
                        editingMessage = true
                    }
                    suggestion("重新定制计划", icon: "calendar") { openGuide() }
                } else if lines.last?.role == "assistant" {
                    suggestion("总结成训练要点") { sendSuggestedReply("请把刚才的回复总结成训练要点。") }
                    suggestion("给我一个简单做法") { sendSuggestedReply("根据刚才的讨论，给我一个简单、可执行的做法。") }
                    suggestion("生成训练计划", icon: "calendar") { openGuide() }
                } else {
                    suggestion("生成训练计划", icon: "calendar") { openGuide() }
                    suggestion("看本周训练统计", icon: "chart.bar") { Task { await trainingStats() } }
                    suggestion("记体重", icon: "scalemass") { askWeight() }
                    suggestion("拍照记饮食", icon: "camera") { showPhotoHelp() }
                }
            }
            .spotterGlassCluster(spacing: 5)
        }
        .accessibilityLabel("推荐回复").accessibilityIdentifier("coach-suggestions")
    }

    private func suggestion(_ title: String, icon: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).accessibilityHidden(true) }
                Text(title).fixedSize()
            }
            .font(.footnote.weight(.semibold)).foregroundStyle(CoachColors.text)
            .padding(.horizontal, 12).frame(minHeight: 44)
            .contentShape(Capsule())
            .spotterGlass(in: Capsule(), tint: CoachColors.choice.opacity(0.72),
                          interactive: !reducesMotion && !busy && !hasReachedLimit)
            .padding(.vertical, 4)
        }.buttonStyle(.spotterPress).disabled(busy || hasReachedLimit)
    }

    private func sendSuggestedReply(_ reply: String) {
        guard !busy else { return }
        text = reply
        sendComposer()
    }

    private var composerHint: String {
        if picture != nil {
            return photoMealHistory.isEmpty ? "例如一碗粥、一杯牛奶" : "回复教练，继续这餐…"
        }
        if pendingDrink != nil { return "补充这一杯的信息…" }
        if weightPrompt { return "例如 80.5 kg" }
        if planMode { return "想怎么调整这份草稿？" }
        return "问问 Spotter 教练…"
    }

    private func openGuide() {
        guard canSendConversation() else { return }
        editingMessage = false
        onExpand?()
        showGuide = true
    }

    private func showPhotoHelp() {
        lines += [Line(role: "local-user", content: "拍照记饮食"),
                  Line(role: "meal", content: "用输入栏旁的加号拍照或选照片。写下食物和份量后，可以识别并记餐。")]
        if canUseCamera { camera = true } else { showPhotoPicker = true }
    }

    private func askWeight() {
        lines += [Line(role: "local-user", content: "记体重"),
                  Line(role: "local", content: "今天体重是多少？可以输入 kg 或 lb。")]
        weightPrompt = true
        editingMessage = true
    }

    private func sendComposer() {
        guard !busy, canSendConversation() else { return }
        let input = cleanText
        if picture != nil {
            if ["取消", "取消本次", "不用记了"].contains(input) {
                clearMealPhoto()
                text = ""
                error = nil
                lines.append(Line(role: "local", content: "已取消这次照片记餐。"))
            } else if canSendInput {
                submit(.photo)
            }
            return
        }
        if let drink = pendingDrink {
            if ["取消", "算了", "不用记了", "取消本次", "不用了"].contains(input) {
                clearDrink()
                lines.append(Line(role: "local", content: "已取消这次蛋白粉记录。"))
                return
            }
            if let option = drinkOptions.first(where: { drinkName($0.name) == drinkName(input) }) {
                Task { await recordDrink(selectDrink(option, for: drink)) }
                return
            }
            if !drinkOptions.isEmpty {
                error = "请选择喝的是哪一款蛋白粉。"
                return
            }
            var continued = drink
            if input != "重试" { continued.text += "，" + input }
            let next = continued
            Task { await recordDrink(next) }
            return
        }
        if isProteinRecipeCommand(input) {
            Task { await handleProteinRecipeCommand(input) }
            return
        }
        pendingProteinPhotoPrompt = nil
        if isDrinkCommand(input) {
            var drink = SavedDrink(text: input, day: spotterDay())
            if input.range(of: "又喝|再喝|再记|另一杯|第二杯", options: .regularExpression) != nil {
                drink.anotherCup = true
                if let prior = duplicateDrink ?? lastDrink,
                   input.range(of: "[昨天前]天|今日|今天|\\d{4}-", options: .regularExpression) == nil {
                    drink.productID = prior.productID
                }
            }
            let next = drink
            Task { await recordDrink(next) }
            return
        }
        let weightPrefix = "^(?:(?:帮我|我要|请)\\s*)?(?:记录|记下|记一下|记)\\s*(?:我(?:的)?\\s*)?(?:今天的?\\s*)?体重\\s*[：:=]?\\s*"
        if let range = input.range(of: weightPrefix, options: .regularExpression) {
            text = String(input[range.upperBound...])
            if cleanText.isEmpty { askWeight() } else { weightPrompt = true; Task { await recordWeight() } }
        } else if weightPrompt {
            if ["取消", "不记了", "算了"].contains(input) {
                weightPrompt = false; pendingWeight = nil; text = ""
                lines.append(Line(role: "local", content: "已取消这次体重记录。"))
            } else { Task { await recordWeight() } }
        } else if ["看本周训练统计", "看训练统计", "本周训练统计", "查看本周训练统计"].contains(input) {
            text = ""; Task { await trainingStats() }
        } else if ["拍照记饮食", "记饮食", "记录饮食"].contains(input) {
            text = ""; showPhotoHelp()
        } else if !planMode && input.range(of: "^(?:(?:帮我|请|给我|我要|我想)\\s*)*(?:生成|制定|定制|起草)(?:一个|一份)?(?:训练|健身)?计划[。！!？? ]*$", options: .regularExpression) != nil {
            text = ""
            openGuide()
        } else { submit(planMode || !planDrafts.isEmpty && asksToRevisePlan(input) ? .plan : .chat) }
    }

    private func isDrinkCommand(_ input: String) -> Bool {
        let command = input.precomposedStringWithCompatibilityMapping
        let noLogging = "[？?]|要不要|是否|怎么样|怎么喝|几杯|怎么算|多少|可以吗|好吗|吗[。！!]?$|不想喝|没喝|不喝|别记|不要记|不用记|已经记|喝过了吗|仓库|入库"
        return command.range(of: noLogging, options: .regularExpression) == nil &&
            command.range(of: "喝(?:了|完了)|饮用(?:了)?|记(?:录|一下|入)?|帮我加", options: .regularExpression) != nil &&
            command.range(of: "蛋白粉|乳清|\\bwhey\\b", options: [.regularExpression, .caseInsensitive]) != nil
    }

    private func isProteinRecipeCommand(_ input: String) -> Bool {
        guard input.range(of: "蛋白粉|乳清|\\bwhey\\b|训练(?:后)?默认", options: [.regularExpression, .caseInsensitive]) != nil,
              input.range(of: "[?？]|怎么|如何|有没有|是否|要不要|能不能|可不可以|是不是",
                          options: .regularExpression) == nil else { return false }
        let warehouse = "(?:加入|加到|存入|存到|放进|写入|放入|添加到|添加进).{0,10}仓库|添加.{0,6}入库"
        return hasAffirmativeProteinAction(input, matching: warehouse) || requestsTrainingDefault(input)
    }

    private func requestsTrainingDefault(_ text: String) -> Bool {
        hasAffirmativeProteinAction(text, matching: "(?:设为|设成|改成|作为|设置为?).{0,10}默认")
    }

    private func hasAffirmativeProteinAction(_ text: String, matching pattern: String) -> Bool {
        text.split(whereSeparator: { $0.isNewline || "，。！？,.;；".contains($0) }).contains { clause in
            guard let action = clause.range(of: pattern, options: .regularExpression) else { return false }
            return clause[..<action.lowerBound].range(of: "不要|不用|不必|不想|不需要|不能|别", options: .regularExpression) == nil
        }
    }

    private enum ProteinDiaryIntent { case none, record, skip }

    private func proteinDiaryIntent(_ notes: String) -> ProteinDiaryIntent {
        if notes.range(of: "别(?:再)?记|不要再记|不用(?:再)?记|不需要(?:再)?记|只(?:要)?入库", options: .regularExpression) != nil { return .skip }
        if notes.range(of: "帮我记|补(?:记|录|上)|记入饮食|记一下|加入饮食|记录饮食|喝了.{0,12}(?:记|补)", options: .regularExpression) != nil { return .record }
        if notes.range(of: "别重复|不要重复|已经记", options: .regularExpression) != nil { return .skip }
        return .none
    }

    private func recipeDiarySkipSteps(_ notes: String, day: String) -> [ProteinOperationReceipt.Step] {
        let dateRE = try? NSRegularExpression(pattern: "\\d{4}-\\d{2}-\\d{2}")
        let matches = dateRE?.matches(in: notes, range: NSRange(notes.startIndex..., in: notes)) ?? []
        var dates = Set(matches.compactMap { match -> String? in
            guard let range = Range(match.range, in: notes) else { return nil }
            let key = String(notes[range])
            guard let date = nativePlanDate(key), spotterDay(date) == key else { return nil }
            return key
        })
        if let base = nativePlanDate(day) {
            for (pattern, offset) in [("今天|今日", 0), ("昨天|昨日", -1), ("前天", -2)]
            where notes.range(of: pattern, options: .regularExpression) != nil {
                if let date = Calendar.current.date(byAdding: .day, value: offset, to: base) { dates.insert(spotterDay(date)) }
            }
        }
        let detail = "按你的要求保留原记录。"
        return dates.isEmpty ? [.init(area: .diary, result: .skipped, detail: detail)]
            : dates.sorted().map { .init(area: .diary, result: .skipped, detail: detail, date: $0) }
    }

    private func handleProteinRecipeCommand(_ notes: String) async {
        guard !busy else { return }
        busy = true; error = nil; text = ""; pendingProteinPhotoPrompt = nil
        defer { busy = false }
        lines.append(Line(role: "local-user", content: notes))
        let id = UUID().uuidString.lowercased()
        let makeDefault = requestsTrainingDefault(notes)
        do {
            let payload = try await api.request("/api/library", method: "GET", json: nil, for: owner)
            let rows = try JSONDecoder().decode(NativeJSON.self, from: payload)["rows"].array
            let products = rows.first { $0["kind"].string == "protein-warehouse" }?["products"].array ?? []
            let key = drinkName(notes)
            let named = products.compactMap { product -> (product: NativeJSON, name: String)? in
                let name = drinkName(product["name"].string)
                return !name.isEmpty && key.contains(name) ? (product, name) : nil
            }.sorted { $0.name.count > $1.name.count }
            let sole = products.count == 1 && notes.range(of: "唯一一款|仓库(?:里|中)的?(?:那款|这款)", options: .regularExpression) != nil
            let match = named.first.flatMap { first in named.dropFirst().first?.name.count == first.name.count ? nil : first.product }
            guard let product = match ?? (named.isEmpty && sole ? products.first : nil) else {
                pendingProteinPhotoPrompt = notes
                let detail = products.isEmpty ? "仓库暂时没有配方。拍一张包装营养表，核对后即可保存。"
                    : "请在指令里写上仓库中的完整品名。添加新产品时，可以直接拍包装营养表。"
                var steps: [ProteinOperationReceipt.Step] = [.init(area: .warehouse, result: .failed, detail: detail)]
                if makeDefault { steps.append(.init(area: .trainingDefault, result: .skipped, detail: "待核对产品后再设置。")) }
                if proteinDiaryIntent(notes) == .record {
                    steps.append(.init(area: .diary, result: .skipped, detail: "待核对产品后再记入饮食。"))
                } else if proteinDiaryIntent(notes) == .skip {
                    steps.append(contentsOf: recipeDiarySkipSteps(notes, day: nutritionDate ?? spotterDay()))
                }
                setProteinSteps(for: id, replacing: [.warehouse, .trainingDefault, .diary], steps: steps)
                return
            }
            let productID = try await commitProteinRecipe(product, makeDefault: makeDefault, operationID: id)
            busy = false
            await finishProteinRecipe(notes: notes, id: id, productID: productID)
        } catch {
            reportUnconfirmedProteinRecipe(id: id, makeDefault: makeDefault, notes: notes, reason: error)
        }
    }

    private func drinkName(_ name: String) -> String {
        name.precomposedStringWithCompatibilityMapping.lowercased().filter { $0.isLetter || $0.isNumber }
    }

    private func selectDrink(_ choice: KnownProtein, for request: SavedDrink) -> SavedDrink {
        var next = request
        next.productID = choice.id
        return next
    }

    private func clearDrink() {
        pendingDrink = nil; duplicateDrink = nil; drinkOptions = []; error = nil; text = ""
        persistConversation()
    }

    @discardableResult
    private func recordDrink(_ request: SavedDrink, showQuestion: Bool = true) async -> Bool {
        guard !busy, !showQuestion || canSendConversation() else { return false }
        busy = true; defer { busy = false }
        pendingDrink = request
        drinkOptions = []; duplicateDrink = nil; error = nil; text = ""
        persistConversation()
        do {
            var body: [String: Any] = ["action": "record-saved", "expectedOwner": owner, "text": request.text,
                                       "recordId": request.id, "localDate": request.day]
            if let id = request.productID { body["productId"] = id }
            if request.anotherCup { body["anotherCup"] = true }
            let data = try await api.request("/api/coach-protein", method: "POST", json: JSONSerialization.data(withJSONObject: body), for: owner)
            let reply = try JSONDecoder().decode(SavedDrinkReply.self, from: data)
            if showQuestion, lines.last?.content != request.text {
                lines.append(Line(role: "local-user", content: request.text))
            }
            if reply.status == "choose" {
                drinkOptions = reply.products ?? []
            } else if reply.status == "clarify" {
                setProteinSteps(for: request.id, replacing: [.diary], steps: [
                    .init(area: .diary, result: .failed, detail: reply.message ?? "请补充这杯的配方。")
                ])
            } else if reply.status == "complete", let records = reply.records, !records.isEmpty {
                var next = request
                next.productID = reply.productId
                lastDrink = next
                pendingDrink = nil
                let liquid = reply.liquidName ?? "冲泡液体"
                let portion = "每杯 \(coachAmount(reply.powderGrams ?? 0)) g 粉 · \(coachAmount(reply.liquidMl ?? 0)) mL \(liquid)"
                let steps = records.map { record -> ProteinOperationReceipt.Step in
                    if record.alreadyRecorded {
                        if records.count == 1 { duplicateDrink = next }
                        let source = record.linkedWorkout == nil ? "饮食记录" : "训练打卡"
                        return .init(area: .diary, result: .skipped, detail: "\(source)已有「\(record.entry.name)」。", date: record.date)
                    }
                    let meal = MealReceipt(id: record.id, date: record.date, draft: record.entry,
                                           meal: "加餐", updated: record.updated, recipeID: reply.productId)
                    let energy = coachAmount(record.entry.calories) + " 千卡"
                    return .init(area: .diary, result: .saved,
                                 detail: "\(record.entry.name) · \(energy)\n\(portion)", date: record.date, meal: meal)
                }
                setProteinSteps(for: request.id, replacing: [.diary], steps: steps)
                if records.contains(where: { !$0.alreadyRecorded }) { nutritionChanged() }
            } else {
                throw CocoaError(.coderReadCorrupt)
            }
            persistConversation()
            return true
        } catch {
            setProteinSteps(for: request.id, replacing: [.diary], steps: [
                .init(area: .diary, result: .unconfirmed, detail: "暂时无法核对保存结果。重试会沿用这一次记录。")
            ])
            if showQuestion, !lines.contains(where: { $0.role == "local-user" && $0.content == request.text }) {
                lines.insert(Line(role: "local-user", content: request.text), at: max(0, lines.count - 1))
            }
            await showRequestFailure(error)
            return false
        }
    }

    private func setProteinSteps(for id: String, replacing areas: Set<ProteinOperationReceipt.Area>,
                                 steps: [ProteinOperationReceipt.Step]) {
        if let index = lines.firstIndex(where: { $0.proteinReceipt?.id == id }), var receipt = lines[index].proteinReceipt {
            receipt.steps.removeAll { areas.contains($0.area) }
            receipt.steps.append(contentsOf: steps)
            lines[index].proteinReceipt = receipt
        } else if !steps.isEmpty {
            lines.append(Line(role: "status", content: "", proteinReceipt: .init(id: id, steps: steps)))
        }
    }

    private func asksToRevisePlan(_ input: String) -> Bool {
        let note = input.precomposedStringWithCompatibilityMapping.lowercased()
        guard note.range(of: "^(先不|暂时不|不|别|不用|为什么|怎么|如何|怎样|what|why|how)", options: .regularExpression) == nil else { return false }
        return note.range(of: "^(?:(?:请|能不能|可以|麻烦|帮我|给我|我想|我希望|想|把|将|这(?:次|个|份|套)(?:训练|计划|动作)?)[，, ]*)*(?:.*(?:换(?:成|为)|改(?:成|为|到)|替换|移到)|改一下|调整|取消|去掉|删掉|去除|加上|新增|增加|减掉|减少|缩短|延长|挪到|简单一点|轻松一点|短一点|change\\b|swap\\b|replace\\b|remove\\b|add\\b|adjust\\b|make it\\b|move\\b)", options: .regularExpression) != nil
    }

    private func trainingStats() async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let result = try await api.spotterRead("/api/workout", as: Activity.self)
            var calendar = Calendar(identifier: .gregorian)
            calendar.firstWeekday = 2
            let weekStart = calendar.dateInterval(of: .weekOfYear, for: .now)?.start ?? .now
            let records = result.entries.filter {
                $0.owner == owner && $0.kind == "log" && $0.day >= spotterDay(weekStart) && $0.day <= spotterDay()
            }
            let minutes = records.reduce(0) { $0 + $1.durationMinutes }
            let sets = records.reduce(0) { $0 + ($1.session?.completedSets ?? 0) }
            let summary = records.isEmpty ? "本周还没有已完成的训练。" : "本周完成 \(records.count) 次训练，累计 \(minutes) 分钟、\(sets) 组。"
            lines += [Line(role: "local-user", content: "看本周训练统计"), Line(role: "local", content: summary)]
        } catch { self.error = error.localizedDescription }
    }

    private func recordWeight() async {
        let input = cleanText.lowercased()
        let pounds = input.hasSuffix("lb") || input.hasSuffix("磅")
        let numeric = input.replacingOccurrences(of: "(kg|lb|公斤|磅)$", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard let weight = Double(numeric), weight.isFinite else { error = "请输入体重数字，可选 kg 或 lb。"; return }
        let kg = ((pounds ? weight * 0.45359237 : weight) * 100).rounded() / 100
        guard (10...700).contains(kg) else { error = "请核对体重或单位。"; return }
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        let date = spotterDay()
        let id = pendingWeight.flatMap { $0.date == date && $0.kg == kg ? $0.id : nil } ?? UUID().uuidString.lowercased()
        pendingWeight = (id, date, kg)
        do {
            try await api.spotterSend("/api/library", body: ["action": "save", "expectedOwner": owner,
                "data": ["kind": "nutrition", "id": id, "date": date, "entry": ["type": "weight", "kg": kg]]])
            lines += [Line(role: "local-user", content: cleanText),
                      Line(role: "status", content: "已记录体重 \(kg.formatted(.number.precision(.fractionLength(0...2)))) kg。")]
            text = ""; weightPrompt = false; editingMessage = false; pendingWeight = nil
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        } catch { self.error = error.localizedDescription }
    }

    private var planPreview: some View {
        VStack(alignment: .leading, spacing: 10) {
            messageTitle("calendar", "训练计划草稿")
            draftRows(planDrafts)
            coachPrimary("保存到我的训练计划") { Task { await savePlans() } }
            Button("在对话中调整草稿") {
                planMode = true
                editingMessage = true
            }
            .font(.footnote.weight(.semibold)).buttonStyle(.spotterPress).frame(minHeight: 44).disabled(busy || hasReachedLimit)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14).coachPanel()
    }

    private func draftRows(_ drafts: [PlanDraft]) -> some View {
        ForEach(drafts) { draft in
            let moves = draft.raw["exercises"].array
            SpotterDisclosure {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(Array(moves.enumerated()), id: \.offset) { _, move in
                        Text(planMoveSummary(move))
                            .font(.footnote).foregroundStyle(CoachColors.muted)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 3)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(draft.title).fontWeight(.semibold)
                    Text([draft.date, "\(moves.count) 个动作", "\(Int(draft.raw["minutes"].number)) 分钟"].joined(separator: " · "))
                        .font(.footnote).foregroundStyle(CoachColors.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func planMoveSummary(_ item: NativeJSON) -> String {
        let name = item["name"].string
        let sets = Int(item["sets"].number)
        let reps = Int(item["reps"].number)
        let seconds = Int(item["seconds"].number)
        let duration = seconds > 0 ? "\(seconds) 秒" : "\(reps) 次"
        let rest = item["restSeconds"] == .null ? "" : " · 休息 \(Int(item["restSeconds"].number)) 秒"
        return "\(name) · \(sets) 组 × \(duration)\(rest)"
    }

    private func coachPrimary(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.footnote.weight(.bold)).foregroundStyle(CoachColors.dark)
                .padding(.horizontal, 13).frame(minHeight: 44)
                .background(accent.fill, in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.spotterPress).disabled(busy)
    }

    private func mealPreview(_ draft: NativeMealDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            messageTitle("camera", draft.name, .orange)
            Text("估算 \(Int(draft.calories.rounded())) 千卡 · 蛋白质 \(Int(draft.protein.rounded())) 克")
                .font(.footnote).foregroundStyle(CoachColors.muted)
            Text("碳水 \(Int(draft.carbs.rounded())) 克 · 脂肪 \(Int(draft.fat.rounded())) 克")
                .font(.footnote).foregroundStyle(CoachColors.muted)
            SpotterMenuPicker("餐次", selection: $meal, options: mealOptions)
                .disabled(busy)
            coachPrimary("添加到\(meal)") { Task { await retryMeal(draft) } }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14).coachPanel()
    }

    private var ownAI: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    messageTitle("sparkles", "让你的 AI 起草或整理计划")
                    Text("把提示词发给常用的 AI，再导入生成的训练计划。")
                        .font(.subheadline).foregroundStyle(CoachColors.muted)
                    SpotterGlassSegments(options: ["起草新计划", "整理已有计划"], value: $ownPromptMode) { $0 }
                        .accessibilityLabel("AI 处理目标")
                    HStack {
                        Button("复制计划提示词") {
                            UIPasteboard.general.string = externalPrompt
                            ownNotice = "已复制。"
                        }
                        .buttonStyle(.spotterPrimaryControl).disabled(busy)
                        Button(ownPromptVisible ? "收起提示词" : "查看提示词") { ownPromptVisible.toggle() }
                            .buttonStyle(.spotterControl)
                    }
                    .spotterGlassCluster()
                    if ownPromptVisible {
                        Text(externalPrompt).font(.footnote.monospaced()).textSelection(.enabled)
                            .transition(panelTransition)
                    }
                    if let ownNotice { Text(ownNotice).font(.footnote).foregroundStyle(CoachColors.muted).transition(panelTransition) }
                }.padding(14).coachPanel()
                    .animation(controlMotion, value: ownPromptVisible)
                    .animation(controlMotion, value: ownNotice != nil)
                VStack(alignment: .leading, spacing: 10) {
                    messageTitle("list.bullet.clipboard", "粘贴已有内容")
                    coachPrimary("导入并核对计划") { showOwnImport = true }
                }.padding(14).coachPanel()
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var externalPrompt: String {
        let purpose = ownPromptMode == "起草新计划" ? "按我提供的目标、时间、器械和限制起草训练计划。" : "把我提供的训练笔记、计划或跟练链接整理成训练计划。"
        return """
        \(purpose)
        只返回一个含 1–20 堂课的 JSON 数组，保留原动作、单位、组次、休息和日期。未约定日期从 \(spotterDay()) 开始。重量未知填 0，单位是 kg 或 lb，计时动作使用秒。只有视频时保留原链接，exercises 留空。shared 保持 false。
        category 可选力量训练、有氧训练、拉伸恢复、跟练视频或其他。结构示例：
        [{"title":"上肢力量","date":"\(spotterDay())","category":"力量训练","minutes":45,"shared":false,"video":"","exercises":[{"name":"哑铃卧推","sets":3,"reps":8,"weight":0,"unit":"kg","seconds":0,"restSeconds":90}]}]
        """
    }

    private static let sharingDisabledMessage = "可在对话上方或「设置 → AI 教练」开启 AI 数据授权。"

    private func refreshQuota(ifUnknown: Bool = false) async {
        guard let result = try? await api.spotterRead("/api/ai-coach", as: QuotaResponse.self),
              let next = result.quota, !Task.isCancelled, !ifUnknown || quota == nil else { return }
        quota = next
    }

    private func showRequestFailure(_ reason: Error) async {
        error = reason.localizedDescription
        if (reason as? NativeAPIError)?.statusCode == 429 { await refreshQuota() }
    }

    private func canSendConversation() -> Bool {
        guard let message = quota?.limitMessage else { return true }
        error = message
        return false
    }

    private func submit(_ kind: RequestKind) {
        guard !busy, !cleanText.isEmpty || kind == .photo || kind == .guided, canSendConversation() else { return }
        editingMessage = false
        guard NativeCoachConsent.isAllowed(owner: owner) else {
            error = Self.sharingDisabledMessage
            return
        }
        Task { await send(kind) }
    }

    private func send(_ kind: RequestKind) async {
        guard !busy, NativeCoachConsent.isAllowed(owner: owner), canSendConversation() else { return }
        busy = true
        error = nil
        defer { busy = false }
        if kind == .photo {
            await recognize()
            return
        }
        let selection = kind == .guided ? guidedDraft : nil
        let user = Line(role: "user", content: selection == nil ? String(cleanText.prefix(4000)) : "请根据我选择的条件起草训练计划。")
        guard !user.content.isEmpty else { return }
        var context = Array((lines.filter { $0.role == "user" || $0.role == "assistant" } + [user]).suffix(9))
        while let first = context.first, first.role != "user" { context.removeFirst() }
        while context.count > 1 && context.reduce(0, { $0 + $1.content.utf16.count }) > 9000 { context.removeFirst(2) }
        let messages = (selection == nil ? context : [user]).map { ["role": $0.role, "content": $0.content] }
        let messageIndex = lines.count
        lines.append(Line(role: "local-user", content: user.content))
        text = ""
        do {
            let attachingPlans = selection == nil && includePlans
            var request: [String: Any] = [
                "expectedOwner": owner, "intent": kind == .chat ? "chat" : "draft",
                "model": "haiku", "date": selection?.date ?? (attachingPlans ? spotterDay(contextDate) : spotterDay()),
                "includePlans": attachingPlans, "messages": messages
            ]
            if attachingPlans { request["contextRange"] = contextRange }
            if let selection { request["guided"] = selection.values; request["draftDays"] = selection.days }
            if kind == .plan && !planDrafts.isEmpty {
                request["priorDraft"] = ["plans": planDrafts.map(\.data)]
                let dates = planDrafts.map(\.date).compactMap { nativePlanDate($0) }.sorted()
                if let first = dates.first, let last = dates.last, attachingPlans == false {
                    request["date"] = spotterDay(first)
                    request["draftDays"] = min(28, max(7, 1 + (Calendar.current.dateComponents([.day], from: first, to: last).day ?? 0)))
                }
            }
            let result = try await api.spotterSend("/api/ai-coach", body: request)
            if let next = (try? JSONDecoder().decode(QuotaResponse.self, from: result))?.quota { quota = next }
            guard let object = try JSONSerialization.jsonObject(with: result) as? [String: Any],
                  let reply = object["reply"] as? String else { throw CocoaError(.coderReadCorrupt) }
            lines[messageIndex] = user
            lines.append(Line(role: "assistant", content: reply))
            planMode = false
            guidedDraft = nil
            if let draft = object["draft"] as? [String: Any], let plans = draft["plans"] as? [[String: Any]] {
                let revised = plans.compactMap(PlanDraft.init(data:))
                if kind == .plan && !planDrafts.isEmpty {
                    let old = Set(planDrafts.map { $0.date + $0.title })
                    let moved = revised.filter { !old.contains($0.date + $0.title) }.count
                    let summary = moved == 0 ? "已更新草稿。请展开核对组次和休息时间。"
                        : "已调整 \(moved) 堂训练的日期或内容。确认后再保存。"
                    lines.append(Line(role: "local", content: summary))
                }
                planDrafts = revised
            }
        } catch { await showRequestFailure(error) }
    }

    private func attachMealPhoto(_ jpeg: Data) {
        picture = jpeg
        photoNeedsReply = false
        error = nil
    }

    private func clearMealPhoto() {
        picture = nil
        photoChoice = nil
        photoMealHistory = []
        photoNeedsReply = false
    }

    private func rememberMealTurn(_ content: String, role: String) {
        let bounded = String(decoding: content.utf16.prefix(300), as: UTF16.self)
        if photoMealHistory.count == 7 { photoMealHistory.remove(at: 1) }
        photoMealHistory.append(["role": role, "content": bounded])
    }

    private func recognize() async {
        guard let picture else { return }
        let input = cleanText
        let recipeNotes = [pendingProteinPhotoPrompt, input].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "，")
        if looksLikeProteinPhoto(recipeNotes) || pendingProteinPhotoPrompt != nil {
            await recognizeProtein(picture, notes: recipeNotes)
            return
        }
        if !input.isEmpty || photoMealHistory.last?["role"] != "user" {
            let initial = photoMealHistory.isEmpty
            let note = input.isEmpty ? (initial ? "请识别这张照片里的餐食。" : "请参考这张补充照片。") : input
            rememberMealTurn(note, role: "user")
            lines.append(Line(role: "local-user", content: initial ? "照片 · \(note)" : note))
        }
        text = ""
        photoNeedsReply = false
        var request: [String: Any] = [
            "expectedOwner": owner, "mode": "meal", "inCoach": true,
            "notes": photoMealHistory.last?["content"] ?? "",
            "image": ["mediaType": "image/jpeg", "base64": picture.base64EncodedString()]
        ]
        if photoMealHistory.count > 1 { request["mealHistory"] = Array(photoMealHistory.dropLast().suffix(6)) }
        do {
            let data = try await api.spotterSend("/api/food-photo", body: request)
            let answer = try JSONDecoder().decode(RecognizedMeal.self, from: data)
            if let next = answer.quota { quota = next }
            if let draft = answer.draft {
                mealDraft = draft
                mealEstimate = answer.estimate
                mealID = UUID().uuidString.lowercased()
                mealDate = nutritionDate ?? spotterDay()
                clearMealPhoto()
                persistConversation()
                try await saveMeal(draft)
            } else if let question = answer.needs?.first, !question.isEmpty {
                rememberMealTurn(question, role: "assistant")
                lines.append(Line(role: "meal", content: question))
                photoNeedsReply = true
            } else {
                error = answer.error ?? "这张照片暂时无法识别。可以重试或换一张照片。"
            }
        } catch { await showRequestFailure(error) }
    }

    private func looksLikeProteinPhoto(_ notes: String) -> Bool {
        notes.range(of: "蛋白粉|乳清|\\bwhey\\b", options: [.regularExpression, .caseInsensitive]) != nil &&
            notes.range(of: "仓库|入库|配方|包装|营养表|背标|训练默认", options: .regularExpression) != nil
    }

    private func proteinAmount(in text: String, pattern: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return Double(text[range])
    }

    private func recognizeProtein(_ image: Data, notes: String) async {
        do {
            let data = try await api.spotterSend("/api/food-photo", body: [
                "expectedOwner": owner, "mode": "protein", "inCoach": true,
                "image": ["mediaType": "image/jpeg", "base64": image.base64EncodedString()]
            ])
            let answer = try JSONDecoder().decode(ProteinPhotoReading.self, from: data)
            if let quota = answer.quota { self.quota = quota }
            let explicitDefault = requestsTrainingDefault(notes)
            var editor = NativeProteinRecipeEditor(makeDefault: explicitDefault)
            let label = answer.product
            editor.name = label?.name ?? ""
            for (key, value) in label?.per100g ?? [:] {
                editor.powder[key] = String(value)
            }
            let grams = proteinAmount(in: notes, pattern: "(?:按|约|为|重|是|一勺|每勺|1勺)\\s*(\\d+(?:\\.\\d+)?)\\s*(?:克|g)")
            if let scoop = grams ?? label?.scoopGrams {
                editor.scoop = String(scoop)
                editor.scoopEstimated = grams != nil && notes.contains("估")
            }
            if let ml = proteinAmount(in: notes, pattern: "(\\d+(?:\\.\\d+)?)\\s*(?:m\\s*l|毫升)") {
                editor.cup = String(ml)
            }
            if notes.contains("牛奶") || notes.contains("牛乳") {
                editor.usesMixer = true
                if notes.range(of: "2(?:\\.0)?\\s*%", options: .regularExpression) != nil {
                    editor.mixerName = "低脂牛奶（2%）"
                    editor.liquid = ["calories": "50", "protein": "3.3", "carbs": "4.8", "fat": "1.98"]
                } else if notes.contains("全脂") {
                    editor.mixerName = "全脂牛奶"
                    editor.liquid = ["calories": "61", "protein": "3.15", "carbs": "4.8", "fat": "3.25"]
                } else {
                    editor.mixerName = "牛奶"
                }
            }
            proteinPhotoNotes = notes
            proteinPhotoLogsDrink = proteinDiaryIntent(notes) == .record
            if let needs = answer.needs, !needs.isEmpty {
                lines.append(Line(role: "meal", content: needs.joined(separator: "\n")))
            }
            proteinPhotoID = UUID().uuidString.lowercased()
            proteinEditor = editor
            pendingProteinPhotoPrompt = nil
            lines.append(Line(role: "local-user", content: "照片 · " + notes))
            picture = nil; photoChoice = nil; text = ""
        } catch { await showRequestFailure(error) }
    }

    private func saveProteinRecipe(_ product: NativeJSON, makeDefault: Bool) async -> String? {
        let id = proteinPhotoID
        let notes = proteinPhotoNotes
        do {
            let productID = try await commitProteinRecipe(product, makeDefault: makeDefault, operationID: id)
            await finishProteinRecipe(notes: notes, id: id, productID: productID)
            return nil
        } catch {
            reportUnconfirmedProteinRecipe(id: id, makeDefault: makeDefault, notes: notes, reason: error)
            return error.localizedDescription
        }
    }

    private func commitProteinRecipe(_ product: NativeJSON, makeDefault: Bool, operationID: String) async throws -> String {
        let body = NativeJSON.object(["expectedOwner": .string(owner), "product": product, "addToWarehouse": .bool(true),
                                      "setTrainingDefault": .bool(makeDefault), "records": .array([])])
        let response = try await api.request("/api/coach-protein", method: "POST", json: JSONEncoder().encode(body), for: owner)
        let receipt = try JSONDecoder().decode(NativeJSON.self, from: response)
        let productID = receipt["warehouseProductId"].string
        let warehouse = receipt["warehouse"].string
        guard UUID(uuidString: productID) != nil, ["added", "existing"].contains(warehouse) else { throw NativeAPIError.invalidResponse }
        let name = product["name"].string
        var steps: [ProteinOperationReceipt.Step] = [
            .init(area: .warehouse, result: .saved, detail: warehouse == "added" ? "已加入「\(name)」。" : "已确认仓库中的「\(name)」。")
        ]
        if makeDefault {
            let done = receipt["defaultProductId"].string == productID
            steps.append(.init(area: .trainingDefault, result: done ? .saved : .failed,
                               detail: done ? "训练打卡将使用这份配方。" : "请在仓库补齐包装营养后再设为默认。"))
        }
        setProteinSteps(for: operationID, replacing: [.warehouse, .trainingDefault], steps: steps)
        nutritionChanged()
        return productID
    }

    private func finishProteinRecipe(notes: String, id: String, productID: String) async {
        let day = nutritionDate ?? spotterDay()
        switch proteinDiaryIntent(notes) {
        case .none:
            break
        case .skip:
            setProteinSteps(for: id, replacing: [.diary], steps: recipeDiarySkipSteps(notes, day: day))
        case .record:
            if notes.utf16.count <= 420 {
                let drink = SavedDrink(id: id, text: notes, day: day, productID: productID)
                _ = await recordDrink(drink, showQuestion: false)
            } else {
                setProteinSteps(for: id, replacing: [.diary], steps: [
                    .init(area: .diary, result: .failed, detail: "补记指令太长。请单独发一条消息说明日期、产品和份数。")
                ])
            }
        }
        persistConversation()
    }

    private func reportUnconfirmedProteinRecipe(id: String, makeDefault: Bool, notes: String, reason: Error) {
        let status = (reason as? NativeAPIError)?.statusCode
        let rejected = (status.map { 400..<500 ~= $0 } ?? false)
        let state: ProteinOperationReceipt.Result = rejected ? .failed : .unconfirmed
        var steps = [ProteinOperationReceipt.Step(area: .warehouse, result: state, detail: reason.localizedDescription)]
        if makeDefault { steps.append(.init(area: .trainingDefault, result: state, detail: "默认配方的保存尚未确认。")) }
        if proteinDiaryIntent(notes) == .record {
            steps.append(.init(area: .diary, result: .skipped, detail: "待仓库确认后再记入饮食。"))
        }
        setProteinSteps(for: id, replacing: [.warehouse, .trainingDefault, .diary], steps: steps)
    }

    private func retryMeal(_ draft: NativeMealDraft) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            try await saveMeal(draft)
        } catch { self.error = error.localizedDescription }
    }

    private func saveMeal(_ draft: NativeMealDraft) async throws {
        let data = try await api.spotterSend("/api/library", body: [
            "action": "save", "expectedOwner": owner, "revision": NSNull(),
            "data": ["kind": "nutrition", "id": mealID, "date": mealDate, "entry": draft.values(meal: meal)]
        ])
        let updated = try JSONDecoder().decode(NativeJSON.self, from: data)["updated"].string
        mealDraft = nil
        setReceipt(MealReceipt(id: mealID, date: mealDate, draft: draft, meal: meal, updated: updated, estimate: mealEstimate))
        mealEstimate = nil
        nutritionChanged()
        error = nil
    }

    private func setReceipt(_ receipt: MealReceipt, summary: String = "") {
        if updateProteinMeal(receipt.id, change: { step in
            step.meal = receipt
            step.detail = "\(receipt.draft.name) · \(coachAmount(receipt.draft.calories)) 千卡"
        }) { return }
        let line = Line(role: "status", content: summary, receipt: receipt)
        if let index = lines.firstIndex(where: { $0.receipt?.id == receipt.id }) { lines[index] = line }
        else { lines.append(line) }
    }

    private func updateProteinMeal(_ recordID: String, change: (inout ProteinOperationReceipt.Step) -> Void) -> Bool {
        guard let index = lines.firstIndex(where: { $0.proteinReceipt?.steps.contains { $0.meal?.id == recordID } == true }),
              var receipt = lines[index].proteinReceipt,
              let row = receipt.steps.firstIndex(where: { $0.meal?.id == recordID }) else { return false }
        change(&receipt.steps[row])
        lines[index].proteinReceipt = receipt
        return true
    }

    private func nutritionChanged() {
        persistConversation()
        NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
    }

    private func undoMeal(_ receipt: MealReceipt) async {
        guard !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            try await api.spotterSend("/api/library", body: [
                "action": "remove", "expectedOwner": owner, "kind": "nutrition", "id": receipt.id, "revision": receipt.updated
            ])
            if !updateProteinMeal(receipt.id, change: { step in
                step.result = .undone
                step.meal = nil
                step.detail = "已撤销「\(receipt.draft.name)」。"
            }), let index = lines.firstIndex(where: { $0.receipt?.id == receipt.id }) {
                lines[index] = Line(role: "local", content: "已撤销 \(receipt.date) 的「\(receipt.draft.name)」。")
            }
            nutritionChanged()
        } catch { self.error = error.localizedDescription }
    }

    private func receiptEditor(_ receipt: MealReceipt) -> some View {
        EditMealReceipt(receipt: receipt) { next in
            do {
                var item: [String: Any] = ["kind": "nutrition", "id": next.id, "date": next.date, "entry": next.draft.values(meal: next.meal)]
                if let recipe = next.recipeID { item["proteinProductId"] = recipe }
                let data = try await api.spotterSend("/api/library", body: [
                    "action": "save", "expectedOwner": owner, "revision": next.updated, "data": item
                ])
                var saved = next
                saved.updated = try JSONDecoder().decode(NativeJSON.self, from: data)["updated"].string
                setReceipt(saved)
                nutritionChanged()
                editingReceipt = nil
                return nil
            } catch { return error.localizedDescription }
        }
        .environment(\.colorScheme, surroundingColorScheme)
    }

    private struct EditMealReceipt: View {
        @Environment(\.dismiss) private var dismiss
        @State private var receipt: MealReceipt
        @State private var busy = false
        @State private var error: String?
        let save: (MealReceipt) async -> String?

        init(receipt: MealReceipt, save: @escaping (MealReceipt) async -> String?) {
            _receipt = State(initialValue: receipt)
            self.save = save
        }

        var body: some View {
            NavigationStack {
                Form {
                    Section(receipt.date) {
                        TextField("食物名称", text: $receipt.draft.name)
                        SpotterMenuPicker("餐次", selection: $receipt.meal, options: ["早餐", "午餐", "晚餐", "加餐"].map { ($0, $0) })
                        TextField("重量 g（可留空）", value: $receipt.draft.grams, format: .number).keyboardType(.decimalPad)
                    }
                    Section("这一份的营养") {
                        TextField("热量 千卡", value: $receipt.draft.calories, format: .number).keyboardType(.decimalPad)
                        TextField("蛋白质 g", value: $receipt.draft.protein, format: .number).keyboardType(.decimalPad)
                        TextField("碳水 g", value: $receipt.draft.carbs, format: .number).keyboardType(.decimalPad)
                        TextField("脂肪 g", value: $receipt.draft.fat, format: .number).keyboardType(.decimalPad)
                    }
                    if let error { Text(error).foregroundStyle(.red) }
                }
                .navigationTitle("编辑饮食记录")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(busy ? "保存中…" : "保存") {
                            Task {
                                busy = true
                                error = await save(receipt)
                                busy = false
                            }
                        }.disabled(busy || receipt.draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .interactiveDismissDisabled(busy).presentationDragIndicator(.visible)
        }
    }

    private func savePlans() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        let drafts = planDrafts
        do {
            for offset in stride(from: 0, to: drafts.count, by: 20) {
                let batch = drafts[offset..<min(offset + 20, drafts.count)]
                _ = try await api.spotterSend("/api/workout", body: [
                    "action": "plans", "expectedOwner": owner, "skipExisting": true,
                    "items": batch.map { ["id": $0.id, "data": $0.data] }
                ])
            }
            planDrafts = []; lines.append(Line(role: "status", content: "训练计划已保存。")); error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct CoachArt: View {
    let tile: Int
    let symbol: String
    let size: CGFloat

    var body: some View {
        Group {
            if let image = UIImage(named: "CoachQuestionnaireArt") {
                Image(uiImage: image).resizable().frame(width: size * 3, height: size * 3)
                    .offset(x: -CGFloat(tile % 3) * size, y: -CGFloat(tile / 3) * size)
            } else {
                Image(systemName: symbol).font(.title3).foregroundStyle(CoachColors.dark)
                    .frame(width: size, height: size)
            }
        }
        .frame(width: size, height: size, alignment: .topLeading)
        .background(Color(red: 0.94, green: 0.90, blue: 0.84))
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .accessibilityHidden(true)
    }
}

private struct CoachGuidedSelection {
    let date: String
    let days: Int
    let values: [String: Any]
}

@MainActor
private struct NativePlanQuestions: View {
    private struct Choice: Identifiable {
        let id: String
        let title: String
        let detail: String
        let symbol: String
        let tile: Int
    }
    private struct Move: Decodable, Identifiable, Sendable {
        let id: String
        let name: String
        let en: String
        var fields: [String: String] { ["name": name, "catalogueId": id] }
    }
    private struct Catalogue: Decodable, Sendable { let rows: [Move] }
    private struct Preset: Identifiable {
        var id: String { title }
        let title: String
        let work: [String]
        var warmup: [String] = ["4420", "3905", "3411", "1368"]
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @State private var goal: String
    @State private var venue = "gym"
    @State private var frequency = 3
    @State private var minutes = 45
    @State private var weeks = 1
    @State private var start = Date.now
    @State private var limits: Set<String> = []
    @State private var focus: Set<String> = []
    @State private var step = 0
    @State private var catalogue: [Move] = []
    @State private var loadingCatalogue = false
    @State private var catalogueError = false
    @State private var selectedPreset: String?
    @State private var work: [Move] = []
    @State private var warmup: [Move] = []
    @State private var editingWarmup = false
    @State private var choosingMove = false
    @State private var search = ""
    let completed: (CoachGuidedSelection) -> Void

    init(initialGoal: String?, completed: @escaping (CoachGuidedSelection) -> Void) {
        let inferred = switch initialGoal?.lowercased() ?? "" {
        case "strength", "力量", "提升力量": "strength"
        case "fat-loss", "减脂", "减重", "减脂期保持训练": "fat-loss"
        case "conditioning", "endurance", "体能", "心肺", "有氧": "conditioning"
        case "general", "记录训练", "习惯", "保持运动习惯": "general"
        default: "hypertrophy"
        }
        _goal = State(initialValue: inferred)
        self.completed = completed
    }

    private let labels = ["限制", "场景", "预设", "动作", "设置"]
    private let titles = ["有哪些动作想先避开？", "这次在哪里练？", "从一组动作开始", "调整候选动作", "设置训练目标与节奏"]
    private let details = ["可多选。只需选择本次想避开的动作。", "选择你能使用的器械和训练空间。",
                           "选一组 Spotter 动作，下一步可以自由增删。", "为正式训练和热身分别选动作。", "告诉教练你想练什么，以及每周能练多久。"]
    private let headerArt = [2, 4, 8, 6, 5]
    private let limitOptions = [
        Choice(id: "jumping", title: "跑跳与冲击", detail: "跑步、跳箱和类似的落地冲击", symbol: "figure.run", tile: 0),
        Choice(id: "overhead", title: "过头推举", detail: "将重量推举到头部上方", symbol: "figure.strengthtraining.traditional", tile: 1),
        Choice(id: "deep-knee", title: "深屈膝动作", detail: "需要明显弯曲膝盖的动作", symbol: "figure.walk", tile: 2),
        Choice(id: "heavy-hip-hinge", title: "重负荷髋铰链", detail: "大重量硬拉等动作", symbol: "dumbbell", tile: 3),
    ]
    private let venues = [
        Choice(id: "gym", title: "健身房", detail: "有器械、自由重量和训练凳", symbol: "dumbbell", tile: 4),
        Choice(id: "home", title: "家中基础器械", detail: "哑铃和一块可活动的空间", symbol: "house", tile: 5),
        Choice(id: "bodyweight", title: "自重", detail: "用自身体重训练", symbol: "figure.flexibility", tile: 6),
        Choice(id: "bands", title: "弹力带", detail: "以弹力带和徒手动作为主", symbol: "circle.grid.cross", tile: 7),
    ]
    private let goals = [("strength", "提升力量"), ("hypertrophy", "增肌"), ("fat-loss", "减脂期保持训练"),
                         ("conditioning", "提升体能"), ("general", "保持运动习惯")]
    private let focusChoices = [("chest", "胸部"), ("back", "背部"), ("shoulders", "肩部"), ("arms", "手臂"),
                                ("legs", "腿部"), ("glutes", "臀部"), ("core", "核心")]

    private var presets: [Preset] {
        switch venue {
        case "gym": [
            Preset(title: "器械全身", work: ["0576", "1350", "0739", "0198", "0585", "0463"], warmup: ["0798", "4420", "3905", "3411", "1368"]),
            Preset(title: "自由重量基础", work: ["0025", "3593", "0085", "0293", "0294", "0463"]),
        ]
        case "home": [
            Preset(title: "哑铃全身", work: ["3668", "0293", "1760", "1459", "3972", "0463"]),
            Preset(title: "哑铃与核心", work: ["3319", "6146", "1760", "0294", "6435", "0276"]),
        ]
        case "bands": [
            Preset(title: "弹力带全身", work: ["1004", "3896", "0915", "2154", "0894", "0463"], warmup: ["4420", "3905", "3411", "1368", "2151"]),
            Preset(title: "弹力带上身与核心", work: ["0930", "0915", "4063", "3511", "3776", "0276"], warmup: ["4420", "3905", "3411", "1368", "1503"]),
        ]
        default: [
            Preset(title: "徒手基础", work: ["3948", "3211", "6435", "3018", "0463", "1241"]),
            Preset(title: "低冲击与核心", work: ["3948", "3561", "0714", "0276", "1241", "3588"]),
        ]
        }
    }

    private var excluded: Set<String> {
        let exclusions = ["overhead": ["3972"], "deep-knee": ["0739", "0585", "3593", "1760", "3948", "1004"],
                          "heavy-hip-hinge": ["0085", "1459"]]
        return Set(limits.flatMap { exclusions[$0] ?? [] })
    }

    private var invalidStep: Bool {
        switch step {
        case 2: selectedPreset == nil
        case 3: work.isEmpty
        case 4: frequency * weeks > 12
        default: false
        }
    }

    private var stepMotion: Animation? {
        reduceMotion || systemReduceMotion ? nil : .easeInOut(duration: 0.22)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("问答定制训练计划").font(.headline)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").frame(width: 44, height: 44).contentShape(Rectangle())
                }.buttonStyle(.spotterPress).accessibilityLabel("关闭问答")
            }.padding(.horizontal, 16)
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("第 \(step + 1) 步 · \(labels[step])").font(.caption.weight(.semibold)).foregroundStyle(accent.fill)
                                Text(titles[step]).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                                Text(details[step]).font(.subheadline).foregroundStyle(CoachColors.muted)
                            }
                            Spacer(minLength: 0)
                            CoachArt(tile: headerArt[step], symbol: "list.clipboard", size: 65)
                        }
                        .foregroundStyle(CoachColors.text).padding(13)
                        .background(LinearGradient(colors: [CoachColors.dark, CoachColors.glow],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                                    in: RoundedRectangle(cornerRadius: 17))
                        .id("guide-top")
                        progress
                        ZStack(alignment: .topLeading) {
                            VStack(alignment: .leading, spacing: 12) { stepContents }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(step)
                                .transition(.opacity.combined(with: .offset(y: 6)))
                        }
                        .animation(stepMotion, value: step)
                    }.padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 14)
                }
                .onChange(of: step) { _ in
                    scroll.scrollTo("guide-top", anchor: .top)
                }
            }
            footer
        }
        .foregroundStyle(SpotterPalette.ink).background(SpotterPalette.background.ignoresSafeArea())
        .tint(accent.tint)
        .task { await loadCatalogue() }
        .sheet(isPresented: $choosingMove) { cataloguePicker.presentationDragIndicator(.visible) }
    }

    private var progress: some View {
        HStack(spacing: 5) {
            ForEach(labels.indices, id: \.self) { index in
                VStack(spacing: 4) {
                    Capsule().fill(step >= index ? accent.tint : SpotterPalette.line).frame(height: 4)
                    Text(labels[index]).font(.caption2).foregroundStyle(step == index ? SpotterPalette.ink : SpotterPalette.muted)
                }.frame(maxWidth: .infinity)
            }
        }.accessibilityHidden(true).animation(stepMotion, value: step)
    }

    @ViewBuilder
    private var stepContents: some View {
        switch step {
        case 0:
            ForEach(limitOptions) { item in
                choiceCard(item, selected: limits.contains(item.id)) {
                    if limits.contains(item.id) { limits.remove(item.id) } else { limits.insert(item.id) }
                    work.removeAll { excluded.contains($0.id) }
                    warmup.removeAll { excluded.contains($0.id) }
                }
            }
        case 1:
            ForEach(venues) { item in
                choiceCard(item, selected: venue == item.id) {
                    if venue != item.id { venue = item.id; resetPreset() }
                }
            }
        case 2: presetCards
        case 3: movements
        default: preferences
        }
    }

    private func choiceCard(_ item: Choice, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                CoachArt(tile: item.tile, symbol: item.symbol, size: 48)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.headline)
                    Text(item.detail).font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                Spacer(minLength: 4)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? accent.tint : SpotterPalette.muted)
            }.padding(10).guidePanel(accent: selected ? accent : nil)
        }
        .buttonStyle(.spotterPress).accessibilityAddTraits(selected ? .isSelected : [])
        .animation(stepMotion, value: selected)
    }

    private var presetCards: some View {
        VStack(alignment: .leading, spacing: 9) {
            if loadingCatalogue { ProgressView("正在读取动作库…") }
            if catalogueError {
                Button("重新读取动作库") { Task { await loadCatalogue() } }
                    .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.accent)
                    .transition(.opacity)
            }
            ForEach(presets) { preset in
                let candidates = moves(preset.work)
                let warm = moves(preset.warmup)
                if !candidates.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        choiceCard(Choice(id: preset.id, title: preset.title,
                                          detail: "\(candidates.count) 个正式动作 · \(warm.count) 个热身动作",
                                          symbol: "dumbbell", tile: 4), selected: selectedPreset == preset.id) {
                            selectedPreset = preset.id; work = candidates; warmup = warm
                        }
                        SpotterDisclosure("查看动作") {
                            Text((candidates + warm).map(\.name).joined(separator: " · ")).foregroundStyle(SpotterPalette.muted)
                        }
                        .font(.caption).padding(.horizontal, 10).padding(.bottom, 4)
                    }
                }
            }
            choiceCard(Choice(id: "own", title: "自选动作", detail: "从 Spotter 动作库加入你想用的动作",
                              symbol: "plus", tile: 8), selected: selectedPreset == "own") {
                resetPreset(); selectedPreset = "own"
            }
        }
        .animation(stepMotion, value: loadingCatalogue)
        .animation(stepMotion, value: catalogueError)
    }

    private var movements: some View {
        VStack(alignment: .leading, spacing: 10) {
            SpotterGlassSegments(options: [false, true], value: $editingWarmup) {
                $0 ? "热身动作（\(warmup.count)）" : "正式动作（\(work.count)）"
            }
            .accessibilityLabel("动作类别")
            Button { search = ""; choosingMove = true } label: {
                Label("从动作库添加", systemImage: "plus").font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, 11)
                    .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.spotterPress).disabled((editingWarmup ? warmup : work).count >= 24)
            ForEach(editingWarmup ? warmup : work) { move in
                HStack {
                    Label(move.name, systemImage: "dumbbell")
                    Spacer()
                    Button {
                        if editingWarmup { warmup.removeAll { $0.id == move.id } } else { work.removeAll { $0.id == move.id } }
                    } label: { Image(systemName: "trash").frame(width: 44, height: 44) }
                    .buttonStyle(.spotterPress)
                    .accessibilityLabel("移除 \(move.name)")
                }.padding(.horizontal, 9).padding(.vertical, 4).guidePanel()
                    .transition(.opacity.combined(with: .offset(y: 5)))
            }
            if work.isEmpty { Text("至少加入一个正式动作。").font(.caption).foregroundStyle(SpotterPalette.muted) }
        }
        .animation(stepMotion, value: editingWarmup)
        .animation(stepMotion, value: (editingWarmup ? warmup : work).map(\.id))
    }

    private var preferences: some View {
        VStack(alignment: .leading, spacing: 12) {
            SpotterMenuPicker("训练目标", selection: $goal, options: goals)
            Stepper(value: $frequency, in: 1...7) {
                Text("每周训练 \(frequency) 天").contentTransition(.numericText()).animation(stepMotion, value: frequency)
            }
            Stepper(value: $minutes, in: 15...120, step: 5) {
                Text("每次最多 \(minutes) 分钟").contentTransition(.numericText()).animation(stepMotion, value: minutes)
            }
            SpotterMenuPicker("训练周数", selection: $weeks, options: [1, 2, 4].map { ($0, "\($0) 周") })
            DatePicker("开始日期", selection: $start, displayedComponents: .date)
            Text("重点部位").font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 65))], spacing: 7) {
                ForEach(focusChoices, id: \.0) { item in
                    let selected = focus.contains(item.0)
                    Button {
                        if selected { focus.remove(item.0) } else { focus.insert(item.0) }
                    } label: {
                        Text(item.1).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SpotterGlassChoiceStyle(selected: selected, horizontalPadding: 4))
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .animation(stepMotion, value: selected)
                }
            }
            .spotterGlassCluster()
            if frequency * weeks > 12 {
                Text("每份草稿最多 12 堂，请减少周数或每周次数。").font(.caption).foregroundStyle(.red).transition(.opacity)
            }
        }.padding(12).guidePanel()
            .animation(stepMotion, value: frequency * weeks > 12)
    }

    private var footer: some View {
        HStack(spacing: 8) {
            if step > 0 {
                Button { step -= 1 } label: {
                    Label("上一步", systemImage: "chevron.left")
                }
                .buttonStyle(.spotterControl)
                .transition(.opacity.combined(with: .offset(x: 4)))
            }
            Button {
                if step < 4 { step += 1 }
                else {
                    completed(CoachGuidedSelection(date: spotterDay(start), days: weeks * 7,
                        values: ["limits": limits.sorted(), "scene": venue, "goal": goal, "focus": focus.sorted(),
                                 "daysPerWeek": frequency, "minutes": minutes,
                                 "work": work.map(\.fields), "warmup": warmup.map(\.fields)]))
                }
            } label: {
                Text(step == 4 ? "生成计划草稿" : "下一步").frame(maxWidth: .infinity)
            }
            .buttonStyle(.spotterPrimaryControl).disabled(invalidStep)
        }
        .spotterGlassCluster()
        .padding(.horizontal, 16).padding(.bottom, 10)
        .animation(stepMotion, value: step > 0)
    }

    private var cataloguePicker: some View {
        NavigationStack {
            List {
                if catalogueError {
                    Button("重新读取动作库") { Task { await loadCatalogue() } }.foregroundStyle(SpotterPalette.accent)
                }
                ForEach(catalogue.filter { move in
                    !excluded.contains(move.id) && !(editingWarmup ? warmup : work).contains { $0.id == move.id }
                        && (search.isEmpty || move.name.localizedCaseInsensitiveContains(search) || move.en.localizedCaseInsensitiveContains(search))
                }.prefix(80)) { move in
                    Button {
                        if editingWarmup { warmup.append(move) } else { work.append(move) }
                        choosingMove = false
                    } label: {
                        HStack {
                            Text(move.name)
                            Spacer(minLength: 7)
                            Image(systemName: "plus.circle").foregroundStyle(SpotterPalette.accent)
                        }.contentShape(Rectangle())
                    }
                }
            }
            .buttonStyle(.spotterPress)
            .searchable(text: $search, prompt: "搜索动作")
            .navigationTitle("动作库")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { choosingMove = false } label: { Image(systemName: "xmark").frame(width: 38, height: 44) }
                        .buttonStyle(.spotterPress).accessibilityLabel("关闭")
                }
            }
        }
    }

    private func moves(_ ids: [String]) -> [Move] {
        let byID = Dictionary(catalogue.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return ids.filter { !excluded.contains($0) }.compactMap { byID[$0] }
    }

    private func resetPreset() { selectedPreset = nil; work = []; warmup = [] }

    private func loadCatalogue() async {
        guard !loadingCatalogue, catalogue.isEmpty else { return }
        loadingCatalogue = true
        catalogueError = false
        defer { loadingCatalogue = false }
        do {
            catalogue = try await Task.detached(priority: .utility) {
                guard let url = Bundle.main.url(forResource: "index", withExtension: "json") else {
                    throw CocoaError(.fileNoSuchFile)
                }
                return try JSONDecoder().decode(Catalogue.self, from: Data(contentsOf: url)).rows
            }.value
        } catch is CancellationError { return }
        catch { catalogueError = true }
    }
}

private func coachImage(_ input: Data) -> Data? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithData(input as CFData, sourceOptions),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceCreateThumbnailWithTransform: true,
              kCGImageSourceThumbnailMaxPixelSize: 1536
          ] as CFDictionary) else { return nil }
    let output = NSMutableData()
    guard let encoder = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(encoder, image, [kCGImageDestinationLossyCompressionQuality: 0.72] as CFDictionary)
    return CGImageDestinationFinalize(encoder) && output.length <= 1_800_000 ? output as Data : nil
}

private struct NativeFoodCamera: UIViewControllerRepresentable {
    let complete: (Data?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(complete) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let camera = UIImagePickerController()
        camera.sourceType = .camera
        camera.delegate = context.coordinator
        return camera
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let complete: (Data?) -> Void
        init(_ complete: @escaping (Data?) -> Void) { self.complete = complete }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { complete(nil) }
        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            complete((info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.9))
        }
    }
}
