import CryptoKit
import Foundation
import SwiftUI

@MainActor
final class NativeWorkoutStore: ObservableObject {
    @Published private(set) var entries: [NativeWorkoutEntry] = []
    @Published private(set) var active: NativeWorkoutEntry?
    @Published private(set) var pendingCheckins: [NativeWorkoutEntry] = []
    @Published private(set) var isBusy = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var status = "正在连接"
    @Published private(set) var proteinProducts: [NativeJSON] = []
    @Published private(set) var defaultProteinProductID: String?
    let owner: String
    private let api: NativeAPI
    private let origin: String
    private let cacheURL: URL?
    private var draftTask: Task<Void, Never>?
    private var draftInFlight = false
    private var draftAgain = false
    private var uploading = false
    private var localRevision = 0

    var plans: [NativeWorkoutEntry] { entries.filter { $0.kind == "plan" } }
    var logs: [NativeWorkoutEntry] {
        let pendingIds = Set(pendingCheckins.map(\.id))
        return (pendingCheckins + entries.filter { $0.kind == "log" && $0.owner == owner && !pendingIds.contains($0.id) })
            .sorted { ($0.workoutWindow?.from ?? 0) > ($1.workoutWindow?.from ?? 0) }
    }
    var drafts: [NativeWorkoutEntry] { entries.filter { $0.kind == "draft" && $0.owner == owner && $0.id != active?.id } }
    var completedCount: Int { logs.count }
    var totalMinutes: Int { logs.reduce(0) { $0 + $1.durationMinutes } }
    var totalVolumeKg: Double { logs.reduce(0) { $0 + ($1.session?.volumeKg ?? 0) } }

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
        origin = api.origin
        let digest = SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/WorkoutRecovery", isDirectory: true)
        cacheURL = directory?.appendingPathComponent(digest + ".json")
        if let cacheURL, let data = try? Data(contentsOf: cacheURL), let saved = try? JSONDecoder().decode(Recovery.self, from: data),
           saved.owner == owner, saved.origin == api.origin {
            active = saved.active?.owner == owner && saved.active?.kind == "draft" ? saved.active : nil
            pendingCheckins = saved.pending.filter { $0.owner == owner && $0.kind == "log" }
            status = active != nil || !pendingCheckins.isEmpty ? "本机记录已恢复，等待同步" : "正在连接"
        }
    }

    private struct Recovery: Codable { let origin: String; let owner: String; let active: NativeWorkoutEntry?; let pending: [NativeWorkoutEntry] }

    @discardableResult
    private func persist() -> Bool {
        guard let cacheURL else { errorMessage = "无法保存本机恢复记录，请保持 App 打开并联网保存。"; return false }
        do {
            try FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                    attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            let recovery = Recovery(origin: origin, owner: owner, active: active, pending: pendingCheckins)
            try JSONEncoder().encode(recovery).write(to: cacheURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var values = URLResourceValues(); values.isExcludedFromBackup = true
            var url = cacheURL; try? url.setResourceValues(values)
            return true
        } catch { errorMessage = "本机恢复记录未保存，请保持 App 打开并联网保存。"; return false }
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let revision = localRevision
            let payload = try await api.request("/api/workout")
            guard revision == localRevision else { return }
            let value = try JSONDecoder().decode(NativeWorkoutState.self, from: payload)
            guard value.me.id == owner else { entries = []; throw NativeWorkoutProblem.accountChanged }
            entries = value.entries
            if let active, value.entries.contains(where: { $0.owner == owner && $0.kind == "log" && $0.id == active.id }) {
                self.active = nil
                persist()
            }
            status = "云端已连接"
            errorMessage = nil
            await loadProteinPreferences()
            await retryPending()
        } catch {
            status = "暂未连接云端"
            errorMessage = error.localizedDescription
        }
    }

    func loadProteinPreferences() async {
        do {
            let data = try await api.request("/api/library")
            let library = try JSONDecoder().decode(NativeJSON.self, from: data)
            let rows = library["rows"].array
            proteinProducts = rows.first { $0["kind"].string == "protein-warehouse" }?["products"].array ?? []
            defaultProteinProductID = rows.first { $0["kind"].string == "protein-preference" }?["defaultProductId"].string
        } catch { /* Training can continue; no guessed or stale recipe is selected after an unreadable warehouse. */
            proteinProducts = []
            defaultProteinProductID = nil
        }
    }

    var suggestedProteinProduct: NativeJSON? {
        if let preferred = proteinProducts.first(where: { $0["id"].string == defaultProteinProductID }) {
            if case .object = preferred["powder"] { return preferred }
            return nil
        }
        let complete = proteinProducts.filter { if case .object = $0["powder"] { return true }; return false }
        return complete.count == 1 ? complete[0] : nil
    }

    func setProteinConsumed(_ consumed: Bool, productID: String? = nil) {
        let product = productID.flatMap { id in proteinProducts.first { $0["id"].string == id } } ?? suggestedProteinProduct
        if consumed {
            guard let product, case .object = product["powder"] else { errorMessage = "请先在蛋白粉仓库保存营养配方，并选择这次喝的产品。"; return }
            mutate { $0.raw["proteinShake"] = .bool(true); $0.raw["proteinProduct"] = product }
        } else {
            mutate { session in
                var raw = session.raw.object
                raw.removeValue(forKey: "proteinShake"); raw.removeValue(forKey: "proteinProduct")
                session.raw = .object(raw)
            }
        }
    }

    func clearLocalData() {
        localRevision &+= 1
        draftTask?.cancel()
        active = nil; pendingCheckins = []; entries = []; proteinProducts = []; defaultProteinProductID = nil
        if let cacheURL { try? FileManager.default.removeItem(at: cacheURL) }
    }

    func start(plan: NativePlan, id: String) {
        guard active == nil, !isBusy else { return }
        let existing = drafts.first { $0.data["planId"].string == id && $0.day == NativeWorkoutSession.day() }
        if let existing { resume(existing); return }
        begin(NativeWorkoutSession.start(plan: plan, planId: id))
    }

    func startFreeWorkout() { guard active == nil, !isBusy else { return }; begin(.free()) }

    private func begin(_ session: NativeWorkoutSession) {
        active = NativeWorkoutEntry(id: UUID().uuidString.lowercased(), owner: owner, kind: "draft",
                                    updated: ISO8601DateFormatter().string(from: Date()), data: session.raw)
        errorMessage = nil
        changed()
    }

    func resume(_ entry: NativeWorkoutEntry) {
        guard active == nil, entry.owner == owner, entry.kind == "draft", let session = entry.session else { return }
        var restored = session
        // A draft opened from another device keeps saved elapsed time until explicitly resumed here.
        if restored.isRunning { restored.pause(at: Int(restored.raw["clock"]["runningSince"].number)) }
        restored.resume()
        active = entry
        active?.data = restored.raw
        errorMessage = nil
        changed()
    }

    func mutate(_ change: (inout NativeWorkoutSession) -> Void) {
        guard var current = active, !isBusy, var session = current.session else { return }
        change(&session)
        current.data = session.raw
        current.updated = ISO8601DateFormatter().string(from: Date())
        active = current
        changed()
    }

    func setNumber(move: Int, row: Int, key: String, value: Double) {
        guard value.isFinite else { return }
        let maximum = key == "weight" ? 2000.0 : key == "seconds" ? 18000.0 : 999.0
        let bounded = min(maximum, max(0, key == "weight" ? value : value.rounded()))
        mutate { $0.setLine(move: move, row: row, key: key, value: .number(bounded)) }
    }

    func toggleDone(move: Int, row: Int) {
        mutate { session in
            guard session.rows.indices.contains(move), session.rows[move].indices.contains(row) else { return }
            session.setLine(move: move, row: row, key: "done", value: .bool(!session.rows[move][row]["done"].bool))
        }
    }

    func setRightNumber(move: Int, row: Int, key: String, value: Double) {
        guard value.isFinite else { return }
        mutate { session in
            guard session.rows.indices.contains(move), session.rows[move].indices.contains(row) else { return }
            var right = session.rows[move][row]["right"]
            guard case .object = right else { return }
            right[key] = .number(min(key == "weight" ? 2000 : 999, max(0, key == "weight" ? value : value.rounded())))
            session.setLine(move: move, row: row, key: "right", value: right)
        }
    }

    func toggleClock() {
        mutate { session in if session.isRunning { session.pause() } else { session.resume() } }
    }

    private func changed() {
        persist()
        status = "草稿已保存到本机，等待同步"
        draftTask?.cancel()
        draftTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled else { return }
            await self?.saveDraft()
        }
    }

    private struct Upload: Encodable { let action: String; let expectedOwner: String; let id: String; let data: NativeJSON }
    private struct Receipt: Decodable { let data: NativeJSON; let updated: String }

    func saveDraft() async {
        guard !draftInFlight else { draftAgain = true; return }
        guard let snapshot = active, snapshot.kind == "draft" else { return }
        draftInFlight = true
        defer {
            draftInFlight = false
            if draftAgain { draftAgain = false; Task { [weak self] in await self?.saveDraft() } }
        }
        do {
            let revision = localRevision
            let body = Upload(action: "draft", expectedOwner: owner, id: snapshot.id, data: snapshot.data)
            _ = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
            guard revision == localRevision else { return }
            guard active?.id == snapshot.id, active?.kind == "draft" else { return }
            if active?.data == snapshot.data { status = "草稿已保存到云端" }
            else { draftAgain = true }
        } catch {
            guard active?.id == snapshot.id else { return }
            status = "草稿保留在本机，可联网重试"
            errorMessage = error.localizedDescription
        }
    }

    func finish() async {
        guard !isBusy, let current = active, let session = current.session else { return }
        do {
            let final = try session.finalizing()
            draftTask?.cancel()
            let checkin = NativeWorkoutEntry(id: current.id, owner: owner, kind: "log", updated: ISO8601DateFormatter().string(from: Date()), data: final.raw)
            let oldPending = pendingCheckins
            if !pendingCheckins.contains(where: { $0.id == checkin.id }) { pendingCheckins.append(checkin) }
            active = nil
            guard persist() else { active = current; pendingCheckins = oldPending; return }
            status = "打卡已保存在本机，正在上传"
            await retryPending()
        } catch { errorMessage = error.localizedDescription }
    }

    func retryPending() async {
        guard !uploading else { return }
        uploading = true
        isBusy = true
        defer { uploading = false; isBusy = false }
        for pending in pendingCheckins {
            guard pending.owner == owner else { continue }
            do {
                let revision = localRevision
                let body = Upload(action: "log", expectedOwner: owner, id: pending.id, data: pending.data)
                let payload = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
                guard revision == localRevision else { return }
                let receipt = try JSONDecoder().decode(Receipt.self, from: payload)
                let record = NativeWorkoutEntry(id: pending.id, owner: owner, kind: "log", updated: receipt.updated, data: receipt.data)
                entries.removeAll { $0.id == pending.id && $0.owner == owner }
                entries.insert(record, at: 0)
                pendingCheckins.removeAll { $0.id == pending.id }
                persist()
                errorMessage = nil
                status = "训练已打卡并保存到云端"
            } catch {
                status = "打卡已保存在本机，等待重试"
                errorMessage = error.localizedDescription
                return
            }
        }
    }
}

