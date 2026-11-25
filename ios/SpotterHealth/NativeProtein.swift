import Foundation
import PhotosUI
import SwiftUI
import UIKit
import Vision

@MainActor
private final class NativeProteinStore: ObservableObject {
    @Published var products: [NativeJSON] = []
    @Published var defaultID: String?
    @Published var message: String?
    @Published var busy = false
    @Published var loaded = false
    private var warehouse: NativeJSON = .object(["kind": .string("protein-warehouse"), "products": .array([])])
    private var preference: NativeJSON = .object(["kind": .string("protein-preference"), "enabled": .bool(true)])
    private var revision: String?
    let api: NativeAPI
    let owner: String

    init(api: NativeAPI, owner: String) { self.api = api; self.owner = owner }

    func load() async {
        busy = true
        defer { busy = false }
        do {
            let data = try await api.request("/api/library")
            let rows = try JSONDecoder().decode(NativeJSON.self, from: data)["rows"].array
            if let saved = rows.first(where: { $0["kind"].string == "protein-warehouse" }) {
                warehouse = saved; products = saved["products"].array; revision = saved["updated"].string
            } else { products = []; revision = nil }
            if let saved = rows.first(where: { $0["kind"].string == "protein-preference" }) {
                preference = saved; defaultID = saved["defaultProductId"].string
            } else { defaultID = nil }
            loaded = true; message = nil
        } catch { loaded = false; message = error.localizedDescription }
    }

    func save(_ product: NativeJSON, makeDefault: Bool) async -> String? {
        guard loaded, !busy else { return "请先成功读取仓库，再保存配方。" }
        var next = products
        if let index = next.firstIndex(where: { $0["id"].string == product["id"].string }) { next[index] = product }
        else {
            guard next.count < 20 else { return "仓库最多保存 20 款蛋白粉。" }
            let name = product["name"].string.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            guard !next.contains(where: { $0["name"].string.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current) == name }) else {
                return "仓库已有这款产品，请回到列表编辑原配方。"
            }
            next.append(product)
        }
        busy = true
        defer { busy = false }
        do {
            var updated = warehouse.object
            updated.removeValue(forKey: "updated")
            updated["kind"] = .string("protein-warehouse"); updated["products"] = .array(next)
            let body: NativeJSON = .object(["action": .string("save"), "expectedOwner": .string(owner),
                "revision": revision.map(NativeJSON.string) ?? .null, "data": .object(updated)])
            let data = try await api.request("/api/library", method: "POST", json: JSONEncoder().encode(body))
            let receipt = try JSONDecoder().decode(NativeJSON.self, from: data)
            revision = receipt["updated"].string
            warehouse = .object(updated); products = next
            if makeDefault { try await saveDefault(product["id"].string) }
            message = "配方已保存到蛋白粉仓库。"
            return nil
        } catch {
            message = error.localizedDescription
            return error.localizedDescription + " 请关闭编辑页并刷新仓库后核对，避免覆盖其他设备的改动。"
        }
    }

    func chooseDefault(_ id: String) async {
        guard loaded, !busy else { return }
        busy = true
        defer { busy = false }
        do { try await saveDefault(id); message = "训练打卡默认配方已更新。" }
        catch { message = error.localizedDescription }
    }

    private func saveDefault(_ id: String) async throws {
        var raw = preference.object
        raw.removeValue(forKey: "updated")
        raw["kind"] = .string("protein-preference"); raw["enabled"] = .bool(true); raw["defaultProductId"] = .string(id)
        let body: NativeJSON = .object(["action": .string("save"), "expectedOwner": .string(owner), "data": .object(raw)])
        _ = try await api.request("/api/library", method: "POST", json: JSONEncoder().encode(body))
        preference = .object(raw); defaultID = id
    }
}

