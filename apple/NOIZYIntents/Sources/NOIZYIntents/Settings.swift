import SwiftUI

/// Enter once: the M2Ultra bridge address (its tailnet address, e.g. http://100.x.y.z:9795) and the bridge key
/// (from Proton Pass). Both go into the Keychain on this iPhone only.
public struct NOIZYSettingsView: View {
    @State private var url = Keychain.get("bridge_url") ?? "http://100.64.0.1:9795"
    @State private var key = ""
    @State private var status = ""
    public init() {}
    public var body: some View {
        Form {
            Section("M2Ultra bridge") {
                #if os(iOS)
                TextField("Address", text: $url).textInputAutocapitalization(.never).autocorrectionDisabled()
                #else
                TextField("Address", text: $url).autocorrectionDisabled()
                #endif
                SecureField("Bridge key (from Proton Pass)", text: $key)
            }
            Button("Save") {
                Keychain.set("bridge_url", url)
                if !key.isEmpty { Keychain.set("bridge_key", key); key = "" }
                status = "Saved on this iPhone."
            }
            Button("Test: check drives") {
                Task { do { _ = try await NOIZYBridge.call("/drives"); status = "M2Ultra answered." }
                       catch { status = error.localizedDescription } }
            }
            if !status.isEmpty { Text(status).font(.title3) }
        }
        .font(.title3)
    }
}