private let nativeWorkoutGreen = Color(red: 0.13, green: 0.30, blue: 0.20)

struct NativeWorkoutView: View {
    @ObservedObject var store: NativeWorkoutStore
    var showsAllPlans = false
    @Environment(\.scenePhase) private var phase
    @State private var date = Date()
    @State private var opensWorkout = false

    private var visiblePlans: [NativeWorkoutEntry] {
        showsAllPlans ? store.plans.sorted { $0.day < $1.day } : store.plans.filter { $0.day == NativeWorkoutSession.day(date) }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Text(store.active == nil ? "今天练什么？" : "训练进行中").font(.system(size: 29, weight: .bold, design: .rounded))
                    Text(store.active?.title ?? "按计划开始，或创建一次自由训练。")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.8))
                    if let active = store.active {
                        Button { opensWorkout = true } label: { Label("继续训练", systemImage: "play.fill").fontWeight(.semibold) }
                            .buttonStyle(.borderedProminent).tint(Color(red: 0.77, green: 0.96, blue: 0.49)).foregroundStyle(nativeWorkoutGreen)
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            Text(Self.duration(active.session?.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000)) ?? 0))
                                .font(.system(.title2, design: .monospaced)).foregroundStyle(.white)
                        }
                    } else {
                        Button { store.startFreeWorkout(); opensWorkout = true } label: { Label("开始自由训练", systemImage: "plus") }
                            .buttonStyle(.borderedProminent).tint(Color(red: 0.77, green: 0.96, blue: 0.49)).foregroundStyle(nativeWorkoutGreen)
                            .disabled(store.isBusy)
                    }
                }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
            }.listRowBackground(nativeWorkoutGreen).foregroundStyle(.white)

            if !store.pendingCheckins.isEmpty {
                Section("待同步打卡") {
                    Text("\(store.pendingCheckins.count) 条打卡保存在此账号的本机记录中。联网重试沿用同一编号，不会重复打卡。")
                        .font(.subheadline).foregroundStyle(.secondary)
                    Button("重试上传") { Task { await store.retryPending() } }.disabled(store.isBusy)
                }
            }
            Section(showsAllPlans ? "训练计划" : "当天计划") {
                if !showsAllPlans { DatePicker("日期", selection: $date, displayedComponents: .date) }
                if visiblePlans.isEmpty { Text("这一天还没有训练计划。可以直接开始自由训练。").foregroundStyle(.secondary) }
                ForEach(visiblePlans) { entry in
                    VStack(alignment: .leading, spacing: 9) {
                        Text(entry.title).font(.headline)
                        Text("\(entry.day) · \(entry.data["category"].string) · \(entry.data["exercises"].array.count) 个动作")
                            .font(.caption).foregroundStyle(.secondary)
                        Button("开始这次训练") { store.start(plan: NativePlan(raw: entry.data), id: entry.id); opensWorkout = true }
                            .buttonStyle(.bordered).disabled(store.active != nil || store.isBusy)
                    }.padding(.vertical, 4)
                }
            }
            if !store.drafts.isEmpty {
                Section("未完成训练") {
                    ForEach(store.drafts) { draft in
                        Button { store.resume(draft); opensWorkout = true } label: {
                            VStack(alignment: .leading) { Text(draft.title); Text(draft.day).font(.caption).foregroundStyle(.secondary) }
                        }.disabled(store.active != nil || store.isBusy)
                    }
                }
            }
            Section {
                Label(store.status, systemImage: "icloud").font(.footnote).foregroundStyle(.secondary)
                if let error = store.errorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
            }
        }
        .listStyle(.insetGrouped).tint(nativeWorkoutGreen)
        .navigationTitle(showsAllPlans ? "训练" : "今日")
        .refreshable { await store.load() }
        .task { await store.load() }
        .onChange(of: phase) { if $0 == .active { Task { await store.load() } } }
        .fullScreenCover(isPresented: $opensWorkout) { NavigationStack { NativeActiveWorkoutView(store: store) } }
    }

    static func duration(_ milliseconds: Int) -> String {
        let seconds = max(0, milliseconds / 1000)
        return String(format: "%02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60)
    }
}

