import CryptoKit
import Foundation
import AudioToolbox
import SwiftUI
import UIKit

@MainActor
final class NativeWorkoutStore: ObservableObject {
    @Published private(set) var entries: [NativeWorkoutEntry] = [] {
        didSet {
            plans = entries.filter { $0.kind == "plan" }
            plansByKey = Dictionary(plans.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
            savedDrafts = entries.filter { $0.kind == "draft" && $0.owner == owner }
            savedLogs = entries.filter { $0.kind == "log" && $0.owner == owner }
            rebuildLogs()
        }
    }
    @Published private(set) var active: NativeWorkoutEntry?
    @Published private(set) var pendingCheckins: [NativeWorkoutEntry] = [] {
        didSet { rebuildLogs() }
    }
    @Published private(set) var isBusy = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var status = "正在连接"
    @Published private(set) var proteinProducts: [NativeJSON] = []
    @Published private(set) var defaultProteinProductID: String?
    @Published private(set) var tracksWorkoutProtein = false
    @Published private(set) var libraryRows: [NativeJSON] = []
    @Published private(set) var room: NativeJSON = .null
    @Published private(set) var viewerName = "我"
    let owner: String
    let api: NativeAPI
    private let origin: String
    private let cacheURL: URL?
    private var draftTask: Task<Void, Never>?
    private var draftInFlight = false
    private var draftAgain = false
    private var uploading = false
    private var reloadAfterPlanWrite = false
    private var localRevision = 0
    private var entryRevision = 0

    private(set) var plans: [NativeWorkoutEntry] = []
    private(set) var logs: [NativeWorkoutEntry] = []
    private(set) var plansByKey: [NativeWorkoutEntry.Key: NativeWorkoutEntry] = [:]
    private var savedDrafts: [NativeWorkoutEntry] = []
    private var savedLogs: [NativeWorkoutEntry] = []
    var drafts: [NativeWorkoutEntry] { savedDrafts.filter { $0.id != active?.id } }
    var partnerID: String { room["partner"]["id"].string }
    var partnerName: String {
        let name = room["partner"]["name"].string
        return name.isEmpty ? "训练搭子" : name
    }
    var partnerLogs: [NativeWorkoutEntry] {
        guard !partnerID.isEmpty, room["partnerTrainingShared"] != .bool(false) else { return [] }
        return entries.filter { $0.kind == "log" && $0.owner == partnerID }
    }

    private func rebuildLogs() {
        let pendingIds = Set(pendingCheckins.map(\.id))
        logs = (pendingCheckins + savedLogs.filter { !pendingIds.contains($0.id) })
            .map { record in
                let start = record.data["started"].number.rounded(.towardZero)
                return (record: record, started: max(0, Int(exactly: start) ?? 0))
            }
            .sorted { $0.started > $1.started }
            .map(\.record)
    }

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
            rebuildLogs()
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
        defer {
            isLoading = false
            if reloadAfterPlanWrite {
                reloadAfterPlanWrite = false
                Task { await load() }
            }
        }
        do {
            let revision = localRevision
            let edit = entryRevision
            let value = try await api.spotterRead("/api/workout", as: NativeWorkoutState.self)
            guard revision == localRevision, edit == entryRevision else { return }
            guard value.me.id == owner else { entries = []; throw NativeWorkoutProblem.accountChanged }
            if entries != value.entries { entries = value.entries }
            let currentRoom = value.room ?? .null
            if room != currentRoom { room = currentRoom }
            let name = value.me.name ?? "我"
            if viewerName != name { viewerName = name }
            if let active, value.entries.contains(where: { $0.owner == owner && $0.kind == "log" && $0.id == active.id }) {
                self.active = nil
                persist()
            }
            if status != "云端已连接" { status = "云端已连接" }
            if errorMessage != nil { errorMessage = nil }
            await loadProteinPreferences()
            await retryPending()
        } catch {
            status = "暂未连接云端"
            errorMessage = error.localizedDescription
        }
    }

