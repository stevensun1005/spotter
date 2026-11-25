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
    @Published private(set) var libraryRows: [NativeJSON] = []
    @Published private(set) var room: NativeJSON = .null
    @Published private(set) var viewerName = "我"
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
            room = value.room ?? .null
            viewerName = value.me.name ?? "我"
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
            libraryRows = rows
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

    func startFreeWorkout(kind: String = "strength") {
        guard active == nil, !isBusy else { return }
        var session = NativeWorkoutSession.free()
        if kind != "strength" {
            session.raw["plan"]["title"] = .string(kind == "incline" ? "爬坡走" : kind == "hiit" ? "HIIT 训练" : "有氧训练")
            session.raw["plan"]["category"] = .string("有氧训练")
        }
        if kind == "incline" { session.raw["cardio"] = .object(["activity": .string("incline-walk")]) }
        begin(session)
    }

    func addCatalogueExercise(_ move: NativeJSON) {
        if active == nil { startFreeWorkout() }
        mutate { session in
            session.addExercise(name: move["name"].string)
            var exercises = session.plan.exercises
            guard let last = exercises.indices.last else { return }
            if !move["id"].string.isEmpty { exercises[last]["catalogueId"] = move["id"] }
            if !move["en"].string.isEmpty { exercises[last]["sourceName"] = move["en"] }
            session.raw["plan"]["exercises"] = .array(exercises)
        }
    }

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
        if key == "rpe" {
            guard (1...10).contains(value), (value * 2).rounded() == value * 2 else { return }
            mutate { $0.setLine(move: move, row: row, key: key, value: .number(value)) }; return
        }
        let maximum = key == "weight" ? 2000.0 : key == "seconds" ? 18000.0 : 999.0
        let bounded = min(maximum, max(0, key == "weight" ? value : value.rounded()))
        mutate { $0.setLine(move: move, row: row, key: key, value: .number(bounded)) }
    }

    func toggleDone(move: Int, row: Int) {
        mutate { session in
            guard session.rows.indices.contains(move), session.rows[move].indices.contains(row) else { return }
            session.setLine(move: move, row: row, key: "done", value: .bool(!session.rows[move][row]["done"].bool))
            var raw = session.raw.object
            raw.removeValue(forKey: "rest")
            if session.rows[move][row]["done"].bool && session.rows.flatMap({ $0 }).contains(where: { !$0["done"].bool }) {
                let moveRest = session.plan.exercises[move]["restSeconds"]
                let rest = session.raw["defaultRestOverride"] != .null ? session.raw["defaultRestOverride"].number :
                    (moveRest != .null ? moveRest.number : session.plan.raw["defaultRestSeconds"] != .null ? session.plan.raw["defaultRestSeconds"].number : 30)
                if rest > 0 { raw["rest"] = .object(["until": .number(Double(session.elapsedMilliseconds()) + rest * 1000), "kind": .string("组间休息")]) }
            }
            session.raw = .object(raw)
        }
    }

    func toggleSetKind(move: Int, row: Int, kind: String) {
        mutate { session in
            guard session.rows.indices.contains(move), session.rows[move].indices.contains(row) else { return }
            var line = session.rows[move][row].object
            if line["kind"]?.string == kind { line.removeValue(forKey: "kind") } else { line["kind"] = .string(kind) }
            var rows = session.rows; rows[move][row] = .object(line); session.raw["rows"] = .array(rows.map(NativeJSON.array))
        }
    }

    func toggleRight(move: Int, row: Int) {
        mutate { session in
            guard session.rows.indices.contains(move), session.rows[move].indices.contains(row) else { return }
            var line = session.rows[move][row].object
            if line["right"] != nil { line.removeValue(forKey: "right") }
            else { line["right"] = .object(["weight": line["weight"] ?? .number(0), "reps": line["reps"] ?? .number(0)]) }
            var rows = session.rows; rows[move][row] = .object(line); session.raw["rows"] = .array(rows.map(NativeJSON.array))
        }
    }

    func convertUnit(move: Int) {
        guard let session = active?.session, session.plan.exercises.indices.contains(move) else { return }
        let unit = session.plan.exercises[move]["unit"].string
        let factor = unit == "kg" ? 1 / 0.45359237 : 0.45359237
        guard session.rows[move].allSatisfy({ max($0["weight"].number, $0["right"]["weight"].number) * factor <= 2000 }), session.plan.exercises[move]["weight"].number * factor <= 2000 else {
            errorMessage = "换算后超过单组可记录的最大重量。"; return
        }
        mutate { session in
            var moves = session.plan.exercises
            moves[move]["unit"] = .string(unit == "kg" ? "lb" : "kg")
            moves[move]["weight"] = .number((moves[move]["weight"].number * factor * 100).rounded() / 100)
            session.raw["plan"]["exercises"] = .array(moves)
            var rows = session.rows
            for index in rows[move].indices {
                rows[move][index]["weight"] = .number((rows[move][index]["weight"].number * factor * 100).rounded() / 100)
                if case .object = rows[move][index]["right"] { rows[move][index]["right"]["weight"] = .number((rows[move][index]["right"]["weight"].number * factor * 100).rounded() / 100) }
            }
            session.raw["rows"] = .array(rows.map(NativeJSON.array))
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

    func savePlan(id: String, data: NativeJSON, revision: String?) async -> String? {
        await savePlanItem(.object(["action": .string("plans"), "expectedOwner": .string(owner), "items": .array([
            .object(["id": .string(id), "data": data, "revision": revision.map(NativeJSON.string) ?? .null])
        ])]), path: "/api/workout")
    }

    func saveTemplate(id: String, data: NativeJSON, revision: String?) async -> String? {
        await savePlanItem(.object(["action": .string("save"), "expectedOwner": .string(owner), "revision": revision.map(NativeJSON.string) ?? .null,
                                  "data": .object(["kind": .string("template"), "id": .string(id), "plan": data])]), path: "/api/library")
    }

    private func savePlanItem(_ body: NativeJSON, path: String) async -> String? {
        guard !isBusy else { return "正在保存，请稍后重试。" }
        isBusy = true
        defer { isBusy = false }
        do {
            _ = try await api.request(path, method: "POST", json: JSONEncoder().encode(body))
            await load()
            return nil
        } catch { return error.localizedDescription }
    }
}

struct NativeWorkoutView: View {
    @ObservedObject var store: NativeWorkoutStore
    var showsAllPlans = false
    var openSettings: (() -> Void)? = nil
    var openNutrition: (() -> Void)? = nil
    var openAllPlans: (() -> Void)? = nil
    var openCoach: (() -> Void)? = nil
    var openFriends: (() -> Void)? = nil
    var openRest: (() -> Void)? = nil
    var openBody: (() -> Void)? = nil
    var homeNutrition: AnyView? = nil
    @Environment(\.scenePhase) private var phase
    @AppStorage("spotter.native.home.nutritionCollapsed") private var nutritionCollapsed = false
    @State private var selectedDate = Date()
    @State private var opensWorkout = false
    @State private var showsLaunch = false
    @State private var pendingLaunchKind: String?
    @State private var pendingLaunchAction: (() -> Void)?
    @State private var trainingTab = "我的计划"
    @State private var completedPlans = false
    @State private var showsMoves = false
    @State private var planEditor: NativePlanDraft?

    private var selectedDay: String { NativeWorkoutSession.day(selectedDate) }
    private var completedPlanIDs: Set<String> { Set(store.logs.map { $0.data["planId"].string }.filter { !$0.isEmpty }) }
    private var pendingPlans: [NativeWorkoutEntry] { store.plans.filter { !completedPlanIDs.contains($0.id) } }
    private var dayPlans: [NativeWorkoutEntry] {
        pendingPlans.filter { $0.day == selectedDay }.sorted { ($0.owner == store.owner ? 0 : 1) < ($1.owner == store.owner ? 0 : 1) }
    }
    private var dayCompleted: [NativeWorkoutEntry] { store.plans.filter { $0.day == selectedDay && completedPlanIDs.contains($0.id) } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if showsAllPlans { trainingLanding }
                else { todayLanding }
                if !store.pendingCheckins.isEmpty { pendingCard }
                if let message = store.errorMessage {
                    Button { Task { await store.load() } } label: {
                        Label(message, systemImage: "arrow.clockwise").font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 26)
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .tint(SpotterPalette.accent)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await store.load() }
        .task { await store.load() }
        .onChange(of: phase) { if $0 == .active { Task { await store.load() } } }
        .fullScreenCover(isPresented: $opensWorkout) { NativeActiveWorkoutView(store: store) }
        .sheet(item: $planEditor) { draft in
            NavigationStack {
                NativePlanEditorPanel(store: store, draft: draft) { day in
                    trainingTab = "我的计划"; completedPlans = false
                    if let date = nativePlanDate(day) { selectedDate = date }
                }
            }
        }
        .fullScreenCover(isPresented: $showsLaunch, onDismiss: {
            if let action = pendingLaunchAction { pendingLaunchAction = nil; action(); return }
            guard let kind = pendingLaunchKind else { return }
            pendingLaunchKind = nil
            if store.active == nil { store.startFreeWorkout(kind: kind) }
            opensWorkout = true
        }) {
            NativeTrainingLaunch(start: { kind in
                pendingLaunchKind = kind
                showsLaunch = false
            }, rest: openRest.map { action in { pendingLaunchAction = action; showsLaunch = false } },
               bodyAction: openBody.map { action in { pendingLaunchAction = action; showsLaunch = false } })
        }
    }

    @ViewBuilder private var todayLanding: some View {
        HStack(spacing: 8) {
            if nutritionCollapsed {
                nativeIconButton("fork.knife", label: "展开饮食记录") { nutritionCollapsed = false }
            }
            Button { showsLaunch = true } label: { Label("训练", systemImage: "play.fill").font(.system(size: 15, weight: .bold)) }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
            Spacer()
            nativeIconButton("gearshape", label: "设置") { openSettings?() }
        }
        if !nutritionCollapsed {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("饮食记录").font(.system(size: 18, weight: .bold))
                    Spacer()
                    Button { nutritionCollapsed = true } label: { Image(systemName: "xmark").frame(width: 44, height: 44) }
                        .foregroundStyle(SpotterPalette.muted).accessibilityLabel("收起饮食记录")
                }
                if let homeNutrition { homeNutrition }
                else {
                    Button { openNutrition?() } label: {
                        HStack { Label("查看今日饮食", systemImage: "fork.knife"); Spacer(); Image(systemName: "arrow.up.right") }
                            .padding(16).spotterCard()
                    }.buttonStyle(.plain)
                }
            }
        }
        partnerCard
        weekStrip
        HStack {
            Text(selectedDay == NativeWorkoutSession.day() ? "今日训练" : "\(shortDay(selectedDay))的训练")
                .font(.system(size: 18, weight: .bold))
            Spacer()
            Button { openAllPlans?() } label: { HStack(spacing: 2) { Text("全部计划"); Image(systemName: "chevron.right") }.font(.system(size: 13, weight: .semibold)) }
        }.padding(.top, 4)
        if selectedDay == NativeWorkoutSession.day() {
            if let active = store.active { draftRow(active, current: true) }
            ForEach(store.drafts) { entry in draftRow(entry, current: false) }
        }
        if let first = dayPlans.first {
            hero(first)
            if dayPlans.count > 1 { planRows(Array(dayPlans.dropFirst())) }
            if !first.data["exercises"].array.isEmpty { movementCard(first) }
            if let url = URL(string: first.data["video"].string), !first.data["video"].string.isEmpty {
                Link(destination: url) { Label("打开跟练视频", systemImage: "play.circle").frame(maxWidth: .infinity).padding(14).spotterCard() }
            }
        } else if dayCompleted.isEmpty {
            emptyCard(store.logs.contains { $0.day == selectedDay } && selectedDay == NativeWorkoutSession.day() ? "今天已完成打卡" : "这天还没有安排", symbol: "dumbbell")
        }
        if !dayCompleted.isEmpty { planRows(dayCompleted, completed: true) }
        weeklyCheckins
        Button { openCoach?() } label: {
            HStack(spacing: 12) {
                tile("sparkles", color: Color(red: 0.57, green: 0.45, blue: 0.78))
                VStack(alignment: .leading, spacing: 4) { Text("添加计划").font(.system(size: 16, weight: .bold)); Text("用 AI 起草训练计划").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(SpotterPalette.muted)
            }.padding(15).spotterCard()
        }.buttonStyle(.plain)
    }

    private var partnerCard: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 9) {
                tile("person.2", size: 36)
                Text("今日搭子打卡").font(.system(size: 17, weight: .bold))
                Spacer()
                if !store.room["partner"]["id"].string.isEmpty {
                    Text("\(todayMine ? 1 + (todayPartner ? 1 : 0) : (todayPartner ? 1 : 0)) / 2 已打卡")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(SpotterPalette.muted)
                }
            }
            HStack(spacing: 12) {
                member("我", initial: String(store.viewerName.prefix(1)), checked: todayMine, connected: true, purple: false)
                member(store.room["partner"]["name"].string.isEmpty ? "训练搭子" : store.room["partner"]["name"].string,
                       initial: String(store.room["partner"]["name"].string.prefix(1)), checked: todayPartner,
                       connected: !store.room["partner"]["id"].string.isEmpty, purple: true,
                       statusOverride: store.room["partnerTrainingShared"] == .bool(false) ? "打卡未公开" : nil)
            }
            Button { openFriends?() } label: {
                Label(store.room["partner"]["id"].string.isEmpty ? "连接训练搭子" : "看搭子打卡", systemImage: store.room["partner"]["id"].string.isEmpty ? "link" : "person.2")
                    .frame(maxWidth: .infinity)
            }.buttonStyle(SpotterNativeButtonStyle(primary: store.room["partner"]["id"].string.isEmpty))
        }.padding(14).spotterCard()
    }

    private var todayMine: Bool { store.logs.contains { $0.day == NativeWorkoutSession.day() } }
    private var todayPartner: Bool {
        let partner = store.room["partner"]["id"].string
        guard !partner.isEmpty, store.room["partnerTrainingShared"] != .bool(false) else { return false }
        return store.entries.contains { $0.owner == partner && $0.kind == "log" && $0.day == NativeWorkoutSession.day() } ||
            store.room["partnerCheckins"].array.contains { $0["date"].string == NativeWorkoutSession.day() && $0["count"].number > 0 }
    }

    private func member(_ name: String, initial: String, checked: Bool, connected: Bool, purple: Bool, statusOverride: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Group { if initial.isEmpty { Image(systemName: "person") } else { Text(initial).fontWeight(.bold) } }
                    .font(.system(size: 14)).frame(width: 32, height: 32)
                    .background(purple ? Color(red: 0.91, green: 0.87, blue: 0.97) : SpotterPalette.lime, in: Circle())
                    .foregroundStyle(SpotterPalette.deep)
                Text(name).font(.system(size: 14, weight: .bold)).lineLimit(1)
            }
            Label(statusOverride ?? (connected ? (checked ? "已打卡" : store.isLoading ? "同步中" : "未打卡") : "未连接"), systemImage: checked ? "checkmark" : "circle")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(checked ? SpotterPalette.accent : SpotterPalette.muted)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(11).background(SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
    }

    private var weekStrip: some View {
        VStack(spacing: 12) {
            HStack {
                Text("训练日程").font(.system(size: 18, weight: .bold))
                Spacer()
                Button { shiftWeek(-7) } label: { Image(systemName: "chevron.left").frame(width: 32, height: 32) }.accessibilityLabel("上一周")
                Button { shiftWeek(7) } label: { Image(systemName: "chevron.right").frame(width: 32, height: 32) }.accessibilityLabel("下一周")
            }
            HStack(spacing: 3) {
                ForEach(Array(weekDates.enumerated()), id: \.offset) { offset, date in
                    let day = NativeWorkoutSession.day(date)
                    Button { selectedDate = date; showsMoves = false } label: {
                        VStack(spacing: 4) {
                            Text("周\(["一", "二", "三", "四", "五", "六", "日"][offset])").font(.system(size: 11, weight: .semibold))
                            Text(date.formatted(.dateTime.day())).font(.system(size: 19, weight: .bold))
                            Circle().fill(SpotterPalette.accent).frame(width: 4, height: 4)
                                .opacity(store.plans.contains { $0.day == day } || store.logs.contains { $0.day == day } ? 1 : 0)
                        }.frame(maxWidth: .infinity).padding(.vertical, 7)
                            .foregroundStyle(day == selectedDay ? SpotterPalette.deep : SpotterPalette.muted)
                            .background(day == selectedDay ? SpotterPalette.lime : SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                    }.buttonStyle(.plain).accessibilityLabel(day)
                }
            }
        }.padding(14).spotterCard()
    }

    private var weekDates: [Date] {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let offset = (calendar.component(.weekday, from: selectedDate) + 5) % 7
        let first = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: selectedDate)) ?? selectedDate
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: first) }
    }
    private func shiftWeek(_ days: Int) { selectedDate = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) ?? selectedDate; showsMoves = false }

    private func hero(_ entry: NativeWorkoutEntry) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Circle().fill(SpotterPalette.lime).frame(width: 6, height: 6)
                    Text((entry.owner == store.owner ? "" : "搭子共享 · ") + entry.data["category"].string)
                        .font(.system(size: 12, weight: .bold))
                }.padding(.horizontal, 10).padding(.vertical, 6).background(SpotterPalette.deep.opacity(0.68), in: Capsule())
                    .overlay(Capsule().stroke(SpotterPalette.lime.opacity(0.3), lineWidth: 1))
                Text(entry.title).font(.system(size: 30, weight: .heavy)).tracking(-0.7).lineSpacing(1).frame(maxWidth: 280, alignment: .leading)
                HStack(spacing: 12) {
                    if entry.data["minutes"].number > 0 { Label("\(Int(entry.data["minutes"].number)) 分钟", systemImage: "clock") }
                    if !entry.data["exercises"].array.isEmpty { Label("\(entry.data["exercises"].array.count) 个动作", systemImage: "dumbbell") }
                    if !entry.data["video"].string.isEmpty { Label("跟练视频", systemImage: "play") }
                }.font(.system(size: 13)).foregroundStyle(.white.opacity(0.88))
                Button { store.start(plan: NativePlan(raw: entry.data), id: entry.id); opensWorkout = true } label: {
                    Label("开始计划训练", systemImage: "play.fill").font(.system(size: 15, weight: .bold))
                }.buttonStyle(SpotterNativeButtonStyle(primary: true)).padding(.top, 6).disabled(store.active != nil || store.isBusy)
            }
            .padding(18).frame(maxWidth: .infinity, minHeight: 232, alignment: .leading)
            .foregroundStyle(.white)
            .background {
                GeometryReader { size in
                    Image("TrainingHero").resizable().scaledToFill().frame(width: size.size.width, height: size.size.height).clipped()
                    LinearGradient(colors: [SpotterPalette.deep, SpotterPalette.deep.opacity(0.88), SpotterPalette.deep.opacity(0.1)], startPoint: .leading, endPoint: .trailing)
                }
            }
            if !entry.data["durationNote"].string.isEmpty {
                Text(entry.data["durationNote"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(SpotterPalette.card)
            }
        }.clipShape(RoundedRectangle(cornerRadius: 19))
            .overlay(alignment: .topTrailing) {
                if entry.owner == store.owner {
                    Menu { Button("编辑计划", systemImage: "pencil") { planEditor = NativePlanDraft(entry: entry) } } label: {
                        Image(systemName: "ellipsis").font(.system(size: 18, weight: .bold)).frame(width: 40, height: 40)
                            .foregroundStyle(.white).background(SpotterPalette.deep.opacity(0.8), in: RoundedRectangle(cornerRadius: 10))
                    }.padding(12)
                }
            }
    }

    private func movementCard(_ entry: NativeWorkoutEntry) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { showsMoves.toggle() } } label: {
                HStack { Text("动作清单").font(.system(size: 17, weight: .bold)); Spacer(); Text("\(entry.data["exercises"].array.count) 个动作").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted); Image(systemName: showsMoves ? "chevron.up" : "chevron.down") }
                    .padding(14)
            }.buttonStyle(.plain)
            if showsMoves {
                ForEach(Array(entry.data["exercises"].array.enumerated()), id: \.offset) { index, move in
                    HStack(alignment: .top, spacing: 10) {
                        Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string)
                            .font(.system(size: 13, weight: .bold)).frame(width: 34, height: 30).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 5) {
                            Text(move["name"].string).font(.system(size: 15, weight: .bold))
                            Text(prescription(move)).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                            if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }
                        }
                        Spacer(minLength: 0)
                    }.padding(.horizontal, 14).padding(.vertical, 10)
                    if index < entry.data["exercises"].array.count - 1 { Divider().overlay(SpotterPalette.line).padding(.horizontal, 14) }
                }
            }
        }.spotterCard()
    }

    private func draftRow(_ entry: NativeWorkoutEntry, current: Bool) -> some View {
        HStack(spacing: 10) {
            tile("clock", size: 34)
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title).font(.system(size: 14, weight: .bold))
                Text("\(entry.session?.completedSets ?? 0) 组完成 · \(current ? store.status : "训练草稿")").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
            }
            Spacer(minLength: 0)
            Button("继续") { if !current { store.resume(entry) }; opensWorkout = true }
                .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(!current && store.active != nil)
        }.padding(12).spotterCard()
    }

    private func planRows(_ entries: [NativeWorkoutEntry], completed: Bool = false) -> some View {
        VStack(spacing: 0) {
            ForEach(entries) { entry in
                HStack(spacing: 9) {
                    tile(completed ? "checkmark" : "dumbbell", size: 34)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.title).font(.system(size: 14, weight: .bold)).lineLimit(2)
                        Text("\(shortDay(entry.day)) · \(entry.data["category"].string)" + (entry.data["minutes"].number > 0 ? " · \(Int(entry.data["minutes"].number)) 分钟" : ""))
                            .font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 0)
                    if !completed {
                        Button("开始") { store.start(plan: NativePlan(raw: entry.data), id: entry.id); opensWorkout = true }
                            .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(store.active != nil || store.isBusy)
                    } else { Text("已完成").font(.system(size: 12, weight: .semibold)).foregroundStyle(SpotterPalette.accent) }
                    if entry.owner == store.owner {
                        Menu { Button("编辑计划", systemImage: "pencil") { planEditor = NativePlanDraft(entry: entry) } } label: { Image(systemName: "ellipsis").frame(width: 30, height: 35) }
                    }
                }.padding(.vertical, 10)
                if entry.id != entries.last?.id { Divider().overlay(SpotterPalette.line) }
            }
        }.padding(.horizontal, 12).spotterCard()
    }

    private var weeklyCheckins: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("近 7 天打卡").font(.system(size: 17, weight: .bold)); Spacer(); Text("\(store.logs.filter { $0.day >= NativeWorkoutSession.day(Calendar.current.date(byAdding: .day, value: -6, to: Date()) ?? Date()) }.count) 次").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
            HStack(spacing: 4) {
                Text("我").font(.system(size: 13, weight: .bold)).frame(width: 35, alignment: .leading)
                ForEach(0..<7) { offset in
                    let date = Calendar.current.date(byAdding: .day, value: offset - 6, to: Date()) ?? Date()
                    let done = store.logs.contains { $0.day == NativeWorkoutSession.day(date) }
                    VStack(spacing: 6) {
                        Text(["日", "一", "二", "三", "四", "五", "六"][Calendar(identifier: .gregorian).component(.weekday, from: date) - 1]).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                        Image(systemName: done ? "checkmark" : "circle.fill").font(.system(size: done ? 10 : 3, weight: .bold))
                            .frame(width: 24, height: 24).background(done ? SpotterPalette.lime.opacity(0.65) : SpotterPalette.wash, in: Circle())
                    }.frame(maxWidth: .infinity)
                }
            }
        }.padding(14).spotterCard()
    }

    @ViewBuilder private var trainingLanding: some View {
        HStack(spacing: 10) {
            HStack(spacing: 3) {
                ForEach(["我的计划", "个人模板", "动作库"], id: \.self) { tab in
                    Button { trainingTab = tab } label: {
                        Text(tab).font(.system(size: 13, weight: .semibold)).padding(.vertical, 10).frame(maxWidth: .infinity)
                            .foregroundStyle(trainingTab == tab ? SpotterPalette.deep : SpotterPalette.muted)
                            .background(trainingTab == tab ? SpotterPalette.lime : .clear, in: RoundedRectangle(cornerRadius: 7))
                    }.buttonStyle(.plain)
                }
            }.padding(3).background(SpotterPalette.wash.opacity(0.7), in: RoundedRectangle(cornerRadius: 10))
            Button { openFriends?() } label: { Label("好友", systemImage: "person.2").font(.system(size: 13, weight: .semibold)) }.buttonStyle(.plain)
        }
        if trainingTab == "我的计划" {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("全部计划").font(.system(size: 18, weight: .bold))
                    Spacer()
                    Button { openCoach?() } label: { Label("添加计划", systemImage: "sparkles").font(.system(size: 12, weight: .semibold)) }
                    Button { planEditor = NativePlanDraft(day: selectedDay) } label: { Label("新建计划", systemImage: "plus").font(.system(size: 12, weight: .semibold)) }
                        .buttonStyle(SpotterNativeButtonStyle(primary: true))
                }
                HStack(spacing: 4) {
                    ForEach([false, true], id: \.self) { completed in
                        Button { completedPlans = completed } label: {
                            Text(completed ? "已完成" : "待训练").font(.system(size: 13, weight: .semibold)).padding(.vertical, 9).frame(maxWidth: .infinity)
                                .foregroundStyle(completedPlans == completed ? SpotterPalette.deep : SpotterPalette.muted)
                                .background(completedPlans == completed ? SpotterPalette.lime : .clear, in: RoundedRectangle(cornerRadius: 7))
                        }.buttonStyle(.plain)
                    }
                }.padding(3).background(SpotterPalette.wash.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            }.padding(12).spotterCard()
            let visible = store.plans.filter { completedPlanIDs.contains($0.id) == completedPlans }.sorted { $0.day < $1.day }
            if visible.isEmpty { emptyCard(completedPlans ? "还没有已完成的计划" : "还没有训练计划", symbol: "list.clipboard") }
            else { planRows(visible, completed: completedPlans) }
            if let active = store.active { draftRow(active, current: true) }
        } else if trainingTab == "个人模板" {
            let templates = store.libraryRows.filter { $0["kind"].string == "template" }
            Button { planEditor = NativePlanDraft(day: selectedDay, template: true) } label: { Label("新建模板", systemImage: "plus") }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
            if templates.isEmpty { emptyCard("还没有个人模板", symbol: "bookmark", detail: "也可以从现有计划或已完成的打卡另存为模板。") }
            ForEach(Array(templates.enumerated()), id: \.offset) { _, template in
                VStack(alignment: .leading, spacing: 10) {
                    tile("list.clipboard", size: 34)
                    Text(template["plan"]["title"].string).font(.system(size: 17, weight: .bold))
                    Text("\(template["plan"]["category"].string) · \(template["plan"]["exercises"].array.count) 个动作").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                    Text(template["plan"]["exercises"].array.prefix(4).map { $0["name"].string }.joined(separator: "、")).font(.system(size: 13))
                    HStack {
                        Button("编辑") { planEditor = NativePlanDraft(template: template, day: selectedDay, schedule: false) }
                            .buttonStyle(SpotterNativeButtonStyle(primary: false))
                        Button { planEditor = NativePlanDraft(template: template, day: selectedDay, schedule: true) } label: { Label("安排训练", systemImage: "calendar.badge.plus") }
                            .buttonStyle(SpotterNativeButtonStyle(primary: true))
                    }.disabled(store.isBusy)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
            }
        } else { NativeCatalogueBrowser(store: store) { opensWorkout = true } }
    }

    private var pendingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("待同步打卡 · \(store.pendingCheckins.count) 条", systemImage: "icloud.and.arrow.up").font(.system(size: 15, weight: .semibold))
            Text("打卡已保存在本机，联网重试不会重复记录。").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
            Button("重试上传") { Task { await store.retryPending() } }.buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(store.isBusy)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard()
    }

    private func emptyCard(_ title: String, symbol: String, detail: String? = nil) -> some View {
        VStack(spacing: 12) {
            tile(symbol, size: 46)
            Text(title).font(.system(size: 17, weight: .bold))
            if let detail { Text(detail).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted).multilineTextAlignment(.center) }
        }.frame(maxWidth: .infinity).padding(.vertical, 30).padding(.horizontal, 18).spotterCard()
    }

    static func duration(_ milliseconds: Int) -> String {
        let seconds = max(0, milliseconds / 1000)
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

struct SpotterNativeButtonStyle: ButtonStyle {
    var primary: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 13).padding(.vertical, 11)
            .foregroundStyle(primary ? SpotterPalette.deep : SpotterPalette.ink)
            .background(primary ? SpotterPalette.lime : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(primary ? SpotterPalette.lime : SpotterPalette.line, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

private func tile(_ symbol: String, size: CGFloat = 40, color: Color? = nil) -> some View {
    Image(systemName: symbol).font(.system(size: size * 0.45, weight: .semibold)).frame(width: size, height: size)
        .foregroundStyle(color ?? SpotterPalette.accent).background((color ?? SpotterPalette.accent).opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
}

private func nativeIconButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) { Image(systemName: symbol).font(.system(size: 19)).frame(width: 44, height: 44).background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12)) }
        .buttonStyle(.plain).foregroundStyle(SpotterPalette.ink).accessibilityLabel(label)
}