private struct NativeActiveWorkoutView: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var newExercise = ""

    var body: some View {
        Group {
            if let entry = store.active, let session = entry.session {
                List {
                    Section {
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            Text(NativeWorkoutView.duration(session.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000))))
                                .font(.system(size: 38, weight: .semibold, design: .monospaced)).frame(maxWidth: .infinity)
                        }
                        Button(session.isRunning ? "暂停计时" : "继续计时") { store.toggleClock() }
                        Text("\(session.completedSets) 组已完成 · \(session.volumeKg.formatted(.number.precision(.fractionLength(0...1)))) kg 容量")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                        Section {
                            ForEach(Array((session.rows.indices.contains(index) ? session.rows[index] : []).enumerated()), id: \.offset) { row, line in
                                VStack(alignment: .leading, spacing: 9) {
                                    HStack {
                                        Text("第 \(row + 1) 组").font(.subheadline.weight(.semibold))
                                        Spacer()
                                        Button { store.toggleDone(move: index, row: row) } label: {
                                            Label(line["done"].bool ? "已完成" : "完成", systemImage: line["done"].bool ? "checkmark.circle.fill" : "circle")
                                        }.buttonStyle(.bordered).tint(line["done"].bool ? nativeWorkoutGreen : .secondary)
                                    }
                                    HStack(spacing: 16) {
                                        numeric("重量 \(move["unit"].string)", move: index, row: row, key: "weight", value: line["weight"].number)
                                        numeric("次数", move: index, row: row, key: "reps", value: line["reps"].number)
                                        numeric("秒数", move: index, row: row, key: "seconds", value: line["seconds"].number)
                                    }
                                    if case .object = line["right"] {
                                        HStack(spacing: 16) {
                                            rightNumeric("右侧 \(move["unit"].string)", move: index, row: row, key: "weight", value: line["right"]["weight"].number)
                                            rightNumeric("右侧次数", move: index, row: row, key: "reps", value: line["right"]["reps"].number)
                                        }
                                    }
                                }.padding(.vertical, 4)
                            }
                            Button { store.mutate { $0.addSet(move: index) } } label: { Label("增加一组", systemImage: "plus") }
                                .disabled((session.rows.indices.contains(index) ? session.rows[index].count : 30) >= 30)
                        } header: {
                            Text(move["name"].string)
                        } footer: {
                            Text([move["cue"].string, move["tempo"].string].filter { !$0.isEmpty }.joined(separator: " · "))
                        }
                    }
                    if !session.plan.video.isEmpty, let video = URL(string: session.plan.video) {
                        Section("跟练视频") {
                            Link("打开跟练视频", destination: video)
                            Toggle("已经完成视频跟练", isOn: Binding(get: { session.raw["finishedVideo"].bool }, set: { value in store.mutate { $0.raw["finishedVideo"] = .bool(value) } }))
                        }
                    }
                    Section("添加动作") {
                        TextField("动作名称", text: $newExercise)
                        Button("添加到本次训练") {
                            store.mutate { $0.addExercise(name: newExercise) }; newExercise = ""
                        }.disabled(newExercise.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || session.plan.exercises.count >= 30)
                    }
                    Section("训练笔记") {
                        TextField("记录训练感受", text: Binding(get: { session.raw["note"].string }, set: { value in store.mutate { $0.raw["note"] = .string(String(value.prefix(1500))) } }), axis: .vertical)
                            .lineLimit(3...8)
                    }
                    Section("蛋白粉") {
                        Toggle("已喝蛋白粉", isOn: Binding(get: { session.raw["proteinShake"].bool }, set: { store.setProteinConsumed($0) }))
                            .disabled(!session.raw["proteinShake"].bool && store.proteinProducts.isEmpty)
                        if session.raw["proteinShake"].bool {
                            Text(session.raw["proteinProduct"]["name"].string).font(.headline)
                            Text("\(session.raw["proteinProduct"]["scoopGrams"].number.formatted()) g 粉 · \(session.raw["proteinProduct"]["mixer"]["name"].string.isEmpty ? "水" : session.raw["proteinProduct"]["mixer"]["name"].string) \(session.raw["proteinProduct"]["cupMl"].number.formatted()) mL")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        if store.proteinProducts.count > 1 {
                            ForEach(Array(store.proteinProducts.enumerated()), id: \.offset) { _, product in
                                if case .object = product["powder"] {
                                    Button(product["name"].string) { store.setProteinConsumed(true, productID: product["id"].string) }
                                }
                            }
                        }
                        Text("按仓库中的这一款配方随本次打卡记入加餐，同一条训练重试不会重复记杯。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    Section {
                        Text(store.status).font(.footnote).foregroundStyle(.secondary)
                        if let error = store.errorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                        Button { Task { await store.finish(); if store.active == nil { dismiss() } } } label: {
                            HStack { Spacer(); Label("完成打卡", systemImage: "checkmark.circle.fill").fontWeight(.semibold); Spacer() }
                        }.buttonStyle(.borderedProminent).tint(nativeWorkoutGreen).disabled(store.isBusy)
                    }
                }
                .navigationTitle(entry.title).navigationBarTitleDisplayMode(.inline)
            } else { ContentUnavailableViewCompat(title: "训练已保存", detail: store.status) }
        }
        .tint(nativeWorkoutGreen)
        .task { await store.loadProteinPreferences() }
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("收起") { Task { await store.saveDraft() }; dismiss() } } }
    }

    private func numeric(_ title: String, move: Int, row: Int, key: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            TextField(title, value: Binding(get: { value }, set: { store.setNumber(move: move, row: row, key: key, value: $0) }), format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder).accessibilityLabel("第\(row + 1)组\(title)")
        }
    }

    private func rightNumeric(_ title: String, move: Int, row: Int, key: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            TextField(title, value: Binding(get: { value }, set: { store.setRightNumber(move: move, row: row, key: key, value: $0) }), format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder).accessibilityLabel("第\(row + 1)组\(title)")
        }
    }
}