    func loadProteinPreferences() async {
        do {
            let library = try await api.spotterRead("/api/library", as: NativeJSON.self)
            let rows = library["rows"].array
            if libraryRows != rows { libraryRows = rows }
            let products = rows.first { $0["kind"].string == "protein-warehouse" }?["products"].array ?? []
            if proteinProducts != products { proteinProducts = products }
            let preference = rows.first { $0["kind"].string == "protein-preference" }
            let productID = preference?["defaultProductId"].string
            if defaultProteinProductID != productID { defaultProteinProductID = productID }
            let tracks = preference.map { $0["enabled"] != .bool(false) } ?? !products.isEmpty
            if tracksWorkoutProtein != tracks { tracksWorkoutProtein = tracks }
        } catch { /* Training can continue; no guessed or stale recipe is selected after an unreadable warehouse. */
            proteinProducts = []
            defaultProteinProductID = nil
            tracksWorkoutProtein = false
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
        active = nil; pendingCheckins = []; entries = []; room = .null
        proteinProducts = []; defaultProteinProductID = nil; tracksWorkoutProtein = false
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
                    (moveRest != .null ? moveRest.number : session.plan.raw["defaultRestSeconds"] != .null ? session.plan.raw["defaultRestSeconds"].number : Double(NativePreferenceKey.restSeconds))
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

    func finish() async -> NativeWorkoutEntry? {
        guard !isBusy, let current = active, let session = current.session else { return nil }
        do {
            let final = try session.finalizing()
            draftTask?.cancel()
            let checkin = NativeWorkoutEntry(id: current.id, owner: owner, kind: "log", updated: ISO8601DateFormatter().string(from: Date()), data: final.raw)
            let oldPending = pendingCheckins
            if !pendingCheckins.contains(where: { $0.id == checkin.id }) { pendingCheckins.append(checkin) }
            active = nil
            guard persist() else { active = current; pendingCheckins = oldPending; return nil }
            status = "打卡已保存在本机，正在上传"
            await retryPending()
            return logs.first { $0.key == checkin.key } ?? checkin
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func retryPending() async {
        guard !uploading, !pendingCheckins.isEmpty else { return }
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
                entries = [record] + entries.filter { $0.id != pending.id || $0.owner != owner }
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

    func canMovePlan(_ plan: NativeWorkoutEntry) -> Bool {
        guard plan.kind == "plan", plan.owner == owner else { return false }
        func usesPlan(_ entry: NativeWorkoutEntry) -> Bool {
            entry.owner == owner && (entry.id == plan.id || entry.data["planId"].string == plan.id)
        }
        return !(active.map(usesPlan) ?? false) && !savedDrafts.contains(where: usesPlan) && !logs.contains(where: usesPlan)
    }

    func isPlanRestDay(_ date: Date) -> Bool {
        guard let settings = libraryRows.first(where: { $0["kind"].string == "schedule" })?["values"] else { return false }
        let weekday = (Calendar(identifier: .gregorian).component(.weekday, from: date) + 5) % 7
        return settings["dates"].array.contains(.string(spotterDay(date))) || settings["weekdays"].array.contains(.number(Double(weekday)))
    }

    func previewPlanMove(_ choice: NativePlanMoveChoice) async throws -> NativePlanMovePreview {
        let plan = try targetPlan(id: choice.id, revision: choice.revision, day: choice.from)
        guard canMovePlan(plan) else { throw NativeAPIError.server(status: 409, message: "已开始或已完成的训练保留原日期。") }
        let response = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(choice), for: owner)
        let preview = try JSONDecoder().decode(NativePlanMovePreview.self, from: response).checked(for: choice)
        try checkMoveTargets(preview)
        return preview
    }

    func movePlan(_ choice: NativePlanMoveChoice, using preview: NativePlanMovePreview) async throws -> NativePlanMoveReceipt {
        _ = try targetPlan(id: choice.id, revision: choice.revision, day: choice.from)
        try checkMoveTargets(preview)
        return try await writePlanChange(try JSONEncoder().encode(choice.confirmed(token: preview.token))) { response in
            let receipt = try JSONDecoder().decode(NativePlanMoveReceipt.self, from: response)
            guard receipt.moved == preview.changes.count, receipt.date == preview.changes.first(where: { $0.id == choice.id })?.date else {
                throw NativeAPIError.invalidResponse
            }
            let byID = Dictionary(uniqueKeysWithValues: preview.changes.map { ($0.id, $0) })
            entries = entries.map { entry in
                guard entry.kind == "plan", entry.owner == owner, let change = byID[entry.id], entry.day == change.from else { return entry }
                var moved = entry
                moved.data["date"] = .string(change.date)
                return moved
            }
            return receipt
        }
    }

    func removePlan(_ plan: NativeWorkoutEntry) async throws {
        guard plan.kind == "plan", plan.owner == owner else { throw NativeWorkoutProblem.invalid }
        _ = try targetPlan(id: plan.id, revision: plan.updated, day: plan.day)
        let body = ["action": "delete", "kind": "plan", "id": plan.id, "revision": plan.updated]
        try await writePlanChange(try JSONEncoder().encode(body)) { response in
            guard try JSONDecoder().decode(NativeJSON.self, from: response)["ok"].bool else {
                throw NativeAPIError.invalidResponse
            }
            entries = entries.filter { $0.kind != "plan" || $0.key != plan.key }
        }
    }

    private func targetPlan(id: String, revision: String, day: String) throws -> NativeWorkoutEntry {
        let key = NativeWorkoutEntry.Key(owner: owner, id: id)
        guard let plan = plansByKey[key], plan.updated == revision, plan.day == day else {
            throw NativeAPIError.server(status: 409, message: "计划已变更，请重新打开计划操作确认。")
        }
        return plan
    }

    private func checkMoveTargets(_ preview: NativePlanMovePreview) throws {
        for change in preview.changes {
            let key = NativeWorkoutEntry.Key(owner: owner, id: change.id)
            guard let plan = plansByKey[key], plan.day == change.from else {
                throw NativeAPIError.server(status: 409, message: "计划已变更，请重新核对日期。")
            }
            guard canMovePlan(plan) else {
                throw NativeAPIError.server(status: 409, message: "日期变更包含本机已开始或打卡的训练。先同步训练，再重新核对。")
            }
        }
    }

    private func writePlanChange<T>(_ body: Data, apply: (Data) throws -> T) async throws -> T {
        guard !isBusy else { throw NativeAPIError.server(status: 409, message: "正在同步训练，请稍后重试。") }
        isBusy = true
        defer { isBusy = false }
        let revision = localRevision
        let response = try await api.request("/api/workout", method: "POST", json: body, for: owner)
        guard revision == localRevision else { throw NativeWorkoutProblem.accountChanged }
        entryRevision &+= 1
        let result = Result { try apply(response) }
        if isLoading { reloadAfterPlanWrite = true }
        else { await load() }
        return try result.get()
    }

    func editRecord(_ record: NativeWorkoutEntry, data: NativeJSON) async throws -> NativeWorkoutEntry {
        guard record.kind == "log", record.owner == owner, UUID(uuidString: record.id) != nil,
              !pendingCheckins.contains(where: { $0.id == record.id }) else { throw NativeWorkoutProblem.invalid }
        let revision = localRevision
        let body: NativeJSON = .object(["action": .string("editLog"), "id": .string(record.id),
                                       "revision": .string(record.updated), "data": data])
        let payload = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body), for: owner)
        let receipt = try JSONDecoder().decode(Receipt.self, from: payload)
        guard revision == localRevision else { throw NativeWorkoutProblem.accountChanged }
        var saved = record
        saved.updated = receipt.updated
        saved.data = receipt.data
        entryRevision &+= 1
        entries = entries.map { $0.key == saved.key && $0.kind == "log" ? saved : $0 }
        return saved
    }

    func cheer() async throws {
        let connection = room["connectionId"].string
        guard !partnerID.isEmpty, !connection.isEmpty else { return }
        let body: NativeJSON = .object(["action": .string("cheer"), "partner": .string(partnerID),
                                       "connection": .string(connection), "timeZone": .string(TimeZone.current.identifier)])
        _ = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
        await load()
    }

    func saveExerciseProfile(_ item: NativeJSON) async -> String? {
        guard !isBusy else { return "正在保存，请稍后重试。" }
        isBusy = true
        defer { isBusy = false }
        let body: NativeJSON = .object(["action": .string("save"), "expectedOwner": .string(owner),
                                       "data": .object(["kind": .string("exercise"), "item": item])])
        do {
            let response = try await api.request("/api/library", method: "POST", json: JSONEncoder().encode(body))
            let updated = try JSONDecoder().decode(NativeJSON.self, from: response)["updated"]
            let row: NativeJSON = .object(["kind": .string("exercise"), "item": item, "updated": updated])
            if let previous = libraryRows.firstIndex(where: { $0["kind"].string == "exercise" && $0["item"]["name"] == item["name"] }) {
                libraryRows[previous] = row
            } else {
                libraryRows.insert(row, at: 0)
            }
            return nil
        } catch { return error.localizedDescription }
    }

    func saveHistoryOrder(day: String, entryIDs: [String]) async throws {
        let payload = ["kind": NativeJSON.string("history-order"), "id": .string(day), "entries": .array(entryIDs.map(NativeJSON.string))]
        let body = NativeJSON.object(["action": .string("save"), "expectedOwner": .string(owner), "data": .object(payload)])
        let response = try await api.request("/api/library", method: "POST", json: JSONEncoder().encode(body))
        let updated = try JSONDecoder().decode(NativeJSON.self, from: response)["updated"]
        var row = payload
        row["updated"] = updated
        var rows = libraryRows
        rows.removeAll { $0["kind"].string == "history-order" && $0["id"].string == day }
        rows.insert(.object(row), at: 0)
        libraryRows = rows
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
    @Environment(\.spotterAccent) private var accent
    var showsAllPlans = false
    var openSettings: (() -> Void)? = nil
    var openNutrition: (() -> Void)? = nil
    var openAllPlans: (() -> Void)? = nil
    var openStats: (() -> Void)? = nil
    var openCoach: (() -> Void)? = nil
    var openImport: (() -> Void)? = nil
    var openPrograms: (() -> Void)? = nil
    var openFriends: (() -> Void)? = nil
    var openRest: (() -> Void)? = nil
    var openBody: (() -> Void)? = nil
    var homeNutrition: AnyView? = nil
    @Environment(\.spotterInteractionMotion) private var motion
    @Namespace private var trainingSelection
    @AppStorage("spotter.native.home.nutritionCollapsed") private var nutritionCollapsed = false
    @AppStorage(NativePreferenceKey.weeklyCheckins) private var showCheckins = true
    @AppStorage(NativePreferenceKey.planShortcut) private var showPlanShortcut = true
    @State private var selectedDate = Date()
    @State private var opensWorkout = false
    @State private var showsLaunch = false
    @State private var pendingLaunchKind: String?
    @State private var pendingLaunchAction: (() -> Void)?
    @State private var trainingTab = "我的计划"
    @State private var completedPlans = false
    @State private var showsMoves = false
    @State private var planEditor: NativePlanDraft?
    @State private var planScheduleAction: PlanScheduleAction?
    @State private var planNotice: String?
    @State private var cataloguePlanMove: NativeCataloguePlanMove?
    @State private var queuedCatalogueDraft: NativePlanDraft?
    @State private var recordSheet: RecordSheet?
    @State private var finishedWorkout: NativeWorkoutEntry?
    @State private var cheering = false
    @State private var cheerError: String?

    private enum PlanScheduleAction: Identifiable {
        case move(NativeWorkoutEntry), remove(NativeWorkoutEntry)

        var id: String {
            switch self {
            case .move(let plan): return "move:\(plan.id)"
            case .remove(let plan): return "remove:\(plan.id)"
            }
        }
    }

    private enum RecordSheet: Identifiable {
        case record(NativeWorkoutEntry), share(NativeWorkoutEntry), day(String, [NativeWorkoutEntry])

        var id: String {
            switch self {
            case .record(let entry): return "record:\(entry.owner):\(entry.id)"
            case .share(let entry): return "share:\(entry.owner):\(entry.id)"
            case .day(let day, _): return "day:\(day)"
            }
        }
    }

    private var selectedDay: String { NativeWorkoutSession.day(selectedDate) }
    private var visibleLogs: [NativeWorkoutEntry] { store.logs + store.partnerLogs }
    private var completions: [NativeWorkoutEntry.Key: [NativeWorkoutEntry]] {
        Dictionary(grouping: visibleLogs.filter { $0.planKey != nil }, by: { $0.planKey ?? $0.key })
    }

    var body: some View {
        Group {
            if showsAllPlans {
                VStack(alignment: .leading, spacing: 9) {
                    trainingTabs
                        .padding(.horizontal, 14)
                        .padding(.top, 12)
                    if trainingTab == "动作库" {
                        NativeCatalogueBrowser(store: store) { entry in
                            cataloguePlanMove = NativeCataloguePlanMove(entry: entry)
                        }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 5)
                    } else {
                        workoutOverview(topPadding: 7)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            } else {
                workoutOverview(topPadding: 12)
            }
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .tint(accent.tint)
        .toolbar(.hidden, for: .navigationBar)
        .fullScreenCover(isPresented: $opensWorkout, onDismiss: {
            if let finishedWorkout { recordSheet = .record(finishedWorkout); self.finishedWorkout = nil }
        }) {
            NativeActiveWorkoutView(store: store) { finishedWorkout = $0 }
        }
        .sheet(item: $recordSheet) { screen in
            switch screen {
            case .record(let entry):
                NavigationStack { recordDetail(entry, showsClose: true) }
                    .presentationDragIndicator(.visible)
            case .share(let entry):
                if entry.owner == store.owner, let current = store.logs.first(where: { $0.key == entry.key }) {
                    NativeWorkoutShareView(entry: current, logs: store.logs, owner: store.owner, displayName: store.viewerName, api: store.api)
                }
            case .day(let day, let records):
                NavigationStack { dayDetails(day, records: records) }
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(item: $planEditor) { draft in
            NavigationStack {
                NativePlanEditorPanel(store: store, draft: draft) { day in
                    if draft.isTemplate {
                        if showsAllPlans { trainingTab = "个人模板" }
                        planNotice = "模板已保存"
                    } else {
                        trainingTab = "我的计划"
                        completedPlans = false
                        if let date = nativePlanDate(day) { selectedDate = date }
                    }
                }
            }
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $planScheduleAction) { action in
            switch action {
            case .move(let plan):
                NativePlanMoveSheet(store: store, entry: plan) { receipt in
                    if let date = nativePlanDate(receipt.date) { selectedDate = date }
                    showsMoves = false
                    planNotice = receipt.moved > 1 ? "已顺延 \(receipt.moved) 节训练" : "训练已移动"
                }
            case .remove(let plan):
                NativePlanDeleteSheet(store: store, entry: plan) { planNotice = "计划已删除" }
            }
        }
        .task(id: planNotice) {
            guard planNotice != nil else { return }
            do { try await Task.sleep(for: .seconds(4)) }
            catch { return }
            planNotice = nil
        }
        .sheet(item: $cataloguePlanMove, onDismiss: openQueuedCataloguePlan) { pending in
            NativeCataloguePlanPicker(store: store, move: pending) { plan in
                editCataloguePlan(pending.entry, in: plan)
            }
        }
        .sheet(isPresented: $showsLaunch, onDismiss: {
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
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private func workoutOverview(topPadding: CGFloat) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let planNotice {
                    Label(planNotice, systemImage: "checkmark.circle")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if showsAllPlans { trainingLanding } else { todayLanding }
                if !store.pendingCheckins.isEmpty { pendingCard }
                if let message = store.errorMessage {
                    Button { Task { await store.load() } } label: {
                        Label(message, systemImage: "arrow.clockwise").font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }.buttonStyle(.spotterPress)
                }
            }
            .padding(.horizontal, 14).padding(.top, topPadding).padding(.bottom, 26)
        }
        .refreshable { await store.load() }
    }

    @ViewBuilder private var todayLanding: some View {
        let byPlan = completions
        let dayPlans = store.plans.filter { $0.day == selectedDay && byPlan[$0.key] == nil }
            .sorted { ($0.owner == store.owner ? 0 : 1) < ($1.owner == store.owner ? 0 : 1) }
        let scheduledCompletions = store.plans.filter { $0.day == selectedDay && byPlan[$0.key] != nil }
            .flatMap { plan in
                let matches = byPlan[plan.key] ?? []
                return matches.contains { $0.day == selectedDay } ? [] : Array(matches.sorted(by: newestRecord).prefix(1))
            }
        let dayRecords = (store.logs.filter { $0.day == selectedDay } + store.partnerLogs.filter {
            $0.day == selectedDay && $0.planKey.flatMap { store.plansByKey[$0] } != nil
        } + scheduledCompletions).sorted(by: newestRecord)
        HStack(spacing: 8) {
            if nutritionCollapsed && openNutrition != nil {
                nativeIconButton("fork.knife", label: "展开饮食记录") { nutritionCollapsed = false }
            }
            Button { showsLaunch = true } label: { Label("训练", systemImage: "play.fill").font(.system(size: 15, weight: .bold)) }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
            Spacer()
            nativeIconButton("gearshape", label: "设置") { openSettings?() }
        }
        if !nutritionCollapsed && openNutrition != nil {
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
                    }.buttonStyle(.spotterPress)
                }
            }
        }
        if openFriends != nil { partnerCard }
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
        } else if dayRecords.isEmpty {
            emptyCard("这天还没有安排", symbol: "dumbbell")
        }
        if !dayRecords.isEmpty { completedRows(dayRecords) }
        if showCheckins { weeklyCheckins }
        if showPlanShortcut {
            Button { openCoach?() } label: {
                HStack(spacing: 12) {
                    tile("sparkles", color: Color(red: 0.57, green: 0.45, blue: 0.78))
                    VStack(alignment: .leading, spacing: 4) { Text("添加计划").font(.system(size: 16, weight: .bold)); Text("用 AI 起草训练计划").font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(SpotterPalette.muted)
                }.padding(15).spotterCard()
            }.buttonStyle(.spotterPress)
        }
    }

    private var partnerCard: some View {
        let today = NativeWorkoutSession.day()
        let mine = store.logs.filter { $0.day == today }
        let partnerToday = store.partnerLogs.filter { $0.day == today }
        let latest = store.partnerLogs.filter { $0.day <= today }.sorted(by: newestRecord).first
        let lastDay = store.room["partnerCheckins"].array
            .filter { $0["count"].number > 0 }
            .map { $0["date"].string }
            .filter { !$0.isEmpty && $0 <= today }
            .max()
        let sentCheer = store.entries.contains { $0.kind == "cheer" && $0.owner == store.owner && $0.day == today }
        let receivedCheer = store.entries.contains { entry in
            guard entry.kind == "cheer", entry.owner == store.partnerID else { return false }
            return localRecordDay(entry.updated) == today
        }
        let connected = !store.partnerID.isEmpty
        let canSeePartner = store.room["partnerTrainingShared"] != .bool(false)
        return VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 9) {
                tile("person.2", size: 36)
                Text("今日搭子打卡").font(.system(size: 17, weight: .bold))
                Spacer()
                if connected && canSeePartner {
                    Text("\(todayMine ? 1 + (todayPartner ? 1 : 0) : (todayPartner ? 1 : 0)) / 2 已打卡")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(SpotterPalette.muted)
                }
            }
            HStack(spacing: 12) {
                member("我", initial: String(store.viewerName.prefix(1)), checked: todayMine, connected: true, purple: false, records: mine)
                member(store.partnerName, initial: connected ? String(store.partnerName.prefix(1)) : "", checked: todayPartner,
                       connected: connected, purple: true, statusOverride: canSeePartner ? nil : "打卡未公开", records: partnerToday)
            }
            if canSeePartner, let latest, latest.day >= (lastDay ?? "") {
                Button { recordSheet = .record(latest) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("搭子最近打卡 · \(shortDay(latest.day))").font(.caption).foregroundStyle(SpotterPalette.muted)
                            Text(latest.displayTitle).font(.subheadline.weight(.bold))
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                    }.frame(minHeight: 44).contentShape(Rectangle())
                }.buttonStyle(.spotterPress)
            } else if canSeePartner, let lastDay {
                Text("搭子最近打卡 · \(shortDay(lastDay))").font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            if receivedCheer {
                Label("搭子今天给你加油了", systemImage: "flame").font(.subheadline).foregroundStyle(.brown)
            }
            HStack(spacing: 8) {
                Button { openFriends?() } label: {
                    Label(connected ? "看搭子打卡" : "连接训练搭子", systemImage: connected ? "person.2" : "link")
                        .font(.subheadline.weight(.bold)).frame(maxWidth: .infinity)
                }.buttonStyle(SpotterNativeButtonStyle(primary: !connected))
                if connected {
                    Button {
                        Task {
                            cheering = true; cheerError = nil
                            defer { cheering = false }
                            do { try await store.cheer() }
                            catch { cheerError = error.localizedDescription }
                        }
                    } label: {
                        Label(sentCheer ? "今天已加油" : "给搭子加油", systemImage: sentCheer ? "checkmark" : "flame")
                            .font(.subheadline.weight(.bold)).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .disabled(cheering || sentCheer)
                }
            }
            if let cheerError { Text(cheerError).font(.caption).foregroundStyle(SpotterPalette.muted) }
        }.padding(14).spotterCard()
    }

    private var todayMine: Bool { store.logs.contains { $0.day == NativeWorkoutSession.day() } }
    private var todayPartner: Bool {
        guard !store.partnerID.isEmpty, store.room["partnerTrainingShared"] != .bool(false) else { return false }
        return store.partnerLogs.contains { $0.day == NativeWorkoutSession.day() } ||
            store.room["partnerCheckins"].array.contains { $0["date"].string == NativeWorkoutSession.day() && $0["count"].number > 0 }
    }

    private func member(_ name: String, initial: String, checked: Bool, connected: Bool, purple: Bool,
                        statusOverride: String? = nil, records: [NativeWorkoutEntry]) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                Group { if initial.isEmpty { Image(systemName: "person") } else { Text(initial).fontWeight(.bold) } }
                    .font(.system(size: 14)).frame(width: 32, height: 32)
                    .background(purple ? SpotterPalette.color(0xe8def7) : accent.fill, in: Circle())
                    .foregroundStyle(SpotterPalette.deep)
                Text(name).font(.system(size: 14, weight: .bold)).lineLimit(1)
            }
            Label(statusOverride ?? (connected ? (checked ? "已打卡" : store.isLoading ? "同步中" : "未打卡") : "未连接"), systemImage: checked ? "checkmark" : "circle")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(checked ? SpotterPalette.accent : SpotterPalette.muted)
            if let first = records.first {
                Button {
                    recordSheet = records.count == 1 ? .record(first) : .day(first.day, records)
                } label: {
                    HStack(spacing: 3) {
                        Text(records.count == 1 ? first.displayTitle : "\(records.count) 次训练")
                            .multilineTextAlignment(.leading).lineLimit(2)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.caption2.bold())
                    }.font(.caption).frame(minHeight: 32).contentShape(Rectangle())
                }.buttonStyle(.spotterPress)
            }
        }.frame(maxWidth: .infinity, alignment: .topLeading).padding(11)
            .background(purple ? SpotterPalette.adaptive(0xf4effa, 0x372c45) : SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
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
                            .background(day == selectedDay ? accent.fill : SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                    }.buttonStyle(.spotterPress).accessibilityLabel(day)
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
        let plan = NativePlan(raw: entry.data)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Circle().fill(accent.fill).frame(width: 6, height: 6)
                    Text((entry.owner == store.owner ? "" : "搭子共享 · ") + entry.data["category"].string)
                        .font(.system(size: 12, weight: .bold))
                }.padding(.horizontal, 10).padding(.vertical, 6).background(SpotterPalette.deep.opacity(0.68), in: Capsule())
                    .overlay(Capsule().stroke(accent.fill.opacity(0.3), lineWidth: 1))
                Text(plan.displayTitle).font(.system(size: 30, weight: .heavy)).tracking(-0.7).lineSpacing(1).frame(maxWidth: 280, alignment: .leading)
                HStack(spacing: 12) {
                    if !plan.weekDay.isEmpty { Label(plan.weekDay, systemImage: "calendar") }
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
                    Menu { planActions(entry) } label: {
                        Image(systemName: "ellipsis").font(.system(size: 18, weight: .bold)).frame(width: 40, height: 40)
                            .foregroundStyle(.white).background(SpotterPalette.deep.opacity(0.8), in: RoundedRectangle(cornerRadius: 10))
                    }.accessibilityLabel("训练操作 " + entry.displayTitle).padding(12)
                }
            }
    }

    private func movementCard(_ entry: NativeWorkoutEntry) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(motion) { showsMoves.toggle() } } label: {
                HStack {
                    Text("动作清单").font(.system(size: 17, weight: .bold))
                    Spacer()
                    Text("\(entry.data["exercises"].array.count) 个动作").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    Image(systemName: "chevron.down").rotationEffect(.degrees(showsMoves ? 180 : 0))
                }.padding(14)
            }.buttonStyle(.spotterPress)
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

    private func planRows(_ entries: [NativeWorkoutEntry]) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(entries, id: \.key) { entry in
                let plan = NativePlan(raw: entry.data)
                HStack(spacing: 9) {
                    tile("dumbbell", size: 34)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.displayTitle).font(.system(size: 14, weight: .bold)).lineLimit(2)
                        Text([shortDay(entry.day), plan.weekDay, plan.category,
                              entry.durationMinutes > 0 ? "\(entry.durationMinutes) 分钟" : ""].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 0)
                    Button("开始") { store.start(plan: plan, id: entry.id); opensWorkout = true }
                        .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(store.active != nil || store.isBusy)
                    if entry.owner == store.owner {
                        Menu { planActions(entry) } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }
                            .accessibilityLabel("训练操作 " + entry.displayTitle)
                    }
                }.padding(.vertical, 10)
                if entry.key != entries.last?.key { Divider().overlay(SpotterPalette.line) }
            }
        }.padding(.horizontal, 12).spotterCard()
    }

    @ViewBuilder private func planActions(_ entry: NativeWorkoutEntry) -> some View {
        Button("编辑计划", systemImage: "pencil") { planEditor = NativePlanDraft(entry: entry) }
        if store.canMovePlan(entry) {
            Button("移动或顺延", systemImage: "calendar.badge.clock") { planScheduleAction = .move(entry) }
        }
        Button("另存为模板", systemImage: "bookmark") { planEditor = NativePlanDraft(copying: NativePlan(raw: entry.data)) }
        Button("删除计划", systemImage: "trash", role: .destructive) { planScheduleAction = .remove(entry) }
    }

    private func completedRows(_ records: [NativeWorkoutEntry]) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(records, id: \.key) { entry in
                let linkedPlan = entry.planKey.flatMap { store.plansByKey[$0] }
                let plan = NativePlan(raw: linkedPlan?.data ?? entry.data["plan"])
                let templateID = plan.raw["templateId"].string
                let fromTemplate = !templateID.isEmpty && entry.owner == store.owner &&
                    store.libraryRows.contains { $0["kind"].string == "template" && $0["id"].string == templateID }
                let subtitle = [shortDay(entry.day), plan.weekDay, plan.category,
                                entry.durationMinutes > 0 ? "\(entry.durationMinutes) 分钟" : "",
                                fromTemplate ? "模板" : "", entry.owner != store.owner ? store.partnerName : "", "已完成"]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                HStack(spacing: 8) {
                    tile("checkmark", size: 38)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.displayTitle).font(.system(size: 15, weight: .bold)).lineLimit(2)
                        Text(subtitle).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    }
                    .layoutPriority(1)
                    Spacer(minLength: 0)
                    if entry.owner == store.owner {
                        Menu {
                            if let linkedPlan { planActions(linkedPlan) }
                            Button("分享训练", systemImage: "square.and.arrow.up") { recordSheet = .share(entry) }
                        } label: {
                            Image(systemName: "ellipsis").font(.subheadline.bold())
                                .frame(width: 42, height: 40)
                                .background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(SpotterPalette.line))
                        }
                        .accessibilityLabel("更多训练选项")
                    }
                    Button { recordSheet = .record(entry) } label: {
                        Text("查看记录").font(.system(size: 13, weight: .bold)).lineLimit(1).fixedSize()
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: false))
                    .accessibilityHint(entry.displayTitle)
                }.padding(.vertical, 13)
                if entry.key != records.last?.key { Divider().overlay(SpotterPalette.line) }
            }
        }.padding(.horizontal, 12).spotterCard()
    }

    private func recordDetail(_ entry: NativeWorkoutEntry, showsClose: Bool = false) -> some View {
        NativeWorkoutDetailView(store: store, entry: entry, showsClose: showsClose)
    }

    private func dayDetails(_ day: String, records: [NativeWorkoutEntry]) -> some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(records.sorted(by: newestRecord), id: \.key) { entry in
                    NavigationLink {
                        recordDetail(entry)
                    } label: {
                        HStack {
                            Label(entry.displayTitle, systemImage: "checkmark.circle")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .padding(14).spotterCard()
                    }.buttonStyle(.spotterPress)
                }
            }.padding(14)
        }
        .background(SpotterPalette.background)
        .navigationTitle("\(shortDay(day))的打卡")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { recordSheet = nil } } }
    }

    private var weeklyCheckins: some View {
        let calendar = Calendar(identifier: .gregorian)
        let today = calendar.startOfDay(for: Date())
        let dates = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0 - 6, to: today) }
        let days = dates.map { NativeWorkoutSession.day($0) }
        let own = Dictionary(grouping: store.logs, by: \.day)
        let shared = Dictionary(grouping: store.partnerLogs, by: \.day)
        let partnerDays = Set(store.room["partnerCheckins"].array.filter { $0["count"].number > 0 }.map { $0["date"].string })
        return VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text("近 7 天打卡").font(.system(size: 17, weight: .bold))
                Spacer()
                if let openStats {
                    nativeIconButton("chart.bar", label: "查看训练统计", action: openStats)
                }
            }
            HStack(spacing: 4) {
                Color.clear.frame(width: 58, height: 12).accessibilityHidden(true)
                ForEach(dates, id: \.self) { date in
                    Text(["日", "一", "二", "三", "四", "五", "六"][calendar.component(.weekday, from: date) - 1])
                        .font(.caption2).foregroundStyle(SpotterPalette.muted).frame(maxWidth: .infinity)
                }
            }
            checkinRow("我", days: days, records: own)
            if openFriends != nil, !store.partnerID.isEmpty, store.room["partnerTrainingShared"] != .bool(false) {
                checkinRow(store.partnerName, days: days, records: shared, partnerDays: partnerDays,
                           visibleFrom: store.room["partnerCheckinsFrom"].string)
            }
        }.padding(14).spotterCard()
    }

    private func checkinRow(_ name: String, days: [String], records: [String: [NativeWorkoutEntry]],
                            partnerDays: Set<String>? = nil, visibleFrom: String = "") -> some View {
        let completed = days.filter { records[$0] != nil || partnerDays?.contains($0) == true }.count
        return HStack(spacing: 4) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.caption.weight(.bold)).lineLimit(1)
                Text("\(completed) 天").font(.caption2).foregroundStyle(SpotterPalette.muted)
            }.frame(width: 58, alignment: .leading)
            ForEach(days, id: \.self) { day in
                let sessions = records[day] ?? []
                let checked = !sessions.isEmpty || partnerDays?.contains(day) == true
                let known = visibleFrom.isEmpty || day >= visibleFrom
                let mark = Image(systemName: checked ? "checkmark" : known ? "circle.fill" : "minus")
                    .font(.system(size: checked ? 10 : known ? 3 : 8, weight: .bold))
                    .frame(width: 24, height: 24)
                    .foregroundStyle(checked ? SpotterPalette.deep : SpotterPalette.muted)
                    .background(checked ? (partnerDays == nil ? accent.fill.opacity(0.85) : SpotterPalette.color(0xe5d9f6)) : SpotterPalette.wash, in: Circle())
                Group {
                    if let first = sessions.first {
                        Button { recordSheet = sessions.count == 1 ? .record(first) : .day(day, sessions) } label: {
                            mark.frame(maxWidth: .infinity, minHeight: 36).contentShape(Rectangle())
                        }.buttonStyle(.spotterPress).accessibilityLabel("\(name) \(shortDay(day)) \(sessions.count) 次打卡")
                    } else {
                        mark.frame(minHeight: 36).accessibilityLabel("\(name) \(shortDay(day))" +
                            (checked ? "已打卡" : known ? "未打卡" : "暂无共享信息"))
                    }
                }.frame(maxWidth: .infinity)
            }
        }
    }

    private var trainingTabs: some View {
        HStack(spacing: 3) {
            ForEach(["我的计划", "个人模板", "动作库"], id: \.self) { tab in
                Button { trainingTab = tab } label: {
                    Text(tab).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                        .padding(.vertical, 10).frame(maxWidth: .infinity)
                        .foregroundStyle(trainingTab == tab ? SpotterPalette.deep : SpotterPalette.muted)
                        .background {
                            if trainingTab == tab {
                                Color.clear
                                    .spotterGlass(cornerRadius: 10, tint: accent.fill, interactive: false)
                                    .matchedGeometryEffect(id: "trainingSelection", in: trainingSelection)
                                    .allowsHitTesting(false)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityAddTraits(trainingTab == tab ? [.isSelected] : [])
            }
        }
        .animation(motion, value: trainingTab)
        .padding(3)
        .background(SpotterPalette.wash.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
    }

    private func editCataloguePlan(_ entry: NativeCatalogEntry, in plan: NativeWorkoutEntry?) {
        var draft = plan.map(NativePlanDraft.init(entry:)) ?? NativePlanDraft(day: selectedDay)
        if plan == nil { draft.plan["title"] = .string(entry.name) }
        var raw = draft.plan.object
        raw.removeValue(forKey: "templateId")
        raw.removeValue(forKey: "ownExercises")
        raw["exercises"] = .array(draft.plan["exercises"].array + [NativeCataloguePlanMove.planMove(entry)])
        draft.plan = .object(raw)
        queuedCatalogueDraft = draft
        cataloguePlanMove = nil
    }

    private func openQueuedCataloguePlan() {
        if let draft = queuedCatalogueDraft {
            queuedCatalogueDraft = nil
            trainingTab = "我的计划"
            completedPlans = false
            planEditor = draft
        }
    }

    @ViewBuilder private var trainingLanding: some View {
        if trainingTab == "我的计划" {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("全部计划").font(.system(size: 18, weight: .bold))
                    Spacer()
                    Menu {
                        if let openCoach { Button("AI 教练起草", systemImage: "sparkles", action: openCoach) }
                        if let openImport { Button("粘贴已有内容", systemImage: "list.bullet.clipboard", action: openImport) }
                        if let openPrograms { Button("训练周期", systemImage: "calendar.badge.plus", action: openPrograms) }
                    } label: { Label("添加计划", systemImage: "plus.square.on.square").font(.system(size: 12, weight: .semibold)) }
                    Button { planEditor = NativePlanDraft(day: selectedDay) } label: { Label("新建计划", systemImage: "plus").font(.system(size: 12, weight: .semibold)) }
                        .buttonStyle(SpotterNativeButtonStyle(primary: true))
                }
                HStack(spacing: 4) {
                    ForEach([false, true], id: \.self) { completed in
                        Button { completedPlans = completed } label: {
                            Text(completed ? "已完成" : "待训练").font(.system(size: 13, weight: .semibold)).padding(.vertical, 9).frame(maxWidth: .infinity)
                                .foregroundStyle(completedPlans == completed ? SpotterPalette.deep : SpotterPalette.muted)
                                .background(completedPlans == completed ? accent.fill : .clear, in: RoundedRectangle(cornerRadius: 7))
                        }.buttonStyle(.spotterPress)
                    }
                }.padding(3).background(SpotterPalette.wash.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            }.padding(12).spotterCard()
            if completedPlans {
                let records = visibleLogs.sorted(by: newestRecord)
                if records.isEmpty { emptyCard("还没有已完成的训练", symbol: "list.clipboard") }
                else { completedRows(records) }
            } else {
                let byPlan = completions
                let plans = store.plans.filter { byPlan[$0.key] == nil }.sorted { $0.day < $1.day }
                if plans.isEmpty { emptyCard("还没有训练计划", symbol: "list.clipboard") }
                else { planRows(plans) }
            }
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
        }
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
    @Environment(\.spotterAccent) private var accent
    var primary: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 13).padding(.vertical, 11)
            .foregroundStyle(primary ? SpotterPalette.deep : SpotterPalette.ink)
            .spotterGlass(cornerRadius: 11, tint: primary ? accent.fill : SpotterPalette.card.opacity(0.85))
            .spotterPressFeedback(configuration.isPressed)
    }
}

private func tile(_ symbol: String, size: CGFloat = 40, color: Color? = nil) -> some View {
    Image(systemName: symbol).font(.system(size: size * 0.45, weight: .semibold)).frame(width: size, height: size)
        .foregroundStyle(color ?? SpotterPalette.accent).background((color ?? SpotterPalette.accent).opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
}

private func nativeIconButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) { Image(systemName: symbol).font(.system(size: 19)).frame(width: 44, height: 44).background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12)) }
        .buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.ink).accessibilityLabel(label)
}

