import SwiftUI

@MainActor
struct HealthConnectionView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var coordinator: HealthSyncCoordinator
    @ObservedObject private var session: AppSession

    init(coordinator: HealthSyncCoordinator) {
        self.coordinator = coordinator
        self.session = coordinator.session
    }

    var body: some View {
        NavigationStack {
            Form {
                if session.healthAccount == nil {
                    Section {
                        Text("请先在训练页面登录。账号确认前，健康同步保持暂停。")
                    }
                }
                if let connection = coordinator.connection {
                    Section {
                        LabeledContent("已连接", value: connection.origin)
                        LabeledContent("Apple Watch", value: "历史同步")
                        LabeledContent("实时心率", value: "未接入")
                        if let lastSync = coordinator.lastSync {
                            LabeledContent("最近同步", value: lastSync.formatted(date: .abbreviated, time: .shortened))
                        }
                    } footer: {
                        Text("只同步当前账号选定的数据，原始心率、体重与活动记录保持私密。后台同步尚未启用。")
                    }
                    Section {
                        ForEach(HealthSelection.allCases) { type in
                            Toggle(type.title, isOn: Binding(get: { coordinator.selected.contains(type) }, set: { enabled in
                                Task { await coordinator.select(type, enabled: enabled) }
                            })).disabled(coordinator.busy || session.healthAccount == nil)
                        }
                    } header: {
                        Text("选择同步数据")
                    } footer: {
                        Text("每类数据单独请求读取权限，不写入 Apple 健康。系统不会告诉 App 你是否拒绝读取；没有样本时请核对权限和范围。")
                    }
                    Section {
                        Picker("日期", selection: $coordinator.rangeDays) {
                            Text("今天").tag(1)
                            Text("最近 14 天").tag(14)
                            Text("最近 30 天").tag(30)
                            Text("最近 90 天").tag(90)
                            Text("最近 365 天").tag(365)
                            Text("自定义").tag(0)
                        }.disabled(coordinator.busy)
                        if coordinator.rangeDays == 0 {
                            DatePicker("开始日期", selection: Binding(get: { Date(timeIntervalSince1970: coordinator.customStartEpoch) }, set: { coordinator.customStartEpoch = $0.timeIntervalSince1970 }), in: ...Date(), displayedComponents: .date).disabled(coordinator.busy)
                            DatePicker("结束日期", selection: Binding(get: { Date(timeIntervalSince1970: coordinator.customEndEpoch) }, set: { coordinator.customEndEpoch = $0.timeIntervalSince1970 }), in: ...Date(), displayedComponents: .date).disabled(coordinator.busy)
                        }
                        Button("同步所选健康数据") { coordinator.scheduleSync(askPermission: true) }
                            .disabled(coordinator.busy || coordinator.selected.isEmpty || session.healthAccount == nil)
                    } header: {
                        Text("同步范围")
                    } footer: {
                        Text("日期按 iPhone 当前时区，最多 365 天。手动同步可补回历史和延迟到达的样本；重复同步不会重复记。打开 App 或回到前台也会同步当前范围。")
                    }
                    Section {
                        Button("重新配对或更换账号") { coordinator.showPairing.toggle() }.disabled(coordinator.busy)
                        Button("断开连接", role: .destructive) { coordinator.showDisconnect = true }.disabled(coordinator.busy)
                    }
                }
                if coordinator.connection == nil || coordinator.showPairing { pairingForm }
                if coordinator.busy { ProgressView("正在同步…") }
                if !coordinator.message.isEmpty {
                    Text(coordinator.message).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("训练搭子 · 健康")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } }
            }
            .confirmationDialog("断开此 iPhone？", isPresented: $coordinator.showDisconnect, titleVisibility: .visible) {
                Button("断开连接", role: .destructive) { Task { await coordinator.disconnect() } }
            }
        }
    }

    private var pairingForm: some View {
        Section {
            LabeledContent("当前网站", value: session.healthAccount?.origin ?? "等待登录")
            SecureField("五分钟配对码", text: $coordinator.code)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("配对并读取 Apple 健康") { Task { await coordinator.connect() } }
                .disabled(coordinator.busy || session.healthAccount == nil || coordinator.code.trimmingCharacters(in: .whitespacesAndNewlines).count != 32)
        } footer: {
            Text("在当前网站的账号面板生成一次性配对码。只可配对当前登录账号；首次仅请求心率，之后可逐项开启其他数据。网站需要已开通原生健康同步。")
        }
    }
}
