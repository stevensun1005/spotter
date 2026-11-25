import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

private struct NativeMealDraft: Codable {
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

        var note: String {
            "今日剩余 \(dailyRemaining.formatted())/\(dailyLimit.formatted()) 次 · 本月剩余 \(monthlyRemaining.formatted())/\(monthlyLimit.formatted()) 次"
        }

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

    private struct Line {
        let role: String
        let content: String
    }
    private struct PlanDraft: Identifiable {
        let id = UUID().uuidString.lowercased()
        let data: [String: Any]
        var title: String { data["title"] as? String ?? "训练" }
        var date: String { data["date"] as? String ?? spotterDay() }
        var exerciseNames: [String] {
            (data["exercises"] as? [[String: Any]])?.compactMap { $0["name"] as? String } ?? []
        }
    }
    private struct RecognizedMeal: Decodable {
        var draft: NativeMealDraft?
        var needs: [String]?
        var error: String?
        var quota: Quota?
    }
    private enum RequestKind {
        case chat
        case plan
        case photo
        case guided
    }
    private enum Mode { case coach, own }
    private struct Activity: Decodable { let entries: [NativeWorkoutEntry] }

    let api: NativeAPI
    let owner: String
    var compact = true
    var onExpand: (() -> Void)? = nil
    var onStartWorkout: (() -> Void)? = nil
    let nutritionDate: String?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.spotterReduceMotion) private var reduceMotion
    @Environment(\.spotterInteractionMotion) private var controlMotion
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
    @State private var picture: Data?
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

    init(api: NativeAPI, owner: String, compact: Bool = true, onExpand: (() -> Void)? = nil,
         onStartWorkout: (() -> Void)? = nil, initialMeal: String? = nil, nutritionDate: String? = nil) {
        self.api = api
        self.owner = owner
        self.compact = compact
        self.onExpand = onExpand
        self.onStartWorkout = onStartWorkout
        self.nutritionDate = nutritionDate
        _sharingAllowed = AppStorage(wrappedValue: false, NativeCoachConsent.key(owner))
        _meal = State(initialValue: initialMeal ?? "加餐")
    }

    private var cleanText: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var reducesMotion: Bool { reduceMotion || systemReduceMotion }
    private var panelTransition: AnyTransition { reducesMotion ? .identity : .opacity.combined(with: .offset(y: 6)) }
    private var showsOptions: Bool { showOptions && picture == nil && !weightPrompt }
    private var showsSuggestions: Bool {
        !showsOptions && picture == nil && !weightPrompt && mealDraft == nil && !editingMessage && cleanText.isEmpty
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
        .task(id: owner) { await refreshQuota(ifUnknown: true) }
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
                    picture = jpeg
                    error = nil
                } catch { self.error = "相册暂时无法读取这张照片。" }
            }
        }
        .fullScreenCover(isPresented: $camera) {
            NativeFoodCamera { data in
                camera = false
                if let data { picture = coachImage(data); error = picture == nil ? "无法读取这张照片。" : nil }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGuide, onDismiss: {
            if sendGuidedAfterClosing { sendGuidedAfterClosing = false; submit(.guided) }
        }) {
            NativePlanQuestions { draft in
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
                .frame(width: 42, height: 44).contentShape(Rectangle())
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
        VStack(spacing: 0) {
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
                        if let error { message(Line(role: "error", content: error)).transition(panelTransition) }
                        if busy {
                            ProgressView("教练正在回复").font(.footnote).tint(accent.fill)
                                .padding(.vertical, 6).transition(.opacity)
                        }
                        Color.clear.frame(height: 1).id("latest")
                    }
                    .padding(.horizontal, 20).padding(.top, compact ? 14 : 24).padding(.bottom, 14)
                    .animation(controlMotion, value: lines.count)
                    .animation(controlMotion, value: busy)
                    .animation(controlMotion, value: sharingAllowed)
                    .animation(controlMotion, value: planDrafts.isEmpty)
                    .animation(controlMotion, value: mealDraft == nil)
                    .animation(controlMotion, value: error != nil)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: lines.count) { _ in scrollToLatest(proxy) }
                .onChange(of: busy) { _ in scrollToLatest(proxy) }
                .onChange(of: error) { _ in scrollToLatest(proxy) }
            }
            composer
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy) {
        withAnimation(reducesMotion ? nil : .easeOut(duration: 0.18)) {
            proxy.scrollTo("latest", anchor: .bottom)
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
        lines = []; planDrafts = []; mealDraft = nil; error = nil; text = ""; picture = nil
        photoChoice = nil; planMode = false; weightPrompt = false; pendingWeight = nil; guidedDraft = nil
        includePlans = false; showOptions = false; copiedReply = nil; editingMessage = false
    }

    @ViewBuilder
    private func message(_ line: Line, index: Int? = nil) -> some View {
        if line.role == "user" || line.role == "local-user" {
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
                        .clipShape(RoundedRectangle(cornerRadius: 9)).accessibilityLabel("待发送的餐食照片")
                    SpotterMenuPicker("记入餐次", selection: $meal, options: mealOptions) {
                        HStack(spacing: 5) {
                            Text(meal).lineLimit(1)
                            Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                        }
                        .frame(minHeight: 44)
                    }
                    Spacer()
                    Button { self.picture = nil; photoChoice = nil } label: {
                        Image(systemName: "xmark").fontWeight(.semibold).frame(width: 38, height: 38)
                            .spotterGlass(cornerRadius: 19, interactive: !reducesMotion)
                            .frame(width: 44, height: 44).contentShape(Rectangle())
                    }.buttonStyle(.spotterPress).disabled(busy).accessibilityLabel("移除照片")
                }.font(.footnote).padding(8).coachPanel().transition(panelTransition)
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
            if let quota {
                Text(quota.note).font(.caption2).foregroundStyle(CoachColors.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
                if let message = quota.limitMessage {
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
        }
        .padding(.horizontal, 16).padding(.top, 5).padding(.bottom, 8)
        .animation(controlMotion, value: showsOptions)
        .animation(controlMotion, value: showsSuggestions)
        .animation(controlMotion, value: showsContextChip)
        .animation(controlMotion, value: picture != nil)
        .animation(controlMotion, value: planMode || weightPrompt)
        .animation(controlMotion, value: quota != nil)
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
            TextField(composerHint, text: $text, axis: .vertical)
                .focused($editingMessage)
                .lineLimit(1...4)
                .textFieldStyle(.plain)
                .font(.body)
                .padding(.leading, 12)
                .padding(.vertical, 8)
                .disabled(busy)
                .accessibilityIdentifier("coach-composer")
            Button { sendComposer() } label: {
                let ready = picture != nil || !cleanText.isEmpty
                if picture != nil {
                    Text("识别并记餐").font(.footnote.weight(.bold)).padding(.horizontal, 11).frame(minHeight: 36)
                        .foregroundStyle(CoachColors.dark).background(accent.fill, in: Capsule())
                        .transition(.opacity)
                } else {
                    Image(systemName: "arrow.up").font(.body.weight(.semibold)).frame(width: 40, height: 38)
                        .foregroundStyle(ready ? CoachColors.dark : CoachColors.muted.opacity(0.7))
                        .background(ready ? accent.fill : .white.opacity(0.06), in: RoundedRectangle(cornerRadius: 13))
                        .accessibilityLabel("发送消息")
                        .transition(.opacity)
                }
            }.buttonStyle(.spotterPress).accessibilityIdentifier("coach-send")
                .disabled(busy || hasReachedLimit || (picture == nil && cleanText.isEmpty))
        }
        .padding(4).frame(minHeight: 48)
        .background(LinearGradient(colors: [CoachColors.indigo.opacity(0.54), CoachColors.dark, CoachColors.ocean.opacity(0.67)],
                                   startPoint: .leading, endPoint: .trailing), in: shape)
        .overlay(shape.strokeBorder(LinearGradient(colors: [CoachColors.pearl.opacity(editingMessage ? 0.53 : 0.30),
                                                           accent.fill.opacity(editingMessage ? 0.40 : 0.12), CoachColors.border],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing)).allowsHitTesting(false))
        .animation(controlMotion, value: editingMessage)
        .animation(controlMotion, value: cleanText.isEmpty)
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
        }
        .accessibilityLabel("推荐回复").accessibilityIdentifier("coach-suggestions")
    }

    private func suggestion(_ title: String, icon: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).accessibilityHidden(true) }
                Text(title).fixedSize()
            }
            .font(.footnote.weight(.semibold)).foregroundStyle(CoachColors.dark)
            .padding(.horizontal, 12).padding(.vertical, 6).frame(minHeight: 36)
            .background(CoachColors.pearl, in: RoundedRectangle(cornerRadius: 13))
            .padding(.vertical, 4).contentShape(Rectangle())
        }.buttonStyle(.spotterPress).disabled(busy || hasReachedLimit)
    }

    private func sendSuggestedReply(_ reply: String) {
        guard !busy else { return }
        text = reply
        sendComposer()
    }

    private var composerHint: String {
        if picture != nil { return "例如 200 mL 牛奶、1 勺蛋白粉" }
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
        guard canSendConversation() else { return }
        let input = cleanText
        if picture != nil { submit(.photo); return }
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
        } else { submit(planMode ? .plan : .chat) }
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
            VStack(alignment: .leading, spacing: 4) {
                Text(draft.title).fontWeight(.semibold)
                Text(([draft.date] + draft.exerciseNames).joined(separator: " · "))
                    .font(.footnote).foregroundStyle(CoachColors.muted)
            }
        }
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
                    Picker("AI 处理目标", selection: $ownPromptMode) {
                        Text("起草新计划").tag("起草新计划")
                        Text("整理已有计划").tag("整理已有计划")
                    }.pickerStyle(.segmented)
                    HStack {
                        coachPrimary("复制计划提示词") {
                            UIPasteboard.general.string = externalPrompt
                            ownNotice = "已复制。"
                        }
                        Button(ownPromptVisible ? "收起提示词" : "查看提示词") { ownPromptVisible.toggle() }
                            .buttonStyle(.spotterPress).font(.footnote.weight(.semibold)).frame(minHeight: 44)
                    }
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
        do {
            let attachingPlans = selection == nil && includePlans
            var request: [String: Any] = [
                "expectedOwner": owner, "intent": kind == .chat ? "chat" : "draft",
                "model": "haiku", "date": selection?.date ?? (attachingPlans ? spotterDay(contextDate) : spotterDay()),
                "includePlans": attachingPlans, "messages": messages
            ]
            if attachingPlans { request["contextRange"] = contextRange }
            if let selection { request["guided"] = selection.values; request["draftDays"] = selection.days }
            if kind == .plan && !planDrafts.isEmpty { request["priorDraft"] = ["plans": planDrafts.map(\.data)] }
            let result = try await api.spotterSend("/api/ai-coach", body: request)
            if let next = (try? JSONDecoder().decode(QuotaResponse.self, from: result))?.quota { quota = next }
            guard let object = try JSONSerialization.jsonObject(with: result) as? [String: Any],
                  let reply = object["reply"] as? String else { throw CocoaError(.coderReadCorrupt) }
            lines += [user, Line(role: "assistant", content: reply)]
            text = ""
            planMode = false
            guidedDraft = nil
            if let draft = object["draft"] as? [String: Any], let plans = draft["plans"] as? [[String: Any]] {
                planDrafts = plans.map { PlanDraft(data: $0) }
            }
        } catch { await showRequestFailure(error) }
    }

    private func recognize() async {
        guard let picture else { return }
        do {
            let data = try await api.spotterSend("/api/food-photo", body: [
                "expectedOwner": owner, "mode": "meal", "inCoach": true, "notes": String(cleanText.prefix(300)),
                "image": ["mediaType": "image/jpeg", "base64": picture.base64EncodedString()]
            ])
            let answer = try JSONDecoder().decode(RecognizedMeal.self, from: data)
            if let next = answer.quota { quota = next }
            if let draft = answer.draft {
                mealDraft = draft
                mealID = UUID().uuidString.lowercased()
                mealDate = nutritionDate ?? spotterDay()
                lines.append(Line(role: "local-user", content: cleanText.isEmpty ? "照片 · 拍照记饮食" : "照片 · \(cleanText)"))
                self.picture = nil
                photoChoice = nil
                text = ""
                try await saveMeal(draft)
            } else {
                error = answer.error ?? answer.needs?.joined(separator: "；") ?? "请补充食物和份量，再试一次。"
            }
        } catch { await showRequestFailure(error) }
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
        try await api.spotterSend("/api/library", body: [
            "action": "save", "expectedOwner": owner,
            "data": ["kind": "nutrition", "id": mealID, "date": mealDate, "entry": draft.values(meal: meal)]
        ])
        mealDraft = nil
        lines.append(Line(role: "status", content: "已把「\(draft.name)」记入\(meal)。"))
        NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
        error = nil
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
    @State private var goal = "hypertrophy"
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
            Picker("动作类别", selection: $editingWarmup) {
                Text("正式动作（\(work.count)）").tag(false)
                Text("热身动作（\(warmup.count)）").tag(true)
            }.pickerStyle(.segmented)
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
                        Text(item.1).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 44)
                            .background(selected ? accent.fill : SpotterPalette.wash, in: Capsule())
                            .foregroundStyle(selected ? SpotterPalette.deep : SpotterPalette.ink)
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .animation(stepMotion, value: selected)
                }
            }
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
                    Label("上一步", systemImage: "chevron.left").font(.footnote.weight(.semibold))
                        .padding(.horizontal, 11).frame(minHeight: 44)
                        .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.spotterPress)
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
                Text(step == 4 ? "生成计划草稿" : "下一步").font(.subheadline.weight(.bold))
                    .foregroundStyle(SpotterPalette.deep).frame(maxWidth: .infinity, minHeight: 44)
                    .background(accent.fill.opacity(invalidStep ? 0.45 : 1), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.spotterPress).disabled(invalidStep)
        }
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
