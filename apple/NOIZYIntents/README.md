# NOIZYIntents: Siri on iPhone 15 Pro Max drives M2Ultra

**Four Siri actions, each one NOIZYBRIDGE verb.** Swift App Intents (iOS 17+). Written here; **not yet built on a device**.

| Say to Siri | Intent | M2Ultra does |
|---|---|---|
| "Check my drives with NOIZY" | `DriveHealthIntent` | Reads NOIZYTEK's drive cards (read only) |
| "Find a file with NOIZY" | `FindFileIntent` | Asks the file catalog (read only) |
| "Start recording with NOIZY" | `AudioHijackIntent` | Starts or stops an Audio Hijack session (HALT first) |
| "Send audio with NOIZY" | `AirfoilIntent` | Connects or disconnects an Airfoil speaker (HALT first) |

## Put it on the iPhone

1. On M2Ultra, open Xcode (or Swift Playgrounds on iPad/Mac).
2. New app called **NOIZY** (App Intents phrases use the app name).
3. Add the three files in `Sources/NOIZYIntents/` to the app target. Put them in the app itself, so Siri finds the phrases.
4. In the app's main view, show `NOIZYSettingsView()`.
5. Run it on the iPhone 15 Pro Max once. Enter:
   1. **Address:** M2Ultra's tailnet address, `http://100.x.y.z:9795` (from the Tailscale app).
   2. **Key:** the bridge key from Proton Pass.
6. Press **Test: check drives**.
7. Say "Check my drives with NOIZY".

**If iOS blocks the plain `http://` address:** add `NSAppTransportSecurity` → `NSAllowsLocalNetworking = YES` to the app's Info. The tailnet already encrypts the traffic end to end (WireGuard).

The key is stored in the iPhone **Keychain** (this device only). It is never in the code, never in Shortcuts history.