private func shortDay(_ day: String) -> String {
    let parts = day.split(separator: "-")
    guard parts.count == 3 else { return day }
    return "\(Int(parts[1]) ?? 0)月\(Int(parts[2]) ?? 0)日"
}

private func newestRecord(_ left: NativeWorkoutEntry, _ right: NativeWorkoutEntry) -> Bool {
    if left.day != right.day { return left.day > right.day }
    let leftTime = max(left.data["started"].number, left.data["ended"].number)
    let rightTime = max(right.data["started"].number, right.data["ended"].number)
    if leftTime != rightTime { return leftTime > rightTime }
    return (left.updated, left.id) > (right.updated, right.id)
}

private func localRecordDay(_ timestamp: String) -> String? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: timestamp) { return NativeWorkoutSession.day(date) }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: timestamp).map { NativeWorkoutSession.day($0) }
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
        ScrollView {
            VStack(spacing: 18) {
                HStack {
                    Text("开始训练").font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.subheadline.weight(.semibold)).frame(width: 44, height: 44)
                            .spotterGlass(cornerRadius: 22, tint: .white.opacity(0.16))
                    }
                    .buttonStyle(.spotterPress).accessibilityLabel("关闭开始训练")
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 19) {
                    ForEach(choices, id: \.0) { choice in launchButton(choice.1, symbol: choice.2, color: choice.3) { start(choice.0) } }
                    launchButton("安排休息", symbol: "cup.and.saucer", color: Color(red: 0.79, green: 0.75, blue: 0.93)) { rest?() }.disabled(rest == nil)
                    launchButton("身体数据", symbol: "ruler", color: Color(red: 0.95, green: 0.76, blue: 0.67)) { bodyAction?() }.disabled(bodyAction == nil)
                }
            }
            .frame(maxWidth: 620)
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 14)
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(.white)
        .background(SpotterPalette.deep.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
    private func launchButton(_ title: String, symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 31, weight: .medium)).frame(width: 70, height: 70)
                    .background(color, in: RoundedRectangle(cornerRadius: 17)).foregroundStyle(SpotterPalette.deep)
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
        }.buttonStyle(.spotterPress)
    }
}