struct NativeWorkoutHistoryView: View {
    @ObservedObject var store: NativeWorkoutStore
    var extraDetail: ((NativeWorkoutEntry) -> AnyView)? = nil

    var body: some View {
        List {
            if store.logs.isEmpty { Text("完成第一次训练后，在这里查看打卡。").foregroundStyle(.secondary) }
            ForEach(store.logs) { entry in
                NavigationLink {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            Text(entry.title).font(.largeTitle.bold())
                            Text(entry.day).foregroundStyle(.secondary)
                            HStack {
                                summary("分钟", value: entry.durationMinutes.formatted())
                                summary("完成组数", value: (entry.session?.completedSets ?? 0).formatted())
                                summary("容量 kg", value: (entry.session?.volumeKg ?? 0).formatted(.number.precision(.fractionLength(0...1))))
                            }
                            if !entry.data["note"].string.isEmpty { Text(entry.data["note"].string) }
                            if let session = entry.session {
                                ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(move["name"].string).font(.headline)
                                        ForEach(Array((session.rows.indices.contains(index) ? session.rows[index] : []).enumerated()), id: \.offset) { set, row in
                                            if row["done"].bool {
                                                Text("第\(set + 1)组 · \(row["weight"].number.formatted()) \(move["unit"].string) × \(Int(row["reps"].number))" + (row["seconds"].number > 0 ? " · \(Int(row["seconds"].number)) 秒" : ""))
                                                    .font(.subheadline).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }
                            if let extraDetail { extraDetail(entry) }
                        }.padding()
                    }.navigationTitle("训练详情").navigationBarTitleDisplayMode(.inline)
                } label: {
                    VStack(alignment: .leading, spacing: 6) { Text(entry.title).font(.headline); Text("\(entry.day) · \(entry.durationMinutes) 分钟").font(.caption).foregroundStyle(.secondary) }
                }
            }
        }.navigationTitle("打卡历史").tint(nativeWorkoutGreen).refreshable { await store.load() }.task { await store.load() }
    }

    private func summary(_ name: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) { Text(value).font(.title2.bold()); Text(name).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ContentUnavailableViewCompat: View {
    let title: String
    let detail: String
    var body: some View { VStack(spacing: 12) { Image(systemName: "checkmark.circle").font(.largeTitle); Text(title).font(.title2.bold()); Text(detail).foregroundStyle(.secondary) }.padding() }
}
