import SwiftUI
import UniformTypeIdentifiers

struct NativeProgramsView: View {
    let api: NativeAPI
    let owner: String
    let didSchedule: @MainActor () async -> Void

    @State private var records: [Record] = []
    @State private var selected: Record?
    @State private var preview: Preview?
    @State private var showingImport = false
    @State private var busy = false
    @State private var message: String?
    @State private var issue: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("训练周期").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
                Button { showingImport = true } label: { Label("导入周期", systemImage: "square.and.arrow.down") }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true))
                if busy { ProgressView().frame(maxWidth: .infinity) }
                if !busy && records.isEmpty && issue == nil {
                    Text("还没有训练周期").foregroundStyle(SpotterPalette.muted).frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
                }
                ForEach(records) { record in
                    Button { selected = record; preview = nil; message = nil } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(record.title).font(.headline)
                                Text(record.summary).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(SpotterPalette.muted).accessibilityHidden(true)
                        }.padding(14).spotterCard()
                    }.buttonStyle(.spotterPress)
                }
                if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
            }.padding(14)
        }
        .background(SpotterPalette.background.ignoresSafeArea()).foregroundStyle(SpotterPalette.ink)
        .navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
        .refreshable { await load() }.task { await load() }
        .sheet(isPresented: $showingImport) {
            NativeProgramImport { program in
                let result = try await send(["action": .string("save"), "program": program, "revision": .null])
                guard let record = Record(result["program"]) else { throw NativeAPIError.invalidResponse }
                records = [record] + records.filter { $0.id != record.id }
            }.presentationDragIndicator(.visible)
        }
        .sheet(item: $selected) { record in
            NavigationStack {
                List {
                    Section(record.summary) {
                        ForEach(Array(record.raw["phases"].array.enumerated()), id: \.offset) { _, phase in
                            LabeledContent(phase["name"].string, value: "第 \(Int(phase["fromWeek"].number))–\(Int(phase["toWeek"].number)) 周")
                        }
                        ForEach(Array(record.sessions.enumerated()), id: \.offset) { _, item in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item["plan"]["title"].string).font(.headline)
                                Text(position(item, date: item["plan"]["date"].string)).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let message { Section { Label(message, systemImage: "checkmark.circle") } }
                    if let preview {
                        Section("核对排期 · \(preview.items.count) 节") {
                            ForEach(Array(preview.items.enumerated()), id: \.offset) { _, item in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item["title"].string).font(.headline)
                                    Text(position(item, date: item["date"].string)).font(.footnote)
                                    Text(item["reason"].string).font(.footnote).foregroundStyle(.secondary)
                                }
                            }
                            Button("确认写入 \(preview.writable) 节") { Task { await schedule(record, preview: preview) } }
                                .buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(busy || preview.writable == 0)
                        }
                    }
                    Section {
                        if let error = issue { Text(error).font(.footnote).foregroundStyle(.red) }
                        Button(preview == nil ? "预览排入日历" : "重新核对排期") { Task { await check(record) } }.disabled(busy)
                    }
                }
                .navigationTitle(record.title).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { selected = nil; issue = nil }.disabled(busy) } }
            }.presentationDragIndicator(.visible).interactiveDismissDisabled(busy)
        }
    }

    private func position(_ item: NativeJSON, date: String) -> String {
        "\(date) · 第 \(Int(item["week"].number)) 周 · 第 \(Int(item["day"].number)) 天"
    }

    private func load() async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        issue = nil
        do {
            let bytes = try await api.request("/api/programs", method: "GET", json: nil, for: owner)
            records = try JSONDecoder().decode(NativeJSON.self, from: bytes)["programs"].array.compactMap(Record.init)
        } catch { issue = error.localizedDescription }
    }

    private func check(_ record: Record) async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        message = nil; issue = nil; preview = nil
        do {
            let result = try await send(["action": .string("preview"), "id": .string(record.id), "revision": record.raw["revision"]])
            guard result["programId"].string == record.id, result["revision"] == record.raw["revision"], !result["token"].string.isEmpty else {
                throw NativeAPIError.invalidResponse
            }
            preview = Preview(raw: result)
        } catch { issue = error.localizedDescription }
    }

    private func schedule(_ record: Record, preview: Preview) async {
        guard !busy, preview.writable > 0 else { return }
        busy = true; defer { busy = false }
        issue = nil
        do {
            let result = try await send(["action": .string("commit"), "id": .string(record.id), "revision": record.raw["revision"],
                                         "previewToken": preview.raw["token"], "confirmed": .bool(true)])
            self.preview = nil
            message = "已更新日历。新增 \(Int(result["added"].number)) 节，更新 \(Int(result["updated"].number)) 节，保留或跳过 \(Int(result["skipped"].number)) 节。"
            await didSchedule()
        } catch { issue = error.localizedDescription }
    }

    private func send(_ fields: [String: NativeJSON]) async throws -> NativeJSON {
        let data = try await api.request("/api/programs", method: "POST", json: JSONEncoder().encode(NativeJSON.object(fields)), for: owner)
        return try JSONDecoder().decode(NativeJSON.self, from: data)
    }

    private struct Record: Identifiable {
        let raw: NativeJSON
        let id: String
        init?(_ raw: NativeJSON) {
            id = raw["id"].string
            guard !id.isEmpty, !raw["revision"].string.isEmpty else { return nil }
            self.raw = raw
        }
        var title: String { raw["title"].string }
        var summary: String { "\(raw["startDate"].string) 开始 · \(Int(raw["weeks"].number)) 周 · \(sessions.count) 节训练" }
        var sessions: [NativeJSON] { raw["sessions"].array.sorted { ($0["week"].number, $0["day"].number) < ($1["week"].number, $1["day"].number) } }
    }

    private struct Preview {
        let raw: NativeJSON
        var items: [NativeJSON] { raw["items"].array }
        var writable: Int { items.filter { ["new", "update"].contains($0["status"].string) }.count }
    }
}

