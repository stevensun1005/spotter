import CryptoKit
import Foundation
import AudioToolbox
import Network
import SwiftUI
import UIKit

enum NativeWorkoutSyncStatus: Equatable {
    case localSaveFailed, waitingForNetwork, queued, uploading, synced

    var title: String {
        switch self {
        case .localSaveFailed: return "本机保存失败"
        case .waitingForNetwork: return "已保存到手机 · 等待联网"
        case .queued: return "已保存到手机 · 等待同步"
        case .uploading: return "正在同步"
        case .synced: return "已同步"
        }
    }

    var icon: String {
        switch self {
        case .localSaveFailed: return "exclamationmark.triangle"
        case .waitingForNetwork: return "wifi.slash"
        case .queued: return "icloud.and.arrow.up"
        case .uploading: return "arrow.triangle.2.circlepath"
        case .synced: return "checkmark.icloud"
        }
    }
}

private struct NativeWorkoutSyncLabel: View {
    let status: NativeWorkoutSyncStatus

    var body: some View {
        Label(status.title, systemImage: status.icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(status == .localSaveFailed ? Color.red : SpotterPalette.muted)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(status.title)
            .accessibilityIdentifier("workout-sync-status")
    }
}

@MainActor
final class NativeWorkoutStore: ObservableObject {
    @Published private(set) var widgetRevision = 0
    @Published private(set) var entries: [NativeWorkoutEntry] = [] {
        didSet { rebuildEntries(); widgetRevision &+= 1 }
    }
    @Published private(set) var active: NativeWorkoutEntry?
    @Published private(set) var pendingCheckins: [NativeWorkoutEntry] = [] {
        didSet { rebuildLogs(); widgetRevision &+= 1 }
    }
    @Published private(set) var isBusy = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var networkAvailable: Bool?
    @Published private(set) var syncProblem: String?
    @Published private var draftNeedsSync = false
    @Published private var draftSaveInFlight = false
    @Published private var localDraftSaved = true
    @Published private var uploading = false
    @Published private var uploadingCheckinID: String?
    @Published private(set) var status = "正在连接"
    @Published private(set) var proteinProducts: [NativeJSON] = []
    @Published private(set) var defaultProteinProductID: String?
    @Published private(set) var tracksWorkoutProtein = false
    @Published private(set) var libraryRows: [NativeJSON] = []
    @Published private(set) var room: NativeJSON = .null
    @Published private(set) var viewerName = "我"
    @Published private var viewerAnatomyVariant: NativeAnatomyVariant?
    @Published private(set) var recentHistoryStart: String?
    @Published private var completedPlanIds: Set<String> = [] {
        didSet { widgetRevision &+= 1 }
    }
    @Published private var discardedDrafts: [String] = []
    let owner: String
    let api: NativeAPI
    private let origin: String
    private let cacheURL: URL?
    private let snapshotURL: URL?
    private let reachability = NWPathMonitor()
    private static let snapshotQueue = DispatchQueue(label: "app.spotter.health.workout-snapshot", qos: .utility)
    private var draftTask: Task<Void, Never>?
    private var draftAgain = false
    private var pendingRemovalAfterUpload = false
    private var syncRetryTask: Task<Void, Never>?
    private var syncRetryAttempt = 0
    private var reloadAfterPlanWrite = false
    private var localRevision = 0
    private var entryRevision = 0
    private var anatomyEditRevision = 0
    private var localCompletedPlanIds: Set<String> = []
    private var lastSetCompletion: LastSetCompletion?

    private(set) var plans: [NativeWorkoutEntry] = []
    private(set) var logs: [NativeWorkoutEntry] = []
    private(set) var plansByKey: [NativeWorkoutEntry.Key: NativeWorkoutEntry] = [:]
    private var savedDrafts: [NativeWorkoutEntry] = []
    private var savedLogs: [NativeWorkoutEntry] = []
    private(set) var widgetOverviewDay: String?
    private var widgetHistory: WidgetHistory?
    private(set) var widgetNutrition: SpotterWidgetSnapshot.Nutrition?
    private(set) var widgetNutritionDay: String?
    private var widgetHistoryInFlight = false
    private var reloadWidgetHistory = false
    private var widgetNutritionInFlight = false
    private var reloadWidgetNutrition = false
    private var widgetNutritionUpdatedAt: Date?
    var drafts: [NativeWorkoutEntry] { savedDrafts.filter { $0.id != active?.id } }
    var undoableSet: NativeWorkoutSession.SetPosition? {
        guard let active, let lastSetCompletion, lastSetCompletion.workoutID == active.id,
              active.session?.line(at: lastSetCompletion.completion.position)?["done"].bool == true else { return nil }
        return lastSetCompletion.completion.position
    }
    var pendingDraftRemovalCount: Int { discardedDrafts.count }
    var hasPendingSync: Bool { draftNeedsSync || !pendingCheckins.isEmpty || !discardedDrafts.isEmpty }
    var isSyncing: Bool { uploading || draftSaveInFlight }

    var draftSyncStatus: NativeWorkoutSyncStatus {
        if !draftNeedsSync { return .synced }
        if draftSaveInFlight { return .uploading }
        if !localDraftSaved { return .localSaveFailed }
        return networkAvailable == false ? .waitingForNetwork : .queued
    }

    func checkinSyncStatus(id: String) -> NativeWorkoutSyncStatus {
        if !pendingCheckins.contains(where: { $0.id == id }) { return .synced }
        if uploadingCheckinID == id { return .uploading }
        return networkAvailable == false ? .waitingForNetwork : .queued
    }
    var todayPendingPlans: [NativeWorkoutEntry] { pendingPlans(on: NativeWorkoutSession.day()) }
    var partnerID: String { room["partner"]["id"].string }
    var partnerName: String {
        let name = room["partner"]["name"].string
        return name.isEmpty ? "训练搭子" : name
    }
    var partnerLogs: [NativeWorkoutEntry] {
        guard !partnerID.isEmpty, room["partnerTrainingShared"] != .bool(false) else { return [] }
        return entries.filter { $0.kind == "log" && $0.owner == partnerID }
    }

    func anatomyVariant(for personID: String) -> NativeAnatomyVariant? {
        if personID == owner { return viewerAnatomyVariant }
        guard !partnerID.isEmpty, personID == partnerID, room["partnerTrainingShared"] != .bool(false) else { return nil }
        return NativeAnatomyVariant(rawValue: room["partner"]["anatomyVariant"].string)
    }

    func useSavedAnatomyVariant(_ variant: NativeAnatomyVariant?) {
        anatomyEditRevision &+= 1
        guard viewerAnatomyVariant != variant else { return }
        viewerAnatomyVariant = variant
        saveSnapshot()
    }

    private func rebuildEntries() {
        plans = entries.filter { $0.kind == "plan" }
        plansByKey = Dictionary(plans.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        savedDrafts = entries.filter { $0.kind == "draft" && $0.owner == owner && !discardedDrafts.contains($0.id) }
        savedLogs = entries.filter { $0.kind == "log" && $0.owner == owner }
        rebuildLogs()
    }

    private func pendingPlans(on day: String) -> [NativeWorkoutEntry] {
        plans.filter { $0.owner == owner && $0.day == day && !hasCompletedPlan(id: $0.id) }
    }

    func hasCompletedPlan(id: String) -> Bool {
        completedPlanIds.contains(id) || localCompletedPlanIds.contains(id)
    }

    func nextPlan(after day: String) -> NativeWorkoutEntry? {
        plans.filter { $0.owner == owner && $0.day > day && !hasCompletedPlan(id: $0.id) }
            .min { $0.day < $1.day }
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
        localCompletedPlanIds = Set(logs.compactMap { $0.planKey?.id })
    }

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
        origin = api.origin
        let digest = SHA256.hash(data: Data((api.origin + "\n" + owner).utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Spotter/WorkoutRecovery", isDirectory: true)
        cacheURL = directory?.appendingPathComponent(digest + ".json")
        snapshotURL = directory?.appendingPathComponent(digest + "-snapshot.json")
        if let cacheURL, let data = try? Data(contentsOf: cacheURL), let saved = try? JSONDecoder().decode(Recovery.self, from: data),
           saved.owner == owner, saved.origin == api.origin {
            active = saved.active?.owner == owner && saved.active?.kind == "draft" ? saved.active : nil
            if let completion = saved.lastSetCompletion, completion.workoutID == active?.id { lastSetCompletion = completion }
            draftNeedsSync = active != nil && (saved.draftNeedsSync ?? true)
            pendingCheckins = saved.pending.filter { $0.owner == owner && $0.kind == "log" }
            discardedDrafts = (saved.discarded ?? []).filter { UUID(uuidString: $0) != nil }
        }
        if let snapshotURL, let data = try? Data(contentsOf: snapshotURL), let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data),
           snapshot.owner == owner, snapshot.origin == api.origin {
            completedPlanIds = Set(snapshot.completedPlanIds ?? [])
            recentHistoryStart = snapshot.historyFrom
            widgetHistory = snapshot.widgetHistory
            viewerAnatomyVariant = snapshot.viewerAnatomyVariant
            entries = snapshot.entries.filter { $0.owner == owner }
            rebuildEntries()
        } else { rebuildLogs() }
        if active != nil || !pendingCheckins.isEmpty || !entries.isEmpty { status = "本机记录已恢复，等待同步" }
        reachability.pathUpdateHandler = { [weak self] path in
            let available = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                let reconnected = networkAvailable == false && available
                if networkAvailable != available { networkAvailable = available }
                guard reconnected else { return }
                await syncLocalChanges()
                if isLoading { reloadAfterPlanWrite = true }
                else { await load() }
                let waiting = Set(pendingCheckins.map(\.id))
                let uploaded = logs.filter { !waiting.contains($0.id) }
                async let summaries: Void = NativeWorkoutHealthSync.shared.run(api: api, owner: owner, entries: uploaded)
                async let nutrition: Void = refreshWidgetNutrition(force: true)
                await refreshWidgetHistory()
                await nutrition
                await summaries
            }
        }
        reachability.start(queue: DispatchQueue(label: "app.spotter.health.workout-connectivity"))
    }

    deinit {
        reachability.cancel()
        draftTask?.cancel()
        syncRetryTask?.cancel()
    }

    private struct LastSetCompletion: Codable {
        let workoutID: String
        let completion: NativeWorkoutSession.SetCompletion
    }

    private struct Recovery: Codable {
        let origin: String
        let owner: String
        let active: NativeWorkoutEntry?
        let pending: [NativeWorkoutEntry]
        let discarded: [String]?
        let draftNeedsSync: Bool?
        let lastSetCompletion: LastSetCompletion?
    }

    private struct Snapshot: Codable {
        let origin: String
        let owner: String
        let entries: [NativeWorkoutEntry]
        let completedPlanIds: [String]?
        let historyFrom: String?
        let widgetHistory: WidgetHistory?
        let viewerAnatomyVariant: NativeAnatomyVariant?
    }

    private struct WidgetHistory: Codable {
        let from: String
        let through: String
        let fetchedAt: Date
        let dailyMinutes: [String: Int]
    }

    nonisolated private static func writeLocal<Value: Encodable>(_ value: Value, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        try JSONEncoder().encode(value).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        var target = url; try? target.setResourceValues(values)
    }

    @discardableResult
    private func persist() -> Bool {
        guard let cacheURL else { errorMessage = "无法保存本机恢复记录，请保持 App 打开并联网保存。"; return false }
        do {
            let completion = lastSetCompletion.flatMap { $0.workoutID == active?.id ? $0 : nil }
            let recovery = Recovery(origin: origin, owner: owner, active: active, pending: pendingCheckins,
                                    discarded: discardedDrafts, draftNeedsSync: draftNeedsSync, lastSetCompletion: completion)
            try Self.writeLocal(recovery, to: cacheURL)
            return true
        } catch { errorMessage = "本机恢复记录未保存，请保持 App 打开并联网保存。"; return false }
    }

    private func saveSnapshot() {
        guard let snapshotURL else { return }
        let own = entries.filter { $0.owner == owner }
        let scheduled = own.filter { $0.kind == "plan" }
        let history = own.filter { $0.kind == "log" }.sorted { $0.updated > $1.updated }.prefix(120)
        let snapshot = Snapshot(origin: origin, owner: owner, entries: scheduled + history,
                                completedPlanIds: completedPlanIds.sorted(), historyFrom: recentHistoryStart,
                                widgetHistory: widgetHistory, viewerAnatomyVariant: viewerAnatomyVariant)
        Self.snapshotQueue.async { try? Self.writeLocal(snapshot, to: snapshotURL) }
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
            let anatomyEdit = anatomyEditRevision
            let loadedViewerName = viewerName
            let removalsWhenRequested = Set(discardedDrafts)
            let value = try await api.spotterRead("/api/workout?scope=overview", as: NativeWorkoutState.self)
            guard revision == localRevision, edit == entryRevision else { return }
            guard value.me.id == owner else {
                entries = []; room = .null; viewerAnatomyVariant = nil
                throw NativeWorkoutProblem.accountChanged
            }
            let anatomyVariant = value.me.anatomyVariant.flatMap(NativeAnatomyVariant.init(rawValue:))
            let anatomyChanged = anatomyEdit == anatomyEditRevision && viewerAnatomyVariant != anatomyVariant
            if anatomyChanged { viewerAnatomyVariant = anatomyVariant }
            let currentRoom = value.room ?? .null
            let cutoff = value.historyFrom ?? ""
            let incomingCompleted = Set(value.completedPlanIds ?? [])
            let snapshotNeedsRefresh = recentHistoryStart != value.historyFrom || completedPlanIds != incomingCompleted
            if recentHistoryStart != value.historyFrom { recentHistoryStart = value.historyFrom }
            if completedPlanIds != incomingCompleted { completedPlanIds = incomingCompleted }
            let sharedSince = currentRoom["partnerCheckinsFrom"].string
            let partner = currentRoom["partner"]["id"].string
            let retained = entries.filter {
                guard $0.kind == "log", $0.day < cutoff else { return false }
                return $0.owner == owner || (!partner.isEmpty && $0.owner == partner && $0.day >= sharedSince)
            }
            let updatedKeys = Set(value.entries.map(\.key))
            // A deletion acknowledged while this request was in flight can still be in its response.
            let removedDrafts = removalsWhenRequested.union(discardedDrafts)
            let updated = value.entries.filter { $0.kind != "draft" || !removedDrafts.contains($0.id) } +
                retained.filter { !updatedKeys.contains($0.key) }
            let historyChanged = entries != updated
            if historyChanged { entries = updated }
            if historyChanged || snapshotNeedsRefresh || anatomyChanged { saveSnapshot() }
            let overviewDay = SpotterWidgetSnapshot.dayKey(for: .now)
            if widgetOverviewDay != overviewDay || room != currentRoom {
                widgetOverviewDay = overviewDay
                room = currentRoom
                widgetRevision &+= 1
            }
            if viewerName == loadedViewerName, let name = value.me.name { useConfirmedViewerName(name) }
            if let active, value.entries.contains(where: { $0.owner == owner && $0.kind == "log" && $0.id == active.id }) {
                self.active = nil
                lastSetCompletion = nil
                draftNeedsSync = false
                persist()
            }
            if status != "云端已连接" { status = "云端已连接" }
            if errorMessage != nil { errorMessage = nil }
            await flushLocalChanges()
            await loadProteinPreferences()
        } catch {
            status = "暂未连接云端"
            if !hasPendingSync || networkAvailable != false { errorMessage = error.localizedDescription }
            if hasPendingSync { await flushLocalChanges() }
        }
    }

