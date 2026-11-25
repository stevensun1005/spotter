import CryptoKit
import SwiftUI

private struct SpotterAccountPreferencesKey: EnvironmentKey {
    static let defaultValue: NativeAccountPreferences? = nil
}

extension EnvironmentValues {
    var spotterAccountPreferences: NativeAccountPreferences? {
        get { self[SpotterAccountPreferencesKey.self] }
        set { self[SpotterAccountPreferencesKey.self] = newValue }
    }
}

@MainActor
final class NativeAccountPreferences: ObservableObject {
    private struct Values: Codable, Equatable {
        var gyms: NativeGymPreferences?
        var defaultUnit: String?
        var defaultRest: Int?

        var isEmpty: Bool { gyms == nil && defaultUnit == nil && defaultRest == nil }

        func merging(_ newest: Self) -> Self {
            Self(gyms: newest.gyms ?? gyms, defaultUnit: newest.defaultUnit ?? defaultUnit,
                 defaultRest: newest.defaultRest ?? defaultRest)
        }
    }

    private struct Envelope: Decodable {
        let owner: String
        let preferences: Values
    }

    private struct Update: Encodable {
        let expectedOwner: String
        let preferences: Values
        let initialize: Bool
    }

    private struct Local: Codable {
        var cached = Values()
        var seed = Values()
        var pending = Values()

        var visible: Values { seed.merging(cached).merging(pending) }
    }

    @Published private(set) var notice: String?
    private let api: NativeAPI
    private let owner: String
    private let key: String
    private var local = Local()
    private var activated = false
    private var synchronizing = false

    init(api: NativeAPI, owner: String) {
        self.api = api
        self.owner = owner
        let reference = SHA256.hash(data: Data((api.origin + "\n" + owner).utf8))
        key = "spotter.native.accountPreferences." + reference.map { String(format: "%02x", $0) }.joined()
    }

    func activate() {
        guard !activated else { return }
        activated = true
        let defaults = UserDefaults.standard
        let prior = defaults.string(forKey: "spotter.native.accountPreferences.owner")
        defaults.set(key, forKey: "spotter.native.accountPreferences.owner")
        if let data = defaults.data(forKey: key), let saved = try? JSONDecoder().decode(Local.self, from: data) {
            local = saved
        } else if prior == nil || prior == key {
            let gymData = defaults.data(forKey: NativeGymPreferences.storageKey) ?? Data()
            let legacyGear = defaults.string(forKey: NativePreferenceKey.equipment) ?? ""
            local.seed = Values(
                gyms: gymData.isEmpty && legacyGear.isEmpty ? nil : .read(gymData, legacy: legacyGear),
                defaultUnit: defaults.string(forKey: NativePreferenceKey.unit),
                defaultRest: defaults.object(forKey: NativePreferenceKey.defaultRest) as? Int
            )
        }
        apply(local.visible)
        persist()
    }

    func save(gyms: NativeGymPreferences? = nil, unit: String? = nil, rest: Int? = nil) {
        activate()
        local.pending = local.pending.merging(Values(gyms: gyms, defaultUnit: unit, defaultRest: rest))
        notice = "待同步训练偏好"
        persist()
        Task { await sync() }
    }

    func clear() {
        let defaults = UserDefaults.standard
        if stillActive {
            defaults.removeObject(forKey: "spotter.native.accountPreferences.owner")
            apply(Values())
        }
        defaults.removeObject(forKey: key)
        local = Local()
    }

    func sync() async {
        activate()
        guard !synchronizing, stillActive else { return }
        synchronizing = true
        defer { synchronizing = false }
        do {
            if !local.seed.isEmpty {
                let answer = try await upload(local.seed, initialize: true)
                guard stillActive, answer.owner == owner else { return }
                local.seed = Values()
                guard accept(answer) else { return }
            } else if local.pending.isEmpty {
                let answer = try await api.spotterRead("/api/workout-preferences", as: Envelope.self)
                guard accept(answer) else { return }
            }
            while !local.pending.isEmpty && stillActive {
                let sent = local.pending
                let answer = try await upload(sent, initialize: false)
                guard stillActive, answer.owner == owner else { return }
                if local.pending.gyms == sent.gyms { local.pending.gyms = nil }
                if local.pending.defaultUnit == sent.defaultUnit { local.pending.defaultUnit = nil }
                if local.pending.defaultRest == sent.defaultRest { local.pending.defaultRest = nil }
                guard accept(answer) else { return }
            }
            notice = nil
        } catch {
            guard stillActive else { return }
            notice = local.pending.isEmpty && local.seed.isEmpty ? "暂时无法刷新训练偏好" : "训练偏好已存在本机，联网后重试"
        }
    }

    private var stillActive: Bool {
        UserDefaults.standard.string(forKey: "spotter.native.accountPreferences.owner") == key
    }

    private func upload(_ values: Values, initialize: Bool) async throws -> Envelope {
        let body = try JSONEncoder().encode(Update(expectedOwner: owner, preferences: values, initialize: initialize))
        let result = try await api.request("/api/workout-preferences", method: "POST", json: body, for: owner)
        return try JSONDecoder().decode(Envelope.self, from: result)
    }

    private func accept(_ answer: Envelope) -> Bool {
        guard stillActive, answer.owner == owner else { return false }
        local.cached = answer.preferences
        apply(local.visible)
        persist()
        return true
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(local) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private func apply(_ values: Values) {
        let defaults = UserDefaults.standard
        if let gyms = values.gyms, let data = try? JSONEncoder().encode(gyms) {
            defaults.set(data, forKey: NativeGymPreferences.storageKey)
        } else {
            defaults.removeObject(forKey: NativeGymPreferences.storageKey)
            defaults.removeObject(forKey: NativePreferenceKey.equipment)
        }
        defaults.set(values.defaultUnit ?? "kg", forKey: NativePreferenceKey.unit)
        defaults.set(values.defaultRest ?? 30, forKey: NativePreferenceKey.defaultRest)
    }
}
