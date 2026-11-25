import SwiftUI
import UniformTypeIdentifiers

@MainActor
struct NativeProgramsView: View {
    let api: NativeAPI
    let owner: String
    let didSchedule: @MainActor () async -> Void
    var store: NativeWorkoutStore? = nil

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var records: [NativeProgramRecord] = []
    @State private var rules = NativeProgramService.Rules(rules: NativeProgramRules(), revision: nil)
    @State private var templates: [NativeProgramTemplate] = []
    @State private var sheet: Sheet?
    @State private var nextEditor: NativeProgramRecord?
    @State private var busy = false
    @State private var hasLoaded = false
    @State private var message: String?
    @State private var issue: String?
    @State private var templateIssue: String?

    private var service: NativeProgramService { .init(api: api, owner: owner) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                Text("训练周期").font(.largeTitle.weight(.heavy)).accessibilityAddTraits(.isHeader)
                actions
                if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
                if let message { Label(message, systemImage: "checkmark.circle").font(.footnote).foregroundStyle(accent.tint) }
                if busy { ProgressView("正在读取训练周期…").frame(maxWidth: .infinity) }
                if hasLoaded, records.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("还没有训练周期", systemImage: "calendar").font(.headline)
                        Text("选择每周训练日，使用个人模板或填写训练，再核对排期。")
                            .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
                }
                ForEach(records) { record in recordCard(record) }
            }.padding(14)
        }
        .background(SpotterPalette.background.ignoresSafeArea()).foregroundStyle(SpotterPalette.ink)
        .navigationBarTitleDisplayMode(.inline).toolbar(.visible, for: .navigationBar)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        .refreshable { await load() }.task { await load() }
        .sheet(item: $sheet, onDismiss: openNextEditor) { route in
            NavigationStack {
                switch route {
                case .create:
                    NativeCreateProgram(templates: templates, templateIssue: templateIssue, store: store, save: create)
                case .importDraft:
                    NativeProgramImport(save: create)
                case .rules:
                    NativeProgramRulesEditor(value: rules.rules) { next in
                        rules = try await service.saveRules(next, revision: rules.revision)
                        message = "编排偏好已保存。"
                    }
                case .edit(let record):
                    NativeTrainingProgramEditor(record: record, rules: rules.rules, store: store, templates: templates, service: service,
                                                didSave: keep, didRemove: remove, didSchedule: didSchedule)
                }
            }.presentationDragIndicator(.visible)
        }
    }

    private var actions: some View {
        HStack(spacing: 8) {
            Button { start(.create) } label: { Label("新建周期", systemImage: "plus") }
                .buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(busy || !hasLoaded)
            Menu {
                Button("导入周期", systemImage: "square.and.arrow.down") { start(.importDraft) }.disabled(busy || !hasLoaded)
                Button("编排偏好", systemImage: "slider.horizontal.3") { start(.rules) }.disabled(busy || !hasLoaded)
                Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } }.disabled(busy)
            } label: {
                Label("周期操作", systemImage: "ellipsis.circle").labelStyle(.iconOnly)
                    .font(.title3).frame(width: 44, height: 44)
            }.accessibilityLabel("周期操作")
        }
    }

    private func recordCard(_ record: NativeProgramRecord) -> some View {
        let program = record.program
        return Button { start(.edit(record)) } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .top) {
                    Text(program.title).font(.headline)
                    Spacer(minLength: 6)
                    Image(systemName: "chevron.right").font(.footnote).foregroundStyle(SpotterPalette.muted)
                }
                Text("\(program.startDate) 开始 · \(program.weeks) 周 · \(program.sessions.count) 节训练")
                    .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                Text(record.scheduledAt == nil ? "周期草稿 · 仅自己可见" : "已排入日历 · 仅自己可见")
                    .font(.caption.weight(.medium)).foregroundStyle(accent.tint)
                if !program.phases.isEmpty {
                    Text(program.phases.map { "\($0.name) · 第 \($0.fromWeek)–\($0.toWeek) 周" }.joined(separator: "  "))
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
        }.buttonStyle(.spotterPress).accessibilityHint("打开周期")
    }

    private func start(_ route: Sheet) {
        issue = nil
        message = nil
        sheet = route
    }

    private func load() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        issue = nil
        do {
            let result = try await service.load()
            records = result.programs
            rules = result.rules
            hasLoaded = true
        } catch { issue = error.localizedDescription }
        do {
            templates = try await service.loadTemplates()
            templateIssue = nil
        } catch {
            templateIssue = "暂时无法读取个人模板。你可以填写自定义训练。"
        }
    }

    private func create(_ program: NativeTrainingProgram) async throws {
        let record = try await service.save(program, revision: nil)
        keep(record)
        nextEditor = record
    }

    private func openNextEditor() {
        guard let nextEditor else { return }
        self.nextEditor = nil
        sheet = .edit(nextEditor)
    }

    private func keep(_ record: NativeProgramRecord) {
        records = [record] + records.filter { $0.id != record.id }
    }

    private func remove(_ record: NativeProgramRecord) {
        records.removeAll { $0.id == record.id }
        message = "周期草稿已移除。已排入日历的训练和历史记录已保留。"
    }

    private enum Sheet: Identifiable {
        case create, importDraft, rules, edit(NativeProgramRecord)
        var id: String {
            switch self {
            case .create: return "create"
            case .importDraft: return "import"
            case .rules: return "rules"
            case .edit(let record): return record.id
            }
        }
    }
}