    func refreshWidgetHistory() async {
        if widgetHistoryInFlight {
            reloadWidgetHistory = true
            return
        }
        let now = Date.now
        let day = SpotterWidgetSnapshot.dayKey(for: now)
        guard widgetOverviewDay == day,
              let start = widgetDate(now, addingDays: -364), let cutoff = recentHistoryStart,
              cutoff > start, let cutoffDate = nativePlanDate(cutoff),
              let through = widgetDate(cutoffDate, addingDays: -1) else { return }
        if let current = widgetHistory, current.from <= start, current.through >= through,
           (0..<3 * 60 * 60).contains(now.timeIntervalSince(current.fetchedAt)) { return }
        let revision = localRevision
        let edit = entryRevision
        widgetHistoryInFlight = true
        defer {
            widgetHistoryInFlight = false
            if reloadWidgetHistory {
                reloadWidgetHistory = false
                Task { await refreshWidgetHistory() }
            }
        }
        do {
            let value = try await api.spotterRead("/api/workout?scope=history&from=\(start)&to=\(through)", as: NativeWorkoutState.self)
            guard !Task.isCancelled, revision == localRevision, value.me.id == owner,
                  recentHistoryStart == cutoff, widgetOverviewDay == day else { return }
            guard edit == entryRevision else {
                reloadWidgetHistory = true
                return
            }
            let logs = value.entries.filter { $0.owner == owner && $0.kind == "log" && $0.day >= start && $0.day <= through }
            widgetHistory = .init(from: start, through: through, fetchedAt: now, dailyMinutes: Self.widgetMinutes(for: logs))
            widgetRevision &+= 1
            saveSnapshot()
        } catch {
            // Keep the last confirmed summary available when the cloud cannot be reached.
        }
    }

    func refreshWidgetNutrition(force: Bool = false) async {
        if widgetNutritionInFlight {
            reloadWidgetNutrition = reloadWidgetNutrition || force
            return
        }
        let now = Date.now
        let day = SpotterWidgetSnapshot.dayKey(for: now)
        if !force, widgetNutritionDay == day, let updated = widgetNutritionUpdatedAt,
           (0..<60).contains(now.timeIntervalSince(updated)) { return }
        let revision = localRevision
        widgetNutritionInFlight = true
        defer {
            widgetNutritionInFlight = false
            if reloadWidgetNutrition {
                reloadWidgetNutrition = false
                Task { await refreshWidgetNutrition(force: true) }
            }
        }
        do {
            let result = try await readWidgetNutrition(on: day)
            guard !Task.isCancelled, revision == localRevision,
                  day == SpotterWidgetSnapshot.dayKey(for: .now) else { return }
            if widgetNutrition != result || widgetNutritionDay != day {
                widgetNutrition = result
                widgetNutritionDay = day
                widgetRevision &+= 1
            }
            widgetNutritionUpdatedAt = now
        } catch {
            // An unsuccessful fetch must not turn a partially loaded day into zero totals.
        }
    }

    func widgetYear(endingAt now: Date) -> SpotterWidgetSnapshot.Year? {
        let day = SpotterWidgetSnapshot.dayKey(for: now)
        guard widgetOverviewDay == day, let from = widgetDate(now, addingDays: -364) else { return nil }
        let cutoff = max(from, recentHistoryStart ?? from)
        var minutes: [String: Int] = [:]
        if from < cutoff {
            guard let widgetHistory, let cutoffDate = nativePlanDate(cutoff),
                  let through = widgetDate(cutoffDate, addingDays: -1),
                  widgetHistory.from <= from, widgetHistory.through >= through else { return nil }
            minutes = widgetHistory.dailyMinutes.filter { $0.key >= from && $0.key < cutoff }
        }
        let recent = logs.filter { $0.owner == owner && $0.day >= cutoff && $0.day <= day }
        minutes.merge(Self.widgetMinutes(for: recent), uniquingKeysWith: { _, current in current })
        return .init(dailyMinutes: minutes)
    }

    static func widgetMinutes(for logs: [NativeWorkoutEntry]) -> [String: Int] {
        logs.reduce(into: [:]) { minutes, log in
            let duration = max(0, min(1_440, log.data["minutes"].number))
            minutes[log.day, default: 0] += Int(exactly: duration.rounded(.towardZero)) ?? 0
        }
    }

