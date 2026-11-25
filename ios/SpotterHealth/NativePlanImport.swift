import SwiftUI
import UniformTypeIdentifiers

struct NativePlanImportView: View {
    @Environment(\.spotterInteractionMotion) private var motion
    let api: NativeAPI
    let owner: String
    let didImport: @MainActor () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var previews: [NativePlanDraft] = []
    @State private var editing: NativePlanDraft?
    @State private var showingFiles = false
    @State private var busy = false
    @State private var error: String?
    @State private var receipt: String?
    @FocusState private var editingText: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("粘贴已有内容").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
                sourceCard
                if !previews.isEmpty { previewCard.transition(.opacity) }
                if let error { Label(error, systemImage: "exclamationmark.circle").font(.subheadline).foregroundStyle(.red) }
                if let receipt { Label(receipt, systemImage: "checkmark.circle").font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.accent) }
            }.padding(14)
                .animation(motion, value: previews.isEmpty)
        }
        .background(SpotterPalette.background.ignoresSafeArea())
        .foregroundStyle(SpotterPalette.ink)
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() }.disabled(busy) } }
        .toolbar(.visible, for: .navigationBar)
        .interactiveDismissDisabled(busy)
        .sheet(item: $editing) { draft in
            NavigationStack {
                NativePlanEditorPanel(imported: draft) { edited in
                    guard let index = previews.firstIndex(where: { $0.id == edited.id }) else { return }
                    previews[index] = edited
                }
            }.presentationDragIndicator(.visible)
        }
        .fileImporter(isPresented: $showingFiles, allowedContentTypes: [.json, .plainText]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let file = try FileHandle(forReadingFrom: url)
                defer { try? file.close() }
                let data = try file.read(upToCount: NativePlanImport.maximumBytes + 1) ?? Data()
                guard data.count <= NativePlanImport.maximumBytes else { throw NativePlanImport.Problem("文件太大，请分批导入。") }
                guard let contents = String(data: data, encoding: .utf8) else { throw NativePlanImport.Problem("请选择 UTF-8 格式的 JSON 或文本文件。") }
                input = contents
                preview(contents)
            } catch { self.error = error.localizedDescription }
        }
    }

    private var sourceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("训练文本、计划 JSON 或跟练链接").font(.headline)
            TextField("例如：哑铃卧推 3×10，12 kg", text: Binding(get: { input }, set: { value in
                input = value; previews = []; error = nil; receipt = nil
            }), axis: .vertical)
                .lineLimit(6...10).font(.body).padding(11)
                .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 10))
                .focused($editingText).disabled(busy)
            ViewThatFits(in: .horizontal) {
                HStack { chooseFile; Spacer(); previewButton }
                VStack(alignment: .leading) { chooseFile; previewButton }
            }
        }.padding(14).spotterCard()
    }

    private var chooseFile: some View {
        Button { editingText = false; showingFiles = true } label: { Label("选择文件", systemImage: "doc.badge.plus") }
            .buttonStyle(.spotterControl).disabled(busy)
    }

    private var previewButton: some View {
        Button { preview(input) } label: { Label("预览导入", systemImage: "list.bullet.clipboard") }
            .buttonStyle(.spotterPrimaryControl)
            .disabled(busy || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    private var previewCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("核对 \(previews.count) 堂训练").font(.headline)
            ForEach(previews) { draft in
                let plan = NativePlan(raw: draft.plan)
                Button { editing = draft } label: {
                    HStack(spacing: 9) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(plan.title).font(.body.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                            Text([plan.date, plan.category, "\(plan.exercises.count) 个动作"].joined(separator: " · "))
                                .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).accessibilityHidden(true)
                    }.padding(10).frame(maxWidth: .infinity, alignment: .leading)
                        .background(SpotterPalette.wash.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
                }.buttonStyle(.spotterPress).accessibilityHint("编辑这堂训练")
            }
            Button { Task { await save() } } label: { Label(busy ? "正在排入日历…" : "保存到我的计划", systemImage: "calendar.badge.plus") }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
        }.padding(14).spotterCard().disabled(busy)
    }

    private func preview(_ source: String) {
        editingText = false
        receipt = nil
        do {
            previews = try NativePlanImport.parse(source, today: spotterDay()).map { plan in
                var draft = NativePlanDraft(day: plan["date"].string)
                draft.plan = plan
                return draft
            }
            error = nil
        } catch {
            previews = []
            self.error = error.localizedDescription
        }
    }

    private func save() async {
        guard !busy, !previews.isEmpty else { return }
        busy = true
        defer { busy = false }
        do {
            for draft in previews { try NativePlanImport.validate(draft.plan) }
            let body: NativeJSON = .object([
                "action": .string("plans"), "expectedOwner": .string(owner), "skipExisting": .bool(true),
                "items": .array(previews.map { .object(["id": .string($0.id), "data": $0.plan]) })
            ])
            let result = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
            let saved = try JSONDecoder().decode(Receipt.self, from: result)
            previews = []
            error = nil
            receipt = "已保存 \(saved.added) 堂，跳过 \(saved.skipped) 堂重复计划。"
            await didImport()
        } catch { self.error = error.localizedDescription }
    }

    private struct Receipt: Decodable { let added: Int; let skipped: Int }
}