struct NativeCataloguePlanMove: Identifiable {
    let entry: NativeCatalogEntry
    var id: String { entry.id }

    static func planMove(_ entry: NativeCatalogEntry) -> NativeJSON {
        let timed = entry.hold || entry.type == "isometric" || entry.type == "cardio"
        let repetitions = entry.distance ? 1.0 : Double(NativePreferenceKey.newMoveReps)
        var move: NativeJSON = .object([
            "name": .string(String(entry.name.prefix(100))),
            "sets": .number(Double(NativePreferenceKey.newMoveSets)),
            "reps": .number(timed ? 0 : repetitions),
            "weight": .number(0),
            "unit": .string(NativePreferenceKey.newMoveUnit),
            "seconds": .number(timed ? 30 : 0),
        ])
        if !entry.isPersonal { move["catalogueId"] = .string(entry.id) }
        return move
    }
}

private struct NativeCataloguePlanPicker: View {
    @ObservedObject var store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var selected = ""
    @State private var warning: String?
    let move: NativeCataloguePlanMove
    var selectPlan: (NativeWorkoutEntry?) -> Void

    private var plans: [NativeWorkoutEntry] {
        store.plans.filter { $0.owner == store.owner && $0.data["exercises"].array.count < 30 }
            .sorted { $0.day < $1.day }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(move.entry.name).font(.headline)
                    Picker("选择训练计划", selection: $selected) {
                        Text("新建训练计划").tag("")
                        ForEach(plans) { plan in
                            Text("\(plan.day) · \(plan.title)").tag(plan.id)
                        }
                    }
                }
                if let plan = plans.first(where: { $0.id == selected }), !plan.data["templateId"].string.isEmpty {
                    Text("保存这次的动作改动后，这一节会成为独立计划。")
                        .font(.footnote).foregroundStyle(SpotterPalette.muted)
                }
                if let warning { Text(warning).font(.footnote).foregroundStyle(.red) }
                Button {
                    let plan = plans.first { $0.id == selected }
                    guard selected.isEmpty || plan != nil else {
                        warning = "这个计划已更新，请重新选择。"
                        return
                    }
                    selectPlan(plan)
                } label: {
                    Label("加入并编辑", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SpotterNativeButtonStyle(primary: true))
            }
            .navigationTitle("加入训练计划")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
        }
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
    @Environment(\.spotterAccent) private var accent
    @ObservedObject var store: NativeWorkoutStore
    let completed: (NativeWorkoutEntry) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @Environment(\.spotterInteractionMotion) private var motion
    @AppStorage(NativePreferenceKey.showNext) private var showNext = true
    @AppStorage(NativePreferenceKey.showTempo) private var showTempo = true
    @AppStorage(NativePreferenceKey.showEffort) private var showEffort = true
    @AppStorage(NativePreferenceKey.autoAdvance) private var autoAdvance = false
    @AppStorage(NativePreferenceKey.restSound) private var restSound = false
    @AppStorage(NativePreferenceKey.restHaptics) private var restHaptics = false
    @AppStorage(NativePreferenceKey.keepAwake) private var keepAwake = false
    @State private var openedMove = 0
    @State private var edit: NativeSetTarget?
    @State private var editText = ""
    @State private var pristine = true
    @State private var panel: NativeEditorPanel?
    @State private var dismissAfterPanel = false
    @State private var changedIdleTimer = false
    @State private var lastRestRemaining: Int?

    private var needsIdleTimer: Bool {
        keepAwake && phase == .active && store.active?.session?.isRunning == true
    }

    var body: some View {
        Group {
            if let entry = store.active, let session = entry.session { workout(entry, session: session) }
            else { VStack(spacing: 15) { Image(systemName: "checkmark.circle").font(.largeTitle); Text("训练已保存").font(.title2.bold()); Text(store.status).font(.subheadline); Button("返回") { dismiss() } }.frame(maxWidth: .infinity, maxHeight: .infinity).background(SpotterPalette.background) }
        }
        .foregroundStyle(SpotterPalette.ink).tint(accent.tint)
        .task { await store.loadProteinPreferences() }
        .onAppear { updateIdleTimer(needsIdleTimer) }
        .onChange(of: needsIdleTimer) { enabled in updateIdleTimer(enabled) }
        .onDisappear { updateIdleTimer(false) }
        .sheet(item: $panel, onDismiss: finishPanelDismissal) { item in
            NavigationStack {
                switch item {
                case .note: NativeWorkoutNotePanel(store: store)
                case .settings: NativeWorkoutSettingsPanel(store: store)
                case .add: NativeWorkoutAddPanel(store: store)
                case .finish:
                    NativeWorkoutFinishPanel(store: store) { record in
                        completed(record)
                        dismissAfterPanel = true
                        panel = nil
                    }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(item == .finish && store.isBusy)
        }
    }

    private func finishPanelDismissal() {
        guard dismissAfterPanel else { return }
        dismissAfterPanel = false
        dismiss()
    }

    private func workout(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(spacing: 0) {
            editorHeader(entry, session: session)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    let total = session.rows.flatMap { $0 }.count + (session.plan.video.isEmpty ? 0 : 1)
                    if total > 0 { ProgressView(value: Double(session.completedSets + (session.raw["finishedVideo"].bool ? 1 : 0)), total: Double(total)).tint(SpotterPalette.accent).padding(.horizontal, 2) }
                    if !session.plan.raw["durationNote"].string.isEmpty { Text(session.plan.raw["durationNote"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                    if showNext, let next = nextSet(session) {
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
            ZStack(alignment: .bottom) {
                if let edit { keypad(edit, session: session).transition(.move(edge: .bottom).combined(with: .opacity)) }
                else { actionBar(session).transition(.opacity) }
            }
            .animation(motion, value: edit != nil)
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
                        .buttonStyle(.spotterPress)
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
                    let remaining = max(0, Int(ceil((session.raw["rest"]["until"].number - Double(session.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000)))) / 1000)))
                    HStack {
                        Text(remaining > 0 ? "\(session.raw["rest"]["kind"].string) \(NativeWorkoutView.duration(remaining * 1000))" : "休息结束").font(.system(size: 13, weight: .semibold))
                        Spacer()
                        Button(remaining > 0 ? "跳过" : "关闭") { store.mutate { session in var raw = session.raw.object; raw.removeValue(forKey: "rest"); session.raw = .object(raw) } }.font(.system(size: 12))
                    }.padding(.top, 5).onAppear { lastRestRemaining = remaining }
                        .onChange(of: remaining) { current in
                        if (lastRestRemaining ?? 0) > 0, current == 0, phase == .active {
                            if restSound { AudioServicesPlaySystemSound(1057) }
                            if restHaptics { UINotificationFeedbackGenerator().notificationOccurred(.success) }
                        }
                        lastRestRemaining = current
                    }
                }
            }
        }.padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 12)
    }

    private func exerciseCard(_ index: Int, move: NativeJSON, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Button { withAnimation(motion) { openedMove = openedMove == index ? -1 : index; edit = nil } } label: {
                HStack(spacing: 9) {
                    Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string).font(.system(size: 13, weight: .bold)).frame(width: 34, height: 30).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                    Text(move["name"].string).font(.system(size: 16, weight: .bold)).multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Text("\(session.rows.indices.contains(index) ? session.rows[index].filter { $0["done"].bool }.count : 0)/\(Int(move["sets"].number)) 组").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    Image(systemName: "chevron.down").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        .rotationEffect(.degrees(openedMove == index ? 180 : 0))
                }
            }.buttonStyle(.spotterPress)
            if openedMove == index {
                if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                Text(prescription(move)).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                if showTempo && !move["tempo"].string.isEmpty { Text("节奏 \(move["tempo"].string)").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted) }
                ForEach(Array((session.rows.indices.contains(index) ? session.rows[index] : []).enumerated()), id: \.offset) { row, line in setRow(index, row: row, move: move, line: line) }
                Button { withAnimation(motion) { store.mutate { $0.addSet(move: index) } } } label: { Label("增加一组", systemImage: "plus").font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity) }
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
                if showEffort && line["rpe"] != .null { Text("RPE \(line["rpe"].number.formatted())").font(.system(size: 11, weight: .semibold)).padding(.horizontal, 7).padding(.vertical, 4).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 7)).frame(maxWidth: .infinity, alignment: .leading) }
            }
            Button { toggleDone(move: moveIndex, row: row) } label: {
                Image(systemName: line["done"].bool ? "checkmark.circle.fill" : "circle").font(.system(size: 24, weight: .medium)).frame(width: 38, height: 50)
                    .foregroundStyle(line["done"].bool ? SpotterPalette.accent : SpotterPalette.muted.opacity(0.55))
                    .scaleEffect(line["done"].bool ? 1.08 : 1)
            }.buttonStyle(.spotterPress).accessibilityLabel("标记第\(row + 1)组\(line["done"].bool ? "未完成" : "完成")")
        }
        .padding(7)
        .background(line["done"].bool ? SpotterPalette.wash : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 11))
        .animation(motion, value: line["done"].bool)
    }

    private func toggleDone(move: Int, row: Int) {
        edit = nil
        store.toggleDone(move: move, row: row)
        guard autoAdvance, let session = store.active?.session,
              session.rows.indices.contains(move), session.rows[move].allSatisfy({ $0["done"].bool }),
              let next = session.rows.indices.dropFirst(move + 1).first(where: { index in
                  session.rows[index].contains { !$0["done"].bool }
              }) else { return }
        withAnimation(motion) { openedMove = next }
    }

    private func updateIdleTimer(_ enabled: Bool) {
        if enabled && !UIApplication.shared.isIdleTimerDisabled {
            UIApplication.shared.isIdleTimerDisabled = true
            changedIdleTimer = true
        } else if !enabled && changedIdleTimer {
            UIApplication.shared.isIdleTimerDisabled = false
            changedIdleTimer = false
        }
    }

    private func setNumber(_ target: NativeSetTarget, label: String, value: Double, done: Bool) -> some View {
        Button { activate(target, value: value) } label: {
            VStack(spacing: 1) { Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(SpotterPalette.muted); Text(value.formatted(.number.precision(.fractionLength(0...2)))).font(.system(size: 19, weight: .bold)).monospacedDigit() }
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(edit == target ? accent.selection : done ? SpotterPalette.wash.opacity(0.4) : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(edit == target ? accent.tint : SpotterPalette.line, lineWidth: edit == target ? 2 : 1))
        }.buttonStyle(.spotterPress).accessibilityLabel("第\(target.row + 1)组\(label) \(value.formatted())")
    }

    private func actionBar(_ session: NativeWorkoutSession) -> some View {
        HStack(spacing: 3) {
            footerAction("最小化", symbol: "arrow.down.right.and.arrow.up.left") { Task { await store.saveDraft() }; dismiss() }
            footerAction("更多", symbol: "ellipsis") { panel = .settings }
            Button { panel = .add } label: {
                VStack(spacing: 5) { Image(systemName: "plus").font(.system(size: 23, weight: .semibold)).foregroundStyle(SpotterPalette.deep).frame(width: 42, height: 36).background(accent.fill, in: RoundedRectangle(cornerRadius: 13)); Text("加动作").font(.system(size: 11, weight: .bold)) }.frame(maxWidth: .infinity)
            }.buttonStyle(.spotterPress).disabled(session.plan.exercises.count >= 30)
            footerAction("写心得", symbol: "square.and.pencil") { panel = .note }
            footerAction("数字键盘", symbol: "keyboard") {
                if let next = nextSet(session) { let timed = session.plan.exercises[next.move]["seconds"].number > 0; let key = timed ? "seconds" : "weight"; activate(NativeSetTarget(move: next.move, row: next.row, key: key), value: session.rows[next.move][next.row][key].number) }
            }.disabled(session.rows.isEmpty)
        }.padding(.horizontal, 12).padding(.top, 7).padding(.bottom, 8).background(SpotterPalette.card).overlay(alignment: .top) { Rectangle().fill(SpotterPalette.line).frame(height: 1) }
    }

    private func footerAction(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { VStack(spacing: 6) { Image(systemName: symbol).font(.system(size: 21)); Text(title).font(.system(size: 11, weight: .semibold)) }.frame(maxWidth: .infinity, minHeight: 52) }.buttonStyle(.spotterPress).foregroundStyle(SpotterPalette.muted)
    }
    private func activate(_ target: NativeSetTarget, value: Double) { edit = target; editText = value.formatted(.number.grouping(.never).precision(.fractionLength(0...2))); pristine = true; openedMove = target.move }
    private func nextSet(_ session: NativeWorkoutSession) -> NativeSetTarget? {
        for (move, rows) in session.rows.enumerated() { if let row = rows.firstIndex(where: { !$0["done"].bool }) { return NativeSetTarget(move: move, row: row, key: "weight") } }
        return nil
    }
    private func finish() {
        if (store.tracksWorkoutProtein && !store.proteinProducts.isEmpty) || store.active?.data["proteinShake"].bool == true { panel = .finish }
        else {
            Task {
                if let record = await store.finish() { completed(record); dismiss() }
            }
        }
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
                        Button { press(value, target: target) } label: { Text(value).font(.system(size: 23, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44).background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 9)) }.buttonStyle(.spotterPress)
                    }
                    padAction(["加一组", "向上填", "向下填", "RPE"][row]) { rightAction(row, target: target) }
                }
            }
        }.padding(10).background(SpotterPalette.wash).overlay(alignment: .top) { Rectangle().fill(SpotterPalette.line).frame(height: 1) }
    }
    private func padAction(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(label).font(.system(size: 11, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44).background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 9)) }.buttonStyle(.spotterPress)
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
    var saved: (NativeWorkoutEntry) -> Void
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
                    }.buttonStyle(.spotterPress)
                }
            }
            if let error = store.errorMessage { Text(error).font(.system(size: 13)).foregroundStyle(.red) }
            Spacer(minLength: 0)
            HStack {
                Button("返回训练") { dismiss() }.buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(store.isBusy)
                Spacer()
                Button { Task { if let record = await store.finish() { saved(record) } } } label: { Label(store.isBusy ? "正在保存" : "保存打卡", systemImage: "checkmark") }
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

@MainActor
struct NativeWorkoutDetailView: View {
    @ObservedObject var store: NativeWorkoutStore
    let entry: NativeWorkoutEntry
    var showsClose = false
    @Environment(\.dismiss) private var dismiss
    @State private var action: Action?
    @State private var savingProtein = false
    @State private var notice: String?

    private enum Action: String, Identifiable {
        case share, edit, template
        var id: Self { self }
    }

    private var own: Bool { entry.owner == store.owner }
    private var current: NativeWorkoutEntry? {
        (own ? store.logs : store.partnerLogs).first { $0.key == entry.key }
    }
    private var pending: Bool { own && store.pendingCheckins.contains { $0.id == entry.id } }

    var body: some View {
        Group {
            if let current, let session = current.session {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 13) {
                        overview(current, session: session)
                        if own { proteinRecord(current) }
                        if own && !current.data["note"].string.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("训练心得").font(.headline)
                                Text(current.data["note"].string).font(.subheadline)
                            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
                        }
                        if own, let video = URL(string: session.plan.video), video.scheme == "https" {
                            Link(destination: video) { Label("打开跟练视频", systemImage: "play.circle") }.buttonStyle(SpotterNativeButtonStyle(primary: false))
                        }
                        if pending {
                            Label("已在本机打卡，联网后自动同步", systemImage: "icloud.and.arrow.up")
                                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                        } else if own {
                            NativeHeartView(api: store.api, owner: store.owner, entry: current)
                        }
                        if session.completedSets > 0 {
                            DisclosureGroup("肌群分布") {
                                SecondaryMusclePanel(entries: [current]).padding(.top, 8)
                            }.font(.subheadline.weight(.semibold)).padding(14).spotterCard()
                        }
                        if !session.plan.exercises.isEmpty {
                            Text("训练动作").font(.headline).accessibilityAddTraits(.isHeader)
                            ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                                exercise(move, rows: session.rows.indices.contains(index) ? session.rows[index] : [])
                            }
                        }
                    }.padding(14)
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if own { actions(session) }
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "dumbbell").font(.title2)
                    Text("这条训练记录已不可用。").font(.subheadline)
                }.frame(maxWidth: .infinity, maxHeight: .infinity).foregroundStyle(SpotterPalette.muted)
            }
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("训练详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            if showsClose { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
        .sheet(item: $action) { action in
            if own, let current {
                switch action {
                case .share:
                    NativeWorkoutShareView(entry: current, logs: store.logs, owner: store.owner, displayName: store.viewerName, api: store.api)
                case .edit:
                    NavigationStack { NativeWorkoutLogEditor(entry: current, store: store) }
                        .presentationDragIndicator(.visible)
                case .template:
                    if let plan = current.session?.plan {
                        NavigationStack { NativePlanEditorPanel(store: store, draft: NativePlanDraft(copying: plan)) { _ in actionSaved() } }
                            .presentationDragIndicator(.visible)
                    }
                }
            }
        }
    }

    private func actionSaved() { notice = "已另存为个人模板" }

    private func actions(_ session: NativeWorkoutSession) -> some View {
        VStack(spacing: 7) {
            if let notice { Text(notice).font(.footnote).foregroundStyle(SpotterPalette.muted) }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { actionButtons(session) }
                VStack(alignment: .leading, spacing: 6) { actionButtons(session) }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(.regularMaterial)
    }

    @ViewBuilder private func actionButtons(_ session: NativeWorkoutSession) -> some View {
        if !pending {
            Button { action = .edit } label: { Label("编辑记录", systemImage: "pencil").fixedSize() }
                .buttonStyle(.spotterPress)
                .font(.subheadline.weight(.semibold))
                .padding(.vertical, 10)
            if session.raw["cardio"] == .null && (!session.plan.exercises.isEmpty || !session.plan.video.isEmpty) {
                Button { action = .template } label: { Label("另存为模板", systemImage: "bookmark").fixedSize() }
                    .buttonStyle(.spotterPress)
                    .font(.subheadline.weight(.semibold))
                    .padding(.vertical, 10)
            }
        }
        Button { action = .share } label: { Label("分享训练", systemImage: "square.and.arrow.up").font(.subheadline.weight(.bold)).fixedSize() }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
    }

    private func overview(_ current: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(current.displayTitle).font(.system(.title, weight: .heavy)).accessibilityAddTraits(.isHeader)
            Text([shortDay(current.day), session.plan.weekDay, session.plan.category, own ? "" : store.partnerName]
                .filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            if !own {
                Label("搭子共享的训练记录", systemImage: "person.2").font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            if own, current.data["finishedVideo"].bool {
                Label("已完成跟练视频", systemImage: "checkmark.circle").font(.caption.weight(.semibold))
            }
            if case .object = current.data["cardio"] {
                cardioSummary(current.data["cardio"])
            } else {
                HStack(alignment: .top, spacing: 7) {
                    summary("分钟", value: current.durationMinutes.formatted())
                    summary("完成组数", value: session.completedSets.formatted())
                    summary("容量 kg", value: session.volumeKg.formatted(.number.precision(.fractionLength(0...1))))
                }
            }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
    }

    private func cardioSummary(_ cardio: NativeJSON) -> some View {
        let elapsed = Int(cardio["durationSeconds"].number)
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 10) {
            summary("实际时长", value: elapsed > 0 ? String(format: "%02d:%02d", elapsed / 60, elapsed % 60) : "—")
            if case .number = cardio["incline"]["value"] {
                summary(cardio["incline"]["kind"].string == "percent" ? "坡度 %" : "跑步机档位", value: cardio["incline"]["value"].number.formatted())
            }
            if case .number = cardio["distanceKm"] { summary("距离 km", value: cardio["distanceKm"].number.formatted()) }
            if case .number = cardio["speedKmh"] { summary("速度 km/h", value: cardio["speedKmh"].number.formatted()) }
        }
    }

    @ViewBuilder private func proteinRecord(_ current: NativeWorkoutEntry) -> some View {
        let product = current.data["proteinProduct"]
        let products = store.proteinProducts.filter { if case .object = $0["powder"] { return true }; return false }
        let checked = current.data["proteinShake"].bool
        if checked || (store.tracksWorkoutProtein && !products.isEmpty) {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Label("已喝蛋白粉", systemImage: checked ? "checkmark.circle.fill" : "mug").font(.subheadline.weight(.semibold))
                    Spacer()
                    if !pending && store.tracksWorkoutProtein {
                        Menu("修改") {
                            ForEach(Array(products.enumerated()), id: \.offset) { _, choice in
                                Button(choice["name"].string) { setProtein(choice, on: current) }
                            }
                            if checked {
                                Button("取消本次蛋白粉记录", role: .destructive) { setProtein(nil, on: current) }
                            }
                        }.disabled(savingProtein)
                    }
                }
                if checked && !product["name"].string.isEmpty {
                    let mixer = product["mixer"]["name"].string
                    Text(product["name"].string).font(.subheadline.weight(.medium))
                    Text("1 勺 · \(product["scoopGrams"].number.formatted()) g · \(mixer.isEmpty ? "水" : mixer) \(product["cupMl"].number.formatted()) mL")
                        .font(.caption).foregroundStyle(SpotterPalette.muted)
                } else if !checked {
                    Text("尚未记录").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
            }.padding(14).spotterCard()
        }
    }

    private func setProtein(_ product: NativeJSON?, on current: NativeWorkoutEntry) {
        guard !savingProtein else { return }
        savingProtein = true
        notice = nil
        var fields = current.data.object
        fields["proteinShake"] = .bool(product != nil)
        fields["proteinProduct"] = product
        Task {
            defer { savingProtein = false }
            do {
                _ = try await store.editRecord(current, data: .object(fields))
                notice = product == nil ? "已取消本次蛋白粉记录" : "蛋白粉已记入饮食"
            } catch { notice = error.localizedDescription }
        }
    }

    private func exercise(_ move: NativeJSON, rows: [NativeJSON]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                let slot = move["sourceSlot"].string.isEmpty ? move["block"].string : move["sourceSlot"].string
                if !slot.isEmpty {
                    Text(slot).font(.caption.weight(.bold)).padding(.horizontal, 7).padding(.vertical, 3)
                        .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 5))
                }
                Text(move["name"].string).font(.headline)
            }
            if own {
                Text("计划处方 · \(prescription(move))").font(.caption).foregroundStyle(SpotterPalette.muted)
                if !move["tempo"].string.isEmpty { Text("节奏 \(move["tempo"].string)").font(.caption).foregroundStyle(SpotterPalette.muted) }
                if case .number = move["restSeconds"] { Text("组间休息 \(Int(move["restSeconds"].number)) 秒").font(.caption).foregroundStyle(SpotterPalette.muted) }
                if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.caption).foregroundStyle(SpotterPalette.muted) }
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                if row["done"].bool {
                    Divider().overlay(SpotterPalette.line)
                    HStack(alignment: .top, spacing: 8) {
                        Text("第 \(index + 1) 组" + (row["kind"].string == "warmup" ? " · 热身" : row["kind"].string == "drop" ? " · 递减" : ""))
                            .font(.caption.weight(.semibold))
                        Spacer(minLength: 2)
                        Text(actualSet(row, move: move)).font(.subheadline).multilineTextAlignment(.trailing)
                        Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(SpotterPalette.accent).accessibilityHidden(true)
                    }
                }
            }
            if !rows.contains(where: { $0["done"].bool }) {
                Text("本动作没有完成的组").font(.caption).foregroundStyle(SpotterPalette.muted)
            }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).spotterCard()
    }

    private func actualSet(_ row: NativeJSON, move: NativeJSON) -> String {
        let unit = move["unit"].string
        let weight = row["weight"].number
        let reps = Int(row["reps"].number)
        let effort = row["rpe"] == .null ? "" : " · RPE \(row["rpe"].number.formatted())"
        if row["seconds"].number > 0 {
            return "\(Int(row["seconds"].number)) 秒" + (weight > 0 ? " · \(weight.formatted()) \(unit)" : "") + effort
        }
        if case .object = row["right"] {
            let right = row["right"]
            return "左 \(weight.formatted()) \(unit) × \(reps) · 右 \(right["weight"].number.formatted()) \(unit) × \(Int(right["reps"].number))" + effort
        }
        let side = NativeWorkoutSession.isPerSideLoad(move) && weight > 0 ? " · 每侧" : ""
        return "\(weight.formatted()) \(unit) × \(reps) 次" + side + effort
    }

    private func summary(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.title2.weight(.heavy)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
            Text(label).font(.caption).foregroundStyle(SpotterPalette.muted)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(9)
            .background(SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 9))
    }
}

