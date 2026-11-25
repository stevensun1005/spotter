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

    private static func key(_ owner: String) -> String { "spotter.native.coach.consent." + owner }
}

private enum CoachColors {
    static let canvas = Color(red: 0.08, green: 0.125, blue: 0.102)
    static let panel = Color(red: 0.125, green: 0.18, blue: 0.145)
    static let accent = Color(red: 0.82, green: 0.96, blue: 0.48)
    static let dark = Color(red: 0.094, green: 0.145, blue: 0.114)
    static let text = Color(red: 0.94, green: 0.96, blue: 0.93)
    static let muted = Color(red: 0.69, green: 0.75, blue: 0.70)
    static let border = Color(red: 0.23, green: 0.32, blue: 0.27)
    static let choice = Color(red: 0.17, green: 0.27, blue: 0.20)
    static let glow = Color(red: 0.18, green: 0.30, blue: 0.22)
    static let error = Color(red: 1, green: 0.72, blue: 0.70)
    static let guideCanvas = Color(red: 0.95, green: 0.96, blue: 0.93)
    static let guideText = Color(red: 0.106, green: 0.157, blue: 0.125)
    static let guideMuted = Color(red: 0.35, green: 0.40, blue: 0.37)
    static let guideBorder = Color(red: 0.88, green: 0.91, blue: 0.87)
    static let guideSelected = Color(red: 0.92, green: 0.96, blue: 0.85)
    static let guideAccent = Color(red: 0.32, green: 0.43, blue: 0.23)
}

private extension View {
    func coachPanel(_ fill: Color = CoachColors.panel, radius: CGFloat = 16) -> some View {
        background(fill, in: RoundedRectangle(cornerRadius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(CoachColors.border, lineWidth: 1))
    }

    func guidePanel(selected: Bool = false) -> some View {
        background(selected ? CoachColors.guideSelected : .white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16)
                .strokeBorder(selected ? CoachColors.guideAccent : CoachColors.guideBorder, lineWidth: 1))
    }
}

@MainActor
struct NativeCoachView: View {
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
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @FocusState private var editingMessage: Bool
    @State private var lines: [Line] = []
    @State private var text = ""
    @State private var error: String?
    @State private var busy = false
    @State private var planDrafts: [PlanDraft] = []
    @State private var mealDraft: NativeMealDraft?
    @State private var mealID = UUID().uuidString.lowercased()
    @State private var mealDate = ""
    @State private var picture: Data?
    @State private var photoChoice: PhotosPickerItem?
    @State private var camera = false
    @State private var showGuide = false
    @State private var consentNeeded = false
    @State private var planMode = false
    @State private var pendingRequest: RequestKind?
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
    @State private var ownInput = ""
    @State private var ownNotice: String?
    @State private var ownDrafts: [PlanDraft] = []

