import AVFoundation

// GABRIEL speaks in RSP_001's own voice, using Apple's Personal Voice.
//
// RSP_001 makes the voice once (Settings → Accessibility → Personal Voice: 10 phrases, under a minute)
// and turns on "Allow Apps to Request to Use". This file asks permission once and then speaks.
// Everything stays on the device: Apple does not let an app record or export a Personal Voice.
//
// WRITTEN, NOT YET COMPILED (like the rest of this package). The API names and versions below were
// checked against Apple's documentation on 2026-11-15 (iOS 17, macOS 14, watchOS 10).
//
// Use from the app, not from inside a Siri intent: Siri reads an intent's answer in its own voice.
//     let line = try await GabrielVoice.shared.speak("Good evening. Everything is in order.")
//     GabrielVoice.shared.onWord = { word in /* move the avatar's mouth, show the word */ }

public enum GabrielVoiceError: LocalizedError {
    case notAllowed, noPersonalVoice, notSupported
    public var errorDescription: String? {
        switch self {
        case .notAllowed: return "Personal Voice is not allowed for this app. Settings → Accessibility → Personal Voice → Allow Apps to Request to Use."
        case .noPersonalVoice: return "No Personal Voice on this device yet. Settings → Accessibility → Personal Voice → Create a Personal Voice."
        case .notSupported: return "This device cannot use Personal Voice."
        }
    }
}

public final class GabrielVoice: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    public static let shared = GabrielVoice()

    /// Called on the main thread just before each word is spoken. Use it to move the avatar's mouth.
    public var onWord: ((String) -> Void)?
    /// Called on the main thread when a line ends, or is stopped.
    public var onFinish: (() -> Void)?

    private let synthesizer = AVSpeechSynthesizer()
    private var finished: CheckedContinuation<Void, Never>?

    private override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// Asks once for permission to use RSP_001's Personal Voice. Later calls return the stored answer.
    public func authorize() async -> AVSpeechSynthesizer.PersonalVoiceAuthorizationStatus {
        await withCheckedContinuation { done in
            AVSpeechSynthesizer.requestPersonalVoiceAuthorization { status in done.resume(returning: status) }
        }
    }

    /// The Personal Voice on this device, if there is one and the app may use it.
    public func personalVoice() async throws -> AVSpeechSynthesisVoice {
        switch await authorize() {
        case .authorized: break
        case .unsupported: throw GabrielVoiceError.notSupported
        default: throw GabrielVoiceError.notAllowed
        }
        guard let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { $0.voiceTraits.contains(.isPersonalVoice) }) else {
            throw GabrielVoiceError.noPersonalVoice
        }
        return voice
    }

    /// Speak one line in RSP_001's voice and return when it has finished.
    /// GABRIEL's manner (RSP_001, 2026-11-15): well-educated, unhurried, a late-night calm. Not British: it is his own voice.
    public func speak(_ text: String) async throws {
        let voice = try await personalVoice()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9   // a little slower than everyday speech
        utterance.pitchMultiplier = 0.96                            // a touch lower
        utterance.preUtteranceDelay = 0.15
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            finished = done
            synthesizer.speak(utterance)
        }
    }

    /// Stop at once (for HALT, or when RSP_001 starts to speak).
    public func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        guard let range = Range(characterRange, in: utterance.speechString) else { return }
        let word = String(utterance.speechString[range])
        DispatchQueue.main.async { self.onWord?(word) }
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { end() }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) { end() }

    private func end() {
        finished?.resume()
        finished = nil
        DispatchQueue.main.async { self.onFinish?() }
    }
}