struct NativeProgramTemplate: Identifiable {
    let id: String
    let plan: NativeJSON
    var title: String { plan["title"].string }
}

@MainActor
private struct NativeProgramService {
    let api: NativeAPI
    let owner: String

    struct Collection: Decodable { let programs: [NativeProgramRecord]; let rules: Rules }
    struct Rules: Decodable { let rules: NativeProgramRules; let revision: String? }
    struct Receipt: Decodable { let added: Int; let updated: Int; let skipped: Int }
    private struct Saved: Decodable { let program: NativeProgramRecord }
    private struct Removed: Decodable { let removed: Bool }

    func load() async throws -> Collection { try await read("/api/programs") }

    func loadTemplates() async throws -> [NativeProgramTemplate] {
        let response: NativeJSON = try await read("/api/library")
        return response["rows"].array.compactMap { row in
            guard row["kind"].string == "template", !row["id"].string.isEmpty, !row["plan"]["title"].string.isEmpty else { return nil }
            return NativeProgramTemplate(id: row["id"].string, plan: row["plan"])
        }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    func save(_ draft: NativeTrainingProgram, revision: String?) async throws -> NativeProgramRecord {
        try draft.validate()
        let response: Saved = try await send("save", object: ["program": try payload(draft), "revision": revision.map(NativeJSON.string) ?? .null])
        guard response.program.id == draft.id else { throw NativeAPIError.invalidResponse }
        return response.program
    }

    func preview(_ record: NativeProgramRecord) async throws -> NativeProgramPreview {
        let result: NativeProgramPreview = try await send("preview", object: identity(record))
        guard result.programId == record.id, result.revision == record.revision,
              result.token.range(of: #"^[a-f0-9]{64}$"#, options: .regularExpression) != nil else {
            throw NativeAPIError.invalidResponse
        }
        return result
    }

    func commit(_ record: NativeProgramRecord, preview: NativeProgramPreview) async throws -> Receipt {
        guard preview.programId == record.id, preview.revision == record.revision else { throw NativeAPIError.invalidResponse }
        var fields = identity(record)
        fields["previewToken"] = .string(preview.token)
        fields["confirmed"] = .bool(true)
        return try await send("commit", object: fields)
    }

    func saveRules(_ rules: NativeProgramRules, revision: String?) async throws -> Rules {
        try await send("rules", object: ["rules": try payload(rules.validated()), "revision": revision.map(NativeJSON.string) ?? .null])
    }

    func remove(_ record: NativeProgramRecord) async throws {
        let result: Removed = try await send("remove", object: identity(record))
        guard result.removed else { throw NativeAPIError.invalidResponse }
    }

    private func identity(_ record: NativeProgramRecord) -> [String: NativeJSON] {
        ["id": .string(record.id), "revision": .string(record.revision)]
    }

    private func read<Response: Decodable>(_ path: String) async throws -> Response {
        let data = try await api.request(path, method: "GET", json: nil, for: owner)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    private func send<Response: Decodable>(_ action: String, object: [String: NativeJSON]) async throws -> Response {
        var fields = object
        fields["action"] = .string(action)
        let data = try await api.request("/api/programs", method: "POST", json: JSONEncoder().encode(NativeJSON.object(fields)), for: owner)
        return try JSONDecoder().decode(Response.self, from: data)
    }

    private func payload(_ value: some Encodable) throws -> NativeJSON {
        try JSONDecoder().decode(NativeJSON.self, from: JSONEncoder().encode(value))
    }
}

@MainActor
private struct NativeTrainingProgramEditor: View {
    let rules: NativeProgramRules
    let store: NativeWorkoutStore?
    let templates: [NativeProgramTemplate]
    let service: NativeProgramService
    let didSave: (NativeProgramRecord) -> Void
    let didRemove: (NativeProgramRecord) -> Void
    let didSchedule: @MainActor () async -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var record: NativeProgramRecord
    @State private var draft: NativeTrainingProgram
    @State private var week = 1
    @State private var sheet: Sheet?
    @State private var confirm: Confirmation?
    @State private var busy = false
    @State private var issue: String?
    @State private var message: String?
    @State private var document: NativeProgramDocument?
    @State private var exporting = false

    init(record: NativeProgramRecord, rules: NativeProgramRules, store: NativeWorkoutStore?, templates: [NativeProgramTemplate],
         service: NativeProgramService, didSave: @escaping (NativeProgramRecord) -> Void, didRemove: @escaping (NativeProgramRecord) -> Void,
         didSchedule: @escaping @MainActor () async -> Void) {
        self.rules = rules
        self.store = store
        self.templates = templates
        self.service = service
        self.didSave = didSave
        self.didRemove = didRemove
        self.didSchedule = didSchedule
        _record = State(initialValue: record)
        _draft = State(initialValue: record.program)
    }

    private var dirty: Bool { record.program != draft }
    private var sessions: [NativeTrainingProgram.Session] { draft.sessions(in: week) }
    private var availableDays: [Int] { (1...7).filter { day in !sessions.contains { $0.day == day } } }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 13) {
                summary
                weekPicker
                weekContent
                if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
                if let message { Label(message, systemImage: "checkmark.circle").font(.footnote).foregroundStyle(accent.tint) }
            }.padding(14)
        }
        .background(SpotterPalette.background.ignoresSafeArea()).foregroundStyle(SpotterPalette.ink)
        .navigationTitle("编辑训练周期").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("全部周期", action: close).disabled(busy) }
            ToolbarItem(placement: .confirmationAction) { toolbarMenu }
        }
        .interactiveDismissDisabled(dirty || busy)
        .sheet(item: $sheet) { destination($0).presentationDragIndicator(.visible) }
        .alert("\(confirm?.title ?? "确认操作")", isPresented: Binding(get: { confirm != nil }, set: { if !$0 { confirm = nil } }), presenting: confirm) { action in
            Button(action.action, role: .destructive) { perform(action) }
            Button("取消", role: .cancel) { confirm = nil }
        } message: { action in Text(action.message) }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "spotter-program-\(draft.id)") { result in
            switch result {
            case .success: message = "周期及编排偏好已导出。"; issue = nil
            case .failure(let error): issue = error.localizedDescription
            }
            document = nil
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(draft.title).font(.title2.weight(.heavy)).accessibilityAddTraits(.isHeader)
            Text("\(draft.startDate) 开始 · \(draft.weeks) 周 · \(draft.sessions.count) 节训练")
                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            if dirty { Label("有未保存的修改", systemImage: "circle.dotted").font(.footnote.weight(.semibold)) }
            HStack(alignment: .top, spacing: 9) {
                Button("保存草稿") { Task { await act { _ = try await saveDraft(); message = "周期草稿已保存。" } } }
                    .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(!dirty || busy)
                Button(dirty ? "保存并预览排期" : "预览排入日历") { Task { await act { try await checkSchedule() } } }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(busy)
            }
            if busy { ProgressView().accessibilityLabel("正在处理周期") }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
    }

    private var weekPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(1...max(1, draft.weeks), id: \.self) { number in
                    weekButton(number)
                }
            }
        }.accessibilityLabel("周期周次")
    }

    private func weekButton(_ number: Int) -> some View {
        let selected = week == number
        return Button { week = number } label: {
            Text("第 \(number) 周").font(.footnote.weight(.semibold)).lineLimit(1)
                .padding(.horizontal, 12).frame(minHeight: 38)
                .foregroundStyle(selected ? SpotterPalette.deep : SpotterPalette.ink)
                .background(selected ? accent.fill : SpotterPalette.wash, in: Capsule())
        }.buttonStyle(.spotterPress).accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var weekContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("第 \(week) 周").font(.headline)
                    Text("\(draft.date(week: week, day: 1)) 至 \(draft.date(week: week, day: 7))")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                Spacer()
                if let phase = draft.phase(for: week) { NativeProgramPhaseBadge(phase: phase, showsWeeks: false) }
            }
            HStack(spacing: 10) {
                Button("复制这一周", systemImage: "document.on.document") { sheet = .copy }
                    .buttonStyle(.spotterPress).disabled(draft.weeks < 2 || sessions.isEmpty)
                Button("批量调整", systemImage: "slider.horizontal.3") { sheet = .adjust }
                    .buttonStyle(.spotterPress)
            }.font(.footnote.weight(.semibold)).foregroundStyle(accent.tint)
            if sessions.isEmpty { Text("这一周还没有训练。").font(.subheadline).foregroundStyle(SpotterPalette.muted) }
            ForEach(sessions) { sessionCard($0) }
            Menu {
                ForEach(availableDays, id: \.self) { day in
                    Button("第 \(day) 天 · \(draft.weekday(day))") {
                        sheet = .newSession(day)
                    }
                }
            } label: { Label("添加训练", systemImage: "plus.circle").font(.subheadline.weight(.semibold)) }
                .disabled(availableDays.isEmpty)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
            .disabled(busy)
    }

    private func sessionCard(_ session: NativeTrainingProgram.Session) -> some View {
        let plan = NativePlan(raw: session.plan)
        return VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plan.title).font(.body.weight(.semibold))
                    Text("\(plan.date) · 第 \(session.day) 天 · \(plan.category)")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                Spacer()
                Menu {
                    Button("编辑这一节", systemImage: "pencil") { sheet = .session(session) }
                    Button("从草稿移除", role: .destructive) { confirm = .session(session) }
                } label: { Image(systemName: "ellipsis.circle").frame(width: 44, height: 44) }
                    .accessibilityLabel("\(plan.title) 操作")
            }
            ForEach(Array(plan.exercises.enumerated()), id: \.offset) { _, move in
                Text("\(move["name"].string) · \(NativeProgramPlanEditor.prescription(move))")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            Text(["\(plan.exercises.count) 个动作", session.plan["minutes"].number > 0 ? "\(Int(session.plan["minutes"].number)) 分钟" : nil,
                  plan.video.isEmpty ? nil : "包含跟练视频", "仅自己可见"].compactMap { $0 }.joined(separator: " · "))
                .font(.caption2).foregroundStyle(SpotterPalette.muted)
            Button("编辑这一节") { sheet = .session(session) }.buttonStyle(.spotterPress)
                .font(.footnote.weight(.semibold)).foregroundStyle(accent.tint)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(12)
            .background(SpotterPalette.wash.opacity(0.45), in: RoundedRectangle(cornerRadius: 12))
    }

    private var toolbarMenu: some View {
        Menu {
            Button("周期信息与阶段", systemImage: "calendar.badge.clock") { sheet = .metadata }
            Button("导出周期", systemImage: "square.and.arrow.up", action: exportDraft)
            Button("重新读取云端版本", systemImage: "arrow.clockwise") {
                if dirty { confirm = .reload } else { Task { await act { try await reload() } } }
            }
            Button("移除此周期草稿", role: .destructive) { confirm = .remove }
        } label: { Label("编辑器操作", systemImage: "ellipsis.circle").labelStyle(.iconOnly) }
            .accessibilityLabel("编辑器操作").disabled(busy)
    }

    @ViewBuilder private func destination(_ route: Sheet) -> some View {
        NavigationStack {
            switch route {
            case .session(let session):
                NativeProgramPlanEditor(plan: session.plan, date: draft.date(week: session.week, day: session.day), store: store) { plan in
                    var updated = session
                    updated.plan = plan
                    draft.replace(updated)
                    message = nil
                    issue = nil
                }
            case .newSession(let day):
                let date = draft.date(week: week, day: day)
                NativeProgramPlanEditor(plan: NativePlanDraft(day: date).plan, date: date, store: store, templates: templates) { plan in
                    draft.replace(.init(week: week, day: day, plan: plan))
                    message = nil
                    issue = nil
                }
            case .metadata:
                NativeProgramMetadataEditor(draft: draft, save: change)
            case .copy:
                NativeProgramCopyWeek(draft: draft, week: week, save: change)
            case .adjust:
                NativeProgramAdjust(draft: draft, week: week, save: change)
            case .preview(let preview):
                NativeProgramPreviewScreen(preview: preview, refresh: { try await service.preview(record) }, commit: { current in
                    let receipt = try await service.commit(record, preview: current)
                    record.scheduledAt = ISO8601DateFormatter().string(from: .now)
                    didSave(record)
                    message = "已更新日历。新增 \(receipt.added) 节，更新 \(receipt.updated) 节，保留或跳过 \(receipt.skipped) 节。"
                    await didSchedule()
                })
            }
        }
    }

    private func change(_ next: NativeTrainingProgram) {
        draft = next
        week = min(week, next.weeks)
        message = nil
        issue = nil
    }

    private func saveDraft() async throws -> NativeProgramRecord {
        let saved = try await service.save(draft, revision: record.revision)
        record = saved
        draft = saved.program
        didSave(saved)
        return saved
    }

    private func checkSchedule() async throws {
        let current = dirty ? try await saveDraft() : record
        sheet = .preview(try await service.preview(current))
    }

    private func reload() async throws {
        let list = try await service.load()
        guard let newest = list.programs.first(where: { $0.id == record.id }) else {
            throw NativePlanImport.Problem("找不到这个周期，可能已在另一台设备移除。")
        }
        record = newest
        change(newest.program)
        didSave(newest)
        message = "已读取云端版本。"
    }

    private func exportDraft() {
        do {
            try draft.validate()
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            document = NativeProgramDocument(bytes: try encoder.encode(NativeProgramExport(program: draft, rules: rules)))
            exporting = true
        } catch { issue = error.localizedDescription }
    }

    private func close() {
        if dirty { confirm = .leave } else { dismiss() }
    }

    private func perform(_ action: Confirmation) {
        confirm = nil
        switch action {
        case .leave: dismiss()
        case .reload: Task { await act { try await reload() } }
        case .remove:
            Task { await act { try await service.remove(record); didRemove(record); dismiss() } }
        case .session(let session):
            var next = draft
            next.sessions.removeAll { $0.id == session.id }
            change(next)
        }
    }

    private func act(_ action: () async throws -> Void) async {
        guard !busy else { return }
        busy = true
        issue = nil
        message = nil
        defer { busy = false }
        do { try await action() }
        catch { issue = error.localizedDescription }
    }

    private enum Sheet: Identifiable {
        case session(NativeTrainingProgram.Session), newSession(Int), metadata, copy, adjust, preview(NativeProgramPreview)
        var id: String {
            switch self {
            case .session(let session): return session.id
            case .newSession(let day): return "day-\(day)"
            case .metadata: return "metadata"
            case .copy: return "copy"
            case .adjust: return "adjust"
            case .preview(let preview): return preview.id
            }
        }
    }

    private enum Confirmation {
        case remove, leave, reload, session(NativeTrainingProgram.Session)
        var title: String {
            switch self {
            case .remove: return "移除训练周期"
            case .leave, .reload: return "放弃未保存的修改？"
            case .session: return "移除草稿里的训练"
            }
        }
        var action: String {
            switch self {
            case .remove, .session: return "移除"
            case .leave: return "放弃并返回"
            case .reload: return "放弃并读取"
            }
        }
        var message: String {
            switch self {
            case .remove, .session: return "已排入日历的训练和打卡会保留。"
            case .leave: return "返回后会保留上一次保存的草稿。"
            case .reload: return "读取后会显示云端草稿。"
            }
        }
    }
}