    private var cleanText: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(spacing: 0) {
            header
            if mode == .coach { conversation }
            else { ownAI }
        }
        .foregroundStyle(CoachColors.text)
        .tint(CoachColors.accent)
        .background {
            CoachColors.canvas.overlay(alignment: .topTrailing) {
                RadialGradient(colors: [CoachColors.glow, .clear], center: .topTrailing, startRadius: 12, endRadius: 365)
            }.ignoresSafeArea()
        }
        .toolbar(.hidden, for: .navigationBar)
        .environment(\.colorScheme, .dark)
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
        .confirmationDialog("允许 AI 教练处理内容？", isPresented: $consentNeeded, titleVisibility: .visible) {
            Button("允许并继续") {
                NativeCoachConsent.allow(owner: owner)
                if let kind = pendingRequest { Task { await send(kind) } }
                pendingRequest = nil
            }
            Button("查看隐私说明") {
                pendingRequest = nil
                if let url = URL(string: AppConfiguration.defaultOrigin + "/privacy#external-ai") { openURL(url) }
            }
            Button("取消", role: .cancel) { pendingRequest = nil }
        } message: {
            Text("你发送的对话、选中的照片和训练资料会交由外部 AI 服务处理。授权可在设置中撤销。")
        }
    }

    private var header: some View {
        HStack(spacing: 7) {
            Button { onExpand?() } label: {
                Capsule().fill(CoachColors.muted).frame(width: 25, height: 5).frame(width: 34, height: 36)
            }
            .buttonStyle(.plain)
            .disabled(onExpand == nil)
            .accessibilityLabel("展开 AI 教练")
            .simultaneousGesture(DragGesture(minimumDistance: 16).onEnded { drag in
                if drag.translation.height < -26 { onExpand?() }
            })
            HStack(spacing: 3) {
                modeButton("站内 AI", .coach)
                modeButton("用自己的 AI", .own)
            }
            .padding(3).coachPanel(CoachColors.dark, radius: 13)
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 17, weight: .medium)).frame(width: 36, height: 40)
            }
            .buttonStyle(.plain).foregroundStyle(CoachColors.muted).accessibilityLabel("关闭 AI 教练")
        }
        .padding(.horizontal, 14).padding(.vertical, 6)
        .overlay(alignment: .bottom) { Rectangle().fill(CoachColors.border).frame(height: 1) }
    }

    private func modeButton(_ title: String, _ item: Mode) -> some View {
        Button {
            mode = item
            editingMessage = false
        } label: {
            Text(title).font(.subheadline.weight(.bold)).frame(maxWidth: .infinity, minHeight: 35)
                .foregroundStyle(mode == item ? CoachColors.dark : CoachColors.muted)
                .background(mode == item ? CoachColors.accent : .clear, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(mode == item ? .isSelected : [])
    }

    private var conversation: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if lines.isEmpty && mealDraft == nil { welcome }
                        else { newConversation }
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in message(line) }
                        if !planDrafts.isEmpty { planPreview }
                        if let draft = mealDraft { mealPreview(draft) }
                        if let error { message(Line(role: "error", content: error)) }
                        if busy { ProgressView("教练正在回复").font(.footnote).tint(CoachColors.accent).padding(.vertical, 6) }
                        Color.clear.frame(height: 1).id("latest")
                    }
                    .padding(.horizontal, 16).padding(.vertical, 11)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: lines.count) { _ in scrollToLatest(proxy) }
                .onChange(of: busy) { _ in scrollToLatest(proxy) }
            }
            composer
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.18)) { proxy.scrollTo("latest", anchor: .bottom) }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("今天想怎么练？").font(compact ? .headline : .title2.bold())
                    Text(compact ? "在这里记体重、查训练统计，或者一起排训练。" : "问一个训练问题，或一起制定计划。")
                        .font(.subheadline).foregroundStyle(CoachColors.muted)
                }
                Spacer(minLength: 0)
                if !compact { CoachArt(tile: 8, symbol: "figure.strengthtraining.traditional", size: 66) }
            }
            .padding(13).frame(maxWidth: .infinity, alignment: .leading).coachPanel(CoachColors.choice)
            if !compact {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    taskCard("生成计划", "calendar", .green) { openGuide() }
                    taskCard("拍照记饮食", "camera", .orange) { showPhotoHelp() }
                    taskCard("训练统计", "chart.bar", .cyan) { Task { await trainingStats() } }
                    taskCard("记体重", "scalemass", .purple) { askWeight() }
                    if let onStartWorkout { taskCard("开始训练", "dumbbell", .green, action: onStartWorkout) }
                }
            }
        }
    }

    private func taskCard(_ title: String, _ icon: String, _ tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.body.weight(.semibold))
                    .foregroundStyle(CoachColors.text).frame(width: 34, height: 34)
                    .background(tint.opacity(0.24), in: RoundedRectangle(cornerRadius: 9))
                Text(title).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(9).frame(minHeight: 51).coachPanel()
        }.buttonStyle(.plain).disabled(busy)
    }

    private var newConversation: some View {
        Button {
            lines = []; planDrafts = []; mealDraft = nil; error = nil; text = ""; picture = nil
            photoChoice = nil; planMode = false; weightPrompt = false; pendingWeight = nil; guidedDraft = nil
            includePlans = false; showOptions = false
        } label: {
            quickLabel("新对话", "plus.message")
        }
        .buttonStyle(.plain).disabled(busy).frame(maxWidth: .infinity, alignment: .trailing)
    }

    @ViewBuilder
    private func message(_ line: Line) -> some View {
        if line.role == "user" || line.role == "local-user" {
            HStack {
                Spacer(minLength: 42)
                Text(line.content).font(.subheadline).lineSpacing(4).textSelection(.enabled)
                    .padding(.vertical, 10).padding(.horizontal, 13).coachPanel(CoachColors.choice)
            }
            .accessibilityLabel("你：\(line.content)")
        } else {
            let mark = line.role == "error" ? ("exclamationmark.circle", "暂未完成", CoachColors.error)
                : line.role == "status" ? ("checkmark", "已保存", CoachColors.accent)
                : line.role == "meal" ? ("camera", "拍照记饮食", Color.orange)
                : ("sparkles", "Spotter 教练", CoachColors.accent)
            VStack(alignment: .leading, spacing: 9) {
                messageTitle(mark.0, mark.1, mark.2)
                Text(line.content).font(.subheadline).lineSpacing(4).textSelection(.enabled)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(13).coachPanel(radius: 17)
        }
    }

    private func messageTitle(_ icon: String, _ title: String, _ tint: Color = CoachColors.accent) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon).frame(width: 28, height: 28)
                .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            Text(title).font(.footnote.weight(.bold))
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 7) {
            if lines.isEmpty && picture == nil { openingSuggestions }
            HStack(spacing: 6) {
                Button { camera = true } label: { quickLabel("拍照", "camera") }
                    .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera) || busy)
                PhotosPicker(selection: $photoChoice, matching: .images) {
                    quickLabel("相册", "photo.on.rectangle")
                }.disabled(busy)
                if picture == nil && !weightPrompt {
                    Button { showOptions.toggle() } label: {
                        quickLabel(includePlans ? "已附上训练安排" : "对话选项", "slider.horizontal.3")
                    }.disabled(busy)
                }
            }.buttonStyle(.plain)
            if showOptions && picture == nil && !weightPrompt {
                VStack {
                    Toggle("附上个人训练安排", isOn: $includePlans)
                    if includePlans {
                        DatePicker("计划日期", selection: $contextDate, displayedComponents: .date)
                        Picker("安排范围", selection: $contextRange) {
                            Text("所选日期").tag("day")
                            Text("所在周").tag("week")
                        }
                    }
                    Button("问答定制训练计划") { openGuide() }.frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(.footnote).padding(9).coachPanel()
            }
            if let picture, let image = UIImage(data: picture) {
                HStack(spacing: 9) {
                    Image(uiImage: image).resizable().scaledToFill().frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 9)).accessibilityLabel("待发送的餐食照片")
                    Picker("记入餐次", selection: $meal) {
                        ForEach(["早餐", "午餐", "晚餐", "加餐"], id: \.self, content: Text.init)
                    }
                    Spacer()
                    Button { self.picture = nil; photoChoice = nil } label: {
                        Image(systemName: "xmark").frame(width: 36, height: 36).accessibilityLabel("移除照片")
                    }.disabled(busy)
                }.font(.footnote).padding(8).coachPanel()
            } else if planMode || weightPrompt {
                HStack {
                    Text(weightPrompt ? "记录体重" : "正在调整训练草稿")
                    Spacer()
                    Button("取消") { planMode = false; weightPrompt = false }.disabled(busy)
                }.font(.footnote).foregroundStyle(CoachColors.muted).padding(.horizontal, 4)
            }
            HStack(alignment: .center, spacing: 5) {
                TextField(composerHint, text: $text, axis: .vertical)
                    .focused($editingMessage)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .padding(.leading, 12)
                    .padding(.vertical, 9)
                    .disabled(busy)
                Button { sendComposer() } label: {
                    let ready = picture != nil || !cleanText.isEmpty
                    if picture != nil {
                        Text("识别并记餐").font(.footnote.weight(.bold)).padding(.horizontal, 12).frame(minHeight: 36)
                            .foregroundStyle(CoachColors.dark).background(CoachColors.accent, in: Capsule())
                    } else {
                        Image(systemName: "arrow.up").font(.body.weight(.semibold)).frame(width: 36, height: 36)
                            .foregroundStyle(ready ? CoachColors.dark : CoachColors.muted)
                            .background(ready ? CoachColors.accent : .clear, in: Circle())
                            .accessibilityLabel("发送消息")
                    }
                }.buttonStyle(.plain).disabled(busy || (picture == nil && cleanText.isEmpty))
            }
            .padding(4).coachPanel(radius: 24)
        }
        .padding(.horizontal, 15).padding(.bottom, 8)
    }

    private var openingSuggestions: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                suggestion("记体重") { askWeight() }
                suggestion("看本周训练统计") { Task { await trainingStats() } }
                suggestion("帮我制定训练计划") { openGuide() }
                suggestion("拍照记饮食") { showPhotoHelp() }
            }
        }
        .accessibilityLabel("推荐对话")
    }

    private func suggestion(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.caption.weight(.bold)).foregroundStyle(CoachColors.dark)
                .padding(.horizontal, 11).frame(minHeight: 34)
                .background(Color(red: 0.85, green: 0.91, blue: 0.82), in: Capsule())
        }.buttonStyle(.plain).disabled(busy)
    }

    nonisolated private func quickLabel(_ title: String, _ icon: String) -> some View {
        Label(title, systemImage: icon).font(.caption.weight(.semibold)).fixedSize()
            .padding(.horizontal, 9).frame(minHeight: 34)
            .background(CoachColors.panel, in: Capsule())
            .overlay(Capsule().strokeBorder(CoachColors.border, lineWidth: 1))
    }

    private var composerHint: String {
        if picture != nil { return "例如 200 mL 牛奶、1 勺蛋白粉" }
        if weightPrompt { return "例如 80.5 kg" }
        if planMode { return "想怎么调整这份草稿？" }
        return "问问 Spotter 教练…"
    }

    private func openGuide() {
        editingMessage = false
        onExpand?()
        showGuide = true
    }

    private func showPhotoHelp() {
        lines += [Line(role: "local-user", content: "拍照记饮食"),
                  Line(role: "meal", content: "点输入栏旁的拍照或相册。可以写下食物和份量，识别后直接记餐。")]
        if UIImagePickerController.isSourceTypeAvailable(.camera) { camera = true }
    }

    private func askWeight() {
        lines += [Line(role: "local-user", content: "记体重"),
                  Line(role: "local", content: "今天体重是多少？可以输入 kg 或 lb。")]
        weightPrompt = true
        editingMessage = true
    }

    private func sendComposer() {
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
            coachPrimary("保存到我的训练计划") { Task { await savePlans(own: false) } }
            Button("在对话中调整草稿") {
                planMode = true
                editingMessage = true
            }
            .font(.footnote.weight(.semibold)).disabled(busy)
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
                .padding(.horizontal, 13).frame(minHeight: 38)
                .background(CoachColors.accent, in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.plain).disabled(busy)
    }

    private func mealPreview(_ draft: NativeMealDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            messageTitle("camera", draft.name, .orange)
            Text("估算 \(Int(draft.calories.rounded())) 千卡 · 蛋白质 \(Int(draft.protein.rounded())) 克")
                .font(.footnote).foregroundStyle(CoachColors.muted)
            Text("碳水 \(Int(draft.carbs.rounded())) 克 · 脂肪 \(Int(draft.fat.rounded())) 克")
                .font(.footnote).foregroundStyle(CoachColors.muted)
            Picker("餐次", selection: $meal) {
                ForEach(["早餐", "午餐", "晚餐", "加餐"], id: \.self, content: Text.init)
            }
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
                    Text("把提示词发给常用的 AI，再把生成的计划 JSON 粘贴到这里预览。")
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
                            .font(.footnote.weight(.semibold))
                    }
                    if ownPromptVisible {
                        Text(externalPrompt).font(.footnote.monospaced()).textSelection(.enabled)
                    }
                }.padding(14).coachPanel()
                VStack(alignment: .leading, spacing: 10) {
                    messageTitle("list.bullet.clipboard", "粘贴已有内容")
                    TextField("粘贴计划 JSON", text: $ownInput, axis: .vertical)
                        .lineLimit(4...10).font(.footnote.monospaced()).padding(9).coachPanel(CoachColors.dark)
                    coachPrimary("预览计划") { importOwnDrafts() }
                    if let ownNotice { Text(ownNotice).font(.footnote).foregroundStyle(CoachColors.muted) }
                    if !ownDrafts.isEmpty {
                        draftRows(ownDrafts)
                        coachPrimary("确认保存到训练计划") { Task { await savePlans(own: true) } }
                    }
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

    private func importOwnDrafts() {
        ownDrafts = []
        var input = ownInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let fence = String(repeating: "\u{0060}", count: 3)
        if input.hasPrefix(fence), input.hasSuffix(fence), let endOfHeader = input.firstIndex(of: "\n"),
           input.distance(from: endOfHeader, to: input.endIndex) > 3 {
            input = String(input[input.index(after: endOfHeader)..<input.index(input.endIndex, offsetBy: -3)])
        }
        guard input.utf8.count <= 250_000,
              let rows = (try? JSONSerialization.jsonObject(with: Data(input.utf8))) as? [[String: Any]],
              (1...20).contains(rows.count),
              rows.allSatisfy({ ($0["title"] as? String)?.isEmpty == false
                  && ($0["date"] as? String)?.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil
                  && $0["exercises"] is [[String: Any]] }) else {
            ownNotice = "请粘贴 1 至 20 堂包含名称、日期和动作列表的计划 JSON。"
            return
        }
        ownDrafts = rows.map { row in
            var plan = row
            plan["shared"] = false
            return PlanDraft(data: plan)
        }
        ownNotice = "已载入 \(rows.count) 堂，确认后保存。"
    }

    private func submit(_ kind: RequestKind) {
        guard !busy, !cleanText.isEmpty || kind == .photo || kind == .guided else { return }
        editingMessage = false
        if NativeCoachConsent.isAllowed(owner: owner) { Task { await send(kind) } }
        else { pendingRequest = kind; consentNeeded = true }
    }

    private func send(_ kind: RequestKind) async {
        guard !busy, NativeCoachConsent.isAllowed(owner: owner) else { return }
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
            guard let object = try JSONSerialization.jsonObject(with: result) as? [String: Any],
                  let reply = object["reply"] as? String else { throw CocoaError(.coderReadCorrupt) }
            lines += [user, Line(role: "assistant", content: reply)]
            text = ""
            planMode = false
            guidedDraft = nil
            if let draft = object["draft"] as? [String: Any], let plans = draft["plans"] as? [[String: Any]] {
                planDrafts = plans.map { PlanDraft(data: $0) }
            }
        } catch { self.error = error.localizedDescription }
    }

    private func recognize() async {
        guard let picture else { return }
        do {
            let data = try await api.spotterSend("/api/food-photo", body: [
                "expectedOwner": owner, "mode": "meal", "notes": String(cleanText.prefix(300)),
                "image": ["mediaType": "image/jpeg", "base64": picture.base64EncodedString()]
            ])
            let answer = try JSONDecoder().decode(RecognizedMeal.self, from: data)
            if let draft = answer.draft {
                mealDraft = draft
                mealID = UUID().uuidString.lowercased()
                mealDate = spotterDay()
                lines.append(Line(role: "local-user", content: cleanText.isEmpty ? "照片 · 拍照记饮食" : "照片 · \(cleanText)"))
                self.picture = nil
                photoChoice = nil
                text = ""
                try await saveMeal(draft)
            } else {
                error = answer.error ?? answer.needs?.joined(separator: "；") ?? "请补充食物和份量，再试一次。"
            }
        } catch { self.error = error.localizedDescription }
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

    private func savePlans(own: Bool) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        let drafts = own ? ownDrafts : planDrafts
        do {
            for offset in stride(from: 0, to: drafts.count, by: 20) {
                let batch = drafts[offset..<min(offset + 20, drafts.count)]
                _ = try await api.spotterSend("/api/workout", body: [
                    "action": "plans", "expectedOwner": owner, "skipExisting": true,
                    "items": batch.map { ["id": $0.id, "data": $0.data] }
                ])
            }
            if own {
                ownDrafts = []; ownInput = ""; ownNotice = "训练计划已保存。"
            } else {
                planDrafts = []; lines.append(Line(role: "status", content: "训练计划已保存。")); error = nil
            }
        } catch {
            if own { ownNotice = error.localizedDescription }
            else { self.error = error.localizedDescription }
        }
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

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("问答定制训练计划").font(.headline)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").frame(width: 36, height: 38)
                }.accessibilityLabel("关闭问答")
            }.padding(.horizontal, 16)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("第 \(step + 1) 步 · \(labels[step])").font(.caption.weight(.semibold)).foregroundStyle(CoachColors.accent)
                            Text(titles[step]).font(.title2.bold())
                            Text(details[step]).font(.subheadline).foregroundStyle(CoachColors.muted)
                        }
                        Spacer(minLength: 0)
                        CoachArt(tile: headerArt[step], symbol: "list.clipboard", size: 65)
                    }
                    .foregroundStyle(CoachColors.text).padding(13)
                    .background(LinearGradient(colors: [CoachColors.dark, CoachColors.glow],
                                               startPoint: .topLeading, endPoint: .bottomTrailing),
                                in: RoundedRectangle(cornerRadius: 17))
                    progress
                    stepContents
                }.padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 14)
            }
            footer
        }
        .foregroundStyle(CoachColors.guideText).background(CoachColors.guideCanvas.ignoresSafeArea())
        .tint(CoachColors.guideAccent).environment(\.colorScheme, .light)
        .task { await loadCatalogue() }
        .sheet(isPresented: $choosingMove) { cataloguePicker }
    }

    private var progress: some View {
        HStack(spacing: 5) {
            ForEach(labels.indices, id: \.self) { index in
                VStack(spacing: 4) {
                    Capsule().fill(step >= index ? CoachColors.guideAccent : CoachColors.guideBorder).frame(height: 4)
                    Text(labels[index]).font(.caption2).foregroundStyle(step == index ? CoachColors.guideText : CoachColors.guideMuted)
                }.frame(maxWidth: .infinity)
            }
        }.accessibilityHidden(true)
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
                    Text(item.detail).font(.caption).foregroundStyle(CoachColors.guideMuted)
                }
                Spacer(minLength: 4)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? CoachColors.guideAccent : CoachColors.guideMuted)
            }.padding(10).guidePanel(selected: selected)
        }
        .buttonStyle(.plain).accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var presetCards: some View {
        VStack(alignment: .leading, spacing: 9) {
            if loadingCatalogue { ProgressView("正在读取动作库…") }
            if catalogueError { Button("重新读取动作库") { Task { await loadCatalogue() } } }
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
                        DisclosureGroup("查看动作") {
                            Text((candidates + warm).map(\.name).joined(separator: " · ")).foregroundStyle(CoachColors.guideMuted)
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
    }

    private var movements: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("动作类别", selection: $editingWarmup) {
                Text("正式动作（\(work.count)）").tag(false)
                Text("热身动作（\(warmup.count)）").tag(true)
            }.pickerStyle(.segmented)
            Button { search = ""; choosingMove = true } label: {
                Label("从动作库添加", systemImage: "plus").frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.bordered).disabled((editingWarmup ? warmup : work).count >= 24)
            ForEach(editingWarmup ? warmup : work) { move in
                HStack {
                    Label(move.name, systemImage: "dumbbell")
                    Spacer()
                    Button {
                        if editingWarmup { warmup.removeAll { $0.id == move.id } } else { work.removeAll { $0.id == move.id } }
                    } label: { Image(systemName: "trash").frame(width: 34, height: 34) }
                    .accessibilityLabel("移除 \(move.name)")
                }.padding(.horizontal, 9).padding(.vertical, 4).guidePanel()
            }
            if work.isEmpty { Text("至少加入一个正式动作。").font(.caption).foregroundStyle(CoachColors.guideMuted) }
        }
    }

    private var preferences: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("训练目标", selection: $goal) {
                ForEach(goals, id: \.0) { Text($0.1).tag($0.0) }
            }
            Stepper("每周训练 \(frequency) 天", value: $frequency, in: 1...7)
            Stepper("每次最多 \(minutes) 分钟", value: $minutes, in: 15...120, step: 5)
            Picker("训练周数", selection: $weeks) {
                ForEach([1, 2, 4], id: \.self) { Text("\($0) 周").tag($0) }
            }
            DatePicker("开始日期", selection: $start, displayedComponents: .date)
            Text("重点部位").font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 65))], spacing: 7) {
                ForEach(focusChoices, id: \.0) { item in
                    Button(item.1) {
                        if focus.contains(item.0) { focus.remove(item.0) } else { focus.insert(item.0) }
                    }
                    .buttonStyle(.bordered)
                    .tint(focus.contains(item.0) ? CoachColors.guideAccent : CoachColors.guideMuted)
                }
            }
            if frequency * weeks > 12 {
                Text("每份草稿最多 12 堂，请减少周数或每周次数。").font(.caption).foregroundStyle(.red)
            }
        }.padding(12).guidePanel()
    }

    private var footer: some View {
        HStack(spacing: 8) {
            if step > 0 {
                Button("上一步") { step -= 1 }
                    .buttonStyle(.bordered).frame(minHeight: 42)
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
                    .foregroundStyle(CoachColors.guideText).frame(maxWidth: .infinity, minHeight: 42)
                    .background(CoachColors.accent.opacity(invalidStep ? 0.45 : 1), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain).disabled(invalidStep)
        }
        .padding(.horizontal, 16).padding(.bottom, 10)
    }

    private var cataloguePicker: some View {
        NavigationStack {
            List {
                if catalogueError { Button("重新读取动作库") { Task { await loadCatalogue() } } }
                ForEach(catalogue.filter { move in
                    !excluded.contains(move.id) && !(editingWarmup ? warmup : work).contains { $0.id == move.id }
                        && (search.isEmpty || move.name.localizedCaseInsensitiveContains(search) || move.en.localizedCaseInsensitiveContains(search))
                }.prefix(80)) { move in
                    Button(move.name) {
                        if editingWarmup { warmup.append(move) } else { work.append(move) }
                        choosingMove = false
                    }
                }
            }
            .searchable(text: $search, prompt: "搜索动作")
            .navigationTitle("动作库")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { choosingMove = false } } }
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
