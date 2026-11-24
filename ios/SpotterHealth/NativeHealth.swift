import Charts
import Foundation
import SwiftUI

@MainActor
struct NativeHeartView: View {
    private struct StoredHeart: Decodable {
        let source: String
        let average: Int?
        let minimum: Int?
        let maximum: Int?
        let sourceName: String?
        let samples: [HeartPoint]
        var minimumBPM: Int? { minimum ?? samples.map(\.bpm).min() }
        var label: String {
            sourceName ?? ["apple": "Apple 健康", "whoop": "WHOOP", "fit": "FIT", "tcx": "TCX", "csv": "CSV"][source] ?? source
        }
    }
    private struct Cloud: Decodable { let data: StoredHeart? }
    let api: NativeAPI
    let owner: String
    let entry: NativeWorkoutEntry
    @State private var stored: StoredHeart?
    @State private var busy = false
    @State private var message: String?
    @State private var confirmReplace = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("训练心率", systemImage: "heart.text.square").font(.headline)
            if let stored {
                HStack(spacing: 20) {
                    heartMeasure("平均", value: stored.average)
                    heartMeasure("最低", value: stored.minimumBPM)
                    heartMeasure("最高", value: stored.maximum)
                }
                if !stored.samples.isEmpty {
                    Chart(stored.samples, id: \.at) { point in
                        LineMark(x: .value("时间", Date(timeIntervalSince1970: Double(point.at) / 1000)),
                                 y: .value("心率", point.bpm))
                            .foregroundStyle(.red)
                    }
                    .frame(height: 120)
                    .accessibilityLabel("训练心率曲线")
                }
                Text(stored.label).font(.footnote).foregroundStyle(.secondary)
            }
            if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
            if entry.workoutWindow != nil {
                Button {
                    if let stored, stored.source != "apple" { confirmReplace = true }
                    else { Task { await loadHealth() } }
                } label: {
                    Label(busy ? "正在读取" : "从 Apple 健康同步", systemImage: "arrow.trianglehead.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(busy)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
        .task { await loadCloud() }
        .confirmationDialog("替换当前来源的心率记录？", isPresented: $confirmReplace, titleVisibility: .visible) {
            Button("同步 Apple 健康", role: .destructive) { Task { await loadHealth() } }
            Button("取消", role: .cancel) {}
        }
    }

    private func heartMeasure(_ title: String, value: Int?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value.map { "\($0)" } ?? "–").font(.title3.bold()).monospacedDigit()
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
    }

    private func loadCloud() async {
        guard UUID(uuidString: entry.id) != nil else { return }
        do {
            stored = try await api.spotterRead("/api/health?id=" + entry.id, as: Cloud.self).data
        } catch { message = error.localizedDescription }
    }

    private func loadHealth() async {
        guard let interval = entry.workoutWindow, entry.owner == owner else { return }
        let window = WorkoutWindow(id: entry.id, from: interval.from, to: interval.to)
        guard window.canRead else { message = "这笔训练的开始和结束时间还无法同步。"; return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            let reader = HealthKitReader()
            try await reader.authorize(.heartRate)
            guard let payload = try await reader.read(window) else {
                message = "这段时间没有可读取的心率。请检查健康权限和手表同步。"
                return
            }
            try Task.checkCancellation()
            struct HeartUpload: Encodable {
                let action = "save"
                let id: String
                let expectedOwner: String
                let data: HeartPayload
            }
            let body = try JSONEncoder().encode(HeartUpload(id: entry.id, expectedOwner: owner, data: payload))
            _ = try await api.request("/api/health", method: "POST", json: body)
            await loadCloud()
            if message == nil { message = "这次训练的心率已同步。" }
        } catch { message = error.localizedDescription }
    }
}

@MainActor
struct NativeHealthSummary: View {
    var api: NativeAPI? = nil
    var owner: String? = nil
    @State private var selection: HealthSelection = .steps
    @State private var days = 1
    @State private var summary: String?
    @State private var payload: HealthRecordsPayload?
    @State private var busy = false

    private let items: [HealthSelection] = [.steps, .activeEnergy, .exerciseTime, .bodyMass, .workouts]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Apple 健康", systemImage: "heart.text.square").font(.headline)
            HStack {
                Picker("数据类型", selection: $selection) {
                    ForEach(items) { item in Text(item.title).tag(item) }
                }
                Picker("日期范围", selection: $days) {
                    Text("今天").tag(1)
                    Text("近 7 天").tag(7)
                    Text("近 30 天").tag(30)
                }
            }
            Button("读取所选数据") { Task { await read() } }
                .buttonStyle(.bordered)
                .disabled(busy)
            if let summary { Text(summary).font(.subheadline).foregroundStyle(.secondary) }
            if let payload, selection == .bodyMass, !payload.bodyMass.isEmpty, let api, let owner {
                Button("同步体重到账号") { Task { await uploadWeights(api: api, owner: owner, records: payload.bodyMass) } }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy)
            }
        }
        .onChange(of: selection) { _ in payload = nil; summary = nil }
        .onChange(of: days) { _ in payload = nil; summary = nil }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(spotterCardPadding)
        .spotterCard()
    }

    private func read() async {
        let type = selection
        let dayCount = days
        let calendar = Calendar.current
        let now = Date.now
        guard let begin = calendar.date(byAdding: .day, value: 1 - dayCount, to: calendar.startOfDay(for: now)) else { return }
        busy = true
        defer { busy = false }
        do {
            let health = HealthKitReader()
            try await health.authorize(type)
            let value = try await health.records(selected: [type], from: begin, to: now, calendar: calendar)
            guard selection == type, days == dayCount else { return }
            payload = value
            if value.count == 0 {
                summary = "这段时间没有可读取的样本，请检查健康权限和日期范围。"
                return
            }
            switch type {
            case .steps:
                summary = "\(Int(value.activity.compactMap(\.steps).reduce(0, +))) 步"
            case .activeEnergy:
                summary = "\(Int(value.activity.compactMap(\.activeEnergyKcal).reduce(0, +).rounded())) 千卡"
            case .exerciseTime:
                summary = "\(Int(value.activity.compactMap(\.exerciseMinutes).reduce(0, +).rounded())) 分钟"
            case .bodyMass:
                if let latest = value.bodyMass.last { summary = latest.value.formatted(.number.precision(.fractionLength(1))) + " kg" }
            case .workouts:
                let minutes = value.workouts.map(\.durationSeconds).reduce(0, +) / 60
                summary = "\(value.workouts.count) 次系统运动，共 \(Int(minutes.rounded())) 分钟"
            case .heartRate: break
            }
        } catch { summary = error.localizedDescription }
    }

    private func uploadWeights(api: NativeAPI, owner: String, records: [BodyMassRecord]) async {
        busy = true
        defer { busy = false }
        var saved = 0
        do {
            for weight in records where (10...700).contains(weight.value) {
                try Task.checkCancellation()
                _ = try await api.spotterSend("/api/library", body: [
                    "action": "save", "expectedOwner": owner,
                    "data": ["kind": "nutrition", "id": weight.id.lowercased(),
                             "date": spotterDay(Date(timeIntervalSince1970: Double(weight.at) / 1000)),
                             "entry": ["type": "weight", "kg": weight.value]]
                ])
                saved += 1
            }
            summary = "已同步 \(saved) 条体重记录。"
            if saved > 0 { NotificationCenter.default.post(name: .spotterNativeNutritionUpdated, object: nil) }
        } catch { summary = "已同步 \(saved) 条。\(error.localizedDescription)" }
    }
}
