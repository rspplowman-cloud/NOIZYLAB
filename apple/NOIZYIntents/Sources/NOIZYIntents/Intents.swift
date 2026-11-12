import AppIntents

// Each intent is one NOIZYBRIDGE verb. Siri speaks the answer in short, plain sentences.

public struct DriveHealthIntent: AppIntent {
    public static var title: LocalizedStringResource = "Check M2Ultra drives"
    public static var description = IntentDescription("Reads NOIZYTEK's latest drive cards from M2Ultra. Read only.")
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let r = try await NOIZYBridge.call("/drives")
        let cards = r["cards"] as? [[String: Any]] ?? []
        if cards.isEmpty { return .result(dialog: "No drive scan yet. Run the NOIZYTEK scan on M2Ultra.") }
        let worst = cards.filter { ($0["grade"] as? String) == "COPY NOW" }.compactMap { $0["name"] as? String ?? $0["disk"] as? String }
        let watch = cards.filter { ($0["grade"] as? String) == "WATCH" }.count
        var say = "\(cards.count) drives checked."
        if !worst.isEmpty { say += " Copy now: \(worst.joined(separator: ", "))." }
        if watch > 0 { say += " \(watch) to watch." }
        if worst.isEmpty && watch == 0 { say += " All OK." }
        return .result(dialog: IntentDialog(stringLiteral: say))
    }
}

public struct FindFileIntent: AppIntent {
    public static var title: LocalizedStringResource = "Find a NOIZY file"
    public static var description = IntentDescription("Asks the NOIZY file catalog on M2Ultra where something is. Read only.")
    @Parameter(title: "What are you looking for?") public var query: String
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let r = try await NOIZYBridge.call("/files/ask", body: ["q": query])
        let hits = (r["results"] as? [[String: Any]] ?? []).prefix(3)
        if hits.isEmpty { return .result(dialog: "Nothing found for \(query).") }
        let lines = hits.map { h in "\(h["name"] as? String ?? "?") on \((h["path"] as? String ?? "").split(separator: "/").dropFirst().first.map(String.init) ?? "M2Ultra")" }
        return .result(dialog: IntentDialog(stringLiteral: "Found: " + lines.joined(separator: "; ") + "."))
    }
}

public enum RecordAction: String, AppEnum {
    case start, stop
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "Action"
    public static var caseDisplayRepresentations: [RecordAction: DisplayRepresentation] = [.start: "Start", .stop: "Stop"]
}

public struct AudioHijackIntent: AppIntent {
    public static var title: LocalizedStringResource = "Audio Hijack session on M2Ultra"
    public static var description = IntentDescription("Starts or stops a named Audio Hijack session on M2Ultra. Checks HALT first.")
    @Parameter(title: "Session", default: "TaleSpin VO") public var session: String
    @Parameter(title: "Action", default: .start) public var action: RecordAction
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        _ = try await NOIZYBridge.call("/audio/hijack", body: ["session": session, "action": action.rawValue])
        return .result(dialog: IntentDialog(stringLiteral: action == .start ? "Recording \(session) on M2Ultra." : "Stopped \(session)."))
    }
}

public enum SpeakerAction: String, AppEnum {
    case connect, disconnect
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "Action"
    public static var caseDisplayRepresentations: [SpeakerAction: DisplayRepresentation] = [.connect: "Connect", .disconnect: "Disconnect"]
}

public struct AirfoilIntent: AppIntent {
    public static var title: LocalizedStringResource = "Airfoil speaker"
    public static var description = IntentDescription("Sends M2Ultra audio to a speaker with Airfoil, or stops. Checks HALT first.")
    @Parameter(title: "Speaker") public var speaker: String
    @Parameter(title: "Action", default: .connect) public var action: SpeakerAction
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        _ = try await NOIZYBridge.call("/airfoil", body: ["speaker": speaker, "action": action.rawValue])
        return .result(dialog: IntentDialog(stringLiteral: action == .connect ? "Playing to \(speaker)." : "Stopped \(speaker)."))
    }
}

public enum WarpJob: String, AppEnum {
    case scan = "noizytek-scan", allgreen, party
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "Job"
    public static var caseDisplayRepresentations: [WarpJob: DisplayRepresentation] = [
        .scan: "Drive scan", .allgreen: "All green", .party: "NOIZY PARTY"]
}

public struct WarpJobIntent: AppIntent {
    public static var title: LocalizedStringResource = "Run a NOIZY job in Warp on M2Ultra"
    public static var description = IntentDescription("Opens a fixed Warp launch configuration on M2Ultra: drive scan, all green, or NOIZY PARTY. Checks HALT first.")
    @Parameter(title: "Job", default: .allgreen) public var job: WarpJob
    public init() {}
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        _ = try await NOIZYBridge.call("/warp", body: ["job": job.rawValue])
        return .result(dialog: "Started on M2Ultra in Warp.")
    }
}

/// Siri phrases. Every phrase must contain the app name; the app is called NOIZY.
public struct NOIZYShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: DriveHealthIntent(), phrases: ["Check my drives with \(.applicationName)", "How are the drives in \(.applicationName)"],
                    shortTitle: "Drives", systemImageName: "internaldrive")
        AppShortcut(intent: FindFileIntent(), phrases: ["Find a file with \(.applicationName)", "Where is it in \(.applicationName)"],
                    shortTitle: "Find file", systemImageName: "magnifyingglass")
        AppShortcut(intent: AudioHijackIntent(), phrases: ["Start recording with \(.applicationName)", "Record on M2Ultra with \(.applicationName)"],
                    shortTitle: "Record", systemImageName: "record.circle")
        AppShortcut(intent: AirfoilIntent(), phrases: ["Send audio with \(.applicationName)"],
                    shortTitle: "Speakers", systemImageName: "hifispeaker")
        AppShortcut(intent: WarpJobIntent(), phrases: ["Run a job in Warp with \(.applicationName)", "All green with \(.applicationName)"],
                    shortTitle: "Warp job", systemImageName: "terminal")
    }
}