private struct NativeProgramDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    let bytes: Data
    init(bytes: Data) { self.bytes = bytes }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        bytes = data
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: bytes) }
}

private struct NativeProgramPhaseBadge: View {
    let phase: NativeTrainingProgram.Phase
    var showsWeeks = true

    private var color: Color {
        switch phase.color {
        case .mint: return SpotterPalette.color(0xcfead9)
        case .lime: return SpotterPalette.color(0xe1efa9)
        case .lilac: return SpotterPalette.color(0xe5dafa)
        case .amber: return SpotterPalette.color(0xf9e1b9)
        }
    }

    var body: some View {
        Text(showsWeeks ? "\(phase.name) · 第 \(phase.fromWeek)–\(phase.toWeek) 周" : phase.name)
            .font(.caption.weight(.semibold)).foregroundStyle(SpotterPalette.color(0x18251d))
            .padding(.horizontal, 8).padding(.vertical, 5).background(color, in: Capsule())
    }
}

private struct NativeProgramMetadataFields: View {
    @Binding var draft: NativeTrainingProgram
    var creating = false

    var body: some View {
        Section("周期安排") {
            TextField("周期名称", text: $draft.title).onChange(of: draft.title) { draft.title = String($0.prefix(100)) }
            DatePicker("第一周开始日期", selection: Binding(get: { NativeTrainingProgram.pickerDate(draft.startDate) ?? .now }, set: {
                draft.startDate = NativeTrainingProgram.dayString($0, timeZone: .current)
            }), displayedComponents: .date)
            Stepper("\(draft.weeks) 周", value: $draft.weeks, in: 1...52)
                .accessibilityLabel("周期周数").accessibilityValue("\(draft.weeks) 周")
                .onChange(of: draft.weeks) { weeks in
                    if creating, draft.phases.count == 1, draft.phases[0].fromWeek == 1 { draft.phases[0].toWeek = weeks }
                }
        }
        Section {
            ForEach($draft.phases) { $phase in
                DisclosureGroup {
                    TextField("阶段名称", text: $phase.name)
                    Stepper("起始周  \(phase.fromWeek)", value: $phase.fromWeek, in: 1...52)
                    Stepper("结束周  \(phase.toWeek)", value: $phase.toWeek, in: 1...52)
                    Picker("阶段颜色", selection: $phase.color) {
                        ForEach(NativeTrainingProgram.Phase.Hue.allCases) { color in Text(color.title).tag(color) }
                    }
                    Button("移除阶段", role: .destructive) {
                        let id = phase.id
                        draft.phases.removeAll { $0.id == id }
                    }
                } label: { NativeProgramPhaseBadge(phase: phase) }
            }
            Button("添加阶段", systemImage: "plus.circle", action: addPhase).disabled(draft.phases.count >= 52)
        } header: { Text("训练阶段") } footer: { Text("阶段的起止周必须在周期内，阶段之间不能重叠。") }
    }