private func shortDay(_ day: String) -> String {
    let parts = day.split(separator: "-")
    guard parts.count == 3 else { return day }
    return "\(Int(parts[1]) ?? 0)月\(Int(parts[2]) ?? 0)日"
}

private func prescription(_ move: NativeJSON) -> String {
    let repetitions = move["seconds"].number > 0 ? "\(Int(move["seconds"].number)) 秒" : "\(Int(move["reps"].number)) 次"
    return "\(Int(move["sets"].number)) 组 × \(repetitions)" + (move["weight"].number > 0 ? " · \(move["weight"].number.formatted()) \(move["unit"].string)" : "")
}

private struct NativeTrainingLaunch: View {
    let start: (String) -> Void
    var rest: (() -> Void)?
    var bodyAction: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    private let choices = [("strength", "力量训练", "dumbbell", Color(red: 0.82, green: 0.93, blue: 0.64)),
                           ("cardio", "有氧训练", "waveform.path.ecg", Color(red: 0.65, green: 0.89, blue: 0.79)),
                           ("incline", "爬坡走", "figure.walk", Color(red: 0.67, green: 0.85, blue: 0.94)),
                           ("hiit", "HIIT 训练", "bolt", Color(red: 1, green: 0.86, blue: 0.59))]

    var body: some View {
        ZStack {
            SpotterPalette.deep.opacity(0.94).ignoresSafeArea()
            VStack {
                Spacer()
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 28) {
                    ForEach(choices, id: \.0) { choice in launchButton(choice.1, symbol: choice.2, color: choice.3) { start(choice.0) } }
                    launchButton("安排休息", symbol: "cup.and.saucer", color: Color(red: 0.79, green: 0.75, blue: 0.93)) { dismiss(); rest?() }.disabled(rest == nil)
                    launchButton("身体数据", symbol: "ruler", color: Color(red: 0.95, green: 0.76, blue: 0.67)) { dismiss(); bodyAction?() }.disabled(bodyAction == nil)
                }.padding(.horizontal, 26)
                Spacer()
                Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 19)).frame(width: 48, height: 48).background(.white, in: Circle()).foregroundStyle(SpotterPalette.deep) }
                    .accessibilityLabel("关闭开始训练").padding(.bottom, 20)
            }
        }
    }
    private func launchButton(_ title: String, symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 31, weight: .medium)).frame(width: 70, height: 70)
                    .background(color, in: RoundedRectangle(cornerRadius: 17)).foregroundStyle(SpotterPalette.deep)
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
        }.buttonStyle(.plain)
    }
}

