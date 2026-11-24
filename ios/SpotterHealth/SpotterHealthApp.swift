import SwiftUI

@main
struct SpotterHealthApp: App {
    var body: some Scene {
        WindowGroup { HealthConnectionView() }
    }
}

@MainActor
private struct HealthConnectionView: View {
    @Environment(\.scenePhase) private var scene
    @AppStorage("healthSelectedTypes") private var selectedRaw = HealthSelection.heartRate.rawValue
    @AppStorage("healthRangeDays") private var rangeDays = 14
    @State private var connection = DeviceKeychain.load()
    @State private var address = ""
    @State private var code = ""
    @State private var message = ""
    @State private var busy = false
    @State private var showDisconnect = false
    @State private var showPairing = false
    @AppStorage("healthCustomStart") private var customStartEpoch = (Calendar.current.date(byAdding: .day, value: -13, to: Date()) ?? Date()).timeIntervalSince1970
    @AppStorage("healthCustomEnd") private var customEndEpoch = Date().timeIntervalSince1970
    @State private var lastSync: Date?
    @State private var health = HealthKitReader()
    private let api = BridgeClient()

    private var selected: Set<HealthSelection> {
        Set(selectedRaw.split(separator: ",").compactMap { HealthSelection(rawValue: String($0)) })
    }

    var body: some View {
        NavigationStack {
            Form {
                if let connection {
                    Section {
                        LabeledContent("已连接", value: connection.origin)
                        LabeledContent("Apple Watch", value: "历史同步")
                        LabeledContent("实时心率", value: "未接入")
                        if let lastSync { LabeledContent("最近同步", value: lastSync.formatted(date: .abbreviated, time: .shortened)) }
                    } footer: {
                        Text("只同步当前账号选定的数据，原始心率、体重与活动记录保持私密。后台同步尚未启用。")
                    }
                    Section {
                        ForEach(HealthSelection.allCases) { type in
                            Toggle(type.title, isOn: Binding(get: { selected.contains(type) }, set: { enabled in
                                Task { await select(type, enabled: enabled) }
                            })).disabled(busy)
                        }
                    } header: {
                        Text("选择同步数据")
                    } footer: {
                        Text("每类数据单独请求读取权限，不写入 Apple 健康。系统不会告诉 App 你是否拒绝读取；没有样本时请核对权限和范围。")
                    }
                    Section {
                        Picker("日期", selection: $rangeDays) {
                            Text("今天").tag(1)
                            Text("最近 14 天").tag(14)
                            Text("最近 30 天").tag(30)
                            Text("最近 90 天").tag(90)
                            Text("最近 365 天").tag(365)
                            Text("自定义").tag(0)
                        }.disabled(busy)
                        if rangeDays == 0 {
                            DatePicker("开始日期", selection: Binding(get: { Date(timeIntervalSince1970: customStartEpoch) }, set: { customStartEpoch = $0.timeIntervalSince1970 }), in: ...Date(), displayedComponents: .date)
                            DatePicker("结束日期", selection: Binding(get: { Date(timeIntervalSince1970: customEndEpoch) }, set: { customEndEpoch = $0.timeIntervalSince1970 }), in: ...Date(), displayedComponents: .date)
                        }
                        Button("同步所选健康数据") { Task { await sync(askPermission: true) } }
                            .disabled(busy || selected.isEmpty)
                    } header: {
                        Text("同步范围")
                    } footer: {
                        Text("日期按 iPhone 当前时区，最多 365 天。手动同步可补回历史和延迟到达的样本；重复同步不会重复记。打开 App 或回到前台也会同步当前范围。")
                    }
                    Section {
                        Button("重新配对或更换账号") { showPairing.toggle() }.disabled(busy)
                        Button("断开连接", role: .destructive) { showDisconnect = true }.disabled(busy)
                    }
                }
                if connection == nil || showPairing { pairingForm }
                if busy { ProgressView("正在同步…") }
                if !message.isEmpty { Text(message).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("训练搭子 · 健康")
            .confirmationDialog("断开此 iPhone？", isPresented: $showDisconnect, titleVisibility: .visible) {
                Button("断开连接", role: .destructive) { Task { await disconnect() } }
            }
            .task { await sync() }
            .onChange(of: scene) { phase in
                if phase == .active { Task { await sync() } }
            }
        }
    }

    private var pairingForm: some View {
        Section {
            TextField("测试独立版 HTTPS 网址", text: $address)
                .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
            SecureField("五分钟配对码", text: $code)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("配对并读取 Apple 健康") { Task { await connect() } }
                .disabled(busy || address.isEmpty || code.trimmingCharacters(in: .whitespacesAndNewlines).count != 32)
        } footer: {
            Text("在测试独立版网页登录账号并生成一次性配对码。首次仅请求心率，之后可逐项开启其他数据。当前 Sites 快捷指令入口与原生配对接口不同，请勿填正式 Sites 网址。")
        }
    }

    private func select(_ type: HealthSelection, enabled: Bool) async {
        guard !busy else { return }
        if enabled {
            busy = true
            defer { busy = false }
            do { try await health.authorize(type) }
            catch { message = error.localizedDescription; return }
        }
        var types = selected
        if enabled { types.insert(type) } else { types.remove(type) }
        selectedRaw = types.map(\.rawValue).sorted().joined(separator: ",")
        message = enabled ? "已选定" + type.title + "。是否可读取以系统权限和实际样本为准。" : "已停止同步" + type.title + "。"
    }

    private func connect() async {
        guard !busy else { return }
        busy = true
        message = ""
        let previous = connection
        do {
            let paired = try await BridgeClient.pair(origin: address, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
            try DeviceKeychain.save(paired)
            connection = paired
            selectedRaw = HealthSelection.heartRate.rawValue
            rangeDays = 14
            lastSync = nil
            code = ""
            showPairing = false
            if let previous { try? await api.disconnect(previous) }
            try await health.authorize(.heartRate)
        } catch { message = error.localizedDescription }
        busy = false
        if connection != nil && !showPairing { await sync() }
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
        busy = true
        defer { busy = false }
        var saved = 0
        var skipped = 0
        var empty = 0
        var heartWindows = 0
        var received = Set<HealthSelection>()
        do {
            let (from, to, calendar) = try range()
            let types = selected
            if askPermission { for type in HealthSelection.allCases where types.contains(type) { try await health.authorize(type) } }
            if types.contains(.heartRate) {
                var cursor: String?
                var seen = Set<String>()
                repeat {
                    let page = try await api.workouts(connection, from: from, to: to, cursor: cursor)
                    for workout in page.workouts where workout.start >= from && workout.end <= to {
                        heartWindows += 1
                        guard let payload = try await health.read(workout) else { empty += 1; continue }
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
                    // Seven-day overlap carries long/cross-midnight workouts across batch boundaries.
                    // Thirty local days also leave room for the extra DST hour in the server's 31-day limit.
                    let start = first ? from : max(from, calendar.date(byAdding: .day, value: -7, to: position)!)
                    let end = min(to, calendar.date(byAdding: .day, value: 23, to: position)!)
                    let payload = try await health.records(selected: types, from: start, to: end, calendar: calendar)
                    if payload.count == 0 { empty += 1 }
                    received.formUnion(payload.received)
                    let result = try await api.save(payload, using: connection)
                    saved += result.saved
                    skipped += result.skipped
                    position = end
                    first = false
                }
            }
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

    private func disconnect() async {
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
