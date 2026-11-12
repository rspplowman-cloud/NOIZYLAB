import Foundation
import Security

/// Talks to NOIZYBRIDGE on M2Ultra (services/noizybridge). Address and key are kept in the iPhone Keychain,
/// entered once in NOIZYSettingsView. Nothing secret is in the code or in Shortcuts history.
public enum NOIZYBridge {
    public enum Failure: LocalizedError {
        case notSetUp, http(Int, String), badReply
        public var errorDescription: String? {
            switch self {
            case .notSetUp: return "NOIZY bridge is not set up. Open the NOIZY app and add the M2Ultra address and key."
            case .http(423, _): return "HALT is on. M2Ultra is not taking actions right now."
            case .http(401, _): return "The bridge key is wrong. Check it in the NOIZY app."
            case .http(let c, let m): return "M2Ultra answered \(c): \(m)"
            case .badReply: return "M2Ultra sent a reply I could not read."
            }
        }
    }

    public static func call(_ path: String, body: [String: String]? = nil) async throws -> [String: Any] {
        guard let base = Keychain.get("bridge_url"), let key = Keychain.get("bridge_key"),
              let url = URL(string: base.trimmingCharacters(in: .whitespaces) + path) else { throw Failure.notSetUp }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = body == nil ? "GET" : "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(key, forHTTPHeaderField: "X-NOIZY-Key")
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw Failure.http(code, obj?["error"] as? String ?? "error") }
        guard let obj else { throw Failure.badReply }
        return obj
    }
}

/// Minimal Keychain wrapper (this device only, after first unlock, so Siri can use it from the lock screen).
public enum Keychain {
    public static func set(_ key: String, _ value: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "ai.noizy.bridge",
                                   kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
    public static func get(_ key: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "ai.noizy.bridge",
                                kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
}