@MainActor
private struct NativeWorkoutLogEditor: View {
    let entry: NativeWorkoutEntry
    let store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var session: NativeWorkoutSession
    @State private var busy = false
    @State private var problem: String?

    init(entry: NativeWorkoutEntry, store: NativeWorkoutStore) {
        self.entry = entry
        self.store = store
        _session = State(initialValue: NativeWorkoutSession(raw: entry.data))
    }

    private var hasCardio: Bool { session.raw["cardio"] != .null }
    private var today: Date { Calendar.current.startOfDay(for: Date()) }

    var body: some View {
        Form {
            Section("打卡") {
                TextField("训练名称", text: Binding(get: { session.plan.title }, set: { session.raw["plan"]["title"] = .string(String($0.prefix(100))) }))
                DatePicker("打卡日期", selection: Binding(get: { min(nativePlanDate(session.raw["date"].string) ?? today, today) },
                    set: { session.raw["date"] = .string(NativeWorkoutSession.day($0)) }), in: ...today, displayedComponents: .date)
                if hasCardio { cardioFields }
                else { numberField("时长（分钟）", binding: number(session.raw["minutes"], range: 0...720, integer: true) { session.raw["minutes"] = $0 }, integer: true) }
                TextField("训练心得", text: Binding(get: { session.raw["note"].string },
                    set: { session.raw["note"] = .string(String($0.prefix(1500))) }), axis: .vertical)
                    .lineLimit(2...6)
            }
            ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                if session.rows.indices.contains(index) {
                    Section {
                        DisclosureGroup(move["name"].string) { exerciseFields(at: index, move: move) }
                    }
                }
            }
            if let problem { Section { Text(problem).font(.footnote).foregroundStyle(.red) } }
        }
        .disabled(busy)
        .scrollContentBackground(.hidden)
        .background(SpotterPalette.background)
        .navigationTitle("编辑训练记录")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(busy)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) {
                Button(busy ? "正在保存" : "保存修改") { Task { await save() } }.fontWeight(.bold).disabled(busy)
            }
        }
    }

    private var cardioFields: some View {
        Group {
            cardioNumber("实际时长（秒）", key: "durationSeconds", range: 1...43_200, integer: true)
            cardioNumber("距离（km）", key: "distanceKm", range: 0...500)
            cardioNumber("速度（km/h）", key: "speedKmh", range: 0...50)
            if session.raw["cardio"]["incline"] != .null {
                let kind = session.raw["cardio"]["incline"]["kind"].string
                numberField(kind == "percent" ? "坡度（%）" : "跑步机档位", binding: number(session.raw["cardio"]["incline"]["value"],
                    range: kind == "percent" ? -100...100 : 0...1_000) { session.raw["cardio"]["incline"]["value"] = $0 })
            }
        }
    }

    private func cardioNumber(_ title: String, key: String, range: ClosedRange<Double>, integer: Bool = false) -> some View {
        numberField(title, binding: number(session.raw["cardio"][key], range: range, integer: integer) {
            session.raw["cardio"][key] = $0
            if key == "durationSeconds" { session.raw["minutes"] = .number(max(1, ($0.number / 60).rounded())) }
        }, integer: integer)
    }

    private func exerciseFields(at index: Int, move: NativeJSON) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            TextField("动作名称", text: Binding(get: { move["name"].string }, set: { value in
                var moves = session.plan.exercises
                guard moves.indices.contains(index) else { return }
                moves[index]["name"] = .string(String(value.prefix(100)))
                session.raw["plan"]["exercises"] = .array(moves)
            }))
            let rows = session.rows[index]
            ForEach(Array(rows.enumerated()), id: \.offset) { position, row in
                Divider()
                HStack {
                    Toggle("第 \(position + 1) 组完成", isOn: Binding(get: { row["done"].bool }, set: {
                        session.setLine(move: index, row: position, key: "done", value: .bool($0))
                    }))
                    Button(role: .destructive) {
                        removeSet(move: index, row: position)
                    } label: { Image(systemName: "trash").padding(6) }
                        .buttonStyle(.borderless).accessibilityLabel("移除第 \(position + 1) 组")
                }
                let isSplit = row["right"] != .null
                let mass = move["unit"].string
                setNumber(isSplit ? "左侧重量（\(mass)）" : "重量（\(mass)）", move: index, row: position, field: "weight", range: 0...2_000)
                if move["seconds"].number > 0 || row["seconds"].number > 0 {
                    setNumber("时长（秒）", move: index, row: position, field: "seconds", range: 0...18_000, integer: true)
                } else {
                    setNumber(isSplit ? "左侧次数" : "次数", move: index, row: position, field: "reps", range: 0...999, integer: true)
                }
                if isSplit {
                    setNumber("右侧重量（\(mass)）", move: index, row: position, field: "weight", range: 0...2_000, right: true)
                    setNumber("右侧次数", move: index, row: position, field: "reps", range: 0...999, integer: true, right: true)
                }
            }
            Button {
                session.addSet(move: index)
                session.setLine(move: index, row: rows.count, key: "done", value: .bool(true))
            } label: { Label("加一组", systemImage: "plus.circle") }
                .buttonStyle(.borderless).disabled(rows.count >= 30).padding(.top, 5)
        }.padding(.vertical, 7)
    }

    private func removeSet(move: Int, row: Int) {
        var rows = session.rows
        guard rows.indices.contains(move), rows[move].indices.contains(row) else { return }
        if rows[move].count == 1 {
            session.setLine(move: move, row: row, key: "done", value: .bool(false))
            return
        }
        rows[move].remove(at: row)
        var exercises = session.plan.exercises
        exercises[move]["sets"] = .number(Double(rows[move].count))
        session.raw["plan"]["exercises"] = .array(exercises)
        session.raw["rows"] = .array(rows.map(NativeJSON.array))
    }

    private func setNumber(_ title: String, move: Int, row: Int, field: String, range: ClosedRange<Double>,
                           integer: Bool = false, right: Bool = false) -> some View {
        let line = session.rows[move][row]
        return numberField(title, binding: number(right ? line["right"][field] : line[field], range: range, integer: integer) { value in
            let rows = session.rows
            guard rows.indices.contains(move), rows[move].indices.contains(row) else { return }
            if right {
                var side = rows[move][row]["right"]
                side[field] = value
                session.setLine(move: move, row: row, key: "right", value: side)
            } else { session.setLine(move: move, row: row, key: field, value: value) }
        }, integer: integer)
    }

    private func number(_ value: NativeJSON, range: ClosedRange<Double>, integer: Bool = false,
                        set: @escaping (NativeJSON) -> Void) -> Binding<Double> {
        Binding(get: { value.number }, set: { number in
            guard number.isFinite else { return }
            set(.number(min(range.upperBound, max(range.lowerBound, integer ? number.rounded() : number))))
        })
    }

    private func numberField(_ title: String, binding: Binding<Double>, integer: Bool = false) -> some View {
        HStack {
            Text(title).font(.subheadline)
            Spacer()
            TextField(title, value: binding, format: .number.grouping(.never).precision(.fractionLength(0...(integer ? 0 : 2))))
                .multilineTextAlignment(.trailing).keyboardType(integer ? .numberPad : .numbersAndPunctuation)
                .frame(minWidth: 60, maxWidth: 110)
        }
    }

    private func save() async {
        guard !busy else { return }
        let title = session.plan.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let namesValid = session.plan.exercises.allSatisfy { !$0["name"].string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !title.isEmpty, namesValid else { problem = "请填写训练和动作名称。"; return }
        let completed = hasCardio ? session.raw["cardio"]["durationSeconds"].number > 0 :
            (session.completedSets > 0 || session.raw["finishedVideo"].bool)
        guard completed else { problem = hasCardio ? "请记录有氧训练时长。" : "请至少保留一组完成记录。"; return }
        busy = true; problem = nil
        defer { busy = false }
        session.raw["plan"]["title"] = .string(title)
        do { _ = try await store.editRecord(entry, data: session.raw); dismiss() }
        catch { problem = error.localizedDescription }
    }
}