    private func widgetDate(_ date: Date, addingDays count: Int) -> String? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar.date(byAdding: .day, value: count, to: date).map {
            SpotterWidgetSnapshot.dayKey(for: $0, timeZone: calendar.timeZone)
        }
    }

    private func invalidateWidgetHistory(for days: String...) {
        guard let current = widgetHistory, days.contains(where: { $0 >= current.from && $0 <= current.through }) else { return }
        widgetHistory = nil
        saveSnapshot()
        Task { await refreshWidgetHistory() }
    }

    func loadHistory(from: String, through: String) async {
        guard from <= through, let first = nativePlanDate(from), let last = nativePlanDate(through) else { return }
        var start = first
        while start <= last, !Task.isCancelled {
            guard let bound = Calendar.current.date(byAdding: .day, value: 3_660, to: start) else { return }
            let end = min(bound, last)
            guard await loadHistoryPage(from: NativeWorkoutSession.day(start), through: NativeWorkoutSession.day(end)) else { return }
            guard end < last, let next = Calendar.current.date(byAdding: .day, value: 1, to: end) else { return }
            start = next
        }
    }

    func loadOlderHistoryIfNeeded(from: String, through: String) async {
        guard let recentHistoryStart, from < recentHistoryStart else { return }
        await loadHistory(from: from, through: through)
    }

    func loadEarlierHistory(before: String) async -> String? {
        guard let first = nativePlanDate(before),
              let end = Calendar.current.date(byAdding: .day, value: -1, to: first),
              let begin = Calendar.current.date(byAdding: .day, value: -30, to: end) else { return nil }
        let next = NativeWorkoutSession.day(begin)
        return await loadHistoryPage(from: next, through: NativeWorkoutSession.day(end)) ? next : nil
    }

    private func loadHistoryPage(from: String, through: String) async -> Bool {
        let revision = localRevision
        let edit = entryRevision
        do {
            let value = try await api.spotterRead("/api/workout?scope=history&from=\(from)&to=\(through)", as: NativeWorkoutState.self)
            guard !Task.isCancelled, revision == localRevision, edit == entryRevision, value.me.id == owner else { return false }
            let partner = (value.room ?? .null)["partner"]["id"].string
            let records = value.entries.filter {
                $0.kind == "log" && $0.day >= from && $0.day <= through &&
                    ($0.owner == owner || (!partner.isEmpty && $0.owner == partner))
            }
            let inRange = { (entry: NativeWorkoutEntry) in entry.kind == "log" && entry.day >= from && entry.day <= through }
            // `load()` keeps the server's order, so comparing whole arrays saw a change on nearly every 统计 visit
            // and re-rendered every tab. Publish only when the logs in this range really differ.
            if !Self.sameEntries(entries.filter(inRange), records) {
                entries = entries.filter { !inRange($0) } + records
            }
            refreshCachedWidgetHistory(with: records, from: from, through: through)
            return true
        } catch { return false }
    }

    /// True when both lists hold the same entries, in any order.
    private static func sameEntries(_ lhs: [NativeWorkoutEntry], _ rhs: [NativeWorkoutEntry]) -> Bool {
        guard lhs.count == rhs.count else { return false }
        let known = Dictionary(lhs.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        guard known.count == lhs.count, Set(rhs.map(\.key)).count == rhs.count else { return false }
        return rhs.allSatisfy { known[$0.key] == $0 }
    }

    private func refreshCachedWidgetHistory(with records: [NativeWorkoutEntry], from: String, through: String) {
        guard let archive = widgetHistory else { return }
        let first = max(from, archive.from)
        let last = min(through, archive.through)
        guard first <= last else { return }
        let known = records.filter { $0.owner == owner && $0.day >= first && $0.day <= last }
        let remaining = archive.dailyMinutes.filter { $0.key < first || $0.key > last }
        let days = remaining.merging(Self.widgetMinutes(for: known), uniquingKeysWith: { _, current in current })
        guard days != archive.dailyMinutes else { return }
        widgetHistory = .init(from: archive.from, through: archive.through, fetchedAt: archive.fetchedAt, dailyMinutes: days)
        widgetRevision &+= 1
        saveSnapshot()
    }

    func useConfirmedViewerName(_ name: String) {
        if viewerName != name { viewerName = name }
    }

    func loadProteinPreferences() async {
        let revision = localRevision
        let edit = entryRevision
        do {
            let data = try await api.request("/api/library", method: "GET", json: nil, for: owner)
            guard revision == localRevision, edit == entryRevision else { return }
            let library = try JSONDecoder().decode(NativeJSON.self, from: data)
            let rows = library["rows"].array
            if libraryRows != rows {
                let schedule = libraryRows.first { $0["kind"].string == "schedule" }
                libraryRows = rows
                if schedule != rows.first(where: { $0["kind"].string == "schedule" }) { widgetRevision &+= 1 }
            }
            let products = rows.first { $0["kind"].string == "protein-warehouse" }?["products"].array ?? []
            if proteinProducts != products { proteinProducts = products }
            let preference = rows.first { $0["kind"].string == "protein-preference" }
            let productID = preference?["defaultProductId"].string
            if defaultProteinProductID != productID { defaultProteinProductID = productID }
            let tracks = preference.map { $0["enabled"] != .bool(false) } ?? !products.isEmpty
            if tracksWorkoutProtein != tracks { tracksWorkoutProtein = tracks }
        } catch { /* Training can continue; no guessed or stale recipe is selected after an unreadable warehouse. */
            guard revision == localRevision, edit == entryRevision else { return }
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
        widgetOverviewDay = nil
        widgetHistory = nil
        widgetNutrition = nil
        widgetNutritionDay = nil
        widgetNutritionUpdatedAt = nil
        reloadWidgetNutrition = false
        reloadWidgetHistory = false
        draftTask?.cancel()
        syncRetryTask?.cancel()
        syncRetryTask = nil
        syncRetryAttempt = 0
        syncProblem = nil
        draftNeedsSync = false
        discardedDrafts = []
        pendingRemovalAfterUpload = false
        completedPlanIds = []
        recentHistoryStart = nil
        lastSetCompletion = nil
        active = nil; pendingCheckins = []; entries = []; room = .null
        libraryRows = []
        viewerAnatomyVariant = nil
        proteinProducts = []; defaultProteinProductID = nil; tracksWorkoutProtein = false
        if let cacheURL { try? FileManager.default.removeItem(at: cacheURL) }
        if let snapshotURL { Self.snapshotQueue.sync { try? FileManager.default.removeItem(at: snapshotURL) } }
    }

    func startScheduled(_ entry: NativeWorkoutEntry) {
        guard entry.kind == "plan", entry.owner == owner else { return }
        start(plan: NativePlan(raw: entry.data), id: entry.id)
    }

    @discardableResult
    func discardDraft(_ entry: NativeWorkoutEntry) -> Bool {
        removeDraft(entry, replacingWith: nil)
    }

    func restartPausedWorkout(_ entry: NativeWorkoutEntry) -> Bool {
        guard active?.key == entry.key, let session = active?.session, !session.isRunning else { return false }
        return removeDraft(entry, replacingWith: makeDraft(session.restarting()))
    }

    private func removeDraft(_ entry: NativeWorkoutEntry, replacingWith replacement: NativeWorkoutEntry?) -> Bool {
        guard entry.owner == owner, entry.kind == "draft", UUID(uuidString: entry.id) != nil,
              !isBusy, entry.key != active?.key || active?.session?.isRunning == false,
              active?.key == entry.key || drafts.contains(where: { $0.key == entry.key }) else { return false }
        let current = active
        let previousDirty = draftNeedsSync
        let previousRemovals = discardedDrafts
        if active?.key == entry.key {
            active = replacement
            draftNeedsSync = replacement != nil
        }
        if !discardedDrafts.contains(entry.id) { discardedDrafts.append(entry.id) }
        guard persist() else {
            active = current
            draftNeedsSync = previousDirty
            discardedDrafts = previousRemovals
            return false
        }
        if current?.key == entry.key { draftTask?.cancel(); lastSetCompletion = nil }
        entryRevision &+= 1
        if isLoading { reloadAfterPlanWrite = true }
        entries.removeAll { $0.key == entry.key && $0.kind == "draft" }
        saveSnapshot()
        errorMessage = nil
        if replacement != nil {
            localDraftSaved = true
            status = "已重新开始，等待同步"
        } else { status = "训练草稿已删除，等待同步" }
        if uploading { pendingRemovalAfterUpload = true }
        Task { await flushLocalChanges() }
        return true
    }

    func start(plan: NativePlan, id: String) {
        guard active == nil, !isBusy else { return }
        let existing = drafts.first { $0.data["planId"].string == id && $0.day == NativeWorkoutSession.day() }
        if let existing { resume(existing); return }
        begin(NativeWorkoutSession.start(plan: plan, planId: id))
    }

    /// 从个人模板直接开始，不关联已排的计划。
    func startUnscheduled(plan: NativePlan) {
        guard active == nil, !isBusy else { return }
        begin(NativeWorkoutSession.start(plan: plan, planId: ""))
    }

    func startFreeWorkout(kind: String = "strength") {
        guard active == nil, !isBusy else { return }
        let cardio = kind == "incline" ? .incline : NativeWorkoutSession.CardioActivity(rawValue: kind)
        begin(.free(cardio: cardio))
    }

    private func begin(_ session: NativeWorkoutSession) {
        lastSetCompletion = nil
        active = makeDraft(session)
        errorMessage = nil
        changed()
    }

    private func makeDraft(_ session: NativeWorkoutSession) -> NativeWorkoutEntry {
        NativeWorkoutEntry(id: UUID().uuidString.lowercased(), owner: owner, kind: "draft",
                           updated: Date.now.formatted(.iso8601), data: session.raw)
    }

    func resume(_ entry: NativeWorkoutEntry) {
        guard active == nil, entry.owner == owner, entry.kind == "draft", let session = entry.session else { return }
        var restored = session
        // A draft opened from another device keeps saved elapsed time until explicitly resumed here.
        if restored.isRunning { restored.pause(at: Int(restored.raw["clock"]["runningSince"].number)) }
        restored.resume()
        lastSetCompletion = nil
        active = entry
        active?.data = restored.raw
        errorMessage = nil
        changed()
    }

    func mutate(_ change: (inout NativeWorkoutSession) -> Void) {
        guard var current = active, !isBusy, var session = current.session else { return }
        change(&session)
        guard current.data != session.raw else { return }
        current.data = session.raw
        current.updated = Date.now.formatted(.iso8601)
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

    @discardableResult
    func toggleDone(move: Int, row: Int) -> Bool {
        guard let id = active?.id else { return false }
        let position = NativeWorkoutSession.SetPosition(move: move, row: row)
        let previousPosition = undoableSet
        var completed = false
        mutate { session in
            guard let line = session.line(at: position) else { return }
            if line["done"].bool {
                if previousPosition == position, let lastSetCompletion {
                    session.undoSetCompletion(lastSetCompletion.completion)
                    self.lastSetCompletion = nil
                } else {
                    session.setLine(move: move, row: row, key: "done", value: .bool(false))
                    if previousPosition == nil { session.clearRest() }
                }
            } else if let action = session.completeSet(at: position, after: previousPosition) {
                lastSetCompletion = LastSetCompletion(workoutID: id, completion: action)
                completed = true
            }
        }
        return completed
    }

    func undoLastCompletedSet() -> NativeWorkoutSession.SetPosition? {
        guard let position = undoableSet, let lastSetCompletion else { return nil }
        var undone = false
        mutate { session in
            guard session.undoSetCompletion(lastSetCompletion.completion) else { return }
            self.lastSetCompletion = nil
            undone = true
        }
        return undone ? position : nil
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

    func pauseClock() {
        mutate { session in if session.isRunning { session.pause() } }
    }

    func applyWatchAction(_ command: NativeWatchWorkoutCommand, workoutID: String) -> NativeWatchWorkoutSnapshot? {
        guard !isBusy, let entry = active, entry.owner == owner, entry.id == workoutID, let session = entry.session else { return nil }
        let previous = undoableSet
        switch command.action {
        case .completeSet:
            guard let target = command.position else { return nil }
            let position = NativeWorkoutSession.SetPosition(move: target.move, row: target.row)
            guard session.nextSet(after: previous) == position else { return nil }
            var completed = false
            mutate { workout in
                var candidate = workout
                if let weight = command.weight { candidate.setLine(move: target.move, row: target.row, key: "weight", value: .number(weight)) }
                if let reps = command.reps { candidate.setLine(move: target.move, row: target.row, key: "reps", value: .number(Double(reps))) }
                if let seconds = command.seconds { candidate.setLine(move: target.move, row: target.row, key: "seconds", value: .number(Double(seconds))) }
                guard let result = candidate.completeSet(at: position, after: previous) else { return }
                workout = candidate
                self.lastSetCompletion = LastSetCompletion(workoutID: workoutID, completion: result)
                completed = true
            }
            guard completed else { return nil }
        case .setRunning:
            guard let running = command.running else { return nil }
            if running != session.isRunning { toggleClock() }
        case .skipRest:
            mutate { $0.clearRest() }
        case .adjustRest:
            guard let adjustment = command.adjustment else { return nil }
            var changedRest = false
            mutate { changedRest = $0.adjustRest(by: adjustment) }
            guard changedRest else { return nil }
        case .refresh:
            break
        }
        guard let updated = active?.session else { return nil }
        return NativeWatchWorkoutSnapshot(session: updated, previous: undoableSet)
    }

    private func changed() {
        draftNeedsSync = true
        let stored = persist()
        if localDraftSaved != stored { localDraftSaved = stored }
        if stored { status = "草稿已保存到本机，等待同步" }
        draftTask?.cancel()
        draftTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled, let self else { return }
            draftTask = nil
            await saveDraft()
        }
    }

    private struct Upload: Encodable { let action: String; let expectedOwner: String; let id: String; let data: NativeJSON }
    private struct Receipt: Decodable { let data: NativeJSON; let updated: String }

    func saveDraft() async {
        guard draftNeedsSync, networkAvailable != false else { return }
        guard !draftSaveInFlight else { draftAgain = true; return }
        guard let snapshot = active, snapshot.kind == "draft" else { return }
        draftSaveInFlight = true
        defer {
            draftSaveInFlight = false
            if draftAgain { draftAgain = false; Task { [weak self] in await self?.saveDraft() } }
        }
        do {
            let revision = localRevision
            let body = Upload(action: "draft", expectedOwner: owner, id: snapshot.id, data: snapshot.data)
            _ = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
            guard revision == localRevision else { return }
            guard active?.id == snapshot.id, active?.kind == "draft" else { return }
            if active?.data == snapshot.data {
                draftNeedsSync = false
                localDraftSaved = persist()
                status = "草稿已保存到云端"
                clearRetryIfSynced()
            }
            else { draftAgain = true }
        } catch {
            guard !Task.isCancelled, active?.id == snapshot.id else { return }
            status = localDraftSaved ? "草稿已保存到本机，等待同步" : "本机保存失败"
            retryIfTransient(error)
        }
    }

    func finish() async -> NativeWorkoutEntry? {
        guard !isBusy, let current = active, let session = current.session else { return nil }
        do {
            let final = try session.finalizing()
            draftTask?.cancel()
            let checkin = NativeWorkoutEntry(id: current.id, owner: owner, kind: "log", updated: ISO8601DateFormatter().string(from: Date()), data: final.raw)
            let oldPending = pendingCheckins
            let previousDirty = draftNeedsSync
            if !pendingCheckins.contains(where: { $0.id == checkin.id }) { pendingCheckins.append(checkin) }
            active = nil
            draftNeedsSync = false
            guard persist() else { active = current; pendingCheckins = oldPending; draftNeedsSync = previousDirty; return nil }
            if #available(iOS 17.0, *) {
                let context = NativeWatchWorkoutContext(owner: owner, workoutID: current.id, isRunning: session.isRunning)
                NativeWatchHeartRate.shared.finishWorkout(context: context, entry: checkin, origin: api.origin)
            }
            lastSetCompletion = nil
            status = "打卡已保存在本机，正在上传"
            Task { await retryPending() }
            return checkin
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func retryPending() async {
        guard networkAvailable != false, !uploading, !pendingCheckins.isEmpty || !discardedDrafts.isEmpty else { return }
        uploading = true
        defer {
            uploadingCheckinID = nil
            uploading = false
            clearRetryIfSynced()
            if pendingRemovalAfterUpload {
                pendingRemovalAfterUpload = false
                Task { await retryPending() }
            }
        }
        while let id = discardedDrafts.first {
            do {
                let revision = localRevision
                let body = try JSONEncoder().encode(["action": "delete", "kind": "draft", "id": id, "expectedOwner": owner])
                _ = try await api.request("/api/workout", method: "POST", json: body)
                guard revision == localRevision else { return }
                discardedDrafts.removeAll { $0 == id }
                persist()
                if active == nil && pendingCheckins.isEmpty { status = "训练草稿已删除" }
            } catch let failure as NativeAPIError where failure.statusCode == 409 {
                // A completed workout takes precedence over a later deletion of its former draft.
                discardedDrafts.removeAll { $0 == id }
                persist()
                errorMessage = failure.localizedDescription
                if isLoading { reloadAfterPlanWrite = true }
                else { Task { await load() } }
            } catch {
                guard !Task.isCancelled else { return }
                retryIfTransient(error)
                break
            }
        }
        while let pending = pendingCheckins.first, pending.owner == owner {
            uploadingCheckinID = pending.id
            do {
                let revision = localRevision
                let body = Upload(action: "log", expectedOwner: owner, id: pending.id, data: pending.data)
                let payload = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body))
                guard revision == localRevision else { return }
                let receipt = try JSONDecoder().decode(Receipt.self, from: payload)
                let record = NativeWorkoutEntry(id: pending.id, owner: owner, kind: "log", updated: receipt.updated, data: receipt.data)
                entryRevision &+= 1
                if isLoading { reloadAfterPlanWrite = true }
                entries = [record] + entries.filter { $0.id != pending.id || $0.owner != owner }
                pendingCheckins.removeAll { $0.id == pending.id }
                invalidateWidgetHistory(for: record.day)
                NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil)
                persist()
                saveSnapshot()
                errorMessage = nil
                if active == nil { status = "训练已打卡并保存到云端" }
            } catch {
                guard !Task.isCancelled else { return }
                status = "打卡已保存在本机，等待重试"
                retryIfTransient(error)
                return
            }
        }
    }

    func syncLocalChanges() async {
        syncRetryTask?.cancel()
        syncRetryTask = nil
        syncRetryAttempt = 0
        await flushLocalChanges()
    }

    private func flushLocalChanges() async {
        await retryPending()
        await saveDraft()
    }

    private func clearRetryIfSynced() {
        guard !hasPendingSync else { return }
        syncRetryTask?.cancel()
        syncRetryTask = nil
        syncRetryAttempt = 0
        if syncProblem != nil { syncProblem = nil }
    }

    private func retryIfTransient(_ error: Error) {
        guard networkAvailable != false, syncRetryTask == nil else { return }
        let retryable: Bool
        if let status = (error as? NativeAPIError)?.statusCode {
            retryable = [408, 429, 500, 502, 503, 504].contains(status)
        } else if let failure = error as? URLError {
            retryable = [.timedOut, .networkConnectionLost, .notConnectedToInternet, .cannotFindHost,
                         .cannotConnectToHost, .dnsLookupFailed].contains(failure.code)
        } else {
            retryable = false
        }
        let delays: [UInt64] = [4, 12, 30]
        guard retryable, delays.indices.contains(syncRetryAttempt) else {
            syncProblem = retryable ? "暂时无法连接云端。可手动重试。" : error.localizedDescription
            return
        }
        let delay = delays[syncRetryAttempt]
        syncRetryAttempt += 1
        syncRetryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
            guard !Task.isCancelled, let self else { return }
            syncRetryTask = nil
            await flushLocalChanges()
        }
    }

    func savePlan(id: String, data: NativeJSON, revision: String?) async -> String? {
        await savePlanItem(.object(["action": .string("plans"), "expectedOwner": .string(owner), "items": .array([
            .object(["id": .string(id), "data": data, "revision": revision.map(NativeJSON.string) ?? .null])
        ])]), path: "/api/workout")
    }

    func saveTemplate(id: String, data: NativeJSON, revision: String?) async throws {
        let template: NativeJSON = .object(["kind": .string("template"), "id": .string(id), "plan": data])
        let body: NativeJSON = .object(["action": .string("save"), "expectedOwner": .string(owner),
                                       "revision": revision.map(NativeJSON.string) ?? .null, "data": template])
        try await writePlanChange(JSONEncoder().encode(body), path: "/api/library") { response in
            let receipt = try JSONDecoder().decode(NativeJSON.self, from: response)
            guard receipt["ok"].bool, !receipt["updated"].string.isEmpty else { throw NativeAPIError.invalidResponse }
            var row = template
            row["updated"] = receipt["updated"]
            libraryRows = [row] + libraryRows.filter { $0["kind"].string != "template" || $0["id"].string != id }
        }
    }

    func removeTemplate(id: String, revision: String) async throws {
        let body = ["action": "remove", "kind": "template", "id": id, "revision": revision, "expectedOwner": owner]
        try await writePlanChange(JSONEncoder().encode(body), path: "/api/library") { response in
            let receipt = try JSONDecoder().decode(NativeJSON.self, from: response)
            guard receipt["ok"].bool else { throw NativeAPIError.invalidResponse }
            libraryRows.removeAll { $0["kind"].string == "template" && $0["id"].string == id }
        }
    }

    func canMovePlan(_ plan: NativeWorkoutEntry) -> Bool {
        guard plan.kind == "plan", plan.owner == owner else { return false }
        guard !hasCompletedPlan(id: plan.id) else { return false }
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

    private func writePlanChange<T>(_ body: Data, path: String = "/api/workout", apply: (Data) throws -> T) async throws -> T {
        guard !isBusy else { throw NativeAPIError.server(status: 409, message: "正在同步训练，请稍后重试。") }
        isBusy = true
        defer { isBusy = false }
        let revision = localRevision
        let response = try await api.request(path, method: "POST", json: body, for: owner)
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
        invalidateWidgetHistory(for: record.day, saved.day)
        return saved
    }

    func cheer(expectedPartner: String? = nil) async throws {
        if let expectedPartner {
            await load()
            guard partnerID == expectedPartner, !room["connectionId"].string.isEmpty else {
                throw NativeAPIError.server(status: 409, message: "搭子关系已变化，请打开搭子列表刷新。")
            }
        }
        let connection = room["connectionId"].string
        guard !partnerID.isEmpty, !connection.isEmpty else { return }
        let body: NativeJSON = .object(["action": .string("cheer"), "partner": .string(partnerID),
                                       "connection": .string(connection), "timeZone": .string(TimeZone.current.identifier)])
        _ = try await api.request("/api/workout", method: "POST", json: JSONEncoder().encode(body), for: owner)
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
    var openWorkout: () -> Void
    @Environment(\.spotterAccent) private var accent
    @EnvironmentObject private var remarks: NativeSocialRemarks
    var showsAllPlans = false
    var openSettings: (() -> Void)? = nil
    var openNutrition: (() -> Void)? = nil
    var openAllPlans: (() -> Void)? = nil
    var openStats: (() -> Void)? = nil
    var openCoach: (() -> Void)? = nil
    var openImport: (() -> Void)? = nil
    var openPrograms: (() -> Void)? = nil
    var openFriends: (() -> Void)? = nil
    var homeNutrition: ((@escaping () -> Void) -> AnyView)? = nil
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.spotterGuide) private var guide
    @AppStorage("spotter.native.home.nutritionCollapsed") private var nutritionCollapsed = false
    @AppStorage(NativePreferenceKey.weeklyCheckins) private var showCheckins = true
    @AppStorage(NativePreferenceKey.planShortcut) private var showPlanShortcut = true
    @AppStorage(NativePreferenceKey.officialTemplates) private var showOfficialTemplates = true
    @State private var selectedDate = Date()
    @State private var trainingTab = "我的计划"
    @State private var completedPlans = false
    @State private var earlierHistoryAnchor: String?
    @State private var loadingEarlierHistory = false
    @State private var earlierHistoryFailed = false
    @State private var planEditor: NativePlanDraft?
    @State private var queuedPlanStart: NativePlanDraft?
    @State private var planScheduleAction: PlanScheduleAction?
    @State private var templateAction: NativeTemplateAction?
    @State private var planNotice: String?
    @State private var cataloguePlanMove: NativeCataloguePlanMove?
    @State private var queuedCatalogueDraft: NativePlanDraft?
    @State private var recordSheet: RecordSheet?
    @State private var draftToDiscard: NativeWorkoutEntry?
    @State private var draftToRestart: NativeWorkoutEntry?
    @State private var swipeDraftID: String?
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
        case planMoves(NativeWorkoutEntry)
        case templateMoves(NativeJSON)

        var id: String {
            switch self {
            case .record(let entry): return "record:\(entry.owner):\(entry.id)"
            case .share(let entry): return "share:\(entry.owner):\(entry.id)"
            case .day(let day, _): return "day:\(day)"
            case .planMoves(let entry): return "planMoves:" + entry.id
            case .templateMoves(let template): return "templateMoves:" + template["id"].string
            }
        }
    }

    private var selectedDay: String { NativeWorkoutSession.day(selectedDate) }
    private var partnerDisplayName: String { remarks.name(for: store.partnerID, fallback: store.partnerName) }
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
                    } else if showOfficialTemplates && trainingTab == "官方模板" {
                        NativeOfficialTemplates(store: store)
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
        .task(id: guide?.step) {
            guard showsAllPlans, guide?.step == .newPlan else { return }
            trainingTab = "我的计划"
            completedPlans = false
        }
        .onChange(of: showOfficialTemplates) { enabled in
            if !enabled && trainingTab == "官方模板" { trainingTab = "我的计划" }
        }
        .sheet(item: $recordSheet) { screen in
            switch screen {
            case .record(let entry):
                NavigationStack { recordDetail(entry, showsClose: true) }
                    .presentationDragIndicator(.visible)
            case .share(let entry):
                if entry.owner == store.owner, let current = store.logs.first(where: { $0.key == entry.key }) {
                    NativeWorkoutShareView(entry: current, logs: store.logs, owner: store.owner, displayName: store.viewerName,
                                           api: store.api, subjectFigure: store.anatomyVariant(for: current.owner))
                }
            case .day(let day, let records):
                NavigationStack { dayDetails(day, records: records) }
                    .presentationDragIndicator(.visible)
            case .planMoves(let entry):
                NavigationStack { plannedDemonstrations(entry) }
                    .presentationDragIndicator(.visible)
            case .templateMoves(let template):
                NavigationStack { NativePersonalTemplatePreview(plan: NativePlan(raw: template["plan"]), store: store) }
                    .presentationDragIndicator(.visible)
            }
        }
        .fullScreenCover(item: $planEditor, onDismiss: {
            guide?.advance(.planFields)
            if let queued = queuedPlanStart {
                queuedPlanStart = nil
                startEditedPlan(queued)
            }
        }) { draft in
            NavigationStack {
                NativePlanEditorPanel(store: store, draft: draft, saved: { day in
                    if draft.isTemplate {
                        if showsAllPlans { trainingTab = "个人模板" }
                        planNotice = "模板已保存"
                    } else {
                        trainingTab = "我的计划"
                        completedPlans = false
                        if let date = nativePlanDate(day) { selectedDate = date }
                    }
                }, start: { queuedPlanStart = $0 })
            }
        }
        .sheet(item: $planScheduleAction) { action in
            switch action {
            case .move(let plan):
                NativePlanMoveSheet(store: store, entry: plan) { receipt in
                    if let date = nativePlanDate(receipt.date) { selectedDate = date }
                    planNotice = receipt.moved > 1 ? "已顺延 \(receipt.moved) 节训练" : "训练已移动"
                }
            case .remove(let plan):
                NativePlanDeleteSheet(store: store, entry: plan) { planNotice = "计划已删除" }
            }
        }
        .sheet(item: $templateAction) { action in
            NativeTemplateActionSheet(store: store, action: action) { planNotice = $0 }
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
        .alert(draftToDiscard?.key == store.active?.key ? "删除本次训练？" : "删除训练草稿？", isPresented: Binding(
            get: { draftToDiscard != nil },
            set: { if !$0 { draftToDiscard = nil } }
        ), presenting: draftToDiscard) { entry in
            Button(entry.key == store.active?.key ? "删除本次训练" : "删除草稿", role: .destructive) {
                withAnimation(motion) { _ = store.discardDraft(entry) }
            }
            Button("取消", role: .cancel) {}
        } message: { entry in
            Text("「\(entry.title)」的计时、组次和心得将删除。已排的计划会保留，以前的打卡也会保留。")
        }
        .confirmationDialog("重新开始训练？", isPresented: Binding(
            get: { draftToRestart != nil },
            set: { if !$0 { draftToRestart = nil } }
        ), titleVisibility: .visible, presenting: draftToRestart) { entry in
            Button("重新开始", role: .destructive) {
                swipeDraftID = nil
                if store.restartPausedWorkout(entry) { openWorkout() }
            }
            Button("取消", role: .cancel) {}
        } message: { _ in
            Text("将清空本次计时、组次和心得，保留训练项目并从零计时。已排的计划会保留。")
        }
        .task(id: selectedDay + (store.recentHistoryStart ?? "")) {
            guard !showsAllPlans, let start = weekDates.first, let end = weekDates.last else { return }
            await store.loadOlderHistoryIfNeeded(from: NativeWorkoutSession.day(start), through: NativeWorkoutSession.day(end))
        }
    }

    private func workoutOverview(topPadding: CGFloat) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let planNotice {
                    Label(planNotice, systemImage: "checkmark.circle")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.muted)
                        .accessibilityAddTraits(.updatesFrequently)
                        .transition(.opacity)
                }
                if showsAllPlans { trainingLanding } else { todayLanding }
                if showsAllPlans, !store.pendingCheckins.isEmpty || store.pendingDraftRemovalCount > 0 { pendingCard }
                if let message = store.errorMessage {
                    Button { Task { await store.load() } } label: {
                        Label(message, systemImage: "arrow.clockwise").font(.footnote).foregroundStyle(SpotterPalette.muted)
                    }.buttonStyle(.spotterPress)
                }
            }
            .padding(.horizontal, 14).padding(.top, topPadding).padding(.bottom, 26)
        }
        .animation(motion, value: planNotice != nil)
        .refreshable { await store.load() }
    }

    @ViewBuilder private var todayLanding: some View {
        let today = NativeWorkoutSession.day()
        let byPlan = completions
        let dayPlans = store.plans.filter {
            $0.day == selectedDay && byPlan[$0.key] == nil && ($0.owner != store.owner || !store.hasCompletedPlan(id: $0.id))
        }
            .sorted { ($0.owner == store.owner ? 0 : 1) < ($1.owner == store.owner ? 0 : 1) }
        let scheduledCompletions = store.plans.filter { $0.day == selectedDay && byPlan[$0.key] != nil }
            .flatMap { plan in
                let matches = byPlan[plan.key] ?? []
                return matches.contains { $0.day == selectedDay } ? [] : Array(matches.sorted(by: newestRecord).prefix(1))
            }
        let dayRecords = (store.logs.filter { $0.day == selectedDay } + store.partnerLogs.filter {
            $0.day == selectedDay && $0.planKey.flatMap { store.plansByKey[$0] } != nil
        } + scheduledCompletions).sorted(by: newestRecord)
        if let openNutrition { nutritionPanel(openNutrition) }
        else if openSettings != nil { HStack { Spacer(); settingsButton } }
        if !store.pendingCheckins.isEmpty || store.pendingDraftRemovalCount > 0 { pendingCard }
        weekStrip
        HStack {
            Text(selectedDay == today ? "今日训练" : "\(shortDay(selectedDay))的训练")
                .font(.system(size: 18, weight: .bold))
            Spacer()
            Button { openAllPlans?() } label: {
                Label("全部计划", systemImage: "chevron.right")
                    .labelStyle(.titleAndIcon).font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
            }.buttonStyle(.spotterPress).foregroundStyle(accent.tint)
        }.padding(.top, 4)
        if selectedDay == today {
            if let active = store.active { draftRow(active, current: true) }
            ForEach(store.drafts) { entry in draftRow(entry, current: false) }
        }
        if let first = dayPlans.first {
            hero(first)
            if dayPlans.count > 1 { planRows(Array(dayPlans.dropFirst())) }
            if let url = URL(string: first.data["video"].string), !first.data["video"].string.isEmpty {
                Link(destination: url) { Label("打开跟练视频", systemImage: "play.circle").frame(maxWidth: .infinity).padding(14).spotterCard() }
                    .buttonStyle(.spotterPress)
            }
        } else if dayRecords.isEmpty && (selectedDay != today || store.active == nil) {
            compactUnscheduledDay
        }
        if !dayRecords.isEmpty { completedRows(dayRecords) }
        if selectedDay == today {
            let overdue = store.plans.filter { $0.day < today && store.canMovePlan($0) }
                .sorted { ($0.day, $0.updated, $0.id) > ($1.day, $1.updated, $1.id) }
            NativeMissedPlansCard(plans: overdue) { planScheduleAction = .move($0) }
        }
        if openFriends != nil { partnerCard }
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

    @ViewBuilder private var settingsButton: some View {
        if let openSettings {
            Button(action: openSettings) {
                Image(systemName: "gearshape").font(.body.weight(.semibold))
                    .frame(width: 44, height: 44).contentShape(Circle())
                    .spotterGlass(in: Circle(), tint: accent.selection.opacity(0.5), interactive: motion != nil)
            }.buttonStyle(.spotterGlassPress).accessibilityLabel("设置")
        }
    }

    private var compactUnscheduledDay: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("这天还没有安排", systemImage: "calendar")
                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
            if let next = store.nextPlan(after: selectedDay), let date = nativePlanDate(next.day) {
                Button {
                    withAnimation(motion) { selectedDate = date}
                } label: {
                    HStack(spacing: 8) {
                        Text("下次 · \(shortDay(next.day))").font(.caption.weight(.semibold)).foregroundStyle(accent.tint)
                        Text(next.displayTitle).font(.subheadline.weight(.semibold)).lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(accent.tint)
                    }.frame(minHeight: 44).contentShape(Rectangle())
                }.buttonStyle(.spotterPress).accessibilityLabel("下次训练 \(shortDay(next.day)) \(next.displayTitle)")
            }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 13).padding(.vertical, 11).spotterCard(radius: 14)
    }

    private func nutritionPanel(_ open: @escaping () -> Void) -> some View {
        let inMealGuide = guide?.step == .mainMeal || guide?.step.presentation == .mealEditor
        let collapsed = nutritionCollapsed && !inMealGuide
        return VStack(alignment: .leading, spacing: 8) {
            SpotterGlassGroup {
                HStack(spacing: 9) {
                    if collapsed {
                        Button { setNutritionCollapsed(false) } label: {
                            Image(systemName: "fork.knife")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(accent.tint)
                                .frame(width: 34, height: 34)
                                .spotterGlass(in: Circle(), tint: accent.selection.opacity(0.52), interactive: motion != nil)
                                .frame(width: 44, height: 44, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterGlassPress)
                        .accessibilityLabel("展开饮食记录")
                        .accessibilityIdentifier("home-nutrition-expand")
                        .transition(.opacity)
                    } else {
                        Text("饮食记录").font(.headline).accessibilityAddTraits(.isHeader)
                    }
                    Spacer()
                    settingsButton
                }
            }
            if !collapsed {
                Group {
                    // Only the stored flag: the card may keep this closure across passes and animates it itself.
                    if let homeNutrition { homeNutrition { nutritionCollapsed = true } }
                    else {
                        HStack {
                            Button(action: open) {
                                HStack { Label("查看今日饮食", systemImage: "fork.knife"); Spacer(); Image(systemName: "arrow.up.right") }
                                    .frame(minHeight: 44).contentShape(Rectangle())
                            }.buttonStyle(.spotterPress)
                            NativeHomeNutritionCollapseButton { setNutritionCollapsed(true) }
                        }.padding(12).spotterCard()
                    }
                }
                .transition(.offset(y: -8).combined(with: .opacity))
            }
        }
    }

    private func setNutritionCollapsed(_ collapsed: Bool) {
        withAnimation(motion) { nutritionCollapsed = collapsed }
    }

    private var partnerCard: some View {
        let today = NativeWorkoutSession.day()
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
                member("我", avatarName: store.viewerName, id: store.owner, checked: todayMine, connected: true, purple: false)
                member(partnerDisplayName, avatarName: partnerDisplayName, id: connected ? store.partnerID : nil, checked: todayPartner,
                       connected: connected, purple: true, statusOverride: canSeePartner ? nil : "打卡未公开")
            }
            if canSeePartner, let latest, latest.day >= (lastDay ?? "") {
                let showsDay = latest.day == today && partnerToday.count > 1
                Button { recordSheet = showsDay ? .day(today, partnerToday) : .record(latest) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("搭子最近打卡 · \(shortDay(latest.day))").font(.caption).foregroundStyle(SpotterPalette.muted)
                            Text(latest.displayTitle).font(.subheadline.weight(.bold))
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                    }.frame(minHeight: 44).contentShape(Rectangle())
                }.buttonStyle(.spotterPress)
                    .accessibilityHint(showsDay ? "查看当天的全部搭子打卡" : "查看训练记录")
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

    private func member(_ name: String, avatarName: String, id: String?, checked: Bool, connected: Bool, purple: Bool,
                        statusOverride: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 7) {
                NativePersonAvatar(id: id, name: avatarName, size: 32, appearance: .init(
                    foreground: SpotterPalette.deep, background: purple ? SpotterPalette.color(0xe8def7) : accent.fill,
                    fallbackIcon: connected ? nil : "person", outlined: false
                ))
                Text(name).font(.system(size: 14, weight: .bold)).lineLimit(1)
            }
            Label(statusOverride ?? (connected ? (checked ? "已打卡" : store.isLoading ? "同步中" : "未打卡") : "未连接"), systemImage: checked ? "checkmark" : "circle")
                .font(.system(size: 12, weight: .semibold)).foregroundStyle(checked ? SpotterPalette.accent : SpotterPalette.muted)
                .lineLimit(1)
        }.frame(maxWidth: .infinity, alignment: .topLeading).padding(11)
            .background(purple ? SpotterPalette.adaptive(0xf4effa, 0x372c45) : SpotterPalette.wash.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
    }

    private var weekStrip: some View {
        let scheduledDays = Set(store.plans.map(\.day)).union(store.logs.map(\.day))
        return VStack(spacing: 12) {
            HStack {
                Text("训练日程").font(.system(size: 18, weight: .bold))
                Spacer()
                HStack(spacing: 4) {
                    Button { shiftWeek(-7) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("上一周")
                    Button { shiftWeek(7) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("下一周")
                }
                .buttonStyle(.spotterControl)
            }
            HStack(spacing: 3) {
                ForEach(Array(weekDates.enumerated()), id: \.offset) { offset, date in
                    let day = NativeWorkoutSession.day(date)
                    Button { withAnimation(motion) { selectedDate = date} } label: {
                        VStack(spacing: 4) {
                            Text("周\(["一", "二", "三", "四", "五", "六", "日"][offset])").font(.system(size: 11, weight: .semibold))
                            Text(date.formatted(.dateTime.day())).font(.system(size: 19, weight: .bold))
                            Circle().fill(SpotterPalette.accent).frame(width: 4, height: 4)
                                .opacity(scheduledDays.contains(day) ? 1 : 0)
                        }.frame(maxWidth: .infinity).padding(.vertical, 7)
                    }
                    .buttonStyle(SpotterChoiceStyle(selected: day == selectedDay, horizontalPadding: 0, minimumWidth: 0))
                    .accessibilityLabel(day)
                    .accessibilityAddTraits(day == selectedDay ? .isSelected : [])
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
    private func shiftWeek(_ days: Int) {
        withAnimation(motion) {
            selectedDate = Calendar.current.date(byAdding: .day, value: days, to: selectedDate) ?? selectedDate
        }
    }

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
                HStack(spacing: 8) {
                    Button { store.start(plan: plan, id: entry.id); openWorkout() } label: {
                        Label("开始计划训练", systemImage: "play.fill")
                    }
                    .buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .disabled(store.active != nil || store.isBusy)
                    if entry.owner == store.owner, !plan.exercises.isEmpty {
                        Button("动作演示", systemImage: "play.rectangle") { recordSheet = .planMoves(entry) }
                            .buttonStyle(SpotterNativeButtonStyle(primary: false))
                            .accessibilityIdentifier("plan-exercise-demonstrations")
                    }
                }
                .font(.system(size: 15, weight: .bold))
                .padding(.top, 6)
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
                    SpotterMenu { planActions(entry) } label: {
                        Image(systemName: "ellipsis").font(.system(size: 16, weight: .bold))
                    }.accessibilityLabel("训练操作 " + entry.displayTitle).padding(12)
                }
            }
    }

    private func plannedDemonstrations(_ entry: NativeWorkoutEntry) -> some View {
        ScrollView {
            planMovementRows(entry) { index, move in
                NavigationLink {
                    NativeExerciseProgressView(store: store, move: move)
                } label: {
                    planMovementRow(index, move: move, showsDemo: true)
                }
                .buttonStyle(.spotterPress)
                .accessibilityHint("打开动作详情，查看可用演示")
                .accessibilityIdentifier("plan-exercise-demo-\(index)")
            }
            .spotterCard()
            .padding(14)
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("动作演示")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("关闭") { recordSheet = nil } }
        }
    }

    private func planMovementRows<Row: View>(_ entry: NativeWorkoutEntry,
                                             @ViewBuilder row: @escaping (Int, NativeJSON) -> Row) -> some View {
        let exercises = entry.data["exercises"].array
        return LazyVStack(alignment: .leading, spacing: 0) {
            ForEach(Array(exercises.enumerated()), id: \.offset) { index, move in
                row(index, move)
                if index < exercises.count - 1 {
                    Divider().overlay(SpotterPalette.line).padding(.horizontal, 14)
                }
            }
        }
    }

    private func planMovementRow(_ index: Int, move: NativeJSON, showsDemo: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string)
                .font(.system(size: 13, weight: .bold))
                .frame(width: 34, height: 30)
                .background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(move["name"].string).font(.system(size: 15, weight: .bold))
                Text(prescription(move)).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
                if !move["cue"].string.isEmpty {
                    Text(move["cue"].string).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                }
            }
            Spacer(minLength: 0)
            if showsDemo {
                Label("演示", systemImage: "play.rectangle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accent.tint)
                    .fixedSize()
                    .frame(minHeight: 30)
            }
        }
        .frame(minHeight: 44, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private func draftRow(_ entry: NativeWorkoutEntry, current: Bool) -> some View {
        let running = current && entry.session?.isRunning == true
        let row = HStack(spacing: 10) {
            tile("clock", size: 34)
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title).font(.system(size: 14, weight: .bold))
                Text("\(entry.session?.completedSets ?? 0) 组完成 · \(current ? (running ? "进行中" : "计时已暂停") : "训练草稿")")
                    .font(.caption).foregroundStyle(SpotterPalette.muted)
            }
            Spacer(minLength: 0)
            if !running {
                SpotterMenu {
                    if current {
                        Button("重新开始", systemImage: "arrow.counterclockwise") { draftToRestart = entry }
                            .accessibilityIdentifier("workout-draft-restart")
                    }
                    Button(current ? "删除本次训练" : "删除训练草稿", systemImage: "trash", role: .destructive) { draftToDiscard = entry }
                        .accessibilityIdentifier("workout-draft-delete")
                } label: {
                    Image(systemName: "ellipsis").font(.body.weight(.semibold))
                        .frame(width: 22, height: 22)
                }.accessibilityLabel("训练草稿操作 \(entry.title)")
            }
            Button(current && !running ? "打开" : "继续") {
                swipeDraftID = nil
                if !current { store.resume(entry) }
                openWorkout()
            }
                .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(!current && store.active != nil)
        }.padding(12).spotterCard()
        return Group {
            if running { row }
            else {
                row.spotterSwipeToDelete(id: entry.id, openRow: $swipeDraftID, accessibilityLabel: "删除训练草稿") {
                    draftToDiscard = entry
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(current ? "workout-current-draft-row" : "workout-draft-row-\(entry.id)")
    }

    private func planRows(_ entries: [NativeWorkoutEntry]) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(entries, id: \.key) { entry in
                let plan = NativePlan(raw: entry.data)
                HStack(spacing: 9) {
                    tile(isFollowAlong(entry.data) ? "play.rectangle" : "dumbbell", size: 34)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.displayTitle).font(.system(size: 14, weight: .bold)).lineLimit(2)
                        Text([shortDay(entry.day), plan.weekDay, plan.category,
                              entry.durationMinutes > 0 ? "\(entry.durationMinutes) 分钟" : ""].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                    }
                    Spacer(minLength: 0)
                    Button("开始") { store.start(plan: plan, id: entry.id); openWorkout() }
                        .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(store.active != nil || store.isBusy)
                    if entry.owner == store.owner {
                        SpotterMenu { planActions(entry) } label: { Image(systemName: "ellipsis") }
                            .accessibilityLabel("训练操作 " + entry.displayTitle)
                    }
                }.padding(.vertical, 10)
                if entry.key != entries.last?.key { Divider().overlay(SpotterPalette.line) }
            }
        }.padding(.horizontal, 12).spotterCard()
    }

    @ViewBuilder private func planActions(_ entry: NativeWorkoutEntry) -> some View {
        if entry.owner == store.owner, !entry.data["exercises"].array.isEmpty {
            Button("动作演示", systemImage: "play.rectangle") { recordSheet = .planMoves(entry) }
        }
        Button("编辑计划", systemImage: "pencil") { planEditor = NativePlanDraft(entry: entry) }
        if store.canMovePlan(entry) {
            Button(entry.day < NativeWorkoutSession.day() ? "预览调整日期" : "移动或顺延",
                   systemImage: "calendar.badge.clock") { planScheduleAction = .move(entry) }
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
                                fromTemplate ? "模板" : "", entry.owner != store.owner ? partnerDisplayName : "", "已完成"]
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
                        SpotterMenu {
                            if let linkedPlan { planActions(linkedPlan) }
                            Button("分享训练", systemImage: "square.and.arrow.up") { recordSheet = .share(entry) }
                        } label: {
                            Image(systemName: "ellipsis").font(.subheadline.bold())
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
                checkinRow(partnerDisplayName, days: days, records: shared, partnerDays: partnerDays,
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
        let tabs = showOfficialTemplates ? ["我的计划", "个人模板", "官方模板", "动作库"] : ["我的计划", "个人模板", "动作库"]
        return SpotterGlassSegments(options: tabs, value: $trainingTab,
                                    guideTarget: { $0 == "官方模板" ? .officialTemplates : nil }) { $0 }
    }

    private func editCataloguePlan(_ entry: NativeCatalogEntry, in plan: NativeWorkoutEntry?) {
        queuedCatalogueDraft = NativeCataloguePlanMove(entry: entry).draft(addingTo: plan, on: selectedDay)
        cataloguePlanMove = nil
    }

    private func startEditedPlan(_ draft: NativePlanDraft) {
        guard store.active == nil, !store.isBusy else { return }
        if draft.isTemplate {
            var fields = draft.plan.object
            fields["templateId"] = .string(draft.id)
            fields["date"] = .string(NativeWorkoutSession.day())
            store.startUnscheduled(plan: NativePlan(raw: .object(fields)))
        } else {
            store.start(plan: NativePlan(raw: draft.plan), id: draft.id)
        }
        if store.active != nil { openWorkout() }
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
                    HStack(spacing: 4) {
                        SpotterMenu {
                            if let openCoach { Button("AI 教练起草", systemImage: "sparkles", action: openCoach) }
                            if let openImport { Button("粘贴已有内容", systemImage: "list.bullet.clipboard", action: openImport) }
                            if let openPrograms { Button("训练周期", systemImage: "calendar.badge.plus", action: openPrograms) }
                        } label: {
                            Label("添加计划", systemImage: "plus.square.on.square").font(.system(size: 12, weight: .semibold))
                        }
                        Button {
                            planEditor = NativePlanDraft(day: selectedDay)
                            guide?.advance(.newPlan)
                        } label: {
                            Label("新建计划", systemImage: "plus").font(.system(size: 12, weight: .semibold))
                        }
                        .buttonStyle(.spotterPrimaryControl)
                        .nativeGuideTarget(.newPlan)
                    }
                }
                SpotterGlassSegments(options: [false, true], value: $completedPlans, glass: false) { $0 ? "已完成" : "待训练" }
            }.padding(12).spotterCard()
            if completedPlans {
                let records = visibleLogs.sorted(by: newestRecord)
                if records.isEmpty { emptyCard("还没有已完成的训练", symbol: "list.clipboard") }
                else { completedRows(records) }
                if let before = earlierHistoryAnchor ?? store.recentHistoryStart {
                    Button {
                        Task { await showEarlierHistory(before: before) }
                    } label: {
                        Label(loadingEarlierHistory ? "正在加载" : "加载更早的打卡", systemImage: "clock.arrow.circlepath")
                            .frame(maxWidth: .infinity)
                    }.buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled(loadingEarlierHistory)
                    if earlierHistoryFailed { Text("暂时无法读取较早的打卡，请联网重试。").font(.footnote).foregroundStyle(SpotterPalette.muted) }
                }
            } else {
                let byPlan = completions
                let plans = store.plans.filter {
                    byPlan[$0.key] == nil && ($0.owner != store.owner || !store.hasCompletedPlan(id: $0.id))
                }.sorted { $0.day < $1.day }
                let sessions = plans.filter { !isFollowAlong($0.data) }
                let videos = plans.filter { isFollowAlong($0.data) }
                if plans.isEmpty { emptyCard("还没有训练计划", symbol: "list.clipboard") }
                if !sessions.isEmpty { planRows(sessions) }
                if !videos.isEmpty {
                    followAlongHeading
                    planRows(videos)
                }
            }
            if let active = store.active { draftRow(active, current: true) }
        } else if trainingTab == "个人模板" {
            personalTemplates
        }
    }

    private func isFollowAlong(_ plan: NativeJSON) -> Bool {
        plan["category"].string == "跟练视频" || !plan["video"].string.isEmpty
    }

    private var followAlongHeading: some View {
        Label("跟练视频", systemImage: "play.rectangle")
            .font(.headline)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder private var personalTemplates: some View {
        let templates = store.libraryRows.filter { $0["kind"].string == "template" }
        let workouts = templates.filter { !isFollowAlong($0["plan"]) }
        let videos = templates.filter { isFollowAlong($0["plan"]) }
        Button { planEditor = NativePlanDraft(day: selectedDay, template: true) } label: { Label("新建模板", systemImage: "plus") }
            .buttonStyle(SpotterNativeButtonStyle(primary: true))
        if templates.isEmpty {
            emptyCard("还没有个人模板", symbol: "bookmark", detail: "也可以从现有计划或已完成的打卡另存为模板。")
        }
        ForEach(workouts, id: \.["id"].string) { personalTemplateCard($0) }
        if !videos.isEmpty {
            followAlongHeading
            ForEach(videos, id: \.["id"].string) { personalTemplateCard($0) }
        }
    }

    private func personalTemplateCard(_ template: NativeJSON) -> some View {
        let plan = NativePlan(raw: template["plan"])
        let moveNames = plan.exercises.prefix(4).map { $0["name"].string }.joined(separator: "、")
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button {
                    recordSheet = .templateMoves(template)
                } label: {
                    HStack(spacing: 10) {
                        tile(isFollowAlong(plan.raw) ? "play.rectangle" : "list.clipboard", size: 38)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(plan.title).font(.headline)
                            Text([plan.category, plan.exercises.isEmpty ? "" : "\(plan.exercises.count) 个动作",
                                  plan.raw["minutes"].number > 0 ? "\(Int(plan.raw["minutes"].number)) 分钟" : ""]
                                .filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                            if !moveNames.isEmpty { Text(moveNames).font(.subheadline).foregroundStyle(SpotterPalette.muted) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(SpotterPalette.muted)
                            .accessibilityHidden(true)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .accessibilityHint("打开模板详情和完整动作清单")
                .accessibilityIdentifier("personal-template-detail")
                SpotterMenu {
                    Button("改名", systemImage: "character.cursor.ibeam") {
                        templateAction = .init(template: template, operation: .rename)
                    }
                    if let url = URL(string: plan.video), url.scheme?.lowercased() == "https" {
                        Link(destination: url) { Label("打开跟练视频", systemImage: "play.rectangle") }
                    }
                    Button("删除模板", systemImage: "trash", role: .destructive) {
                        templateAction = .init(template: template, operation: .remove)
                    }
                } label: {
                    Image(systemName: "ellipsis").font(.body.weight(.semibold)).frame(width: 22, height: 22)
                }
                .accessibilityLabel("模板操作 \(plan.title)")
            }
            HStack {
                Button {
                    planEditor = NativePlanDraft(template: template, day: selectedDay, schedule: false)
                } label: {
                    Label(plan.exercises.isEmpty ? "编辑模板" : "编辑动作", systemImage: "pencil")
                }.buttonStyle(SpotterNativeButtonStyle(primary: false))
                Button {
                    planEditor = NativePlanDraft(template: template, day: selectedDay, schedule: true)
                } label: {
                    Label("安排训练", systemImage: "calendar.badge.plus")
                }.buttonStyle(SpotterNativeButtonStyle(primary: true))
            }
            .font(.subheadline.weight(.semibold))
        }
        .disabled(store.isBusy)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14).spotterCard()
    }

    private func showEarlierHistory(before: String) async {
        guard !loadingEarlierHistory else { return }
        loadingEarlierHistory = true
        defer { loadingEarlierHistory = false }
        if let page = await store.loadEarlierHistory(before: before) {
            earlierHistoryAnchor = page
            earlierHistoryFailed = false
        } else {
            earlierHistoryFailed = true
        }
    }

    private var pendingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(store.isSyncing ? "正在同步训练" : (store.networkAvailable == false ? "训练已保存到手机" : "训练待同步"),
                  systemImage: store.networkAvailable == false ? "wifi.slash" : "icloud.and.arrow.up")
                .font(.subheadline.weight(.semibold))
            if !store.pendingCheckins.isEmpty {
                Text("\(store.pendingCheckins.count) 条打卡等待同步，联网后自动上传。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if store.pendingDraftRemovalCount > 0 {
                Text("\(store.pendingDraftRemovalCount) 条草稿删除待同步。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            }
            if let problem = store.syncProblem, store.networkAvailable != false { Text(problem).font(.footnote).foregroundStyle(SpotterPalette.muted) }
            Button("重试同步") { Task { await store.syncLocalChanges() } }
                .buttonStyle(SpotterNativeButtonStyle(primary: false))
                .disabled(store.isBusy || store.isSyncing || store.networkAvailable == false)
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

private struct NativePersonalTemplatePreview: View {
    let plan: NativePlan
    let store: NativeWorkoutStore
    @Environment(\.dismiss) private var dismiss
    @State private var exercisePreview: NativeTemplateExercisePreview?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                Text(plan.title).font(.title2.weight(.heavy)).accessibilityAddTraits(.isHeader)
                Text(plan.category).font(.subheadline).foregroundStyle(SpotterPalette.muted)
                if let url = URL(string: plan.video), url.scheme?.lowercased() == "https" {
                    Link(destination: url) { Label("打开跟练视频", systemImage: "play.rectangle") }
                }
                if plan.exercises.isEmpty {
                    Text("此模板尚未添加动作。").font(.subheadline).foregroundStyle(SpotterPalette.muted)
                } else {
                    Text("动作清单").font(.headline).accessibilityAddTraits(.isHeader)
                    ForEach(Array(plan.exercises.enumerated()), id: \.offset) { index, move in
                        let rowID = "personal-template-exercise-\(index)"
                        NativeTemplateExerciseButton(name: move["name"].string, prescription: prescription(move),
                                                     cue: move["cue"].string) {
                            exercisePreview = .init(id: rowID, move: move)
                        }
                        .accessibilityIdentifier(rowID)
                    }
                }
            }
            .padding(14)
        }
        .background(SpotterPalette.background)
        .foregroundStyle(SpotterPalette.ink)
        .navigationTitle("模板详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
        }
        .sheet(item: $exercisePreview) { preview in
            NativeTemplateExerciseSheet(store: store, move: preview.move)
        }
    }
}

private struct NativeTemplateAction: Identifiable {
    enum Operation: String { case rename, remove }

    let template: NativeJSON
    let operation: Operation

    var id: String { "\(operation.rawValue):\(template["id"].string)" }
}

private struct NativeTemplateActionSheet: View {
    @ObservedObject var store: NativeWorkoutStore
    let action: NativeTemplateAction
    let didFinish: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var busy = false
    @State private var problem: String?
    @State private var needsReview = false

    init(store: NativeWorkoutStore, action: NativeTemplateAction, didFinish: @escaping (String) -> Void) {
        self.store = store
        self.action = action
        self.didFinish = didFinish
        self._name = State(initialValue: action.template["plan"]["title"].string)
    }

    private var isRename: Bool { action.operation == .rename }
    private var nameToSave: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var validName: Bool { (1...100).contains(nameToSave.utf16.count) }
    private var canSubmit: Bool { !busy && !store.isBusy && !needsReview && (!isRename || validName) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 13) {
                    if isRename {
                        TextField("模板名称", text: $name)
                            .textFieldStyle(.roundedBorder)
                            .submitLabel(.done)
                            .onSubmit { if canSubmit { Task { await submit() } } }
                        if nameToSave.utf16.count > 100 {
                            Text("模板名称最多 100 字。")
                                .font(.footnote).foregroundStyle(SpotterPalette.muted)
                        }
                    } else {
                        Text("删除「\(action.template["plan"]["title"].string)」？")
                            .font(.headline)
                        Text("已安排的训练和已完成的打卡都会保留。")
                            .font(.subheadline).foregroundStyle(SpotterPalette.muted)
                    }
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.circle")
                            .font(.footnote).foregroundStyle(.red)
                    }
                    if !isRename {
                        Button(role: .destructive) { Task { await submit() } } label: {
                            Label(busy ? "正在删除…" : "确认删除", systemImage: "trash")
                        }.buttonStyle(.spotterControl).disabled(!canSubmit)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(14).spotterCard().padding(14)
            }
            .background(SpotterPalette.background.ignoresSafeArea())
            .navigationTitle(isRename ? "模板改名" : "删除模板")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(busy) }
                if isRename {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(busy ? "保存中" : "保存") { Task { await submit() } }.disabled(!canSubmit)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    private func submit() async {
        guard canSubmit else { return }
        busy = true
        problem = nil
        defer { busy = false }
        do {
            let id = action.template["id"].string
            let revision = action.template["updated"].string
            if isRename {
                var plan = action.template["plan"]
                plan["title"] = .string(nameToSave)
                try await store.saveTemplate(id: id, data: plan, revision: revision)
            } else {
                try await store.removeTemplate(id: id, revision: revision)
            }
            didFinish(isRename ? "模板已改名" : "模板已删除")
            dismiss()
        } catch {
            problem = error.localizedDescription
            if (error as? NativeAPIError)?.statusCode == 409 {
                needsReview = true
                await store.load()
            }
        }
    }
}

struct SpotterNativeButtonStyle: ButtonStyle {
    @Environment(\.spotterAccent) private var accent
    @Environment(\.isEnabled) private var enabled
    var primary: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 13).padding(.vertical, 11)
            .foregroundStyle(primary ? SpotterPalette.deep : SpotterPalette.ink)
            .background(primary ? accent.fill : SpotterPalette.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay {
                RoundedRectangle(cornerRadius: 11)
                    .strokeBorder(primary ? .clear : SpotterPalette.line).allowsHitTesting(false)
            }
            .spotterPressFeedback(configuration.isPressed)
            .opacity(enabled ? 1 : 0.54)
    }
}

private func tile(_ symbol: String, size: CGFloat = 40, color: Color? = nil) -> some View {
    Image(systemName: symbol).font(.system(size: size * 0.45, weight: .semibold)).frame(width: size, height: size)
        .foregroundStyle(color ?? SpotterPalette.accent).background((color ?? SpotterPalette.accent).opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
}

private func nativeIconButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: symbol).font(.system(size: 19)).frame(width: 44, height: 44)
            .background(SpotterPalette.card, in: RoundedRectangle(cornerRadius: 12))
            .contentShape(Rectangle())
    }
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