private struct NativeCatalogueBrowser: View {
    @ObservedObject var store: NativeWorkoutStore
    var begin: () -> Void
    @State private var rows: [NativeJSON] = []
    @State private var search = ""
    @State private var part = "全部"
    @State private var limit = 60

    private var filtered: [NativeJSON] {
        rows.filter { row in
            let haystack = [row["name"].string, row["en"].string, row["part"].string, row["equipment"].string, row["target"].string].joined(separator: " ")
            let area = part == "全部" || haystack.localizedCaseInsensitiveContains(["胸": "chest", "背": "back", "腿": "legs", "肩": "shoulder", "手臂": "arms", "核心": "waist"][part] ?? part)
            return area && (search.isEmpty || haystack.localizedCaseInsensitiveContains(search))
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Image(systemName: "magnifyingglass").foregroundStyle(SpotterPalette.muted); TextField("搜索动作、部位或器械", text: $search).font(.system(size: 14)) }
                .padding(12).spotterCard()
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(["全部", "胸", "背", "腿", "肩", "手臂", "核心"], id: \.self) { value in
                        Button(value) { part = value; limit = 60 }.font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 14).padding(.vertical, 9)
                            .background(part == value ? SpotterPalette.lime : SpotterPalette.card, in: Capsule()).foregroundStyle(part == value ? SpotterPalette.deep : SpotterPalette.muted)
                    }
                }
            }
            Text("\(filtered.count) 个动作").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
            LazyVStack(spacing: 9) {
                ForEach(Array(filtered.prefix(limit).enumerated()), id: \.offset) { _, move in
                    NavigationLink {
                        NativeCatalogueDetail(move: move) { store.addCatalogueExercise(move); begin() }
                    } label: {
                        HStack(spacing: 12) {
                            tile("figure.strengthtraining.traditional", size: 42)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(move["name"].string).font(.system(size: 15, weight: .bold))
                                Text(move["en"].string).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted).lineLimit(1)
                                Text("\(move["part"].string) · \(move["equipment"].string)").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                            }
                            Spacer(minLength: 0); Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        }.padding(12).spotterCard()
                    }.buttonStyle(.plain)
                }
                if filtered.count > limit { Button("显示更多动作") { limit += 60 }.buttonStyle(SpotterNativeButtonStyle(primary: false)) }
                if rows.isEmpty { Text("暂时无法读取动作库。").font(.subheadline).foregroundStyle(SpotterPalette.muted) }
            }
        }
        .task {
            guard rows.isEmpty, let url = Bundle.main.url(forResource: "index", withExtension: "json"), let data = try? Data(contentsOf: url),
                  let catalogue = try? JSONDecoder().decode(NativeJSON.self, from: data) else { return }
            rows = catalogue["rows"].array
        }
    }
}