    private func addPhase() {
        let free = (1...draft.weeks).filter { week in !draft.phases.contains { $0.contains(week) } }
        let first = free.first ?? draft.weeks
        let last = (first...draft.weeks).prefix { free.contains($0) }.last ?? first
        draft.phases.append(.init(name: "新阶段", fromWeek: first, toWeek: last, color: .lilac))
    }
}

@MainActor
private struct NativeProgramMetadataEditor: View {
    let save: (NativeTrainingProgram) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var draft: NativeTrainingProgram
    @State private var issue: String?

    init(draft: NativeTrainingProgram, save: @escaping (NativeTrainingProgram) -> Void) {
        _draft = State(initialValue: draft)
        self.save = save
    }

    var body: some View {
        Form {
            NativeProgramMetadataFields(draft: $draft)
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
        }
        .navigationTitle("周期信息与阶段").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("应用") { apply() }.fontWeight(.bold) }
        }
    }

    private func apply() {
        do {
            var next = draft
            try next.relink()
            save(next)
            dismiss()
        } catch { issue = error.localizedDescription }
    }
}

@MainActor
private struct NativeCreateProgram: View {
    let templates: [NativeProgramTemplate]
    let templateIssue: String?
    let store: NativeWorkoutStore?
    let save: (NativeTrainingProgram) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterAccent) private var accent
    @State private var draft: NativeTrainingProgram
    @State private var days: [NativeTrainingProgram.BaseDay]
    @State private var editedDay: DayEditor?
    @State private var pending: NativeTrainingProgram?
    @State private var weeklyWeight = "0"
    @State private var weeklyReps = "0"
    @State private var deloadWeeks = ""
    @State private var deloadPercent = "80"
    @State private var busy = false
    @State private var issue: String?

    init(templates: [NativeProgramTemplate], templateIssue: String?, store: NativeWorkoutStore?, save: @escaping (NativeTrainingProgram) async throws -> Void) {
        self.templates = templates
        self.templateIssue = templateIssue
        self.store = store
        self.save = save
        let start = NativeTrainingProgram.dayString(.now, timeZone: .current)
        let draft = NativeTrainingProgram(startDate: start, phases: [.init(name: "训练阶段", fromWeek: 1, toWeek: 4, color: .mint)])
        _draft = State(initialValue: draft)
        _days = State(initialValue: [1, 3, 5].map { .init(day: $0, plan: NativePlanDraft(day: draft.date(week: 1, day: $0)).plan) })
    }

    var body: some View {
        Form {
            NativeProgramMetadataFields(draft: $draft, creating: true)
            weeklyDays
            progressionFields
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
            Button(busy ? "正在保存…" : "创建周期草稿") { Task { await submit() } }
                .buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(days.isEmpty || busy)
        }
        .disabled(busy).interactiveDismissDisabled(busy)
        .navigationTitle("新建训练周期").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        .sheet(item: $editedDay) { item in
            NavigationStack {
                if let day = days.first(where: { $0.day == item.day }) {
                    NativeProgramPlanEditor(plan: day.plan, date: draft.date(week: 1, day: item.day), store: store) { plan in
                        updateDay(item.day, templateID: nil, plan: plan)
                    }
                }
            }.presentationDragIndicator(.visible)
        }
        .onChange(of: draft) { _ in pending = nil }
        .onChange(of: days) { _ in pending = nil }
        .onChange(of: weeklyWeight) { _ in pending = nil }
        .onChange(of: weeklyReps) { _ in pending = nil }
        .onChange(of: deloadWeeks) { _ in pending = nil }
        .onChange(of: deloadPercent) { _ in pending = nil }
    }

    private var weeklyDays: some View {
        Section {
            HStack(spacing: 3) {
                ForEach(1...7, id: \.self) { day in
                    let selected = days.contains { $0.day == day }
                    Button { toggle(day) } label: {
                        Text(draft.weekday(day)).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity, minHeight: 38)
                            .foregroundStyle(selected ? SpotterPalette.deep : SpotterPalette.ink)
                            .background(selected ? accent.fill : SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 7))
                    }.buttonStyle(.spotterPress).accessibilityLabel("第 \(day) 天 · \(draft.weekday(day))")
                        .accessibilityAddTraits(selected ? [.isSelected] : [])
                }
            }
            if let templateIssue { Text(templateIssue).font(.footnote).foregroundStyle(SpotterPalette.muted) }
            ForEach(Array(days.enumerated()), id: \.element.day) { index, day in
                VStack(alignment: .leading, spacing: 7) {
                    Text("第 \(day.day) 天 · \(draft.weekday(day.day))").font(.subheadline.weight(.semibold))
                    if !templates.isEmpty {
                        Picker("个人模板", selection: Binding(get: { days.first { $0.day == day.day }?.templateID ?? "" }, set: { id in
                            let plan = templates.first { $0.id == id }?.plan ?? NativePlanDraft(day: draft.date(week: 1, day: day.day)).plan
                            updateDay(day.day, templateID: id.isEmpty ? nil : id, plan: plan)
                        })) {
                            Text("自定义训练").tag("")
                            ForEach(templates) { template in Text(template.title).tag(template.id) }
                        }
                    }
                    if !day.plan["title"].string.isEmpty { Text(day.plan["title"].string).font(.footnote).foregroundStyle(SpotterPalette.muted) }
                    Button("编辑训练", systemImage: "pencil") { editedDay = DayEditor(day: day.day) }.buttonStyle(.borderless)
                    if index > 0 {
                        Button("复制上一节内容", systemImage: "document.on.document") {
                            guard let current = days.firstIndex(where: { $0.day == day.day }), current > 0 else { return }
                            updateDay(day.day, templateID: nil, plan: days[current - 1].plan)
                        }.buttonStyle(.borderless)
                    }
                }
            }
        } header: { Text("每周训练") } footer: { Text("周期使用模板内容的副本。逐周编辑不会修改个人模板。") }
    }

    private var progressionFields: some View {
        Section("进阶与减量") {
            LabeledContent("每周重量变化") { TextField("0", text: $weeklyWeight).programNumberInput() }
            LabeledContent("每周次数变化") { TextField("0", text: $weeklyReps).programNumberInput() }
            TextField("减量周，例如 4，8", text: $deloadWeeks).keyboardType(.numbersAndPunctuation)
            LabeledContent("减量周保留重量 %") { TextField("80", text: $deloadPercent).programNumberInput() }
            Text("\(draft.weeks) 周 × 每周 \(days.count) 节，共 \(draft.weeks * days.count) 节草稿。未知重量保持为 0。")
                .font(.footnote).foregroundStyle(SpotterPalette.muted)
        }
    }

    private func toggle(_ day: Int) {
        if let index = days.firstIndex(where: { $0.day == day }) { days.remove(at: index) }
        else {
            days.append(.init(day: day, plan: NativePlanDraft(day: draft.date(week: 1, day: day)).plan))
            days.sort { $0.day < $1.day }
        }
    }

    private func updateDay(_ day: Int, templateID: String?, plan: NativeJSON) {
        guard let index = days.firstIndex(where: { $0.day == day }) else { return }
        days[index].templateID = templateID
        days[index].plan = NativeTrainingProgram.privatePlan(plan, date: draft.date(week: 1, day: day))
    }

    private func submit() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        issue = nil
        do {
            if pending == nil {
                guard let weight = nativeProgramDecimal(weeklyWeight), let reps = Int(weeklyReps.trimmingCharacters(in: .whitespacesAndNewlines)),
                      let percent = nativeProgramDecimal(deloadPercent) else { throw NativePlanImport.Problem("请填写有效的进阶与减量数值。") }
                let values = deloadWeeks.split { $0.isWhitespace || ",，、".contains($0) }
                let weeks = values.compactMap { Int($0) }
                guard weeks.count == values.count else { throw NativePlanImport.Problem("减量周次请用逗号分隔。") }
                var program = draft
                try program.build(days: days, progression: .init(weightPerWeek: weight, repsPerWeek: reps, deloadWeeks: Set(weeks), deloadPercent: percent))
                pending = program
            }
            if let pending { try await save(pending); dismiss() }
        } catch { issue = error.localizedDescription }
    }

    private struct DayEditor: Identifiable { let day: Int; var id: Int { day } }
}