/// Created once: the home screen checks every buddy cheer with these on each update, and building an
/// ISO8601DateFormatter per call was a large part of that.
private let localRecordFractionalFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}()

private let localRecordFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
}()

private func localRecordDay(_ timestamp: String) -> String? {
    if let date = localRecordFractionalFormatter.date(from: timestamp) { return NativeWorkoutSession.day(date) }
    return localRecordFormatter.date(from: timestamp).map { NativeWorkoutSession.day($0) }
}

private func prescription(_ move: NativeJSON) -> String {
    let repetitions = move["seconds"].number > 0 ? "\(Int(move["seconds"].number)) 秒" : "\(Int(move["reps"].number)) 次"
    return "\(Int(move["sets"].number)) 组 × \(repetitions)" + (move["weight"].number > 0 ? " · \(move["weight"].number.formatted()) \(move["unit"].string)" : "")
}

struct NativeTrainingLaunch: View {
    let start: (String) -> Void
    var rest: (() -> Void)?
    var bodyAction: (() -> Void)?
    var scheduled: [NativeWorkoutEntry] = []
    var startPlan: ((NativeWorkoutEntry) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.spotterInteractionMotion) private var motion
    @State private var showsCardioActivities = false
    private let choices = [("strength", "力量训练", "dumbbell", Color(red: 0.82, green: 0.93, blue: 0.64)),
                           ("cardio", "有氧训练", "waveform.path.ecg", Color(red: 0.65, green: 0.89, blue: 0.79)),
                           ("incline", "爬坡走", "figure.walk", Color(red: 0.67, green: 0.85, blue: 0.94)),
                           ("hiit", "HIIT 训练", "bolt", Color(red: 1, green: 0.86, blue: 0.59))]

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                HStack {
                    if showsCardioActivities {
                        Button {
                            withAnimation(motion) { showsCardioActivities = false }
                        } label: {
                            Image(systemName: "chevron.left").font(.subheadline.weight(.semibold))
                                .frame(width: 44, height: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.spotterPress)
                        .accessibilityLabel("返回训练类型")
                    }
                    Text(showsCardioActivities ? "选择有氧项目" : "开始训练")
                        .font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.subheadline.weight(.semibold))
                            .frame(width: 44, height: 44).contentShape(Rectangle())
                            .spotterGlass(cornerRadius: 22, tint: .white.opacity(0.16))
                    }
                    .buttonStyle(.spotterGlassPress).accessibilityLabel("关闭开始训练")
                }
                if showsCardioActivities {
                    LazyVGrid(columns: gridColumns, spacing: 15) {
                        ForEach(NativeWorkoutSession.CardioActivity.allCases) { activity in
                            launchButton(activity.title, symbol: activity.symbol, color: cardioColor, size: 52) { start(activity.rawValue) }
                                .accessibilityIdentifier("start-cardio-" + activity.rawValue)
                        }
                    }
                } else {
                    startChoices
                }
            }
            .frame(maxWidth: 620)
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 14)
            .frame(maxWidth: .infinity)
        }
        .id(showsCardioActivities)
        .foregroundStyle(.white)
        .background(SpotterPalette.deep.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
    private var gridColumns: [GridItem] { Array(repeating: GridItem(.flexible()), count: 3) }

    private let cardioColor = Color(red: 0.65, green: 0.89, blue: 0.79)

    private var startChoices: some View {
        VStack(spacing: 18) {
            if let startPlan, !scheduled.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("今天的计划").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.7))
                    ForEach(scheduled, id: \.key) { plan in
                        Button { startPlan(plan) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "play.circle.fill").font(.title3).foregroundStyle(SpotterAccent.lime.fill)
                                Text(plan.displayTitle).font(.subheadline.weight(.semibold))
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.footnote.weight(.bold))
                            }.padding(.horizontal, 13).frame(minHeight: 46)
                        }.buttonStyle(.spotterPress)
                            .background(SpotterPalette.color(0x294333), in: RoundedRectangle(cornerRadius: 13))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            LazyVGrid(columns: gridColumns, spacing: 19) {
                ForEach(choices, id: \.0) { choice in
                    launchButton(choice.1, symbol: choice.2, color: choice.3) {
                        if choice.0 == "cardio" { withAnimation(motion) { showsCardioActivities = true } }
                        else { start(choice.0) }
                    }
                }
                launchButton("安排休息", symbol: "cup.and.saucer", color: Color(red: 0.79, green: 0.75, blue: 0.93)) { rest?() }.disabled(rest == nil)
                launchButton("身体数据", symbol: "ruler", color: Color(red: 0.95, green: 0.76, blue: 0.67)) { bodyAction?() }.disabled(bodyAction == nil)
            }
        }
    }

    private func launchButton(_ title: String, symbol: String, color: Color, size: CGFloat = 70, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: size * 0.44, weight: .medium)).frame(width: size, height: size)
                    .background(color, in: RoundedRectangle(cornerRadius: 15)).foregroundStyle(SpotterPalette.deep)
                    .accessibilityHidden(true)
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: size + 30)
            .contentShape(Rectangle())
        }.buttonStyle(.spotterPress)
    }
}