private struct NativeCatalogueDetail: View {
    let move: NativeJSON
    var add: () -> Void
    private var isBench: Bool { ["杠铃卧推", "杠铃平板卧推"].contains(move["name"].string) || move["en"].string.lowercased() == "barbell bench press" }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 17) {
                if isBench { Image("SpotterBench").resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 17)) }
                Text(move["name"].string).font(.system(size: 25, weight: .bold))
                Text(move["en"].string).font(.system(size: 14)).foregroundStyle(SpotterPalette.muted)
                VStack(alignment: .leading, spacing: 12) {
                    Label("部位 · \(move["part"].string)", systemImage: "figure.stand")
                    Label("器械 · \(move["equipment"].string)", systemImage: "dumbbell")
                    Label("目标 · \(move["target"].string)", systemImage: "scope")
                }.font(.system(size: 15)).padding(16).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
                Button(action: add) { Label("添加到本次训练", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(SpotterNativeButtonStyle(primary: true))
            }.padding(16)
        }.background(SpotterPalette.background).foregroundStyle(SpotterPalette.ink).navigationTitle("动作详情").navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeSetTarget: Equatable {
    var move: Int
    var row: Int
    var key: String
    var right = false
}

private enum NativeEditorPanel: String, Identifiable { case settings, note, add, finish; var id: String { rawValue } }

