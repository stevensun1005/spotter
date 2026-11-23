import Foundation
import Security

enum DeviceKeychain {
    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "app.spotter.health.bridge",
         kSecAttrAccount as String: "iphone"]
    }

    static func load() -> Connection? {
        var item = query
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Connection.self, from: data)
    }

    static func save(_ connection: Connection) throws {
        let data = try JSONEncoder().encode(connection)
        let updates = [kSecValueData as String: data] as CFDictionary
        let status = SecItemUpdate(query as CFDictionary, updates)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw BridgeError.keychain }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw BridgeError.keychain }
    }

    static func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw BridgeError.keychain }
    }
}