struct NativeCardioPlanPresets: View {
    let add: (NativeJSON) -> Void

    var body: some View {
        SpotterMenu {
            ForEach(NativeWorkoutSession.CardioActivity.planPresets) { activity in
                if let move = activity.planMove {
                    Button(activity.title, systemImage: activity.symbol) { add(move) }
                }
            }
        } label: {
            Label("添加常见有氧动作", systemImage: "figure.run")
        }
    }
}

struct NativeCataloguePlanMove: Identifiable {
    let entry: NativeCatalogEntry
    var id: String { entry.id }

    func draft(addingTo plan: NativeWorkoutEntry?, on day: String) -> NativePlanDraft {
        var draft = plan.map(NativePlanDraft.init(entry:)) ?? NativePlanDraft(day: day)
        if plan == nil { draft.plan["title"] = .string(entry.name) }
        var fields = draft.plan.object
        fields.removeValue(forKey: "templateId")
        fields.removeValue(forKey: "ownExercises")
        fields["exercises"] = .array(draft.plan["exercises"].array + [Self.planMove(entry)])
        draft.plan = .object(fields)
        return draft
    }

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

struct NativeCataloguePlanPicker: View {
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
                    SpotterMenuPicker("选择训练计划", selection: $selected,
                                      options: [("", "新建训练计划")] + plans.map { ($0.id, "\($0.day) · \($0.title)") })
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

private enum NativeEditorPanel: String, Identifiable {
    case settings, watch, sync, add, finish, demonstration