struct NativePlanDraft: Identifiable {
    var id: String
    var revision: String?
    var plan: NativeJSON
    var isTemplate: Bool
    init(day: String, template: Bool = false) {
        id = UUID().uuidString.lowercased(); isTemplate = template
        plan = .object(["title": .string(""), "date": .string(day), "category": .string("力量训练"), "minutes": .number(0), "shared": .bool(false), "video": .string(""), "exercises": .array([])])
    }
    init(entry: NativeWorkoutEntry) { id = entry.id; revision = entry.updated; plan = entry.data; isTemplate = false }
    init(copying source: NativePlan) {
        id = UUID().uuidString.lowercased()
        revision = nil
        isTemplate = true
        var fields = source.raw.object
        for key in ["templateId", "ownExercises", "week", "day", "programId", "programSessionId", "phaseId"] {
            fields.removeValue(forKey: key)
        }
        fields["title"] = .string(source.displayTitle)
        fields["shared"] = .bool(false)
        plan = .object(fields)
    }
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

struct NativePlanEditorPanel: View {
    let store: NativeWorkoutStore?
    @Environment(\.dismiss) private var dismiss
    @State var draft: NativePlanDraft
    @State private var moveName = ""
    @State private var busy = false
    @State private var error: String?
    private let saved: (String) -> Void
    private let reviewed: ((NativePlanDraft) -> Void)?
    private var linked: Bool { !draft.isTemplate && !draft.plan["templateId"].string.isEmpty }

