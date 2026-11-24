import Foundation
import Combine

@MainActor
final class HealthSyncCoordinator: ObservableObject {
    let session: AppSession
    @Published var selectedRaw: String { didSet { UserDefaults.standard.set(selectedRaw, forKey: "healthSelectedTypes") } }
    @Published var rangeDays: Int { didSet { UserDefaults.standard.set(rangeDays, forKey: "healthRangeDays") } }
    @Published var customStartEpoch: Double { didSet { UserDefaults.standard.set(customStartEpoch, forKey: "healthCustomStart") } }
    @Published var customEndEpoch: Double { didSet { UserDefaults.standard.set(customEndEpoch, forKey: "healthCustomEnd") } }
    @Published var code = ""
    @Published var showDisconnect = false
    @Published var showPairing = false
    @Published private(set) var connection = DeviceKeychain.load()
    @Published private(set) var message = ""
    @Published private(set) var busy = false
    @Published private(set) var lastSync: Date?
    private let health = HealthKitReader()
    private let api = BridgeClient()
    private var syncTask: Task<Void, Never>?
    private var lastObservedAccount: ExpectedHealthAccount?
    private var subscriptions = Set<AnyCancellable>()

    init(session: AppSession) {
        self.session = session
        let defaults = UserDefaults.standard
        selectedRaw = defaults.string(forKey: "healthSelectedTypes") ?? HealthSelection.heartRate.rawValue
        rangeDays = defaults.object(forKey: "healthRangeDays") as? Int ?? 14
        customStartEpoch = defaults.object(forKey: "healthCustomStart") as? Double ?? (Calendar.current.date(byAdding: .day, value: -13, to: Date()) ?? Date()).timeIntervalSince1970
        customEndEpoch = defaults.object(forKey: "healthCustomEnd") as? Double ?? Date().timeIntervalSince1970
        session.$healthAccount.dropFirst().sink { [weak self] account in
            self?.accountChanged(account)
        }.store(in: &subscriptions)
        if let account = session.healthAccount { accountChanged(account) }
    }

    var selected: Set<HealthSelection> {
        Set(selectedRaw.split(separator: ",").compactMap { HealthSelection(rawValue: String($0)) })
    }

    private func accountChanged(_ account: ExpectedHealthAccount?) {
        syncTask?.cancel()
        guard let account else {
            message = "正在确认当前训练账号，健康同步已暂停。"
            return
        }
        if let previous = lastObservedAccount, previous != account {
            selectedRaw = HealthSelection.heartRate.rawValue
            lastSync = nil
            code = ""
        }
        lastObservedAccount = account
        if connection == nil {
            message = "当前训练账号已确认。生成配对码后可连接 Apple 健康。"
        } else if selected.isEmpty {
            message = "当前未选择健康数据，可在此逐项开启同步。"
        }
        scheduleSync()
    }

    func select(_ type: HealthSelection, enabled: Bool) async {
        guard !busy, let expected = session.healthAccount else { return }
        let revision = session.identityRevision
        if enabled {
            busy = true
            defer { busy = false }
            do {
                try await confirmCurrentAccount(expected, revision: revision)
                try await health.authorize(type)
                try ensureCurrentAccount(expected, revision: revision)
            }
            catch { message = error.localizedDescription; return }
        }
        var types = selected
        if enabled { types.insert(type) } else { types.remove(type) }
        selectedRaw = types.map(\.rawValue).sorted().joined(separator: ",")
        message = enabled ? "已选定" + type.title + "。是否可读取以系统权限和实际样本为准。" : "已停止同步" + type.title + "。"
    }