    var id: String { rawValue }
    var detents: Set<PresentationDetent> {
        switch self {
        case .watch: return [.height(224), .large]
        case .demonstration: return [.large]
        default: return [.medium, .large]
        }
    }
}

struct NativeActiveWorkoutView: View {
    private enum WorkoutPrompt {
        case empty

        var title: String { "这次还没有可打卡的内容" }
    }

    @Environment(\.spotterAccent) private var accent
    @ObservedObject var store: NativeWorkoutStore
    let completed: (NativeWorkoutEntry) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @Environment(\.spotterInteractionMotion) private var motion
    @Environment(\.verticalSizeClass) private var verticalSizeClass
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
    @State private var workoutPrompt: (kind: WorkoutPrompt, draft: NativeWorkoutEntry)?
    @State private var panelMove: NativeJSON?
    @State private var exerciseHistory = NativeExerciseHistory()
    @State private var hasIndexedExerciseHistory = false
    @State private var lookedUpOlderHistory = false
    @State private var dismissAfterPanel = false
    @State private var changedIdleTimer = false
    @State private var lastRestRemaining: Int?
    @State private var undoneSet: NativeWorkoutSession.SetPosition?
    @State private var setToReveal: NativeWorkoutSession.SetPosition?
    @State private var setFeedback = UIImpactFeedbackGenerator(style: .light)

    private var needsIdleTimer: Bool {
        keepAwake && phase == .active && store.active?.session?.isRunning == true
    }

    private var earlierExerciseHistoryCutoff: String? {
        hasIndexedExerciseHistory ? store.recentHistoryStart : nil
    }

