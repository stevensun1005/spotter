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

@MainActor
struct NativeCoachView: View {
    private struct Line: Codable {
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
    }

    let api: NativeAPI
    let owner: String
    @Environment(\.dismiss) private var dismiss
    @State private var lines: [Line] = []
    @State private var text = ""
    @State private var error: String?
    @State private var busy = false
    @State private var planDrafts: [PlanDraft] = []
    @State private var mealDraft: NativeMealDraft?
    @State private var mealID = UUID().uuidString.lowercased()
    @State private var picture: Data?
    @State private var photoChoice: PhotosPickerItem?
    @State private var camera = false
    @State private var showGuide = false
    @State private var consentNeeded = false
    @State private var planMode = false
    @State private var pendingRequest: RequestKind?
    @State private var meal = "加餐"

    private var sharingKey: String { "spotter.native.coach.consent." + owner }
    private var cleanText: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if lines.isEmpty {
                            Text("今天想练什么？").font(.title2.bold())
                            HStack {
                                Button { showGuide = true } label: { Label("定制训练计划", systemImage: "calendar.badge.plus") }
                                Button("训练安排建议") { text = "帮我安排这周的力量训练。" }
                            }
                            .buttonStyle(.bordered)
                        }
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                            Text(line.content)
                                .frame(maxWidth: .infinity, alignment: line.role == "user" ? .trailing : .leading)
                                .padding(14)
                                .background(line.role == "user" ? SpotterPalette.lime.opacity(0.28) : SpotterPalette.card,
                                            in: RoundedRectangle(cornerRadius: 16))
                        }
                        if !planDrafts.isEmpty { planPreview }
                        if let draft = mealDraft { mealPreview(draft) }
                        if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                        if busy { ProgressView().padding(.vertical, 6) }
                        Color.clear.frame(height: 1).id("latest")
                    }
                    .padding(16)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: lines.count) { _ in withAnimation { proxy.scrollTo("latest", anchor: .bottom) } }
                .onChange(of: busy) { _ in withAnimation { proxy.scrollTo("latest", anchor: .bottom) } }
            }
            composer
        }
        .background(SpotterPalette.background)
        .navigationTitle("AI 教练")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("完成") { dismiss() } }
            ToolbarItem(placement: .primaryAction) {
                Button { lines = []; planDrafts = []; mealDraft = nil; error = nil; text = ""; picture = nil; planMode = false } label: {
                    Image(systemName: "square.and.pencil").accessibilityLabel("新对话")
                }.disabled(busy)
            }
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
        .sheet(isPresented: $showGuide) {
            NavigationStack {
                NativePlanQuestions { prompt in
                    text = prompt
                    planMode = true
                    showGuide = false
                    // The composer keeps the answers visible before sending them.
                }
            }
            .presentationDetents([.large])
        }
        .confirmationDialog("允许将本次内容发送给 AI 教练？", isPresented: $consentNeeded, titleVisibility: .visible) {
            Button("允许并继续") {
                UserDefaults.standard.set(true, forKey: sharingKey)
                if let kind = pendingRequest { Task { await send(kind) } }
                pendingRequest = nil
            }
            Button("取消", role: .cancel) { pendingRequest = nil }
        } message: {
            Text("本次对话或你选中的照片和备注会发送给 Anthropic 处理。")
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 11) {
            if let picture, let image = UIImage(data: picture) {
                HStack {
                    Image(uiImage: image).resizable().scaledToFill().frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 9)).accessibilityLabel("待发送的餐食照片")
                    Text("附加照片").font(.footnote)
                    Spacer()
                    Button { self.picture = nil; photoChoice = nil } label: {
                        Image(systemName: "xmark.circle.fill").accessibilityLabel("移除照片")
                    }.disabled(busy)
                }
            }
            HStack(spacing: 17) {
                Button { camera = true } label: { Label("拍照", systemImage: "camera") }
                    .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera) || busy)
                PhotosPicker(selection: $photoChoice, matching: .images) {
                    Label("相册", systemImage: "photo.on.rectangle")
                }.disabled(busy)
                Button { showGuide = true } label: { Label("计划问答", systemImage: "checklist") }.disabled(busy)
            }.font(.footnote)
            if planMode, picture == nil {
                HStack {
                    Label("生成计划", systemImage: "calendar")
                    Spacer()
                    Button("退出计划模式") { planMode = false }.disabled(busy)
                }.font(.footnote)
            }
            HStack(alignment: .bottom) {
                TextField(picture == nil ? "问问 Spotter 教练" : "说明食物和份量", text: $text, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.roundedBorder)
                    .disabled(busy)
                if picture == nil {
                    Button { submit(planMode ? .plan : .chat) } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.title)
                            .accessibilityLabel(planMode ? "生成计划草稿" : "发送")
                    }.disabled(busy || cleanText.isEmpty)
                } else {
                    Button("识别照片") { submit(.photo) }
                        .buttonStyle(.borderedProminent)
                        .disabled(busy)
                }
            }
        }
        .padding(15)
        .background(.regularMaterial)
    }

    private var planPreview: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("训练计划草稿", systemImage: "calendar").font(.headline)
            ForEach(planDrafts) { draft in
                VStack(alignment: .leading, spacing: 4) {
                    Text(draft.title).fontWeight(.semibold)
                    Text(([draft.date] + draft.exerciseNames).joined(separator: " · "))
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Button("保存到我的训练计划") { Task { await savePlans() } }
                .buttonStyle(.borderedProminent).disabled(busy)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding).spotterCard()
    }

    private func mealPreview(_ draft: NativeMealDraft) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(draft.name, systemImage: "fork.knife").font(.headline)
            Text("估算 \(Int(draft.calories.rounded())) 千卡 · 蛋白质 \(Int(draft.protein.rounded())) 克")
                .font(.footnote).foregroundStyle(.secondary)
            Text("碳水 \(Int(draft.carbs.rounded())) 克 · 脂肪 \(Int(draft.fat.rounded())) 克")
                .font(.footnote).foregroundStyle(.secondary)
            Picker("餐次", selection: $meal) {
                ForEach(["早餐", "午餐", "晚餐", "加餐"], id: \.self, content: Text.init)
            }
            Button("添加到饮食") { Task { await saveMeal(draft) } }
                .buttonStyle(.borderedProminent).disabled(busy)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding).spotterCard()
    }

    private func submit(_ kind: RequestKind) {
        guard !busy, !cleanText.isEmpty || kind == .photo else { return }
        if UserDefaults.standard.bool(forKey: sharingKey) { Task { await send(kind) } }
        else { pendingRequest = kind; consentNeeded = true }
    }

    private func send(_ kind: RequestKind) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        if kind == .photo {
            await recognize()
            return
        }
        let user = Line(role: "user", content: String(cleanText.prefix(4000)))
        guard !user.content.isEmpty else { return }
        var context = Array((lines.filter { $0.role == "user" || $0.role == "assistant" } + [user]).suffix(9))
        while let first = context.first, first.role != "user" { context.removeFirst() }
        while context.count > 1 && context.reduce(0, { $0 + $1.content.utf16.count }) > 9000 { context.removeFirst(2) }
        let messages = context.map { ["role": $0.role, "content": $0.content] }
        do {
            let result = try await api.spotterSend("/api/ai-coach", body: [
                "expectedOwner": owner, "intent": kind == .plan ? "draft" : "chat",
                "model": "haiku", "date": spotterDay(), "includePlans": false, "messages": messages
            ])
            guard let object = try JSONSerialization.jsonObject(with: result) as? [String: Any],
                  let reply = object["reply"] as? String else { throw CocoaError(.coderReadCorrupt) }
            lines += [user, Line(role: "assistant", content: reply)]
            text = ""
            planMode = false
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
                self.picture = nil
                photoChoice = nil
                text = ""
            } else {
                error = answer.error ?? answer.needs?.joined(separator: "；") ?? "请补充食物和份量，再试一次。"
            }
        } catch { self.error = error.localizedDescription }
    }

    private func saveMeal(_ draft: NativeMealDraft) async {
        busy = true
        defer { busy = false }
        do {
            _ = try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner,
                "data": ["kind": "nutrition", "id": mealID, "date": spotterDay(), "entry": draft.values(meal: meal)]
            ])
            mealDraft = nil
            lines.append(Line(role: "status", content: "已把「\(draft.name)」记入今天的\(meal)。"))
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func savePlans() async {
        busy = true
        defer { busy = false }
        do {
            for offset in stride(from: 0, to: planDrafts.count, by: 20) {
                let batch = planDrafts[offset..<min(offset + 20, planDrafts.count)]
                _ = try await api.spotterSend("/api/workout", body: [
                    "action": "plans", "expectedOwner": owner, "skipExisting": true,
                    "items": batch.map { ["id": $0.id, "data": $0.data] }
                ])
            }
            planDrafts = []
            lines.append(Line(role: "status", content: "训练计划已保存。"))
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct NativePlanQuestions: View {
    @Environment(\.dismiss) private var dismiss
    @State private var goal = "增肌"
    @State private var venue = "健身房"
    @State private var frequency = 3
    @State private var limits = ""
    @State private var step = 0
    let completed: (String) -> Void

    var body: some View {
        Form {
            Section {
                ProgressView(value: Double(step + 1), total: 3)
                    .accessibilityLabel("第 \(step + 1) 步，共三步")
            }
            switch step {
            case 0:
                Section("有没有要避开的动作？") {
                    TextField("不适、动作偏好或可用器械（选填）", text: $limits, axis: .vertical)
                }
            case 1:
                Section("你在哪里训练？") {
                    Picker("场地", selection: $venue) {
                        ForEach(["健身房", "家庭", "自重"], id: \.self, content: Text.init)
                    }.pickerStyle(.inline)
                }
            default:
                Section("想达到什么目标？") {
                    Picker("目标", selection: $goal) {
                        ForEach(["增肌", "提高力量", "保持活动量"], id: \.self, content: Text.init)
                    }
                    Stepper("每周 \(frequency) 次", value: $frequency, in: 1...7)
                }
            }
            Section {
                if step < 2 { Button("下一步") { step += 1 } }
                else {
                    Button("带入对话") {
                        let details = limits.trimmingCharacters(in: .whitespacesAndNewlines)
                        completed("请为我生成训练计划。目标是\(goal)，在\(venue)训练，每周\(frequency)次。" +
                                  (details.isEmpty ? "" : "我的限制或偏好是\(details)。"))
                        dismiss()
                    }
                }
                if step > 0 { Button("上一步") { step -= 1 } }
            }
        }
        .navigationTitle("计划问答")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
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

@MainActor
struct NativeFoodLog: View {
    private struct PersonalRows: Decodable {
        struct Row: Decodable, Identifiable {
            struct Item: Decodable {
                let type: String
                let name: String?
                let calories: Double?
                let kg: Double?
            }
            let id: String?
            let kind: String
            let entry: Item?
        }
        let rows: [Row]
    }
    let api: NativeAPI
    let owner: String
    @State private var rows: [PersonalRows.Row] = []
    @State private var showForm = false
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("今日饮食和体重", systemImage: "fork.knife.circle").font(.headline)
            if rows.isEmpty { Text("今天还没有饮食或体重记录。").font(.footnote).foregroundStyle(.secondary) }
            ForEach(rows) { row in
                if let entry = row.entry {
                    switch entry.type {
                    case "meal":
                        LabeledContent(entry.name ?? "餐食", value: "\(Int((entry.calories ?? 0).rounded())) 千卡")
                    case "weight":
                        LabeledContent("体重", value: (entry.kg ?? 0).formatted(.number.precision(.fractionLength(1))) + " kg")
                    default: EmptyView()
                    }
                }
            }
            if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
            Button("记录体重") { showForm = true }.buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .spotterNativeNutritionUpdated)) { _ in Task { await load() } }
        .sheet(isPresented: $showForm) {
            NavigationStack {
                NativeWeightForm(api: api, owner: owner)
            }
            .presentationDetents([.medium])
        }
    }

    private func load() async {
        do {
            let records = try await api.spotterRead("/api/library?date=" + spotterDay(), as: PersonalRows.self)
            rows = records.rows.filter { $0.kind == "nutrition" && $0.id != nil &&
                ($0.entry?.type == "meal" || $0.entry?.type == "weight") }
            message = nil
        } catch { message = error.localizedDescription }
    }
}

@MainActor
private struct NativeWeightForm: View {
    let api: NativeAPI
    let owner: String
    @Environment(\.dismiss) private var dismiss
    @State private var weight = ""
    @State private var unit = "kg"
    @State private var id = UUID().uuidString.lowercased()
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Form {
            TextField("体重", text: $weight).keyboardType(.decimalPad)
            Picker("单位", selection: $unit) { Text("公斤").tag("kg"); Text("磅").tag("lb") }
            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            Button("保存") { Task { await save() } }.disabled(busy || weight.isEmpty)
        }
        .navigationTitle("记录体重")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
    }

    private func save() async {
        guard let amount = Double(weight.replacingOccurrences(of: ",", with: ".")), amount.isFinite else { error = "请输入体重数值。"; return }
        let kg = unit == "lb" ? amount * 0.45359237 : amount
        guard (10...700).contains(kg) else { error = "请检查体重数值和单位。"; return }
        busy = true
        defer { busy = false }
        do {
            _ = try await api.spotterSend("/api/library", body: [
                "action": "save", "expectedOwner": owner,
                "data": ["kind": "nutrition", "id": id, "date": spotterDay(), "entry": ["type": "weight", "kg": kg]]
            ])
            NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
