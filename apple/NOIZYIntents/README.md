# NOIZYIntents: Siri on iPhone 15 Pro Max drives M2Ultra

**Seven Siri actions.** LUCY and GABRIEL can also answer **on the iPhone itself** (`OnDevice.swift`, MLX or Apple's on-device model); see `docs/apple/PARTNERS-AND-ON-DEVICE.md`. Swift App Intents (iOS 17+). Written here; **not yet built on a device**.

| Say to Siri | Intent | M2Ultra does |
|---|---|---|
| "Ask GABRIEL with NOIZY" / "Ask LUCY with NOIZY" | `AskAgentIntent` | Answers on the iPhone if a local model is ready; otherwise asks M2Ultra (advice only) |
| "Morning brief with NOIZY" | `MorningBriefIntent` | Red, waiting on you, ship today |
| "All green with NOIZY" | `WarpJobIntent` | Opens a fixed Warp job |
| "Check my drives with NOIZY" | `DriveHealthIntent` | Reads NOIZYTEK's drive cards (read only) |
| "Find a file with NOIZY" | `FindFileIntent` | Asks the file catalog (read only) |
| "Start recording with NOIZY" | `AudioHijackIntent` | Starts or stops an Audio Hijack session (HALT first) |
| "Send audio with NOIZY" | `AirfoilIntent` | Connects or disconnects an Airfoil speaker (HALT first) |

## Put it on the iPhone

1. On M2Ultra, open Xcode (or Swift Playgrounds on iPad/Mac).
2. New app called **NOIZY** (App Intents phrases use the app name).
3. Add the four files in `Sources/NOIZYIntents/` to the app target. Put them in the app itself, so Siri finds the phrases.
4. In the app's main view, show `NOIZYSettingsView()`.
5. Run it on the iPhone 15 Pro Max once. Enter:
   1. **Address:** M2Ultra's tailnet address, `http://100.x.y.z:9795` (from the Tailscale app).
   2. **Key:** the bridge key from Proton Pass.
6. Press **Test: check drives**.
7. Say "Check my drives with NOIZY".

**If iOS blocks the plain `http://` address:** add `NSAppTransportSecurity` → `NSAllowsLocalNetworking = YES` to the app's Info. The tailnet already encrypts the traffic end to end (WireGuard).

The key is stored in the iPhone **Keychain** (this device only). It is never in the code, never in Shortcuts history.