    var body: some View {
        Group {
            if let entry = store.active, let session = entry.session { workout(entry, session: session) }
            else {
                VStack(spacing: 15) {
                    Text(store.status).font(.subheadline.weight(.semibold))
                    Button("返回") { dismiss() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(SpotterPalette.background)
            }
        }
        .foregroundStyle(SpotterPalette.ink).tint(accent.tint)
        .task { await store.loadProteinPreferences() }
        .task(id: store.logs) {
            let logs = store.logs
            let owner = store.owner
            let indexed = await Task.detached(priority: .userInitiated) {
                NativeExerciseHistory(logs: logs, owner: owner)
            }.value
            guard !Task.isCancelled else { return }
            exerciseHistory = indexed
            hasIndexedExerciseHistory = true
        }
        .task(id: earlierExerciseHistoryCutoff) {
            if let cutoff = earlierExerciseHistoryCutoff { await readOlderExerciseHistoryIfNeeded(before: cutoff) }
        }
        .onAppear { updateIdleTimer(needsIdleTimer) }
        .onChange(of: needsIdleTimer) { enabled in updateIdleTimer(enabled) }
        .onDisappear { updateIdleTimer(false) }
        .alert(workoutPrompt?.kind.title ?? "", isPresented: Binding(
            get: { workoutPrompt != nil },
            set: { if !$0 { workoutPrompt = nil } }
        ), presenting: workoutPrompt) { prompt in
            Button("删除本次训练", role: .destructive) {
                guard store.active?.key == prompt.draft.key, store.discardDraft(prompt.draft) else { return }
                dismiss()
            }
            Button("返回记录", role: .cancel) {}
        } message: { _ in
            Text("计时已暂停。可以返回补记完成组、跟练或有氧时长，也可以删除这次试练。已排的训练计划会保留。")
        }
        .sheet(item: $panel, onDismiss: finishPanelDismissal) { item in
            NavigationStack {
                switch item {
                case .settings: NativeWorkoutSettingsPanel(store: store)
                case .watch:
                    if #available(iOS 17.0, *), let entry = store.active, let session = entry.session {
                        NativeWorkoutWatchPanel(context: watchContext(entry, session: session), cardio: session.watchCardioActivity)
                    }
                case .sync: syncPanel
                case .add: NativeWorkoutAddPanel(store: store) {
                    openedMove = max(0, (store.active?.session?.plan.exercises.count ?? 1) - 1)
                }
                case .demonstration:
                    if let panelMove {
                        NativeExerciseProgressView(store: store, move: panelMove, showsClose: true)
                    }
                case .finish:
                    NativeWorkoutFinishPanel(store: store) { record in
                        completed(record)
                        dismissAfterPanel = true
                        panel = nil
                    }
                }
            }
            .presentationDetents(item.detents)
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(item == .finish && store.isBusy)
        }
    }

    private func finishPanelDismissal() {
        guard dismissAfterPanel else { return }
        dismissAfterPanel = false
        dismiss()
    }

    private func readOlderExerciseHistoryIfNeeded(before cutoff: String) async {
        guard !lookedUpOlderHistory, let moves = store.active?.session?.plan.exercises,
              moves.contains(where: { exerciseHistory.matching(.init($0)).isEmpty }),
              let cutoffDate = nativePlanDate(cutoff),
              let before = Calendar.current.date(byAdding: .day, value: -1, to: cutoffDate),
              let searchStart = Calendar.current.date(byAdding: .year, value: -1, to: .now) else { return }
        lookedUpOlderHistory = true
        await store.loadHistory(from: spotterDay(searchStart), through: spotterDay(before))
    }

    private func workout(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        let compactHeight = verticalSizeClass == .compact
        let next = nextSet(session)
        return VStack(spacing: 0) {
            if !compactHeight { editorHeader(entry, session: session) }
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if compactHeight { editorHeader(entry, session: session) }
                        if let cardio = session.cardioActivity { NativeWorkoutCardioFields(store: store, activity: cardio) }
                        if let video = URL(string: session.plan.video), !session.plan.video.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Link(destination: video) { Label("打开跟练视频", systemImage: "play.circle") }
                                Toggle("已完成跟练", isOn: Binding(get: { session.raw["finishedVideo"].bool }, set: { value in store.mutate { $0.raw["finishedVideo"] = .bool(value) } }))
                            }.font(.system(size: 14)).padding(13).spotterCard()
                        }
                        ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                            exerciseCard(index, move: move, session: session, nextRow: showNext && next?.move == index ? next?.row : nil)
                        }
                        if session.plan.exercises.isEmpty && session.raw["cardio"] == .null {
                            VStack(spacing: 12) { tile("dumbbell", size: 44); Text("添加动作，开始记录训练").font(.system(size: 15, weight: .semibold)); Button("添加动作") { panel = .add }.buttonStyle(SpotterNativeButtonStyle(primary: true)) }
                                .frame(maxWidth: .infinity).padding(30).spotterCard()
                        }
                        if let error = store.errorMessage { Text(error).font(.system(size: 13)).foregroundStyle(.red) }
                    }.padding(14)
                }
                .task(id: entry.key) {
                    guard session.completedSets > 0, let next else { return }
                    revealSet(.init(move: next.move, row: next.row))
                }
                .onChange(of: store.undoableSet) { completed in
                    guard let completed, let session = store.active?.session else { return }
                    undoneSet = nil
                    guard let target = session.nextSet(after: completed),
                          completed.move != target.move,
                          autoAdvance || session.isInSameGroup(completed.move, target.move) else { return }
                    revealSet(target)
                }
                .task(id: setToReveal) {
                    guard let target = setToReveal else { return }
                    await Task.yield()
                    guard !Task.isCancelled, target == setToReveal, target.move == openedMove else { return }
                    withAnimation(motion) { scroll.scrollTo(target, anchor: .center) }
                    setToReveal = nil
                }
            }
            .background(SpotterPalette.background).clipShape(UnevenTopRoundedShape(radius: 23))
            ZStack(alignment: .bottom) {
                if let edit { keypad(edit, session: session).transition(.move(edge: .bottom).combined(with: .opacity)) }
                else {
                    actionBar(session)
                        .transition(.opacity)
                }
            }
            .animation(motion, value: edit != nil)
        }.background(SpotterPalette.wash).toolbar(.hidden, for: .navigationBar)
    }

    private func editorHeader(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                HStack(spacing: 7) {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text(NativeWorkoutView.duration(session.elapsedMilliseconds(at: Int(context.date.timeIntervalSince1970 * 1000))))
                            .font(.system(size: 43, weight: .heavy)).tracking(-2).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.65)
                    }
                    .accessibilityIdentifier("workout-elapsed")
                    Button { store.toggleClock() } label: {
                        Image(systemName: session.isRunning ? "pause.fill" : "play.fill").font(.system(size: 16))
                            .frame(width: 44, height: 44)
                            .background(SpotterPalette.card, in: Circle())
                            .contentShape(Rectangle())
                    }
                        .buttonStyle(.spotterPress)
                        .disabled(store.isBusy)
                        .accessibilityLabel(session.isRunning ? "暂停计时" : "继续计时")
                        .accessibilityIdentifier("workout-clock-toggle")
                }
                Spacer(minLength: 5)
                Button(action: undoLatestSet) {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .background(SpotterPalette.card.opacity(0.8), in: Circle())
                        .contentShape(Rectangle())
                }
                .buttonStyle(.spotterPress)
                .opacity(store.undoableSet == nil ? 0.4 : 1)
                .disabled(store.undoableSet == nil || store.isBusy || edit != nil)
                .accessibilityLabel("撤销上一组")
                .accessibilityIdentifier("workout-undo-set")
                Button(store.isBusy ? "正在保存" : "结束训练") { finish(entry) }
                    .font(.system(size: 14, weight: .bold)).buttonStyle(SpotterNativeButtonStyle(primary: true))
                    .fixedSize(horizontal: true, vertical: false)
                    .disabled(store.isBusy || edit != nil)
                    .accessibilityIdentifier("workout-finish")
            }
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(session.plan.category).font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                        syncIndicator
                        if #available(iOS 17.0, *) {
                            NativeWatchWorkoutBPM(context: watchContext(entry, session: session))
                        }
                    }
                    if session.raw["planId"].string.isEmpty {
                        HStack(spacing: 5) {
                            Image(systemName: "pencil.line").font(.system(size: 15)).foregroundStyle(SpotterPalette.muted)
                            TextField("输入训练标题", text: Binding(get: { session.plan.title == "自由训练" ? "" : session.plan.title }, set: { value in store.mutate { $0.raw["plan"]["title"] = .string(value.trimmingCharacters(in: .whitespaces).isEmpty ? "自由训练" : String(value.prefix(100))) } }))
                                .font(.system(size: 16, weight: .bold))
                        }.padding(.horizontal, 9).padding(.vertical, 7).background(SpotterPalette.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                    } else {
                        Text(entry.title).font(.system(size: 18, weight: .bold))
                    }
                }
                Spacer(minLength: 0)
                if let cardio = session.cardioActivity {
                    Image(systemName: cardio.symbol).font(.title3).foregroundStyle(SpotterPalette.muted)
                        .accessibilityHidden(true)
                } else {
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("\(session.completedSets)/\(session.totalSets) 组").font(.system(size: 14, weight: .bold))
                        Text("\(session.volumeKg.formatted(.number.precision(.fractionLength(0...1)))) kg 容量").font(.system(size: 11)).foregroundStyle(SpotterPalette.muted)
                    }
                }
            }
            if session.raw["rest"] != .null { restTimer(session) }
        }.padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)
    }

    private func watchContext(_ entry: NativeWorkoutEntry, session: NativeWorkoutSession) -> NativeWatchWorkoutContext {
        .init(owner: store.owner, workoutID: entry.id, isRunning: session.isRunning)
    }

    private var syncIndicator: some View {
        let status = store.draftSyncStatus
        return Button { panel = .sync } label: {
            Image(systemName: status.icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(store.syncProblem != nil || status == .localSaveFailed ? .red : SpotterPalette.muted)
                .frame(minWidth: 30, minHeight: 26)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityLabel(status.title)
        .accessibilityHint("查看训练同步状态")
        .accessibilityIdentifier("workout-sync-status")
    }

    private var syncPanel: some View {
        Form {
            NativeWorkoutSyncLabel(status: store.draftSyncStatus)
            if let problem = store.syncProblem { Text(problem).font(.footnote) }
            if store.draftSyncStatus != .synced, store.networkAvailable != false {
                Button("重试") { Task { await store.syncLocalChanges() } }
                    .disabled(store.isSyncing)
            }
        }
        .navigationTitle("训练同步").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { panel = nil } } }
    }

    private func restTimer(_ session: NativeWorkoutSession) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            if let rest = session.restStatus(at: Int(context.date.timeIntervalSince1970 * 1_000)) {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 4) {
                        restSummary(rest).fixedSize(horizontal: true, vertical: false)
                        Spacer(minLength: 0)
                        restControls(rest)
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        restSummary(rest)
                        restControls(rest)
                    }
                }
                .onAppear { lastRestRemaining = rest.remainingSeconds }
                .onChange(of: rest.remainingSeconds) { remaining in
                    if (lastRestRemaining ?? 0) > 0, remaining == 0, phase == .active {
                        if restSound { AudioServicesPlaySystemSound(1057) }
                        if restHaptics { UINotificationFeedbackGenerator().notificationOccurred(.success) }
                    }
                    lastRestRemaining = remaining
                }
            }
        }
    }

    private func restSummary(_ rest: NativeWorkoutSession.RestStatus) -> some View {
        HStack(spacing: 6) {
            Text(rest.remainingSeconds > 0 ? rest.kind : "休息结束").font(.caption.weight(.semibold))
            if rest.remainingSeconds > 0 {
                Text(NativeWorkoutView.duration(rest.remainingSeconds * 1_000))
                    .font(.subheadline.bold()).monospacedDigit().contentTransition(.numericText(countsDown: true))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rest.remainingSeconds > 0 ? rest.kind : "休息结束")
        .accessibilityValue(rest.remainingSeconds > 0 ? "剩余 \(rest.remainingSeconds) 秒" : "")
        .accessibilityAddTraits(.updatesFrequently)
        .accessibilityIdentifier("workout-rest-summary")
    }

    private func restControls(_ rest: NativeWorkoutSession.RestStatus) -> some View {
        HStack(spacing: 4) {
            restButton("−15 秒") { store.mutate { $0.adjustRest(by: -15) } }
                .disabled(rest.remainingSeconds == 0)
                .accessibilityLabel("减少休息 15 秒")
                .accessibilityIdentifier("workout-rest-less")
            restButton("+15 秒") { store.mutate { $0.adjustRest(by: 15) } }
                .disabled(rest.remainingSeconds >= NativeWorkoutSession.maximumRestSeconds)
                .accessibilityLabel("增加休息 15 秒")
                .accessibilityIdentifier("workout-rest-more")
            restButton(rest.remainingSeconds > 0 ? "跳过" : "关闭") { store.mutate { $0.clearRest() } }
                .accessibilityLabel(rest.remainingSeconds > 0 ? "跳过休息" : "关闭休息计时")
                .accessibilityIdentifier("workout-rest-skip")
        }
        .disabled(store.isBusy)
    }

    private func restButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.caption.weight(.semibold))
                .padding(.horizontal, 8).frame(minHeight: 26)
                .background(SpotterPalette.card.opacity(0.8), in: Capsule())
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }.buttonStyle(.spotterPress)
    }

    private func exerciseCard(_ index: Int, move: NativeJSON, session: NativeWorkoutSession, nextRow: Int?) -> some View {
        let rows = session.rows.indices.contains(index) ? session.rows[index] : []
        return VStack(alignment: .leading, spacing: 4) {
            Button { withAnimation(motion) { openedMove = openedMove == index ? -1 : index; edit = nil } } label: {
                HStack(spacing: 9) {
                    Text(move["sourceSlot"].string.isEmpty ? "\(index + 1)" : move["sourceSlot"].string).font(.system(size: 13, weight: .bold)).frame(width: 34, height: 30).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 8))
                    Text(move["name"].string).font(.system(size: 16, weight: .bold)).multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Text("\(rows.filter { $0["done"].bool }.count)/\(rows.count) 组")
                        .font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        .monospacedDigit().fixedSize()
                    Image(systemName: "chevron.down").font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
                        .rotationEffect(.degrees(openedMove == index ? 180 : 0))
                }
            }.buttonStyle(.spotterPress)
                .accessibilityValue(openedMove == index ? "已展开" : "已收起")
            exerciseSummary(index, move: move, category: session.plan.category)
            if openedMove == index {
                let warmup = NativeExerciseLabel(move).warmup
                let previous = exerciseHistory.matching(.init(move)).first {
                    $0.isTimed == (move["seconds"].number > 0) &&
                        $0.warmup == warmup
                }
                let reference = previous.map { NativeExerciseHistory.previousRows(for: rows, from: $0, move: move) }
                let suggestion = session.plan.category == "力量训练" ? exerciseHistory.increase(for: move) : nil
                VStack(alignment: .leading, spacing: 8) {
                    if !move["cue"].string.isEmpty { Text(move["cue"].string).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted) }
                    if let previous, let reference, zip(rows, reference).contains(where: { row, source in
                        source.map { NativeExerciseHistory.copied(row, from: $0, record: previous, move: move) != row } ?? false
                    }) {
                        reuseButton(index, move: move, record: previous).buttonStyle(.spotterControl)
                    }
                    if let suggestion { progressionButton(index, move: move, rows: rows, suggestion: suggestion) }
                    ForEach(Array(rows.enumerated()), id: \.offset) { row, line in
                        setRow(index, row: row, move: move, line: line,
                               previous: reference?[row], previousUnit: previous?.unit, isNext: row == nextRow)
                            .id(NativeWorkoutSession.SetPosition(move: index, row: row))
                    }
                    Button { withAnimation(motion) { store.mutate { $0.addSet(move: index) } } } label: { Label("增加一组", systemImage: "plus").font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity) }
                        .buttonStyle(SpotterNativeButtonStyle(primary: false)).disabled((session.rows.indices.contains(index) ? session.rows[index].count : 30) >= 30)
                }.transition(.offset(y: -5).combined(with: .opacity))
            }
        }.padding(12).spotterCard()
    }

    private func exerciseSummary(_ index: Int, move: NativeJSON, category: String) -> some View {
        let summary = HStack(spacing: 6) {
            Text(prescription(move)).font(.system(size: 13)).foregroundStyle(SpotterPalette.muted)
            if showTempo, let tempo = NativeExerciseTempo.display(move, category: category) {
                Text(tempo.prescribed ? tempo.value : "建议 \(tempo.value)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(accent.tint)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(SpotterPalette.wash, in: Capsule())
                    .fixedSize()
                    .accessibilityLabel(tempo.accessibilityDescription)
                    .accessibilityIdentifier("workout-exercise-tempo-\(index)")
            }
        }
        let demonstration = Button {
            edit = nil
            panelMove = move
            panel = .demonstration
        } label: {
            Label("动作演示", systemImage: "play.rectangle")
                .font(.caption2.weight(.semibold)).fixedSize()
                .padding(.horizontal, 8)
                .frame(height: 25)
                .background(SpotterPalette.background, in: Capsule())
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.spotterPress)
        .accessibilityIdentifier("workout-exercise-demonstration-\(index)")
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) {
                summary.fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: 0)
                demonstration
            }
            VStack(alignment: .leading, spacing: 0) {
                summary
                demonstration.frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    private func reuseButton(_ index: Int, move: NativeJSON, record: NativeExerciseHistory.Record) -> some View {
        Button {
            edit = nil
            changeExerciseRows(index, move: move) { rows in
                let sources = NativeExerciseHistory.previousRows(for: rows, from: record, move: move)
                return zip(rows, sources).map { row, previous in
                    previous.map { NativeExerciseHistory.copied(row, from: $0, record: record, move: move) } ?? row
                }
            }
            setFeedback.impactOccurred()
        } label: {
            Label("沿用上次", systemImage: "arrow.uturn.backward")
                .font(.caption.weight(.semibold))
        }
        .disabled(store.isBusy)
        .accessibilityIdentifier("workout-reuse-exercise")
        .accessibilityHint("填入对应的未完成组，可以继续编辑")
    }

    @ViewBuilder private func progressionButton(_ index: Int, move: NativeJSON, rows: [NativeJSON],
                                                suggestion: NativeExerciseHistory.Increase) -> some View {
        if rows.contains(where: { NativeExerciseHistory.withIncrease($0, suggestion: suggestion) != $0 }) {
            let unit = NativeExerciseHistory.unit(of: move)
            let display = suggestion.rightWeight.map { "左 \(suggestion.weight.formatted()) · 右 \($0.formatted()) \(unit)" }
                ?? "\(suggestion.weight.formatted()) \(unit)"
            HStack(alignment: .center, spacing: 7) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("连续两次达到目标").font(.caption.weight(.semibold))
                    Text("建议试 \(display)").font(.caption).foregroundStyle(SpotterPalette.muted)
                }
                Spacer(minLength: 0)
                Button("采用重量") {
                    edit = nil
                    changeExerciseRows(index, move: move) { $0.map { NativeExerciseHistory.withIncrease($0, suggestion: suggestion) } }
                    setFeedback.impactOccurred()
                }
                .buttonStyle(.spotterControl)
                .font(.caption.weight(.semibold))
                .disabled(store.isBusy)
                .accessibilityIdentifier("workout-adopt-exercise-load")
            }
            .padding(9).background(SpotterPalette.wash, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private func changeExerciseRows(_ index: Int, move: NativeJSON, transform: ([NativeJSON]) -> [NativeJSON]) {
        store.mutate { session in
            var rows = session.rows
            guard rows.indices.contains(index), session.plan.exercises.indices.contains(index),
                  session.plan.exercises[index] == move else { return }
            let updated = transform(rows[index])
            guard updated != rows[index] else { return }
            rows[index] = updated
            session.raw["rows"] = .array(rows.map(NativeJSON.array))
        }
    }

    private func setRow(_ moveIndex: Int, row: Int, move: NativeJSON, line: NativeJSON,
                        previous: NativeJSON?, previousUnit: String?, isNext: Bool) -> some View {
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
                if let previous, let previousUnit {
                    Text("上次 " + NativeExerciseHistory.amount(previous, unit: previousUnit, showEffort: showEffort))
                        .font(.caption2)
                        .foregroundStyle(SpotterPalette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            Button { toggleDone(move: moveIndex, row: row) } label: {
                Image(systemName: line["done"].bool ? "checkmark.circle.fill" : "circle").font(.system(size: 24, weight: .medium)).frame(width: 38, height: 50)
                    .foregroundStyle(line["done"].bool ? SpotterPalette.accent : SpotterPalette.muted.opacity(0.55))
                    .scaleEffect(line["done"].bool ? 1.08 : 1)
            }
            .buttonStyle(.spotterPress)
            .accessibilityLabel("标记第\(row + 1)组\(line["done"].bool ? "未完成" : "完成")")
            .accessibilityHint(isNext ? "下一组" : "")
        }
        .padding(7)
        .background(line["done"].bool ? SpotterPalette.wash : SpotterPalette.background, in: RoundedRectangle(cornerRadius: 11))
        .overlay {
            if isNext {
                RoundedRectangle(cornerRadius: 11).strokeBorder(accent.tint.opacity(0.55)).allowsHitTesting(false)
            }
        }
        .animation(motion, value: line["done"].bool)
    }

    private func toggleDone(move: Int, row: Int) {
        edit = nil
        guard store.toggleDone(move: move, row: row) else { return }
        setFeedback.impactOccurred()
    }

    private func undoLatestSet() {
        guard let position = store.undoLastCompletedSet() else { return }
        setFeedback.impactOccurred()
        edit = nil
        undoneSet = position
        revealSet(position)
    }

    private func revealSet(_ position: NativeWorkoutSession.SetPosition) {
        withAnimation(motion) {
            openedMove = position.move
            setToReveal = position
        }
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
            if session.cardioActivity == nil {
                Button { panel = .add } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
                        Text("加动作").font(.system(size: 10, weight: .bold)).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(SpotterChoiceStyle(selected: true, horizontalPadding: 1))
                .disabled(session.plan.exercises.count >= 30)
            }
            if #available(iOS 17.0, *) {
                footerAction("手表", symbol: "applewatch") { panel = .watch }
                    .accessibilityHint("连接 Apple Watch 并查看实时心率")
                    .accessibilityIdentifier("workout-watch")
            }
            footerAction("退出", symbol: "rectangle.portrait.and.arrow.right", action: exitWorkout)
                .disabled(store.isBusy)
                .accessibilityHint("暂停计时并返回")
                .accessibilityIdentifier("workout-exit")
        }
        .spotterGlassToolbar()
        .padding(.horizontal, 10).padding(.vertical, 5)
    }

    private func prompt(_ prompt: WorkoutPrompt, for draft: NativeWorkoutEntry) {
        workoutPrompt = (prompt, draft)
    }

    private func exitWorkout() {
        store.pauseClock()
        guard store.active?.session?.isRunning == false else { return }
        Task { await store.saveDraft() }
        dismiss()
    }

    private func footerAction(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 19))
                Text(title).font(.system(size: 10, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(SpotterChoiceStyle(selected: false, horizontalPadding: 1))
    }
    private func activate(_ target: NativeSetTarget, value: Double) { edit = target; editText = value.formatted(.number.grouping(.never).precision(.fractionLength(0...2))); pristine = true; openedMove = target.move }
    private func nextSet(_ session: NativeWorkoutSession) -> NativeSetTarget? {
        let reopened = undoneSet.flatMap { position in
            session.plan.exercises.indices.contains(position.move) && session.line(at: position)?["done"].bool == false
                ? position : nil
        }
        let position = reopened ?? session.nextSet(after: store.undoableSet)
        return position.map { NativeSetTarget(move: $0.move, row: $0.row, key: "weight") }
    }
    private func finish(_ entry: NativeWorkoutEntry) {
        store.pauseClock()
        guard store.active?.key == entry.key, let session = store.active?.session, !session.isRunning else { return }
        if !session.hasCheckinContent() {
            prompt(.empty, for: entry)
            return
        }
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

struct UnevenTopRoundedShape: Shape {
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
            NavigationLink {
                NativeWorkoutNotePanel(store: store)
            } label: {
                Label("训练心得", systemImage: "square.and.pencil")
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
    private struct PreviousMove: Identifiable, Sendable {
        let move: NativeJSON
        let set: NativeJSON
        var id: String { Self.identity(of: move) }

        var amount: String {
            if set["seconds"].number > 0 { return "\(Int(set["seconds"].number)) 秒" }
            let unit = move["unit"].string.isEmpty ? "kg" : move["unit"].string
            let left = "\(set["weight"].number.formatted()) \(unit) × \(Int(set["reps"].number))"
            if case .object = set["right"] {
                let right = set["right"]
                return "左 \(left) · 右 \(right["weight"].number.formatted()) \(unit) × \(Int(right["reps"].number))"
            }
            return left
        }

        static func name(_ move: NativeJSON) -> String {
            NativeExerciseLabel(move).name.precomposedStringWithCompatibilityMapping.lowercased()
        }

        static func identity(of move: NativeJSON) -> String {
            let id = move["catalogueId"].string
            return id.isEmpty ? "name:" + name(move) : "id:" + id
        }
    }

    @ObservedObject var store: NativeWorkoutStore
    var didAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage(NativeGymPreferences.storageKey) private var gyms = Data()
    @AppStorage(NativePreferenceKey.equipment) private var legacyGear = ""
    @State private var name = ""
    @State private var index: NativeCatalogIndex?
    @State private var catalogueFailed = false
    @State private var histories: [PreviousMove] = []
    @State private var matches: [NativeCatalogEntry] = []
    @State private var selection: NativeCatalogEntry?
    @State private var availableOnly = true
    private var query: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var configuredGear: Set<String> { NativeGymPreferences.read(gyms, legacy: legacyGear).catalogueGear }
    private var searchKey: String { query + "\n" + (availableOnly ? configuredGear.sorted().joined(separator: "|") : "") }

    var body: some View {
        List {
            Section {
                TextField("搜索动作名称", text: $name)
                    .autocorrectionDisabled()
                if !configuredGear.isEmpty {
                    Toggle("只看可用器械", isOn: $availableOnly)
                }
            }
            if query.isEmpty, !histories.isEmpty {
                Section("最近练过") {
                    ForEach(Array(histories.prefix(8))) { previous in
                        Button {
                            add(NativePreferenceKey.newMove(name: NativeExerciseLabel(previous.move).name), previous: previous)
                        } label: {
                            row(NativeExerciseLabel(previous.move).name, detail: "上次 \(previous.amount)", action: "沿用")
                        }.buttonStyle(.spotterPress)
                    }
                }
            }
            if let selection {
                let move = NativeCataloguePlanMove.planMove(selection)
                Section(selection.name) {
                    if let previous = previous(for: move) {
                        Button { add(move, previous: previous) } label: {
                            row("沿用上次记录", detail: previous.amount, action: "添加")
                        }.buttonStyle(.spotterPress)
                    }
                    Button { add(move) } label: {
                        row("使用默认组数", detail: prescription(move), action: "添加")
                    }.buttonStyle(.spotterPress)
                }
            }
            if !matches.isEmpty {
                Section(query.isEmpty ? "推荐动作" : "搜索结果") {
                    ForEach(matches) { entry in
                        Button { selection = entry } label: {
                            let prior = previous(for: NativeCataloguePlanMove.planMove(entry))
                            row(entry.name, detail: prior.map { "上次 \($0.amount)" } ?? index?.label(entry.equipment) ?? "", action: "选择")
                        }.buttonStyle(.spotterPress)
                    }
                }
            } else if catalogueFailed {
                Section { Text("动作库暂不可用，可以输入动作名称添加。").font(.footnote).foregroundStyle(SpotterPalette.muted) }
            } else if index == nil {
                Section { ProgressView("正在读取动作库") }
            }
            if !query.isEmpty {
                Section {
                    Button {
                        add(NativePreferenceKey.newMove(name: String(query.prefix(100))))
                    } label: {
                        Label("添加手输动作「\(query)」", systemImage: "plus")
                    }.buttonStyle(.spotterPress)
                }
            }
        }
        .scrollContentBackground(.hidden).background(SpotterPalette.background)
        .navigationTitle("添加动作").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
        .task {
            let recent = Array(store.logs.prefix(60))
            histories = await Task.detached(priority: .userInitiated) { Self.prepareHistory(recent) }.value
            do { index = try await NativeCatalogIndex.bundled.value }
            catch { catalogueFailed = true }
        }
        .task(id: searchKey + (index == nil ? "" : "#")) { await search() }
        .onChange(of: name) { _ in selection = nil }
    }

    private func row(_ title: String, detail: String, action: String) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SpotterPalette.ink)
                if !detail.isEmpty { Text(detail).font(.caption).foregroundStyle(SpotterPalette.muted) }
            }.multilineTextAlignment(.leading)
            Spacer(minLength: 5)
            Text(action).font(.footnote.weight(.semibold)).foregroundStyle(SpotterPalette.accent)
        }.frame(minHeight: 44).contentShape(Rectangle())
    }

    nonisolated private static func prepareHistory(_ logs: [NativeWorkoutEntry]) -> [PreviousMove] {
        var seen: Set<String> = []
        return logs.flatMap { record -> [PreviousMove] in
            guard let session = record.session else { return [] }
            let rows = session.rows
            return session.plan.exercises.enumerated().compactMap { index, move in
                guard !NativeExerciseLabel(move).warmup, rows.indices.contains(index),
                      let set = rows[index].last(where: { $0["done"].bool && $0["kind"].string.isEmpty }),
                      seen.insert(PreviousMove.identity(of: move)).inserted else { return nil }
                return PreviousMove(move: move, set: set)
            }
        }
    }

    private func previous(for move: NativeJSON) -> PreviousMove? {
        let identity = PreviousMove.identity(of: move)
        if !move["catalogueId"].string.isEmpty, let match = histories.first(where: { $0.id == identity }) { return match }
        let named = histories.filter { PreviousMove.name($0.move) == PreviousMove.name(move) }
        return named.contains(where: { !$0.move["catalogueId"].string.isEmpty }) ? nil : named.first
    }

    private func search() async {
        guard let index else { return }
        let query = self.query
        let gear = availableOnly ? configuredGear : []
        let frequent = Set(histories.map { NativeExerciseLabel($0.move).name })
        if !query.isEmpty { try? await Task.sleep(for: .milliseconds(100)) }
        guard !Task.isCancelled else { return }
        let result = await Task.detached(priority: .userInitiated) {
            let result = index.results(query: query, gear: gear, frequent: frequent)
            return Array((query.isEmpty && !result.featured.isEmpty ? result.featured : result.sections.flatMap(\.rows)).prefix(30))
        }.value
        if !Task.isCancelled { matches = result }
    }

    private func add(_ entry: NativeJSON, previous: PreviousMove? = nil) {
        guard let active = store.active?.session, active.plan.exercises.count < 30 else { return }
        var move = entry
        if let previous {
            move["unit"] = previous.move["unit"]
            move["weight"] = previous.set["weight"]
            move["reps"] = previous.set["reps"]
            move["seconds"] = previous.set["seconds"]
            if move["catalogueId"] == .null, previous.move["catalogueId"] != .null { move["catalogueId"] = previous.move["catalogueId"] }
        }
        store.mutate { $0.addExercise(move, previousSet: previous?.set) }
        didAdd()
        dismiss()
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
    let activity: NativeWorkoutSession.CardioActivity
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(activity.title).font(.headline)
            Text("结束时自动使用本次计时。也可以手动填写实际时长。").font(.footnote).foregroundStyle(SpotterPalette.muted)
            cardioDuration
            if activity.tracksDistance {
                HStack {
                    cardioNumber("距离 km", key: "distanceKm", maximum: 500)
                    cardioNumber("速度 km/h", key: "speedKmh", maximum: activity.maximumSpeedKmh)
                }
            }
        }.padding(14).spotterCard()
    }

    private var cardioDuration: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("实际时长（秒）").font(.caption).foregroundStyle(SpotterPalette.muted)
            TextField("使用本次计时", value: Binding(
                get: {
                    guard let cardio = store.active?.data["cardio"], case .number(let seconds) = cardio["durationSeconds"] else { return nil }
                    return Int(seconds)
                },
                set: { (value: Int?) in
                    store.mutate { session in
                        var cardio = session.raw["cardio"].object
                        if let value, value > 0 { cardio["durationSeconds"] = .number(Double(min(43_200, value))) }
                        else { cardio.removeValue(forKey: "durationSeconds") }
                        session.raw["cardio"] = .object(cardio)
                    }
                }), format: .number.grouping(.never))
                .keyboardType(.numberPad).padding(10).background(SpotterPalette.background, in: RoundedRectangle(cornerRadius: 9))
        }
    }
    private func cardioNumber(_ label: String, key: String, maximum: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 12)).foregroundStyle(SpotterPalette.muted)
            TextField("可不填", value: Binding<Double?>(get: {
                guard case .number(let value) = store.active?.data["cardio"][key] else { return nil }
                return value
            }, set: { value in
                store.mutate { session in
                    var cardio = session.raw["cardio"].object
                    cardio[key] = value.flatMap { $0.isFinite ? .number(max(0, min(maximum, $0))) : nil }
                    session.raw["cardio"] = .object(cardio)
                }
            }), format: .number.precision(.fractionLength(0...2)))
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
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @EnvironmentObject private var remarks: NativeSocialRemarks
    @State private var action: Action?
    @State private var templateDraft: NativePlanDraft?
    @State private var savingProtein = false
    @State private var notice: String?

    private enum Action: String, Identifiable {
        case share, edit
        var id: Self { self }
    }

    private var own: Bool { entry.owner == store.owner }
    private var current: NativeWorkoutEntry? {
        (own ? store.logs : store.partnerLogs).first { $0.key == entry.key }
    }
    private var pending: Bool { own && store.pendingCheckins.contains { $0.id == entry.id } }
    private var scrollsActions: Bool { textSize.isAccessibilitySize || verticalSizeClass == .compact }

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
                        if own {
                            HStack {
                                NativeWorkoutSyncLabel(status: store.checkinSyncStatus(id: entry.id))
                                Spacer(minLength: 8)
                                if pending, store.networkAvailable != false, !store.isSyncing {
                                    Button("重试同步") { Task { await store.syncLocalChanges() } }
                                        .buttonStyle(.spotterControl)
                                }
                            }
                        }
                        if own {
                            NativeHeartView(api: store.api, owner: store.owner, entry: current, isPending: pending)
                        }
                        if !session.plan.exercises.isEmpty {
                            Text("训练动作").font(.headline).accessibilityAddTraits(.isHeader)
                            ForEach(Array(session.plan.exercises.enumerated()), id: \.offset) { index, move in
                                exercise(move, rows: session.rows.indices.contains(index) ? session.rows[index] : [])
                            }
                        }
                        if session.completedSets > 0 {
                            SpotterDisclosure("肌群分布") {
                                SecondaryMusclePanel(entries: [current], subjectFigure: store.anatomyVariant(for: current.owner),
                                                     participationOnly: true).padding(.top, 8)
                            }.font(.subheadline.weight(.semibold)).padding(14).spotterCard()
                        }
                        if own && scrollsActions { actions(session, inset: false) }
                    }.padding(14)
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if own && !scrollsActions { actions(session) }
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
                    NativeWorkoutShareView(entry: current, logs: store.logs, owner: store.owner, displayName: store.viewerName,
                                           api: store.api, subjectFigure: store.anatomyVariant(for: current.owner))
                case .edit:
                    NavigationStack { NativeWorkoutLogEditor(entry: current, store: store) }
                        .presentationDragIndicator(.visible)
                }
            }
        }
        .fullScreenCover(item: $templateDraft) { draft in
            NavigationStack { NativePlanEditorPanel(store: store, draft: draft) { _ in actionSaved() } }
        }
    }

    private func actionSaved() { notice = "已另存为个人模板" }

    private func actions(_ session: NativeWorkoutSession, inset: Bool = true) -> some View {
        VStack(spacing: 7) {
            if let notice { Text(notice).font(.footnote).foregroundStyle(SpotterPalette.muted) }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 5) { actionButtons(session, singleLine: true) }
                VStack(alignment: .leading, spacing: 6) { actionButtons(session, singleLine: false) }
            }
            .spotterGlassToolbar()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, inset ? 14 : 0)
        .padding(.vertical, 9)
    }

    @ViewBuilder private func actionButtons(_ session: NativeWorkoutSession, singleLine: Bool) -> some View {
        if !pending {
            Button { action = .edit } label: {
                Label("编辑记录", systemImage: "pencil").fixedSize(horizontal: singleLine, vertical: true)
            }
                .buttonStyle(.spotterControl)
            if session.raw["cardio"] == .null && (!session.plan.exercises.isEmpty || !session.plan.video.isEmpty) {
                Button { templateDraft = NativePlanDraft(copying: session.plan) } label: {
                    Label("另存为模板", systemImage: "bookmark").fixedSize(horizontal: singleLine, vertical: true)
                }
                    .buttonStyle(.spotterControl)
            }
        }
        Button { action = .share } label: {
            Label("分享训练", systemImage: "square.and.arrow.up").font(.subheadline.weight(.bold))
                .fixedSize(horizontal: singleLine, vertical: true)
        }
            .buttonStyle(.spotterPrimaryControl)
    }

    private func overview(_ current: NativeWorkoutEntry, session: NativeWorkoutSession) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(current.displayTitle).font(.system(.title, weight: .heavy)).accessibilityAddTraits(.isHeader)
            Text([shortDay(current.day), session.plan.weekDay, session.plan.category,
                  own ? "" : remarks.name(for: current.owner, fallback: store.partnerName)]
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
                        SpotterMenu {
                            ForEach(Array(products.enumerated()), id: \.offset) { _, choice in
                                Button(choice["name"].string) { setProtein(choice, on: current) }
                            }
                            if checked {
                                Button("取消本次蛋白粉记录", role: .destructive) { setProtein(nil, on: current) }
                            }
                        } label: { Label("修改", systemImage: "chevron.down") }.disabled(savingProtein)
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
                Spacer(minLength: 0)
                if own {
                    NavigationLink {
                        NativeExerciseProgressView(store: store, move: move, startsWithStats: true)
                    } label: {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(SpotterPalette.accent)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.spotterPress)
                    .accessibilityLabel("查看 \(NativeExerciseLabel(move).name) 的动作进步")
                }
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
    @Environment(\.spotterInteractionMotion) private var motion
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
                        SpotterDisclosure(move["name"].string) { exerciseFields(at: index, move: move) }
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
            if session.cardioActivity?.tracksDistance != false {
                cardioNumber("距离（km）", key: "distanceKm", range: 0...500)
                cardioNumber("速度（km/h）", key: "speedKmh", range: 0...(session.cardioActivity?.maximumSpeedKmh ?? 50))
            }
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
                        withAnimation(motion) { removeSet(move: index, row: position) }
                    } label: { Image(systemName: "trash").padding(6) }
                        .buttonStyle(.spotterPress).foregroundStyle(.red).accessibilityLabel("移除第 \(position + 1) 组")
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
                withAnimation(motion) {
                    session.addSet(move: index)
                    session.setLine(move: index, row: rows.count, key: "done", value: .bool(true))
                }
            } label: { Label("加一组", systemImage: "plus.circle") }
                .buttonStyle(.spotterControl).disabled(rows.count >= 30).padding(.top, 5)
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

func nativePlanDate(_ day: String) -> Date? {
    let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = .current
    formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: day)
}