@MainActor
private struct NativeProgramCopyWeek: View {
    let draft: NativeTrainingProgram
    let week: Int
    let save: (NativeTrainingProgram) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var targets: Set<Int>
    @State private var issue: String?

    init(draft: NativeTrainingProgram, week: Int, save: @escaping (NativeTrainingProgram) -> Void) {
        self.draft = draft
        self.week = week
        self.save = save
        _targets = State(initialValue: [week < draft.weeks ? week + 1 : 1])
    }

    var body: some View {
        Form {
            Section {
                ForEach((1...draft.weeks).filter { $0 != week }, id: \.self) { number in
                    Toggle("第 \(number) 周", isOn: Binding(get: { targets.contains(number) }, set: {
                        if $0 { targets.insert(number) } else { targets.remove(number) }
                    }))
                }
            } header: { Text("目标周次") } footer: { Text("复制会替换所选周的草稿内容，目标日期按周次计算。") }
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
            Button("确认复制") {
                do {
                    var next = draft
                    try next.copyWeek(week, to: targets)
                    save(next)
                    dismiss()
                } catch { issue = error.localizedDescription }
            }.buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(targets.isEmpty)
        }
        .navigationTitle("复制第 \(week) 周").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
    }
}

@MainActor
private struct NativeProgramAdjust: View {
    let draft: NativeTrainingProgram
    let save: (NativeTrainingProgram) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var from: Int
    @State private var through: Int
    @State private var mode = NativeTrainingProgram.WeightMode.delta
    @State private var weight = "0"
    @State private var reps = "0"
    @State private var issue: String?