struct NativeProteinView: View {
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterAccent) private var accent
    @StateObject private var store: NativeProteinStore
    @State private var editor: NativeProteinRecipeEditor?

    init(api: NativeAPI, owner: String) { _store = StateObject(wrappedValue: NativeProteinStore(api: api, owner: owner)) }

    var body: some View {
        List {
            Section {
                Text("每款产品分别保存一勺粉量、冲泡液体和杯量。训练勾选已喝后，使用这份配方同步一杯加餐。")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button { editor = NativeProteinRecipeEditor() } label: {
                    Label("添加蛋白粉", systemImage: "plus.circle.fill")
                        .fontWeight(.semibold).foregroundStyle(SpotterPalette.accent)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
                }
                    .disabled(!store.loaded || store.busy || store.products.count >= 20)
            }
            Section("我的配方") {
                if store.products.isEmpty { Text(store.loaded ? "仓库还没有配方，可从包装照片识别后核对添加。" : "正在读取仓库…").foregroundStyle(.secondary) }
                ForEach(Array(store.products.enumerated()), id: \.offset) { _, product in
                    let id = product["id"].string
                    let isDefault = id == store.defaultID
                    VStack(alignment: .leading, spacing: 9) {
                        HStack {
                            Text(product["name"].string).font(.headline)
                            Spacer()
                            if isDefault {
                                Label("训练默认", systemImage: "checkmark")
                                    .font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.accent)
                                    .padding(.horizontal, 8).padding(.vertical, 4)
                                    .background(SpotterPalette.wash, in: Capsule())
                                    .transition(.opacity.combined(with: .offset(x: 5)))
                            }
                        }
                        Text("一勺 \(product["scoopGrams"].number.formatted()) g · \(product["mixer"]["name"].string.isEmpty ? "水" : product["mixer"]["name"].string) \(product["cupMl"].number.formatted()) mL")
                            .font(.subheadline).foregroundStyle(.secondary)
                        if case .object = product["powder"] {
                            Text(Self.servingText(product)).font(.caption).foregroundStyle(.secondary)
                        } else { Text("待补充包装营养").font(.caption).foregroundStyle(.orange) }
                        if product["powderEstimated"].bool || product["scoopEstimated"].bool { Text("份量或营养含估算").font(.caption).foregroundStyle(.secondary) }
                        HStack {
                            recipeAction("编辑配方", icon: "pencil") { editor = NativeProteinRecipeEditor(product: product, makeDefault: isDefault) }
                            Spacer()
                            if !isDefault, case .object = product["powder"] {
                                recipeAction("设为训练默认", icon: "checkmark.circle") { Task { await store.chooseDefault(id) } }
                                    .transition(.opacity)
                            }
                        }.disabled(store.busy || !store.loaded)
                    }
                    .padding(.vertical, 5)
                    .animation(motion, value: isDefault)
                }
            }
            if let message = store.message { Section { Text(message).font(.footnote).foregroundStyle(.secondary) } }
        }
        .buttonStyle(.spotterPress)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background.ignoresSafeArea())
        .tint(accent.tint)
        .navigationTitle("蛋白粉仓库")
        .refreshable { await store.load() }
        .task { await store.load() }
        .sheet(item: $editor) { item in
            NavigationStack { NativeProteinEditor(initial: item) { product, makeDefault in await store.save(product, makeDefault: makeDefault) } }
                .presentationDragIndicator(.visible)
        }
    }

    private func recipeAction(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.accent)
                .padding(.horizontal, 10).frame(minHeight: 44)
                .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.spotterPress)
    }

    private static func servingText(_ product: NativeJSON) -> String {
        let powder = product["powder"], mixer = product["mixer"]["per100ml"]
        let grams = product["scoopGrams"].number, ml = product["cupMl"].number
        let value: (String) -> String = { key in ((powder[key].number * grams + mixer[key].number * ml) / 100).formatted(.number.precision(.fractionLength(0...1))) }
        return "每杯 \(value("calories")) 千卡 · 蛋白质 \(value("protein")) g · 碳水 \(value("carbs")) g · 脂肪 \(value("fat")) g"
    }
}