    init(store: NativeWorkoutStore, draft: NativePlanDraft, saved: @escaping (String) -> Void) {
        self.store = store
        self._draft = State(initialValue: draft)
        self.saved = saved
        self.reviewed = nil
    }

    init(imported draft: NativePlanDraft, reviewed: @escaping (NativePlanDraft) -> Void) {
        self.store = nil
        self._draft = State(initialValue: draft)
        self.saved = { _ in }
        self.reviewed = reviewed
    }

    var body: some View {
        Form {
            Section("计划") {
                TextField("计划名称", text: text("title", maximum: 100))
                if !draft.isTemplate {
                    DatePicker("训练日期", selection: Binding(get: { nativePlanDate(draft.plan["date"].string) ?? Date() }, set: { draft.plan["date"] = .string(NativeWorkoutSession.day($0)) }), displayedComponents: .date)
                }
                if !linked {
                    Picker("训练类型", selection: text("category", maximum: 20)) {
                        ForEach(NativePlanImport.categories, id: \.self) { Text($0).tag($0) }
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
                        if reviewed != nil {
                            Picker("重量单位", selection: Binding(get: { move["unit"].string }, set: { setMove(index, key: "unit", value: .string($0)) })) {
                                Text("kg").tag("kg"); Text("lb").tag("lb")
                            }
                        }
                    }.padding(.vertical, 6)
                }
                .onDelete { indices in
                    var moves = draft.plan["exercises"].array
                    moves.remove(atOffsets: indices)
                    draft.plan["exercises"] = .array(moves)
                    if linked { draft.plan["ownExercises"] = .bool(true) }
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
        .navigationTitle(reviewed != nil ? "核对计划" : draft.isTemplate ? "编辑模板" : draft.revision == nil ? "新建计划" : "编辑计划").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) {
                Button(busy ? "保存中" : reviewed == nil ? "保存" : "完成核对") { Task { await commit() } }.fontWeight(.bold).disabled(busy)
            }
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
        moves.append(NativePreferenceKey.newMove(name: String(moveName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))))
        draft.plan["exercises"] = .array(moves); moveName = ""
        if linked { draft.plan["ownExercises"] = .bool(true) }
    }
    private func commit() async {
        if let reviewed {
            do { try NativePlanImport.validate(draft.plan); reviewed(draft); dismiss() }
            catch { self.error = error.localizedDescription }
            return
        }
        guard let store else { return }
        guard !draft.plan["title"].string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !draft.plan["exercises"].array.isEmpty || !draft.plan["video"].string.isEmpty else { error = "请填写计划名称，并至少添加一个动作或跟练视频。"; return }
        busy = true; defer { busy = false }
        let message = draft.isTemplate ? await store.saveTemplate(id: draft.id, data: draft.plan, revision: draft.revision) :
            await store.savePlan(id: draft.id, data: draft.plan, revision: draft.revision)
        if let message { error = message }
        else { saved(draft.plan["date"].string); dismiss() }
    }
}

func nativePlanDate(_ day: String) -> Date? {
    let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = .current
    formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: day)
}