    init(draft: NativeTrainingProgram, week: Int, save: @escaping (NativeTrainingProgram) -> Void) {
        self.draft = draft
        self.save = save
        _from = State(initialValue: week)
        _through = State(initialValue: week)
    }

    var body: some View {
        Form {
            Section("调整范围") {
                Stepper("开始周  \(from)", value: $from, in: 1...draft.weeks)
                    .onChange(of: from) { through = max($0, through) }
                Stepper("结束周  \(through)", value: $through, in: from...draft.weeks)
            }
            Section {
                Picker("重量调整方式", selection: $mode) {
                    ForEach(NativeTrainingProgram.WeightMode.allCases) { mode in Text(mode.title).tag(mode) }
                }.onChange(of: mode) { weight = $0 == .delta ? "0" : "80" }
                LabeledContent(mode == .delta ? "重量变化（原单位）" : "保留比例 %") { TextField("0", text: $weight).programNumberInput() }
                LabeledContent("次数变化") { TextField("0", text: $reps).programNumberInput() }
            } header: { Text("训练调整") } footer: { Text("未知重量保持为 0。计时动作的次数保持原样。改动重量时会清除原百分比负荷。") }
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
            Button("应用到草稿", action: apply).buttonStyle(SpotterNativeButtonStyle(primary: true))
        }
        .navigationTitle("批量调整周期草稿").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
    }