private struct NativeActiveWorkoutView: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var openedMove = 0
    @State private var edit: NativeSetTarget?
    @State private var editText = ""
    @State private var pristine = true
    @State private var panel: NativeEditorPanel?

    var body: some View {
        Group {
            if let entry = store.active, let session = entry.session { workout(entry, session: session) }
            else { VStack(spacing: 15) { Image(systemName: "checkmark.circle").font(.largeTitle); Text("训练已保存").font(.title2.bold()); Text(store.status).font(.subheadline); Button("返回") { dismiss() } }.frame(maxWidth: .infinity, maxHeight: .infinity).background(SpotterPalette.background) }
        }
        .foregroundStyle(SpotterPalette.ink).tint(SpotterPalette.accent)
        .task { await store.loadProteinPreferences() }
        .sheet(item: $panel) { item in
            NavigationStack {
                switch item {
                case .note: NativeWorkoutNotePanel(store: store)
                case .settings: NativeWorkoutSettingsPanel(store: store)
                case .add: NativeWorkoutAddPanel(store: store)
                case .finish: NativeWorkoutFinishPanel(store: store) { panel = nil; DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { dismiss() } }
                }
            }.presentationDetents(item == .finish ? [.medium, .large] : [.medium, .large])
        }
    }

    private func workout(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(spacing: 0) {
            editorHeader(entry, session: session)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    let total = session.rows.flatMap { $0 }.count + (session.plan.video.isEmpty ? 0 : 1)
                    if total > 0 { ProgressView(value: Double(session.completedSets + (session.raw["finishedVideo"].bool ? 1 : 0)), total: Double(total)).tint(SpotterPalette.accent).padding(.horizontal, 2) }
                    if !session.plan.raw["durationNote"].string.isEmpty { Text(session.plan.raw["durationNote"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                    if let next = nextSet(session) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("下一组").font(.system(size: 13))
                            Text(session.plan.exercises[next.move]["name"].string).font(.system(size: 14, weight: .bold)).lineLimit(2)
                            Spacer(minLength: 0); Text("第 \(next.row + 1) 组").font(.system(size: 13))
                        }.padding(11).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
                    }
                    if case .object = session.raw["cardio"] { NativeWorkoutCardioFields(store: store) }
                    if let video = URL(string: session.plan.video), !session.plan.video.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Link(destination: video) { Label("打开跟练视频", systemImage: "play.circle") }
                            Toggle("已完成跟练", isOn: Binding(get: { session.raw["finishedVideo"].bool }, set: { value in store.mutate { $0.raw["finishedVideo"] = .bool(value) } }))
                        }.font(.system(size: 14)).padding(13).spotterCard()
                    }
                    ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in exerciseCard(index, move: move, session: session) }
                    if session.plan.exercises.isEmpty && session.raw["cardio"] == .null {
                        VStack(spacing: 12) { tile("dumbbell", size: 44); Text("添加动作，开始记录训练").font(.system(size: 15, weight: .semibold)); Button("添加动作") { panel = .add }.buttonStyle(SpotterNativeButtonStyle(primary: true)) }
                            .frame(maxWidth: .infinity).padding(30).spotterCard()
                    }
                    if let error = store.errorMessage { Text(error).font(.system(size: 13)).foregroundStyle(.red) }
                }.padding(14)
            }.background(SpotterPalette.background).clipShape(UnevenTopRoundedShape(radius: 23))
            if let edit { keypad(edit, session: session) }
            else { actionBar(session) }
        }.background(SpotterPalette.wash).toolbar(.hidden, for: .navigationBar)
    }

    private func editorHeader(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                HStack(spacing: 10) {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(NativeWorkoutView.duration(session.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000))))
                            .font(.system(size: 43, weight: .heavy)).tracking(-2).monospacedDigit()
                    }
                    Button { store.toggleClock() } label: { Image(systemName: session.isRunning ? "pause.fill" : "play.fill").font(.system(size: 16)).frame(width: 43, height: 43).background(SpotterPalette.card, in: Circle()) }
                        .accessibilityLabel(session.isRunning ? "暂停计时" : "继续计时")
                }
                Spacer(minLength: 5)
                Button(store.isBusy ? "正在保存" : "完成") { finish() }
                    .font(.system(size: 14, weight: .bold)).buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .disabled(store.isBusy || edit != nil || (session.completedSets == 0 && !session.raw["finishedVideo"].bool && session.raw["cardio"] == .null))
            }
            HStack(alignment: .center, spacing: 10) {
                if session.raw["planId"].string.isEmpty {
                    HStack(spacing: 5) {
                        Image(systemName: "pencil.line").font(.system(size: 15)).foregroundStyle(SpotterPalette.muted)
                        TextField("输入训练标题", text: Binding(get: { session.plan.title == "自由训练" ? "" : session.plan.title }, set: { value in store.mutate { $0.raw["plan"]["title"] = .string(value.trimmingCharacters(in: .whitespaces).isEmpty ? "自由训练" : String(value.prefix(100))) } }))
                            .font(.system(size: 16, weight: .bold))
                    }.padding(.horizontal, 9).padding(.vertical, 7).background(SpotterPalette.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                } else {
                    VStack(alignment: .leading, spacing: 3) { Text(session.plan.category).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted); Text(entry.title).font(.system(size: 18, weight: .bold)) }
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(session.completedSets)/\(session.rows.flatMap { $0 }.count) 组").font(.system(size: 14, weight: .bold))
                    Text("\(session.volumeKg.formatted(.number.precision(.fractionLength(0...1)))) kg 容量").font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                }
            }
            Text(store.status).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
            if session.raw["rest"] != .null {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    let remaining = max(0, Int((session.raw["rest"]["until"].number - Double(session.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000)))) / 1000))
                    HStack {
                        Text(remaining > 0 ? "\(session.raw["rest"]["kind"].string) \(NativeWorkoutView.duration(remaining * 1000))" : "休息结束").font(.system(size: 13, weight: .semibold))
                        Spacer()
                        Button(remaining > 0 ? "跳过" : "关闭") { store.mutate { session in var raw = session.raw.object; raw.removeValue(forKey: "rest"); session.raw = .object(raw) } }.font(.system(size: 12))
                    }.padding(.top, 5)
                }
            }
        }.padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 12)
    }

    private func exerciseCard(_ index: Int, move: NativeJSON, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { openedMove = openedMove == index ? -1 : index; edit = nil } } label: {
                HStack(spacing: 9) {
                    Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string).font(.system(size: 13, weight: .bold)).frame(width: 34, height: 30).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                    Text(move["name"].string).font(.system(size: 16, weight: .bold)).multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Text("\(session.rows.indices.contains(index) ? session.rows[index].filter { $0["done"].bool }.count : 0)/\(Int(move["sets"].number)) 组").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    Image(systemName: openedMove == index ? "chevron.up" : "chevron.down").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                }
            }.buttonStyle(.plain)
            if openedMove == index {
                if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                Text(prescription(move)).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                if !move["tempo"].string.isEmpty { Text("节奏 \(move["tempo"].string)").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }
                ForEach(Array((session.rows.indices.contains(index) ? session.rows[index] : []).enumerated()), id: \.offset) { row, line in setRow(index, row: row, move: move, line: line) }
                Button { store.mutate { $0.addSet(move: index) } } label: { Label("增加一组", systemImage: "plus").font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity) }
                    .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled((session.rows.indices.contains(index) ? session.rows[index].count : 30) >= 30)
            }
        }.padding(12).spotterCard()
    }

    private func setRow(_ moveIndex: Int, row: Int, move: NativeJSON, line: NativeJSON) -> some View {
        HStack(alignment: .top, spacing: 7) {
            VStack(spacing: 3) {
                Text("\(row + 1)").font(.system(size: 16, weight: .bold))
                if !line["kind"].string.isEmpty { Text(line["kind"].string == "warmup" ? "热身" : "递减").font(.system(size: 9)).foregroundStyle(SpotterPalette.muted) }
            }.frame(width: 24, height: 50)
            VStack(spacing: 5) {
                HStack(spacing: 5) {
                    setNumber(NativeSetTarget(move: moveIndex, row: row, key: "weight"), label: line["right"] == .null ? move["unit"].string : "左 \(move["unit"].string)", value: line["weight"].number, done: line["done"].bool)
                    let timed = move["seconds"].number > 0
                    setNumber(NativeSetTarget(move: moveIndex, row: row, key: timed ? "seconds" : "reps"), label: timed ? "秒数" : (line["right"] == .null ? "次数" : "左 次数"), value: line[timed ? "seconds" : "reps"].number, done: line["done"].bool)
                }
                if case .object = line["right"] {
                    HStack(spacing: 5) {
                        setNumber(NativeSetTarget(move: moveIndex, row: row, key: "weight", right: true), label: "右 \(move["unit"].string)", value: line["right"]["weight"].number, done: line["done"].bool)
                        setNumber(NativeSetTarget(move: moveIndex, row: row, key: "reps", right: true), label: "右 次数", value: line["right"]["reps"].number, done: line["done"].bool)
                    }
                }
                if line["rpe"] != .null { Text("RPE \(line["rpe"].number.formatted())").font(.system(size: 11, weight: .semibold)).padding(.horizontal, 7).padding(.vertical, 4).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 7)).frame(maxWidth: .infinity, alignment: .leading) }
            }
            Button { edit = nil; store.toggleDone(move: moveIndex, row: row) } label: {
                Image(systemName: line["done"].bool ? "checkmark.circle.fill" : "circle").font(.system(size: 24, weight: .medium)).frame(width: 38, height: 50)
                    .foregroundStyle(line["done"].bool ? SpotterPalette.accent : SpotterPalette.muted.opacity(0.55))
            }.buttonStyle(.plain).accessibilityLabel("标记第\(row + 1)组\(line["done"].bool ? "未完成" : "完成")")
        }.padding(7).background(line["done"].bool ? SpotterPalette.wash : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 11))
    }

    private func setNumber(_ target: NativeSetTarget, label: String, value: Double, done: Bool) -> some View {
        Button { activate(target, value: value) } label: {
            VStack(spacing: 1) { Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(SpotterPalette.muted); Text(value.formatted(.number.precision(.fractionLength(0...2)))).font(.system(size: 19, weight: .bold)).monospacedDigit() }
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(edit == target ? SpotterPalette.lime.opacity(0.3) : done ? SpotterPalette.wash.opacity(0.4) : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(edit == target ? SpotterPalette.accent : SpotterPalette.line, lineWidth: edit == target ? 2 : 1))
        }.buttonStyle(.plain).accessibilityLabel("第\(target.row + 1)组\(label) \(value.formatted())")
    }

    private func actionBar(_ session: NativeWorkoutSession) -> some View {
        HStack(spacing: 3) {
            footerAction("最小化", symbol: "arrow.down.right.and.arrow.up.left") { Task { await store.saveDraft() }; dismiss() }
            footerAction("更多", symbol: "ellipsis") { panel = .settings }
            Button { panel = .add } label: {
                VStack(spacing: 5) { Image(systemName: "plus").font(.system(size: 23, weight: .semibold)).frame(width: 42, height: 36).background(SpotterPalette.lime, in: RoundedRectangle(cornerRadius: 13)); Text("加动作").font(.system(size: 11, weight: .bold)) }.frame(maxWidth: .infinity)
            }.buttonStyle(.plain).disabled(session.plan.exercises.count >= 30)
            footerAction("写心得", symbol: "square.and.pencil") { panel = .note }
            footerAction("数字键盘", symbol: "keyboard") {
                if let next = nextSet(session) { let timed = session.plan.exercises[next.move]["seconds"].number > 0; let key = timed ? "seconds" : "weight"; activate(NativeSetTarget(move: next.move, row: next.row, key: key), value: session.rows[next.move][next.row][key].number) }
            }.disabled(session.rows.isEmpty)
        }.padding(.horizontal, 12).padding(.top, 7).padding(.bottom, 8).background(SpotterPalette.card).overlay(alignment: .top) { Rectangle().fill(SpotterPalette.line).frame(height: 1) }
    }

    private func footerAction(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { VStack(spacing: 6) { Image(systemName: symbol).font(.system(size: 21)); Text(title).font(.system(size: 11, weight: .semibold)) }.frame(maxWidth: .infinity, minHeight: 52) }.buttonStyle(.plain).foregroundStyle(SpotterPalette.muted)
    }
    private func activate(_ target: NativeSetTarget, value: Double) { edit = target; editText = value.formatted(.number.grouping(.never).precision(.fractionLength(0...2))); pristine = true; openedMove = target.move }
    private func nextSet(_ session: NativeWorkoutSession) -> NativeSetTarget? {
        for (move, rows) in session.rows.enumerated() { if let row = rows.firstIndex(where: { !$0["done"].bool }) { return NativeSetTarget(move: move, row: row, key: "weight") } }
        return nil
    }
    private func finish() {
        if !store.proteinProducts.isEmpty || store.active?.data["proteinShake"].bool == true { panel = .finish }
        else { Task { await store.finish(); if store.active == nil { dismiss() } } }
    }

    private func keypad(_ target: NativeSetTarget, session: NativeWorkoutSession) -> some View {
        VStack(spacing: 6) {
            HStack {
                Text("第 \(target.row + 1) 组 · \(target.key == "weight" ? "重量" : target.key == "reps" ? "次数" : target.key == "rpe" ? "RPE" : "秒数")").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                Text(editText.isEmpty ? "0" : editText).font(.system(size: 17, weight: .bold)).monospacedDigit()
                Spacer()
                Button("完成") { edit = nil }.font(.system(size: 14, weight: .bold)).padding(7)
            }
            ForEach(0..<4) { row in
                HStack(spacing: 5) {
                    padAction(["用 \(session.plan.exercises[target.move]["unit"].string == "kg" ? "lb" : "kg")", "热身组", "递减组", "记录左右"][row]) { leftAction(row, target: target) }
                    ForEach(0..<3) { column in
                        let value = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [".", "0", "⌫"]][row][column]
                        Button { press(value, target: target) } label: { Text(value).font(.system(size: 23, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44).background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 9)) }.buttonStyle(.plain)
                    }
                    padAction(["加一组", "向上填", "向下填", "RPE"][row]) { rightAction(row, target: target) }
                }
            }
        }.padding(10).background(SpotterPalette.wash).overlay(alignment: .top) { Rectangle().fill(SpotterPalette.line).frame(height: 1) }
    }
    private func padAction(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(label).font(.system(size: 11, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44).background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 9)) }.buttonStyle(.plain)
    }
    private func press(_ digit: String, target: NativeSetTarget) {
        var text = pristine ? "" : editText
        if digit == "⌫" { text = String((pristine ? editText : text).dropLast()) }
        else if digit == "." { if text.contains(".") || ["reps", "seconds"].contains(target.key) { return }; text = text.isEmpty ? "0." : text + "." }
        else { text += digit }
        guard text.count <= 8 else { return }
        editText = text; pristine = false
        guard let value = Double(text), value <= (target.key == "weight" ? 2000 : target.key == "reps" ? 999 : target.key == "rpe" ? 10 : 18000) else { return }
        if target.right { store.setRightNumber(move: target.move, row: target.row, key: target.key, value: value) }
        else { store.setNumber(move: target.move, row: target.row, key: target.key, value: value) }
    }
    private func leftAction(_ index: Int, target: NativeSetTarget) {
        if index == 0 { store.convertUnit(move: target.move); edit = nil }
        else if index == 1 { store.toggleSetKind(move: target.move, row: target.row, kind: "warmup") }
        else if index == 2 { store.toggleSetKind(move: target.move, row: target.row, kind: "drop") }
        else { store.toggleRight(move: target.move, row: target.row); edit = nil }
    }
    private func rightAction(_ index: Int, target: NativeSetTarget) {
        if index == 0 { store.mutate { $0.addSet(move: target.move) } }
        else if index == 3 {
            let value = store.active?.session?.rows[target.move][target.row]["rpe"].number ?? 8
            activate(NativeSetTarget(move: target.move, row: target.row, key: "rpe"), value: value == 0 ? 8 : value)
        } else if let value = Double(editText) {
            let maximum = target.key == "weight" ? 2000.0 : target.key == "reps" ? 999.0 : target.key == "rpe" ? 10.0 : 18000.0
            guard value.isFinite, value >= 0, value <= maximum,
                  target.key != "rpe" || (value >= 1 && (value * 2).rounded() == value * 2) else { return }
            store.mutate { session in
                let indices = index == 1 ? Array(0..<target.row) : Array((target.row + 1)..<session.rows[target.move].count)
                for row in indices {
                    if target.right { var right = session.rows[target.move][row]["right"]; guard case .object = right else { continue }; right[target.key] = .number(value); session.setLine(move: target.move, row: row, key: "right", value: right) }
                    else { session.setLine(move: target.move, row: row, key: target.key, value: .number(value)) }
                }
            }
        }
    }
}