private struct NativeProgramImport: View {
    let save: (NativeJSON) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var candidate: NativeJSON?
    @State private var files = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("周期 JSON") {
                    TextField("粘贴训练周期 JSON", text: $input, axis: .vertical).lineLimit(5...12)
                    Button("选择 JSON 文件") { files = true }
                    Button("检查内容") { prepare() }.disabled(input.isEmpty)
                }
                if let candidate {
                    Section("核对导入") {
                        Text(candidate["title"].string).font(.headline)
                        Text("\(candidate["startDate"].string) 开始 · \(Int(candidate["weeks"].number)) 周 · \(candidate["sessions"].array.count) 节训练")
                        Button("保存为新周期草稿") { Task { await submit(candidate) } }
                    }
                }
                if let error { Text(error).font(.footnote).foregroundStyle(.red) }
            }
            .disabled(busy).navigationTitle("导入周期草稿").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        }
        .interactiveDismissDisabled(busy)
        .onChange(of: input) { _ in candidate = nil; error = nil }
        .fileImporter(isPresented: $files, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let file = try FileHandle(forReadingFrom: url)
                defer { try? file.close() }
                let bytes = try file.read(upToCount: 1_300_001) ?? Data()
                guard let text = String(data: bytes, encoding: .utf8), bytes.count <= 1_300_000 else { throw Self.invalid }
                input = text
            } catch { self.error = error.localizedDescription }
        }
    }

    private static let invalid = NativePlanImport.Problem("请选择有效的 Spotter 周期 JSON，单份最多 1.3 MB。")

    private func prepare() {
        candidate = nil; error = nil
        do {
            let raw = input.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{feff}")))
            guard raw.utf8.count <= 1_300_000 else { throw Self.invalid }
            let source = try JSONDecoder().decode(NativeJSON.self, from: Data(raw.utf8))
            let wrapped = source["format"].string == "spotter-program" && source["version"].number == 1
            guard wrapped || source["format"] == .null else { throw Self.invalid }
            var program = wrapped ? source["program"] : source
            let phases = program["phases"].array
            let sessions = program["sessions"].array
            guard !program["title"].string.isEmpty, !program["startDate"].string.isEmpty, (1...52).contains(program["weeks"].number),
                  phases.count <= 52, (1...364).contains(sessions.count), Set(phases.map { $0["id"].string }).count == phases.count else { throw Self.invalid }
            let programID = UUID().uuidString.lowercased()
            let phaseIDs = Dictionary(uniqueKeysWithValues: phases.map { ($0["id"].string, UUID().uuidString.lowercased()) })
            program["id"] = .string(programID)
            program["phases"] = .array(phases.map { phase in
                var updated = phase; updated["id"] = .string(phaseIDs[phase["id"].string] ?? ""); return updated
            })
            program["sessions"] = .array(try sessions.map { item in
                var updated = item.object
                var plan = item["plan"].object
                let id = UUID().uuidString.lowercased()
                if item["phaseId"] != .null, phaseIDs[item["phaseId"].string] == nil { throw Self.invalid }
                let phase = phaseIDs[item["phaseId"].string].map(NativeJSON.string)
                updated["id"] = .string(id); updated["phaseId"] = phase
                plan["programId"] = .string(programID); plan["programSessionId"] = .string(id); plan["phaseId"] = phase
                plan["shared"] = .bool(false); plan["templateId"] = nil; plan["ownExercises"] = nil
                try NativePlanImport.validate(.object(plan))
                updated["plan"] = .object(plan)
                return .object(updated)
            })
            candidate = program
        } catch { self.error = error is DecodingError ? Self.invalid.localizedDescription : error.localizedDescription }
    }

    private func submit(_ candidate: NativeJSON) async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        do { try await save(candidate); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