    private func apply() {
        do {
            guard let weight = nativeProgramDecimal(weight), let reps = Int(reps.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                throw NativePlanImport.Problem("请填写有效的重量和次数变化。")
            }
            var next = draft
            try next.adjust(from: from, through: through, mode: mode, weight: weight, reps: reps)
            save(next)
            dismiss()
        } catch { issue = error.localizedDescription }
    }
}

@MainActor
private struct NativeProgramRulesEditor: View {
    let save: (NativeProgramRules) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var draft: NativeProgramRules
    @State private var avoid: String
    @State private var busy = false
    @State private var issue: String?

    init(value: NativeProgramRules, save: @escaping (NativeProgramRules) async throws -> Void) {
        self.save = save
        _draft = State(initialValue: value)
        _avoid = State(initialValue: value.avoid.joined(separator: "\n"))
    }

    var body: some View {
        Form {
            Section {
                TextField("训练原则", text: $draft.principles, axis: .vertical).lineLimit(3...6)
                    .onChange(of: draft.principles) { draft.principles = String($0.prefix(4000)) }
                TextField("进阶习惯", text: $draft.progression, axis: .vertical).lineLimit(3...6)
                    .onChange(of: draft.progression) { draft.progression = String($0.prefix(2000)) }
                TextField("可用器械", text: $draft.equipment, axis: .vertical).lineLimit(3...6)
                    .onChange(of: draft.equipment) { draft.equipment = String($0.prefix(1000)) }
                TextField("需要避开的动作，每行一个", text: $avoid, axis: .vertical).lineLimit(3...8)
            } footer: { Text("偏好仅你可见，授权的 AI Agent 可以读取。") }
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
        }
        .disabled(busy).interactiveDismissDisabled(busy)
        .navigationTitle("我的编排偏好").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) { Button("保存偏好") { Task { await submit() } }.disabled(busy) }
        }
    }

    private func submit() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            draft.avoid = avoid.components(separatedBy: .newlines)
            try await save(draft.validated())
            dismiss()
        } catch { issue = error.localizedDescription }
    }
}