private struct UnevenTopRoundedShape: Shape {
    var radius: CGFloat
    func path(in rect: CGRect) -> Path { Path(UIBezierPath(roundedRect: rect, byRoundingCorners: [.topLeft, .topRight], cornerRadii: CGSize(width: radius, height: radius)).cgPath) }
}

private struct NativeWorkoutNotePanel: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 18) {
            TextEditor(text: Binding(get: { store.active?.data["note"].string ?? "" }, set: { value in store.mutate { $0.raw["note"] = .string(String(value.prefix(1500))) } }))
                .font(.system(size: 16)).frame(minHeight: 130).padding(8).spotterCard()
            Button("完成") { dismiss() }.buttonStyle(SpotterNativeButtonStyle(primary: true)).frame(maxWidth: .infinity, alignment: .trailing)
            Spacer()
        }.padding(18).background(SpotterPalette.background).navigationTitle("训练心得").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
    }
}

private struct NativeWorkoutSettingsPanel: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var rest = 30.0
    @State private var minutes = 0.0
    var body: some View {
        Form {
            Section {
                HStack { Text("本次默认休息（秒）"); Spacer(); TextField("秒", value: $rest, format: .number).multilineTextAlignment(.trailing).keyboardType(.numberPad).frame(width: 70) }
                HStack { Text("实际时长（分钟）"); Spacer(); TextField("使用计时", value: $minutes, format: .number).multilineTextAlignment(.trailing).keyboardType(.numberPad).frame(width: 70) }
                Text("时长填 0 时使用训练计时。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            Button("保存设置") {
                store.mutate { $0.raw["defaultRestOverride"] = .number(max(0, min(600, rest.rounded()))); $0.raw["minutes"] = .number(max(0, min(720, minutes.rounded()))) }
                dismiss()
            }
        }.scrollContentBackground(.hidden).background(SpotterPalette.background).navigationTitle("训练设置").navigationBarTitleDisplayMode(.inline)
            .onAppear { let raw = store.active?.data ?? .null; rest = raw["defaultRestOverride"] != .null ? raw["defaultRestOverride"].number : raw["plan"]["defaultRestSeconds"] != .null ? raw["plan"]["defaultRestSeconds"].number : 30; minutes = raw["minutes"].number }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
    }
}