    func connect() async {
        guard !busy, let expected = session.healthAccount else { return }
        let revision = session.identityRevision
        busy = true
        message = ""
        let previous = connection
        do {
            try await confirmCurrentAccount(expected, revision: revision)
            let paired = try await BridgeClient.pair(origin: expected.origin, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
            do {
                try ensureCurrentAccount(expected, revision: revision)
                let owner = try await api.deviceOwner(paired)
                try ensureCurrentAccount(expected, revision: revision)
                guard HealthAccountGate.permits(expected: expected, connection: paired, deviceOwner: owner) else {
                    throw HealthAccountError.mismatch
                }
            } catch {
                try? await api.disconnect(paired)
                throw error
            }
            try DeviceKeychain.save(paired)
            connection = paired
            selectedRaw = HealthSelection.heartRate.rawValue
            rangeDays = 14
            lastSync = nil
            code = ""
            showPairing = false
            if let previous { try? await api.disconnect(previous) }
            try ensureCurrentAccount(expected, revision: revision)
            try await health.authorize(.heartRate)
        } catch BridgeError.server(404, _) {
            message = "当前网站尚未开通 App 原生健康同步。现有训练记录可继续使用。"
        } catch { message = error.localizedDescription }
        busy = false
        if connection != nil && !showPairing { scheduleSync() }
    }

    private func range() throws -> (Date, Date, Calendar) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let now = Date()
        let from = calendar.startOfDay(for: rangeDays == 0 ? Date(timeIntervalSince1970: customStartEpoch) : calendar.date(byAdding: .day, value: -(rangeDays - 1), to: now)!)
        let requestedEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: Date(timeIntervalSince1970: customEndEpoch)))!
        let to = rangeDays == 0 ? min(requestedEnd, now) : now
        let latestEnd = calendar.date(byAdding: .day, value: 365, to: from)!
        guard from < to, from <= now, to <= latestEnd, to.timeIntervalSince(from) <= 366 * 86_400 else { throw HealthError.range }
        return (from, to, calendar)
    }

    private func sync(askPermission: Bool = false) async {
        guard !busy, let connection, !selected.isEmpty, !showPairing else { return }
        guard let expected = session.healthAccount else {
            message = "请先在训练页面登录，健康同步已暂停。"
            return
        }
        let revision = session.identityRevision
        busy = true
        defer { busy = false }
        var saved = 0
        var skipped = 0
        var empty = 0
        var heartWindows = 0
        var received = Set<HealthSelection>()
        do {
            try await confirmCurrentAccount(expected, revision: revision)
            guard try BridgeClient.origin(connection.origin) == BridgeClient.origin(expected.origin) else {
                throw HealthAccountError.mismatch
            }
            let owner = try await api.deviceOwner(connection)
            try ensureCurrentAccount(expected, revision: revision)
            guard HealthAccountGate.permits(expected: expected, connection: connection, deviceOwner: owner) else {
                throw HealthAccountError.mismatch
            }
            let (from, to, calendar) = try range()
            let types = selected
            if askPermission {
                for type in HealthSelection.allCases where types.contains(type) {
                    try ensureCurrentAccount(expected, revision: revision)
                    try await health.authorize(type)
                }
            }
            if types.contains(.heartRate) {
                var cursor: String?
                var seen = Set<String>()
                repeat {
                    try ensureCurrentAccount(expected, revision: revision)
                    let page = try await api.workouts(connection, from: from, to: to, cursor: cursor)
                    for workout in page.workouts where workout.start >= from && workout.end <= to {
                        try ensureCurrentAccount(expected, revision: revision)
                        heartWindows += 1
                        guard let payload = try await health.read(workout) else { empty += 1; continue }
                        try await confirmCurrentAccount(expected, revision: revision)
                        received.insert(.heartRate)
                        if try await api.save(payload, id: workout.id, using: connection) { saved += 1 } else { skipped += 1 }
                    }
                    cursor = page.nextCursor
                    if let cursor, !seen.insert(cursor).inserted { throw BridgeError.badResponse }
                } while cursor != nil
            }
            if !types.subtracting([.heartRate]).isEmpty {
                var position = from
                var first = true
                while position < to {
                    try ensureCurrentAccount(expected, revision: revision)
                    // Seven-day overlap carries long/cross-midnight workouts across batch boundaries.
                    // Thirty local days also leave room for the extra DST hour in the server's 31-day limit.
                    let start = first ? from : max(from, calendar.date(byAdding: .day, value: -7, to: position)!)
                    let end = min(to, calendar.date(byAdding: .day, value: 23, to: position)!)
                    let payload = try await health.records(selected: types, from: start, to: end, calendar: calendar)
                    try await confirmCurrentAccount(expected, revision: revision)
                    if payload.count == 0 { empty += 1 }
                    received.formUnion(payload.received)
                    let result = try await api.save(payload, using: connection)
                    saved += result.saved
                    skipped += result.skipped
                    position = end
                    first = false
                }
            }
            try await confirmCurrentAccount(expected, revision: revision)
            try await api.report(connection, from: from, to: to, saved: saved, skipped: skipped,
                                 empty: received.isEmpty, selected: types, received: received)
            lastSync = Date()
            message = "同步完成：更新 " + String(saved) + " 项，跳过 " + String(skipped) + " 项。"
            if types.contains(.heartRate) && heartWindows == 0 {
                message += " 所选范围内没有可匹配的已完成训练时段，请先在网页打卡或调整日期范围。"
            }
            let missing = types.subtracting(received)
            if !missing.isEmpty {
                message += " 未读到：" + HealthSelection.allCases.filter { missing.contains($0) }.map(\.title).joined(separator: "、") + "。请检查 Apple 健康读取权限、日期范围和手表到 iPhone 的同步。"
            } else if empty > 0 {
                message += " 部分历史时段没有样本，可检查权限和时间范围后补同步。"
            }
        } catch is CancellationError {
            message = "健康同步已暂停。请确认当前训练账号后重试。"
        } catch let error as URLError where error.code == .cancelled {
            message = "健康同步已暂停。请确认当前训练账号后重试。"
        } catch let error as HealthAccountError {
            message = error.localizedDescription
        } catch BridgeError.server(404, _) {
            message = "当前网站尚未开通 App 原生健康同步。现有训练记录可继续使用。"
        } catch BridgeError.server(401, _) {
            do {
                try DeviceKeychain.clear()
                self.connection = nil
                selectedRaw = HealthSelection.heartRate.rawValue
                message = "连接已失效，请重新配对。"
            } catch { message = error.localizedDescription }
        } catch {
            message = "同步未完成（已更新 " + String(saved) + " 项）。" + error.localizedDescription + " 网络恢复后可手动重试或回到前台，无需重新配对。"
        }
    }

    private func ensureCurrentAccount(_ expected: ExpectedHealthAccount, revision: Int) throws {
        try Task.checkCancellation()
        guard session.healthAccount == expected, session.identityRevision == revision else {
            throw HealthAccountError.changed
        }
    }

    private func confirmCurrentAccount(_ expected: ExpectedHealthAccount, revision: Int) async throws {
        try ensureCurrentAccount(expected, revision: revision)
        guard await session.confirmIdentity() else { throw HealthAccountError.changed }
        try ensureCurrentAccount(expected, revision: revision)
    }

    func scheduleSync(askPermission: Bool = false) {
        let previous = syncTask
        previous?.cancel()
        syncTask = Task {
            if let previous { await previous.value }
            guard !Task.isCancelled else { return }
            await sync(askPermission: askPermission)
        }
    }

    func disconnect() async {
        guard !busy, let connection else { return }
        busy = true
        defer { busy = false }
        do {
            do { try await api.disconnect(connection) }
            catch BridgeError.server(401, _) { }
            try DeviceKeychain.clear()
            self.connection = nil
            selectedRaw = HealthSelection.heartRate.rawValue
            lastSync = nil
            message = "已断开连接。服务器不再接受此设备，已同步历史仍保留在你的账号。"
        } catch {
            message = "断开未完成。请联网重试，或在网页账号面板断开连接。" + error.localizedDescription
        }
    }
}