@MainActor
private struct NativeProgramPreviewScreen: View {
    let refresh: () async throws -> NativeProgramPreview
    let commit: (NativeProgramPreview) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var preview: NativeProgramPreview
    @State private var busy = false
    @State private var issue: String?
    @State private var expanded = false

    init(preview: NativeProgramPreview, refresh: @escaping () async throws -> NativeProgramPreview,
         commit: @escaping (NativeProgramPreview) async throws -> Void) {
        _preview = State(initialValue: preview)
        self.refresh = refresh
        self.commit = commit
    }

    var body: some View {
        List {
            Section("排期结果") {
                LabeledContent("新增", value: preview.added.formatted())
                LabeledContent("更新", value: preview.updated.formatted())
                LabeledContent("保留原内容", value: preview.retained.formatted())
                LabeledContent("无需写入或跳过", value: preview.skipped.formatted())
            }
            Section("核对排期 · \(preview.items.count) 节") {
                ForEach(expanded ? preview.items : Array(preview.items.prefix(12))) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(item.title).font(.subheadline.weight(.semibold)); Spacer(); Text(item.status.title).font(.caption) }
                        Text("\(item.date) · 第 \(item.week) 周 · 第 \(item.day) 天").font(.caption)
                        Text(item.reason).font(.caption).foregroundStyle(SpotterPalette.muted)
                    }
                }
                if !expanded && preview.items.count > 12 { Button("查看全部 \(preview.items.count) 节训练") { expanded = true } }
            }
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
            Section {
                Button("重新核对排期") { Task { await act { preview = try await refresh() } } }.disabled(busy)
                Button(preview.writable == 0 ? "无需写入" : "确认写入 \(preview.writable) 节") {
                    Task { await act { try await commit(preview); dismiss() } }
                }.buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(busy || preview.writable == 0)
            } footer: { Text("已进行、已完成及单独改过的训练会保留。日历有新修改时，需重新核对后再确认。") }
        }
        .navigationTitle("核对周期排期").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() }.disabled(busy) } }
        .interactiveDismissDisabled(busy)
    }

    private func act(_ action: () async throws -> Void) async {
        guard !busy else { return }
        busy = true
        issue = nil
        defer { busy = false }
        do { try await action() }
        catch { issue = error.localizedDescription }
    }
}

@MainActor
private struct NativeProgramImport: View {
    let save: (NativeTrainingProgram) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var candidate: NativeTrainingProgram?
    @State private var files = false
    @State private var busy = false
    @State private var issue: String?

    var body: some View {
        Form {
            Section("周期 JSON") {
                TextField("粘贴训练周期 JSON", text: $input, axis: .vertical).lineLimit(5...12)
                Button("选择 JSON 文件") { files = true }
                Button("检查内容", action: prepare).disabled(input.isEmpty)
            }
            if let candidate {
                Section("核对导入") {
                    Text(candidate.title).font(.headline)
                    Text("\(candidate.startDate) 开始 · \(candidate.weeks) 周 · \(candidate.sessions.count) 节训练")
                    Button("保存为新周期草稿") { Task { await submit(candidate) }
                    }.buttonStyle(SpotterNativeButtonStyle(primary: true))
                }
            }
            if let issue { Text(issue).font(.footnote).foregroundStyle(.red) }
        }
        .disabled(busy).interactiveDismissDisabled(busy)
        .navigationTitle("导入周期草稿").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) } }
        .onChange(of: input) { _ in candidate = nil; issue = nil }
        .fileImporter(isPresented: $files, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let file = try FileHandle(forReadingFrom: url)
                defer { try? file.close() }
                let bytes = try file.read(upToCount: 1_300_001) ?? Data()
                guard bytes.count <= 1_300_000, let text = String(data: bytes, encoding: .utf8) else {
                    throw NativePlanImport.Problem("请选择不超过 1.3 MB 的周期 JSON 文件。")
                }
                input = text
            } catch { issue = error.localizedDescription }
        }
    }

    private func prepare() {
        candidate = nil
        issue = nil
        do { candidate = try NativeTrainingProgram.importDraft(input) }
        catch is DecodingError { issue = "请选择 Spotter 周期 JSON，并检查文件内容是否完整。" }
        catch { issue = error.localizedDescription }
    }

    private func submit(_ candidate: NativeTrainingProgram) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do { try await save(candidate); dismiss() }
        catch { issue = error.localizedDescription }
    }
}

private func nativeProgramDecimal(_ value: String) -> Double? {
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: Locale.current.decimalSeparator ?? ".", with: ".")
    guard let parsed = Double(normalized), parsed.isFinite else { return nil }
    return parsed
}

private extension View {
    func programNumberInput() -> some View {
        keyboardType(.numbersAndPunctuation).multilineTextAlignment(.trailing)
    }
}