private struct NativeWorkoutAddPanel: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    var body: some View {
        Form {
            Section("动作名称") { TextField("搜索或输入动作名称", text: $name) }
            Section {
                Button("添加到本次训练") { store.mutate { $0.addExercise(name: name) }; dismiss() }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (store.active?.session?.plan.exercises.count ?? 30) >= 30)
            }
        }.scrollContentBackground(.hidden).background(SpotterPalette.background).navigationTitle("添加动作").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
    }
}

private struct NativeWorkoutFinishPanel: View {
    @ObservedObject var store: NativeWorkoutStore
    var saved: () -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Toggle("已喝蛋白粉", isOn: Binding(get: { store.active?.data["proteinShake"].bool ?? false }, set: { store.setProteinConsumed($0) })).font(.system(size: 16, weight: .semibold))
            if let product = store.active?.data["proteinProduct"], product != .null {
                VStack(alignment: .leading, spacing: 7) {
                    Text(product["name"].string).font(.system(size: 16, weight: .bold))
                    Text("1 勺 · \(product["scoopGrams"].number.formatted()) g · \(product["mixer"]["name"].string.isEmpty ? "水" : product["mixer"]["name"].string) \(product["cupMl"].number.formatted()) mL").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                }.padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
            }
            if store.proteinProducts.count > 1 {
                Text("喝的是哪款？").font(.system(size: 14, weight: .semibold))
                ForEach(Array(store.proteinProducts.enumerated()), id: \.offset) { _, product in
                    Button { store.setProteinConsumed(true, productID: product["id"].string) } label: {
                        HStack { Image(systemName: store.active?.data["proteinProduct"]["id"].string == product["id"].string ? "largecircle.fill.circle" : "circle"); Text(product["name"].string) }
                    }.buttonStyle(.plain)
                }
            }
            if let error = store.errorMessage { Text(error).font(.system(size: 13)).foregroundStyle(.red) }
            Spacer(minLength: 0)
            HStack {
                Button("返回训练") { dismiss() }.buttonStyle(SpotterNativeButtonStyle(primary: false))
                Spacer()
                Button { Task { await store.finish(); if store.active == nil { saved() } } } label: { Label(store.isBusy ? "正在保存" : "保存打卡", systemImage: "checkmark") }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true)).disabled(store.isBusy)
            }
        }.padding(18).background(SpotterPalette.background).navigationTitle("完成训练").navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeWorkoutCardioFields: View {
    @ObservedObject var store: NativeWorkoutStore
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("爬坡走").font(.system(size: 18, weight: .bold))
            Text("计时结束时记录实际时长，也可以填写跑步机上的读数。").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
            HStack {
                cardioNumber("距离 km", key: "distanceKm", maximum: 500)
                cardioNumber("速度 km/h", key: "speedKmh", maximum: 50)
            }
        }.padding(14).spotterCard()
    }
    private func cardioNumber(_ label: String, key: String, maximum: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
            TextField("可不填", value: Binding(get: { store.active?.data["cardio"][key].number ?? 0 }, set: { value in guard value.isFinite else { return }; store.mutate { $0.raw["cardio"][key] = .number(max(0, min(maximum, value))) } }), format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad).padding(10).background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 9))
        }
    }
}

struct NativeWorkoutHistoryView: View {
    @ObservedObject var store: NativeWorkoutStore
    var extraDetail: ((NativeWorkoutEntry) -> AnyView)? = nil
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if store.logs.isEmpty {
                    VStack(spacing: 12) { tile("clock.arrow.circlepath", size: 46); Text("还没有训练打卡").font(.system(size: 17, weight: .bold)); Text("完成训练后，在这里查看记录。").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                        .frame(maxWidth: .infinity).padding(30).spotterCard()
                }
                ForEach(store.logs) { entry in
                    NavigationLink { NativeWorkoutDetailView(entry: entry, extraDetail: extraDetail) } label: {
                        HStack(spacing: 12) {
                            tile("dumbbell", size: 40)
                            VStack(alignment: .leading, spacing: 5) { Text(entry.title).font(.system(size: 15, weight: .bold)); Text("\(shortDay(entry.day)) · 我 · \(entry.durationMinutes) 分钟").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }
                            Spacer(minLength: 0); Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        }.padding(14).spotterCard()
                    }.buttonStyle(.plain)
                }
            }.padding(14)
        }.background(SpotterPalette.background).foregroundStyle(SpotterPalette.ink).navigationTitle("打卡历史").navigationBarTitleDisplayMode(.inline)
            .refreshable { await store.load() }.task { await store.load() }
    }
}

