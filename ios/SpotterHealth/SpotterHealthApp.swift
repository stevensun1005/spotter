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
    @State private var connection = DeviceKeychain.load()
    @State private var address = ""
    @State private var code = ""
    @State private var message = ""
    @State private var busy = false
    @State private var showDisconnect = false
    @State private var health = HealthKitReader()
    private let api = BridgeClient()

    var body: some View {
        NavigationStack {
            Form {
                if let connection {
                    Section {
                        LabeledContent("已连接", value: connection.origin)
                        Button("同步训练心率") { Task { await sync(askPermission: true) } }
                            .disabled(busy)
                    } footer: {
                        Text("打开 App 时会检查最近 14 天的已打卡训练。同步的心率仅你可见。")
                    }
                    Section {
                        Button("断开连接", role: .destructive) { showDisconnect = true }
                            .disabled(busy)
                    }
                } else {
                    Section {
                        TextField("独立版 HTTPS 网址", text: $address)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("五分钟配对码", text: $code)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("配对并授权 Apple 健康") { Task { await connect() } }
                            .disabled(busy || address.isEmpty || code.trimmingCharacters(in: .whitespacesAndNewlines).count != 32)
                    } footer: {
                        Text("登录训练搭子，在账号里生成配对码。授权后只读取每次已打卡训练时段内的心率。")
                    }
                }
                if busy { ProgressView() }
                if !message.isEmpty { Text(message).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("训练搭子 · 心率")
            .confirmationDialog("断开此 iPhone？", isPresented: $showDisconnect, titleVisibility: .visible) {
                Button("断开连接", role: .destructive) { Task { await disconnect() } }
            }
            .task { await sync() }
            .onChange(of: scene) { phase in
                if phase == .active { Task { await sync() } }
            }
        }
    }

    private func connect() async {
        guard !busy else { return }
        busy = true
        message = ""
        do {
            let origin = try BridgeClient.origin(address)
            try await health.authorize()
            let paired = try await BridgeClient.pair(origin: origin, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
            try DeviceKeychain.save(paired)
            connection = paired
            code = ""
        } catch {
            message = error.localizedDescription
        }
        busy = false
        if connection != nil { await sync() }
    }

    private func sync(askPermission: Bool = false) async {
        guard !busy, let connection else { return }
        busy = true
        defer { busy = false }
        do {
            if askPermission { try await health.authorize() }
            let workouts = try await api.workouts(connection)
            var saved = 0
            var empty = 0
            for workout in workouts {
                guard let payload = try await health.read(workout) else { empty += 1; continue }
                if try await api.save(payload, id: workout.id, using: connection) { saved += 1 }
            }
            if saved > 0 { message = "已同步 " + String(saved) + " 次训练心率。" }
            else if empty > 0 { message = "对应时段暂无心率。可检查训练时间、手表同步和 Apple 健康的读取权限。" }
            else { message = "近期训练心率已是最新。" }
        } catch BridgeError.server(401, _) {
            try? DeviceKeychain.clear()
            self.connection = nil
            message = "连接已失效，请重新配对。"
        } catch {
            message = error.localizedDescription
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
            message = "已断开连接。"
        } catch {
            message = error.localizedDescription
        }
    }
}