struct NativeProteinEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterAccent) private var accent
    @State private var value: NativeProteinRecipeEditor
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showCamera = false
    @State private var busy = false
    @State private var message: String?
    let confirmTitle: String
    let save: (NativeJSON, Bool) async -> String?

    init(initial: NativeProteinRecipeEditor, confirmTitle: String = "核对无误，保存到仓库",
         save: @escaping (NativeJSON, Bool) async -> String?) {
        _value = State(initialValue: initial)
        self.confirmTitle = confirmTitle
        self.save = save
    }

    var body: some View {
        Form {
            Section("包装标签") {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label("选择标签照片", systemImage: "photo").foregroundStyle(SpotterPalette.accent)
                        .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }
                .disabled(busy)
                Button { showCamera = true } label: {
                    Label("拍摄标签", systemImage: "camera").foregroundStyle(SpotterPalette.accent)
                        .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }
                    .disabled(busy || !UIImagePickerController.isSourceTypeAvailable(.camera))
                Text("识别在设备上进行。照片不会上传；识别结果只是草稿，请核对计量口径和数值后再加入仓库。")
                    .font(.footnote).foregroundStyle(.secondary)
                if !value.recognized.isEmpty {
                    SpotterDisclosure("查看识别文字") { Text(value.recognized).font(.caption).textSelection(.enabled) }
                        .transition(.opacity)
                }
            }
            Section("这一款的配方") {
                TextField("产品名称", text: $value.name)
                number("每勺粉量 g", text: $value.scoop)
                number("液体量 mL", text: $value.cup)
                Toggle("冲泡使用奶或其他液体", isOn: $value.usesMixer)
                if value.usesMixer { TextField("液体名称", text: $value.mixerName).transition(.opacity) }
                Toggle("一勺粉量含估算", isOn: $value.scoopEstimated)
            }
            Section("粉的包装营养") {
                SpotterMenuPicker("标签口径", selection: $value.perServing, options: [(false, "每 100 克"), (true, "每份")])
                if value.perServing { number("这一份的克数 g", text: $value.servingGrams).transition(.opacity) }
                nutritionFields(values: $value.powder)
                Toggle("营养含估算", isOn: $value.estimated)
            }
            if value.usesMixer {
                Section("冲泡液体每 100 mL 营养") { nutritionFields(values: $value.liquid) }.transition(.opacity)
            }
            Section {
                Toggle("训练打卡默认选这款", isOn: $value.makeDefault)
                if let message { Text(message).font(.footnote).foregroundStyle(.red).transition(.opacity) }
                Button { Task { await commit() } } label: {
                    ZStack {
                        if busy { ProgressView().transition(.opacity) }
                        else { Text(confirmTitle).fontWeight(.semibold).transition(.opacity) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44).contentShape(Rectangle())
                    .foregroundStyle(SpotterPalette.deep)
                    .background(accent.fill, in: RoundedRectangle(cornerRadius: 11))
                }
                .disabled(busy)
            }
        }
        .buttonStyle(.spotterPress)
        .tint(accent.tint)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background.ignoresSafeArea())
        .animation(motion, value: value.usesMixer)
        .animation(motion, value: value.perServing)
        .animation(motion, value: value.recognized.isEmpty)
        .animation(motion, value: message != nil)
        .animation(motion, value: busy)
        .navigationTitle("蛋白粉配方").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button { dismiss() } label: { Image(systemName: "xmark").frame(width: 38, height: 44) }
                    .buttonStyle(.spotterPress).accessibilityLabel("取消").disabled(busy)
            }
        }
        .onChange(of: selectedPhoto) { photo in
            Task {
                guard let photo else { return }
                if let data = try? await photo.loadTransferable(type: Data.self) { await recognize(data) }
                else { message = "暂时无法读取照片。你可以重选或手动填写。" }
            }
        }
        .sheet(isPresented: $showCamera) { ProteinCamera { data in showCamera = false; if let data { Task { await recognize(data) } } } }
    }

    private func number(_ label: String, text: Binding<String>) -> some View { TextField(label, text: text).keyboardType(.decimalPad) }
    @ViewBuilder private func nutritionFields(values: Binding<[String: String]>) -> some View {
        ForEach(["calories", "protein", "carbs", "fat"], id: \.self) { key in
            let label = ["calories": "热量 kcal", "protein": "蛋白质 g", "carbs": "碳水化合物 g", "fat": "脂肪 g"][key]!
            number(label, text: Binding(get: { values.wrappedValue[key] ?? "" }, set: { values.wrappedValue[key] = $0 }))
        }
    }

    private func commit() async {
        do {
            let product = try value.product()
            busy = true; defer { busy = false }
            if let problem = await save(product, value.makeDefault) { message = problem }
            else { dismiss() }
        } catch { message = error.localizedDescription }
    }

    private func recognize(_ data: Data) async {
        busy = true; defer { busy = false }
        do {
            let text = try await Task.detached(priority: .userInitiated) { () -> String in
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate; request.recognitionLanguages = ["en-US", "zh-Hans"]; request.usesLanguageCorrection = true
                try VNImageRequestHandler(data: data, options: [:]).perform([request])
                return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
            }.value
            value.recognized = text
            let match: (String) -> String? = { pattern in
                guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                      let result = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)), let range = Range(result.range(at: 1), in: text) else { return nil }
                return String(text[range])
            }
            if let grams = match("(?:scoop|每勺|每份|serving size)[^\\d\\n]{0,20}(\\d+(?:\\.\\d+)?)\\s*g") { value.scoop = grams; value.servingGrams = grams }
            let patterns = ["protein": "(?:protein|蛋白质)[^\\d\\n]{0,12}(\\d+(?:\\.\\d+)?)\\s*g",
                            "carbs": "(?:carbohydrates?|碳水化合物)[^\\d\\n]{0,12}(\\d+(?:\\.\\d+)?)\\s*g",
                            "fat": "(?:total\\s+fat|fat|脂肪)[^\\d\\n]{0,12}(\\d+(?:\\.\\d+)?)\\s*g"]
            for (key, pattern) in patterns { if let number = match(pattern) { value.powder[key] = number } }
            if let calories = match("(\\d+(?:\\.\\d+)?)\\s*(?:kcal|千卡)") ?? match("calories\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)") { value.powder["calories"] = calories }
            value.perServing = match("(?:per|每)\\s*(100)\\s*g") == nil
            value.estimated = true
            message = text.isEmpty ? "没有识别到标签文字，请重新拍摄或手动填写。" : "已填入识别草稿。请逐项核对，尤其是每份克数和营养口径；未识别的字段需要手动补齐。"
        } catch { message = "暂时无法识别这张照片，请重新拍摄或手动填写。" }
    }
}

private struct ProteinCamera: UIViewControllerRepresentable {
    let complete: (Data?) -> Void
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let complete: (Data?) -> Void
        init(complete: @escaping (Data?) -> Void) { self.complete = complete }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { complete(nil) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            complete((info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.88))
        }
    }
    func makeCoordinator() -> Coordinator { Coordinator(complete: complete) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = context.coordinator; return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) { }
}