private struct NativeWorkoutDetailView: View {
    let entry: NativeWorkoutEntry
    var extraDetail: ((NativeWorkoutEntry) -> AnyView)? = nil
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("\(shortDay(entry.day)) · \(entry.data["plan"]["category"].string)").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                    HStack {
                        summary("分钟", value: entry.durationMinutes.formatted())
                        summary("完成组数", value: (entry.session?.completedSets ?? 0).formatted())
                        summary("容量 kg", value: (entry.session?.volumeKg ?? 0).formatted(.number.precision(.fractionLength(0...1))))
                    }
                }.padding(16).spotterCard()
                if entry.data["proteinShake"].bool {
                    Label(entry.data["proteinProduct"]["name"].string.isEmpty ? "已喝蛋白粉" : entry.data["proteinProduct"]["name"].string, systemImage: "mug").font(.system(size: 14)).padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
                }
                if !entry.data["note"].string.isEmpty { Text(entry.data["note"].string).font(.system(size: 15)).padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard() }
                if let video = URL(string: entry.data["plan"]["video"].string), !entry.data["plan"]["video"].string.isEmpty { Link(destination: video) { Label("打开跟练视频", systemImage: "play.circle") }.buttonStyle(SpotterNativeButtonStyle(primary: false)) }
                if let extraDetail { extraDetail(entry) }
                if let session = entry.session, !session.plan.exercises.isEmpty {
                    Text("训练动作").font(.system(size: 18, weight: .bold))
                    ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(move["name"].string).font(.system(size: 16, weight: .bold))
                            Text("计划处方：\(prescription(move))").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                            if !move["tempo"].string.isEmpty { Text("节奏 \(move["tempo"].string)").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }
                            ForEach(Array((session.rows.indices.contains(index) ? session.rows[index] : []).enumerated()), id: \.offset) { set, row in
                                if row["done"].bool {
                                    Divider().overlay(SpotterPalette.line)
                                    HStack(alignment: .top, spacing: 10) {
                                        Text("第 \(set + 1) 组" + (row["kind"].string == "warmup" ? " · 热身" : row["kind"].string == "drop" ? " · 递减" : ""))
                                        Spacer(minLength: 0)
                                        Text(row["seconds"].number > 0 ? "\(Int(row["seconds"].number)) 秒" : "\(row["weight"].number.formatted()) \(move["unit"].string) × \(Int(row["reps"].number))")
                                        Image(systemName: "checkmark").foregroundStyle(SpotterPalette.accent)
                                    }.font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                                }
                            }
                        }.padding(14).spotterCard()
                    }
                }
            }.padding(14)
        }.background(SpotterPalette.background).foregroundStyle(SpotterPalette.ink).navigationTitle(entry.title).navigationBarTitleDisplayMode(.inline)
    }
    private func summary(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) { Text(value).font(.system(size: 25, weight: .bold)).monospacedDigit(); Text(label).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct NativePlanDraft: Identifiable {
    var id: String
    var revision: String?
    var plan: NativeJSON
    var isTemplate: Bool
    init(day: String, template: Bool = false) {
        id = UUID().uuidString.lowercased(); isTemplate = template
        plan = .object(["title": .string(""), "date": .string(day), "category": .string("力量训练"), "minutes": .number(0), "shared": .bool(false), "video": .string(""), "exercises": .array([])])
    }
    init(entry: NativeWorkoutEntry) { id = entry.id; revision = entry.updated; plan = entry.data; isTemplate = false }
    init(template: NativeJSON, day: String, schedule: Bool) {
        id = schedule ? UUID().uuidString.lowercased() : template["id"].string
        revision = schedule ? nil : template["updated"].string
        isTemplate = !schedule
        plan = template["plan"]
        if schedule {
            var raw = plan.object
            raw["date"] = .string(day); raw["shared"] = .bool(false); raw["templateId"] = template["id"]
            raw.removeValue(forKey: "week"); raw.removeValue(forKey: "day")
            plan = .object(raw)
        }
    }
}

private struct NativePlanEditorPanel: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State var draft: NativePlanDraft
    @State private var moveName = ""
    @State private var busy = false
    @State private var error: String?
    var saved: (String) -> Void
    private var linked: Bool { !draft.isTemplate && !draft.plan["templateId"].string.isEmpty }

    var body: some View {
        Form {
            Section("计划") {
                TextField("计划名称", text: text("title", maximum: 100))
                if !draft.isTemplate {
                    DatePicker("训练日期", selection: Binding(get: { nativePlanDate(draft.plan["date"].string) ?? Date() }, set: { draft.plan["date"] = .string(NativeWorkoutSession.day($0)) }), displayedComponents: .date)
                }
                if !linked {
                    Picker("训练类型", selection: text("category", maximum: 20)) {
                        ForEach(["力量训练", "有氧训练", "拉伸恢复", "跟练视频", "其他"], id: \.self) { Text($0).tag($0) }
                    }
                    HStack { Text("预计分钟"); Spacer(); TextField("分钟", value: number("minutes", maximum: 720), format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 65) }
                }
                Toggle("与搭子共享计划", isOn: Binding(get: { draft.plan["shared"].bool }, set: { draft.plan["shared"] = .bool($0) }))
                if linked { Text("动作和组数来自个人模板。修改动作仅适用于本次训练。").font(.footnote).foregroundStyle(SpotterPalette.muted) }
            }
            Section("动作") {
                ForEach(Array(draft.plan["exercises"].array.enumerated()), id: \.offset) { index, move in
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("动作名称", text: Binding(get: { move["name"].string }, set: { setMove(index, key: "name", value: .string(String($0.prefix(100)))) }))
                            .font(.system(size: 15, weight: .semibold))
                        HStack(spacing: 12) {
                            moveNumber("组", index: index, key: "sets", value: move["sets"].number, maximum: 30)
                            moveNumber("次", index: index, key: "reps", value: move["reps"].number, maximum: 999)
                            moveNumber(move["unit"].string, index: index, key: "weight", value: move["weight"].number, maximum: 2000)
                            moveNumber("秒", index: index, key: "seconds", value: move["seconds"].number, maximum: 18000)
                        }
                        if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.caption).foregroundStyle(SpotterPalette.muted) }
                    }.padding(.vertical, 6)
                }
                HStack {
                    TextField("添加动作名称", text: $moveName)
                    Button { addMove() } label: { Image(systemName: "plus.circle.fill") }
                        .disabled(moveName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.plan["exercises"].array.count >= 30)
                }
            }
            if !linked { Section("跟练视频") { TextField("粘贴 B 站或 YouTube 链接", text: text("video", maximum: 1200)).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled() } }
            if let error { Section { Text(error).font(.footnote).foregroundStyle(.red) } }
        }
        .scrollContentBackground(.hidden).background(SpotterPalette.background).foregroundStyle(SpotterPalette.ink)
        .navigationTitle(draft.isTemplate ? "编辑模板" : draft.revision == nil ? "新建计划" : "编辑计划").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) { Button(busy ? "保存中" : "保存") { Task { await commit() } }.fontWeight(.bold).disabled(busy) }
        }
    }
    private func text(_ key: String, maximum: Int) -> Binding<String> {
        Binding(get: { draft.plan[key].string }, set: { draft.plan[key] = .string(String($0.prefix(maximum))) })
    }
    private func number(_ key: String, maximum: Double) -> Binding<Double> {
        Binding(get: { draft.plan[key].number }, set: { if $0.isFinite { draft.plan[key] = .number(min(maximum, max(0, $0.rounded()))) } })
    }
    private func setMove(_ index: Int, key: String, value: NativeJSON) {
        var moves = draft.plan["exercises"].array
        guard moves.indices.contains(index) else { return }
        if key == "name", moves[index]["name"] != value {
            var raw = moves[index].object; raw.removeValue(forKey: "catalogueId"); raw.removeValue(forKey: "sourceName"); moves[index] = .object(raw)
        }
        moves[index][key] = value; draft.plan["exercises"] = .array(moves)
        if linked { draft.plan["ownExercises"] = .bool(true) }
    }
    private func moveNumber(_ label: String, index: Int, key: String, value: Double, maximum: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
            TextField(label, value: Binding(get: { value }, set: { entry in
                guard entry.isFinite else { return }
                let rounded = key == "weight" ? entry : entry.rounded()
                let bounded = min(maximum, max(key == "sets" ? 1 : 0, rounded))
                setMove(index, key: key, value: .number(bounded))
            }), format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
        }
    }
    private func addMove() {
        var moves = draft.plan["exercises"].array
        moves.append(.object(["name": .string(String(moveName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))), "sets": .number(3), "reps": .number(10), "weight": .number(0), "unit": .string("kg"), "seconds": .number(0)]))
        draft.plan["exercises"] = .array(moves); moveName = ""
        if linked { draft.plan["ownExercises"] = .bool(true) }
    }
    private func commit() async {
        guard !draft.plan["title"].string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !draft.plan["exercises"].array.isEmpty || !draft.plan["video"].string.isEmpty else { error = "请填写计划名称，并至少添加一个动作或跟练视频。"; return }
        busy = true; defer { busy = false }
        let message = draft.isTemplate ? await store.saveTemplate(id: draft.id, data: draft.plan, revision: draft.revision) :
            await store.savePlan(id: draft.id, data: draft.plan, revision: draft.revision)
        if let message { error = message }
        else { saved(draft.plan["date"].string); dismiss() }
    }
}

private func nativePlanDate(_ day: String) -> Date? {
    let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = .current
    formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: day)
}
